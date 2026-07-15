#!/usr/bin/env python3
"""Blender procedural renders of sPHENIX Inner HCal tile assemblies.

Reads tile_params.json (from parse_inner_tile.py) and renders isometric + top
views showing scintillator, serpentine WLS fiber, coating, wrap, light blocker,
and SiPM. Does not require STEP import.

Usage (from physics/):
  blender -b -P cad/sphenix_hcal/scripts/render_inner_tiles.py
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

# Resolve project root: script at cad/sphenix_hcal/scripts/
SCRIPT = Path(__file__).resolve() if "__file__" in dir() else None


def find_root() -> Path:
    # When run via blender -P, __file__ is set
    p = Path(__file__).resolve()
    return p.parents[3]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def mat(name, color, alpha=1.0, rough=0.45, metallic=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = rough
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1.0:
        m.blend_method = "BLEND"
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
    return m


def add_box(name, cx, cy, cz, sx, sy, sz, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx / 2, sy / 2, sz / 2)
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(material)
    return obj


def add_fiber_path(name, path_xy, z, radius, material):
    if len(path_xy) < 2:
        return None
    curve_data = bpy.data.curves.new(name + "_curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 8
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 4
    spline = curve_data.splines.new("POLY")
    spline.points.add(len(path_xy) - 1)
    for i, (x, y) in enumerate(path_xy):
        spline.points[i].co = (x, y, z, 1.0)
    obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(obj)
    curve_data.materials.append(material)
    return obj


def add_mesh_from_gdml(name, gdml_path, material):
    """Import tessellated GDML as a Blender mesh (approx)."""
    import xml.etree.ElementTree as ET

    tree = ET.parse(gdml_path)
    root = tree.getroot()

    def local(tag):
        return tag.split("}")[-1] if "}" in tag else tag

    positions = {}
    for el in root.iter():
        if local(el.tag) != "position":
            continue
        positions[el.get("name")] = (
            float(el.get("x", 0)),
            float(el.get("y", 0)),
            float(el.get("z", 0)),
        )
    verts = []
    name_to_i = {}
    for n, p in positions.items():
        name_to_i[n] = len(verts)
        verts.append(p)
    faces = []
    for el in root.iter():
        if local(el.tag) != "triangular":
            continue
        faces.append(
            (
                name_to_i[el.get("vertex1")],
                name_to_i[el.get("vertex2")],
                name_to_i[el.get("vertex3")],
            )
        )
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def setup_world_camera(bbox, view="iso"):
    # Light
    bpy.ops.object.light_add(type="AREA", location=(bbox["xmax"] + 200, bbox["ymax"] + 200, 300))
    light = bpy.context.active_object
    light.data.energy = 800
    light.data.size = 300
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 200))
    bpy.context.active_object.data.energy = 2.0

    cx = 0.5 * (bbox["xmin"] + bbox["xmax"])
    cy = 0.5 * (bbox["ymin"] + bbox["ymax"])
    cz = 0.5 * (bbox["zmin"] + bbox["zmax"])
    size = max(bbox["dx"], bbox["dy"], 50)

    bpy.ops.object.camera_add()
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam
    if view == "iso":
        cam.location = (cx + size * 1.4, cy - size * 1.5, cz + size * 1.1)
    elif view == "top":
        cam.location = (cx, cy, cz + size * 2.2)
    else:
        cam.location = (cx + size * 2.0, cy, cz + size * 0.3)

    # Point camera at center
    direction = Vector((cx, cy, cz)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 50


def render_tile(root: Path, name: str, params: dict, views=("iso", "top")):
    gdml = root / "reference_documentation/repositories/sPHENIX_HCal/gdml" / f"{name}.gdml"
    out_dir = root / "figures"
    out_dir.mkdir(parents=True, exist_ok=True)
    cad_renders = root / "cad/sphenix_hcal/renders"
    cad_renders.mkdir(parents=True, exist_ok=True)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 128
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 900
    scene.render.image_settings.file_format = "PNG"
    scene.cycles.use_denoising = True

    for view in views:
        clear_scene()
        # Materials must be created after clear_scene (which purges unused mats)
        m_scint = mat("Scint", (0.15, 0.75, 0.3), alpha=0.85, rough=0.35)
        m_fiber = mat("Fiber", (0.95, 0.85, 0.1), rough=0.2)
        m_coat = mat("Coat", (0.92, 0.92, 0.95), alpha=0.25, rough=0.8)
        m_block = mat("Blocker", (0.15, 0.15, 0.2), rough=0.5)
        m_sipm = mat("SiPM", (0.85, 0.1, 0.1), metallic=0.4, rough=0.25)

        if gdml.exists():
            add_mesh_from_gdml("Scintillator", gdml, m_scint)
        else:
            bb = params["bbox"]
            add_box(
                "Scintillator",
                0.5 * (bb["xmin"] + bb["xmax"]),
                0.5 * (bb["ymin"] + bb["ymax"]),
                params["z_mid_mm"],
                bb["dx"],
                bb["dy"],
                bb["dz"],
                m_scint,
            )

        add_fiber_path("WLS_Fiber", params["fiber_path_xy"], params["z_mid_mm"], params["fiber_radius_mm"], m_fiber)

        bb = params["bbox"]
        # Coating as slightly larger thin box (visual only)
        add_box(
            "Coating",
            0.5 * (bb["xmin"] + bb["xmax"]),
            0.5 * (bb["ymin"] + bb["ymax"]),
            params["z_mid_mm"],
            bb["dx"] + 1.0,
            bb["dy"] + 1.0,
            bb["dz"] + 0.4,
            m_coat,
        )
        b = params["blocker"]
        add_box("LightBlocker", b["cx"], b["cy"], b["cz"], b["sx"], b["sy"], b["sz"], m_block)
        s = params["sipm"]
        add_box("SiPM", s["cx"], s["cy"], s["cz"], s["sx"], s["sy"], s["sz"], m_sipm)

        setup_world_camera(bb, view=view)
        # World background
        world = bpy.data.worlds.new("World") if "World" not in bpy.data.worlds else bpy.data.worlds["World"]
        scene.world = world
        world.use_nodes = True
        bg = world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.08, 0.09, 0.11, 1)
            bg.inputs[1].default_value = 1.0

        fname = f"hcal_{name}_{view}.png"
        scene.render.filepath = str(out_dir / fname)
        bpy.ops.render.render(write_still=True)
        # Copy into cad renders
        import shutil

        shutil.copy2(out_dir / fname, cad_renders / fname)
        print(f"Rendered {fname}")


def main():
    root = find_root()
    params_path = root / "cad/sphenix_hcal/tile_params.json"
    if not params_path.exists():
        print("Missing tile_params.json — run parse_inner_tile.py first")
        sys.exit(1)
    params_all = json.loads(params_path.read_text())
    # Render representative tiles: smallest, mid, largest
    picks = []
    for key in ("InnerHCalTile01_EJ200", "InnerHCalTile06_EJ200", "InnerHCalTile12_EJ200"):
        if key in params_all:
            picks.append(key)
    if not picks:
        picks = list(params_all.keys())[:3]
    for name in picks:
        render_tile(root, name, params_all[name])
    print("Done.")


if __name__ == "__main__":
    main()
