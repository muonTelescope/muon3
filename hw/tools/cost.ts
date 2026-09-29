// BOM + landed-cost model for N stations shipped to Berlin and the US.
// JLC fee structure and freight/duty rates below are assumptions: edit here, everything else is computed.
import { build } from "../src/design.ts";
import { search, priceAt } from "./jlc.ts";

export const FEES = {
  pcbaSetup: 8.0,            // per order, one side
  stencil: 1.5,
  extendedLoading: 3.0,      // per unique extended part (basic + preferred-extended: 0)
  perJoint: 0.0017,
  thtSetup: 3.5, thtJoint: 0.02, // [EST] JLC THT hand/wave solder
  pcb6L: (areaCm2: number, qty: number) => 30 + 0.12 * areaCm2 * Math.max(qty, 5), // [EST] verify with JLC quote
  shipDHL: { EU: 28, US: 32 },   // [EST] per shipment, ~1–1.5 kg
  importVAT: { EU: 0.19, US: 0 },
  // US units ship to GSU (importer of record). China-origin PCBA tariff stack is volatile [EST 45 %];
  // GSU procurement should check HTS 9810.00.60 (scientific instruments for non-profit institutions) eligibility.
  duty: { EU: 0.0, US: 0.45 },
};

async function main() {
  const qty = Number(process.env.QTY ?? 5);
  const { W, H } = await import("../src/floorplan.ts");
  const area = Number(process.env.AREA_CM2 ?? (W * H) / 100);
  const c = await build();
  const lines = new Map<string, { lcsc: string; mpn: string; refs: string[] }>();
  for (const p of c.parts) {
    const l = lines.get(p.lcsc) ?? { lcsc: p.lcsc, mpn: p.value, refs: [] };
    l.refs.push(p.ref); lines.set(p.lcsc, l);
  }
  let parts = 0, extended = 0, joints = 0;
  const rows: string[] = [];
  for (const l of lines.values()) {
    const hit = (await search(l.lcsc)).find(x => "C" + x.lcsc === l.lcsc);
    const unitQty = l.refs.length * qty;
    const unit = hit ? priceAt(hit, unitQty) : 0;
    if (!hit) console.log(`  ? ${l.lcsc} not in jlcsearch`);
    const cls = hit?.is_basic ? "basic" : hit?.is_preferred ? "pref" : "EXT";
    if (cls === "EXT") extended++;
    parts += unit * unitQty;
    rows.push(`${l.lcsc.padEnd(10)} ${cls.padEnd(5)} ${String(l.refs.length).padStart(3)}x $${unit.toFixed(3).padStart(7)}  stock ${String(hit?.stock ?? "?").padStart(8)}  ${l.mpn}`);
  }
  let tht = 0, bottomSide = false;
  for (const p of c.parts) { joints += p.info.footprint.pads.length; tht += p.info.footprint.pads.filter(q => q.layer === "multi" && !/TYPE-C/.test(p.info.mpn)).length; if (p.info.footprint.pads.some(q => q.layer === "bottom")) bottomSide = true; }
  rows.sort((a, b) => a.slice(11, 16).localeCompare(b.slice(11, 16)));
  console.log(rows.join("\n"));
  const pcb = FEES.pcb6L(area, qty);
  // bottom pads (edge SMA straddle) = second assembly side: another setup + stencil [EST]
  const pcba = (FEES.pcbaSetup + FEES.stencil) * (bottomSide ? 2 : 1) + extended * FEES.extendedLoading + joints * qty * FEES.perJoint + (tht ? FEES.thtSetup + tht * qty * FEES.thtJoint : 0);
  console.log(`\n${lines.size} unique parts (${extended} extended), ${c.parts.length} placements, ${joints} joints/board (${tht} THT)${bottomSide ? ", two-sided (edge SMA)" : ""}`);
  console.log(`qty ${qty}: parts $${parts.toFixed(2)}  PCB(6L, ${area.toFixed(0)} cm²) $${pcb.toFixed(2)}  PCBA $${pcba.toFixed(2)}`);
  const ex = parts + pcb + pcba;
  console.log(`ex-works $${ex.toFixed(2)}  = $${(ex / qty).toFixed(2)}/board`);
  // Scenario A: one JLC order to Berlin, forward the US units from Germany (duty still applies: origin is China).
  // Scenario B: two JLC orders (Berlin, US): fixed fees paid twice, 5-PCB minimum each.
  const nEU = Number(process.env.EU ?? 2), nUS = qty - nEU;
  const perBoardVar = parts / qty + (joints * FEES.perJoint);
  const fixed = (FEES.pcbaSetup + FEES.stencil) * (bottomSide ? 2 : 1) + extended * FEES.extendedLoading;
  const landEU = (v: number) => v * (1 + FEES.duty.EU) * (1 + FEES.importVAT.EU);
  const landUS = (v: number) => v * (1 + FEES.duty.US);
  const aEU = landEU(ex + FEES.shipDHL.EU);
  const aFwd = 45 + landUS((ex / qty) * nUS); // DHL DE->US ~€40 [EST]
  const orderB = (n: number) => FEES.pcb6L(area, 5) + fixed + perBoardVar * n;
  const bEU = landEU(orderB(nEU) + FEES.shipDHL.EU), bUS = landUS(orderB(nUS) + FEES.shipDHL.US);
  console.log(`A one order → Berlin (+VAT) $${aEU.toFixed(0)}, forward ${nUS} → US (+duty) $${aFwd.toFixed(0)}: total $${(aEU + aFwd).toFixed(0)}`);
  console.log(`B two orders: Berlin ${nEU} $${bEU.toFixed(0)}, US/GSU ${nUS} $${bUS.toFixed(0)}: total $${(bEU + bUS).toFixed(0)}`);
  console.log(`  (US at 0 % duty if GSU qualifies for duty-free entry: $${(orderB(nUS) + FEES.shipDHL.US).toFixed(0)})`);
}
if (import.meta.main) await main();
