// Native self-contained KiCad schematics: functional blocks, standard passive
// graphics, explicit IC electrical pin types, exact pad-number connectivity.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import type {Circuit,Part} from './circuit.ts';
const q=JSON.stringify,uid=randomUUID;
const eff='(effects (font (size 1.27 1.27)))';
const library=[process.env.KICAD_SYMBOL_DIR,'/Applications/KiCad/KiCad.app/Contents/SharedSupport/symbols','/usr/share/kicad/symbols'].find(p=>p&&existsSync(p+'/Device.kicad_sym'));
function balanced(source:string,start:number){let d=0,quoted=false,escape=false;for(let i=start;i<source.length;i++){const c=source[i];if(escape){escape=false;continue;}if(c==='\\'&&quoted){escape=true;continue;}if(c==='"'){quoted=!quoted;continue;}if(!quoted){if(c==='(')d++;if(c===')'&&--d===0)return source.slice(start,i+1);}}throw Error('Unbalanced library');}
function standard(name:string,ref:string,category='Device'){if(!library)throw Error('KiCad symbol library not found; set KICAD_SYMBOL_DIR');const source=readFileSync(library+'/'+category+'.kicad_sym','utf8');const start=source.indexOf(`(symbol "${name}"`);if(start<0)throw Error('Missing standard '+name);const raw=balanced(source,start),parent=raw.match(/\(extends \"([^\"]+)\"\)/);if(parent)return standard(parent[1],ref,category);return raw.replaceAll(`"${name}`,`"${ref}`).replace(`(symbol "${ref}"`,`(symbol "mod:${ref}"`);}
type Pin={num:string;name:string;x:number;y:number;angle:number;type:string};
const power=(s:string)=>/^(GND|ADJ\/GND|VSS|EP|V-|V\+|VDD|VCC|VDDIO|VCCPLL|VCCIO_\d|VPP_2V5|SPI_Vccio1|3V3|VIN|VBUS)$/.test(s);
function pinType(p:Part,num:string,n:string):string {
 const m=p.info.mpn,net=p.pads[num]??'';
 if(!/^[UY]/.test(p.ref))return 'passive';
 if(/USBLC/.test(m))return 'passive';
 if(/^NC/.test(n))return 'no_connect';
 if(power(n))return 'power_in';
 if(/AMS1117|TLV1117/.test(m)&&num==='4')return 'passive'; // Exposed tab is the same output as pin 2, not a second regulator.
 if(/TLV75|AMS1117|TLV1117/.test(m)){if(n==='IN')return 'power_in';if(/^(OUT|VOUT)$/.test(n))return 'power_out';return 'input';}
 if(/OPA356|LMV7219/.test(m))return n==='OUT'?'output':'input';
 if(/TC4427/.test(m))return n.startsWith('OUT')?'output':'input';
 if(/MC34063/.test(m))return n==='SWE'?'output':['SWC','TCAP'].includes(n)?'passive':'input';
 if(/MCP4728/.test(m))return n==='SDA'?'bidirectional':n.startsWith('VOUT')?'output':n.startsWith('RDY')?'open_collector':'input';
 if(/BME280/.test(m))return n==='SDI'?'bidirectional':'input';
 if(/TCA9546/.test(m))return /^S[DC]/.test(n)?'bidirectional':'input';
 if(p.ref.startsWith('Y'))return n==='OUT'?'output':'input';
 if(/ESP32/.test(m)){
  if(['USB_DP','USB_DN','SDA'].includes(net))return 'bidirectional';
  if(['SPI_MISO','CFG_MISO','CDONE','IRQ','ESP_EN','BOOT','CC1','CC2'].includes(net)||net.startsWith('HV_MON'))return 'input';
  if(net&&!net.startsWith('NC'))return 'output';
  return 'bidirectional';
 }
 if(/ICE40/i.test(m)){
  if(['SPI_MISO','CFG_MISO','IRQ'].includes(net))return 'output';
  if(net==='CDONE')return 'open_collector';
  if(net)return 'input';
  return 'bidirectional';
 }
 throw Error(`Unreviewed IC pin types: ${p.ref} ${m}`);
}
const groupTitle:Record<string,string>={hv:'SiPM bias — internal HV',ch0:'Analog front end and discriminator',dac:'Threshold / baseline / bias DAC',rails:'Power regulation',inj:'Electrical calibration injection',bme:'Detector temperature / pressure',harness:'Keyed low-voltage detector harness',usb:'USB-C input and ESD',mcu:'ESP32-S3 USB / Wi-Fi control',fpga:'FPGA acquisition and decoupling',core_rail:'FPGA core supply',clock:'Acquisition reference clock',mux:'Four isolated I2C branches',expansion:'Future tracking expansion'};
function passiveValue(p:Part){if(p.ref.startsWith('R'))return p.value+'R';if(p.ref.startsWith('C'))return p.value+'F';if(p.ref.startsWith('L'))return p.value+'H';return p.value;}
export function writeSchematic(c:Circuit,path:string,name:string){
 const rootId=uid(),lib:string[]=[],body:string[]=[];
 let powerCount=0;
 function label(net:string,x:number,y:number,side=1){body.push(`(label ${q(net)} (at ${x} ${y} 0) (effects (font (size 1.27 1.27)) (justify ${side<0?'right':'left'} bottom)) (uuid "${uid()}"))`);}
 function wire(x:number,y:number,xx:number,yy:number){body.push(`(wire (pts (xy ${x} ${y}) (xy ${xx} ${yy})) (stroke (width 0) (type default)) (uuid "${uid()}"))`);}
 function powerSymbol(net:string,x:number,y:number){
  const ref='#PWR'+(++powerCount),id='Power'+powerCount,gnd=net==='GND';
  const line=gnd?'(polyline (pts (xy 0 0) (xy 0 -1.27) (xy -1.27 -1.27) (xy 0 -2.54) (xy 1.27 -1.27) (xy 0 -1.27)) (stroke (width 0) (type default)) (fill (type none)))':'(polyline (pts (xy 0 0) (xy 0 2.54) (xy -1.27 1.27) (xy 0 2.54) (xy 1.27 1.27)) (stroke (width 0) (type default)) (fill (type none)))';
  lib.push(`(symbol "mod:${id}" (power) (pin_names (offset 0) hide) (in_bom no) (on_board no) (property "Reference" "${ref}" (at 0 0 0) (effects (font (size 1.27 1.27)) hide)) (property "Value" ${q(net)} (at 0 ${gnd?-4:4} 0) ${eff}) (symbol "${id}_0_1" ${line}) (symbol "${id}_1_1" (pin power_in line (at 0 0 ${gnd?90:270}) (length 0) hide (name ${q(net)} ${eff}) (number "1" ${eff}))))`);
  body.push(`(symbol (lib_id "mod:${id}") (at ${x} ${y} 0) (unit 1) (in_bom no) (on_board no) (dnp no) (uuid "${uid()}") (property "Reference" "${ref}" (at ${x} ${y} 0) (effects (font (size 1.27 1.27)) hide)) (property "Value" ${q(net)} (at ${x} ${y+(gnd?4:-4)} 0) ${eff}) (pin "1" (uuid "${uid()}")) (instances (project ${q(name)} (path "/${rootId}" (reference "${ref}") (unit 1)))))`);
 }
 function emit(p:Part,x:number,y:number){
  let pins:Pin[]=[],symbol:string,h=0;
  const librarySymbol=/OPA356/.test(p.info.mpn)?['OPA356xxDBV','Amplifier_Operational']:/LMV7219/.test(p.info.mpn)?['LMV7219M5','Comparator']:p.ref.startsWith('TP')?['TestPoint','Connector']:null;
  const kind=p.ref.match(/^(R|C|L)\d/);
  if(librarySymbol){
   symbol=standard(librarySymbol[0],p.ref,librarySymbol[1]);
   for(const match of symbol.matchAll(/\(pin (power_in|input|output|passive|bidirectional) /g)){const chunk=balanced(symbol,match.index!);const a=chunk.match(/\(at ([\d.-]+) ([\d.-]+) ([\d.-]+)\)/)!,num=chunk.match(/\(number \"([^\"]+)\"/)!,nm=chunk.match(/\(name \"([^\"]+)\"/)!;pins.push({num:num[1],name:(nm?.[1]??p.info.pins[num[1]]),x:+a[1],y:+a[2],angle:+a[3],type:match[1]});}
   if(pins.length!==Object.keys(p.info.pins).length)throw Error('Library pin count mismatch '+p.ref);h=Math.max(...pins.map(pn=>Math.abs(pn.y)),5.08);
  } else if(kind){
   const sym=kind[1]==='R'?'R_Small_US':kind[1];symbol=standard(sym,p.ref);
   const lengths:Record<string,number>={R:2.54,C:3.81,L:3.81};const a=lengths[kind[1]];
   pins=[{num:'1',name:'1',x:0,y:a,angle:270,type:'passive'},{num:'2',name:'2',x:0,y:-a,angle:90,type:'passive'}];h=a;
  } else {
   const values=Object.entries(p.info.pins),half=Math.ceil(values.length/2);h=Math.max(5.08,(half+1)*1.27);
   pins=values.map(([num,n],i)=>({num,name:n,x:i<half?-33.02:33.02,y:h-(i%half+1)*2.54,angle:i<half?0:180,type:pinType(p,num,n)}));
   const pinrows=pins.map(pn=>`(pin ${pn.type} line (at ${pn.x} ${pn.y} ${pn.angle}) (length 2.54) (name ${q(pn.name)} (effects (font (size 1 1)))) (number ${q(pn.num)} (effects (font (size 1 1)))))`).join('');
   symbol=`(symbol "mod:${p.ref}" (pin_names (offset 1)) (in_bom yes) (on_board yes) (property "Reference" ${q(p.ref)} (at 0 ${h+2.54} 0) ${eff}) (property "Value" ${q(p.value)} (at 0 ${-h-2.54} 0) ${eff}) (symbol "${p.ref}_0_1" (rectangle (start -30.48 ${h}) (end 30.48 ${-h}) (stroke (width 0.254) (type default)) (fill (type background)))) (symbol "${p.ref}_1_1" ${pinrows}))`;
  }
  lib.push(symbol);
  const props=(k:string,v:string)=>`(property ${q(k)} ${q(v)} (at ${x} ${y} 0) (effects (font (size 1.27 1.27)) hide))`;
  const refx=kind?x+5.08:librarySymbol?x+20.32:x,refy=kind?y-1.27:librarySymbol?y-5.08:y-h-3.81,valuex=kind?x+5.08:librarySymbol?x+25.4:x,valuey=kind?y+1.27:librarySymbol?y+5.08:y+h+3.81;
  body.push(`(symbol (lib_id "mod:${p.ref}") (at ${x} ${y} 0) (unit 1) (in_bom yes) (on_board yes) (dnp ${p.dnp?'yes':'no'}) (uuid "${uid()}") (property "Reference" ${q(p.ref)} (at ${refx} ${refy} 0) ${eff}) (property "Value" ${q(passiveValue(p))} (at ${valuex} ${valuey} 0) ${eff}) ${props('Footprint','muon3:'+p.info.footprint.name)} ${props('MPN',p.info.mpn)} ${props('Manufacturer',p.info.manufacturer)} ${props('LCSC',p.lcsc)} ${props('Datasheet',p.info.datasheet??'')} ${pins.map(pn=>`(pin ${q(pn.num)} (uuid "${uid()}"))`).join('')} (instances (project ${q(name)} (path "/${rootId}" (reference ${q(p.ref)}) (unit 1)))))`);
  for(const pn of pins){const xx=x+pn.x,yy=y-pn.y,net=p.pads[pn.num];
   if(!net||net.startsWith('NC')){body.push(`(no_connect (at ${xx} ${yy}) (uuid "${uid()}"))`);continue;}
   if(kind){const ey=yy+(pn.y>0?-2.54:2.54);wire(xx,yy,xx,ey);if(/^(GND|5V|3V3|3V3A|1V2|1V2_PLL)$/.test(net))powerSymbol(net,xx,ey);else label(net,xx,ey);}
   else if(librarySymbol&&(pn.angle===90||pn.angle===270)){const ey=yy+(pn.angle===90?2.54:-2.54);wire(xx,yy,xx,ey);if(power(pn.name)||net==='GND')powerSymbol(net,xx,ey);else label(net,xx,ey);}
   else {const ex=xx+(pn.x<0?-5.08:5.08);wire(xx,yy,ex,yy);label(net,ex,yy,pn.x<0?-1:1);}
  }
 }
 const grouped=new Map<string,Part[]>();for(const p of c.parts){const a=grouped.get(p.group)??[];a.push(p);grouped.set(p.group,a);}
 const blocks=[...grouped].map(([group,parts])=>{
  const large=parts.filter(p=>!/^[RCL]\d/.test(p.ref)),small=parts.filter(p=>/^[RCL]\d/.test(p.ref));
  const lh=large.map(p=>/OPA356|LMV7219/.test(p.info.mpn)?40.64:Math.max(10.16,(Math.ceil(Object.keys(p.info.pins).length/2)+1)*2.54)+15.24);
  return {group,large,small,lh,height:20.32+lh.reduce((a,b)=>a+b,0)+Math.ceil(small.length/5)*22.86};
 }).sort((a,b)=>b.height-a.height);
 const colHeights=[22.86,22.86,22.86];
 for(const block of blocks){const ci=colHeights.indexOf(Math.min(...colHeights)),bx=10.16+ci*190.5,by=colHeights[ci];
  body.push(`(rectangle (start ${bx} ${by}) (end ${bx+185.42} ${by+block.height}) (stroke (width 0.254) (type default) (color 45 70 100 1)) (fill (type none)) (uuid "${uid()}"))`);
  body.push(`(text ${q(groupTitle[block.group]??block.group)} (at ${bx+5.08} ${by+5.08} 0) (effects (font (size 2 2) (bold yes)) (justify left)) (uuid "${uid()}"))`);
  let cy=by+15.24;
  block.large.forEach((p,i)=>{const h=(block.lh[i]-15.24)/2;emit(p,bx+92.71,cy+h+3.81);cy+=block.lh[i];});
  block.small.forEach((p,i)=>emit(p,bx+10.16+(i%5)*35.56,cy+12.7+Math.floor(i/5)*22.86));
  colHeights[ci]+=block.height+7.62;
 }
 // Explicit incoming power sources, plus filtered PLL rail fed through R.
 const flags=name==='controller'?['VBUS_USB','5V','GND','1V2_PLL']:['5V','GND'];
 flags.forEach((net,i)=>{const ref='#FLG'+i,fl='Flag'+i,x=20.32+i*38.1,y=15.24;
  lib.push(`(symbol "mod:${fl}" (power) (pin_names (offset 0) hide) (in_bom no) (on_board no) (property "Reference" "${ref}" (at 0 0 0) (effects (font (size 1.27 1.27)) hide)) (property "Value" "PWR_FLAG" (at 0 2.54 0) ${eff}) (symbol "${fl}_0_1" (polyline (pts (xy 0 0) (xy 0 1.27) (xy 1.27 1.27) (xy 0 2.54) (xy -1.27 1.27) (xy 0 1.27)) (stroke (width 0) (type default)) (fill (type none)))) (symbol "${fl}_1_1" (pin power_out line (at 0 0 90) (length 0) (name "pwr" ${eff}) (number "1" ${eff}))))`);
  body.push(`(symbol (lib_id "mod:${fl}") (at ${x} ${y} 0) (unit 1) (in_bom no) (on_board no) (dnp no) (uuid "${uid()}") (property "Reference" "${ref}" (at ${x} ${y} 0) (effects (font (size 1.27 1.27)) hide)) (property "Value" ${q('SOURCE '+net)} (at ${x} ${y-3.81} 0) ${eff}) (pin "1" (uuid "${uid()}")) (instances (project ${q(name)} (path "/${rootId}" (reference "${ref}") (unit 1)))))`);label(net,x,y);
 });
 const pageHeight=Math.max(420,Math.ceil((Math.max(...colHeights)+15)/10)*10);
 const root=`(kicad_sch (version 20250114) (generator "muon3-modular") (uuid "${rootId}") (paper "User" 594 ${pageHeight}) (title_block (title ${q('Muon3 Rev E '+name)}) (rev "E") (comment 1 "Prototype: typed IC pins; cross-check datasheets and PCB parity before release."))`;
 writeFileSync(path.replace(/[^/]+$/,'mod.kicad_sym'),'(kicad_symbol_lib (version 20241209) (generator "muon3") '+lib.join('\n').replaceAll('"mod:','"')+')');
 writeFileSync(path.replace(/[^/]+$/,'sym-lib-table'),'(sym_lib_table (lib (name "mod") (type "KiCad") (uri "${KIPRJMOD}/mod.kicad_sym") (options "") (descr "Self-contained typed review symbols")))');
 writeFileSync(path,root+'\n(lib_symbols\n'+lib.join('\n')+')\n'+body.join('\n')+'\n)\n');
}
