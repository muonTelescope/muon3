// BOM + landed-cost model for N stations shipped to Berlin and the US.
// JLC fee structure and freight/duty rates below are assumptions: edit here, everything else is computed.
import { build } from "../src/design.ts";
import { search, priceAt } from "./jlc.ts";

export const FEES = {
  pcbaSetup: 8.0,            // per order and side
  stencil: 1.5,              // per side
  extendedLoading: 3.0,      // per unique extended part per order (basic + preferred-extended: 0)
  perJoint: 0.0017,
  thtSetup: 3.5, thtJoint: 0.02,                                           // [EST] JLC THT hand/wave solder
  pcb4L: (areaCm2: number, qty: number) => 12 + 0.045 * areaCm2 * qty,       // [EST] JLC 4-layer 1.6 mm — confirm with quote
  pcb6L: (areaCm2: number, qty: number) => 30 + 0.12 * areaCm2 * qty,       // [EST]
  ship: { proto: 25, production: 45 },                                    // [EST] DHL, 0.5 kg / ~3 kg
  importVAT: { EU: 0.19, US: 0 },
  // US units ship to GSU (importer of record). China-origin PCBA tariff stack is volatile [EST 45 %];
  // GSU procurement should check HTS 9810.00.60 (scientific instruments for non-profit institutions) eligibility.
  duty: { EU: 0.0, US: 0.45 },
};

type Order = { name: string; pcbs: number; assembled: number; dest: "EU" | "US"; ship: number };

async function main() {
  const { W, H } = await import("../src/floorplan.ts");
  const { LAYERS } = await import("../src/board.ts");
  const area = Number(process.env.AREA_CM2 ?? (W * H) / 100);
  const c = await build();
  const lines = new Map<string, { lcsc: string; mpn: string; refs: string[] }>();
  for (const p of c.parts) {
    const l = lines.get(p.lcsc) ?? { lcsc: p.lcsc, mpn: p.value, refs: [] };
    l.refs.push(p.ref); lines.set(p.lcsc, l);
  }
  let joints = 0, tht = 0, bottomSide = false;
  for (const p of c.parts) {
    joints += p.info.footprint.pads.length;
    tht += p.info.footprint.pads.filter(q => q.layer === "multi" && !/TYPE-C/.test(p.info.mpn)).length;
    if (p.info.footprint.pads.some(q => q.layer === "bottom")) bottomSide = true;
  }
  const hits = new Map<string, Awaited<ReturnType<typeof search>>[number] | undefined>();
  for (const l of lines.values()) hits.set(l.lcsc, (await search(l.lcsc)).find(x => "C" + x.lcsc === l.lcsc));
  const extended = [...lines.values()].filter(l => { const h = hits.get(l.lcsc); return !h?.is_basic && !h?.is_preferred; }).length;
  const sides = bottomSide ? 2 : 1;
  const pcbPrice = LAYERS.length === 4 ? FEES.pcb4L : FEES.pcb6L;

  const cost = (o: Order) => {
    let parts = 0; const short: string[] = [];
    for (const l of lines.values()) {
      const h = hits.get(l.lcsc), n = l.refs.length * o.assembled;
      parts += (h ? priceAt(h, n) : 0) * n;
      if (h && h.stock < n * 1.1) short.push(`${l.mpn} (${h.stock} < ${n})`);
    }
    const pcb = pcbPrice(area, o.pcbs);
    const pcba = (FEES.pcbaSetup + FEES.stencil) * sides + extended * FEES.extendedLoading + joints * o.assembled * FEES.perJoint
      + (tht ? FEES.thtSetup + tht * o.assembled * FEES.thtJoint : 0);
    const exw = parts + pcb + pcba;
    const landed = (exw + o.ship) * (1 + FEES.duty[o.dest]) * (1 + FEES.importVAT[o.dest]);
    const dutyFree = (exw + o.ship) * (1 + FEES.importVAT[o.dest]);
    return { parts, pcb, pcba, exw, landed, dutyFree, short };
  };

  const orders: Order[] = [
    { name: "Prototype → Berlin", pcbs: 5, assembled: 2, dest: "EU", ship: FEES.ship.proto },
    { name: "Production → GSU", pcbs: 100, assembled: 100, dest: "US", ship: FEES.ship.production },
  ];
  console.log(`${W}×${H} mm, ${LAYERS.length} layers, ${c.parts.length} placements, ${lines.size} LCSC lines (${extended} extended), ${joints} joints/board${sides === 2 ? ", two-sided (edge-SMA tabs)" : ""}`);
  for (const o of orders) {
    const r = cost(o);
    console.log(`${o.name}: ${o.assembled} boards  parts $${r.parts.toFixed(0)}  PCB $${r.pcb.toFixed(0)}  PCBA $${r.pcba.toFixed(0)}  ex-works $${r.exw.toFixed(0)} ($${(r.exw / o.assembled).toFixed(2)}/board)`
      + `  landed $${r.landed.toFixed(0)} ($${(r.landed / o.assembled).toFixed(2)}/board)` + (o.dest === "US" ? `; duty-free $${r.dutyFree.toFixed(0)} ($${(r.dutyFree / o.assembled).toFixed(2)}/board)` : ""));
    if (r.short.length) console.log(`   stock short: ${r.short.join(", ")}`);
  }
  if (process.env.LINES) for (const l of lines.values()) { const h = hits.get(l.lcsc); console.log(`  ${l.lcsc.padEnd(10)} ${String(l.refs.length).padStart(3)}x  $${(h ? priceAt(h, l.refs.length * 100) : 0).toFixed(3)}@100  stock ${h?.stock}  ${h?.is_basic ? "basic" : h?.is_preferred ? "pref" : "EXT"}  ${l.mpn}`); }
}
if (import.meta.main) await main();
