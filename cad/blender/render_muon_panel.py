import bpy
import math
import os

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Render settings
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 256
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
# Better quality / transparency handling
scene.render.film_transparent = False

out_dir = os.path.abspath("figures")
os.makedirs(out_dir, exist_ok=True)

def add_material(obj, name, color, emission=0.0, transmission=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    if emission > 0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission
    try:
        bsdf.inputs['Transmission Weight'].default_value = transmission
    except:
        pass
    try:
        bsdf.inputs['Roughness'].default_value = roughness
    except:
        pass
    obj.data.materials.append(mat)

# Scintillator panel (thin box)
bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 0.05))
panel = bpy.context.active_object
panel.name = "Scintillator"
panel.scale = (1.0, 1.0, 0.05)
add_material(panel, "Scintillator", (0.15, 0.65, 0.95), emission=0.25, transmission=0.5, roughness=0.1)

# Thin reflector/wrapper layer (slightly larger, diffuse white)
bpy.ops.mesh.primitive_cube_add(size=2.02, location=(0, 0, 0.055))
reflector = bpy.context.active_object
reflector.name = "Reflector"
reflector.scale = (1.02, 1.02, 0.06)
add_material(reflector, "Reflector", (0.95, 0.95, 0.92), emission=0.0, transmission=0.05, roughness=0.8)

# WLS Fiber loop (torus for the curve)
bpy.ops.mesh.primitive_torus_add(major_radius=0.72, minor_radius=0.045, location=(0, 0, 0.1))
fiber = bpy.context.active_object
fiber.name = "WLS_Fiber"
add_material(fiber, "WLSFiber", (0.1, 0.85, 0.25), emission=0.9, roughness=0.3)

# SiPM + small carrier board
bpy.ops.mesh.primitive_cube_add(size=0.18, location=(0.82, 0, 0.1))
sipm_board = bpy.context.active_object
sipm_board.name = "SiPM_Board"
sipm_board.scale = (0.6, 0.4, 0.08)
add_material(sipm_board, "SiPMBoard", (0.15, 0.15, 0.18), roughness=0.6)

bpy.ops.mesh.primitive_cube_add(size=0.11, location=(0.82, 0, 0.13))
sipm = bpy.context.active_object
sipm.name = "SiPM"
add_material(sipm, "SiPM", (0.03, 0.03, 0.03), emission=0.05, roughness=0.2)

# Base/PCB
bpy.ops.mesh.primitive_cube_add(size=2.3, location=(0, 0, -0.03))
base = bpy.context.active_object
base.name = "BasePCB"
base.scale = (1.08, 1.08, 0.012)
add_material(base, "PCB", (0.08, 0.32, 0.12), roughness=0.7)

# Simple frame/holder (border rails around panel)
for i, (dx, dy, dz, sx, sy, sz) in enumerate([
    (0, 1.05, 0.02, 2.15, 0.08, 0.08),   # top
    (0, -1.05, 0.02, 2.15, 0.08, 0.08),  # bottom
    (1.05, 0, 0.02, 0.08, 2.0, 0.08),    # right
    (-1.05, 0, 0.02, 0.08, 2.0, 0.08),   # left
]):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(dx, dy, dz))
    rail = bpy.context.active_object
    rail.name = f"FrameRail_{i}"
    rail.scale = (sx, sy, sz)
    add_material(rail, f"Frame_{i}", (0.6, 0.6, 0.65), roughness=0.4)

# Lights (area + some fill for better definition on frame/reflector)
for loc, energy, size in [((5, 5, 7), 120, 3.0), ((-5, -4, 5), 60, 2.5), ((0, -6, 4), 70, 2.8), ((1, 6, 2), 40, 2.0)]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    light = bpy.context.active_object
    light.data.energy = energy
    light.data.size = size

# Add a bit of world light
world = bpy.data.worlds['World']
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
if bg:
    bg.inputs['Strength'].default_value = 0.6

# Cameras for different views (slightly adjusted framing for added frame/reflector)
def render_view(name, loc, rot, suffix):
    cam = bpy.data.cameras.new(name)
    cam_obj = bpy.data.objects.new(name, cam)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = loc
    cam_obj.rotation_euler = rot
    scene.camera = cam_obj
    scene.render.filepath = os.path.join(out_dir, f"muon3_panel_{suffix}")
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {suffix}")

# Views
render_view("Iso", (3.0, 3.0, 2.6), (math.radians(52), 0, math.radians(42)), "isometric")
render_view("Top", (0, 0, 3.8), (0, 0, 0), "top")
render_view("Side", (4.2, 0, 1.6), (math.radians(78), 0, math.radians(88)), "side")
render_view("Front", (0, 4.2, 1.1), (math.radians(68), 0, 0), "front")

print("Blender renders complete. Check figures/ for muon3_panel_*.png")
