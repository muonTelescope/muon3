// Flowerpot design iterations. ONE round/faceted pot encloses three identical sealed tile modules; ONE main PCB (disc in the base)
// carries the electronics AND a ring of LEDs. Each LED feeds a 3D-printed clear lightpipe that runs up inside the pot wall to a flush
// "window" on the outer surface -> data lines wrapped around the whole pot. No threaded rod: modules sit on printed ledges,
// pot segments twist-lock, screws only close the base cover (8x M3) and mount the PCB (4x M3).
import { Scene, T, Rz, Rx, Ry, I4, mul, pt, offsetPoly, rayHit, sub, add, sc, nrm, cross, frame } from './lib.mjs';
import fs from 'node:fs';
const TILES = JSON.parse(fs.readFileSync(new URL('./tiles.json', import.meta.url)));
const TILE = 1, TT = 7, PITCH = 80, ZB = 40, zk = k => 70 + PITCH * k, TOP = 280, TW = 3.5, ZP = 20;
const circle = (R, n = 64) => Array.from({ length: n }, (_, i) => [R * Math.cos(2 * Math.PI * i / n), R * Math.sin(2 * Math.PI * i / n)]);
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const basis = (t, s, n, o) => [[t[0], s[0], n[0], o[0]], [t[1], s[1], n[1], o[1]], [t[2], s[2], n[2], o[2]], [0, 0, 0, 1]];

/** shared interior: 3 sealed tile modules, the single PCB with its LED ring, base cover, pipes. `spec.rin(z)` inner radius of the shell. */
function interior(S, spec, lines) {
  const D = TILES[TILE], cx = D.hull.reduce((a, p) => a + p[0], 0) / 4, cy = D.hull.reduce((a, p) => a + p[1], 0) / 4;
  const H = D.hull.map(([x, y]) => [x - cx, y - cy]), yt = D.ytop - cy, sx = D.sx - cx, pk = D.pocket;
  const O = d => offsetPoly(H, d);
  for (let k = 0; k < 3; k++) {
    S.push(T(0, 0, zk(k)));
    S.prism('dark', O(3), -8, -6); S.ring('dark', O(3), O(0.8), -6, 6, [Scene.cutBox([14, 10, 8], [sx, yt + 2, 0])]); S.prism('dark', O(3), 6, 8);
    S.prism('tile', H, -TT / 2, TT / 2, [Scene.cutBox([pk.x1 - pk.x0, yt + 2 - (pk.y_floor - cy), 2 * TT], [(pk.x0 + pk.x1) / 2 - cx, (yt + 2 + pk.y_floor - cy) / 2, 0])]);
    S.box('dark', [16, 12, 10], [sx, yt - 3, 0]); S.box('comp', [3, 1.5, 3], [sx, yt + 2.5, 0]);
    S.count('scintillator tile (reclaimed)'); S.count('sealed detector module'); S.pop();
    for (const a of [90, 210, 330]) { const r = spec.rin(zk(k) - 9) - 3.5, th = a * Math.PI / 180; S.box('pot', [12, 8, 7], [r * Math.cos(th), r * Math.sin(th), zk(k) - 10.5], Rz(th)); S.count('module ledge (printed in shell)'); }
  }
  // the one PCB
  const Rp = spec.rin(ZP) - 5;
  S.prism('pcb', circle(Rp), ZP, ZP + 1.6); S.count('main PCB (single board)');
  S.box('comp', [18, 25, 3], [20, 30, ZP + 3.1]); S.box('comp', [14, 14, 1.5], [-15, 5, ZP + 2.4]); S.box('comp', [10, 10, 1.5], [10, -25, ZP + 2.4]);
  S.box('comp', [9, 7.2, 3.2], [-Rp + 6, 0, ZP + 3.2]); for (let i = 0; i < 3; i++) S.box('comp', [10, 5, 8], [-40 + 30 * i, -50, ZP + 5.6]);
  for (const [x, y] of [[-70, 70], [70, 70], [-70, -70], [70, -70]]) { S.cyl('pot', 6, 8, [x, y, ZP - 4]); S.screw(x, y, ZP + 3.6, 8); }   // 4x M3 board mount
  S.prism('pot', circle(spec.rin(0) + TW), 0, 4);                                                                                       // base cover
  for (let i = 0; i < 8; i++) { const th = i * Math.PI / 4 + Math.PI / 8, r = spec.rin(0) - 4; const x = r * Math.cos(th), y = r * Math.sin(th); S.cyl('hw', 5.5, 3, [x, y, 1.5]); S.cyl('hw', 3, 12, [x, y, 9]); S.count('M3 cap screw'); }
  // light lines: LED on the PCB -> clear lightpipe up the inside of the wall -> flush window on the outside
  for (const L of lines) {
    const th = L.th, zA = ZP + 3, r = z => spec.rin(z) - 2.6;
    const p0 = [r(zA) * Math.cos(th), r(zA) * Math.sin(th), zA], p1 = [r(L.z0) * Math.cos(th), r(L.z0) * Math.sin(th), L.z0];
    S.box('ledpcb', [2.6, 2.6, 1], [p0[0], p0[1], ZP + 2.1], Rz(th)); S.count('LED (on main PCB)');
    if (L.z0 - zA > 3) { const mid = sc(add(p0, p1), .5), d = nrm(sub(p1, p0)), Lh = Math.hypot(...sub(p1, p0)); const Rr = mul(frame([0, 0, 0], d), Ry(Math.PI / 2)); S.cyl('pipe', 3.2, Lh, mid, Rr); S.count('printed lightpipe'); }
  }
}

function wallFrame(spec, th, z, tilt = 0, off = 0.2) {
  const rho = (spec.ro(z + 1) - spec.ro(z - 1)) / 2, c = Math.cos(th), s = Math.sin(th);
  const t = [-s, c, 0], sl = nrm([rho * c, rho * s, 1]), n = cross(t, sl);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const t2 = [ct * t[0] + st * sl[0], ct * t[1] + st * sl[1], ct * t[2] + st * sl[2]], s2 = [-st * t[0] + ct * sl[0], -st * t[1] + ct * sl[1], -st * t[2] + ct * sl[2]];
  const R = spec.ro(z) + off; return basis(t2, s2, n, [R * c, R * s, z]);
}
const win = (S, spec, th, z, len, wid, I, tilt = 0) => { S.push(wallFrame(spec, th, z, tilt)); S.box('led' + I, [wid, len, 1.8], [0, 0, 0]); S.pop(); };

const SHELL = (S, spec, z0, z1, g = 'pot') => {
  const n = 40, outer = [], inner = [];
  for (let i = 0; i <= n; i++) { const z = z0 + (z1 - z0) * i / n; outer.push([spec.ro(z), z]); inner.push([spec.rin(z), z]); }
  S.rev(g, [...outer, ...inner.reverse()]);
};
const saucer = (S, spec, g = 'pot') => S.rev(g, [[spec.rin(0) + 2, 0], [spec.ro(0) + 18, 0], [spec.ro(0) + 18, 7], [spec.ro(0) + 6, 11], [spec.ro(0) + 2, 11]]);
const soil = (S, spec, topZ) => { const R = spec.rin(topZ) - 1; S.rev('soil', [[0, topZ - 6], [R, topZ - 6], [R, topZ], [R * .9, topZ + 5], [R * .55, topZ + 9], [0, topZ + 10]]); };

// ----------------------------------------------------------------------------------------------------- 1 Terra: tapered terracotta, data-wrap heat-map
function P1(S) {
  const spec = { rin: z => 126 + .075 * z + (z > TOP - 22 ? (z - (TOP - 22)) * .45 : 0), ro: z => spec.rin(z) + TW + (z > TOP - 22 ? 5 : 0) };
  SHELL(S, spec, 0, TOP); saucer(S, spec); soil(S, spec, TOP);
  const lines = [], rng = mulberry(4);
  for (let c = 0; c < 24; c++) for (let k = 0; k < 3; k++) {
    const th = (c * 15 + (k - 1) * 3.2) * Math.PI / 180, age = (c + 24 - 17) % 24; const I = Math.max(0, Math.min(3, Math.round(3.4 - age * .16 - (rng() < .25 ? 1.5 : 0) + (k === 1 ? .4 : 0))));
    lines.push({ th, z0: zk(k) - 14, z1: zk(k) + 14, I }); win(S, spec, th, zk(k), 28, 5, I);
  }
  for (let i = 0; i < 48; i++) win(S, spec, i * Math.PI / 24, TOP - 11, 5, 8, (i % 12 < 4) ? 3 : 1);                            // rim ring: coincidence chaser
  interior(S, spec, lines); S.count('twist-lock pot segment', 3);
  return { spec, style: { pot: [.62, .29, .17], rough: .9 }, cam: { az: 28, el: 14, dist: .98, look: [0, 0, 150] } };
}
// ----------------------------------------------------------------------------------------------------- 2 Ring stack: three nested pots, glowing lips
function P2(S) {
  const spec = { rin: z => 126 + .05 * z, ro: z => spec.rin(z) + TW };
  const segs = [[ZB - 38, zk(0) + 36], [zk(0) + 44, zk(1) + 36], [zk(1) + 44, TOP]];
  segs.forEach(([a, b], k) => {
    const lip = z => (z > b - 16 ? 9 : 0);
    const sp = { rin: z => spec.rin(z), ro: z => spec.rin(z) + TW + lip(z) }; SHELL(S, sp, k ? a : 0, b);
    for (let i = 0; i < 36; i++) { const I = [3, 2, 1, 0][(i + 5 * k) % 4]; win(S, { ro: sp.ro }, i * Math.PI / 18, b - 8, 4, 12, I); }  // lip segments
    for (let i = 0; i < 36; i++) win(S, { ro: sp.ro }, i * Math.PI / 18, zk(k) - 4, 3, 20, (i * 3 + k) % 5 < 2 ? 2 : 0);
  });
  saucer(S, spec); soil(S, spec, TOP);
  const lines = []; for (let k = 0; k < 3; k++) for (let i = 0; i < 24; i++) lines.push({ th: (i * 15 + k * 5) * Math.PI / 180, z0: segs[k][1] - 12, z1: segs[k][1] - 4 });
  interior(S, spec, lines); S.count('twist-lock pot segment', 3);
  return { spec, style: { pot: [.86, .8, .66], rough: .55 }, cam: { az: 28, el: 14, dist: .98, look: [0, 0, 150] } };
}
// ----------------------------------------------------------------------------------------------------- 3 Fluted vase: polar bar-graph of vertical light flutes
function P3(S) {
  const base = z => z <= 250 ? 126 + 16 * Math.sin(Math.PI * z / 250) : 126 - (z - 250) * .5;
  const spec = { rin: base, ro: z => base(z) + TW };
  SHELL(S, spec, 0, TOP); saucer(S, spec); soil(S, spec, TOP);
  const lines = [], rng = mulberry(8), N = 36;
  for (let c = 0; c < N; c++) {
    const f = Math.exp(-.5 * ((c - 12) / 4.5) ** 2) + .55 * Math.exp(-.5 * ((c - 26) / 3) ** 2) + .08 * rng(), h = 18 + 215 * Math.min(1, f), th = c * 2 * Math.PI / N;
    const zs = []; for (let z = 28; z < 28 + h; z += 16) zs.push(z);
    zs.forEach((z, i) => win(S, spec, th, z + 8, Math.min(16, 28 + h - z), 3.4, i / zs.length > .8 ? 3 : (i / zs.length > .4 ? 2 : 1)));
    lines.push({ th, z0: 28, z1: 28 + h, I: 2 });
  }
  interior(S, spec, lines); S.count('twist-lock pot segment', 3);
  return { spec, style: { pot: [.05, .11, .22], rough: .25 }, cam: { az: 28, el: 14, dist: .98, look: [0, 0, 150] } };
}
// ----------------------------------------------------------------------------------------------------- 4 Hex planter: stepped facets, chevron light lines
function P4(S) {
  const ain = z => 126 + .06 * z;
  const hex = a => Array.from({ length: 6 }, (_, i) => [a / Math.cos(Math.PI / 6) * Math.cos(i * Math.PI / 3), a / Math.cos(Math.PI / 6) * Math.sin(i * Math.PI / 3)]);
  const step = 5; for (let z = 0; z < TOP; z += step) S.ring('pot', hex(ain(z + step) + TW), hex(ain(z)), z, z + step);
  S.prism('pot', hex(ain(0) + 18), 0, 7); S.prism('soil', hex(ain(TOP) - 1), TOP - 6, TOP + 3);
  const lines = [], rng = mulberry(2);
  for (let f = 0; f < 6; f++) {
    const phi = f * Math.PI / 3 + Math.PI / 6, nn = [Math.cos(phi), Math.sin(phi), 0], tt = [-Math.sin(phi), Math.cos(phi), 0];
    for (let k = 0; k < 3; k++) for (const du of [-1, 1]) {                       // one chevron (two diagonals) per facet per tile level
      const z = zk(k), u = du * 22, I = Math.min(3, Math.floor(rng() * 4)), a = ain(z) + TW + .2, ang = du * 0.7;
      const o = [a * nn[0] + u * tt[0], a * nn[1] + u * tt[1], z];
      const t2 = [Math.cos(ang) * tt[0], Math.cos(ang) * tt[1], Math.sin(ang)], s2 = [-Math.sin(ang) * tt[0], -Math.sin(ang) * tt[1], Math.cos(ang)];
      S.push(basis(t2, s2, nn, o)); S.box('led' + I, [4, 36, 1.8], [0, 0, 0]); S.pop();
      lines.push({ th: Math.atan2(o[1], o[0]), z0: z - 14, z1: z + 14, I });
    }
  }
  interior(S, { rin: z => ain(z) + 3, ro: z => ain(z) + TW }, lines); S.count('twist-lock pot segment', 3);
  return { style: { pot: [.07, .075, .085], rough: .5 }, cam: { az: 30, el: 14, dist: .98, look: [0, 0, 150] } };
}
// ----------------------------------------------------------------------------------------------------- 5 Drum on a tripod: one spiral ticker winding up the pot
function P5(S) {
  const spec = { rin: z => 127 + .02 * z, ro: z => spec.rin(z) + TW };
  S.push(T(0, 0, 30));
  for (let i = 0; i < 3; i++) { const th = i * 2 * Math.PI / 3 + .5; S.cyl('pot', 16, 36, [118 * Math.cos(th), 118 * Math.sin(th), -12]); S.cyl('pot', 22, 4, [118 * Math.cos(th), 118 * Math.sin(th), -1]); }
  SHELL(S, spec, 0, TOP); saucer(S, spec); soil(S, spec, TOP);
  const lines = [], N = 132, head = 96, turns = 3;
  for (let i = 0; i < N; i++) {
    const u = i / N, th = u * turns * 2 * Math.PI, z = 36 + u * 205, age = (head - i + N) % N, I = age < 3 ? 3 : age < 14 ? 2 : age < 40 ? 1 : 0;
    const delta = Math.atan2(205 / (turns * 2 * Math.PI), spec.ro(z));
    win(S, spec, th, z, 12, 3.6, I, -Math.PI / 2 + delta); lines.push({ th, z0: z - 6, z1: z + 6, I });
  }
  interior(S, spec, lines); S.count('twist-lock pot segment', 3); S.pop();
  return { shift: 30, style: { pot: [.48, .56, .42], rough: .8 }, cam: { az: 28, el: 14, dist: .98, look: [0, 0, 180] } };
}

export const POTS = {};
[[1, 'Terra', P1], [2, 'Rings', P2], [3, 'Vase', P3], [4, 'Hex', P4], [5, 'Spiral', P5]].forEach(([i, name, fn]) => {
  POTS['P' + i] = { name, tile: TILE, build(S) { const r = fn(S); return { Ms: [0, 1, 2].map(k => T(0, 0, zk(k) + (r.shift || 0))), tile: TILE, cutX: 0, cam: r.cam, style: r.style }; } };
});
