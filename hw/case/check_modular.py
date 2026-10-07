"""Exact solid interference checks for a generated modular station.
Print mating contact/snap hooks may require engineering review; every positive
intersection is recorded rather than silently classified as acceptable.
"""
import FreeCAD as App,Part,os,json
n=int(os.getenv('TILE','1'));out=os.path.abspath(f'hw/out/assembly/modular_v2/tile{n:02d}')
doc=App.openDocument(out+'/station.FCStd');m=json.load(open(out+'/manifest.json'))
objects=[]
for p in m['parts']:
 if p['group'] not in ('frame','electronics','tile','sipm'):continue
 if p['name'].endswith('_Fiber'):continue
 o=doc.getObject(p['name']);s=o.Shape.copy();s.Placement=App.Placement(App.Matrix(*p["matrix"]));objects.append((p,s,s.Solids,p['group']=='frame' or p['name'].endswith(('_base','_lid'))))
res=[]
def positive_bbox(a,b):
 return min(a.XMax,b.XMax)-max(a.XMin,b.XMin)>1e-5 and min(a.YMax,b.YMax)-max(a.YMin,b.YMin)>1e-5 and min(a.ZMax,b.ZMax)-max(a.ZMin,b.ZMin)>1e-5
for i,(a,sa,asol,aprinted) in enumerate(objects):
 for b,sb,bsol,bprinted in objects[i+1:]:
  if not (aprinted or bprinted):continue
  if not positive_bbox(sa.BoundBox,sb.BoundBox):continue
  v=0
  for aa in asol:
   for bb in bsol:
    if positive_bbox(aa.BoundBox,bb.BoundBox):v+=aa.common(bb).Volume
  if v>.1:res.append({'a':a['name'],'b':b['name'],'overlap_mm3':round(v,3)})
json.dump({'tile':n,'positive_interferences':res,'scope':'Printed structure, enclosures, sensor packages and tiles. Imported populated PCB STEP compounds excluded; inspect board metadata and supplier models separately.', 'status':'review required' if res else 'no positive-volume solid interference within stated scope'},open(out+'/interferences.json','w'),indent=2)
print('INTERFERENCES',len(res));print(res)
