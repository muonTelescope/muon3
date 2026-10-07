import {mkdirSync,writeFileSync} from 'node:fs';
import {detector,controller,DIMENSIONS,HARNESS,FPGA_PINS,MCU_PINS} from './modular.ts';
import {Board,PLANE_LAYERS} from './board.ts';
import {place,type Floorplan} from './place.ts';
import {autoroute} from './autoroute.ts';
import {toCopper} from './copper.ts';
import {buildPlanes} from './planes.ts';
import {writeKicad,footprint} from './kicad.ts';
import {renderSvg} from './svg.ts';
import {checkBoard} from './drc.ts';
import {jlcFiles} from './jlc.ts';
import {writeSchematic} from './modular_schematic.ts';
const OUT=new URL('../out/modular/',import.meta.url).pathname;mkdirSync(OUT,{recursive:true});
for(const name of ['detector','controller'] as const){
 if(process.argv[2] && process.argv[2]!==name) continue;
 const c=await (name==='detector'?detector:controller)();const d=DIMENSIONS[name];const b=new Board(c,d.w,d.h);
 const fp:Floorplan={fixed:{},groups:{},keepouts:[]};
 if(name==='detector'){
  fp.fixed.J100={x:30,y:36,rot:0}; fp.fixed.J2={x:8,y:4,rot:0};fp.fixed.U2={x:5,y:32,rot:0};
  fp.groups={hv:{x:44,y:15},ch0:{x:14,y:13},inj:{x:20,y:24},dac:{x:29,y:20},rails:{x:45,y:30},bme:{x:5,y:32}};
 }else{
  for(let i=0;i<4;i++)fp.fixed[`J${100+i}`]={x:15+i*23,y:8,rot:0};fp.fixed.J104={x:91,y:47,rot:90};
  fp.fixed.J1={x:15,y:75,rot:0};fp.fixed.U1={x:28,y:52,rot:270};
  const f=c.parts.find(p=>p.lcsc==='C2678152')!; fp.fixed[f.ref]={x:62,y:36,rot:0};
  Object.assign(fp.fixed,{C1:{x:57,y:31,rot:0},C5:{x:53,y:29,rot:0},C6:{x:56,y:47,rot:0},C10:{x:70,y:37,rot:0},C11:{x:70,y:39.5,rot:0},R10:{x:73,y:37,rot:0},C12:{x:65,y:47,rot:0},C13:{x:62,y:29,rot:0},C14:{x:53,y:32,rot:0},C15:{x:53,y:34.5,rot:0},R11:{x:53,y:38,rot:0},R12:{x:53,y:40.5,rot:0},R13:{x:57,y:44,rot:0},R14:{x:61,y:46,rot:0},R15:{x:68,y:43,rot:0},Y1:{x:73,y:29,rot:0},R16:{x:69,y:31,rot:0},C16:{x:75,y:33,rot:0}});
  fp.groups={usb:{x:15,y:66},mcu:{x:30,y:50},rails:{x:44,y:67},fpga:{x:62,y:36},core_rail:{x:54,y:56},clock:{x:72,y:43},mux:{x:40,y:27},harness:{x:52,y:17},expansion:{x:88,y:43}};
 }
 // Snap-in rails require clear 1.5 mm side borders; no metal fasteners.
 fp.keepouts.push({x0:0,y0:0,x1:1.5,y1:d.h,why:'printed edge rail'},{x0:d.w-1.5,y0:0,x1:d.w,y1:d.h,why:'printed edge rail'});
 place(b,fp);console.log(name,c.parts.length,'parts',c.check());
 const dir=OUT+name+'/';mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'placement.svg',renderSvg(b,{rats:true,title:`Muon3 Rev E ${name} — engineering review`}));
 writeSchematic(c,dir+name+'.kicad_sch',name);
 writeFileSync(dir+'netlist.json',JSON.stringify(c.parts,null,1));
 writeFileSync(dir+'board.json',JSON.stringify({name,...d,thickness:1.6,top_envelope:9.1,bottom_envelope:3.5,parts:c.parts.map(p=>({ref:p.ref,mpn:p.info.mpn,value:p.value,...p.place,bbox:p.info.footprint.bbox})),connectors:c.parts.filter(p=>p.ref.startsWith('J')).map(p=>({ref:p.ref,...p.place,pins:p.pads}))},null,2));
 if(process.env.PLACEMENT_ONLY!=='1'){const r=autoroute(b,[],undefined,console.log,Number(process.env.ROUTE_PASSES??250));toCopper(b,r,{smooth:false});buildPlanes(b,PLANE_LAYERS,[]);}
 mkdirSync(dir+'muon3.pretty',{recursive:true});for(const p of b.parts){let f=footprint(b,p,()=>0).replace('\"muon3:', '\"').replace(/\(net 0 \"[^\"]*\"\)/g,'');writeFileSync(dir+'muon3.pretty/'+p.info.footprint.name+'.kicad_mod',f);}writeFileSync(dir+'fp-lib-table','(fp_lib_table (lib (name \"muon3\") (type \"KiCad\") (uri \"${KIPRJMOD}/muon3.pretty\") (options \"\") (descr \"Generated verified pad geometry\")))');
 writeKicad(b,dir+name+'.kicad_pcb',`Muon3 Rev E ${name} — NOT RELEASED`);
 writeFileSync(dir+'routed.svg',renderSvg(b,{title:`Muon3 Rev E ${name}`}));
 for(const [file,data] of Object.entries(jlcFiles(b)))writeFileSync(dir+file,data);
 const drc=checkBoard(b);writeFileSync(dir+'validation.json',JSON.stringify({release:false,circuit_issues:c.check(),routing:drc,remaining:['Independent KiCad DRC/ERC','Circuit simulation and physical pulse/cable tests','USB current budget and FPGA power sequencing verification','PCB fabrication release withheld until all checks pass']},null,2));console.log(name,'DRC',drc.clearance.length,'clearances',drc.open.length,'open');
}
writeFileSync(OUT+'interface.json',JSON.stringify({revision:'E',dimensions:DIMENSIONS,harness:HARNESS,fpga:FPGA_PINS,mcu:MCU_PINS,i2c:{mux_address:'0x70',selection:'exactly one port at a time',dac_address:'0x60',bme_address:'0x76'},clock_hz:100000000,status:'engineering review; not fabrication released'},null,2));
