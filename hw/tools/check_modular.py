#!/usr/bin/env python3
"""Check cross-board contracts and independent KiCad reports for Rev E.
This intentionally fails if any board has unrouted items or ERC/DRC errors.
It never treats a missing report as a pass and never exports fabrication files.
"""
import json
from pathlib import Path
from collections import Counter
ROOT = Path(__file__).resolve().parents[1] / 'out' / 'modular'
issues=[]
expected=['5V','GND','HIT','GND','SDA','SCL','HV_EN','HV_MON','INJ','GND']
for name in ('detector','controller'):
    folder=ROOT/name
    parts=json.loads((folder/'netlist.json').read_text())
    refs=Counter(p['ref'] for p in parts)
    issues += [f'{name}: duplicate {r}' for r,n in refs.items() if n!=1]
    for p in parts:
        if p['lcsc'] not in ('TP','MANUAL') and p['lcsc']!=p['info']['lcsc']:
            issues.append(f"{name}: {p['ref']} BOM identity {p['lcsc']} != {p['info']['lcsc']}")
        if p['lcsc']=='MANUAL': issues.append(f"{name}: unselected part {p['ref']}")
    headers=['J100'] if name=='detector' else ['J100','J101','J102','J103']
    for i,ref in enumerate(headers):
        p=next(p for p in parts if p['ref']==ref)
        pinout=[p['pads'][str(n)] for n in range(1,11)]
        wanted=[n+str(i) if name=='controller' and n in ('HIT','SDA','SCL','HV_MON') else n for n in expected]
        if pinout!=wanted: issues.append(f'{name}: {ref} harness mismatch {pinout}')
        if any(n in ('HV','HV_RAW','HV_SW') for n in pinout):issues.append(f'{name}: HV exposed on low-voltage harness')
    for report in ('drc','erc'):
        path=folder/(report+'.json')
        if not path.exists():issues.append(f'{name}: missing independent {report}');continue
        r=json.loads(path.read_text())
        violations=r.get('violations',[])+r.get('unconnected_items',[])
        violations += [v for s in r.get('sheets',[]) for v in s.get('violations',[])]
        failures=[v for v in violations if v.get('severity')=='error']
        issues.extend(f"{name}: {report}: {v['description']}" for v in failures)
        print(f'{name} {report}: {len(failures)} errors, {sum(v.get("severity")=="warning" for v in violations)} warnings')
if issues:
    print('\n'.join(issues));raise SystemExit(1)
print('Board contracts, BOM identity and independent ERC/DRC reports pass. Bench validation remains separate.')
