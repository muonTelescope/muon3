# Muon3 board-as-code (tscircuit)

Repo-root **[tscircuit](https://tscircuit.com/)** project: the Muon3 four-channel
cosmic-ray telescope controller authored as code and built to JLCPCB
fabrication outputs. This is the electrical **source of truth** for the board;
`pcb/` (KiCad) and `pcb/tscircuit/` (the older placement/KiCad bridge) are being
superseded by this project.

- Board target: **160 × 120 mm, 4-layer, JLCPCB Standard PCBA**.
- Detector path: decommissioned sPHENIX HCal tiles → Hamamatsu S12572-33-015P
  SiPM, LT3482 ~70 V bias (see [../pcb/SCHEMATIC_FREEZE_CHECK.md](../pcb/SCHEMATIC_FREEZE_CHECK.md)).
- Toolchain: **bun** (no node/npm needed). TypeScript pinned to the 5.x line
  (TS 7 / tsgo breaks tsci's rollup plugin).

## Quick start

```bash
# needs bun: curl -fsSL https://bun.sh/install | bash
bun install          # from the repo root
bun run build        # eval + DRC → dist/board/index/circuit.json
bun run fab          # full fabrication build → fab/
```

`bun run fab` writes to `fab/`:

| File | What |
| --- | --- |
| `muon3-gerbers.zip` | Gerbers + drill + JLCPCB `bom.csv` + `pick_and_place.csv` (upload this to JLCPCB) |
| `pcb.svg` | PCB render |
| `schematic.svg` | Schematic render |
| `muon3-board.kicad_pcb` | KiCad export for cross-check / manual RF-AFE-HV routing |
| `bom.csv`, `pnp.csv` | Flattened JLCPCB BOM + CPL for quick review |

The gerbers, SVGs, KiCad export, and CSVs in `fab/` are committed as the
tangible "built" artifact; `dist/`, `node_modules/`, and the unzipped gerber
dir are regenerated (git-ignored).

## Layout

```
board/
  index.tsx     top-level <board> composing the subsystems
  power.tsx     USB-C PD input + rails            (in progress)
  ...           digital, afe, hv, thermal, connectors (added incrementally)
tools/
  fab.ts        one-command fabrication build (bun run fab)
  make_bom_pnp.ts  circuit-json → JLCPCB BOM + CPL CSVs
```

## Parts policy

- Every fitted component carries a real **LCSC/JLCPCB part number**
  (`supplierPartNumbers={{ jlcpcb: ["C…"] }}`) so the BOM/CPL are orderable.
- The tscircuit **parts engine** fetches the authoritative JLCPCB footprint at
  build time; a generic `footprint="0402"` that differs slightly logs a
  non-fatal copper-IoU warning (tighten by matching the exact JLC land later).
- `routingDisabled` on the board for now — placement/nets are authored first;
  RF/AFE/HV routing follows [../pcb/DESIGN_RULES.md](../pcb/DESIGN_RULES.md)
  (autorouter draft only; sensitive nets hand-routed).

## Build status

Incremental. The board must stay **DRC-clean and fab-buildable at every
commit**. Subsystem progress:

| Subsystem | Status |
| --- | --- |
| Fabrication pipeline (build → gerbers/BOM/CPL) | ✅ working |
| Power input (USB-C PD, rails) | 🚧 seed (VBUS/GND/CC nets + passives) |
| Digital core (nRF9151 + iCE40 + RP2040 + flash) | ⏳ |
| AFE ×4 (OPA858 + dual TLV3601) | ⏳ |
| HV bias (LT3482 ~70 V) | ⏳ |
| TEC drivers (DRV8873 ×4) + fans | ⏳ |
| Connectors / sensors (U.FL, SIM, panels, BME280) | ⏳ |
