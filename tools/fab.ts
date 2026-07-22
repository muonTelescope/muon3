/**
 * fab.ts — one-command fabrication build for the Muon3 board.
 *
 *   bun run fab
 *
 * Produces (in fab/): gerbers zip, pcb.svg, schematic.svg, kicad_pcb, and
 * flattened bom.csv / pnp.csv.
 *
 * Each step is isolated: a failing export does not abort the rest (e.g.
 * tscircuit's gerber exporter currently rejects 4-layer boards —
 * "Inner layer inner1 only supports copper gerbers" — so on a 4-layer
 * board the gerbers step is skipped and 4-layer fab data comes from the
 * KiCad export instead). `tsci export -o` resolves relative to the ENTRY
 * FILE's dir (board/), so outputs are written ../fab/... -> repo-root fab/.
 */
import { $ } from "bun"
import fs from "node:fs"

fs.mkdirSync("fab", { recursive: true })
const entry = "board/index.tsx"

async function step(name: string, run: () => Promise<unknown>) {
  try {
    await run()
    console.log(`  ✓ ${name}`)
  } catch (e: any) {
    console.log(`  ✗ ${name} — skipped: ${String(e?.stderr ?? e?.message ?? e).split("\n").slice(-3).join(" ").slice(0, 160)}`)
  }
}

console.log("• build (eval + DRC) …")
await step("build", () => $`bunx tsci build ${entry}`.quiet())
console.log("• exports …")
await step("gerbers (2-layer only)", () => $`bunx tsci export ${entry} -f gerbers -o ../fab/muon3-gerbers.zip`.quiet())
await step("pcb.svg", () => $`bunx tsci export ${entry} -f pcb-svg -o ../fab/pcb.svg`.quiet())
await step("schematic.svg", () => $`bunx tsci export ${entry} -f schematic-svg -o ../fab/schematic.svg`.quiet())
await step("kicad_pcb (4-layer fab source)", () => $`bunx tsci export ${entry} -f kicad_pcb -o ../fab/muon3-board.kicad_pcb`.quiet())
await step("bom/pnp csv", () => $`bun run tools/make_bom_pnp.ts`)
console.log("Done → fab/")
