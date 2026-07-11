#!/usr/bin/env python3
"""gen_pcb.py — placement + plane strategy for the muon telescope board.
4-layer: F.Cu (signal/components) | In1 GND (solid) | In2 +3V3 | B.Cu (GND pour + slow routes).
Low-noise architecture:
  - channels strip on the left, U.FL at board edge, signal path grows left->right
  - single GND domain (no split planes -> no loop around a slot); partitioning by PLACEMENT
  - boost converter quarantined bottom-right, >40mm from any summing node
  - rule areas: no plane/pour under each TIA summing node (Cf parasitic + leakage)
  - HV netclass 0.5mm clearance
"""
import re, sys
import pcbnew
from pcbnew import wxPointMM, VECTOR2I, FromMM

NET_FILE = '/tmp/m8.net'
OUT = '/home/claude/kicad_proj/out_v7/muon_telescope.kicad_pcb'
STD = '/usr/share/kicad/footprints'
CDFER = '/home/claude/kicad_proj/JLCPCB_v7.pretty'

# ---------- parse netlist ----------
txt = open(NET_FILE).read()
comps = {}
for m in re.finditer(r'\(comp \(ref "([^"]+)"\)(.*?)(?=\(comp |\(libparts)', txt, re.S):
    ref = m.group(1)
    fp = re.search(r'\(footprint "([^"]+)"\)', m.group(2))
    val = re.search(r'\(value "([^"]+)"\)', m.group(2))
    comps[ref] = {'fp': fp.group(1) if fp else '', 'val': val.group(1) if val else ''}
nets = {}
for m in re.finditer(r'\(net \(code "\d+"\) \(name "([^"]+)"\)(.*?)(?=\(net |\)\)\s*$)', txt, re.S):
    nets[m.group(1)] = re.findall(r'\(node \(ref "([^"]+)"\) \(pin "([^"]+)"\)', m.group(2))
print(f'netlist: {len(comps)} components, {len(nets)} nets')

# ---------- board ----------
board = pcbnew.BOARD()
ds = board.GetDesignSettings()
ds.SetCopperLayerCount(4)

netmap = {}
for name in nets:
    ni = pcbnew.NETINFO_ITEM(board, name)
    board.Add(ni)
    netmap[name] = ni
pad2net = {}
for name, nodes in nets.items():
    for ref, pin in nodes:
        pad2net[(ref, pin)] = name

def load_fp(fpid):
    lib, name = fpid.split(':')
    path = CDFER if lib == 'PCM_JLCPCB' else f'{STD}/{lib}.pretty'
    fp = pcbnew.FootprintLoad(path, name)
    if fp is None:
        raise RuntimeError(f'footprint not found: {fpid}')
    return fp

# ---------- floorplan ----------
CH_Y = [9, 26, 43, 60]
pos = {}
rot = {}
for ch in range(4):
    y = CH_Y[ch]
    b = 100 + ch * 10
    pos[f'J{2+ch}'] = (7, y)                      # U.FL at the edge
    pos[f'R{b+1}'] = (13, y + 6)    # 100k HV
    pos[f'C{b+1}'] = (19, y + 6)                  # 100n 50V at connector
    pos[f'R{b+2}'] = (14.5, y)                    # 10R series
    pos[f'D{2+ch}'] = (20, y - 5)                 # BAV99
    pos[f'U{b+1}'] = (26, y)                      # OPA858
    pos[f'R{b+6}'] = (25, y - 6)                  # Rf 2k
    pos[f'C{b+6}'] = (30, y - 6)                  # Cf 2.2p
    pos[f'R{b+3}'] = (20, y + 10)                 # VBOT 1k
    pos[f'C{b+2}'] = (26, y + 10)                 # VBOT 100n
    pos[f'U{b+2}'] = (40, y)                      # TLV3601
    pos[f'R{b+4}'] = (34, y + 10)                 # THRESH 1k
    pos[f'C{b+3}'] = (40, y + 10)                 # THRESH 100n
    pos[f'R{b+5}'] = (47, y)                      # 33R out
    pos[f'C{b+4}'] = (44, y - 5)                  # 100n dec
    pos[f'C{b+5}'] = (48, y - 5)                  # 1u dec

# digital
pos['U3'] = (62, 36)                              # iCE40 QFN48
pos['X1'] = (52, 24)                              # TCXO near G0
pos['U6'] = (62, 14)                              # config flash
pos['C30'] = (66, 14); pos['C31'] = (52, 18)
pos['U4'] = (80, 30)                              # DAC7578
pos['C32'] = (80, 40)
pos['R30'] = (86, 36); pos['R31'] = (86, 40)
pos['U5'] = (70, 8)                               # BME280
pos['C33'] = (74, 12)
# power
pos['R20'] = (70, 50); pos['C20'] = (90, 46)
pos['U11'] = (78, 47); pos['C21'] = (85, 50)
pos['U12'] = (78, 58); pos['C22'] = (85, 58)
# boost quarantine, bottom-right strip
pos['L1'] = (62, 76); pos['U10'] = (68, 76); pos['D10'] = (74, 76)
pos['C10'] = (81, 76); pos['L2'] = (87, 76); pos['C11'] = (92, 76)
pos['R10'] = (96.5, 76); pos['C12'] = (101, 76)
pos['R16'] = (62, 82); pos['C13'] = (66, 82); pos['R11'] = (71, 82)
pos['R12'] = (75, 82); pos['R13'] = (79, 82); pos['R14'] = (88, 82); pos['R15'] = (92, 82)
# headers right edge / NTC
pos['J7'] = (103, 8);  rot['J7'] = 270
pos['J8'] = (103, 14); rot['J8'] = 270
pos['J6'] = (103, 20); rot['J6'] = 270
pos['J9'] = (74, 58); rot['J9'] = 270
pos['J10'] = (74, 64); rot['J10'] = 270
pos['R32'] = (66, 56); pos['R33'] = (66, 62)
pos['J1'] = (10, 80); rot['J1'] = 270
pos['R35'] = (52, 50); pos['R36'] = (52, 54); pos['R37'] = (52, 58)

missing = [r for r in comps if r not in pos]
if missing:
    print('UNPLACED:', missing)

# ---------- place ----------
for ref, c in comps.items():
    if not c['fp']:
        print('no footprint:', ref); continue
    fp = load_fp(c['fp'])
    fp.SetReference(ref); fp.SetValue(c['val'])
    x, y = pos.get(ref, (110, 10))
    fp.SetPosition(VECTOR2I(FromMM(x), FromMM(y)))
    if ref in rot:
        fp.SetOrientationDegrees(rot[ref])
    for pad in fp.Pads():
        key = (ref, pad.GetNumber())
        if key in pad2net:
            pad.SetNet(netmap[pad2net[key]])
    board.Add(fp)

# mounting holes
for i, (x, y) in enumerate([(3.5, 76), (55, 4), (104, 60), (55, 82.5)]):
    try:
        mh = pcbnew.FootprintLoad(f'{STD}/MountingHole.pretty', 'MountingHole_3.2mm_M3')
        mh.SetReference(f'H{i+1}'); mh.SetValue('M3')
        mh.SetPosition(VECTOR2I(FromMM(x), FromMM(y)))
        board.Add(mh)
    except Exception as e:
        print('mh', e)

# ---------- outline ----------
W, H = 108, 86
for (x1, y1, x2, y2) in [(0, 0, W, 0), (W, 0, W, H), (W, H, 0, H), (0, H, 0, 0)]:
    seg = pcbnew.PCB_SHAPE(board)
    seg.SetShape(pcbnew.SHAPE_T_SEGMENT)
    seg.SetStart(VECTOR2I(FromMM(x1), FromMM(y1)))
    seg.SetEnd(VECTOR2I(FromMM(x2), FromMM(y2)))
    seg.SetLayer(pcbnew.Edge_Cuts)
    seg.SetWidth(FromMM(0.1))
    board.Add(seg)

# ---------- zones ----------
def add_zone(layer, netname, pts, priority=0, name=''):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer)
    if netname:
        z.SetNet(netmap[netname])
    ol = z.Outline()
    ol.NewOutline()
    for (x, y) in pts:
        ol.Append(FromMM(x), FromMM(y))
    z.SetAssignedPriority(priority)
    z.SetZoneName(name)
    z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
    z.SetThermalReliefGap(FromMM(0.3))
    z.SetThermalReliefSpokeWidth(FromMM(0.4))
    z.SetLocalClearance(FromMM(0.25))
    z.SetMinThickness(FromMM(0.2))
    board.Add(z)
    return z

full = [(1, 1), (W-1, 1), (W-1, H-1), (1, H-1)]
add_zone(pcbnew.F_Cu, 'GND', full, 0, 'GND_top')
add_zone(pcbnew.B_Cu, 'GND', full, 0, 'GND_bot')
add_zone(pcbnew.In1_Cu, 'GND', full, 0, 'GND_plane')
add_zone(pcbnew.In2_Cu, '+3V3', full, 0, 'P3V3_plane')
# quieter analog 3V3 pocket: GND fill on In2 under boost area to deny 3V3 plane there
# (boost noise should not couple into the 3V3 plane region under itself)
add_zone(pcbnew.In2_Cu, 'GND', [(58, 70), (W-1, 70), (W-1, H-1), (58, H-1)], 2, 'GND_under_boost')

# rule areas: no copper pour under each summing node (In1, In2, B.Cu)
for ch in range(4):
    y = CH_Y[ch]
    ra = pcbnew.ZONE(board)
    ls = pcbnew.LSET()
    for l in (pcbnew.In1_Cu, pcbnew.In2_Cu, pcbnew.B_Cu):
        ls.AddLayer(l)
    ra.SetLayerSet(ls)
    ra.SetIsRuleArea(True)
    ra.SetDoNotAllowCopperPour(True)
    ra.SetDoNotAllowTracks(False)
    ra.SetDoNotAllowVias(False)
    ol = ra.Outline(); ol.NewOutline()
    for (x, yy) in [(20, y-9), (34, y-9), (34, y+3), (20, y+3)]:
        ol.Append(FromMM(x), FromMM(yy))
    ra.SetZoneName(f'no_pour_summing_node_ch{ch}')
    board.Add(ra)

# GND stitching vias on coarse grid, skipping component areas
occupied = []
for fp in board.GetFootprints():
    bb = fp.GetBoundingBox()
    occupied.append((bb.GetLeft(), bb.GetTop(), bb.GetRight(), bb.GetBottom()))
def free(xn, yn):
    p = (FromMM(xn), FromMM(yn))
    for (l, t, r, b) in occupied:
        if l - FromMM(1) < p[0] < r + FromMM(1) and t - FromMM(1) < p[1] < b + FromMM(1):
            return False
    return True
nvia = 0
for xs in range(6, W-2, 9):
    for ys in range(6, H-2, 9):
        if not free(xs, ys):
            continue
        if 20 <= xs <= 34 and any(abs(ys - cy) < 11 for cy in CH_Y):
            continue  # inside summing-node no-pour rule areas
        v = pcbnew.PCB_VIA(board)
        v.SetPosition(VECTOR2I(FromMM(xs), FromMM(ys)))
        v.SetDrill(FromMM(0.3)); v.SetWidth(FromMM(0.6))
        v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
        v.SetNet(netmap['GND'])
        board.Add(v); nvia += 1
print('stitching vias:', nvia)

# ---------- silk guidance ----------
def silk(x, y, msg, size=1.0):
    t = pcbnew.PCB_TEXT(board)
    t.SetText(msg); t.SetLayer(pcbnew.F_SilkS)
    t.SetPosition(VECTOR2I(FromMM(x), FromMM(y)))
    t.SetTextSize(pcbnew.VECTOR2I(FromMM(size), FromMM(size)))
    t.SetTextThickness(FromMM(0.15))
    board.Add(t)
silk(26, 3, 'ANALOG - 4x SiPM TIA   (U.FL: center=signal shield=HV)')
silk(78, 70, 'HV BOOST QUARANTINE', 1.2)
silk(28, 84, 'muon telescope rev A 2026-06-11', 1.0)

board.Save(OUT)
print('saved', OUT)
