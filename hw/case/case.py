# Muon3 station case — 3D-printed ABS, generated from the board data (hw/out/board.json).
# Run:  freecadcmd hw/case/case.py            (writes hw/out/case/*.step|stl and prints the screw length)
#
# Rev D: the board is a 337 x 40 mm strip that stands behind the four tiles, so the case is one long box that is printed in
# THREE segments (split at board x = 68.5 and 268.5, where the plate bars carry the joints): A (cell 0), B (cells 1, 2 and
# the hub: USB-C, ESP32, BME280, 200 mm) and C (cell 3). Each segment has its own base and lid.
# Construction: M3 socket-head screws pass through the lid's spacer columns and the board's edge holes into M3×5.7 heat-set
# inserts in the base bosses, clamping lid + board + base. The split line is the board mid-plane. The tile coax (Ø1.13/1.37 mm
# micro-coax on U.FL plugs) enters through a notch in the lid skirt above each U.FL, so the bias on the U.FL shells stays inside
# the closed case; a small cable-tie bridge on the outside of the wall takes the strain off each U.FL plug.
# Chambers: the BME280 island is walled off above and below and vented to room air through the USB-side wall; the hot side
# (ESP32 + AMS1117) has its own vents; the antenna sits outside on the lid.
import json, os, math
import FreeCAD as App
import Part

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "out", "case")
os.makedirs(OUT, exist_ok=True)
B = json.load(open(os.path.join(HERE, "..", "out", "board.json")))
W, H, T = B["w"], B["h"], B["thickness"]
parts = {p["ref"]: p for p in B["parts"]}

# ---------------- parameters (mm) ----------------
WALL, FLOOR, TOP = 2.4, 2.4, 2.5
GAP = 0.6                 # board edge to inner wall
STANDOFF = 4.6            # floor top to board underside
ABOVE = 5.4               # board top to lid ceiling (USB-C / ESP32 ≈ 3.3 mm tall)
R_OUT = 3.0               # outer corner radius
INSERT_D, INSERT_DEPTH = 4.0, 6.0   # M3 × 5.7 mm heat-set insert (e.g. Ruthex RX-M3x5.7): Ø4.0 hole
BOSS_D = 7.0
COL_D, CLEAR_D = 6.0, 3.4 # lid spacer column / M3 clearance
HEAD_D, HEAD_H = 6.0, 3.0 # M3 socket head Ø5.5 × 3.0 → counterbore Ø6.0
NOTCH_W, NOTCH_H = 1.8, 2.4   # coax entry notch per channel (Ø1.37 max), from the split plane up
Z_FLOOR = FLOOR
Z_BB = Z_FLOOR + STANDOFF           # board bottom
Z_BT = Z_BB + T                     # board top
Z_MID = Z_BB + T / 2                # split plane
Z_CEIL = Z_BT + ABOVE
Z_TOP = Z_CEIL + TOP

X0, Y0 = -GAP - WALL, -GAP - WALL   # outer box in board coordinates (x right, y DOWN)
X1, Y1 = W + GAP + WALL, H + GAP + WALL

def by(y):  # board y (down) -> case Y (up)
    return H - y

def rbox(x0, y0, x1, y1, z0, z1, r):
    """Rounded-rectangle prism in board coordinates."""
    b = Part.makeBox(x1 - x0, y1 - y0, z1 - z0, App.Vector(x0, by(y1), z0))
    if r > 0:
        edges = [e for e in b.Edges if abs(e.Vertexes[0].Point.z - e.Vertexes[1].Point.z) > 1e-6]
        b = b.makeFillet(r, edges)
    return b

def box_xy(x0, y0, x1, y1, z0, z1):   # board coordinates (y down)
    return Part.makeBox(x1 - x0, y1 - y0, z1 - z0, App.Vector(x0, by(y1), z0))

def cyl(x, y, z0, z1, d):
    return Part.makeCylinder(d / 2, z1 - z0, App.Vector(x, by(y), z0))

def hcyl_y(x, y0, y1, z, d):  # horizontal cylinder along board y (through the top wall)
    return Part.makeCylinder(d / 2, abs(y1 - y0), App.Vector(x, by(max(y0, y1)), z), App.Vector(0, 1, 0))

def slot_x(x0, x1, y, z0, z1, w):  # rectangular opening through a wall normal to x
    return Part.makeBox(x1 - x0, w, z1 - z0, App.Vector(x0, by(y) - w / 2, z0))

outer = rbox(X0, Y0, X1, Y1, 0, Z_TOP, R_OUT)
inner = rbox(-GAP, -GAP, W + GAP, H + GAP, Z_FLOOR, Z_CEIL, max(0.5, R_OUT - WALL))
shell = outer.cut(inner)
below = Part.makeBox(X1 - X0 + 2, Y1 - Y0 + 2, Z_MID + 1, App.Vector(X0 - 1, by(Y1) - 1, -1))
base, lid = shell.common(below), shell.cut(below)

# ---------- base: bosses with heat-set insert holes ----------
for h in B["holes"]:
    base = base.fuse(cyl(h["x"], h["y"], Z_FLOOR - 0.01, Z_BB, BOSS_D))
    base = base.cut(cyl(h["x"], h["y"], Z_BB - INSERT_DEPTH, Z_BB + 0.1, INSERT_D))

# ---------- floor mounting holes: the base is screwed to the tile-stack back plate (M3 button-head from inside, so the
# heads sit in the 4.6 mm gap under the board; the board's underside carries no parts) ----------
SEG_CUTS = [68.5, 268.5]                                      # segment joints (board x), on the plate bars at tile z = 50 and 250
FLOOR_Z = [15, 43, 57, 83, 120, 160, 217, 243, 257, 285]     # world z of the floor screws (two per segment per bar)
FLOOR_SCREWS = [(z + 18.5, H / 2) for z in FLOOR_Z]          # board coordinates, mid-width, clear of bosses, BME ribs and vents
for (x, y) in FLOOR_SCREWS:
    base = base.cut(cyl(x, y, -1, Z_FLOOR + 0.1, 3.4))

# ---------- lid: spacer columns + counterbored screw holes ----------
for h in B["holes"]:
    lid = lid.fuse(cyl(h["x"], h["y"], Z_BT + 0.05, Z_CEIL + 0.01, COL_D))
    lid = lid.cut(cyl(h["x"], h["y"], Z_BT - 0.1, Z_TOP + 0.1, CLEAR_D))
    lid = lid.cut(cyl(h["x"], h["y"], Z_TOP - HEAD_H, Z_TOP + 0.1, HEAD_D))

# screw: from counterbore floor through lid column + board into the insert (leave 0.5 mm below the screw tip)
grip = (Z_TOP - HEAD_H) - Z_BB          # counterbore floor to board underside
avail = grip + INSERT_DEPTH - 0.5
std = [l for l in (6, 8, 10, 12, 14, 16, 20, 25) if l <= avail]
SCREW = std[-1]
engage = SCREW - grip

# ---------- coax entry notches (coax-side wall, board y = 0) above each U.FL, + a small external cable-tie bridge per cable ----------
JACKS = ("J2", "J3", "J4", "J5")
for ref in JACKS:
    x = parts[ref]["x"]
    lid = lid.cut(Part.makeBox(NOTCH_W, WALL + GAP + 1.0, NOTCH_H + (Z_BT - Z_MID) + 0.01,
                               App.Vector(x - NOTCH_W / 2, by(-GAP - 0.5), Z_MID - 0.01)))
    Yw = by(Y0)                                           # outer face of the coax-side wall (case Y)
    bar = Part.makeBox(9.0, 1.6, 3.0, App.Vector(x - 4.5, Yw + 2.4, Z_MID - 4.0))     # a zip tie passes behind it
    for xe in (x - 4.5, x + 1.5):
        bar = bar.fuse(Part.makeBox(3.0, 2.5, 3.0, App.Vector(xe, Yw - 0.1, Z_MID - 4.0)))
    base = base.fuse(bar)

# ---------- USB-C opening (far long wall, y = H: the side a plug reaches easily) ----------
def far_port(ref, w, h, zc):
    x = parts[ref]["x"]
    o = Part.makeBox(w, WALL + GAP + 1.5, h, App.Vector(x - w / 2, by(Y1) - 0.5, zc - h / 2))
    return o.makeFillet(min(1.5, h / 2 - 0.05), [e for e in o.Edges if abs(e.Vertexes[0].Point.y - e.Vertexes[1].Point.y) > 1e-6])
usb = far_port("J1", 12.6, 6.8, Z_BT + 1.65)     # USB-C cable overmold clearance
base, lid = base.cut(usb), lid.cut(usb)

# ---------- BME280 chamber: ribs above and below the slotted island (on the far long edge), vented to room air ----------
I, IB = B["island"], B["island_box"]
ix0 = IB["x0"] + 1.4 - I["slotW"] / 2 - 0.8; ix1 = IB["x0"] + 1.4 + (I["y1"] - I["y0"]) + I["slotW"] / 2 + 0.8     # along the edge (board x)
iy1 = H + GAP + 0.01; iy0 = H - (I["x1"] + I["slotW"] + 0.9)                                                     # from the wall inwards (board y)
RIB = 1.2
def ring(z0, z1):
    o = Part.makeBox(ix1 - ix0, iy1 - iy0, z1 - z0, App.Vector(ix0, by(iy1), z0))
    i = Part.makeBox(ix1 - ix0 - 2 * RIB, iy1 - iy0 - RIB, z1 - z0 + 2, App.Vector(ix0 + RIB, by(iy1) - 1, z0 - 1))
    return o.cut(i)
lid = lid.fuse(ring(Z_BT + 0.15, Z_CEIL + 0.01))       # rib stops 0.15 mm above the board (no clamp on the sensor)
base = base.fuse(ring(Z_FLOOR - 0.01, Z_BB - 0.15))
def slot_y(x, y0, y1, z0, z1, w):                      # rectangular opening through a wall normal to y
    return Part.makeBox(w, abs(y1 - y0), z1 - z0, App.Vector(x - w / 2, by(max(y0, y1)), z0))
for k in range(4):                                     # far-wall grille into the chamber, above and below the board
    xk = ix0 + 2.0 + k * (ix1 - ix0 - 4.0) / 3         # 8 slots 1.6 mm wide (≤ 2 mm: no finger/probe access)
    base = base.cut(slot_y(xk, H + GAP - 0.5, Y1 + 1, Z_FLOOR + 0.6, Z_BB - 0.6, 1.6))
    lid = lid.cut(slot_y(xk, H + GAP - 0.5, Y1 + 1, Z_BT + 0.6, Z_CEIL - 0.6, 1.6))

# ---------- hot side (ESP32 + AMS1117): chimney vents in the floor and the lid ----------
u1 = parts["U1"]                                       # 8 slots 1.6 × 14 mm in floor and lid: cool air in low, out high
for k in range(8):
    x = u1["x0"] + 1.5 + k * 2.6
    base = base.cut(Part.makeBox(1.6, 14, FLOOR + 1, App.Vector(x, by(u1["y1"]) + 2.5, -0.5)))
    lid = lid.cut(Part.makeBox(1.6, 14, TOP + 1, App.Vector(x, by(u1["y1"]) + 2.5, Z_CEIL - 0.5)))

# ---------- external antenna (ESP32-S3-WROOM-1U): pigtail hole over the module's U.FL, a shallow groove for the cable, and a
# recess in the lid's outer face for a 35 x 10 mm self-adhesive 2.4 GHz FPC antenna (outside the case: no plastic-and-board
# detuning, no shielding by the AFE, and ≥ 10 cm of coax between the antenna and the SiPM inputs) ----------
U1P = parts["U1"]; ANT_HOLE = (U1P["x"] + 7.7, U1P["y"] + 6.0)   # board coordinates of the module's U.FL jack (offset from the module centre, rot 270)
ANT_BOX = (ANT_HOLE[0] - 37.0, 35.5, ANT_HOLE[0] - 2.0, 42.5)   # antenna recess x0, y0, x1, y1 (board coordinates), along the far edge
lid = lid.cut(cyl(ANT_HOLE[0], ANT_HOLE[1], Z_CEIL - 1, Z_TOP + 1, 3.2))
lid = lid.cut(box_xy(ANT_BOX[0], ANT_BOX[1], ANT_BOX[2], ANT_BOX[3], Z_TOP - 0.7, Z_TOP + 0.1))
for (xa, ya, xb, yb) in ((ANT_HOLE[0], ANT_HOLE[1], ANT_HOLE[0], 39.0), (ANT_HOLE[0], 39.0, ANT_BOX[2] - 0.5, 39.0)):
    lid = lid.cut(box_xy(min(xa, xb) - 0.8, min(ya, yb) - 0.8, max(xa, xb) + 0.8, max(ya, yb) + 0.8, Z_TOP - 0.8, Z_TOP + 0.1))

# ---------- access: BOOT pin hole, STATUS light pipe ----------
for p in B["parts"]:
    if p["value"] == "BOOT":
        lid = lid.cut(cyl(p["x"], p["y"], Z_CEIL - 1, Z_TOP + 1, 1.6))
    if p["value"] == "STATUS":
        lid = lid.cut(cyl(p["x"], p["y"], Z_CEIL - 1, Z_TOP + 1, 2.0))

# ---------- label (debossed) ----------
try:
    import Draft  # noqa: F401  (text needs a font; skip silently when unavailable)
except Exception:
    pass

import Mesh
cuts = [-GAP - WALL - 1] + SEG_CUTS + [W + GAP + WALL + 1]
SEGS = []
for k in range(3):
    name = "ABC"[k]; x0_, x1_ = cuts[k], cuts[k + 1]
    cutter = Part.makeBox(x1_ - x0_, Y1 - Y0 + 4, Z_TOP + 4, App.Vector(x0_, by(Y1) - 2, -2))
    for nm, shp in (("case_base_" + name, base.common(cutter)), ("case_lid_" + name, lid.common(cutter))):
        shp = shp.removeSplitter()
        shp.exportStep(os.path.join(OUT, nm + ".step"))
        Mesh.Mesh(shp.tessellate(0.05)).write(os.path.join(OUT, nm + ".stl"))
    SEGS.append([round(x0_, 1) if k else round(X0, 1), round(x1_, 1) if k < 2 else round(X1, 1)])

info = {
    "outer_mm": [round(X1 - X0, 2), round(Y1 - Y0, 2), round(Z_TOP, 2)],
    "board_z": [round(Z_BB, 2), round(Z_BT, 2)], "split_z": round(Z_MID, 2),
    "screw": f"ISO 4762 M3x{SCREW}", "screw_engagement_mm": round(engage, 2),
    "inserts": f"{len(B['holes'])}x M3 x 5.7 heat-set (hole Ø4.0 x 6.0)", "z_top": round(Z_TOP, 2), "z_ceil": round(Z_CEIL, 2), "holes": B["holes"], "segments": SEGS, "jack_x": [parts[r]["x"] for r in JACKS], "jack_y": parts["J2"]["y"], "antenna_hole": ANT_HOLE, "antenna_recess": ANT_BOX,
    "floor_screws_board_xy": FLOOR_SCREWS, "z_floor": Z_FLOOR, "z_board_bottom": Z_BB, "z_split": Z_MID,
    "outer_xyz0": [X0, by(Y1), 0], "board_hw": [W, H],
    "base_volume_cm3": round(base.Volume / 1000, 1), "lid_volume_cm3": round(lid.Volume / 1000, 1), "floor_z": FLOOR_Z,
}
json.dump(info, open(os.path.join(OUT, "case.json"), "w"), indent=1)
print(json.dumps(info))
