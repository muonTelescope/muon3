# Panel connector

Status: release blocker.

Role: touch-safe, keyed connection to each scintillator panel assembly.

Required conductors:

- SiPM bias.
- SiPM signal/return or signal coax pair depending on final AFE partition.
- NTC pair.
- Peltier positive/negative or H-bridge output pair.
- Optional shield/drain if the cable construction supports it safely.

Selection target:

- Polarized locking connector with enough current rating for the Peltier path.
- Creepage/clearance suitable for the SiPM bias, including field contamination.
- JLCPCB-assembled board connector or a deliberate hand-assembly exception.

Rejected legacy pattern:

- Do not put SiPM HV on an exposed U.FL shield/shell.

Open action: pick a JST-GH, Molex Micro-Lock, Hirose, or similar family after the
panel cable and Peltier current are specified.
