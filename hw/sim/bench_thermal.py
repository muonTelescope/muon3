"""Bench board steady-state thermal check: where the heat goes and how hot the power traces get.

1. Board: 2-D heat spreading on a 0.25 mm grid. Sheet conductance per cell = FR4 (0.3 W/mK x 1.6 mm) + copper
   (390 W/mK x thickness x coverage) of all four layers, coverage rasterised at 0.05 mm from board.json (tracks, pads) and the
   L2 GND plane (outline minus antipads and the antenna cut-out). Both faces lose heat to 25 C air at h = 10 W/m2K
   (natural convection ~5 + radiation ~6 at emissivity 0.9) [EST]. Part dissipation is spread over each part's body.
   Junction = board under the part + P x theta_jb (datasheet class values) [EST]. Matrix-free CG, numpy only.
2. Power traces: each rail's copper graph (bench_copper.graph) is solved in ngspice for the scenario's load currents
   (bench_traces.solve). Every piece gets I^2 R, conducts along its copper (390 W/mK), and leaks into the board through the
   FR4 to the L2 plane: g' = k_FR4 2 pi / acosh(4 d / w) per length (strip of width w at distance d from the plane, as a
   cylinder of diameter w/2). Trace temperature = board temperature there + this local rise. Unlike the IPC-2221 chart
   (an infinitely long trace in still air), short necks are heat-sunk by the wide copper at both ends.
Scenarios: typical (Wi-Fi connected, average currents) and worst (every load at its continuous maximum).
Usage: python3 sim/bench_thermal.py      -> out/bench/sim/thermal.json, docs/bench/sim_thermal.png
"""
import json, math, os
import numpy as np
from matplotlib.path import Path
from bench_copper import B, OUT, DOCS, PARTS, T_CU, LAYER, RHO_CU
import bench_traces as S

K_CU, K_FR4, H_AIR, T_AMB = 390.0, 0.3, 10.0, 25.0
DX, FINE = 0.25, 0.05                                        # thermal grid, coverage raster (mm)
W, H = B["w"], B["h"]
D_PLANE = {0: 0.2104, 2: 1.065, 3: 1.065 + 0.2104 + 0.0152}  # strip to L2 plane distance, mm

SCEN = {   # amps per load (see bench_traces.LOADS for the peak table)
    "typical": dict(esp=0.12, fpga_io=0.005, i1v2=0.008, qt=0.010, led=0.0, opa=0.0083, cmp=0.0011, dac=0.0008, hv_in=0.010),
    "worst":   dict(esp=0.34, fpga_io=0.010, i1v2=0.020, qt=0.100, led=0.0066, opa=0.011, cmp=0.0013, dac=0.0010, hv_in=0.020),
}
THETA_JB = {"U4": 15, "U1": 8, "U5": 50, "U6": 50, "U2": 12, "U9": 60, "Q1": 120, "U12": 60, "U14": 60, "U16": 60, "U18": 60}

def currents(s):
    i3v3a = 4 * s["opa"] + 4 * s["cmp"] + 2 * s["dac"]
    i3v3 = s["esp"] + s["fpga_io"] + s["i1v2"] + s["qt"] + s["led"] + 0.0023      # + status LEDs
    return i3v3, i3v3a

def part_power(s):
    i3v3, i3v3a = currents(s)
    P = {"U4": 1.7 * i3v3 + 5.0 * 0.005, "U1": 3.3 * s["esp"], "U5": 1.7 * i3v3a, "U6": 2.1 * s["i1v2"],
         "U2": 1.2 * s["i1v2"] + 3.3 * s["fpga_io"], "U9": 5.0 * s["hv_in"] * 0.5, "Q1": 5.0 * s["hv_in"] * 0.25,
         "L1": 5.0 * s["hv_in"] * 0.15, "D7": 5.0 * s["hv_in"] * 0.1, "U10": 3.3 * s["dac"], "U11": 3.3 * s["dac"],
         "D1": 2.0 * 0.0013, "R3": 1.3 * 0.0013, "U8": 3.3 * s["led"] * 0.3}
    for r in ("U12", "U14", "U16", "U18"): P[r] = 3.3 * s["opa"]
    for r in ("U13", "U15", "U17", "U19"): P[r] = 3.3 * s["cmp"]
    return P

def rail_loads(s):
    i3v3, i3v3a = currents(s)
    return {"5V": {"C6186": i3v3 + 0.005, "C485517": i3v3a, "C100023": s["hv_in"]},
            "3V3": {"C2913198": s["esp"], "C2678152": s["fpga_io"], "C22456010": s["i1v2"], "C7836": s["led"], "C160404": s["qt"]},
            "3V3A": {"C183100": s["opa"], "C20613263": s["cmp"], "C478093": s["dac"]},
            "1V2": {"C2678152": s["i1v2"]}}

# ── copper coverage per layer (fraction of each DX cell) ──
def coverage():
    nx, ny = int(round(W / FINE)), int(round(H / FINE))
    xc = (np.arange(nx) + 0.5) * FINE; yc = (np.arange(ny) + 0.5) * FINE
    cov = np.zeros((4, ny, nx), bool)
    def win(x0, y0, x1, y1):
        i0, i1 = max(0, int(x0 / FINE)), min(nx, int(x1 / FINE) + 2); j0, j1 = max(0, int(y0 / FINE)), min(ny, int(y1 / FINE) + 2)
        return i0, i1, j0, j1
    for t in B["tracks"]:
        (ax, ay), (bx, by), r = t["a"], t["b"], t["w"] / 2
        i0, i1, j0, j1 = win(min(ax, bx) - r, min(ay, by) - r, max(ax, bx) + r, max(ay, by) + r)
        if i0 >= i1 or j0 >= j1: continue
        X, Y = np.meshgrid(xc[i0:i1], yc[j0:j1]); dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy or 1e-12
        u = np.clip(((X - ax) * dx + (Y - ay) * dy) / L2, 0, 1)
        cov[t["layer"], j0:j1, i0:i1] |= (X - ax - u * dx) ** 2 + (Y - ay - u * dy) ** 2 <= r * r
    for p in B["pads"]:
        P = np.array(p["poly"]); i0, i1, j0, j1 = win(*P.min(0), *P.max(0))
        if i0 >= i1 or j0 >= j1: continue
        X, Y = np.meshgrid(xc[i0:i1], yc[j0:j1])
        m = Path(P).contains_points(np.c_[X.ravel(), Y.ravel()]).reshape(X.shape)
        for L in {"top": [0], "bottom": [3], "multi": [0, 1, 2, 3]}[p["layer"]]: cov[L, j0:j1, i0:i1] |= m
    # L2: GND plane 0.3 mm in from the edge, antipads 0.2 mm round non-GND vias, no copper under the antenna
    X, Y = np.meshgrid(xc, yc)
    l2 = (X > 0.3) & (X < W - 0.3) & (Y > 0.3) & (Y < H - 0.3)
    a = B["antenna"]; l2 &= ~((X > a["x0"]) & (X < a["x1"]) & (Y > a["y0"]) & (Y < a["y1"]))
    for v in B["vias"]:
        if v["net"] != "GND":
            r = v["d"] / 2 + 0.2; i0, i1, j0, j1 = win(v["x"] - r, v["y"] - r, v["x"] + r, v["y"] + r)
            l2[j0:j1, i0:i1] &= (X[j0:j1, i0:i1] - v["x"]) ** 2 + (Y[j0:j1, i0:i1] - v["y"]) ** 2 > r * r
    for h in B["holes"]:
        r = 1.6 + 0.3; l2 &= (X - h["x"]) ** 2 + (Y - h["y"]) ** 2 > r * r
    cov[1] |= l2
    k = int(round(DX / FINE))
    return cov.reshape(4, ny // k, k, nx // k, k).mean(axis=(2, 4))

# ── 2-D board solve: -div(G grad T) + 2h (T - Tamb) dA = q ──
def board_solve(G, q):
    ny, nx = G.shape
    gx = 2 * G[:, 1:] * G[:, :-1] / (G[:, 1:] + G[:, :-1])          # harmonic mean between cells (W/K per square)
    gy = 2 * G[1:, :] * G[:-1, :] / (G[1:, :] + G[:-1, :])
    hA = 2 * H_AIR * (DX * 1e-3) ** 2
    diag = np.full_like(G, hA); diag[:, 1:] += gx; diag[:, :-1] += gx; diag[1:, :] += gy; diag[:-1, :] += gy
    def A(T):
        r = diag * T
        r[:, 1:] -= gx * T[:, :-1]; r[:, :-1] -= gx * T[:, 1:]; r[1:, :] -= gy * T[:-1, :]; r[:-1, :] -= gy * T[1:, :]
        return r
    x = np.zeros_like(G); r = q - A(x); z = r / diag; p = z.copy(); rz = (r * z).sum()
    for it in range(20000):
        Ap = A(p); al = rz / (p * Ap).sum(); x += al * p; r -= al * Ap
        if np.sqrt((r * r).sum()) < 1e-10 * max(1e-12, np.sqrt((q * q).sum())): break
        z = r / diag; rz2 = (r * z).sum(); p = z + rz2 / rz * p; rz = rz2
    return x + T_AMB, it

def heat_box(ref):
    """Grid slice (j0, j1, i0, i1) where a part's heat enters the board: its body, minus the ESP32 module's antenna overhang."""
    pt = PARTS[ref]; x1 = min(pt["x1"], B["antenna"]["x0"]) if ref == "U1" else pt["x1"]
    i0 = int(pt["x0"] / DX); j0 = int(pt["y0"] / DX)
    return j0, max(j0 + 1, int(math.ceil(pt["y1"] / DX))), i0, max(i0 + 1, int(math.ceil(x1 / DX)))

def board_T(Tb, x, y):
    i = min(Tb.shape[1] - 1, max(0, int(x / DX))); j = min(Tb.shape[0] - 1, max(0, int(y / DX)))
    return float(Tb[j, i])

# ── 1-D self-heating of one rail's copper ──
def trace_heat(net, load, Tb):
    edges, volt, _ = S.solve(net, load)
    nodes = {}
    def ix(n):
        if n not in nodes: nodes[n] = len(nodes)
        return nodes[n]
    rows = []                                    # (node a, node b, g along copper W/K, I A, R ohm, track, g to board W/K)
    for a, b, R, t in edges:
        if a == b: continue
        ia, ib = ix(a), ix(b)
        if t is None: rows.append((ia, ib, 1e3, 0.0, 0.0, None, 0.0)); continue      # overlap joint: thermally a short
        L = R * t["w"] * 1e-3 * T_CU[t["layer"]] / RHO_CU                           # piece length, m
        gk = K_CU * t["w"] * 1e-3 * T_CU[t["layer"]] / max(L, 1e-6)
        gs = K_FR4 * 2 * math.pi / math.acosh(max(1.01, 4 * D_PLANE[t["layer"]] / t["w"])) * L
        rows.append((ia, ib, gk, abs(volt(a) - volt(b)) / R, R, t, gs))
    N = len(nodes); A = np.zeros((N, N)); q = np.zeros(N)
    for ia, ib, gk, I, R, t, gs in rows:
        A[ia, ia] += gk + gs / 2; A[ib, ib] += gk + gs / 2; A[ia, ib] -= gk; A[ib, ia] -= gk
        q[ia] += I * I * R / 2; q[ib] += I * I * R / 2
    for n, i in nodes.items():                   # pads and vias sink into part leads / via barrels [EST 2 mW/K]
        A[i, i] += 2e-3 if n[0] in ("pad", "via") else 1e-9
    dT = np.linalg.solve(A, q)
    out = []
    for ia, ib, gk, I, R, t, gs in rows:
        if t is None: continue
        rise = float(max(dT[ia], dT[ib])); mx, my = (t["a"][0] + t["b"][0]) / 2, (t["a"][1] + t["b"][1]) / 2
        out.append({"net": net, "layer": LAYER[t["layer"]], "w": t["w"], "len_mm": round(math.dist(t["a"], t["b"]), 2),
                    "I_A": round(I, 3), "rise_K": round(rise, 2), "T_C": round(board_T(Tb, mx, my) + rise, 1),
                    "ipc2221_K": round(ipc(I, t), 1), "at": [round(mx, 2), round(my, 2)]})
    return out

def ipc(I, t):
    area = (t["w"] / 0.0254) * (T_CU[t["layer"]] / 25.4e-6); k = 0.048 if t["layer"] in (0, 3) else 0.024
    return (I / (k * area ** 0.725)) ** (1 / 0.44) if I > 0 else 0.0

def main():
    cov = coverage()
    G = K_FR4 * 1.6e-3 + K_CU * sum(T_CU[L] * cov[L] for L in range(4))           # W/K per square
    ny, nx = G.shape
    j0, j1, i0, i1 = heat_box("U1")                                                # the module's own PCB (GND planes, ~2 x 35 um) [EST]
    G[j0:j1, i0:i1] += K_CU * 70e-6
    res = {"h_W_m2K": H_AIR, "ambient_C": T_AMB, "copper_cover": {LAYER[L]: round(float(cov[L].mean()), 3) for L in range(4)}, "scenarios": {}}
    maps = {}
    for name, s in SCEN.items():
        P = part_power(s); q = np.zeros_like(G)
        for ref, p in P.items():
            j0, j1, i0, i1 = heat_box(ref)
            q[j0:j1, i0:i1] += p / ((j1 - j0) * (i1 - i0))
        Tb, it = board_solve(G, q); maps[name] = Tb
        parts = []
        for ref, p in sorted(P.items(), key=lambda kv: -kv[1]):
            j0, j1, i0, i1 = heat_box(ref); pt = PARTS[ref]
            tb = float(Tb[j0:j1, i0:i1].max())
            parts.append({"ref": ref, "value": pt["value"], "P_W": round(p, 4), "T_board_C": round(tb, 1),
                          "T_j_C": round(tb + p * THETA_JB.get(ref, 80), 1)})
        traces = []
        for net, load in rail_loads(s).items(): traces += trace_heat(net, load, Tb)
        traces.sort(key=lambda h: -h["rise_K"])
        res["scenarios"][name] = {"P_total_W": round(sum(P.values()), 3), "cg_iterations": it, "T_board_max_C": round(float(Tb.max()), 1),
                                  "parts": parts[:12], "hottest_traces": traces[:8],
                                  "rail_currents_A": dict(zip(["3V3", "3V3A"], [round(c, 3) for c in currents(s)]))}
        print(f"{name}: {res['scenarios'][name]['P_total_W']} W, board max {Tb.max():.1f} C ({it} CG it)")
        for p in parts[:6]: print(f"   {p['ref']:4s} {p['value'][:16]:16s} {p['P_W']*1e3:6.0f} mW  board {p['T_board_C']:5.1f} C  Tj {p['T_j_C']:5.1f} C")
        for h in traces[:4]: print(f"   trace {h['net']} {h['layer']} {h['w']} mm {h['len_mm']} mm  {h['I_A']} A  +{h['rise_K']} K over board -> {h['T_C']} C  (IPC-2221 chart {h['ipc2221_K']} K)")
    json.dump(res, open(os.path.join(OUT, "thermal.json"), "w"), indent=1)
    plot(maps, res, G)

def plot(maps, res, G):
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    fig, axs = plt.subplots(3, 1, figsize=(10, 13.5), constrained_layout=True)
    ext = (0, W, H, 0)
    axs[0].imshow(np.log10(G), extent=ext, cmap="copper", interpolation="nearest")
    axs[0].set_title("Sheet conductance, log10 W/K per square (copper of all layers + FR4)")
    for ax, name in zip(axs[1:], ("typical", "worst")):
        sc = res["scenarios"][name]
        im = ax.imshow(maps[name], extent=ext, cmap="inferno", interpolation="bilinear")
        cs = ax.contour(np.linspace(0, W, maps[name].shape[1]), np.linspace(0, H, maps[name].shape[0]), maps[name], colors="w", linewidths=0.5, alpha=0.6)
        ax.clabel(cs, fmt="%.0f", fontsize=7)
        for p in sc["parts"][:5]:
            pt = PARTS[p["ref"]]
            ax.annotate(f"{p['ref']} {p['P_W']*1e3:.0f} mW\nTj {p['T_j_C']:.0f} C", ((pt["x0"] + pt["x1"]) / 2, (pt["y0"] + pt["y1"]) / 2),
                        color="w", fontsize=7, ha="center", va="center")
        h = sc["hottest_traces"][0]
        ax.plot(*h["at"], "c+", ms=10); ax.annotate(f"hottest trace {h['net']} {h['layer']}: {h['T_C']} C", h["at"], color="c", fontsize=7, xytext=(4, -8), textcoords="offset points")
        fig.colorbar(im, ax=ax, shrink=0.8, label="C")
        ax.set_title(f"{name}: {sc['P_total_W']:.2f} W, 25 C still air, board max {sc['T_board_max_C']} C")
    for ax in axs: ax.set_xlabel("x, mm"); ax.set_ylabel("y, mm")
    fig.savefig(os.path.join(DOCS, "sim_thermal.png"), dpi=130); print("wrote docs/bench/sim_thermal.png")

if __name__ == "__main__":
    main()
