// Build: netlist -> placement -> (routing) -> Gerbers, drill, BOM/CPL, SVG previews.
import { mkdirSync, writeFileSync } from "node:fs";
import { build as buildCircuit, P } from "./design.ts";
import { Board, ROUTE_LAYERS, PLANE_LAYERS, slotPath } from "./board.ts";
import { place } from "./place.ts";
import { floorplan, W, H, MOUNT_HOLES, ISLAND, CELLS } from "./floorplan.ts";
import { renderSvg, ratsnest } from "./svg.ts";
import { writeGerbers } from "./gerber.ts";
import { autoroute } from "./autoroute.ts";
import { toCopper, taperStats } from "./copper.ts";
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
// BME280 island: two C-shaped slots (1 mm FR4 bridge at the board edge); their inner legs run right to armX and
// leave a 2.6 mm arm between them. Island + arm carry no plane and no vias.
{ const I = ISLAND, r = I.slotW / 2, xr = I.x1 + r;
  board.cutouts.push(
    slotPath([{ x: 1.0 + r, y: I.y0 }, { x: xr, y: I.y0 }, { x: xr, y: I.neckY0 }, { x: I.armX, y: I.neckY0 }], I.slotW),
    slotPath([{ x: I.armX, y: I.neckY1 }, { x: xr, y: I.neckY1 }, { x: xr, y: I.y1 }, { x: 1.0 + r, y: I.y1 }], I.slotW));
  // plane void = island + arm only: a bigger notch in L2 next to the ch0 input raised its 2.4 GHz pickup 7× (openEMS)
  board.noPlane.push({ x0: 0, y0: I.y0 - r, x1: xr + r + 0.2, y1: I.y1 + r },
                     { x0: xr, y0: I.neckY0 - r, x1: I.armX + r + 0.2, y1: I.neckY1 + r }); }
place(board, floorplan);
const mcuU = circuit.parts.find(p => p.lcsc === P.esp32)!.ref;
console.log("  ESP32 hit-pin swap:", swapPins(board, mcuU, /^HIT\d$/).join(" "));
const rats = ratsnest(board);
const ratLen = rats.reduce((s, r) => s + Math.hypot(r.a.x - r.b.x, r.a.y - r.b.y), 0);
console.log(`${circuit.parts.length} parts placed, ratsnest ${ratLen.toFixed(0)} mm (${rats.length} connections) in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

writeFileSync(OUT + "placement.svg", renderSvg(board, { rats: true, title: "Muon3 station — placement + ratsnest" }));

const router = autoroute(board, floorplan.keepouts.filter(k => k.copper), CELLS); // placement-only keepouts don't block copper

toCopper(board, router, { smooth: process.env.SMOOTH !== "0" });
console.log(`  taper: ${taperStats.ends} pad exits considered, ${taperStats.wide} tapered steps kept`);
buildPlanes(board, PLANE_LAYERS, floorplan.keepouts);
footprintSilk(board);
labels(board, "2026-09-30");
writeFileSync(OUT + "routed.svg", renderSvg(board, { title: `Muon3 station — routed (${board.tracks.length} tracks, ${board.vias.length} vias)` }));
for (const L of ROUTE_LAYERS) writeFileSync(OUT + `layer${L + 1}.svg`, renderSvg(board, { layers: [L], labels: false, title: `L${L + 1}` }));
const files = writeGerbers(board, "muon3");
for (const [f, s] of Object.entries(files)) writeFileSync(OUT + "gerber/" + f, s);
for (const [f, s] of Object.entries(jlcFiles(board))) writeFileSync(OUT + f, s);
execFileSync("zip", ["-q", "-j", "-FS", OUT + "muon3-gerbers.zip", ...Object.keys(files).map(f => OUT + "gerber/" + f)]);
writeFileSync(OUT + "placement.json", JSON.stringify(circuit.parts.map(p => ({ ref: p.ref, lcsc: p.lcsc, ...p.place })), null, 1));
// geometry for the case generator (case/case.py) and the thermal/EM models
writeFileSync(OUT + "board.json", JSON.stringify({
  w: W, h: H, thickness: 1.6, holes: MOUNT_HOLES, island: ISLAND,
  cutouts: board.cutouts, noPlane: board.noPlane,
  parts: circuit.parts.filter(p => p.place).map(p => {
    const c = board.courtyard(p, 0); const xs = c.map(q => q.x), ys = c.map(q => q.y);
    return { ref: p.ref, lcsc: p.lcsc, value: p.value, mpn: p.info.mpn, x: p.place!.x, y: p.place!.y, rot: p.place!.rot,
      x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }),
}, null, 1));

const chk = checkBoard(board);
console.log(`  JS DRC: ${chk.clearance.length} clearance, ${chk.open.length} nets open`);
for (const s of [...chk.open.slice(0, 15), ...chk.clearance.slice(0, 15)]) console.log("    " + s);
mkdirSync(OUT + "kicad", { recursive: true });
writeKicad(board, OUT + "kicad/muon3.kicad_pcb");
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
