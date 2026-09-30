"""Steady-state thermal model of the Muon3 station in its ABS case.

2D conduction in the board (0.5 mm grid, copper-layer sheet conductance; routed slots are real gaps), component heat
sources at their placed footprints, convection+radiation from both board faces to the enclosed air, the main cavity air
coupled through the ABS walls to the room, and the BME280 chamber as its own air node (vented grille + thin ribs).

Rev D: the board is a 337 x 40 mm strip with the island on the far long edge; the case air is still one lumped node (an
estimate: the real air is warmer near the hub and cooler at the far cells).
Reads hw/out/board.json. Writes hw/docs/thermal.png and prints the BME280 offset for three layouts:
  A  island + own vented chamber (the design)      B  island, no chamber      C  sensor mid-board, no island
Usage: python hw/sim/thermal.py
"""
import json, os, sys
import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

HERE = os.path.dirname(os.path.abspath(__file__))
B = json.load(open(os.path.join(HERE, "..", "out", "board.json")))
W, H = B["w"], B["h"]
DX = 0.5e-3                                  # grid (m)
NX, NY = int(round(W / 0.5)), int(round(H / 0.5))

# ---- board sheet conductance (W/K per square): k·t summed over layers [EST fills] ----
K_CU, K_FR4 = 390.0, 0.8
layers = [(35e-6, 0.30), (17.5e-6, 0.90), (17.5e-6, 0.20), (35e-6, 0.25)]   # (thickness, copper fill) L1..L4
G_SHEET = K_CU * sum(t * f for t, f in layers) + K_FR4 * 1.5e-3
# island + arm: no plane, no pour, only the 4 sensor traces (necked to 0.127 mm × 35 µm) spread over the 2.6 mm arm, plus FR4
G_ISLAND = K_CU * 4 * 0.127e-3 * 35e-6 / 2.6e-3 + K_FR4 * 1.5e-3

# ---- heat sources (W) [EST: ESP32 Wi-Fi connected, modem-sleep average] ----
PROFILES = {  # ESP32 + AMS1117 (5 V -> 3.3 V drop x load) — the rest is fixed
    "wifi-on": {"C3013946": 0.30, "C6186": 0.17},   # 240 MHz, Wi-Fi associated, no power save  [EST ~90 mA avg]
    "low":     {"C3013946": 0.13, "C6186": 0.07},   # 80 MHz + WIFI_PS_MAX_MODEM, uploads batched [EST ~40 mA avg]
}
SRC = {"C3013946": 0.30, "C6186": 0.17, "C485517": 0.043, "C183100": 0.015, "C20613263": 0.0036,
       "C100023": 0.020, "C8545": 0.0, "C478093": 0.003, "C92489": 0.00001}

# ---- convection / radiation coefficients (W/m²K) and air-path conductances ----
H_IN = 8.0            # board face → enclosed air (natural convection ~3 + radiation ~5)
H_OUT = 9.0           # case outer surface → room
K_ABS, T_WALL = 0.17, 2.4e-3
_cj = os.path.join(HERE, "..", "out", "case", "case.json")
_cx, _cy, _cz = (json.load(open(_cj))["outer_mm"] if os.path.exists(_cj) else (W + 6, H + 6, 16.5))
CASE_AREA = 2 * (_cx * _cy + _cx * _cz + _cy * _cz) * 1e-6
V_AIR = 0.02                      # buoyant flow speed through a 16 mm-tall case with ~10 K rise, after losses [EST]
VENT_HOT = 1.2 * 1005 * (8 * 1.6e-3 * 14e-3) * V_AIR   # hot-side chimney: 8 slots 1.6 × 14 mm (case.py), ρ·cp·A·v
VENT_BME = 1.2 * 1005 * (8 * 1.6e-3 * 3.4e-3) * V_AIR * 2  # BME grille: 8 slots 1.6 × ~3.4 mm (case.py), in + out [EST]
RIB_G = K_ABS * (1.2e-3 * 0.012 * 2 + 1.2e-3 * 0.012 * 2) / 1.2e-3 * 0.5   # chamber ribs to main air [EST]
ISL_AREA = (B["island"]["x1"] * (B["island"]["y1"] - B["island"]["y0"])) * 1e-6

def solve(layout):
    """layout: 'A' | 'B' | 'C'. Returns (T grid over ambient, T_main_air, T_bme)."""
    mask = np.ones((NY, NX), bool)                   # board material present
    ys, xs = np.mgrid[0:NY, 0:NX]
    cx, cy = (xs + 0.5) * 0.5, (ys + 0.5) * 0.5       # mm
    island = np.zeros_like(mask); gcell = np.full((NY, NX), G_SHEET)
    if layout in "AB":
        for k in B.get("noPlane", []):
            gcell[(cx > k["x0"]) & (cx < k["x1"]) & (cy > k["y0"]) & (cy < k["y1"])] = G_ISLAND
        I = B["island"]
        from matplotlib.path import Path
        pts = np.c_[cx.ravel(), cy.ravel()]
        for c in B["cutouts"]:   # C-shaped slots: true point-in-polygon, not the bounding box
            mask &= ~Path([(p["x"], p["y"]) for p in c]).contains_points(pts).reshape(mask.shape)
        IB = B["island_box"]; ix0 = IB["x0"] + 1.4                               # the island sits on the far long edge (y = H)
        island = (cx > ix0) & (cx < ix0 + I["y1"] - I["y0"]) & (cy > H - I["x1"]) & mask   # the pad itself (arm stays in the main air)
    n_board = NX * NY
    AIR, BAIR = n_board, n_board + 1                  # main air node, BME-chamber air node
    N = n_board + 2
    idx = lambda i, j: i * NX + j
    rows, cols, vals = [], [], []
    def link(a, b, g):
        rows.extend([a, b, a, b]); cols.extend([a, b, b, a]); vals.extend([g, g, -g, -g])
    rhs = np.zeros(N); diag_amb = np.zeros(N)
    for i in range(NY):
        for j in range(NX):
            if not mask[i, j]: diag_amb[idx(i, j)] += 1e-9; continue
            if j + 1 < NX and mask[i, j + 1]: link(idx(i, j), idx(i, j + 1), 2 / (1 / gcell[i, j] + 1 / gcell[i, j + 1]))
            if i + 1 < NY and mask[i + 1, j]: link(idx(i, j), idx(i + 1, j), 2 / (1 / gcell[i, j] + 1 / gcell[i + 1, j]))
            g_face = 2 * H_IN * DX * DX
            to = BAIR if (layout == "A" and island[i, j]) else AIR
            link(idx(i, j), to, g_face)
    # heat sources over each part footprint
    bme_cells = []
    for p in B["parts"]:
        q = SRC.get(p["lcsc"], 0.0)
        x0, y0, x1, y1 = p["x0"], p["y0"], p["x1"], p["y1"]
        if p["lcsc"] == "C92489" and layout == "C":     # move the sensor to mid-board for the reference case
            x0, y0, x1, y1 = W / 2 - 1.3, H / 2 - 1.3, W / 2 + 1.3, H / 2 + 1.3
        sel = (cx >= x0) & (cx <= x1) & (cy >= y0) & (cy <= y1) & mask
        if p["lcsc"] == "C92489": bme_cells = np.flatnonzero(sel.ravel())
        if q and sel.any(): rhs[np.flatnonzero(sel.ravel())] += q / sel.sum()
    # air nodes
    g_wall = CASE_AREA / (1 / H_IN + T_WALL / K_ABS + 1 / H_OUT)
    diag_amb[AIR] += g_wall + VENT_HOT
    if layout == "A":
        diag_amb[BAIR] += VENT_BME + ISL_AREA * 2 / (1 / H_IN + T_WALL / K_ABS + 1 / H_OUT)  # grille + its own wall
        link(BAIR, AIR, RIB_G)
    else:
        link(BAIR, AIR, 1.0); diag_amb[BAIR] += 1e-9
    A = sp.coo_matrix((vals, (rows, cols)), shape=(N, N)).tocsr() + sp.diags(diag_amb)
    T = spla.spsolve(A.tocsc(), rhs)
    grid = T[:n_board].reshape(NY, NX); grid[~mask] = np.nan
    return grid, T[AIR], float(np.mean(T[bme_cells]))

if __name__ == "__main__":
    out = {}
    for prof in ("low",):   # headline numbers for the recommended firmware profile; the full-power case follows
        SRC.update(PROFILES[prof])
        g, air, bme = solve("A")
        print(f"[{prof}] A: board max +{np.nanmax(g):5.2f} K  case air +{air:5.2f} K  BME280 +{bme:5.2f} K")
        out["A_" + prof] = {"board_max_K": round(float(np.nanmax(g)), 2), "air_K": round(float(air), 2), "bme_K": round(bme, 2)}
    SRC.update(PROFILES["wifi-on"])
    res = {k: solve(k) for k in "ABC"}
    names = {"A": "island + own vented chamber (design)", "B": "island, open to the case air", "C": "sensor mid-board, no island"}
    total = sum(SRC.get(p["lcsc"], 0) for p in B["parts"])
    print(f"total dissipation {total:.2f} W, sheet conductance {G_SHEET*1e3:.1f} mW/K (island {G_ISLAND*1e3:.1f})")
    for k, (g, air, bme) in res.items():
        print(f"{k}: {names[k]:40s} board max +{np.nanmax(g):5.2f} K  case air +{air:5.2f} K  BME280 +{bme:5.2f} K"
              f"  → bias error {bme*60:5.0f} mV if uncorrected (S12572 60 mV/K)")
        out[k] = {"board_max_K": round(float(np.nanmax(g)), 2), "air_K": round(float(air), 2), "bme_K": round(bme, 2)}
    json.dump(out, open(os.path.join(HERE, "thermal_results.json"), "w"), indent=1)
    try:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
        fig, axs = plt.subplots(2, 1, figsize=(11, 5.0), dpi=150)
        for ax, k in zip(axs, "AC"):
            g = res[k][0]
            im = ax.imshow(g, extent=[0, W, H, 0], cmap="inferno", vmin=0, vmax=np.nanmax(res["C"][0]))
            ax.set_title(f"{names[k]}\nBME280 +{res[k][2]:.2f} K over room", fontsize=9)
            ax.set_xlabel("x (mm)"); ax.set_ylabel("y (mm)")
        fig.colorbar(im, ax=axs, label="board temperature over room (K)")
        fig.savefig(os.path.join(HERE, "..", "docs", "thermal.png"), bbox_inches="tight")
    except Exception as e:
        print("plot skipped:", e, file=sys.stderr)
