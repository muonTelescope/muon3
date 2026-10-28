# Fill the copper zones in KiCad (the generator writes outlines only) and export the bench board as GLB for Blender.
#   /Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3 hw/case/bench/export_3d.py
# Writes hw/out/bench/kicad/muon3_filled.kicad_pcb and hw/out/bench/3d/board.glb: parts + board body + copper (outer and
# inner) + mask + silk. The board meshes are named muon3_filled_<kind> (render_board.py keys on that).
import os, subprocess, pcbnew

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
K = os.path.join(ROOT, "hw", "out", "bench", "kicad")
OUT = os.path.join(ROOT, "hw", "out", "bench", "3d")
os.makedirs(OUT, exist_ok=True)

b = pcbnew.LoadBoard(os.path.join(K, "muon3.kicad_pcb"))
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
filled = os.path.join(K, "muon3_filled.kicad_pcb")
b.Save(filled)
print("zones filled:", len(b.Zones()))

layers = ["--include-tracks", "--include-pads", "--include-zones", "--include-inner-copper", "--include-silkscreen", "--include-soldermask"]
subprocess.run(["kicad-cli", "pcb", "export", "glb", "-f", "--subst-models", *layers, "-o", os.path.join(OUT, "board.glb"), filled], check=True)
print("wrote", os.path.join(OUT, "board.glb"))
