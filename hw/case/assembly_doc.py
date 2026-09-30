"""Collect the assembly renders into hw/docs/assembly/ and fill the shape table in the top-level README.md.
Reads hw/out/assembly/tileNN/manifest.json and hw/out/assembly/render/*.png (see build_assemblies.sh).
Usage: python hw/case/assembly_doc.py"""
import json, math, os, re, shutil, subprocess
HW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(HW, "out", "assembly"); DST = os.path.join(HW, "docs", "assembly"); os.makedirs(DST, exist_ok=True)
REN = os.path.join(SRC, "render")

rows = []
for n in range(1, 13):
    mp = os.path.join(SRC, f"tile{n:02d}", "manifest.json")
    if not os.path.exists(mp): continue
    M = json.load(open(mp)); P = {p["name"]: p for p in M["parts"]}
    xs = [h[0] for h in M["hull"]]; ys = [h[1] for h in M["hull"]]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    rods = M["rods"]; rx = [r[0] for r in rods]
    x_ext = max(max(rx) + 7, M["plate_x"][1]) - min(min(rx) - 7, M["plate_x"][0])
    split = M.get("plate_split", False)
    cab = [P[f"Cable_{k}"]["vol"] / (math.pi * 0.57 ** 2) for k in range(4)]
    abs_v = sum(p["vol"] for p in M["parts"] if tuple(p["color"]) == (0.86, 0.8, 0.62)) / 1000
    top = max(ys) - min(ys)
    slant = math.degrees(math.atan2(M["hull"][3][0] - M["hull"][0][0], M["hull"][3][1] - M["hull"][0][1]))
    rows.append((n, w, h, slant, x_ext, split, min(cab), max(cab), abs_v, len(M["parts"]), M.get("fiber", {})))
    for v in ("top_fixed", "iso_back", "iso_front"):
        s = os.path.join(REN, f"tile{n:02d}_{v}.png")
        if os.path.exists(s) and v == "top_fixed":       # same scale for every shape; crop the empty right-hand side
            subprocess.run(["magick", s, "-crop", "1180x820+0+40", "+repage", os.path.join(DST, f"tile{n:02d}_top.png")], check=True)

table = ["| Tile | Bounding box (mm) | Left-edge slant | Stack footprint x × y × z (mm) | Fiber loop: lean, legs apart, length | Distance tile → fiber: mean / 95 % / max | Plate bars | Coax (mm) | ABS volume |", "|---|---|---|---|---|---|---|---|---|"]
for n, w, h, sl, xe, split, c0, c1, av, npart, fb in rows:
    table.append(f"| {n:02d} | {w:.0f} × {h:.0f} | {sl:.0f}° | {xe:.0f} × 244 × 344 | {fb.get('lean_deg', 0):.1f}°, {fb.get('spacing_mm', 0):.0f} mm, {fb.get('length', 0):.0f} mm | {fb.get('mean_dist_mm', 0):.0f} / {fb.get('p95_dist_mm', 0):.0f} / {fb.get('max_dist_mm', 0):.0f} mm | {'3 × 2 halves + splice' if split else '3 × 1 piece'} | {c0:.0f} | {av:.0f} cm³ |")
TABLE = "\n".join(table)

# contact sheet: the same scale for every shape
sheet = os.path.join(DST, "shapes_top.png")
tiles = [os.path.join(DST, f"tile{n:02d}_top.png") for n, *_ in rows if os.path.exists(os.path.join(DST, f"tile{n:02d}_top.png"))]
if tiles:
    args = ["magick", "montage", "-font", "/System/Library/Fonts/Supplemental/Arial.ttf"]
    for n, t in zip([r[0] for r in rows], tiles): args += ["-label", f"tile {n:02d}", t]
    args += ["-tile", "3x", "-geometry", "620x430+6+6", "-pointsize", "24", "-background", "#e5e7ec", sheet]
    subprocess.run(args, check=True)
for v, tiles_ in (("iso_back", (1, 12)), ("explode_elec", (1,)), ("sec_x_sipm", (1,)), ("sec_x_case", (1,)), ("sec_zcase", (1,)), ("sec_ztile", (1,)),
                  ("panel_bare", (1, 6, 12)), ("panel_layers", (1,)), ("step1", (1,)), ("step2", (1,)), ("step3", (1,)), ("step4", (1,)), ("step5", (1,))):
    for n in tiles_:
        s = os.path.join(REN, f"tile{n:02d}_{v}.png")
        if os.path.exists(s): subprocess.run(["magick", s, "-resize", "1500x1500>", os.path.join(DST, f"tile{n:02d}_{v}.png")], check=True)

pb = [os.path.join(DST, f"tile{n:02d}_panel_bare.png") for n in (1, 6, 12)]
if all(os.path.exists(q) for q in pb):          # the three bare panels side by side
    subprocess.run(["magick", *pb, "-resize", "900x", "+append", os.path.join(DST, "panels_bare.png")], check=True)

md = os.path.join(HW, "..", "README.md")
s = open(md).read()
s = re.sub(r"<!-- SHAPES -->.*?<!-- /SHAPES -->", f"<!-- SHAPES -->\n{TABLE}\n<!-- /SHAPES -->", s, flags=re.S)
open(md, "w").write(s)
print(TABLE)
