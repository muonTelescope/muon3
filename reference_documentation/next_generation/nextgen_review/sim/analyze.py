#!/usr/bin/env python3
"""Analysis/plots for SiPM TIA front-end simulations."""
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

S = "/home/claude/muon/sim"
P = "/home/claude/muon/plots"
plt.rcParams.update({"font.size": 10, "figure.dpi": 130})

def load(tag):
    d = np.loadtxt(f"{S}/w_{tag}.csv", skiprows=1)
    return d[:,0]*1e9, d[:,1], d[:,2]   # t[ns], vout, vcmp

def tot_and_edge(t, vcmp, vmid=1.65):
    low = vcmp < vmid
    if not low.any():
        return np.nan, np.nan
    idx = np.where(low)[0]
    t_fall = t[idx[0]]
    t_rise = t[idx[-1]]
    return t_rise - t_fall, t_fall

# ---------- 1. pulse response family ----------
fig, (a1, a2) = plt.subplots(2, 1, figsize=(8, 7), sharex=True,
                             gridspec_kw={"height_ratios": [2.2, 1]})
colors = plt.cm.viridis(np.linspace(0, 0.9, 6))
for c, n in zip(colors, [1, 3, 10, 30, 100, 500]):
    t, vo, vc = load(f"858_n{n}")
    a1.plot(t, vo, color=c, lw=1.4, label=f"{n} p.e.")
    a2.plot(t, vc, color=c, lw=1.2)
a1.axhline(2.326, color="crimson", ls="--", lw=1, label="threshold (3 p.e.)")
a1.axhline(2.399, color="gray", ls=":", lw=1, label="baseline (VBOT)")
a1.set_ylabel("TIA output [V]")
a1.set_title("OPA858 TIA, Rf=2k Cf=2.2p, S13360-2050VE (140 pF) — pulse family")
a1.legend(ncol=2, fontsize=8); a1.grid(alpha=.3)
a2.set_ylabel("TLV3601 out [V]"); a2.set_xlabel("time [ns]")
a2.set_xlim(150, 550); a2.grid(alpha=.3)
fig.tight_layout(); fig.savefig(f"{P}/pulse_family_opa858.png"); plt.close(fig)

# ---------- 2. ToT vs NPE (both amps) + log fit ----------
grid = [2,3,4,5,6,8,10,13,17,22,30,40,55,75,100,140,200,300,500,800]
res = {}
for amp, tagp in [("OPA858", "tot_n"), ("OPA356", "356_n")]:
    npe, tot, edge = [], [], []
    for n in grid:
        t, vo, vc = load(f"{tagp}{n}")
        T, F = tot_and_edge(t, vc)
        if np.isfinite(T):
            npe.append(n); tot.append(T); edge.append(F - 200.0)  # T0=200ns
    res[amp] = (np.array(npe), np.array(tot), np.array(edge))

fig, ax = plt.subplots(figsize=(7.2, 5))
for amp, mk, col in [("OPA858", "o", "#1565c0"), ("OPA356", "s", "#e65100")]:
    n, T, _ = res[amp]
    ax.semilogx(n, T, mk, color=col, ms=5, label=f"{amp} (sim)")
# fit log model on linear region (exclude clipped >90 pe) for OPA858
n, T, _ = res["OPA858"]
m = (n >= 4) & (n <= 75)
A = np.vstack([np.log(n[m]), np.ones(m.sum())]).T
tau, b = np.linalg.lstsq(A, T[m], rcond=None)[0]
nn = np.geomspace(3.2, 800, 200)
ax.semilogx(nn, tau*np.log(nn)+b, "-", color="#1565c0", alpha=.5, lw=1,
            label=f"fit: ToT = {tau:.1f}·ln(Npe) {b:+.1f} ns")
ax.axvline(30, color="gray", ls=":", lw=1); ax.text(31, 8, "muon MPV\n(~30 p.e.)", fontsize=8)
ax.axvspan(90, 800, color="red", alpha=.06); ax.text(120, 8, "TIA clipped\n(still monotonic)", fontsize=8)
ax.set_xlabel("photoelectrons fired"); ax.set_ylabel("Time over Threshold [ns]")
ax.set_title("ToT energy estimator — threshold = 3 p.e., 10 ns FPGA bins shown")
for y in range(0, 260, 10): ax.axhline(y, color="k", alpha=.05, lw=.5)
ax.legend(); ax.grid(alpha=.3, which="both")
fig.tight_layout(); fig.savefig(f"{P}/tot_vs_npe.png"); plt.close(fig)

# ---------- 3. time-walk ----------
fig, ax = plt.subplots(figsize=(7.2, 4.4))
for amp, mk, col in [("OPA858", "o", "#1565c0"), ("OPA356", "s", "#e65100")]:
    n, _, E = res[amp]
    ax.semilogx(n, E, mk + "-", color=col, ms=4, lw=1, label=amp)
ax.set_xlabel("photoelectrons fired")
ax.set_ylabel("comparator latency after photon arrival [ns]")
ax.set_title("Time-walk: trigger latency vs signal size (incl. 2.5 ns comparator tpd)")
ax.legend(); ax.grid(alpha=.3, which="both")
fig.tight_layout(); fig.savefig(f"{P}/timewalk.png"); plt.close(fig)
n8, _, e8 = res["OPA858"]; n3, _, e3 = res["OPA356"]
print(f"time-walk 4->800 pe  OPA858: {e8.max()-e8.min():.1f} ns   OPA356: {e3.max()-e3.min():.1f} ns")
print(f"tau_fit = {tau:.1f} ns")

# ---------- 4. AC + Cf transient ----------
fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 4.2))
for cf in ["1.0p", "1.5p", "2.2p", "4.7p"]:
    d = np.loadtxt(f"{S}/ac_cf_{cf}.csv", skiprows=1)
    a1.semilogx(d[:,0]/1e6, d[:,1], lw=1.4, label=f"Cf={cf}")
    t, vo, _ = load(f"cf_{cf}")
    a2.plot(t, vo, lw=1.2, label=f"Cf={cf}")
a1.set_xlabel("frequency [MHz]"); a1.set_ylabel("transimpedance [dBΩ]")
a1.set_title("Closed-loop response, Cdet=140p+3p")
a1.set_xlim(0.1, 1000); a1.set_ylim(30, 72); a1.legend(fontsize=8); a1.grid(alpha=.3, which="both")
a2.set_xlabel("time [ns]"); a2.set_ylabel("TIA out [V]")
a2.set_title("30 p.e. transient vs Cf"); a2.set_xlim(190, 320)
a2.legend(fontsize=8); a2.grid(alpha=.3)
fig.tight_layout(); fig.savefig(f"{P}/cf_stability.png"); plt.close(fig)

# ---------- 5. OPA858 vs OPA356 single-pulse overlay ----------
fig, ax = plt.subplots(figsize=(7.2, 4.4))
t, vo, vc = load("tot_n30"); ax.plot(t, vo, lw=1.5, color="#1565c0", label="OPA858 (Cf=2.2p, 52 MHz)")
t, vo, vc = load("356_n30"); ax.plot(t, vo, lw=1.5, color="#e65100", label="OPA356 (Cf=11p, ~10 MHz)")
ax.axhline(2.326, color="#1565c0", ls="--", lw=.8)
ax.axhline(2.3636, color="#e65100", ls="--", lw=.8)
ax.set_xlim(180, 420); ax.set_xlabel("time [ns]"); ax.set_ylabel("TIA out [V]")
ax.set_title("30 p.e. muon pulse: 20 mA vs 8 mA amplifier (thresholds at 3 p.e. each)")
ax.legend(); ax.grid(alpha=.3)
fig.tight_layout(); fig.savefig(f"{P}/amp_compare.png"); plt.close(fig)
print("plots done")
