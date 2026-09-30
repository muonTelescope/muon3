"""Plot the openEMS runs (emi_openems.py) -> docs/sim_emi.png. Usage: python sim/plot_emi.py DATADIR"""
import json, os, sys
import numpy as np
import h5py
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt

D = sys.argv[1] if len(sys.argv) > 1 else "."
HERE = os.path.dirname(os.path.abspath(__file__))
names = {"none": "as built", "none-noisland": "solid L2 under the BME island", "can": "metal can over each AFE",
         "abs": "printed ABS cavity"}
runs = {k: json.load(open(os.path.join(D, f"emi_{k}.json"))) for k in names if os.path.exists(os.path.join(D, f"emi_{k}.json"))}

fig = plt.figure(figsize=(11, 5.4), dpi=150)
ax = fig.add_subplot(2, 1, 1)
h5 = os.path.join(D, "emi_none", "Ef.h5")
if os.path.exists(h5):
    with h5py.File(h5) as f:
        x, y = f["Mesh/x"][:], f["Mesh/y"][:]
        v = f["FieldData/FD/f0"][()]                                        # N, X, Y, Z (complex)
        if v.dtype.names: v = v["real"] + 1j * v["imag"]
        e = np.sqrt(np.sum(np.abs(v) ** 2, axis=0))[:, :, 0].T                # |E| on the plane, (y, x)
    im_ = ax.pcolormesh(x * 1e3 if x.max() < 1 else x, y * 1e3 if y.max() < 1 else y, 20 * np.log10(e / e.max() + 1e-9),
                        vmin=-50, vmax=0, cmap="magma", shading="auto")
    ax.set_aspect("equal"); ax.invert_yaxis()
    fig.colorbar(im_, ax=ax, label="dB re max")
ax.set(title="2.44 GHz field 1.2 mm above the parts, external antenna on the lid (as built)", xlabel="x (mm)", ylabel="y (mm)")

bx = fig.add_subplot(2, 1, 2)
ch = np.arange(4)
wd = 0.8 / max(1, len(runs))
for i, (k, r) in enumerate(runs.items()):
    v = [r[f"v_tia{c}_mV_at_100mW"] for c in ch]
    bx.bar(ch + i * wd - 0.4 + wd / 2, v, wd, label=names[k])
bx.set(xticks=ch, xticklabels=[f"ch{c}" for c in ch], ylabel="mV peak at the TIA input",
       title="Antenna -> AFE input coupling at 2.44 GHz, +20 dBm accepted")
bx.legend(fontsize=7); bx.grid(axis="y", alpha=.3)
fig.tight_layout(); fig.savefig(os.path.join(HERE, "..", "docs", "sim_emi.png"))
print({k: [round(r[f"v_tia{c}_mV_at_100mW"], 1) for c in ch] + [round(r["s11_at_f0_db"], 1)] for k, r in runs.items()})
