# Schematic-freeze questions and decisions

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
