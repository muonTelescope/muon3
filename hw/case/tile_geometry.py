"""Exact detector tile geometry reused by modular_v2.py.
Derived from assembly.py. Dimensions and fiber tokens remain sourced from the
same Geant4 mesh metadata. Nonprinted tile/wrap/SiPM components only.
"""
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
OUT = os.path.join(HW, "out", "assembly", "modular_v2", f"tile{N:02d}")
COMMON = os.path.join(HW, "out", "assembly", "modular_v2", "common")
for d in (OUT + "/stl", COMMON):
    os.makedirs(d, exist_ok=True)
P = json.load(open(os.path.join(HW, "..", "sim", "geant4", "gdml", "mesh", f"InnerHCalTile{N:02d}_EJ200_mesh.json")))["params"]


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
    # Identical detector layers share optical solids through native App::Link.
    # Separate links keep the body/fiber/wrap material assignments in manifests.
    first = re.sub(r"^Tile[1-3]_", "Tile0_", name)
    source = doc.getObject(first) if first != name else None
    if source is not None:
        o = doc.addObject("App::Link", name); o.setLink(source)
        o.LinkPlacement = App.Placement()
    else:
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

