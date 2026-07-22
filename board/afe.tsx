/**
 * Analog front-end channel (real board-as-code)
 * ----------------------------------------------
 * One channel of the four-channel AFE, wired per the verified ngspice deck
 * sim/circuit/afe_hamamatsu_s12572.cir (HCal-tile S12572 path):
 *
 *   panel SiPM anode ─ Rser 10Ω ─ INA (summing node) ─ OPA858 IN_NEG
 *   OPA858 IN_POS ← VBOT (1.80 V, RC-filtered DAC ref)
 *   Rf 15k ‖ Cf 1.5p  between OPA858 FB pin and INA   (see note on FB)
 *   OPA858 OUT ─ dual TLV3601 comparators (low physics + high shower thr)
 *   comparator outputs ─ 33Ω ─ 6p ─ FPGA header
 *   INA clamped to VANA / GND by 1N4148W diodes
 *
 * OPA858 FB (pin 1) is INTERNALLY connected to OUT (pin 6) — TI OPA858
 * datasheet. The feedback network is therefore placed FB↔IN_NEG (lower
 * parasitics than routing to OUT); OUT drives the comparators separately.
 *
 * Real vendored ICs (imports/), real passive footprints + LCSC.
 * Rf/Cf, thresholds and clamp diodes are re-tuned from single-p.e. bench
 * calibration before freeze (values here are the sim starting points).
 *
 * Placement is generously spaced (no pad/courtyard overlaps); routing is
 * deferred (board is routingDisabled) and follows pcb/DESIGN_RULES.md.
 */
import { OPA858IDSGR } from "../imports/OPA858IDSGR"
import { TLV3601DCKR } from "../imports/TLV3601DCKR"

type ChannelProps = { index: number; x: number; y: number }

export const AfeChannel = ({ index: i, x, y }: ChannelProps) => {
  const n = (s: string) => `net.${s}${i}` // per-channel net helper
  const mm = (v: number) => `${v}mm`
  return (
    <group name={`AFE${i}`}>
      {/* Panel hybrid connector: SiPM signal, HV bias, GND, cold/hot NTC */}
      <pinheader
        name={`J_PANEL${i}`}
        pinCount={6}
        gender="female"
        pcbX={mm(x)}
        pcbY={mm(y + 30)}
        connections={{
          pin1: n("SIG"),
          pin2: n("HV"),
          pin3: "net.GND",
          pin4: n("NTC_C"),
          pin5: n("NTC_H"),
          pin6: "net.GND",
        }}
      />

      {/* Input series + rail clamp to the summing node */}
      <resistor name={`Rser${i}`} resistance="10" footprint="0402" pcbX={mm(x - 6)} pcbY={mm(y + 22)} connections={{ pin1: n("SIG"), pin2: n("INA") }} />
      <diode name={`D_CLH${i}`} footprint="sod123" supplierPartNumbers={{ jlcpcb: ["C2128"] }} pcbX={mm(x - 12)} pcbY={mm(y + 18)} connections={{ anode: n("INA"), cathode: "net.VANA" }} />
      <diode name={`D_CLL${i}`} footprint="sod123" supplierPartNumbers={{ jlcpcb: ["C2128"] }} pcbX={mm(x + 12)} pcbY={mm(y + 18)} connections={{ anode: "net.GND", cathode: n("INA") }} />

      {/* OPA858 transimpedance amplifier (clean 5 V analog rail) */}
      <OPA858IDSGR
        name={`U_TIA${i}`}
        pcbX={mm(x)}
        pcbY={mm(y + 12)}
        connections={{
          IN_NEG: n("INA"),
          IN_POS: "net.VBOTF",
          OUT: n("AOUT"),
          FB: n("FB"),
          VS_POS: "net.VANA",
          VS_NEG: "net.GND",
          PD: "net.VANA", // PD high = enabled
          EP: "net.GND",
        }}
      />
      {/* Feedback network on the FB pin (internally tied to OUT) */}
      <resistor name={`Rf${i}`} resistance="15k" footprint="0402" pcbX={mm(x - 10)} pcbY={mm(y + 9)} connections={{ pin1: n("FB"), pin2: n("INA") }} />
      <capacitor name={`Cf${i}`} capacitance="1.5pF" footprint="0402" pcbX={mm(x + 10)} pcbY={mm(y + 9)} connections={{ pin1: n("FB"), pin2: n("INA") }} />
      <capacitor name={`C_TIA${i}`} capacitance="100nF" footprint="0402" pcbX={mm(x + 14)} pcbY={mm(y + 12)} connections={{ pin1: "net.VANA", pin2: "net.GND" }} />

      {/* Dual comparators: signal on IN_POS, threshold on IN_NEG (3.3 V) */}
      <TLV3601DCKR
        name={`U_CMPL${i}`}
        pcbX={mm(x - 12)}
        pcbY={mm(y)}
        connections={{ IN_POS: n("AOUT"), IN_NEG: n("VTHLF"), OUT: n("CMPL"), VCC: "net.VDIG", VEE: "net.GND" }}
      />
      <TLV3601DCKR
        name={`U_CMPH${i}`}
        pcbX={mm(x + 12)}
        pcbY={mm(y)}
        connections={{ IN_POS: n("AOUT"), IN_NEG: n("VTHHF"), OUT: n("CMPH"), VCC: "net.VDIG", VEE: "net.GND" }}
      />
      <capacitor name={`C_CL${i}`} capacitance="100nF" footprint="0402" pcbX={mm(x - 18)} pcbY={mm(y)} connections={{ pin1: "net.VDIG", pin2: "net.GND" }} />
      <capacitor name={`C_CH${i}`} capacitance="100nF" footprint="0402" pcbX={mm(x + 18)} pcbY={mm(y)} connections={{ pin1: "net.VDIG", pin2: "net.GND" }} />

      {/* DAC threshold + bias references, RC-filtered (DAC nets driven later) */}
      <resistor name={`R_THL${i}`} resistance="1k" footprint="0402" pcbX={mm(x - 18)} pcbY={mm(y - 5)} connections={{ pin1: "net.VTHL_DAC", pin2: n("VTHLF") }} />
      <capacitor name={`C_THL${i}`} capacitance="100nF" footprint="0402" pcbX={mm(x - 12)} pcbY={mm(y - 5)} connections={{ pin1: n("VTHLF"), pin2: "net.GND" }} />
      <resistor name={`R_THH${i}`} resistance="1k" footprint="0402" pcbX={mm(x + 12)} pcbY={mm(y - 5)} connections={{ pin1: "net.VTHH_DAC", pin2: n("VTHHF") }} />
      <capacitor name={`C_THH${i}`} capacitance="100nF" footprint="0402" pcbX={mm(x + 18)} pcbY={mm(y - 5)} connections={{ pin1: n("VTHHF"), pin2: "net.GND" }} />

      {/* Bias reference RC (VBOT ~1.80 V from DAC) */}
      <resistor name={`R_VB${i}`} resistance="1k" footprint="0402" pcbX={mm(x - 4)} pcbY={mm(y - 5)} connections={{ pin1: "net.VBOT_DAC", pin2: "net.VBOTF" }} />
      <capacitor name={`C_VB${i}`} capacitance="100nF" footprint="0402" pcbX={mm(x + 4)} pcbY={mm(y - 5)} connections={{ pin1: "net.VBOTF", pin2: "net.GND" }} />

      {/* Comparator outputs → series damping → FPGA header */}
      <resistor name={`Rgl${i}`} resistance="33" footprint="0402" pcbX={mm(x - 12)} pcbY={mm(y - 10)} connections={{ pin1: n("CMPL"), pin2: n("FPAL") }} />
      <capacitor name={`Cgl${i}`} capacitance="6pF" footprint="0402" pcbX={mm(x - 6)} pcbY={mm(y - 10)} connections={{ pin1: n("FPAL"), pin2: "net.GND" }} />
      <resistor name={`Rgh${i}`} resistance="33" footprint="0402" pcbX={mm(x + 6)} pcbY={mm(y - 10)} connections={{ pin1: n("CMPH"), pin2: n("FPAH") }} />
      <capacitor name={`Cgh${i}`} capacitance="6pF" footprint="0402" pcbX={mm(x + 12)} pcbY={mm(y - 10)} connections={{ pin1: n("FPAH"), pin2: "net.GND" }} />

      <pinheader
        name={`J_FPGA${i}`}
        pinCount={4}
        gender="male"
        pcbX={mm(x)}
        pcbY={mm(y - 15)}
        connections={{ pin1: n("FPAL"), pin2: n("FPAH"), pin3: n("AOUT"), pin4: "net.GND" }}
      />
    </group>
  )
}

export default AfeChannel
