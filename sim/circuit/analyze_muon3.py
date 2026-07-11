#!/usr/bin/env python3
"""
analyze_muon3.py (rev 2) - Analyze real Muon3 AFE ngspice results.

Changes from rev 1:
- NO synthetic fallback. Rev 1 silently generated "physics-matched"
  synthetic data when ngspice output was missing and wrote it into
  results/, making fake data indistinguishable from real runs. This
  version refuses to run without real CSVs and never writes into
  results/ itself.
- Adds a real time-walk analysis (leading-edge time vs NPE).
- Adds the low-threshold scan and 50 cm cable comparison plots.
- Writes the ToT(NPE) log-fit coefficients to results/tot_fit.json so
  sipm_to_tot.py and the report stay in sync with the actual sim.
"""
import os
import json
import glob
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

BASE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(BASE, "results")
PLOTS = os.path.join(BASE, "plots")
os.makedirs(PLOTS, exist_ok=True)

plt.rcParams.update({"font.size": 9, "figure.dpi": 140, "lines.linewidth": 1.2})

VBOT = 1.80
CMP_THRESH = 1.65   # comparator output logic threshold (3.3 V rail)


def load_wave(path):
    """Load an ngspice wrdata CSV: time OUT CMPL CMPH INA FPAL."""
    d = np.loadtxt(path, skiprows=1)
    if d.shape[1] < 4:
        raise ValueError(f"{path}: expected >=4 columns, got {d.shape[1]}")
    t_ns = d[:, 0] * 1e9
    return t_ns, d[:, 1], d[:, 2], d[:, 3]


def tot_and_lead(t_ns, cmp_v, thresh=CMP_THRESH):
    """Time-over-threshold and leading-edge time from a comparator trace."""
    low = cmp_v < thresh
    if not np.any(low):
        return np.nan, np.nan
    idx = np.where(low)[0]
    return t_ns[idx[-1]] - t_ns[idx[0]], t_ns[idx[0]]


def main():
    npes, files = [], {}
    for f in sorted(glob.glob(os.path.join(RESULTS, "wave_dual_n*.csv"))):
        n = int(os.path.basename(f)[len("wave_dual_n"):-len(".csv")])
        npes.append(n)
        files[n] = f
    npes.sort()
    if not npes:
        sys.exit("ERROR: no results/wave_dual_n*.csv found. Run ./run_sweeps.sh "
                 "first — this analyzer does not synthesize data.")

    data = {n: load_wave(files[n]) for n in npes}

    # 1. Pulse family
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 5.5), sharex=True)
    colors = plt.cm.viridis(np.linspace(0.15, 0.95, len(npes)))
    for n, c in zip(npes, colors):
        t, vo, vl, vh = data[n]
        ax1.plot(t, vo, color=c, label=f"{n} p.e.")
        ax2.plot(t, vl, color=c, lw=0.9)
    ax1.axhline(1.767, color="crimson", ls="--", lw=0.8, label="low thr (~3 p.e.)")
    ax1.axhline(1.580, color="darkorange", ls="--", lw=0.8, label="high thr (~20 p.e.)")
    ax1.axhline(VBOT, color="0.5", ls=":", lw=0.7)
    ax1.set_ylabel("TIA OUT (V)")
    ax1.set_title("Muon3 AFE, ngspice (MicroFC-30035: 850 pF, tau=82 ns; OPA858 Rf=2k)")
    ax1.legend(ncol=3, fontsize=7)
    ax1.grid(alpha=0.3)
    ax2.set_ylabel("CMPL (low)")
    ax2.set_xlabel("Time (ns)")
    ax2.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "muon3_pulse_family.png"))
    plt.close(fig)
    print("Saved plots/muon3_pulse_family.png")

    # 2. ToT vs NPE + log fit; 3. time-walk; 4. amplitude
    ns = np.array(npes, dtype=float)
    tots, leads, amps = [], [], []
    for n in npes:
        t, vo, vl, _ = data[n]
        tot, lead = tot_and_lead(t, vl)
        tots.append(tot)
        leads.append(lead)
        amps.append((VBOT - vo.min()) * 1000.0)  # mV below baseline
    tots, leads, amps = map(np.array, (tots, leads, amps))

    mask = np.isfinite(tots) & (ns >= 3)
    fit = None
    if mask.sum() >= 3:
        p = np.polyfit(np.log(ns[mask]), tots[mask], 1)
        fit = {"a": float(p[0]), "b": float(p[1]),
               "form": "ToT_ns = a*ln(NPE) + b",
               "fit_range_npe": [float(ns[mask].min()), float(ns[mask].max())],
               "source": "ngspice afe_dual_threshold.cir rev2 "
                         "(CT=850p, TAUD=82n, Rf=2k, Cf=3.3p, low thr 33 mV)"}
        print(f"ToT fit: {p[0]:.2f} * ln(NPE) + {p[1]:.1f} ns")
        with open(os.path.join(RESULTS, "tot_fit.json"), "w") as fh:
            json.dump(fit, fh, indent=1)

    fig, ax = plt.subplots(figsize=(6.5, 4))
    ax.semilogx(ns, tots, "o-", color="#1565c0", ms=6, label="ToT (low thr)")
    if fit:
        nfit = np.logspace(np.log10(2), np.log10(150), 50)
        ax.semilogx(nfit, fit["a"] * np.log(nfit) + fit["b"], "--",
                    color="#e65100",
                    label=f"fit: {fit['a']:.1f} ln(NPE) {fit['b']:+.1f} ns")
    ax.set_xlabel("NPE")
    ax.set_ylabel("Time-over-Threshold (ns)")
    ax.set_title("Muon3 dual-threshold ToT characteristic (ngspice)")
    ax.legend()
    ax.grid(alpha=0.3, which="both")
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "muon3_tot_vs_npe.png"))
    plt.close(fig)
    print("Saved plots/muon3_tot_vs_npe.png")

    # Time-walk: leading-edge shift relative to the largest pulse
    fig, ax = plt.subplots(figsize=(6, 3.8))
    ref = leads[np.isfinite(leads)][-1] if np.any(np.isfinite(leads)) else 0
    ax.semilogx(ns, leads - ref, "o-", color="#6a1b9a")
    ax.set_xlabel("NPE")
    ax.set_ylabel("Leading-edge shift (ns)")
    ax.set_title("Time-walk at the low threshold (rel. largest pulse)")
    ax.grid(alpha=0.3, which="both")
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "muon3_timewalk.png"))
    plt.close(fig)
    print("Saved plots/muon3_timewalk.png")

    fig, ax = plt.subplots(figsize=(6, 3.8))
    ax.loglog(ns, amps, "s-", color="#2e7d32")
    ax.set_xlabel("NPE")
    ax.set_ylabel("Peak amplitude (mV below baseline)")
    ax.set_title("TIA output swing vs NPE (ngspice)")
    ax.grid(alpha=0.3, which="both")
    fig.tight_layout()
    fig.savefig(os.path.join(PLOTS, "muon3_amplitude.png"))
    plt.close(fig)
    print("Saved plots/muon3_amplitude.png")

    # 5. Threshold scan (optional files)
    vth_files = sorted(glob.glob(os.path.join(RESULTS, "wave_dual_vth*.csv")))
    if vth_files:
        vths, vtots = [], []
        for f in vth_files:
            v = float(os.path.basename(f)[len("wave_dual_vth"):-len(".csv")])
            t, vo, vl, _ = load_wave(f)
            tot, _ = tot_and_lead(t, vl)
            vths.append((VBOT - v) * 1000)  # threshold depth in mV
            vtots.append(tot)
        order = np.argsort(vths)
        vths, vtots = np.array(vths)[order], np.array(vtots)[order]
        fig, ax = plt.subplots(figsize=(6, 3.8))
        ax.plot(vths, vtots, "d-", color="#00838f")
        ax.set_xlabel("Low threshold depth below baseline (mV)")
        ax.set_ylabel("ToT (ns) at NPE=30")
        ax.set_title("ToT vs low-threshold setting (ngspice)")
        ax.grid(alpha=0.3)
        fig.tight_layout()
        fig.savefig(os.path.join(PLOTS, "muon3_threshold_scan.png"))
        plt.close(fig)
        print("Saved plots/muon3_threshold_scan.png")

    # 6. Cable comparison (optional file)
    cable_f = os.path.join(RESULTS, "cable_compare.csv")
    if os.path.exists(cable_f):
        d = np.loadtxt(cable_f, skiprows=1)
        t = d[:, 0] * 1e9
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.plot(t, d[:, 1], label="direct at panel (OUTA)", color="#1565c0")
        ax.plot(t, d[:, 2], label="through 50 cm cable (OUTB)",
                color="#e65100", ls="--")
        ax.set_xlabel("Time (ns)")
        ax.set_ylabel("TIA OUT (V)")
        ax.set_title("50 cm hybrid-cable effect on the AFE pulse (NPE=30)")
        ax.legend()
        ax.grid(alpha=0.3)
        fig.tight_layout()
        fig.savefig(os.path.join(PLOTS, "muon3_cable_compare.png"))
        plt.close(fig)
        print("Saved plots/muon3_cable_compare.png")

    # Summary table for the report
    print("\n NPE   amp(mV)  ToT(ns)  lead(ns)")
    for n, a, tt, ld in zip(npes, amps, tots, leads):
        print(f"{n:5.0f}  {a:7.1f}  {tt:7.1f}  {ld:8.2f}")
    summary = {
        "npe": [float(x) for x in ns],
        "amplitude_mV": [round(float(x), 2) for x in amps],
        "tot_ns": [None if not np.isfinite(x) else round(float(x), 2) for x in tots],
        "lead_ns": [None if not np.isfinite(x) else round(float(x), 2) for x in leads],
    }
    with open(os.path.join(RESULTS, "afe_summary.json"), "w") as fh:
        json.dump(summary, fh, indent=1)
    print("\nWrote results/afe_summary.json and results/tot_fit.json")


if __name__ == "__main__":
    main()
