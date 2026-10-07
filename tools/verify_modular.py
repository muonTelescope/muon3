#!/usr/bin/env python3
"""Compare schematic/PCB/source connectivity and assembly-interface dimensions.
Uses KiCad's schematic XML export, checks every physical pad net independently.
Does not replace ERC, DRC, timing, or physical tests.
"""
import json,pathlib,re,subprocess,xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'hw/out/modular'

def sexpr(text):
    tokens=re.findall(r'"(?:\\.|[^"\\])*"|[()]|[^\s()]+',text)
    stack=[]; root=[]; current=root
    for tok in tokens:
        if tok=='(': item=[];current.append(item);stack.append(current);current=item
        elif tok==')': current=stack.pop()
        else: current.append(json.loads(tok) if tok.startswith('"') else tok)
    return root[0]

def fields(node,key):return [x for x in node if isinstance(x,list) and x and x[0]==key]
def one(node,key):return next(iter(fields(node,key)),None)
def normalized(net):return net.lstrip('/')
def compare(name):
    folder=OUT/name
    xml=folder/'schematic-netlist.xml'
    subprocess.run(['kicad-cli','sch','export','netlist','--format','kicadxml','-o',str(xml),str(folder/f'{name}.kicad_sch')],check=True,capture_output=True)
    sch={}
    for net in ET.parse(xml).findall('./nets/net'):
        n=normalized(net.attrib['name'])
        for pin in net.findall('node'):
            if not pin.attrib['ref'].startswith('#'):sch[(pin.attrib['ref'],pin.attrib['pin'])]=n
    source=json.loads((folder/'netlist.json').read_text())
    expected={(p['ref'],num):net for p in source for num,net in p['pads'].items() if not net.startswith('NC')}
    pcb={}
    tree=sexpr((folder/f'{name}.kicad_pcb').read_text())
    for fp in fields(tree,'footprint'):
        props={p[1]:p[2] for p in fields(fp,'property')}
        ref=props.get('Reference')
        if ref is None:
            ref=next((t[2] for t in fields(fp,'fp_text') if t[1]=='reference'),None)
        for pad in fields(fp,'pad'):
            n=one(pad,'net')
            if n and len(n)>2 and not n[2].startswith('NC'):pcb[(ref,pad[1])]=n[2]
    errors=[]
    for label,actual in [('schematic',sch),('PCB',pcb)]:
        for key,net in expected.items():
            if actual.get(key)!=net:errors.append(f'{label} {key}: expected {net}, got {actual.get(key)}')
        for key,net in actual.items():
            if key not in expected and not net.startswith('unconnected'):errors.append(f'{label} extra {key}: {net}')
    return {'board':name,'expected_connected_pads':len(expected),'schematic_pads':len(sch),'pcb_pads':len(pcb),'errors':errors}

def main():
    results=[compare(n) for n in ('detector','controller')]
    interface=json.loads((OUT/'interface.json').read_text())
    for n in ('detector','controller'):
        b=json.loads((OUT/n/'board.json').read_text())
        assert (b['w'],b['h'])==(interface['dimensions'][n]['w'],interface['dimensions'][n]['h'])
    report={'checks':results,'passed':not any(r['errors'] for r in results),'scope':'Pin-number connectivity against independent KiCad schematic XML and PCB parser; board interface dimensions.'}
    (OUT/'connectivity-review.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
    return 0 if report['passed'] else 1
if __name__=='__main__':raise SystemExit(main())
