#!/usr/bin/env python3
"""Muon3 station: automated board test + tile calibration over USB-CDC. No scope, no fixture needed.

  python tools/station_test.py board [--port /dev/cu.usbmodem*]   # factory test, nothing on the jacks  (~2 min)
  python tools/station_test.py tile  --ch 0 [--vop 69.2]          # per-tile gain + threshold, tile attached (~10 min)

Firmware line protocol (ESP32-S3 USB-CDC, 115200, one command per line, one reply line "OK ..." or "ERR ..."):
  ID?                       -> OK <mac> <fw-version>
  I2C?                      -> OK 0:76 0:19 0:60 1:60          (bus:addr found)
  ENV?                      -> OK <T degC> <P hPa> <RH %>
  HV <0|1>                  -> OK                                (HV_EN)
  TRIM <volts 0..2.048>     -> OK                                (MCP4728 B ch B)
  HVMON?                    -> OK <volts at the ADC pin, averaged 64x>
  HVSET <volts>             -> OK                                (closed loop on HV_MON with the stored hv_a/hv_b,
                                                                  plus 60 mV/K BME280 feed-forward)
  VREF <volts>              -> OK                                (MCP4728 B ch A, common TIA baseline)
  VTH <ch> <volts>          -> OK                                (MCP4728 A ch 0..3)
  INJ <n> <period_us>       -> OK                                (n injection pulses, both edges inject)
  COUNT <ch> <ms>           -> OK <hits>                         (PCNT, rising edges, pulses < 20 ns ignored)
  SAVE <key> <value>        -> OK                                (NVS calibration store)
Limits come from the simulations in hw/sim (see hw/docs/TESTING.md).
"""
import argparse, glob, sys, time

HV_PER_MON = 27.7                     # HV = HV_MON × 27.7 (1 M + 1 M + 75 k divider)
LIM = {
    "i2c": {"0:76", "0:19", "0:60", "1:60"},       # BME280, SC7A20H, DAC A (I2C0), DAC B (I2C1)
    "hv_off": (2.5, 5.5),             # HV_EN low: USB 5 V through the boost diode   [SIM ≈ 4 V]
    "hv_trim0": (80.0, 86.5),         # TRIM 0 V                                      [SIM 83.0 V]
    "hv_trim1": (65.5, 71.5),         # TRIM 1.0 V                                    [SIM 68.4 V]
    "hv_trim2": (50.0, 56.0),         # TRIM 2.048 V                                  [SIM 52.9 V]
    "inj_mv": (85.0, 135.0),          # injection 50 % point below VREF, no tile     [SIM 109 mV]
    "noise_mv": (0.0, 8.0),           # baseline noise edge below VREF, no tile       [SIM < 3 mV]
}
VREF = 2.50

class Station:
    def __init__(self, port):
        import serial                  # pyserial
        self.s = serial.Serial(port, 115200, timeout=5)
        time.sleep(0.2); self.s.reset_input_buffer()
    def cmd(self, line):
        self.s.write((line + "\n").encode())
        r = self.s.readline().decode().strip()
        if not r.startswith("OK"): raise RuntimeError(f"{line!r} -> {r!r}")
        return r[2:].split()

def check(name, v, lo_hi):
    lo, hi = lo_hi
    ok = lo <= v <= hi
    print(f"  {'PASS' if ok else 'FAIL'}  {name:<28} {v:9.3f}   [{lo}, {hi}]")
    return ok

def edge_scan(st, ch, lo_mv, hi_mv, step_mv, inj=False, ms=100):
    """Threshold staircase: rate vs. VTH depth below VREF. Returns [(depth_mV, counts)]."""
    out = []
    for d in range(int(lo_mv), int(hi_mv) + 1, int(step_mv)):
        st.cmd(f"VTH {ch} {VREF - d / 1000:.4f}")
        if inj: st.cmd(f"INJ 100 {ms * 10}")         # 100 pulses spread over the gate
        out.append((d, int(st.cmd(f"COUNT {ch} {ms}")[0])))
    return out

def fifty(scan, n_expected):
    """Depth where counts drop through 50 % of n_expected (linear interpolation)."""
    for (d0, c0), (d1, c1) in zip(scan, scan[1:]):
        if c0 >= n_expected / 2 > c1:
            return d0 + (d1 - d0) * (c0 - n_expected / 2) / max(c0 - c1, 1)
    return float("nan")

def board(st):
    ok = True
    print("board:", *st.cmd("ID?"))
    found = set(st.cmd("I2C?"))
    ok &= check("I2C devices present", len(LIM["i2c"] & found), (4, 4))
    t, p, rh = map(float, st.cmd("ENV?")); ok &= check("BME280 pressure hPa", p, (850, 1090))
    st.cmd(f"VREF {VREF}")
    st.cmd("HV 0"); time.sleep(0.5)
    ok &= check("HV off (V)", float(st.cmd("HVMON?")[0]) * HV_PER_MON, LIM["hv_off"])
    st.cmd("HV 1"); pts = []
    for trim, key in ((0.0, "hv_trim0"), (1.0, "hv_trim1"), (2.048, "hv_trim2")):
        st.cmd(f"TRIM {trim}"); time.sleep(0.4)        # RC post-filter + HV caps settle ≈ 0.1 s [SIM]
        hv = float(st.cmd("HVMON?")[0]) * HV_PER_MON; pts.append((trim, hv))
        ok &= check(f"HV at TRIM {trim} V", hv, LIM[key])
    # 2-point calibration HV(TRIM) = a + b·TRIM, stored for the tile step
    (t0, h0), (t2, h2) = pts[0], pts[2]
    b = (h2 - h0) / (t2 - t0); st.cmd(f"SAVE hv_a {h0:.3f}"); st.cmd(f"SAVE hv_b {b:.4f}")
    st.cmd("TRIM 2.048"); st.cmd("HV 0")                # leave the bias low and off
    for ch in range(4):
        noise = edge_scan(st, ch, 0, 20, 1, inj=False)
        edge = next((d for d, c in noise if c == 0), 99)
        ok &= check(f"ch{ch} noise edge (mV)", edge, LIM["noise_mv"])
        inj = edge_scan(st, ch, 60, 160, 2, inj=True)
        a = fifty(inj, 200)                              # both edges inject: 2 hits per pulse
        ok &= check(f"ch{ch} injection 50 % (mV)", a, LIM["inj_mv"])
        st.cmd(f"SAVE inj{ch} {a:.2f}")
    print("BOARD", "PASS" if ok else "FAIL")
    return ok

def tile(st, ch, vop):
    """Dark-count staircase at V_op: the spacing of the steps is the 1 p.e. amplitude (gain); set VTH at 5 p.e."""
    st.cmd(f"VREF {VREF}"); st.cmd("HV 1")
    st.cmd(f"HVSET {vop:.2f}"); time.sleep(1.0)
    scan = edge_scan(st, ch, 1, 40, 1, inj=False, ms=200)
    # derivative of the log-rate: peaks sit between p.e. steps
    import math
    r = [math.log(max(c, 1)) for _, c in scan]
    dr = [r[i] - r[i + 1] for i in range(len(r) - 1)]
    peaks = [scan[i][0] + 0.5 for i in range(1, len(dr) - 1) if dr[i] > dr[i - 1] and dr[i] >= dr[i + 1] and dr[i] > 0.3]
    if len(peaks) < 2:
        print("  FAIL  no p.e. staircase: tile, bias or light-tightness?"); return False
    pe_mv = (peaks[-1] - peaks[0]) / (len(peaks) - 1)
    print(f"  1 p.e. = {pe_mv:.2f} mV  (target 5.8 mV at V_op; adjust V_op by ΔV = (5.8/{pe_mv:.2f} - 1)·(V_op - V_bd))")
    vth = 5 * pe_mv
    st.cmd(f"VTH {ch} {VREF - vth / 1000:.4f}"); st.cmd(f"SAVE vth{ch} {vth:.2f}"); st.cmd(f"SAVE pe{ch} {pe_mv:.3f}")
    rate = int(st.cmd(f"COUNT {ch} 10000")[0]) / 10
    print(f"  VTH = 5 p.e. = {vth:.1f} mV, singles {rate:.1f} /s  (expect ≈ 1-3 /s per tile for muons + tail of dark counts)")
    return True

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["board", "tile"])
    ap.add_argument("--port", default=(glob.glob("/dev/cu.usbmodem*") + glob.glob("/dev/ttyACM*") + [None])[0])
    ap.add_argument("--ch", type=int, default=0)
    ap.add_argument("--vop", type=float, default=69.0, help="tile operating voltage from the GSU/Hamamatsu sheet")
    a = ap.parse_args()
    if not a.port: sys.exit("no USB-CDC port found")
    st = Station(a.port)
    sys.exit(0 if (board(st) if a.mode == "board" else tile(st, a.ch, a.vop)) else 1)
