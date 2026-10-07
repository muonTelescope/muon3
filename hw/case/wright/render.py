# Blender renderer for the ClassCAD Wright layouts:  blender -b --factory-startup --python hw/case/wright/render.py -- <layout> <outdir> [WxH] [samples]
# Reads hw/out/wright/<L>/{group}.stl + manifest.json written by tools/classcad/wright/build.mjs.
import bpy, json, math, os, sys
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index("--") + 1:]
L, OUT = argv[0], argv[1]
MODE = argv[4] if len(argv) > 4 else "day"
RES = tuple(int(v) for v in (argv[2] if len(argv) > 2 else "1800x1200").split("x")); SAMPLES = int(argv[3]) if len(argv) > 3 else 64
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
D = os.path.join(ROOT, "hw", "out", "wright", L); MAN = json.load(open(os.path.join(D, "manifest.json")))
os.makedirs(OUT, exist_ok=True)
AZ = {"A": 30, "B": 35, "C": 205, "D": 28, "E": 208, "L": 150, "X": 150, "P1": 28, "P2": 28, "P3": 28, "P4": 30, "P5": 28, "Q1": 160, "Q2": 160, "Q3": 160, "Q4": 150, "Q5": 12, "R1": 150, "R2": 150, "R3": 150, "R4": 150, "R5": 14}[L]
if len(argv) > 5: AZ = float(argv[5])
NIGHT = MODE == "night"
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = RES
try: sc.eevee.taa_render_samples = SAMPLES; sc.eevee.use_raytracing = True
except Exception: pass
sc.view_settings.view_transform = "Standard"; sc.view_settings.look = "None"
def mat(name, c, rough=.55, metal=0, emit=None, es=0, alpha=1):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*c, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal; b.inputs["Alpha"].default_value = alpha
    if emit: b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = es
    if alpha < 1:
        try: m.surface_render_method = "BLENDED"
        except Exception: m.blend_method = "BLEND"
    return m
MATS = dict(
    stone=mat("stone", (.62, .50, .34), .9), wood=mat("wood", (.36, .20, .10), .7), red=mat("red", (.50, .13, .06), .45), dark=mat("dark", (.035, .035, .04), .5),
    hw=mat("hw", (.62, .63, .66), .35, 1), pcb=mat("pcb", (.04, .30, .13), .4), comp=mat("comp", (.02, .02, .02), .4), lid=mat("lid", (.22, .24, .28), .15, 0, alpha=.28),
    tile=mat("tile", (.45, .72, 1.0), .15, 0, (.2, .45, .9), .25, alpha=.30), led=mat("led", (1, .62, .25), .3, 0, (1, .45, .12), 6 if NIGHT else 2.2),
    shade=mat("shade", (.98, .97, .93), .35, 0, (1, .85, .6), .55 if NIGHT else 0.3, alpha=.96))
ST = MAN.get("style") or {}
if ST:
    MATS["pot"] = mat("pot", tuple(ST["pot"]), ST.get("rough", .7)); MATS["soil"] = mat("soil", (.07, .045, .03), .95)
    MATS["pipe"] = mat("pipe", (.85, .95, 1.0), .05, 0, (.6, .8, 1), .15, alpha=.35)
    k = 1.0 if NIGHT else .55
    MATS["led3"] = mat("led3", (1, .85, .6), .3, 0, (1, .85, .6), 10 * k + 2); MATS["led2"] = mat("led2", (1, .6, .2), .3, 0, (1, .55, .15), 6 * k + 1)
    MATS["led1"] = mat("led1", (.6, .2, .05), .3, 0, (1, .3, .06), 2.2 * k); MATS["led0"] = mat("led0", (.02, .02, .025), .12)
    MATS["shade"] = mat("shade", (.97, .95, .9), .4, 0, (1, .8, .5), 0.8 if NIGHT else .25, alpha=.55)
    MATS["crown"] = mat("crown", (.97, .93, .85), .4, 0, (1, .7, .35), 0.45 if NIGHT else .1, alpha=.6); MATS["pot2"] = mat("pot2", tuple(ST["pot"]), ST.get("rough", .7))
    MATS["ledpcb"] = mat("ledpcb", (1, .6, .2), .3, 0, (1, .55, .15), 6)
objs = []
for g, m in MATS.items():
    f = os.path.join(D, g + ".stl")
    if not os.path.exists(f): continue
    bpy.ops.wm.stl_import(filepath=f); o = bpy.context.selected_objects[0]; o.data.materials.append(m); o.name = g
    try:
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]): bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))
    except Exception: pass
    objs.append(o)
def cut_x(o, x):
    if not hasattr(cut_x, "c"):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x + 1500, 0, 200)); cut_x.c = bpy.context.object; cut_x.c.scale = (3000, 3000, 3000); cut_x.c.display_type = "WIRE"; cut_x.c.hide_render = True
    md = o.modifiers.new("cut", "BOOLEAN"); md.operation = "DIFFERENCE"; md.object = cut_x.c; md.solver = "EXACT"
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]): bpy.ops.object.modifier_apply(modifier=md.name)
def tube(name, pts, r, m, seg=8):
    if MODE == "cut":
        runs, cur = [], []
        for p in pts:
            if p[0] <= MAN["cutX"]: cur.append(p)
            elif cur: runs.append(cur); cur = []
        if cur: runs.append(cur)
        for rr in runs:
            if len(rr) > 1: _tube(name, rr, r, m, seg)
        return
    return _tube(name, pts, r, m, seg)
def _tube(name, pts, r, m, seg=8):
    pts = [Vector(p) for p in pts]; verts, faces = [], []
    for i, p in enumerate(pts):
        t = ((pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)])).normalized(); n = t.cross(Vector((0, 0, 1)))
        if n.length < 1e-4: n = t.cross(Vector((1, 0, 0)))
        n.normalize(); b = t.cross(n)
        verts += [p + (math.cos(2 * math.pi * k / seg) * n + math.sin(2 * math.pi * k / seg) * b) * r for k in range(seg)]
    for i in range(len(pts) - 1):
        for k in range(seg): a = i * seg + k; b2 = i * seg + (k + 1) % seg; faces.append((a, b2, b2 + seg, a + seg))
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update(); o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o); o.data.materials.append(m); return o
fibm = mat("fiber", (.1, .9, .2), .3, 0, (.1, 1, .25), 2.5)
for p in MAN["panels"]: tube("fiber", p["fiber"], 1.0, fibm, 6)
wr, wb = mat("wire_r", (.7, .05, .05), .5), mat("wire_k", (.02, .02, .02), .5)
for i, w in enumerate(MAN["wires"]):
    for k, (m_, off) in enumerate(((wr, 2.2), (wb, -2.2))): tube("wire", [(p[0] + off, p[1], p[2]) for p in w], 1.6, m_, 8)
if MODE == "cut":
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o in objs: cut_x(o, MAN["cutX"])
# ground + light
bb = [Vector(o.matrix_world @ Vector(c)) for o in objs for c in o.bound_box]
if MODE == "cut": bb = [Vector((min(v.x for v in bb), v.y, v.z)) for v in bb]
lo = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb))); hi = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
ctr = (lo + hi) / 2; R = (hi - lo).length / 2
bpy.ops.mesh.primitive_plane_add(size=30000, location=(0, 0, -0.5)); gr = bpy.context.object; gr.data.materials.append(mat("ground", (.46, .38, .29) if not NIGHT else (.16, .12, .09), .95))
if NIGHT:
    for p in MAN["panels"]:
        for dz in (50, -50):
            lt = bpy.data.objects.new("pl", bpy.data.lights.new("pl", "POINT")); lt.data.energy = 2.2e5; lt.data.color = (1, .6, .28); lt.data.shadow_soft_size = 25
            lt.location = (0, 40, p["M"][2][3] + dz); sc.collection.objects.link(lt)
sc.world = bpy.data.worlds.new("w"); sc.world.use_nodes = True; bg = sc.world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (.36, .39, .48, 1) if not NIGHT else (.02, .025, .05, 1); bg.inputs[1].default_value = .9 if not NIGHT else .5
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 0.0 if NIGHT else 3.4; sun.data.color = (1, .78, .55); sun.data.angle = math.radians(2.5)
sun.rotation_euler = Vector((math.cos(math.radians(AZ - 70)) * -.6, math.sin(math.radians(AZ - 70)) * -.6, -.65)).to_track_quat("-Z", "Y").to_euler(); sc.collection.objects.link(sun)
cam_d = MAN["cam"]; el = math.radians(cam_d["el"]); az = math.radians(AZ)
look = Vector(cam_d["look"]); dirv = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50; cam.data.clip_end = 40000; cam.location = look + dirv * R * 2.9 * cam_d["dist"] * .82
cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.render.filepath = os.path.join(OUT, f"wright_{L}_{MAN['name'].lower()}" + ("" if MODE == "day" and len(argv) <= 5 else f"_{MODE}") + (f"_az{int(AZ)}" if len(argv) > 5 and MODE == "day" else "") + ".png"); bpy.ops.render.render(write_still=True); print("done", sc.render.filepath)
