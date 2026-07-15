#!/usr/bin/env python3
"""Export flat mesh JSON for Geant4 hcal_tile (no GDML dependency)."""
from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def main():
    params_path = ROOT / "cad/sphenix_hcal/tile_params.json"
    gdml_dir = ROOT / "reference_documentation/repositories/sPHENIX_HCal/gdml"
    out_dir = ROOT / "sim/geant4/gdml/mesh"
    out_dir.mkdir(parents=True, exist_ok=True)
    params = json.loads(params_path.read_text())

    for name, p in params.items():
        path = gdml_dir / f"{name}.gdml"
        tree = ET.parse(path)
        root = tree.getroot()
        positions = {}
        order = []
        for el in root.iter():
            if local(el.tag) != "position":
                continue
            n = el.get("name")
            positions[n] = [
                float(el.get("x", 0)),
                float(el.get("y", 0)),
                float(el.get("z", 0)),
            ]
            order.append(n)
        name_to_i = {n: i for i, n in enumerate(order)}
        verts = [positions[n] for n in order]
        faces = []
        for el in root.iter():
            if local(el.tag) != "triangular":
                continue
            faces.append(
                [
                    name_to_i[el.get("vertex1")],
                    name_to_i[el.get("vertex2")],
                    name_to_i[el.get("vertex3")],
                ]
            )
        bb = p["bbox"]
        data = {
            "name": name,
            "vertices_mm": verts,
            "faces": faces,
            "params": p,
            "xmin": bb["xmin"],
            "xmax": bb["xmax"],
            "ymin": bb["ymin"],
            "ymax": bb["ymax"],
            "zmin": bb["zmin"],
            "zmax": bb["zmax"],
            "z_mid_mm": p["z_mid_mm"],
            "fiber_radius_mm": p["fiber_radius_mm"],
            "clad_outer_mm": p["clad_outer_mm"],
            "coating_thickness_mm": p["coating_thickness_mm"],
            "wrap_thickness_mm": p["wrap_thickness_mm"],
            "fiber_path_xy": p["fiber_path_xy"],
            "blocker": p["blocker"],
            "sipm": p["sipm"],
        }
        out = out_dir / f"{name}_mesh.json"
        out.write_text(json.dumps(data))
        print(f"Wrote {out} ({len(verts)} verts, {len(faces)} faces)")


if __name__ == "__main__":
    main()
