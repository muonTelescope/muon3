"""Plot the rev-2 bias simulations (run_hv2.sh output) -> docs/sim_hv.png. Usage: python sim/plot_hv.py DATADIR"""
import sys, os, numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
D = sys.argv[1] if len(sys.argv) > 1 else "."
fig, (a, b) = plt.subplots(1, 2, figsize=(10, 3.6), dpi=150)
for v, c in (("0", "C3"), ("1.0", "C1"), ("2.048", "C0")):
    d = np.loadtxt(os.path.join(D, f"hv_rev2_dac{v}.txt"))
    t, hv, tia = d[:, 0], d[:, 1], d[:, 5]
    k = slice(None, None, 20)
    a.plot(t[k] * 1e3, hv[k], c, lw=1, label=f"HV_TRIM {v} V → {hv[-2000:].mean():.1f} V")
    m = t > 0.100
    r = tia[m] - np.polyval(np.polyfit(t[m], tia[m], 2), t[m])   # remove the slow settling tail: switching ripple only
    b.plot((t[m] - 0.100) * 1e6, r * 1e3, c, lw=0.6, label=f"DAC {v} V: {np.ptp(r)*1e3:.3f} mV pk-pk")
a.axvline(10, color="k", ls=":", lw=0.8); a.text(10.5, 8, "HV_EN ↑", fontsize=8)
a.set(xlabel="time (ms)", ylabel="HV at the SMA shell (V)", title="Bias ramp: ≈4 V (USB 5 V − diode) while HV_EN low")
a.legend(fontsize=7, loc="lower right"); a.grid(alpha=.3)
b.set_xlim(0, 400)
b.set(xlabel="time (µs, steady state)", ylabel="TIA output ripple (mV)", title="Converter ripple seen by the TIA (1 p.e. ≈ 14 mV)")
b.legend(fontsize=7); b.grid(alpha=.3)
fig.tight_layout(); fig.savefig(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "sim_hv.png"))
