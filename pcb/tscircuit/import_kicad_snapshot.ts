/**
 * Optional reverse path: load a KiCad PCB/schematic into circuit-json
 * (for inspection or re-routing experiments).
 *
 *   bun run import:kicad -- ../muon3.kicad_pcb
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { join, dirname, basename } from "path"
import { fileURLToPath } from "url"
import { KicadToCircuitJsonConverter } from "kicad-to-circuit-json"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, "out")
mkdirSync(outDir, { recursive: true })

const args = process.argv.slice(2).filter((a) => !a.startsWith("-"))
const files =
  args.length > 0
    ? args
    : [join(__dirname, "..", "muon3.kicad_pcb")]

const converter = new KicadToCircuitJsonConverter()
for (const f of files) {
  const content = readFileSync(f, "utf-8")
  converter.addFile(basename(f), content)
  console.log("Added", f)
}

converter.runUntilFinished()
const json = converter.getOutput()
const outPath = join(outDir, "imported_from_kicad.circuit.json")
writeFileSync(outPath, JSON.stringify(json, null, 2))
console.log("Wrote", outPath)
console.log("Warnings:", converter.getWarnings?.() ?? "(n/a)")
console.log("Stats:", converter.getStats?.() ?? "(n/a)")
console.log(
  "Next: inspect JSON, or feed a full netlist into tscircuit autorouter once production sheets are complete.",
)
