#!/usr/bin/env python3
"""Build STEP assemblies for sPHENIX Inner HCal tiles via FreeCAD.

Each assembly includes:
  1. Original tessellated scintillator solid (from GDML, kept as mesh solid)
  2. WLS fiber (swept pipe along serpentine dual-end path)
  3. Diffuse white coating shell (outer offset approximation)
  4. Light-tight wrapping shell
  5. Plastic light blocker / SiPM coupler at fiber exit
  6. SiPM body at the coupler

Usage (from physics/ root):
  /Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd \\
      cad/sphenix_hcal/scripts/build_inner_tile_step.py

  # or with system freecadcmd on PATH:
  freecadcmd cad/sphenix_hcal/scripts/build_inner_tile_step.py

Original GDML files under originals/ and the upstream clone are never modified.
"""
from __future__ import annotations

import json
import math
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# FreeCAD modules available when launched via freecadcmd
import FreeCAD as App
import Mesh
import Part
import MeshPart


def project_root() -> Path:
    # Script lives at cad/sphenix_hcal/scripts/
    return Path(__file__).resolve().parents[3]


def local_tag(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def load_mesh_from_gdml(gdml_path: Path) -> Mesh.Mesh:
    tree = ET.parse(gdml_path)
    root = tree.getroot()
    positions = {}
    for el in root.iter():
        if local_tag(el.tag) != "position":
            continue
        positions[el.get("name")] = (
            float(el.get("x", 0)),
            float(el.get("y", 0)),
            float(el.get("z", 0)),
        )
    mesh = Mesh.Mesh()
    for el in root.iter():
        if local_tag(el.tag) != "triangular":
            continue
        v1 = positions[el.get("vertex1")]
        v2 = positions[el.get("vertex2")]
        v3 = positions[el.get("vertex3")]
        # FreeCAD expects nine floats or three App.Vector
        mesh.addFacet(
            v1[0], v1[1], v1[2],
            v2[0], v2[1], v2[2],
            v3[0], v3[1], v3[2],
        )
    return mesh


def mesh_to_shape(mesh: Mesh.Mesh):
    """Convert mesh to a Part shape (shell/solid). Falls back to compound of faces."""
    try:
        shape = MeshPart.meshFromShape  # noqa: F841 — probe import
    except Exception:
        pass
    # Preferred: create shape from mesh
    try:
        shape = Part.Shape()
        shape.makeShapeFromMesh(mesh.Topology, 0.1)
        solid = Part.makeSolid(shape)
        if solid.isValid() and solid.Volume > 0:
            return solid
        if shape.Faces:
            return shape
    except Exception as exc:
        print(f"  warn: makeShapeFromMesh failed ({exc}); using face compound")
    # Fallback: individual triangular faces
    faces = []
    for facet in mesh.Facets:
        pts = [App.Vector(*p) for p in facet.Points]
        try:
            wire = Part.makePolygon(pts + [pts[0]])
            faces.append(Part.Face(wire))
        except Exception:
            continue
    if not faces:
        raise RuntimeError("Could not build any faces from mesh")
    return Part.makeCompound(faces)


def make_fiber_pipe(path_xy, z: float, radius: float):
    """Sweep a circular profile along a 3D polyline path."""
    if len(path_xy) < 2:
        raise ValueError("fiber path too short")
    pts = [App.Vector(p[0], p[1], z) for p in path_xy]
    # Remove near-duplicates
    cleaned = [pts[0]]
    for p in pts[1:]:
        if (p - cleaned[-1]).Length > 0.2:
            cleaned.append(p)
    if len(cleaned) < 2:
        raise ValueError("fiber path collapsed")

    # Build wire from segments
    edges = []
    for a, b in zip(cleaned[:-1], cleaned[1:]):
        edges.append(Part.makeLine(a, b))
    wire = Part.Wire(edges)

    # Discretize and make a pipe shell via successive frustums / loft circles
    # FreeCAD makePipe needs a profile at start; use makeTube if available
    try:
        # Approximate continuous tube with fused cylinders + spheres at joints
        solids = []
        for a, b in zip(cleaned[:-1], cleaned[1:]):
            direction = b - a
            length = direction.Length
            if length < 1e-6:
                continue
            cyl = Part.makeCylinder(radius, length, a, direction)
            solids.append(cyl)
            solids.append(Part.makeSphere(radius, a))
        solids.append(Part.makeSphere(radius, cleaned[-1]))
        shape = solids[0]
        for s in solids[1:]:
            shape = shape.fuse(s)
        return shape.removeSplitter()
    except Exception as exc:
        print(f"  warn: fiber fuse failed ({exc}); returning compound")
        return Part.makeCompound(solids)


def make_box(cx, cy, cz, sx, sy, sz):
    # FreeCAD makeBox origin is corner; shift to center
    return Part.makeBox(sx, sy, sz, App.Vector(cx - sx / 2, cy - sy / 2, cz - sz / 2))


def make_coating_shell(bbox: dict, thickness: float, z_mid: float, dz: float):
    """Simple rectangular shell approximating white diffuse coating on faces."""
    margin = 1.0
    outer = Part.makeBox(
        bbox["dx"] + 2 * margin,
        bbox["dy"] + 2 * margin,
        dz + 2 * thickness,
        App.Vector(bbox["xmin"] - margin, bbox["ymin"] - margin, z_mid - dz / 2 - thickness),
    )
    inner = Part.makeBox(
        bbox["dx"] + 2 * margin - 2 * thickness,
        bbox["dy"] + 2 * margin - 2 * thickness,
        dz,
        App.Vector(
            bbox["xmin"] - margin + thickness,
            bbox["ymin"] - margin + thickness,
            z_mid - dz / 2,
        ),
    )
    try:
        return outer.cut(inner)
    except Exception:
        return outer


def export_step(shapes_named, out_path: Path):
    """Export a multi-solid STEP with named compounds."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    doc = App.newDocument("InnerHCalTileAssembly")
    compound_shapes = []
    for name, shape in shapes_named:
        obj = doc.addObject("Part::Feature", name)
        obj.Shape = shape
        compound_shapes.append(shape)
    # Also write a single compound STEP for CAD tools that prefer one root
    compound = Part.makeCompound([s for _, s in shapes_named])
    compound.exportStep(str(out_path))
    # Save FreeCAD document for re-edit
    fcstd = out_path.with_suffix(".FCStd")
    doc.saveAs(str(fcstd))
    App.closeDocument(doc.Name)
    print(f"  wrote {out_path} (+ {fcstd.name})")


def build_one(tile_name: str, params: dict, gdml_path: Path, out_dir: Path, stl_dir: Path):
    print(f"Building {tile_name} ...")
    mesh = load_mesh_from_gdml(gdml_path)
    stl_dir.mkdir(parents=True, exist_ok=True)
    stl_path = stl_dir / f"{tile_name}_scintillator.stl"
    mesh.write(str(stl_path))

    scint_shape = mesh_to_shape(mesh)
    z_mid = params["z_mid_mm"]
    fiber_r = params["fiber_radius_mm"]
    fiber = make_fiber_pipe(params["fiber_path_xy"], z_mid, fiber_r)

    coating = make_coating_shell(
        params["bbox"], params["coating_thickness_mm"], z_mid, params["thickness_mm"]
    )
    wrap = make_coating_shell(
        params["bbox"],
        params["coating_thickness_mm"] + params["wrap_thickness_mm"],
        z_mid,
        params["thickness_mm"],
    )
    # Wrapping is outer shell minus coating envelope — approximate as thicker shell only
    # for visualization; boolean difference can be fragile
    try:
        wrap = wrap.cut(coating)
    except Exception:
        pass

    b = params["blocker"]
    blocker = make_box(b["cx"], b["cy"], b["cz"], b["sx"], b["sy"], b["sz"])
    s = params["sipm"]
    sipm = make_box(s["cx"], s["cy"], s["cz"], s["sx"], s["sy"], s["sz"])

    shapes = [
        ("Scintillator_EJ200", scint_shape),
        ("WLS_Fiber", fiber),
        ("DiffuseCoating", coating),
        ("LightTightWrap", wrap),
        ("LightBlocker_Coupler", blocker),
        ("SiPM", sipm),
    ]
    out_step = out_dir / f"{tile_name}_assembly.step"
    export_step(shapes, out_step)

    # Also export individual STLs for Blender / quick viz
    for name, shape in shapes:
        try:
            m = MeshPart.meshFromShape(Shape=shape, LinearDeflection=0.2, AngularDeflection=0.1)
            m.write(str(stl_dir / f"{tile_name}_{name}.stl"))
        except Exception as exc:
            print(f"  warn: STL export {name}: {exc}")


def main(argv=None):
    root = project_root()
    params_path = root / "cad/sphenix_hcal/tile_params.json"
    if not params_path.exists():
        # Generate params first
        sys.path.insert(0, str(root / "cad/sphenix_hcal/scripts"))
        from parse_inner_tile import main as parse_main

        sys.argv = [
            "parse_inner_tile.py",
            "--gdml-dir",
            str(root / "reference_documentation/repositories/sPHENIX_HCal/gdml"),
            "--out",
            str(params_path),
        ]
        parse_main()

    params_all = json.loads(params_path.read_text())
    out_dir = root / "cad/sphenix_hcal/step"
    stl_dir = root / "cad/sphenix_hcal/stl"
    gdml_dir = root / "reference_documentation/repositories/sPHENIX_HCal/gdml"

    # Build a representative subset by default for speed; env/all via args
    want = None
    if argv is None:
        argv = sys.argv[1:]
    if argv and argv[0] != "--":
        # freecadcmd passes script path; remaining args after --
        if "--" in argv:
            argv = argv[argv.index("--") + 1 :]
        else:
            # when run as freecadcmd script.py [args]
            argv = [a for a in argv if not a.endswith(".py")]
    if argv:
        want = set(a if a.startswith("Inner") else f"InnerHCalTile{a.zfill(2)}_EJ200" for a in argv)

    built = 0
    for name, params in sorted(params_all.items()):
        if want and name not in want:
            continue
        gdml = gdml_dir / f"{name}.gdml"
        if not gdml.exists():
            print(f"skip missing {gdml}")
            continue
        try:
            build_one(name, params, gdml, out_dir, stl_dir)
            built += 1
        except Exception as exc:
            print(f"ERROR {name}: {exc}")
            import traceback

            traceback.print_exc()
    print(f"Done. Built {built} assemblies into {out_dir}")


# freecadcmd executes the file; call main
if __name__ == "__main__" or __name__ == "__builtin__" or True:
    # When loaded by freecadcmd, __name__ may not be __main__
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        print("Fatal:", e)
        import traceback

        traceback.print_exc()
        sys.exit(1)
