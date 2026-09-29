# Muon3 station board (Rev B): board-as-code, straight to Gerbers

One **84 × 50 mm, 4-layer, USB-powered** board for the GSU gLOWCOST / Muon3 telescope, assembled by JLC on one
side. It reads four decommissioned sPHENIX inner-HCal tiles (Hamamatsu S12572-33-015P) over SMA coax. There is no
battery, no FPGA and no LoRa.

Everything is TypeScript: circuit, placement, routing, copper, Gerbers, drill, BOM/CPL. KiCad is used only as an
**independent checker** (DRC) and for 3D renders; the fabrication files are written by `src/gerber.ts`.

![3D render](docs/render_3d.png)

*The renders in `docs/` (render_3d, render_top, routed, sim_afe) date from commit 267a13f, which is before the
MC34063 bias change. `sim_hv.png` is current. Rebuild to refresh them.*

```bash
cd hw
bun run build        # netlist → place → route → smooth → planes → silk → Gerbers/drill/BOM/CPL (~10 s)
bun run drc          # kicad-cli DRC on the exported board (oracle); expect 0 errors, 0 unconnected
bun run cost         # BOM + JLC fees + freight/duty scenarios (Berlin, GSU/US)
bun run parts        # (re)fetch footprints, pin names, datasheets, STEP/OBJ for every LCSC part
bun run index        # regenerate parts/INDEX.md
```

Outputs land in `out/` (git-ignored):
- `muon3-gerbers.zip` (upload to JLC), `bom.csv`, `cpl.csv`
- `routed.svg` and per-layer SVGs
- `kicad/muon3.kicad_pcb` (+ `.kicad_pro/.kicad_dru`) for DRC and 3D

`out/` is not cleaned between builds. Delete it before a fresh build so leftover 6-layer files from older builds
(`gerber/muon3-In3_Cu.g4`, `In4_Cu.g5`, `layer6.svg`, `zoom_fpga.png`) don't confuse anyone. The zip only contains
the current layers.

## Board

- **Outline:** 84 × 50 mm, 3 mm corner radius, 4 × M3 holes 3.5 mm from the corners (`src/floorplan.ts`).
- **Edges:**
  - 4 edge-launch SMAs on the top edge (x = 13/31/51/69 mm)
  - USB-C and the STEMMA QT connector on the left edge
  - ESP32-S3 on the right, antenna flush with the right edge over a copper keep-out
- **Layout:** four identical analog channels sit directly behind their jacks, with the DACs and BME280 between
  them. The HV bias is centre-left.
- **Stack-up:** JLC 4-layer 1.6 mm (`src/board.ts`, `src/kicad_stackup.txt`).
  - L1: signal + parts
  - L2: solid GND
  - L3: signal/power
  - L4: signal
- **Rules:** 0.127/0.127 mm signal track/clearance, 0.3 mm power, 0.5 mm HV clearance, 0.3/0.5 mm vias.
- **Assembly:** all parts on the top. The SMA jacks' bottom tabs are left **unpasted** (`noPasteBottom`), so JLC
  assembles one side only; the top tabs and the centre pin are soldered. `B_Paste` is empty.

## What's on the board, and what was deleted

| Kept | Why |
|---|---|
| 4× edge-launch SMA (BWSMA-KE-P001, as on 2v2), **shell = SiPM cathode = bias (HVJ_n)**, centre = anode | 2v2 heritage. A 47 kΩ resistor from HV limits a short to ≤ 1.7 mA; 100 nF at each jack AC-grounds the shell so it shields the signal. **[OPEN] needs safety sign-off**: exposed shells carry bias, and that 100 nF sits on the shell side of the 47 kΩ. |
| 4 channels: OPA356 TIA (Rf 33k / Cf 2.7p) → LMV7219 → 33 Ω → HIT_n, one per jack | [SIM] `sim/afe_s12572_tia.cir`: 9.5 mV/p.e.; 5 p.e. = 35 mV; mean muon (58 p.e.) ≈ 380 mV; noise ≈ 1.4 mV rms |
| **Bias: MC34063 boost** (Ipk 0.3 A via 1 Ω, CT 1 nF ≈ 33 kHz, discontinuous) + BSS123 (1 kΩ gate pull-down) + 150 µH + LL4148, 1 mH/1 µF LC post-filter | Same power stage as 2v2; the MC34063 costs ≈ $0.15 vs $6.09 for the MAX1932 (qty 100). [SIM] `sim/hv_mc34063.cir` |
| Bias set by **ESP32 PWM** (HV_PWM, IO12) → 2-pole RC (10k/1µ ×2, fc ≈ 16 Hz) → 47 kΩ into the 1.02 MΩ / 22 kΩ feedback node; **boot-safe** 100 kΩ pull-up on HV_TRIM keeps the bias low until firmware drives the PWM; HV_MON divider (2 MΩ / 75 kΩ, 80 V → 2.9 V) on IO6 closes the loop in firmware | S12572 needs 59–79 V. The design comment says ≈ 15 V (TRIM 3.3 V) … 85 V (TRIM 0 V), about 17 mV steps with 12-bit PWM. See the HV note below. |
| Per-channel bias trim = TIA reference VREF_n from MCP4728 #1 (I2C0); thresholds VTH_n from MCP4728 #2 (I2C1) | 2v2's anode-offset idea, zero extra HV parts |
| ESP32-S3-WROOM-1-N8 (PCB antenna, −40…85 °C): HIT0–3 on IO1/2/4/5 (GPIO matrix), **MCPWM capture at 12.5 ns on both edges** (time stamp + time-over-threshold) and **PCNT** singles counters; coincidences in firmware | Replaces the iCE40. Wi-Fi/BLE; native USB (IO19/20) for data and USB-CDC debug; BOOT button + status LED |
| USB-C, **5 V only** (5.1 kΩ Rd on CC1/CC2), USBLC6 ESD → AMS1117-3.3 (digital, SOT-223) + TLV75733 (analog 3V3A) | No battery: a USB power bank is the UPS |
| BME280 (0x76) for SiPM/ambient temperature, pressure and humidity; SC7A20H tilt (0x19); STEMMA QT (JST-SH 4) on I2C0 | The tiles have no sensor (sPHENIX put thermistors on the tower electronics); I2C expansion for future sensors |

Deleted (relative to the 2026-09-29 max-scope freeze, commit `594b36c`, and the first Rev B draft):
- iCE40UP5K FPGA
- 18650 cells + BQ25890 charger
- LoRa
- MAX1932
- head boards + LVDS + custom harness
- TEC drivers + interlocks
- nRF9151 LTE + SIM, GNSS
- USB-PD / 4S charger / balancer
- Ethernet, OLED, microSD
- DAC80508, ADS7128 ×3
- the second comparator per channel
- TCXO, FPGA flash, I/O expanders, per-tile NTC/LED lines

**HV note [CHECK before ordering].** The 15–85 V figures in `src/design.ts` assume HV_TRIM is driven by an ideal
source, and the ngspice deck does the same (`Vt vt 0 {VTRIM}`). On the real network, the 20 kΩ RC filter and the
100 kΩ pull-up load the TRIM node. A hand calculation gives roughly:

| ESP pin (HV_PWM) | TRIM | HV |
|---|---|---|
| High | ≈ 2.76 V | ≈ 26 V |
| Low | ≈ 0.73 V | ≈ 70 V |
| Floating | ≈ 1.9 V | ≈ 45 V |

The floating-pin case is still below breakdown. Also, the TRIM filter capacitors start at 0 V, so at power-up the
loop briefly aims high before they charge. Re-simulate with the real TRIM network, and confirm that the range
reaches the tiles' operating voltage (up to 79 V), before ordering.

## Pipeline

| Step | File | Notes |
|---|---|---|
| Parts | `tools/fetch_parts.ts` | LCSC/EasyEDA API → pads (mm, rotation-aware bbox), pin names, holes/slots, 3D body; datasheet (validated `%PDF`, falls back to LCSC's direct link), STEP + OBJ |
| Passives | `src/passives.ts` | value + package → **nearest JLC basic part** (±5 % R / ±25 % C) unless `=value`; basic parts carry no loading fee |
| Circuit | `src/design.ts` | netlist by pin *name*; each value tagged [DS]/[2v2]/[SIM] |
| Placement | `src/floorplan.ts`, `src/place.ts` | edge parts fixed; groups anchored; force-directed + 90° rotation choice + spiral legalisation |
| Pin swap | `src/pinswap.ts` | GPIO-matrix nets (e.g. ESP32 HIT_n) assigned to the nearest free pin |
| Routing | `src/router.ts`, `src/autoroute.ts` | 0.1 mm grid, half-clearance occupancy (+0.04 mm quantisation margin), 3 routed layers (L1/L3/L4), octilinear A* with via moves, windowed then full-board search, soft rip-up with PathFinder history cost; GND = via fan-out into the L2 plane (via-in-pad only when the whole via fits); hole-to-hole mask; no top copper under module bodies |
| Copper | `src/copper.ts` | per net: pull taut (farthest legal straight shot), fillet every corner with the largest legal tangent arc (≤ 8 mm), pin T-junctions/vias, straight pad entries; grid re-marked so later nets see the smoothed copper |
| Planes | `src/planes.ts` | L2 solid GND, 0.3 mm edge pull-back, antipads, antenna cut-out |
| Silk | `src/silk.ts`, `src/labels.ts` | LCSC footprint outlines + pin-1 marks, built-in stroke font, polarity/labels |
| Gerber | `src/gerber.ts` | RS-274X X2, flashed pads (macro for rotated rects), **native arcs (G02/G03)**, regions + LPC antipads, Excellon with G85 slots |
| Checks | `src/drc.ts`, `src/kicad.ts` | JS exact-geometry clearance + connectivity; `.kicad_pcb` export for kicad-cli DRC and STEP/PNG renders |
| JLC | `src/jlc.ts`, `tools/cost.ts` | BOM/CPL (Gerber frame, origin bottom-left); cost incl. extended-part loading fees; 4-layer and one-sided pricing chosen from the board |

## Status (2026-09-29)

- Last build (23:35 CEST): **fully routed**. kicad-cli DRC shows 0 errors and 0 unconnected; the 117 warnings are
  all `lib_footprint_issues` ("footprint library 'muon3' not configured"). 117 placements, 43 BOM lines.
  Parts list: [`parts/INDEX.md`](parts/INDEX.md).
- Cost: **not yet re-run for Rev B** (`bun run cost`). The earlier ≈ $91/board and ≈ $971 landed figures were for
  the 100 × 150 mm 6-layer, two-sided battery board.
- 3D: KiCad library models replace EasyEDA models that don't render correctly (edge SMA); see `src/kicad.ts`.
- Not yet: firmware (ESP-IDF), a JLC quote with real prices, and regenerated renders.

## Open items before ordering

1. **Safety sign-off for the bias voltage on the exposed SMA shells** (47 kΩ-limited DC; 100 nF at each jack on
   the shell side).
2. HV trim range and power-up behaviour with the real TRIM network (HV note above).
3. Real JLC quote for the 84 × 50 mm 4-layer, one-sided board. Confirm that the unpasted SMA bottom tabs give
   enough mechanical retention (hand-solder them if needed).
4. GSU procurement: tariff treatment of the 3 US boards (importer of record: GSU).
5. Firmware, and a one-channel bench test on a real HCal tile.
