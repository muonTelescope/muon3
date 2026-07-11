#!/usr/bin/env python3
"""sipm_to_tot.py - Parametrized ToT vs NPE (from ngspice fit or measurement)."""
import numpy as np
import matplotlib.pyplot as plt

def tot_from_npe(npe, a=14.6, b=-7.5, clip=92):
    tot = a * np.log(np.maximum(npe, 0.5)) + b
    tot = np.where(npe > clip, tot + 8*np.log(npe/clip), tot)  # crude saturation extension
    return np.clip(tot, 0, None)

if __name__ == "__main__":
    n = np.logspace(0, 3, 200)
    plt.semilogx(n, tot_from_npe(n), label="OPA858 + dual TLV (fit)")
    plt.xlabel("NPE"); plt.ylabel("ToT @ 3 p.e. threshold (ns)")
    plt.grid(alpha=0.3); plt.legend()
    plt.title("Muon3 parametrized ToT model")
    plt.savefig("tot_model.png", dpi=130)
    print("Saved tot_model.png")
    print("Example: 30 p.e. ->", tot_from_npe(30), "ns")
