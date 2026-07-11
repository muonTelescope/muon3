import bpy
import math
import os

# Clear scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Render settings
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64  # lower for speed
scene.cycles.use_denoising = True
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'

out_dir = os.path.abspath("figures")
os.makedirs(out_dir, exist_ok=True)

def add_material(obj, name, color, emission=0.0, transmission=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    if emission > 0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission
    # For Blender 4+
    try:
        bsdf.inputs['Transmission Weight'].default_value = transmission
    except:
        pass  # fallback
    obj.data.materials.append(mat)

# Scintillator panel (thin box)
bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 0.05))
panel = bpy.context.active_object
panel.name = "Scintillator"
panel.scale = (1.0, 1.0, 0.05)
add_material(panel, "Scintillator", (0.2, 0.7, 0.9), emission=0.3, transmission=0.6)

# WLS Fiber loop (torus)
bpy.ops.mesh.primitive_torus_add(major_radius=0.75, minor_radius=0.04, location=(0, 0, 0.1))
fiber = bpy.context.active_object
fiber.name = "WLS_Fiber"
add_material(fiber, "WLSFiber", (0.2, 0.9, 0.3), emission=0.8)

# SiPM
bpy.ops.mesh.primitive_cube_add(size=0.12, location=(0.85, 0, 0.1))
sipm = bpy.context.active_object
sipm.name = "SiPM"
add_material(sipm, "SiPM", (0.05, 0.05, 0.05), emission=0.0)

# Base/PCB
bpy.ops.mesh.primitive_cube_add(size=2.3, location=(0, 0, -0.03))
base = bpy.context.active_object
base.name = "BasePCB"
base.scale = (1.05, 1.05, 0.015)
add_material(base, "PCB", (0.1, 0.35, 0.15))

# Lights
for loc, energy in [((4, 4, 6), 80), ((-4, -3, 4), 40), ((0, -5, 3), 50)]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    light = bpy.context.active_object
    light.data.energy = energy
    light.data.size = 2.5

# Cameras for different views
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
render_view("Iso", (2.8, 2.8, 2.5), (math.radians(55), 0, math.radians(45)), "isometric")
render_view("Top", (0, 0, 4), (0, 0, 0), "top")
render_view("Side", (4, 0, 1.5), (math.radians(80), 0, math.radians(90)), "side")
render_view("Front", (0, 4, 1), (math.radians(70), 0, 0), "front")

print("Blender renders complete. Check figures/ for muon3_panel_*.png")
