#!/usr/bin/env python3
"""
coincidence_rates.py
Simple Monte-Carlo style rate and coincidence estimator for Muon3.
Uses mean p.e. per muon from Geant4 or measurement.

Falls back to pure Python random if numpy unavailable.
"""
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    import random, math
    HAS_NUMPY = False
    print("numpy not available - using stdlib fallback")

def simulate_station(muons_per_sec=120, dark_rate_hz=800, p_efficiency=0.92,
                     npe_mean=18, npe_sigma=6, thr=3.0, n_events=20000):
    """Very rough Poisson + normal light yield model."""
    detected = 0
    total_muons = 0

    if HAS_NUMPY:
        rng = np.random.default_rng(42)
        singles = rng.poisson(muons_per_sec, n_events)
        for m in singles:
            total_muons += m
            for _ in range(int(m)):
                npe = max(0.0, rng.normal(npe_mean, npe_sigma))
                if npe >= thr:
                    detected += 1
    else:
        for _ in range(n_events):
            m = max(0, int(random.gauss(muons_per_sec, muons_per_sec**0.5)))
            total_muons += m
            for __ in range(m):
                npe = max(0.0, random.gauss(npe_mean, npe_sigma))
                if npe >= thr:
                    detected += 1

    eff = detected / total_muons if total_muons > 0 else 0.0
    dark_acc = dark_rate_hz * 1e-7

    print(f"Muon rate input: {muons_per_sec} /s   events={n_events}")
    print(f"Per-muon detection eff @ {thr} p.e. thr: {eff*100:.1f} %")
    print(f"Rough accidental contribution (single station): {dark_acc*100:.3f} %")
    return eff

if __name__ == "__main__":
    for thr in [2.0, 3.0, 4.5]:
        simulate_station(thr=thr)
