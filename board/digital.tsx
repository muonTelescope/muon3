/**
 * Digital core — iCE40 FPGA + RP2040 telemetry MCU + flash + ADC + DAC + BME280
 * ---------------------------------------------------------------------------
 * Real vendored parts placed in the DIGITAL zone: power/ground wired to the
 * rails with cluster decoupling (row below each IC) + essential config/reset/
 * boot pull-ups. iCE40 core & VCCPLL are 1.2 V (V1V2) per DESIGN_RULES (NOT
 * 3.3 V); VCCIO/VPP are 3.3 V.
 *
 * Placement pass: supplies + decoupling + config pull-ups wired. Inter-IC
 * signal buses (RP2040 QSPI↔flash, SPI/I2C to DAC/ADC/BME280/iCE40, GPIO,
 * PPS) are the routing/netlist pass. DAC80508 imported as a BGA with only
 * grid ball names (A1..D4) → placed but NOT powered until wired from the
 * datasheet ball map. RP2040 12 MHz crystal MPN still TBD (load caps placed).
 */
import { ICE40UP5K_SG48I } from "./imports/ICE40UP5K_SG48I"
import { RP2040 } from "./imports/RP2040"
import { W25Q128JVSIQ } from "./imports/W25Q128JVSIQ"
import { BME280 } from "./imports/BME280"
import { ADS7128IRTER } from "./imports/ADS7128IRTER"
import { DAC80508ZYZFR } from "./imports/DAC80508ZYZFR"

const at = (x: number, y: number) => ({ pcbX: `${x}mm`, pcbY: `${y}mm` })
const dc = (name: string, x: number, y: number, net: string, val = "100nF", fp = "0402") => (
  <capacitor name={name} capacitance={val} footprint={fp} {...at(x, y)} connections={{ pin1: `net.${net}`, pin2: "net.GND" }} />
)
const pu = (name: string, x: number, y: number, a: string, b: string, r = "10k") => (
  <resistor name={name} resistance={r} footprint="0402" {...at(x, y)} connections={{ pin1: `net.${a}`, pin2: `net.${b}` }} />
)

const ICY = -8 // IC row
const DCY = -17 // decoupling row (well clear of the 7 mm QFN edges)
const PUY = -22 // config pull-up row

export const Digital = () => (
  <group name="DIGITAL" pcbX="0mm" pcbY="0mm">
    {/* ---- RP2040 telemetry MCU ---- */}
    <RP2040
      name="U_RP2040"
      {...at(-58, ICY)}
      connections={{
        IOVDD1: "net.VDIG", IOVDD2: "net.VDIG", IOVDD3: "net.VDIG", IOVDD4: "net.VDIG", IOVDD5: "net.VDIG", IOVDD6: "net.VDIG",
        USB_VDD: "net.VDIG", ADC_AVDD: "net.VDIG", VREG_IN: "net.VDIG",
        VREG_VOUT: "net.VCORE", DVDD1: "net.VCORE", DVDD2: "net.VCORE",
        GND: "net.GND", RUN: "net.RP_RUN", XIN: "net.RP_XIN", XOUT: "net.RP_XOUT",
      }}
    />
    {dc("C_RP1", -62, DCY, "VDIG")} {dc("C_RP2", -59, DCY, "VDIG")} {dc("C_RP3", -56, DCY, "VDIG")}
    {dc("C_RPV", -53, DCY, "VCORE", "1uF")} {dc("C_RPB", -50, DCY, "VDIG", "10uF", "0805")}
    {dc("C_RPX1", -66, ICY - 2, "RP_XIN", "18pF")} {dc("C_RPX2", -66, ICY + 2, "RP_XOUT", "18pF")}
    {pu("R_RPRUN", -58, PUY, "VDIG", "RP_RUN")}

    {/* ---- iCE40UP5K FPGA (core 1.2 V, VCCIO 3.3 V) ---- */}
    <ICE40UP5K_SG48I
      name="U_ICE40"
      {...at(-42, ICY)}
      connections={{
        VCC1: "net.V1V2", VCC2: "net.V1V2", VCCPLL: "net.V1V2_PLL",
        VCCIO_0: "net.VDIG", VCCIO_2: "net.VDIG", SPI_Vccio1: "net.VDIG", VPP_2V5: "net.VDIG",
        EP: "net.GND", CDONE: "net.ICE_CDONE", creset_b: "net.ICE_CRESET",
      }}
    />
    {dc("C_IC1", -46, DCY, "V1V2")} {dc("C_IC2", -43, DCY, "V1V2")} {dc("C_IC3", -40, DCY, "VDIG")}
    {dc("C_ICB", -37, DCY, "VDIG", "1uF")}
    {pu("R_PLL", -34, DCY, "V1V2", "V1V2_PLL", "100")} {dc("C_PLL", -31, DCY, "V1V2_PLL")}
    {pu("R_CDONE", -46, PUY, "VDIG", "ICE_CDONE")} {pu("R_CRESET", -43, PUY, "VDIG", "ICE_CRESET")}

    {/* ---- QSPI boot flash (RP2040) ---- */}
    <W25Q128JVSIQ name="U_FLASH" {...at(-28, ICY)} connections={{ VCC: "net.VDIG", GND: "net.GND", CS: "net.FLASH_CS" }} />
    {dc("C_FL", -28, DCY, "VDIG")} {pu("R_FLCS", -25, DCY, "VDIG", "FLASH_CS")}

    {/* ---- BME280 environment (I2C) ---- */}
    <BME280 name="U_BME280" {...at(-18, ICY)} connections={{ VDD: "net.VDIG", VDDIO: "net.VDIG", GND1: "net.GND", GND2: "net.GND", CSB: "net.VDIG" }} />
    {dc("C_BME", -18, DCY, "VDIG")}

    {/* ---- ADS7128 telemetry ADC (I2C, 8-ch) ---- */}
    <ADS7128IRTER name="U_ADC" {...at(-9, ICY)} connections={{ AVDD: "net.VDIG", DVDD: "net.VDIG", GND: "net.GND", EP: "net.GND", DECAP: "net.ADC_DECAP", ADDR: "net.GND" }} />
    {dc("C_ADC", -10, DCY, "VDIG")} {dc("C_ADCD", -7, DCY, "ADC_DECAP", "1uF")}

    {/* ---- DAC80508 (BGA) — placed only; ball map wiring is a datasheet pass ---- */}
    <DAC80508ZYZFR name="U_DAC" {...at(3, ICY)} />
    <fabricationnotetext text="U_DAC (BGA): wire VDD/GND/REF/SPI from datasheet ball map" pcbX="6mm" pcbY={`${DCY}mm`} fontSize="1mm" anchorAlignment="center" />

    {/* Shared I2C pull-ups (BME280 + ADS7128) to 3.3 V */}
    {pu("R_SDA", -10, PUY, "VDIG", "I2C_SDA", "4.7k")}
    {pu("R_SCL", -7, PUY, "VDIG", "I2C_SCL", "4.7k")}
  </group>
)

export default Digital
