"""Check that the four channel cells' copper is identical (local nets + the GND copper inside each cell), from the KiCad file.
Usage: python tools/cell_identity.py            (run from hw/ after `bun run build`; pitch and box from src/floorplan.ts)"""
import re
PITCH, X0, X1, YMAX = 100.0, 8.5, 28.5, 22.4
s = open("out/kicad/muon3.kicad_pcb").read()
nets = dict((m.group(1), m.group(2)) for m in re.finditer(r'\(net (\d+) "([^"]+)"\)', s))
PAT = re.compile(r'\((segment|arc) \(start ([-\d.]+) ([-\d.]+)\)(?: \(mid ([-\d.]+) ([-\d.]+)\))? \(end ([-\d.]+) ([-\d.]+)\) \(width ([\d.]+)\) \(layer "([^"]+)"\) \(net (\d+)\)')
def geo(k, gnd):
    dx = PITCH * k; out = []
    for m in PAT.finditer(s):
        n = nets[m.group(10)]; xs = [float(m.group(i)) for i in (2, 4, 6) if m.group(i)]; ys = [float(m.group(i)) for i in (3, 5, 7) if m.group(i)]
        local = n in [f"{b}{k}" for b in ("SIG", "TIA", "VREFF", "VTHF", "CMP", "HVJ")]
        if local or (gnd and n == "GND" and all(X0 + dx <= x <= X1 + dx for x in xs) and max(ys) < YMAX):
            out.append((re.sub(r"\d$", "", n), m.group(9), m.group(8), tuple(x - dx for x in xs), tuple(ys)))
    return sorted(out)
def same(a, b):
    return len(a) == len(b) and all(p[:3] == q[:3] and all(abs(u - w) < 2e-3 for u, w in zip(p[3] + p[4], q[3] + q[4])) for p, q in zip(a, b))
for gnd in (False, True):
    g0 = geo(0, gnd)
    print("local nets + cell GND" if gnd else "local nets", [(k, len(geo(k, gnd)), same(g0, geo(k, gnd))) for k in (1, 2, 3)], "cell 0 segments:", len(g0))
