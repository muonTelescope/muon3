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

**Not an alternate on this bias rail:** Hamamatsu **S12572-33-015P** (sPHENIX
HCal) — correct device for HCal *tile* models, but needs ~70 V and has ~13×
lower charge/p.e. See `../sipm_hamamatsu_s12572/` and
`sim/circuit/HAMAMATSU_SIPM_COMPATIBILITY.md`. Prefer keeping MicroFC-30035 as
the only SiPM that matches the frozen TPS61170 + OPA858 production design.

Downloaded: `MicroC-Series.pdf`
