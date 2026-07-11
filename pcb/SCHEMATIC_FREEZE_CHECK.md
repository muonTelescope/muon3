# Muon3 schematic freeze check

Date: 2026-07-11

Status: not frozen. The architecture is converging, but several choices still
change symbols, footprints, connectors, rail sizing, and thermal safety.

## Freeze recommendation

Use a two-step freeze:

1. Freeze the detector, timing, telemetry, and low-power rails after the open
   questions below are answered.
2. Keep the TEC/Peltier power stage behind a clearly isolated interface until
   the actual TEC module, heatsink, fan, and power budget are measured.

This keeps the cosmic-ray instrument moving without letting the cooling system
quietly dominate the whole board.

## Live JLCPCB confirmation snapshot

Checked from public JLCPCB part pages on 2026-07-11. Stock is volatile; re-check
inside the JLCPCB BOM tool immediately before ordering.

| Block | Part | JLCPCB status | Freeze posture |
| --- | --- | --- | --- |
| SiPM HV boost | `TPS61170DRVR`, `C15163` | Extended, WSON-6(2x2), SMT assembly, Economic and Standard PCBA, in stock 3920, available order qty 3731 | Freezeable for prototype, with OVP and bias-margin review. |
| TIA | `OPA858IDSGR`, `C970232` | JLCPCB page confirms WSON-8-EP(2x2), FET-input amplifier, assembly support, EasyEDA footprint/symbol | Freezeable for prototype after analog bias/common-mode review. |
| Cellular/GNSS | `nRF9151-LACA-R7`, `C22397843` | LGA-113(12.1x11.1), Standard Only PCBA, MSL 3, X-ray required, SMT assembly | Freezeable only with Nordic reference layout and Standard PCBA. |
| USB-C PD sink | `CH224K`, `C970725` | ESSOP-10, PD 3.0, advertised 5/9/12/15/20 V output profiles, assembly support | Usable for P0 prototype, but not ideal for full 100 W/battery architecture. |
| FPGA | `ICE40UP5K-SG48I`, `C2678152` | QFN-48-EP(7x7), JLC assembly support, EasyEDA footprint/symbol | Freezeable; keep VCC/VCCPLL at 1.2 V. |
| Peltier bridge | `DRV8873HPWPR`, `C2150604` | HTSSOP-24-EP, SMT assembly, in stock 261, available order qty 245 | Freezeable only if we accept H-bridge TEC control and reserve stock early. |

## Parts not ready to freeze

| Block | Current candidate | Reason not frozen | Recommended action |
| --- | --- | --- | --- |
| Comparator | `TLV3601IDBVR` | Good timing part, but no live JLC confirmation captured in this pass | Keep as performance reference; find an exact JLC part page or qualify a JLC-stocked alternate. |
| Threshold/bias DACs | `DAC60508ZRTET`, second DAC TBD | Requirements now prefer two 8-channel DACs; live JLC status not confirmed | Freeze only after choosing one exact DAC family and output count. |
| 3.3 V buck | `TPS62933` family | Technically excellent, exact JLC orderable number not confirmed | Confirm exact suffix/LCSC code and inductor values. |
| 1.2 V FPGA rail | small buck or LDO TBD | Load/current margin depends on FPGA use and power tree | Use a real >=200 mA regulator, not the 60 mA XC6206 except as a last-resort low-load fallback. |
| USB-C PD full-power controller | `TPS25751` class | Requirements now call for 15 V/3 A or 20 V/5 A and possible battery/solar; CH224K is simpler but less managed | Decide whether this board needs full 100 W policy/power-path control now or later. |
| Battery/solar charger | `BQ25798` class | Architecture decision, not a part-choice detail | Decide onboard battery/solar vs external qualified module. |
| TEC controller | `MAX1968` vs `DRV8873` | MAX1968 is technically better for quiet TEC current control, but JLC assembly availability is not confirmed | If JLC-only is mandatory, use DRV8873 or another confirmed driver; if thermal performance dominates, allow hand-placed/sourced MAX1968 or daughterboard. |
| External ADC | TBD | Thermal sensors plus HV monitor exceed practical nRF9151 ADC use | Add a multichannel ADC; choose I2C/SPI, resolution, and JLC-stocked MPN. |
| Panel connector | TBD | Mechanically and electrically defining; affects all channel sheets | Select keyed connector/cable before schematic freeze. |
| SIM/eSIM | TBD | Physical SIM holder and optional MFF2 eSIM exact footprints still open | Pick nano-SIM holder and DNP eSIM footprint from JLC. |
| TCXO | TBD | Timing target needs exact stability, output format, voltage, and footprint | Choose 25 MHz or other final FPGA clock source after timing architecture is frozen. |
| USB/protection | TBD | Safety/reliability critical | Select TVS, eFuse/current limit, reverse protection, and rail telemetry parts. |

## Proposed freeze choices

- Detector: freeze around MicroFC-30035, but require exact package suffix and
  overvoltage target before final HV range.
- AFE: freeze OPA858 plus TLV3601-class dual threshold only after comparator
  sourcing is confirmed.
- Logic: freeze iCE40UP5K-SG48I plus nRF9151-LACA-R7.
- USB-C: use CH224K for a P0 USB-C-powered prototype without battery/solar, but
  move to TPS25751-class architecture if the board must manage 15 V/3 A,
  20 V/5 A, battery charging, solar input, and safe power-path arbitration.
- TEC: if "completely JLCPCB assembled" is strict, freeze DRV8873-class
  current-limited H-bridge. If "best thermal control" is allowed to override
  JLC convenience, use MAX1968 or a TEC daughterboard.
- DACs: freeze two 8-channel DACs rather than one 8-channel plus crumbs. The
  spare outputs are cheap insurance for baseline trim, HV trim, TEC setpoints,
  and calibration injection.
- External ADC: add it now. The nRF9151 ADC should not be the whole analog
  telemetry system.

## Questions that affect schematic freeze

1. Should the first manufacturable board be JLC-only even if that makes the TEC
   driver less ideal, or may the TEC section use a sourced/hand-placed part or
   daughterboard?
2. Should battery/solar charging be on this PCB now, or should this revision
   only expose a protected DC/USB-C input and leave battery/solar to an external
   qualified module?
3. What is the baseline TEC module per channel: voltage, maximum current,
   physical size, cold-plate mounting, heatsink, and fan assumption?
4. Is the baseline station three panels or four panels? The controller has four
   analog channels, but the mechanical stack and coincidence masks depend on the
   intended default.
5. What panel cable length should the AFE tolerate: short internal pigtail
   under 20 cm, roughly 1 m, or longer outdoor/service cable?
6. Should the SiPM signal stay coax-only with separate power/thermal connector,
   or should we choose a single hybrid locking panel connector?
7. Should the board include an optical/electrical calibration pulser connector
   per channel, or only a shared calibration input for the first prototype?
8. Do we need EU and US cellular certification risk minimized by using a
   pre-certified antenna/reference layout exactly, even if the board outline is
   less convenient?
9. Should USB-C fallback at 5 V still collect science data with TECs disabled,
   or is 5 V only a debug/configuration mode?
10. Should the initial board include environmental sealing/condensation
    interlock connectors for fan/hot-side sensors, or just cold-side NTCs?

## Evidence notes

- JLCPCB page for `TPS61170DRVR/C15163` reports WSON-6(2x2), SMT assembly,
  Economic and Standard PCBA, in stock 3920, available order quantity 3731.
- JLCPCB page for `DRV8873HPWPR/C2150604` reports HTSSOP-24-EP, SMT assembly,
  in stock 261, available order quantity 245.
- JLCPCB page for `nRF9151-LACA-R7/C22397843` reports Standard Only PCBA,
  MSL 3, and required X-ray inspection.
- JLCPCB page for `CH224K/C970725` reports PD 3.0, 5/9/12/15/20 V output
  profiles, 4-30 V supply range, and 100 W listing.
- ADI/MAX1968 data sheet confirms the TEC-specific benefits: direct current
  control, bipolar +/-3 A operation, ripple cancellation, and a 3.0-5.5 V input
  rail. That is technically attractive but not yet confirmed as JLC-assembly
  compatible.
