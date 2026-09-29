// Board model: stack-up, placed footprints -> world pads, copper (segments + true arcs), vias, zones.
import type { Circuit, Part } from "./circuit.ts";
import type { Pad } from "../tools/fetch_parts.ts";
import { type Pt, type Poly, pt, apply, rectPoly, circlePoly, obroundPoly, bboxOf } from "./geom.ts";

/** JLC 4-layer 1.6 mm (JLC04161H-7628 class): L1 signal + parts, L2 solid GND, L3 signal/power, L4 signal. */
export const LAYERS = ["F.Cu", "In1.Cu", "In2.Cu", "B.Cu"] as const;
export const TOP = 0, GND1 = 1, SIG2 = 2, BOT = 3;
export const ROUTE_LAYERS = [TOP, SIG2, BOT];
export const PLANE_LAYERS = [GND1];

/** Design rules (JLC 6-layer capability with margin). */
export const RULES = {
  track: 0.127, clearance: 0.127, // 5/5 mil signal
  power: 0.3, hvClearance: 0.5,   // HV nets: IPC-2221 B2 ~0.25 mm @ 100 V; we use 0.5
  viaDrill: 0.3, viaDia: 0.5,     // JLC free via size
  edge: 0.3, hole: 0.3,
};

export type WPad = {
  ref: string; num: string; net: string; layer: "top" | "bottom" | "multi";
  shape: Pad["shape"]; c: Pt; w: number; h: number; rot: number; poly: Poly; drill?: number;
  slot?: [Pt, Pt]; // plated slot: drill-width centreline end points
  nopaste?: boolean;
};
export type Seg = { kind: "seg"; a: Pt; b: Pt };
export type Arc = { kind: "arc"; a: Pt; b: Pt; c: Pt; ccw: boolean }; // from a to b about centre c
export type Track = { net: string; layer: number; width: number; path: (Seg | Arc)[] };
export type Via = { net: string; at: Pt; drill: number; dia: number };
export type Zone = { net: string; layer: number; outline: Poly; fill?: Poly[]; holes?: Poly[] };
export type Hole = { at: Pt; d: number; plated: boolean };

export class Board {
  w: number; h: number;
  outline: Poly;
  cutouts: Poly[] = []; // internal routed slots (Edge.Cuts)
  /** Thermal islands: no plane copper and no vias inside (heat leaves only through thin traces). */
  noPlane: { x0: number; y0: number; x1: number; y1: number }[] = [];
  tracks: Track[] = [];
  vias: Via[] = [];
  zones: Zone[] = [];
  holes: Hole[] = [];
  silk: { layer: "top" | "bottom"; a: Pt; b: Pt; w: number }[] = [];
  texts: { layer: "top" | "bottom"; at: Pt; text: string; size: number; rot: number }[] = [];

  constructor(public circuit: Circuit, w: number, h: number, cornerR = 3) {
    this.w = w; this.h = h;
    this.outline = roundedRect(w, h, cornerR);
  }

  get parts() { return this.circuit.parts; }

  /** World-space pads for a placed part. */
  pads(p: Part): WPad[] {
    if (!p.place) return [];
    const t = { x: p.place.x, y: p.place.y, rot: p.place.rot, mirror: p.place.side === "bottom" };
    return p.info.footprint.pads.map(pd => {
      const c = apply(t, pt(pd.x, pd.y));
      const rot = (pd.rot + p.place!.rot) % 360;
      const layer = pd.layer === "multi" ? "multi" : (pd.layer === "top") !== (p.place!.side === "bottom") ? "top" : "bottom";
      let poly: Poly;
      if (pd.shape === "poly" && pd.poly?.length) poly = pd.poly.map(q => apply(t, q));
      else if (pd.shape === "circle") poly = circlePoly(c, pd.w / 2, 20);
      else if (pd.shape === "oval") poly = obroundPoly(c.x, c.y, pd.w, pd.h, rot);
      else poly = rectPoly(c.x, c.y, pd.w, pd.h, rot);
      let slot: [Pt, Pt] | undefined;
      if (pd.drill && pd.drillLen && pd.drillLen > pd.drill + 1e-3) {
        const half = (pd.drillLen - pd.drill) / 2, along = pd.h >= pd.w ? pt(0, half) : pt(half, 0);
        const r1 = apply({ x: 0, y: 0, rot: pd.rot }, along);
        slot = [apply(t, pt(pd.x + r1.x, pd.y + r1.y)), apply(t, pt(pd.x - r1.x, pd.y - r1.y))];
      }
      return { ref: p.ref, num: pd.num, net: p.pads[pd.num] ?? `NC_${p.ref}_${pd.num}`, layer, shape: pd.shape, c, w: pd.w, h: pd.h, rot, poly, drill: pd.drill, slot, nopaste: pd.nopaste };
    });
  }

  allPads(): WPad[] { return this.parts.flatMap(p => this.pads(p)); }

  /** Courtyard of a placed part (footprint bbox + margin), world space. */
  courtyard(p: Part, margin = 0.25): Poly {
    const b = p.info.footprint.bbox;
    const t = { x: p.place!.x, y: p.place!.y, rot: p.place!.rot, mirror: p.place!.side === "bottom" };
    return [pt(b.x0 - margin, b.y0 - margin), pt(b.x1 + margin, b.y0 - margin), pt(b.x1 + margin, b.y1 + margin), pt(b.x0 - margin, b.y1 + margin)].map(q => apply(t, q));
  }

  partHoles(p: Part): Hole[] {
    if (!p.place) return [];
    const t = { x: p.place.x, y: p.place.y, rot: p.place.rot, mirror: p.place.side === "bottom" };
    return p.info.footprint.holes.map(h => ({ at: apply(t, pt(h.x, h.y)), d: h.d, plated: false }));
  }

  bbox() { return bboxOf(this.outline); }
}

export function roundedRect(w: number, h: number, r: number, n = 8): Poly {
  const out: Pt[] = [];
  const corners = [[w - r, r, -90], [w - r, h - r, 0], [r, h - r, 90], [r, r, 180]] as const;
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      out.push(pt(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  return out;
}

/** Rounded slot (stadium) from (x0,y0) to (x1,y1), width w — routed by a mill of the same width. */
export function slot(x0: number, y0: number, x1: number, y1: number, w: number, n = 8): Poly {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, r = w / 2;
  const out: Pt[] = [];
  const a0 = Math.atan2(uy, ux);
  for (let i = 0; i <= n; i++) { const a = a0 - Math.PI / 2 + (Math.PI * i) / n; out.push(pt(x1 + r * Math.cos(a), y1 + r * Math.sin(a))); }
  for (let i = 0; i <= n; i++) { const a = a0 + Math.PI / 2 + (Math.PI * i) / n; out.push(pt(x0 + r * Math.cos(a), y0 + r * Math.sin(a))); }
  return out;
}

/** Routed slot along a polyline (mitred corners, round ends): one closed outline, no self-intersections. */
export function slotPath(path: Pt[], w: number, n = 8): Poly {
  const r = w / 2, L: Pt[] = [], R: Pt[] = [];
  const dir = (a: Pt, b: Pt) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return pt(dx / l, dy / l); };
  for (let i = 0; i < path.length; i++) {
    const d0 = i > 0 ? dir(path[i - 1], path[i]) : dir(path[0], path[1]);
    const d1 = i < path.length - 1 ? dir(path[i], path[i + 1]) : d0;
    let nx = -(d0.y + d1.y), ny = d0.x + d1.x; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const k = r / Math.max(0.2, nx * -d0.y + ny * d0.x); // miter length
    L.push(pt(path[i].x + nx * k, path[i].y + ny * k)); R.push(pt(path[i].x - nx * k, path[i].y - ny * k));
  }
  const cap = (c: Pt, d: Pt, sgn: number) => {
    const a0 = Math.atan2(d.y, d.x), out: Pt[] = [];
    for (let i = 1; i < n; i++) { const a = a0 + sgn * (Math.PI / 2 - (Math.PI * i) / n); out.push(pt(c.x + r * Math.cos(a), c.y + r * Math.sin(a))); }
    return out;
  };
  const e = path.length - 1;
  return [...L, ...cap(path[e], dir(path[e - 1], path[e]), 1).reverse().reverse(), ...R.reverse(), ...cap(path[0], dir(path[1], path[0]), 1)];
}
