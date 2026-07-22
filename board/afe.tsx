/**
 * Analog front-end channel (real board-as-code)
 * ----------------------------------------------
 * One channel of the four-channel AFE, wired per the verified ngspice deck
 * sim/circuit/afe_hamamatsu_s12572.cir (HCal-tile S12572 path):
 *
 *   panel SiPM anode ─ Rser 10Ω ─ INA (summing node) ─ OPA858 IN_NEG
 *   OPA858 IN_POS ← VBOT (1.80 V, RC-filtered DAC ref)
 *   Rf 15k ‖ Cf 1.5p  between OPA858 FB pin and INA   (FB internally = OUT)
 *   OPA858 OUT ─ dual TLV3601 comparators (low physics + high shower thr)
 *   comparator outputs ─ 33Ω ─ 6p ─ FPGA header
 *   INA clamped to VANA / GND by 1N4148W diodes
 *
 * Compact vertical strip (~18 mm wide x ~40 mm tall) so four channels tile
 * across the AFE zone (board/layout.ts). Panel connector at the top (board
 * top edge, short SiPM signal path); FPGA header at the bottom toward the
 * digital zone. Vendored OPA858/TLV3601 (board/imports), real passives+LCSC.
 */
import { OPA858IDSGR } from "./imports/OPA858IDSGR"
import { TLV3601DCKR } from "./imports/TLV3601DCKR"

type ChannelProps = { index: number; x: number; cy: number }

export const AfeChannel = ({ index: i, x, cy }: ChannelProps) => {
  const n = (s: string) => `net.${s}${i}`
  // channel-relative placement: p(dx, dy) around the strip center (x, cy)
  const p = (dx: number, dy: number) => ({ pcbX: `${x + dx}mm`, pcbY: `${cy + dy}mm` })
  return (
    <group name={`AFE${i}`} pcbX="0mm" pcbY="0mm">
      {/* Panel hybrid connector (top edge): SiPM signal, HV bias, GND, NTCs */}
      <pinheader
        name={`J_PANEL${i}`}
        pinCount={6}
        gender="female"
        {...p(0, 20)}
        connections={{ pin1: n("SIG"), pin2: n("HV"), pin3: "net.GND", pin4: n("NTC_C"), pin5: n("NTC_H"), pin6: "net.GND" }}
      />

      {/* Input series + rail clamp to the summing node */}
      <diode name={`D_CLH${i}`} footprint="sod123" supplierPartNumbers={{ jlcpcb: ["C2128"] }} {...p(-6, 14)} connections={{ anode: n("INA"), cathode: "net.VANA" }} />
      <resistor name={`Rser${i}`} resistance="10" footprint="0402" {...p(0, 14)} connections={{ pin1: n("SIG"), pin2: n("INA") }} />
      <diode name={`D_CLL${i}`} footprint="sod123" supplierPartNumbers={{ jlcpcb: ["C2128"] }} {...p(6, 14)} connections={{ anode: "net.GND", cathode: n("INA") }} />

      {/* OPA858 TIA + feedback on the FB pin (internally tied to OUT) */}
      <OPA858IDSGR
        name={`U_TIA${i}`}
        {...p(0, 9)}
        connections={{ IN_NEG: n("INA"), IN_POS: "net.VBOTF", OUT: n("AOUT"), FB: n("FB"), VS_POS: "net.VANA", VS_NEG: "net.GND", PD: "net.VANA", EP: "net.GND" }}
      />
      <capacitor name={`C_TIA${i}`} capacitance="100nF" footprint="0402" {...p(6, 9)} connections={{ pin1: "net.VANA", pin2: "net.GND" }} />
      <resistor name={`Rf${i}`} resistance="15k" footprint="0402" {...p(-5, 4.5)} connections={{ pin1: n("FB"), pin2: n("INA") }} />
      <capacitor name={`Cf${i}`} capacitance="1.5pF" footprint="0402" {...p(5, 4.5)} connections={{ pin1: n("FB"), pin2: n("INA") }} />

      {/* Bias reference RC (VBOT ~1.80 V from DAC) */}
      <resistor name={`R_VB${i}`} resistance="1k" footprint="0402" {...p(-7, 0)} connections={{ pin1: "net.VBOT_DAC", pin2: "net.VBOTF" }} />
      <capacitor name={`C_VB${i}`} capacitance="100nF" footprint="0402" {...p(-2.5, 0)} connections={{ pin1: "net.VBOTF", pin2: "net.GND" }} />

      {/* Dual comparators: signal on IN_POS, threshold on IN_NEG (3.3 V) */}
      <capacitor name={`C_CL${i}`} capacitance="100nF" footprint="0402" {...p(-9, -5)} connections={{ pin1: "net.VDIG", pin2: "net.GND" }} />
      <TLV3601DCKR name={`U_CMPL${i}`} {...p(-5, -5)} connections={{ IN_POS: n("AOUT"), IN_NEG: n("VTHLF"), OUT: n("CMPL"), VCC: "net.VDIG", VEE: "net.GND" }} />
      <TLV3601DCKR name={`U_CMPH${i}`} {...p(5, -5)} connections={{ IN_POS: n("AOUT"), IN_NEG: n("VTHHF"), OUT: n("CMPH"), VCC: "net.VDIG", VEE: "net.GND" }} />
      <capacitor name={`C_CH${i}`} capacitance="100nF" footprint="0402" {...p(9, -5)} connections={{ pin1: "net.VDIG", pin2: "net.GND" }} />

      {/* DAC threshold references, RC-filtered */}
      <resistor name={`R_THL${i}`} resistance="1k" footprint="0402" {...p(-7, -10)} connections={{ pin1: "net.VTHL_DAC", pin2: n("VTHLF") }} />
      <capacitor name={`C_THL${i}`} capacitance="100nF" footprint="0402" {...p(-2.5, -10)} connections={{ pin1: n("VTHLF"), pin2: "net.GND" }} />
      <resistor name={`R_THH${i}`} resistance="1k" footprint="0402" {...p(2.5, -10)} connections={{ pin1: "net.VTHH_DAC", pin2: n("VTHHF") }} />
      <capacitor name={`C_THH${i}`} capacitance="100nF" footprint="0402" {...p(7, -10)} connections={{ pin1: n("VTHHF"), pin2: "net.GND" }} />

      {/* Comparator outputs → series damping → FPGA header */}
      <resistor name={`Rgl${i}`} resistance="33" footprint="0402" {...p(-6, -15)} connections={{ pin1: n("CMPL"), pin2: n("FPAL") }} />
      <capacitor name={`Cgl${i}`} capacitance="6pF" footprint="0402" {...p(-2, -15)} connections={{ pin1: n("FPAL"), pin2: "net.GND" }} />
      <resistor name={`Rgh${i}`} resistance="33" footprint="0402" {...p(2, -15)} connections={{ pin1: n("CMPH"), pin2: n("FPAH") }} />
      <capacitor name={`Cgh${i}`} capacitance="6pF" footprint="0402" {...p(6, -15)} connections={{ pin1: n("FPAH"), pin2: "net.GND" }} />

      <pinheader
        name={`J_FPGA${i}`}
        pinCount={4}
        gender="male"
        {...p(0, -20)}
        connections={{ pin1: n("FPAL"), pin2: n("FPAH"), pin3: n("AOUT"), pin4: "net.GND" }}
      />
    </group>
  )
}

export default AfeChannel
