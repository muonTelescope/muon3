// Placement: fixed edge parts + group anchors (human floorplan) -> force-directed refinement -> legalisation.
import type { Board } from "./board.ts";
import type { Part } from "./circuit.ts";
import { apply, pt, type Pt } from "./geom.ts";

export type Anchor = { x: number; y: number; r?: number }; // group centre and soft radius
export type Floorplan = {
  fixed: Record<string, { x: number; y: number; rot: number }>; // ref -> pose
  groups: Record<string, Anchor>;
  keepouts: { x0: number; y0: number; x1: number; y1: number; why: string }[];
};

type Box = { x0: number; y0: number; x1: number; y1: number };

/** Axis-aligned courtyard for a part at a candidate pose (rotations are multiples of 90°). */
function boxAt(p: Part, x: number, y: number, rot: number, m = 0.2): Box {
  const b = p.info.footprint.bbox;
  const cs = [pt(b.x0, b.y0), pt(b.x1, b.y0), pt(b.x1, b.y1), pt(b.x0, b.y1)].map(q => apply({ x, y, rot }, q));
  return {
    x0: Math.min(...cs.map(c => c.x)) - m, y0: Math.min(...cs.map(c => c.y)) - m,
    x1: Math.max(...cs.map(c => c.x)) + m, y1: Math.max(...cs.map(c => c.y)) + m,
  };
}
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** Nets that are planes/pours: they don't pull placement. */
export const PLANE_NETS = new Set(["GND", "3V3", "3V3A", "VSYS", "1V2", "VBAT", "HV"]);

export function place(b: Board, fp: Floorplan, iters = 400) {
  const parts = b.parts;
  const fixed = new Set(Object.keys(fp.fixed));
  // 1) fixed parts
  for (const p of parts) {
    const f = fp.fixed[p.ref];
    if (f) p.place = { ...f, side: "top", locked: true };
  }
  // 2) seed movable parts at their group anchor (small spiral so they don't start coincident)
  const byGroup = new Map<string, Part[]>();
  for (const p of parts) if (!fixed.has(p.ref)) { const g = byGroup.get(p.group) ?? []; g.push(p); byGroup.set(p.group, g); }
  for (const [g, ps] of byGroup) {
    const a = fp.groups[g] ?? { x: b.w / 2, y: b.h / 2 };
    ps.forEach((p, i) => { const t = i * 2.4, r = 0.8 * Math.sqrt(i); p.place = { x: a.x + r * Math.cos(t), y: a.y + r * Math.sin(t), rot: 0, side: "top" }; });
  }
  const movable = parts.filter(p => !fixed.has(p.ref));

  // net membership: part -> pins with local pad offsets
  const netPins = new Map<string, { p: Part; off: Pt }[]>();
  for (const p of parts) for (const pd of p.info.footprint.pads) {
    const net = p.pads[pd.num]; if (!net || net.startsWith("NC") || PLANE_NETS.has(net)) continue;
    const l = netPins.get(net) ?? []; l.push({ p, off: pt(pd.x, pd.y) }); netPins.set(net, l);
  }
  // rail pins pull only within the same group (decoupling caps sit on their IC's pin)
  const railPins = new Map<string, { p: Part; off: Pt }[]>();
  for (const p of parts) for (const pd of p.info.footprint.pads) {
    const net = p.pads[pd.num]; if (!net || !PLANE_NETS.has(net) || net === "GND") continue;
    const k = net + "|" + p.group; const l = railPins.get(k) ?? []; l.push({ p, off: pt(pd.x, pd.y) }); railPins.set(k, l);
  }
  const world = (q: { p: Part; off: Pt }) => apply(q.p.place!, q.off);

  const inBoard = (bx: Box) => bx.x0 >= 0.5 && bx.y0 >= 0.5 && bx.x1 <= b.w - 0.5 && bx.y1 <= b.h - 0.5;
  const fixedBoxes = () => [...parts.filter(p => fixed.has(p.ref)).map(p => boxAt(p, p.place!.x, p.place!.y, p.place!.rot)), ...fp.keepouts];

  for (let it = 0; it < iters; it++) {
    const T = 1 - it / iters; // cooling
    const force = new Map<Part, Pt>(movable.map(p => [p, pt(0, 0)]));
    const pull = (pins: { p: Part; off: Pt }[], k: number) => {
      if (pins.length < 2) return;
      const ws = pins.map(world);
      const cx = ws.reduce((s, w) => s + w.x, 0) / ws.length, cy = ws.reduce((s, w) => s + w.y, 0) / ws.length;
      const kk = k / Math.max(1, pins.length - 1);
      pins.forEach((q, i) => { const f = force.get(q.p); if (f) { f.x += (cx - ws[i].x) * kk; f.y += (cy - ws[i].y) * kk; } });
    };
    // nets inside one group pull hard (tight clusters); nets between groups pull gently (floorplan wins)
    for (const pins of netPins.values()) pull(pins, pins.every(q => q.p.group === pins[0].p.group) ? 1 : 0.12);
    for (const pins of railPins.values()) pull(pins, 0.8);
    for (const p of movable) { const a = fp.groups[p.group]; if (a) { const f = force.get(p)!; f.x += (a.x - p.place!.x) * 0.2; f.y += (a.y - p.place!.y) * 0.2; } }
    // overlap repulsion
    const boxes = movable.map(p => boxAt(p, p.place!.x, p.place!.y, p.place!.rot));
    const fb = fixedBoxes();
    for (let i = 0; i < movable.length; i++) {
      const bi = boxes[i];
      for (let j = i + 1; j < movable.length; j++) {
        const bj = boxes[j]; if (!overlap(bi, bj)) continue;
        const dx = (bi.x0 + bi.x1 - bj.x0 - bj.x1) / 2, dy = (bi.y0 + bi.y1 - bj.y0 - bj.y1) / 2;
        const ox = Math.min(bi.x1, bj.x1) - Math.max(bi.x0, bj.x0), oy = Math.min(bi.y1, bj.y1) - Math.max(bi.y0, bj.y0);
        const fi = force.get(movable[i])!, fj = force.get(movable[j])!;
        if (ox < oy) { const s = Math.sign(dx || 1) * ox * 0.6; fi.x += s; fj.x -= s; } else { const s = Math.sign(dy || 1) * oy * 0.6; fi.y += s; fj.y -= s; }
      }
      for (const f of fb) {
        if (!overlap(bi, f)) continue;
        const dx = (bi.x0 + bi.x1 - f.x0 - f.x1) / 2, dy = (bi.y0 + bi.y1 - f.y0 - f.y1) / 2;
        const ox = Math.min(bi.x1, f.x1) - Math.max(bi.x0, f.x0), oy = Math.min(bi.y1, f.y1) - Math.max(bi.y0, f.y0);
        const fi = force.get(movable[i])!;
        if (ox < oy) fi.x += Math.sign(dx || 1) * ox * 1.2; else fi.y += Math.sign(dy || 1) * oy * 1.2;
      }
    }
    for (const p of movable) {
      const f = force.get(p)!, step = 0.5 + 2 * T;
      const m = Math.hypot(f.x, f.y);
      const s = m > step ? step / m : 1;
      p.place!.x += f.x * s; p.place!.y += f.y * s;
      const bx = boxAt(p, p.place!.x, p.place!.y, p.place!.rot);
      if (bx.x0 < 0.5) p.place!.x += 0.5 - bx.x0; if (bx.x1 > b.w - 0.5) p.place!.x -= bx.x1 - (b.w - 0.5);
      if (bx.y0 < 0.5) p.place!.y += 0.5 - bx.y0; if (bx.y1 > b.h - 0.5) p.place!.y -= bx.y1 - (b.h - 0.5);
    }
    // try rotations for two-pin parts every 50 iterations: pick the one with shortest pin-to-centroid sum
    if (it % 50 === 49) for (const p of movable) bestRotation(p, netPins, railPins);
  }
  legalise(b, movable, fixedBoxes(), inBoard);
  for (const p of movable) { p.place!.x = Math.round(p.place!.x * 20) / 20; p.place!.y = Math.round(p.place!.y * 20) / 20; }
}

function bestRotation(p: Part, ...maps: Map<string, { p: Part; off: Pt }[]>[]) {
  let best = p.place!.rot, bestCost = Infinity;
  for (const rot of [0, 90, 180, 270]) {
    p.place!.rot = rot;
    let cost = 0;
    for (const m of maps) for (const pins of m.values()) {
      if (!pins.some(q => q.p === p) || pins.length < 2) continue;
      const ws = pins.map(q => apply(q.p.place!, q.off));
      const cx = ws.reduce((s, w) => s + w.x, 0) / ws.length, cy = ws.reduce((s, w) => s + w.y, 0) / ws.length;
      pins.forEach((q, i) => { if (q.p === p) cost += Math.hypot(ws[i].x - cx, ws[i].y - cy); });
    }
    if (cost < bestCost - 1e-6) { bestCost = cost; best = rot; }
  }
  p.place!.rot = best;
}

/** Greedy legalisation: largest parts first, each moved to the nearest free spot on a 0.25 mm spiral. */
function legalise(b: Board, movable: Part[], fixedBoxes: Box[], inBoard: (bx: Box) => boolean) {
  const placed: Box[] = [...fixedBoxes];
  const area = (p: Part) => { const x = p.info.footprint.bbox; return (x.x1 - x.x0) * (x.y1 - x.y0); };
  for (const p of [...movable].sort((a, c) => area(c) - area(a))) {
    const { x, y, rot } = p.place!;
    let done = false;
    for (let r = 0; r < 40 && !done; r += 0.25) {
      const n = Math.max(1, Math.round((2 * Math.PI * r) / 0.25));
      for (let k = 0; k < n && !done; k++) {
        const nx = x + r * Math.cos((2 * Math.PI * k) / n), ny = y + r * Math.sin((2 * Math.PI * k) / n);
        const bx = boxAt(p, nx, ny, rot);
        if (inBoard(bx) && !placed.some(q => overlap(bx, q) > 1e-9)) { p.place!.x = nx; p.place!.y = ny; placed.push(bx); done = true; }
      }
    }
    if (!done) console.warn(`legalise: no room for ${p.ref} (${p.group})`);
  }
}
