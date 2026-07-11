#!/usr/bin/env python3
"""
geant4_panel_standin.py
Lightweight stand-in OR driver for the real Geant4 muon + optical simulation.
If a real built muon_panel binary is found (after full Geant4 + example build),
it will run the real simulation to generate authentic hits.csv.
Otherwise falls back to a fast synthetic model tuned to project expectations.
Outputs:
- geant4/hits.csv (compatible with real Geant4)
- plots/
- summary numbers for reports
"""
import os
import subprocess
import numpy as np
import matplotlib.pyplot as plt

BASE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE))
OUT = os.path.join(PROJECT_ROOT, "sim", "geant4")
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(OUT, "plots"), exist_ok=True)

REAL_BINARY_CANDIDATES = [
    os.path.join(PROJECT_ROOT, "sim", "geant4", "build", "muon_panel"),
    os.path.join(PROJECT_ROOT, "sim", "geant4", "build", "muon_panel.exe"),
]

def find_real_binary():
    for p in REAL_BINARY_CANDIDATES:
        if os.path.exists(p) and os.access(p, os.X_OK):
            return p
    return None

np.random.seed(123)

def simulate_panel(n_events=2000):
    # MIP dE ~ 2 MeV in 1cm plastic
    dedx = 2.0  # MeV
    scint_yield = 10000  # ph/MeV
    trapping = 0.035     # effective collection + WLS + transport eff per end (loop single end)
    pde = 0.40

    xs = np.random.uniform(-90, 90, n_events)
    ys = np.random.uniform(-90, 90, n_events)
    # Simple efficiency map: lower in corners, best near fiber
    dist_to_fiber = np.minimum(np.abs(xs), 90) * 0.3 + np.random.normal(0, 5, n_events)**2 * 0.001
    coll_eff = trapping * (1 - 0.4 * np.clip(dist_to_fiber / 80, 0, 1))

    n_photons_prod = np.random.poisson(dedx * scint_yield, n_events)
    n_detected = np.random.binomial(n_photons_prod, coll_eff * pde)

    # Arrival time spread (ns) - fiber transit + decay
    t_mean = 8 + np.abs(xs) * 0.03 + np.random.exponential(2.5, n_events)
    t_sigma = 1.5 + np.random.uniform(0, 1, n_events) * 2

    data = np.column_stack([
        np.arange(n_events),
        xs, ys, np.full(n_events, -5.0),   # z
        np.full(n_events, dedx),
        n_photons_prod,
        (n_photons_prod * coll_eff * 0.85).astype(int),  # "shifted"
        n_detected
    ])
    header = "event,x_mm,y_mm,z_mm,edep_MeV,photons_prod,photons_shifted,photons_detected"
    np.savetxt(os.path.join(OUT, "hits.csv"), data, delimiter=",", header=header, comments="")

    # Summary stats
    print(f"Events: {n_events}")
    print(f"Mean produced: {n_photons_prod.mean():.0f}")
    print(f"Mean detected p.e.: {n_detected.mean():.2f}  (sigma {n_detected.std():.2f})")
    print(f"Median detected: {np.median(n_detected):.1f}")
    eff = n_detected.mean() / (dedx * scint_yield * trapping * pde)
    print(f"Effective overall eff (rel): {eff:.3f}")

    # Plots
    plt.figure(figsize=(6,5))
    plt.scatter(xs, ys, c=n_detected, s=8, cmap="viridis", alpha=0.7)
    plt.colorbar(label="Detected p.e.")
    plt.xlabel("x (mm)"); plt.ylabel("y (mm)")
    plt.title("Light yield map (stand-in Geant4)")
    plt.tight_layout()
    plt.savefig(os.path.join(OUT, "plots", "yield_map.png"), dpi=130)
    plt.close()

    plt.figure(figsize=(6,4))
    plt.hist(n_detected, bins=40, color="#1565c0", alpha=0.8)
    plt.xlabel("Detected photoelectrons")
    plt.ylabel("Events")
    plt.title("Muon p.e. spectrum (MicroFC-30035 + loop fiber)")
    plt.tight_layout()
    plt.savefig(os.path.join(OUT, "plots", "pe_spectrum.png"), dpi=130)
    plt.close()

    # Time profile example
    t = np.linspace(0, 40, 200)
    prof = np.exp(-(t-8)/4.5) * (t>3)
    prof /= prof.max()
    plt.figure(figsize=(6,3.5))
    plt.plot(t, prof, color="#e65100")
    plt.xlabel("Time (ns)"); plt.ylabel("Relative intensity")
    plt.title("Typical WLS photon arrival profile at SiPM")
    plt.tight_layout()
    plt.savefig(os.path.join(OUT, "plots", "time_profile.png"), dpi=130)
    plt.close()

    return n_detected.mean()

def run_real_geant4(n_events=500, macro="run.mac"):
    """Run the real built muon_panel if available."""
    binary = find_real_binary()
    if not binary:
        return False, "No real muon_panel binary found"

    macro_path = os.path.join(PROJECT_ROOT, "sim", "geant4", "macros", macro)
    if not os.path.exists(macro_path):
        macro_path = os.path.join(PROJECT_ROOT, "sim", "geant4", "macros", "run.mac")

    # Temporarily cd so it can find macros if relative
    cmd = [binary, "-m", macro_path]
    print(f"Running REAL Geant4 simulation: {' '.join(cmd)}")
    try:
        # The real app may write to cwd or have its own output. We run it and then move hits.csv if produced.
        result = subprocess.run(cmd, cwd=os.path.dirname(binary), capture_output=True, text=True, timeout=300)
        print(result.stdout[-500:] if result.stdout else "")
        if result.returncode != 0:
            print("Real run stderr:", result.stderr[-300:] if result.stderr else "")
            return False, "Real simulation returned non-zero"

        # The C++ code writes muon_panel_hits.csv in current dir of the binary or cwd.
        possible_hits = [
            os.path.join(os.path.dirname(binary), "muon_panel_hits.csv"),
            os.path.join(os.getcwd(), "muon_panel_hits.csv"),
            os.path.join(OUT, "muon_panel_hits.csv"),
        ]
        for p in possible_hits:
            if os.path.exists(p):
                # Move/rename to standard location
                target = os.path.join(OUT, "hits.csv")
                if p != target:
                    os.replace(p, target)
                print(f"Real hits.csv captured to {target}")
                return True, target
        return False, "Real run completed but no hits.csv found (check app output logic)"
    except Exception as e:
        return False, f"Failed to run real binary: {e}"

if __name__ == "__main__":
    real_bin = find_real_binary()
    if real_bin:
        success, info = run_real_geant4(300)
        if success:
            print("Used REAL Geant4 output.")
            # Optionally post-process or just use the produced hits.csv
            print("See sim/geant4/hits.csv (real data)")
            # Still generate some plots from it if wanted
            # For now just exit
            exit(0)
        else:
            print(f"Real run failed ({info}), falling back to synthetic stand-in.")

    mean_pe = simulate_panel(2500)
    print(f"Geant4 stand-in complete. Mean p.e. ~ {mean_pe:.1f}")
    print("See sim/geant4/hits.csv and plots/")
