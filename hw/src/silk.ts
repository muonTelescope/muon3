// Silkscreen: footprint outlines (from the LCSC footprints), a small stroke font, labels and polarity marks.
import type { Board } from "./board.ts";
import { apply, pt, pointInPoly, distPtPoly, type Pt } from "./geom.ts";

// Glyphs on a 4 (w) × 6 (h) grid, y down. Each glyph = list of polylines.
const G: Record<string, number[][]> = {
  A: [[0, 6, 0, 2, 2, 0, 4, 2, 4, 6], [0, 3, 4, 3]], B: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3], [3, 3, 4, 4, 4, 5, 3, 6, 0, 6]],
  C: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5]], D: [[0, 0, 0, 6, 3, 6, 4, 5, 4, 1, 3, 0, 0, 0]],
  E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]], F: [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]],
  G: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 3, 2, 3]], H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
  I: [[1, 0, 3, 0], [2, 0, 2, 6], [1, 6, 3, 6]], J: [[4, 0, 4, 5, 3, 6, 1, 6, 0, 5]], K: [[0, 0, 0, 6], [4, 0, 0, 4], [1, 3, 4, 6]],
  L: [[0, 0, 0, 6, 4, 6]], M: [[0, 6, 0, 0, 2, 3, 4, 0, 4, 6]], N: [[0, 6, 0, 0, 4, 6, 4, 0]],
  O: [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0]], P: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3]],
  Q: [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0], [2, 4, 4, 6]], R: [[0, 6, 0, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3], [2, 3, 4, 6]],
  S: [[4, 1, 3, 0, 1, 0, 0, 1, 0, 2, 1, 3, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5]], T: [[0, 0, 4, 0], [2, 0, 2, 6]],
  U: [[0, 0, 0, 5, 1, 6, 3, 6, 4, 5, 4, 0]], V: [[0, 0, 2, 6, 4, 0]], W: [[0, 0, 1, 6, 2, 3, 3, 6, 4, 0]],
  X: [[0, 0, 4, 6], [4, 0, 0, 6]], Y: [[0, 0, 2, 3, 4, 0], [2, 3, 2, 6]], Z: [[0, 0, 4, 0, 0, 6, 4, 6]],
  "0": [[1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0], [4, 1, 0, 5]], "1": [[1, 1, 2, 0, 2, 6], [1, 6, 3, 6]],
  "2": [[0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 0, 6, 4, 6]], "3": [[0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 3, 3, 4, 4, 4, 5, 3, 6, 1, 6, 0, 5], [1, 3, 3, 3]],
  "4": [[3, 6, 3, 0, 0, 4, 4, 4]], "5": [[4, 0, 0, 0, 0, 3, 3, 3, 4, 4, 4, 5, 3, 6, 0, 6]],
  "6": [[3, 0, 1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 3, 3, 0, 3]], "7": [[0, 0, 4, 0, 1, 6]],
  "8": [[1, 0, 3, 0, 4, 1, 4, 2, 3, 3, 1, 3, 0, 2, 0, 1, 1, 0], [1, 3, 0, 4, 0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 3, 3]],
  "9": [[4, 3, 1, 3, 0, 2, 0, 1, 1, 0, 3, 0, 4, 1, 4, 5, 3, 6, 1, 6]],
  "-": [[1, 3, 3, 3]], "+": [[0, 3, 4, 3], [2, 1, 2, 5]], ".": [[2, 5.5, 2, 6]], "/": [[0, 6, 4, 0]], ":": [[2, 1.5, 2, 2], [2, 4.5, 2, 5]],
  "(": [[3, 0, 2, 1, 2, 5, 3, 6]], ")": [[1, 0, 2, 1, 2, 5, 1, 6]], "!": [[2, 0, 2, 4], [2, 5.5, 2, 6]], "=": [[0, 2, 4, 2], [0, 4, 4, 4]],
  "_": [[0, 6, 4, 6]], ">": [[0, 0, 4, 3, 0, 6]], "<": [[4, 0, 0, 3, 4, 6]], "&": [[4, 6, 1, 2, 1, 1, 2, 0, 3, 1, 3, 2, 0, 4, 0, 5, 1, 6, 2, 6, 4, 4]],
  "%": [[0, 6, 4, 0], [0, 0, 1, 0, 1, 1, 0, 1, 0, 0], [3, 5, 4, 5, 4, 6, 3, 6, 3, 5]], "'": [[2, 0, 2, 1.5]], "°": [[1, 0, 2, 0, 2, 1, 1, 1, 1, 0]],
  "×": [[1, 2, 3, 4], [3, 2, 1, 4]], "~": [[0, 3, 1, 2, 3, 4, 4, 3]], "#": [[1, 0, 1, 6], [3, 0, 3, 6], [0, 2, 4, 2], [0, 4, 4, 4]],
};

export type Align = "left" | "center";
/** Stroke text: height h mm (cap height), line width h/7, rot in degrees (CCW, top view). */
export function text(b: Board, s: string, at: Pt, h = 1.0, opts: { rot?: number; align?: Align; layer?: "top" | "bottom" } = {}) {
  const k = h / 6, adv = 5.2 * k, w = Math.max(0.15, h / 7);
  const total = s.length * adv - k * 1.2;
  const x0 = opts.align === "center" ? -total / 2 : 0;
  const t = { x: at.x, y: at.y, rot: opts.rot ?? 0, mirror: opts.layer === "bottom" };
  [...s.toUpperCase()].forEach((ch, i) => {
    for (const line of G[ch] ?? []) for (let j = 0; j + 3 < line.length; j += 2) {
      const a = apply(t, pt(x0 + i * adv + line[j] * k, line[j + 1] * k - h / 2));
      const c = apply(t, pt(x0 + i * adv + line[j + 2] * k, line[j + 3] * k - h / 2));
      b.silk.push({ layer: opts.layer ?? "top", a, b: c, w });
    }
  });
}

export function line(b: Board, a: Pt, c: Pt, w = 0.15, layer: "top" | "bottom" = "top") { b.silk.push({ layer, a, b: c, w }); }

/** Footprint outlines + pin-1 marks exactly as LCSC draws them, transformed to the board. */
export function footprintSilk(b: Board) {
  for (const p of b.parts) {
    if (!p.place) continue;
    const t = { x: p.place.x, y: p.place.y, rot: p.place.rot, mirror: p.place.side === "bottom" };
    for (const s of p.info.footprint.silk) line(b, apply(t, pt(s.x1, s.y1)), apply(t, pt(s.x2, s.y2)), Math.max(0.12, s.w), p.place.side);
  }
}

/** Axis-aligned box of a text run (same geometry as text()). */
export function textBox(s: string, at: Pt, h: number, opts: { rot?: number; align?: Align } = {}) {
  const k = h / 6, adv = 5.2 * k, total = s.length * adv - k * 1.2, x0 = opts.align === "center" ? -total / 2 : 0;
  const t = { x: at.x, y: at.y, rot: opts.rot ?? 0 };
  const cs = [pt(x0, -h / 2), pt(x0 + total, -h / 2), pt(x0 + total, h / 2), pt(x0, h / 2)].map(q => apply(t, q));
  return { x0: Math.min(...cs.map(c => c.x)), y0: Math.min(...cs.map(c => c.y)), x1: Math.max(...cs.map(c => c.x)), y1: Math.max(...cs.map(c => c.y)) };
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const taken = new WeakMap<Board, Box[]>();
/** Place a label at the first candidate whose box clears pads, holes, slots, other labels and the board edge. */
export function label(b: Board, s: string, candidates: Pt[], h = 0.8, opts: { rot?: number; align?: Align } = {}): boolean {
  const boxes = taken.get(b) ?? (taken.set(b, []), taken.get(b)!);
  const pads = b.allPads().filter(p => p.layer !== "bottom");
  const clear = (bx: Box) => {
    if (bx.x0 < 0.4 || bx.y0 < 0.4 || bx.x1 > b.w - 0.4 || bx.y1 > b.h - 0.4) return false;
    const g = { x0: bx.x0 - 0.15, y0: bx.y0 - 0.15, x1: bx.x1 + 0.15, y1: bx.y1 + 0.15 };
    const hit = (o: Box) => !(o.x1 < g.x0 || o.x0 > g.x1 || o.y1 < g.y0 || o.y0 > g.y1);
    for (const p of pads) { const xs = p.poly.map(q => q.x), ys = p.poly.map(q => q.y); if (hit({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) })) return false; }
    // slots are C-shaped: test the real outline (a bounding box would forbid the whole island inside them)
    for (let i = 0; i <= 6; i++) for (let j = 0; j <= 2; j++) {
      const q = { x: g.x0 + (g.x1 - g.x0) * i / 6, y: g.y0 + (g.y1 - g.y0) * j / 2 };
      if (b.cutouts.some(c => pointInPoly(q, c) || distPtPoly(q, c) < 0.25)) return false;
    }
    for (const hh of b.holes) if (hit({ x0: hh.at.x - hh.d / 2, y0: hh.at.y - hh.d / 2, x1: hh.at.x + hh.d / 2, y1: hh.at.y + hh.d / 2 })) return false;
    return !boxes.some(hit);
  };
  for (const at of candidates) {
    const bx = textBox(s, at, h, opts);
    if (clear(bx)) { text(b, s, at, h, opts); boxes.push(bx); return true; }
  }
  return false;
}

/** Candidate anchor points around a box (above, below, right, left), for centred text. */
export function around(bx: Box, h: number, len: number): Pt[] {
  const cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2, g = 0.35 + h / 2;
  return [pt(cx, bx.y0 - g), pt(cx, bx.y1 + g), pt(bx.x1 + 0.35 + len / 2, cy), pt(bx.x0 - 0.35 - len / 2, cy),
    pt(cx, bx.y0 - g - h * 1.3), pt(cx, bx.y1 + g + h * 1.3)];
}
