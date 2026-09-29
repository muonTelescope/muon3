// Routing driver: GND fan-out, then nets by priority, then rip-up/re-route until stable.
import { Router, PLANE, netClass } from "./router.ts";
import type { Board } from "./board.ts";
import { mst } from "./svg.ts";

const PRIORITY: [RegExp, number][] = [
  [/^(SIG|TIA|VREFF|VTHF|CMP)\d$/, 0],        // analog front end: shortest, most sensitive
  [/^(HV|HV_\w+|HVJ\d)$/, 1],                  // bias
  [/^(VBUS|PMID|CHG_SW|VSYS|VBAT|CELL\d_P)$/, 2], // high current
  [/^(3V3|3V3A|1V2|1V2_PLL|REGN)$/, 3],
  [/^USB_D[PN]$/, 4],
];

export function autoroute(b: Board, keepouts: { x0: number; y0: number; x1: number; y1: number }[], log = console.log) {
  const t0 = performance.now();
  const r = new Router(b, keepouts, 0.1);
  for (const net of PLANE) r.fanoutPlane(net); // nothing else is routed yet, so nothing to rip
  log(`  GND fan-out: ${r.routed.get("GND")?.vias.length} vias, ${r.routed.get("GND")?.failed} pads failed (${((performance.now() - t0) / 1000).toFixed(1)} s)`);

  const byNet = new Map<string, { x: number; y: number }[]>();
  for (const p of r.pads) if (!PLANE.has(p.net) && !p.net.startsWith("NC")) (byNet.get(p.net) ?? byNet.set(p.net, []).get(p.net)!).push(p.c);
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
