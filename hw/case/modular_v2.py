"""Muon3 modular ABS classroom station, all sPHENIX tile outlines.
Run with TILE=1..12 using FreeCAD's freecadcmd. Legacy assembly.py is preserved.
All printed parts export in an explicit print coordinate system; assembly STL
placements are separate. This is a prototype pending ABS fit/load testing.
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tile_geometry as g
import FreeCAD as App
import Part, Mesh
V=App.Vector
box, cyl, poly_face, prism = g.box,g.cyl,g.poly_face,g.prism
OUT=g.OUT
PRINT=os.path.join(OUT,'print'); os.makedirs(PRINT,exist_ok=True)
PARTS=[]; PRINTS={}; CHECKS=[]; WIRES=[]
PCB_DEFS={}
DOC=g.doc; ST=g.ST; FRAME=g.FRAME
# 0.25 mm radial mating clearance; calibration coupons span ±0.10 mm.
CLEAR=.25; BODY=18.; TENON=12.; SOCKET=TENON+2*CLEAR
PITCH=100.; SHOULDER=-9.; PCB_T=1.6
RODS=[(g.BL[0]-8,-15),(g.BR[0]+8,-15),(g.TR[0]+8,g.YTOP+17),(g.TL[0]-8,g.YTOP+17)]
MATERIAL={'material':'ABS','nozzle_mm':.4,'layer_mm':.2,'perimeters':5,'infill_percent':35,'brim_mm':5,'support':'Only where noted; tune bridging and ABS temperature to actual filament','printer':'Prusa CORE One','bed_mm':[250,220,270],'target_footprint_mm':[230,200]}

def mesh(shape,path,tol=.12):
 v,f=shape.tessellate(tol); m=Mesh.Mesh();m.addFacets([[v[a],v[b],v[c]] for a,b,c in f]);m.write(path)
 return len(f)

def global_placement(o):
 if hasattr(o,'getGlobalPlacement'):return o.getGlobalPlacement()
 placement=o.Placement
 cur=o
 while True:
  parents=[p for p in cur.InList if p.TypeId=='App::Part' and cur in p.Group]
  if not parents:break
  cur=parents[0];placement=cur.Placement.multiply(placement)
 return placement

def linked_board(name,source,placement,parent):
 o=DOC.addObject('App::Link',name);o.setLink(source);o.LinkPlacement=placement;parent.addObject(o)
 g.LEAVES.append((o,'pcb',g.COL['pcb'],1.0,.15))
 CHECKS.append({'name':name,'valid':True,'solids':len(source.Shape.Solids),'volume_mm3':round(source.Shape.Volume,3),'instance_of':source.Name})
 return o

def normalized(s,rotation=None):
 p=s.copy()
 if rotation:p.rotate(V(),rotation[0],rotation[1])
 b=p.BoundBox;p.translate(V(-b.XMin,-b.YMin,-b.ZMin));return p

def add(name,shape,group='frame',printed=False,key=None,parent=None,rotation=None,note=''):
 if shape.isNull() or not shape.isValid() or shape.Volume<=0:raise ValueError('Invalid geometry: '+name)
 o=g.leaf(name,shape,parent or FRAME,group,g.COL['abs'] if printed else g.COL.get('cable' if group=='cables' else group,g.COL['pcb']),1,.12)
 CHECKS.append({'name':name,'valid':shape.isValid(),'solids':len(shape.Solids),'volume_mm3':round(shape.Volume,3)})
 if printed:
  key=key or name
  if key not in PRINTS:
   p=normalized(shape,rotation);b=p.BoundBox;dims=[b.XLength,b.YLength,b.ZLength]
   if dims[0]>230 or dims[1]>200:
    p=normalized(p,(V(0,0,1),90));b=p.BoundBox;dims=[b.XLength,b.YLength,b.ZLength]
   if dims[0]>230.001 or dims[1]>200.001 or dims[2]>260:raise ValueError(f'{key} exceeds print envelope {dims}')
   path=os.path.join(PRINT,key+'.stl');nf=mesh(p,path)
   p.exportStep(os.path.join(PRINT,key+'.step'))
   PRINTS[key]={'name':key,'quantity':0,'stl':os.path.relpath(path,OUT),'step':'print/'+key+'.step','size_mm':[round(q,3) for q in dims],'facets':nf,'orientation':'As exported; bottom is Z=0','notes':note}
  PRINTS[key]['quantity']+=1
 return o

def moved(s,x=0,y=0,z=0):
 q=s.copy();q.translate(V(x,y,z));return q

def beam(a,b,z,w=8,h=3.2):
 d=V(b[0]-a[0],b[1]-a[1],0);length=d.Length;angle=math.degrees(math.atan2(d.y,d.x))
 s=box(0,-w/2,z,length,w/2,z+h);s.rotate(V(),V(0,0,1),angle);s.translate(V(a[0],a[1],0));return s
RAIL_EDGES=[(RODS[0],RODS[1]),(RODS[1],RODS[2]),(RODS[2],RODS[3]),(RODS[3],RODS[0])]
# Export the four existing optical couplers as printable parts without adding
# duplicate assembly bodies. Black opaque ABS and light-leak testing are required.
_c=add('CouplerPrintMaster',g.coupler,group='sipm',printed=True,key='optical_coupler',note='Opaque black ABS; print and inspect optical pockets, then check light tightness with the actual sensor and fiber ends.')
g.LEAVES=[p for p in g.LEAVES if p[0]!=_c];DOC.removeObject(_c.Name);CHECKS.pop();PRINTS['optical_coupler']['quantity']=4
# Corner cradles are open upward; removable overhang caps secure wrapped tiles.
# Offset by 0.65 per edge and 0.64 in Z above nominal 7 mm tile provides room for wrap.
outer=g.hull_face.makeOffset2D(3.2,0).Faces[0]
inner=g.hull_face.makeOffset2D(.65,0).Faces[0]
inside=g.hull_face.makeOffset2D(-5,0).Faces[0]
for i,((vx,vy),(rx,ry)) in enumerate(zip(g.HULL,RODS)):
 disc=Part.Face(Part.Wire(Part.makeCircle(20,V(vx,vy,0))))
 plan=outer.common(disc)
 cradle=prism(plan,-6.8,5.0).cut(prism(inner,-4.15,6)).cut(prism(inside,-8,8))
 # Structural web links corner to tower, outside the tile edge. Radial web ends
 # overlap both solids to avoid a merely touching STL seam.
 d=V(rx-vx,ry-vy,0);d.normalize();normal=V(-d.y,d.x,0)
 web=poly_face([(vx+normal.x*5,vy+normal.y*5),(rx+normal.x*5,ry+normal.y*5),(rx-normal.x*5,ry-normal.y*5),(vx-normal.x*5,vy-normal.y*5)])
 cradle=cradle.fuse(prism(web,-6.8,-4.3))
 tower=box(rx-9,ry-9,-9,rx+9,ry+9,91)
 # Female recess below, male above; shoulders carry compression, not latches.
 tower=tower.cut(box(rx-SOCKET/2,ry-SOCKET/2,-9.1,rx+SOCKET/2,ry+SOCKET/2,-.5))
 tower=tower.fuse(box(rx-6,ry-6,91,rx+6,ry+6,99))
 # Front-facing bridge clip seats at each 100 mm segment joint.
 for zz in (-9,91):
  for dz in (-10,10):
   tower=tower.cut(box(rx-3.3,ry-9.1,zz+dz-1.2,rx+3.3,ry-7.9,zz+dz+1.2))
 # Sliding rail sockets sit above the optical tile; 0.25 mm assembly clearance.
 for a,b in RAIL_EDGES:
  tower=tower.cut(beam(a,b,7.75,8.5,3.7))
 module=tower.fuse(cradle).removeSplitter()
 # Clear the joined web from the socket and latch recesses after fusion.
 module=module.cut(box(rx-SOCKET/2,ry-SOCKET/2,-9.1,rx+SOCKET/2,ry+SOCKET/2,-.5))
 for zz in (-9,91):
  for dz in (-10,10):module=module.cut(box(rx-3.3,ry-9.15,zz+dz-1.2,rx+3.3,ry-7.9,zz+dz+1.2))
 for xa,xb in ((rx-9.1,rx-8.65),(rx+8.65,rx+9.1)):
  module=module.cut(box(xa,ry-9.1,5.7,xb,ry-6.1,7.1))
 cap=prism(plan,5.25,7.65).cut(prism(inside,3,9))
 cap=cap.fuse(prism(plan.common(inner),4.15,5.3).cut(prism(inside,3,9)))
 # Open-sided C collar joins lid to tower. Beam jaws flex around the 18 mm
 # tower and snap into a 0.6 mm relief. Load remains in the cradle below.
 collar=box(rx-11.65,ry-11.65,5.25,rx+11.65,ry+11.65,7.65).cut(box(rx-9.25,ry-9.25,5,rx+9.25,ry+9.25,8))
 collar=collar.cut(box(rx-8.8,ry-13,5,rx+8.8,ry-8.8,8))
 cap=cap.fuse(prism(web,5.25,7.65)).fuse(collar)
 cap=cap.cut(box(rx-9.25,ry-9.25,3,rx+9.25,ry+9.25,9)).removeSplitter()
 for xa,xb in ((rx-9.5,rx-8.75),(rx+8.75,rx+9.5)):
  cap=cap.fuse(box(xa,ry-8.8,5.95,xb,ry-6.4,6.85)).removeSplitter()
 # Cap slides on two square keys outside the scintillator; keyed dowels avoid screws.
 # The cap's short friction pegs are retained by the upper tower shoulder locking bar.
 cap=cap.cut(prism(inner,3.9,4.4))
 for k in range(4):
  topmod=module if k<3 else module.common(box(rx-50,ry-50,-20,rx+50,ry+50,20)).fuse(box(rx-6,ry-6,20,rx+6,ry+6,28))
  add(f'CornerTower_{k}_{i}',moved(topmod,z=100*k),printed=True,key=f'corner_tower_{i}'+('_top' if k==3 else ''),note='Print on the broad outer tower face using supports beneath cradle shelf; use exported upright orientation for preview. Tower carries compression; test lateral loads.')
  add(f'TileCap_{k}_{i}',moved(cap,z=100*k),printed=True,key=f'tile_cap_{i}',note='Seat only after wrapping; secure with printed cradle keeper. Do not force against scintillator.')
 # Foot with matching post and wide floor pad. Tip resistance still needs physical test.
 foot=box(rx-19,ry-19,-14,rx+19,ry+19,-9).fuse(box(rx-6,ry-6,-9,rx+6,ry+6,-1))
 add(f'Foot_{i}',foot,printed=True,key='tower_foot')
 end=box(rx-9,ry-9,391,rx+9,ry+9,395).cut(box(rx-6.25,ry-6.25,390.9,rx+6.25,ry+6.25,399))
 # Top module may extend above last detector; its top cap closes the top tenon.
 end=box(rx-9,ry-9,320,rx+9,ry+9,331).cut(box(rx-6.25,ry-6.25,319.9,rx+6.25,ry+6.25,328.5))
 add(f'TowerTop_{i}',end,printed=True,key='tower_top')

# Snap bridge: active spring span 20 mm, 1.6 thickness, 6 width. Two hooks
# engage shallow reliefs straddling the joint; screwdriver access at centre.
clip=box(-3,-1.6,-11,3,0,11)
for zz in (-10,10):
 clip=clip.fuse(box(-3,-.1,zz-.7,3,.6,zz+.7))
clip=clip.cut(box(-1.5,-2,-1,1.5,-.7,1))
for i,(rx,ry) in enumerate(RODS):
 for j in range(1,4):
  add(f'TowerRetainer_{i}_{j}',moved(clip,rx,ry-9,100*j-9),printed=True,key='tower_retainer',rotation=(V(1,0,0),90),note='Print flat on outside face. 20 mm span, 1.6 mm beam, 0.5 mm nominal insertion deflection; approx 0.30% ideal strain. Tool release via centre opening.')

# Closed load frames at every detector level. Front/back bars are single pieces;
# sloping side bars are divided to remain printable for widest reclaimed tiles.
# Rails lie below the scintillator, and their ends overlap shaped tower recesses.
RAIL_Z=8.; RAIL_H=3.2; RAIL_W=8.
def beam(a,b,z,w=8,h=3.2):
 d=V(b[0]-a[0],b[1]-a[1],0);length=d.Length;angle=math.degrees(math.atan2(d.y,d.x))
 s=box(0,-w/2,z,length,w/2,z+h);s.rotate(V(),V(0,0,1),angle);s.translate(V(a[0],a[1],0));return s
for k in range(4):
 for e,(a,b) in enumerate(RAIL_EDGES):
  length=math.dist(a,b);count=math.ceil(length/190)
  for seg in range(count):
   p=(a[0]+(b[0]-a[0])*seg/count,a[1]+(b[1]-a[1])*seg/count)
   q=(a[0]+(b[0]-a[0])*(seg+1)/count,a[1]+(b[1]-a[1])*(seg+1)/count)
   s=beam(p,q,100*k+RAIL_Z)
   for rx,ry in (a,b):
    lap=box(rx-12,ry-12,100*k+RAIL_Z+(1.5 if e%2==0 else -.1),rx+12,ry+12,100*k+RAIL_Z+(3.3 if e%2==0 else 1.7))
    s=s.cut(lap)
   angle=-math.degrees(math.atan2(b[1]-a[1],b[0]-a[0]))
   add(f'Rail_{k}_{e}_{seg}',s,printed=True,key=f'rail_{e}_{seg}',rotation=(V(0,0,1),angle),note='Structural rail prototype. Seat in matching corner sockets before stacking. Intermediate joints use printed sleeve.')
  if count>1:
   mid=((a[0]+b[0])/2,(a[1]+b[1])/2)
   angle=math.degrees(math.atan2(b[1]-a[1],b[0]-a[0]))
   sleeve=box(-15,-6,100*k+RAIL_Z-2.4,15,6,100*k+RAIL_Z+5.9).cut(box(-16,-4.25,100*k+RAIL_Z-.25,16,4.25,100*k+RAIL_Z+3.45))
   sleeve.rotate(V(),V(0,0,1),angle);sleeve.translate(V(mid[0],mid[1],0))
   add(f'RailSleeve_{k}_{e}',sleeve,printed=True,key='rail_sleeve',rotation=(V(0,0,1),-angle),note='Slide over joined rail ends; retention is a prototype interference-fit feature pending coupon tests.')

# Pods use edge rails and removable flexing side lids. No metal screws/inserts.
# Board coordinates are x/y in the PCB plane, z above board; all populate one side.
ELEC=g.part('ModularElectronics',ST);CABLES=g.part('ModularHarness',ST)
SPEC={'detector':{'size':[60,45],'headers':[[30,36]],'ufl':[52,4]},'controller':{'size':[100,80],'headers':[[85,8],[62,8],[39,8],[16,8]],'usb':[85,75]}}
def pod(kind):
 w,h=SPEC[kind]['size'];floor=2.4;bb=7.0;top=21.6
 base=box(-3,-3,0,w+3,h+3,top-2.4).cut(box(-.6,-.6,floor,w+.6,h+.6,top))
 # Continuous PCB edge shelves, plus lid standoffs above keepout-only board edges.
 for x0,x1 in ((-.6,1.5),(w-1.5,w+.6)):
  base=base.fuse(box(x0,0,floor,x1,h,bb))
 # Connector clearance windows. Headers remain inside pod; harness exits rear edge.
 for cx,cy in SPEC[kind]['headers']:
  base=base.cut(box(cx-8,-3.1 if cy<h/2 else h-.1,bb+1.6,cx+8,.1 if cy<h/2 else h+3.1,top))
 if kind=='detector':base=base.cut(box(48,-3.1,6.6,56,.1,12.6))
 else:base=base.cut(box(79,h-.1,5,91,h+3.1,12))
 # Latch slots in left and right walls.
 for x in (-3,w+.6):
  for y in (10,h-10):base=base.cut(box(x-.1,y-4,5.75,x+2.5,y+4,7.5))
 for x0,x1 in ((-3.1,-2.35),(w+2.35,w+3.1)):
  base=base.cut(box(x0,h/2-3.5,13.1,x1,h/2+3.5,15.2))
 lid=box(-3,-3,top-2.4,w+3,h+3,top)
 for x,side in ((-4.05,-1),(w+3.25,1)):
  for y in (10,h-10):
   leg=box(x,y-3,5.5,x+.8,y+3,top-.1)
   hook=box(x if side<0 else w+2.5,y-3,6,x+1.55 if side<0 else x+.8,y+3,7)
   bridge=box(x if side<0 else w+2.5,y-3,top-2.4,-2.5 if side<0 else x+.8,y+3,top)
   lid=lid.fuse(leg).fuse(hook).fuse(bridge)
 if kind=='controller':lid=lid.cut(cyl(75,60,top-3,top+1,2.4))
 # Vent slots outside sensor light-tight enclosure; ASIC thermal performance unvalidated.
 for x in range(12,int(w)-8,8):lid=lid.cut(box(x,15,top-3,x+3,h-15,top+.1))
 return base.removeSplitter(),lid.removeSplitter(),bb

PCB_CACHE={}
def place_board(kind,index,origin):
 spec=SPEC[kind];w,h=spec['size'];base,lid,bb=pod(kind)
 x,y,z=origin
 add(f'{kind}_{index}_base',moved(base,x,y,z),group='electronics',printed=True,key=kind+'_pod_base',parent=ELEC,note='Floor down; 0.6 mm PCB edge allowance. Connector windows and component envelopes must be checked against final routed PCB.')
 add(f'{kind}_{index}_lid',moved(lid,x,y,z),group='electronics',printed=True,key=kind+'_pod_lid',parent=ELEC,rotation=(V(1,0,0),180),note='Lid exterior down. Short lid snaps are initial geometry; coupon and fatigue testing required before use.')
 pcbpath=os.path.join(g.HW,'out','modular',kind,kind+'.step')
 if not os.path.exists(pcbpath):raise FileNotFoundError('Populated PCB STEP required: '+pcbpath)
 if kind not in PCB_DEFS:
  source=DOC.addObject('Part::Feature',kind+'_PCB_Definition');source.Shape=Part.read(pcbpath)
  if not source.Shape.isValid():raise ValueError('Invalid populated PCB STEP '+kind)
  PCB_DEFS[kind]=source
 # Native App::Link instances share populated PCB geometry in FCStd and STEP.
 placement=App.Placement(V(x+w,y,z+bb),App.Rotation(V(0,0,1),180))
 linked_board(f'{kind}_{index}_populated_PCB',PCB_DEFS[kind],placement,ELEC)
 if kind=='detector':
  meta=json.load(open(os.path.join(g.HW,'out','modular',kind,'board.json')))
  q=next(a for a in meta['parts'] if a['ref']=='Q1')
  # Missing supplier STEP: explicitly named conservative package envelope.
  add(f'{kind}_{index}_Q1_envelope',moved(box(w-q['x']-1.6,q['y']-1.6,bb+1.6,w-q['x']+1.6,q['y']+1.6,bb+2.8),x,y,z),group='electronics',parent=ELEC)
 for j,(hx,hy) in enumerate(spec['headers']) if os.getenv('HEADER_ENVELOPES')=='1' else []:
  add(f'{kind}_{index}_header{j}',moved(box(hx-10,hy-4.4,bb+1.6,hx+10,hy+4.4,bb+10.6),x,y,z),group='electronics',parent=ELEC)
 if kind=='controller' and os.getenv('HEADER_ENVELOPES')=='1':
  add('ControllerExpansionHeader_envelope',moved(box(4.6,37,bb+1.6,13.4,57,bb+10.6),x,y,z),group='electronics',parent=ELEC)
 # Component placements substituted from actual PCB STEP when available.
 return origin,bb
# Printed rear shelves connect detector pods to the rear frame. Two 3.2 mm
# webs carry pod weight; side guide lips locate the pod with 0.25 mm clearance.
def shelf(origin,w,h,rail_z):
 x,y,z=origin
 sh=box(x-5,g.YTOP+12,rail_z+3.2,x+w+5,y+h+4,rail_z+5.6)
 # Broad plate with large central opening leaves a peripheral load frame.
 sh=sh.cut(box(x+8,g.YTOP+29,rail_z+3,x+w-8,y+h-6,rail_z+7))
 for xx in (x+6,x+w-6):
  collar=box(xx-6,g.YTOP+10.6,rail_z-2.4,xx+6,g.YTOP+23.4,rail_z+5.6)
  collar=collar.cut(box(xx-6.1,g.YTOP+12.75,rail_z-.25,xx+6.1,g.YTOP+21.25,rail_z+3.45))
  sh=sh.fuse(collar)
 # Long flexible shelf fingers engage shallow pod grooves. 16.8 mm cantilever,
 # 1.2 mm thick, .4 mm deflection; about .26% ideal bending strain.
 for xx,side in ((x-4.5,-1),(x+w+3.3,1)):
  finger=box(xx,y+h/2-3,rail_z+3.2,xx+1.2,y+h/2+3,z+14.8)
  hook=box(xx if side<0 else xx-.7,y+h/2-3,z+13.5,xx+1.9 if side<0 else xx+1.2,y+h/2+3,z+14.8)
  sh=sh.fuse(finger).fuse(hook)
 for rx,ry in RODS:
  sh=sh.cut(box(rx-9.25,ry-9.25,rail_z-3,rx+9.25,ry+9.25,z+20))
 return sh.removeSplitter()
ORIGINS=[]
for k in range(4):
 # Place each detector board just behind its SiPM; horizontal pod away from tile.
 origin=(g.SX-30,g.YTOP+32,100*k+13.6);ORIGINS.append(place_board('detector',k,origin))
 if k!=1:add(f'DetectorShelf_{k}',shelf(origin,60,45,100*k+8),printed=True,key='detector_shelf',note='Slides over back rail; pod locates on shelf. Add printed retaining clips before carrying station.')
# Controller sits near mid-height with space behind detector pods for IDC routes.
CTRL=(g.SX-50,g.YTOP+105,113.6);control=place_board('controller',0,CTRL)
add('CombinedControllerDetectorShelf',shelf(CTRL,100,80,108).fuse(shelf(ORIGINS[1][0],60,45,108)).removeSplitter(),printed=True,key='controller_shelf',note='Slides on back rail at the second tile. Printed shelf locates hub; verify loaded deflection.')
# External antenna is a vendor-neutral envelope and cable route, pending the
# exact Wi-Fi antenna selection. It remains outside the conducting PCB/shield.
add('WiFi_FPC_Antenna_envelope',moved(box(60,66,21.7,90,74,22.0),*CTRL),group='cables',parent=ELEC)
antpts=[(CTRL[0]+72,CTRL[1]+52,CTRL[2]+10),(CTRL[0]+75,CTRL[1]+60,CTRL[2]+12),(CTRL[0]+75,CTRL[1]+60,CTRL[2]+22.5),(CTRL[0]+76,CTRL[1]+68,CTRL[2]+22.5)]
add('WiFi_AntennaPigtail_envelope',g.pipe(g.fillet_wire(antpts,2),.5),group='cables',parent=CABLES)
for k,((x,y,z),bb) in enumerate(ORIGINS):
 start=(g.SX,g.YTOP+10.5,100*k)
 end=(x+52,y+4,z+bb+4)
 pts=[start,(start[0],y-10,start[2]),(end[0],y-10,end[2]),end]
 try:wire=g.pipe(g.fillet_wire(pts,5),.57)
 except Exception:wire=Part.makeCompound([Part.makeCylinder(.57,(V(*b)-V(*a)).Length,V(*a),V(*b)-V(*a)) for a,b in zip(pts,pts[1:])])
 add(f'SensorCoax_{k}',wire,group='cables',parent=CABLES)
 WIRES.append({'name':f'SensorCoax_{k}','type':'1.13 mm micro-coax with U.FL','polyline_mm':pts,'cut_length_mm':math.ceil(sum(math.dist(a,b) for a,b in zip(pts,pts[1:]))+20),'allowance_mm':20})
 # Ten individual insulated wires, routed as flat harness; white/colored cores represented separately.
 for j in range(10):
  dx=(j-4.5)*1.1
  start=(x+30+dx,y+36,z+bb+11)
  end=(CTRL[0]+SPEC['controller']['headers'][k][0]+dx,CTRL[1]+8,CTRL[2]+bb+11)
  pts=[start,(start[0],g.YTOP+96,start[2]),(end[0],g.YTOP+96,end[2]),end]
  # Avoid zero-length corners in mid-stack channels.
  pts=[p for ii,p in enumerate(pts) if ii==0 or math.dist(p,pts[ii-1])>.01]
  try:s=g.pipe(g.fillet_wire(pts,5),.42)
  except Exception:s=Part.makeCompound([Part.makeCylinder(.42,(V(*b)-V(*a)).Length,V(*a),V(*b)-V(*a)) for a,b in zip(pts,pts[1:])])
  add(f'Harness_{k}_wire_{j}',s,group='cables',parent=CABLES)
 WIRES.append({'name':f'DetectorHarness_{k}','type':'10 conductors; assignment from electronics interface','polyline_mm':pts,'cut_length_mm':math.ceil(sum(math.dist(a,b) for a,b in zip(pts,pts[1:]))+30),'allowance_mm':30})

# Fit-test assembly: three sockets, detachable common male, and retaining clip.
COUPONS=os.path.join(g.HW,'out','case','modular_v2','coupons');os.makedirs(COUPONS,exist_ok=True)
for clear in (.15,.25,.35):
 outer=box(0,0,0,22,22,12);sz=12+2*clear
 socket=outer.cut(box(11-sz/2,11-sz/2,3.5,11+sz/2,11+sz/2,12.1))
 socket.exportStep(os.path.join(COUPONS,f'socket_{clear:.2f}.step'));mesh(socket,os.path.join(COUPONS,f'socket_{clear:.2f}.stl'))
male=box(0,0,0,18,18,4).fuse(box(3,3,4,15,15,12));male.exportStep(os.path.join(COUPONS,'male.step'));mesh(male,os.path.join(COUPONS,'male.stl'))
mesh(normalized(clip,(V(1,0,0),90)),os.path.join(COUPONS,'retainer.stl'))
DOC.recompute()
manifest={'revision':'modular_v2','status':'mechanical prototype; not physically validated','tile':g.N,'hull':g.HULL,'xs':g.SX,'zs':g.ZS,'zc':150,'y_top':g.YTOP,'parts':[],'printed_parts':list(PRINTS.values()),'printer':MATERIAL,'wires':WIRES,'geometry_checks':CHECKS,'board_geometry_status':'Actual populated KiCad STEP imported with rigid 180 degree Z transform; real C5665 IDC header models are included; detector Q1 and Wi-Fi antenna/pigtail use explicitly named package envelopes; pins/components from supplier STEP may differ from manufactured part.','snap':{'clearance_per_side_mm':CLEAR,'tower_retainer_beam_mm':[20,6,1.6],'deflection_mm':.5,'ideal_strain_percent':.30,'validation':'Analytical screening only. ABS orientation, fatigue, creep, tolerance and loads require printed tests.'}}
for o,group,color,alpha,tol in g.LEAVES:
 local=o.Shape.copy();local.Placement=App.Placement();path=os.path.join(OUT,'stl',o.Name+'.stl')
 if o.Name.endswith('_populated_PCB'):
  path=os.path.join(g.COMMON,o.Name.split('_')[0]+'_populated_PCB.stl')
  source_step=os.path.join(g.HW,'out','modular',o.Name.split('_')[0],o.Name.split('_')[0]+'.step')
  if not os.path.exists(path) or os.path.getmtime(path)<os.path.getmtime(source_step):mesh(local,path,.15)
 elif o.Name.startswith(('Tile1_','Tile2_','Tile3_')):
  path=os.path.join(OUT,'stl','Tile0_'+o.Name.split('_',1)[1]+'.stl')
  if not os.path.exists(path):mesh(local,path,.15)
 else:mesh(local,path,.15)
 m=global_placement(o).toMatrix()
 manifest['parts'].append({'name':o.Name,'group':group,'color':color,'alpha':alpha,'matrix':[m.A11,m.A12,m.A13,m.A14,m.A21,m.A22,m.A23,m.A24,m.A31,m.A32,m.A33,m.A34,0,0,0,1],'stl':path,'vol':round(o.Shape.Volume,3),'sec':{}})
for o,group,col,alpha,tol in g.LEAVES:
 try:o.ViewObject.ShapeColor=col;o.ViewObject.Transparency=int((1-alpha)*100)
 except Exception:pass
DOC.saveAs(os.path.join(OUT,'station.FCStd'))
# A flattened STEP is interoperable with ClassCAD and independent of App::Part support.
import Import
Import.export([ST],os.path.join(OUT,'station.step'))
with open(os.path.join(OUT,'manifest.json'),'w') as f:json.dump(manifest,f,indent=2)
print(f'MODULAR_V2 tile {g.N}: {len(g.LEAVES)} assembly leaves, {len(PRINTS)} printable part types, {sum(p["quantity"] for p in PRINTS.values())} printed pieces')
App.closeDocument(DOC.Name)
