// Tiny scene-graph on top of ClassCAD direct-modeling primitives. Millimetres, z up.
// Matrices are row-major 4x4 arrays. ClassCAD rotation = [rx,ry,rz] applied Z, then Y, then X (R = Rx·Ry·Rz).
export const I4 = () => [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
export function mul(A, B) {
  const C = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += A[i][k] * B[k][j]; C[i][j] = s; }
  return C;
}
export const T = (x, y, z) => [[1, 0, 0, x], [0, 1, 0, y], [0, 0, 1, z], [0, 0, 0, 1]];
export const Rz = a => [[Math.cos(a), -Math.sin(a), 0, 0], [Math.sin(a), Math.cos(a), 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
export const Rx = a => [[1, 0, 0, 0], [0, Math.cos(a), -Math.sin(a), 0], [0, Math.sin(a), Math.cos(a), 0], [0, 0, 0, 1]];
export const Ry = a => [[Math.cos(a), 0, Math.sin(a), 0], [0, 1, 0, 0], [-Math.sin(a), 0, Math.cos(a), 0], [0, 0, 0, 1]];
export const pt = (M, p) => [0, 1, 2].map(i => M[i][0] * p[0] + M[i][1] * p[1] + M[i][2] * p[2] + M[i][3]);
export const dir = (M, v) => [0, 1, 2].map(i => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), sc = (a, s) => a.map(v => v * s);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
export { sub, add, sc, dot, cross, nrm };
/** frame with x along `x`, z as close to `up` as possible, origin `o` */
export function frame(o, x, up = [0, 0, 1]) {
  x = nrm(x); let z = sub(up, sc(x, dot(up, x))); z = nrm(z); const y = cross(z, x);
  return [[x[0], y[0], z[0], o[0]], [x[1], y[1], z[1], o[1]], [x[2], y[2], z[2], o[2]], [0, 0, 0, 1]];
}
export function euler(M) {
  const b = Math.asin(Math.max(-1, Math.min(1, M[0][2])));
  if (Math.abs(M[0][2]) < 0.99999) return [Math.atan2(-M[1][2], M[2][2]), b, Math.atan2(-M[0][1], M[0][0])];
  return [Math.atan2(M[2][1], M[1][1]), b, 0];
}
/** offset a convex CCW polygon outward by d */
export function offsetPoly(P, d) {
  const n = P.length, L = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const e = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    L.push({ p: [a[0] + e[1] * d, a[1] - e[0] * d], e });
  }
  return P.map((_, i) => {
    const { p: p1, e: e1 } = L[(i + n - 1) % n], { p: p2, e: e2 } = L[i];
    const den = e1[0] * e2[1] - e1[1] * e2[0];
    const t = ((p2[0] - p1[0]) * e2[1] - (p2[1] - p1[1]) * e2[0]) / den;
    return [p1[0] + t * e1[0], p1[1] + t * e1[1]];
  });
}
/** distance from the origin along angle (rad) to the boundary of a convex polygon containing the origin */
export function rayHit(P, ang) {
  const d = [Math.cos(ang), Math.sin(ang)]; let best = Infinity;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], e = [b[0] - a[0], b[1] - a[1]];
    const den = d[0] * e[1] - d[1] * e[0]; if (Math.abs(den) < 1e-9) continue;
    const t = (a[0] * e[1] - a[1] * e[0]) / den, s = (a[0] * d[1] - a[1] * d[0]) / den;
    if (t > 0 && s >= 0 && s <= 1) best = Math.min(best, t);
  }
  return best;
}

export class Scene {
  constructor() { this.prims = []; this.stack = [I4()]; this.tally = {}; this.wires = []; this.fibers = []; }
  get M() { return this.stack.at(-1); }
  push(M) { this.stack.push(mul(this.M, M)); } pop() { this.stack.pop(); }
  count(k, n = 1) { this.tally[k] = (this.tally[k] || 0) + n; }
  _add(p) { this.prims.push(p); return p; }
  /** box centred at c, optional local rotation matrix R (4x4) */
  box(g, s, c, R = I4(), cuts = []) { return this._add({ g, k: 'box', s, M: mul(this.M, mul(T(...c), R)), cuts: cuts.map(q => ({ ...q, M: mul(this.M, q.M) })) }); }
  cyl(g, d, h, c, R = I4()) { return this._add({ g, k: 'cyl', d, h, M: mul(this.M, mul(T(...c), R)), cuts: [] }); }
  prism(g, poly, z0, z1, cuts = []) { return this._add({ g, k: 'prism', poly, h: z1 - z0, M: mul(this.M, T(0, 0, z0)), cuts: cuts.map(q => ({ ...q, M: mul(this.M, q.M) })) }); }
  ring(g, outer, inner, z0, z1, cuts = []) { return this._add({ g, k: 'ring', outer, inner, h: z1 - z0, M: mul(this.M, T(0, 0, z0)), cuts: cuts.map(q => ({ ...q, M: mul(this.M, q.M) })) }); }
  hex(g, r, z0, z1, rot = 0) { return this.prism(g, Array.from({ length: 6 }, (_, i) => [r * Math.cos(rot + i * Math.PI / 3), r * Math.sin(rot + i * Math.PI / 3)]), z0, z1); }
  /** cutter box description (local matrix, composed with the stack when attached) */
  static cutBox(s, c, R = I4()) { return { k: 'box', s, M: mul(T(...c), R) }; }
  /** ISO 4762-style M3 cap screw: head d5.5 x 3, shank d3, axis +z (use R to aim); top of head at z=ztop */
  screw(x, y, ztop, len = 16, R = I4()) {
    this.cyl('hw', 5.5, 3, [x, y, ztop - 1.5], R); this.cyl('hw', 3, len, [x, y, ztop - 3 - len / 2], R); this.count('M3 cap screw');
  }
  nut(x, y, z0) { this.hex('hw', 3.18, z0, z0 + 2.4, 0); this.count('M3 hex nut'); }
}

/** Build the ClassCAD script for one material group. Prims already carry world matrices. */
export function groupScript(name, prims) {
  const data = prims.map(p => {
    const e = euler(p.M), t = [p.M[0][3], p.M[1][3], p.M[2][3]];
    return { ...p, rot: e, tr: t, dz: [p.M[0][2], p.M[1][2], p.M[2][2]], M: undefined, cuts: p.cuts.map(c => ({ ...c, rot: euler(c.M), tr: [c.M[0][3], c.M[1][3], c.M[2][3]], M: undefined })) };
  });
  return `const DATA=${JSON.stringify(data)};
await api.v1.common.clear({});
const part=(await api.v1.part.create({name:${JSON.stringify(name)}})).result;
const eif=(await api.v1.part.entityInjection({id:part})).result;
const ids=[]; let bad=0;
async function profile(poly){const sh=(await api.v1.curve.shape({id:eif})).result;
 await api.v1.curve.advancedPolyline({id:sh,pld:poly.map(q=>({xa:q[0],ya:q[1]})),close:true}); return sh;}
async function extrude(poly,h,rot,tr){const sh=await profile(poly);return (await api.v1.solid.extrusion({id:eif,direction:[0,0,h],curves:sh,rotation:rot,translation:tr})).result;}
async function make(p){
 if(p.k==='box')return (await api.v1.solid.box({id:eif,length:p.s[0],width:p.s[1],height:p.s[2],rotation:p.rot,translation:p.tr})).result;
 if(p.k==='cyl')return (await api.v1.solid.cylinder({id:eif,diameter:p.d,height:p.h,rotation:p.rot,translation:p.tr})).result;
 if(p.k==='prism')return extrude(p.poly,p.h,p.rot,p.tr);
 if(p.k==='ring'){const o=await extrude(p.outer,p.h,p.rot,p.tr);
   const inner=await extrude(p.inner,p.h+1,p.rot,[p.tr[0]-0.5*p.dz[0],p.tr[1]-0.5*p.dz[1],p.tr[2]-0.5*p.dz[2]]);
   return (await api.v1.solid.subtraction({id:eif,target:o,tools:[inner]})).result;}
}
for(const p of DATA){
 let id=await make(p); if(id==null){bad++;continue;}
 for(const c of p.cuts){const cid=(await api.v1.solid.box({id:eif,length:c.s[0],width:c.s[1],height:c.s[2],rotation:c.rot,translation:c.tr})).result;
   const r=(await api.v1.solid.subtraction({id:eif,target:id,tools:[cid]})).result; if(r==null){bad++;}}
 ids.push(id);}
if(bad)throw Error('null solids: '+bad);
return {solids:ids.length};`;
}
