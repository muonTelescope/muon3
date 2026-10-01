// Five Frank-Lloyd-Wright-inspired detector layouts. Every detector = THREE IDENTICAL sPHENIX tiles (same shape, registered in plan,
// 100 mm apart) so the triple-coincidence overlap is 100 % for a vertical track. Everything except tile / PCB / SiPM / LEDs / fiber / wire
// is 3D-printed, and every joint is M3 cap screw + hex nut (captive nut traps in the holder floors).
import { Scene, T, Rz, Rx, Ry, I4, mul, pt, dir, frame, offsetPoly, rayHit, sub, add, sc, nrm } from './lib.mjs';
import fs from 'node:fs';
const TILES = JSON.parse(fs.readFileSync(new URL('./tiles.json', import.meta.url)));
const TT = 7, GAP = 100;

/** Panel holder = tray (floor ring + nut traps) + wall ring (LED strip bay) + bezel ring, split at y=0 into two printable halves,
 *  plus the SiPM/PCB pod on the top edge. Local origin = tile centroid, z = 0 at tile mid-plane. Returns local anchor info. */
export function panel(S, tileNo, explode = 0) {
  const D = TILES[tileNo];
  const cx = D.hull.reduce((a, p) => a + p[0], 0) / 4, cy = D.hull.reduce((a, p) => a + p[1], 0) / 4;
  const H = D.hull.map(([x, y]) => [x - cx, y - cy]);
  const yt = D.ytop - cy, yb = -cy, sx = D.sx - cx;
  const O = d => offsetPoly(H, d), O3 = O(-3), O23 = O(2.3), O13 = O(13), O17 = O(17), O75 = O(7.5), Ol = O(0.5), Ol2 = O(2.0);
  const ex = explode;
  // tile (the reclaimed scintillator): hull prism minus the SiPM pocket, as in the existing tile model
  const pk = D.pocket;
  S.push(T(0, 0, ex * 0.5));
  S.prism('tile', H, -TT / 2, TT / 2, [Scene.cutBox([pk.x1 - pk.x0, yt + 2 - (pk.y_floor - cy), 2 * TT], [(pk.x0 + pk.x1) / 2 - cx, (yt + 2 + pk.y_floor - cy) / 2, 0])]);
  S.count('scintillator tile (reclaimed)');
  // coupler + SiPM envelope
  S.box('dark', [16, 20, 10], [sx, yt - 1, 0]);
  S.box('comp', [3, 1.5, 3], [sx, yt + 10, 0]);
  // LED strips (3 sides; the SiPM side is left clear), 5 mm warm-white strip standing on the wall's inner face
  for (const i of [0, 1, 3]) {
    const a = Ol[i], b = Ol[(i + 1) % 4], c = Ol2[(i + 1) % 4], d = Ol2[i];
    const L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    S.prism('led', [L(a, b, .05), L(a, b, .95), L(d, c, .95), L(d, c, .05)], -2.5, 2.5); S.count('LED strip (5 mm, edge-lit)');
  }
  // wall ring with the SiPM-edge notch
  const notch = Scene.cutBox([46, 26, 16], [sx, yt + 6, 1.5]);
  S.prism('dark', O13, 0, 0); S.prims.pop();
  S.ring('dark', O13, O23, -3.5, 3.5, [notch]);
  S.ring('led', O(14.6), O13, -3.0, 3.0, [notch, Scene.cutBox([700, 0.6, 30], [0, 0, 0])]); S.count('LED light band (outer wall)');
  S.pop();
  S.push(T(0, 0, ex * 1.0));
  S.ring('red', O13, O3, 3.5, 6.5, [notch]); S.ring('red', O17, O13, 4.7, 6.5, [notch]);
  S.pop();
  const seam = Scene.cutBox([700, 0.6, 30], [0, 0, 0]);
  S.ring('red', O13, O3, -6.5, -3.5, [seam]); S.ring('red', O17, O13, -6.5, -4.8, [seam]);
  // seam splices (bezel straps) where the y=0 cut crosses the left/right walls
  const straps = [];
  for (const i of [1, 3]) {
    const a = O75[i], b = O75[(i + 1) % 4], t = (0 - a[1]) / (b[1] - a[1]), p = [a[0] + (b[0] - a[0]) * t, 0];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    S.push(T(0, 0, ex * 1.0));
    S.box('red', [36, 14, 2.4], [p[0], 0, 7.7], Rz(ang));
    for (const s of [-1, 1]) { const q = [p[0] + s * 11 * Math.cos(ang), s * 11 * Math.sin(ang)]; S.screw(q[0], q[1], 8.9, 8); S.nut(q[0], q[1], -6.5); }
    S.pop(); S.count('bezel splice strap');
  }
  // 12 clamp screws M3x16 + captive nuts
  const spots = [];
  for (const i of [0, 1, 3]) for (const t of [.22, .78]) spots.push([i, t]);
  spots.push([2, .07], [2, .93], [1, .5 + 0.0001], [3, .5 + 0.0001]);
  for (const [i, t] of spots.slice(0, 8)) {
    const a = O75[i], b = O75[(i + 1) % 4], q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    S.push(T(0, 0, ex * 1.0)); S.screw(q[0], q[1], 9.5, 16); S.pop(); S.nut(q[0], q[1], -6.5);
  }
  // detector pod on the SiPM edge: PCB 60x45 on 3 mm standoffs, smoke lid with 4 M3
  const podY = yt + 8 + 25.5;
  pod(S, sx, podY, -6.5, 66, 51, 60, 45, 'det', ex);
  S.push(T(0, 0, 0)); S.box('red', [66, 14, 3], [sx, yt + 8 - 4, -5]); S.pop(); // floor tongue ties pod to tray
  const xlo = Math.max(H[0][0], H[3][0]) + 6, xhi = Math.min(H[1][0], H[2][0]) - 6, xc = (xlo + xhi) / 2;
  return { H, yb, yt, sx, xc, xlen: xhi - xlo, podBack: yt + 8 + 51, podY, cx, cy, hull: H, sipmX: sx, fiber: D.fiber.map(([x, y]) => [x - cx, y - cy]), O3, O13, O17 };
}

function pod(S, cx, cy, z0, w, d, pw, pd, kind, ex = 0) {
  S.box('red', [w, d, 3], [cx, cy, z0 + 1.5]);
  const t = 3, h = 17.5;
  for (const [sx, sy, X, Y] of [[w, t, 0, d / 2 - t / 2], [w, t, 0, -d / 2 + t / 2], [t, d - 2 * t, w / 2 - t / 2, 0], [t, d - 2 * t, -w / 2 + t / 2, 0]])
    S.box('dark', [sx, sy, h - 3], [cx + X, cy + Y, z0 + 3 + (h - 3) / 2]);
  S.box('pcb', [pw, pd, 1.6], [cx, cy, z0 + 6.8]);
  const zc = z0 + 7.6;
  if (kind === 'det') {
    S.box('comp', [21, 5, 8.5], [cx, cy + pd / 2 - 5, zc + 4.25]);          // IDC header
    S.box('comp', [8, 8, 1.6], [cx - 12, cy - 4, zc + .8]); S.box('comp', [6, 4, 3], [cx + 18, cy - 12, zc + 1.5]);
    for (let i = 0; i < 5; i++) S.box('comp', [2, 1.2, .7], [cx - 22 + 4 * i, cy + 10, zc + .35]);
  } else {
    S.box('comp', [18, 25, 3], [cx - 20, cy + 14, zc + 1.5]); S.box('comp', [9, 7, 3.2], [cx - pw / 2 + 4, cy - 14, zc + 1.6]);
    for (let i = 0; i < 3; i++) S.box('comp', [21, 5, 8.5], [cx + 22, cy - 22 + 18 * i, zc + 4.25]);
    S.box('comp', [10, 10, 1.6], [cx + 5, cy - 4, zc + .8]);
  }
  S.push(T(0, 0, ex * 1.8));
  S.box('lid', [w, d, 2.5], [cx, cy, z0 + h + 1.25]);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.screw(cx + sx * (w / 2 - t / 2), cy + sy * (d / 2 - t / 2), z0 + h + 2.5, 14);
  S.pop();
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.nut(cx + sx * (w / 2 - t / 2), cy + sy * (d / 2 - t / 2), z0 + 3 - 2.4 + 0.5);
  S.count(kind === 'det' ? 'detector PCB pod' : 'controller pod');
}

/** printed beam from p0 to p1 (w wide, h high), split into <=210 mm pieces joined by splice plates with M3 */
function beam(S, g, p0, p1, w, h, up = [0, 0, 1], seg = 210) {
  const d = nrm(sub(p1, p0)), L = Math.hypot(...sub(p1, p0)), n = Math.max(1, Math.ceil(L / seg)), step = L / n;
  for (let i = 0; i < n; i++) {
    const a = add(p0, sc(d, i * step + (i ? .3 : 0))), b = add(p0, sc(d, (i + 1) * step - (i < n - 1 ? .3 : 0)));
    const F = frame(sc(add(a, b), .5), d, up); S.push(F); S.box(g, [Math.hypot(...sub(b, a)), w, h], [0, 0, 0]); S.pop();
  }
  for (let i = 1; i < n; i++) {
    const F = frame(add(p0, sc(d, i * step)), d, up); S.push(F);
    S.box(g, [46, w + 4, 2.5], [0, 0, h / 2 + 1.25]);
    for (const a of [-15, 15]) for (const b of [-w / 4, w / 4]) { S.cyl('hw', 5.5, 3, [a, b, h / 2 + 4]); S.cyl('hw', 3, 12, [a, b, h / 2 - 4]); S.count('M3 cap screw'); S.hex('hw', 3.18, -h / 2 - 2.4, -h / 2); }
    S.pop(); S.count('beam splice plate');
  }
  S.count('printed beam');
}

/** stone masonry courses (alternating raked joints), body + projecting band per course */
function masonry(S, cx, cy, z0, w, d, h, rng, { course = 24, splitY = false, front = null } = {}) {
  const n = Math.floor(h / course);
  for (let i = 0; i < n; i++) {
    const z = z0 + i * course, pr = [0, 0, 0, 0, 3, 5][Math.floor(rng() * 6)];
    const fy = front ? front(z + course / 2) : 0;
    const parts = splitY ? [[cy - d / 4 + fy / 2, d / 2 + fy]] : [[cy + fy / 2, d + fy]];
    const pieces = splitY ? [[-1], [1]] : [[0]];
    for (const [s] of pieces) {
      const dd = splitY ? d / 2 - .4 : d + fy, yc = splitY ? cy + s * (d / 4 + .2) : cy - fy / 2;
      S.box('stone', [w - 3, dd - 3, course - 4], [cx, yc, z + (course - 4) / 2]);
      S.box('stone', [w + pr, dd + pr, 4], [cx, yc, z + course - 2]);
      S.count('masonry block', 2);
    }
  }
  return n * course;
}
function slab(S, cx, cy, w, d, z0, t) {            // plinth plate in 4 printable quadrants
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) S.box('stone', [w / 2 - .4, d / 2 - .4, t], [cx + sx * (w / 4 + .2), cy + sy * (d / 4 + .2), z0 + t / 2]);
  S.count('plinth quadrant', 4);
}
function controller(S, x, y, z0) {
  pod(S, x, y, z0, 106, 86, 100, 80, 'ctl');
  S.cyl('dark', 7, 6, [x + 40, y - 30, z0 + 23.5]); S.cyl('dark', 5, 90, [x + 40, y - 30, z0 + 70]); S.count('external antenna');
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** place three registered panels: callback(k, S, info) after pushing the panel matrix */
function stack(S, tile, Ms, per) {
  const infos = [];
  Ms.forEach((M, k) => { S.push(M); const info = panel(S, tile); infos.push(info); per?.(k, info, M); S.pop(); });
  return infos;
}
const panelWire = (S, M, info, target) => { const p0 = pt(M, [info.sx, info.podBack, 1]); S.wires.push([p0, ...target(p0)]); };

export const LAYOUTS = {
  // ---------------------------------------------------------------- A  Fallingwater: stone core, three cantilevered terraces
  A: { name: 'Fallingwater', tile: 7, build(S) {
    const rng = mulberry(7), tile = 7;
    slab(S, 0, 100, 440, 440, 0, 14); slab(S, 0, 20, 300, 200, 14, 10);
    const coreTop = masonry(S, 0, 0, 24, 130, 80, 408, rng);
    const Y0 = 232, zs = [160, 260, 360];
    const Ms = zs.map(z => mul(T(0, Y0, z), Rz(Math.PI)));
    const infos = stack(S, tile, Ms, (k, info, M) => {});
    Ms.forEach((M, k) => {
      const info = infos[k];
      for (const sx of [-22, 22]) beam(S, 'wood', pt(M, [info.xc + sx, info.yb - 8, -15.5]), pt(M, [info.xc + sx, Y0 - 24, -15.5]), 14, 12);
      S.push(M); S.box('wood', [info.xlen + 12, 16, 6], [info.xc, info.yb - 5, -9.5]); S.box('wood', [info.xlen + 12, 16, 6], [info.xc, info.yt + 5, -9.5]); S.pop(); S.count('cross bearer', 2);
      panelWire(S, M, info, p0 => [add(p0, [0, -14, 0]), [p0[0], 42, p0[2] - 6], [p0[0], 30, p0[2] - 6]]);
    });
    controller(S, -150, 150, 14);
    return { Ms, tile, cam: { az: 28, el: 20, dist: 1.25, look: [0, 130, 215] } };
  } },
  // ---------------------------------------------------------------- B  Guggenheim: drum + ramp (pitch 100 mm = panel spacing)
  B: { name: 'Guggenheim', tile: 10, build(S) {
    const rng = mulberry(3), tile = 10;
    slab(S, 0, 130, 460, 480, 0, 14);
    const R0 = 46; for (let i = 0; i < 17; i++) { S.cyl('stone', 2 * R0 - 4, 20, [0, 0, 24 + i * 24 + 10]); S.cyl('stone', 2 * R0 + (i % 5 == 3 ? 8 : 0), 4, [0, 0, 24 + i * 24 + 22]); S.count('drum course', 2); }
    const Y0 = 262, zs = [160, 260, 360];
    const Ms = zs.map(z => mul(T(0, Y0, z), Rz(Math.PI)));
    // ramp: pitch 100 mm per turn; at the panel azimuth (+y) it passes 50 mm under each tray
    const N = 40, u0 = -(100 - 24 - 5) / 100, u1 = 3.05, rr = 60, rw = 28;
    for (let i = 0; i < Math.round((u1 - u0) * N); i++) {
      const u = u0 + (i + .5) / N, th = Math.PI / 2 + u * 2 * Math.PI, z = 100 + u * 100;
      const tang = [-Math.sin(th), Math.cos(th), 100 / (2 * Math.PI * rr)], F = frame([rr * Math.cos(th), rr * Math.sin(th), z], tang);
      S.push(F); S.box('red', [2 * Math.PI * rr / N * 1.06, rw, 5], [0, 0, 0]); S.box('led', [2 * Math.PI * rr / N * .98, 2, 3], [0, rw / 2 + 1, 2.5]); S.pop();
      S.count('ramp segment'); if (i % 3 == 0) S.count('M3 cap screw');
    }
    const infos = stack(S, tile, Ms, null);
    Ms.forEach((M, k) => {
      const info = infos[k];
      for (const sx of [-22, 22]) beam(S, 'wood', pt(M, [info.xc + sx, info.yb - 8, -15.5]), pt(M, [info.xc + sx, Y0 - 38, -15.5]), 14, 12);
      S.push(M); S.box('wood', [info.xlen + 12, 16, 6], [info.xc, info.yb - 5, -9.5]); S.box('wood', [info.xlen + 12, 16, 6], [info.xc, info.yt + 5, -9.5]); S.pop(); S.count('cross bearer', 2);
      panelWire(S, M, info, p0 => [add(p0, [0, -14, 0]), [p0[0], 50, p0[2] - 6]]);
    });
    controller(S, -170, 190, 14);
    return { Ms, tile, cam: { az: 40, el: 18, dist: 1.3, look: [0, 150, 215] } };
  } },
  // ---------------------------------------------------------------- C  Robie House: two long masonry piers, roof-plane beams, deep eaves
  C: { name: 'Robie', tile: 9, build(S) {
    const rng = mulberry(11), tile = 9;
    const Xi = 168, zs = [150, 250, 350];
    slab(S, 0, 0, 640, 440, 0, 14);
    for (const sx of [-1, 1]) masonry(S, sx * (Xi + 25), 0, 14, 50, 300, 384, rng, { splitY: true });
    const Ms = zs.map(z => T(0, 0, z));
    const infos = stack(S, tile, Ms, null);
    Ms.forEach((M, k) => {
      const info = infos[k];
      for (const [yy] of [[info.yb - 5], [info.yt + 5]]) beam(S, 'wood', pt(M, [-(Xi + 60) - 40, yy, -15.5]), pt(M, [Xi + 60 + 40, yy, -15.5]), 16, 12);
      panelWire(S, M, info, p0 => [[p0[0], p0[1] + 14, p0[2] - 6], [Xi, p0[1] + 14, p0[2] - 6]]);
      S.count('roof-plane beam pair');
    });
    controller(S, 0, -130, 14);
    return { Ms, tile, cam: { az: 32, el: 16, dist: 1.2, look: [0, 0, 220] } };
  } },
  // ---------------------------------------------------------------- D  Hanna "honeycomb": three hexagonal piers at 120 deg, spokes + collars
  D: { name: 'Hanna', tile: 4, build(S) {
    const rng = mulberry(5), tile = 4, zs = [160, 260, 360];
    const Rp = 196, betas = [90, 210, 330].map(a => a * Math.PI / 180);
    slab(S, 0, 0, 520, 520, 0, 14);
    const Ms = zs.map(z => T(0, 0, z));
    for (const b of betas) for (let i = 0; i < 16; i++) { S.push(T(Rp * Math.cos(b), Rp * Math.sin(b), 0)); S.hex('stone', 24 - .8, 14 + i * 24, 14 + i * 24 + 20, i % 2 ? Math.PI / 6 : 0); S.hex('stone', 26.5 + (i % 4 == 2 ? 3 : 0), 14 + i * 24 + 20, 14 + i * 24 + 24, i % 2 ? Math.PI / 6 : 0); S.pop(); S.count('hex course', 2); }
    const infos = stack(S, tile, Ms, null);
    Ms.forEach((M, k) => {
      const info = infos[k], z = zs[k];
      for (const b of betas) { S.push(T(Rp * Math.cos(b), Rp * Math.sin(b), z)); S.hex('red', 31, -7, 7); S.screw(0, 0, 10, 8); for (const a of [0, 2, 4]) S.screw(27 * Math.cos(a * Math.PI / 3 + .5), 27 * Math.sin(a * Math.PI / 3 + .5), 7 + 3, 8); S.pop(); S.count('pier collar'); }
      for (const b of betas.slice(1)) {
        const r0 = rayHit(info.O17, b) - 4, r1 = Rp - 20;
        S.push(M); beam(S, 'wood', [r0 * Math.cos(b), r0 * Math.sin(b), -11], [r1 * Math.cos(b), r1 * Math.sin(b), -11], 20, 8); S.pop();
      }
      S.push(M); S.box('red', [66, 30, 3], [info.sx, info.podBack + 8, -5]); S.pop(); S.count('pod tongue');
      panelWire(S, M, info, p0 => [[p0[0], p0[1] + 6, p0[2] - 4], [p0[0], Rp - 28, p0[2] - 4]]);
    });
    controller(S, 0, -200, 14);
    return { Ms, tile, cam: { az: 30, el: 22, dist: 1.25, look: [0, 0, 215] } };
  } },
  // ---------------------------------------------------------------- E  Taliesin West: battered stone wall, tilted redwood-style trusses
  E: { name: 'Taliesin', tile: 5, build(S) {
    const rng = mulberry(9), tile = 5, pitch = -16 * Math.PI / 180, zs = [170, 270, 370];
    slab(S, 0, 90, 460, 460, 0, 14);
    const Ms = zs.map(z => mul(T(0, 0, z), Rx(pitch)));
    const infos = stack(S, tile, Ms, null);
    const pb = pt(Ms[0], [0, infos[0].podBack, -6.5]), yw = pb[1] + 30;
    masonry(S, 0, yw + 60, 14, 340, 120, 408, rng, { splitY: false, front: z => Math.max(0, 70 - Math.max(0, z - 14) * .35) * 0 });
    for (const sx of [-1, 1]) masonry(S, sx * 190, yw + 60, 14, 50, 120, 408, rng);
    Ms.forEach((M, k) => {
      const info = infos[k];
      for (const sx of [-22, 22]) beam(S, 'wood', pt(M, [info.xc + sx, info.yb - 8, -15.5]), pt(M, [info.xc + sx, info.podBack + 34, -15.5]), 14, 12);
      S.push(M); S.box('wood', [info.xlen + 12, 16, 6], [info.xc, info.yb - 5, -9.5]); S.box('wood', [info.xlen + 12, 16, 6], [info.xc, info.yt + 5, -9.5]); S.pop(); S.count('cross bearer', 2);
      panelWire(S, M, info, p0 => [add(p0, [0, 10, -2]), [p0[0], yw + 2, p0[2] - 6]]);
    });
    controller(S, -120, -10, 14);
    return { Ms, tile, cam: { az: 32, el: 18, dist: 1.5, look: [0, 40, 190] } };
  } },
};
