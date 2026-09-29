// Muon3 station board (Rev B, 2026-09-29): 4 sPHENIX inner-HCal tiles (S12572-33-015P) on edge SMAs, USB-C powered.
// Every value is traced: [DS] datasheet, [2v2] tested gLOWCOST 2v2 board, [SIM] hw/sim/*.cir.
import { Circuit } from "./circuit.ts";

export const P = {
  esp32: "C2913198",     // ESP32-S3-WROOM-1-N8 (PCB antenna, -40..85 C)
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
  sma: "C496550",        // BWSMA-KE-P001 edge-launch SMA (as gLOWCOST 2v2), one per HCal tile
  jstsh4: "C160404",     // SM04B-SRSS-TB: STEMMA QT / Qwiic
  bss123: "C78755",
  ll4148: "C3015531",
  l150u: "C135260",      // SMNR4018-151MT 150 µH (bias boost) [2v2: 150 uH]
  l1m: "C114766",        // NLFV32T-102K-EF 1 mH (HV LC post-filter) [2v2]
  led: "C2286",          // KT-0603R red
  button: "C318884",
};

const CH = [0, 1, 2, 3];

export async function build(): Promise<Circuit> {
  const c = new Circuit();
  c.reserve("J1", "J2", "J3", "J4", "J5", "J6", "U1"); // floorplan-fixed; U1 = ESP32-S3

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
    IO12: "HV_PWM",
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

  // ───────────── HV bias: MC34063 boost with external 100 V switch, set by ESP32 PWM ─────────────
  // [DS MC34063A SLLS636N] boost, discontinuous mode (load ≪ 1 mA): VIpk 0.3 V / 1 Ω = 0.3 A, CT 1 nF ≈ 33 kHz,
  // ½·L·Ipk²·f ≈ 0.2 W available vs ~10 mW needed. Internal Darlington drives the BSS123 gate (1 kΩ pull-down).
  // Vout = 1.25·(1 + Ru/Rl) − (V_TRIM − 1.25)·Ru/Rd with Ru 1.02 MΩ, Rl 22 kΩ, Rd 47 kΩ → ≈ 15 V (TRIM 3.3 V) … 85 V (TRIM 0 V).
  // Boot-safe: TRIM pulled up to 3V3, so an unconfigured ESP32 pin gives ≈ 15 V (below SiPM breakdown).
  // S12572-015 needs 59–79 V: TRIM ≈ 1.2…0.27 V, 12-bit PWM → ≈ 17 mV steps. HV_MON closes the loop in firmware.
  c.group = "hv";
  await c.add("U", P.mc34063, { VCC: "5V", SWC: "5V", DRC: "5V", IPK: "HV_IPK", SWE: "HV_GATE", TCAP: "HV_CT", COMP: "HV_FB", GND: "GND" });
  await c.c("10u", "5V", "GND", "0805", 10); await c.c("100n", "5V", "GND");
  await c.r("1", "5V", "HV_IPK", "0805");                  // Rsc: Ipk = 0.3 V / 1 Ω
  await c.c("1n", "HV_CT", "GND");                          // ≈ 33 kHz [DS 7.5]
  await c.l("150u", "HV_IPK", "HV_SW", P.l150u);
  await c.add("Q", P.bss123, { G: "HV_GATE", S: "GND", D: "HV_SW" });
  await c.r("1k", "HV_GATE", "GND");
  await c.add("D", P.ll4148, { A: "HV_SW", K: "HV_RAW" });
  await c.c("1u", "HV_RAW", "GND", "1206", 100); await c.c("100n", "HV_RAW", "GND", "0805", 100);
  await c.l("1m", "HV_RAW", "HV", P.l1m); // LC post-filter [2v2]
  await c.c("1u", "HV", "GND", "1206", 100);
  await c.r("510k", "HV_RAW", "HV_FB_MID", "0805"); await c.r("510k", "HV_FB_MID", "HV_FB", "0805");
  await c.r("22k", "HV_FB", "GND");
  await c.r("47k", "HV_TRIM", "HV_FB");
  await c.r("10k", "HV_PWM", "HV_PWM_F"); await c.c("1u", "HV_PWM_F", "GND");   // 2-pole RC, fc ≈ 16 Hz
  await c.r("10k", "HV_PWM_F", "HV_TRIM"); await c.c("1u", "HV_TRIM", "GND");
  await c.r("100k", "3V3", "HV_TRIM");                       // boot-safe: low HV until firmware drives HV_PWM
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
      { ref: `J${2 + i}`, value: `TILE ${i}`, noPasteBottom: true }); // top tabs + centre soldered; bottom tabs bare (one-sided assembly)
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
