# Next-Generation Muon Telescope Requirements

Status: baseline requirements captured 2026-07-11. Items marked PROVISIONAL require prototype
measurement or a component selection review.

## Scientific priorities

In priority order:

1. Inter-station extensive-air-shower coincidence.
2. Long-duration atmospheric and space-weather muon-rate monitoring.
3. Directional tracking.

The instrument must preserve raw timing-quality and livetime metadata while also producing
stable, environmentally corrected rate products.

## Detector geometry

- Baseline panel: 200 x 200 x 10 mm plastic scintillator.
- One glued, embedded wavelength-shifting fiber routed in a loop.
- Baseline telescope: at least three panel layers; final layer spacing and mechanical orientation
  remain configurable because they set solid-angle acceptance and tracking resolution.
- Four analog channels on the controller. Other panel geometries must remain possible.
- Production SiPM: onsemi MicroFC-30035.
- Existing GSU/sPHENIX-derived measured panel data must be imported and analyzed in calibrated
  photoelectrons before analog dynamic range is frozen.

## Analog acquisition

- Four DC-coupled SiPM TIA channels, subject to correcting the OPA858 common-mode violation.
- Preferred fix: clean 5 V analog rail for OPA858 and a separately filtered reference/DAC domain;
  validate with an official model and one-channel coupon.
- Two comparator thresholds per channel for dual-threshold ToT: eight thresholds total.
- Independent per-channel baseline trim: four outputs.
- One HV trim output plus at least three spare analog outputs.
- Preferred DAC provision: two 8-channel DACs (16 outputs total), with readback or factory
  calibration of every output. DAC80508-class SPI devices are a candidate; final choice must be
  validated for output range, reference noise, startup state, availability, and power.
- Nominal 3 p.e. trigger remains PROVISIONAL. Hardware must support calibrated scans from below
  1 p.e. through the full muon-efficiency plateau.
- Per-channel charge injection and optical test injection are required.

## SiPM interconnect

- HV on a touchable U.FL shield is no longer required and should be removed.
- Preferred signal connector: coax center = SiPM anode signal, shield = ground.
- Provide a keyed, touch-safe auxiliary connector per channel for SiPM bias, cold-side NTC,
  TEC power, and optional hot-side NTC/fan signals. A combined locking hybrid connector may be
  evaluated if signal integrity and service safety remain adequate.
- Default HV state must be off under loss of MCU, DAC, firmware, cable, or sensor validity.

## Timing and digital processing

- iCE40UP5K remains the timing device, with VCCPLL corrected to filtered 1.2 V.
- External TCXO and GNSS PPS remain required.
- PROVISIONAL timing targets:
  - FPGA system clock: 100 MHz or faster, giving 10 ns base bins.
  - Capture any active-low pulse >= 5 ns without loss.
  - Programmable coincidence window: 10 ns to 2 us.
  - Programmable/bypassable holdoff: 0 to at least 50 us.
  - Inter-channel timestamp skew after calibration: <= 2 ns typical, <= 5 ns over temperature.
  - PPS timestamp uncertainty reported per station; target <= 50 ns when locked.
- Required FPGA products: raw singles, exact-subset counts, leading/trailing timestamps,
  dual-threshold ToT histograms, shadow-window accidentals, muon-lifetime histogram,
  livetime/deadtime, overflow/drop counters, PPS counter latch, and calibration-pulse control.
- Production RTL requires CDC/metastability analysis, synthetic-pulse verification, formal or
  exhaustive counter/register tests, and atomic SPI snapshots.

## Cellular controller

- Controller: integrate the nRF9151-LACA SiP directly, following Nordic's reference layout,
  RF grounding, antenna matching, SIM protection, approved BOM, and certification guidance.
  The prior generic J7/J8 carrier headers are dropped from the baseline.
- Initial regions: European Union and United States.
- Connectivity: Onomondo or Deutsche Telekom nuSIM/eSIM plus a physical SIM option.
- Radio support: LTE-M and NB-IoT; roaming, APN provisioning, PSM/eDRX, physical-SIM ESD, and
  antenna tuning must be validated in both regions.
- Required security: unique device identity, encrypted authenticated telemetry, signed OTA with
  rollback, configuration audit log, secure recovery, and credential provisioning.

## USB-C power and power delivery

- The instrument must operate from USB-C.
- Implement a standards-compliant USB-C PD sink; do not rely on passive CC resistors for the TEC
  power case.
- Recommended input profiles: 5 V fallback for detector operation without active cooling, and
  15 V/3 A or 20 V/5 A negotiated modes for TEC operation.
- Preferred PD starting point: TPS25751-class 100 W sink/controller. If a 2-4 cell battery is
  integrated, evaluate the documented TPS25751 + BQ25798 pairing; use the corresponding TI
  reference design rather than creating the PD/power-path implementation from first principles.
- Provide input ESD/surge protection, eFuse/current limiting, reverse-current protection, UVLO,
  telemetry, and controlled rail sequencing.
- Generate at least: RF/controller supply, quiet 5 V analog, 3.3 V digital, filtered 3.3 V
  comparator/reference as needed, 1.2 V FPGA core/PLL, approximately 30 V SiPM bias, and TEC rail.
- Maintain one ground system, but isolate noisy converters through placement, filtered branches,
  current-return control, and acquisition-aware switching.
- Battery/solar support is desired on-board or through a qualified module: charger, protection,
  power path, fuel gauge, external MPPT/solar interface, and safe USB/battery arbitration.

## Four-channel Peltier/TEC subsystem

- One independently controlled TEC output per SiPM channel.
- Cooling goal is reduced dark count and stable gain, not unrestricted minimum temperature.
- Normal control modes:
  1. fixed SiPM temperature;
  2. fixed delta below ambient; and
  3. dew-point-limited mode, maintaining the cold assembly at least 3 degC above calculated dew
     point unless the SiPM cavity is sealed and dry.
- Sensors per channel:
  - mandatory cold-side 10 kOhm NTC adjacent to SiPM;
  - strongly recommended hot-side/heatsink NTC;
  - enclosure ambient temperature/humidity/pressure sensor in ventilated, solar-shielded airflow.
- Add a multi-channel external ADC because HV_MON plus 4-8 thermal sensors exceed the practical
  nRF9151 ADC allocation and remote accuracy needs.
- TEC driver requirements per channel (PROVISIONAL until TEC selected):
  - 0-3 A bidirectional current control;
  - preferred driver candidate: MAX1968, which is an active-production, EMI-optimized bipolar
    +/-3 A TEC controller from a 3.0-5.5 V rail; create a dedicated high-current 5 V TEC rail from
    the negotiated PD input;
  - current and voltage telemetry;
  - hardware current limit, open/short detection, thermal shutdown, and default off;
  - filtered/synchronized PWM or linear current regulation so switching does not create triggers.
- Put TEC power stages and inductors in a quarantined region or on a separate daughterboard.
- Hard interlocks: disable TEC on invalid NTC, hot-side overtemperature, absent fan, excessive
  condensation risk, overcurrent, or insufficient PD contract.
- Mechanical design must include cold-side insulation, low-conductivity mounting, a real hot-side
  heat path, fan/heatsink monitoring, drainage/condensation management, and service access.

## Environmental and scientific telemetry

Every report must contain:

- station ID, firmware/RTL/configuration versions and reset reason;
- UTC/PPS lock, counter-per-PPS, timing uncertainty, and holdover state;
- singles, exact subsets, dual-ToT histograms, accidentals, livetime/deadtime, and overflow/drop;
- thresholds, baselines, HV setpoint/readback, SiPM temperatures, TEC currents/power, hot-side
  temperatures, ambient temperature/humidity/pressure, supply rails, and PD contract;
- pressure-corrected and uncorrected counts, with correction coefficients/version retained;
- calibration state and last electrical/optical self-test result.

## Initial engineering acceptance targets

These are reasonable prototype targets and must be tightened from measured data:

- Per-panel muon detection efficiency: >= 95% at the selected operating point.
- Electronics-only false-trigger rate: < 0.01 Hz/channel.
- Measured accidental coincidence contribution: < 1% of accepted coincidence rate, continuously
  estimated by shadow windows.
- Electrical channel-to-channel false coincidence during injection: < 1e-4 per injected pulse.
- Gain/threshold-equivalent drift after compensation: <= 2% over the qualified temperature range.
- No event loss at 10x the highest measured dark/signal rate; all overflow is counted and reported.
- Station livetime: >= 99.5% excluding declared updates/calibration; RF/TEC blanking reported.
- TEC regulation: +/-0.25 degC steady state; hot-side and dew-point interlocks independently tested.
- USB-C 5 V fallback must retain safe counting and telemetry with TECs disabled.

## Open measurements and selections

1. Import the user's measured single-p.e./muon distributions and temperature scans.
2. Select exact MicroFC-30035 variant/package, overvoltage, TEC, cold plate, heatsink, and fan.
3. Freeze number of panels and layer spacing for the baseline station.
4. Freeze the nRF9151-LACA reference-layout implementation and antenna system.
5. Select the USB-C PD controller, battery/solar power-path architecture, TEC driver, external
   ADC, DACs, and all regulator parts.
6. Decide whether the TEC subsystem resides on the detector PCB or a replaceable power daughterboard.
