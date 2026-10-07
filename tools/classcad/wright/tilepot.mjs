// Rev-3: SHARP, tile-shaped flowerpot / table lamp. The enclosure is the tile's own outline offset outward (sharp corners, no radii).
// One tall PCB (SiPM cells + electronics + every LED) sits just behind the SiPM edge; the only lit parts are the front "blade"
// (3 identical translucent light-guide blocks) and, on the lamp, a crown shade fed by the board's top LEDs. Each drum is a sealed
// tile chamber printed as two half-shells (front/rear) closed by M3; drums twist-lock; no rods, nuts or inserts.
import { Scene, T, Rz, Rx, Ry, I4, mul, offsetPoly, offsetVar, clipY, nrm, cross, frame } from './lib.mjs';
import fs from 'node:fs';
const TILES = JSON.parse(fs.readFileSync(new URL('./tiles.json', import.meta.url)));
const TT = 7, PITCH = 80, zk = k => 55 + PITCH * k, TOP = 258, WALL = 3.5, E = 32, STEP = 5;

export function tilePot(S, tileNo, form, ex = 0, cutaway = false) {
  const D = TILES[tileNo];
  const cx = D.hull.reduce((a, p) => a + p[0], 0) / 4, cy = D.hull.reduce((a, p) => a + p[1], 0) / 4;
  const Hr = D.hull.map(([x, y]) => [-(x - cx), -(y - cy)]);          // rotated 180 deg: the SiPM edge is the FRONT edge (index 2, y = -yt)
  const yt = D.ytop - cy, bx = -(D.sx - cx), pk = D.pocket;
  const rho = form === 'planter' ? .075 : form === 'lamp' ? .03 : 0;
  const o0 = form === 'lamp' ? 6 : 5;
  const stepW = k => form === 'stepped' ? 4 + 9 * k : 0;
  const oAt = (z, k) => o0 + rho * z + stepW(k);
  const poly = (o, off = 0) => offsetVar(Hr, [o + off, o + off, o + off + E, o + off]);
  const ringAt = (z, k, g, z0, z1, ey = 0, cuts = []) => {
    const o = oAt(z, k), mid = 0, big = poly(o), small = poly(o - WALL);
    const half = (sgn, shift) => { S.push(T(0, shift, 0)); S.ring(g, clipY(big, sgn * .3, sgn), clipY(small, sgn * 1.0 + 0 * mid, sgn), z0, z1, cuts); S.pop(); };
    S.push(T(0, 0, ex * 70 * k)); const win = [Scene.cutBox([36, 70, 76], [bx, -(yt + 25), zk(k)])];
    if (!cutaway) { S.push(T(0, ex * 110, 0)); S.ring(g, clipY(big, .3, 1), clipY(small, -1.0, 1), z0, z1); S.pop(); }
    S.push(T(0, -ex * 110, 0)); S.ring(g, clipY(big, -.3, -1), clipY(small, 1.0, -1), z0, z1, win); S.pop();
    S.pop();
  };
  // ---- drums: sliced for a smooth sharp-cornered taper (planter / lamp), or stepped ziggurat
  for (let k = 0; k < 3; k++) {
    const z0 = k ? zk(k) - 40 + .4 : 10, z1 = zk(k) + 40 - .4;
    if (form === 'stepped') { ringAt(zk(k), k, 'pot', z0, z1); ringAt(zk(k), k, 'pot2', z1 - 3, z1); }
    else for (let z = z0; z < z1 - 1e-6; z += STEP) ringAt(z + STEP / 2, k, 'pot', z, Math.min(z + STEP, z1));
    S.count('drum half (rear)'); S.count('drum half (front)');
    S.push(T(0, 0, ex * 70 * k));
    // 2x M3 closing screws per drum, one on each slanted side at the seam
    const out = poly(oAt(zk(k), k));
    for (const i of [1, 3]) { const a = out[i], b = out[(i + 1) % 4], t = (0 - a[1]) / (b[1] - a[1]), p = [a[0] + t * (b[0] - a[0]), 0], ang = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2 * (i === 1 ? -1 : 1) * -1;
      const nrmAng = Math.atan2(-(b[0] - a[0]), b[1] - a[1]);                      // outward normal angle (CCW polygon: right-hand normal)
      const nn = [Math.sin(Math.atan2(b[1] - a[1], b[0] - a[0])), -Math.cos(Math.atan2(b[1] - a[1], b[0] - a[0]))];
      S.cyl('hw', 5.5, 3, [p[0] + nn[0] * 1.5, p[1] + nn[1] * 1.5, zk(k)], mul(Rz(Math.atan2(nn[1], nn[0])), Ry(Math.PI / 2))); S.count('M3 cap screw'); }
    // tile (reclaimed) with its pocket, sealed in the drum
    S.push(T(0, 0, zk(k)));
    S.prism('tile', Hr, -TT / 2, TT / 2, [Scene.cutBox([pk.x1 - pk.x0, yt + 2 - (pk.y_floor - cy), 2 * TT], [-((pk.x0 + pk.x1) / 2 - cx), -((yt + 2 + pk.y_floor - cy) / 2), 0])]);
    S.box('dark', [16, 12, 10], [bx, -(yt + 1), 0]); S.pop(); S.count('scintillator tile (reclaimed)');
    for (const [x, y] of [[0.55, 0.55], [-0.55, 0.55]]) S.box('pot', [10, 8, 5], [x * 55, y * -60, zk(k) - 6]);   // tile ledges (printed in the shell)
    S.pop();
  }
  // ---- the single PCB + blade
  const yb = -(yt + 14), fy = yb - 1;
  S.push(T(0, -ex * 150, 0));
  S.box('pcb', [40, 1.6, 226], [bx, yb, 137]);
  for (let k = 0; k < 3; k++) { S.box('comp', [3, 1.5, 3], [bx, yb + 1.5, zk(k)]); S.box('comp', [14, 4, 8], [bx + 12, yb + 3, zk(k) + 14]); }
  S.box('comp', [18, 3, 25], [bx, yb + 2.4, 38]); S.box('comp', [10, 2, 10], [bx + 8, yb + 2, 60]); S.box('comp', [9, 3.2, 7.2], [bx, yb - 2.4, 26]);
  S.count('M3 cap screw', 6); S.pop();
  const phi = Math.atan(rho);
  for (let k = 0; k < 3; k++) {
    S.push(T(0, -ex * 110, ex * 70 * k));
    const yo = -(yt + oAt(zk(k), k) + E + 0.3), len = Math.abs(yo - fy), ym = (yo + fy) / 2;
    S.box('shade', [34, len, 74], [bx, ym, zk(k)], Rx(phi)); S.count('blade light-guide block');
    for (const sgn of [-1, 1]) S.box('dark', [2, len, 74], [bx + sgn * 18, ym, zk(k)], Rx(phi));
    const lvl = [14, 9, 16][k];
    for (let i = 0; i < 18; i++) { const I = i < lvl ? (i >= lvl - 2 ? 3 : (i > lvl - 7 ? 2 : 1)) : (i === 12 ? 2 : 0); S.box('led' + I, [26, 1.6, 2.4], [bx, fy - 1.2, zk(k) - 36 + i * 4.1 + 2]); S.count('LED (on the one PCB)'); }
    S.pop();
  }
  // ---- base / feet, lid (+ soil), crown shade for the lamp
  const oB = oAt(0, 0), baseP = poly(oB + 12), tl = ex * 70 * 3;
  if (form === 'lamp') {
    S.prism('pot', poly(oB + 4), 16, 26);
    for (const v of poly(oB - 4)) { S.push(T(v[0] * .8, v[1] * .8, 0)); S.box('pot', [16, 16, 16], [0, 0, 8]); S.pop(); }
  } else S.prism('pot', baseP, 0, 10);
  S.box('dark', [12, 12, 5], [bx, yb - 16, form === 'lamp' ? 20 : 4]); S.count('base');
  if (!cutaway) {
    S.push(T(0, 0, tl));
    const oT = oAt(TOP, 2);
    S.prism('pot', poly(oT + (form === 'planter' ? 5 : 0)), TOP - 4, TOP + 2);
    if (form === 'lamp') { for (let i = 0; i < 12; i++) S.ring('crown', poly(oT - 1 - i * 1.8), poly(oT - 3 - i * 1.8), TOP + 2 + i * 5, TOP + 7 + i * 5); S.prism('crown', poly(oT - 24), TOP + 62, TOP + 64); S.count('lit crown shade');
      for (let i = 0; i < 6; i++) S.box('led2', [26, 1.6, 2.4], [bx, fy - 1.2, zk(2) + 40 + i * 4.1]); S.box('shade', [34, 14, 30], [bx, yb - 8, TOP + 8]); }
    else { S.prism('soil', poly(oT - 4), TOP + 2, TOP + 8); S.prism('soil', poly(oT - 10), TOP + 8, TOP + 11); }
    S.count('lid'); S.pop();
  }
  S.count('M3 cap screw', 6);
  return { Ms: [0, 1, 2].map(k => T(0, 0, zk(k) + ex * 70 * k)), tile: tileNo, cutX: bx };
}

const mk = (key, name, tile, form, style, ex, cam, cut = false) => [key, { name, tile, build(S) { return { ...tilePot(S, tile, form, ex, cut), style, cam }; } }];
const CAM = { az: 150, el: 26, dist: 1.3, look: [0, 0, 120] };
export const TILEPOT = Object.fromEntries([
  mk('R1', 'TilePlanter', 10, 'planter', { pot: [.62, .29, .17], rough: .9 }, 0, CAM),
  mk('R2', 'TileLamp', 10, 'lamp', { pot: [.06, .06, .07], rough: .35 }, 0, { ...CAM, dist: 1.45, look: [0, 0, 150] }),
  mk('R3', 'TileStepped', 10, 'stepped', { pot: [.42, .46, .4], rough: .8 }, 0, CAM),
  mk('R4', 'TileExploded', 10, 'planter', { pot: [.62, .29, .17], rough: .9 }, 1, { az: 150, el: 20, dist: 1.5, look: [0, -20, 170] }),
  mk('R5', 'TileCutaway', 10, 'planter', { pot: [.62, .29, .17], rough: .9 }, 0, { az: 12, el: 30, dist: 1.2, look: [0, 0, 120] }, true),
]);
