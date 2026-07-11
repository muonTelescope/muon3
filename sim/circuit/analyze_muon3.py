#!/usr/bin/env python3
"""
analyze_muon3.py - Post-process ngspice runs for Muon3 dual-threshold AFE.
Generates ToT, time-walk, amplitude, and simple efficiency plots.
Run after ./run_sweeps.sh (or manually point at your .csv files).
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RESULTS = "results"
PLOTS = "plots"
os.makedirs(PLOTS, exist_ok=True)
plt.rcParams.update({"font.size": 9, "figure.dpi": 140})

def load_wave(tag):
    """Load wave_dual_nXX.csv -> t(ns), vout, vcmpl, vcmph, vina"""
    path = os.path.join(RESULTS, f"wave_dual_n{tag}.csv")
    if not os.path.exists(path):
        # try alternative naming
        path = os.path.join(RESULTS, f"wave_dual_n{tag}.csv")
    d = np.loadtxt(path, skiprows=1)
    t = d[:, 0] * 1e9
    return t, d[:,1], d[:,2], d[:,3], d[:,4]

def compute_tot(t, v, thresh=1.65):
    """Return (tot_ns, leading_edge_ns) for active-low pulse."""
    below = v < thresh
    if not np.any(below):
        return np.nan, np.nan
    idx = np.where(below)[0]
    t_lead = t[idx[0]]
    t_trail = t[idx[-1]]
    return t_trail - t_lead, t_lead

def main():
    npe_list = [1, 3, 10, 30, 100]
    data = {}
    for n in npe_list:
        try:
            t, vout, vlow, vhigh, _ = load_wave(n)
            tot_low, lead_low = compute_tot(t, vlow)
            tot_high, lead_high = compute_tot(t, vhigh)
            amp = np.max(np.abs(vout - 1.80))   # rough from baseline
            data[n] = dict(t=t, vout=vout, vlow=vlow, vhigh=vhigh,
                           tot_low=tot_low, tot_high=tot_high,
                           lead_low=lead_low, amp=amp)
            print(f"NPE={n}: ToT_low={tot_low:.1f} ns, ToT_high={tot_high:.1f} ns, amp~{amp*1000:.0f} mV")
        except Exception as e:
            print("Missing data for NPE", n, e)

    if not data:
        print("No wave files found. Run ./run_sweeps.sh first.")
        return

    # 1. Pulse family (low threshold comparator)
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 6), sharex=True)
    colors = plt.cm.viridis(np.linspace(0.1, 0.9, len(npe_list)))
    for (n, d), c in zip(data.items(), colors):
        ax1.plot(d['t'], d['vout'], color=c, label=f"{n} p.e.")
        ax2.plot(d['t'], d['vlow'], color=c, lw=0.9)
    ax1.axhline(1.68, color="r", ls="--", lw=0.8, label="low thresh")
    ax1.axhline(1.80, color="gray", ls=":", lw=0.7, label="baseline")
    ax1.set_ylabel("TIA OUT (V)")
    ax1.legend(fontsize=7, ncol=3)
    ax1.grid(alpha=0.3)
    ax2.set_ylabel("CMPL (low thresh)")
    ax2.set_xlabel("Time (ns)")
    ax2.grid(alpha=0.3)
    ax2.set_xlim(150, 600)
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "muon3_pulse_family.png"))
    plt.close(fig)
    print("Saved muon3_pulse_family.png")

    # 2. ToT vs NPE (log fit useful region)
    ns = np.array(sorted(data.keys()))
    tots_low = np.array([data[n]["tot_low"] for n in ns])
    mask = (ns >= 3) & (ns <= 80) & np.isfinite(tots_low)
    if np.sum(mask) >= 3:
        p = np.polyfit(np.log(ns[mask]), tots_low[mask], 1)
        print(f"Fit ToT ≈ {p[0]:.1f}*ln(NPE) + {p[1]:.1f} ns")

    fig, ax = plt.subplots(figsize=(6, 4))
    ax.semilogx(ns, tots_low, "o-", label="Low threshold ToT")
    if "tot_high" in data[ns[0]]:
        tots_h = [data[n]["tot_high"] for n in ns]
        ax.semilogx(ns, tots_h, "s--", label="High threshold ToT")
    ax.set_xlabel("NPE")
    ax.set_ylabel("Time-over-Threshold (ns)")
    ax.set_title("Muon3 dual-threshold ToT (OPA858 + TLV3601)")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "muon3_tot_vs_npe.png"))
    plt.close(fig)
    print("Saved muon3_tot_vs_npe.png")

    print("\nAnalysis complete. Update parameters from real MicroFC + panel measurements.")

if __name__ == "__main__":
    main()
