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
  for (const k of keepouts) if (/antenna/i.test(k.why ?? "")) holes.push([pt(k.x0, k.y0), pt(k.x1, k.y0), pt(k.x1, k.y1), pt(k.x0, k.y1)]);
  b.zones = b.zones.filter(z => !layers.includes(z.layer));
  for (const L of layers) b.zones.push({ net: "GND", layer: L, outline: b.outline, fill: [fill], holes });
}
