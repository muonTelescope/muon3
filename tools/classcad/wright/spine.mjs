// Rev-2 flowerpot: ONE tall PCB carries the SiPM cells, all electronics AND every LED. The only lit part is a "blade" on the front of the
// pot: three identical translucent blocks, each a short light-guide from the board's LED bar to the outer skin. No sensor daughterboards,
// no coax, no harness, no lightpipe bundle, no tile boxes (each pot drum IS the sealed tile chamber), no nuts / inserts / rods.
//   printed: base, 3x drum-rear half, 3x drum-front half, 3x blade block, lid  (5 unique designs, 11 pieces, nothing over 250x130x90 mm)
//   screws : 18x M3 thread-forming, one SKU: 6 close the drum halves, 3 close the base, 3 close the lid, 6 mount the board.
import { Scene, T, Rz, Rx, Ry, I4, mul, pt, offsetPoly, nrm, sub, add, sc, frame } from './lib.mjs';
import fs from 'node:fs';
const TILES = JSON.parse(fs.readFileSync(new URL('./tiles.json', import.meta.url)));
const TILE = 1, TT = 7, PITCH = 80, zk = k => 55 + PITCH * k, TW = 3.5, TOP = 258;

export function spinePot(S, variant, ex = 0, cutaway = false) {
  const D = TILES[TILE], cx = D.hull.reduce((a, p) => a + p[0], 0) / 4, cy = D.hull.reduce((a, p) => a + p[1], 0) / 4;
  const Hh = D.hull.map(([x, y]) => [x - cx, y - cy]), yt = D.ytop - cy, sxl = D.sx - cx, pk = D.pocket;
  // shell radius profile per variant (inner radius); every variant keeps r >= 126 so the tile (R=115 + clearance) always fits
  const prof = {
    terra: z => 126 + .075 * z + (z > TOP - 20 ? (z - (TOP - 20)) * .4 : 0),
    vase: z => z <= 240 ? 126 + 16 * Math.sin(Math.PI * Math.max(0, z - 10) / 235) : 126 - (z - 240) * .5,
    rings: z => 126 + .05 * z }[variant];
  const lip = (z, k) => variant === 'rings' && z > zk(k) + 22 ? 9 : (variant === 'terra' && z > TOP - 20 ? 5 : 0);
  const rin = prof, ro = (z, k = 0) => rin(z) + TW + lip(z, k);
  const rev = (z0, z1, k, cut) => { const n = 24, o = [], i = []; for (let a = 0; a <= n; a++) { const z = z0 + (z1 - z0) * a / n; o.push([ro(z, k), z]); i.push([rin(z), z]); } return S.rev('pot', [...o, ...i.reverse()]); };
  const halves = (z0, z1, k) => {
    const zc = (z0 + z1) / 2, big = [700, 300, 300];
    if (!cutaway) { S.push(T(0, ex * 110, ex * 70 * k)); const a = rev(z0, z1, k); a.cuts.push({ k: 'box', s: big, M: mul(S.M, T(0, -150 + .3, zc)) }); S.pop(); }   // rear half (y>0)
    S.push(T(0, -ex * 110, ex * 70 * k)); const b = rev(z0, z1, k); b.cuts.push({ k: 'box', s: big, M: mul(S.M, T(0, 150 - .3, zc)) });                          // front half (y<0)
    b.cuts.push({ k: 'box', s: [36, 40, 76], M: mul(S.M, T(-sxl, -(rin(zc) - 8), zk(k))) }); S.pop();                                                        // blade window
    S.count('drum half (rear)'); S.count('drum half (front)');
  };
  // ---- drums (each = sealed tile chamber), joined by twist-lock lugs (not modelled), halves closed by 2x M3
  for (let k = 0; k < 3; k++) {
    const z0 = k ? zk(k) - 40 + .4 : 10, z1 = zk(k) + 40 - .4;
    halves(z0, z1, k);
    S.push(T(0, 0, ex * 70 * k));
    for (const sgn of [-1, 1]) { const r = ro(zk(k)) + 0.2, x = sgn * r; S.cyl('hw', 5.5, 3, [x, 0, zk(k) + 22], Ry(Math.PI / 2)); S.cyl('hw', 5.5, 3, [x, 0, zk(k) - 22], Ry(Math.PI / 2)); }
    for (const a of [30, 150, 270]) { const th = a * Math.PI / 180, r = rin(zk(k)) - 3; S.box('pot', [12, 8, 6], [r * Math.cos(th), r * Math.sin(th), zk(k) - 6], Rz(th)); S.count('tile ledge (in shell)'); }
    // tile (SiPM edge faces the front / board), rotated 180 deg about z
    S.push(T(0, 0, zk(k))); S.push(Rz(Math.PI));
    S.prism('tile', Hh, -TT / 2, TT / 2, [Scene.cutBox([pk.x1 - pk.x0, yt + 2 - (pk.y_floor - cy), 2 * TT], [(pk.x0 + pk.x1) / 2 - cx, (yt + 2 + pk.y_floor - cy) / 2, 0])]);
    S.box('dark', [16, 10, 10], [sxl, yt + 1, 0]);                                                  // optical coupler to the SiPM
    S.pop(); S.pop(); S.count('scintillator tile (reclaimed)');
    S.pop();
  }
  // ---- single PCB (front of the chamber, behind the blade). local frame: tile top edge (SiPM) is at y = -yt after the 180deg turn
  const yb = -(yt + 3 + 10 + 1);                 // board mid-plane (rear face = SiPM side, front face = LED side)
  const bx = -sxl;                               // SiPM x after the turn
  S.push(T(0, -ex * 150, 0));
  S.box('pcb', [40, 1.6, 226], [bx, yb, 137]);
  for (let k = 0; k < 3; k++) { S.box('comp', [3, 1.5, 3], [bx, yb + 1.5, zk(k)]); S.box('comp', [14, 4, 8], [bx + 12, yb + 3, zk(k) + 14]); }   // SiPM cells + AFE
  S.box('comp', [18, 3, 25], [bx, yb + 2.4, 38]); S.box('comp', [10, 2, 10], [bx + 8, yb + 2, 60]); S.box('comp', [9, 3.2, 7.2], [bx, yb - 2.4, 26]);    // MCU/FPGA/USB-C
  for (const k of [0, 1, 2]) for (const dz of [-30, 30]) { S.cyl('hw', 5.5, 3, [bx - 14, yb - 3.5, zk(k) + dz], Rx(Math.PI / 2)); S.cyl('hw', 3, 8, [bx - 14, yb + 2, zk(k) + dz], Rx(Math.PI / 2)); S.count('M3 cap screw'); }
  S.pop();
  // ---- lit blade: 3 identical translucent light-guide blocks fed by the board's LED bar (1 LED / 4 mm), frame baffles keep light off the SiPM
  const fy = yb - 1;                              // LED plane
  for (let k = 0; k < 3; k++) {
    S.push(T(0, -ex * 110, ex * 70 * k));
    const yo = -(ro(zk(k)) + 0.3), len = Math.abs(yo - fy), ym = (yo + fy) / 2;
    S.box('shade', [34, len, 74], [bx, ym, zk(k)]); S.count('blade light-guide block');
    for (const sgn of [-1, 1]) S.box('dark', [2, len, 74], [bx + sgn * 18, ym, zk(k)]);       // baffle walls
    const nled = 18, lvl = [14, 9, 16][k];
    for (let i = 0; i < nled; i++) {
      const I = i < lvl ? (i >= lvl - 2 ? 3 : (i > lvl - 7 ? 2 : 1)) : (i === 12 ? 2 : 0);   // bar graph + shared coincidence marker
      S.box('led' + I, [26, 1.6, 2.4], [bx, fy - 1.2, zk(k) - 36 + i * 4.1 + 2]); S.count('LED (on the one PCB)');
    }
    S.pop();
  }
  // ---- base + lid
  S.push(T(0, 0, 0)); S.rev('pot', [[0, 0], [rin(0) + TW + 8, 0], [rin(0) + TW + 8, 6], [rin(0) + TW, 10], [0, 10]]); S.count('base'); S.box('dark', [12, 12, 5], [bx, yb - 18, 4]); S.pop();
  const R = rin(TOP) - 1, tz = TOP + 2; if (!cutaway) { S.push(T(0, 0, ex * 70 * 3)); S.rev('soil', [[0, tz - 6], [R, tz - 6], [R, tz], [R * .9, tz + 5], [R * .55, tz + 9], [0, tz + 10]]); S.count('lid'); S.pop(); }
  S.count('M3 cap screw', 12);
  return { Ms: [0, 1, 2].map(k => T(0, 0, zk(k) + ex * 70 * k)), tile: TILE, cutX: bx, shift: 0 };
}

const mk = (key, name, variant, style, ex, cam) => [key, { name, tile: TILE, build(S) { const r = spinePot(S, variant, ex); return { ...r, style, cam }; } }];
export const SPINE = Object.fromEntries([
  mk('Q1', 'SpineTerra', 'terra', { pot: [.62, .29, .17], rough: .9 }, 0, { az: 24, el: 12, dist: .98, look: [0, 0, 140], front: true }),
  mk('Q2', 'SpineVase', 'vase', { pot: [.05, .11, .22], rough: .25 }, 0, { az: 24, el: 12, dist: .98, look: [0, 0, 140] }),
  mk('Q3', 'SpineRings', 'rings', { pot: [.86, .8, .66], rough: .55 }, 0, { az: 24, el: 12, dist: .98, look: [0, 0, 140] }),
  ['Q5', { name: 'SpineCutaway', tile: TILE, build(S) { const r = spinePot(S, 'terra', 0, true); return { ...r, style: { pot: [.62, .29, .17], rough: .9 }, cam: { az: 14, el: 22, dist: .98, look: [0, 0, 140] } }; } }],
  mk('Q4', 'SpineExploded', 'terra', { pot: [.62, .29, .17], rough: .9 }, 1, { az: 28, el: 16, dist: 1.2, look: [0, -20, 180] }),
]);
