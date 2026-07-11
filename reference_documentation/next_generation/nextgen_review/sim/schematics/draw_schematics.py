#!/usr/bin/env python3
"""Schematics for the SiPM muon telescope front end."""
import schemdraw
import schemdraw.elements as elm
from schemdraw import flow

OUT = "/home/claude/muon/sch"

# =====================================================================
# 1. Per-channel analog schematic
# =====================================================================
with schemdraw.Drawing(file=f"{OUT}/channel_schematic.svg", show=False) as d:
    d.config(unit=2.2, fontsize=10)

    # --- HV entry / per-channel filter (top-left) ---
    hv = d.add(elm.Dot(open=True).label("HV_QUIET\n(+32.4 V)", "left"))
    d += elm.Resistor().right().label("R1\n100k").at(hv.start)
    cath = d.add(elm.Dot().label("CATH", "top"))
    d.push()
    d += elm.Capacitor().down().label("C1\n100n\n50V C0G", loc="bottom")
    d += elm.Ground()
    d.pop()

    # --- SiPM ---
    d += elm.Line().right(1.0)
    sipm = d.add(elm.Photodiode().down().reverse()
                 .label("D1\nS13360-2050VE\n(K up / A down)", loc="bottom", ofst=(1.4, 0)))
    d += elm.Line().down(0.4)
    anode = d.add(elm.Dot())

    # --- series protection + clamps ---
    d += elm.Resistor().right().label("R2\n10").at(anode.center)
    ina = d.add(elm.Dot().label("INA", "top"))
    d.push()
    d += elm.Diode().up().label("D2a\nBAV99", loc="bottom")
    d += elm.Vdd().label("+3V3")
    d.pop()
    d.push()
    d += elm.Diode().down().reverse().label("D2b", loc="bottom")
    d += elm.Ground()
    d.pop()

    # --- TIA ---
    d += elm.Line().right(0.8).at(ina.center)
    opamp = d.add(elm.Opamp(leads=True).anchor("in1").label("U1\nOPA858", "center", ofst=(0, .9)))
    # feedback Rf || Cf
    d += elm.Line().up(1.5).at(opamp.in1)
    fb_l = d.add(elm.Dot())
    d += elm.Resistor().right().label("Rf\n2k 1%").at(fb_l.center)
    d += elm.Line().right(1.05)
    fb_r = d.add(elm.Dot())
    d += elm.Line().down().toy(opamp.out)
    d += elm.Dot().at(opamp.out)
    d += elm.Capacitor().right().label("Cf\n2.2p C0G", loc="bottom").at(fb_l.center).up().theta(0)
    # actually draw Cf above Rf:
    d += elm.Line().up(1.2).at(fb_l.center)
    d += elm.Capacitor().right().label("Cf 2.2p C0G", loc="top")
    d += elm.Line().right(1.05)
    d += elm.Line().down(1.2).tox(fb_r.center)

    # non-inverting reference
    d += elm.Line().left(0.7).at(opamp.in2)
    d += elm.Resistor().down().label("R3\n1k", loc="bottom")
    vb = d.add(elm.Dot(open=True).label("CHx_VBOT\n(DAC4-7, 2.40 V)", "left"))
    d += elm.Capacitor().down().label("C2\n100n", loc="bottom").at(opamp.in2, dx=-0.7*2.2)
    # (cap from the in2 node junction)

    # --- comparator ---
    d += elm.Line().right(1.4).at(opamp.out)
    tia_out = d.add(elm.Dot().label("TIA_OUT", "top"))
    d += elm.Line().right(0.8)
    cmp = d.add(elm.Opamp(leads=True).anchor("in1").label("U2\nTLV3601", "center", ofst=(0, .9)))
    d += elm.Line().left(0.7).at(cmp.in2)
    d += elm.Resistor().down().label("R4\n1k", loc="bottom")
    th = d.add(elm.Dot(open=True).label("CHx_THRESH\n(DAC0-3, 2.326 V)", "left"))

    # output network
    d += elm.Resistor().right().label("R5\n33").at(cmp.out)
    d += elm.Line().right(0.6)
    d += elm.Dot(open=True).label("CHx_CMP\n→ iCE40 pin\n(active-low)", "right")

# =====================================================================
# 2. HV bias chain
# =====================================================================
with schemdraw.Drawing(file=f"{OUT}/hv_bias.svg", show=False) as d:
    d.config(unit=2.0, fontsize=10)
    src = d.add(elm.Dot(open=True).label("VSYS / VBAT\n(3.5-5 V)", "left"))
    d += elm.Line().right(0.8)
    boost = d.add(elm.Ic(pins=[elm.IcPin(name="VIN", side="left"),
                               elm.IcPin(name="SW", side="top"),
                               elm.IcPin(name="FB", side="bottom"),
                               elm.IcPin(name="VOUT", side="right")],
                         edgepadW=1.2, edgepadH=0.8)
                  .label("U10 TPS61170\nboost, 1.2 MHz", "center", ofst=(0, -0.05))
                  .anchor("VIN"))
    d += elm.Line().right(0.9).at(boost.VOUT)
    hvraw = d.add(elm.Dot().label("HV_RAW ≈ 33 V", "top"))
    d.push()
    d += elm.Capacitor().down().label("C10\n1u 50V", loc="bottom")
    d += elm.Ground()
    d.pop()
    d += elm.Inductor().right().label("L2\n100u").at(hvraw.center)
    mid = d.add(elm.Dot())
    d.push()
    d += elm.Capacitor().down().label("C11\n1u 50V", loc="bottom")
    d += elm.Ground()
    d.pop()
    d += elm.Resistor().right().label("R10\n1k").at(mid.center)
    hvq = d.add(elm.Dot().label("HV_QUIET", "top"))
    d.push()
    d += elm.Capacitor().down().label("C12\n2.2u 50V\nfilm/C0G", loc="bottom")
    d += elm.Ground()
    d.pop()
    d += elm.Line().right(0.8).at(hvq.center)
    d += elm.Dot(open=True).label("→ 4× per-channel\n100k + 100n RC", "right")

    # DAC trim of feedback node
    d += elm.Line().down(1.0).at(boost.FB)
    fbn = d.add(elm.Dot().label("FB", "right"))
    d += elm.Resistor().up().label("R11 270k", loc="bottom").at(fbn.center).theta(90)
    # feedback divider sketch
    d += elm.Resistor().down().label("R12 10k", loc="bottom").at(fbn.center)
    d += elm.Ground()
    d += elm.Resistor().right().label("R13 100k", loc="bottom").at(fbn.center)
    d += elm.Dot(open=True).label("HV_TRIM\n(DAC / PWM-RC)", "right")

    # readback divider
    d += elm.Resistor().down().label("R14 1M", loc="bottom").at(hvq.center, dx=0.8*2.0)

# =====================================================================
# 3. System block diagram
# =====================================================================
with schemdraw.Drawing(file=f"{OUT}/system_block.svg", show=False) as d:
    d.config(fontsize=10, unit=1.6)
    def box(label, w=3.0, h=1.3):
        return flow.Box(w=w, h=h).label(label)

    paddle = d.add(box("4× EJ-200 paddle\n+ WLS + SiPM", 3.4, 1.5))
    d += elm.Arrow().right(1.2).at(paddle.E)
    afe = d.add(box("4× analog FE\nOPA858 TIA\nTLV3601 cmp", 3.2, 1.8).anchor("W"))
    d += elm.Arrow().right(1.2).at(afe.E).label("4× CMP\n(act. low)", fontsize=8)
    fpga = d.add(box("iCE40UP5K\nedge capture, coinc,\nToT hist, shadow,\nlifetime, PPS latch", 3.8, 2.2).anchor("W"))
    d += elm.Arrow().right(1.2).at(fpga.E).label("SPI regs", fontsize=8)
    mcu = d.add(box("nRF9151\nhousekeeping +\nLTE-M uplink", 3.2, 1.8).anchor("W"))

    gps = d.add(box("LC76G GNSS", 2.6, 1.0).at((fpga.N[0]-1.0, fpga.N[1]+1.6)))
    d += elm.Arrow().down(1.1).at(gps.S).label("PPS", fontsize=8, loc="bottom")
    d += elm.Arrow().right(2.2).at(gps.E).label("NMEA UART", fontsize=8)

    i2c = d.add(box("I²C: BME280,\nDAC7578, INA228,\nMAX17048, 4× NTC→ADC", 3.6, 1.8).at((mcu.S[0]-0.3, mcu.S[1]-2.6)))
    d += elm.Arrow().up(0.8).at(i2c.N)

    hv = d.add(box("TPS61170 boost\n→ π filter → HV_QUIET\n+ DAC trim + readback", 3.6, 1.8).at((paddle.S[0], paddle.S[1]-2.6)))
    d += elm.Arrow().up(0.8).at(hv.N).label("+32 V", fontsize=8)

    pwr = d.add(box("Maxeon cell → MPPT\ncharger → LiPo → VSYS", 3.6, 1.4).at((hv.S[0], hv.S[1]-2.2)))
    d += elm.Arrow().up(0.8).at(pwr.N)

print("schematics done")
