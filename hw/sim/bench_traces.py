"""Bench board copper checks from the routed tracks (widths, lengths, layers, positions):

1. DC IR drop and trace heating on 5V / 3V3 / 3V3A / 1V2: every track piece becomes a resistor (rho L / w t, per-layer
   copper), every load pad a current sink at its PEAK current [EST table below], solved by ngspice (.op).
   Trace heating from IPC-2221 (I = k dT^0.44 A^0.725, k 0.048 outer / 0.024 inner).
2. Crosstalk screen into the TIA inputs (SIG0..3) and the shared injection node INJ_D: every aggressor segment near a SIG segment, on the same layer
   (classic microstrip rule Cm = C' / (1 + (d/h)^2)) or broadside L3<->L4 (no plane between them, 0.21 mm apart:
   parallel-plate with fringing [EST x2]). Charge per aggressor edge Q = Cm dV, in photo-electrons (QPE 36.8 fC,
   S12572-015 at 2.3e5 gain). The worst pairs go to bench_xtalk_openems.py for a full-wave check.
3. Transmission-line table for the signal classes on each layer.
Writes out/bench/sim/traces.json and docs/bench/sim_traces.png. Usage: python3 hw/sim/bench_traces.py
"""
import json, math, os, subprocess, collections
import numpy as np
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from bench_copper import B, PARTS, OUT, DOCS, T_CU, LAYER, by_net, graph, microstrip, ref_height, ER_PREPREG

QPE = 36.8e-15
EPS0 = 8.854e-12
# ── peak load currents per part on each rail, A [EST: datasheet typ/max, ESP32-S3 Wi-Fi TX burst] ──
LOADS = {
    "5V":   {"source": ["J1"], "C6186": 0.55, "C485517": 0.045, "C100023": 0.14, "C2687116": 0.0001},   # AMS1117 in, TLV757 in, MC34063 Ipk
    "3V3":  {"source": ["U4"], "C2913198": 0.50, "C2678152": 0.010, "C22456010": 0.020, "C7836": 0.066, "C160404": 0.10},  # ESP32 TX, FPGA IO, 1V2 LDO, LED drive into 49.9R, QT
    "3V3A": {"source": ["U5"], "C183100": 0.011, "C20613263": 0.0011, "C478093": 0.0008},
    "1V2":  {"source": ["U6"], "C2678152": 0.020},
}

def solve(net, load=None):
    """DC solve of one rail's copper with ngspice. load: {lcsc: amps} (default LOADS[net]). Returns (edges, volt(node), loads)."""
    load = load or LOADS[net]
    edges, _ = graph(net)
    pads = [p for p in B["pads"] if p["net"] == net]
    names = {}
    def nm(n):
        if n not in names: names[n] = f"n{len(names) + 1}"
        return names[n]
    lines = [f"* {net} copper network from board.json", f"Vsrc src 0 {dict(zip(['5V', '3V3', '3V3A', '1V2'], [5.0, 3.3, 3.3, 1.2]))[net]}"]
    for i, (a, b, R, t) in enumerate(edges):
        if a != b: lines.append(f"R{i} {nm(a)} {nm(b)} {R:.6g}")
    src_ref = LOADS[net]["source"][0]
    for p in pads:
        if p["ref"] == src_ref: lines.append(f"Rs_{p['num']} src {nm(('pad', p['ref'], p['num']))} 1e-6")
    loads = []
    by_part = collections.defaultdict(list)
    for p in pads:
        if p["ref"] != src_ref: by_part[p["ref"]].append(p)
    for ref, ps in by_part.items():
        I = load.get(PARTS[ref]["lcsc"], 0.0)
        if not I: continue
        for p in ps:
            lines.append(f"I_{ref}_{p['num']} {nm(('pad', ref, p['num']))} 0 {I / len(ps):.6g}"); loads.append((ref, p["num"], I / len(ps)))
    # every node gets a 1 Gohm leak so isolated pad islands (unrouted decoupling pads etc.) do not make the matrix singular
    for n in names.values(): lines.append(f"Rleak_{n} {n} 0 1e9")
    cir = os.path.join(OUT, f"ir_{net}.cir")
    out = os.path.join(OUT, f"ir_{net}.txt")
    lines += [".control", "op", f"print all > {out}", ".endc", ".end"]
    open(cir, "w").write("\n".join(lines) + "\n")
    subprocess.run(["ngspice", "-b", cir], capture_output=True, check=True)
    V = {}
    for ln in open(out):
        if "=" in ln:
            k, v = ln.split("="); V[k.strip()] = float(v)
    volt = lambda n: V.get(nm(n), V.get(f"v({nm(n)})", float("nan")))
    return edges, volt, loads

def ir_drop(net):
    edges, volt, loads = solve(net)
    Vnom = dict(zip(["5V", "3V3", "3V3A", "1V2"], [5.0, 3.3, 3.3, 1.2]))[net]
    worst = {}
    for ref, num, I in loads:
        dv = Vnom - volt(("pad", ref, num))
        worst[ref] = max(worst.get(ref, 0), dv)
    # per-piece current and IPC-2221 chart rise (an infinitely long trace: far too high for short necks; bench_thermal.py
    # models the heat flow into the wide copper and the board)
    heat = []
    for a, b, R, t in edges:
        if a == b or t is None: continue
        I = abs(volt(a) - volt(b)) / R
        area_mil2 = (t["w"] / 0.0254) * (T_CU[t["layer"]] / 25.4e-6)
        k = 0.048 if t["layer"] in (0, 3) else 0.024
        dT = (I / (k * area_mil2 ** 0.725)) ** (1 / 0.44) if I > 0 else 0
        heat.append({"layer": LAYER[t["layer"]], "w": t["w"], "I": I, "dT": dT, "a": t["a"], "b": t["b"]})
    heat.sort(key=lambda h: -h["dT"])
    return {"drop_V": {k: round(v, 5) for k, v in sorted(worst.items(), key=lambda kv: -kv[1])},
            "hottest": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in h.items()} for h in heat[:5]],
            "copper_mm": {L: round(sum(math.dist(t["a"], t["b"]) for t in by_net()[net]["tracks"] if t["layer"] == i), 1) for i, L in enumerate(LAYER)}}

# ── crosstalk screen ──
AGGR = {  # net pattern -> edge swing (V)
    "HIT": 3.3, "CMP": 3.3, "CMPO": 3.3, "FX": 3.3, "SPI_": 3.3, "FPGA_": 3.3, "LED_": 3.3, "USB_": 3.3, "TXD": 3.3, "RXD": 3.3,
    "SDA": 3.3, "SCL": 3.3, "HV_SW": 85.0, "HV_GATE": 5.0, "HV_IPK": 5.0, "INJX": 1.0, "TIA": 1.0,
}
def swing(net):
    for k in sorted(AGGR, key=len, reverse=True):
        if net.startswith(k) and not net.startswith("TIAC") and not net.startswith("TIAO"): return AGGR[k]
    return 0.0

def cross2(p, q): return p[0] * q[1] - p[1] * q[0]

def pair_cm(v, a):
    """Mutual capacitance estimate (F) between victim segment v and aggressor segment a."""
    va, vb, aa, ab = map(np.array, (v["a"], v["b"], a["a"], a["b"]))
    dv, da = vb - va, ab - aa
    Lv, La = np.linalg.norm(dv), np.linalg.norm(da)
    if Lv < 1e-6 or La < 1e-6: return 0.0, ""
    uv, ua = dv / Lv, da / La
    cos = abs(float(uv @ ua))
    if v["layer"] == a["layer"]:
        if cos < 0.94: return 0.0, ""                                   # same layer: only parallel runs couple much
        # overlap of a's projection on v, and centre distance
        s0, s1 = sorted([float((aa - va) @ uv), float((ab - va) @ uv)])
        ov = max(0.0, min(Lv, s1) - max(0.0, s0))
        if ov <= 0: return 0.0, ""
        d = abs(float(cross2(uv, aa - va)))
        h, er = ref_height(v["layer"])
        if d > 6 * h + 1: return 0.0, ""
        _, _, c = microstrip(v["w"], h, er)                              # pF/mm
        return c * 1e-12 * ov / (1 + (d / h) ** 2), f"same {LAYER[v['layer']]} {ov:.1f} mm at {d:.2f} mm"
    if {v["layer"], a["layer"]} == {2, 3}:                               # broadside, 0.21 mm prepreg, no plane between
        t = 0.2104e-3
        if cos < 0.94:                                                   # a crossing: overlap area w1 w2 / sin(theta)
            # do they cross?
            den = float(cross2(dv, da))
            if abs(den) < 1e-12: return 0.0, ""
            s = float(cross2(aa - va, da)) / den; u = float(cross2(aa - va, dv)) / den
            if not (-0.05 <= s <= 1.05 and -0.05 <= u <= 1.05): return 0.0, ""
            area = v["w"] * a["w"] * 1e-6 / max(0.2, math.sqrt(1 - cos ** 2))
            return 2.0 * EPS0 * ER_PREPREG * area / t, "crossing L3/L4"
        s0, s1 = sorted([float((aa - va) @ uv), float((ab - va) @ uv)])
        ov = max(0.0, min(Lv, s1) - max(0.0, s0))
        d = abs(float(cross2(uv, aa - va)))                            # lateral offset, mm
        if ov <= 0 or d > 2.0: return 0.0, ""
        weff = max(0.5 * (v["w"] + a["w"]) - d, 0) + 0.5 * 0.2104 / (1 + (d / 0.2104) ** 2)   # overlap + fringe [EST]
        return 2.0 * EPS0 * ER_PREPREG * weff * 1e-3 * ov * 1e-3 / t, f"broadside L3/L4 {ov:.1f} mm at {d:.2f} mm"
    return 0.0, ""                                                      # L1 vs inner/bottom: L2 plane between

# victims and how coupled charge turns into TIA-input charge: SIG directly; INJ_D (the divider node of the shared injection,
# 10k / 1.1k from the FPGA pin) through its node capacitance and a 1 pF cap into EVERY channel. INJ itself is the FPGA pin
# net: the output driver (~40 ohm) shorts what couples into it, and the 10k / 1.1k divider cuts the rest by 10.
def inj_node_pf():
    from bench_copper import by_net
    L = sum(math.dist(t["a"], t["b"]) for t in by_net()["INJ_D"]["tracks"])
    return 0.06 * L + 4 * 1.0 + 0.6                       # trace ~0.06 pF/mm + 4 x 1 pF + pads/resistor [EST]
INJ_NODE_PF = inj_node_pf()
def victim_gain(net): return 1.0 if net.startswith("SIG") else 1.0 / INJ_NODE_PF if net == "INJ_D" else 0.0

def xtalk():
    tracks = B["tracks"]
    victims = [t for t in tracks if victim_gain(t["net"])]
    aggs = [t for t in tracks if swing(t["net"]) and t["layer"] != 1]
    acc = collections.defaultdict(lambda: [0.0, []])
    for v in victims:
        for a in aggs:
            if a["net"] == "TIA" + v["net"][3:] or a["net"] == v["net"]: continue   # own TIA output: the feedback network
            cm, why = pair_cm(v, a)
            if cm > 0:
                k = (v["net"], a["net"]); acc[k][0] += cm; acc[k][1].append(why)
    rows = []
    for (vn, an), (cm, whys) in acc.items():
        q = cm * swing(an) * victim_gain(vn)
        rows.append({"victim": vn + (" (all 4 ch)" if vn == "INJ_D" else ""), "aggressor": an, "Cm_fF": round(cm * 1e15, 2), "swing_V": swing(an), "Q_fC": round(q * 1e15, 2),
                     "pe": round(q / QPE, 2), "where": sorted(set(whys))[:3]})
    rows.sort(key=lambda r: -r["Q_fC"])
    return rows

def tl_table():
    rows = []
    for L in (0, 2, 3):
        h, er = ref_height(L)
        for w in (0.127, 0.2, 0.3, 0.5):
            z, ee, c = microstrip(w, h, er)
            rows.append({"layer": LAYER[L], "w_mm": w, "h_to_plane_mm": round(h, 3), "Z0_ohm": round(z, 1), "eps_eff": round(ee, 2), "C_pF_per_mm": round(c, 3)})
    return rows

if __name__ == "__main__":
    res = {"ir": {n: ir_drop(n) for n in LOADS}, "xtalk_SIG": xtalk(), "tl": tl_table()}
    json.dump(res, open(os.path.join(OUT, "traces.json"), "w"), indent=1)
    for n, r in res["ir"].items():
        print(f"{n}: worst drop " + ", ".join(f"{k} {v * 1e3:.1f} mV" for k, v in list(r["drop_V"].items())[:4]),
              f"| hottest piece {r['hottest'][0]['w']} mm on {r['hottest'][0]['layer']}: {r['hottest'][0]['I'] * 1e3:.0f} mA, dT {r['hottest'][0]['dT']:.2f} K" if r["hottest"] else "")
    print("SIG crosstalk, top 12:")
    for r in res["xtalk_SIG"][:12]: print(f"  {r['victim']:5s} <- {r['aggressor']:10s} Cm {r['Cm_fF']:6.2f} fF  x {r['swing_V']:5.1f} V = {r['Q_fC']:7.2f} fC = {r['pe']:6.2f} pe   {r['where']}")
    for r in res["tl"]: print("  TL", r)
    # figure: IR drop per load and the SIG crosstalk ranking
    fig, ax = plt.subplots(1, 2, figsize=(13, 4.8))
    labels, vals, cols = [], [], []
    for n, c in zip(res["ir"], ["#c0392b", "#2c7fb8", "#41ab5d", "#8856a7"]):
        for k, v in list(res["ir"][n]["drop_V"].items())[:5]:
            labels.append(f"{n} {k} ({PARTS[k]['mpn'] or PARTS[k]['value']})"[:34]); vals.append(v * 1e3); cols.append(c)
    ax[0].barh(labels[::-1], vals[::-1], color=cols[::-1]); ax[0].set_xlabel("DC drop at peak load (mV)"); ax[0].set_title("Rail drop from the routed copper (ngspice)")
    top = res["xtalk_SIG"][:12]
    ax[1].barh([f"{r['aggressor']} -> {r['victim']}" for r in top][::-1], [r["pe"] for r in top][::-1], color="#e6550d")
    ax[1].axvline(1, color="k", lw=0.8, ls="--"); ax[1].set_xlabel("charge per aggressor edge (photo-electrons)")
    ax[1].set_title("Crosstalk screen into the TIA inputs (estimate)")
    fig.tight_layout(); fig.savefig(os.path.join(DOCS, "sim_traces.png"), dpi=130)
    print("wrote", os.path.join(DOCS, "sim_traces.png"))
