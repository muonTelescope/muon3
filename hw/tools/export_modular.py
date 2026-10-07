#!/usr/bin/env python3
"""Deterministic Rev E preflight + review/STEP exports; --fabrication needs clean ERC/DRC."""
import argparse,json,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--fabrication',action='store_true');a=p.parse_args()
def run(*args):subprocess.run([str(x) for x in args],check=True)
run('kicad-cli','version')
for name in ('detector','controller'):
    d=ROOT/'out/modular'/name;b=d/(name+'.kicad_pcb');s=d/(name+'.kicad_sch')
    run('kicad-cli','sch','erc','--format','json','--output',d/'erc.json',s)
    run('kicad-cli','pcb','drc','--refill-zones','--format','json','--output',d/'drc.json',b)
    for report in ('erc','drc'):
        r=json.loads((d/(report+'.json')).read_text());vs=r.get('violations',[])+r.get('unconnected_items',[])+[v for sh in r.get('sheets',[]) for v in sh['violations']]
        errs=[v for v in vs if v['severity']=='error']
        if errs:raise SystemExit(f'FAILURE: {name} has {len(errs)} {report} errors; fabrication export blocked')
    run('kicad-cli','sch','export','netlist','--format','kicadxml','--output',d/'netlist.xml',s)
    run('kicad-cli','sch','export','pdf','--output',d/(name+'-schematic.pdf'),s)
    run('kicad-cli','sch','export','svg','--output',d,s)
    run('kicad-cli','pcb','export','step','--user-origin','0x0','--subst-models','--force','--output',d/(name+'.step'),b)
run('python3',ROOT.parent/'tools/verify_modular.py')
run('python3',ROOT/'tools/check_modular.py')
if a.fabrication:
    for name in ('detector','controller'):
        d=ROOT/'out/modular'/name;b=d/(name+'.kicad_pcb');g=d/'gerbers';g.mkdir(exist_ok=True)
        run('kicad-cli','pcb','export','gerbers','--output',str(g)+'/', '--layers','F.Cu,In1.Cu,In2.Cu,B.Cu,F.Paste,B.Paste,F.Silkscreen,B.Silkscreen,F.Mask,B.Mask,Edge.Cuts',b)
        run('kicad-cli','pcb','export','drill','--output',str(g)+'/', '--format','excellon','--drill-origin','absolute',b)
        with zipfile.ZipFile(d/(name+'-prototype-gerbers.zip'),'w',zipfile.ZIP_DEFLATED) as z:
            for f in sorted(g.iterdir()):
                if f.is_file():z.write(f,f.name)
        (d/'FABRICATION_STATUS.txt').write_text('Rev E prototype outputs. ERC/DRC and exact netlist parity passed at export.\nNot bench validated. Confirm bias regulation/ripple, thermal behavior, supply sequencing, cable pulse widths, and actual SiPM voltage before commissioning.\n4-layer, 1.6 mm PCB. Through-hole headers are excluded from SMT CPL and require separate soldering. USB-C source must advertise >=1.5 A.\n')
