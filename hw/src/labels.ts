// Board-specific silkscreen: what a student/teacher needs to plug in, probe, and not get hurt.
import type { Board } from "./board.ts";
import { text, line, label, around } from "./silk.ts";
import { JACK_X, JACK_Y, W, H, ROW_X0, ROW_Y, ISLAND_BOX } from "./floorplan.ts";
import { TEST_ROW } from "./design.ts";
import { pt, pointInPoly, distPtPoly } from "./geom.ts";

const SHORT: Record<string, string> = { HV_EN: "HVEN", HV_TRIM: "TRIM", HV_MON: "HVMON", DAC_C: "DACC", DAC_D: "DACD", SDA0: "SDA", SCL0: "SCL" };

export function labels(b: Board, date: string) {
  const at = (ref: string) => b.parts.find(p => p.ref === ref)!.place!;
  // ── top ── (collision-aware: every label tries several spots and is dropped rather than printed over copper)
  const len = (t: string, h: number) => t.length * 5.2 * h / 6;
  const cb = (ref: string) => { const p = b.parts.find(q => q.ref === ref)!, c = b.courtyard(p, 0.1);
    return { x0: Math.min(...c.map(q => q.x)), y0: Math.min(...c.map(q => q.y)), x1: Math.max(...c.map(q => q.x)), y1: Math.max(...c.map(q => q.y)) }; };
  // probe row first (fixed band): vertical net names above each pad, a bracket and the row name
  TEST_ROW.forEach((n, k) => text(b, SHORT[n] ?? n, pt(ROW_X0 + 2.54 * k + 0.35, ROW_Y - 1.2), 0.7, { rot: 90 }));
  const xL = ROW_X0 - 1.3, xR = ROW_X0 + 2.54 * (TEST_ROW.length - 1) + 1.3;
  line(b, pt(xL, ROW_Y + 1.2), pt(xR, ROW_Y + 1.2), 0.12);
  text(b, "PROBES", pt(xL - 0.6, ROW_Y + 0.4), 0.7, { rot: 90 });
  // safety + tile names
  const hv = b.parts.find(p => p.lcsc === "C100023");
  if (hv) { const bx = cb(hv.ref), cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2;
    label(b, "HV 85V", [...around(bx, 1.0, len("HV 85V", 1.0)), ...[-6, -3, 0, 3, 6].flatMap(dx => [-7, -5, 5, 7].map(dy => pt(cx + dx, cy + dy)))], 1.0, { align: "center" }); }
  // tile labels: the same candidate list per cell, so identical cells get identical silk wherever the copper allows
  JACK_X.forEach((x, i) => label(b, `TILE ${i}`, [pt(x - 5.0, JACK_Y), pt(x + 5.0, JACK_Y), pt(x - 5.0, JACK_Y + 1.6), pt(x + 5.0, JACK_Y + 1.6),
    ...[1.6, 3.2, 4.8, 6.4].flatMap(y => [-7, 7, -8.5, 8.5].map(dx => pt(x + dx, y)))], 1.0, { align: "center" }));
  // scope pairs + HV test point
  for (const tp of b.parts.filter(p => p.lcsc === "TP" && !isRow(p.ref))) {
    const c = tp.place!, lab = tp.value === "GND" ? "G" : tp.value === "HV" ? "HV!" : tp.value.replace("TIA", "T");
    const w = len(lab, 0.7) / 2;
    label(b, lab, [1.3, 1.8, 2.4].flatMap(r => [pt(c.x, c.y - r), pt(c.x, c.y + r), pt(c.x + r - 0.1 + w, c.y), pt(c.x - r + 0.1 - w, c.y),
      pt(c.x + r * 0.8 + w, c.y - r * 0.8), pt(c.x - r * 0.8 - w, c.y - r * 0.8), pt(c.x + r * 0.8 + w, c.y + r * 0.8), pt(c.x - r * 0.8 - w, c.y + r * 0.8)]), 0.7, { align: "center" });
  }
  // connectors, controls, LEDs, sensor island
  label(b, "USB-C 5V", around(cb("J1"), 0.9, len("USB-C 5V", 0.9)).map(q => pt(q.x + 3, q.y)), 0.9, { align: "center" });
  for (const sw of b.parts.filter(p => /^SW/.test(p.ref))) label(b, "BOOT", around(cb(sw.ref), 0.8, len("BOOT", 0.8)), 0.8, { align: "center" });
  for (const d of b.parts.filter(p => p.lcsc === "C2286")) label(b, d.value, around(cb(d.ref), 0.7, len(d.value, 0.7)), 0.7, { align: "center" });
  { const I = ISLAND_BOX; label(b, "AIR T/P", [pt(I.x1 + 3.0, I.y1 - 2.0), pt(I.x0 - 3.0, I.y1 - 2.0), pt(I.x1 + 4.5, I.y1 - 6.0), pt(I.x0 - 4.5, I.y1 - 6.0),
    ...[0, 1.6, 3.2].flatMap(dy => [I.x0 - 8, I.x1 + 8, I.x0 - 12, I.x1 + 12].map(x => pt(x, I.y0 - 1 - dy)))], 0.6, { align: "center" }); }
  // reference designators for ICs, transistors and connectors (passives: BOM/CPL carry them)
  for (const p of b.parts.filter(p => /^(U|J|Q)\d/.test(p.ref) && p.place && p.ref !== "U1"))
    label(b, p.ref, around(cb(p.ref), 0.7, len(p.ref, 0.7)), 0.7, { align: "center" });
  // ── bottom: probe + safety guide ──
  const L = (s: string, i: number, h = 1.0) => text(b, s, pt(W / 2, 5 + i * 3.0), h, { align: "center", layer: "bottom" });
  [
    `MUON3 STATION REV C  ${date}`,
    "GSU GLOWCOST - 4X SPHENIX INNER HCAL TILE",
    "U.FL SHELL = SIPM BIAS (UP TO 85V, 47K LIMITED)",
    "NEVER CLIP SCOPE GROUND TO A U.FL SHELL",
    "SCOPE TIAn: TIP ON T, SPRING ON ITS G PAD",
    "TIA BASELINE = VREF, 1PE = 6MV, MUON = 0.1-1V NEGATIVE",
    "INJ EDGE = 0.33PC = 9PE ON ALL 4 CHANNELS",
    "HV = HVMON X 27.7   TRIM 0-2.048V = 83-53V   HV_EN LOW = 4V",
    "PROBES: GND 5V 3V3 3V3A VREF VTH0-3 HIT0-3 INJ HVEN TRIM HVMON DACC DACD SDA SCL GND",
  ].forEach((s, i) => L(s, i, i === 0 ? 1.4 : i === 8 ? 0.8 : 1.0));
  text(b, "JLCJLCJLCJLC", pt(W / 2, 33), 1.0, { align: "center", layer: "bottom" });
  clipSilkOverPads(b);
}

function isRow(ref: string) { const k = Number(ref.replace("TP", "")); return /^TP\d+$/.test(ref) && k >= 1 && k <= TEST_ROW.length; }

/** Drop silk segments that would print on exposed copper (pad + 0.1 mm mask expansion). */
function clipSilkOverPads(b: Board) {
  const pads = b.allPads();
  b.silk = b.silk.filter(s => {
    const side = s.layer;
    for (const q of [s.a, s.b]) {
      if (!pointInPoly(q, b.outline) || distPtPoly(q, b.outline.slice().reverse()) < 0) return false;
      if (b.cutouts.some(c => pointInPoly(q, c) || distPtPoly(q, c) < 0.2)) return false;
    }
    for (const q of [s.a, s.b, pt((s.a.x + s.b.x) / 2, (s.a.y + s.b.y) / 2)])
      for (const pd of pads) {
        if (pd.layer !== "multi" && pd.layer !== side) continue;
        if (Math.abs(pd.c.x - q.x) > 6 || Math.abs(pd.c.y - q.y) > 6) continue;
        if (pointInPoly(q, pd.poly) || distPtPoly(q, pd.poly) < 0.1 + s.w / 2) return false;
      }
    return true;
  });
}
