# SiPM Muon Telescope — KiCad Project (KiCad 10)

Generated 2026-06-11. Four hierarchical sheets implementing the simulated TIA front-end design
(see the accompanying simulation report): 4× SiPM → OPA858 TIA → TLV3601 → iCE40UP5K-SG48,
TPS61170 HV boost + π filter + DAC trim + ADC readback, DAC7578 thresholds, BME280, W25Q128
config flash, TCXO, GNSS-module and nRF9151-carrier headers.

## Opening in KiCad 10

Open `muon_telescope_v10/muon_telescope.kicad_pro`. The schematic files are written in the
20250114 s-expression format with generator_version 9.0 — the exact format the KiCad 10.0
release ships its own demo projects in. KiCad 10 opens it natively (the official migration
path); on first save it re-stamps the files to the current 20260306 format. Every s-expression
token used was checked against KiCad 10.0's parser keyword list (eeschema/schematic.keywords,
branch 10.0), and the grammar was pattern-matched against reference files from the 10.0 source
tree.

`muon_telescope_v7/` contains a byte-equivalent-structure twin in KiCad 7 format. It exists
because this project was machine-generated and validated headlessly with kicad-cli 7.0.11:
SVG/PDF plots of all four sheets plus a full netlist export, with the connectivity of every
critical net checked programmatically (TIA feedback loops, all four CMPx→FPGA pins, shared
VBOT, DAC routing, HV trim/readback, PPS, config-flash SPI, nRF SPI, 1V2 core). The v10 set is
generated from the identical structure, so the electrical verification carries over.

## First steps after opening

1. Run ERC. Global-label connectivity is used throughout (machine-generated layout); expect
   only style-level warnings.
2. Annotation is pre-assigned and collision-free; re-annotate only if you restructure.
3. Tidy label positions to taste — symbols are placed on grid but some labels overlap.

## Libraries

- `muon_parts.kicad_sym` — project library, all symbols used. Also embedded in each sheet, so
  the schematics are self-contained.
- `JLCPCB-Kicad-Library/` — bundled subset (symbols + footprints) of
  https://github.com/CDFER/JLCPCB-Kicad-Library (MIT). sym-lib-table and fp-lib-table already
  point at it via ${KIPRJMOD}. Re-clone the upstream repo for 3D models and live stock data.

## Sourcing status (read before ordering)

CDFER basic/preferred parts with LCSC numbers embedded in symbol fields:
all 0402/0603 R and C values, BAV99 (C2500), SS510B 100V Schottky (C7420368), 100µH filter
inductor (C68035), AMS1117-3.3 (C6186), BME280 (C92489), W25Q128JVSIQ (C97521).

Pinout-verified from official KiCad library or TI datasheets, LCSC ID to confirm at order time
(extended parts): OPA858 (WSON-8), TLV3601 (SOT-23-5: 1=OUT 2=VEE 3=IN+ 4=IN− 5=VCC, TI
SNOSDB1E), TPS61170 (VSON-6: 1=FB 2=COMP 3=GND 4=SW 5=CTRL 6=VIN, TI SLVS789D), DAC7578
(TSSOP-16), iCE40UP5K-SG48ITR (QFN-48).

Marked VERIFY in-schematic before ordering: XC6206P122 1.2 V LDO pinout and LCSC number;
TCXO footprint/pinout vs the exact part chosen; the two placeholder LCSC numbers on
0402 1µF / 0603 10µF; DAC7578 I²C address for ADDR0=GND; iCE40 VPP_2V5-from-3V3 against the
current Lattice datasheet; all HV-node capacitors must be ≥50 V (C0G/film on HV_QUIET).

## Design notes carried from simulation

DC-coupled anode readout: SiPM anode sits at the TIA virtual ground (VBOT, 2.40 V), cathode at
HV_QUIET — no input coupling cap, no undershoot. HV ≈ VBOT + Vbr + Vov: ~32.4 V for
MicroFC-30035 as drawn; for Hamamatsu S13360 (~58 V) replace the boost stage, filter unchanged.
Rf=2 kΩ 1%, Cf=2.2 pF C0G → 24.4 mV/p.e., 52 MHz, 3 p.e. threshold = 74 mV below baseline.
Comparator output idles HIGH, pulses LOW (falling edge = event), matching firmware convention.

## Layout-critical items

Rf/Cf at the OPA858 pins, no plane under summing nodes; boost hot loop compact and far from
the four INA nodes; comparator output routing away from analog inputs; star HV_QUIET
distribution after C12; thermal pads (OPA858 pin 9, TPS61170 pin 7, iCE40 pin 49) to GND.

## Regenerating

`python3 gen_sch.py v9` (KiCad-10-ready) or `python3 gen_sch.py v7` (kicad-cli-7-validatable).
gen_symbols.py holds all pin maps with their provenance in comments.

## PCB (muon_telescope.kicad_pcb)

108 x 86 mm, 4-layer: F.Cu signal | In1 solid GND | In2 +3V3 plane | B.Cu GND pour.
Placement complete and DRC-clean (0 clearance / courtyard / hole violations); routing is
intentionally left open — unconnected-net DRC entries are the ratsnest. The board file is
KiCad 7 format; KiCad 10 opens and migrates it like the schematics.

Grounding / noise architecture baked into the file:
- ONE continuous ground domain. No split planes anywhere — return currents cannot be forced
  around a slot, which is the classic ground-loop generator. Partitioning is by placement.
- 31 GND stitching vias on a 9 mm grid keep F.Cu / In1 / B.Cu grounds at the same potential
  at RF, preventing the pour islands from becoming patch antennas.
- Per-channel rule areas (no copper pour, In1+In2+B.Cu) under each TIA summing node:
  keeps parasitic capacitance off the Cf node and leakage paths off the femtocoulomb input.
- Boost quarantine: TPS61170 hot loop bottom-right, >40 mm from the nearest summing node;
  In2 under the entire boost area is GND (priority fill), denying the 3V3 plane any
  capacitive pickup from the switch node directly beneath it.
- U.FL per channel at the board edge: CENTER = anode signal, SHIELD = HV bias. The shield is
  AC-grounded by C1 within ~6 mm of the connector, so it shields normally while DC-carrying
  the bias - one coax per SiPM, minimal loop area. Both shield legs of the BWIPX footprint
  are netted (the upstream CDFER symbol leaves pad 3 floating - fixed here).
- HV netclass (0.5 mm clearance, pattern HV_* + BOOST_SW) is defined in the .kicad_pro.

Routing order suggestion: (1) per-channel input: U.FL center -> R2 -> summing node -> OPA858
pin 3, with Rf/Cf to the FB pin, shortest possible, F.Cu only; (2) TIA -> comparator -> R5;
(3) CMPx to FPGA as spaced single-ended lines over solid In1; (4) HV_QUIET from C12 along the
bottom/left perimeter to the four R1s (DC, filtered - length is free); (5) boost hot loop
L1/U10/D10/C10 tight first, before anything else near it; (6) supplies last via In2 + drops.
Pad-local notes: thermal pads of U10/U101..U131/U3 need via farms to In1.
