# Schematic-freeze questions and decisions

> **Superseded in part on 2026-09-29.** The max-scope architecture review froze decisions
> #1–#12, listed in the section below. Where they conflict with the 2026-07-11 answers, the
> 2026-09-29 decisions win. Full specification: [MUON3_MAX_SCOPE_ARCHITECTURE.md](MUON3_MAX_SCOPE_ARCHITECTURE.md).
> Parts list with status: [key_parts_max_scope.csv](key_parts_max_scope.csv).

## 2026-09-29 — Max-scope architecture freeze (decisions #1–#12, FROZEN)

Reviewed and answered by Sawaiz on 2026-09-29, between 20:09 and 20:36 Europe/Berlin.

| # | Decision (FROZEN 2026-09-29) | Supersedes (2026-07-11) |
| --- | --- | --- |
| 1 | **ESP32-S3-WROOM-1U-N16 (C2980298) is the main controller.** It provides Wi-Fi + BLE 5 + USB-OTG (CDC + MSC) and configures the iCE40 over SPI from its flash. **RP2040 and nRF54 are removed.** | Q11 (nRF9151 primary + RP2040 co-processor + optional nRF54). |
| 2 | **Panel-Head Board (PHB) per SiPM + Molex Micro-Fit 3.0 2×12 locking harness** (header 0430452400 / C277384, housing 0430252400). The AFE (OPA858 **at 5 V, VBOT 3.0 V**), TLV3601 ×2, MCP4728, injection, TMP117 and ID EEPROM sit on the head board. The 50 cm harness carries **LVDS digital**, not analog. | Q5/Q6 (a single hybrid connector carrying analog SiPM signal + bias). The hybrid connector is retired. |
| 3 | **DRV8873 ×4 + hardware interlock on every main board.** CP30238 coolers, fans and heatsinks are fitted only on hot-site or lab units. Temperature-compensated bias is the primary gain stabilisation. The DRV8873 internal ITRIP minimum is 3.27 A, so the trip is an IPROPI comparator. | Q1/Q3/Q10 are kept. "ITRIP ≤ 2.5 A" is replaced by the IPROPI trip. |
| 4 | **nRF9151-LACA-R7 is an optional LTE-M/NB-IoT variant, not fitted by default.** It runs Nordic Serial LTE Modem firmware over UART. No SIM7080G on Rev A; SIM7080G is only a Rev B candidate if nRF9151 lead time exceeds 8 weeks. | Q11 / the Q10 (second) role of the nRF9151. |
| 5 | **External antennas via U.FL** for Wi-Fi, GNSS, LoRa and LTE. | Q10 (second; the Nordic reference antenna geometry drove the outline). |
| 6 | **4× 18650 in on-PCB holders, 4S1P ≈ 49 Wh.** BQ25798 charger + BQ76907 protection and balancing; MYOUNG BH-18650-B1BA002 on the bottom side of the 160 × 120 mm board. The autonomy requirement is revised to an **≥ 18 h UPS**; multi-day operation comes from an off-board 12–24 V AUX input. | Q2 (TPS25751 + BQ2579x is kept; the battery is now on board). **CH224K is dropped.** |
| 7 | **RAK3172 LoRa** (RAK3172-T-8-SM-I / -T-9-SM-I), regional SKUs on one footprint. | New. |
| 8 | **SiPM soldered directly on the PHB.** TEC units use a **flex carrier ≤ 3 cm** (125 V FPC connector). | New (resolves the SiPM mechanical question). |
| 9 | **First 5-unit build: 3× US915 (T-9) + 2× EU868 (T-8); one of the five is the LTE variant.** | New. |
| 10 | **Stations ship without cells.** Specify UN38.3 Samsung 35E / LG MJ1-class cells. | New. |
| 11 | **LoRa backhaul: TTN where covered, otherwise one LoRaWAN gateway per site cluster.** | New. |
| 12 | **Added features:** W5500 Ethernet + magjack option (not fitted by default); LIS2DH12-class accelerometer (SC7A20H fitted); boot self-test + automatic threshold/gain calibration + cosmic plateau scan; ESP32-S3 Secure Boot v2 + flash encryption + signed OTA (bitstream inside the image) + per-device certificates; SSD1306 OLED header (not fitted by default); pre-crimped Molex harness route. | New. |

Other changes adopted with this freeze. They are PROPOSED part choices and bug fixes; see the architecture doc §(i).
- iCE40 **VCCPLL at 1.2 V**, not 3.3 V (TLV77312 + RC).
- MAX-M10S replaces LC76G.
- One DAC80508Z for HV plus an MCP4728 per head, replacing two 8-ch DAC80508.
- SHT45 + MS5607 replace BME280, for balloon use.
- DS90LV048A LVDS receivers.
- W25Q128 removed: the ESP32 configures the FPGA.
- ADS7128 ×3 and a PCA9554 expander.
- KiCad is the fab source.

**Still OPEN (user):**
- **LTE SIM provider.** Onomondo was not approved; other candidates are DT nuSIM, 1NCE and Hologram.
- **Which sites get TEC-fitted units.**
- **Firmware-signing key custody and device CA / MQTT broker owner.** The recommendation is GSU COSMIC, with an offline signing key and a self-hosted broker.

Verification gates before fab are listed in the architecture doc §(j). **Do not order the current Rev A.**

---

## 2026-07-11 — Original freeze answers (historical)

All ten questions were answered on 2026-07-11. These are now binding
architecture decisions for the first manufacturable revision.

1. **Must the entire first PCB be JLCPCB-assembled, including TEC drivers?**
   Yes. 100% JLCPCB assembly, no hand-placed exceptions and no daughterboard.
   Consequence: the TEC drive is frozen on `DRV8873HPWPR` (C2150604) H-bridges,
   one per channel; MAX1968 and daughterboard options are dropped.

2. **Battery/solar on the main PCB, or external?**
   **Updated requirement**: Onboard battery/solar **or** full 20 V / 5 A power management is required.
   Decision: Adopt TPS25751 + BQ2579x-class charger/power-path on the main PCB.
   This replaces the CH224K USB-C-PD-input-only approach. External modules remain possible but are no longer the only path. See PART_SELECTION.md power section.

3. **Exact TEC module per SiPM?**
   Same Sky `CP30238`: 20 x 20 x 3.8 mm, 8.6 V / 3 A max, Qmax 15 W,
   dTmax 66 degC, ~2.3 ohm. Run at roughly 1.2-1.8 A per channel for the
   15-25 degC target. Aluminum cold block, >= 40 x 40 x 20 mm hot-side
   heatsink, 40 mm 12 V tach fan per channel. See
   [parts/tec_cp30238/](parts/tec_cp30238/README.md).

4. **Three panels, four panels, or four-channel board?**
   Four-channel board that ships populated for three panels; the fourth
   channel is expansion if the science data justifies it. Coincidence masks
   default to exact-subset over channels 1-3.

5. **Baseline panel-cable length?**
   50 cm. AFE, cable capacitance/loss budget, and TEC/fan IR drop are all
   specified against a 50 cm hybrid cable.

6. **Separate coax plus keyed auxiliary connector, or one hybrid connector?**
   One hybrid locking panel connector per channel carrying shielded SiPM
   signal, bias, cold- and hot-side NTCs, TEC power, and fan power/tach.
   Touch-safe, keyed, no exposed bias on any shell. Exact connector family is
   still an open selection, but the two-connector scheme is retired.

7. **Calibration injection per-channel or shared?**
   Per-channel from the start: independent charge injection and optical test
   hooks on all four channels (DNP allowed where cost matters, but on the
   schematic and layout now).

8. **Does USB-C 5 V fallback collect science data?**
   Yes. 5 V fallback is a valid science mode with TECs and fans disabled.
   Cooling is an enhancement, not a prerequisite for data validity.

9. **Fan tach, hot-side NTC, enclosure-open, condensation sensors?**
   All required on the first PCB.

10. **Hardware vs firmware safety for TECs (new)**
    TEC power must default OFF in hardware. Invalid NTC, hot-side overtemp,
    insufficient PD contract, watchdog loss, or overcurrent must all force
    shutdown independently of any processor. See PART_SELECTION.md and
    thermal.kicad_sch for interlock architecture.

11. **Telemetry subsystem (new)**
    nRF9151 remains primary for cellular. Add RP2040 as dedicated telemetry
    co-processor (PIO for sensors/tach, USB local interface). Optional path
    for nRF54-class BLE later if local wireless field access is required.
    See parts/telemetry_rp2040/.

12. **DAC architecture (new)**
    Two 8-channel precision DACs (DAC80508 class preferred) instead of one
    8-ch + small secondary. 16 total outputs for thresholds, HV trim,
    injection, TEC refs, spares.

10. **Should cellular certification risk dominate outline and antenna
    placement?**
    Yes. Follow the Nordic nRF9151 reference antenna geometry and RF layout
    as closely as possible and let it constrain the board outline early.
