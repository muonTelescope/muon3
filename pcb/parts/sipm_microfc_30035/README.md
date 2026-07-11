# MicroFC-30035 SiPM

Preferred detector: onsemi/SensL `MicroFC-30035`

Current role: off-board SiPM coupled to the looped wavelength-shifting fiber in
each scintillator panel.

Why selected:

- User-selected detector for the next-generation design.
- 3 mm class active area is a reasonable match to embedded fiber readout.
- Existing project history already used SensL/onsemi MPPC-style sensors.

Design cautions:

- Confirm exact package suffix, breakdown-voltage bin, overvoltage target,
  temperature coefficient, and whether the chosen mechanical coupling wants SMT,
  TSV, or cabled packaging.
- The PCB connector must be touch-safe and keyed; do not carry SiPM HV on an
  exposed U.FL shell as in the legacy constraint.
- Bias compensation should use the per-channel NTC/Peltier assembly temperature,
  not just board temperature.

Alternates:

- MicroFJ-30035 family if packaging/coupling is mechanically better.
- Larger-area SiPM only if photon statistics demand it and capacitance/noise
  remain acceptable.

Downloaded: `MicroC-Series.pdf`
