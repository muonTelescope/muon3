#!/usr/bin/env python3
"""Plot Geant4 results for sPHENIX Inner HCal tile assemblies."""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", type=Path, default=None)
    ap.add_argument("--out-dir", type=Path, default=ROOT / "figures")
    ap.add_argument("--tag", type=str, default="hcal_inner_tile")
    args = ap.parse_args()

    candidates = []
    if args.csv:
        candidates = [args.csv]
    else:
        candidates = [
            ROOT / "sim/geant4/build_hcal/muon_panel_hits.csv",
            ROOT / "sim/geant4/build_hcal/hcal_tile_hits.csv",
            ROOT / "sim/geant4/hcal_tile_hits.csv",
            ROOT / "sim/geant4/muon_panel_hits.csv",
        ]
    csv_path = next((p for p in candidates if p.exists()), None)
    if csv_path is None:
        raise SystemExit("No hits CSV found. Run hcal_tile first.")

    data = np.genfromtxt(csv_path, delimiter=",", names=True)
    edep = np.asarray(data["edep_MeV"], dtype=float)
    prod = np.asarray(data["photons_prod"], dtype=float)
    det = np.asarray(data["photons_detected"], dtype=float)
    x = np.asarray(data["x_mm"], dtype=float)
    y = np.asarray(data["y_mm"], dtype=float)

    args.out_dir.mkdir(parents=True, exist_ok=True)
    g4_plots = ROOT / "sim/geant4/plots"
    g4_plots.mkdir(parents=True, exist_ok=True)

    # 1) Energy deposit spectrum
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.hist(edep, bins=40, color="#2a9d8f", edgecolor="white", alpha=0.9)
    ax.axvline(np.mean(edep), color="#e76f51", ls="--", label=f"mean={np.mean(edep):.3f} MeV")
    ax.set_xlabel("Energy deposit in scintillator (MeV)")
    ax.set_ylabel("Events")
    ax.set_title("sPHENIX Inner HCal tile — MIP energy deposit (Geant4)")
    ax.legend()
    fig.tight_layout()
    for d in (args.out_dir, g4_plots):
        fig.savefig(d / f"{args.tag}_edep.png", dpi=160)
    plt.close(fig)

    # 2) Detected p.e. spectrum
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.hist(det, bins=40, color="#264653", edgecolor="white", alpha=0.9)
    ax.axvline(np.mean(det), color="#e9c46a", ls="--", label=f"mean={np.mean(det):.1f} p.e.")
    ax.set_xlabel("Detected photoelectrons (after PDE)")
    ax.set_ylabel("Events")
    ax.set_title("sPHENIX Inner HCal tile — SiPM yield (Geant4 optical)")
    ax.legend()
    fig.tight_layout()
    for d in (args.out_dir, g4_plots):
        fig.savefig(d / f"{args.tag}_pe.png", dpi=160)
    plt.close(fig)

    # 3) Position map of mean edep
    fig, ax = plt.subplots(figsize=(6.5, 5.5))
    hb = ax.hexbin(x, y, C=edep, reduce_C_function=np.mean, gridsize=25, cmap="viridis")
    cb = fig.colorbar(hb, ax=ax)
    cb.set_label("Mean edep (MeV)")
    ax.set_xlabel("x (mm)")
    ax.set_ylabel("y (mm)")
    ax.set_title("Inner HCal tile — mean edep vs impact position")
    ax.set_aspect("equal", adjustable="box")
    fig.tight_layout()
    for d in (args.out_dir, g4_plots):
        fig.savefig(d / f"{args.tag}_yield_map.png", dpi=160)
    plt.close(fig)

    # 4) Summary multi-panel
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.8))
    axes[0].hist(edep, bins=30, color="#2a9d8f", edgecolor="white")
    axes[0].set_title("Edep (MeV)")
    axes[1].hist(prod, bins=30, color="#457b9d", edgecolor="white")
    axes[1].set_title("Scint. photons (est.)")
    axes[2].hist(det, bins=30, color="#1d3557", edgecolor="white")
    axes[2].set_title("Detected p.e.")
    for ax in axes:
        ax.set_ylabel("Events")
    fig.suptitle(
        f"Geant4 Inner HCal tile results (N={len(edep)}, "
        f"⟨E⟩={np.mean(edep):.2f} MeV, ⟨p.e.⟩={np.mean(det):.1f})",
        fontsize=11,
    )
    fig.tight_layout()
    for d in (args.out_dir, g4_plots):
        fig.savefig(d / f"{args.tag}_summary.png", dpi=160)
    plt.close(fig)

    summary = {
        "n_events": int(len(edep)),
        "mean_edep_MeV": float(np.mean(edep)),
        "std_edep_MeV": float(np.std(edep)),
        "mean_pe": float(np.mean(det)),
        "std_pe": float(np.std(det)),
        "mean_photons_prod": float(np.mean(prod)),
        "csv": str(csv_path),
    }
    out_json = g4_plots / f"{args.tag}_summary.json"
    import json

    out_json.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    print(f"Figures written to {args.out_dir} and {g4_plots}")


if __name__ == "__main__":
    main()
