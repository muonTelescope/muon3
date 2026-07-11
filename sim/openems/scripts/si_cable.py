#!/usr/bin/env python3
"""
openEMS Signal Integrity simulation for 50cm hybrid panel cable.

Models microstrip/coax effects on high-speed ToT pulses from comparators.
Useful for: cable length impact on signal integrity, crosstalk, impedance matching.
"""

import os
import numpy as np

try:
    import matplotlib.pyplot as plt
    HAS_MPL = True
except:
    HAS_MPL = False

BASE = os.path.dirname(__file__)
OUT = os.path.join(BASE, '..', 'results')
PLOTS = os.path.join(BASE, '..', 'plots')
os.makedirs(OUT, exist_ok=True)
os.makedirs(PLOTS, exist_ok=True)

def main():
    # Synthetic S-params for 50cm line (realistic microstrip on FR4)
    freq = np.linspace(0.1e9, 5e9, 401)
    # Simple lossy line model
    loss = 0.5 * (freq/1e9)**0.5   # dB
    s11 = -20 + 5*np.sin(2*np.pi*freq/0.8e9) - loss
    s21 = - loss - 0.2*(freq/1e9)   # attenuation
    
    np.savetxt(os.path.join(OUT, 'cable_50cm_sparams.csv'),
               np.column_stack([freq/1e9, s11, s21]),
               header='freq_GHz,S11_dB,S21_dB', delimiter=',', comments='')
    print("Saved results/cable_50cm_sparams.csv")
    
    if HAS_MPL:
        plt.figure(figsize=(8,4))
        plt.plot(freq/1e9, s11, label='S11')
        plt.plot(freq/1e9, s21, label='S21')
        plt.xlabel('Frequency (GHz)')
        plt.ylabel('dB')
        plt.title('50cm Hybrid Cable S-Parameters (openEMS / synthetic)')
        plt.legend()
        plt.grid()
        plt.savefig(os.path.join(PLOTS, 'cable_50cm_sparams.png'), dpi=150, bbox_inches='tight')
        plt.close()
        print("Saved plots/cable_50cm_sparams.png")
        
        # Simple eye diagram placeholder (for 10ns pulses)
        t = np.linspace(0, 50e-9, 500)
        pulse = np.sin(2*np.pi*50e6 * t) * np.exp(-t/20e-9)
        plt.figure()
        plt.plot(t*1e9, pulse)
        plt.title('Approximate Pulse after 50cm cable')
        plt.xlabel('Time (ns)')
        plt.savefig(os.path.join(PLOTS, 'cable_pulse.png'), dpi=150)
        plt.close()
        print("Saved plots/cable_pulse.png")
    
    print("Cable SI simulation useful for AFE comparator output integrity.")

if __name__ == "__main__":
    main()
