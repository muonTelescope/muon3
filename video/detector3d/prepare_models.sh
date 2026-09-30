#!/bin/sh
# Copy the tile-01 assembly parts (STL + placement matrices) that hw/case/assembly.py wrote into models/ for the three.js scene.
# Needs: TILE=1 freecadcmd hw/case/assembly.py   (hw/out/assembly/tile01/manifest.json + stl/, hw/out/assembly/common/)
set -e
cd "$(dirname "$0")"; SRC=../../hw/out/assembly; mkdir -p models
python3 - <<'P'
import json, os, shutil
SRC = "../../hw/out/assembly"
M = json.load(open(f"{SRC}/tile01/manifest.json"))
out = []
for p in M["parts"]:
    src = p["stl"]
    if not os.path.exists(src): continue
    name = os.path.basename(src)
    if not os.path.exists(f"models/{name}"): shutil.copy(src, f"models/{name}")
    out.append({"name": p["name"], "group": p["group"], "color": p["color"], "alpha": p["alpha"], "matrix": p["matrix"], "stl": f"models/{name}"})
json.dump({"hull": M["hull"], "zs": M["zs"], "xs": M["xs"], "parts": out}, open("models/manifest.json", "w"))
print(len(out), "parts")
P
du -sh models
