import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const require=createRequire(import.meta.url);
export async function session(){
 const client=new Client({name:'muon3-wright',version:'1.0.0'});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[require.resolve('@classcad/mcp')],env:{...process.env,CLASSCAD_ENGINE:'wasm'},stderr:'inherit'}));
 const call=async(name,args={})=>{const r=await client.callTool({name,arguments:args},undefined,{timeout:600000});
  const t=r.content.filter(b=>b.type==='text').map(b=>b.text).join('\n'); if(r.isError)throw Error(t); try{return JSON.parse(t)}catch{return t}};
 return {client,call};
}
if (process.argv[1]===fileURLToPath(import.meta.url)) {
 const {client,call}=await session();
 const script=`const p=(await api.v1.part.create({name:'t'})).result; const e=(await api.v1.part.entityInjection({id:p})).result;
 const out=[]; for(const t of [[1,0,0],[0,1,0],[0,0,1]]){ const b=(await api.v1.solid.box({id:e,length:1,width:1,height:1,translation:t,rotation:[0.3,0.5,0.7],rotateFirst:false})).result;
 out.push((await api.v1.part.calculateMassProperties({id:b})).result.cog);} return out;`;
 console.log(JSON.stringify(await call('run_script',{label:'rot test',script,timeoutMs:120000})));
 await client.close();
}
