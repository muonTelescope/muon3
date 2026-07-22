/**
 * Power input subsystem (seed)
 * ----------------------------
 * Decision 2 (freeze): USB-C PD input only this revision; battery/solar
 * lives in an external module. This seed establishes the VBUS/GND/CC nets
 * with real passives + LCSC parts. The USB-C receptacle (C165948) and the
 * CH224K PD sink + protection network are added in the next commit with
 * their verified JLCPCB footprints (via the tscircuit parts engine).
 *
 * Real footprints + nets + LCSC part numbers (JLCPCB Standard PCBA).
 */
export const PowerInput = () => (
  <group name="PWR" pcbX="0mm" pcbY="0mm">
    {/* UFP CC advertisement: 5.1k from each CC line to GND */}
    <resistor
      name="R_CC1"
      resistance="5.1k"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C25905"] }}
      pcbX="-63mm"
      pcbY="-44mm"
    />
    <resistor
      name="R_CC2"
      resistance="5.1k"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C25905"] }}
      pcbX="-63mm"
      pcbY="-46mm"
    />

    {/* VBUS bulk + decoupling */}
    <capacitor
      name="C_VBUS1"
      capacitance="10uF"
      footprint="0805"
      supplierPartNumbers={{ jlcpcb: ["C15850"] }}
      pcbX="-60mm"
      pcbY="-48mm"
    />
    <capacitor
      name="C_VBUS2"
      capacitance="100nF"
      footprint="0402"
      supplierPartNumbers={{ jlcpcb: ["C1525"] }}
      pcbX="-57mm"
      pcbY="-48mm"
    />

    {/* Power nets (connector/CH224K pin mapping wired in the next commit) */}
    <trace name="T_VBUS1" from=".C_VBUS1 > .pin1" to="net.VBUS" />
    <trace name="T_GND1" from=".C_VBUS1 > .pin2" to="net.GND" />
    <trace name="T_VBUS2" from=".C_VBUS2 > .pin1" to="net.VBUS" />
    <trace name="T_GND2" from=".C_VBUS2 > .pin2" to="net.GND" />
    <trace name="T_CC1" from=".R_CC1 > .pin1" to="net.CC1" />
    <trace name="T_CC1G" from=".R_CC1 > .pin2" to="net.GND" />
    <trace name="T_CC2" from=".R_CC2 > .pin1" to="net.CC2" />
    <trace name="T_CC2G" from=".R_CC2 > .pin2" to="net.GND" />
  </group>
)

export default PowerInput
