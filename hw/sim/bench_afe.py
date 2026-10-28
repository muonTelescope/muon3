"""ngspice: one bench channel with the parasitics the layout sets (hw/out/bench/board.json).

Chain: S12572-015 SiPM (QPE 36.8 fC, Ct 320 pF, 1 / 20 ns) [on the SMA directly | on 50 cm RG316 | nothing: SMA open,
injection only] -> SIG node (trace C from its routed length per layer + BAV99 2 x 1.5 pF + OPA356 2 pF + 2 x 1 pF injection
caps + 0.5 pF SMA pad) -> OPA356 TIA 33k || 2.7p (GBW 200 MHz, 360 V/us) referenced to VREF -> 0R -> LMV7219 (7 ns, 1.3 ns
edges, no hysteresis [EST]) against VTH -> 33R -> HIT (FPGA pin 5 pF) and 100R -> CMP OUT U.FL (open, 1 pF).
Cfb: a capacitor from the comparator output to SIG — the self-coupling the layout allows (bench_traces.py / openEMS), swept to
find the margin before the channel re-triggers on its own edge.
1. AC: transimpedance |Zt(f)| peaking and bandwidth for each input case (stability).
2. Transient: 1, 5, 30 p.e. pulses: TIA peak, 10-90 % rise, undershoot; comparator pulse count (re-trigger check).
3. Bias boost ripple: MC34063 boost (hv_rev2.inc, the bench uses the same chain: 10k + 1 uF, 47k + 100 nF per channel) ->
   SiPM Ct -> TIA output ripple, compared with one p.e.
Writes out/bench/sim/afe.json and docs/bench/sim_afe.png. Usage: python3 hw/sim/bench_afe.py
"""
import json, math, os, re, subprocess
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from bench_copper import OUT, DOCS, by_net, microstrip, ref_height

HERE = os.path.dirname(os.path.abspath(__file__))
QPE = 36.8e-15
# SIG trace capacitance from the routed copper (channel 1; the four cells are copies)
c_trace = sum(math.dist(t["a"], t["b"]) * microstrip(t["w"], *ref_height(t["layer"]))[2] for t in by_net()["SIG1"]["tracks"])   # pF
C_IN = c_trace + 3.0 + 2.0 + 2.0 + 0.5
VREF, VDD = 3.0, 3.3

MODELS = f"""
.subckt SIPM A K NPE=1 QPE=36.8f TAUR=1n TAUD=20n T0=100n CT=320p
Bp K A I = (time > {{T0}}) ? {{NPE*QPE/(TAUD-TAUR)}} * ( exp(-(time-{{T0}})/{{TAUD}}) - exp(-(time-{{T0}})/{{TAUR}}) ) : 0
Ct A K {{CT}}
.ends
* OPA356: GBW 200 MHz, slew 360 V/us, rail-to-rail output on 3.3 V
.subckt OPA356 INP INN OUT
Gm 0 n1 INP INN 1m
R1 n1 0 1Meg
C1 n1 0 {{1m/(6.2832*200Meg)}}
Bsr 0 s I = ( (v(n1)-v(s)) > 0.01 ? 3.6m : ((v(n1)-v(s)) < -0.01 ? -3.6m : (v(n1)-v(s))*0.36 ) )
Cs s 0 10p
Rs s 0 1G
Bout o1 0 V = v(s) > 3.25 ? 3.25 : (v(s) < 0.05 ? 0.05 : v(s))
Ro o1 OUT 10
.ends
* LMV7219: 7 ns propagation, 1.3 ns edges, push-pull 3.3 V, no hysteresis [EST]
.subckt LMV7219 INP INN OUT
Bd d 0 V = v(INP) > v(INN) ? {VDD} : 0
Td d 0 dl 0 Z0=50 TD=5n
Rt dl 0 50
Bo o1 0 V = 2*v(dl)
Ro o1 o2 30
Co o2 0 25p
Rx o2 OUT 1
.ends
"""

def run(cir, name):
    path = os.path.join(OUT, name + ".cir")
    open(path, "w").write(cir)
    r = subprocess.run(["ngspice", "-b", path], capture_output=True, text=True, cwd=HERE)
    meas = {m.group(1).lower(): float(m.group(2)) for m in re.finditer(r"^(\w+)\s*=\s*([-+0-9.eE]+)", r.stdout, re.M)}
    return meas, r

def frontend(case):
    """Netlist lines for the input side: SiPM (or none) into node sig. Returns (lines, Cin_extra_text)."""
    if case == "open": return ""
    if case == "direct": return "X1 sig hvj SIPM NPE={NPE}\nVhv hvj 0 0\n"
    if case == "coax50": return "X1 far hvj SIPM NPE={NPE}\nVhv hvj 0 0\nT1 far 0 sig 0 Z0=50 TD=2.5n\n"

CASES = {"open": "SMA open (injection only)", "direct": "SiPM on the SMA", "coax50": "SiPM on 50 cm RG316"}

def ac(case):
    cir = f"""* AC transimpedance, {case}
{MODELS}
.param NPE=0
Iin 0 sig AC 1
{frontend(case).replace('NPE={NPE}', 'NPE=0')}
Csig sig 0 {C_IN:.3f}p
Vref vref 0 {VREF}
X2 vref sig tia OPA356
Rf tia sig 33k
Cf tia sig 2.7p
.control
ac dec 60 10k 1G
let zt = mag(v(tia))
meas ac zdc find zt at=100k
meas ac zpk max zt
meas ac fpk when zt=zpk
let half = zdc/sqrt(2)
meas ac f3db when zt=half fall=last
wrdata {OUT}/afe_ac_{case}.txt zt
.endc
.end
"""
    m, _ = run(cir, f"afe_ac_{case}")
    return {"Zdc_kohm": m.get("zdc", float("nan")) / 1e3, "peaking_dB": 20 * math.log10(m.get("zpk", 1) / m.get("zdc", 1)),
            "f_peak_MHz": m.get("fpk", float("nan")) / 1e6, "f3dB_MHz": m.get("f3db", float("nan")) / 1e6}

def tran(case, npe, cfb_ff, vth_pe=2.5, inj=False):
    pe_amp = PE_AMP.get(case, 0.006)
    vth = VREF - vth_pe * pe_amp
    src = frontend(case) if not inj else ""
    if inj:   # 1 V, 2 ns step into INJ IN (50R terminated, 1 pF into SIG) = 1 pC = 27 p.e.
        src = f"Vinj injx 0 PULSE(0 {npe / 27.2:.4f} 100n 2n 2n 400n 1u)\nCinj injx sig 1p\n"
    cir = f"""* transient, {case}, {npe} pe, Cfb {cfb_ff} fF
{MODELS}
.param NPE={npe}
{src}
Csig sig 0 {C_IN:.3f}p
Vref vref 0 {VREF}
X2 vref sig tia OPA356
Rf tia sig 33k
Cf tia sig 2.7p
Vth vth 0 {vth:.4f}
X3 vth tia cmp LMV7219
Rh cmp hit 33
Chit hit 0 5p
Rc cmp cmpo 100
Cc cmpo 0 1p
Cfb cmp sig {cfb_ff}f
.control
tran 0.1n 1.2u 0 0.1n
meas tran tmin min v(tia) from=90n to=600n
meas tran tmax max v(tia) from=150n to=1.2u
meas tran trise trig v(tia) val={VREF - 0.1 * 0.0:.3f} fall=1 targ v(tia) val={VREF:.3f} fall=1
let cnt = 0
meas tran nrise find v(hit) at=1.19u
wrdata {OUT}/afe_tr_{case}_{npe}_{cfb_ff}.txt v(tia) v(hit)
.endc
.end
"""
    m, r = run(cir, f"afe_tr_{case}_{npe}_{cfb_ff}")
    d = np.loadtxt(os.path.join(OUT, f"afe_tr_{case}_{npe}_{cfb_ff}.txt"))
    t, vt, vh = d[:, 0], d[:, 1], d[:, 3]
    hi = vh > VDD / 2
    edges = int(np.sum(hi[1:] & ~hi[:-1]))
    amp = VREF - vt.min()
    i0 = np.argmax(vt < VREF - 0.1 * amp); i1 = np.argmax(vt < VREF - 0.9 * amp)
    under = max(0.0, vt[t > t[np.argmin(vt)]].max() - VREF)
    return {"peak_mV": amp * 1e3, "rise_ns": (t[i1] - t[i0]) * 1e9, "undershoot_mV": under * 1e3, "comparator_pulses": edges,
            "t": t, "v": vt, "hit": vh}

def ripple():
    cir = f"""* bias boost ripple to the TIA output (bench chain = hv_rev2)
.include {os.path.join(HERE, 'hv_rev2.inc')}
.param VDAC=1.0 TEN=5m
Ru raw fb 1.02Meg
Rl fb 0 20k
Vdac dac 0 {{VDAC}}
Rf1 dac tf 1k
Ctf tf 0 100n
Rd tf fb 68k
Rpx v33 x 10k
Den x fb LL4148
Ven en 0 PULSE(0 1 {{TEN}} 1u 1u 10 20)
Bnm x 0 I = v(en) > 0.5 ? v(x) / 5 : v(x) * 1e-9
Csipm j1 tin 320p
Csig tin 0 {C_IN:.3f}p
Vref vref 0 {VREF}
X2 vref tin tia OPA356
Rf tia tin 33k
Cf tia tin 2.7p
{MODELS.split('* LMV7219')[0]}
.control
save v(hv) v(j1) v(tia)
tran 50n 120m 90m 50n uic
meas tran hvavg avg v(hv) from=100m to=120m
meas tran hva avg v(hv) from=100m to=110m
meas tran hvb avg v(hv) from=110m to=120m
meas tran hvpp pp v(hv) from=110m to=120m
meas tran j1pp pp v(j1) from=110m to=120m
meas tran tiapp pp v(tia) from=110m to=120m
.endc
.end
"""
    m, r = run(cir, "afe_ripple")
    if not m: print(r.stdout[-1500:], r.stderr[-1500:])
    return {"HV_V": m.get("hvavg"), "HV_drift_mV_per_10ms": (m.get("hvb", float("nan")) - m.get("hva", float("nan"))) * 1e3, "HV_ripple_mVpp": m.get("hvpp", float("nan")) * 1e3, "HVJ_ripple_uVpp": m.get("j1pp", float("nan")) * 1e6,
            "TIA_ripple_mVpp": m.get("tiapp", float("nan")) * 1e3}

if __name__ == "__main__":
    print(f"SIG node: trace {c_trace:.2f} pF + parts -> {C_IN:.2f} pF")
    res = {"C_in_pF": C_IN, "C_trace_pF": c_trace, "ac": {c: ac(c) for c in CASES}}
    for c, r in res["ac"].items(): print(f"  AC {CASES[c]:28s} Zt {r['Zdc_kohm']:.1f} k, peaking {r['peaking_dB']:.1f} dB at {r['f_peak_MHz']:.1f} MHz, BW {r['f3dB_MHz']:.1f} MHz")
    # one p.e. amplitude per case sets the thresholds
    PE_AMP = {}
    for c in ("direct", "coax50"):
        PE_AMP[c] = tran(c, 1, 0)["peak_mV"] / 1e3
    PE_AMP["open"] = tran("open", 27.2, 0, inj=True)["peak_mV"] / 1e3 / 27.2
    res["pe_amp_mV"] = {k: v * 1e3 for k, v in PE_AMP.items()}
    print("  1 p.e. at the TIA output:", {k: round(v, 2) for k, v in res["pe_amp_mV"].items()}, "mV")
    res["tran"] = {}
    for c in ("direct", "coax50"):
        for npe in (1, 5, 30):
            r = tran(c, npe, 0); res["tran"][f"{c}_{npe}"] = {k: v for k, v in r.items() if not isinstance(v, np.ndarray)}
            print(f"  {CASES[c]:22s} {npe:3d} pe: peak {r['peak_mV']:7.1f} mV, rise {r['rise_ns']:4.1f} ns, undershoot {r['undershoot_mV']:5.2f} mV, comparator pulses {r['comparator_pulses']}")
    # re-trigger margin: comparator output -> SIG coupling sweep, 5 p.e. pulse, threshold 2.5 p.e.
    res["cfb_sweep"] = {}
    for c in ("direct", "coax50"):
        for cfb in (0, 1, 3, 10, 30, 100):
            r = tran(c, 5, cfb); res["cfb_sweep"][f"{c}_{cfb}"] = {"pulses": r["comparator_pulses"], "peak_mV": r["peak_mV"]}
        print(f"  re-trigger sweep {CASES[c]}: " + ", ".join(f"{cfb} fF -> {res['cfb_sweep'][f'{c}_{cfb}']['pulses']}" for cfb in (0, 1, 3, 10, 30, 100)))
    res["ripple"] = ripple()
    print("  bias ripple:", {k: (round(v, 3) if v is not None else None) for k, v in res["ripple"].items()})
    json.dump(res, open(os.path.join(OUT, "afe.json"), "w"), indent=1)
    # figure: Zt(f) per case, and 1/5/30 p.e. pulses on the SMA
    fig, ax = plt.subplots(1, 2, figsize=(13, 4.6))
    for c in CASES:
        d = np.loadtxt(os.path.join(OUT, f"afe_ac_{c}.txt")); ax[0].loglog(d[:, 0], d[:, 1] / 1e3, label=CASES[c])
    ax[0].set_xlabel("frequency (Hz)"); ax[0].set_ylabel("|Zt| (kohm)"); ax[0].set_title(f"TIA transimpedance (C_SIG {C_IN:.1f} pF from layout)"); ax[0].legend(); ax[0].grid(alpha=.3, which="both")
    for npe in (1, 5, 30):
        r = tran("direct", npe, 0); ax[1].plot((r["t"] - 100e-9) * 1e9, (VREF - r["v"]) * 1e3, label=f"{npe} p.e.")
    ax[1].set_xlim(-20, 600); ax[1].set_yscale("symlog", linthresh=10); ax[1].set_xlabel("time (ns)"); ax[1].set_ylabel("VREF - TIA (mV)")
    ax[1].set_title("TIA output, SiPM on the SMA"); ax[1].legend(); ax[1].grid(alpha=.3)
    fig.tight_layout(); fig.savefig(os.path.join(DOCS, "sim_afe.png"), dpi=130); print("wrote", os.path.join(DOCS, "sim_afe.png"))
