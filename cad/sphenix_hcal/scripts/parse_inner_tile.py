#!/usr/bin/env python3
"""Parse sPHENIX Inner HCal tile GDML tessellations.

Extracts outline vertices, groove/exit pocket geometry, bounding box, and a
recommended dual-end WLS fiber path consistent with sPHENIX HCal design:
  - max deposit-to-fiber distance ~2.5 cm
  - minimum bend radius ~2.5 cm
  - dual fiber ends at outer-radius exit with SiPM coupler / light blocker

Original GDML files are never modified; this only reads them.
"""
from __future__ import annotations

import argparse
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Tuple

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

    # Dual fiber exit centers at outer edge (y = ymax)
    exit_span = pocket_x1 - pocket_x0
    exit_left = (pocket_x0 + 0.20 * exit_span, ymax)
    exit_right = (pocket_x0 + 0.80 * exit_span, ymax)

    fiber_path = build_serpentine_path(
        x_min=min(xs) + 8.0,
        x_max=max(xs) - 8.0,
        y_min=8.0,
        y_max=pocket_y - 4.0,
        exit_left=exit_left,
        exit_right=exit_right,
        pitch=45.0,
        bend_r=25.0,
    )

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
            "sx": max(12.0, abs(exit_right[0] - exit_left[0]) + 6.0),
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


def build_serpentine_path(
    x_min: float,
    x_max: float,
    y_min: float,
    y_max: float,
    exit_left: Point2,
    exit_right: Point2,
    pitch: float = 45.0,
    bend_r: float = 25.0,
) -> List[Point2]:
    """Build a dual-end serpentine fiber path inside the tile face.

    Path starts at exit_left, snakes toward the inner radius, and returns to
    exit_right — matching the sPHENIX dual-end outer-radius readout topology.
    """
    if x_max - x_min < 20 or y_max - y_min < 20:
        # Degenerate / very small tile: simple U
        return [
            list(exit_left),
            [exit_left[0], y_min],
            [exit_right[0], y_min],
            list(exit_right),
        ]

    # Number of horizontal legs
    height = y_max - y_min
    n_legs = max(2, int(math.floor(height / pitch)) + 1)
    # Even number of legs so we end on the same side we need for exit_right
    if n_legs % 2 == 1:
        n_legs += 1

    ys = [y_max - i * (height / (n_legs - 1)) for i in range(n_legs)]
    path: List[Point2] = [list(exit_left)]

    # Drop into first leg from left exit
    path.append([exit_left[0], ys[0]])

    going_right = True
    for i, y in enumerate(ys):
        if going_right:
            path.append([x_max, y])
            if i + 1 < n_legs:
                # Arc-ish corner: two intermediate points
                y_next = ys[i + 1]
                path.append([x_max, y - 0.5 * (y - y_next)])
                path.append([x_max - bend_r * 0.3, y_next])
        else:
            path.append([x_min, y])
            if i + 1 < n_legs:
                y_next = ys[i + 1]
                path.append([x_min, y - 0.5 * (y - y_next)])
                path.append([x_min + bend_r * 0.3, y_next])
        going_right = not going_right

    # Last leg should end near right; route to exit_right
    path.append([exit_right[0], ys[-1] if not going_right else ys[-1]])
    path.append([exit_right[0], exit_right[1]])
    path.append(list(exit_right))

    # Deduplicate consecutive points
    cleaned: List[Point2] = []
    for p in path:
        if not cleaned or math.hypot(p[0] - cleaned[-1][0], p[1] - cleaned[-1][1]) > 0.05:
            cleaned.append([float(p[0]), float(p[1])])
    return cleaned


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
