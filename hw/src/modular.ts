// Rev E modular station. Legacy Rev D is retained as a comparison, never overwritten.
import { Circuit, type Part } from './circuit.ts';
import { build as legacy, P } from './design.ts';
import { fetchPart } from '../tools/fetch_parts.ts';
export const DIMENSIONS = { detector: {w:60,h:45}, controller:{w:100,h:80}, thickness:1.6 };
export const HARNESS = ['5V','GND','HIT','GND','SDA','SCL','HV_EN','HV_MON','INJ','GND'];
export const FPGA_PINS = { CLK100:35,HIT0:2,HIT1:3,HIT2:4,HIT3:6,SPI_CS:23,SPI_SCK:25,SPI_MOSI:26,SPI_MISO:27,IRQ:28,ACQ_RESET:31,CFG_MISO:14,CFG_SCK:15,CFG_CS:16,CFG_MOSI:17,CRESET:8,CDONE:7 };
export const MCU_PINS:Record<string,string> = {IO19:'USB_DN',IO20:'USB_DP',IO6:'CC1',IO7:'CC2',IO1:'HV_MON0',IO2:'HV_MON1',IO4:'HV_MON2',IO5:'HV_MON3',IO8:'SDA',IO18:'SCL',IO12:'HV_EN',IO13:'INJ',IO9:'CFG_MISO',IO10:'CFG_CS',IO11:'CFG_MOSI',IO14:'CFG_SCK',IO15:'CRESET',IO16:'CDONE',IO17:'SPI_CS',IO21:'SPI_SCK',IO38:'SPI_MOSI',IO39:'SPI_MISO',IO40:'IRQ',IO41:'ACQ_RESET',IO42:'MUX_RESET',IO47:'LED_STATUS'};
function cloneParts(parts:Part[]):Circuit { const c=new Circuit(); c.parts=structuredClone(parts); c.reserve(...c.parts.map(p=>p.ref)); return c; }
function rename(c:Circuit,map:Record<string,string>) {for(const p of c.parts)for(const k in p.pads)p.pads[k]=map[p.pads[k]]??p.pads[k];}
async function header(c:Circuit,ref:string,nets:string[],group:string) {
 c.group=group;
 return c.add('J','C5665',Object.fromEntries(nets.map((net,i)=>[String(i+1),net])),{ref,value:'IDC 2x5 keyed / C5665'});
}
export async function detector():Promise<Circuit> {
 const old=await legacy();
 const c=cloneParts(old.parts.filter(p=>['hv','inj','ch0','bme'].includes(p.group)));
 // Local supply, threshold, baseline and trim: one DAC per identical detector.
 rename(c,{'3V3':'3V3A','SDA0':'SDA','SCL0':'SCL','HIT0':'HIT'});
 c.group='rails'; await c.add('U',P.ldo33,{IN:'5V',EN:'5V',GND:'GND',OUT:'3V3A',NC:'NC_LDO'});await c.c('1u','5V','GND');await c.c('10u','3V3A','GND','0603');
 c.group='dac';await c.add('U',P.mcp4728,{VDD:'3V3A',VSS:'GND',SCL:'SCL',SDA:'SDA','LDAC#':'GND','RDY/BSY#':'NC_DAC_RDY',VOUTA:'VTH0',VOUTB:'VREF',VOUTC:'HV_TRIM',VOUTD:'NC_DAC_D'});await c.decouple('3V3A',['100n','1u']);await c.r('4.7k','3V3A','SDA');await c.r('4.7k','3V3A','SCL');
 // Legacy 100 V BSS123 driven by a Darlington was marginal. 240 V rated
 // BSS131 + 5 V rail-to-rail TC4427 driver; retain ~136 mA peak current (2.2 R) with 0.4 A pulsed-rated switch.
 c.group='hv';const mos=c.parts.find(p=>p.lcsc===P.bss123)!;mos.info=await fetchPart('C151498',{assets:false,datasheet:false});mos.lcsc='C151498';mos.value=mos.info.mpn;mos.pads={'1':'HV_GATE_DRIVE','2':'GND','3':'HV_SW'};
 const limit=c.parts.find(p=>p.value==='2.2')!; c.parts=c.parts.filter(p=>p!==limit);await c.r('2.2','5V','HV_IPK','0805');
 await c.add('U','C20551',{'IN A':'HV_GATE','OUT A':'HV_GATE_DRIVE','IN B':'GND','OUT B':'NC_GATE_B',VDD:'5V',GND:'GND','1':'NC_DRIVER1','8':'NC_DRIVER8'});await c.c('100n','5V','GND');await c.c('1u','5V','GND');await c.r('100k','HV_GATE_DRIVE','GND');
 // Bleed output after disable; HV remains internal, never put on the harness.
 await c.r('1M','HV','GND','0805');
 await header(c,'J100',HARNESS,'harness');
 return c;
}
export async function controller():Promise<Circuit>{
 const old=await legacy();const c=cloneParts(old.parts.filter(p=>p.group==='usb'||p.group==='mcu'||(p.group==='rails' && (p.lcsc===P.ams1117 || ['5V','3V3'].includes(p.pads['1'])&&['10u','22u'].includes(p.value)))));
 // USB input protection and a ceramic-stable TI LDO replace the legacy rail.
 for(const p of c.parts.filter(p=>p.group==='usb'))for(const pin in p.pads)if(p.pads[pin]==='5V')p.pads[pin]='VBUS_USB';
 c.group='usb';await c.add('F','C269119',{'1':'VBUS_USB','2':'5V'},{value:'1.1A resettable fuse'});
 const rail=c.parts.find(p=>p.lcsc===P.ams1117)!;rail.info=await fetchPart('C15578',{assets:false,datasheet:false});rail.lcsc='C15578';rail.value=rail.info.mpn;rail.pads={'1':'GND','2':'3V3','3':'5V','4':'3V3'};
 // Remove legacy I2C pullups then connect a single TCA9546 mux upstream bus.
 c.parts=c.parts.filter(p=>!(p.ref.startsWith('R') && Object.values(p.pads).some(n=>/^S[CD][AL][01]$/.test(n))));
 const mcu=c.parts.find(p=>p.lcsc===P.esp32)!;mcu.pads={};const pins={GND:'GND',EP:'GND','3V3':'3V3',EN:'ESP_EN',IO0:'BOOT',...MCU_PINS};for(const [name,net] of Object.entries(pins))for(const [num,pin]of Object.entries(mcu.info.pins))if(pin===name)mcu.pads[num]=net;
 c.group='fpga';await c.add('U','C2678152',{'VCC':'1V2','VCCPLL':'1V2_PLL','VCCIO_0':'3V3','VCCIO_2':'3V3','SPI_Vccio1':'3V3','VPP_2V5':'3V3',EP:'GND',...Object.fromEntries(Object.entries(FPGA_PINS).map(([n,p])=>[String(p),n]))});
 await c.r('10','1V2','1V2_PLL');await c.decouple('1V2',['100n','100n']);await c.c('10u','1V2','GND','0603');await c.decouple('1V2_PLL',['100n','1u']);await c.decouple('3V3',['100n','100n','100n','100n']);
 // ESP32 loads FPGA SRAM on each boot. No shared runtime/configuration pins.
 await c.r('10k','3V3','CRESET');await c.r('10k','3V3','CDONE');await c.r('10k','3V3','CFG_CS');await c.r('10k','3V3','SPI_CS');await c.r('10k','3V3','ACQ_RESET');
 c.group='clock';await c.add('Y','C5179979',{'TRI-STATE':'3V3',VDD:'3V3',GND:'GND',OUT:'CLK_SOURCE'});await c.r('33','CLK_SOURCE','CLK100');await c.c('100n','3V3','GND');
 c.group='core_rail';await c.add('U','C2877864',{IN:'5V',EN:'5V',GND:'GND',OUT:'1V2',NC:'NC_CORE'});await c.c('1u','5V','GND');await c.c('1u','1V2','GND');
 c.group='mux';await c.add('U','C201653',{VCC:'3V3',GND:'GND',A0:'GND',A1:'GND',A2:'GND','RESET#':'MUX_RESET',SDA:'SDA',SCL:'SCL',...Object.fromEntries([0,1,2,3].flatMap(i=>[[`SD${i}`,`SDA${i}`],[`SC${i}`,`SCL${i}`]]))});await c.r('10k','3V3','MUX_RESET');await c.r('4.7k','3V3','SDA');await c.r('4.7k','3V3','SCL');await c.c('100n','3V3','GND');
 c.group='harness';for(let i=0;i<4;i++) {await header(c,`J${100+i}`,HARNESS.map(n=>['HIT','HV_MON','SDA','SCL'].includes(n)?n+i:n),'harness');await c.r('100k',`HIT${i}`,'GND');}
 // Future spatial detector expansion: four 3.3 V inputs, clock out and grounds.
 await header(c,'J104',['3V3','GND','EXP0','GND','EXP1','GND','EXP2','GND','EXP3','GND'],'expansion');const fpga=c.parts.find(p=>p.lcsc==='C2678152')!;Object.assign(fpga.pads,{'32':'EXP0','34':'EXP1','36':'EXP2','37':'EXP3'});
 await c.r('100k','HV_EN','GND');await c.r('100k','INJ','GND');
 return c;
}
