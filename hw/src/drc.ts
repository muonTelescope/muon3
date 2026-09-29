// Exact-geometry checks in JS: per-net connectivity (union-find) and copper clearance.
import { Board, LAYERS, RULES, type WPad, type Seg, type Arc } from "./board.ts";
import { type Pt, distPtSeg, segSegDist, distPtPoly, pointInPoly } from "./geom.ts";
import { arcPoints } from "./copper.ts";
import { ruleHalfClear } from "./router.ts";

type Item = { net: string; layers: number[]; kind: "pad" | "track" | "via"; label: string;
  segs?: [Pt, Pt][]; r?: number; poly?: Pt[]; at?: Pt };

const ALL = LAYERS.map((_, i) => i);

function items(b: Board): Item[] {
  const out: Item[] = [];
  for (const p of b.allPads()) out.push({ net: p.net, layers: p.layer === "multi" ? ALL : [p.layer === "top" ? 0 : ALL.length - 1], kind: "pad", label: `${p.ref}.${p.num}`, poly: p.poly });
  for (const t of b.tracks) {
    const segs: [Pt, Pt][] = [];
    for (const s of t.path) {
      if (s.kind === "seg") segs.push([s.a, s.b]);
      else { const ps = arcPoints(s.a, s.b, s.c, s.ccw, 0.02); for (let i = 1; i < ps.length; i++) segs.push([ps[i - 1], ps[i]]); }
    }
    out.push({ net: t.net, layers: [t.layer], kind: "track", label: `track ${t.net} ${LAYERS[t.layer]}`, segs, r: t.width / 2 });
  }
  for (const v of b.vias) out.push({ net: v.net, layers: ALL, kind: "via", label: `via ${v.net}`, at: v.at, r: v.dia / 2 });
  return out;
}

/** Signed gap between two items on a shared layer (≤0 = touching). */
function gap(a: Item, b: Item): number {
  const shapeDist = (x: Item, p: Pt): number => {
    if (x.poly) return distPtPoly(p, x.poly);
    if (x.at) return Math.max(0, Math.hypot(p.x - x.at.x, p.y - x.at.y) - x.r!);
    let m = Infinity; for (const [s, e] of x.segs!) m = Math.min(m, distPtSeg(p, s, e)); return Math.max(0, m - x.r!);
  };
  if (a.poly && b.poly) {
    let m = Infinity;
    for (let i = 0; i < a.poly.length; i++) for (let j = 0; j < b.poly.length; j++)
      m = Math.min(m, segSegDist(a.poly[i], a.poly[(i + 1) % a.poly.length], b.poly[j], b.poly[(j + 1) % b.poly.length]));
    if (pointInPoly(a.poly[0], b.poly) || pointInPoly(b.poly[0], a.poly)) return 0;
    return m;
  }
  if (a.poly || b.poly) {
    const [pl, o] = a.poly ? [a, b] : [b, a];
    if (o.at) return shapeDist(pl, o.at) - o.r!;
    let m = Infinity;
    for (const [s, e] of o.segs!) {
      if (pointInPoly(s, pl.poly!) || pointInPoly(e, pl.poly!)) return -o.r!;
      for (let i = 0; i < pl.poly!.length; i++) m = Math.min(m, segSegDist(s, e, pl.poly![i], pl.poly![(i + 1) % pl.poly!.length]));
    }
    return m - o.r!;
  }
  if (a.at && b.at) return Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y) - a.r! - b.r!;
  if (a.at || b.at) {
    const [v, t] = a.at ? [a, b] : [b, a];
    let m = Infinity; for (const [s, e] of t.segs!) m = Math.min(m, distPtSeg(v.at!, s, e));
    return m - v.r! - t.r!;
  }
  let m = Infinity;
  for (const [s, e] of a.segs!) for (const [s2, e2] of b.segs!) m = Math.min(m, segSegDist(s, e, s2, e2));
  return m - a.r! - b.r!;
}

function bounds(x: Item) {
  const pts = x.poly ?? (x.at ? [x.at] : x.segs!.flatMap(s => s));
  const r = x.r ?? 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  return { x0: x0 - r, y0: y0 - r, x1: x1 + r, y1: y1 + r };
}

/** Pairs of items sharing a layer whose bounding boxes come within `pad` mm (spatial hash, 2 mm buckets). */
function pairs(its: Item[], pad: number, fn: (a: Item, b: Item) => void) {
  const B = 2, grid = new Map<string, number[]>(), bb = its.map(bounds);
  its.forEach((_, i) => {
    const b = bb[i];
    for (let gx = Math.floor((b.x0 - pad) / B); gx <= Math.floor((b.x1 + pad) / B); gx++)
      for (let gy = Math.floor((b.y0 - pad) / B); gy <= Math.floor((b.y1 + pad) / B); gy++) { const k = gx + "," + gy; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); }
  });
  const seen = new Set<number>();
  for (const l of grid.values()) for (let x = 0; x < l.length; x++) for (let y = x + 1; y < l.length; y++) {
    const i = Math.min(l[x], l[y]), j = Math.max(l[x], l[y]), key = i * 1e6 + j;
    if (seen.has(key)) continue; seen.add(key);
    const a = its[i], c = its[j];
    if (!a.layers.some(L => c.layers.includes(L))) continue;
    const A = bb[i], C = bb[j];
    if (A.x0 > C.x1 + pad || C.x0 > A.x1 + pad || A.y0 > C.y1 + pad || C.y0 > A.y1 + pad) continue;
    fn(a, c);
  }
}

export function checkBoard(b: Board) {
  const its = items(b);
  // connectivity
  const parent = its.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const idx = new Map(its.map((x, i) => [x, i]));
  const clearance: string[] = [];
  pairs(its, 0.6, (a, c) => {
    const g = gap(a, c);
    if (a.net === c.net) { if (g <= 1e-4) parent[find(idx.get(a)!)] = find(idx.get(c)!); return; }
    if (a.kind === "pad" && c.kind === "pad" && a.label.split(".")[0] === c.label.split(".")[0]) return; // one land pattern: as supplied
    const rule = Math.max(RULES.clearance, Math.min(0.26, ruleHalfClear(a.net) + ruleHalfClear(c.net)));
    if (g < rule - 1e-3) clearance.push(`${g.toFixed(3)} < ${rule.toFixed(3)}  ${a.label} × ${c.label}`);
  });
  const comps = new Map<string, Set<number>>();
  its.forEach((x, i) => { if (x.net.startsWith("NC")) return; (comps.get(x.net) ?? comps.set(x.net, new Set()).get(x.net)!).add(find(i)); });
  const open: string[] = [];
  for (const [net, s] of comps) {
    if (net === "GND") continue; // planes join GND; checked separately
    if (s.size > 1) {
      const groups = [...s].map(root => its.filter((_, i) => find(i) === root).filter(x => x.kind === "pad").map(x => x.label));
      open.push(`${net}: ${s.size} islands  ${groups.map(g => "[" + g.join(",") + "]").join(" ")}`);
    }
  }
  return { clearance, open };
}
