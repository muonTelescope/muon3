"""Debug figure for the sPHENIX inner-HCal tile Geant4 model, from an HCAL_DEBUG=1 run (photon_fate.csv, photon_tracks.csv,
muon_panel_hits.csv).   python debug_photons.py RUNDIR TILE_MESH_JSON OUT.png [title]
Left   : tile outline, fiber centre line, coupler; paths of sampled WLS photons that reached the SiPM windows (coloured), and
         the points where sampled guided photons left the fiber (grey).
Middle : the loss funnel, photons per muon.
Right  : how every optical photon of the run ended, by creator."""
import collections, csv, json, sys
import numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
run, mesh, out = sys.argv[1:4]
title = sys.argv[4] if len(sys.argv) > 4 else ""
P = json.load(open(mesh))["params"]
fate = list(csv.DictReader(open(f"{run}/photon_fate.csv")))
hits = list(csv.DictReader(open(f"{run}/muon_panel_hits.csv")))
nfate = len({r["event"] for r in fate})
trk = collections.defaultdict(list)
for r in csv.DictReader(open(f"{run}/photon_tracks.csv")): trk[r["track"]].append(r)
FIB = {"fiber_core", "fiber_clad"}

# ---- funnel (photons per muon; only the first nfate events carry the fate log) ----
prod = np.mean([float(h["photons_prod"]) for h in hits[:nfate]])
cap = sum(1 for r in fate if r["creator"] == "Scintillation" and r["pre"] == "fiber_core" and r["proc"] == "OpWLS") / nfate
emit = sum(1 for r in fate if r["creator"] == "OpWLS") / nfate
sipm = sum(1 for r in fate if r["pre"].startswith("SiPM")) / nfate
det = np.mean([float(h["photons_detected"]) for h in hits])
trapped = sum(1 for r in fate if r["creator"] == "OpWLS" and r["pre"] == "fiber_core" and r["proc"] in ("OpAbsorption",)) / nfate + sipm
stages = [("scintillation photons", prod), ("absorbed by the fiber (WLS)", cap), ("re-emitted in the fiber", emit), ("reached a SiPM window", sipm), ("detected (PDE 25 %)", det)]

fig, ax = plt.subplots(1, 3, figsize=(15, 6.4), dpi=150, gridspec_kw={"width_ratios": [1.05, 0.9, 1.0]})
a, b, c = ax
h = np.array(P["hull_xy"] + [P["hull_xy"][0]]); a.fill(h[:, 0], h[:, 1], color="#e3edf6", ec="#5a7d99", lw=1)
fp = np.array(P["fiber_path_xy"]); a.plot(fp[:, 0], fp[:, 1], color="#2ca02c", lw=1.0, alpha=.8, label="fiber path")
bl = P["blocker"]; a.add_patch(plt.Rectangle((bl["cx"] - bl["sx"] / 2, P["bbox"]["ymax"]), bl["sx"], 6, color="k", label="coupler"))
n_tr = 0; grey = []
for v in trk.values():
    if v[0]["creator"] != "OpWLS": continue
    k = 0
    while k < len(v) and v[k]["vol"] in FIB: k += 1
    xy = np.array([[float(s["x"]), float(s["y"])] for s in v[:k + 1]])
    reached = any(s["vol"].startswith("SiPM") for s in v) or (k == len(v) and v[-1]["vol"] in FIB and float(v[-1]["y"]) > 190.9)
    if reached and len(xy) > 3 and n_tr < 25:
        a.plot(xy[:, 0], xy[:, 1], lw=1.2, alpha=.9, color=plt.cm.autumn(n_tr / 25)); n_tr += 1
    elif k >= 3: grey.append(xy[-1])
if grey: g = np.array(grey); a.scatter(g[:, 0], g[:, 1], s=6, c="#777", zorder=4, label=f"sampled guided photons leaving ({len(g)})")
a.set_aspect("equal"); a.set_xlabel("x (mm)"); a.set_ylabel("y (mm)"); a.legend(fontsize=7, loc="lower right")
a.set_title(f"guided photons that reached the SiPM ({n_tr} paths shown)", fontsize=9)
y = np.arange(len(stages))[::-1]
b.barh(y, [max(s[1], 0.05) for s in stages], color=["#9aa5b1", "#2ca02c", "#8bc34a", "#e6a000", "#d62728"])
for yy, (nm, val) in zip(y, stages): b.text(max(val, 0.05) * 1.15, yy, f"{val:,.1f}" if val < 100 else f"{val:,.0f}", va="center", fontsize=8)
b.set_yticks(y); b.set_yticklabels([s[0] for s in stages], fontsize=8); b.set_xscale("log"); b.set_xlim(0.5, 1e6)
b.set_xlabel("photons per muon (log)"); b.set_title("loss funnel", fontsize=9)
cnt = collections.Counter()
for r in fate:
    where = "SiPM" if r["pre"].startswith("SiPM") else ("coupler block" if "Blocker" in r["post"] else
        ("fiber" if r["pre"].startswith("fiber") else ("tile coating" if r["post"] == "DiffuseCoating" else
        ("tile bulk" if r["pre"] == "InnerHCalTile_PS" and r["post"] == "InnerHCalTile_PS" else "other"))))
    cnt[({"Scintillation": "scintillation", "OpWLS": "WLS re-emission"}.get(r["creator"], "Cerenkov"), where)] += 1
cats = ["tile coating", "tile bulk", "fiber", "coupler block", "SiPM", "other"]; cols = ["#c9c9c9", "#e0b060", "#2ca02c", "#333333", "#d62728", "#9467bd"]
crs = ["scintillation", "WLS re-emission", "Cerenkov"]; left = np.zeros(3)
for cat, col in zip(cats, cols):
    v = np.array([cnt[(cr, cat)] for cr in crs], float) / nfate; c.barh(crs, v, left=left, color=col, label=cat); left += v
c.set_xlabel("photons per muon"); c.set_title("where photons end", fontsize=9); c.legend(fontsize=7)
fig.suptitle(title, fontsize=10); fig.tight_layout(); fig.savefig(out)
print({k: round(v, 2) for k, v in stages})
