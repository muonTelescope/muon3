// Circuit-as-code: parts, pins, nets. Pins are addressed by symbol name or pad number.
import { fetchPart, type PartInfo } from "../tools/fetch_parts.ts";
import { passive } from "./passives.ts";

export type Side = "top" | "bottom";
export type Placement = { x: number; y: number; rot: number; side: Side; locked?: boolean };

export type Part = {
  ref: string; lcsc: string; info: PartInfo; value: string;
  pads: Record<string, string>; // pad number -> net
  group: string; // placement cluster (e.g. "afe0", "hv", "power")
  place?: Placement;
  dnp?: boolean;
};

/** One stocked JLC part per passive package supplies the footprint + 3D model. */
const PACKAGE_REP: Record<string, string> = {
  R0402: "C25744", R0603: "C25804", R0805: "C17414", R1206: "C17902",
  C0402: "C1525", C0603: "C14663", C0805: "C15850", C1206: "C13832",
};

export class Circuit {
  parts: Part[] = [];
  private refCount: Record<string, number> = {};
  private used = new Set<string>();
  group = "misc";

  /** Refs the floorplan pins down; auto-numbering skips them. */
  reserve(...refs: string[]) { for (const r of refs) this.used.add(r); }

  nextRef(prefix: string) {
    let r: string;
    do { this.refCount[prefix] = (this.refCount[prefix] ?? 0) + 1; r = prefix + this.refCount[prefix]; } while (this.used.has(r));
    this.used.add(r);
    return r;
  }

  /** Add a part by LCSC code. conn maps pin name (or pad number) -> net name. */
  async add(prefix: string, lcsc: string, conn: Record<string, string>, opts: { value?: string; ref?: string; footprintFrom?: string; noPasteBottom?: boolean } = {}) {
    // Passives take footprint + 3D model from one representative part per package (one EasyEDA fetch per package).
    const info = await fetchPart(opts.footprintFrom ?? lcsc, { assets: true, datasheet: !opts.footprintFrom });
    if (opts.noPasteBottom) info.footprint.pads = info.footprint.pads.map(pd => pd.layer === "bottom" ? { ...pd, nopaste: true } : pd);
    const ref = opts.ref ?? this.nextRef(prefix);
    if (opts.ref && this.parts.some(q => q.ref === opts.ref)) throw new Error(`duplicate ref ${opts.ref}`);
    const pads: Record<string, string> = {};
    for (const [pin, net] of Object.entries(conn)) {
      const nums = resolvePin(info, pin);
      if (!nums.length) throw new Error(`${ref} (${info.mpn}): no pin "${pin}". Pins: ${JSON.stringify(info.pins)}`);
      for (const n of nums) pads[n] = net;
    }
    const p: Part = { ref, lcsc, info, value: opts.value ?? info.mpn, pads, group: this.group };
    this.parts.push(p);
    return p;
  }

  /** Two-terminal passive: R/C/L by value and package, resolved to a JLC basic part where one exists. */
  async r(value: string, a: string, b: string, pkg = "0402") { return this.two("R", "resistor", value, pkg, a, b); }
  async c(value: string, a: string, b: string, pkg = "0402", volts = 16) { return this.two("C", "capacitor", value, pkg, a, b, volts); }
  async l(value: string, a: string, b: string, lcsc: string) { return this.add("L", lcsc, { "1": a, "2": b }, { value }); }

  private async two(prefix: string, kind: "resistor" | "capacitor", value: string, pkg: string, a: string, b: string, volts = 0) {
    // Default: snap to the nearest JLC basic value (no loading fee). "=4.99k" forces the exact value.
    const lcsc = await passive(kind, value.startsWith("=") ? value.slice(1) : value.startsWith("~") ? value : "~" + value, pkg, volts);
    value = value.replace(/^[=~]/, "");
    const rep = PACKAGE_REP[(kind === "resistor" ? "R" : "C") + pkg];
    if (!rep) throw new Error(`no footprint representative for ${kind} ${pkg}`);
    return this.add(prefix, lcsc, { "1": a, "2": b }, { value, footprintFrom: rep });
  }

  /** Bare probe pad (1.2 mm, no paste, not in BOM/CPL). */
  tp(net: string, opts: { ref?: string; label?: string } = {}) {
    const ref = opts.ref ?? this.nextRef("TP");
    const info = {
      lcsc: "TP", mpn: "TEST POINT", manufacturer: "", package: "TestPoint_Pad_D1.2mm", jlcClass: "", datasheet: "",
      pins: { "1": "TP" },
      footprint: {
        name: "TestPoint_Pad_D1.2mm", silk: [], holes: [],
        pads: [{ num: "1", shape: "circle" as const, x: 0, y: 0, w: 1.2, h: 1.2, rot: 0, layer: "top" as const, nopaste: true }],
        bbox: { x0: -0.75, y0: -0.75, x1: 0.75, y1: 0.75 },
      },
    };
    const p: Part = { ref, lcsc: "TP", info, value: opts.label ?? net, pads: { "1": net }, group: this.group };
    this.parts.push(p);
    return p;
  }

  /** Decoupling: one cap per value from rail to GND. */
  async decouple(rail: string, values: string[], pkg = "0402") {
    for (const v of values) await this.c(v, rail, "GND", pkg);
  }

  nets() {
    const m = new Map<string, { ref: string; pad: string }[]>();
    for (const p of this.parts) for (const [pad, net] of Object.entries(p.pads)) {
      if (!m.has(net)) m.set(net, []);
      m.get(net)!.push({ ref: p.ref, pad });
    }
    return m;
  }

  /** Electrical sanity: single-pin nets (except NC_*), unconnected power pins. */
  check() {
    const issues: string[] = [];
    for (const [net, nodes] of this.nets())
      if (nodes.length < 2 && !net.startsWith("NC")) issues.push(`net ${net} has one pin: ${nodes.map(n => n.ref + "." + n.pad)}`);
    for (const p of this.parts)
      for (const [num, name] of Object.entries(p.info.pins))
        if (!(num in p.pads) && /^(VDD|VCC|VIN|GND|AVDD|VCCIO|VPP|3V3|EP)/i.test(name))
          issues.push(`${p.ref}.${num} (${name}) unconnected`);
    return issues;
  }
}

function resolvePin(info: PartInfo, pin: string): string[] {
  if (pin in info.pins || info.footprint.pads.some(p => p.num === pin)) return [pin];
  const hits = Object.entries(info.pins).filter(([, n]) => n === pin || n.replace(/[#~{}]/g, "") === pin.replace(/[#~{}]/g, ""));
  return hits.map(([num]) => num);
}
