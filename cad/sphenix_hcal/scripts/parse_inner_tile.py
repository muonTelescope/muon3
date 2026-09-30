#!/usr/bin/env python3
"""Parse sPHENIX Inner HCal tile GDML tessellations.

Extracts outline vertices, the connector-pocket geometry and the bounding box. The GDML has NO fiber, so the WLS fiber is
added from fiber_loop.py: one closed loop, both ends side by side at the SiPM edge (Aidala et al. 2018, Fig. 6):
  - max deposit-to-fiber distance ~2.5 cm
  - minimum bend radius ~2.5 cm
  - one compact coupler + one 3x3 mm SiPM centred on the two fiber ends, 0.75 mm air gap

Original GDML files are never modified; this only reads them.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fiber_loop import loop_tokens, dense  # noqa: E402

Point3 = Tuple[float, float, float]
Point2 = Tuple[float, float]


def _local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def parse_tile_gdml(path: Path) -> dict:
    tree = ET.parse(path)
    root = tree.getroot()

    positions: Dict[str, Point3] = {}
    for el in root.iter():
        if _local(el.tag) != "position":
            continue
        name = el.get("name")
        if not name:
            continue
        positions[name] = (
            float(el.get("x", 0.0)),
            float(el.get("y", 0.0)),
            float(el.get("z", 0.0)),
        )

    triangles: List[Tuple[str, str, str]] = []
    for el in root.iter():
        if _local(el.tag) != "triangular":
            continue
        triangles.append(
            (el.get("vertex1"), el.get("vertex2"), el.get("vertex3"))
        )

    xs = [p[0] for p in positions.values()]
    ys = [p[1] for p in positions.values()]
    zs = [p[2] for p in positions.values()]
    z_lo, z_hi = min(zs), max(zs)
    thickness = z_hi - z_lo
    z_mid = 0.5 * (z_lo + z_hi)

    # Bottom face vertices (for 2D outline / pocket analysis)
    bot = [(n, p[0], p[1]) for n, p in positions.items() if abs(p[2] - z_lo) < 1e-3]
    # Outer corners of the tile face (not in the groove fillet chain)
    # Heuristic: points on the convex hull of bottom face.
    hull = _convex_hull([(x, y) for _, x, y in bot])

    # Groove / fiber-exit pocket: points near ymax with an indent from outer edge.
    ymax = max(ys)
    top_band = [(x, y) for _, x, y in bot if y > ymax - 12.0]
    # Pocket floor is the min y in the top band excluding pure corners on ymax
    pocket_pts = [(x, y) for x, y in top_band if y < ymax - 0.5]
    if pocket_pts:
        pocket_y = min(y for _, y in pocket_pts)
        pocket_xs = [x for x, y in pocket_pts]
        pocket_x0, pocket_x1 = min(pocket_xs), max(pocket_xs)
    else:
        pocket_y = ymax - 8.0
        pocket_x0, pocket_x1 = min(xs) + 30.0, max(xs) - 20.0

    # One fiber loop; both ends at the SiPM edge, 1.2 mm apart, centred on the SiPM x of the source CAD
    x0 = min(xs)
    hull_local = [(x - x0, y) for x, y in hull]
    sipm_x = 0.5 * (pocket_x0 + pocket_x1) - x0
    tok, loop = loop_tokens(hull_local, sipm_x, ymax)
    fiber_path = [[x + x0, y] for x, y in dense(tok, 1.0)]
    exit_left, exit_right = tuple(fiber_path[0]), tuple(fiber_path[-1])

    mesh_verts = list(positions.values())
    mesh_faces = []
    name_to_idx = {n: i for i, n in enumerate(positions.keys())}
    for a, b, c in triangles:
        if a in name_to_idx and b in name_to_idx and c in name_to_idx:
            mesh_faces.append((name_to_idx[a], name_to_idx[b], name_to_idx[c]))

    return {
        "name": path.stem,
        "source_gdml": str(path.resolve()),
        "bbox": {
            "xmin": min(xs),
            "xmax": max(xs),
            "ymin": min(ys),
            "ymax": max(ys),
            "zmin": z_lo,
            "zmax": z_hi,
            "dx": max(xs) - min(xs),
            "dy": max(ys) - min(ys),
            "dz": thickness,
        },
        "thickness_mm": thickness,
        "z_mid_mm": z_mid,
        "hull_xy": hull,
        "pocket": {
            "x0": pocket_x0,
            "x1": pocket_x1,
            "y_floor": pocket_y,
            "y_exit": ymax,
        },
        "fiber_exit": {"left": list(exit_left), "right": list(exit_right)},
        "fiber_loop": {k: round(v, 3) for k, v in loop.items()},
        "fiber_tokens": [[t[0], *[[round(c, 4) for c in q] for q in t[1:]]] for t in tok],     # local coordinates (x from the tile's xmin): the FreeCAD assembly sweeps these
        "fiber_path_xy": fiber_path,
        "fiber_radius_mm": 0.50,  # Kuraray single-clad ~1.0 mm diameter
        "clad_outer_mm": 0.60,
        "coating_thickness_mm": 0.10,  # white diffuse ~50 um, thickened for CAD
        "wrap_thickness_mm": 0.20,  # light-tight outer wrapping
        "blocker": {
            # Plastic SiPM coupler / light blocker at outer-radius exit
            # (sPHENIX tile mount for dual fiber ends + Hamamatsu MPPC)
            "cx": 0.5 * (exit_left[0] + exit_right[0]),
            "cy": ymax + 3.0,
            "cz": z_mid,
            "sx": 16.0,
            "sy": 6.0,
            "sz": max(4.0, thickness + 1.0),
        },
        # Hamamatsu S12572-33-015P (sPHENIX HCal SiPM / MPPC):
        #   - 3×3 mm² active area, 15 μm pixels (~40 000 pixels)
        #   - PDE ~25% (device average; green / WLS band)
        #   - Gain ~2.3e5 at ~4 V over breakdown (Aidala et al. IEEE TNS 2018)
        #   - ~0.75 mm air gap from dual fiber ends to SiPM face (spread light,
        #     limit optical saturation)
        # Not the Muon3 onsemi MicroFC-30035.
        "sipm": {
            "part": "Hamamatsu S12572-33-015P",
            "manufacturer": "Hamamatsu",
            "active_mm": 3.0,
            "pixel_pitch_um": 15,
            "n_pixels": 40000,
            "pde": 0.25,
            "air_gap_mm": 0.75,
            "cx": 0.5 * (exit_left[0] + exit_right[0]),
            # Face at ymax + air_gap; package center half-depth beyond face
            "cy": ymax + 0.75 + 0.5 * 1.5,
            "cz": z_mid,
            "sx": 3.0,
            "sy": 1.5,
            "sz": 3.0,
        },
        "mesh": {
            "vertices": mesh_verts,
            "faces": mesh_faces,
            "vertex_names": list(positions.keys()),
        },
    }


def _convex_hull(pts: List[Point2]) -> List[Point2]:
    pts = sorted(set((round(x, 6), round(y, 6)) for x, y in pts))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--gdml-dir",
        type=Path,
        default=Path("reference_documentation/repositories/sPHENIX_HCal/gdml"),
    )
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("cad/sphenix_hcal/tile_params.json"),
    )
    ap.add_argument("--tiles", type=str, default="all", help="all or e.g. 01,06,12")
    args = ap.parse_args()

    if args.tiles == "all":
        files = sorted(args.gdml_dir.glob("InnerHCalTile*_EJ200.gdml"))
    else:
        ids = [t.strip().zfill(2) for t in args.tiles.split(",")]
        files = [args.gdml_dir / f"InnerHCalTile{i}_EJ200.gdml" for i in ids]

    results = {}
    for f in files:
        if not f.exists():
            raise SystemExit(f"Missing {f}")
        data = parse_tile_gdml(f)
        # Drop full mesh from summary JSON (large); keep path to source
        mesh = data.pop("mesh")
        data["n_vertices"] = len(mesh["vertices"])
        data["n_faces"] = len(mesh["faces"])
        results[data["name"]] = data
        print(
            f"{data['name']}: {data['bbox']['dx']:.1f} x {data['bbox']['dy']:.1f} x "
            f"{data['bbox']['dz']:.2f} mm, fiber pts={len(data['fiber_path_xy'])}"
        )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(results, indent=2))
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
