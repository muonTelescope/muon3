// Direct Gerber X2 (RS-274X) + Excellon writer. Tracks keep true arcs (G02/G03), zones are regions.
import { Board, LAYERS, type WPad, type Track } from "./board.ts";
import type { Pt, Poly } from "./geom.ts";

const fmt = (v: number) => Math.round(v * 1e6).toString(); // 4.6 format, mm

class GerberWriter {
  private body: string[] = [];
  private apertures = new Map<string, number>();
  private apDefs: string[] = [];
  private nextD = 10;
  private cur = "";
  private polarity: "D" | "C" = "D";
  constructor(private flipH: number, private fn: string, private func: string) {}

  private Y(y: number) { return fmt(this.flipH - y); }
  private X(x: number) { return fmt(x); }

  aperture(kind: string, params: number[], macro?: string): number {
    const key = kind + params.map(p => p.toFixed(4)).join(",") + (macro ?? "");
    let d = this.apertures.get(key);
    if (d === undefined) {
      d = this.nextD++;
      this.apertures.set(key, d);
      this.apDefs.push(`%ADD${d}${kind},${params.map(p => +p.toFixed(4)).join("X")}*%`);
    }
    return d;
  }
  select(d: number) { const k = `D${d}`; if (this.cur !== k) { this.body.push(`${k}*`); this.cur = k; } }
  setPolarity(p: "D" | "C") { if (p !== this.polarity) { this.body.push(`%LP${p}*%`); this.polarity = p; } }

  flash(d: number, p: Pt) { this.select(d); this.body.push(`X${this.X(p.x)}Y${this.Y(p.y)}D03*`); }

  /** Pad: flashed aperture when the shape allows, else a region. */
  pad(pd: WPad, expand = 0) {
    const w = pd.w + 2 * expand, h = pd.h + 2 * expand;
    const r = ((pd.rot % 360) + 360) % 360;
    const ortho = r % 90 === 0;
    const [aw, ah] = r % 180 === 0 ? [w, h] : [h, w];
    if (pd.shape === "circle") return this.flash(this.aperture("C", [w]), pd.c);
    if (pd.shape === "rect" && ortho) return this.flash(this.aperture("R", [aw, ah]), pd.c);
    if (pd.shape === "oval" && ortho) return this.flash(this.aperture("O", [aw, ah]), pd.c);
    if (pd.shape === "rect") { // rotated rect via macro primitive 21; Gerber rotation is CCW in y-up = our rot convention
      const d = this.aperture("RR", [w, h, r], "RR");
      return this.flash(d, pd.c);
    }
    this.region(expand ? grow(pd.poly, expand) : pd.poly);
  }

  region(poly: Poly) {
    if (poly.length < 3) return;
    this.body.push("G36*");
    this.body.push(`X${this.X(poly[0].x)}Y${this.Y(poly[0].y)}D02*`, "G01*");
    for (let i = 1; i < poly.length; i++) this.body.push(`X${this.X(poly[i].x)}Y${this.Y(poly[i].y)}D01*`);
    this.body.push(`X${this.X(poly[0].x)}Y${this.Y(poly[0].y)}D01*`, "G37*");
  }

  track(t: Track) {
    this.select(this.aperture("C", [t.width]));
    let at: Pt | undefined;
    for (const s of t.path) {
      if (!at || Math.hypot(at.x - s.a.x, at.y - s.a.y) > 1e-6) this.body.push(`X${this.X(s.a.x)}Y${this.Y(s.a.y)}D02*`);
      if (s.kind === "seg") this.body.push("G01*", `X${this.X(s.b.x)}Y${this.Y(s.b.y)}D01*`);
      else {
        // ccw = visually counter-clockwise; the y-flip preserves appearance, so it stays G03
        this.body.push(s.ccw ? "G03*" : "G02*",
          `X${this.X(s.b.x)}Y${this.Y(s.b.y)}I${fmt(s.c.x - s.a.x)}J${fmt(-(s.c.y - s.a.y))}D01*`);
      }
      at = s.b;
    }
  }

  line(a: Pt, b: Pt, w: number) {
    this.select(this.aperture("C", [w]));
    this.body.push(`X${this.X(a.x)}Y${this.Y(a.y)}D02*`, "G01*", `X${this.X(b.x)}Y${this.Y(b.y)}D01*`);
  }

  toString() {
    const head = [
      `%TF.GenerationSoftware,Muon3,hw-ts,0.1*%`,
      `%TF.FileFunction,${this.func}*%`,
      "%FSLAX46Y46*%", "%MOMM*%",
      "%AMRR*21,1,$1,$2,0,0,$3*%",
      "G75*", "%LPD*%",
    ];
    return [...head, ...this.apDefs, ...this.body, "M02*"].join("\n") + "\n";
  }
}

function grow(poly: Poly, d: number): Poly {
  const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length, cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
  return poly.map(p => { const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return { x: p.x + (dx / l) * d, y: p.y + (dy / l) * d }; });
}

export function writeGerbers(b: Board, prefix: string): Record<string, string> {
  const H = b.h;
  const pads = b.allPads();
  const files: Record<string, string> = {};
  const cuName = ["F_Cu.gtl", "In1_Cu.g2", "In2_Cu.g3", "In3_Cu.g4", "In4_Cu.g5", "B_Cu.gbl"];
  for (let L = 0; L < LAYERS.length; L++) {
    const side = L === 0 ? "Top" : L === LAYERS.length - 1 ? "Bot" : "Inr";
    const g = new GerberWriter(H, prefix, `Copper,L${L + 1},${side}`);
    for (const z of b.zones.filter(z => z.layer === L)) {
      for (const f of z.fill ?? []) { g.setPolarity("D"); g.region(f); }
      for (const hole of z.holes ?? []) { g.setPolarity("C"); g.region(hole); }
    }
    g.setPolarity("D");
    for (const t of b.tracks.filter(t => t.layer === L)) g.track(t);
    for (const v of b.vias) g.flash(g.aperture("C", [v.dia]), v.at);
    for (const p of pads) {
      const on = p.layer === "multi" || (L === 0 && p.layer === "top") || (L === 5 && p.layer === "bottom");
      if (on) g.pad(p);
    }
    files[`${prefix}-${cuName[L]}`] = g.toString();
  }
  for (const [side, L, ext] of [["top", "Top", "gts"], ["bottom", "Bot", "gbs"]] as const) {
    const g = new GerberWriter(H, prefix, `Soldermask,${L}`);
    for (const p of pads) if (p.layer === side || p.layer === "multi") g.pad(p, 0.05);
    files[`${prefix}-${side === "top" ? "F" : "B"}_Mask.${ext}`] = g.toString();
  }
  for (const [side, L, ext] of [["top", "Top", "gtp"], ["bottom", "Bot", "gbp"]] as const) {
    const g = new GerberWriter(H, prefix, `Paste,${L}`);
    for (const p of pads) if (p.layer === side && !p.drill) g.pad(p, p.w * p.h > 6 ? -0.15 : 0); // big EPs: reduced paste
    files[`${prefix}-${side === "top" ? "F" : "B"}_Paste.${ext}`] = g.toString();
  }
  for (const [side, L, ext] of [["top", "Top", "gto"], ["bottom", "Bot", "gbo"]] as const) {
    const g = new GerberWriter(H, prefix, `Legend,${L}`);
    for (const s of b.silk.filter(s => s.layer === side)) g.line(s.a, s.b, s.w);
    files[`${prefix}-${side === "top" ? "F" : "B"}_Silkscreen.${ext}`] = g.toString();
  }
  const e = new GerberWriter(H, prefix, "Profile,NP");
  for (let i = 0; i < b.outline.length; i++) e.line(b.outline[i], b.outline[(i + 1) % b.outline.length], 0.1);
  files[`${prefix}-Edge_Cuts.gm1`] = e.toString();
  files[`${prefix}-PTH.drl`] = excellon(b, true);
  files[`${prefix}-NPTH.drl`] = excellon(b, false);
  return files;
}

function excellon(b: Board, plated: boolean): string {
  const hits: { d: number; at: Pt; to?: Pt }[] = [];
  if (plated) {
    for (const v of b.vias) hits.push({ d: v.drill, at: v.at });
    for (const p of b.allPads()) if (p.drill) hits.push(p.slot ? { d: p.drill, at: p.slot[0], to: p.slot[1] } : { d: p.drill, at: p.c });
  } else {
    for (const h of [...b.holes, ...b.parts.flatMap(p => b.partHoles(p))]) if (!h.plated) hits.push({ d: h.d, at: h.at });
  }
  const tools = [...new Set(hits.map(h => h.d.toFixed(3)))].sort();
  const out = ["M48", "; Muon3 hw-ts", `; #@! TF.FileFunction,${plated ? "Plated,1,6,PTH" : "NonPlated,1,6,NPTH"}`, "METRIC,TZ", ...tools.map((t, i) => `T${i + 1}C${t}`), "%", "G90", "G05"];
  tools.forEach((t, i) => {
    out.push(`T${i + 1}`);
    for (const h of hits.filter(h => h.d.toFixed(3) === t))
      out.push(`X${h.at.x.toFixed(3)}Y${(b.h - h.at.y).toFixed(3)}` + (h.to ? `G85X${h.to.x.toFixed(3)}Y${(b.h - h.to.y).toFixed(3)}` : "")); // G85 = routed slot
  });
  out.push("M30");
  return out.join("\n") + "\n";
}
