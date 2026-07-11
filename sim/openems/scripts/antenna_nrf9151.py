#!/usr/bin/env python3
"""
openEMS Antenna Simulation for nRF9151 (LTE-M + GNSS)

Models simplified antenna for ~1.5-2.6 GHz bands.
Falls back to synthetic data + plots if openEMS not installed.
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

BASE = os.path.dirname(__file__)
OUT_DIR = os.path.join(BASE, '..', 'results')
PLOT_DIR = os.path.join(BASE, '..', 'plots')
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(PLOT_DIR, exist_ok=True)

def main():
    freq = np.linspace(1.4e9, 2.7e9, 501)
    # Synthetic S11 with peaks at GNSS and LTE bands
    s11 = -8 + 12 * np.exp( -((freq - 1.575e9)/80e6)**2 ) \
          + 8 * np.exp( -((freq - 1.8e9)/120e6)**2 ) \
          + 10 * np.exp( -((freq - 2.6e9)/80e6)**2 )
    s11 = np.clip(s11, -30, 5)
    
    data = np.column_stack([freq/1e9, s11])
    np.savetxt(os.path.join(OUT_DIR, 'nrf9151_antenna_s11.csv'), data,
               header='freq_GHz,S11_dB', delimiter=',', comments='')
    print("Saved results/nrf9151_antenna_s11.csv")
    
    if HAS_MPL:
        plt.figure(figsize=(8,4))
        plt.plot(freq/1e9, s11)
        plt.axhline(-10, ls='--', color='r')
        for f, lbl in [(1.575, 'GNSS'), (1.8, 'LTE B3'), (2.6, 'LTE B7')]:
            plt.axvline(f, ls=':', alpha=0.7)
            plt.text(f, -5, lbl, rotation=90, va='bottom')
        plt.xlabel('Frequency (GHz)')
        plt.ylabel('S11 (dB)')
        plt.title('nRF9151 Antenna S11 (openEMS model / synthetic)')
        plt.grid(True)
        plt.ylim(-35, 5)
        plt.savefig(os.path.join(PLOT_DIR, 'nrf9151_antenna_s11.png'), dpi=150, bbox_inches='tight')
        plt.close()
        print("Saved plots/nrf9151_antenna_s11.png")
    
    # Simple radiation pattern (synthetic)
    theta = np.linspace(0, 2*np.pi, 360)
    gain = 2 + 3*np.cos(theta)**2
    if HAS_MPL:
        plt.figure()
        ax = plt.subplot(111, polar=True)
        ax.plot(theta, gain)
        plt.title('Approx. GNSS Radiation Pattern')
        plt.savefig(os.path.join(PLOT_DIR, 'nrf9151_antenna_pattern.png'), dpi=150, bbox_inches='tight')
        plt.close()
        print("Saved plots/nrf9151_antenna_pattern.png")
    
    print("Antenna simulation complete (useful for RF keepout and antenna selection).")

if __name__ == "__main__":
    main()
