import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const W='C:/Users/33272/AppData/Local/Temp/companion-client-calls-closeout-20261020',host='D:/code/shidai3/P8000/cocos-mcp/mcp';
const req=createRequire(host+'/package.json');
const {Client}=await import(pathToFileURL(req.resolve('@modelcontextprotocol/sdk/client/index.js')).href);
const {StdioClientTransport}=await import(pathToFileURL(req.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href);
const locPath=process.env.APPDATA+'/Creator AI Companion/daemon.json',before=JSON.parse(await readFile(locPath,'utf8'));
if(before.identity.pid!==6564)throw Error('OWNER_CHANGED');
const project='04c4cde24ee76d83',proof={atUtc:new Date().toISOString(),scope:'Independent MCP SDK readonly protocol verification; does not claim actual Codex/Cursor connection',projectId:project,configurationWrites:0,credentialChanges:0,modelOrCreatorActions:0,listenSocketsCreated:0,historyInjection:0,toolCalls:[],ok:false};
const client=new Client({name:'companion-readonly-acceptance',version:'1.0.0'});
const transport=new StdioClientTransport({command:'C:/Program Files/nodejs/node.exe',args:[host+'/dist/companion/creator-ai.js','mcp','--project',project],stderr:'pipe'});
let stderrBytes=0;transport.stderr?.on('data',x=>{stderrBytes+=x.length});
try{
 await client.connect(transport,{timeout:10000});
 proof.serverVersion=client.getServerVersion();proof.handshake=true;
 const listing=await client.listTools({}, {timeout:10000});proof.toolCount=listing.tools.length;
 for(const [name,args] of [['project_get_status',{}],['debug_get_logs',{source:'launcher',limit:3}]]){
  if(!listing.tools.some(t=>t.name===name))throw Error('READONLY_TOOL_NOT_AVAILABLE');
  const result=await client.callTool({name,arguments:args},undefined,{timeout:15000});
  const structured=result.structuredContent;
  proof.toolCalls.push({name,isError:result.isError===true,status:structured?.status,projectIdMatches:structured?.projectId===project,dataSha256:createHash('sha256').update(JSON.stringify(structured?.data??null)).digest('hex')});
  if(result.isError||structured?.status!=='PASSED')throw Error('READONLY_TOOL_DID_NOT_PASS');
 }
 proof.ok=true;
}catch(e){proof.failure={code:typeof e.code==='number'?e.code:null,kind:/^[A-Z_]+$/.test(e.message??'')?e.message:'PROTOCOL_OR_TRANSPORT_FAILED'};process.exitCode=1;}
finally{
 await client.close();proof.stderrBytes=stderrBytes;proof.rawOutputArchived=false;
 const after=JSON.parse(await readFile(locPath,'utf8'));if(JSON.stringify(after.identity)!==JSON.stringify(before.identity))throw Error('OWNER_CHANGED');
 const response=await fetch(before.baseUrl+'/v1/daemon/inflight',{headers:{authorization:'Bearer '+before.apiToken},signal:AbortSignal.timeout(10000)});const state=await response.json();
 proof.finalIdentity=state.identity;proof.phase=state.phase;proof.unknown=state.counts.nativeEpochUnproven;proof.activeCountersZero=Object.entries(state.counts).filter(([k])=>k!=='nativeEpochUnproven').every(([,v])=>v===0);
 if(state.phase!=='OPEN'||proof.unknown!==2||!proof.activeCountersZero)process.exitCode=1;
 await writeFile(W+'/protocol-result.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(proof));
}
