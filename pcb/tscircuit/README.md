# Muon3 tscircuit placement, autorouter & KiCad bridge

Part of the **Muon3** project (`muon3.kicad_pcb`, hierarchical sheets under `pcb/`).

Uses **[tscircuit](https://docs.tscircuit.com)** (`@tscircuit/core`) plus the
**capacity autorouter** and **circuit-json ↔ KiCad** converters so placement
and draft routing can land in KiCad without retyping coordinates by hand.

## Quick start

```bash
# needs bun: curl -fsSL https://bun.sh/install | bash
cd pcb/tscircuit
bun install

bun run render          # placement SVG + circuit-json + shielding MD
bun run export:kicad    # → out/kicad/muon3_tscircuit_placement.kicad_pro
bun run sync:zones      # stamp zones into ../muon3.kicad_pcb
bun run autoroute       # capacity-autorouter demo → KiCad
# or all of render + export + sync:
bun run bridge
```

**Full bridge guide:** [KICAD_BRIDGE.md](./KICAD_BRIDGE.md)

## Scripts

| Script | What it does |
|--------|----------------|
| `bun run render` | Placement board → SVG, circuit-json, `MUON3_PLACEMENT_SHIELDING.md` |
| `bun run export:kicad` | Placement → KiCad project + `placement_positions.csv` |
| `bun run sync:zones` | Write Edge.Cuts + zone fences into production `muon3.kicad_pcb` |
| `bun run autoroute` | Demo nets through capacity autorouter → SVG + KiCad |
| `bun run import:kicad` | Production PCB → circuit-json snapshot |
| `bun run bridge` | `render` + `export:kicad` + `sync:zones` |

## Files (Muon3 naming)

| File | Description |
|------|-------------|
| `muon3_placement.tsx` | Board, zones, chips, keepouts |
| `autoroute_demo.tsx` | Small netted board for autorouter exercise |
| `coords.ts` | tscircuit ↔ KiCad coordinate transform |
| `render_placement.ts` | Export circuit-json + SVG + shielding MD |
| `export_to_kicad.ts` | circuit-json → KiCad via `circuit-json-to-kicad` |
| `sync_zones_to_kicad.ts` | Zone fences → production `muon3.kicad_pcb` |
| `run_autoroute.ts` | Capacity autorouter + KiCad export |
| `import_kicad_snapshot.ts` | KiCad → circuit-json |
| `KICAD_BRIDGE.md` | End-to-end workflow |
| `out/kicad/*.kicad_*` | Generated KiCad projects |
| `out/placement_positions.csv` | Component XY for KiCad placement |
| `figures/tscircuit/muon3_placement_pcb.svg` | Shared figure asset |

## Zone map

```
 ← RF │ DIGITAL │ AFE CH0–3 │ HV │
      │ iCE40   │ OPA858    │LT3482│
      │ RP2040  │ panels ↑  │ 70V  │
 ──── POWER / USB-PD ── TEC DRV×4 ─── →
```

See `MUON3_PLACEMENT_SHIELDING.md` and `../DESIGN_RULES.md`.

## Using results in KiCad

### Placement (now)

1. `bun run bridge`
2. Open `pcb/muon3.kicad_pro` — zones/keepouts match tscircuit.
3. For IC anchors, open `out/kicad/muon3_tscircuit_placement.kicad_pro` or
   place from `out/placement_positions.csv` (`kicad_x_mm`, `kicad_y_mm`).

### Autorouter (demo now; full board later)

1. `bun run autoroute`
2. Open `out/kicad/muon3_autoroute_demo.kicad_pro` in KiCad.
3. Inspect traces; treat as a draft. Production RF/AFE/HV still need hand
   routing per `DESIGN_RULES.md`.

### Reverse

```bash
bun run import:kicad -- ../muon3.kicad_pcb
```

## Preview

![Muon3 placement PCB](../../figures/tscircuit/muon3_placement_pcb.svg)

## Packages

- `@tscircuit/core` — placement geometry
- `@tscircuit/capacity-autorouter` — PCB autorouter
- `circuit-json-to-kicad` — export to KiCad
- `kicad-to-circuit-json` — import from KiCad
