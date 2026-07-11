# Questions before schematic freeze

Please answer these when convenient; the first three are the ones that change
the PCB the most.

1. Must the entire first PCB be JLCPCB-assembled with no hand-placed exceptions,
   including the TEC/Peltier drivers?
2. Should battery/solar support be on the main PCB now, or left to an external
   qualified module for this revision?
3. What exact TEC/Peltier module should I design around per SiPM: voltage,
   current, dimensions, and expected heatsink/fan?
4. Is the default telescope three panels or four panels?
5. How long should the panel cable be in the baseline station?
6. Do you prefer separate coax signal plus keyed auxiliary connector, or one
   hybrid locking panel connector?
7. Should calibration injection be per-channel or shared?
8. Should USB-C 5 V fallback collect science data with TECs off, or only support
   debug/configuration?
9. Are fan tach / hot-side NTC / enclosure-open sensors required on the first
   revision?
10. Should cellular certification risk dominate antenna/mechanical placement,
    meaning we follow Nordic/reference antenna geometry as closely as possible?
