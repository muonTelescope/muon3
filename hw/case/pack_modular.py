"""Pack normalized printed parts into CORE One 3MF plates with 10 mm separation.
Pure standard-library 3MF creation, then PrusaSlicer imports each plate and
stores a printer-aware project. No G-code is exported. ABS temperatures are
explicit starting assumptions, not a calibrated filament profile.
"""
import os,json,struct,zipfile,subprocess,sys,xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SLICER='/Applications/Original Prusa Drivers/PrusaSlicer.app/Contents/MacOS/PrusaSlicer'
NS='http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
ET.register_namespace('',NS)

def mesh(path):
 data=Path(path).read_bytes();n=struct.unpack_from('<I',data,80)[0];vertices=[];faces=[];ids={};edges={}
 for i in range(n):
  face=[]
  for j in range(3):
   p=struct.unpack_from('<fff',data,84+50*i+12+12*j);p=tuple(round(v,5) for v in p)
   if p not in ids:ids[p]=len(vertices);vertices.append(p)
   face.append(ids[p])
  if len(set(face))<3:continue
  faces.append(face)
  for a,b in zip(face,face[1:]+face[:1]):
   key=tuple(sorted((a,b)));edges[key]=edges.get(key,0)+1
 return vertices,faces,sum(v!=2 for v in edges.values())

def write3mf(path,plate,root):
 model=ET.Element('{'+NS+'}model',unit='millimeter',attrib={'xml:lang':'en-US'});res=ET.SubElement(model,'{'+NS+'}resources');build=ET.SubElement(model,'{'+NS+'}build')
 check=[]
 for i,item in enumerate(plate,1):
  vs,fs,bad=mesh(root/item['stl']);check.append({'name':item['name'],'nonmanifold_edges':bad})
  if bad:raise ValueError(f"{item['name']}: {bad} nonmanifold mesh edges")
  obj=ET.SubElement(res,'{'+NS+'}object',id=str(i),type='model',name=item['name']);m=ET.SubElement(obj,'{'+NS+'}mesh');verts=ET.SubElement(m,'{'+NS+'}vertices');tris=ET.SubElement(m,'{'+NS+'}triangles')
  for v in vs:ET.SubElement(verts,'{'+NS+'}vertex',x=str(v[0]),y=str(v[1]),z=str(v[2]))
  for f in fs:ET.SubElement(tris,'{'+NS+'}triangle',v1=str(f[0]),v2=str(f[1]),v3=str(f[2]))
  x,y=item['xy_mm'];ET.SubElement(build,'{'+NS+'}item',objectid=str(i),transform=f'1 0 0 0 1 0 0 0 1 {x} {y} 0')
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
  z.writestr('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
  z.writestr('3D/3dmodel.model',ET.tostring(model,encoding='utf-8',xml_declaration=True))
 return check

def pack(tile):
 out=ROOT/f'hw/out/assembly/modular_v2/tile{tile:02d}';m=json.loads((out/'manifest.json').read_text());folder=out/'plates';folder.mkdir(exist_ok=True)
 items=[]
 for p in m['printed_parts']:
  for i in range(p['quantity']):items.append(dict(p,copy=i+1))
 items.sort(key=lambda p:(p['size_mm'][1],p['size_mm'][0]),reverse=True)
 plates=[];rows=[]
 for item in items:
  w,h,_=item['size_mm'];placed=False
  for pi,rowlist in enumerate(rows):
   for row in rowlist:
    if h<=row['h'] and row['x']+w<=240:
     item['xy_mm']=[row['x'],row['y']];row['x']+=w+10;plates[pi].append(item);placed=True;break
   if placed:break
   y=sum(row['h']+10 for row in rowlist)+10
   if y+h<=210:
    item['xy_mm']=[10,y];rowlist.append({'x':20+w,'y':y,'h':h});plates[pi].append(item);placed=True;break
  if not placed:
   item['xy_mm']=[10,10];rows.append([{'x':20+w,'y':10,'h':h}]);plates.append([item])
 checks=[];plate_data=[]
 for i,plate in enumerate(plates,1):
  path=folder/f'plate_{i:02d}.3mf';checks.extend(write3mf(path,plate,out))
  # Save an explicit CORE One project. ASA preset contributes machine-compatible
  # defaults only; filament type and thermal values are overridden to ABS.
  project=folder/f'plate_{i:02d}_core_one_ABS.3mf'
  cmd=[SLICER,str(path),'--printer-profile','Prusa CORE One 0.4 nozzle','--print-profile','0.20mm STRUCTURAL @COREONE 0.4','--material-profile','Prusament ASA @COREONE','--filament-type','ABS','--temperature','255','--first-layer-temperature','255','--bed-temperature','100','--first-layer-bed-temperature','100','--perimeters','5','--fill-density','35%','--brim-width','5','--dont-arrange','--export-3mf','--output',str(project)]
  r=subprocess.run(cmd,capture_output=True,text=True)
  (folder/f'plate_{i:02d}_slicer.log').write_text(r.stdout+r.stderr)
  if r.returncode:raise RuntimeError(r.stdout+r.stderr)
  plate_data.append({'plate':i,'project':str(project.relative_to(out)),'parts':[{'name':p['name'],'copy':p['copy'],'xy_mm':p['xy_mm'],'size_mm':p['size_mm']} for p in plate]})
 result={'tile':tile,'printer':'Prusa CORE One 0.4 nozzle','bed_mm':[250,220,270],'margin_mm':10,'part_gap_mm':10,'brim_mm':5,'status':'Unsliced review projects. Confirm material temperatures, supports and first-layer orientation before printing. No G-code supplied.','candidate_ABS':{'nozzle_C':255,'bed_C':100,'layer_mm':.2,'perimeters':5,'infill_percent':35},'plates':plate_data,'mesh_checks':checks}
 (folder/'plates.json').write_text(json.dumps(result,indent=2));print(f'tile {tile:02d}: {len(items)} pieces on {len(plates)} plates, {len(checks)} closed meshes')
for n in map(int,sys.argv[1:] or range(1,13)):pack(n)
