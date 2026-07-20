/**
 * Run tscircuit capacity autorouter on the Muon3 demo board and export
 * results to SVG + KiCad.
 *
 *   cd pcb/tscircuit && bun run autoroute
 *
 * Uses the built-in autorouter (pcbRoutingDisabled = false / autorouter="auto")
 * which drives @tscircuit/capacity-autorouter under the hood.
 */
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import {
  CircuitJsonToKicadPcbConverter,
  CircuitJsonToKicadSchConverter,
  CircuitJsonToKicadProConverter,
} from "circuit-json-to-kicad"
import { buildAutorouteDemoCircuit, DEMO_W, DEMO_H } from "./autoroute_demo.tsx"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, "out")
const kicadDir = join(outDir, "kicad")
const figDir = join(__dirname, "..", "..", "figures", "tscircuit")
mkdirSync(outDir, { recursive: true })
mkdirSync(kicadDir, { recursive: true })
mkdirSync(figDir, { recursive: true })

const projectName = "muon3_autoroute_demo"

console.log(`Building autoroute demo (${DEMO_W}×${DEMO_H} mm)...`)
const circuit = buildAutorouteDemoCircuit()
// Ensure routing is enabled (default when autorouter="auto" on <board>)
circuit.pcbRoutingDisabled = false

console.log("Rendering + capacity autorouting (this may take a bit)...")
const t0 = performance.now()
await circuit.renderUntilSettled()
const dt = ((performance.now() - t0) / 1000).toFixed(2)
console.log(`Settled in ${dt}s`)

const json = circuit.getCircuitJson()
const traces = json.filter((e: any) => e.type === "pcb_trace")
const vias = json.filter((e: any) => e.type === "pcb_via")
const chips = json.filter((e: any) => e.type === "pcb_component")
console.log(
  `circuit-json: elements=${json.length} components=${chips.length} traces=${traces.length} vias=${vias.length}`,
)

writeFileSync(
  join(outDir, "muon3_autoroute_demo.circuit.json"),
  JSON.stringify(json, null, 2),
)

const svg = convertCircuitJsonToPcbSvg(json, { width: 1000, height: 750 })
writeFileSync(join(outDir, "muon3_autoroute_demo_pcb.svg"), svg)
writeFileSync(join(figDir, "muon3_autoroute_demo_pcb.svg"), svg)
console.log("Wrote autoroute demo SVG")

// Optional: exercise capacity-autorouter API directly for SimpleRouteJson stats
try {
  const { AutoroutingPipelineSolver } = await import(
    "@tscircuit/capacity-autorouter"
  )
  // If core exposed simple route json on the circuit, log it; otherwise skip.
  const anyCircuit = circuit as any
  const srj =
    typeof anyCircuit.getSimpleRouteJson === "function"
      ? anyCircuit.getSimpleRouteJson()
      : null
  if (srj) {
    const solver = new AutoroutingPipelineSolver(srj)
    let steps = 0
    while (!solver.solved && !solver.failed && steps < 50_000) {
      solver.step()
      steps++
    }
    if (solver.failed) {
      console.warn("Direct capacity-autorouter re-run failed:", solver.error)
    } else {
      const out = solver.getOutputSimpleRouteJson()
      console.log(
        `Direct AutoroutingPipelineSolver: steps=${steps} traces=${out.traces?.length ?? 0}`,
      )
      writeFileSync(
        join(outDir, "muon3_autoroute_demo.simple_route.json"),
        JSON.stringify(out, null, 2),
      )
    }
  } else {
    console.log(
      "Note: circuit.getSimpleRouteJson() not available; core-integrated autorouter already ran.",
    )
  }
} catch (e) {
  console.warn("Direct capacity-autorouter probe skipped:", (e as Error).message)
}

// Export to KiCad (with traces if autorouter succeeded)
console.log("Exporting autorouted demo → KiCad...")
const pcbConv = new CircuitJsonToKicadPcbConverter(json as any, {
  projectName,
})
pcbConv.runUntilFinished()
writeFileSync(
  join(kicadDir, `${projectName}.kicad_pcb`),
  pcbConv.getOutputString(),
)

const schConv = new CircuitJsonToKicadSchConverter(json as any)
schConv.runUntilFinished()
writeFileSync(
  join(kicadDir, `${projectName}.kicad_sch`),
  schConv.getOutputString(),
)

const proConv = new CircuitJsonToKicadProConverter(json as any, {
  projectName,
  schematicFilename: `${projectName}.kicad_sch`,
  pcbFilename: `${projectName}.kicad_pcb`,
  schematicSheetPlan: schConv.schematicSheetPlan,
})
proConv.runUntilFinished()
writeFileSync(
  join(kicadDir, `${projectName}.kicad_pro`),
  proConv.getOutputString(),
)

console.log(`KiCad project: ${join(kicadDir, `${projectName}.kicad_pro`)}`)
console.log("Done.")
