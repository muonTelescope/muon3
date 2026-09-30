"""openEMS FDTD: ESP32 Wi-Fi antenna -> AFE input coupling, board inside the ABS case.

Model (mm, board frame from hw/out/board.json, z = 0 at the board underside):
  FR4 1.6 mm (er 4.3, tan d 0.02), L2 GND plane at z 1.39 (pulled back 0.3 mm, open under the BME island); ESP32 metal can
  (grounded); the external antenna of the WROOM-1U: an inverted-L on the lid's outer face (8.4 mm feed from the ground plane
  at the module's U.FL jack + 22 mm arm, lumped 50 ohm port at the plane); U.FL jacks with the tile coax shields (AC-grounded
  through 100 nF) leaving through the case wall; ABS case shell (er 2.8, tan d 0.01).
  Victims: each channel's SIG trace on L1 from the U.FL pin to the OPA356 IN- pin, 50 ohm at the jack end (the coax)
  and a 50 ohm port at the TIA end: |S(k,1)| is the antenna -> TIA-input coupling.
Variants:  none | can (stamped shield frame+lid over each AFE, stitched to L2) | abs (same shape, printed ABS: no metal)
           | none-noisland (as none, but L2 kept solid under the BME island: isolates the island void's effect)
Usage:  python sim/emi_openems.py VARIANT OUTDIR       (~1 M cells, ~0.3 GB; run under tools/memguard.sh)
"""
import json, os, sys
import numpy as np
from CSXCAD import ContinuousStructure
from openEMS import openEMS
from openEMS.physical_constants import EPS0

VARIANT = sys.argv[1] if len(sys.argv) > 1 else "none"
OUT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else ".")
HERE = os.path.dirname(os.path.abspath(__file__))
B = json.load(open(os.path.join(HERE, "..", "out", "board.json")))
W, H, T = B["w"], B["h"], B["thickness"]
parts = {p["ref"]: p for p in B["parts"]}
F0, FC = 2.44e9, 1.2e9
ZP = 1.39                                # L2 plane height (0.21 mm prepreg under L1)
JACK_X = [parts[j]["x"] for j in ("J2", "J3", "J4", "J5")]
OPA = sorted([p for p in B["parts"] if p["value"].startswith("OPA356")], key=lambda p: p["x"])
CMP = sorted([p for p in B["parts"] if p["value"].startswith("LMV7219")], key=lambda p: p["x"])

FDTD = openEMS(NrTS=120000, EndCriteria=1e-4)
FDTD.SetGaussExcite(F0, FC)
FDTD.SetBoundaryCond(["MUR"] * 6)
CSX = ContinuousStructure(); FDTD.SetCSX(CSX)
mesh = CSX.GetGrid(); mesh.SetDeltaUnit(1e-3)
xs, ys, zs = set(), set(), set()
def box(prop, a, b, prio):
    prop.AddBox(a, b, priority=prio); xs.update((a[0], b[0])); ys.update((a[1], b[1])); zs.update((a[2], b[2]))

w_f = 2 * np.pi * F0 * EPS0
fr4 = CSX.AddMaterial("FR4", epsilon=4.3, kappa=w_f * 4.3 * 0.02)
abs_ = CSX.AddMaterial("ABS", epsilon=2.8, kappa=w_f * 2.8 * 0.01)
gnd = CSX.AddMetal("GND")
box(fr4, [0, 0, 0], [W, H, T], 1)

# ---- L2 plane: board minus antenna keepout (x > 77.6, y 20..42) and the island's no-plane rect ----
E = 0.3
box(gnd, [E, E, ZP], [W - E, H - E, ZP], 5)              # solid L2 (the WROOM-1U has no PCB antenna, so no keep-out)
# thermal-island plane voids: FR4 at higher priority overrides the sheet there
if "noisland" not in VARIANT:
    for r in B.get("noPlane", []):
        box(fr4, [r["x0"], r["y0"], ZP - 0.1], [r["x1"], r["y1"], ZP + 0.1], 6)

# ---- ESP32-S3-WROOM can (18 x ~19 mm, 3.1 mm tall), walls stitched to L2 ----
u = parts["U1"]
cx0, cx1, cy0, cy1, ztop = u["x0"] + 0.4, 92.3 - 3.0, u["y0"] + 0.8, u["y1"] - 0.8, T + 3.1   # the can has a corner notch round the U.FL jack at (92.3, 51.0)
box(gnd, [cx0, cy0, ztop], [cx1, cy1, ztop], 6)
for a, b in (([cx0, cy0, ZP], [cx1, cy0, ztop]), ([cx0, cy1, ZP], [cx1, cy1, ztop]),
             ([cx0, cy0, ZP], [cx0, cy1, ztop]), ([cx1, cy0, ZP], [cx1, cy1, ztop])):
    box(gnd, a, b, 6)

# ---- inverted-F antenna in the keepout (on the ground layer's level, like the module's own PCB antenna) ----
AX, AY, ZA = 92.3, 51.0, 9.7                       # the module's U.FL jack (board x, y) and the lid's outer face
ARM = float(os.environ.get("ARM", 19.5))            # inverted-L: 8.4 mm feed + ARM mm along the lid, ~ lambda/4 at 2.44 GHz
box(gnd, [AX - 0.5, AY - 0.5, ZP + 1.0], [AX + 0.5, AY + 0.5, ZA], 7)            # pigtail centre conductor up through the lid hole
box(gnd, [AX - ARM, AY - 0.5, ZA - 0.2], [AX + 0.5, AY + 0.5, ZA], 7)             # the FPC antenna on the lid's outer face
ant = FDTD.AddLumpedPort(1, 50, [AX - 0.5, AY - 0.5, ZP], [AX + 0.5, AY + 0.5, ZP + 1.0], "z", excite=1.0, priority=8)
xs.update((AX - 0.5, AX + 0.5)); ys.update((AY - 0.5, AY + 0.5)); zs.update((ZP + 1.0, ZA))

# ---- U.FL jacks + tile coax: the shield (AC-grounded by 100 nF at the jack) leaves through the case wall and runs
#      to the absorbing boundary, i.e. a long cable that can pick up Wi-Fi as a common-mode antenna ----
JY = parts["J2"]["y"]
for x in JACK_X:
    box(gnd, [x - 0.6, JY - 1.2, ZP], [x + 0.6, JY - 0.6, T + 1.4], 6)          # shell pads + 100 nF -> plane
    box(gnd, [x - 0.3, -3.0 - 18, T + 1.0], [x + 0.3, JY - 0.6, T + 1.4], 6)    # Ø1.37 coax shield, out to the boundary

# ---- victims: SIG trace, 50 ohm at the jack, port at the TIA input ----
ports = []
for k, (xj, op) in enumerate(zip(JACK_X, OPA)):
    xo, yo = op["x0"] + 0.3, op["y"]
    tw = 0.4
    y0v = JY + 1.3                                                            # U.FL centre pin
    box(gnd, [xj - tw / 2, y0v, T], [xj + tw / 2, yo + tw / 2, T], 7)
    box(gnd, [min(xj, xo) - tw / 2, yo - tw / 2, T], [max(xj, xo) + tw / 2, yo + tw / 2, T], 7)
    CSX.AddLumpedElement(f"Rjack{k}", ny="z", caps=True, R=50).AddBox([xj - tw / 2, y0v, ZP], [xj + tw / 2, y0v + tw, T], priority=8)
    zs.update((ZP, T))
    ports.append(FDTD.AddLumpedPort(2 + k, 50, [xo - tw / 2, yo - tw / 2, ZP], [xo + tw / 2, yo + tw / 2, T], "z", priority=8))
    xs.update((xo - tw / 2, xo + tw / 2)); ys.update((yo - tw / 2, yo + tw / 2))

# ---- AFE enclosure variant: can (metal) or printed ABS cavity, over OPA + comparator + feedback ----
if VARIANT in ("can", "abs"):
    mat = gnd if VARIANT == "can" else abs_
    for op, cm in zip(OPA, CMP):
        x0, x1 = min(op["x0"], cm["x0"]) - 2.0, max(op["x1"], cm["x1"]) + 2.5
        y0, y1, zt = JY + 2.2, max(op["y1"], cm["y1"]) + 1.5, T + 2.5
        t = 0.2 if VARIANT == "can" else 1.0
        zb = ZP if VARIANT == "can" else T                                # can walls are stitched down to L2
        box(mat, [x0, y0, zt - (0 if VARIANT == "can" else t)], [x1, y1, zt], 9)
        box(mat, [x0, y1 - (0 if VARIANT == "can" else t), zb], [x1, y1, zt], 9)
        box(mat, [x0, y0, zb], [x0 + (0 if VARIANT == "can" else t), y1, zt], 9)
        box(mat, [x1 - (0 if VARIANT == "can" else t), y0, zb], [x1, y1, zt], 9)
        # jack-side wall with a 1.2 x 0.3 mm notch where the SIG trace passes (real frames have these)
        xj = JACK_X[OPA.index(op)]
        box(mat, [x0, y0, zb], [xj - 0.6, y0 + (0 if VARIANT == "can" else t), zt], 9)
        box(mat, [xj + 0.6, y0, zb], [x1, y0 + (0 if VARIANT == "can" else t), zt], 9)
        box(mat, [xj - 0.6, y0, T + 0.3], [xj + 0.6, y0 + (0 if VARIANT == "can" else t), zt], 9)

# ---- ABS case shell (outer 90 x 56 x 16.5, walls 2.4, board underside 7.0 above the outer floor) ----
cz0, cz1 = -7.0, 16.5 - 7.0
cxa, cya, cxb, cyb, wl = -3.0, -3.0, W + 3.0, H + 3.0, 2.4   # case.py: WALL 2.4 + GAP 0.6
for a, b in (([cxa, cya, cz0], [cxb, cyb, cz0 + wl]), ([cxa, cya, cz1 - 2.5], [cxb, cyb, cz1]),
             ([cxa, cya, cz0], [cxa + wl, cyb, cz1]), ([cxb - wl, cya, cz0], [cxb, cyb, cz1]),
             ([cxa, cya, cz0], [cxb, cya + wl, cz1]), ([cxa, cyb - wl, cz0], [cxb, cyb, cz1])):
    box(abs_, a, b, 0)

# ---- field map just above the parts ----
CSX.AddDump("Ef", dump_type=10, file_type=1, frequency=[F0]).AddBox([-3, -3, T + 1.2], [W + 3, H + 3, T + 1.2])

# ---- mesh: feature edges + 1 mm max in the board, graded to ~λ/15 in air ----
M = 18
xs.update(np.arange(-3, W + 3.01, 1.0)); ys.update(np.arange(-3, H + 3.01, 1.0))
xs.update((-3 - M, W + 3 + M)); ys.update((-3 - M, H + 3 + M)); zs.update((cz0 - M, cz1 + M, 0, T, T + 1.0, T + 1.4, T + 2.5, T + 3.1, cz0, cz1))
zs.update(np.arange(0, T + 0.01, 0.4))
def dedupe(v, tol):  # lines closer than tol collapse to one (tiny cells would shrink the FDTD timestep)
    out = []
    for q in sorted(round(x, 3) for x in v):
        if not out or q - out[-1] >= tol: out.append(q)
    return out
for d, s, tol in (("x", xs, 0.15), ("y", ys, 0.15), ("z", zs, 0.18)):
    mesh.AddLine(d, dedupe(s, tol))
mesh.SmoothMeshLines("x", 1.0, 1.4); mesh.SmoothMeshLines("y", 1.0, 1.4); mesh.SmoothMeshLines("z", 1.0, 1.4)
n = [len(mesh.GetLines(d)) for d in "xyz"]
dmin = [float(np.min(np.diff(mesh.GetLines(d)))) for d in "xyz"]
print(f"[{VARIANT}] mesh {n[0]}x{n[1]}x{n[2]} = {np.prod(n)/1e6:.2f} M cells, min cell {min(dmin):.3f} mm", flush=True)

if os.environ.get("DRY"): sys.exit(0)
sim = os.path.join(OUT, "emi_" + VARIANT)
os.makedirs(sim, exist_ok=True)
FDTD.Run(sim, cleanup=True, verbose=0, numThreads=2)

f = np.linspace(1.8e9, 3.0e9, 121)
ant.CalcPort(sim, f)
for p in ports: p.CalcPort(sim, f)
s11 = ant.uf_ref / ant.uf_inc
p_acc = 0.5 * (np.abs(ant.uf_inc) ** 2 - np.abs(ant.uf_ref) ** 2) / 50
res = {"variant": VARIANT, "f": f.tolist(), "s11_db": (20 * np.log10(np.abs(s11))).tolist()}
i0 = int(np.argmin(np.abs(f - F0)))
for k, p in enumerate(ports):
    v = np.abs(p.uf_tot)                                        # victim port voltage (peak) per excitation
    res[f"s{k+2}1_db"] = (20 * np.log10(np.abs(p.uf_ref / ant.uf_inc))).tolist()
    res[f"v_tia{k}_mV_at_100mW"] = float(v[i0] * np.sqrt(0.1 / p_acc[i0]) * 1e3)   # ESP32 +20 dBm accepted
print(json.dumps({k: (round(v, 3) if isinstance(v, float) else v) for k, v in res.items() if k.startswith("v_")}))
res["s11_at_f0_db"] = res["s11_db"][i0]
json.dump(res, open(os.path.join(OUT, f"emi_{VARIANT}.json"), "w"))
