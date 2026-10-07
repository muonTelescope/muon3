// "Prairie Lantern": ONE freestanding, fully enclosed art-lamp that is also a three-panel muon detector.
//   * three IDENTICAL sPHENIX tiles, registered, 100 mm apart, each sealed in its own opaque printed box (floor / wall ring / lid)
//   * between the boxes: sealed lamp bays (corner pillars + frosted shade panels with a Wright-style mullion pattern + LED strips).
//     The LEDs live only in the bays, behind the opaque module plates, so they cannot light the scintillator.
//   * a hollow masonry "chimney" spine behind the SiPM edge holds the three detector PCBs, the antenna and the cable run;
//     the controller + LED driver + USB-C live in the hollow base. Nothing electronic is exposed.
//   * assembly = 4 M3 threaded tie-rods + nuts through pillars/boxes, 4 M3 rods through the spine corners, M3 nuts in the base floor.
import { Scene, T, Rz, Rx, I4, mul, pt, offsetPoly, sub, add } from './lib.mjs';
import fs from 'node:fs';
const TILES = JSON.parse(fs.readFileSync(new URL('./tiles.json', import.meta.url)));
const TT = 7;
const rect = (cx, cy, w, d) => [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2]];

export function lamp(S, tileNo, ex = 0) {
  const D = TILES[tileNo];
  const cx = D.hull.reduce((a, p) => a + p[0], 0) / 4, cy = D.hull.reduce((a, p) => a + p[1], 0) / 4;
  const H = D.hull.map(([x, y]) => [x - cx, y - cy]), yt = D.ytop - cy, sx = D.sx - cx, pk = D.pocket;
  const O = d => offsetPoly(H, d);
  const Oin = O(1.0), Owall = O(5.0), Op = O(6.2), Oe = O(12.5), Oled1 = O(3.2), Oled0 = O(1.6);
  const LIFT = l => ex * 80 * l;
  const ZB = 70, z = k => 79 + 100 * k, top = z(3) - 9;          // base top, module centres, crown-bay top (370)
  const spineY0 = yt + 5, SW = 80, SD = 66, spineCy = spineY0 + SD / 2;
  const notchAt = (zc, h) => Scene.cutBox([SW + 4, 9.5, h], [sx, yt + 9.25, zc]);
  const notch = notchAt(0, 60);
  const lift = l => { S.push(T(0, 0, LIFT(l))); };

  // ------------------------------------------------------------------ base: hollow plinth + spine foot
  S.push(T(0, 0, 0));
  S.prism('red', Oe, 0, 4, [notchAt(2, 20)]);
  for (const v of Op) { S.push(T(v[0], v[1], 0)); S.nut(0, 0, 0); S.pop(); }
  S.ring('stone', Oe, O(8.5), 4, ZB - 4, [notchAt(35, 80)]);
  S.prism('red', Oe, ZB - 4, ZB, [notchAt(ZB - 2, 12)]);
  // controller + LED driver inside the plinth
  S.box('pcb', [100, 80, 1.6], [0, 20, 12]); S.box('comp', [18, 25, 3], [-20, 35, 14]); S.box('comp', [30, 20, 12], [30, 10, 18]);
  S.box('comp', [9, 7.2, 3.2], [0, yt + 60 - 20, 14]);
  S.count('base plinth'); S.pop();
  // spine foot (hollow) behind the plinth, with a USB-C opening in its back wall
  const foot = (g, zb, zt) => {
    S.box(g, [SW, 4, zt - zb], [sx, spineY0 + 2, (zb + zt) / 2]);
    S.box(g, [SW, 4, zt - zb], [sx, spineY0 + SD - 2, (zb + zt) / 2], I4(), g === 'stone' && zb < 5 ? [Scene.cutBox([10, 8, 4], [sx, spineY0 + SD - 2, 20])] : []);
    for (const s of [-1, 1]) S.box(g, [4, SD - 8, zt - zb], [sx + s * (SW / 2 - 2), spineCy, (zb + zt) / 2]);
  };
  foot('stone', 4, ZB); S.box('red', [SW + 16, SD + 16, 4], [sx, spineCy, 2]); S.count('spine foot');
  S.box('comp', [9, 3.2, 3.2], [sx, spineY0 + SD - 2, 20]);       // USB-C receptacle seen in the back wall

  // ------------------------------------------------------------------ three sealed detector modules + lamp bays
  const rods = Op;
  for (let k = 0; k < 3; k++) {
    const zk = z(k); lift(2 * k); S.push(T(0, 0, zk));
    S.push(T(0, 0, -ex * 22)); S.prism('red', Oe, -9, -6, [notch]); S.pop();   // floor plate (eave)
    S.ring('dark', Owall, Oin, -6, 6, [Scene.cutBox([14, 10, 8], [sx, yt + 3, 0])]);   // wall ring + coax slot
    for (const v of Op) { S.push(T(v[0], v[1], 0)); S.hex('dark', 4.4, -6, 6); S.pop(); }
    S.push(T(0, 0, ex * 22)); S.prism('red', Oe, 6, 9, [notch]); S.pop();      // lid plate (eave)
    S.prism('tile', H, -TT / 2, TT / 2, [Scene.cutBox([pk.x1 - pk.x0, yt + 2 - (pk.y_floor - cy), 2 * TT], [(pk.x0 + pk.x1) / 2 - cx, (yt + 2 + pk.y_floor - cy) / 2, 0])]);
    S.count('scintillator tile (reclaimed)');
    S.box('dark', [16, 12, 10], [sx, yt - 3, 0]); S.box('comp', [3, 1.5, 3], [sx, yt + 2.5, 0]);
    for (const q of Oin) { const c = [q[0] * .9, q[1] * .9]; S.box('dark', [8, 8, 2.5], [c[0], c[1], -4.75]); }  // tile pads
    S.count('sealed detector module (floor+wall+lid)'); S.pop(); S.pop();
    // lamp bay above module k
    const lvl = 2 * k + 1, zlo = zk + 9, zhi = z(k + 1) - 9, hh = zhi - zlo;
    lift(lvl);
    for (const v of Op) { S.push(T(v[0], v[1], 0)); S.hex('stone', 4.4, zlo, zhi); S.pop(); S.count('corner pillar'); }
    S.ring('led', Oled1, Oled0, zlo, zlo + 1.5); S.ring('led', Oled1, Oled0, zhi - 1.5, zhi); S.count('LED strip ring', 2);
    for (let i = 0; i < 4; i++) {
      const a = Op[i], b = Op[(i + 1) % 4], e = [b[0] - a[0], b[1] - a[1]], len = Math.hypot(...e), u = [e[0] / len, e[1] / len], nrm = [u[1], -u[0]];
      const ang = Math.atan2(e[1], e[0]), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L = len - 8.4;
      S.push(T(mid[0], mid[1], (zlo + zhi) / 2)); S.push(Rz(ang));
      S.box('shade', [L, 1.6, hh], [0, 0, 0]); S.count('frosted shade panel');
      for (const t of [-.3, 0, .3]) S.box('dark', [3, 0.8, hh - 10], [t * L, 1.2, 0]);          // mullions
      for (const h of [-.2, .22]) S.box('dark', [L - 6, 0.8, 3], [0, 1.2, h * hh]);              // rails
      S.pop(); S.pop();
    }
    S.pop();
  }
  // ------------------------------------------------------------------ crown
  lift(6);
  S.prism('red', Oe, top, top + 6, [notchAt(top + 3, 12)]); S.prism('red', O(-8), top + 6, top + 12); S.prism('red', O(-38), top + 12, top + 18);
  S.hex('stone', 9, top + 18, top + 32); S.count('crown');
  for (const v of Op) { S.push(T(v[0], v[1], 0)); S.nut(0, 0, top); S.pop(); }
  S.pop();
  // ------------------------------------------------------------------ chimney spine: 3 hollow masonry segments (one per detector level)
  for (let k = 0; k < 3; k++) {
    const zb = ZB + 100 * k, zt = zb + 100, zk = z(k); S.push(T(0, 0, LIFT(2 * k + 0.5)));
    foot('stone', zb, zt);
    for (const j of [1, 2, 3]) S.ring('stone', rect(sx, spineCy, SW + 4, SD + 4), rect(sx, spineCy, SW, SD), zb + j * 25 - 2, zb + j * 25 + 2);
    S.box('stone', [SW - 8, 3, 3], [sx, spineY0 + 5, zk - 6]);
    S.box('pcb', [60, 45, 1.6], [sx, spineY0 + 32, zk - 2]);
    S.box('comp', [21, 5, 8.5], [sx, spineY0 + 32 + 17, zk + 3.2]); S.box('comp', [8, 8, 1.6], [sx - 12, spineY0 + 30, zk - 1]);
    for (const s of [-1, 1]) S.box('stone', [3, SD - 10, 3], [sx + s * (SW / 2 - 5.5), spineCy, zk - 5.5]);
    S.count('spine segment + detector PCB'); S.pop();
  }
  S.push(T(0, 0, LIFT(6)));
  foot('stone', top - 30, top);  S.box('comp', [10, 10, 40], [sx, spineCy, top - 15]);                  // antenna inside the top segment
  S.prism('red', rect(sx, spineCy, SW + 16, SD + 16), top, top + 6); S.count('spine cap + antenna'); S.pop();
  // ------------------------------------------------------------------ M3 hardware: 4 tower tie rods, 4 spine rods
  const rodTop = top + 6 + LIFT(6) + (ex ? 12 : 0);
  for (const v of Op) { S.cyl('hw', 3, rodTop, [v[0], v[1], rodTop / 2]); S.count('M3 threaded rod'); }
  for (const sxx of [-1, 1]) for (const syy of [-1, 1]) {
    const x = sx + sxx * (SW / 2 - 2), y = spineCy + syy * (SD / 2 - 2); S.cyl('hw', 3, rodTop - 20, [x, y, (rodTop - 20) / 2 + 2]); S.count('M3 threaded rod');
  }
  // coax runs and harness (drawn by the renderer)
  for (let k = 0; k < 3; k++) S.wires.push([[sx, yt + 2.5, z(k)], [sx, yt + 8, z(k)], [sx, spineY0 + 18, z(k) - 2]]);
  return { Ms: [0, 1, 2].map(k => T(0, 0, z(k) + LIFT(2 * k))), tile: tileNo, cutX: sx };
}

export const LAMP = {
  L: { name: 'Lantern', tile: 7, build(S) { const r = lamp(S, 7, 0); return { ...r, cam: { az: 150, el: 12, dist: 1.6, look: [20, 40, 205] } }; } },
  X: { name: 'LanternExploded', tile: 7, build(S) { const r = lamp(S, 7, 1); return { ...r, cam: { az: 150, el: 16, dist: 1.5, look: [20, 40, 400] } }; } },
};
