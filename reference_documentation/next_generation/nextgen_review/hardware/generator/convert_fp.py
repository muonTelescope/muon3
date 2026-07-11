#!/usr/bin/env python3
"""Convert KiCad 8 .kicad_mod to KiCad 7 loadable format (pads/geometry lossless)."""
import sexpdata, os, sys
from sexpdata import Symbol as S

SRC = '/home/claude/JLCPCB-Kicad-Library/footprints/JLCPCB.pretty'
DST = '/home/claude/kicad_proj/JLCPCB_v7.pretty'
os.makedirs(DST, exist_ok=True)

NEEDED = ['R_0402', 'R_0603', 'C_0402', 'C_0603', 'C_0805', 'C_1206', 'L_0805',
          'SOT-23-3_L2.9-W1.6-P1.90-LS2.8-BR', 'D_SMB',
          'SOT-223-3_L6.5-W3.4-P2.30-LS7.0-BR', 'SOIC-8_L5.3-W5.3-P1.27-LS8.0-BL',
          'Bosch_LGA-8_2.5x2.5mm_P0.65mm_ClockwisePinNumbering',
          'IPEX-SMD_BWIPX-1-001E']

ALLOWED = {'layer', 'descr', 'tags', 'attr', 'fp_text', 'fp_line', 'fp_rect',
           'fp_circle', 'fp_arc', 'fp_poly', 'pad', 'model', 'solder_mask_margin',
           'solder_paste_margin', 'solder_paste_ratio', 'clearance', 'zone_connect'}

def head(x):
    return str(x[0]) if isinstance(x, list) and x and isinstance(x[0], S) else None

def clean(node):
    """recursively drop v8-only tokens, rename uuid->tstamp"""
    if not isinstance(node, list):
        return node
    h = head(node)
    if h == 'uuid':
        return [S('tstamp'), node[1]]
    out = []
    for e in node:
        eh = head(e)
        if eh in ('unlocked', 'uuid') and h in ('property', 'fp_text', 'pad', 'fp_line',
                                                'fp_rect', 'fp_circle', 'fp_arc', 'fp_poly', 'model'):
            if eh == 'uuid':
                out.append([S('tstamp'), e[1]])
            continue
        if eh in ('remove_unused_layers', 'keep_end_layers', 'zone_layer_connections',
                  'thermal_bridge_angle', 'embedded_fonts', 'tenting', 'hide'):
            # 'hide' bare token list inside effects in v8 is (hide yes) -> v7 wants bare hide symbol
            if eh == 'hide':
                out.append(S('hide'))
            continue
        out.append(clean(e))
    return out

def conv_property(p):
    """(property "Reference" "VAL" (at..)(layer..)(effects..)) -> fp_text"""
    kind = str(p[1])
    if kind not in ('Reference', 'Value'):
        return None
    rest = [clean(e) for e in p[3:] if head(e) in ('at', 'layer', 'effects', 'uuid') or head(e) is None]
    rest = [([S('tstamp'), e[1]] if head(e) == 'uuid' else e) for e in rest]
    return [S('fp_text'), S(kind.lower()), p[2]] + rest

def dump(x, ind=0):
    if isinstance(x, S):
        return str(x)
    if isinstance(x, str):
        return '"' + x.replace('"', '\\"') + '"'
    if isinstance(x, bool):
        return 'yes' if x else 'no'
    if isinstance(x, float):
        s = f'{x:.6f}'.rstrip('0').rstrip('.')
        return s if s else '0'
    if isinstance(x, int):
        return str(x)
    inner = ' '.join(dump(e, ind + 1) for e in x)
    return '(' + inner + ')'

for name in NEEDED:
    tree = sexpdata.loads(open(f'{SRC}/{name}.kicad_mod').read())
    out = [S('footprint'), tree[1], [S('version'), 20221018], [S('generator'), S('pcbnew')]]
    for e in tree[2:]:
        h = head(e)
        if h == 'property':
            c = conv_property(e)
            if c:
                out.append(c)
        elif h in ('version', 'generator', 'generator_version', 'embedded_fonts'):
            continue
        elif h in ALLOWED or h == 'tstamp':
            out.append(clean(e))
        elif h is None:
            out.append(e)
        # silently drop anything else v8-specific
    open(f'{DST}/{name}.kicad_mod', 'w').write(dump(out))

# verify all load in pcbnew 7
import pcbnew
fails = []
for name in NEEDED:
    fp = pcbnew.FootprintLoad(DST, name)
    if fp is None:
        fails.append(name)
    else:
        pads = [p.GetNumber() for p in fp.Pads()]
        print(f'OK {name}: pads {pads}')
print('FAILS:', fails if fails else 'none')
