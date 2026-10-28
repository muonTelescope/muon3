# Blender renders of the bench board on its printed mount:
#   blender -b --factory-startup --python hw/case/bench/render.py -- <outdir> [WxH] [samples] [views]
# Reads hw/out/bench/mount/{group}.stl (tools/classcad/bench/mount.mjs) and hw/out/bench/top.png (top copper, for the board face).
import bpy, math, os, sys
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]; RES = tuple(int(v) for v in (argv[1] if len(argv) > 1 else "1800x1100").split("x"))
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
VIEWS = (argv[3] if len(argv) > 3 else "hero,top,edge,tray").split(",")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
D = os.path.join(ROOT, "hw", "out", "bench", "mount"); TOP = os.path.join(ROOT, "hw", "out", "bench", "top.png")
W, H = 184.0, 80.0  # board size; top.png covers board x -4..188, y -4..84 (y down)
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
sc.render.resolution_x, sc.render.resolution_y = RES
try: sc.eevee.taa_render_samples = SAMPLES; sc.eevee.use_raytracing = True
except Exception: pass
sc.view_settings.view_transform = "Standard"

def mat(name, c, rough=.55, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*c, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    return m
def pcb_mat():
    m = mat("pcb", (.04, .30, .13), .45)
    if not os.path.exists(TOP): return m
    nt = m.node_tree; N = nt.nodes; Lk = nt.links; b = N["Principled BSDF"]
    geo = N.new("ShaderNodeNewGeometry"); sep = N.new("ShaderNodeSeparateXYZ"); Lk.new(geo.outputs["Position"], sep.inputs[0])
    def lin(src, a, k):  # (src*1000 + a) * k   (positions are in metres after STL import at 0.001 scale)
        m1 = N.new("ShaderNodeMath"); m1.operation = "MULTIPLY_ADD"; m1.inputs[1].default_value = 1000 * k; m1.inputs[2].default_value = a * k
        Lk.new(src, m1.inputs[0]); return m1.outputs[0]
    u = lin(sep.outputs["X"], 4, 1 / 192); v = lin(sep.outputs["Y"], 4, 1 / 88)  # world y = H - board y
    comb = N.new("ShaderNodeCombineXYZ"); Lk.new(u, comb.inputs[0]); Lk.new(v, comb.inputs[1])
    tex = N.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(TOP); Lk.new(comb.outputs[0], tex.inputs["Vector"])
    Lk.new(tex.outputs["Color"], b.inputs["Base Color"])
    return m
MATS = dict(mount=mat("mount", (.93, .45, .08), .6), pcb=pcb_mat(), comp=mat("comp", (.025, .025, .03), .4),
            esp=mat("esp", (.55, .56, .58), .3, 1), hw=mat("hw", (.62, .63, .66), .35, 1), insert=mat("insert", (.80, .62, .30), .3, 1), loop=mat("loop", (.75, .76, .78), .3, 1), gold=mat("gold", (.85, .65, .30), .25, 1))
objs = {}
for g, m in MATS.items():
    f = os.path.join(D, g + ".stl")
    if not os.path.exists(f): continue
    bpy.ops.wm.stl_import(filepath=f, global_scale=0.001); o = bpy.context.selected_objects[0]; o.data.materials.append(m); o.name = g
    objs[g] = o

world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (.92, .93, .95, 1); world.node_tree.nodes["Background"].inputs[1].default_value = .35
def light(name, kind, loc, energy, size=1.0, rot=None):
    l = bpy.data.lights.new(name, kind); l.energy = energy
    if kind == "AREA": l.size = size
    o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
    if rot: o.rotation_euler = rot
    return o
light("sun", "SUN", (0, 0, 1), 2.2, rot=(math.radians(35), math.radians(10), math.radians(-30)))
light("key", "AREA", (0.05, 0.45, 0.35), 6, 0.3)
plane = bpy.data.meshes.new("floor"); plane.from_pydata([(-1, -1, -0.0041), (1, -1, -0.0041), (1, 1, -0.0041), (-1, 1, -0.0041)], [], [(0, 1, 2, 3)])
fo = bpy.data.objects.new("floor", plane); fo.data.materials.append(mat("floor", (.80, .81, .83), .8)); sc.collection.objects.link(fo)

cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
def look(target, az, el, dist, lens=50, ortho=None):
    t = Vector(target); d = Vector((math.cos(math.radians(el)) * math.sin(math.radians(az)), -math.cos(math.radians(el)) * math.cos(math.radians(az)), math.sin(math.radians(el))))
    cam.location = t + d * dist; cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.type = "ORTHO" if ortho else "PERSP"
    if ortho: cam.data.ortho_scale = ortho
    cam.data.lens = lens; cam.data.clip_end = 10
C = (W / 2 / 1000, H / 2 / 1000 + 0.01, 0.01)
SPEC = {
    "hero": dict(show=None, target=C, az=200, el=32, dist=0.36),           # from the SMA side, front left
    "top": dict(show=None, target=(W / 2 / 1000, H / 2 / 1000 + 0.011, 0), az=0, el=89.9, dist=0.5, ortho=0.215),
    "edge": dict(show=None, target=(0.050, H / 1000, 0.012), az=200, el=22, dist=0.13),
    "tray": dict(show={"mount", "insert"}, target=C, az=25, el=40, dist=0.36),   # the printed part alone, from the back
}
for v in VIEWS:
    s = SPEC[v]
    for g, o in objs.items(): o.hide_render = bool(s["show"]) and g not in s["show"]
    look(s["target"], s["az"], s["el"], s["dist"], ortho=s.get("ortho"))
    sc.render.filepath = os.path.join(OUT, f"bench_{v}.png"); bpy.ops.render.render(write_still=True)
    print("wrote", sc.render.filepath)
