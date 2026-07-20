/**
 * Export Muon3 tscircuit placement → KiCad project files.
 *
 *   cd pcb/tscircuit && bun run export:kicad
 *
 * Writes:
 *   out/kicad/muon3_tscircuit_placement.{kicad_pcb,kicad_sch,kicad_pro}
 *   out/placement_positions.json   — machine-readable anchors for manual layout
 *   out/placement_positions.csv    — importable position table
 *
 * Open the generated .kicad_pro in KiCad as a **placement reference** alongside
 * the hierarchical production project (`../muon3.kicad_pro`). Do not replace
 * the production schematic with this export — it is placement geometry only.
 */
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import {
  CircuitJsonToKicadPcbConverter,
  CircuitJsonToKicadSchConverter,
  CircuitJsonToKicadProConverter,
} from "circuit-json-to-kicad"
import {
  buildMuon3PlacementCircuit,
  ZONES,
  BOARD_W,
  BOARD_H,
  TIA_KEEPOUTS,
} from "./muon3_placement.tsx"
import {
  tscToKicad,
  tscRectToKicad,
  boardEdgeCutsKicad,
  KICAD_ORIGIN_X,
  KICAD_ORIGIN_Y,
} from "./coords.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, "out")
const kicadDir = join(outDir, "kicad")
mkdirSync(kicadDir, { recursive: true })

const projectName = "muon3_tscircuit_placement"

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

console.log("Building Muon3 placement circuit...")
const circuit = buildMuon3PlacementCircuit()
circuit.pcbRoutingDisabled = true
await circuit.renderUntilSettled()
const circuitJson = circuit.getCircuitJson()

writeFileSync(
  join(outDir, "muon3_placement.circuit.json"),
  JSON.stringify(circuitJson, null, 2),
)

// --- Component positions from circuit-json ---
const sourceById = new Map(
  (circuitJson as any[])
    .filter((e) => e.type === "source_component")
    .map((e) => [e.source_component_id, e] as const),
)
const chips = circuitJson.filter((e: any) => e.type === "pcb_component")
type PosRow = {
  name: string
  tsc_x_mm: number
  tsc_y_mm: number
  kicad_x_mm: number
  kicad_y_mm: number
  rotation_deg: number
  layer: string
}
const positions: PosRow[] = []
for (const c of chips as any[]) {
  const src = sourceById.get(c.source_component_id)
  const name =
    src?.name ?? c.name ?? c.component_name ?? c.source_component_id ?? "UNK"
  const x = Number(c.center?.x ?? c.x ?? 0)
  const y = Number(c.center?.y ?? c.y ?? 0)
  const rot = Number(c.rotation ?? c.ccw_rotation ?? 0)
  const k = tscToKicad(x, y)
  positions.push({
    name: String(name),
    tsc_x_mm: round3(x),
    tsc_y_mm: round3(y),
    kicad_x_mm: round3(k.x),
    kicad_y_mm: round3(k.y),
    rotation_deg: round3(rot),
    layer: String(c.layer ?? "top"),
  })
}
positions.sort((a, b) => a.name.localeCompare(b.name))

const posPayload = {
  project: "Muon3",
  board_mm: { width: BOARD_W, height: BOARD_H },
  coordinate_systems: {
    tscircuit: "board center (0,0), +X right, +Y up, mm",
    kicad: `board top-left at (${KICAD_ORIGIN_X},${KICAD_ORIGIN_Y}), +X right, +Y down, mm`,
  },
  edge_cuts_kicad: boardEdgeCutsKicad(),
  zones: ZONES.map((z) => ({
    ...z,
    kicad: tscRectToKicad(z.cx, z.cy, z.w, z.h),
  })),
  tia_keepouts: TIA_KEEPOUTS.map((k) => ({
    ...k,
    kicad: tscToKicad(k.x, k.y),
  })),
  components: positions,
  generated: new Date().toISOString(),
}

writeFileSync(join(outDir, "placement_positions.json"), JSON.stringify(posPayload, null, 2))
const csv = [
  "ref,tsc_x_mm,tsc_y_mm,kicad_x_mm,kicad_y_mm,rotation_deg,layer",
  ...positions.map(
    (p) =>
      `${p.name},${p.tsc_x_mm},${p.tsc_y_mm},${p.kicad_x_mm},${p.kicad_y_mm},${p.rotation_deg},${p.layer}`,
  ),
].join("\n")
writeFileSync(join(outDir, "placement_positions.csv"), csv + "\n")
console.log(`Wrote placement_positions.json (${positions.length} components)`)

// --- circuit-json → KiCad ---
console.log("Converting circuit-json → KiCad PCB...")
const pcbConv = new CircuitJsonToKicadPcbConverter(circuitJson as any, {
  projectName,
})
pcbConv.runUntilFinished()
const pcbPath = join(kicadDir, `${projectName}.kicad_pcb`)
writeFileSync(pcbPath, pcbConv.getOutputString())
console.log(`  ${pcbPath}`)

console.log("Converting circuit-json → KiCad schematic...")
const schConv = new CircuitJsonToKicadSchConverter(circuitJson as any)
schConv.runUntilFinished()
const schPath = join(kicadDir, `${projectName}.kicad_sch`)
writeFileSync(schPath, schConv.getOutputString())
console.log(`  ${schPath}`)

console.log("Writing KiCad project...")
const proConv = new CircuitJsonToKicadProConverter(circuitJson as any, {
  projectName,
  schematicFilename: `${projectName}.kicad_sch`,
  pcbFilename: `${projectName}.kicad_pcb`,
  schematicSheetPlan: schConv.schematicSheetPlan,
})
proConv.runUntilFinished()
const proPath = join(kicadDir, `${projectName}.kicad_pro`)
writeFileSync(proPath, proConv.getOutputString())
console.log(`  ${proPath}`)

writeFileSync(
  join(kicadDir, "README.md"),
  `# Muon3 tscircuit → KiCad export

Generated by \`bun run export:kicad\` from \`muon3_placement.tsx\`.

## Files

| File | Use |
|------|-----|
| \`${projectName}.kicad_pro\` | Open in KiCad 9+ as **placement reference** |
| \`${projectName}.kicad_pcb\` | Footprints, keepouts, zone silkscreen from tscircuit |
| \`${projectName}.kicad_sch\` | Minimal schematic (placement anchors only) |
| \`../placement_positions.json\` | Component XY for manual placement in production PCB |
| \`../placement_positions.csv\` | Same table as CSV |

## How to use with production \`muon3.kicad_pro\`

1. Open **this** project to inspect recommended placement / keepouts.
2. Open **\`../../muon3.kicad_pro\`** (hierarchical production sheets).
3. Place production footprints using \`placement_positions.csv\` coordinates
   (KiCad columns), or run \`bun run sync:zones\` to stamp zone fences into
   the production board outline.
4. For autorouted demo nets → KiCad, run \`bun run autoroute\` then re-export.

**Do not** overwrite production hierarchical schematics with this export.
`,
)

console.log("Done. Open:")
console.log(`  ${proPath}`)
