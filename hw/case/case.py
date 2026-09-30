# Muon3 station case — 3D-printed ABS, generated from the board data (hw/out/board.json).
# Run:  freecadcmd hw/case/case.py            (writes hw/out/case/*.step|stl and prints the screw length)
#
# Construction (4 fasteners total): M3 socket-head screws pass through the lid's spacer columns and the board's corner
# holes into M3×5.7 heat-set inserts in the base bosses, clamping lid + board + base. The split line is the board
# mid-plane. Rev C: the tile coax (Ø1.13/1.37 mm micro-coax on U.FL plugs) enters through a notch in the lid skirt
# above each U.FL, so the bias on the U.FL shells stays inside the closed case; a cable-tie bridge on the outside of
# the base wall takes the strain off the U.FL plugs.
# Chambers: the BME280 island is walled off above and below and vented to room air through the left wall; the hot side
# (ESP32 + AMS1117) has its own vents; the antenna end carries no metal.
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
FLOOR_SCREWS = [(24, 8), (72, 8), (28, 56), (52, 56)]        # board coordinates, clear of bosses, BME ribs and vents
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

# ---------- coax entry notches (top wall, board y = 0) above each U.FL, + external cable-tie bridge ----------
for ref in ("J2", "J3", "J4", "J5"):
    x = parts[ref]["x"]
    lid = lid.cut(Part.makeBox(NOTCH_W, WALL + GAP + 1.0, NOTCH_H + (Z_BT - Z_MID) + 0.01,
                               App.Vector(x - NOTCH_W / 2, by(-GAP - 0.5), Z_MID - 0.01)))
xs = [parts[r]["x"] for r in ("J2", "J3", "J4", "J5")]
bx0, bx1 = min(xs) - 3, max(xs) + 3                       # bridge spans all four cables, 4 mm proud of the wall
Yw = by(Y0)                                               # outer face of the top wall (case Y)
bar = Part.makeBox(bx1 - bx0, 1.6, 3.0, App.Vector(bx0, Yw + 2.4, Z_MID - 4.0))   # a zip tie passes behind it
for xe in (bx0, bx1 - 3.0):
    bar = bar.fuse(Part.makeBox(3.0, 2.5, 3.0, App.Vector(xe, Yw - 0.1, Z_MID - 4.0)))
base = base.fuse(bar)

# ---------- USB-C + STEMMA QT openings (left wall, above the board: lid skirt) ----------
def left_port(ref, w, h, zc):
    y = parts[ref]["y"]
    o = Part.makeBox(WALL + GAP + 1.5, w, h, App.Vector(X0 - 0.5, by(y) - w / 2, zc - h / 2))
    return o.makeFillet(min(1.5, h / 2 - 0.05), [e for e in o.Edges if abs(e.Vertexes[0].Point.x - e.Vertexes[1].Point.x) > 1e-6])
usb = left_port("J1", 12.6, 6.8, Z_BT + 1.65)     # USB-C cable overmold clearance
qt = left_port("J6", 7.0, 5.0, Z_BT + 1.5)        # JST-SH (STEMMA QT / Qwiic) plug
for o in (usb, qt):
    base, lid = base.cut(o), lid.cut(o)

# ---------- BME280 chamber: ribs above and below the slotted island, vented to room air ----------
I = B["island"]
cx0, cx1 = -GAP - 0.01, I["x1"] + I["slotW"] + 0.9     # from the left wall to just past the right slot
cy0, cy1 = I["y0"] - I["slotW"] / 2 - 0.8, I["y1"] + I["slotW"] / 2 + 0.8
RIB = 1.2
def ring(z0, z1):
    o = Part.makeBox(cx1 - cx0, cy1 - cy0, z1 - z0, App.Vector(cx0, by(cy1), z0))
    i = Part.makeBox(cx1 - cx0 - RIB, cy1 - cy0 - 2 * RIB, z1 - z0 + 2, App.Vector(cx0 - 1, by(cy1) + RIB, z0 - 1))
    return o.cut(i)
lid = lid.fuse(ring(Z_BT + 0.15, Z_CEIL + 0.01))       # rib stops 0.15 mm above the board (no clamp on the sensor)
base = base.fuse(ring(Z_FLOOR - 0.01, Z_BB - 0.15))
for k in range(4):                                     # left-wall grille into the chamber, above and below the board
    yk = cy0 + 2.0 + k * (cy1 - cy0 - 4.0) / 3         # 8 slots 1.6 mm wide (≤ 2 mm: no finger/probe access)
    base = base.cut(slot_x(X0 - 1, -GAP + 0.5, yk, Z_FLOOR + 0.6, Z_BB - 0.6, 1.6))
    lid = lid.cut(slot_x(X0 - 1, -GAP + 0.5, yk, Z_BT + 0.6, Z_CEIL - 0.6, 1.6))

# ---------- hot side (ESP32 + AMS1117): chimney vents in the floor and the lid ----------
u1 = parts["U1"]                                       # 8 slots 1.6 × 14 mm in floor and lid: cool air in low, out high
for k in range(8):
    x = u1["x0"] + 1.5 + k * 2.6
    base = base.cut(Part.makeBox(1.6, 14, FLOOR + 1, App.Vector(x, by(u1["y1"]) + 2.5, -0.5)))
    lid = lid.cut(Part.makeBox(1.6, 14, TOP + 1, App.Vector(x, by(u1["y1"]) + 2.5, Z_CEIL - 0.5)))

# ---------- external antenna (ESP32-S3-WROOM-1U): pigtail hole over the module's U.FL, a shallow groove for the cable, and a
# recess in the lid's outer face for a 35 x 10 mm self-adhesive 2.4 GHz FPC antenna (outside the case: no plastic-and-board
# detuning, no shielding by the AFE, and ≥ 10 cm of coax between the antenna and the SiPM inputs) ----------
ANT_HOLE = (92.3, 51.0)                                         # board coordinates of the module's U.FL jack
ANT_BOX = (52.0, 52.5, 88.0, 59.5)                              # antenna recess x0, y0, x1, y1 (board coordinates)
lid = lid.cut(cyl(ANT_HOLE[0], ANT_HOLE[1], Z_CEIL - 1, Z_TOP + 1, 3.2))
lid = lid.cut(box_xy(ANT_BOX[0], ANT_BOX[1], ANT_BOX[2], ANT_BOX[3], Z_TOP - 0.7, Z_TOP + 0.1))
for (xa, ya, xb, yb) in ((ANT_HOLE[0], ANT_HOLE[1], 90.0, 53.5), (90.0, 53.5, ANT_BOX[2] - 0.5, 53.5)):
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

for name, shp in (("case_base", base), ("case_lid", lid)):
    shp = shp.removeSplitter()
    shp.exportStep(os.path.join(OUT, name + ".step"))
    mesh = shp.tessellate(0.05)
    import Mesh
    Mesh.Mesh(mesh).write(os.path.join(OUT, name + ".stl"))

info = {
    "outer_mm": [round(X1 - X0, 2), round(Y1 - Y0, 2), round(Z_TOP, 2)],
    "board_z": [round(Z_BB, 2), round(Z_BT, 2)], "split_z": round(Z_MID, 2),
    "screw": f"ISO 4762 M3x{SCREW}", "screw_engagement_mm": round(engage, 2),
    "inserts": "4x M3 x 5.7 heat-set (hole Ø4.0 x 6.0)", "antenna_hole": ANT_HOLE, "antenna_recess": ANT_BOX,
    "floor_screws_board_xy": FLOOR_SCREWS, "z_floor": Z_FLOOR, "z_board_bottom": Z_BB, "z_split": Z_MID,
    "outer_xyz0": [X0, by(Y1), 0], "board_hw": [W, H],
    "base_volume_cm3": round(base.Volume / 1000, 1), "lid_volume_cm3": round(lid.Volume / 1000, 1),
}
json.dump(info, open(os.path.join(OUT, "case.json"), "w"), indent=1)
print(json.dumps(info))
