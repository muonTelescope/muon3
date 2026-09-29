# Muon3 station board (Rev B) — board-as-code, straight to Gerbers

One 6-layer, fully JLC-assembled board for the GSU gLOWCOST / Muon3 telescope, reading four decommissioned
sPHENIX inner-HCal tiles (Hamamatsu S12572-33-015P) over SMA coax. Everything — circuit, placement, routing,
copper, Gerbers, drill, BOM/CPL — is TypeScript. KiCad is used only as an **independent checker** (DRC) and
for 3D renders; the fabrication files are written by `src/gerber.ts`.

![3D render](docs/render_3d.png)

```bash
cd hw
bun run build        # netlist → place → route → smooth → planes → silk → Gerbers/drill/BOM/CPL (~10 s)
bun run drc          # kicad-cli DRC on the exported board (oracle); expect 0 violations, 0 unconnected
bun run cost         # BOM + JLC fees + freight/duty scenarios (Berlin, GSU/US)
bun run parts        # (re)fetch footprints, pin names, datasheets, STEP/OBJ for every LCSC part
bun run index        # regenerate parts/INDEX.md
```

Outputs land in `out/` (git-ignored): `muon3-gerbers.zip` (upload to JLC), `bom.csv`, `cpl.csv`, `routed.svg`,
per-layer SVGs, `kicad/muon3.kicad_pcb` (+ `.kicad_pro/.kicad_dru`) for DRC and 3D.

## What's on the board, and what was deleted

| Kept | Why |
|---|---|
| 4× edge-launch SMA (BWSMA-KE-P001, as 2v2), **shell = SiPM cathode = bias**, centre = anode | user choice; the 100 nF at each jack AC-grounds the shell so it shields the signal; 47 kΩ limits a short to ≤ 1.7 mA |
| 4 channels: OPA356 TIA (Rf 33k / Cf 2.7p) → LMV7219, one per jack | [SIM] `sim/afe_s12572_tia.cir`: 9.5 mV/p.e., 5 p.e. = 35 mV, mean muon (58 p.e.) ≈ 380 mV; noise ≈ 1.4 mV rms; ringing stays > 20 mV from threshold |
| MAX1932 bias, 54–104 V, exact 2v2 topology (150 µH, BSS123, LL4148, 806 Ω CL, 1 mH/1 µF post-filter) | tested on gLOWCOST 2v2; S12572 needs 59–79 V |
| Per-channel bias trim = TIA reference VREF_n (1–3 V) from an MCP4728 | 2v2's anode-offset idea, zero extra HV parts |
| BME280 = SiPM/ambient temperature + pressure + humidity | user choice; tiles have no sensor (sPHENIX put thermistors on the tower electronics) |
| iCE40UP5K, configured by the ESP32 (no flash), clocked by ESP32 LEDC 40 MHz (no TCXO) | user kept the FPGA for ns capture / ToT |
| ESP32-S3-WROOM-1-N8 (PCB antenna, −40…85 °C) | Wi-Fi/BLE/USB; antenna overhangs the right edge, copper-free |
| 4× 18650 holders, **1S4P**, BQ25890 NVDC charger (ADC = battery gauge), 5 V USB-C only | user choice; per-cell PTC + red LED lights if a cell is reversed |
| SC7A20H tilt, STEMMA QT (JST-SH 4) on I2C0 | expansion for future I2C sensors |

Deleted: LoRa, head boards + LVDS + custom harness, TEC drivers + interlocks, nRF9151 LTE + SIM, GNSS,
USB-PD/4S charger/balancer, Ethernet, OLED, microSD, DAC80508, ADS7128 ×3, second comparator per channel,
TCXO, FPGA flash, I/O expanders, per-tile NTC/LED lines.

## Pipeline

| Step | File | Notes |
|---|---|---|
| Parts | `tools/fetch_parts.ts` | LCSC/EasyEDA API → pads (mm, rotation-aware bbox), pin names, holes/slots, 3D body; datasheet (validated `%PDF`, falls back to LCSC's direct link), STEP + OBJ |
| Passives | `src/passives.ts` | value + package → **nearest JLC basic part** (±5 % R / ±25 % C) unless `=value`; basic parts carry no loading fee |
| Circuit | `src/design.ts` | netlist by pin *name*; each value tagged [DS]/[2v2]/[SIM] |
| Placement | `src/floorplan.ts`, `src/place.ts` | edge parts fixed; groups anchored; force-directed + 90° rotation choice + spiral legalisation |
| FPGA pins | `src/pinswap.ts` | generic iCE40 I/O nets assigned to the nearest free pin (RGB open-drain pins excluded) |
| Routing | `src/router.ts`, `src/autoroute.ts` | 0.1 mm grid, half-clearance occupancy (+0.04 mm quantisation margin), 4 signal layers, octilinear A* with via moves, windowed then full-board search, soft rip-up with PathFinder history cost; GND = via fan-out into L2/L5 (via-in-pad only when the whole via fits); hole-to-hole mask; no top copper under module bodies |
| Copper | `src/copper.ts` | per net: pull taut (farthest legal straight shot), fillet every corner with the largest legal tangent arc (≤ 8 mm), pin T-junctions/vias, straight pad entries; grid re-marked so later nets see the smoothed copper |
| Planes | `src/planes.ts` | L2/L5 solid GND, 0.3 mm edge pull-back, antipads, antenna cut-out |
| Silk | `src/silk.ts`, `src/labels.ts` | LCSC footprint outlines + pin-1 marks, built-in stroke font, polarity/labels |
| Gerber | `src/gerber.ts` | RS-274X X2, flashed pads (macro for rotated rects), **native arcs (G02/G03)**, regions + LPC antipads, Excellon with G85 slots |
| Checks | `src/drc.ts`, `src/kicad.ts` | JS exact-geometry clearance + connectivity; `.kicad_pcb` export for kicad-cli DRC and STEP/PNG renders |
| JLC | `src/jlc.ts`, `tools/cost.ts` | BOM/CPL (Gerber frame, origin bottom-left); cost incl. extended-part loading fees |

Stack-up: JLC 6-layer 1.6 mm — L1 signal+parts, L2 GND, L3 signal, L4 signal, L5 GND, L6 signal.

## Status (2026-09-29)

- **Fully routed; kicad-cli DRC 0 violations / 0 unconnected**; the JS checker agrees. 159 placements, 53 LCSC lines (25 extended).
- Cost (5 boards, estimate): parts ≈ $237, PCB ≈ $120 [EST], PCBA ≈ $99 (two sides: the SMA ground tabs) → ≈ $91/board ex-works;
  two JLC orders (2 → Berlin, 3 → GSU) ≈ $971 landed. The US figure assumes a 45 % tariff with GSU as importer of record;
  if GSU qualifies for duty-free scientific-instrument entry (HTS 9810.00.60) the US order is ≈ $391.
- 3D: KiCad library models replace two EasyEDA models that don't render correctly (iCE40 QFN-48, edge SMA) — `src/kicad.ts`.
- Not yet: firmware (ESP-IDF + iCE40 gateware), JLC quote with real prices.

## Open items before ordering

1. Real JLC quote for 6-layer 100 × 150 mm (the PCB line in `tools/cost.ts` is an estimate), epoxy-filled via-in-pad on the
   QFN/module exposed pads, and second-side assembly for the edge SMA ground tabs.
2. GSU procurement: tariff treatment of the 3 US boards (importer of record: GSU).
3. Firmware + gateware, and a one-channel bench test on a real HCal tile.
