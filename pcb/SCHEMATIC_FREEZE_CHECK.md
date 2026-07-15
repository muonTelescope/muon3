# Muon3 schematic freeze check

Date: 2026-07-11 (updated same day with decision answers)

Status: architecture decisions frozen. All ten freeze questions were answered
on 2026-07-11 — see [freeze_questions.md](freeze_questions.md). The remaining
freeze blockers are exact-part selections (comparator, DACs, regulators, ADC,
hybrid connector, TCXO, SIM hardware, protection network), not architecture.

## Freeze recommendation

Use a two-step freeze:

1. Freeze the detector, timing, telemetry, and low-power rails now; the open
   questions are answered.
2. Keep the TEC/Peltier power stage behind a clearly isolated interface until
   the one-channel thermal coupon confirms the CP30238 operating point,
   heatsink, fan, and measured parasitic load.

This keeps the cosmic-ray instrument moving without letting the cooling system
quietly dominate the whole board.

## Decisions from 2026-07-11

| # | Question | Decision |
| --- | --- | --- |
| 1 | JLC-only assembly incl. TEC drivers? | Yes, 100% JLCPCB. DRV8873 frozen; MAX1968/daughterboard dropped. |
| 2 | Battery/solar on board? | No. Protected USB-C PD input only; storage/solar external. |
| 3 | Exact TEC module? | Same Sky CP30238, 20x20x3.8 mm, 8.6 V/3 A, Qmax 15 W. See [parts/tec_cp30238/](parts/tec_cp30238/README.md). |
| 4 | Panel count? | Four-channel board, ships populated for three panels, fourth is expansion. |
| 5 | Panel cable length? | 50 cm baseline. |
| 6 | Connector scheme? | Single hybrid locking panel connector per channel (signal, bias, NTCs, TEC, fan/tach). |
| 7 | Calibration injection? | Per-channel charge and optical injection from the start. |
| 8 | 5 V fallback science-valid? | Yes; TECs/fans off, science data valid. |
| 9 | Extra thermal/enclosure sensors? | All required: 4x fan driver+tach, 4x hot-side NTC, enclosure-open, humidity/dew point. |
| 10 | Nordic antenna geometry dominates? | Yes; reference RF layout constrains outline early. |

## Live JLCPCB confirmation snapshot

Checked from public JLCPCB part pages on 2026-07-11. Stock is volatile; re-check
inside the JLCPCB BOM tool immediately before ordering.

| Block | Part | JLCPCB status | Freeze posture |
| --- | --- | --- | --- |
| SiPM HV boost | `LT3482EUD#TRPBF`, `C515895` | Extended, APD boost to 90 V, Standard PCBA (not Basic), re-check live stock | Freeze for HCal-tile S12572 ~70 V path; OVP/HV_MON/DAC trim required. |
| TIA | `OPA858IDSGR`, `C970232` | JLCPCB page confirms WSON-8-EP(2x2), FET-input amplifier, assembly support, EasyEDA footprint/symbol | Freezeable for prototype after analog bias/common-mode review. |
| Cellular/GNSS | `nRF9151-LACA-R7`, `C22397843` | LGA-113(12.1x11.1), Standard Only PCBA, MSL 3, X-ray required, SMT assembly | Frozen; Nordic reference layout and Standard PCBA (decision 10). |
| USB-C PD sink | `CH224K`, `C970725` | ESSOP-10, PD 3.0, advertised 5/9/12/15/20 V output profiles, assembly support | Frozen for this revision (decision 2): USB-C-only input, no onboard battery/solar. |
| FPGA | `ICE40UP5K-SG48I`, `C2678152` | QFN-48-EP(7x7), JLC assembly support, EasyEDA footprint/symbol | Freezeable; keep VCC/VCCPLL at 1.2 V. |
| Peltier bridge | `DRV8873HPWPR`, `C2150604` | HTSSOP-24-EP, SMT assembly, in stock 261, available order qty 245 | Frozen (decision 1). Reserve stock early or qualify `DRV8876PWPR` as the drop-in fallback. |

## Parts not ready to freeze

| Block | Current candidate | Reason not frozen | Recommended action |
| --- | --- | --- | --- |
| Comparator | `TLV3601IDBVR` | Good timing part, but no live JLC confirmation captured in this pass | Keep as performance reference; find an exact JLC part page or qualify a JLC-stocked alternate. |
| Threshold/bias DACs | `DAC60508ZRTET`, second DAC TBD | Requirements prefer two 8-channel DACs; live JLC status not confirmed | Freeze only after choosing one exact DAC family and output count. |
| 3.3 V buck | `TPS62933` family | Technically excellent, exact JLC orderable number not confirmed | Confirm exact suffix/LCSC code and inductor values. |
| 1.2 V FPGA rail | small buck or LDO TBD | Load/current margin depends on FPGA use and power tree | Use a real >=200 mA regulator, not the 60 mA XC6206 except as a last-resort low-load fallback. |
| External ADC | TBD | Eight NTC channels, HV monitor, TEC current/voltage, and rails now confirmed in scope (decision 9) | Add a multichannel ADC; choose I2C/SPI, resolution, and JLC-stocked MPN. |
| Hybrid panel connector | TBD | Decision 6 fixes the architecture (single hybrid locking connector) but not the family | Select a keyed locking family rated for 3 A TEC contacts plus shielded signal at 50 cm; per-channel. |
| Fan drive | Low-side FET (AO3400-class) + tach input per channel | Simple JLC-basic path; exact FET/flyback/tach conditioning not yet drawn | Draw four fan channels with tach interlock; confirm fan MPN tach suffix. |
| SIM/eSIM | TBD | Physical SIM holder and optional MFF2 eSIM exact footprints still open | Pick nano-SIM holder and DNP eSIM footprint from JLC. |
| TCXO | TBD | Timing target needs exact stability, output format, voltage, and footprint | Choose 25 MHz or other final FPGA clock source after timing architecture is frozen. |
| USB/protection | TBD | Safety/reliability critical | Select TVS, eFuse/current limit, reverse protection, and rail telemetry parts. |

## Frozen architecture choices

- Detector: Hamamatsu S12572-33-015P on decommissioned HCal tiles; Vbr bin and
  OV target set the LT3482 ~68–75 V rail (not MicroFC/TPS61170).
- AFE: OPA858 plus TLV3601-class dual thresholds per channel; Rf/Cf retuned for
  ~37 fC/p.e.; comparator
  sourcing must be confirmed before symbol freeze.
- Logic: iCE40UP5K-SG48I plus nRF9151-LACA-R7.
- USB-C: CH224K PD sink, USB-C-only input this revision (decision 2). A
  TPS25751-class architecture is deferred to a future revision if onboard
  battery/solar ever moves on board.
- TEC: DRV8873 H-bridge per channel (decision 1) driving one CP30238 per SiPM
  (decision 3), hardware-default-off interlocks, ITRIP <= 2.5 A.
- Calibration: per-channel charge and optical injection (decision 7).
- Sensors: 4x cold NTC, 4x hot NTC, 4x fan tach, enclosure-open,
  BME280 humidity/pressure with dew-point interlock (decision 9).
- DACs: two 8-channel DACs; spare outputs cover baseline trim, HV trim, TEC
  setpoints, and calibration amplitude.
- External ADC: required; the nRF9151 ADC must not carry the telemetry system.

## Evidence notes

- JLCPCB page for `TPS61170DRVR/C15163` reports WSON-6(2x2), SMT assembly,
  Economic and Standard PCBA, in stock 3920, available order quantity 3731.
- JLCPCB page for `DRV8873HPWPR/C2150604` reports HTSSOP-24-EP, SMT assembly,
  in stock 261, available order quantity 245.
- JLCPCB page for `nRF9151-LACA-R7/C22397843` reports Standard Only PCBA,
  MSL 3, and required X-ray inspection.
- JLCPCB page for `CH224K/C970725` reports PD 3.0, 5/9/12/15/20 V output
  profiles, 4-30 V supply range, and 100 W listing.
- Same Sky CP30 datasheet (rev 1.04, 2024-09-12, downloaded to
  `parts/tec_cp30238/CP30.pdf`) confirms CP30238: 20 x 20 x 3.8 mm, Vmax
  8.6 V, Imax 3 A, Qmax 15 W at Th=27 degC, dTmax 66 degC, internal
  resistance 2.07-2.53 ohm. Stocked at Digi-Key as 102-1667-ND.
- MAX1968 remains technically attractive for quiet TEC current control but is
  excluded by the 100% JLCPCB assembly decision.
