// Build: netlist -> placement -> (routing) -> Gerbers, drill, BOM/CPL, SVG previews.
import { mkdirSync, writeFileSync } from "node:fs";
import { build as buildCircuit } from "./design.ts";
import { Board } from "./board.ts";
import { place } from "./place.ts";
import { floorplan, W, H, MOUNT_HOLES } from "./floorplan.ts";
import { renderSvg, ratsnest } from "./svg.ts";
import { writeGerbers } from "./gerber.ts";
import { autoroute } from "./autoroute.ts";
import { toCopper } from "./copper.ts";
import { writeKicad } from "./kicad.ts";
import { checkBoard } from "./drc.ts";
import { swapPins } from "./pinswap.ts";
import { buildPlanes } from "./planes.ts";
import { jlcFiles } from "./jlc.ts";
import { footprintSilk } from "./silk.ts";
import { labels } from "./labels.ts";
import { execFileSync } from "node:child_process";

const OUT = new URL("../out/", import.meta.url).pathname;
mkdirSync(OUT + "gerber", { recursive: true });

const t0 = performance.now();
const circuit = await buildCircuit();
const issues = circuit.check();
if (issues.length) console.log(issues.map(s => "  ! " + s).join("\n"));
const board = new Board(circuit, W, H);
for (const h of MOUNT_HOLES) board.holes.push({ at: h, d: 3.2, plated: false });
place(board, floorplan);
const fpgaU = circuit.parts.find(p => p.lcsc === "C2678152")!.ref;
console.log("  FPGA pin swap:", swapPins(board, fpgaU, /^(HIT\d|FPGA_IRQ)$/).join(" "));
const rats = ratsnest(board);
const ratLen = rats.reduce((s, r) => s + Math.hypot(r.a.x - r.b.x, r.a.y - r.b.y), 0);
console.log(`${circuit.parts.length} parts placed, ratsnest ${ratLen.toFixed(0)} mm (${rats.length} connections) in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

writeFileSync(OUT + "placement.svg", renderSvg(board, { rats: true, title: "Muon3 station — placement + ratsnest" }));

const router = autoroute(board, floorplan.keepouts);

toCopper(board, router, { smooth: process.env.SMOOTH !== "0" });
buildPlanes(board, [1, 4], floorplan.keepouts);
footprintSilk(board);
labels(board, "2026-09-29");
writeFileSync(OUT + "routed.svg", renderSvg(board, { title: `Muon3 station — routed (${board.tracks.length} tracks, ${board.vias.length} vias)` }));
for (const L of [0, 2, 3, 5]) writeFileSync(OUT + `layer${L + 1}.svg`, renderSvg(board, { layers: [L], labels: false, title: `L${L + 1}` }));
const files = writeGerbers(board, "muon3");
for (const [f, s] of Object.entries(files)) writeFileSync(OUT + "gerber/" + f, s);
for (const [f, s] of Object.entries(jlcFiles(board))) writeFileSync(OUT + f, s);
execFileSync("zip", ["-q", "-j", "-FS", OUT + "muon3-gerbers.zip", ...Object.keys(files).map(f => OUT + "gerber/" + f)]);
writeFileSync(OUT + "placement.json", JSON.stringify(circuit.parts.map(p => ({ ref: p.ref, lcsc: p.lcsc, ...p.place })), null, 1));

const chk = checkBoard(board);
console.log(`  JS DRC: ${chk.clearance.length} clearance, ${chk.open.length} nets open`);
for (const s of [...chk.open.slice(0, 15), ...chk.clearance.slice(0, 15)]) console.log("    " + s);
mkdirSync(OUT + "kicad", { recursive: true });
writeKicad(board, OUT + "kicad/muon3.kicad_pcb");
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
