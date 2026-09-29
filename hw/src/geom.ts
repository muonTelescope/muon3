// Geometry primitives. Units: mm. Board coordinates are y-down (screen/KiCad); Gerber output flips y.
export type Pt = { x: number; y: number };
export type Poly = Pt[];

export const pt = (x: number, y: number): Pt => ({ x, y });
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
export const cross = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
export const len = (a: Pt) => Math.hypot(a.x, a.y);
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Pt): Pt => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; };
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** KiCad convention: rot = degrees counter-clockwise as seen from the top, in y-down coordinates. */
export function rotate(p: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return { x: p.x * c + p.y * s, y: -p.x * s + p.y * c };
}

export type Xform = { x: number; y: number; rot: number; mirror?: boolean };
export function apply(t: Xform, p: Pt): Pt {
  const q = rotate(t.mirror ? { x: -p.x, y: p.y } : p, t.rot);
  return { x: q.x + t.x, y: q.y + t.y };
}

export function rectPoly(cx: number, cy: number, w: number, h: number, rot = 0): Poly {
  return [pt(-w / 2, -h / 2), pt(w / 2, -h / 2), pt(w / 2, h / 2), pt(-w / 2, h / 2)].map(p => add(rotate(p, rot), pt(cx, cy)));
}

export function circlePoly(c: Pt, r: number, n = 24): Poly {
  return Array.from({ length: n }, (_, i) => pt(c.x + r * Math.cos((2 * Math.PI * i) / n), c.y + r * Math.sin((2 * Math.PI * i) / n)));
}

/** Stadium (obround) of size w×h, rotated by rot. */
export function obroundPoly(cx: number, cy: number, w: number, h: number, rot = 0, n = 12): Poly {
  const vertical = h > w;
  const L = Math.max(w, h), r = Math.min(w, h) / 2, l = L / 2 - r;
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI * i) / n; out.push(pt(l + r * Math.cos(a), r * Math.sin(a))); }
  for (let i = 0; i <= n; i++) { const a = Math.PI / 2 + (Math.PI * i) / n; out.push(pt(-l + r * Math.cos(a), r * Math.sin(a))); }
  return out.map(p => add(rotate(vertical ? rotate(p, 90) : p, rot), pt(cx, cy)));
}

export function bboxOf(pts: Pt[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0, y0, x1, y1 };
}

/** Distance from point p to segment ab. */
export function distPtSeg(p: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
  return dist(p, add(a, mul(ab, t)));
}

export function segSegDist(a: Pt, b: Pt, c: Pt, d: Pt): number {
  if (segIntersect(a, b, c, d)) return 0;
  return Math.min(distPtSeg(a, c, d), distPtSeg(b, c, d), distPtSeg(c, a, b), distPtSeg(d, a, b));
}

export function segIntersect(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(sub(b, a), sub(c, a)), d2 = cross(sub(b, a), sub(d, a));
  const d3 = cross(sub(d, c), sub(a, c)), d4 = cross(sub(d, c), sub(b, c));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function pointInPoly(p: Pt, poly: Poly): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Distance from point to polygon boundary (0 if inside). */
export function distPtPoly(p: Pt, poly: Poly): number {
  if (pointInPoly(p, poly)) return 0;
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) m = Math.min(m, distPtSeg(p, poly[i], poly[(i + 1) % poly.length]));
  return m;
}

export function polyPolyDist(a: Poly, b: Poly): number {
  if (pointInPoly(a[0], b) || pointInPoly(b[0], a)) return 0;
  let m = Infinity;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      m = Math.min(m, segSegDist(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length]));
  return m;
}
