#!/usr/bin/env python3
"""Per-channel schematic, explicit layout."""
import schemdraw
import schemdraw.elements as elm

OUT = "/home/claude/muon/sch"

with schemdraw.Drawing(file=f"{OUT}/channel_schematic.svg", show=False) as d:
    d.config(unit=2.0, fontsize=11)

    # ---------- HV / SiPM column ----------
    hv = d.add(elm.Dot(open=True).at((0, 6)).label("HV_QUIET\n+32.4 V", "left"))
    d += elm.Resistor().right().at((0, 6)).label("R1\n100k")
    cath = d.add(elm.Dot().label("CATH", "top"))
    # local HV reservoir
    d += elm.Capacitor().down().at(cath.center).label("C1  100n 50V C0G", loc="bottom", ofst=(0.1, 0))
    d += elm.Ground()
    # SiPM from cathode to anode (signal current exits anode)
    d += elm.Line().right(1.6).at(cath.center)
    ktop = d.add(elm.Dot())
    sipm = d.add(elm.Photodiode().down().at(ktop.center)
                 .label("D1\nS13360-2050VE", loc="bottom", ofst=(1.05, 0.2)))
    d += elm.Line().down(0.6)
    an = d.add(elm.Dot().label("A", "left"))

    # ---------- protection / summing node ----------
    d += elm.Resistor().right().at(an.center).label("R2\n10")
    ina = d.add(elm.Dot().label("INA", "top", ofst=(-.25, 0)))
    # clamp diodes
    d += elm.Diode().up().at(ina.center).label("D2a\nBAV99", loc="bottom", ofst=(0.6, 0))
    d += elm.Vdd().label("+3V3")
    d += elm.Diode().down().at(ina.center).reverse().label("D2b\nBAV99", loc="bottom", ofst=(0.6, 0))
    d += elm.Ground()

    # ---------- TIA ----------
    d += elm.Line().right(1.3).at(ina.center)
    op = d.add(elm.Opamp(leads=True).anchor("in1").label("U1\nOPA858", "center", ofst=(0, 1.0)))
    # in1 is inverting input (top) — correct for TIA
    # feedback: Rf and Cf in parallel above the amp
    inx = (ina.center[0] + 1.3*2.0*0.0 + 1.3, ina.center[1])  # start of lead
    d += elm.Line().up(1.6).at(op.in1)
    f1 = d.add(elm.Dot())
    d += elm.Resistor().right(3.6).at(f1.center).label("Rf  2k 1%", loc="top")
    f2 = d.add(elm.Dot())
    d += elm.Line().down(1.6).at(f2.center).toy(op.out)
    outdot = d.add(elm.Dot().at((f2.center[0], op.out[1])))
    d += elm.Line().up(1.4).at(f1.center)
    d += elm.Capacitor().right(3.6).label("Cf  2.2p C0G", loc="top")
    d += elm.Line().down(1.4)
    # non-inverting reference with RC filter
    d += elm.Line().left(0.9).at(op.in2)
    j = d.add(elm.Dot())
    d += elm.Capacitor().down().at(j.center).label("C2\n100n", loc="bottom", ofst=(0.5, 0))
    d += elm.Ground()
    d += elm.Resistor().left().at(j.center).label("R3\n1k", loc="top")
    d += elm.Dot(open=True).label("CHx_VBOT  (DAC4-7)\n2.40 V baseline", "bottom", ofst=(0, -0.2))

    # ---------- comparator ----------
    d += elm.Line().right(1.0).at(op.out).tox(outdot.center)
    d += elm.Line().right(1.2).at(outdot.center)
    tiao = d.add(elm.Dot().label("TIA_OUT", "top"))
    d += elm.Line().right(0.9)
    # need TIA on IN+ (in2, bottom) for active-low output: route down then in
    d += elm.Line().down(0.62)
    d += elm.Line().right(0.9)
    cmp = d.add(elm.Opamp(leads=True).anchor("in2").label("U2\nTLV3601", "center", ofst=(0, 1.0)))
    # threshold to IN- (in1, top)
    d += elm.Line().left(0.9).at(cmp.in1)
    d += elm.Line().up(0.8)
    jt = d.add(elm.Dot())
    d += elm.Capacitor().right().at(jt.center).label("C3\n100n", loc="top", ofst=(0.3, 0))
    d += elm.Ground()
    d += elm.Resistor().up().at(jt.center).label("R4\n1k", loc="bottom", ofst=(0.6, 0))
    d += elm.Dot(open=True).label("CHx_THRESH  (DAC0-3)\n2.326 V = 3 p.e.", "top", ofst=(0, 0.15))

    # output
    d += elm.Resistor().right().at(cmp.out).label("R5\n33", loc="top")
    d += elm.Line().right(0.7)
    d += elm.Dot(open=True).label("CHx_CMP → iCE40\nidle HIGH, pulse LOW", "right")

print("channel schematic redrawn")
