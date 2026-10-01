"""Dump hull, SiPM pocket and fiber polyline of sPHENIX tiles (same mesh metadata the Geant4/FreeCAD models use).
   python3 tile_data.py 7 10 9 4 5  ->  ../../../tools/classcad/wright/tiles.json"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..", "..", "..")
sys.path.insert(0, os.path.join(ROOT, "cad", "sphenix_hcal", "scripts"))
from fiber_loop import loop_tokens, dense
out = {}
for N in [int(a) for a in sys.argv[1:]] or [7, 10, 9, 4, 5]:
    P = json.load(open(os.path.join(ROOT, "sim", "geant4", "gdml", "mesh", f"InnerHCalTile{N:02d}_EJ200_mesh.json")))["params"]
    X0 = P["bbox"]["xmin"]; hull = [(x - X0, y) for x, y in P["hull_xy"]]; sx = P["sipm"]["cx"] - X0
    ytop = max(y for _, y in hull); tok, info = loop_tokens(hull, sx, ytop)
    out[str(N)] = dict(tile=N, hull=hull, sx=sx, ytop=ytop, thickness=P["thickness_mm"], fiber=dense(tok, 3.0),
                       pocket=dict(x0=P["pocket"]["x0"] - X0, x1=P["pocket"]["x1"] - X0, y_floor=P["pocket"]["y_floor"]))
    print(N, [round(v) for v in hull[1] + hull[2]], round(sx))
json.dump(out, open(os.path.join(ROOT, "tools", "classcad", "wright", "tiles.json"), "w"))
