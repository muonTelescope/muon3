/**
 * make_bom_pnp.ts — derive JLCPCB BOM + CPL (pick-and-place) CSVs from the
 * tscircuit circuit-json produced by `tsci build`.
 *
 * BOM  -> fab/bom.csv   (Comment, Designator, Footprint, JLCPCB Part #)
 * CPL  -> fab/pnp.csv   (Designator, Mid X, Mid Y, Layer, Rotation)
 *
 * Board origin is the tscircuit board center (0,0), matching the exported
 * gerbers; set the same origin in the JLCPCB assembly step.
 */
import fs from "node:fs"
import path from "node:path"

const CJ = "dist/board/index/circuit.json"
if (!fs.existsSync(CJ)) {
  console.error(`circuit-json not found at ${CJ} — run \`bun run build\` first.`)
  process.exit(1)
}
const raw = JSON.parse(fs.readFileSync(CJ, "utf8"))
const els: any[] = Array.isArray(raw) ? raw : (raw.circuitJson ?? raw)

const srcById = new Map<string, any>()
for (const e of els) if (e.type === "source_component") srcById.set(e.source_component_id, e)

function valueOf(s: any): string {
  return (
    s.display_resistance ??
    s.display_capacitance ??
    s.display_value ??
    s.resistance ??
    s.capacitance ??
    s.ftype ??
    ""
  ).toString()
}
function csv(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

type Row = {
  desig: string
  lcsc: string
  value: string
  ftype: string
  x: number
  y: number
  rot: number
  layer: string
}
const rows: Row[] = []
for (const e of els) {
  if (e.type !== "pcb_component") continue
  const s = srcById.get(e.source_component_id)
  if (!s) continue
  if (e.do_not_place) continue
  rows.push({
    desig: s.name ?? "?",
    lcsc: s.supplier_part_numbers?.jlcpcb?.[0] ?? "",
    value: valueOf(s),
    ftype: s.ftype ?? "",
    x: e.center?.x ?? 0,
    y: e.center?.y ?? 0,
    rot: e.rotation ?? 0,
    layer: e.layer === "bottom" ? "Bottom" : "Top",
  })
}
rows.sort((a, b) => a.desig.localeCompare(b.desig, undefined, { numeric: true }))

fs.mkdirSync("fab", { recursive: true })

// --- CPL / pick-and-place ---
const cpl = ["Designator,Mid X,Mid Y,Layer,Rotation"]
for (const r of rows) {
  cpl.push(
    [r.desig, `${r.x.toFixed(4)}mm`, `${r.y.toFixed(4)}mm`, r.layer, r.rot.toFixed(2)].join(","),
  )
}
fs.writeFileSync("fab/pnp.csv", cpl.join("\n") + "\n")

// --- BOM (grouped by part) ---
const groups = new Map<string, { value: string; ftype: string; lcsc: string; desigs: string[] }>()
for (const r of rows) {
  const key = `${r.lcsc}|${r.value}|${r.ftype}`
  if (!groups.has(key)) groups.set(key, { value: r.value, ftype: r.ftype, lcsc: r.lcsc, desigs: [] })
  groups.get(key)!.desigs.push(r.desig)
}
const bom = ["Comment,Designator,Footprint,JLCPCB Part #"]
let unplaced = 0
for (const g of groups.values()) {
  if (!g.lcsc) unplaced += g.desigs.length
  bom.push(
    [csv(g.value), csv(g.desigs.join(",")), csv(g.ftype), csv(g.lcsc)].join(","),
  )
}
fs.writeFileSync("fab/bom.csv", bom.join("\n") + "\n")

console.log(
  `fab/bom.csv (${groups.size} line items, ${rows.length} placements) + fab/pnp.csv written.`,
)
if (unplaced) console.log(`  note: ${unplaced} placement(s) have no LCSC part # yet.`)
