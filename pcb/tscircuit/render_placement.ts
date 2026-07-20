/**
 * Render HCal-tile placement board → circuit JSON + PCB SVG + summary.
 *
 *   cd pcb/tscircuit && bun run render_placement.ts
 */
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { writeFileSync, mkdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { buildHcalPlacementCircuit, ZONES, BOARD_W, BOARD_H, TIA_KEEPOUTS } from "./hcal_tile_placement.tsx"

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, "out")
const figDir = join(__dirname, "..", "..", "figures", "tscircuit")
mkdirSync(outDir, { recursive: true })
mkdirSync(figDir, { recursive: true })

const circuit = buildHcalPlacementCircuit()
// Disable autorouting for placement-only sketch (faster, no netlist)
circuit.pcbRoutingDisabled = true

console.log("Rendering tscircuit placement board...")
await circuit.renderUntilSettled()

const json = circuit.getCircuitJson()
const keepouts = json.filter((e: any) => e.type === "pcb_keepout")
const chips = json.filter((e: any) => e.type === "pcb_component")
const silk = json.filter((e: any) => String(e.type).includes("silkscreen"))
const notes = json.filter((e: any) => String(e.type).includes("pcb_note") || String(e.type).includes("fabrication_note"))

writeFileSync(join(outDir, "hcal_placement.circuit.json"), JSON.stringify(json, null, 2))
console.log(
  `circuit-json: ${json.length} elements | components=${chips.length} keepouts=${keepouts.length} silkscreen=${silk.length} notes=${notes.length}`,
)

const svg = convertCircuitJsonToPcbSvg(json, {
  width: 1200,
  height: 900,
})
writeFileSync(join(outDir, "hcal_placement_pcb.svg"), svg)
writeFileSync(join(figDir, "hcal_placement_pcb.svg"), svg)
console.log("Wrote PCB SVG")

// Markdown report of placement rationale
const report = `# HCal-tile PCB placement & shielding (tscircuit)

**Board:** ${BOARD_W} × ${BOARD_H} mm · 4-layer JLCPCB Standard PCBA target  
**Tool:** tscircuit (\`@tscircuit/core\`) placement sketch  
**Detectors:** decommissioned sPHENIX Inner HCal tiles · Hamamatsu **S12572-33-015P**  
**HV:** **LT3482** (C515895) ~70 V  

Generated: \`${new Date().toISOString().slice(0, 10)}\`

## Zone map (optimal placement)

| Zone | Center (mm) | Size (mm) | Shielding / notes |
|------|-------------|-----------|-------------------|
${ZONES.map(
  (z) =>
    `| **${z.name}** — ${z.label.replace(/\\n/g, " ")} | (${z.cx}, ${z.cy}) | ${z.w}×${z.h} | ${z.shield ?? "—"} |`,
).join("\n")}

### Placement principles (from project notes)

1. **RF at board edge** — nRF9151 + U.FL LTE/GNSS with **≥15 mm antenna keepout** (openEMS / Nordic).
2. **AFE mid-board, connector edge** — four OPA858 banks face panel connectors; short SiPM/bias path.
3. **TEC + USB-PD opposite AFE** — switching loops ≥25 mm from TIA summing nodes (\`DESIGN_RULES.md\`).
4. **HV island** — LT3482 boost isolated; SW-node keepout; 100 V creepage; no pour under switch.
5. **Continuous ground** — placement zones only; **do not split GND plane** (return-path control).
6. **No copper pour** under TIA virtual-ground nodes (6×6 mm keepouts CH0–CH3).

## Keepouts encoded in tscircuit

| Keepout | Purpose |
|---------|---------|
| Circle r=15 mm @ U.FL LTE | Antenna RF keepout |
| Rect 6×6 mm ×4 @ TIA | No-pour summing node |
| Rect 12×10 mm @ LT3482 SW | HV switch-node keepout |

TIA keepout centers (mm): ${TIA_KEEPOUTS.map((k) => `${k.name}(${k.x},${k.y})`).join(", ")}

## Shielding recommendations

| Region | Recommendation |
|--------|----------------|
| AFE bank | **Shield can or stitched GND fence** over OPA858+comparators (note box on PCB); stitch vias ≤1 mm pitch on fence |
| RF | Optional shield over nRF9151; mandatory copper keepout for antennas |
| HV | Plastic/Kapton barrier or fence if enclosure nearby; never U.FL for bias |
| TEC / PD | No shield required; physical separation + local ground stitching around H-bridges |
| Cable entry | Hybrid connectors along AFE edge; shields to chassis/GND at entry only |

## Signal / power routing priorities (for later autoroute)

| Net class | Width / rules | Path |
|-----------|---------------|------|
| SiPM anode (AFE in) | short, guarded, no vias if possible | J_PANEL → TIA |
| HV cathode | 100 V spacing, thick for IR only if multi-mA | LT3482 filter → J_PANEL bias |
| CMP → FPGA | 50 Ω class microstrip (openEMS HS trace) | AFE → iCE40 |
| TEC power | wide pours, away from AFE | DRV8873 → J_PANEL |
| RF | 50 Ω coplanar to U.FL | nRF9151 only |

## How to regenerate

\`\`\`bash
cd pcb/tscircuit
bun install
bun run render_placement.ts
\`\`\`

Outputs:
- \`out/hcal_placement.circuit.json\`
- \`out/hcal_placement_pcb.svg\`
- \`figures/tscircuit/hcal_placement_pcb.svg\`

## Relation to KiCad

This is a **placement / shielding plan**, not a full schematic dump. Port zone
coordinates into \`muon3.kicad_pcb\` before dense routing. Full netlist remains
in hierarchical KiCad sheets (\`afe\`, \`power_usb_pd\`, \`digital_radio\`, \`thermal\`).
`

writeFileSync(join(outDir, "PLACEMENT_SHIELDING.md"), report)
writeFileSync(join(__dirname, "PLACEMENT_SHIELDING.md"), report)
writeFileSync(join(__dirname, "..", "PLACEMENT_SHIELDING.md"), report)
console.log("Wrote PLACEMENT_SHIELDING.md")
console.log("Done.")
