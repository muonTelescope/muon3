// Millimetres. Generated fit gauge for the modular tower's nominal 12 mm tenon.
// Left: male; then sockets with 0.15, 0.25, 0.35 mm PER-SIDE clearance.
// This measures printer fit only. It is not a snap-strength qualification.
const part=(await api.v1.part.create({name:'Muon3 socket fit gauge'})).result;
const ei=(await api.v1.part.entityInjection({id:part,name:'Socket gauge geometry'})).result;
async function box(x,y,z,w,d,h) {
 if(Math.min(w,d,h)<=0) throw Error('Nonpositive geometry');
 return (await api.v1.solid.box({id:ei,length:w,width:d,height:h,translation:[x+w/2,y+d/2,z+h/2]})).result;
}
async function volume(id){return (await api.v1.part.calculateMassProperties({id})).result.volume;}
function close(a,b){if(Math.abs(a-b)>Math.max(0.001,b*0.0005))throw Error(`Volume mismatch ${a} versus ${b}`);}
const male=await box(0,0,0,18,18,3);
const tenon=await box(3,3,3,12,12,8);
await api.v1.solid.union({id:ei,target:male,tools:[tenon]});
const expectedMale=18*18*3+12*12*8;
close(await volume(male),expectedMale);
const checks=[{name:'male',volume:await volume(male),expected:expectedMale}];
for(const [index,clearance] of [0.15,0.25,0.35].entries()) {
 const x=28*(index+1),w=12+2*clearance;
 const socket=await box(x,0,0,18,18,11);
 const before=await volume(socket);
 const cutter=await box(x+(18-w)/2,(18-w)/2,2.5,w,w,9);
 await api.v1.solid.subtraction({id:ei,target:socket,tools:[cutter]});
 const actual=await volume(socket),expected=18*18*11-w*w*8.5;
 close(actual,expected); close(before-actual,w*w*8.5);
 checks.push({name:'socket',clearancePerSide:clearance,volume:actual,expected});
}
const cap=await api.inspect.capture();
const bounds=api.inspect.graphicBounds(cap,api.inspect.currentSolids(cap));
if(!bounds||Math.abs(bounds.max[0]-bounds.min[0]-102)>0.1)throw Error('Incorrect coupon extent');
return {units:'mm',checks,bounds,printing:'Flat base on bed; left-to-right male, 0.15/0.25/0.35 mm per-side sockets',validated:'Geometric fit gauge only; ABS print and snap testing required'};
