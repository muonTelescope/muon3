// Bench board build: netlist -> placement -> routing -> Gerbers, drill, BOM/CPL, SVG previews, KiCad oracle. Output: out/bench/.
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { build as buildCircuit, P } from "./design.ts";
import { floorplan, W, H, MOUNT_HOLES, CELLS, SMA_X, ANTENNA } from "./floorplan.ts";
import { labels } from "./labels.ts";
import { Board, ROUTE_LAYERS, PLANE_LAYERS } from "../board.ts";
import { place } from "../place.ts";
import { renderSvg, ratsnest } from "../svg.ts";
import { writeGerbers } from "../gerber.ts";
import { autoroute } from "../autoroute.ts";
import { toCopper, taperStats } from "../copper.ts";
import { writeKicad } from "../kicad.ts";
import { checkBoard } from "../drc.ts";
import { swapPins } from "../pinswap.ts";
import { buildPlanes } from "../planes.ts";
import { jlcFiles } from "../jlc.ts";
import { footprintSilk } from "../silk.ts";

const OUT = new URL("../../out/bench/", import.meta.url).pathname;
mkdirSync(OUT + "gerber", { recursive: true });

const t0 = performance.now();
const circuit = await buildCircuit();
const issues = circuit.check();
if (issues.length) console.log(issues.map(s => "  ! " + s).join("\n"));
const board = new Board(circuit, W, H);
for (const h of MOUNT_HOLES) board.holes.push({ at: h, d: 3.2, plated: false });
place(board, floorplan);
const mcuU = circuit.parts.find(p => p.lcsc === P.esp32)!.ref;
console.log("  ESP32 FPGA-link pin swap:", swapPins(board, mcuU, /^FX\d$/).join(" "));
const rats = ratsnest(board);
const ratLen = rats.reduce((s, r) => s + Math.hypot(r.a.x - r.b.x, r.a.y - r.b.y), 0);
console.log(`${circuit.parts.length} parts placed, ratsnest ${ratLen.toFixed(0)} mm (${rats.length} connections) in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
writeFileSync(OUT + "placement.svg", renderSvg(board, { rats: true, title: "Muon3 bench board — placement + ratsnest" }));
if (process.env.PLACE_ONLY) process.exit(0);

const router = autoroute(board, floorplan.keepouts.filter(k => k.copper), CELLS);
toCopper(board, router, { smooth: process.env.SMOOTH !== "0" });
console.log(`  taper: ${taperStats.ends} pad exits considered, ${taperStats.wide} tapered steps kept`);
buildPlanes(board, PLANE_LAYERS, floorplan.keepouts);
footprintSilk(board);
labels(board, "2026-10-28");
for (const side of ["top", "bottom"] as const) writeFileSync(OUT + `silk_${side}.svg`, silkSvg(board, side));
writeFileSync(OUT + "routed.svg", renderSvg(board, { title: `Muon3 bench board — routed (${board.tracks.length} tracks, ${board.vias.length} vias)` }));
for (const L of ROUTE_LAYERS) writeFileSync(OUT + `layer${L + 1}.svg`, renderSvg(board, { layers: [L], labels: false, title: `L${L + 1}` }));
const files = writeGerbers(board, "muon3-bench");
for (const [f, s] of Object.entries(files)) writeFileSync(OUT + "gerber/" + f, s);
for (const [f, s] of Object.entries(jlcFiles(board))) writeFileSync(OUT + f, s);
execFileSync("zip", ["-q", "-j", "-FS", OUT + "muon3-bench-gerbers.zip", ...Object.keys(files).map(f => OUT + "gerber/" + f)]);
writeFileSync(OUT + "placement.json", JSON.stringify(circuit.parts.map(p => ({ ref: p.ref, lcsc: p.lcsc, ...p.place })), null, 1));
// geometry for the printed mount (tools/classcad/bench/mount.mjs)
writeFileSync(OUT + "board.json", JSON.stringify({
  w: W, h: H, thickness: 1.6, holes: MOUNT_HOLES, sma_x: SMA_X.flat(), antenna: ANTENNA,
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
writeKicad(board, OUT + "kicad/muon3.kicad_pcb", "Muon3 bench board");
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

/** Fab-style preview of one side: solder mask green, exposed pads, holes, white silkscreen (bottom seen from below). */
function silkSvg(b: Board, side: "top" | "bottom") {
  const s = 10, pad = 2, X = (x: number) => (side === "bottom" ? b.w - x : x);
  const P = (q: { x: number; y: number }) => `${X(q.x).toFixed(3)},${q.y.toFixed(3)}`;
  const o: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${b.w + 2 * pad} ${b.h + 2 * pad}" width="${(b.w + 2 * pad) * s}" height="${(b.h + 2 * pad) * s}" style="background:#ffffff">`];
  o.push(`<polygon points="${b.outline.map(P).join(" ")}" fill="#1f6b3f"/>`);
  for (const p of b.allPads()) if (p.layer === "multi" || p.layer === side) o.push(`<polygon points="${p.poly.map(P).join(" ")}" fill="#d9b46a"/>`);
  for (const v of b.vias) o.push(`<circle cx="${X(v.at.x)}" cy="${v.at.y}" r="${v.dia / 2}" fill="#2c7a4c"/>`);
  for (const h of [...b.holes, ...b.parts.flatMap(p => b.partHoles(p))]) o.push(`<circle cx="${X(h.at.x)}" cy="${h.at.y}" r="${h.d / 2}" fill="#ffffff"/>`);
  for (const p of b.allPads()) if (p.drill) o.push(`<circle cx="${X(p.c.x)}" cy="${p.c.y}" r="${p.drill / 2}" fill="#ffffff"/>`);
  for (const l of b.silk.filter(l => l.layer === side)) o.push(`<line x1="${X(l.a.x)}" y1="${l.a.y}" x2="${X(l.b.x)}" y2="${l.b.y}" stroke="#f4f4f0" stroke-width="${l.w}" stroke-linecap="round"/>`);
  o.push("</svg>");
  return o.join("\n");
}
