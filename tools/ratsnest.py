#!/usr/bin/env python3
"""
ratsnest.py — topological quality check of the Muon3 placement.

Reads the tscircuit circuit-json, builds the ratsnest (per-net airwires =
minimum spanning tree over the net's pads), weights each net by a routing
priority derived from the datasheets / DESIGN_RULES, and reports:

  - weighted total airwire length (the objective a good placement minimizes),
  - the worst offenders (long AND high-priority nets → move these),
  - zone-crossing of high-priority nets (noise/EMI risk),
  - unwired signal endpoints (nets with a single pad — the deferred buses),
  - a per-class summary + suggested copper layer.

Lower weighted length + fewer high-priority zone crossings = better.
"""
import json, math, sys, os, collections

CJ = "dist/board/index/circuit.json"
raw = json.load(open(CJ))
els = raw if isinstance(raw, list) else raw.get("circuitJson", raw)

# --- zones (from board/layout.ts) as (name, x0,x1,y0,y1) ---
ZONES = [
    ("RF", -78, -54, 10, 56), ("AFE", -38, 54, 10, 58), ("HV", 57, 77, 10, 50),
    ("DIGITAL", -70, 26, -30, 10), ("POWER", -80, -20, -57, -23), ("TEC", 3, 77, -57, -23),
]
def zone_of(x, y):
    for n, x0, x1, y0, y1 in ZONES:
        if x0 <= x <= x1 and y0 <= y <= y1:
            return n
    return "?"

# --- net-class weights + suggested layer (routing priority) ---
def classify(name):
    n = name.upper()
    def has(*p): return any(s in n for s in p)
    if n == "RF_ANT": return "RF 50ohm", 10, "L1 (L2 ref, GND keepout)"
    if has("INA", "AOUT", "FB") and any(n.endswith(str(i)) for i in range(4)): return "AFE hi-Z/out", 8, "L1 short, no-pour"
    if n.startswith("SIG"): return "SiPM signal", 6, "L1 short"
    if has("HV_BIAS", "HV_APD", "HV_MON") or (n.startswith("HV") and n[2:].isdigit()): return "HV ~70V", 5, "L1, >=0.6mm creepage"
    if has("SPI_SCLK", "SPI_MOSI", "RP_XIN", "RP_XOUT", "QSPI") or n.endswith("_CS") or n == "FLASH_CS": return "clk/hs-dig", 4, "L1/L4 short, ref GND"
    if has("VTHLF", "VTHHF", "VBOT", "DAC") and not has("VDD", "DECAP"): return "analog ref", 3, "L1/L3 guarded"
    if has("CMPL", "CMPH", "FPAL", "FPAH"): return "comparator", 3, "L1 short"
    if has("I2C", "CC1", "CC2", "PD_", "NTC", "SLEEP", "FAULT", "IP", "FAN", "EN", "RESET", "CDONE", "CRESET", "RUN"): return "ctrl/slow", 2, "any"
    if has("VANA", "VDIG", "V12", "VCORE", "V1V2", "VBUS", "PD_VDD", "DVDD", "SW33", "REF"): return "power", 1, "L3 pour"
    if n == "GND": return "ground", 0, "L2 plane"
    return "other", 1, "any"

# --- map source_port -> pad xy, and source_port -> net ---
port_xy = {}
for e in els:
    if e.get("type") == "pcb_port":
        port_xy[e["source_port_id"]] = (e["x"], e["y"])
net_name = {e["source_net_id"]: e.get("name") for e in els if e.get("type") == "source_net"}

# union ports sharing a trace/net
net_ports = collections.defaultdict(set)
for e in els:
    if e.get("type") != "source_trace":
        continue
    ports = e.get("connected_source_port_ids", [])
    nets = e.get("connected_source_net_ids", [])
    key = net_name.get(nets[0]) if nets else ("_t" + str(id(e)))
    for p in ports:
        net_ports[key].add(p)

def mst_len(pts):
    if len(pts) < 2:
        return 0.0
    inn = [pts[0]]; rest = pts[1:]; total = 0.0
    while rest:
        best = None; bi = None
        for i, r in enumerate(rest):
            dmin = min(math.dist(r, a) for a in inn)
            if best is None or dmin < best:
                best, bi = dmin, i
        total += best; inn.append(rest.pop(bi))
    return total

rows = []
for name, ports in net_ports.items():
    if not name:
        continue
    pts = [port_xy[p] for p in ports if p in port_xy]
    cls, w, layer = classify(name)
    L = mst_len(pts)
    zones = sorted({zone_of(x, y) for x, y in pts})
    rows.append(dict(name=name, cls=cls, w=w, layer=layer, pads=len(pts), L=L, cost=L * w, zones=zones))

routable = [r for r in rows if r["pads"] >= 2]
single = [r for r in rows if r["pads"] == 1]
tot_cost = sum(r["cost"] for r in routable)
tot_len = sum(r["L"] for r in routable)

print(f"=== Muon3 ratsnest topology ===")
print(f"nets: {len(rows)}  routable(>=2 pads): {len(routable)}  single-pad(unwired ends): {len(single)}")
print(f"raw airwire length: {tot_len:8.1f} mm    weighted (priority) length: {tot_cost:8.1f}")

print("\n-- worst weighted nets (long AND high-priority → move to shorten) --")
for r in sorted(routable, key=lambda r: -r["cost"])[:16]:
    zc = "CROSS " + ">".join(r["zones"]) if len(r["zones"]) > 1 else r["zones"][0]
    print(f"  {r['name']:12s} w{r['w']} {r['cls']:12s} pads{r['pads']:3d} L={r['L']:6.1f}mm cost={r['cost']:6.0f}  [{zc}]")

print("\n-- high-priority nets crossing zones (noise/EMI risk) --")
hp = [r for r in routable if r["w"] >= 4 and len(r["zones"]) > 1]
if hp:
    for r in sorted(hp, key=lambda r: -r["w"]):
        print(f"  {r['name']:12s} w{r['w']} {r['cls']:12s} {'>'.join(r['zones'])}  L={r['L']:.1f}mm")
else:
    print("  none — all w>=4 nets stay within one zone ✓")

print("\n-- per-class summary (suggested layer) --")
by = collections.defaultdict(lambda: [0, 0.0])
for r in routable:
    by[(r["w"], r["cls"], r["layer"])][0] += 1
    by[(r["w"], r["cls"], r["layer"])][1] += r["L"]
for (w, cls, layer), (cnt, L) in sorted(by.items(), key=lambda kv: -kv[0][0]):
    print(f"  w{w} {cls:12s} nets{cnt:3d}  totL={L:7.1f}mm   layer: {layer}")

print(f"\n-- unwired signal endpoints (deferred inter-IC buses): {len(single)} single-pad nets --")
sig_single = [r['name'] for r in single if r['w'] >= 2][:24]
print("  e.g.", ", ".join(sig_single))
