// GND reference planes (L2, L5): board outline pulled 0.3 mm from the edge, antipads around every
// non-GND via and hole, cut-out under the ESP32 antenna. GND vias/pads join the plane solid.
import { Board, RULES, roundedRect } from "./board.ts";
import { circlePoly, pt, type Poly } from "./geom.ts";

export function buildPlanes(b: Board, layers: number[], keepouts: { x0: number; y0: number; x1: number; y1: number; why?: string }[]) {
  const e = RULES.edge;
  const fill = roundedRect(b.w - 2 * e, b.h - 2 * e, 3 - e).map(p => pt(p.x + e, p.y + e));
  const holes: Poly[] = [];
  const AP = 0.2; // plane-to-foreign-copper clearance
  for (const v of b.vias) if (v.net !== "GND") holes.push(circlePoly(v.at, v.dia / 2 + AP, 16));
  for (const p of b.allPads()) if (p.drill && p.net !== "GND") holes.push(circlePoly(p.c, Math.max(p.w, p.h) / 2 + AP, 16));
  for (const h of [...b.holes, ...b.parts.flatMap(p => b.partHoles(p))]) holes.push(circlePoly(h.at, h.d / 2 + 0.3, 20));
  for (const cut of b.cutouts) holes.push(grow(cut, RULES.edge));
  for (const k of [...keepouts.filter(k => /antenna/i.test(k.why ?? "")), ...b.noPlane]) holes.push([pt(k.x0, k.y0), pt(k.x1, k.y0), pt(k.x1, k.y1), pt(k.x0, k.y1)]);
  b.zones = b.zones.filter(z => !layers.includes(z.layer));
  for (const L of layers) b.zones.push({ net: "GND", layer: L, outline: b.outline, fill: [fill], holes });
}

function grow(poly: Poly, d: number): Poly {
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length, cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  // slots are convex stadiums: pushing each vertex away from the centroid along its normal-ish direction
  return poly.map((p, i) => {
    const a = poly[(i + poly.length - 1) % poly.length], c = poly[(i + 1) % poly.length];
    let nx = -(c.y - a.y), ny = c.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (nx * (p.x - cx) + ny * (p.y - cy) < 0) { nx = -nx; ny = -ny; }
    return pt(p.x + nx * d, p.y + ny * d);
  });
}
