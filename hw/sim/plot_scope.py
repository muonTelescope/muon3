"""Simulated oscilloscope screens for the test guide -> docs/scope_*.png.
Inputs: scope_guide.cir outputs (DIR/scope/*.txt) and run_hv2.sh outputs (DIR/hv_rev2_dac*.txt).
Usage: python sim/plot_scope.py DIR"""
import os, sys
import numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt

D = sys.argv[1] if len(sys.argv) > 1 else "."
DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs")
COL = {1: "#f4e04d", 2: "#3fd0e6", 3: "#e052c9", 4: "#6be675"}   # scope channel colours

def load(name):
    d = np.loadtxt(os.path.join(D, "scope", name), skiprows=1)
    return d

def screen(ax, t, traces, tdiv, title, t0=0.0, meas=()):
    """traces: [(ch, y, volts_per_div, offset_div, label)]; 10 x 8 divisions, trigger at t0."""
    ax.set_facecolor("#101418")
    ax.set_xlim(0, 10); ax.set_ylim(-4, 4)
    for x in range(11): ax.axvline(x, color="#2c3440", lw=0.6)
    for y in range(-4, 5): ax.axhline(y, color="#2c3440", lw=0.6)
    ax.axhline(0, color="#44505e", lw=0.8); ax.axvline(5, color="#44505e", lw=0.8)
    for ch, y, vdiv, off, lab in traces:
        ax.plot((t - t0) / tdiv + 1.0, y / vdiv + off, color=COL[ch], lw=1.1)
        ax.text(0.1, off + 0.12, f"{ch}", color=COL[ch], fontsize=7, weight="bold")
    ax.set_xticks([]); ax.set_yticks([])
    foot = "   ".join(f"CH{ch} {lab} {fmt(vdiv)}/div" for ch, _, vdiv, _, lab in traces) + f"   {fmt(tdiv, 's')}/div"
    ax.set_title(title, fontsize=9, loc="left")
    ax.text(0.05, -3.85, foot, color="#c8d0d8", fontsize=6.3)
    for k, m in enumerate(meas):
        ax.text(9.95, 3.7 - 0.45 * k, m, color="#c8d0d8", fontsize=6.8, ha="right")

def fmt(v, unit="V"):
    for s, f in (("", 1), ("m", 1e-3), ("µ", 1e-6), ("n", 1e-9)):
        if v >= f * 0.999: return f"{v / f:g} {s}{unit}"
    return f"{v:g} {unit}"

fig, axs = plt.subplots(2, 2, figsize=(11, 7), dpi=150)
fig.patch.set_facecolor("white")

# 1) injection self-test, nothing on the jack
d = load("inj_notile.txt"); t, inj, tia, hit = d[:, 0], d[:, 1], d[:, 2], d[:, 3]
base = tia[t < 0.39e-6].mean(); dip = base - tia.min()
tot = np.sum(hit > 1.65) * (t[1] - t[0]) / 2   # two edges -> two pulses; TOT of one
screen(axs[0, 0], t, [(1, inj, 2.0, 2.2, "INJ"), (2, tia - base, 0.05, 0.0, "TIA0 (AC)"), (3, hit, 2.0, -3.2, "HIT0")],
       200e-9, "① Self-test, nothing plugged in: firmware pulses INJ", t0=0.2e-6,
       meas=(f"TIA0 dip {dip*1e3:.0f} mV (0.33 pC)", f"HIT0 width {tot*1e9:.0f} ns", "expect 90–130 mV, both edges"))

# 2) injection with a tile on the jack
d = load("inj_tile.txt"); t, inj, tia, hit = d[:, 0], d[:, 1], d[:, 2], d[:, 3]
base = tia[t < 0.39e-6].mean(); dip2 = base - tia.min()
screen(axs[0, 1], t, [(1, inj, 2.0, 2.2, "INJ"), (2, tia - base, 0.05, 0.0, "TIA0 (AC)"), (3, hit, 2.0, -3.2, "HIT0")],
       200e-9, "② Same, tile + coax attached (bias on)", t0=0.2e-6,
       meas=(f"TIA0 dip {dip2*1e3:.0f} mV", f"ratio to ① {dip2/dip:.2f}", "smaller + slower = tile is there"))

# 3) dark pulse and muon on one screen
p = load("pe1.txt"); m = load("muon.txt")
bp = p[p[:, 0] < 0.19e-6, 1].mean(); bm = m[m[:, 0] < 0.19e-6, 1].mean()
pe = bp - p[:, 1].min(); mu = bm - m[:, 1].min()
tot_m = np.sum(m[:, 2] > 1.65) * (m[1, 0] - m[0, 0])
screen(axs[1, 0], m[:, 0], [(2, (p[:, 1] - bp) * 10, 0.1, 1.5, "1 p.e. ×10"), (4, m[:, 1] - bm, 0.1, -0.5, "muon"),
                            (3, m[:, 2], 2.0, -3.2, "HIT0")],
       100e-9, "③ Tile on, bias at V_op: dark pulse vs. muon", t0=0.1e-6,
       meas=(f"1 p.e. {pe*1e3:.1f} mV", f"mean muon (20 p.e.) {mu*1e3:.0f} mV", f"TOT {tot_m*1e9:.0f} ns", f"VTH 29 mV = {29/(pe*1e3):.0f} p.e."))

# 4) bias power-up: HV_MON on the probe row
for v, ch in (("0", 1), ("1.0", 2), ("2.048", 3)):
    fn = os.path.join(D, f"hv_rev2_dac{v}.txt")
    if not os.path.exists(fn): continue
    h = np.loadtxt(fn); k = slice(None, None, 50)
    hv = h[k, 1]; tt = h[k, 0]
    lab = f"TRIM {v} V"
    axs[1, 1].plot([])
    if ch == 1: traces = []
    traces.append((ch, hv / 27.7, 0.5, -3.0, lab))
screen(axs[1, 1], tt, traces, 10e-3, "④ Bias power-up on HV_MON (HV = HV_MON × 27.7)", t0=0.0,
       meas=("HV_EN ↑ at 10 ms", "≈0.14 V (4 V) before enable", "3.00 / 2.47 / 1.91 V = 83 / 68 / 53 V"))
fig.tight_layout()
fig.savefig(os.path.join(DOCS, "scope_guide.png"))
print(f"inj no tile {dip*1e3:.1f} mV, tile {dip2*1e3:.1f} mV, 1pe {pe*1e3:.2f} mV, muon {mu*1e3:.0f} mV, TOT {tot_m*1e9:.0f} ns, inj HIT {tot*1e9:.0f} ns")
