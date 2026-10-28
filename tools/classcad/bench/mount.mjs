// node tools/classcad/bench/mount.mjs  -> hw/out/bench/mount/{<group>.stl,<group>.step,manifest.json}
// Printed bench mount for the Muon3 bench board: a flat tray with five bosses (M3 heat-set inserts), a stiffening rim on three
// sides, zip-tie slot pairs in front of every SMA (strain relief for the SiPM pigtails and scope cables) and four feet.
// Frame: x = board x, y = H − board y (the board generator's y points down, as in KiCad; the Gerbers flip it), z up.
// The SMA edge is at y = H. Tray top at z = 3, board bottom at z = 13.
// Also writes a board proxy (pcb, comp, hw groups) from hw/out/bench/board.json for the renders.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { session } from '../rt.mjs'; import { Scene, groupScript, Rx } from '../wright/lib.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '../../..');
const B = JSON.parse(fs.readFileSync(path.join(root, 'hw/out/bench/board.json')));
const out = path.join(root, 'hw/out/bench/mount'); fs.mkdirSync(out, { recursive: true });

const T = 3, BOSS = 10, ZB = T + BOSS, PCB = B.thickness, ZT = ZB + PCB;   // tray thickness, boss height, board bottom/top
const Y = yb => B.h - yb;                                               // board y -> world y
const X0 = -6, X1 = B.w + 6, Y0 = -6, Y1 = B.h + 28, RIM = 2.5, RIM_H = 6; // tray reaches 28 mm past the SMA edge
const circle = (cx, cy, r, n = 32) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)]);
function rrect(x0, y0, x1, y1, r, n = 8) {
  const out = [], cs = [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * Math.PI / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}

const S = new Scene();
// ── tray: plate with two windows under the board and tie-slot pairs in front of the SMAs ──
const cuts = [
  Scene.cutBox([72, 56, T + 2], [48, Y(40), T / 2]), Scene.cutBox([72, 56, T + 2], [136, Y(40), T / 2]),     // windows (rib at x 84–100 carries the middle boss)
  ...B.sma_x.flatMap(x => [-4.5, 4.5].map(dx => Scene.cutBox([2.2, 4.5, T + 2], [x + dx, Y(-16), T / 2]))), // zip tie ≤ 2 mm wide
];
S.prism('mount', rrect(X0, Y0, X1, Y1, 5), 0, T, cuts);
// rim on the back and both short sides (the SMA side stays open for the cables)
S.box('mount', [X1 - X0, RIM, RIM_H], [(X0 + X1) / 2, Y0 + RIM / 2, T + RIM_H / 2]);
for (const x of [X0 + RIM / 2, X1 - RIM / 2]) S.box('mount', [RIM, Y1 - Y0 - 10, RIM_H], [x, (Y0 + Y1) / 2 - 1, T + RIM_H / 2]);
// bosses: Ø8, 4.0 mm hole for an M3 × 5.7 heat-set insert; M3 × 6 screw from above through the board
for (const h of B.holes) {
  const y = Y(h.y);
  S.ring('mount', circle(h.x, y, 4), circle(h.x, y, 2.0, 24), T - 0.01, ZB);
  S.cyl('insert', 4.6, 5.7, [h.x, y, ZB - 2.85]); S.count('M3 x 5.7 heat-set insert');
  S.screw(h.x, y, ZT + 3, 6);
}
// feet
for (const [x, y] of [[X0 + 8, Y0 + 8], [X1 - 8, Y0 + 8], [X0 + 8, Y1 - 8], [X1 - 8, Y1 - 8]]) S.cyl('mount', 12, 4, [x, y, -2]);

// ── board proxy (render only) ──
S.prism('pcb', rrect(0, 0, B.w, B.h, 3), ZB, ZT);
const H = { C2913198: 3.2, C2678152: 0.9, C2765186: 3.2, C160404: 2.9, C158012: 7.0, C318884: 1.5, C5199798: 2.6, C6186: 1.7 };
for (const p of B.parts) {
  if (p.lcsc === 'C496550') continue;
  const w = p.x1 - p.x0, d = p.y1 - p.y0, h = H[p.lcsc] ?? (/^[RC]\d/.test(p.ref) ? 0.5 : /^D\d/.test(p.ref) ? 0.6 : 1.1);
  const g = p.lcsc === 'C5199798' ? 'loop' : p.lcsc === 'C2913198' ? 'esp' : 'comp';
  const s = p.lcsc === 'C5199798' ? [Math.min(w, d) * 0.5, Math.max(w, d) * 0.6] : [w * 0.85, d * 0.85];
  const sx = p.lcsc === 'C5199798' && w > d ? s[1] : s[0], sy = p.lcsc === 'C5199798' && w > d ? s[0] : s[1];
  S.box(g, [sx, sy, h], [(p.x0 + p.x1) / 2, Y((p.y0 + p.y1) / 2), ZT + h / 2]);
}
// edge-launch SMA: flange straddling the edge, 1/4-36 barrel off the SMA edge
const zc = ZB + PCB / 2;
for (const x of B.sma_x) {
  S.box('gold', [6.5, 1.6, 6.5], [x, Y(-0.8), zc]);
  S.cyl('gold', 6.35, 7.9, [x, Y(-1.6 - 3.95), zc], Rx(Math.PI / 2));
  S.box('gold', [1.0, 4.8, 0.3], [x, Y(2.4), ZT + 0.15]);
}

const { client, call } = await session();
try {
  const rep = {};
  for (const g of [...new Set(S.prims.map(p => p.g))]) {
    const prims = S.prims.filter(p => p.g === g);
    const r = await call('run_script', { label: `bench:${g}`, script: groupScript(`bench_${g}`, prims), timeoutMs: 300000 });
    rep[g] = { prims: prims.length, result: r.returned ?? r };
    for (const fmt of ['STL', 'STP']) {
      const s = await call('save', { format: fmt }); const content = s.content ?? s.result?.content;
      if (!content) throw Error('empty export ' + g);
      fs.writeFileSync(path.join(out, `${g}.${fmt === 'STL' ? 'stl' : 'step'}`), Buffer.from(content, 'base64'));
    }
    console.log(g, prims.length);
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({
    tray: { x0: X0, y0: Y0, x1: X1, y1: Y1, thickness: T, boss: BOSS, board_bottom: ZB }, tally: S.tally, report: rep }, null, 1));
} finally { await client.close(); }
