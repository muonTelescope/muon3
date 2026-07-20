# Muon3 design rules

- Four Hamamatsu S12572-33-015P channels (decommissioned sPHENIX HCal tiles); each has independent ~70 V bias filtering (LT3482), TIA, low/high thresholds, NTC and reversible Peltier control.
- Comparator events are active-low at the FPGA boundary. Preserve exact-subset mask order `3,5,9,6,10,12,7,11,13,14,15`.
- Holdoff is firmware bypassable for double-pulse/muon-lifetime studies.
- One continuous ground system. Use placement and return-path control, not split planes.
- No copper pour under or immediately around each TIA summing node; guard and keepout dimensions come from the final footprint/parasitic simulation.
- Peltier switching, USB PD and HV boost are separate placement regions with short hot loops and no routing through the AFE region.
- SiPM bias (~70 V class) never appears on a touchable coax connector shell; use 100 V-rated passives on the HV path and higher-BV clamps than BAV99.
- nRF9151 RF layout, antenna keepout, decoupling and LGA escape follow the Nordic reference layout.
- VCC/VCCPLL for iCE40UP5K are 1.2 V. VCCIO banks are 3.3 V only where the assigned I/O standard permits it.
- USB fallback at 5 V must boot electronics safely with cooling disabled.
- Hardware limits **always override** firmware for Peltier power: invalid NTC, hot-side overtemperature, insufficient PD contract, watchdog loss, or overcurrent must independently force TECs and fans off (latching where appropriate). Firmware can only request enable.
- Explicit hardware interlock block required in the thermal section (comparators + logic or load switch enables). Status readable but not bypassable by processors.
- nRF9151 is primary cellular. RP2040 added as telemetry co-processor (PIO for tach/sensors, USB local interface). Two 8-ch precision DACs (DAC80508 class) for all analog references.
- Board target: four-layer JLCPCB Standard PCBA, components predominantly on the top side.
- **Placement / shielding plan** (tscircuit): `pcb/tscircuit/` → zones RF | DIGITAL | AFE | HV | POWER | TEC on a 160×120 mm outline; antenna keepout r=15 mm; TIA no-pour 6×6 mm keepouts; AFE + optional RF shield cans; AFE↔TEC separation ≥25 mm. Regenerate with `cd pcb/tscircuit && bun run render`. Details: `pcb/PLACEMENT_SHIELDING.md`.
