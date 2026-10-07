// JLCPCB assembly outputs: BOM (grouped by LCSC part) and CPL (centroids in the Gerber frame, origin bottom-left).
// Footprints are LCSC/EasyEDA's own, so JLC's rotation zero matches ours: rotation = placement rot (CCW, top view).
import type { Board } from "./board.ts";

const csv = (rows: (string | number)[][]) => rows.map(r => r.map(v => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n") + "\n";

export function jlcFiles(b: Board) {
  const groups = new Map<string, { comment: string; refs: string[]; fp: string; mpn: string; manufacturer: string }>();
  for (const p of b.parts) {
    if (p.dnp || p.lcsc === "TP") continue;
    const g = groups.get(p.lcsc) ?? { comment: p.value, refs: [], fp: p.info.footprint.name, mpn: p.info.mpn, manufacturer: p.info.manufacturer };
    g.refs.push(p.ref); groups.set(p.lcsc, g);
  }
  const nat = (a: string, c: string) => a.localeCompare(c, undefined, { numeric: true });
  const bom = [["Comment", "Designator", "Footprint", "LCSC Part #", "MPN", "Manufacturer", "Qty"],
    ...[...groups].sort((a, c) => nat(a[1].refs[0], c[1].refs[0])).map(([lcsc, g]) => [g.comment, g.refs.sort(nat).join(","), g.fp, lcsc, g.mpn, g.manufacturer, g.refs.length])];
  const cpl = [["Designator", "Mid X", "Mid Y", "Layer", "Rotation"],
    ...b.parts.filter(p => !p.dnp && p.place && p.lcsc !== "TP" && !p.info.footprint.pads.some(pd => pd.layer === "multi")).sort((a, c) => nat(a.ref, c.ref)).map(p =>
      [p.ref, `${p.place!.x.toFixed(3)}mm`, `${(b.h - p.place!.y).toFixed(3)}mm`, p.place!.side === "top" ? "T" : "B", ((p.place!.rot % 360) + 360) % 360])];
  return { "bom.csv": csv(bom), "cpl.csv": csv(cpl) };
}
