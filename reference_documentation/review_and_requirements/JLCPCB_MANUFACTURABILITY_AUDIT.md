# JLCPCB Manufacturability and Component Audit

Audit date: 2026-07-11  
Design audited: `next_generation/nextgen_review/hardware/muon_telescope_v10/muon_telescope.kicad_pcb` (Rev A)

## Result

**Rev A is not orderable as a functional PCBA.** Its 107 electrical references and four mounting holes are placed, but the PCB has no routed copper segments. It also contains electrical design faults and incomplete functions documented in `NEXT_GENERATION_PCB_REVIEW.md`. Component availability alone cannot make it manufacturable.

The existing BOM has 38 purchasing lines. Most commodity lines have usable public JLCPCB/LCSC choices, but several lines are unresolved and several stocked parts must still be changed for electrical reasons. The proposed nRF9151, USB-C PD, SIM/eSIM, four Peltier drivers, extra DACs, dual thresholds, four MPPC/NTC interfaces, and revised power tree are not present in this Rev A BOM and therefore are not covered by its counts.

Stock is volatile. “In stock” below means that the official JLCPCB catalog showed public stock during this audit; it is not a reservation. Pre-order critical extended parts before releasing production.

## Existing Rev A BOM

| Qty | References | Function/value | Package | JLCPCB part | Class / stock | Decision |
|---:|---|---|---|---|---|---|
| 4 | R106,R116,R126,R136 | 2 kΩ 1% | 0402 | C4109 | Basic, in stock | Keep |
| 5 | R13,R101,R111,R121,R131 | 100 kΩ 1% | 0402 | C25741 | Basic, in stock | Keep |
| 4 | R102,R112,R122,R132 | 10 Ω 1% | 0402 | C25077 | Basic, in stock | Keep |
| 9 | R10,R103,R104,R113,R114,R123,R124,R133,R134 | 1 kΩ 1% | 0402 | C11702 | Basic, in stock | Keep |
| 4 | R105,R115,R125,R135 | 33 Ω 1% | 0402 | C25105 | Basic, in stock | Keep |
| 1 | R11 | 270 kΩ 1% | 0603 | C22965 | Basic/catalogued | Verify stock at quote |
| 3 | R12,R32,R33 | 10 kΩ 1% | 0402 | C25744 | Basic/catalogued | Keep |
| 1 | R15 | 62 kΩ 1% | 0603 | C23221 | Basic/catalogued | Keep |
| 1 | R14 | 1 MΩ 1% | 0402 | C26083 | Basic/catalogued | Keep; verify working voltage |
| 3 | R16,R30,R31 | 4.7 kΩ 1% | 0402 | C25900 | Basic/catalogued | Keep |
| 3 | R35,R36,R37 | 100 Ω 1% | 0402 | C25076 | Basic/catalogued | Remove or add actual LEDs; these currently terminate FPGA RGB pins without LEDs |
| 1 | R20 | 0 Ω link | 0402 | **none** | **Bad mapping** | Assign a real 0 Ω part; generator currently inherits 100 Ω C25076 |
| 4 | C106,C116,C126,C136 | 2.2 pF C0G | 0402 | C1559 | Basic/catalogued | Keep only after TIA re-simulation/layout parasitic budget |
| 16 | C30-C33,C102-C104,C112-C114,C122-C124,C132-C134 | 100 nF | 0402 | C1525 | Basic/catalogued | Keep; add missing FPGA/rail decoupling |
| 1 | C13 | 10 nF | 0402 | C15195 | Basic/catalogued | Keep |
| 5 | C22,C105,C115,C125,C135 | 1 µF 25 V X5R | 0402 | C52923 | Basic, in stock | Keep where DC-bias derating is acceptable |
| 2 | C20,C21 | 10 µF | 0603 | C19702 | Catalogued | Verify voltage/ripple and current stock at quote |
| 4 | C101,C111,C121,C131 | 100 nF 50 V | 0805 | TBD | Unresolved | Select exact 50 V X7R/C0G JLC part and re-check DC-bias capacitance |
| 2 | C10,C11 | 1 µF 50 V | 1206 | TBD | Unresolved | Select exact 50 V X7R JLC part |
| 1 | C12 | 2.2 µF 50 V | 1206 | TBD | Unresolved | “Film/C0G” is not credible in this footprint/value; select rated MLCC using bias curves or enlarge footprint |
| 4 | D2-D5 | BAV99,215 | SOT-23 | C2500 | Basic, in stock | Stocked, but do not use as the sole SiPM-input protection until capacitance/clamp-current review |
| 1 | D10 | SS510B | SMB | C7420368 | Extended, in stock | Keep if boost loss/layout are acceptable |
| 1 | L1 | SWPA4030S100MT, 10 µH | 4×4 mm | C38117 | Extended, in stock | Correct footprint to chosen part; 1.5 A rated, 2.4 A saturation, not “2 A” generically |
| 1 | L2 | 100 µH | 0805 | C68035 | Catalogued | Verify current, DCR, tolerance, and live stock; value alone is insufficient |
| 4 | J2-J5 | BWU.FL-IPEX1 coax | SMD | C5137195 | Extended, in stock | Stocked; **do not place SiPM HV on the exposed coax shell** in next generation |
| 3 | J1,J9,J10 | 1×2 2.54 mm vertical header | THT | TBD | Unresolved | Choose exact stocked MPN/LCSC or replace with SMT wire connector |
| 1 | J6 | 1×6 2.54 mm vertical header | THT | TBD | Unresolved | Placeholder; direct GNSS integration preferred |
| 2 | J7,J8 | 1×10 2.54 mm vertical header | THT | TBD | Unresolved | Remove; next baseline directly mounts nRF9151-LACA |
| 4 | U101,U111,U121,U131 | OPA858IDSGR | WSON-8-EP 2×2 | **C970232** | Extended, assembly-supported | Correct bogus C601618 note; circuit still electrically invalid at present 3.3 V/VBOT bias |
| 4 | U102,U112,U122,U132 | TLV3601IDBVR | SOT-23-5 | TBD | Public stock not confirmed | Pre-order/global-source or qualify a stocked comparator; verify output logic and overdrive behavior |
| 1 | U10 | TPS61170DRVR | WSON-6 2×2 | **C15163** | Extended, in stock | Correct bogus C77205 note (C77205 is an unrelated RF receiver) |
| 1 | U11 | AMS1117-3.3 | SOT-223 | C6186 | Basic, in stock | Manufacturable but poor choice for USB/Peltier system; replace with synchronous buck |
| 1 | U12 | XC6206P122MR-G | SOT-23 | C424699 | Extended, in stock | Stocked; only 60 mA rated, so verify FPGA-core peak load or replace |
| 1 | U4 | DAC7578IPWR | TSSOP-16 | TBD | Public stock not confirmed | Do not freeze; next generation needs more DAC channels and explicit reference/buffering |
| 1 | U5 | BME280 | LGA-8 | C92489 | Extended, in stock | Keep if lifecycle/cost acceptable; protect environmental opening |
| 1 | U6 | W25Q128JVSIQ | SOIC-8 208 mil | C97521 | Basic, assembly-supported | Keep; verify exact wide-SOIC courtyard and boot compatibility |
| 1 | U3 | ICE40UP5K-SG48I | QFN-48-EP 7×7 | C2678152 | Extended, in stock | Correct part is `SG48I`, not `SG48ITR`; VCCPLL must be 1.2 V, not current 3.3 V |
| 1 | X1 | 25 MHz 3.3 V oscillator/TCXO | 2520 4-pin | TBD | Unresolved | Select exact stocked part; define stability, phase noise, startup, enable polarity, and footprint |

Mounting holes H1-H4 are mechanical features and are excluded from assembly BOM quantity.

## Stocked parts required by the next-generation baseline

These are catalog feasibility findings, not yet a complete design BOM:

| Function | Candidate | JLCPCB status | Constraint |
|---|---|---|---|
| Cellular/GNSS MCU module | nRF9151-LACA-R7, C22397843 | Extended, assembly-supported | Standard PCBA only; X-ray required; stock must be rechecked/reserved |
| SiPM TIA | OPA858IDSGR, C970232 | Extended, assembly-supported | Requires a corrected analog supply/bias architecture |
| HV boost controller | TPS61170DRVR, C15163 | Extended, in stock | 38 V output limit leaves little fault margin; validate MicroFC-30035 bias range and transients |
| FPGA | ICE40UP5K-SG48I, C2678152 | Extended, in stock | Add correct 1.2 V core/PLL rail, configuration and decoupling |
| 1.2 V LDO | XC6206P122MR-G, C424699 | Extended, in stock | Marginal 60 mA ceiling; likely replace with a higher-current stocked rail part |
| Boost inductor | SWPA4030S100MT, C38117 | Extended, in stock | Footprint and current claims must match this exact MPN |

No final JLC-stocked choices have yet been selected for USB-C receptacle/ESD/PD controller, 5 V and 3.3 V converters, SIM holder/eSIM option, LTE/GNSS RF networks and antennas, four bidirectional Peltier drivers, current sensing, four NTC interfaces, MPPC connectors, extra DACs, dual comparators, programming/debug connectors, or protection. A “complete next-generation BOM” cannot honestly be issued until those circuits are designed.

## Release gates for a completely JLCPCB-manufacturable board

1. Redesign the unsafe/incomplete schematic; do not patch the Rev A BOM in isolation.
2. Give every fitted reference one exact manufacturer part number and one exact JLCPCB/LCSC number. Do not use value-only matching.
3. Use **Standard PCBA**, because nRF9151-LACA requires it and X-ray inspection.
4. Prefer one-sided SMT. Any THT connector must have a confirmed JLCPCB wave/hand-solder assembly option and exact catalog part.
5. Generate Gerbers, drill files, BOM and CPL from the same tagged KiCad commit. Confirm rotations and pin 1 for every QFN/LGA/WSON/diode/connector.
6. Pass KiCad ERC and DRC with zero unexplained violations, routed copper, filled zones, impedance/stack-up definition, and a reviewed return-current path.
7. Upload BOM/CPL to JLCPCB’s quotation tool for the intended quantity. Resolve every automatic match manually and reserve low-stock extended parts.
8. Order an electrically limited prototype run, inspect X-ray images, and perform power-rail/current-limited bring-up before connecting SiPMs or Peltiers.

## Catalog evidence

Official JLCPCB pages used include the current entries for C6186, C970232, C15163, C38117, C424699, C7420368, C5137195, C2678152, C52923, and C22397843. JLCPCB states that only matched BOM parts are populated, extended parts can incur feeder loading charges, and real-time availability must be confirmed during BOM upload. Public stock is not reserved until parts are pre-ordered into the customer library.
