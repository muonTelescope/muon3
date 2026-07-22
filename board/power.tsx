/**
 * Power front end — USB-C PD input + rails
 * ----------------------------------------
 * Decision 2: USB-C PD input only. USB-C receptacle → CH224K PD sink
 * (12 V contract) → TPS62933 buck (3.3 V VDIG). VANA (5 V analog), V1V2
 * (iCE40 core), and VCORE (RP2040) regulators are added next; V12 is the
 * negotiated PD rail feeding HV/TEC/fans.
 *
 * Placement pass: power path + decoupling + the buck network placed.
 * Flag: CH224K CFG1/2/3 code for a 12 V contract, the USB-C A/B pin
 * mapping, and the exact buck L/FB/RT values need datasheet confirmation.
 */
import { TYPE_C_31_M_12 } from "./imports/TYPE_C_31_M_12"
import { CH224K } from "./imports/CH224K"
import { TPS62933DRLR } from "./imports/TPS62933DRLR"

const at = (x: number, y: number) => ({ pcbX: `${x}mm`, pcbY: `${y}mm` })
const dc = (name: string, x: number, y: number, net: string, val = "100nF", fp = "0402") => (
  <capacitor name={name} capacitance={val} footprint={fp} {...at(x, y)} connections={{ pin1: `net.${net}`, pin2: "net.GND" }} />
)
const R = (name: string, x: number, y: number, a: string, b: string, r: string) => (
  <resistor name={name} resistance={r} footprint="0402" {...at(x, y)} connections={{ pin1: `net.${a}`, pin2: `net.${b}` }} />
)

export const PowerInput = () => (
  <group name="PWR" pcbX="0mm" pcbY="0mm">
    {/* USB-C receptacle (bottom edge, clear of the corner mounting hole) */}
    <TYPE_C_31_M_12
      name="J_USBC"
      {...at(-50, -53)}
      connections={{
        B4A9: "net.VBUS", A4B9: "net.VBUS", A1B12: "net.GND", B1A12: "net.GND",
        EH1: "net.GND", EH2: "net.GND", EH3: "net.GND", EH4: "net.GND",
        A5: "net.CC1", B5: "net.CC2", A6: "net.USB_DP", B6: "net.USB_DM",
      }}
    />

    {/* CH224K PD sink */}
    <CH224K
      name="U_PD"
      {...at(-64, -50)}
      connections={{
        VBUS: "net.VBUS", VDD: "net.PD_VDD", GND: "net.GND",
        CC1: "net.CC1", CC2: "net.CC2", DP: "net.USB_DP", DM: "net.USB_DM",
        CFG1: "net.PD_CFG1", CFG2: "net.PD_CFG2", CFG3: "net.PD_CFG3", PG: "net.PD_PG",
      }}
    />
    {dc("C_PDV", -68, -50, "PD_VDD")}
    {R("R_CC1", -61, -45, "CC1", "GND", "5.1k")}
    {R("R_CC2", -59, -45, "CC2", "GND", "5.1k")}
    {R("R_CFG2", -57, -45, "PD_CFG2", "GND", "6.8k")}
    {R("R_PG", -55, -45, "PD_VDD", "PD_PG", "10k")}

    {/* VBUS (= V12 PD rail) bulk */}
    {dc("C_VBUS1", -70, -44, "VBUS", "10uF", "0805")}
    {dc("C_VBUS2", -67, -44, "VBUS")}
    {R("R_V12", -64, -44, "VBUS", "V12", "0")}

    {/* ---- TPS62933 buck: 12 V -> 3.3 V (VDIG) ---- */}
    <TPS62933DRLR
      name="U_BUCK33"
      {...at(-38, -44)}
      connections={{ VIN: "net.V12", GND: "net.GND", SW: "net.SW33", BST: "net.BST33", EN: "net.EN33", FB: "net.FB33", SS: "net.SS33", RT: "net.RT33" }}
    />
    {dc("C_B33IN", -42, -40, "V12", "10uF", "0805")}
    {dc("C_B33IN2", -42, -48, "V12")}
    <inductor name="L_33V" inductance="4.7uH" footprint="1210" {...at(-33, -40)} connections={{ pin1: "net.SW33", pin2: "net.VDIG" }} />
    {dc("C_B33O", -29, -44, "VDIG", "22uF", "0805")}
    <capacitor name="C_BST33" capacitance="100nF" footprint="0402" {...at(-35, -48)} connections={{ pin1: "net.BST33", pin2: "net.SW33" }} />
    {R("R_FB1", -32, -48, "VDIG", "FB33", "100k")}
    {R("R_FB2", -30, -48, "FB33", "GND", "32k")}
    {R("R_EN33", -42, -52, "V12", "EN33", "100k")}
    {R("R_RT33", -39, -52, "RT33", "GND", "100k")}
    <capacitor name="C_SS33" capacitance="10nF" footprint="0402" {...at(-36, -52)} connections={{ pin1: "net.SS33", pin2: "net.GND" }} />
  </group>
)

export default PowerInput
