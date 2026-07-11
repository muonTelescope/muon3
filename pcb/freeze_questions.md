# Schematic-freeze questions and decisions

All ten questions were answered on 2026-07-11. These are now binding
architecture decisions for the first manufacturable revision.

1. **Must the entire first PCB be JLCPCB-assembled, including TEC drivers?**
   Yes. 100% JLCPCB assembly, no hand-placed exceptions and no daughterboard.
   Consequence: the TEC drive is frozen on `DRV8873HPWPR` (C2150604) H-bridges,
   one per channel; MAX1968 and daughterboard options are dropped.

2. **Battery/solar on the main PCB, or external?**
   "Whatever is easier" — decided as the easier path: this revision exposes
   only a protected USB-C PD input (CH224K sink plus a real protection
   network). Energy storage/solar stays in an external qualified module that
   presents USB-C PD or a clean DC input. No BQ25798-class charger on board.

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
   All required on the first PCB: four fan drivers with tach readback, four
   hot-side NTC inputs (eight NTC channels total), enclosure-open switch
   input, and humidity/dew-point sensing (BME280 plus dew-point interlock
   logic). This confirms the multichannel external ADC requirement.

10. **Should cellular certification risk dominate outline and antenna
    placement?**
    Yes. Follow the Nordic nRF9151 reference antenna geometry and RF layout
    as closely as possible and let it constrain the board outline early.
