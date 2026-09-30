// Muon3 station board (Rev D, 2026-09-30): 4 sPHENIX inner-HCal tiles (S12572-33-015P) on U.FL inside the case, USB-C powered.
// Every value is traced: [DS] datasheet, [2v2] tested gLOWCOST 2v2 board, [SIM] hw/sim/*.cir.
import { Circuit } from "./circuit.ts";

export const P = {
  esp32: "C3013946",     // ESP32-S3-WROOM-1U-N16R8: U.FL antenna connector (no PCB antenna: the antenna sits outside the case), 16 MB flash + 8 MB octal PSRAM (IO35-37 reserved)
  mc34063: "C100023",    // TI MC34063ADR boost controller (bias); replaces MAX1932 ($6.09 → $0.15 at 100)
  opa356: "C183100",     // OPA356AIDBVR 200 MHz RRIO TIA, one per channel [SIM afe_s12572_tia.cir]
  lmv7219: "C20613263",  // LMV7219M5 7 ns comparator
  mcp4728: "C478093",    // MCP4728 4ch 12-bit DAC, EEPROM defaults
  ams1117: "C6186",      // AMS1117-3.3 SOT-223, JLC basic (digital 3V3 from USB 5 V)
  ldo33: "C485517",      // TLV75733PDBVR low-noise (analog 3V3A)
  bme280: "C92489",
  accel: "C19274408",    // SC7A20HTR (LIS2DH12-compatible)
  usblc6: "C2687116",
  usbc: "C2765186",
  ufl: "C88374",         // Hirose U.FL-R-SMT-1(80): 60 V AC rms / 200 V AC withstand [DS]; shell = bias, inside the case
  bss123: "C78755",
  n2n7002: "C8545",      // 2N7002, JLC basic (HV_EN gate)
  ll4148: "C3015531",
  l150u: "C135260",      // SMNR4018-151MT 150 µH (bias boost) [2v2: 150 uH]
  led: "C2286",          // KT-0603R red
  button: "C318884",
};

const CH = [0, 1, 2, 3];

/** Bottom-edge probe row, 2.54 mm pitch, left → right (pogo-fixture order). TP1..TPn in this order. */
export const TEST_ROW = ["GND", "5V", "3V3", "3V3A", "VREF", "VTH0", "VTH1", "VTH2", "VTH3", "HIT0", "HIT1", "HIT2", "HIT3",
  "INJ", "HV_EN", "HV_TRIM", "HV_MON", "DAC_C", "DAC_D", "SDA0", "SCL0", "GND"];

export async function build(): Promise<Circuit> {
  const c = new Circuit();
  c.reserve("J1", "J2", "J3", "J4", "J5", "U1", "U2", "C1", ...TEST_ROW.map((_, k) => `TP${k + 1}`)); // floorplan-fixed; U1 = ESP32-S3, U2/C1 = BME280 island

  // ───────────── test points: pogo row (bottom edge) + per-channel scope pairs + HV ─────────────
  c.group = "testrow";
  TEST_ROW.forEach((n, k) => c.tp(n, { ref: `TP${k + 1}` }));

  // ───────────── USB-C 5 V in (no battery: a USB power bank is the UPS) ─────────────
  c.group = "usb";
  await c.add("J", P.usbc, {
    VBUS: "5V", GND: "GND", EH: "GND", CC1: "CC1", CC2: "CC2",
    Dp1: "USB_DP", Dp2: "USB_DP", Dn1: "USB_DN", Dn2: "USB_DN", SBU1: "NC_SBU1", SBU2: "NC_SBU2",
  }, { ref: "J1" });
  await c.r("5.1k", "CC1", "GND"); await c.r("5.1k", "CC2", "GND"); // UFP Rd: source enables 5 V
  await c.add("U", P.usblc6, { "I/O1": "USB_DP", "I/O2": "USB_DN", VBUS: "5V", GND: "GND" });
  await c.c("10u", "5V", "GND", "0805", 10);

  // ───────────── rails ─────────────
  // Digital 3V3: AMS1117 in SOT-223 (JLC basic, tab spreads the 5→3.3 V loss of Wi-Fi bursts).
  // Analog 3V3A: TLV75733 (low noise, ~15 mA load).
  c.group = "rails";
  await c.add("U", P.ams1117, { VIN: "5V", GND: "GND", VOUT: "3V3" });
  await c.c("10u", "5V", "GND", "0805", 10); await c.c("22u", "3V3", "GND", "0805", 10);
  await c.add("U", P.ldo33, { IN: "5V", EN: "5V", GND: "GND", OUT: "3V3A", NC: "NC_LDO2" });
  await c.c("1u", "5V", "GND"); await c.c("10u", "3V3A", "GND", "0603");

  // ───────────── ESP32-S3: hit time stamps (MCPWM capture, 12.5 ns, both edges) + singles (PCNT) ─────────────
  // HIT0..3 go through the GPIO matrix, so pinswap assigns them to the nearest free GPIOs.
  c.group = "mcu";
  await c.add("U", P.esp32, {
    GND: "GND", EP: "GND", "3V3": "3V3", EN: "ESP_EN", IO0: "BOOT",
    IO19: "USB_DN", IO20: "USB_DP",
    IO12: "HV_EN", IO13: "INJ",
    IO8: "SDA0", IO18: "SCL0", IO16: "SDA1", IO17: "SCL1",
    IO1: "HIT0", IO2: "HIT1", IO4: "HIT2", IO5: "HIT3",
    IO6: "HV_MON", IO7: "ACC_INT", IO46: "LED_STATUS",
    RXD0: "NC_RXD0", TXD0: "NC_TXD0", // debug over USB-CDC
  }, { ref: "U1" });
  await c.c("100n", "3V3", "GND"); await c.c("10u", "3V3", "GND", "0603");
  await c.r("10k", "3V3", "ESP_EN"); await c.c("1u", "ESP_EN", "GND");
  await c.r("10k", "3V3", "BOOT");
  await c.add("SW", P.button, { A: "BOOT", B: "BOOT", C: "GND", D: "GND" }, { value: "BOOT" });
  await c.r("1k", "LED_STATUS", "LED_STATUS_A"); await c.add("D", P.led, { A: "LED_STATUS_A", K: "GND" }, { value: "STATUS" });
  for (const n of ["SDA0", "SCL0", "SDA1", "SCL1"]) await c.r("4.7k", "3V3", n);

  // ───────────── HV bias: MC34063 boost, set by a DAC, gated by HV_EN ─────────────
  // [DS MC34063A SLLS636N] boost in discontinuous mode (load ≪ 1 mA): VIpk 0.3 V / 2.2 Ω = 136 mA, CT 1 nF ≈ 33 kHz,
  // ½·L·Ipk²·f ≈ 46 mW available vs ~18 mW needed. Internal Darlington drives the BSS123 gate (1 kΩ pull-down).
  // While disabled the bias node sits at ≈ 5 V (boost input passes through L + diode) — far below SiPM breakdown.
  // FB node: Vout = 1.25 + Ru·(1.25/Rl + (1.25 − V_TRIM)/Rt), Ru 1.02 MΩ, Rl 20 kΩ, Rt 68k + 1k (DAC is a stiff source)
  //   → 83.5 V at TRIM 0 V … 53.2 V at TRIM 2.048 V (7.4 mV per DAC LSB). S12572-015: 59–79 V. [SIM hv_new.cir]
  // The earlier PWM trim was loaded by its own 20 kΩ filter + 100 kΩ pull-up (26–70 V only) and rode on the 3V3 rail.
  // HV_EN (ESP32 pin, 100 kΩ pull-down): while low, 3V3 → 10 kΩ → LL4148 holds FB ≈ 1.6 V > 1.25 V, so the switch never
  // runs (HV ≈ 5 V) at power-up regardless of DAC/EEPROM/capacitor state; HV_EN high turns the 2N7002 on and releases FB.
  c.group = "hv";
  await c.add("U", P.mc34063, { VCC: "5V", SWC: "5V", DRC: "5V", IPK: "HV_IPK", SWE: "HV_GATE", TCAP: "HV_CT", COMP: "HV_FB", GND: "GND" });
  await c.c("10u", "5V", "GND", "0805", 10); await c.c("100n", "5V", "GND");
  await c.r("2.2", "5V", "HV_IPK", "0805");                // Rsc: Ipk = 0.3 V / 2.2 Ω = 136 mA (≈1.4 µJ/pulse, ≈46 mW available)
  await c.c("1n", "HV_CT", "GND");                          // ≈ 33 kHz [DS 7.5]
  await c.l("150u", "HV_IPK", "HV_SW", P.l150u);
  await c.add("Q", P.bss123, { G: "HV_GATE", S: "GND", D: "HV_SW" });
  await c.r("1k", "HV_GATE", "GND");
  await c.add("D", P.ll4148, { A: "HV_SW", K: "HV_RAW" });
  await c.c("1u", "HV_RAW", "GND", "1206", 100); await c.c("100n", "HV_RAW", "GND", "0805", 100);
  // RC post-filter (was 1 mH/1 µF: that LC resonated at ~5 kHz and amplified the MC34063 burst ripple to ~2 V pk-pk)
  await c.r("10k", "HV_RAW", "HV", "0805");
  await c.c("1u", "HV", "GND", "1206", 100);
  await c.r("510k", "HV_RAW", "HV_FB_MID", "0805"); await c.r("510k", "HV_FB_MID", "HV_FB", "0805");
  await c.r("=20k", "HV_FB", "GND");
  await c.r("1k", "HV_TRIM", "HV_TRIM_F"); await c.c("100n", "HV_TRIM_F", "GND");
  await c.r("=68k", "HV_TRIM_F", "HV_FB");
  await c.r("10k", "3V3", "HV_OFF");                        // HV_EN gate
  await c.add("D", P.ll4148, { A: "HV_OFF", K: "HV_FB" });
  await c.add("Q", P.n2n7002, { G: "HV_EN", S: "GND", D: "HV_OFF" });
  await c.r("100k", "HV_EN", "GND");
  c.tp("HV", { label: "HV" }); c.tp("GND", { label: "GND" });
  await c.r("1M", "HV", "HV_MON_MID", "0805"); await c.r("1M", "HV_MON_MID", "HV_MON", "0805"); await c.r("75k", "HV_MON", "GND"); await c.c("100n", "HV_MON", "GND"); // 80 V -> 2.9 V

  // ───────────── DACs (MCP4728, internal 2.048 V reference, EEPROM power-on values) ─────────────
  // U-A (I2C0): the four comparator thresholds. U-B (I2C1): A = common TIA baseline, B = HV trim, C/D spare (test points).
  // Per-channel bias trim was dropped: it only spanned ±1 V, sPHENIX grouped SiPMs into Vop-matched towers, and at
  // 58 p.e. mean vs a 5 p.e. threshold efficiency is on the plateau; per-channel thresholds absorb the gain spread.
  c.group = "dac";
  await c.add("U", P.mcp4728, { VDD: "3V3A", VSS: "GND", SCL: "SCL0", SDA: "SDA0", "LDAC#": "GND", "RDY/BSY#": "NC_RDY0",
    VOUTA: "VTH0", VOUTB: "VTH1", VOUTC: "VTH2", VOUTD: "VTH3" });
  await c.add("U", P.mcp4728, { VDD: "3V3A", VSS: "GND", SCL: "SCL1", SDA: "SDA1", "LDAC#": "GND", "RDY/BSY#": "NC_RDY1",
    VOUTA: "VREF", VOUTB: "HV_TRIM", VOUTC: "DAC_C", VOUTD: "DAC_D" });
  await c.decouple("3V3A", ["100n", "1u", "100n", "1u"]);

  // ───────────── charge injection (self-test without tiles) ─────────────
  // ESP32 INJ step 3.3 V → 10k/1.1k → 0.33 V → 1 pF C0G into each TIA input = 0.33 pC ≈ 9 p.e. (S12572-015) per edge.
  c.group = "inj";
  await c.r("10k", "INJ", "INJ_D"); await c.r("1.1k", "INJ_D", "GND");

  // ───────────── channel ×4: U.FL jack + bias feed + OPA356 TIA + LMV7219, one identical cell each ─────────────
  // Cell k is placed and routed once (ch0) and copied at a fixed pitch (floorplan CELLS, place.ts, autoroute.ts).
  // U.FL shell = SiPM cathode = HVJ_n (47k: ≤1.8 mA short; 100 nF AC-grounds the shell so it shields the centre
  // conductor). Centre = SiPM anode -> DC-coupled TIA. The jack sits inside the case: bias never reaches a surface.
  for (const i of CH) {
    c.group = `ch${i}`;
    await c.add("J", P.ufl, { "1": `SIG${i}`, "2": `HVJ${i}`, "3": `HVJ${i}` }, { ref: `J${2 + i}`, value: `TILE ${i}` });
    await c.r("47k", "HV", `HVJ${i}`, "0805");
    await c.c("100n", `HVJ${i}`, "GND", "0805", 100);
    await c.add("U", P.opa356, { "IN-": `SIG${i}`, "IN+": `VREFF${i}`, OUT: `TIA${i}`, "V+": "3V3A", "V-": "GND" });
    await c.c("100n", "3V3A", "GND");
    await c.r("=33k", `TIA${i}`, `SIG${i}`);
    await c.c("2.7p", `TIA${i}`, `SIG${i}`);
    await c.r("100", "VREF", `VREFF${i}`); await c.c("100n", `VREFF${i}`, "GND");
    await c.c("=1p", "INJ_D", `SIG${i}`);
    await c.r("1k", `VTH${i}`, `VTHF${i}`); await c.c("100n", `VTHF${i}`, "GND");
    await c.add("U", P.lmv7219, { "IN-": `TIA${i}`, "IN+": `VTHF${i}`, OUT: `CMP${i}`, VCC: "3V3A", GND: "GND" });
    await c.c("100n", "3V3A", "GND");
    await c.r("33", `CMP${i}`, `HIT${i}`);
    c.tp(`TIA${i}`, { label: `TIA${i}` }); c.tp("GND", { label: "GND" }); // scope pair: tip + ground spring
  }

  // ───────────── sensors ─────────────
  c.group = "sensors";
  // BME280 = air temperature for SiPM bias compensation + pressure for rate correction: on a slotted island at the
  // cool edge of the board, in its own vented case chamber (see floorplan + case).
  c.group = "bme";
  await c.add("U", P.bme280, { GND: "GND", VDD: "3V3", VDDIO: "3V3", CSB: "3V3", SDI: "SDA0", SCK: "SCL0", SDO: "GND" }, { ref: "U2" }); // 0x76
  const cb = await c.c("100n", "3V3", "GND"); cb.ref = "C1";
  c.group = "sensors";
  await c.add("U", P.accel, { VDD: "3V3", VDDIO: "3V3", GND: "GND", GNDIO: "GND", CS: "3V3", SDx: "SDA0", SCx: "SCL0", SDO: "3V3", INT1: "ACC_INT", INT2: "NC_ACC2" }); // 0x19
  await c.c("100n", "3V3", "GND");

  return c;
}

if (import.meta.main) {
  const c = await build();
  const issues = c.check();
  const nets = c.nets();
  console.log(`${c.parts.length} parts, ${nets.size} nets, ${new Set(c.parts.map(p => p.lcsc)).size} unique LCSC`);
  for (const s of issues) console.log("  !", s);
}
