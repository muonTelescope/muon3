# Muon3: tscircuit placement & autorouter ↔ KiCad

This document is the **bridge** between the Muon3 tscircuit placement tools
and the production KiCad project (`pcb/muon3.kicad_pro`).

## Why two tools

| Tool | Role in Muon3 |
|------|----------------|
| **tscircuit** | Encode zone map, keepouts, IC anchors; run **capacity autorouter**; emit circuit-json + SVG |
| **KiCad 9+** | Hierarchical production schematics, full netlist, DRC, fab output, JLCPCB BOM/CPL |

tscircuit is the placement / autoroute **lab**. KiCad is the **source of truth**
for fabrication once sheets are complete.

## Quick commands

```bash
# needs bun: curl -fsSL https://bun.sh/install | bash
cd pcb/tscircuit
bun install

# 1) Placement sketch → SVG + circuit-json + MUON3_PLACEMENT_SHIELDING.md
bun run render

# 2) Placement → standalone KiCad project + positions table
bun run export:kicad
# → out/kicad/muon3_tscircuit_placement.kicad_pro
# → out/placement_positions.csv

# 3) Stamp zones/keepouts/Edge.Cuts into production muon3.kicad_pcb
bun run sync:zones

# 4) Capacity autorouter demo (real nets) → SVG + KiCad
bun run autoroute
# → out/kicad/muon3_autoroute_demo.kicad_pro

# 5) Optional: KiCad → circuit-json snapshot
bun run import:kicad -- ../muon3.kicad_pcb

# All of 1–3:
bun run bridge
```

## Workflow A — Placement guide in KiCad (recommended now)

Production sheets are still P0 architecture (sparse netlist). Use tscircuit as
the placement planner:

```
muon3_placement.tsx
        │
        ▼  bun run render
 circuit-json + SVG figures
        │
        ├─► bun run export:kicad  ──►  out/kicad/*  (open in KiCad, inspect)
        │
        └─► bun run sync:zones    ──►  ../muon3.kicad_pcb  (zone fences)
```

1. Open `pcb/muon3.kicad_pro` — zone silkscreen / Edge.Cuts match tscircuit
   (after `sync:zones`).
2. Optionally open `pcb/tscircuit/out/kicad/muon3_tscircuit_placement.kicad_pro`
   in a second KiCad window for footprint-level anchors (proxy footprints).
3. When placing real symbols from hierarchical sheets, use
   `out/placement_positions.csv` columns `kicad_x_mm`, `kicad_y_mm`.

### Coordinate systems

| System | Origin | +Y |
|--------|--------|----|
| tscircuit | board center (0,0) | up |
| KiCad (this bridge) | board top-left at **(20, 20) mm** | down |

Transform (implemented in `coords.ts`):

```
kicad_x = 20 + BOARD_W/2 + tsc_x
kicad_y = 20 + BOARD_H/2 - tsc_y
```

Board: **160 × 120 mm** (Edge.Cuts after sync).

## Workflow B — Capacity autorouter → KiCad

tscircuit’s board autorouter (`autorouter="auto"`) drives
[`@tscircuit/capacity-autorouter`](https://github.com/tscircuit/capacity-autorouter)
during `renderUntilSettled()`.

```
autoroute_demo.tsx  (nets + fixed placement)
        │
        ▼  bun run autoroute
 circuit-json with pcb_trace / pcb_via
        │
        ▼  circuit-json-to-kicad
 out/kicad/muon3_autoroute_demo.kicad_pcb  (open in KiCad, edit traces)
```

**Today:** run the demo board (`40×30 mm` AFE-style fragment) to validate the
pipeline and learn the tools.

**Later (full station):** when hierarchical sheets are complete:

1. Export a netlist-bearing design into tscircuit (either rebuild critical
   nets in TSX, or `bun run import:kicad` + hand-stitch nets).
2. Fix component placement from Workflow A.
3. Enable autorouter (do **not** set `pcbRoutingDisabled = true`).
4. `export:kicad` and **merge** traces carefully into production PCB, or treat
   the export as a routing reference while finishing in KiCad / FreeRouting.

### Direct library use

```ts
import { AutoroutingPipelineSolver } from "@tscircuit/capacity-autorouter"

const solver = new AutoroutingPipelineSolver(simpleRouteJson)
while (!solver.solved && !solver.failed) solver.step()
const routed = solver.getOutputSimpleRouteJson()
```

`run_autoroute.ts` probes this API when the circuit exposes SimpleRouteJson.

## Workflow C — Import KiCad into tscircuit

```bash
bun run import:kicad -- ../muon3.kicad_pcb
# → out/imported_from_kicad.circuit.json
```

Uses [`kicad-to-circuit-json`](https://github.com/tscircuit/kicad-to-circuit-json).
Useful for geometry checks; full autoroute still needs nets + pin mapping.

## What not to do

- Do **not** replace `afe.kicad_sch` / other hierarchical sheets with the
  tscircuit placement schematic export.
- Do **not** fab from `muon3_tscircuit_placement` or the autoroute demo — they
  use proxy footprints (qfn64 for LGA113, etc.).
- Do **not** autoroute the full RF/AFE/HV board blindly — capacity autorouter
  is a draft tool; AFE, RF, and HV need manual review (`DESIGN_RULES.md`).

## Packages

| Package | Purpose |
|---------|---------|
| `@tscircuit/core` | Board, chips, keepouts, render |
| `@tscircuit/capacity-autorouter` | PCB autorouter pipeline |
| `circuit-json-to-kicad` | circuit-json → `.kicad_pcb` / `.kicad_sch` / `.kicad_pro` |
| `kicad-to-circuit-json` | KiCad → circuit-json |
| `circuit-to-svg` | PCB preview SVGs |

Online converters also exist (e.g. circuit-json → KiCad web tools) if you prefer
not to run the local CLI.

## Related docs

- `README.md` — tscircuit folder overview
- `MUON3_PLACEMENT_SHIELDING.md` — zone map & shielding
- `../DESIGN_RULES.md` — electrical/layout rules
- `../README.md` — PCB project status
