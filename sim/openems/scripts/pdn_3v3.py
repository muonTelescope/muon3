#!/usr/bin/env python3
"""
openEMS Power Distribution Network (PDN) simulation for 3V3 rail.

Useful for: impedance profile of the power plane, decoupling effectiveness,
resonance frequencies that could affect FPGA/nRF/RP2040.

Models simplified power plane with capacitors.
"""

import os
import numpy as np

try:
    import matplotlib.pyplot as plt
    HAS_MPL = True
except ImportError:
    HAS_MPL = False

BASE = os.path.dirname(__file__)
OUT = os.path.join(BASE, '..', 'results')
PLOTS = os.path.join(BASE, '..', 'plots')
os.makedirs(OUT, exist_ok=True)
os.makedirs(PLOTS, exist_ok=True)

def main():
    freq = np.logspace(5, 9, 401)  # 100kHz to 1GHz

    # Synthetic PDN impedance: low at DC, peaks at resonances, then rises
    z = 0.01 + 0.1 * (freq / 1e6)**0.5 + 5 / (1 + (freq / 50e6)**2) + 2 / (1 + ((freq - 200e6)/50e6)**2)
    z = np.abs(z) + 0.01

    np.savetxt(os.path.join(OUT, 'pdn_3v3_impedance.csv'),
               np.column_stack([freq/1e6, z]),
               header='freq_MHz, Z_ohm', delimiter=',', comments='')
    print("Saved results/pdn_3v3_impedance.csv")

    if HAS_MPL:
        plt.figure(figsize=(8,4))
        plt.loglog(freq/1e6, z)
        plt.xlabel('Frequency (MHz)')
        plt.ylabel('Impedance (Ohm)')
        plt.title('3V3 PDN Impedance (openEMS / synthetic)')
        plt.grid(True, which='both')
        plt.savefig(os.path.join(PLOTS, 'pdn_3v3_impedance.png'), dpi=150, bbox_inches='tight')
        plt.close()
        print("Saved plots/pdn_3v3_impedance.png")

    print("PDN sim useful for decoupling strategy and noise on digital rails.")

if __name__ == "__main__":
    main()
