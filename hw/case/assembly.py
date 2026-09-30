# Muon3 tile-stack assembly: sPHENIX inner-HCal tiles (4, 100 mm apart) + one fiber loop each + coating and wrap + SiPM +
# printed ABS frame + the long station board (one channel cell behind each tile) in its three-segment case + micro-coax
# cables, as a hierarchical FreeCAD document.
#
#   TILE=1 freecadcmd hw/case/assembly.py            (1..12; SECTIONS=1 also writes the section solids)
#
# Writes hw/out/assembly/tileNN/{station.FCStd, station.step, manifest.json, stl/*.stl} (+ common/ for the shared board
# and case). manifest.json drives hw/case/render_assembly.py (Blender).
#
# Frame: x along the tile's x (0 = tile bbox xmin), y along the tile's y (0 = bottom edge, 191 = SiPM edge), z up; tile k's
# mid-plane is at z = 100·k. The station board is a long strip behind the SiPM edge: its long axis runs along z (board x = z + 18.5 mm),
# its normal is +y, its parts face away from the tiles, USB-C on the -x side, coax edge on the +x side.
import json, math, os, re, sys
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
CLIP_T, SLOT, WALL, LIP = 12.4, 8.0, 3.5, 4.0     # corner clip: thickness, tile slot, outer wall, lip overlap
ROD_D, BOSS_R, SP_OD, SP_ID = 6.0, 7.0, 12.0, 6.4
Y_FRONT, Y_BACK = -12.0, YTOP + 15.0               # rod rows
PLATE_T, PLATE_H = 5.0, 78.0                        # back plate bar web thickness, height
BARS = [50.0, 150.0, 250.0]                        # bar centre z: in the gaps between tiles, so the four cables pass between the bars
NK = 4
ZS = [PITCH * k for k in range(NK)]
XC = SX                                            # board centre line x
ZC = 150.0

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
body0 = prism(hull_face, -TT / 2, TT / 2)          # flat SiPM edge: both fiber ends are cut flush with it

sys.path.insert(0, os.path.join(HW, "..", "cad", "sphenix_hcal", "scripts"))
from fiber_loop import loop_tokens          # the fiber loop is shared with the Geant4 model (see fiber_loop.py)
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

if P.get("fiber_tokens"):                                          # cached by parse_inner_tile.py (same loop as the Geant4 model)
    tokF = [(t[0], *[tuple(q) for q in t[1:]]) for t in P["fiber_tokens"]]; LOOP = P["fiber_loop"]
else:
    tokF, LOOP = loop_tokens(HULL, SX, YTOP)
groove_ok = True
try:
    body0 = body0.cut(fiber_solid(tokF, 0.0, GROOVE_R))
except Exception as e:
    groove_ok = False; print("groove cut skipped:", e)
fibF = fiber_solid(tokF, 0.0, FIB_R)

# coupler (black ABS block on the SiPM edge: both fiber ends, 0.75 mm air gap, one 3x3 SiPM centred on the pair), SiPM, daughter PCB with U.FL
BX, BW = SX, 16.0
coupler = box(BX - BW / 2, YTOP, -4, BX + BW / 2, YTOP + 6, 4)
coupler = coupler.cut(box(BX - 2.5, YTOP - 0.1, -2.5, BX + 2.5, YTOP + 0.75, 2.5))                  # air gap over the two fiber ends
coupler = coupler.cut(box(BX - 1.9, YTOP + 0.7, -1.9, BX + 1.9, YTOP + 2.8, 1.9))                   # SiPM pocket
sipm = box(BX - 1.5, YTOP + 0.75, -1.5, BX + 1.5, YTOP + 2.25, 1.5)
sipm_pcb = box(BX - 12, YTOP + 6, -6, BX + 12, YTOP + 7.6, 6)
ufl_sipm = box(BX - 1.5, YTOP + 7.6, -1.3, BX + 1.5, YTOP + 8.85, 1.3)                               # U.FL jack, cable plugs in from +y
Y_JACK = YTOP + 8.85

# coating (50 um painted reflector) + wrap (100 um Al foil, 30 um cling film, 100 um black vinyl): shells that follow the tile outline,
# open at the coupler (Aidala et al., IEEE TNS 65 (2018), Table II). Drawn translucent so the fiber shows through.
WRAP = [("Coating", 0.05, (0.97, 0.97, 0.94), 0.45), ("WrapAl", 0.10, (0.80, 0.82, 0.86), 0.35), ("WrapCling", 0.03, (0.88, 0.93, 0.98), 0.12), ("WrapVinyl", 0.10, (0.04, 0.04, 0.05), 0.40)]
def wrap_shell(r0, r1):
    off = lambda d: hull_face.makeOffset2D(d, 2).Faces[0]
    outer = prism(off(r1), -TT / 2 - r1, TT / 2 + r1)
    inner = prism(off(r0) if r0 > 0 else hull_face, -TT / 2 - r0, TT / 2 + r0)
    return outer.cut(inner).cut(box(SX - 9.0, YTOP - 0.5, -3.0, SX + 9.0, YTOP + 1.0, 3.0))
wraps, r_ = [], 0.0
for nm, t, col, al in WRAP:
    wraps.append((nm, wrap_shell(r_, r_ + t), col, al)); r_ += t

tile_parts = []
for k in range(NK):
    tp = part(f"Tile_{k}", TILES, App.Placement(V(0, 0, ZS[k]), App.Rotation()))
    leaf(f"Tile{k}_Body", body0, tp, "tile", COL["tile"], 0.32, 0.1)
    leaf(f"Tile{k}_Fiber", fibF, tp, "tile", COL["fiber"], 1.0, 0.05)
    for nm, shp, col, al in wraps: leaf(f"Tile{k}_{nm}", shp, tp, "wrap", col, al, 0.1)
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
    slot = prism(hull_face.makeOffset2D(0.6, 0).Faces[0], -SLOT / 2, SLOT / 2)      # room for the 0.28 mm wrap each side
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
        if i >= 2:
            segs = [(za, BARS[g] - PLATE_H / 2), (BARS[g] + PLATE_H / 2, zb_)]
        for j, (a, b) in enumerate(segs):
            leaf(f"Spacer_{NAMES[i]}_{g}{'abc'[j]}", cyl(rx, ry, a, b, SP_OD).cut(cyl(rx, ry, a - 1, b + 1, SP_ID)), FRAME, "frame", COL["abs"], 1.0, 0.1)

# back plate: three identical BARS (z = 50, 150, 250, in the gaps between tiles) join the two back rods and carry the case
# segments on M3 heat-set inserts (two per segment per bar). Each bar is one piece when the rod span fits a print bed
# (tiles 1-11); for the widest tile it is two halves joined by a front splice plate (4 x M3x6 socket head into inserts).
(rlx, rly), (rrx, rry) = BACK_RODS
Y_PB = Y_BACK + PLATE_T / 2                                                                     # plate back face
Y_PF = Y_BACK - PLATE_T / 2                                                                     # plate front face
H_B = CASE["board_hw"][1]; W_B = CASE["board_hw"][0]; X_OF_Z0 = 18.5
bx0, bx1 = rlx - 7, rrx + 7
SPLIT = (bx1 - bx0) > 212
xj = 0.5 * (rlx + rrx)
if SPLIT and abs(SX - xj) < 18: xj = SX + (18 if xj >= SX else -18)
def sleeved(shape, rx, ry, z0p, z1p):
    shape = shape.fuse(cyl(rx, ry, z0p, z1p, 14.0))
    return shape.cut(cyl(rx, ry, z0p - PLATE_H, z1p + PLATE_H, 6.4))
ins_shape = lambda hx, y0, y1, hz: cyly(hx, y0, y1, hz, 4.6).cut(cyly(hx, y0 - 0.1, y1 + 0.1, hz, 3.0))
splices = []
for g, zc_ in enumerate(BARS):
    z0p, z1p = zc_ - PLATE_H / 2, zc_ + PLATE_H / 2
    pieces = [("", bx0, bx1, (rlx, rrx))] if not SPLIT else [("L", bx0, xj, (rlx,)), ("R", xj, bx1, (rrx,))]
    mounts = [z for z in CASE["floor_z"] if z0p + 3 < z < z1p - 3]
    for tag, xa, xb, rods_ in pieces:
        bar = box(xa, Y_PF, z0p, xb, Y_PB, z1p)
        for rx in rods_: bar = sleeved(bar, rx, Y_BACK, z0p, z1p)
        if xa <= SX <= xb:
            for z in mounts: bar = bar.cut(cyly(SX, Y_PB - 4.5, Y_PB + 0.1, z, 4.0))
        if SPLIT:
            for sgn in (-1, 1):
                for dz in (-22, 22):
                    hx = xj + sgn * 8
                    if xa <= hx <= xb: bar = bar.cut(cyly(hx, Y_PF - 0.1, Y_PF + 4.5, zc_ + dz, 4.0))
        leaf(f"PlateBar_{g}{tag}", bar.removeSplitter(), FRAME, "plate", COL["abs"], 1.0, 0.1)
        if xa <= SX <= xb:
            for z in mounts: leaf(f"PlateInsertBack_{g}_{int(z)}", ins_shape(SX, Y_PB - 4.0, Y_PB, z), FRAME, "plate", COL["brass"])
    if SPLIT:
        fish = box(xj - 15, Y_PF - 3.0, zc_ - 32, xj + 15, Y_PF, zc_ + 32)
        for sgn in (-1, 1):
            for dz in (-22, 22):
                hx, hz = xj + sgn * 8, zc_ + dz
                fish = fish.cut(cyly(hx, Y_PF - 3.1, Y_PF + 0.1, hz, 3.4))
                leaf(f"SpliceScrew_{g}{'m' if sgn < 0 else 'p'}{'l' if dz < 0 else 'u'}", cyly(hx, Y_PF - 3.0 - 3.0, Y_PF + 3.0, hz, 3.0).fuse(cyly(hx, Y_PF - 6.0, Y_PF - 3.0, hz, 5.5)), FRAME, "plate", COL["screw"])
                leaf(f"PlateInsertFront_{g}_{int(hx)}_{int(hz)}", ins_shape(hx, Y_PF, Y_PF + 4.0, hz), FRAME, "plate", COL["brass"])
        leaf(f"PlateSplice_{g}", fish, FRAME, "plate", COL["abs"], 1.0, 0.1)
px0, px1 = bx0, bx1

# ------------------------------------------------------------------ electronics: case segments, board, screws, inserts
# case frame (X along the board, Y across it, Z from the floor to the lid) -> world: X -> +z (board x = z + 18.5), Y -> +x, Z -> +y
XW0 = SX - H_B / 2
M = App.Matrix(0, 1, 0, XW0, 0, 0, 1, Y_PB, 1, 0, 0, -X_OF_Z0, 0, 0, 0, 1)
ELEC = part("Electronics", ST, App.Placement(M))
for sg in "ABC":
    leaf(f"Case_Base_{sg}", Part.read(os.path.join(HW, "out", "case", f"case_base_{sg}.step")), ELEC, "electronics", COL["abs"], 1.0, 0.1)
    leaf(f"Case_Lid_{sg}", Part.read(os.path.join(HW, "out", "case", f"case_lid_{sg}.step")), ELEC, "electronics", COL["abs"], 1.0, 0.1)
pcb = Part.read(os.path.join(HW, "out", "assembly", "pcb.step"))
pcb.translate(V(0, H_B, CASE["z_board_bottom"]))
leaf("PCB", pcb, ELEC, "electronics", COL["pcb"], 1.0, 0.15)
ZT_ = CASE["z_top"]
for j, h in enumerate(CASE["holes"]):
    X, Yc = h["x"], H_B - h["y"]
    ztop = ZT_ - 3.0
    screw = cyl(X, Yc, ztop - 12, ztop, 3.0).fuse(cyl(X, Yc, ztop, ZT_, 5.5))
    leaf(f"LidScrew_{j}", screw.cut(box(X - 1.2, Yc - 0.6, ZT_ - 1.2, X + 1.2, Yc + 0.6, ZT_ + 0.1)), ELEC, "electronics", COL["screw"])
    leaf(f"LidInsert_{j}", cyl(X, Yc, CASE["z_board_bottom"] - 5.7, CASE["z_board_bottom"], 4.6).cut(cyl(X, Yc, CASE["z_board_bottom"] - 6, CASE["z_board_bottom"] + 1, 3.0)), ELEC, "electronics", COL["brass"])
for j, (bx, by_) in enumerate(CASE["floor_screws_board_xy"]):
    X, Yc = bx, H_B - by_
    zt = CASE["z_floor"]
    leaf(f"MountScrew_{j}", cyl(X, Yc, zt - 6.0, zt, 3.0).fuse(cyl(X, Yc, zt, zt + 3.0, 5.5)), ELEC, "electronics", COL["screw"])   # ISO 4762 M3x6

# external 2.4 GHz FPC antenna on the lid's outer face + U.FL pigtail from the module's U.FL through the lid
ax0, ay0, ax1, ay1 = CASE["antenna_recess"]
leaf("Antenna_FPC", box(ax0 + 0.5, H_B - ay1 + 0.5, ZT_ - 0.5, ax1 - 0.5, H_B - ay0 - 0.5, ZT_ - 0.1), ELEC, "electronics", (0.05, 0.05, 0.06), 1.0, 0.05)
hx_, hy_ = CASE["antenna_hole"]; Yc_ = H_B - hy_
pig = pipe(fillet_wire([(hx_, Yc_, 11.5), (hx_, Yc_, ZT_ + 0.8), (hx_, H_B - 39.0, ZT_ + 0.5), (ax1 - 1.5, H_B - 39.0, ZT_ + 0.45)], 4.0), 0.5)
leaf("Antenna_Pigtail", pig, ELEC, "electronics", COL["cable"], 1.0, 0.05)
leaf("Antenna_Plug", box(hx_ - 1.5, Yc_ - 1.4, 10.4, hx_ + 1.5, Yc_ + 1.4, 12.0), ELEC, "electronics", COL["steel"])
for k, jx in enumerate(CASE["jack_x"]):                                                            # cable plugs on the board's U.FL jacks
    leaf(f"BoardPlug_{k}", box(jx - 1.6, H_B - CASE["jack_y"] - 1.6, CASE["z_board_bottom"] + 1.6 + 1.4, jx + 1.6, H_B - CASE["jack_y"] + 1.6, CASE["z_board_bottom"] + 1.6 + 3.9), ELEC, "electronics", COL["steel"])

# ------------------------------------------------------------------ micro-coax cables: board jack -> notch in the lid skirt -> straight to the tile's SiPM board
# The jack of channel k sits exactly behind tile k's SiPM board, so all four cables are identical (about 75 mm).
CABLES = part("Cables", ST)
for k in range(NK):
    zt = ZS[k]
    y_p = Y_PB + CASE["z_board_bottom"] + 1.6 + 2.7                                    # plug height above the board
    x_j = XW0 + H_B - CASE["jack_y"]                                                   # world x of the jack
    y_s = Y_JACK + 1.7                                                                 # cable height at the tile-side plug
    pts = [(x_j, y_p, zt), (XW0 + H_B + 11.0, y_p, zt), (XW0 + H_B + 11.0, y_s, zt), (SX, y_s, zt)]
    leaf(f"Cable_{k}", pipe(fillet_wire(pts, 9.0), 0.57), CABLES, "cables", COL["cable"], 1.0, 0.05)
    leaf(f"CablePlug_{k}", box(SX - 1.6, Y_JACK, zt - 1.4, SX + 1.6, Y_JACK + 3.4, zt + 1.4), CABLES, "cables", COL["steel"])
doc.recompute()

# ------------------------------------------------------------------ outputs: FCStd, STEP, STL per leaf, manifest
def gmat(o):
    m = o.getGlobalPlacement().toMatrix()
    return [m.A11, m.A12, m.A13, m.A14, m.A21, m.A22, m.A23, m.A24, m.A31, m.A32, m.A33, m.A34, 0, 0, 0, 1]
SHARED = {f"Case_{t}_{sg}" for t in ("Base", "Lid") for sg in "ABC"} | {"PCB"} | {f"LidScrew_{j}" for j in range(len(CASE["holes"]))} | {f"LidInsert_{j}" for j in range(len(CASE["holes"]))} | {f"MountScrew_{j}" for j in range(len(CASE["floor_screws_board_xy"]))} | {"Antenna_FPC", "Antenna_Pigtail", "Antenna_Plug"} | {f"BoardPlug_{k}" for k in range(4)}
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
    "sec_zcase": ("z", 150.0 + 4.0, "le"),    # through the case and plate at the hub (view from above)
    "sec_ztile": ("z", ZS[-1] + 0.3, "le"),   # through the top tile at the fiber (view from above)
}
def half(axis, v, keep):
    big = 2000.0
    lo = {"x": V(v - big, -big, -big), "y": V(-big, v - big, -big), "z": V(-big, -big, v - big)}[axis]
    return Part.makeBox(big, 2 * big, 2 * big, lo) if axis == "x" else (Part.makeBox(2 * big, big, 2 * big, lo) if axis == "y" else Part.makeBox(2 * big, 2 * big, big, lo))

manifest = {"tile": N, "xs": SX, "zc": ZC, "zs": ZS, "hull": HULL, "y_top": YTOP, "y_back_plate": Y_PB, "rods": RODS,
            "plate_x": [px0, px1], "plate_split": SPLIT, "case_xc": XC, "groove_cut": groove_ok, "fiber": LOOP, "parts": [], "cuts": {k: list(v) for k, v in cuts.items()}}
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
if os.environ.get("TILE_STEP") == "1":                              # one tile with its fiber, coating, wrap, coupler and SiPM (a few MB)
    try:
        import Import
        sd = os.path.join(HW, "..", "cad", "sphenix_hcal", "step"); os.makedirs(sd, exist_ok=True)
        Import.export([tile_parts[0]], os.path.join(sd, f"InnerHCalTile{N:02d}_assembly.step"))
    except Exception as e:
        print("tile STEP export skipped:", e)
print(f"tile {N}: {len(LEAVES)} leaves, plate x {px0:.0f}..{px1:.0f}, rods {[(round(a), round(b)) for a, b in RODS]}, groove {groove_ok}")
