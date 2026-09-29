// Grid router with half-clearance occupancy, multi-layer A*, GND plane fan-out, and rip-up/re-route.
// Output is raw cell paths; geometry.ts turns them into taut, arc-filleted copper.
import { Board, RULES, ROUTE_LAYERS, TOP, BOT, type WPad } from "./board.ts";
import { type Pt, pointInPoly, distPtPoly, distPtSeg, bboxOf, rectPoly, apply } from "./geom.ts";
import { mst } from "./svg.ts";

export type NetClass = { width: number; halfClear: number; neck?: number };
export const PLANE = new Set(["GND"]);
// HV class = long bias runs. The MAX1932's own switch/sense nodes (HV_SW, HV_RAW, HV_CSN) sit at its 0.8 mm pin
// pitch by design and stay local, so they use the standard 0.127 mm (≈ IPC-2221 B4, coated, 31–150 V: 0.13 mm).
const HV_NETS = /^(HV|HV_FB_MID|HVJ\d|HV_MON_MID)$/;
// IPC-2221 external 1 oz, ≤20 °C rise: 1.78 A (ILIM cap) -> 0.44 mm; per-cell branch ≤0.45 A.
const POWER_W: Record<string, number> = {
  VBUS: 0.6, PMID: 0.6, CHG_SW: 0.6, VSYS: 0.6, VBAT: 0.6, CELL0_P: 0.4, CELL1_P: 0.4, CELL2_P: 0.4, CELL3_P: 0.4,
  "3V3": 0.4, "3V3A": 0.3, "1V2": 0.3, HV_SW: 0.3, // REGN (~20 mA) stays signal width
};
/** Raster quantisation margin: the grid router plans with clearance + 2×GRID_MARGIN, DRC checks the true rule. */
const GRID_MARGIN = 0.04;
const HOLE_GAP = 0.25; // JLC min drill-to-drill (edge to edge)
/** The design-rule half-clearance (no grid margin) — what DRC enforces. */
export function ruleHalfClear(net: string) { return HV_NETS.test(net) ? 0.2 : netClass(net).halfClear - GRID_MARGIN; }
export function netClass(net: string): NetClass {
  const hc = RULES.clearance / 2 + GRID_MARGIN;
  // HV ≤ 80 V at ≤ 1.7 mA: IPC-2221 B4 (coated external) 0.13 mm, B1 (internal) 0.10 mm; we keep ≥ 0.26 mm to anything
  if (HV_NETS.test(net)) return { width: 0.2, halfClear: 0.2 + GRID_MARGIN + 0.03, neck: RULES.track };
  if (POWER_W[net]) return { width: POWER_W[net], halfClear: hc, neck: RULES.track };
  return { width: RULES.track, halfClear: hc };
}

type Path = { layer: number; cells: number[]; width: number[] }; // layer = index into ROUTE_LAYERS
export type RoutedNet = { net: string; paths: Path[]; vias: number[]; failed: number };

const NL = ROUTE_LAYERS.length;

export class Router {
  pitch: number; nx: number; ny: number; N: number;
  own: Int16Array[];    // inflated copper owner: 0 free, -1 blocked, -2 contested, >0 net id
  core: Int16Array[];   // true copper (for "reached my own net")
  hard: Uint8Array[];   // pad cells: never ripped
  drill: Uint16Array;   // count of drilled holes whose hole-to-hole zone covers this cell (vias may not be centred here)
  netId = new Map<string, number>(); netName: string[] = [""];
  routed = new Map<string, RoutedNet>();
  marks = new Map<number, { own: number[]; core: number[] }>(); // net -> cells marked (for rip-up), index = L*N + c
  pads: WPad[];

  constructor(public b: Board, public keepouts: { x0: number; y0: number; x1: number; y1: number }[] = [], pitch = 0.1) {
    this.pitch = pitch;
    this.nx = Math.ceil(b.w / pitch); this.ny = Math.ceil(b.h / pitch); this.N = this.nx * this.ny;
    this.own = Array.from({ length: NL }, () => new Int16Array(this.N));
    this.core = Array.from({ length: NL }, () => new Int16Array(this.N));
    this.hard = Array.from({ length: NL }, () => new Uint8Array(this.N));
    this.drill = new Uint16Array(this.N);
    this.pads = b.allPads();
    for (const p of this.pads) this.id(p.net);
    this.blockEdgesAndHoles();
    // no top copper under module bodies / metal shells (exposed pads, test points, shields)
    for (const part of b.parts) {
      if (!/ESP32|RAK3172|TYPE-C/i.test(part.info.mpn)) continue;
      const bd = part.info.footprint.body; if (!bd) continue;
      const ownPads = this.pads.filter(pd => pd.ref === part.ref && pd.layer !== "multi");
      const cy = rectPoly(0, 0, bd.w - 0.4, bd.h - 0.4).map(q => apply(part.place!, { x: q.x + bd.cx, y: q.y + bd.cy })), bb = bboxOf(cy);
      for (let y = Math.max(0, Math.floor(bb.y0 / pitch)); y <= Math.min(this.ny - 1, Math.ceil(bb.y1 / pitch)); y++)
        for (let x = Math.max(0, Math.floor(bb.x0 / pitch)); x <= Math.min(this.nx - 1, Math.ceil(bb.x1 / pitch)); x++) {
          const c = y * this.nx + x;
          const q = { x: (x + 0.5) * pitch, y: (y + 0.5) * pitch };
          if (ownPads.some(pd => distPtPoly(q, pd.poly) < 0.8)) continue; // pad escape corridor
          if (pointInPoly(q, cy) && this.own[0][c] === 0) { this.own[0][c] = -1; this.hard[0][c] = 1; (this.moduleMask ??= new Uint8Array(this.N))[c] = 1; }
        }
    }
    for (const p of this.pads) this.markPad(p);
    // existing holes (THT pads, NPTH pegs, mounting holes) keep via drills 0.25 mm away
    for (const p of this.pads) if (p.drill) this.disk(this.cell(p.c.x, p.c.y), p.drill / 2 + HOLE_GAP + RULES.viaDrill / 2, c => { this.drill[c]++; });
    for (const h of [...b.holes, ...b.parts.flatMap(p => b.partHoles(p))]) this.disk(this.cell(h.at.x, h.at.y), h.d / 2 + HOLE_GAP + RULES.viaDrill / 2, c => { this.drill[c]++; });
  }

  id(net: string) { let i = this.netId.get(net); if (!i) { i = this.netName.length; this.netId.set(net, i); this.netName.push(net); } return i; }
  cx(c: number) { return ((c % this.nx) + 0.5) * this.pitch; }
  cy(c: number) { return (Math.floor(c / this.nx) + 0.5) * this.pitch; }
  cell(x: number, y: number) { return Math.floor(y / this.pitch) * this.nx + Math.floor(x / this.pitch); }

  private disk(c: number, r: number, f: (c2: number) => boolean | void) {
    const R = Math.ceil(r / this.pitch), x0 = c % this.nx, y0 = Math.floor(c / this.nx), r2 = (r / this.pitch) ** 2;
    for (let dy = -R; dy <= R; dy++) {
      const y = y0 + dy; if (y < 0 || y >= this.ny) continue;
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > r2 + 0.25) continue;
        const x = x0 + dx; if (x < 0 || x >= this.nx) continue;
        if (f(y * this.nx + x) === false) return false;
      }
    }
    return true;
  }

  private blockEdgesAndHoles() {
    const m = RULES.edge + RULES.clearance / 2;
    const bb = bboxOf(this.b.outline);
    const holes = [...this.b.holes, ...this.b.parts.flatMap(p => this.b.partHoles(p))];
    for (let c = 0; c < this.N; c++) {
      const p = { x: this.cx(c), y: this.cy(c) };
      let blocked = !pointInPoly(p, this.b.outline) || p.x < bb.x0 + m || p.y < bb.y0 + m || p.x > bb.x1 - m || p.y > bb.y1 - m;
      if (!blocked) for (const h of holes) if (Math.hypot(p.x - h.at.x, p.y - h.at.y) < h.d / 2 + RULES.hole + 0.1) { blocked = true; break; }
      if (!blocked) for (const k of this.keepouts) if (p.x >= k.x0 && p.x <= k.x1 && p.y >= k.y0 && p.y <= k.y1) { blocked = true; break; }
      if (blocked) for (let L = 0; L < NL; L++) { this.own[L][c] = -1; this.hard[L][c] = 1; }
    }
  }
  private padLayers(p: WPad): number[] {
    if (p.layer === "multi") return ROUTE_LAYERS.map((_, i) => i);
    return [p.layer === "top" ? ROUTE_LAYERS.indexOf(TOP) : ROUTE_LAYERS.indexOf(BOT)];
  }

  private markPad(p: WPad) {
    const n = this.id(p.net), hc = netClass(p.net).halfClear;
    const bb = bboxOf(p.poly);
    const x0 = Math.max(0, Math.floor((bb.x0 - hc - this.pitch) / this.pitch)), x1 = Math.min(this.nx - 1, Math.ceil((bb.x1 + hc + this.pitch) / this.pitch));
    const y0 = Math.max(0, Math.floor((bb.y0 - hc - this.pitch) / this.pitch)), y1 = Math.min(this.ny - 1, Math.ceil((bb.y1 + hc + this.pitch) / this.pitch));
    for (const L of this.padLayers(p)) {
      const own = this.own[L], core = this.core[L], hard = this.hard[L];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const c = y * this.nx + x, q = { x: (x + 0.5) * this.pitch, y: (y + 0.5) * this.pitch };
        const d = distPtPoly(q, p.poly);
        if (d <= hc + 0.03) {
          if (own[c] === 0 || own[c] === n || (own[c] === -1 && d === 0 && this.underModule(L, c))) own[c] = n; else if (own[c] > 0) own[c] = -2;
          hard[c] = 1;
          if (d === 0) core[c] = n;
        }
      }
    }
  }

  private moduleMask: Uint8Array | null = null;
  private underModule(L: number, c: number) { return L === 0 && this.moduleMask !== null && this.moduleMask[c] === 1; }

  /** Can net n put a centreline of half-width hw on (L, c)? */
  legal(L: number, c: number, n: number, r: number) {
    const own = this.own[L];
    return this.disk(c, r, c2 => { const o = own[c2]; return o === 0 || o === n; }) as boolean;
  }
  viaLegal(c: number, n: number, hc: number) {
    if (this.drill[c]) return false;
    const r = RULES.viaDia / 2 + hc;
    for (let L = 0; L < NL; L++) if (!this.legal(L, c, n, r)) return false;
    return true;
  }

  private mark(n: number, L: number, c: number, rOwn: number, rCore: number) {
    const m = this.marks.get(n) ?? { own: [], core: [] }; this.marks.set(n, m);
    const own = this.own[L], core = this.core[L];
    this.disk(c, rOwn, c2 => { if (own[c2] === 0) { own[c2] = n; m.own.push(L * this.N + c2); } });
    this.disk(c, Math.max(rCore, 0.001), c2 => { if (core[c2] === 0) { core[c2] = n; m.core.push(L * this.N + c2); } });
  }

  commit(net: string, path: Path) {
    const n = this.id(net), hc = netClass(net).halfClear;
    path.cells.forEach((c, i) => this.mark(n, path.layer, c, path.width[i] / 2 + hc, path.width[i] / 2 - this.pitch / 2));
    const r = this.routed.get(net)!; r.paths.push(path);
  }
  commitVia(net: string, c: number) {
    const n = this.id(net), hc = netClass(net).halfClear;
    for (let L = 0; L < NL; L++) this.mark(n, L, c, RULES.viaDia / 2 + hc, RULES.viaDia / 2 - this.pitch / 2);
    this.disk(c, RULES.viaDrill + HOLE_GAP + 0.05, c2 => { this.drill[c2]++; });
    this.routed.get(net)!.vias.push(c);
  }

  ripUp(net: string) {
    const n = this.id(net), m = this.marks.get(n);
    if (m) {
      // mark() only records cells it changed from 0, so every recorded cell goes back to 0 (incl. rings around pads)
      for (const k of m.own) { const L = Math.floor(k / this.N), c = k % this.N; if (this.own[L][c] === n) this.own[L][c] = 0; }
      for (const k of m.core) { const L = Math.floor(k / this.N), c = k % this.N; if (this.core[L][c] === n) this.core[L][c] = 0; }
      this.marks.delete(n);
    }
    const r = this.routed.get(net);
    if (r) { for (const v of r.vias) this.disk(v, RULES.viaDrill + HOLE_GAP + 0.05, c2 => { if (this.drill[c2]) this.drill[c2]--; }); r.paths = []; r.vias = []; }
  }

  // ───────────────────────── A* ─────────────────────────
  private g = new Float32Array(0); private from = new Int32Array(0); private stamp = new Int32Array(0);
  /** PathFinder history: cells that repeatedly caused rip-ups get more expensive for everyone. */
  history = new Float32Array(0);
  private legalCache = new Uint8Array(0); private legalStamp = new Int32Array(0);
  private run = 0;

  /**
   * Search from `src` states to any state where `goal` is true. States are L*N + c.
   * soft: foreign (non-hard) copper allowed at a penalty; the nets crossed are reported for rip-up.
   */
  search(net: string, src: number[], goal: (s: number) => boolean, target: Pt | null, opts: { soft?: boolean; maxCost?: number; viaGoal?: boolean; box?: { x0: number; y0: number; x1: number; y1: number } } = {}) {
    const S = NL * this.N;
    if (this.g.length !== S) {
      this.g = new Float32Array(S); this.from = new Int32Array(S); this.stamp = new Int32Array(S);
      this.legalCache = new Uint8Array(S); this.legalStamp = new Int32Array(S);
      if (this.history.length !== S) this.history = new Float32Array(S);
    }
    const run = ++this.run, n = this.id(net), cls = netClass(net);
    const { g, from, stamp, legalCache, legalStamp } = this;
    const neck = this.neckZone(net, cls);
    const halfW = (s: number) => (neck && neck.has(s % this.N) ? cls.neck! : cls.width) / 2;
    const layerCost = [1.3, 1.0, 1.15]; // top is for fan-out; inner signal layer preferred
    const viaCost = 25, turnCost = 0.3, softCost = 12;
    const bx0 = opts.box ? Math.floor(opts.box.x0 / this.pitch) : 0, bx1 = opts.box ? Math.ceil(opts.box.x1 / this.pitch) : this.nx;
    const by0 = opts.box ? Math.floor(opts.box.y0 / this.pitch) : 0, by1 = opts.box ? Math.ceil(opts.box.y1 / this.pitch) : this.ny;
    const isLegal = (s: number): number => { // 1 legal, 2 soft-legal, 0 illegal
      if (legalStamp[s] === run) return legalCache[s];
      const L = Math.floor(s / this.N), c = s % this.N, own = this.own[L], hard = this.hard[L];
      let res = 1;
      this.disk(c, halfW(s) + cls.halfClear, c2 => {
        const o = own[c2];
        if (o === 0 || o === n) return;
        if (opts.soft && o > 0 && !hard[c2]) { res = 2; return; } // plane fan-out may be ripped too: it is re-fanned afterwards
        res = 0; return false;
      });
      legalStamp[s] = run; legalCache[s] = res; return res;
    };
    const tx = target ? target.x / this.pitch : 0, ty = target ? target.y / this.pitch : 0;
    const HW = 1.2; // weighted A*: slightly greedy, much faster, near-optimal
    const h = (c: number) => {
      if (!target) return 0;
      const dx = Math.abs((c % this.nx) + 0.5 - tx), dy = Math.abs(Math.floor(c / this.nx) + 0.5 - ty);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    const heap = new Heap();
    for (const s of src) { stamp[s] = run; g[s] = 0; from[s] = -1; heap.push(h(s % this.N) * HW, s); }
    const dirs = [1, -1, this.nx, -this.nx, this.nx + 1, this.nx - 1, -this.nx + 1, -this.nx - 1];
    const dcost = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
    let found = -1, pops = 0;
    while (heap.size) {
      const s = heap.pop(), key = heap.lastKey;
      const gs = g[s];
      if (key > gs + h(s % this.N) * HW + 1e-4) continue; // stale entry
      pops++;
      if (opts.maxCost && gs > opts.maxCost) break;
      if (goal(s)) { found = s; break; }
      if (pops > 3_000_000) break;
      const L = Math.floor(s / this.N), c = s % this.N, x = c % this.nx;
      const prev = from[s], pd = prev >= 0 && Math.floor(prev / this.N) === L ? c - (prev % this.N) : 0;
      for (let k = 0; k < 8; k++) {
        const d = dirs[k], c2 = c + d, x2 = c2 % this.nx;
        if (c2 < 0 || c2 >= this.N || Math.abs(x2 - x) > 1) continue;
        if (opts.box) { const y2 = Math.floor(c2 / this.nx); if (x2 < bx0 || x2 > bx1 || y2 < by0 || y2 > by1) continue; }
        const s2 = L * this.N + c2;
        const lg = isLegal(s2); if (!lg) continue;
        const ng = gs + dcost[k] * layerCost[L] + (pd && pd !== d ? turnCost : 0) + (lg === 2 ? softCost : 0) + this.history[s2];
        if (stamp[s2] !== run || ng < g[s2]) { stamp[s2] = run; g[s2] = ng; from[s2] = s; heap.push(ng + h(c2) * HW, s2); }
      }
      // vias
      let vlegal = -1;
      for (let L2 = 0; L2 < NL; L2++) {
        if (L2 === L) continue;
        const s2 = L2 * this.N + c;
        const ng = gs + viaCost;
        if (stamp[s2] === run && g[s2] <= ng) continue;
        if (vlegal < 0) vlegal = this.viaLegal(c, n, cls.halfClear) ? 1 : 0;
        if (!vlegal) break;
        stamp[s2] = run; g[s2] = ng; from[s2] = s; heap.push(ng + h(c) * HW, s2);
      }
    }
    if (found < 0) return null;
    // unwind into per-layer paths + via cells
    const states: number[] = [];
    for (let s = found; s >= 0; s = from[s]) states.push(s);
    states.reverse();
    const paths: Path[] = []; const vias: number[] = []; const crossed = new Set<number>();
    let cur: Path | null = null;
    for (let i = 0; i < states.length; i++) {
      const s = states[i], L = Math.floor(s / this.N), c = s % this.N;
      if (cur && cur.layer !== L) { vias.push(c); paths.push(cur); cur = null; }
      if (!cur) cur = { layer: L, cells: [], width: [] };
      cur.cells.push(c); cur.width.push(2 * halfW(s));
      if (opts.soft) {
        let hit = false;
        this.disk(c, halfW(s) + cls.halfClear, c2 => { const o = this.own[L][c2]; if (o > 0 && o !== n) { crossed.add(o); hit = true; } });
        if (hit) this.disk(c, 0.5, c2 => { this.history[L * this.N + c2] += 3; });
      }
    }
    if (cur) paths.push(cur);
    return { paths, vias, crossed: [...crossed].map(i => this.netName[i]), end: found };
  }

  private neckCache = new Map<string, Set<number>>();
  /** Cells within 1 mm of this net's own small pads: wide nets neck down here. */
  private neckZone(net: string, cls: NetClass) {
    if (!cls.neck || cls.neck >= cls.width) return null;
    let z = this.neckCache.get(net);
    if (z) return z;
    z = new Set();
    for (const p of this.pads) {
      if (p.net !== net) continue;
      const small = Math.min(p.w, p.h) < cls.width + 0.1;
      if (!small) continue;
      const ext = 1.0 + Math.max(p.w, p.h) / 2;
      const c0 = this.cell(p.c.x, p.c.y);
      this.disk(c0, ext, c => { z!.add(c); });
    }
    this.neckCache.set(net, z);
    return z;
  }

  // ───────────────────────── net-level routing ─────────────────────────
  padStates(p: WPad): number[] {
    const out: number[] = [], n = this.id(p.net);
    const bb = bboxOf(p.poly);
    for (const L of this.padLayers(p)) {
      for (let y = Math.floor(bb.y0 / this.pitch); y <= Math.ceil(bb.y1 / this.pitch); y++)
        for (let x = Math.floor(bb.x0 / this.pitch); x <= Math.ceil(bb.x1 / this.pitch); x++) {
          const c = y * this.nx + x;
          if (c >= 0 && c < this.N && this.core[L][c] === n) out.push(L * this.N + c);
        }
    }
    if (!out.length) { const c = this.cell(p.c.x, p.c.y); for (const L of this.padLayers(p)) out.push(L * this.N + c); }
    return out;
  }

  /** GND / plane nets: every pad drops a via into the planes (in-pad for large pads) or reuses a nearby GND via. */
  fanoutPlane(net: string): string[] {
    const n = this.id(net), r = this.routed.get(net) ?? { net, paths: [], vias: [], failed: 0 };
    this.routed.set(net, r); r.failed = 0;
    const toRip = new Set<string>();
    const cls = netClass(net);
    for (const p of this.pads.filter(p => p.net === net)) {
      if (p.layer === "multi") continue; // through-hole pad already reaches the planes
      const big = p.w * p.h >= 1.0;
      const src = this.padStates(p);
      const goal = (s: number) => {
        const c = s % this.N, L = Math.floor(s / this.N);
        if (L === 0 && this.core[0][c] === n && !src.includes(s) && this.isViaCore(net, c)) return true; // existing GND via
        if (this.insideAnyPadCore(c)) {
          if (!big) return false;
          const q = { x: this.cx(c), y: this.cy(c) }; // via-in-pad: the whole via must sit inside the pad
          if (!pointInPoly(q, p.poly) || edgeDist(q, p.poly) < RULES.viaDia / 2 + 0.02) return false;
        }
        return this.viaLegal(c, n, cls.halfClear);
      };
      const res = this.search(net, src, goal, null, { maxCost: 40 }) ?? this.search(net, src, goal, null, { maxCost: 250 });
      if (res) {
        for (const pth of res.paths) this.commit(net, pth);
        for (const v of res.vias) if (!this.isViaCore(net, v)) this.commitVia(net, v); // layer changes on the way
        const endC = res.end % this.N;
        if (!this.isViaCore(net, endC)) this.commitVia(net, endC);
        continue;
      }
      // last resort: route to any existing copper of this net (other pads, stubs, vias), ripping what's in the way
      const mine = new Set(src);
      const tree = (s: number) => { const L = Math.floor(s / this.N), c = s % this.N; return this.core[L][c] === n && !mine.has(s); };
      const res2 = this.search(net, src, tree, null, { maxCost: 400 }) ?? this.search(net, src, tree, null, { soft: true, maxCost: 400 });
      if (!res2) { r.failed++; continue; }
      for (const x of res2.crossed) { if (x !== net) { this.ripUp(x); toRip.add(x); } }
      for (const pth of res2.paths) this.commit(net, pth);
      for (const v of res2.vias) this.commitVia(net, v);
    }
    return [...toRip];
  }
  private viaCores = new Map<string, Set<number>>();
  isViaCore(net: string, c: number) { return this.routed.get(net)?.vias.includes(c) ?? false; }
  private padCoreAny: Uint8Array | null = null;
  insideAnyPadCore(c: number) {
    if (!this.padCoreAny) {
      this.padCoreAny = new Uint8Array(this.N);
      for (const p of this.pads) if (p.layer !== "multi") {
        const bb = bboxOf(p.poly);
        for (let y = Math.floor((bb.y0 - 0.3) / this.pitch); y <= Math.ceil((bb.y1 + 0.3) / this.pitch); y++)
          for (let x = Math.floor((bb.x0 - 0.3) / this.pitch); x <= Math.ceil((bb.x1 + 0.3) / this.pitch); x++) {
            const cc = y * this.nx + x; if (cc < 0 || cc >= this.N) continue;
            if (distPtPoly({ x: (x + 0.5) * this.pitch, y: (y + 0.5) * this.pitch }, p.poly) < RULES.viaDia / 2) this.padCoreAny[cc] = 1;
          }
      }
    }
    return this.padCoreAny[c] === 1;
  }

  /** Route one signal net as an incrementally grown tree (MST order). Returns nets to rip up, if any. */
  routeNet(net: string, soft = false): string[] {
    const pads = this.pads.filter(p => p.net === net);
    const r: RoutedNet = this.routed.get(net) ?? { net, paths: [], vias: [], failed: 0 };
    this.routed.set(net, r); r.failed = 0;
    if (pads.length < 2) return [];
    const n = this.id(net);
    const order = mstOrder(pads.map(p => p.c));
    const inTree = new Set<number>([order[0]]);
    const toRip = new Set<string>();
    // cells of pads not yet joined: reaching them is NOT reaching the tree
    const padCells = pads.map(p => new Set(this.padStates(p)));
    const outside = new Set<number>();
    pads.forEach((_, j) => { if (!inTree.has(j)) for (const s of padCells[j]) outside.add(s); });
    for (let k = 1; k < order.length; k++) {
      const i = order[k], p = pads[i];
      const treePads = [...inTree].map(j => pads[j]);
      const mine = padCells[i];
      const goal = (s: number) => { const L = Math.floor(s / this.N), c = s % this.N; return this.core[L][c] === n && !outside.has(s); };
      const nearest = treePads.reduce((a, q) => (Math.hypot(q.c.x - p.c.x, q.c.y - p.c.y) < Math.hypot(a.c.x - p.c.x, a.c.y - p.c.y) ? q : a));
      // local window first (fast, keeps routes compact), then the whole board
      const m = Math.max(8, 0.5 * Math.hypot(p.c.x - nearest.c.x, p.c.y - nearest.c.y));
      const box = { x0: Math.min(p.c.x, nearest.c.x) - m, y0: Math.min(p.c.y, nearest.c.y) - m, x1: Math.max(p.c.x, nearest.c.x) + m, y1: Math.max(p.c.y, nearest.c.y) + m };
      let res = this.search(net, [...mine], goal, nearest.c, { box }) ?? this.search(net, [...mine], goal, nearest.c);
      if (!res && soft) {
        res = this.search(net, [...mine], goal, nearest.c, { soft: true, box }) ?? this.search(net, [...mine], goal, nearest.c, { soft: true });
        if (res) for (const x of res.crossed) toRip.add(x);
      }
      if (!res) { r.failed++; continue; }
      if (res.crossed.length) { for (const x of res.crossed) this.ripUp(x); }
      for (const pth of res.paths) this.commit(net, pth);
      for (const v of res.vias) this.commitVia(net, v);
      inTree.add(i);
      for (const s2 of mine) outside.delete(s2);
    }
    return [...toRip];
  }
}

function mstOrder(pts: Pt[]): number[] {
  const edges = mst(pts), adj = new Map<number, number[]>();
  for (const [a, b] of edges) { (adj.get(a) ?? adj.set(a, []).get(a)!).push(b); (adj.get(b) ?? adj.set(b, []).get(b)!).push(a); }
  const out: number[] = [0], seen = new Set([0]);
  for (let i = 0; i < out.length; i++) for (const j of adj.get(out[i]) ?? []) if (!seen.has(j)) { seen.add(j); out.push(j); }
  return out;
}

class Heap {
  k = new Float64Array(1 << 16); v = new Int32Array(1 << 16); size = 0; lastKey = 0;
  push(key: number, val: number) {
    if (this.size === this.k.length) { const k = new Float64Array(this.size * 2); k.set(this.k); this.k = k; const v = new Int32Array(this.size * 2); v.set(this.v); this.v = v; }
    let i = this.size++;
    while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; }
    this.k[i] = key; this.v[i] = val;
  }
  pop(): number {
    const top = this.v[0]; this.lastKey = this.k[0];
    const key = this.k[--this.size], val = this.v[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.size) break;
      if (c + 1 < this.size && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= key) break;
      this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c;
    }
    this.k[i] = key; this.v[i] = val;
    return top;
  }
}

function edgeDist(p: Pt, poly: Pt[]) { let m = Infinity; for (let i = 0; i < poly.length; i++) m = Math.min(m, distPtSeg(p, poly[i], poly[(i + 1) % poly.length])); return m; }
