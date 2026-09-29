// JLC/LCSC stock + price lookup via jlcsearch (cached on disk).
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const CACHE = new URL("../cache/jlc/", import.meta.url).pathname;
mkdirSync(CACHE, { recursive: true });

export type JlcPart = {
  lcsc: number; mfr: string; package: string; description: string;
  stock: number; price: string; is_basic: boolean; is_preferred: boolean;
};

export async function search(q: string): Promise<JlcPart[]> {
  const f = CACHE + encodeURIComponent(q) + ".json";
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  const r = await fetch(`https://jlcsearch.tscircuit.com/components/list.json?search=${encodeURIComponent(q)}`);
  const j = (await r.json()).components as JlcPart[];
  writeFileSync(f, JSON.stringify(j));
  return j;
}

/** Unit price at a given quantity from jlcsearch's "a-b:price,..." string. */
export function priceAt(p: JlcPart, qty: number): number {
  for (const tier of p.price.split(",")) {
    const [range, v] = tier.split(":");
    const [a, b] = range.split("-").map(Number);
    if (qty >= a && (!b || qty <= b)) return Number(v);
  }
  return NaN;
}

if (import.meta.main) {
  const qty = Number(process.env.QTY ?? 20);
  for (const q of process.argv.slice(2)) {
    const res = (await search(q)).sort((a, b) => b.stock - a.stock).slice(0, 6);
    console.log(`## ${q}`);
    for (const p of res)
      console.log(`  C${p.lcsc}\t${p.mfr}\t${p.package}\tstock ${p.stock}\t$${priceAt(p, qty).toFixed(3)}@${qty}\t${p.is_basic ? "BASIC" : p.is_preferred ? "PREF" : "ext"}`);
  }
}
