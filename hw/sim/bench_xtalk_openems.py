"""openEMS FDTD check of the crosstalk screen (bench_traces.py) on the real routed copper.

Model (mm, board frame from out/bench/board.json, z = 0 at the board underside): a rectangular crop of the board with the
aggressor and victim nets' copper as zero-thickness sheets on their layers (L1 1.6, L3 0.25, L4 0.0), vias as square posts,
the L2 GND plane (z 1.35) as a full sheet with a clearance hole at every via, FR4 (er 4.4, tan d 0.02) 0 – 1.6, air above
and below, PML all round. Every point where a net leaves the crop gets a 50 ohm lumped port to the plane (the line runs on
from there). The aggressor's first port is excited (Gaussian, 0 – 3 GHz).
Result: mutual capacitance Cm(f) = |I_victim,1 + I_victim,2| / (2 pi f |V_aggressor|): the displacement current that the
aggressor's edge pushes into the victim node (the inductive part circulates between the victim ports and cancels in the
sum). Compared with the screen's estimate for the same crop.

The CSXCAD Python bindings on this machine segfault (extension built against an older libCSXCAD), so this script writes the
openEMS XML itself (same property layout as openEMS/ports.py LumpedPort) and runs the openEMS binary.
Usage: python3 sim/bench_xtalk_openems.py VICTIM AGGRESSOR x0 y0 x1 y1 [res_mm] [outdir]
       e.g. INJ HIT3 72 49 93 67   (~1.5 M cells, ~0.3 GB; run under tools/memguard.sh)
       python3 sim/bench_xtalk_openems.py --selftest   (two parallel L1 lines, compared with a 2-D field solution)
"""
import json, math, os, subprocess, sys
import numpy as np
from bench_copper import B, OUT

ZL = {0: 1.6, 2: 0.25, 3: 0.0}; ZP = 1.35; T = 1.6; AIR = 3.0; MARGIN = 4.0
F0, FC = 1.5e9, 1.5e9
EPS0 = 8.854e-12

def clip(a, b, box):
    """Liang–Barsky clip of segment a-b to box; returns (a', b', a_on_edge, b_on_edge) or None."""
    X0, Y0, X1, Y1 = box
    (x0, y0), (x1, y1) = a, b; dx, dy = x1 - x0, y1 - y0; t0, t1 = 0.0, 1.0
    for p, q in ((-dx, x0 - X0), (dx, X1 - x0), (-dy, y0 - Y0), (dy, Y1 - y0)):
        if p == 0:
            if q < 0: return None
            continue
        r = q / p
        if p < 0: t0 = max(t0, r)
        else: t1 = min(t1, r)
        if t0 > t1: return None
    return (x0 + t0 * dx, y0 + t0 * dy), (x0 + t1 * dx, y0 + t1 * dy), t0 > 0, t1 < 1

def seg_poly(a, b, w):
    (ax, ay), (bx, by) = a, b; L = math.hypot(bx - ax, by - ay) or 1e-9
    nx, ny = -(by - ay) / L * w / 2, (bx - ax) / L * w / 2
    ex, ey = (bx - ax) / L * w / 2, (by - ay) / L * w / 2         # square-ish end caps so joints overlap
    return [(ax - ex + nx, ay - ey + ny), (bx + ex + nx, by + ey + ny), (bx + ex - nx, by + ey - ny), (ax - ex - nx, ay - ey - ny)]

# ── XML writer (CSXCAD / openEMS file format) ──
def _f(v): return f"{v:.6g}"
def _box(p1, p2, prio=0):
    return (f'<Box Priority="{prio}"><P1 X="{_f(p1[0])}" Y="{_f(p1[1])}" Z="{_f(p1[2])}"/>'
            f'<P2 X="{_f(p2[0])}" Y="{_f(p2[1])}" Z="{_f(p2[2])}"/></Box>')
def _poly(pts, z, prio):
    v = "".join(f'<Vertex X1="{_f(x)}" X2="{_f(y)}"/>' for x, y in pts)
    return f'<Polygon Priority="{prio}" Elevation="{_f(z)}" NormDir="2" CoordSystem="0">{v}</Polygon>'

class Model:
    def __init__(self):
        self.fr4, self.cu, self.extra, self.ports = [], [], [], []
    def port(self, x, y, z0, z1, half, along, excite):
        """50 ohm lumped port along z from z0 to z1 at (x, y) (openEMS/ports.py LumpedPort layout). It spans +-half across the
        strip (along = "x" or "y") and has zero width the other way, which must sit on a mesh line: a box that snaps to zero
        area in both directions leaves the current probe without a loop."""
        n = len(self.ports) + 1; d = 1.0 if z1 > z0 else -1.0
        hx, hy = (half, 0.0) if along == "x" else (0.0, half)
        p1, p2 = (x - hx, y - hy, z0), (x + hx, y + hy, z1)
        zm = (z0 + z1) / 2
        s = [f'<LumpedElement Name="port_resist_{n}" Direction="2" Caps="1" R="50"><Primitives>{_box(p1, p2, 12)}</Primitives></LumpedElement>']
        if excite:
            s.append(f'<Excitation Name="port_excite_{n}" Type="0" Excite="0,0,{_f(-d)}"><Primitives>{_box(p1, p2, 12)}</Primitives></Excitation>')
        s.append(f'<ProbeBox Name="port_ut_{n}" Type="0" Weight="-1"><Primitives>{_box((x, y, z0), (x, y, z1))}</Primitives></ProbeBox>')
        s.append(f'<ProbeBox Name="port_it_{n}" Type="1" Weight="{_f(d)}" NormDir="2"><Primitives>{_box((p1[0], p1[1], zm), (p2[0], p2[1], zm))}</Primitives></ProbeBox>')
        self.extra += s; self.ports.append(n); return n
    def write(self, path, xs, ys, zs, nts=200000):
        kappa = 2 * math.pi * 1e9 * EPS0 * 4.4 * 0.02
        lines = lambda v: ",".join(_f(x) for x in v)
        x = (f'<?xml version="1.0" encoding="UTF-8"?>\n<openEMS>\n'
             f'<FDTD NumberOfTimesteps="{nts}" endCriteria="1e-4" f_max="{_f(F0 + FC)}" OverSampling="4">'
             f'<Excitation Type="0" f0="{_f(F0)}" fc="{_f(FC)}"/>'
             f'<BoundaryCond xmin="PML_8" xmax="PML_8" ymin="PML_8" ymax="PML_8" zmin="PML_8" zmax="PML_8"/></FDTD>\n'
             f'<ContinuousStructure CoordSystem="0"><Properties>\n'
             f'<Material Name="FR4"><Property Epsilon="4.4" Kappa="{_f(kappa)}"/><Primitives>{"".join(self.fr4)}</Primitives></Material>\n'
             f'<Metal Name="cu"><Primitives>{"".join(self.cu)}</Primitives></Metal>\n'
             + "\n".join(self.extra) +
             f'\n</Properties><RectilinearGrid DeltaUnit="0.001" CoordSystem="0">'
             f'<XLines>{lines(xs)}</XLines><YLines>{lines(ys)}</YLines><ZLines>{lines(zs)}</ZLines></RectilinearGrid>'
             f'</ContinuousStructure>\n</openEMS>\n')
        open(path, "w").write(x)

def grade(lo, hi, res, grow=1.3, cap=0.6):
    """Uniform ~res inside [lo, hi] with lines exactly on lo and hi, cells growing by `grow` (to `cap`) out to MARGIN beyond."""
    core = list(np.linspace(lo, hi, max(2, int(round((hi - lo) / res)) + 1)))
    out, x, s = [], lo, res
    while x > lo - MARGIN: s = min(s * grow, cap); x -= s; out.append(x)
    x, s = core[-1], res
    while x < hi + MARGIN: s = min(s * grow, cap); x += s; out.append(x)
    return sorted(core + out)

def zlines(res_z):
    zs = list(np.linspace(0, 0.25, 4)) + list(np.linspace(0.25, ZP, 9)) + list(np.linspace(ZP, T, 4))
    x, s = 0.0, res_z
    while x > -AIR: s = min(s * 1.4, 0.8); x -= s; zs.append(x)
    x, s = T, res_z
    while x < T + AIR: s = min(s * 1.4, 0.8); x += s; zs.append(x)
    return np.unique(np.round(zs, 5))

def run(sim, M, xs, ys, zs):
    os.makedirs(sim, exist_ok=True)
    for fn in os.listdir(sim):
        if fn.startswith("port_"): os.remove(os.path.join(sim, fn))
    xml = os.path.join(sim, "model.xml"); M.write(xml, xs, ys, zs)
    n = len(xs) * len(ys) * len(zs)
    print(f"mesh {len(xs)} x {len(ys)} x {len(zs)} = {n / 1e6:.2f} M cells", flush=True)
    r = subprocess.run(["openEMS", "model.xml", "--engine=multithreaded", "--numThreads=4"], cwd=sim, capture_output=True, text=True)
    tail = (r.stdout + r.stderr).strip().splitlines()
    print("\n".join(tail[-6:]))
    if r.returncode: sys.exit(f"openEMS exit {r.returncode}")

def load(sim, name):
    d = np.loadtxt(os.path.join(sim, name), comments="%")
    return d[:, 0], d[:, 1]

def dft(t, v, f):
    """Same as openEMS utilities.DFT_time2freq: sum v exp(-j w t) dt, times 2."""
    dt = t[1] - t[0]
    return 2 * dt * (np.exp(-2j * np.pi * np.outer(f, t)) @ v)

def port_vi(sim, n, f):
    tu, u = load(sim, f"port_ut_{n}"); ti, i = load(sim, f"port_it_{n}")
    return dft(tu, u, f), dft(ti, i, f)

def cm_from(sim, agg_ports, vic_ports, f):
    Va = np.mean([np.abs(port_vi(sim, n, f)[0]) for n in agg_ports], axis=0)
    Iv = np.abs(sum(port_vi(sim, n, f)[1] for n in vic_ports))
    return Iv / (2 * np.pi * f * Va)

# ── self-test: two parallel L1 lines over L2, analytic-ish reference from a 2-D Laplace solve ──
def laplace_cm(w, s, h, er, dx=None, side=4.0, top=4.0):
    """Mutual capacitance per length (F/m) of two zero-thickness strips (width w, gap s) at height h over a plane,
    dielectric er below the strips, air above, grounded box `side` mm beyond the strips and `top` mm above them.
    2-D finite differences, red-black SOR; charge on the victim (held at 0 V) from the discrete Gauss law."""
    dx = dx or w / 10
    W = 2 * (w + s) + 2 * side; nx = int(round(W / dx)) + 1; ny = int(round((h + top) / dx)) + 1; jh = int(round(h / dx))
    x = (np.arange(nx) - (nx - 1) / 2) * dx
    a_ = np.abs(x + (s + w) / 2) <= w / 2 + 1e-9; v_ = np.abs(x - (s + w) / 2) <= w / 2 + 1e-9
    erow = np.where(np.arange(ny) < jh, er, 1.0)                    # permittivity of the cell row between y_j and y_j+1
    aN = erow[:, None] * np.ones((1, nx)); aS = np.concatenate([erow[:1], erow[:-1]])[:, None] * np.ones((1, nx))
    aE = (aN + aS) / 2; den = aN + aS + 2 * aE
    phi = np.zeros((ny, nx)); free = np.ones((ny, nx), bool)
    free[0, :] = free[-1, :] = free[:, 0] = free[:, -1] = False
    free[jh, a_] = free[jh, v_] = False; phi[jh, a_] = 1.0
    jj, ii = np.indices((ny, nx)); color = [(jj + ii) % 2 == c for c in (0, 1)]
    om = 2 / (1 + math.sin(math.pi / max(nx, ny)))
    for it in range(20000):
        dmax = 0.0
        for c in color:
            m = free & c
            nb = np.zeros_like(phi)
            nb[1:-1, 1:-1] = (aN[1:-1, 1:-1] * phi[2:, 1:-1] + aS[1:-1, 1:-1] * phi[:-2, 1:-1]
                              + aE[1:-1, 1:-1] * (phi[1:-1, 2:] + phi[1:-1, :-2])) / den[1:-1, 1:-1]
            d = om * (nb - phi) * m; phi += d; dmax = max(dmax, np.abs(d).max())
        if dmax < 1e-9: break
    iv = np.where(v_)[0]; j = jh
    q = sum(aN[j, i] * (0 - phi[j + 1, i]) + aS[j, i] * (0 - phi[j - 1, i]) + aE[j, i] * (2 * 0 - phi[j, i + 1] - phi[j, i - 1]) for i in iv)
    return abs(q) * EPS0

def selftest():
    sim = os.path.join(OUT, "xtalk_selftest"); res = 0.0635         # strip edges fall on grid lines (no sliver cells)
    w, pitch, L = 0.127, 0.508, 79 * 0.127                          # 10.03 mm, both ends on x mesh lines
    box = (0, -2, L, 2)
    M = Model()
    M.fr4.append(_box((-MARGIN, -2 - MARGIN, 0), (L + MARGIN, 2 + MARGIN, T), 1))
    M.cu.append(_box((-MARGIN, -2 - MARGIN, ZP), (L + MARGIN, 2 + MARGIN, ZP), 5))
    ya, yv = -pitch / 2, pitch / 2
    for yy in (ya, yv): M.cu.append(_poly([(0, yy - w / 2), (L, yy - w / 2), (L, yy + w / 2), (0, yy + w / 2)], T, 10))
    pa = [M.port(0, ya, ZP, T, w / 2, "y", True), M.port(L, ya, ZP, T, w / 2, "y", False)]
    pv = [M.port(0, yv, ZP, T, w / 2, "y", False), M.port(L, yv, ZP, T, w / 2, "y", False)]
    xs = grade(0, L, 0.127); ys = grade(-2.032, 2.032, res)
    zs = zlines(0.05)
    run(sim, M, xs, ys, zs)
    f = np.linspace(20e6, 1.5e9, 300); Cm = cm_from(sim, pa, pv, f)
    lo = (f > 50e6) & (f < 250e6)
    ref = laplace_cm(w, pitch - w, T - ZP, 4.4) * L * 1e-3
    print(f"selftest: openEMS Cm = {np.median(Cm[lo]) * 1e15:.1f} fF   2-D Laplace = {ref * 1e15:.1f} fF   (10 mm, 0.127 mm @ 0.508 mm, L1)")
    return float(np.median(Cm[lo])), ref

def main():
    VIC, AGG = sys.argv[1], sys.argv[2]
    box = tuple(map(float, sys.argv[3:7])); X0, Y0, X1, Y1 = box
    RES = float(sys.argv[7]) if len(sys.argv) > 7 else 0.1
    sim = os.path.abspath(sys.argv[8] if len(sys.argv) > 8 else os.path.join(OUT, f"xtalk_{AGG}_{VIC}"))
    pieces, ports, vias = {VIC: [], AGG: []}, {VIC: [], AGG: []}, []
    for t in B["tracks"]:
        if t["net"] not in pieces or t["layer"] == 1: continue
        c = clip(t["a"], t["b"], box)
        if not c: continue
        a, b, ea, eb = c
        pieces[t["net"]].append((t["layer"], a, b, t["w"]))
        for p, e in ((a, ea), (b, eb)):
            if e: ports[t["net"]].append((t["layer"], p))
    for v in B["vias"]:
        if v["net"] in pieces and X0 < v["x"] < X1 and Y0 < v["y"] < Y1: vias.append(v)
    print(f"{AGG} -> {VIC}: {sum(len(v) for v in pieces.values())} pieces, {len(vias)} vias, ports {[(n, len(p)) for n, p in ports.items()]}")
    if not ports[VIC] or not ports[AGG]: sys.exit("a net has no port in this crop")
    M = Model()
    M.fr4.append(_box((X0 - MARGIN, Y0 - MARGIN, 0), (X1 + MARGIN, Y1 + MARGIN, T), 1))
    M.cu.append(_box((X0 - MARGIN, Y0 - MARGIN, ZP), (X1 + MARGIN, Y1 + MARGIN, ZP), 5))   # L2 plane, into the PML
    for v in vias:                                                                         # clearance in L2, then the post
        r = v["d"] / 2 + 0.25
        M.fr4.append(_box((v["x"] - r, v["y"] - r, ZP), (v["x"] + r, v["y"] + r, ZP), 8))
        M.cu.append(_box((v["x"] - v["d"] / 2, v["y"] - v["d"] / 2, 0), (v["x"] + v["d"] / 2, v["y"] + v["d"] / 2, T), 10))
    for net, ps in pieces.items():
        for L, a, b, w in ps: M.cu.append(_poly(seg_poly(a, b, w), ZL[L], 10))
    pn = {AGG: [], VIC: []}
    for net in (AGG, VIC):
        for k, (L, p) in enumerate(ports[net]):
            x, y = p
            on_x = min(abs(x - X0), abs(x - X1)) < min(abs(y - Y0), abs(y - Y1))     # leaves through a vertical crop edge
            if on_x: x = X0 if abs(x - X0) < abs(x - X1) else X1
            else: y = Y0 if abs(y - Y0) < abs(y - Y1) else Y1
            z0, z1 = sorted((ZL[L], ZP))
            pn[net].append(M.port(x, y, z0, z1, max(RES, 0.0635), "y" if on_x else "x", net == AGG and k == 0))
    run(sim, M, grade(X0, X1, RES), grade(Y0, Y1, RES), zlines(0.08))
    f = np.linspace(20e6, 1.5e9, 300); Cm = cm_from(sim, pn[AGG], pn[VIC], f)
    lo = (f > 50e6) & (f < 250e6)
    res = {"victim": VIC, "aggressor": AGG, "crop": list(box), "res_mm": RES, "Cm_fF_50_250MHz": float(np.median(Cm[lo]) * 1e15),
           "f_MHz": (f[::10] / 1e6).round(1).tolist(), "Cm_fF": (Cm[::10] * 1e15).round(2).tolist()}
    import bench_traces as S                                 # the screen's estimate for the same copper (same crop)
    est = 0.0
    for v in [t for t in B["tracks"] if t["net"] == VIC]:
        for a in [t for t in B["tracks"] if t["net"] == AGG]:
            cv, ca = clip(v["a"], v["b"], box), clip(a["a"], a["b"], box)
            if cv and ca: est += S.pair_cm({**v, "a": cv[0], "b": cv[1]}, {**a, "a": ca[0], "b": ca[1]})[0]
    res["screen_estimate_fF"] = est * 1e15
    json.dump(res, open(os.path.join(OUT, f"xtalk_{AGG}_{VIC}.json"), "w"), indent=1)
    print(f"Cm (openEMS, 50–250 MHz) = {res['Cm_fF_50_250MHz']:.1f} fF   screen estimate = {res['screen_estimate_fF']:.1f} fF")

if __name__ == "__main__":
    if sys.argv[1:2] == ["--selftest"]:
        cm, ref = selftest()
        json.dump({"openems_fF": cm * 1e15, "laplace_fF": ref * 1e15}, open(os.path.join(OUT, "xtalk_selftest.json"), "w"), indent=1)
    else:
        main()
