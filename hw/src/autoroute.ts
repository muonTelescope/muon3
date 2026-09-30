// Routing driver: GND fan-out, then nets by priority, then rip-up/re-route until stable.
import { Router, PLANE, netClass } from "./router.ts";
import type { Board, WPad } from "./board.ts";
import { mst } from "./svg.ts";

const PRIORITY: [RegExp, number][] = [
  [/^(SIG|TIA|VREFF|VTHF|CMP)\d$/, 0],        // analog front end: shortest, most sensitive
  [/^(HV|HV_\w+|HVJ\d)$/, 1],                  // bias
  [/^INJ$/, 1],                                 // charge-injection step to the far probe row
  [/^5V$/, 2],                                  // USB supply
  [/^(3V3|3V3A)$/, 3],
  [/^USB_D[PN]$/, 4],
];

type Cells = { groups: string[]; pitch: number };

export function autoroute(b: Board, keepouts: { x0: number; y0: number; x1: number; y1: number }[], cells?: Cells, log = console.log) {
  const t0 = performance.now();
  const r = new Router(b, keepouts, 0.1);
  if (cells) routeCells(b, r, cells, log);
  for (const net of PLANE) r.fanoutPlane(net); // nothing else is routed yet, so nothing to rip
  log(`  GND fan-out: ${r.routed.get("GND")?.vias.length} vias, ${r.routed.get("GND")?.failed} pads failed (${((performance.now() - t0) / 1000).toFixed(1)} s)`);

  const byNet = new Map<string, { x: number; y: number }[]>();
  for (const p of r.pads) if (!PLANE.has(p.net) && !p.net.startsWith("NC") && !r.isLocked(p.net)) (byNet.get(p.net) ?? byNet.set(p.net, []).get(p.net)!).push(p.c);
  const length = (pts: { x: number; y: number }[]) => mst(pts).reduce((s, [i, j]) => s + Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y), 0);
  // very short nets (pin → its local cap/resistor) have no alternatives: they go first
  const prio = (n: string) => (length(byNet.get(n)!) < 3 ? -1 : PRIORITY.find(([re]) => re.test(n))?.[1] ?? 5);
  const queue = [...byNet.keys()].filter(n => byNet.get(n)!.length > 1)
    .sort((a, c) => prio(a) - prio(c) || length(byNet.get(a)!) - length(byNet.get(c)!));

  const rips = new Map<string, number>();
  let pass = 0;
  while (queue.length && pass < 4000) {
    pass++;
    const net = queue.shift()!;
    r.ripUp(net);
    const soft = (rips.get(net) ?? 0) < 25;
    const ripped = r.routeNet(net, soft);
    for (const x of ripped) {
      rips.set(x, (rips.get(x) ?? 0) + 1);
      if (PLANE.has(x)) { // re-drop every plane via around the new copper
        r.ripUp(x);
        for (const y of r.fanoutPlane(x)) if (!queue.includes(y)) queue.push(y);
        continue;
      }
      if (!queue.includes(x)) queue.push(x);
    }
  }
  const failed = [...r.routed.values()].filter(x => x.failed > 0);
  log(`  routed ${byNet.size} nets in ${pass} passes, ${failed.length} with open connections (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  for (const f of failed) log(`    open: ${f.net} (${f.failed})`);
  return r;
}

export { netClass };

/**
 * Identical channel cells. Cell 0's plane fan-out and its local nets (every pad inside cell 0) are routed first, then
 * copied into cells 1..n at k·pitch and locked. A copy that would be illegal anywhere is reported, and that net falls
 * back to normal routing, so the log states exactly what is and isn't identical.
 */
function routeCells(b: Board, r: Router, cells: Cells, log: (s: string) => void) {
  const group = new Map(b.parts.map(p => [p.ref, p.group]));
  const inCell = (p: WPad, k: number) => group.get(p.ref) === cells.groups[k];
  const d = (k: number) => Math.round((cells.pitch * k) / r.pitch);                  // x shift in grid cells
  // net correspondence cell 0 -> cell k by (part index in group, pad number)
  const partsOf = (g: string) => b.parts.filter(p => p.group === g);
  const netMap = (k: number) => {
    const m = new Map<string, string>(), a = partsOf(cells.groups[0]), c = partsOf(cells.groups[k]);
    a.forEach((p, i) => { for (const [num, net] of Object.entries(p.pads)) m.set(net, c[i].pads[num]); });
    return m;
  };
  // 1) plane fan-out of cell 0, copied
  for (const net of PLANE) {
    const rn = r.routed.get(net) ?? { net, paths: [], vias: [], failed: 0 }; r.routed.set(net, rn);
    const p0 = rn.paths.length, v0 = rn.vias.length;
    r.fanoutPlane(net, p => inCell(p, 0));
    const paths = rn.paths.slice(p0), vias = rn.vias.slice(v0);
    r.lock(net, paths, vias);
    for (const p of r.pads) if (p.net === net && group.get(p.ref) && cells.groups.includes(group.get(p.ref)!)) r.lockedPads.add(p);
    for (let k = 1; k < cells.groups.length; k++)
      if (!r.replicate(paths, vias, net, d(k))) { log(`  cells: ${net} fan-out of cell ${k} NOT identical (copy blocked)`); for (const p of r.pads) if (p.net === net && inCell(p, k)) r.lockedPads.delete(p); }
  }
  // 2) local nets of cell 0 (all pads inside the cell), shortest first, copied
  const local = [...new Set(r.pads.filter(p => inCell(p, 0)).map(p => p.net))]
    .filter(n => !PLANE.has(n) && !n.startsWith("NC") && r.pads.filter(p => p.net === n).every(p => inCell(p, 0)));
  const maps = cells.groups.map((_, k) => (k ? netMap(k) : null));
  let copied = 0;
  for (const net of local) {
    r.routeNet(net);
    const rn = r.routed.get(net)!;
    if (rn.failed) { log(`  cells: ${net} open in cell 0`); continue; }
    r.lock(net, rn.paths.slice(), rn.vias.slice());
    for (let k = 1; k < cells.groups.length; k++) {
      const dst = maps[k]!.get(net)!;
      if (r.replicate(rn.paths, rn.vias, dst, d(k))) copied++;
      else log(`  cells: ${dst} NOT identical (copy blocked) — routed normally`);
    }
  }
  log(`  cells: ${local.length} local nets × ${cells.groups.length} cells, ${copied}/${local.length * (cells.groups.length - 1)} copies identical`);
}
