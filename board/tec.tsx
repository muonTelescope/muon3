/**
 * TEC drivers + fan switches (4 channels)
 * ---------------------------------------
 * One DRV8873 H-bridge per SiPM Peltier (decision 1: 100% JLCPCB; ITRIP
 * <= 2.5 A) driving a Same Sky CP30238, plus a low-side fan switch. Placed
 * in the TEC zone (bottom-right switching corner, >= 25 mm from AFE).
 *
 * Required passives per channel: VM bulk + HF decoupling, DVDD cap,
 * charge-pump caps (VCP-VM reservoir, CPH-CPL flying), IPROPI current-sense
 * resistors (to the ADC), nSLEEP/nFAULT pull-ups, and the fan MOSFET with
 * gate resistor, gate pull-down, and flyback diode.
 *
 * Deferred (routing/netlist pass): OUTx → panel TEC pins, control lines
 * from the FPGA/telemetry, IPROPI → ADC channels.
 */
import { DRV8873HPWPR } from "./imports/DRV8873HPWPR"
import { AO3400A } from "./imports/AO3400A"

const CY = -40 // DRV row
const TOP = -34 // caps above the DRV
const BOT = -46 // resistors/caps below the DRV
const FAN = -51 // fan cluster row

type Ch = { index: number; x: number }

export const TecChannel = ({ index: i, x }: Ch) => {
  const n = (s: string) => `net.${s}${i}`
  const at = (dx: number, y: number) => ({ pcbX: `${x + dx}mm`, pcbY: `${y}mm` })
  const C = (nm: string, dx: number, y: number, net: string, val: string, fp = "0402") => (
    <capacitor name={`${nm}${i}`} capacitance={val} footprint={fp} {...at(dx, y)} connections={{ pin1: net, pin2: "net.GND" }} />
  )
  const R = (nm: string, dx: number, y: number, a: string, b: string, r: string) => (
    <resistor name={`${nm}${i}`} resistance={r} footprint="0402" {...at(dx, y)} connections={{ pin1: a, pin2: b }} />
  )
  return (
    <group name={`TEC${i}`} pcbX="0mm" pcbY="0mm">
      <DRV8873HPWPR
        name={`U_TEC${i}`}
        {...at(0, CY)}
        connections={{
          VM1: "net.V12", VM2: "net.V12", GND: "net.GND", EP: "net.GND",
          DVDD: n("DVDD"), VCP: n("VCP"), CPH: n("CPH"), CPL: n("CPL"),
          OUT11: n("OA"), OUT12: n("OA"), OUT21: n("OB"), OUT22: n("OB"),
          SRC1: "net.GND", SRC2: "net.GND",
          IPROPI1: n("IPA"), IPROPI2: n("IPB"),
          nSLEEP: n("SLEEP"), nFAULT: n("FAULT"),
        }}
      />
      {/* top row: VM bulk/HF + DVDD + charge pump */}
      {C("C_VM", -6, TOP, "net.V12", "10uF", "0805")}
      {C("C_VMh", -3, TOP, "net.V12", "100nF")}
      {C("C_DV", 0, TOP, n("DVDD"), "1uF")}
      <capacitor name={`C_VCP${i}`} capacitance="1uF" footprint="0402" {...at(3, TOP)} connections={{ pin1: n("VCP"), pin2: "net.V12" }} />
      <capacitor name={`C_CPHL${i}`} capacitance="47nF" footprint="0402" {...at(6, TOP)} connections={{ pin1: n("CPH"), pin2: n("CPL") }} />

      {/* bottom row: DVDD HF, IPROPI sense, nSLEEP/nFAULT pull-ups */}
      {C("C_DVh", -6, BOT, n("DVDD"), "100nF")}
      {R("R_IPA", -3, BOT, n("IPA"), "net.GND", "1.5k")}
      {R("R_IPB", 0, BOT, n("IPB"), "net.GND", "1.5k")}
      {R("R_SLP", 3, BOT, n("DVDD"), n("SLEEP"), "100k")}
      {R("R_FLT", 6, BOT, n("DVDD"), n("FAULT"), "47k")}

      {/* fan row: low-side AO3400 + gate R + pull-down + flyback */}
      <AO3400A name={`Q_FAN${i}`} {...at(-3, FAN)} connections={{ D: n("FANN"), S: "net.GND", G: n("FANG") }} />
      {R("R_FG", 0, FAN, n("FANPWM"), n("FANG"), "100")}
      {R("R_FPD", 3, FAN, n("FANG"), "net.GND", "10k")}
      <diode name={`D_FAN${i}`} footprint="sod123" supplierPartNumbers={{ jlcpcb: ["C2128"] }} {...at(8.5, FAN)} connections={{ anode: n("FANN"), cathode: "net.V12" }} />
    </group>
  )
}

export const TecDrivers = () => (
  <>
    {[8, 25, 42, 59].map((x, i) => (
      <TecChannel key={i} index={i} x={x} />
    ))}
  </>
)

export default TecDrivers
