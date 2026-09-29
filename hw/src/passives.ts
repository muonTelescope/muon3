// Resolve "4.99k"/"100n" + package to an in-stock LCSC part, preferring JLC basic (no extended-part fee).
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const CACHE = new URL("../cache/passives/", import.meta.url).pathname;
mkdirSync(CACHE, { recursive: true });

export function parseValue(v: string): number {
  const m = v.trim().match(/^([\d.]+)\s*([pnuµmkMG]?)/);
  if (!m) throw new Error(`bad value ${v}`);
  const mult: Record<string, number> = { p: 1e-12, n: 1e-9, u: 1e-6, µ: 1e-6, m: 1e-3, "": 1, k: 1e3, M: 1e6, G: 1e9 };
  return Number(m[1]) * mult[m[2]];
}

type Row = { lcsc: number; stock: number; is_basic: boolean; is_preferred: boolean; voltage_rating?: number; tolerance_fraction?: number; temperature_coefficient?: string };

const E24 = [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
const E96 = Array.from({ length: 96 }, (_, i) => Math.round(100 * 10 ** (i / 96)) / 100);

/** "~5.23k" = any value within ±5% (resistors) / ±25% (caps) that JLC stocks as a basic part; plain value = exact. */
export async function passive(kind: "resistor" | "capacitor", value: string, pkg: string, minVolts = 0): Promise<string> {
  if (value.startsWith("~")) {
    const target = parseValue(value.slice(1)), tol = kind === "resistor" ? 0.05 : 0.25;
    const dec = 10 ** Math.floor(Math.log10(target));
    const cands = [...new Set([...E24, ...E96, 10].flatMap(m => [m * dec, m * dec / 10, m * dec * 10]))]
      .filter(v => Math.abs(v / target - 1) <= tol).sort((a, b) => Math.abs(a / target - 1) - Math.abs(b / target - 1));
    for (const v of cands) {
      const lcsc = await passiveExact(kind, v, pkg, minVolts, true);
      if (lcsc) return lcsc;
    }
    return (await passiveExact(kind, target, pkg, minVolts, false))!;
  }
  return (await passiveExact(kind, parseValue(value), pkg, minVolts, false))!;
}

async function passiveExact(kind: "resistor" | "capacitor", v: number, pkg: string, minVolts: number, basicOnly: boolean): Promise<string | undefined> {
  const key = `${kind}_${v.toPrecision(4)}_${pkg}_${minVolts}_${basicOnly ? "b" : "a"}`;
  const f = CACHE + encodeURIComponent(key) + ".txt";
  if (existsSync(f)) return readFileSync(f, "utf8") || undefined;
  const url = kind === "resistor"
    ? `https://jlcsearch.tscircuit.com/resistors/list.json?resistance=${v}&package=${pkg}`
    : `https://jlcsearch.tscircuit.com/capacitors/list.json?capacitance=${v}&package=${pkg}`;
  const rows: Row[] = (await (await fetch(url)).json())[kind === "resistor" ? "resistors" : "capacitors"];
  const ok = rows.filter(r => r.stock > 1000 && (!minVolts || (r.voltage_rating ?? 0) >= minVolts)
    // small caps must be C0G/NP0 for the TIA feedback / timing paths
    && (kind !== "capacitor" || v >= 1e-9 || /C0G|NP0/i.test(r.temperature_coefficient ?? "")));
  const score = (r: Row) => (r.is_basic ? 2e9 : r.is_preferred ? 1e9 : 0) + Math.min(r.stock, 9e8);
  const best = ok.filter(r => !basicOnly || r.is_basic || r.is_preferred).sort((a, b) => score(b) - score(a))[0];
  if (!best) {
    if (basicOnly) { writeFileSync(f, ""); return undefined; }
    throw new Error(`no ${kind} ${v} ${pkg} >=${minVolts}V in stock`);
  }
  const lcsc = "C" + best.lcsc;
  writeFileSync(f, lcsc);
  return lcsc;
}
