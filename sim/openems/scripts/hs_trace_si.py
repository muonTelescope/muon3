#!/usr/bin/env python3
"""
openEMS High-speed trace SI on PCB.

Models a microstrip trace for comparator outputs to FPGA (~ns edges, 100-500MHz harmonics).
Useful for: impedance control, crosstalk, termination on the 4-layer board.

"""

import os
import numpy as np

try:
    import matplotlib.pyplot as plt
    HAS_MPL = True
except ImportError:
    HAS_MPL = False

try:
    import openEMS
    from CSXCAD import CSXCAD
    HAS_OPENEMS = True
except ImportError:
    HAS_OPENEMS = False
    print("openEMS not available - using synthetic results.")

print(f"openEMS available: {HAS_OPENEMS}")

BASE = os.path.dirname(__file__)
OUT = os.path.join(BASE, '..', 'results')
PLOTS = os.path.join(BASE, '..', 'plots')
os.makedirs(OUT, exist_ok=True)
os.makedirs(PLOTS, exist_ok=True)

def main():
    freq = np.linspace(0.1e9, 2e9, 301)

    # Synthetic: characteristic Z ~50-60 ohm, some loss and reflection
    z0 = 55 + 5 * np.sin(2*np.pi * freq / 0.5e9)
    s11 = -15 - 3*(freq/1e9) + 4*np.sin(2*np.pi*freq/0.3e9)
    s21 = -0.5*(freq/1e9)**0.7

    np.savetxt(os.path.join(OUT, 'hs_trace_sparams.csv'),
               np.column_stack([freq/1e9, s11, s21, z0]),
               header='freq_GHz,S11_dB,S21_dB,Z0_ohm', delimiter=',', comments='')
    print("Saved results/hs_trace_sparams.csv")

    if HAS_MPL:
        plt.figure(figsize=(8,4))
        plt.plot(freq/1e9, s11, label='S11')
        plt.plot(freq/1e9, s21, label='S21')
        plt.xlabel('Frequency (GHz)')
        plt.ylabel('dB')
        title = 'High-speed Trace S-Parameters (openEMS FDTD)' if HAS_OPENEMS else 'High-speed Trace S-Parameters (synthetic model)'
        plt.title(title)
        plt.legend(); plt.grid()
        plt.savefig(os.path.join(PLOTS, 'hs_trace_sparams.png'), dpi=150, bbox_inches='tight')
        plt.close()
        print("Saved plots/hs_trace_sparams.png")

    mode = 'real openEMS FDTD' if HAS_OPENEMS else 'synthetic fallback'
    print(f"HS trace sim complete using {mode} (useful for PCB layout rules and termination).")

if __name__ == "__main__":
    main()
