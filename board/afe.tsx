/**
 * Analog front-end channel (real board-as-code) — RF/noise/high-speed tuned
 * ------------------------------------------------------------------------
 * Wired per sim/circuit/afe_hamamatsu_s12572.cir; placement optimized from
 * the OPA858 datasheet (TI SLOS879) layout guidance:
 *
 *   - Feedback network on the OPA858 FB pin (internally = OUT) → minimum
 *     feedback-track parasitics. Rf/Cf placed tight to FB/IN− (below-left).
 *   - Series R (10 Ω) placed DIRECTLY at the IN− pin to damp bond-wire /
 *     stray-C resonance (not up by the connector).
 *   - VS decoupling (C_TIA) tight to the VS_POS pin.
 *   - A no-pour keepout under IN−/OUT/FB (top + L2 GND plane) removes
 *     reference-plane parasitic capacitance at the summing node.
 *
 * The SiPM is off-board (HCal tile, 50 cm hybrid cable) so the datasheet
 * "photodiode adjacent to the amp" ideal is unreachable; the cable is fixed
 * (modeled in cable_50cm.cir) and we minimize the on-board connector→TIA
 * path instead. Comparator (TLV3601) VCC decoupling tightened to the pin.
 *
 * Compact ~18 x 40 mm vertical strip; four tile across the AFE zone.
 */
import { OPA858IDSGR } from "./imports/OPA858IDSGR"
import { TLV3601DCKR } from "./imports/TLV3601DCKR"

type ChannelProps = { index: number; x: number; cy: number }

export const AfeChannel = ({ index: i, x, cy }: ChannelProps) => {
  const n = (s: string) => `net.${s}${i}`
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

      {/* Rail clamp on the incoming line, above the TIA */}
      <diode name={`D_CLH${i}`} footprint="sod123" supplierPartNumbers={{ jlcpcb: ["C2128"] }} {...p(-6, 13.5)} connections={{ anode: n("INA"), cathode: "net.VANA" }} />
      <diode name={`D_CLL${i}`} footprint="sod123" supplierPartNumbers={{ jlcpcb: ["C2128"] }} {...p(6, 13.5)} connections={{ anode: "net.GND", cathode: n("INA") }} />

      {/* TIA cluster — series R at IN−, VS decoupling at VS_POS, feedback at FB */}
      <resistor name={`Rser${i}`} resistance="10" footprint="0402" {...p(-3.5, 9)} connections={{ pin1: n("SIG"), pin2: n("INA") }} />
      <OPA858IDSGR
        name={`U_TIA${i}`}
        {...p(0, 9)}
        connections={{ IN_NEG: n("INA"), IN_POS: "net.VBOTF", OUT: n("AOUT"), FB: n("FB"), VS_POS: "net.VANA", VS_NEG: "net.GND", PD: "net.VANA", EP: "net.GND" }}
      />
      <capacitor name={`C_TIA${i}`} capacitance="100nF" footprint="0402" {...p(3.5, 9)} connections={{ pin1: "net.VANA", pin2: "net.GND" }} />
      {/* OPA858 local bulk (datasheet: 0.1uF + 2.2uF on VS+) */}
      <capacitor name={`C_TIAB${i}`} capacitance="2.2uF" footprint="0603" {...p(6, 7)} connections={{ pin1: "net.VANA", pin2: "net.GND" }} />
      <resistor name={`Rf${i}`} resistance="15k" footprint="0402" {...p(-3, 5.5)} connections={{ pin1: n("FB"), pin2: n("INA") }} />
      <capacitor name={`Cf${i}`} capacitance="1.5pF" footprint="0402" {...p(1, 5.5)} connections={{ pin1: n("FB"), pin2: n("INA") }} />
      {/* No-pour keepout: cut top + L2 reference plane under IN−/OUT/FB */}
      <keepout shape="rect" {...p(0, 8)} width="9mm" height="6mm" layers={["top", "inner1"]} />

      {/* Bias reference RC (VBOT ~1.80 V from DAC) */}
      <resistor name={`R_VB${i}`} resistance="1k" footprint="0402" {...p(-7, 1)} connections={{ pin1: "net.VBOT_DAC", pin2: "net.VBOTF" }} />
      <capacitor name={`C_VB${i}`} capacitance="100nF" footprint="0402" {...p(-3.5, 1)} connections={{ pin1: "net.VBOTF", pin2: "net.GND" }} />

      {/* Dual comparators: signal on IN_POS, threshold on IN_NEG; VCC decoupling at the pin */}
      <capacitor name={`C_CL${i}`} capacitance="100nF" footprint="0402" {...p(-8, -5.5)} connections={{ pin1: "net.VDIG", pin2: "net.GND" }} />
      <TLV3601DCKR name={`U_CMPL${i}`} {...p(-5, -4.5)} connections={{ IN_POS: n("AOUT"), IN_NEG: n("VTHLF"), OUT: n("CMPL"), VCC: "net.VDIG", VEE: "net.GND" }} />
      <TLV3601DCKR name={`U_CMPH${i}`} {...p(5, -4.5)} connections={{ IN_POS: n("AOUT"), IN_NEG: n("VTHHF"), OUT: n("CMPH"), VCC: "net.VDIG", VEE: "net.GND" }} />
      <capacitor name={`C_CH${i}`} capacitance="100nF" footprint="0402" {...p(8, -5.5)} connections={{ pin1: "net.VDIG", pin2: "net.GND" }} />

      {/* DAC threshold references, RC-filtered */}
      <resistor name={`R_THL${i}`} resistance="1k" footprint="0402" {...p(-7, -9)} connections={{ pin1: "net.VTHL_DAC", pin2: n("VTHLF") }} />
      <capacitor name={`C_THL${i}`} capacitance="100nF" footprint="0402" {...p(-3.5, -9)} connections={{ pin1: n("VTHLF"), pin2: "net.GND" }} />
      <resistor name={`R_THH${i}`} resistance="1k" footprint="0402" {...p(3.5, -9)} connections={{ pin1: "net.VTHH_DAC", pin2: n("VTHHF") }} />
      <capacitor name={`C_THH${i}`} capacitance="100nF" footprint="0402" {...p(7, -9)} connections={{ pin1: n("VTHHF"), pin2: "net.GND" }} />

      {/* Comparator outputs → series damping → FPGA header */}
      <resistor name={`Rgl${i}`} resistance="33" footprint="0402" {...p(-6, -13)} connections={{ pin1: n("CMPL"), pin2: n("FPAL") }} />
      <capacitor name={`Cgl${i}`} capacitance="6pF" footprint="0402" {...p(-2.5, -13)} connections={{ pin1: n("FPAL"), pin2: "net.GND" }} />
      <resistor name={`Rgh${i}`} resistance="33" footprint="0402" {...p(2.5, -13)} connections={{ pin1: n("CMPH"), pin2: n("FPAH") }} />
      <capacitor name={`Cgh${i}`} capacitance="6pF" footprint="0402" {...p(6, -13)} connections={{ pin1: n("FPAH"), pin2: "net.GND" }} />

      <pinheader
        name={`J_FPGA${i}`}
        pinCount={4}
        gender="male"
        {...p(0, -17)}
        connections={{ pin1: n("FPAL"), pin2: n("FPAH"), pin3: n("AOUT"), pin4: "net.GND" }}
      />
    </group>
  )
}

export default AfeChannel
