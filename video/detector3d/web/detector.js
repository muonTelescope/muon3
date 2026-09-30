// Muon3 detector model in three.js: the tile stack, frame, plate bars, case, board and cables from hw/case/assembly.py,
// animated as the seven steps of the assembly guide (timing = the narration of video/assembly-guide).
// Deterministic: window.renderFrame(t, fmt) draws global time t (seconds) and returns the base64 image.
import * as THREE from 'three';
import { STLLoader } from '../vendor/STLLoader.js';

// ---- timing (must match video/assembly-guide/src/lib.rs)
const VO = [17.6, 14.4, 14.64, 10.24, 14.16, 16.0, 19.52];
const LEAD = 0.6, TAIL = 0.5;
const dur = i => VO[i] + LEAD + TAIL;
const start = i => VO.slice(0, i).reduce((a, _, k) => a + dur(k), 0);
const sceneAt = t => { for (let i = 6; i >= 0; i--) if (t >= start(i)) return i; return 0; };

// ---- gLowCost palette
const C = { ground: 0x120E1A, panel: 0x1C1628, raised: 0x261E35, hair: 0x3A2F4F, edge: 0x5E4A93, ink: 0xEEE9F5, muted: 0xA89CBF,
  violet: 0x9B7BFF, lilac: 0xC9B6FF, phos: 0x5BE3A0, mint: 0xA6F5CF };

const q = new URLSearchParams(location.search);
const W = +(q.get('w') || 990), H = +(q.get('h') || 1170);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.setClearColor(C.ground, 1);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(C.ground, 900, 2000);
const camera = new THREE.PerspectiveCamera(28, W / H, 10, 4000);
camera.up.set(0, 0, 1);
scene.add(new THREE.HemisphereLight(0xC9B6FF, 0x120E1A, 1.25));
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(500, 700, 900); scene.add(key);
const rim = new THREE.DirectionalLight(0x9B7BFF, 1.6); rim.position.set(-600, -400, 300); scene.add(rim);
const fill = new THREE.DirectionalLight(0x5BE3A0, 0.35); fill.position.set(0, 800, -300); scene.add(fill);

// ---- materials per part
function look(name, group) {
  const m = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.55, metalness: 0.05 }, o));
  if (/_Body$/.test(name)) return m({ color: C.violet, transparent: true, opacity: 0.2, roughness: 0.25, depthWrite: false, side: THREE.DoubleSide });
  if (/_Fiber$/.test(name)) return m({ color: C.phos, emissive: C.phos, emissiveIntensity: 0.9, roughness: 0.3 });
  if (/_Coating$/.test(name)) return m({ color: C.ink, transparent: true, opacity: 0.22, depthWrite: false });
  if (/_WrapAl$/.test(name)) return m({ color: C.lilac, transparent: true, opacity: 0.24, metalness: 0.6, depthWrite: false });
  if (/_WrapCling$/.test(name)) return m({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false });
  if (/_WrapVinyl$/.test(name)) return m({ color: C.panel, transparent: true, opacity: 0.55, depthWrite: false });
  if (/_Coupler$/.test(name)) return m({ color: C.panel, roughness: 0.6 });
  if (/_SiPM$/.test(name)) return m({ color: C.phos, emissive: C.phos, emissiveIntensity: 0.6 });
  if (/_SiPM_PCB$/.test(name)) return m({ color: C.edge, roughness: 0.5 });
  if (/_UFL$|Plug/.test(name)) return m({ color: C.muted, metalness: 0.7, roughness: 0.35 });
  if (/^Rod|^Nut/.test(name)) return m({ color: 0xC9C0DC, metalness: 0.35, roughness: 0.35, emissive: 0x2a2240, emissiveIntensity: 0.4 });
  if (/^Clip|^Spacer/.test(name)) return m({ color: C.ink, roughness: 0.7 });
  if (/^PlateBar/.test(name)) return m({ color: 0xD9CDF5, roughness: 0.7 });
  if (/Insert/.test(name)) return m({ color: 0xE0B060, metalness: 0.8, roughness: 0.3 });
  if (/Screw/.test(name)) return m({ color: C.muted, metalness: 0.85, roughness: 0.3 });
  if (/^Case_Base/.test(name)) return m({ color: 0xD9CDF5, roughness: 0.7, transparent: true, opacity: 1 });
  if (/^Case_Lid/.test(name)) return m({ color: C.ink, roughness: 0.65, transparent: true, opacity: 1 });
  if (/^PCB$/.test(name)) return m({ color: 0x2C2444, roughness: 0.45, metalness: 0.2 });
  if (/^Cable/.test(name)) return m({ color: C.lilac, roughness: 0.4 });
  if (/^Antenna/.test(name)) return m({ color: C.panel, roughness: 0.5 });
  return m({ color: C.muted });
}

// ---- choreography: which scene a part belongs to, when it starts (s after the lead-in) and where it comes from
function plan(name) {
  const k = (name.match(/^(?:Tile|Clip_)(\d)/) || [])[1];
  const T = k === undefined ? null : +k;
  const o = (x, y, z) => new THREE.Vector3(x, y, z);
  let s = 1, d = 0, off = o(0, 0, 0), anim = 1.0;
  if (/^Tile\d_/.test(name)) {
    if (T === 0) {
      s = 1;
      if (/_Body/.test(name)) { d = 0.0; off = o(0, 0, 0); }
      else if (/_Fiber/.test(name)) { d = 1.4; }
      else if (/_Coating/.test(name)) { d = 3.6; off = o(0, 0, 70); }
      else if (/_WrapAl/.test(name)) { d = 4.2; off = o(0, 0, 70); }
      else if (/_WrapCling/.test(name)) { d = 4.8; off = o(0, 0, 70); }
      else if (/_WrapVinyl/.test(name)) { d = 5.4; off = o(0, 0, 70); }
      else { d = 9.5; off = o(0, 50, 0); } // coupler, SiPM, SiPM board, U.FL
    } else { s = 2; d = 5.6 + 0.9 * T; off = o(280, 0, 0); anim = 1.2; }
  } else if (/^Rod|^Nut/.test(name)) { s = 2; d = 0.1 + (/^Nut/.test(name) ? 1.4 : 0); off = o(0, 0, 160); }
  else if (/^Clip_\d_/.test(name)) { s = 2; d = 2.3 + 0.55 * T; off = o(0, 0, 0); const dirx = /F?R_|BR|FR/.test(name) ? 1 : -1; off = o(dirx * 70, /B[LR]$/.test(name) ? 60 : -60, 0); }
  else if (/^Spacer/.test(name)) { s = 2; const g = +(name.match(/_(\d)[ab]?$/) || [0, 0])[1]; d = 5.0 + 0.9 * g; off = o(0, 0, 60); }
  else if (/^PlateBar|^PlateInsertBack|^PlateBar|^Splice|^PlateInsertFront|^PlateSplice/.test(name)) {
    s = 3; const g = +(name.match(/_(\d)/) || [0, 0])[1]; d = 0.4 + 1.6 * g; off = o(0, 170, 0);
  } else if (/^LidInsert|^MountScrew/.test(name) && /Insert/.test(name)) { s = 4; d = 0.0 + 0.06 * (+(name.match(/_(\d+)$/) || [0, 0])[1]); off = o(0, 40, 0); }
  else if (/^Case_Base/.test(name)) { s = 4; d = 2.4 + 0.9 * 'ABC'.indexOf(name.slice(-1)); off = o(0, 240, 0); }
  else if (/^PCB$/.test(name)) { s = 4; d = 5.6; off = o(0, 140, 0); anim = 1.4; }
  else if (/^Case_Lid/.test(name)) { s = 4; d = 7.4 + 0.7 * 'ABC'.indexOf(name.slice(-1)); off = o(0, 220, 0); }
  else if (/^LidScrew/.test(name)) { s = 4; d = 9.9 + 0.12 * (+(name.match(/_(\d+)$/) || [0, 0])[1]); off = o(0, 70, 0); anim = 0.5; }
  else if (/^MountScrew/.test(name)) { s = 4; d = 11.6 + 0.2 * (+(name.match(/_(\d+)$/) || [0, 0])[1]); off = o(0, -60, 0); anim = 0.5; }
  else if (/^BoardPlug|^Antenna/.test(name)) { s = 5; d = 8.0 + (/Antenna_FPC/.test(name) ? 2.0 : 0) + (/Pigtail|Plug/.test(name) ? 3.5 : 0); off = o(0, 50, 0); }
  else if (/^Cable|^CablePlug/.test(name)) { s = 5; const c = +(name.match(/_(\d)/) || [0, 0])[1]; d = 0.6 + 1.6 * c; off = o(60, 0, 0); anim = 1.0; }
  return { s, d, off, anim };
}

const ease = x => { x = Math.min(1, Math.max(0, x)); return 1 - Math.pow(1 - x, 3); };

// ---- load the model
const parts = [];
const geoCache = new Map();
const loader = new STLLoader();
const manifest = await (await fetch('../models/manifest.json')).json();
const tileBox = (() => { const xs = manifest.hull.map(p => p[0]), ys = manifest.hull.map(p => p[1]); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; })();
for (const p of manifest.parts) {
  let geo = geoCache.get(p.stl);
  if (!geo) { geo = await new Promise((res, rej) => loader.load('../' + p.stl, res, undefined, rej)); geoCache.set(p.stl, geo); }
  const mesh = new THREE.Mesh(geo, look(p.name, p.group));
  mesh.matrixAutoUpdate = false;
  const a = p.matrix;
  mesh.matrix.set(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], 0, 0, 0, 1);
  const holder = new THREE.Group(); holder.add(mesh); scene.add(holder);
  const pl = plan(p.name);
  parts.push({ name: p.name, group: p.group, mesh, holder, mat: mesh.material, baseOpacity: mesh.material.transparent ? mesh.material.opacity : 1, baseEmissive: mesh.material.emissiveIntensity ?? 0, ...pl });
}

// ---- cosmic muons for the test scene: lilac tracks crossing the stack, tiles flash where they pass
const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const muons = Array.from({ length: 16 }, (_, m) => {
  const th = (8 + 18 * rnd(m + 1)) * Math.PI / 180, ph = 2 * Math.PI * rnd(m + 7);
  const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), -Math.cos(th));
  // aim at a point of the top tile (z = 300) so most tracks cross all four
  const tx = tileBox.x0 + 20 + (tileBox.x1 - tileBox.x0 - 40) * rnd(m + 13), ty = tileBox.y0 + 30 + (tileBox.y1 - tileBox.y0 - 60) * rnd(m + 29);
  const t0 = (420 - 300) / Math.cos(th);
  const p0 = new THREE.Vector3(tx, ty, 300).addScaledVector(dir, -t0);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1, 8), new THREE.MeshBasicMaterial({ color: C.lilac, transparent: true, opacity: 0.0 }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 8), new THREE.MeshBasicMaterial({ color: C.ink, transparent: true, opacity: 0 }));
  scene.add(cyl, head);
  return { dir, p0, cyl, head, at: 1.0 + 1.15 * m };
});
const V = 900; // mm/s

function tileHit(mu, k) { // where the muon crosses plane z = 100 k, and whether that is inside the tile
  const t = (mu.p0.z - 100 * k) / -mu.dir.z; const p = mu.p0.clone().addScaledVector(mu.dir, t);
  return { t: t / V, inside: p.x > tileBox.x0 + 5 && p.x < tileBox.x1 - 5 && p.y > tileBox.y0 + 5 && p.y < tileBox.y1 - 5 };
}

// ---- cameras per scene: target, distance, azimuth/elevation (deg) at start and end
const CAM = [
  { tg: [70, 105, 140], dist: 840, az: [38, 76], el: [24, 26] },
  { tg: [58, 100, 0], dist: 640, az: [58, 30], el: [48, 38] },
  { tg: [70, 105, 150], dist: 840, az: [-30, 40], el: [26, 24] },
  { tg: [70, 200, 150], dist: 640, az: [55, 35], el: [16, 14] },
  { tg: [80, 215, 150], dist: 820, az: [60, 92], el: [18, 20] },
  { tg: [70, 200, 150], dist: 680, az: [45, 62], el: [22, 18] },
  { tg: [70, 110, 150], dist: 840, az: [40, 92], el: [24, 28] },
];
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => u * u * (3 - 2 * u);

function update(t) {
  const i = sceneAt(t), tl = t - start(i), u = smooth(Math.min(1, Math.max(0, tl / dur(i))));
  const c = CAM[i];
  const az = lerp(c.az[0], c.az[1], u) * Math.PI / 180, el = lerp(c.el[0], c.el[1], u) * Math.PI / 180;
  const tg = new THREE.Vector3(...c.tg);
  camera.position.set(tg.x + c.dist * Math.cos(el) * Math.cos(az), tg.y + c.dist * Math.cos(el) * Math.sin(az), tg.z + c.dist * Math.sin(el));
  camera.lookAt(tg);
  const local = tl - LEAD;
  // tile flashes in the test scene
  const flash = [0, 0, 0, 0];
  if (i === 6) for (const mu of muons) {
    const age = tl - mu.at; if (age < -0.1) continue;
    for (let k = 0; k < 4; k++) { const h = tileHit(mu, k); if (h.inside) { const a = age - h.t; if (a > 0) flash[k] = Math.max(flash[k], Math.exp(-a * 4.5)); } }
  }
  for (const p of parts) {
    let vis, off = 0, op = 1;
    if (i === 0) { vis = 1; }
    else if (p.s < i) { vis = 1; }
    else if (p.s > i) { vis = 0; }
    else { const x = (local - p.d) / p.anim; vis = ease(x); off = 1 - ease(x); }
    p.holder.position.copy(p.off).multiplyScalar(off);
    p.holder.visible = vis > 0.002;
    const m = p.mat;
    if (m.transparent || vis < 1) { m.transparent = true; m.opacity = p.baseOpacity * vis; m.depthWrite = vis >= 0.999 && p.baseOpacity >= 0.999; }
    // the test scene ghosts the case so the tiles and the tracks show through
    if (i === 6 && /^Case_|^PCB$|^LidScrew|^MountScrew|^LidInsert|^PlateBar|^PlateInsert/.test(p.name)) { m.transparent = true; m.opacity = p.baseOpacity * (0.12 + 0.88 * (1 - ease(tl / 2.0))); m.depthWrite = false; }
    const k = (p.name.match(/^Tile(\d)_/) || [])[1];
    if (k !== undefined && m.emissive) {
      if (/_SiPM$/.test(p.name) || /_Fiber$/.test(p.name)) m.emissiveIntensity = p.baseEmissive + 2.4 * flash[+k];
    }
    if (k !== undefined && /_Body$/.test(p.name) && i === 6) { m.color.setHex(C.violet).lerp(new THREE.Color(C.phos), Math.min(1, flash[+k] * 1.0)); m.opacity = 0.2 + 0.35 * flash[+k]; }
    if (/_Fiber$/.test(p.name) && i === 1) { // a pulse of light running through the fiber once it is laid
      const x = (local - p.d - 0.4); m.emissiveIntensity = 0.5 + 1.2 * Math.max(0, Math.sin(x * 3.2)) * (x > 0 ? 1 : 0);
    }
  }
  for (const mu of muons) {
    if (i !== 6) { mu.cyl.material.opacity = 0; mu.head.material.opacity = 0; continue; }
    const age = tl - mu.at, lenMax = 230;
    if (age < 0 || age > 1.3) { mu.cyl.material.opacity = 0; mu.head.material.opacity = 0; continue; }
    const s = age * V, tail = Math.max(0, s - lenMax);
    const a = mu.p0.clone().addScaledVector(mu.dir, tail), b = mu.p0.clone().addScaledVector(mu.dir, s);
    const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
    mu.cyl.position.copy(mid); mu.cyl.scale.set(1, Math.max(len, 0.01), 1);
    mu.cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), mu.dir.clone().normalize());
    const fade = Math.min(1, (1.3 - age) / 0.4);
    mu.cyl.material.opacity = 0.85 * fade; mu.head.position.copy(b); mu.head.material.opacity = 0.95 * fade;
    mu.cyl.visible = mu.head.visible = true;
  }
}

window.renderFrame = (t, fmt = 'jpeg') => {
  update(t); renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL(fmt === 'png' ? 'image/png' : 'image/jpeg', 0.93);
  return url.split(',')[1];
};
window.gpuInfo = () => { const gl = renderer.getContext(); const e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; };
window.filmReady = true;
