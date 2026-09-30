// Per-line BOM cost at the production quantity: which parts dominate, which are JLC "extended" (one-off loading fee each).
// Usage: bun tools/bom_cost.ts [boards=100]
import { build } from "../src/design.ts";
import { search, priceAt } from "./jlc.ts";
const N = Number(process.argv[2] ?? 100);
const c = await build();
const lines = new Map<string, { mpn: string; n: number }>();
for (const p of c.parts) { if (p.lcsc === "TP") continue; const l = lines.get(p.lcsc) ?? { mpn: p.info.mpn, n: 0 }; l.n++; lines.set(p.lcsc, l); }
const rows: any[] = []; let total = 0;
for (const [id, l] of lines) {
  const h = (await search(id)).find(x => "C" + x.lcsc === id);
  const unit = h ? priceAt(h, l.n * N) : NaN, ext = !(h?.is_basic || h?.is_preferred);
  rows.push({ id, mpn: l.mpn, n: l.n, unit, board: unit * l.n, ext }); total += unit * l.n;
}
rows.sort((a, b) => b.board - a.board);
console.log(`BOM at ${N} boards: ${lines.size} lines, ${c.parts.filter(p => p.lcsc !== "TP").length} parts, $${total.toFixed(2)}/board, ${rows.filter(r => r.ext).length} extended lines`);
for (const r of rows) console.log(`${r.ext ? "ext  " : "basic"} ${r.id.padEnd(9)} ${String(r.n).padStart(3)} × $${r.unit.toFixed(4).padStart(7)} = $${r.board.toFixed(3).padStart(7)}  ${r.mpn}`);
