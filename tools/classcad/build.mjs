/** Reproducible ClassCAD MCP build and independent STEP import verification.
 * npm ci --prefix tools/classcad && node tools/classcad/build.mjs [assembly.step]
 * Requires an existing ClassCAD login; never reads or copies credentials.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const out=path.join(root,'hw/out/classcad');
fs.mkdirSync(out,{recursive:true});
const require=createRequire(import.meta.url);
const client=new Client({name:'muon3-cad-build',version:'1.0.0'});
await client.connect(new StdioClientTransport({command:process.execPath,args:[require.resolve('@classcad/mcp')],env:{...process.env,CLASSCAD_ENGINE:'wasm'},stderr:'inherit'}));
function textResult(r) {
 if(r.isError) throw Error(r.content.filter(b=>b.type==='text').map(b=>b.text).join('\n'));
 const t=r.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
 try {return JSON.parse(t);}catch{return t;}
}
async function call(name,args={}) {return textResult(await client.callTool({name,arguments:args},undefined,{timeout:300000}));}
async function save(format,name) {
 const r=await call('save',{format});
 const content=r.content??r.result?.content;
 if(!content) throw Error(`Empty ${format} export: ${JSON.stringify(r)}`);
 fs.writeFileSync(path.join(out,name),Buffer.from(content,'base64'));
}
async function snapshot(args) {
 const result=await call('snapshot',{outDir:out,...args});
 const candidates=fs.readdirSync(out).filter(n=>n.startsWith(args.label+'-')&&n.endsWith('.png')).sort();
 if(!candidates.length)throw Error('ClassCAD snapshot did not create an image');
 fs.copyFileSync(path.join(out,candidates.at(-1)),path.join(out,args.label+'.png'));
 return result;
}
try {
 const input=process.argv[2];
 if(input) {
  const loaded=await call('load',{format:'STP',content:fs.readFileSync(path.resolve(input)).toString('base64')});
  fs.writeFileSync(path.join(out,'import-result.json'),JSON.stringify(loaded,null,2));
  const report=await call('run_script',{label:'Verify assembly import',timeoutMs:180000,script:`const tree=await api.tree({refresh:true}); const nodes=Object.values(tree); const products=nodes.filter(n=>n.class==='CC_Assembly'||n.class==='CC_Part'); if(!products.length)throw Error('No imported products'); const measures=[]; for(const n of products.slice(0,8)){const m=(await api.v1.part.calculateMassProperties({id:n.id})).result;if(!(m.volume>0))throw Error('Invalid imported volume');measures.push({id:n.id,name:n.name,volume:m.volume,cog:m.cog});} return {nodeCount:nodes.length,productCount:products.length,measures};`});
  fs.writeFileSync(path.join(out,'assembly-report.json'),JSON.stringify(report,null,2));
  await snapshot({label:'assembly',width:1600,height:1200,annotate:true,colors:'native',recalc:false});
  await snapshot({label:'assembly_sections',width:1600,height:1200,sheet:true,xray:true,recalc:false});
  console.log('ClassCAD imported and rendered '+input);
 } else {
  const script=fs.readFileSync(path.join(here,'socket-coupon.js'),'utf8');
  const report=await call('run_script',{label:'Build and verify modular socket fit gauges',script,timeoutMs:180000});
  fs.writeFileSync(path.join(out,'socket-coupon-report.json'),JSON.stringify(report,null,2));
  await save('STP','socket-coupon.step');
  await save('STL','socket-coupon.stl');
  await snapshot({label:'socket_coupon',width:1400,height:850,sheet:true,annotate:true,colors:'distinct',recalc:false});
  console.log(JSON.stringify(report,null,2));
 }
 const status=await call('session_info');
 // Deliberately omit account identity from repository output.
 fs.writeFileSync(path.join(out,'engine.json'),JSON.stringify({transport:status.transport,version:status.version,wasm:status.wasm?.version},null,2));
} finally {await client.close();}
