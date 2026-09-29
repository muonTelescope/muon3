// SVG previews: placement + ratsnest, and per-layer copper.
import { Board, LAYERS, type WPad } from "./board.ts";
import { PLANE_NETS } from "./place.ts";
import type { Pt } from "./geom.ts";

const LAYER_COLOR = ["#c83434", "#3a7bd5", "#d59a3a", "#8a3ad5", "#3ad5c2", "#3478c8"];

const path = (poly: Pt[]) => "M" + poly.map(p => `${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join("L") + "Z";

/** Minimum spanning tree over pad centres (Prim), for ratsnest display and length estimates. */
export function mst(pts: Pt[]): [number, number][] {
  const n = pts.length, inTree = new Array(n).fill(false), best = new Array(n).fill(Infinity), from = new Array(n).fill(-1);
  const edges: [number, number][] = [];
  best[0] = 0;
  for (let k = 0; k < n; k++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!inTree[i] && (u < 0 || best[i] < best[u])) u = i;
    inTree[u] = true;
    if (from[u] >= 0) edges.push([from[u], u]);
    for (let v = 0; v < n; v++) {
      const d = Math.hypot(pts[u].x - pts[v].x, pts[u].y - pts[v].y);
      if (!inTree[v] && d < best[v]) { best[v] = d; from[v] = u; }
    }
  }
  return edges;
}

export function ratsnest(b: Board, pads = b.allPads()) {
  const byNet = new Map<string, WPad[]>();
  for (const p of pads) if (!p.net.startsWith("NC")) { const l = byNet.get(p.net) ?? []; l.push(p); byNet.set(p.net, l); }
  const lines: { net: string; a: Pt; b: Pt }[] = [];
  for (const [net, ps] of byNet) if (ps.length > 1) for (const [i, j] of mst(ps.map(p => p.c))) lines.push({ net, a: ps[i].c, b: ps[j].c });
  return lines;
}

export function renderSvg(b: Board, opts: { layers?: number[]; rats?: boolean; labels?: boolean; title?: string } = {}) {
  const s = 8, pad = 4;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${b.w + 2 * pad} ${b.h + 2 * pad}" width="${(b.w + 2 * pad) * s}" height="${(b.h + 2 * pad) * s}" style="background:#10151c">`);
  out.push(`<path d="${path(b.outline)}" fill="#1d3b2a" stroke="#e0d060" stroke-width="0.15"/>`);
  const layers = opts.layers ?? LAYERS.map((_, i) => i);
  for (const L of layers) {
    for (const z of b.zones.filter(z => z.layer === L)) {
      const d = (z.fill ?? []).map(path).join("") + (z.holes ?? []).map(path).join("");
      out.push(`<path d="${d}" fill="${LAYER_COLOR[L]}" fill-opacity="0.25" fill-rule="evenodd"/>`);
    }
    for (const t of b.tracks.filter(t => t.layer === L)) {
      let d = "";
      for (const sgm of t.path) {
        d += `M${sgm.a.x.toFixed(3)} ${sgm.a.y.toFixed(3)}`;
        if (sgm.kind === "seg") d += `L${sgm.b.x.toFixed(3)} ${sgm.b.y.toFixed(3)}`;
        else {
          const r = Math.hypot(sgm.a.x - sgm.c.x, sgm.a.y - sgm.c.y);
          // SVG sweep=1 is clockwise on screen; ccw = visually counter-clockwise. Fillets are < 180°.
          const sweep = sgm.ccw ? 0 : 1, large = 0;
          d += `A${r.toFixed(3)} ${r.toFixed(3)} 0 ${large} ${sweep} ${sgm.b.x.toFixed(3)} ${sgm.b.y.toFixed(3)}`;
        }
      }
      out.push(`<path d="${d}" fill="none" stroke="${LAYER_COLOR[L]}" stroke-width="${t.width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`);
    }
  }
  for (const p of b.parts) {
    if (!p.place) continue;
    out.push(`<path d="${path(b.courtyard(p, 0.1))}" fill="none" stroke="#6f7d8c" stroke-width="0.05"/>`);
  }
  for (const pd of b.allPads()) {
    const col = pd.layer === "multi" ? "#c0c0c0" : pd.layer === "top" ? "#d8a040" : "#4090d8";
    out.push(`<path d="${path(pd.poly)}" fill="${col}" fill-opacity="0.85"><title>${pd.ref}.${pd.num} ${pd.net}</title></path>`);
  }
  for (const v of b.vias) out.push(`<circle cx="${v.at.x}" cy="${v.at.y}" r="${v.dia / 2}" fill="#bbb"/><circle cx="${v.at.x}" cy="${v.at.y}" r="${v.drill / 2}" fill="#10151c"/>`);
  for (const h of [...b.holes, ...b.parts.flatMap(p => b.partHoles(p))]) out.push(`<circle cx="${h.at.x}" cy="${h.at.y}" r="${h.d / 2}" fill="#000" stroke="#888" stroke-width="0.05"/>`);
  if (opts.rats) for (const r of ratsnest(b)) {
    const plane = PLANE_NETS.has(r.net);
    if (plane) continue;
    out.push(`<line x1="${r.a.x}" y1="${r.a.y}" x2="${r.b.x}" y2="${r.b.y}" stroke="#f0f0f0" stroke-width="0.06" opacity="0.5"/>`);
  }
  if (opts.labels !== false) for (const p of b.parts) {
    if (!p.place) continue;
    const bb = p.info.footprint.bbox, big = (bb.x1 - bb.x0) * (bb.y1 - bb.y0) > 12;
    out.push(`<text x="${p.place.x}" y="${p.place.y}" font-size="${big ? 1.6 : 0.55}" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-family="monospace">${p.ref}${big ? " " + p.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").slice(0, 18) : ""}</text>`);
  }
  if (opts.title) out.push(`<text x="0" y="${-1.2}" font-size="2" fill="#e0d060" font-family="monospace">${opts.title}</text>`);
  out.push("</svg>");
  return out.join("\n");
}
