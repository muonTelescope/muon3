// Fetch footprint + 3D model + datasheet for every LCSC part in the BOM.
// Output: parts/<LCSC>/{part.json, datasheet.pdf, model.step, model.obj}
// Footprint geometry is converted from EasyEDA units (10 mil) to mm, origin at the part centre.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";

const ROOT = new URL("../parts/", import.meta.url).pathname;
const CACHE = new URL("../cache/easyeda/", import.meta.url).pathname;
mkdirSync(CACHE, { recursive: true });

const U = 0.254; // EasyEDA unit -> mm

export type Pad = {
  num: string; shape: "rect" | "oval" | "circle" | "poly";
  x: number; y: number; w: number; h: number; rot: number;
  layer: "top" | "bottom" | "multi"; drill?: number; drillLen?: number; poly?: [number, number][];
  nopaste?: boolean; // copper + mask only: not assembled (e.g. edge-SMA bottom tabs)
};
export type Footprint = {
  name: string; pads: Pad[];
  silk: { x1: number; y1: number; x2: number; y2: number; w: number }[];
  holes: { x: number; y: number; d: number }[]; // non-plated (locating pegs)
  body?: { w: number; h: number; cx: number; cy: number }; // 3D body outline (footprint frame)
  bbox: { x0: number; y0: number; x1: number; y1: number }; // copper + body extent
  model?: { uuid: string; ox: number; oy: number; z: number; rot: [number, number, number] };
};
export type PartInfo = {
  lcsc: string; mpn: string; manufacturer: string; package: string;
  jlcClass: string; datasheet: string; footprint: Footprint;
  pins: Record<string, string>; // pad number -> symbol pin name
};

function parsePins(dataStr: any): Record<string, string> {
  const pins: Record<string, string> = {};
  for (const s of dataStr.shape as string[]) {
    if (!s.startsWith("P~")) continue;
    const seg = s.split("^^");
    const num = seg[0].split("~")[3];
    const name = seg[3]?.split("~")[4];
    if (num) pins[num] = name ?? num;
  }
  return pins;
}

async function getJson(lcsc: string) {
  const f = CACHE + lcsc + ".json";
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  let j: any;
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(`https://easyeda.com/api/products/${lcsc}/components?version=6.4.19.5`, { signal: AbortSignal.timeout(30000) });
      j = JSON.parse(await r.text());
      break;
    } catch (e) {
      if (attempt >= 4) throw new Error(`${lcsc}: EasyEDA fetch failed (${(e as Error).message})`);
      await new Promise(res => setTimeout(res, 2000 * 2 ** attempt));
    }
  }
  if (!j.success && !j.result) throw new Error(`${lcsc}: ${JSON.stringify(j).slice(0, 200)}`);
  writeFileSync(f, JSON.stringify(j));
  return j;
}

function parseFootprint(pkg: any): Footprint {
  const ds = pkg.dataStr;
  const ox = Number(ds.head.x), oy = Number(ds.head.y);
  const X = (v: string) => (Number(v) - ox) * U;
  const Y = (v: string) => (Number(v) - oy) * U; // EasyEDA y grows downward; we keep y-down and flip at output
  const pads: Pad[] = [];
  const silk: Footprint["silk"] = [];
  const holes: Footprint["holes"] = [];
  let body: { w: number; h: number; cx: number; cy: number } | undefined;
  let model: Footprint["model"];
  for (const s of ds.shape as string[]) {
    const f = s.split("~");
    if (f[0] === "PAD") {
      // PAD~shape~x~y~w~h~layer~net~number~holeR~points~rot~id~holeLen~holePts~plated
      const shape = f[1] === "RECT" ? "rect" : f[1] === "OVAL" ? "oval" : f[1] === "ELLIPSE" ? "circle" : "poly";
      const layer = f[6] === "1" ? "top" : f[6] === "2" ? "bottom" : "multi";
      const holeR = Number(f[9]) * U;
      const pts = f[10] ? f[10].trim().split(/\s+/).map(Number) : [];
      const poly: [number, number][] = [];
      for (let i = 0; i + 1 < pts.length; i += 2) poly.push([(pts[i] - ox) * U, (pts[i + 1] - oy) * U]);
      pads.push({
        num: f[8], shape, x: X(f[2]), y: Y(f[3]), w: Number(f[4]) * U, h: Number(f[5]) * U,
        rot: Number(f[11] || 0), layer,
        ...(holeR > 0 ? { drill: holeR * 2, drillLen: Number(f[13] || 0) * U || undefined } : {}),
        ...(shape === "poly" ? { poly } : {}),
      });
    } else if (f[0] === "TRACK" && f[2] === "3") {
      // TRACK~width~layer~net~points~id
      const p = f[4].trim().split(/\s+/).map(Number);
      for (let i = 0; i + 3 < p.length; i += 2)
        silk.push({ x1: (p[i] - ox) * U, y1: (p[i + 1] - oy) * U, x2: (p[i + 2] - ox) * U, y2: (p[i + 3] - oy) * U, w: Number(f[1]) * U });
    } else if (f[0] === "HOLE") {
      holes.push({ x: X(f[1]), y: Y(f[2]), d: Number(f[3]) * 2 * U });
    } else if (f[0] === "SVGNODE") {
      const a = JSON.parse(f[1]).attrs;
      // Some EasyEDA outlines carry an origin in another frame; if it's >20 mm away, centre the body on the footprint.
      const [cx0, cy0] = String(a.c_origin).split(",").map(Number);
      const far = Math.hypot(cx0 - ox, cy0 - oy) * U > 20;
      const [cx, cy] = far ? [ox, oy] : [cx0, cy0];
      if (a.c_width) body = { w: Number(a.c_width) * U, h: Number(a.c_height) * U, cx: (cx - ox) * U, cy: (cy - oy) * U };
      if (a.uuid) {
        const r = String(a.c_rotation || "0,0,0").split(",").map(Number) as [number, number, number];
        model = { uuid: a.uuid, ox: (cx - ox) * U, oy: (cy - oy) * U, z: Number(a.z || 0) * U, rot: r };
      }
    }
  }
  const xs: number[] = [], ys: number[] = [];
  for (const p of pads) {
    const q = ((p.rot % 180) + 180) % 180, ex = q === 90 ? p.h : q === 0 ? p.w : Math.hypot(p.w, p.h), ey = q === 90 ? p.w : q === 0 ? p.h : Math.hypot(p.w, p.h);
    xs.push(p.x - ex / 2, p.x + ex / 2); ys.push(p.y - ey / 2, p.y + ey / 2);
    if (p.poly) for (const [x, y] of p.poly) { xs.push(x); ys.push(y); }
  }
  for (const l of silk) { xs.push(l.x1, l.x2); ys.push(l.y1, l.y2); }
  for (const h of holes) { xs.push(h.x - h.d / 2, h.x + h.d / 2); ys.push(h.y - h.d / 2, h.y + h.d / 2); }
  if (body) { xs.push(body.cx - body.w / 2, body.cx + body.w / 2); ys.push(body.cy - body.h / 2, body.cy + body.h / 2); }
  return {
    name: ds.head.c_para?.package ?? pkg.title, pads, silk, holes, body,
    bbox: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) },
    model,
  };
}

async function download(url: string, to: string, magic?: string) {
  if (existsSync(to) && (!magic || readFileSync(to).subarray(0, magic.length).toString() === magic)) return true;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(90000), headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return false;
    const b = new Uint8Array(await r.arrayBuffer());
    if (magic && Buffer.from(b.subarray(0, magic.length)).toString() !== magic) return false; // bot wall / HTML
    writeFileSync(to, b);
    return true;
  } catch { return false; }
}

/** LCSC's product API gives a direct datasheet URL that isn't behind the HTML bot wall. */
async function lcscDatasheetUrl(lcsc: string): Promise<string | undefined> {
  try {
    const r = await fetch(`https://wmsc.lcsc.com/ftps/wm/product/detail?productCode=${lcsc}`,
      { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "Mozilla/5.0" } });
    return (await r.json())?.result?.pdfUrl;
  } catch { return undefined; }
}

export async function fetchPart(lcsc: string, opts: { assets: boolean; datasheet?: boolean } = { assets: true }): Promise<PartInfo> {
  const dir = ROOT + lcsc + "/";
  const cached = dir + "part.json";
  if (existsSync(cached) && !opts.assets) return JSON.parse(readFileSync(cached, "utf8"));
  const j = (await getJson(lcsc)).result;
  const cp = j.dataStr.head.c_para;
  const fp = parseFootprint(j.packageDetail);
  const info: PartInfo = {
    lcsc, mpn: cp["Manufacturer Part"] ?? j.title, manufacturer: cp.Manufacturer ?? "",
    package: fp.name, jlcClass: cp["JLCPCB Part Class"] ?? "",
    datasheet: j.packageDetail.dataStr.head.c_para?.link ?? j.lcsc?.url ?? "", footprint: fp,
    pins: parsePins(j.dataStr),
  };
  mkdirSync(dir, { recursive: true });
  writeFileSync(cached, JSON.stringify(info, null, 1));
  if (opts.assets) {
    const pdf = dir + "datasheet.pdf";
    const ok = opts.datasheet === false || (info.datasheet && await download(info.datasheet, pdf, "%PDF"));
    if (!ok) {
      const alt = await lcscDatasheetUrl(lcsc);
      if (alt && await download(alt, pdf, "%PDF")) info.datasheet = alt;
      else if (existsSync(pdf)) (await import("node:fs")).unlinkSync(pdf);
      writeFileSync(cached, JSON.stringify(info, null, 1));
    }
    if (fp.model) {
      await download(`https://modules.easyeda.com/qAxj6KHrDKw4blvCG8QJPs7Y/${fp.model.uuid}`, dir + "model.step");
      await download(`https://modules.easyeda.com/3dmodel/${fp.model.uuid}`, dir + "model.obj");
    }
  }
  return info;
}

if (import.meta.main) {
  const ids = process.argv.slice(2);
  // no args: every part the design uses (building the design fetches them as a side effect)
  const list = ids.length ? ids : [...new Set((await (await import("../src/design.ts")).build()).parts.map(p => p.info.lcsc))];
  const report = async (id: string) => {
    try {
      const p = await fetchPart(id);
      const d = ROOT + id + "/";
      console.log(`${id}\t${p.mpn}\t${p.footprint.name}\tpads ${p.footprint.pads.length}\tds ${existsSync(d + "datasheet.pdf") ? "y" : "MISSING"}\tstep ${existsSync(d + "model.step") ? "y" : "-"}`);
    } catch (e) { console.log(`${id}\tFAILED ${(e as Error).message}`); }
  };
  // 6 parts in flight at once
  const queue = [...list];
  await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await report(queue.shift()!); }));
}
