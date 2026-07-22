/**
 * HV bias — LT3482 placement anchor (real vendored part)
 * ------------------------------------------------------
 * LT3482 (C515895) is an APD/SiPM bias supply boosting to ~70 V for the
 * Hamamatsu S12572 on the HCal tiles. This commit PLACES the real part in
 * the HV zone with its supply/enable/telemetry pins wired; the switching
 * boost network (inductor on SW1/SW2, Schottky, VOUT1/2 stack, FB divider
 * for ~70 V, CTRL current program, PUMP cap) is authored next from the
 * LT3482 datasheet typical application — no invented L/D/divider values.
 *
 * HV_BIAS fans out to each panel connector's bias pin; keep >=0.6 mm
 * clearance and no pour under the SW node (board/layout.ts, DESIGN_RULES).
 */
import { LT3482EUD_TRPBF } from "./imports/LT3482EUD_TRPBF"

type Props = { x: number; y: number }

export const HvBias = ({ x, y }: Props) => (
  <group name="HV" pcbX="0mm" pcbY="0mm">
    <LT3482EUD_TRPBF
      name="U_HV"
      pcbX={`${x}mm`}
      pcbY={`${y}mm`}
      connections={{
        VIN: "net.V12",
        pin12: "net.HV_EN", // #SHDN (the '#' breaks the selector parser)
        GND1: "net.GND",
        GND2: "net.GND",
        EP: "net.GND",
        APD: "net.HV_BIAS",
        MON: "net.HV_MON",
      }}
    />
    {/* VIN decoupling */}
    <capacitor name="C_HVIN1" capacitance="10uF" footprint="0805" supplierPartNumbers={{ jlcpcb: ["C15850"] }} pcbX={`${x - 5}mm`} pcbY={`${y + 5}mm`} connections={{ pin1: "net.V12", pin2: "net.GND" }} />
    <capacitor name="C_HVIN2" capacitance="100nF" footprint="0402" supplierPartNumbers={{ jlcpcb: ["C1525"] }} pcbX={`${x + 5}mm`} pcbY={`${y + 5}mm`} connections={{ pin1: "net.V12", pin2: "net.GND" }} />
    {/* Enable pull-up (SHDN high = on); firmware/interlock can pull low */}
    <resistor name="R_HVEN" resistance="100k" footprint="0402" pcbX={`${x}mm`} pcbY={`${y + 8}mm`} connections={{ pin1: "net.V12", pin2: "net.HV_EN" }} />
    {/* HV_MON divider to ADC (~70 V → ~1.75 V): 2M / 51k */}
    <resistor name="R_HVMON1" resistance="2M" footprint="0402" pcbX={`${x - 3}mm`} pcbY={`${y - 6}mm`} connections={{ pin1: "net.HV_BIAS", pin2: "net.HV_MON" }} />
    <resistor name="R_HVMON2" resistance="51k" footprint="0402" pcbX={`${x + 3}mm`} pcbY={`${y - 6}mm`} connections={{ pin1: "net.HV_MON", pin2: "net.GND" }} />
  </group>
)

export default HvBias
