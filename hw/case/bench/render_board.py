# Cycles renders of the bench board from KiCad's GLB (parts, copper on all four layers, mask, silk):
#   blender -b --factory-startup --python hw/case/bench/render_board.py -- <outdir> [scale] [samples] [views]
# Needs hw/out/bench/3d/board.glb from hw/case/bench/export_3d.py (run with KiCad's Python).
# Views: hero, top, bottom, cell, core, layers (exploded stack-up without parts), copper (L1..L4 sheet). scale 1 = 2400 px wide.
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = os.path.abspath(argv[0])
SCALE = float(argv[1]) if len(argv) > 1 else 1.0
SAMPLES = int(argv[2]) if len(argv) > 2 else 256
VIEWS = (argv[3] if len(argv) > 3 else "hero,top,bottom,cell,core,layers,copper").split(",")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
D3 = os.path.join(ROOT, "hw", "out", "bench", "3d")
W, H = 0.150, 0.070                           # board, m (GLB: x 0..W, y -H..0, z 0 = bottom face)
# stack-up from hw/src/kicad_stackup.txt (mm): mask .01 | L1 .035 | prepreg .2104 | L2 .0152 | core 1.065 | L3 .0152 | prepreg .2104 | L4 .035 | mask .01
Z_CU = {0: 1.6e-3, 1: 1.37e-3, 2: 0.23e-3, 3: 0.0}   # approximate copper heights in the export, top to bottom
os.makedirs(OUT, exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = "GPU"
    except Exception as e: print("GPU off:", e)
    sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8; sc.cycles.transparent_max_bounces = 16
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.film_transparent = False
    return sc

# ── materials ──
def principled(name, color, rough=0.5, metal=0.0, coat=0.0, alpha=1.0, trans=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if coat: b.inputs["Coat Weight"].default_value = coat; b.inputs["Coat Roughness"].default_value = 0.08
    if trans: b.inputs["Transmission Weight"].default_value = trans
    if alpha < 1: b.inputs["Alpha"].default_value = alpha
    return m
def soldermask():
    # glossy green lacquer that lets the copper under it read as lighter green (as on a real board)
    m = principled("mask", (0.006, 0.10, 0.035), rough=0.34, coat=0.3, alpha=0.94)
    return m
MAT = {}
def mats():
    MAT.update(mask=soldermask(), silk=principled("silk", (0.92, 0.92, 0.88), 0.55),
               copper=principled("copper", (0.95, 0.55, 0.35), 0.28, 1.0), enig=principled("enig", (1.0, 0.78, 0.42), 0.18, 1.0),
               fr4=principled("fr4", (0.62, 0.55, 0.30), 0.6, alpha=1.0), core=principled("core", (0.70, 0.64, 0.40), 0.5, alpha=0.35),
               floor=principled("floor", (0.55, 0.56, 0.58), 0.45), label=principled("label", (0.08, 0.09, 0.10), 0.5))

def load(glb):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(D3, glb))
    return [o for o in bpy.data.objects if o not in before]

def zmean(o, f):
    return sum((o.matrix_world @ o.data.vertices[i].co).z for i in f.vertices) / len(f.vertices)

def split_by_z(o, bins):
    """Split mesh o into one object per bin {name: (z_lo, z_hi)} by face mean height; returns {name: obj}."""
    out = {}
    for name, (lo, hi) in bins.items():
        c = o.copy(); c.data = o.data.copy(); c.data.name = f"{o.data.name}_{name}"; bpy.context.scene.collection.objects.link(c)
        bm = bmesh.new(); bm.from_mesh(c.data); mw = c.matrix_world
        kill = [f for f in bm.faces if not (lo <= sum((mw @ v.co).z for v in f.verts) / len(f.verts) < hi)]
        bmesh.ops.delete(bm, geom=kill, context="FACES"); bm.to_mesh(c.data); bm.free()
        if len(c.data.polygons): out[name] = c
        else: bpy.data.objects.remove(c)
    bpy.data.objects.remove(o)
    return out

def bname(o):
    """KiCad names the board meshes muon3_filled_<kind>: the glTF mesh name (Blender mesh data), not the object."""
    for n in (o.data.name if o.type == "MESH" else "", o.name):
        if n.startswith("muon3_filled_"): return n
    return ""

def board_layers(objs):
    """Classify KiCad's board meshes; split copper into L1..L4, mask/silk into top/bottom."""
    L = {}
    for o in [o for o in objs if o.type == "MESH" and bname(o)]:
        kind = bname(o).split("_")[2].split(".")[0]
        if kind == "copper":
            L.update({k: v for k, v in split_by_z(o, {"L1": (1.45e-3, 1), "L2": (0.8e-3, 1.45e-3), "L3": (0.12e-3, 0.8e-3), "L4": (-1, 0.12e-3)}).items()})
        elif kind in ("silkscreen", "soldermask"):
            zc = sum((o.matrix_world @ Vector(c)).z for c in o.bound_box) / 8
            L[("silk" if kind == "silkscreen" else "mask") + ("_top" if zc > 0.8e-3 else "_bot")] = o
        else: L[kind] = o   # pad, via, PCB
    for k, o in L.items():
        m = MAT["copper"] if k[0] == "L" else MAT["enig"] if k in ("pad", "via") else MAT["silk"] if k.startswith("silk") else \
            MAT["mask"] if k.startswith("mask") else MAT["fr4"]
        o.data.materials.clear(); o.data.materials.append(m)
    return L

def parts_tune(objs):
    # KiCad's STEP colours come through as plain base colours: make the metal-looking greys metallic, the black bodies satin
    for o in bpy.data.objects:
        if o.type != "MESH" or bname(o): continue
        for s in o.material_slots:
            m = s.material
            if not m or not m.use_nodes or m.get("tuned"): continue
            b = m.node_tree.nodes.get("Principled BSDF")
            if not b: continue
            r, g, bl, _ = b.inputs["Base Color"].default_value
            if abs(r - g) < 0.06 and abs(g - bl) < 0.06 and r > 0.45: b.inputs["Metallic"].default_value = 0.9; b.inputs["Roughness"].default_value = 0.28
            elif r > 0.6 and g > 0.45 and bl < 0.35: b.inputs["Metallic"].default_value = 1.0; b.inputs["Roughness"].default_value = 0.22   # gold
            elif max(r, g, bl) < 0.12: b.inputs["Roughness"].default_value = 0.45
            else: b.inputs["Roughness"].default_value = 0.4
            m["tuned"] = 1

# ── studio: backdrop, three area lights, soft world ──
def studio(sc, floor_z=-0.0055, under=False):
    world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes["Background"]; bg.inputs[0].default_value = (0.80, 0.84, 0.90, 1); bg.inputs[1].default_value = 0.25
    if floor_z is not None:
        bpy.ops.mesh.primitive_plane_add(size=3, location=(W / 2, -H / 2, floor_z)); fl = bpy.context.object; fl.name = "floor"
        fl.data.materials.append(MAT["floor"])
    def area(name, loc, target, energy, size, color=(1, 1, 1)):
        l = bpy.data.lights.new(name, "AREA"); l.energy = energy; l.size = size; l.color = color
        o = bpy.data.objects.new(name, l); o.location = loc; sc.collection.objects.link(o)
        o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    c = (W / 2, -H / 2, 0)
    area("key", (W / 2 - 0.22, 0.25, 0.38), c, 7, 0.30, (1.0, 0.97, 0.92))
    area("fill", (W / 2 + 0.35, -0.10, 0.22), c, 2.5, 0.45, (0.90, 0.95, 1.0))
    area("rim", (W / 2 + 0.05, -0.45, 0.20), c, 5, 0.25)
    if under: area("under", (W / 2, -H / 2, -0.35), c, 2.5, 0.5)

def camera(sc, target, az, el, dist, lens=60, ortho=None, fstop=None, up_down=False):
    cam = sc.camera or bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    if cam.name not in sc.collection.objects: sc.collection.objects.link(cam)
    sc.camera = cam; t = Vector(target)
    d = Vector((math.cos(math.radians(el)) * math.sin(math.radians(az)), math.cos(math.radians(el)) * math.cos(math.radians(az)), math.sin(math.radians(el))))
    cam.location = t + d * dist
    if abs(el) > 89: cam.rotation_euler = (0, 0, 0) if el > 0 else (math.pi, 0, 0)   # straight down / up
    else: cam.rotation_euler = (t - cam.location).to_track_quat("-Z", "Z").to_euler()
    cam.data.type = "ORTHO" if ortho else "PERSP"
    if ortho: cam.data.ortho_scale = ortho
    cam.data.lens = lens; cam.data.clip_start = 0.002; cam.data.clip_end = 5
    cam.data.dof.use_dof = bool(fstop)
    if fstop: cam.data.dof.focus_distance = dist; cam.data.dof.aperture_fstop = fstop

def shoot(sc, name, res):
    sc.render.resolution_x, sc.render.resolution_y = int(res[0] * SCALE), int(res[1] * SCALE)
    sc.render.filepath = os.path.join(OUT, f"bench_{name}.png"); bpy.ops.render.render(write_still=True); print("wrote", sc.render.filepath)

# ── assembled board ──
assembled = [v for v in VIEWS if v not in ("layers", "copper")]
if assembled:
    sc = reset(); mats(); objs = load("board.glb"); L = board_layers(objs); parts_tune(objs)
    C = (W / 2, -H / 2, 0.001)
    for v in assembled:
        for o in [o for o in sc.objects if o.type == "LIGHT" or o.name == "floor"]: bpy.data.objects.remove(o)
        studio(sc, floor_z=-0.013 if v == "bottom" else -0.0055)
        if v == "hero":   camera(sc, C, 205, 34, 0.30, lens=55, fstop=8); shoot(sc, v, (2400, 1500))
        if v == "top":    camera(sc, C, 0, 90, 0.5, ortho=0.158); shoot(sc, v, (2400, 1150))
        if v == "bottom":   # turn the board over about its vertical centre line (SMAs stay at the top) and light it like the top
            roots = [o for o in sc.objects if o.parent is None and o.type in ("EMPTY", "MESH") and o.name != "floor"]
            keep = {o: o.matrix_world.copy() for o in roots}
            flip = Matrix.Translation((W / 2, 0, 0.0008)) @ Matrix.Rotation(math.pi, 4, "Y") @ Matrix.Translation((-W / 2, 0, -0.0008))
            for o in roots: o.matrix_world = flip @ o.matrix_world
            camera(sc, C, 0, 90, 0.5, ortho=0.158); shoot(sc, v, (2400, 1150))
            for o, m in keep.items(): o.matrix_world = m
        if v == "cell":   camera(sc, (0.0570, -0.012, 0.002), 335, 38, 0.115, lens=70, fstop=11); shoot(sc, v, (2400, 1500))   # CH1 from the SMA edge
        if v == "core":   camera(sc, (0.100, -0.046, 0.002), 160, 45, 0.15, lens=60, fstop=11); shoot(sc, v, (2400, 1500))   # FPGA, boost, ESP32

# ── exploded stack-up: no parts; each layer lifted and fanned toward the camera so every one shows; name beside it ──
def bare_board():
    sc = reset(); mats(); objs = load("board.glb"); L = board_layers(objs)   # (KiCad's --no-components export loses the mesh names)
    for o in [o for o in bpy.data.objects if o.type == "MESH" and not bname(o)]: bpy.data.objects.remove(o)
    if "via" in L: bpy.data.objects.remove(L.pop("via"))
    if "pad" in L:   # outer-layer pads belong to L1 / L4 copper (THT barrels and inner pads dropped)
        P = split_by_z(L.pop("pad"), {"top": (1.45e-3, 1), "bot": (-1, 0.12e-3)})
        for side, key in (("top", "L1"), ("bot", "L4")):
            if side in P:
                P[side].data.materials.clear(); P[side].data.materials.append(MAT["copper"]); P[side].parent = None
                P[side].matrix_world = P[side].matrix_world; L[key + "_pads"] = P[side]
    return sc, L

def zmid(o): return sum((o.matrix_world @ Vector(c)).z for c in o.bound_box) / 8

if "layers" in VIEWS:
    sc, L = bare_board()
    # silk rides on its mask (it is printed on it): seven levels
    order = [("mask_top", "TOP MASK + SILK", ["silk_top"]), ("L1", "L1  SIGNAL + PARTS", ["L1_pads"]), ("L2", "L2  SOLID GND", []),
             ("PCB", "FR4 CORE", []), ("L3", "L3  SIGNAL / POWER", []), ("L4", "L4  SIGNAL", ["L4_pads"]), ("mask_bot", "BOTTOM MASK + SILK", ["silk_bot"])]
    GAP, FAN = 0.016, 0.024                     # m per level: up, and toward the camera (−y)
    L["PCB"].data.materials.clear(); L["PCB"].data.materials.append(MAT["core"])
    # signal layers are only traces: a faint FR4 sheet under each one makes it read as a layer
    ghost = principled("ghost", (0.70, 0.62, 0.40), 0.6, alpha=0.12); pcb = L["PCB"]; zp = zmid(pcb)
    for key in ("L1", "L3", "L4"):
        g = pcb.copy(); g.data = pcb.data.copy(); g.data.name = "ghost_" + key; bpy.context.scene.collection.objects.link(g)
        g.data.materials.clear(); g.data.materials.append(ghost); g.parent = None
        zl = min((L[key].matrix_world @ Vector(c)).z for c in L[key].bound_box)
        g.matrix_world = Matrix.Translation((0, 0, zl - 0.0001)) @ Matrix.Diagonal((1, 1, 0.03, 1)) @ Matrix.Translation((0, 0, -zp)) @ pcb.matrix_world
        L[key + "_ghost"] = g
    order = [(k, t, e + ([k + "_ghost"] if k + "_ghost" in L else [])) for k, t, e in order]
    for k, (key, text, extra) in enumerate(order):
        if key not in L: continue
        dz, dy = (len(order) / 2 - k) * GAP, -k * FAN
        z0 = zmid(L[key])
        for o in [L[key]] + [L[e] for e in extra if e in L]:
            o.matrix_world = Matrix.Translation((0, dy, dz - z0 + 0.0008)) @ o.matrix_world   # parents may be rotated (glTF y-up)
        bpy.ops.object.text_add(location=(-0.004, -H / 2 + dy, dz + 0.0009))
        t = bpy.context.object; t.data.body = text; t.data.size = 0.0048; t.data.align_x = "RIGHT"; t.data.align_y = "CENTER"
        t.data.extrude = 0.00015; t.data.materials.append(MAT["label"])
    # dark backdrop and light names: the thin copper reads better against it
    MAT["floor"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.05, 0.055, 0.06, 1)
    MAT["label"].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.85, 0.86, 0.88, 1)
    studio(sc, floor_z=-(len(order) / 2 + 1.0) * GAP)
    camera(sc, (W / 2 - 0.03, -H / 2 - 0.07, 0), 205, 30, 0.56, lens=50); shoot(sc, "layers", (2400, 1700))

# ── copper: each layer alone from the top (with the board outline), then a 2 × 2 sheet ──
if "copper" in VIEWS:
    import subprocess
    sc, L = bare_board()
    keep = {"PCB", "L1", "L1_pads", "L2", "L3", "L4", "L4_pads"}
    for k in [k for k in L if k not in keep]: bpy.data.objects.remove(L.pop(k))
    # the body hides the inner layers: a thin dark copy of it sits just behind whichever layer is shown
    back = L.pop("PCB"); back.data.materials.clear(); back.data.materials.append(principled("dark", (0.05, 0.06, 0.05), 0.7))
    zb = zmid(back); base = back.matrix_world.copy()
    world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1); world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    shots = []
    for lay in ("L1", "L2", "L3", "L4"):
        for k, o in L.items(): o.hide_render = k.split("_")[0] != lay
        zl = min((L[lay].matrix_world @ Vector(c)).z for c in L[lay].bound_box) if lay != "L4" else max((L[lay].matrix_world @ Vector(c)).z for c in L[lay].bound_box)
        zt = zl - 0.00005 if lay != "L4" else zl + 0.00005           # backing face just behind the copper, seen from the camera side
        back.matrix_world = Matrix.Translation((0, 0, zt)) @ Matrix.Diagonal((1, 1, 0.02, 1)) @ Matrix.Translation((0, 0, -zb)) @ base
        # L4 is seen from below (mirrored like the bottom view), the others from above
        if lay == "L4": camera(sc, (W / 2, -H / 2, 0), 0, -90, 0.5, ortho=0.156); sc.camera.rotation_euler = (math.pi, 0, math.pi)
        else: camera(sc, (W / 2, -H / 2, 0.002), 0, 90, 0.5, ortho=0.156)
        shoot(sc, "copper_" + lay, (1600, 760)); shots.append(sc.render.filepath)
    subprocess.run(["python3", os.path.join(os.path.dirname(os.path.abspath(__file__)), "compose_layers.py"), OUT, *shots])
