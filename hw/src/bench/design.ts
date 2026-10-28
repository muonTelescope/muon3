// Muon3 bench board (2026-10-28): 4-channel first-order test board. Every SiPM, analog output and comparator output is on an
// U.FL jack, every stage can be cut apart with a link, and every node has an SMD test loop. iCE40UP5K for hit timing and
// coincidences, ESP32-S3 for USB/Wi-Fi and FPGA configuration, STEMMA QT for external sensors, bias from a bench supply or the
// on-board Rev D boost converter (jumper), FPGA-driven LED pulser for SiPM gain calibration.
// The analog chain is the Rev D cell (src/design.ts): values traced there.
import { Circuit } from "../circuit.ts";

export const P = {
  esp32: "C2913198",     // ESP32-S3-WROOM-1-N8: PCB antenna (bench board, no case), quad flash, IO35-37 free
  ice40: "C2678152",     // ICE40UP5K-SG48I: configured by the ESP32 as SPI slave (no flash), clocked by the ESP32 (40 MHz crystal)
  opa356: "C183100",     // OPA356AIDBVR TIA
  lmv7219: "C20613263",  // LMV7219M5 comparator
  mcp4728: "C478093",    // MCP4728 4ch 12-bit DAC
  ams1117: "C6186",      // 3V3 digital
  ldo33: "C485517",      // TLV75733 3V3A analog
  ldo12: "C22456010",    // TLV75712PDYDR 1V2 FPGA core
  usblc6: "C2687116",
  usbc: "C2765186",
  sma: "C496550",        // BWSMA-KE-P001 edge-launch SMA (Rev B/C, gLOWCOST 2v2): SiPM inputs only
  ufl: "C88374",         // Hirose U.FL-R-SMT-1(80): per-channel INJ in, TIA out, CMP out (30 mating cycles: leave pigtails plugged in)
  xh2: "C158012",        // JST B2B-XH-A: external bias input (250 V rated)
  stemma: "C160404",     // JST SM04B-SRSS-TB: STEMMA QT / Qwiic
  loop: "C5199798",      // RH-5015 SMD test loop
  ll4148: "C3015531",    // 100 V: bias input reverse protection
  led: "C2286",
  button: "C318884",
  bav99: "C2500",        // BAV99 clamp pair on each TIA input (JLC basic)
  flash: "C97521",       // W25Q128JVSIQ, FPGA boot flash, footprint only (DNP)
  buf: "C7836",          // SN74LVC1G17DBVR: LED pulse driver, 24 mA, ~2 ns edges
  hdr3: "C49257",         // 1×3 2.54 mm header: bias source jumper (EXT / GEN)
  mc34063: "C100023",    // Rev D bias boost (src/design.ts)
  bss123: "C78755", n2n7002: "C8545", l150u: "C135260",
};

export const CH = [0, 1, 2, 3];
/** One edge SMA per channel (SiPM input, shell = bias); INJ/TIA/CMP are U.FL jacks inside the cell. */
export const smaRef = (ch: number) => `J${10 + ch}`;
/** Per-channel U.FL jacks (k: 0 INJ, 1 TIA, 2 CMP) and test loops (k: 0 TIA, 1 TIAC, 2 VTH, 3 CMP, 4 GND), fixed in the floorplan. */
export const UFL_KIND = ["INJ", "TIA", "CMP"] as const, LOOP_KIND = ["TIA", "TIAC", "VTH", "CMP", "G"] as const;
export const uflRef = (ch: number, k: number) => `J${20 + 3 * ch + k}`, loopRef = (ch: number, k: number) => `TP${101 + 10 * ch + k}`;

/** Top-edge test-loop row, left to right. TP1..TPn in this order. */
export const TEST_ROW = ["GND", "5V", "3V3", "3V3A", "1V2", "HV_MON", "HV_TRIM", "HV_EN", "VREF", "VTH0", "VTH1", "VTH2", "VTH3", "DAC_C", "DAC_D",
  "GND", "SDA0", "SCL0", "SDA1", "SCL1", "SPI_SCK", "SPI_MOSI", "SPI_MISO", "FPGA_SS", "FPGA_CDONE", "FPGA_CRESET", "FPGA_CLK", "FPGA_IRQ",
  "GND", "INJ", "LED_PULSE", "HIT0", "HIT1", "HIT2", "HIT3", "FIO0", "FIO1", "TXD0", "RXD0", "GND"];

export async function build(): Promise<Circuit> {
  const c = new Circuit();
  c.reserve("J1", "J2", "J3", "J4", "U1", "U2", ...CH.map(smaRef), ...CH.flatMap(i => [0, 1, 2].map(k => uflRef(i, k))), ...CH.flatMap(i => [0, 1, 2, 3, 4].map(k => loopRef(i, k))), ...TEST_ROW.map((_, k) => `TP${k + 1}`));
  const loop = (net: string, ref?: string) => c.add("TP", P.loop, { "1": net }, { value: net, ref });

  c.group = "testrow";
  for (const [k, n] of TEST_ROW.entries()) await loop(n, `TP${k + 1}`);

  // ───────────── USB-C 5 V in ─────────────
  c.group = "usb";
  await c.add("J", P.usbc, {
    VBUS: "5V", GND: "GND", EH: "GND", CC1: "CC1", CC2: "CC2",
    Dp1: "USB_DP", Dp2: "USB_DP", Dn1: "USB_DN", Dn2: "USB_DN", SBU1: "NC_SBU1", SBU2: "NC_SBU2",
  }, { ref: "J1" });
  await c.r("5.1k", "CC1", "GND"); await c.r("5.1k", "CC2", "GND");
  await c.add("U", P.usblc6, { "I/O1": "USB_DP", "I/O2": "USB_DN", VBUS: "5V", GND: "GND" });
  await c.c("10u", "5V", "GND", "0805", 10);

  // ───────────── rails: 3V3 digital, 3V3A analog, 1V2 FPGA core ─────────────
  c.group = "rails";
  await c.add("U", P.ams1117, { VIN: "5V", GND: "GND", VOUT: "3V3" });
  await c.c("10u", "5V", "GND", "0805", 10); await c.c("22u", "3V3", "GND", "0805", 10);
  await c.add("U", P.ldo33, { IN: "5V", EN: "5V", GND: "GND", OUT: "3V3A", NC: "NC_LDO2" });
  await c.c("1u", "5V", "GND"); await c.c("10u", "3V3A", "GND", "0603");
  await c.add("U", P.ldo12, { IN: "3V3", EN: "3V3", GND: "GND", EP: "GND", OUT: "1V2", NC: "NC_LDO3" });
  await c.c("1u", "3V3", "GND"); await c.c("1u", "1V2", "GND");
  await c.r("1k", "3V3", "LED_PWR_A"); await c.add("D", P.led, { A: "LED_PWR_A", K: "GND" }, { value: "PWR LED" });

  // ───────────── ESP32-S3: USB, Wi-Fi, FPGA configuration + clock, DACs, bias monitor ─────────────
  c.group = "mcu";
  await c.add("U", P.esp32, {
    GND: "GND", EP: "GND", "3V3": "3V3", EN: "ESP_EN", IO0: "BOOT",
    IO19: "USB_DN", IO20: "USB_DP",
    IO10: "FPGA_SS", IO11: "SPI_MOSI", IO12: "SPI_SCK", IO13: "SPI_MISO", // FSPI IO_MUX pins
    IO9: "FPGA_CRESET", IO14: "FPGA_CDONE", IO21: "FPGA_CLK", IO47: "FPGA_IRQ",
    IO4: "FX0", IO5: "FX1", IO6: "FX2", IO7: "FX3",
    IO8: "SDA0", IO18: "SCL0", IO16: "SDA1", IO17: "SCL1",
    IO1: "HV_MON", IO2: "HV_EN", IO38: "LED_STATUS",
    TXD0: "TXD0", RXD0: "RXD0",
  }, { ref: "U1" });
  await c.c("100n", "3V3", "GND"); await c.c("10u", "3V3", "GND", "0603");
  await c.r("10k", "3V3", "ESP_EN"); await c.c("1u", "ESP_EN", "GND");
  await c.add("SW", P.button, { A: "ESP_EN", B: "ESP_EN", C: "GND", D: "GND" }, { value: "RESET" });
  await c.r("10k", "3V3", "BOOT");
  await c.add("SW", P.button, { A: "BOOT", B: "BOOT", C: "GND", D: "GND" }, { value: "BOOT" });
  await c.r("1k", "LED_STATUS", "LED_STATUS_A"); await c.add("D", P.led, { A: "LED_STATUS_A", K: "GND" }, { value: "ESP LED" });
  for (const n of ["SDA0", "SCL0", "SDA1", "SCL1"]) await c.r("4.7k", "3V3", n);
  // STEMMA QT on I2C1 (shared with the VREF DAC at 0x60; external sensors must not use 0x60)
  await c.add("J", P.stemma, { "1": "GND", "2": "3V3", "3": "SDA1", "4": "SCL1", "5": "GND", "6": "GND" }, { ref: "J2", value: "STEMMA QT" });

  // ───────────── iCE40UP5K: hit capture, time over threshold, coincidences, charge-injection pulses ─────────────
  // Configured by the ESP32 over SPI (slave mode: ESP32 holds FPGA_SS low while it releases CRESET); after configuration the
  // same four lines are the ESP32 <-> FPGA register bus. Clock: ESP32 LEDC on IO21 into global buffer G0 (PLL input).
  c.group = "fpga";
  await c.add("U", P.ice40, {
    VCC: "1V2", VCCPLL: "1V2_PLL", VPP_2V5: "3V3", VCCIO_0: "3V3", VCCIO_2: "3V3", SPI_Vccio1: "3V3", EP: "GND",
    CDONE: "FPGA_CDONE", creset_b: "FPGA_CRESET",
    IOB_32a_SPI_SO: "SPI_MISO", IOB_34a_SPI_SCK: "SPI_SCK", IOB_35b_SPI_SS: "FPGA_SS", IOB_33b_SPI_SI: "SPI_MOSI",
    IOT_46b_G0: "FPGA_CLK", IOB_6a: "FPGA_IRQ",
    IOB_3b_G6: "HIT0", IOB_5b: "HIT1", IOB_0a: "HIT2", IOB_2a: "HIT3", IOB_4a: "INJ",
    IOB_9b: "FX0", IOB_8a: "FX1", IOB_13b: "FX2", IOB_16a: "FX3",
    IOT_37a: "FIO0", IOT_36b: "FIO1", IOT_42b: "LED_PULSE",
    RGB0: "LED_FPGA_K",
  }, { ref: "U2" });
  await c.decouple("1V2", ["100n", "100n"]);
  await c.decouple("3V3", ["100n", "100n", "100n"]);
  await c.r("100", "1V2", "1V2_PLL"); await c.c("10u", "1V2_PLL", "GND", "0603"); await c.c("100n", "1V2_PLL", "GND"); // [DS VCCPLL RC]
  await c.r("10k", "3V3", "FPGA_CRESET"); await c.r("10k", "3V3", "FPGA_CDONE");
  await c.r("1k", "3V3", "LED_FPGA_A"); await c.add("D", P.led, { A: "LED_FPGA_A", K: "LED_FPGA_K" }, { value: "FPGA LED" }); // RGB0 current sink
  // Boot flash, footprint only. Fit it and the FPGA boots on its own (master mode: FPGA_SS = flash CS, SO -> DI, DO -> SI).
  // The ESP32 rewrites it while holding FPGA_CRESET low, with MOSI/MISO swapped in its GPIO matrix. With the flash fitted the
  // ESP32 must not use slave configuration (FPGA_SS low would also select the flash).
  { const f = await c.add("U", P.flash, { "CS#": "FPGA_SS", DO: "SPI_MOSI", IO2: "3V3", GND: "GND", DI: "SPI_MISO", CLK: "SPI_SCK", IO3: "3V3", VCC: "3V3" }, { value: "FLASH DNP" });
    f.dnp = true; const fc = await c.c("100n", "3V3", "GND"); fc.dnp = true; }

  // ───────────── LED pulser (SiPM gain calibration) ─────────────
  // FPGA pulse (width = FPGA clock steps) -> LVC buffer (24 mA) -> 49.9 Ω -> U.FL. At the far end: blue LED + series resistor,
  // in the dark next to the SiPM or on a fibre. Light level = pulse width and that resistor; single-p.e. peaks at the lowest setting.
  c.group = "led";
  await c.add("U", P.buf, { A: "LED_PULSE", Y: "LED_DRV", VCC: "3V3", GND: "GND", "N.C": "NC_BUF" });
  await c.c("100n", "3V3", "GND");
  await c.r("100k", "LED_PULSE", "GND");            // LED off while the FPGA is unconfigured
  await c.r("=49.9", "LED_DRV", "LED_OUT");
  await c.add("J", P.ufl, { "1": "LED_OUT", "2": "GND", "3": "GND" }, { value: "LED" });

  // ───────────── bias: bench supply (EXT) or on-board boost (GEN), chosen by jumper J4 ─────────────
  // J4: 1-2 = EXT, 2-3 = GEN. Each source has its own 10 kΩ; the 1 µF filter sits on HV after the jumper.
  // EXT: LL4148 blocks a reversed supply. HV_LED lights above ~5 V and, with the monitor divider, bleeds the 1 µF to a safe
  // level within a second after the source is removed.
  c.group = "hv";
  await c.add("J", P.xh2, { "1": "HV_IN", "2": "GND" }, { ref: "J3", value: "HV IN" });
  await c.add("D", P.ll4148, { A: "HV_IN", K: "HV_D" });
  await c.r("10k", "HV_D", "HV_EXT", "0805");
  await c.c("1u", "HV", "GND", "1206", 100); await c.c("100n", "HV", "GND", "0805", 100);
  await c.r("100k", "HV", "HV_LED", "0805"); await c.add("D", P.led, { A: "HV_LED", K: "GND" }, { value: "HV ON" });
  await c.r("1M", "HV", "HV_MON_MID", "0805"); await c.r("1M", "HV_MON_MID", "HV_MON", "0805"); await c.r("75k", "HV_MON", "GND"); await c.c("100n", "HV_MON", "GND"); // 80 V -> 2.9 V
  await loop("HV"); await loop("GND");

  // GEN: the Rev D MC34063 boost, unchanged (values and simulation in src/design.ts): 53–83 V set by HV_TRIM (DAC1 B),
  // switch held off by HV_EN low (100 kΩ pull-down) until the ESP32 enables it.
  c.group = "hvgen";
  await c.add("J", P.hdr3, { "1": "HV_EXT", "2": "HV", "3": "HV_GEN" }, { ref: "J4", value: "EXT HV GEN" });
  await c.add("U", P.mc34063, { VCC: "5V", SWC: "5V", DRC: "5V", IPK: "HV_IPK", SWE: "HV_GATE", TCAP: "HV_CT", COMP: "HV_FB", GND: "GND" });
  await c.c("10u", "5V", "GND", "0805", 10); await c.c("100n", "5V", "GND");
  await c.r("2.2", "5V", "HV_IPK", "0805");
  await c.c("1n", "HV_CT", "GND");
  await c.l("150u", "HV_IPK", "HV_SW", P.l150u);
  await c.add("Q", P.bss123, { G: "HV_GATE", S: "GND", D: "HV_SW" });
  await c.r("1k", "HV_GATE", "GND");
  await c.add("D", P.ll4148, { A: "HV_SW", K: "HV_RAW" });
  await c.c("1u", "HV_RAW", "GND", "1206", 100); await c.c("100n", "HV_RAW", "GND", "0805", 100);
  await c.r("10k", "HV_RAW", "HV_GEN", "0805");
  await c.r("510k", "HV_RAW", "HV_FB_MID", "0805"); await c.r("510k", "HV_FB_MID", "HV_FB", "0805");
  await c.r("=20k", "HV_FB", "GND");
  await c.r("1k", "HV_TRIM", "HV_TRIM_F"); await c.c("100n", "HV_TRIM_F", "GND");
  await c.r("=68k", "HV_TRIM_F", "HV_FB");
  await c.r("10k", "3V3", "HV_OFF");
  await c.add("D", P.ll4148, { A: "HV_OFF", K: "HV_FB" });
  await c.add("Q", P.n2n7002, { G: "HV_EN", S: "GND", D: "HV_OFF" });
  await c.r("100k", "HV_EN", "GND");

  // ───────────── DACs (MCP4728, internal 2.048 V reference) ─────────────
  c.group = "dac";
  await c.add("U", P.mcp4728, { VDD: "3V3A", VSS: "GND", SCL: "SCL0", SDA: "SDA0", "LDAC#": "GND", "RDY/BSY#": "NC_RDY0",
    VOUTA: "VTH0", VOUTB: "VTH1", VOUTC: "VTH2", VOUTD: "VTH3" });
  await c.add("U", P.mcp4728, { VDD: "3V3A", VSS: "GND", SCL: "SCL1", SDA: "SDA1", "LDAC#": "GND", "RDY/BSY#": "NC_RDY1",
    VOUTA: "VREF", VOUTB: "HV_TRIM", VOUTC: "DAC_C", VOUTD: "DAC_D" });
  await c.decouple("3V3A", ["100n", "1u", "100n", "1u"]);

  // ───────────── on-board charge injection (FPGA pulse, all 4 channels) ─────────────
  // 3.3 V step -> 10k/1.1k -> 0.33 V -> 1 pF into each TIA input = 0.33 pC ≈ 9 p.e. per edge.
  c.group = "inj";
  await c.r("10k", "INJ", "INJ_D"); await c.r("1.1k", "INJ_D", "GND");

  // ───────────── channel ×4 (identical cells) ─────────────
  // SIPM SMA: centre = SiPM anode -> TIA input, shell = SiPM cathode = bias through 47 kΩ (≤ 1.9 mA into a short).
  // INJ U.FL: 50 Ω terminated, 1 pF into the TIA input (1 V step = 1 pC ≈ 27 p.e.).
  // TIA U.FL: 49.9 Ω back-terminated (half amplitude into 50 Ω). CMP U.FL: 100 Ω series (1.1 V into 50 Ω, 3.3 V into 1 MΩ).
  // Link R0 between TIA and comparator: remove it to drive the comparator from the TIAC loop.
  for (const i of CH) {
    c.group = `ch${i}`;
    await c.add("J", P.sma, { "5": `SIG${i}`, "1": `HVJ${i}`, "2": `HVJ${i}`, "3": `HVJ${i}`, "4": `HVJ${i}` }, { ref: smaRef(i), value: `SIPM${i}`, noPasteBottom: true });
    for (const [k, net] of [`INJX${i}`, `TIAO${i}`, `CMPO${i}`].entries())
      await c.add("J", P.ufl, { "1": net, "2": "GND", "3": "GND" }, { value: `${UFL_KIND[k]}${i}`, ref: uflRef(i, k) });
    await c.r("47k", "HV", `HVJ${i}`, "0805");
    await c.c("100n", `HVJ${i}`, "GND", "0805", 100);
    await c.add("D", P.bav99, { "1": "GND", "2": "3V3A", "3": `SIG${i}` }); // clamps SIG to −0.7…4 V (hot-plugged bias, ESD)
    await c.add("U", P.opa356, { "IN-": `SIG${i}`, "IN+": `VREFF${i}`, OUT: `TIA${i}`, "V+": "3V3A", "V-": "GND" });
    await c.c("100n", "3V3A", "GND");
    await c.r("=33k", `TIA${i}`, `SIG${i}`);
    await c.c("2.7p", `TIA${i}`, `SIG${i}`);
    await c.r("100", "VREF", `VREFF${i}`); await c.c("100n", `VREFF${i}`, "GND");
    await c.c("=1p", "INJ_D", `SIG${i}`);
    await c.r("=49.9", `INJX${i}`, "GND"); await c.c("=1p", `INJX${i}`, `SIG${i}`);
    await c.r("=49.9", `TIA${i}`, `TIAO${i}`);
    await c.r("=0", `TIA${i}`, `TIAC${i}`);
    await c.r("1k", `VTH${i}`, `VTHF${i}`); await c.c("100n", `VTHF${i}`, "GND");
    await c.add("U", P.lmv7219, { "IN-": `TIAC${i}`, "IN+": `VTHF${i}`, OUT: `CMP${i}`, VCC: "3V3A", GND: "GND" });
    await c.c("100n", "3V3A", "GND");
    await c.r("33", `CMP${i}`, `HIT${i}`);
    await c.r("100", `CMP${i}`, `CMPO${i}`);
    for (const [k, n] of [`TIA${i}`, `TIAC${i}`, `VTHF${i}`, `CMP${i}`, "GND"].entries()) await loop(n, loopRef(i, k));
  }

  return c;
}

if (import.meta.main) {
  const c = await build();
  const issues = c.check();
  console.log(`${c.parts.length} parts, ${c.nets().size} nets, ${new Set(c.parts.map(p => p.lcsc)).size} unique LCSC`);
  for (const s of issues) console.log("  !", s);
}
