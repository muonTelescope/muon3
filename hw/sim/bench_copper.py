"""Bench board copper as data, shared by the bench simulations (hw/sim/bench_*.py).

Reads hw/out/bench/board.json (written by `bun src/bench/build.ts`): tracks (segments, mm, board frame y down), vias, pads,
parts. Stack-up = hw/src/kicad_stackup.txt (JLC04161H-7628 class):
  L1 35 um | prepreg 0.2104 | L2 15.2 um (solid GND) | core 1.065 | L3 15.2 um | prepreg 0.2104 | L4 35 um
"""
import json, math, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
B = json.load(open(os.path.join(HERE, "..", "out", "bench", "board.json")))
DOCS = os.path.join(HERE, "..", "docs", "bench")
OUT = os.path.join(HERE, "..", "out", "bench", "sim")
os.makedirs(OUT, exist_ok=True)

RHO_CU = 1.72e-8                       # ohm m, 20 C
T_CU = [35e-6, 15.2e-6, 15.2e-6, 35e-6]                 # copper thickness per layer, m
Z_CU = [1.5654, 1.3398, 0.2350, 0.0]                    # copper bottom face height above the board underside, mm (+ t)
ER_PREPREG, ER_CORE = 4.4, 4.6                          # 7628 prepreg, core (JLC quotes 4.4–4.6 at 1 GHz)
LAYER = ["L1", "L2", "L3", "L4"]
PARTS = {p["ref"]: p for p in B["parts"]}

def seglen(t): return math.dist(t["a"], t["b"])

def by_net():
    n = collections.defaultdict(lambda: {"tracks": [], "vias": [], "pads": []})
    for t in B["tracks"]: n[t["net"]]["tracks"].append(t)
    for v in B["vias"]: n[v["net"]]["vias"].append(v)
    for p in B["pads"]: n[p["net"]]["pads"].append(p)
    return n

def in_poly(x, y, poly, tol=0.0):
    """Point in polygon (ray casting), or within tol of its bounding box when tol > 0 (pads are near-rectangular)."""
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    if tol and min(xs) - tol <= x <= max(xs) + tol and min(ys) - tol <= y <= max(ys) + tol: return True
    inside, j = False, len(poly) - 1
    for i in range(len(poly)):
        (xi, yi), (xj, yj) = poly[i], poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: inside = not inside
        j = i
    return inside

def pad_layers(p): return {"top": [0], "bottom": [3], "multi": [0, 1, 2, 3]}[p["layer"]]

def graph(net):
    """Resistive graph of one net: nodes (layer, x, y) merged at pads and vias; edges = track pieces split at every
    junction. Returns (edges [(n1, n2, R_ohm, track)], node_of_pad {(ref, num): node})."""
    d = by_net()[net]
    # junctions: the router joins copper by overlap, so an end that lies inside another segment's copper (within the wider
    # half-width of its centreline) splits that segment there and is linked to the split point
    segs = [t for t in d["tracks"] if math.dist(t["a"], t["b"]) > 1e-9]
    splits = collections.defaultdict(set); links = []
    for s_ in segs:
        for e in (s_["a"], s_["b"]):
            for t in segs:
                if t is s_ or t["layer"] != s_["layer"]: continue
                (ax, ay), (bx, by) = t["a"], t["b"]; L2 = (bx - ax) ** 2 + (by - ay) ** 2
                u = max(0.0, min(1.0, ((e[0] - ax) * (bx - ax) + (e[1] - ay) * (by - ay)) / L2))
                q = (ax + u * (bx - ax), ay + u * (by - ay))
                if math.dist(q, e) <= max(s_["w"], t["w"]) / 2:
                    if 0 < u < 1: splits[id(t)].add(u)
                    if math.dist(q, e) > 1e-6: links.append((t["layer"], tuple(e), q))
    pieces = []
    for t in segs:
        (ax, ay), (bx, by) = t["a"], t["b"]
        ts = sorted({0.0, 1.0} | splits[id(t)])
        for u0, u1 in zip(ts, ts[1:]):
            if u1 - u0 > 1e-9: pieces.append((t, (ax + u0 * (bx - ax), ay + u0 * (by - ay)), (ax + u1 * (bx - ax), ay + u1 * (by - ay))))
    # node identity: a pad or a via swallows the points inside it; other points snap together within SNAP on their layer
    # (the router's smoothing leaves joints a few um apart, so exact keys would cut the net into islands)
    SNAP = 0.03
    seen = collections.defaultdict(list)                   # (layer, cell) -> [(x, y, key)]
    def node(layer, x, y, w=0.0):
        for p in d["pads"]:
            if layer in pad_layers(p) and in_poly(x, y, p["poly"], tol=max(0.03, w / 2)): return ("pad", p["ref"], p["num"])
        for v in d["vias"]:
            if math.hypot(v["x"] - x, v["y"] - y) <= v["d"] / 2 + 0.03: return ("via", round(v["x"], 3), round(v["y"], 3))
        cx, cy = int(x // SNAP), int(y // SNAP)
        for i in (-1, 0, 1):
            for j in (-1, 0, 1):
                for (qx, qy, k) in seen[(layer, cx + i, cy + j)]:
                    if math.hypot(qx - x, qy - y) <= SNAP: return k
        k = ("pt", layer, round(x, 4), round(y, 4)); seen[(layer, cx, cy)].append((x, y, k))
        return k
    edges = []
    for t, a, b in pieces:
        R = RHO_CU * math.dist(a, b) * 1e-3 / (t["w"] * 1e-3 * T_CU[t["layer"]])
        edges.append((node(t["layer"], *a, t["w"]), node(t["layer"], *b, t["w"]), R, t))
    for layer, e, q in links: edges.append((node(layer, *e), node(layer, *q), 1e-6, None))   # overlap joint
    for v in d["vias"]:                                    # a via inside / touching a pad (via-in-pad) joins it
        for p in d["pads"]:
            if p["layer"] in ("top", "bottom", "multi") and in_poly(v["x"], v["y"], p["poly"], tol=v["d"] / 2):
                edges.append((("via", round(v["x"], 3), round(v["y"], 3)), ("pad", p["ref"], p["num"]), 1e-6, None))
    return edges, {(p["ref"], p["num"]): ("pad", p["ref"], p["num"]) for p in d["pads"]}

# ── transmission-line estimates (Hammerstad–Jensen microstrip; L3/L4 have no plane next to them) ──
def microstrip(w, h, er, t=35e-3):
    """Z0 (ohm), eps_eff, C per length (pF/mm) of a microstrip of width w over a plane at height h (mm)."""
    u = w / h
    ee = (er + 1) / 2 + (er - 1) / 2 * (1 + 12 / u) ** -0.5
    z = 60 / math.sqrt(ee) * math.log(8 / u + u / 4) if u <= 1 else 120 * math.pi / (math.sqrt(ee) * (u + 1.393 + 0.667 * math.log(u + 1.444)))
    c = math.sqrt(ee) / (2.998e8 * z) * 1e9                # F/m -> pF/mm
    return z, ee, c

def ref_height(layer):
    """Height from a layer to its nearest PLANE (only L2 is a plane), mm, and the dielectric between."""
    return {0: (0.2104, ER_PREPREG), 2: (1.065, ER_CORE), 3: (1.065 + 0.2104 + 0.0152, ER_CORE)}[layer]
