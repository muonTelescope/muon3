// Silkscreen: footprint outlines (from the LCSC footprints), a small stroke font, labels and polarity marks.
import type { Board } from "./board.ts";
import { apply, pt, type Pt } from "./geom.ts";

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
