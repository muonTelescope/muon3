// FPGA pin swapping: generic iCE40 I/O nets move to whichever free I/O pad is nearest their far end.
import type { Board } from "./board.ts";
import type { Part } from "./circuit.ts";
import { apply, pt } from "./geom.ts";

const FIXED = /SPI_|CDONE|creset|VCC|VPP|GND|EP|G0/; // config/SPI/clock/power pads never move; RGB0-2 are open-drain sinks, excluded

export function swapPins(b: Board, ref: string, nets: RegExp) {
  const u = b.parts.find(p => p.ref === ref) as Part;
  const pads = u.info.footprint.pads;
  const io = pads.filter(pd => /^IO[BT]_/.test(u.info.pins[pd.num] ?? "") && !FIXED.test(u.info.pins[pd.num]));
  const pos = (num: string) => { const pd = pads.find(q => q.num === num)!; return apply(u.place!, pt(pd.x, pd.y)); };
  const movable = Object.entries(u.pads).filter(([, n]) => nets.test(n));
  // far end of each net = centroid of the net's other pads
  const target = new Map<string, { x: number; y: number }>();
  for (const [, net] of movable) {
    const others = b.parts.flatMap(p => p === u ? [] : Object.entries(p.pads).filter(([, n]) => n === net).map(([num]) => {
      const pd = p.info.footprint.pads.find(q => q.num === num)!; return apply(p.place!, pt(pd.x, pd.y));
    }));
    target.set(net, { x: others.reduce((s, q) => s + q.x, 0) / others.length, y: others.reduce((s, q) => s + q.y, 0) / others.length });
  }
  const free = new Set(io.filter(pd => !u.pads[pd.num] || nets.test(u.pads[pd.num])).map(pd => pd.num));
  for (const [num] of movable) delete u.pads[num];
  // greedy global assignment: repeatedly take the shortest remaining (net, pad) pair
  const todo = new Set(movable.map(([, n]) => n));
  const moves: string[] = [];
  while (todo.size) {
    let best: [string, string, number] | null = null;
    for (const net of todo) for (const num of free) {
      const p = pos(num), t = target.get(net)!, d = Math.hypot(p.x - t.x, p.y - t.y);
      if (!best || d < best[2]) best = [net, num, d];
    }
    const [net, num] = best!;
    u.pads[num] = net; free.delete(num); todo.delete(net);
    moves.push(`${net}→${num}(${u.info.pins[num]})`);
  }
  return moves;
}
