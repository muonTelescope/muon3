# Blender renderer for the FreeCAD tile-stack assembly (manifest.json from assembly.py).
#   blender -b --factory-startup --python hw/case/render_assembly.py -- <manifest.json> <outdir> [view,view,...]
# Views: iso_front, iso_back, top, side, detail_coupler, sec_x, sec_zcase, sec_ztile, step1..step5, explode_elec
import bpy, json, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
MAN = json.load(open(argv[0])); OUT = argv[1]; ONLY = argv[2].split(",") if len(argv) > 2 else None
os.makedirs(OUT, exist_ok=True)
TILE = MAN["tile"]
W = max(x for x, _ in MAN["hull"]) ; D = 260.0; H = 330.0
CX = W / 2

STEPS = {"step1": ["tile", "sipm"], "step2": ["tile", "sipm", "frame"], "step3": ["tile", "sipm", "frame", "plate"],
         "step4": ["tile", "sipm", "frame", "plate", "electronics", "display"], "step5": ["tile", "sipm", "frame", "plate", "electronics", "display", "cables"]}
ALL = ["tile", "sipm", "frame", "plate", "electronics", "display", "cables"]
xs, zc = MAN["xs"], MAN["zc"]
R = math.sqrt(W * W + D * D + H * H)
VIEWS = {
    "iso_front": dict(dir=(-0.75, -1.0, 0.62), look=(CX, 100, 150), ortho=1.08 * R, groups=ALL, res=(1500, 1700)),
    "iso_back": dict(dir=(0.85, 1.0, 0.55), look=(CX, 100, 150), ortho=1.08 * R, groups=ALL, res=(1500, 1700)),
    "top": dict(dir=(0, 0.001, 1), look=(CX, 100, 150), ortho=max(W, D) * 1.15, groups=ALL, up=(0, 1, 0)),
    "top_fixed": dict(dir=(0, 0.001, 1), look=(210, 105, 150), ortho=520, groups=["tile", "sipm", "frame"], up=(0, 1, 0), res=(1300, 900)),  # same scale for every shape
    "side": dict(dir=(1, 0, 0.001), look=(CX, 100, 150), ortho=max(H, D) * 1.12, groups=ALL, up=(0, 0, 1)),
    "sec_x_sipm": dict(dir=(1, 0, 0.001), look=(xs, 198, 300), ortho=75, groups=ALL, up=(0, 0, 1), cut="sec_x"),
    "sec_x_case": dict(dir=(1, 0, 0.001), look=(xs, 214, zc), ortho=110, groups=ALL, up=(0, 0, 1), cut="sec_x"),
    "detail_coupler": dict(dir=(-0.6, 1.0, 0.7), look=(xs, 200, 300), ortho=110, groups=ALL),
    "sec_x": dict(dir=(1, 0, 0.001), look=(xs, 110, 150), ortho=max(H, D) * 1.12, groups=ALL, up=(0, 0, 1), cut="sec_x"),
    "sec_zcase": dict(dir=(0, 0.001, 1), look=(xs + 20, 215, zc), ortho=230, groups=ALL, up=(0, 1, 0), cut="sec_zcase"),
    "sec_ztile": dict(dir=(0, 0.001, 1), look=(CX, 100, 300), ortho=max(W, D) * 1.15, groups=ALL, up=(0, 1, 0), cut="sec_ztile"),
    "explode_elec": dict(dir=(0.8, 1.0, 0.55), look=(xs, 235, zc), ortho=260, groups=["electronics", "display", "plate", "cables"],
                         explode={"Case_Lid": (0, 55, 0), "PCB": (0, 26, 0), "LidScrew": (0, 80, 0), "Pod": (0, 30, 0), "OLED": (0, 14, 0), "PodScrew": (0, 60, 0)}),
}
for k, g in STEPS.items():
    VIEWS[k] = dict(dir=(0.85, 1.0, 0.55), look=(CX, 120, 150), ortho=1.08 * R, groups=g, res=(1500, 1700))
    if k == "step1": VIEWS[k].update(dir=(-0.75, -1.0, 0.62))
    if k in ("step2",): VIEWS[k].update(dir=(-0.75, -1.0, 0.62))

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.read_homefile  # noqa
def material(name, color, alpha):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = 0.55
    b.inputs["Alpha"].default_value = alpha
    if alpha < 1:
        if hasattr(m, "surface_render_method"): m.surface_render_method = "BLENDED"
        else: m.blend_method = "BLEND"
    return m

def render(vname, v):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = v.get("res", (1800, 1200))
    sc.world = bpy.data.worlds.new("w"); sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.86, 0.87, 0.90, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    cut = v.get("cut")
    mats = {}
    n = 0
    for p in MAN["parts"]:
        if p["group"] not in v["groups"]: continue
        if cut:
            path = p["sec"].get(cut)
            if not path: continue
            mtx = Matrix.Identity(4)
        else:
            path = p["stl"]; a = p["matrix"]; mtx = Matrix(((a[0], a[1], a[2], a[3]), (a[4], a[5], a[6], a[7]), (a[8], a[9], a[10], a[11]), (0, 0, 0, 1)))
        if not os.path.exists(path): continue
        bpy.ops.wm.stl_import(filepath=path)
        o = bpy.context.selected_objects[0]
        o.matrix_world = mtx
        for key, off in v.get("explode", {}).items():
            if p["name"].startswith(key): o.location += Vector(off)
        key = (tuple(p["color"]), p["alpha"])
        if key not in mats: mats[key] = material(f"m{len(mats)}", p["color"], p["alpha"])
        o.data.materials.append(mats[key]); n += 1
        bpy.context.view_layer.objects.active = o
        try: bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
        except Exception: pass
    look = Vector(v["look"]); d = Vector(v["dir"]).normalized()
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = "ORTHO"; cam.data.ortho_scale = v["ortho"]; cam.data.clip_start = 1; cam.data.clip_end = 20000
    cam.location = look + d * 3000
    up = Vector(v.get("up", (0, 0, 1)))
    cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
    if "up" in v:
        fwd = (look - cam.location).normalized(); right = fwd.cross(up).normalized(); realup = right.cross(fwd)
        m = Matrix((right, realup, -fwd)).transposed(); cam.rotation_euler = m.to_euler()
    for direction, e in (((-0.4, -0.8, -1.0), 3.2), ((0.7, 0.4, -0.6), 1.8), ((0.0, 0.3, 1.0), 0.5)):
        l = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); l.data.energy = e; sc.collection.objects.link(l)
        l.rotation_euler = Vector(direction).to_track_quat("-Z", "Y").to_euler()
    vl = bpy.context.view_layer
    sc.render.use_freestyle = True; sc.render.line_thickness = 0.9
    ls = vl.freestyle_settings.linesets.new("edges") if not vl.freestyle_settings.linesets else vl.freestyle_settings.linesets[0]
    ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True; ls.select_edge_mark = False
    if ls.linestyle is None: ls.linestyle = bpy.data.linestyles.new("edge")
    ls.linestyle.color = (0.15, 0.16, 0.2); ls.linestyle.thickness = 1.0
    sc.render.filepath = os.path.join(OUT, f"tile{TILE:02d}_{vname}.png")
    bpy.ops.render.render(write_still=True)
    print("rendered", vname, n, "objects")

for name, v in VIEWS.items():
    if ONLY and name not in ONLY: continue
    if v.get("cut") and not any(v["cut"] in p["sec"] for p in MAN["parts"]): continue
    render(name, v)
