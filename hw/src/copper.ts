// Router cell paths -> board copper.
// Each constant-width run is pulled taut (farthest legal straight shot), then every corner becomes the
// largest legal tangent arc (≤ 8 mm). The router grid is re-marked per net so later nets see the new copper.
import { Board, ROUTE_LAYERS, RULES, type Seg, type Arc } from "./board.ts";
import { Router, netClass } from "./router.ts";
import { pt, sub, add, mul, norm, len, dist, pointInPoly, type Pt } from "./geom.ts";

const MAX_R = 8;

export const taperStats = { wide: 0, ends: 0 };
export function toCopper(b: Board, r: Router, opts: { smooth?: boolean } = {}) {
  b.tracks = []; b.vias = [];
  const smooth = opts.smooth !== false;
  type T = { layer: number; width: number; path: (Seg | Arc)[] };
  const copyOut = new Map<string, T[]>(); // identical-cell copies, emitted with their own net
  const translate = (t: T, dx: number, dy: number): T => ({ ...t, path: t.path.map(sg => sg.kind === "seg"
    ? { ...sg, a: pt(sg.a.x + dx, sg.a.y + dy), b: pt(sg.b.x + dx, sg.b.y + dy) }
    : { ...sg, a: pt(sg.a.x + dx, sg.a.y + dy), b: pt(sg.b.x + dx, sg.b.y + dy), c: pt(sg.c.x + dx, sg.c.y + dy) }) });
  for (const rn of r.routed.values()) {
    const n = r.id(rn.net), cls = netClass(rn.net);
    const out: T[] = [...(copyOut.get(rn.net) ?? [])];
    // T-junctions: where another path of this net ends on this one, or a via sits, the vertex is pinned
    const ends = rn.paths.flatMap((p, pi) => [{ pi, L: p.layer, c: p.cells[0] }, { pi, L: p.layer, c: p.cells[p.cells.length - 1] }]);
    const netPads = r.pads.filter(q => q.net === rn.net);
    for (const [pi, p] of rn.paths.entries()) {
      if (r.copies.has(p)) continue; // emitted from its leader
      const twins = r.twins.get(p) ?? [];
      const tw = twins.map(t => ({ ...t, n: r.id(t.net), dx: (t.d % r.nx) * r.pitch, dy: Math.floor(t.d / r.nx) * r.pitch }));
      // legal here AND at every copy (copies may sit next to different foreign copper)
      const everywhere = (L: number, q: Pt, rad: number) => r.legal(L, r.cell(q.x, q.y), n, rad) &&
        tw.every(t => r.legal(L, r.cell(q.x + t.dx, q.y + t.dy), t.n, rad));
      const pts = p.cells.map(c => pt(r.cx(c), r.cy(c)));
      const first = out.length;
      // a path end inside one of the net's pads continues to the pad centre (full-width entry, no neck)
      const Lb = ROUTE_LAYERS[p.layer];
      const padAt = (q: Pt) => netPads.find(pd => (pd.layer === "multi" || (Lb === 0 && pd.layer === "top") || (Lb === 5 && pd.layer === "bottom")) && pointInPoly(q, pd.poly));
      const pa = padAt(pts[0]), pb = padAt(pts[pts.length - 1]);
      // the entry stub is checked too: as wide as the track if legal, else pad-width/signal-width, else skipped
      const stubW = (pad: typeof pa, from: Pt, w: number) => {
        for (const cand of [w, Math.min(w, pad!.w, pad!.h), 0.127]) {
          const ok = segLegal(from, pad!.c, q => everywhere(p.layer, q, cand / 2 + cls.halfClear), r.pitch / 2);
          if (ok) return cand;
        }
        return 0;
      };
      if (pa && dist(pa.c, pts[0]) > 1e-6) { const w = stubW(pa, pts[0], p.width[0]); if (w) { pts.unshift(pa.c); p.cells.unshift(p.cells[0]); p.width.unshift(w); } }
      if (pb && dist(pb.c, pts[pts.length - 1]) > 1e-6) { const w = stubW(pb, pts[pts.length - 1], p.width[p.width.length - 1]); if (w) { pts.push(pb.c); p.cells.push(p.cells[p.cells.length - 1]); p.width.push(w); } }
      const shift = pa && dist(pa.c, pts[1] ?? pts[0]) > 1e-6 && pts[0] === pa.c ? 1 : 0;
      const pinned = new Set<number>([0, pts.length - 1, shift, pts.length - 1 - (pb && pts[pts.length - 1] === pb.c ? 1 : 0)]);
      for (const e of ends) {
        if (e.pi === pi || e.L !== p.layer) continue;
        const ep = pt(r.cx(e.c), r.cy(e.c));
        let best = -1, bd = Infinity;
        pts.forEach((q, k) => { const d = Math.hypot(q.x - ep.x, q.y - ep.y); if (d < bd) { bd = d; best = k; } });
        if (best === 0 || best === pts.length - 1) continue;
        if (bd <= Math.max(...p.width) / 2 + r.pitch) pinned.add(best);
      }
      for (const v of rn.vias) { const k = p.cells.indexOf(v); if (k >= 0) pinned.add(k); }
      // segment k (pts[k]→pts[k+1]) is only as wide as the narrower of its two cells
      const sw = pts.slice(1).map((_, k) => Math.min(p.width[k], p.width[k + 1]));
      if (pts.length === 1) { pts.push(pts[0]); sw.push(p.width[0]); }
      /**
       * Taper: a track that leaves a pad starts as wide as the pad's narrow side (up to 0.45 mm) and narrows linearly to the
       * net width over ~4x the width difference (0.4-1.0 mm of copper length, following corners and arcs), in 6 steps. Each
       * step is kept only where the wider copper still clears its neighbours (in all four cells); otherwise it falls back
       * towards the net width.
       */
      type El = Seg | Arc;
      const elLen = (x: El) => x.kind === "seg" ? dist(x.a, x.b) : Math.hypot(x.a.x - x.c.x, x.a.y - x.c.y) * Math.abs(arcSweep(x));
      const arcSweep = (x: Arc) => {
        const a0 = Math.atan2(x.a.y - x.c.y, x.a.x - x.c.x), a1 = Math.atan2(x.b.y - x.c.y, x.b.x - x.c.x);
        const d = ((a1 - a0) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        return x.ccw ? d : d - 2 * Math.PI;
      };
      const elAt = (x: El, t: number): Pt => {
        if (x.kind === "seg") return pt(x.a.x + (x.b.x - x.a.x) * t, x.a.y + (x.b.y - x.a.y) * t);
        const a0 = Math.atan2(x.a.y - x.c.y, x.a.x - x.c.x), R = Math.hypot(x.a.x - x.c.x, x.a.y - x.c.y), th = a0 + arcSweep(x) * t;
        return pt(x.c.x + R * Math.cos(th), x.c.y + R * Math.sin(th));
      };
      const elSub = (x: El, t0: number, t1: number): El => x.kind === "seg" ? { kind: "seg", a: elAt(x, t0), b: elAt(x, t1) } : { ...x, a: elAt(x, t0), b: elAt(x, t1) };
      const elRev = (x: El): El => x.kind === "seg" ? { kind: "seg", a: x.b, b: x.a } : { ...x, a: x.b, b: x.a, ccw: !x.ccw };
      const elPts = (x: El) => x.kind === "seg" ? [x.a, x.b] : arcPoints(x.a, x.b, x.c, x.ccw, r.pitch / 2);
      const taperEnd = (path: El[], atStart: boolean, pad: NonNullable<typeof pa>, w: number): { width: number; path: El[] }[] => {
        const one = [{ width: w, path }];
        taperStats.ends++;
        const wp = Math.round(Math.min(Math.max(Math.min(pad.w, pad.h) * 0.9, w), 0.45) * 200) / 200;
        if (wp <= w + 0.02) return one;
        const seq = atStart ? path.slice() : path.slice().reverse().map(elRev);       // from the pad outwards
        const e = Math.max(pad.w, pad.h) / 2, Lt = Math.min(Math.max(4 * (wp - w), 0.4), 1.0), K = 6;
        const total = seq.reduce((sum, x) => sum + elLen(x), 0);
        if (total < e + 0.12) return one;
        const Ltt = Math.min(Lt, total - e - 0.05);
        const bps = [e, ...Array.from({ length: K }, (_, k) => e + (Ltt * (k + 1)) / K)];   // breakpoints along the path from the pad centre
        const widthAt = (s: number) => s <= e ? wp : Math.round((wp + (w - wp) * Math.min(1, (s - e) / Ltt)) * 200) / 200;
        const pieces: { width: number; path: El[] }[] = [];
        let s0 = 0, prev = wp, rest: El[] = [];
        for (const x of seq) {
          const L = elLen(x); let t = 0;
          for (const bp of bps) {
            if (bp <= s0 + 1e-9 || bp >= s0 + L - 1e-9 || bp <= s0 + t * L + 1e-9) continue;
            const t1 = (bp - s0) / L, sub = elSub(x, t, t1);
            let ww = Math.min(widthAt(0.5 * (s0 + t * L + bp)), prev);
            const stepIdx = pieces.length;
            while (stepIdx > 0 && ww > w + 1e-6 && !elPts(sub).every((q, i, arr) => i === 0 || segLegal(arr[i - 1], q, u => everywhere(p.layer, u, ww / 2 + cls.halfClear), r.pitch / 2))) ww = Math.max(w, ww - 0.025);
            pieces.push({ width: ww, path: [sub] }); prev = ww; if (ww > w + 1e-6) taperStats.wide++; t = t1;
          }
          // remainder of this element after the last breakpoint that fell inside it
          const tail = t > 0 ? elSub(x, t, 1) : x;
          if (s0 + L <= e + Ltt + 1e-9) {                                             // element still inside the taper: one step
            let ww = Math.min(widthAt(s0 + t * L + 0.5 * (1 - t) * L), prev);
            while (pieces.length > 0 && ww > w + 1e-6 && !elPts(tail).every((q, i, arr) => i === 0 || segLegal(arr[i - 1], q, u => everywhere(p.layer, u, ww / 2 + cls.halfClear), r.pitch / 2))) ww = Math.max(w, ww - 0.025);
            pieces.push({ width: ww, path: [tail] }); prev = ww; if (ww > w + 1e-6) taperStats.wide++;
          } else rest.push(tail);
          s0 += L;
        }
        const head = rest.length ? [{ width: w, path: atStart ? rest : rest.slice().reverse().map(elRev) }] : [];
        return [...head, ...pieces.map(pc => atStart ? pc : { width: pc.width, path: pc.path.map(elRev) })];
      };
      let start = 0;
      for (let i = 1; i <= sw.length; i++) {
        if (i < sw.length && sw[i] === sw[start] && !pinned.has(i)) continue;
        const run = collinearReduce(pts.slice(start, i + 1));
        const w = sw[start];
        if (run.length >= 2) {
          const legal = (q: Pt) => everywhere(p.layer, q, w / 2 + cls.halfClear);
          const taut = smooth ? pull(run, legal, r.pitch / 2) : run;
          let path = smooth ? fillet(taut, legal, r.pitch / 2) : segs(taut);
          let pieces = [{ width: w, path }];
          if (smooth && start === 0 && pa) pieces = taperEnd(path, true, pa, w);
          if (smooth && i === sw.length && pb) { const last = pieces[0]; pieces = [...taperEnd(last.path, false, pb, w), ...pieces.slice(1)]; }
          for (const pc of pieces) out.push({ layer: ROUTE_LAYERS[p.layer], width: pc.width, path: pc.path });
        }
        start = i;
      }
      const lead = out.slice(first);                     // this leader path's tracks, before any copy is added
      for (const t of tw) {                              // its copies, shifted exactly
        const cp = lead.map(x => translate(x, t.dx, t.dy));
        if (t.net === rn.net) out.push(...cp);
        else (copyOut.get(t.net) ?? copyOut.set(t.net, []).get(t.net)!).push(...cp);
      }
    }
    if (smooth) {
      remark(r, rn.net, out, rn.vias);
      // re-mark copies on other nets now, so nets smoothed later see the final copper
      for (const net of new Set(tw_nets(r, rn.paths))) if (net !== rn.net) remark(r, net, copyOut.get(net) ?? [], r.routed.get(net)?.vias ?? []);
    }
    for (const t of out) { const path = t.path.filter(sg => dist(sg.a, sg.b) > 1e-6); if (path.length) b.tracks.push({ net: rn.net, ...t, path }); }
    for (const v of rn.vias) b.vias.push({ net: rn.net, at: pt(r.cx(v), r.cy(v)), drill: RULES.viaDrill, dia: RULES.viaDia });
  }
}

const segs = (p: Pt[]): Seg[] => p.slice(1).map((q, k) => ({ kind: "seg" as const, a: p[k], b: q })).filter(s => dist(s.a, s.b) > 1e-6);

export function collinearReduce(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], m = pts[i], c = pts[i + 1];
    if (Math.abs((m.x - a.x) * (c.y - m.y) - (m.y - a.y) * (c.x - m.x)) > 1e-9) out.push(m);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function segLegal(a: Pt, b: Pt, legal: (q: Pt) => boolean, step: number) {
  const L = dist(a, b), n = Math.max(1, Math.ceil(L / step));
  for (let i = 0; i <= n; i++) if (!legal({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n })) return false;
  return true;
}

/** Greedy string pulling: from each anchor jump to the farthest vertex with a legal straight shot. */
function pull(p: Pt[], legal: (q: Pt) => boolean, step: number): Pt[] {
  const out = [p[0]];
  let i = 0;
  while (i < p.length - 1) {
    let best = i + 1;
    for (let j = i + 2; j < p.length; j++) if (segLegal(p[i], p[j], legal, step)) best = j;
    out.push(p[best]); i = best;
  }
  return out;
}

/** Replace each corner by the largest legal tangent arc. */
function fillet(p: Pt[], legal: (q: Pt) => boolean, step: number): (Seg | Arc)[] {
  if (p.length < 3) return segs(p);
  const res: (Seg | Arc)[] = [];
  let cur = p[0];
  for (let k = 1; k < p.length - 1; k++) {
    const A = p[k - 1], V = p[k], B = p[k + 1];
    const u = norm(sub(A, V)), v = norm(sub(B, V));
    const cosT = Math.max(-1, Math.min(1, u.x * v.x + u.y * v.y));
    const inner = Math.acos(cosT); // angle between the two legs at V
    if (inner > Math.PI - 1e-3) { res.push({ kind: "seg", a: cur, b: V }); cur = V; continue; }
    // paths start/end on a straight stub (≥0.1 mm) so every pad/via entry is a plain segment end
    const la = k === 1 ? dist(cur, V) - 0.1 : Math.min(dist(cur, V), dist(A, V) / 2);
    const lb = k === p.length - 2 ? dist(V, B) - 0.1 : dist(V, B) / 2;
    let t = Math.min(la, lb);
    const tanHalf = Math.tan(inner / 2);
    let done = false;
    for (let tries = 0; tries < 12 && t > 0.05; tries++, t *= 0.7) {
      const rad = t * tanHalf;
      if (rad > MAX_R) continue;
      const T1 = add(V, mul(u, t)), T2 = add(V, mul(v, t));
      const bis = norm(add(u, v)), dc = rad / Math.sin(inner / 2);
      const C = add(V, mul(bis, dc));
      const ccw = (T1.x - C.x) * (T2.y - C.y) - (T1.y - C.y) * (T2.x - C.x) < 0; // y-down: negative cross = visually CCW
      if (!arcLegal(T1, T2, C, ccw, legal, step) || !segLegal(cur, T1, legal, step)) continue;
      res.push({ kind: "seg", a: cur, b: T1 }, { kind: "arc", a: T1, b: T2, c: C, ccw });
      cur = T2; done = true; break;
    }
    if (!done) { res.push({ kind: "seg", a: cur, b: V }); cur = V; }
  }
  res.push({ kind: "seg", a: cur, b: p[p.length - 1] });
  return res.filter(s => dist(s.a, s.b) > 1e-6);
}

export function arcPoints(a: Pt, b: Pt, c: Pt, ccw: boolean, step: number): Pt[] {
  const r = dist(a, c);
  let a0 = Math.atan2(a.y - c.y, a.x - c.x), a1 = Math.atan2(b.y - c.y, b.x - c.x);
  // y-down: visually CCW means decreasing atan2 angle
  let sweep = a1 - a0;
  if (ccw) { while (sweep > 0) sweep -= 2 * Math.PI; } else { while (sweep < 0) sweep += 2 * Math.PI; }
  const n = Math.max(2, Math.ceil((Math.abs(sweep) * r) / step));
  return Array.from({ length: n + 1 }, (_, i) => pt(c.x + r * Math.cos(a0 + (sweep * i) / n), c.y + r * Math.sin(a0 + (sweep * i) / n)));
}

function arcLegal(a: Pt, b: Pt, c: Pt, ccw: boolean, legal: (q: Pt) => boolean, step: number) {
  return arcPoints(a, b, c, ccw, step).every(legal);
}

function tw_nets(r: Router, paths: { layer: number; cells: number[]; width: number[] }[]) {
  return paths.flatMap(p => (r.twins.get(p as never) ?? []).map(t => t.net));
}

/** Replace a net's raster marks with ones sampled from its final geometry. */
function remark(r: Router, net: string, tracks: { layer: number; width: number; path: (Seg | Arc)[] }[], vias: number[]) {
  r.ripUp(net, false);
  for (const t of tracks) {
    const L = ROUTE_LAYERS.indexOf(t.layer);
    const pts: Pt[] = [];
    for (const s of t.path) {
      if (s.kind === "seg") { const k = Math.max(1, Math.ceil(dist(s.a, s.b) / (r.pitch / 2))); for (let i = 0; i <= k; i++) pts.push({ x: s.a.x + ((s.b.x - s.a.x) * i) / k, y: s.a.y + ((s.b.y - s.a.y) * i) / k }); }
      else pts.push(...arcPoints(s.a, s.b, s.c, s.ccw, r.pitch / 2));
    }
    const cells = [...new Set(pts.map(q => r.cell(q.x, q.y)))];
    r.commit(net, { layer: L, cells, width: cells.map(() => t.width) });
  }
  for (const v of vias) r.commitVia(net, v);
}
