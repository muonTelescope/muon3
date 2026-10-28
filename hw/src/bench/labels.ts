// Bench board silkscreen. Rules: every text ≥ 1.0 mm cap height (JLC minimum, 0.15 mm stroke), function names instead of
// reference designators, a frame and a large number per channel, every jack and loop named, high-voltage areas outlined
// with warning marks, the test row grouped under brackets, and a quick-start guide on the bottom.
import type { Board } from "../board.ts";
import type { Part } from "../circuit.ts";
import { text, line, label, reserve } from "../silk.ts";
import { clipSilkOverPads } from "../labels.ts";
import { pt, type Pt } from "../geom.ts";
import { W, CELLS, SMA_X, ROW_X0, ROW_Y, ROW_PITCH, UFL_DX, UFL_Y, LOOP_DX, LOOP_Y } from "./floorplan.ts";
import { TEST_ROW, CH, P, LOOP_KIND } from "./design.ts";

const T = 1.0;  // body text height, mm
const SHORT: Record<string, string> = {
  HV_MON: "HVMON", HV_TRIM: "TRIM", HV_EN: "HVEN", DAC_C: "DACC", DAC_D: "DACD", SPI_SCK: "SCK", SPI_MOSI: "MOSI", SPI_MISO: "MISO",
  FPGA_SS: "SS", FPGA_CDONE: "CDONE", FPGA_CRESET: "CRST", FPGA_CLK: "FCLK", FPGA_IRQ: "IRQ", LED_PULSE: "LEDP",
};
/** Test-row groups (index range into TEST_ROW, inclusive), printed under a bracket. */
export const ROW_GROUPS: [string, number, number][] = [
  ["POWER", 0, 4], ["BIAS", 5, 7], ["DAC", 8, 14], ["I2C", 16, 19], ["FPGA SPI/CFG", 20, 27], ["PULSE", 29, 30], ["HITS", 31, 34],
  ["IO", 35, 36], ["UART", 37, 38],
];
const FUNC: Record<string, string> = {
  [P.ice40]: "ICE40UP5K", [P.ams1117]: "REG 3V3", [P.ldo33]: "LDO 3V3A", [P.ldo12]: "LDO 1V2", [P.usblc6]: "ESD",
  [P.buf]: "LED DRV", [P.flash]: "FLASH DNP",
};
/** shorter fallback when the full function name finds no room */
const SHORTER: Record<string, string> = { "REG 3V3": "3V3", "LDO 3V3A": "3V3A", "LDO 1V2": "1V2", "FLASH DNP": "FLASH", "ESP LED": "ESP", "PWR LED": "PWR", "FPGA LED": "FPGA", "LED DRV": "DRV" };
const JACK: Record<string, string> = { INJ: "INJ IN", TIA: "TIA OUT", CMP: "CMP OUT", LED: "LED OUT" };
type Box = { x0: number; y0: number; x1: number; y1: number };

export function labels(b: Board, date: string) {
  const missed: string[] = [];
  const opt = { align: "center", avoidSilk: true } as const;  // labels also keep off outlines, frames and the row text
  const put = (s: string, c: Pt[], h = T) => { if (!label(b, s, c, h, opt)) missed.push(s); };
  const len = (t: string, h: number) => t.length * 5.2 * h / 6;
  const part = (ref: string) => b.parts.find(q => q.ref === ref);
  const cb = (p: Part, m = 0.1): Box => { const c = b.courtyard(p, m);
    return { x0: Math.min(...c.map(q => q.x)), y0: Math.min(...c.map(q => q.y)), x1: Math.max(...c.map(q => q.x)), y1: Math.max(...c.map(q => q.y)) }; };
  /** label candidates around a box: centred and corner-aligned above/below, then right/left */
  const ring = (bx: Box, s: string, h = T) => {
    const w = len(s, h) / 2, out: Pt[] = [];
    for (const r of [0, 1.3, 2.6, 4.0]) {
      const g = 0.35 + h / 2 + r * h, gx = 0.35 + r * h;
      out.push(pt((bx.x0 + bx.x1) / 2, bx.y0 - g), pt((bx.x0 + bx.x1) / 2, bx.y1 + g), pt(bx.x1 + gx + w, (bx.y0 + bx.y1) / 2), pt(bx.x0 - gx - w, (bx.y0 + bx.y1) / 2),
        pt(bx.x0 + w, bx.y0 - g), pt(bx.x1 - w, bx.y0 - g), pt(bx.x0 + w, bx.y1 + g), pt(bx.x1 - w, bx.y1 + g));
    }
    return out;
  };
  const near = (p: Part, s: string) => { if (!label(b, s, ring(cb(p), s), T, opt) && !(SHORTER[s] && label(b, SHORTER[s], ring(cb(p), SHORTER[s]), T, opt))) missed.push(s); };
  const dashed = (a: Pt, c: Pt, dash = 1.2, gap = 0.8) => {
    const L = Math.hypot(c.x - a.x, c.y - a.y), ux = (c.x - a.x) / L, uy = (c.y - a.y) / L;
    for (let s = 0; s < L; s += dash + gap) { const e = Math.min(L, s + dash); line(b, pt(a.x + ux * s, a.y + uy * s), pt(a.x + ux * e, a.y + uy * e), 0.15); }
    reserve(b, { x0: Math.min(a.x, c.x) - 0.1, y0: Math.min(a.y, c.y) - 0.1, x1: Math.max(a.x, c.x) + 0.1, y1: Math.max(a.y, c.y) + 0.1 });  // no text in the gaps
  };
  /** warning triangle with "!" (apex toward −y, which is "up" in the top view) */
  const warn = (c: Pt, s = 2.4) => {
    const h = s * Math.sqrt(3) / 2, A = pt(c.x, c.y - h * 2 / 3), B = pt(c.x - s / 2, c.y + h / 3), C = pt(c.x + s / 2, c.y + h / 3);
    line(b, A, B, 0.18); line(b, B, C, 0.18); line(b, C, A, 0.18);
    line(b, pt(c.x, c.y - h * 0.32), pt(c.x, c.y + h * 0.05), 0.2); line(b, pt(c.x, c.y + h * 0.17), pt(c.x, c.y + h * 0.2), 0.2);
  };

  // ── test row: vertical names, a bracket per group and the group name ──
  const rowX = (k: number) => ROW_X0 + ROW_PITCH * k;
  TEST_ROW.forEach((n, k) => text(b, SHORT[n] ?? n, pt(rowX(k), ROW_Y - 2.2), 0.9, { rot: 90 }));
  const yb = ROW_Y - 6.6;
  for (const [name, i0, i1] of ROW_GROUPS) {
    const xa = rowX(i0) - 1.1, xc = rowX(i1) + 1.1;
    line(b, pt(xa, yb + 0.5), pt(xa, yb), 0.15); line(b, pt(xa, yb), pt(xc, yb), 0.15); line(b, pt(xc, yb), pt(xc, yb + 0.5), 0.15);
    const nm = len(name, T) > xc - xa + 2 ? name.split(" ")[0] : name;
    text(b, nm, pt((xa + xc) / 2, yb - 1.1), T, { align: "center" });
  }
  const grouped = (k: number) => ROW_GROUPS.some(([, a, c]) => k >= a && k <= c);
  for (const k of TEST_ROW.flatMap((n, k) => (n === "GND" && !grouped(k) ? [k] : []))) text(b, "G", pt(rowX(k), yb - 1.1), T, { align: "center" });

  // ── channel cells: frame, big number, SiPM jack name + warning, U.FL row and loop row with fixed names ──
  CH.forEach(i => {
    const x0 = CELLS.box.x0 + CELLS.pitch * i, x1 = CELLS.box.x1 + CELLS.pitch * i, y1 = CELLS.box.y1;
    for (const [a, c] of [[pt(x0, 9.6), pt(x0, y1)], [pt(x0, y1), pt(x1, y1)], [pt(x1, y1), pt(x1, 9.6)]] as [Pt, Pt][]) line(b, a, c, 0.15);
    put(`CH${i}`, [pt(x0 + 35.4, 3.2), pt(x1 - 3.6, 9.4)], 2.0);
    const x = SMA_X[i];
    put(`SIPM${i}`, [pt(x, 7.6), pt(x, 8.9)], 1.2);
    warn(pt(x - 4.6, 7.5));
    UFL_DX.forEach((dx, k) => { const s = ["INJ IN", "TIA OUT", "CMP OUT"][k], c = [UFL_Y + 3.0, UFL_Y + 4.3].flatMap(y => [-2, 0, 2, -3.5, 3.5].map(d => pt(x0 + dx + d, y)));
      // INJ IN: its 50R termination may sit under the jack; then the name runs up the gap between SMA and jack
      if (!label(b, s, c, T, opt) && !label(b, s, [3.5, 3.3, 3.1].map(d => pt(x0 + dx - d, 3.6)), T, { ...opt, rot: 90 })) missed.push(s); });
    LOOP_DX.forEach((dx, k) => put(LOOP_KIND[k], [pt(x0 + dx, LOOP_Y + 3.1), pt(x0 + dx, LOOP_Y - 3.1)]));
  });
  for (const j of b.parts.filter(p => p.lcsc === P.ufl && !p.group.startsWith("ch"))) { const s = JACK[j.value.replace(/\d$/, "")] ?? j.value; put(s, ring(cb(j), s)); }
  for (const tp of b.parts.filter(p => p.lcsc === P.loop && p.group === "hv")) { const c = tp.place!, lab = tp.value === "HV" ? "HV!" : "G";
    put(lab, [1.7, 2.3, 2.9].flatMap(r => [pt(c.x, c.y - r), pt(c.x, c.y + r), pt(c.x + r + 0.6, c.y), pt(c.x - r - 0.6, c.y)])); }

  // ── high-voltage areas: dashed outline, warning mark, voltage ──
  for (const [g, s] of [["hv", "BIAS IN 90V MAX"], ["hvgen", "BIAS BOOST 83V"]]) {
    const ps = b.parts.filter(p => p.group === g && p.place); if (!ps.length) continue;
    const bs = ps.map(p => cb(p, 0.4));
    // the bias boost box also holds the source jumper's names and title, on its left
    const x0 = g === "hvgen" ? Math.max(Math.min(...bs.map(q => q.x0)) - 8.0, 78.2) : Math.min(...bs.map(q => q.x0)), y0 = Math.min(...bs.map(q => q.y0)), x1 = Math.max(...bs.map(q => q.x1)), y1 = Math.max(...bs.map(q => q.y1));
    for (const [a, c] of [[pt(x0, y0), pt(x1, y0)], [pt(x1, y0), pt(x1, y1)], [pt(x1, y1), pt(x0, y1)], [pt(x0, y1), pt(x0, y0)]] as [Pt, Pt][]) dashed(a, c);
    // leading blanks reserve the warning triangle's room inside the label box
    const s3 = "   " + s, w = len(s3, T) / 2;
    const cands = [y0 - 1.1, y1 + 1.1, y0 + 1.3, y1 - 1.3].flatMap(y => [x0 + w, x1 - w, (x0 + x1) / 2, x0 + w + 0.4].map(x => pt(x, y)));
    const at = cands.find(c => label(b, s3, [c], T, opt));
    if (at) warn(pt(at.x - w + 1.0, at.y), 2.0); else missed.push(s);
  }

  // ── connectors, jumper, controls, LEDs, chips ──
  const J = (ref: string, s: string, h = T) => { const p = part(ref); if (p) put(s, ring(cb(p), s, h), h); };
  J("J1", "USB-C 5V"); J("J2", "QT I2C1"); J("J3", "HV IN 0-90V");
  const pad = (ref: string, num: string) => b.pads(part(ref)!).find(q => q.num === num)!.c;
  { const a = pad("J3", "1"), c = pad("J3", "2");
    for (const [q, s] of [[a, "+"], [c, "GND"]] as [Pt, string][]) put(s, [2.4, 4.4, 5.4, 6.4].map(r => pt(q.x + r + len(s, T) / 2, q.y))); }
  { const a = pad("J4", "1"), c = pad("J4", "3"), horiz = Math.abs(c.x - a.x) > Math.abs(c.y - a.y);
    const sx = Math.sign(c.x - a.x), sy = Math.sign(c.y - a.y);
    const beyond = (q: Pt, s: string, d: number) => horiz ? pt(q.x + d * sx * (1.7 + len(s, T) / 2), q.y) : pt(q.x, q.y + d * sy * 2.1);
    const side = (q: Pt, s: string) => [2.1, 3.0, 3.9].flatMap(r => horiz ? [pt(q.x, q.y - r), pt(q.x, q.y + r)] : [pt(q.x - r + 0.3 - len(s, T) / 2, q.y), pt(q.x + r - 0.3 + len(s, T) / 2, q.y)]);
    put("EXT", [...side(a, "EXT"), beyond(a, "EXT", -1)]); put("GEN", [...side(c, "GEN"), beyond(c, "GEN", 1)]);
    const m = pad("J4", "2"); put("HV", side(m, "HV"));
    // title above the jumper and its names, else up the left of the names
    const j = cb(part("J4")!), cy = (j.y0 + j.y1) / 2;
    // (on two lines: the boost parts crowd in above the jumper)
    const two = [1.0, 1.4].flatMap(d => [-2.0, -1.4, -2.6].map(dx => [pt(j.x0 + dx, j.y0 - d - 1.35), pt(j.x0 + dx, j.y0 - d)]));
    const at = two.find(([p1, p2]) => label(b, "SOURCE", [p2], T, opt) && (label(b, "BIAS", [0, 0.6, -0.6, 1.2].flatMap(dx => [0, -0.3].map(dy => pt(p1.x + dx, p1.y + dy))), T, opt) || (missed.push(`BIAS at ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`), true)));
    if (!at && !label(b, "BIAS SOURCE", [4.6, 5.0, 5.4].map(d => pt(j.x0 - d, cy)), T, { ...opt, rot: 90 })) missed.push("BIAS SOURCE"); }
  for (const sw of b.parts.filter(p => /^SW/.test(p.ref))) near(sw, sw.value);
  for (const d of b.parts.filter(p => p.lcsc === P.led)) near(d, d.value);
  for (const p of b.parts.filter(p => p.place && (FUNC[p.lcsc] || p.lcsc === P.mcp4728))) {
    const s = p.lcsc === P.mcp4728 ? (Object.values(p.pads).includes("VTH0") ? "DAC VTH" : "DAC VREF") : FUNC[p.lcsc];
    near(p, s);
  }
  { const u = part("U1"); if (u) put("ESP32-S3", ring(cb(u), "ESP32-S3", 1.4), 1.4); }

  // ── title ──
  put("MUON3 BENCH  REV A", [pt(45, 33.5), pt(48, 33.5), pt(42, 34.5), pt(92, 33.5), pt(90, 56)], 2.0);

  // ── bottom: quick start + reference ──
  const B = (s: string, y: number, h = T) => text(b, s, pt(W / 2, y), h, { align: "center", layer: "bottom" });
  // two blocks: above the middle mount hole (title + quick start) and below the bias jumper's pins (reference)
  B(`MUON3 BENCH BOARD  REV A  ${date}`, 8, 1.6);
  [
    "QUICK START",
    "1. J4: 1-2 = BENCH SUPPLY ON HV IN, 2-3 = ON-BOARD BOOST (HVEN + TRIM)",
    "2. SIPM COAX ON SIPMn. ITS SHELL CARRIES THE BIAS: NEVER GROUND IT",
    "3. USB-C: THE ESP32 LOADS THE FPGA, SETS VREF + VTH, STREAMS COUNTS",
    "4. SCOPE ON TIA OUT (49.9R: HALF AMPLITUDE INTO 50R, 1PE = 3MV) OR CMP OUT",
  ].forEach((s, i) => B(s, 12.5 + i * 2.8, i === 0 ? 1.3 : T));
  [
    "INJ IN: 50R, 1PF, 1V STEP = 1PC = 27PE.  ON-BOARD INJ = 9PE ON ALL 4",
    "LED OUT: 3.3V PULSE, 49.9R. FIT THE LED + RESISTOR AT THE FAR END",
    "R0 LINK TIA-CMP: REMOVE IT TO DRIVE CMP FROM THE TIAC LOOP",
    "HV = HVMON X 27.7.  QT I2C1: ADDRESS 0X60 IS TAKEN.  U.FL: 30 MATINGS",
  ].forEach((s, i) => B(s, 48 + i * 2.8));
  text(b, "JLCJLCJLCJLC", pt(W / 2, 61), T, { align: "center", layer: "bottom" });
  // through-hole pins named on the bottom too, for probing from below
  for (const [ref, names] of [["J4", { "1": "EXT", "2": "HV", "3": "GEN" }], ["J3", { "1": "HV+", "2": "GND" }]] as [string, Record<string, string>][])
    for (const [n, s] of Object.entries(names)) { const q = pad(ref, n); text(b, s, pt(q.x - 2.0 - len(s, T) / 2, q.y), T, { align: "center", layer: "bottom" }); }

  clipSilkOverPads(b);
  if (missed.length) console.log(`  silk: ${missed.length} labels found no free spot: ${missed.join(", ")}`);
}
