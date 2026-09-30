# Muon3 tile-stack assembly: sPHENIX inner-HCal tiles (4, 100 mm apart) + fibers + SiPM + printed ABS frame + station board
# in its case + display pod + micro-coax cables, as a hierarchical FreeCAD document.
#
#   TILE=1 freecadcmd hw/case/assembly.py            (1..12; SECTIONS=1 also writes the section solids)
#
# Writes hw/out/assembly/tileNN/{station.FCStd, station.step, manifest.json, stl/*.stl} (+ common/ for the shared board
# and case). manifest.json drives hw/case/render_assembly.py (Blender).
#
# Frame: x along the tile's x (0 = tile bbox xmin), y along the tile's y (0 = bottom edge, 191 = SiPM edge), z up; tile k's
# mid-plane is at z = 100·k. The station board stands vertically behind the SiPM edge (board normal = +y, USB on the +x side).
import json, math, os, re
import FreeCAD as App
import Part, Mesh

V = App.Vector
HERE = os.path.dirname(os.path.abspath(__file__))
HW = os.path.join(HERE, "..")
N = int(os.environ.get("TILE", "1"))
SECTIONS = os.environ.get("SECTIONS") == "1"
OUT = os.path.join(HW, "out", "assembly", f"tile{N:02d}")
COMMON = os.path.join(HW, "out", "assembly", "common")
for d in (OUT + "/stl", COMMON):
    os.makedirs(d, exist_ok=True)
P = json.load(open(os.path.join(HW, "..", "sim", "geant4", "gdml", "mesh", f"InnerHCalTile{N:02d}_EJ200_mesh.json")))["params"]
CASE = json.load(open(os.path.join(HW, "out", "case", "case.json")))

# ------------------------------------------------------------------ parameters (mm)
PITCH, TT = 100.0, P["thickness_mm"]              # tile pitch (centre to centre), tile thickness 7
X0 = P["bbox"]["xmin"]
HULL = [(x - X0, y) for x, y in P["hull_xy"]]     # bl, br, tr, tl
BL, BR, TR, TL = HULL
POCKET = P["pocket"]; SX = P["sipm"]["cx"] - X0   # SiPM x
ENDS = [P["fiber_exit"]["left"][0] - X0, P["fiber_exit"]["right"][0] - X0]
FIBER = [(x - X0, y) for x, y in P["fiber_path_xy"]]
YTOP = 191.0                                       # SiPM edge (tile 7-12: 190.62)
YTOP = max(y for _, y in HULL)
FIB_R, GROOVE_R = 0.5, 0.65
CLIP_T, SLOT, WALL, LIP = 12.4, 7.6, 3.5, 4.0     # corner clip: thickness, tile slot, outer wall, lip overlap
ROD_D, BOSS_R, SP_OD, SP_ID = 6.0, 7.0, 12.0, 6.4
Y_FRONT, Y_BACK = -12.0, YTOP + 15.0               # rod rows
PLATE_T, PLATE_H, PLATE_Z0 = 5.0, 78.0, 150.0      # back plate web thickness, height, centre z
NK = 4
ZS = [PITCH * k for k in range(NK)]
XC = SX                                            # board centre x (short cables)
ZC = PLATE_Z0

# ------------------------------------------------------------------ helpers
def box(x0, y0, z0, x1, y1, z1): return Part.makeBox(x1 - x0, y1 - y0, z1 - z0, V(x0, y0, z0))
def cyl(x, y, z0, z1, d): return Part.makeCylinder(d / 2, z1 - z0, V(x, y, z0))
def cylx(x0, x1, y, z, d): return Part.makeCylinder(d / 2, x1 - x0, V(x0, y, z), V(1, 0, 0))
def cyly(x, y0, y1, z, d): return Part.makeCylinder(d / 2, y1 - y0, V(x, y0, z), V(0, 1, 0))

def poly_face(pts, z=0.0):
    return Part.Face(Part.makePolygon([V(x, y, z) for x, y in pts] + [V(pts[0][0], pts[0][1], z)]))

def prism(face, z0, z1):
    f = face.copy(); f.translate(V(0, 0, z0)); return f.extrude(V(0, 0, z1 - z0))

def extrude_faces(shape, z0, z1):
    res = None
    for f in shape.Faces:
        s = prism(f, z0, z1); res = s if res is None else res.fuse(s)
    return res

def fillet_wire(pts, R, closed=False):
    """Polyline (3D points) with tangent-arc corners of radius <= R (clamped to 45 % of the adjacent legs)."""
    Pn = [V(*p) for p in pts]; edges = []; cur = Pn[0]
    for i in range(1, len(Pn) - 1):
        a, p, b = Pn[i - 1], Pn[i], Pn[i + 1]
        u1 = a - p; l1 = u1.Length; u1.normalize(); u2 = b - p; l2 = u2.Length; u2.normalize()
        th = math.acos(max(-1.0, min(1.0, u1.dot(u2))))
        if th > math.pi - 1e-3 or th < 1e-3:
            continue
        t = min(R / math.tan(th / 2), 0.45 * min(l1, l2)); Rr = t * math.tan(th / 2)
        T1, T2 = p + u1 * t, p + u2 * t
        bis = u1 + u2; bis.normalize(); Cc = p + bis * (Rr / math.sin(th / 2)); mid = Cc - bis * Rr
        if (T1 - cur).Length > 1e-6: edges.append(Part.LineSegment(cur, T1).toShape())
        edges.append(Part.Arc(T1, mid, T2).toShape()); cur = T2
    edges.append(Part.LineSegment(cur, Pn[-1]).toShape())
    return Part.Wire(edges)

def pipe(wire, r):
    e = wire.Edges[0]
    p0, t = e.valueAt(e.FirstParameter), e.tangentAt(e.FirstParameter)
    if wire.Vertexes[0].Point.distanceToPoint(p0) > 1e-6:      # edge orientation flipped
        p0, t = e.valueAt(e.LastParameter), e.tangentAt(e.LastParameter) * -1
    prof = Part.Wire(Part.Circle(p0, t, r).toShape())
    return wire.makePipeShell([prof], True, True)

# ------------------------------------------------------------------ document tree
doc = App.newDocument("Station")
LEAVES = []                                             # (obj, group, colour, alpha)
def part(name, parent=None, place=None):
    p = doc.addObject("App::Part", name)
    if place is not None: p.Placement = place
    if parent is not None: parent.addObject(p)
    return p
def leaf(name, shape, parent, group, color, alpha=1.0, tol=0.05):
    o = doc.addObject("Part::Feature", name); o.Shape = shape
    parent.addObject(o); LEAVES.append((o, group, color, alpha, tol)); return o

ST = part("Station")
TILES = part("Tiles", ST); FRAME = part("Frame", ST); ELEC = None
COL = dict(tile=(0.55, 0.78, 0.95), fiber=(0.15, 0.85, 0.30), coupler=(0.05, 0.05, 0.06), sipm=(0.85, 0.12, 0.10),
           pcb=(0.10, 0.38, 0.20), abs=(0.86, 0.80, 0.62), steel=(0.62, 0.64, 0.68), brass=(0.80, 0.62, 0.20),
           cable=(0.12, 0.12, 0.14), pod=(0.30, 0.34, 0.40), oled=(0.05, 0.10, 0.35), screw=(0.25, 0.25, 0.28))

# ------------------------------------------------------------------ tile (one shape; four copies at 100 mm pitch)
hull_face = poly_face(HULL)
pocket = box(POCKET["x0"] - X0, POCKET["y_floor"], -TT, POCKET["x1"] - X0, YTOP + 1, TT)
try: pocket = pocket.makeFillet(1.5, [e for e in pocket.Edges if abs(e.tangentAt(e.FirstParameter).z) > .99 and e.Vertexes[0].Point.y < POCKET["y_floor"] + 1])
except Exception: pass
body0 = prism(hull_face, -TT / 2, TT / 2).cut(pocket)

def fiber_layout(margin=8.0):
    """Fiber centre lines for THIS tile shape. The source mesh JSON only has a valid path for tile 1: for tiles 2-12 it is the
    same bounding-box serpentine (legs 8 mm from the bbox edge), which runs outside the slanted scintillator. So the path is
    rebuilt for every shape: four horizontal legs at the source's y positions joined by semicircles (R = half the leg spacing,
    28.4 mm), each turn pushed as far out as the hull allows with `margin` to the tile edge; loop A goes from the left exit
    down the serpentine to the hairpin, loop B returns along the bottom leg and up to the right exit (vertical when the hull
    allows, otherwise parallel to the slanted right edge). Reproduces the tile-1 path to ~1 mm."""
    (blx, bly), (brx, bry), (trx, tr_y), (tlx, tl_y) = HULL
    xl = lambda y: blx + (tlx - blx) * (y - bly) / (tl_y - bly)
    xr = lambda y: brx + (trx - brx) * (y - bry) / (tr_y - bry)
    ys = sorted({round(FIBER[i][1], 2) for i in range(len(FIBER) - 1) if abs(FIBER[i][1] - FIBER[i + 1][1]) < 1e-3 and abs(FIBER[i][0] - FIBER[i + 1][0]) > 20}, reverse=True)
    R = (ys[0] - ys[1]) / 2
    xeL, xeR = ENDS
    tok = [("pt", (xeL, YTOP)), ("pt", (xeL, ys[0]))]
    cur_y = ys[0]
    for k in range(len(ys) - 1):
        y0_, y1_ = ys[k], ys[k + 1]; cy = (y0_ + y1_) / 2
        right = (k % 2 == 0)
        ths = [math.radians(t) for t in range(-90, 91, 6)]
        if right: c = min(xr(cy + R * math.sin(t)) - margin - R * math.cos(t) for t in ths)
        else:     c = max(xl(cy + R * math.sin(t)) + margin + R * math.cos(t) for t in ths)
        tok.append(("arc", (c, y0_), (c, y1_), (c + (R if right else -R), cy)))
    x_hp = xl(ys[-1]) + margin
    tokA = tok + [("pt", (x_hp, ys[-1]))]
    slope = (trx - brx) / (tr_y - bry)
    y_v = ys[-1] if xr(ys[-1]) - margin >= xeR else (xeR + margin - brx) / slope + bry
    if y_v <= ys[-1] + 1e-6: tokB = [("pt", (x_hp, ys[-1])), ("pt", (xeR, ys[-1])), ("pt", (xeR, YTOP))]
    else:                     tokB = [("pt", (x_hp, ys[-1])), ("pt", (xeR - slope * (y_v - ys[-1]), ys[-1])), ("pt", (xeR, y_v)), ("pt", (xeR, YTOP))]
    return tokA, tokB, R
def _wire(tok, z):
    """Wire through tokens: ('pt', p) corners (filleted with tangent arcs R <= 25 mm, clamped to the legs) and ('arc', start, end, mid)."""
    V3 = lambda q: V(q[0], q[1], z)
    edges, cur = [], tok[0][1]
    def line(a_, b_):
        if math.hypot(b_[0] - a_[0], b_[1] - a_[1]) > 1e-6: edges.append(Part.LineSegment(V3(a_), V3(b_)).toShape())
    for k in range(1, len(tok)):
        t = tok[k]
        if t[0] == "arc":
            line(cur, t[1]); edges.append(Part.Arc(V3(t[1]), V3(t[3]), V3(t[2])).toShape()); cur = t[2]; continue
        if k == len(tok) - 1: line(cur, t[1]); cur = t[1]; continue
        nx = tok[k + 1][1]
        a1 = (cur[0] - t[1][0], cur[1] - t[1][1]); b1 = (nx[0] - t[1][0], nx[1] - t[1][1])
        la, lb = math.hypot(*a1), math.hypot(*b1); a1 = (a1[0] / la, a1[1] / la); b1 = (b1[0] / lb, b1[1] / lb)
        th = math.acos(max(-1, min(1, a1[0] * b1[0] + a1[1] * b1[1])))
        if th > math.pi - 1e-3 or th < 1e-3: continue
        kA = 0.95 if k == 1 else 0.45; kB = 0.95 if k + 2 == len(tok) else 0.45
        tt = min(25 / math.tan(th / 2), kA * la, kB * lb); Rr = tt * math.tan(th / 2)
        bis = (a1[0] + b1[0], a1[1] + b1[1]); lbz = math.hypot(*bis); bis = (bis[0] / lbz, bis[1] / lbz)
        C = (t[1][0] + bis[0] * Rr / math.sin(th / 2), t[1][1] + bis[1] * Rr / math.sin(th / 2))
        T1 = (t[1][0] + a1[0] * tt, t[1][1] + a1[1] * tt); T2 = (t[1][0] + b1[0] * tt, t[1][1] + b1[1] * tt)
        line(cur, T1); edges.append(Part.Arc(V3(T1), V3((C[0] - bis[0] * Rr, C[1] - bis[1] * Rr)), V3(T2)).toShape()); cur = T2
    return Part.Wire(edges)
def fiber_solid(tok, z, r): return pipe(_wire(tok, z), r)

tokA, tokB, R_TURN = fiber_layout()
groove_ok = True
try:
    body0 = body0.cut(fiber_solid(tokA, 1.0, GROOVE_R)).cut(fiber_solid(tokB, -1.0, GROOVE_R))
except Exception as e:
    groove_ok = False; print("groove cut skipped:", e)
fibA, fibB = fiber_solid(tokA, 1.0, FIB_R), fiber_solid(tokB, -1.0, FIB_R)

# coupler (black ABS block on the SiPM edge, two fiber ends + 3x3 SiPM), SiPM, daughter PCB with U.FL
BX, BW = SX, P["blocker"]["sx"]
coupler = box(BX - BW / 2, YTOP, -4, BX + BW / 2, YTOP + 6, 4)
coupler = coupler.cut(box(BX - BW / 2 + 2, YTOP - 0.1, -1.6, BX + BW / 2 - 2, YTOP + 1.0, 1.6))     # mixing slot over the fiber ends
coupler = coupler.cut(box(BX - 1.9, YTOP + 0.9, -1.9, BX + 1.9, YTOP + 2.8, 1.9))                   # SiPM pocket
sipm = box(BX - 1.5, YTOP + 1.0, -1.5, BX + 1.5, YTOP + 2.5, 1.5)
sipm_pcb = box(BX - 12, YTOP + 6, -6, BX + 12, YTOP + 7.6, 6)
ufl_sipm = box(BX - 1.5, YTOP + 7.6, -1.3, BX + 1.5, YTOP + 8.85, 1.3)                               # U.FL jack, cable plugs in from +y
Y_JACK = YTOP + 8.85

tile_parts = []
for k in range(NK):
    tp = part(f"Tile_{k}", TILES, App.Placement(V(0, 0, ZS[k]), App.Rotation()))
    leaf(f"Tile{k}_Body", body0, tp, "tile", COL["tile"], 0.32, 0.1)
    leaf(f"Tile{k}_FiberA", fibA, tp, "tile", COL["fiber"], 1.0, 0.05)
    leaf(f"Tile{k}_FiberB", fibB, tp, "tile", COL["fiber"], 1.0, 0.05)
    leaf(f"Tile{k}_Coupler", coupler, tp, "sipm", COL["coupler"])
    leaf(f"Tile{k}_SiPM", sipm, tp, "sipm", COL["sipm"])
    leaf(f"Tile{k}_SiPM_PCB", sipm_pcb, tp, "sipm", COL["pcb"])
    leaf(f"Tile{k}_UFL", ufl_sipm, tp, "sipm", COL["steel"])
    tile_parts.append(tp)

# ------------------------------------------------------------------ frame: 4 rods, corner clips, spacers, back plate
RODS = [(BL[0] - 4, Y_FRONT), (BR[0] + 4, Y_FRONT), (TR[0] + 4, Y_BACK), (TL[0] - 4, Y_BACK)]   # bl, br, tr, tl
BACK_RODS = [RODS[3], RODS[2]]
def corner_clip(i):
    v, rod = HULL[i], RODS[i]
    outer = hull_face.makeOffset2D(WALL, 0).Faces[0]
    disk = Part.Face(Part.Wire(Part.makeCircle(22.0, V(v[0], v[1], 0))))
    plan = outer.common(disk)
    d = V(rod[0] - v[0], rod[1] - v[1], 0); L = d.Length; d.normalize(); nrm = V(-d.y, d.x, 0)
    bar = poly_face([(v[0] + nrm.x * 5, v[1] + nrm.y * 5), (rod[0] + nrm.x * 5, rod[1] + nrm.y * 5),
                     (rod[0] - nrm.x * 5, rod[1] - nrm.y * 5), (v[0] - nrm.x * 5, v[1] - nrm.y * 5)])
    boss = Part.Face(Part.Wire(Part.makeCircle(BOSS_R, V(rod[0], rod[1], 0))))
    plan = plan.fuse(bar).fuse(boss).removeSplitter()
    c = extrude_faces(plan, -CLIP_T / 2, CLIP_T / 2)
    slot = prism(hull_face.makeOffset2D(0.3, 0).Faces[0], -SLOT / 2, SLOT / 2)
    open_ = prism(hull_face.makeOffset2D(-LIP, 2).Faces[0], -CLIP_T, CLIP_T)
    c = c.cut(slot).cut(open_).cut(cyl(rod[0], rod[1], -CLIP_T, CLIP_T, 6.4))
    return c.removeSplitter()
clips = [corner_clip(i) for i in range(4)]
NAMES = ["FL", "FR", "BR", "BL"]
for k in range(NK):
    for i in range(4):
        cc = clips[i].copy(); cc.translate(V(0, 0, ZS[k]))
        leaf(f"Clip_{k}_{NAMES[i]}", cc, FRAME, "frame", COL["abs"], 1.0, 0.1)

Z_TOP_CLIP = ZS[-1] + CLIP_T / 2
for i, (rx, ry) in enumerate(RODS):
    leaf(f"Rod_{NAMES[i]}", cyl(rx, ry, -CLIP_T / 2 - 16, Z_TOP_CLIP + 16, ROD_D), FRAME, "frame", COL["steel"])
    for zb in (-CLIP_T / 2 - 5 - 1.6, Z_TOP_CLIP + 1.6):                                      # M6 nut + washer top and bottom
        nut = Part.makePolygon([V(rx + 5.77 * math.cos(math.radians(60 * a)), ry + 5.77 * math.sin(math.radians(60 * a)), zb) for a in range(7)])
        leaf(f"Nut_{NAMES[i]}_{int(zb)}", Part.Face(nut).extrude(V(0, 0, 5)).cut(cyl(rx, ry, zb - 1, zb + 6, ROD_D)), FRAME, "frame", COL["steel"])
    # spacers between clips (tube OD 12 / ID 6.4); the back rods are interrupted by the plate sleeves
    gaps = [(ZS[k] + CLIP_T / 2, ZS[k + 1] - CLIP_T / 2) for k in range(NK - 1)]
    for g, (za, zb_) in enumerate(gaps):
        segs = [(za, zb_)]
        if i >= 2 and g == 1:
            segs = [(za, PLATE_Z0 - PLATE_H / 2), (PLATE_Z0 + PLATE_H / 2, zb_)]
        for j, (a, b) in enumerate(segs):
            leaf(f"Spacer_{NAMES[i]}_{g}{'abc'[j]}", cyl(rx, ry, a, b, SP_OD).cut(cyl(rx, ry, a - 1, b + 1, SP_ID)), FRAME, "frame", COL["abs"], 1.0, 0.1)

# back plate, modular: a universal CENTER BAR carries the case and the display pod on M3 heat-set inserts; a ROD ARM (per tile
# shape) reaches each back rod when the rod is beyond the bar's end, joined with a front splice plate (4 x M3x6 socket head
# into inserts). Rods that fall inside the bar's span get their sleeve as part of the bar.
(rlx, rly), (rrx, rry) = BACK_RODS
CASE_W = CASE["outer_mm"][0]
POD_W, POD_Z = 38.0, ZC + 20.0
POD_X = XC + CASE_W / 2 + 6 + POD_W / 2
BAR_X0, BAR_X1 = XC - 67.0, XC + 111.0
Y_PB = Y_BACK + PLATE_T / 2                                                                     # plate back face
Y_PF = Y_BACK - PLATE_T / 2                                                                     # plate front face
z0p, z1p = PLATE_Z0 - PLATE_H / 2, PLATE_Z0 + PLATE_H / 2
arm_l, arm_r = rlx + 7 <= BAR_X0 - 2, rrx - 7 >= BAR_X1 + 2
bx0 = BAR_X0 if arm_l else min(BAR_X0, rlx - 7); bx1 = BAR_X1 if arm_r else max(BAR_X1, rrx + 7)
def sleeved(shape, rx, ry):
    shape = shape.fuse(cyl(rx, ry, z0p, z1p, 14.0))
    return shape.cut(cyl(rx, ry, z0p - PLATE_H, z1p + PLATE_H, 6.4))
bar = box(bx0, Y_PF, z0p, bx1, Y_PB, z1p)
for rx, ry, isarm in ((rlx, rly, arm_l), (rrx, rry, arm_r)):
    if not isarm and bx0 - 7 <= rx <= bx1 + 7: bar = sleeved(bar, rx, ry)
def w_case(X, Y, Z):   # case frame -> world (X -> -x, Z -> +y, Y -> +z): a proper rotation
    return (XC + 48 - X, Y_PB + Z, ZC + (Y - 32))
back_inserts = []                                                                               # (x, z) inserts from the back face
for (bx_, by_) in CASE["floor_screws_board_xy"]:
    wx, _, wz = w_case(bx_, 64 - by_, 0); back_inserts.append((wx, wz))
for dz in (-15, 15): back_inserts.append((POD_X, POD_Z + dz))
front_inserts = []                                                                              # (x, z) inserts from the front face (joints)
arms = []
for side, rx, ry, isarm in (("L", rlx, rly, arm_l), ("R", rrx, rry, arm_r)):
    if not isarm: continue
    xj = bx0 if side == "L" else bx1
    ax0, ax1 = (rx - 7, xj) if side == "L" else (xj, rx + 7)
    arm = sleeved(box(ax0, Y_PF, z0p, ax1, Y_PB, z1p), rx, ry)
    sp = (xj - 15, xj + 15)
    for sgn in (-1, 1):
        for dz in (-22, 22): front_inserts.append((xj + sgn * 8, PLATE_Z0 + dz))
    arms.append((side, arm, xj))
for (hx, hz) in back_inserts: bar = bar.cut(cyly(hx, Y_PB - 4.5, Y_PB + 0.1, hz, 4.0))
bar = bar.removeSplitter()
def front_holes(shape, x0_, x1_):
    for (hx, hz) in front_inserts:
        if x0_ <= hx <= x1_: shape = shape.cut(cyly(hx, Y_PF - 0.1, Y_PF + 4.5, hz, 4.0))
    return shape
bar = front_holes(bar, bx0, bx1)
leaf("PlateBar", bar, FRAME, "plate", COL["abs"], 1.0, 0.1)
ins_shape = lambda hx, y0, y1, hz: cyly(hx, y0, y1, hz, 4.6).cut(cyly(hx, y0 - 0.1, y1 + 0.1, hz, 3.0))
for j, (hx, hz) in enumerate(back_inserts): leaf(f"PlateInsertBack_{j}", ins_shape(hx, Y_PB - 4.0, Y_PB, hz), FRAME, "plate", COL["brass"])
for side, arm, xj in arms:
    arm = front_holes(arm, xj - 200, xj + 200).removeSplitter()
    leaf(f"PlateArm_{side}", arm, FRAME, "plate", COL["abs"], 1.0, 0.1)
    fish = box(xj - 15, Y_PF - 3.0, PLATE_Z0 - 32, xj + 15, Y_PF, PLATE_Z0 + 32)
    for sgn in (-1, 1):
        for dz in (-22, 22): fish = fish.cut(cyly(xj + sgn * 8, Y_PF - 3.1, Y_PF + 0.1, PLATE_Z0 + dz, 3.4))
    leaf(f"PlateSplice_{side}", fish, FRAME, "plate", COL["abs"], 1.0, 0.1)
    for sgn in (-1, 1):
        for dz in (-22, 22):
            hx, hz = xj + sgn * 8, PLATE_Z0 + dz
            leaf(f"SpliceScrew_{side}{'m' if sgn < 0 else 'p'}{'l' if dz < 0 else 'u'}", cyly(hx, Y_PF - 3.0 - 3.0, Y_PF + 3.0, hz, 3.0).fuse(cyly(hx, Y_PF - 6.0, Y_PF - 3.0, hz, 5.5)), FRAME, "plate", COL["screw"])
for (hx, hz) in [q for q in front_inserts]:
    leaf(f"PlateInsertFront_{int(hx)}_{int(hz)}", ins_shape(hx, Y_PF, Y_PF + 4.0, hz), FRAME, "plate", COL["brass"])
px0, px1 = bx0 - (14 if arm_l else 0), bx1
if arm_l: px0 = rlx - 7
if arm_r: px1 = rrx + 7

# ------------------------------------------------------------------ electronics: case, board, screws, inserts, display
M = App.Matrix(-1, 0, 0, XC + 48, 0, 0, 1, Y_PB, 0, 1, 0, ZC - 32, 0, 0, 0, 1)   # case frame -> world
ELEC = part("Electronics", ST, App.Placement(M))
def read(path, tol=None):
    return Part.read(path)
base = Part.read(os.path.join(HW, "out", "case", "case_base.step"))
lid = Part.read(os.path.join(HW, "out", "case", "case_lid.step"))
leaf("Case_Base", base, ELEC, "electronics", COL["abs"], 1.0, 0.1)
leaf("Case_Lid", lid, ELEC, "electronics", COL["abs"], 1.0, 0.1)
pcb = Part.read(os.path.join(HW, "out", "assembly", "pcb.step"))
pcb.translate(V(0, 64, CASE["z_board_bottom"]))
leaf("PCB", pcb, ELEC, "electronics", COL["pcb"], 1.0, 0.15)
for j, (bx, by_) in enumerate([(3.5, 3.5), (92.5, 3.5), (3.5, 60.5), (92.5, 60.5)]):
    X, Yc = bx, 64 - by_
    ztop = 16.5 - 3.0
    screw = cyl(X, Yc, ztop - 12, ztop, 3.0).fuse(cyl(X, Yc, ztop, 16.5, 5.5))
    leaf(f"LidScrew_{j}", screw.cut(box(X - 1.2, Yc - 0.6, 15.3, X + 1.2, Yc + 0.6, 16.6)), ELEC, "electronics", COL["screw"])
    leaf(f"LidInsert_{j}", cyl(X, Yc, CASE["z_board_bottom"] - 5.7, CASE["z_board_bottom"], 4.6).cut(cyl(X, Yc, CASE["z_board_bottom"] - 6, CASE["z_board_bottom"] + 1, 3.0)), ELEC, "electronics", COL["brass"])
for j, (bx, by_) in enumerate(CASE["floor_screws_board_xy"]):
    X, Yc = bx, 64 - by_
    zt = CASE["z_floor"]
    leaf(f"MountScrew_{j}", cyl(X, Yc, zt - 6.0, zt, 3.0).fuse(cyl(X, Yc, zt, zt + 3.0, 5.5)), ELEC, "electronics", COL["screw"])   # ISO 4762 M3x6

# external 2.4 GHz FPC antenna on the lid's outer face + U.FL pigtail from the module's U.FL through the lid
ax0, ay0, ax1, ay1 = CASE["antenna_recess"]
leaf("Antenna_FPC", box(ax0 + 0.5, 64 - ay1 + 0.5, 16.5 - 0.5, ax1 - 0.5, 64 - ay0 - 0.5, 16.5 - 0.1), ELEC, "electronics", (0.05, 0.05, 0.06), 1.0, 0.05)
hx_, hy_ = CASE["antenna_hole"]; Yc_ = 64 - hy_
pig = pipe(fillet_wire([(hx_, Yc_, 11.5), (hx_, Yc_, 17.3), (90.0, 64 - 53.5, 17.0), (ax1 - 1.5, 64 - 53.5, 16.95), (ax1 - 1.5, 64 - 57.5, 16.95)], 4.0), 0.5)
leaf("Antenna_Pigtail", pig, ELEC, "electronics", COL["cable"], 1.0, 0.05)
leaf("Antenna_Plug", box(hx_ - 1.5, Yc_ - 1.4, 10.4, hx_ + 1.5, Yc_ + 1.4, 12.0), ELEC, "electronics", COL["steel"])

# display pod on the plate (0.91" 128x32 I2C OLED behind a window; QT cable in from the case wall opening on the +x side)
pod_m = App.Matrix(1, 0, 0, POD_X, 0, 1, 0, Y_PB, 0, 0, 1, POD_Z, 0, 0, 0, 1)
POD = part("DisplayPod", ST, App.Placement(pod_m))
flange = box(-POD_W / 2, 0, -22, POD_W / 2, 2.4, 22)
body = box(-POD_W / 2, 0, -11, POD_W / 2, 18, 11)
body = body.cut(box(-POD_W / 2 - 1, 0, -7.4, POD_W / 2 - 2.4, 15.6, 7.4))                        # cavity for the module, open on the case side
body = body.cut(box(-12.2, 14, -3.4, 12.2, 19, 3.4))                                              # OLED window 24.4 x 6.8
pod = flange.fuse(body)
for dz in (-15, 15):
    pod = pod.cut(cyly(0, -1, 3, dz, 3.4))
leaf("Pod", pod.removeSplitter(), POD, "display", COL["pod"], 1.0, 0.1)
leaf("OLED", box(-15, 4.0, -5.75, 15, 13.5, 5.75), POD, "display", COL["oled"])
for j, dz in enumerate((-15, 15)):
    leaf(f"PodScrew_{j}", cyly(0, -3.6, 2.4, dz, 3.0).fuse(cyly(0, 2.4, 5.4, dz, 5.5)), POD, "display", COL["screw"])   # ISO 4762 M3x6

# ------------------------------------------------------------------ micro-coax cables: U.FL notch (case top wall) -> tile SiPM
JX = [XC + 48 - (18.5 + 20 * k) for k in range(NK)]                     # world x of jack k (case x = board x)
Y_LANE = Y_PB - PLATE_T - 2.0                                           # in front of the plate, behind the SiPM boards
Z_OVER = PLATE_Z0 + PLATE_H / 2 + 8
CABLES = part("Cables", ST)
for k in range(NK):
    y_out = Y_PB + 9.0
    zt = ZS[k]; px = SX + (k - 1.5) * 1.6
    pts = [(JX[k], y_out, ZC + 29), (JX[k], y_out, Z_OVER), (JX[k], Y_LANE, Z_OVER), (JX[k], Y_LANE, zt), (px, Y_LANE, zt)]
    # drop points that are duplicates
    clean = [pts[0]]
    for q in pts[1:]:
        if V(*q).distanceToPoint(V(*clean[-1])) > 0.5: clean.append(q)
    leaf(f"Cable_{k}", pipe(fillet_wire(clean, 9.0), 0.57), CABLES, "cables", COL["cable"], 1.0, 0.05)
    leaf(f"CablePlug_{k}", box(SX + (k - 1.5) * 1.6 - 1.6, Y_JACK, zt - 1.4, SX + (k - 1.5) * 1.6 + 1.6, Y_JACK + 3.4, zt + 1.4), CABLES, "cables", COL["steel"])
doc.recompute()

# ------------------------------------------------------------------ outputs: FCStd, STEP, STL per leaf, manifest
def gmat(o):
    m = o.getGlobalPlacement().toMatrix()
    return [m.A11, m.A12, m.A13, m.A14, m.A21, m.A22, m.A23, m.A24, m.A31, m.A32, m.A33, m.A34, 0, 0, 0, 1]
SHARED = {"Case_Base", "Case_Lid", "PCB"} | {f"LidScrew_{j}" for j in range(4)} | {f"LidInsert_{j}" for j in range(4)} | {f"MountScrew_{j}" for j in range(4)} | {"Pod", "OLED", "PodScrew_0", "PodScrew_1"}
def stl(o, shape, tol, name):
    key = re.sub(r"^Clip_\d_", "Clip_0_", re.sub(r"^Tile\d_", "Tile0_", name))   # identical shapes share one file (the matrix places them)
    path = os.path.join(COMMON if o.Name in SHARED else OUT + "/stl", key + ".stl")
    if os.path.exists(path) and (o.Name in SHARED or key != name): return path
    local = shape.copy(); local.Placement = App.Placement()     # the matrix (global placement) carries all translations
    verts, faces = local.tessellate(tol)
    m = Mesh.Mesh(); m.addFacets([[verts[a], verts[b], verts[c]] for a, b, c in faces]); m.write(path)
    return path

cuts = {
    "sec_x": ("x", SX, "le"),                 # through the SiPM: tiles edge-on, coupler, cable, plate, case
    "sec_zcase": ("z", ZC + 4.0, "le"),       # through the case and plate at mid-height (view from above)
    "sec_ztile": ("z", ZS[-1] + 1.0, "le"),   # through the top tile at fiber A (view from above)
}
def half(axis, v, keep):
    big = 2000.0
    lo = {"x": V(v - big, -big, -big), "y": V(-big, v - big, -big), "z": V(-big, -big, v - big)}[axis]
    return Part.makeBox(big, 2 * big, 2 * big, lo) if axis == "x" else (Part.makeBox(2 * big, big, 2 * big, lo) if axis == "y" else Part.makeBox(2 * big, 2 * big, big, lo))

manifest = {"tile": N, "xs": SX, "zc": ZC, "zs": ZS, "hull": HULL, "y_top": YTOP, "y_back_plate": Y_PB, "rods": RODS,
            "plate_x": [px0, px1], "pod_x": POD_X, "case_xc": XC, "groove_cut": groove_ok, "parts": [], "cuts": {k: list(v) for k, v in cuts.items()}}
hal = {k: half(*v) for k, v in cuts.items()} if SECTIONS else {}
for (o, group, color, alpha, tol) in LEAVES:
    ent = {"name": o.Name, "group": group, "color": color, "alpha": alpha, "matrix": gmat(o), "vol": round(o.Shape.Volume, 1), "sec": {}}
    ent["stl"] = stl(o, o.Shape, tol, o.Name)
    if SECTIONS:
        gs = o.Shape.copy(); gs.Placement = o.getGlobalPlacement()
        bb = gs.BoundBox
        for ck, (ax, v, keep) in cuts.items():
            lo, hi = getattr(bb, ax.upper() + "Min"), getattr(bb, ax.upper() + "Max")
            if lo >= v: continue                                    # entirely on the removed side
            if hi <= v: c = gs
            else: c = gs.common(hal[ck])
            if c.isNull() or c.Volume < 1e-3: continue
            p = os.path.join(OUT + "/stl", f"{o.Name}__{ck}.stl")
            vv, ff = c.tessellate(tol * 2)
            mm = Mesh.Mesh(); mm.addFacets([[vv[a], vv[b], vv[c_]] for a, b, c_ in ff]); mm.write(p)
            ent["sec"][ck] = p
    manifest["parts"].append(ent)
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=1)
doc.saveAs(os.path.join(OUT, "station.FCStd"))
if os.environ.get("STEP") == "1":                                   # ~150 MB per tile: on request only (the FCStd is the hierarchical file)
    try:
        import Import
        Import.export([ST], os.path.join(OUT, "station.step"))
    except Exception as e:
        print("STEP export skipped:", e)
print(f"tile {N}: {len(LEAVES)} leaves, plate x {px0:.0f}..{px1:.0f}, rods {[(round(a), round(b)) for a, b in RODS]}, groove {groove_ok}")
