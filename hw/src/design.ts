// Muon3 station board (Rev B, 2026-09-29): sPHENIX inner-HCal tiles + S12572-33-015P over RJ45/Cat6.
// Every value is traced: [DS] datasheet, [2v2] tested gLOWCOST 2v2 board, [SIM] hw/sim/*.cir.
import { Circuit } from "./circuit.ts";

export const P = {
  esp32: "C2913198",     // ESP32-S3-WROOM-1-N8 (PCB antenna, -40..85 C)
  ice40: "C2678152",     // ICE40UP5K-SG48I
  max1932: "C2650346",   // MAX1932ETC+T HV bias [2v2]
  opa356: "C183100",     // OPA356AIDBVR 200 MHz RRIO TIA, one per channel [SIM afe_s12572_tia.cir]
  lmv7219: "C20613263",  // LMV7219M5 7 ns comparator
  mcp4728: "C478093",    // MCP4728 4ch 12-bit DAC, EEPROM defaults
  bq25890: "C130451",    // BQ25890 1S NVDC charger + ADC
  ldo33: "C485517",      // TLV75733PDBVR 1 A
  ldo12: "C22456010",    // TLV75712PDYDR (iCE40 core)
  bme280: "C92489",
  accel: "C19274408",    // SC7A20HTR (LIS2DH12-compatible)
  usblc6: "C2687116",
  usbc: "C2765186",
  sma: "C496550",        // BWSMA-KE-P001 edge-launch SMA (as gLOWCOST 2v2), one per HCal tile
  holder: "C2988620",    // BH-18650-B1BA002 SMD
  jstsh4: "C160404",     // SM04B-SRSS-TB: STEMMA QT / Qwiic
  bss123: "C78755",
  ll4148: "C3015531",
  l150u: "C135260",      // SMNR4018-151MT (MAX1932 boost) [2v2: 150 uH]
  l1m: "C114766",        // NLFV32T-102K-EF 1 mH (HV LC post-filter) [2v2]
  l1u: "C91254",         // SWPA4020S1R0NT 1 uH (BQ25890) [DS fig 10-1]
  ptc: "C269119",        // SMD1206B110TFT 1.1 A hold, per cell
  led: "C2286",          // KT-0603R red
  button: "C318884",
  ntc10k: "C95939",      // 10k B3950 0402 (charger TS, near cells)
};

const CH = [0, 1, 2, 3];

export async function build(): Promise<Circuit> {
  const c = new Circuit();
  c.reserve("J1", "J2", "J3", "J4", "J5", "J6", "U1"); // floorplan-fixed; U1 = ESP32-S3

  // ───────────── USB-C input + charger + 1S4P pack ─────────────
  c.group = "usb";
  await c.add("J", P.usbc, {
    VBUS: "VBUS", GND: "GND", EH: "GND", CC1: "CC1", CC2: "CC2",
    Dp1: "USB_DP", Dp2: "USB_DP", Dn1: "USB_DN", Dn2: "USB_DN", SBU1: "NC_SBU1", SBU2: "NC_SBU2",
  }, { ref: "J1" });
  await c.r("5.1k", "CC1", "GND"); await c.r("5.1k", "CC2", "GND"); // UFP Rd: source enables 5 V
  await c.add("U", P.usblc6, { "I/O1": "USB_DP", "I/O2": "USB_DN", VBUS: "VBUS", GND: "GND" });

  c.group = "charger";
  await c.add("U", P.bq25890, {
    VBUS: "VBUS", PMID: "PMID", SW: "CHG_SW", BTST: "CHG_BTST", REGN: "REGN", PGND: "GND", PAD: "GND",
    SYS: "VSYS", BAT: "VBAT", ILIM: "CHG_ILIM", TS: "CHG_TS", STAT: "CHG_STAT", INT: "CHG_INT",
    SCL: "SCL0", SDA: "SDA0", "CE#": "GND", OTG: "GND", "QON#": "NC_QON", DSEL: "NC_DSEL",
    "D+": "NC_CHG_DP", "D-": "NC_CHG_DN", // BC1.2 unused; firmware sets IINLIM over I2C
  });
  await c.c("1u", "VBUS", "GND", "0603", 25);
  await c.c("10u", "PMID", "GND", "0805", 25);
  await c.c("100n", "CHG_BTST", "CHG_SW", "0402", 16); // DS shows 47n; 100n basic is within TI guidance
  await c.c("4.7u", "REGN", "GND", "0603", 10);
  await c.l("1u", "CHG_SW", "VSYS", P.l1u);
  await c.c("10u", "VSYS", "GND", "0805", 10); await c.c("10u", "VSYS", "GND", "0805", 10);
  await c.c("10u", "VBAT", "GND", "0805", 10);
  await c.r("200", "CHG_ILIM", "GND"); // IINMAX = 355/200 = 1.78 A hard cap [DS KILIM]
  await c.r("5.1k", "REGN", "CHG_TS"); await c.r("30k", "CHG_TS", "GND"); // [DS 10-1: 5.23k/30.1k]
  await c.add("TH", P.ntc10k, { "1": "CHG_TS", "2": "GND" }, { value: "10k B3950 (cells)" });
  await c.r("2.2k", "VSYS", "CHG_STAT_LED"); await c.add("D", P.led, { A: "CHG_STAT_LED", K: "CHG_STAT" }, { value: "CHG" });

  // Four removable cells in parallel. Holder contacts are symmetric, so each cell gets a PTC
  // (limits mismatch inrush / trips on a reversed cell) and a red LED that lights only when reversed.
  for (const i of CH) {
    c.group = `cells${i}`;
    // LCSC's footprint silk marks pad 2 as "+": follow it (contacts are symmetric, the mark defines polarity)
    await c.add("BT", P.holder, { "2": `CELL${i}_P`, "1": "GND" }, { value: "18650 holder (+ = pad 2)" });
    await c.add("F", P.ptc, { "1": "VBAT", "2": `CELL${i}_P` }, { value: "1.1A PTC" });
    await c.r("1k", `CELL${i}_P`, `CELL${i}_REV`);
    await c.add("D", P.led, { A: "GND", K: `CELL${i}_REV` }, { value: `REV${i}` });
  }

  // ───────────── rails ─────────────
  c.group = "rails";
  await c.add("U", P.ldo33, { IN: "VSYS", EN: "VSYS", GND: "GND", OUT: "3V3", NC: "NC_LDO1" });
  await c.c("1u", "VSYS", "GND"); await c.c("10u", "3V3", "GND", "0603");
  await c.add("U", P.ldo33, { IN: "VSYS", EN: "VSYS", GND: "GND", OUT: "3V3A", NC: "NC_LDO2" });
  await c.c("1u", "VSYS", "GND"); await c.c("10u", "3V3A", "GND", "0603");
  await c.add("U", P.ldo12, { IN: "3V3", EN: "3V3", GND: "GND", EP: "GND", OUT: "1V2", NC: "NC_LDO3" });
  await c.c("1u", "3V3", "GND"); await c.c("10u", "1V2", "GND", "0603");

  // ───────────── ESP32-S3 ─────────────
  c.group = "mcu";
  await c.add("U", P.esp32, {
    GND: "GND", EP: "GND", "3V3": "3V3", EN: "ESP_EN", IO0: "BOOT",
    IO19: "USB_DN", IO20: "USB_DP",
    IO12: "SPI_SCK", IO11: "SPI_MOSI", IO13: "SPI_MISO", IO10: "FPGA_SS", IO9: "FPGA_CRESET", IO14: "FPGA_CDONE",
    IO21: "FPGA_CLK", IO47: "FPGA_IRQ", IO48: "HV_CS", IO38: "HV_CL",
    IO8: "SDA0", IO18: "SCL0", IO16: "SDA1", IO17: "SCL1",
    IO6: "HV_MON", // SiPM temperature = BME280 (user decision 2026-09-29)
    IO15: "CHG_INT", IO7: "ACC_INT", IO46: "LED_STATUS",
    RXD0: "NC_RXD0", TXD0: "NC_TXD0", // debug over USB-CDC
  }, { ref: "U1" });
  await c.c("22u", "3V3", "GND", "0805", 10); await c.c("100n", "3V3", "GND");
  await c.r("10k", "3V3", "ESP_EN"); await c.c("1u", "ESP_EN", "GND");
  await c.r("10k", "3V3", "BOOT");
  await c.add("SW", P.button, { A: "BOOT", B: "BOOT", C: "GND", D: "GND" }, { value: "BOOT" });
  await c.r("1k", "LED_STATUS", "LED_STATUS_A"); await c.add("D", P.led, { A: "LED_STATUS_A", K: "GND" }, { value: "STATUS" });
  for (const n of ["SDA0", "SCL0", "SDA1", "SCL1", "CHG_INT"]) await c.r("4.7k", "3V3", n);

  // ───────────── iCE40UP5K: hit capture, ToT, coincidences ─────────────
  // Configured by the ESP32 as SPI slave (no flash); clock = ESP32 LEDC 40 MHz from its crystal (no TCXO).
  c.group = "fpga";
  await c.add("U", P.ice40, {
    VCC: "1V2", VCCPLL: "1V2_PLL", VPP_2V5: "3V3", VCCIO_0: "3V3", VCCIO_2: "3V3", SPI_Vccio1: "3V3", EP: "GND",
    CDONE: "FPGA_CDONE", creset_b: "FPGA_CRESET",
    IOB_32a_SPI_SO: "SPI_MISO", IOB_34a_SPI_SCK: "SPI_SCK", IOB_35b_SPI_SS: "FPGA_SS", IOB_33b_SPI_SI: "SPI_MOSI",
    IOT_46b_G0: "FPGA_CLK", IOB_6a: "FPGA_IRQ",
    IOB_3b_G6: "HIT0", IOB_5b: "HIT1", IOB_0a: "HIT2", IOB_2a: "HIT3",
  });
  await c.decouple("1V2", ["100n", "100n"]);
  await c.decouple("3V3", ["100n", "100n", "100n"]);
  await c.r("100", "1V2", "1V2_PLL"); await c.c("10u", "1V2_PLL", "GND", "0603"); await c.c("100n", "1V2_PLL", "GND"); // [DS VCCPLL RC]
  await c.r("10k", "3V3", "FPGA_CRESET"); await c.r("10k", "3V3", "FPGA_CDONE");

  // ───────────── HV bias: MAX1932, exact 2v2 topology, range ~54–104 V [2v2] ─────────────
  // S12572-015: Vop = Vbr(65±10 V) + 4 V -> 59–79 V. Boots at DAC 0xFF = minimum HV; firmware writes 0x00 to shut down.
  c.group = "hv";
  await c.add("U", P.max1932, {
    VIN: "VSYS", GND: "GND", EP: "GND", SCLK: "SPI_SCK", DIN: "SPI_MOSI", "CS#": "HV_CS", "CL#": "HV_CL",
    GATE: "HV_GATE", "CS+": "HV_RAW", "CS-": "HV_CSN", FB: "HV_FB", DACOUT: "HV_DAC", COMP: "HV_COMP",
  });
  await c.c("1u", "VSYS", "GND"); await c.c("100n", "VSYS", "GND");
  await c.r("10k", "3V3", "HV_CS"); await c.r("10k", "3V3", "HV_CL");
  await c.l("150u", "VSYS", "HV_SW", P.l150u);
  await c.add("Q", P.bss123, { G: "HV_GATE", S: "GND", D: "HV_SW" });
  await c.add("D", P.ll4148, { A: "HV_SW", K: "HV_RAW" });
  await c.c("100n", "HV_RAW", "GND", "0805", 100); // 2v2: 47n
  await c.r("806", "HV_RAW", "HV_CSN", "0603"); // current sense -> CL
  await c.c("1u", "HV_CSN", "GND", "1206", 100);
  await c.l("1m", "HV_CSN", "HV", P.l1m); // LC post-filter [2v2]
  await c.c("1u", "HV", "GND", "1206", 100);
  await c.r("49.9k", "HV_CSN", "HV_FB_MID", "0805"); await c.r("49.9k", "HV_FB_MID", "HV_FB", "0805");
  await c.r("2.37k", "HV_FB", "GND"); await c.r("2.49k", "HV_DAC", "HV_FB");
  await c.r("20k", "HV_COMP", "HV_COMP_RC"); await c.c("220n", "HV_COMP_RC", "GND");
  await c.r("1M", "HV", "HV_MON_MID", "0805"); await c.r("1M", "HV_MON_MID", "HV_MON", "0805"); await c.r("75k", "HV_MON", "GND"); await c.c("100n", "HV_MON", "GND"); // 80 V -> 2.9 V

  // ───────────── DACs: VREF_n (per-channel SiPM bias trim / TIA baseline) + VTH_n ─────────────
  c.group = "dac";
  await c.add("U", P.mcp4728, { VDD: "3V3A", VSS: "GND", SCL: "SCL0", SDA: "SDA0", "LDAC#": "GND", "RDY/BSY#": "NC_RDY0",
    VOUTA: "VREF0", VOUTB: "VREF1", VOUTC: "VREF2", VOUTD: "VREF3" });
  await c.add("U", P.mcp4728, { VDD: "3V3A", VSS: "GND", SCL: "SCL1", SDA: "SDA1", "LDAC#": "GND", "RDY/BSY#": "NC_RDY1",
    VOUTA: "VTH0", VOUTB: "VTH1", VOUTC: "VTH2", VOUTD: "VTH3" });
  await c.decouple("3V3A", ["100n", "1u", "100n", "1u"]);

  // ───────────── AFE ×4: OPA356 TIA (Rf 33k / Cf 2.7p, baseline VREF_n) -> LMV7219 [SIM] ─────────────
  // One amplifier per channel, right behind its jack: identical channels, shortest TIA input.
  for (const i of CH) {
    c.group = `afe${i}`;
    await c.add("U", P.opa356, { "IN-": `SIG${i}`, "IN+": `VREFF${i}`, OUT: `TIA${i}`, "V+": "3V3A", "V-": "GND" });
    await c.c("100n", "3V3A", "GND");
    await c.r("=33k", `TIA${i}`, `SIG${i}`);
    await c.c("2.7p", `TIA${i}`, `SIG${i}`);
    await c.r("100", `VREF${i}`, `VREFF${i}`); await c.c("100n", `VREFF${i}`, "GND");
    await c.r("1k", `VTH${i}`, `VTHF${i}`); await c.c("100n", `VTHF${i}`, "GND");
    await c.add("U", P.lmv7219, { "IN-": `TIA${i}`, "IN+": `VTHF${i}`, OUT: `CMP${i}`, VCC: "3V3A", GND: "GND" });
    await c.c("100n", "3V3A", "GND");
    await c.r("33", `CMP${i}`, `HIT${i}`);
  }

  // ───────────── tile jacks ×4: right-angle SMA, HV on the shell (as gLOWCOST 2v2) ─────────────
  // Edge-launch SMA straddling the board edge: pads 1,2 top + 3,4 bottom = shell, 5 = centre.
  // Shell = SiPM cathode = HV_n (47k: ≤1.7 mA short; 100 nF at the jack AC-grounds the shell so it shields the
  // centre conductor). Centre = SiPM anode -> DC-coupled TIA. The tile's soldered pigtail gets an SMA plug.
  for (const i of CH) {
    c.group = `jack${i}`;
    await c.add("J", P.sma, { "1": `HVJ${i}`, "2": `HVJ${i}`, "3": `HVJ${i}`, "4": `HVJ${i}`, "5": `SIG${i}` },
      { ref: `J${2 + i}`, value: `TILE ${i}` });
    await c.r("47k", "HV", `HVJ${i}`, "0805");
    await c.c("100n", `HVJ${i}`, "GND", "0805", 100);
  }

  // ───────────── sensors, STEMMA QT ─────────────
  c.group = "sensors";
  await c.add("U", P.bme280, { GND: "GND", VDD: "3V3", VDDIO: "3V3", CSB: "3V3", SDI: "SDA0", SCK: "SCL0", SDO: "GND" }); // 0x76
  await c.c("100n", "3V3", "GND");
  await c.add("U", P.accel, { VDD: "3V3", VDDIO: "3V3", GND: "GND", GNDIO: "GND", CS: "3V3", SDx: "SDA0", SCx: "SCL0", SDO: "3V3", INT1: "ACC_INT", INT2: "NC_ACC2" }); // 0x19
  await c.c("100n", "3V3", "GND");
  // STEMMA QT / Qwiic pinout: 1 GND, 2 V+ (3.3 V), 3 SDA, 4 SCL
  await c.add("J", P.jstsh4, { "1": "GND", "2": "3V3", "3": "SDA0", "4": "SCL0", "5": "GND", "6": "GND" }, { ref: "J6", value: "STEMMA QT" });

  return c;
}

if (import.meta.main) {
  const c = await build();
  const issues = c.check();
  const nets = c.nets();
  console.log(`${c.parts.length} parts, ${nets.size} nets, ${new Set(c.parts.map(p => p.lcsc)).size} unique LCSC`);
  for (const s of issues) console.log("  !", s);
}
