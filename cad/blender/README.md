# Muon3 Panel Renders (Blender)

Procedural 3D visualizations of the Muon3 scintillator panel assembly used in the simulation paper.

## Script

- `render_muon_panel.py`: Uses Blender Python API (bpy) + Cycles renderer.
  - Models: EJ-200 scintillator plate, WLS fiber loop, SiPM + carrier, diffuse reflector layer, frame rails, PCB base.
  - Outputs: `figures/muon3_panel_{isometric,top,side,front}.png` (relative to physics/ dir).
  - Current settings: Cycles, 256 samples, 1600x900, denoising.

## Run

From the `physics/` directory:

```bash
/opt/homebrew/bin/blender -b -P cad/blender/render_muon_panel.py
# or if blender in PATH:
blender -b -P cad/blender/render_muon_panel.py
```

- Requires Blender 4+ (tested on 5.1).
- Renders take 1–3 minutes depending on hardware/samples.
- Images are committed to `figures/` and referenced from `Muon3_Simulation_Studies.tex`.

## Notes

- The model is fully procedural (no external meshes required) for reproducibility.
- Edit the script to adjust materials, lighting, camera, fiber geometry, or add detail (e.g. groove profile, labels).
- Re-run after changes, then rebuild the paper (`./build_paper.sh`) to update the PDF figure.
- Deprecation warnings for `use_nodes` are benign (Blender 5.x → 6.0 transition).

These renders support the Hardware Baseline section of the paper.
