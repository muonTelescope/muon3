# Muon3 design rules

- Four MicroFC-30035 channels; each has independent bias filtering, TIA, low/high thresholds, NTC and reversible Peltier control.
- Comparator events are active-low at the FPGA boundary. Preserve exact-subset mask order `3,5,9,6,10,12,7,11,13,14,15`.
- Holdoff is firmware bypassable for double-pulse/muon-lifetime studies.
- One continuous ground system. Use placement and return-path control, not split planes.
- No copper pour under or immediately around each TIA summing node; guard and keepout dimensions come from the final footprint/parasitic simulation.
- Peltier switching, USB PD and HV boost are separate placement regions with short hot loops and no routing through the AFE region.
- SiPM bias never appears on a touchable coax connector shell.
- nRF9151 RF layout, antenna keepout, decoupling and LGA escape follow the Nordic reference layout.
- VCC/VCCPLL for iCE40UP5K are 1.2 V. VCCIO banks are 3.3 V only where the assigned I/O standard permits it.
- USB fallback at 5 V must boot electronics safely with cooling disabled.
- Hardware limits override firmware for Peltier overcurrent/overtemperature and HV overvoltage.
- Board target: four-layer JLCPCB Standard PCBA, components predominantly on the top side.
