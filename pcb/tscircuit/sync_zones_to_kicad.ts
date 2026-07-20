/**
 * Stamp tscircuit placement zones + keepouts into the production muon3.kicad_pcb
 * as silkscreen fences / texts + Edge.Cuts for the 160×120 mm outline.
 *
 *   cd pcb/tscircuit && bun run sync:zones
 *
 * Idempotent: replaces graphics between marker texts
 *   "#TSCIRCUIT_PLACEMENT_BEGIN" … "#TSCIRCUIT_PLACEMENT_END"
 *
 * Does not move footprints (production still has no dense layout) — only
 * geometry guides for placement. Hierarchical schematics are untouched.
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { randomUUID } from "crypto"
import { ZONES, TIA_KEEPOUTS, BOARD_W, BOARD_H } from "./muon3_placement.tsx"
import {
  tscToKicad,
  tscRectToKicad,
  boardEdgeCutsKicad,
  KICAD_ORIGIN_X,
  KICAD_ORIGIN_Y,
} from "./coords.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const pcbPath = join(__dirname, "..", "muon3.kicad_pcb")
const backupPath = join(__dirname, "out", "muon3.kicad_pcb.pre_sync.bak")

const MARKER_BEGIN = "#TSCIRCUIT_PLACEMENT_BEGIN"
const MARKER_END = "#TSCIRCUIT_PLACEMENT_END"

function uuid() {
  return randomUUID()
}

function grRect(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  layer: string,
  width = 0.3,
  type: "dash" | "default" = "dash",
) {
  return `
	(gr_rect
		(start ${sx} ${sy})
		(end ${ex} ${ey})
		(stroke
			(width ${width})
			(type ${type})
		)
		(fill no)
		(layer "${layer}")
		(uuid "${uuid()}")
	)`
}

function grCircle(cx: number, cy: number, r: number, layer: string, width = 0.25) {
  return `
	(gr_circle
		(center ${cx} ${cy})
		(end ${cx + r} ${cy})
		(stroke
			(width ${width})
			(type dash)
		)
		(fill no)
		(layer "${layer}")
		(uuid "${uuid()}")
	)`
}

function grText(text: string, x: number, y: number, layer: string, size = 1.2) {
  const safe = text.replace(/"/g, "'")
  return `
	(gr_text "${safe}"
		(at ${x} ${y} 0)
		(layer "${layer}")
		(uuid "${uuid()}")
		(effects
			(font
				(size ${size} ${size})
				(thickness ${Math.max(0.15, size * 0.15)})
			)
		)
	)`
}

function buildBlock(): string {
  const edge = boardEdgeCutsKicad()
  const parts: string[] = []
  // Markers sit off-board on Dwgs.User so they do not print on silk.
  parts.push(grText(MARKER_BEGIN, KICAD_ORIGIN_X - 5, KICAD_ORIGIN_Y - 5, "Dwgs.User", 0.8))
  parts.push(
    grText(
      `Muon3 tscircuit zones ${BOARD_W}x${BOARD_H}mm — regen: bun run sync:zones`,
      KICAD_ORIGIN_X,
      KICAD_ORIGIN_Y - 8,
      "Dwgs.User",
      1.0,
    ),
  )

  parts.push(
    grRect(
      edge.startX,
      edge.startY,
      edge.endX,
      edge.endY,
      "Edge.Cuts",
      0.2,
      "default",
    ),
  )

  for (const z of ZONES) {
    const r = tscRectToKicad(z.cx, z.cy, z.w, z.h)
    parts.push(grRect(r.startX, r.startY, r.endX, r.endY, "F.SilkS", 0.3, "dash"))
    const label = z.label.replace(/\n/g, " ")
    const c = tscToKicad(z.cx, z.cy + z.h / 2 - 3)
    parts.push(grText(label, c.x, c.y, "F.SilkS", 1.3))
    if (z.shield) {
      const s = tscToKicad(z.cx, z.cy - z.h / 2 + 2.5)
      parts.push(grText(z.shield, s.x, s.y, "Dwgs.User", 1.0))
    }
  }

  for (const k of TIA_KEEPOUTS) {
    const r = tscRectToKicad(k.x, k.y, 6, 6)
    parts.push(grRect(r.startX, r.startY, r.endX, r.endY, "Cmts.User", 0.2, "dash"))
    const t = tscToKicad(k.x, k.y + 5)
    parts.push(grText(`TIA ${k.name} NO POUR`, t.x, t.y, "Cmts.User", 0.9))
  }

  const ant = tscToKicad(-72, 50)
  parts.push(grCircle(ant.x, ant.y, 15, "Cmts.User", 0.25))
  parts.push(grText("ANT KEEPOUT 15mm", ant.x, ant.y - 17, "Cmts.User", 1.0))

  const hv = tscRectToKicad(58, 38, 12, 10)
  parts.push(grRect(hv.startX, hv.startY, hv.endX, hv.endY, "Cmts.User", 0.25, "dash"))
  const hvt = tscToKicad(58, 45)
  parts.push(grText("HV SW NODE KEEPOUT", hvt.x, hvt.y, "Cmts.User", 1.0))

  const title = tscToKicad(0, 58)
  parts.push(
    grText(
      "MUON3 160x120 | tscircuit zones | S12572 + LT3482 | NOT FOR FAB",
      title.x,
      title.y,
      "F.SilkS",
      1.5,
    ),
  )

  parts.push(grText(MARKER_END, KICAD_ORIGIN_X - 5, KICAD_ORIGIN_Y + BOARD_H + 5, "Dwgs.User", 0.8))
  return parts.join("\n")
}

/** Strip top-level gr_rect / gr_text / gr_circle (legacy P0 architecture drawings). */
function stripAllGraphics(src: string): string {
  let out = src
  const patterns = [
    /\n\t\(gr_rect[\s\S]*?\n\t\)/g,
    /\n\t\(gr_text[\s\S]*?\n\t\)/g,
    /\n\t\(gr_circle[\s\S]*?\n\t\)/g,
  ]
  for (const re of patterns) {
    out = out.replace(re, "")
  }
  return out
}

function upsertBlock(src: string, block: string): string {
  if (src.includes(MARKER_BEGIN) && src.includes(MARKER_END)) {
    // Remove every gr_* then re-insert clean block (markers identify a prior sync).
    const cleaned = stripAllGraphics(src)
    const idx = cleaned.lastIndexOf("\n)")
    if (idx < 0) throw new Error("Could not find end of kicad_pcb")
    return cleaned.slice(0, idx) + "\n" + block + "\n)\n"
  }

  const cleaned = stripAllGraphics(src)
  const idx = cleaned.lastIndexOf("\n)")
  if (idx < 0) throw new Error("Could not find end of kicad_pcb")
  return cleaned.slice(0, idx) + "\n" + block + "\n)\n"
}

// --- main ---
if (!existsSync(pcbPath)) {
  console.error("Missing", pcbPath)
  process.exit(1)
}

mkdirSync(join(__dirname, "out"), { recursive: true })
const original = readFileSync(pcbPath, "utf-8")
copyFileSync(pcbPath, backupPath)
console.log("Backup:", backupPath)

let pcb = original
if (!pcb.includes("Dwgs.User")) {
  pcb = pcb.replace(
    `(35 "F.Fab" user)`,
    `(12 "Dwgs.User" user "User drawings")\n\t\t(13 "Cmts.User" user "User comments")\n\t\t(35 "F.Fab" user)`,
  )
} else if (!pcb.includes("Cmts.User")) {
  pcb = pcb.replace(
    /(Dwgs\.User"[^\n]*\n)/,
    `$1\t\t(13 "Cmts.User" user "User comments")\n`,
  )
}

const block = buildBlock()
const next = upsertBlock(pcb, block)
writeFileSync(pcbPath, next)
console.log("Updated", pcbPath)
console.log(
  `Edge.Cuts: (${KICAD_ORIGIN_X},${KICAD_ORIGIN_Y}) → (${KICAD_ORIGIN_X + BOARD_W},${KICAD_ORIGIN_Y + BOARD_H})`,
)
console.log(`Zones: ${ZONES.map((z) => z.name).join(", ")}`)
console.log("Open muon3.kicad_pcb in KiCad to review. Hierarchical sheets unchanged.")
