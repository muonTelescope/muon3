"""Geometry study: three matching inner-HCal tiles stacked as a muon telescope, every permutation.

For each of the 12 tile shapes, each tile spacing and each way of turning the second and third tile (identity, rotated 180 deg,
mirrored left-right, mirrored top-bottom; tile 1 is fixed), count the cosmic muons that cross all three tiles. A muon that crosses
all three must cross the top tile, so rays start uniformly on the top tile with the sea-level angular law I(theta) = I_v cos^2(theta)
(rate through a horizontal area: weight cos^3(theta)) and are followed down to tiles 2 and 3.

Output per configuration: triple-coincidence rate, mean zenith angle and zenith spread of the accepted muons (a proxy for how well
the stack defines a direction), and the azimuthal asymmetry (length of the mean horizontal direction: 0 = symmetric in azimuth).
Assumptions: I_v = 70 m^-2 s^-1 sr^-1 (sea level), tile efficiency 1 (Geant4: every muon that crosses passes 5 p.e.), no scattering.

Usage:  python sim/python/stack_permutations.py [OUT.csv] [OUT.png]
"""
import csv, itertools, json, math, os, sys
import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
IV = 0.0070                                   # cm^-2 s^-1 sr^-1, vertical intensity at sea level
PITCHES = (50.0, 100.0, 150.0, 200.0)         # mm between tile mid-planes
ORIENT = {"id": (1, 1), "rot180": (-1, -1), "mirX": (-1, 1), "mirY": (1, -1)}
N = 200_000
rng = np.random.default_rng(1)

def hull(n):
    P = json.load(open(os.path.join(ROOT, "sim", "geant4", "gdml", "mesh", f"InnerHCalTile{n:02d}_EJ200_mesh.json")))["params"]
    h = np.array(P["hull_xy"], float); c = 0.5 * (h.min(0) + h.max(0))
    return h - c                               # counter-clockwise: bl, br, tr, tl, centred on the bounding box

def inside(poly, x, y):
    ok = np.ones(x.shape, bool)
    for i in range(len(poly)):
        (ax, ay), (bx, by) = poly[i], poly[(i + 1) % len(poly)]
        ok &= (bx - ax) * (y - ay) - (by - ay) * (x - ax) >= 0
    return ok

def area(poly):
    x, y = poly[:, 0], poly[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1)))

def sample_top(poly, n):
    x0, y0 = poly.min(0); x1, y1 = poly.max(0); out = []
    while sum(len(o) for o in out) < n:
        x = rng.uniform(x0, x1, 2 * n); y = rng.uniform(y0, y1, 2 * n); m = inside(poly, x, y); out.append(np.c_[x[m], y[m]])
    return np.vstack(out)[:n]

rows = []
for shape in range(1, 13):
    base = hull(shape); A = area(base) / 100.0            # cm^2
    pts = sample_top(base, N)
    cost = (1 - rng.uniform(size=N)) ** 0.25               # cos(theta): pdf cos^3 sin
    cost = np.maximum(cost, 0.26)                          # drop the last 0.5 % beyond 75 degrees
    sint = np.sqrt(1 - cost ** 2); phi = rng.uniform(0, 2 * np.pi, N)
    dx, dy = sint / cost * np.cos(phi), sint / cost * np.sin(phi)   # horizontal shift per unit of height
    for p in PITCHES:
        for o1, o2 in itertools.product(ORIENT, repeat=2):
            ok = np.ones(N, bool)
            for k, o in ((1, o1), (2, o2)):
                sx, sy = ORIENT[o]; poly = base * np.array([sx, sy])
                if sx * sy < 0: poly = poly[::-1]                # mirrored polygons must stay counter-clockwise
                ok &= inside(poly, pts[:, 0] + k * p * dx, pts[:, 1] + k * p * dy)
            f = ok.mean()
            th = np.arccos(cost[ok]) if ok.any() else np.array([0.0])
            asym = float(np.hypot(np.mean(np.cos(phi[ok])), np.mean(np.sin(phi[ok])))) if ok.any() else 0.0
            rate = IV * A * (math.pi / 2) * f * 3600      # per hour
            rows.append(dict(shape=shape, pitch_mm=p, tile2=o1, tile3=o2, area_cm2=round(A), accept_frac=f, rate_per_h=rate,
                             mean_zenith_deg=math.degrees(th.mean()), zenith_spread_deg=math.degrees(th.std()), azimuth_asym=asym))

out_csv = sys.argv[1] if len(sys.argv) > 1 else "stack_permutations.csv"
with open(out_csv, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)

# Pareto front: more counts AND a sharper direction
R = np.array([[r["rate_per_h"], r["zenith_spread_deg"]] for r in rows])
front = [i for i in range(len(rows)) if not np.any((R[:, 0] >= R[i, 0]) & (R[:, 1] <= R[i, 1]) & ((R[:, 0] > R[i, 0]) | (R[:, 1] < R[i, 1])))]
print(f"{len(rows)} configurations, {len(front)} on the Pareto front (rate up, zenith spread down)")
print("shape pitch tile2   tile3   rate/h  zenith<>  spread  asym")
for i in sorted(front, key=lambda i: -R[i, 0])[:14]:
    r = rows[i]; print(f"{r['shape']:>5} {r['pitch_mm']:>5.0f} {r['tile2']:<7} {r['tile3']:<7} {r['rate_per_h']:>6.0f}  {r['mean_zenith_deg']:>6.1f}  {r['zenith_spread_deg']:>6.1f}  {r['azimuth_asym']:.2f}")

try:
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(8.5, 5.2), dpi=160)
    sc = ax.scatter(R[:, 1], R[:, 0], c=[r["shape"] for r in rows], s=10, cmap="turbo", alpha=.7)
    fr = sorted(front, key=lambda i: R[i, 1]); ax.plot(R[fr, 1], R[fr, 0], "k-", lw=1.2, label="Pareto front")
    ax.set_yscale("log"); ax.set_xlabel("zenith spread of accepted muons (deg): smaller = sharper direction")
    ax.set_ylabel("triple coincidences per hour (sea level)"); ax.grid(alpha=.3); ax.legend()
    fig.colorbar(sc, label="tile shape"); fig.tight_layout()
    fig.savefig(sys.argv[2] if len(sys.argv) > 2 else "stack_permutations.png")
except Exception as e:
    print("plot skipped:", e)
