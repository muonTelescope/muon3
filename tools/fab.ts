/**
 * fab.ts — one-command fabrication build for the Muon3 board.
 *
 *   bun run fab
 *
 * Produces (in fab/):
 *   muon3-gerbers.zip   Gerbers + drill + JLCPCB bom.csv + pick_and_place.csv
 *   pcb.svg             PCB render
 *   schematic.svg       Schematic render
 *   muon3-board.kicad_pcb  KiCad export (cross-check / hand-routing)
 *   bom.csv, pnp.csv    Flattened JLCPCB BOM + CPL for review
 *
 * NOTE: `tsci export -o` resolves relative to the ENTRY FILE's directory
 * (board/), so output paths are written as ../fab/... to land at repo root.
 */
import { $ } from "bun"
import fs from "node:fs"

fs.mkdirSync("fab", { recursive: true })
const entry = "board/index.tsx"

console.log("• build (eval + DRC) …")
await $`bunx tsci build ${entry}`
console.log("• gerbers …")
await $`bunx tsci export ${entry} -f gerbers -o ../fab/muon3-gerbers.zip`
console.log("• pcb svg …")
await $`bunx tsci export ${entry} -f pcb-svg -o ../fab/pcb.svg`
console.log("• schematic svg …")
await $`bunx tsci export ${entry} -f schematic-svg -o ../fab/schematic.svg`
console.log("• kicad_pcb …")
await $`bunx tsci export ${entry} -f kicad_pcb -o ../fab/muon3-board.kicad_pcb`
console.log("• bom/pnp csv …")
await $`bun run tools/make_bom_pnp.ts`
console.log("Done → fab/")
