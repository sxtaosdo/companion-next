import {CompanionApiClient} from 'file:///D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion-api-client.js';
import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:32180',kbId='da1051a5-3fff-4198-ba55-017ea79df9c3',out='C:/Users/33272/AppData/Local/Temp/companion-safe-parity-20261019';
const proof={at:new Date().toISOString(),kbId,requests:[],wrapperExecuted:false,credentialFileReadByAgent:false,credentialConfigChanged:false,searchPerformed:false,bodyChunkOriginalRead:false,syncOrInference:false,ok:false};
let browser,client;
const knownCode=raw=>['AUTH_MISSING','AUTH_DENIED','UPSTREAM_UNAVAILABLE','TIMEOUT','SCHEMA_INVALID','CLI_INCOMPATIBLE','CLI_UNAVAILABLE','BUSY','OUTPUT_LIMIT'].includes(raw?.code)?raw.code:'UNCLASSIFIED';
try{
 client=await CompanionApiClient.discover();if(client.baseUrl!==base)throw Error('COMPANION_ORIGIN_MISMATCH');
 const identity=async()=>(await client.request('GET','/v1/daemon/inflight')).identity;
 proof.beforeIdentity=await identity();
 const {chromium}=createRequire('D:/code/shidai3/P8000/cocos-mcp/mcp/package.json')('playwright');browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']});
 const ctx=await browser.newContext({extraHTTPHeaders:{Origin:base}});
 const session=await client.request('POST','/v1/ui/session',{});if((await ctx.request.get(session.url,{maxRedirects:0})).status()!==302)throw Error('LOCAL_UI_AUTH_FAILED');
 async function read(path,body){
  if(!['/api/knowledge/status','/api/knowledge/kb/view','/api/knowledge/doc/list'].includes(path))throw Error('REQUEST_OUT_OF_SCOPE');
  const r=body===undefined?await ctx.request.get(base+path,{timeout:45000}):await ctx.request.post(base+path,{data:body,timeout:45000});
  const bytes=await r.body();if(bytes.length>1024*1024)throw Error('METADATA_RESPONSE_LIMIT');
  let data;try{data=JSON.parse(bytes.toString('utf8'))}catch{throw Error('METADATA_NOT_JSON')}
  const entry={path,status:r.status(),...(body?{input:body}:{})};proof.requests.push(entry);
  if(r.status()!==200){entry.code=knownCode(data);throw Error('METADATA_HTTP_FAILED')}
  if(data.schemaVersion!=='companion-knowledge-v1')throw Error('METADATA_SCHEMA_FAILED');return data;
 }
 const before=await read('/api/knowledge/status');
 const statusProjection=s=>({auth:s.retrieval?.auth,keyword:s.retrieval?.keyword,kbId:s.retrieval?.kbId,cliAvailable:s.cli?.available,cliCompatible:s.cli?.compatible,writerEnabled:s.sync?.writerEnabled,schedulerEnabled:s.sync?.schedulerEnabled});
 proof.statusBefore=statusProjection(before);
 if(before.retrieval?.kbId!==kbId||!['configured','verified','denied'].includes(before.retrieval?.auth))throw Error('READER_NOT_CONFIGURED_FOR_APPROVED_KB');
 const view=await read('/api/knowledge/kb/view',{kbId});if(view.item?.id!==kbId)throw Error('KB_ID_MISMATCH');
 proof.knowledgeBase={id:view.item.id,metadataReceived:true};
 const docs=await read('/api/knowledge/doc/list',{kbId,limit:3});
 if(!Array.isArray(docs.items)||docs.items.length>3||typeof docs.truncated!=='boolean')throw Error('DOCUMENT_LIST_BOUND_FAILED');
 if(docs.items.some(d=>typeof d.id!=='string'||Object.hasOwn(d,'content')))throw Error('DOCUMENT_METADATA_SHAPE_FAILED');
 proof.documents={count:docs.items.length,truncated:docs.truncated,items:docs.items.map(d=>({id:d.id,...(typeof d.parse_status==='string'?{parseStatus:d.parse_status}:{}),...(typeof d.file_type==='string'?{fileType:d.file_type}:{})})),titlesOrBodiesArchived:false};
 proof.statusAfter=statusProjection(await read('/api/knowledge/status'));
 proof.afterIdentity=await identity();proof.daemonUnchanged=JSON.stringify(proof.beforeIdentity)===JSON.stringify(proof.afterIdentity);
 if(!proof.daemonUnchanged||proof.statusAfter.writerEnabled!==false||proof.statusAfter.schedulerEnabled!==false)throw Error('FINAL_STATE_NOT_EXPECTED');
 proof.ok=true;
}catch(e){proof.error=e.message==='METADATA_HTTP_FAILED'?e.message:['READER_NOT_CONFIGURED_FOR_APPROVED_KB','COMPANION_ORIGIN_MISMATCH','LOCAL_UI_AUTH_FAILED','KB_ID_MISMATCH','DOCUMENT_LIST_BOUND_FAILED','DOCUMENT_METADATA_SHAPE_FAILED','FINAL_STATE_NOT_EXPECTED'].includes(e.message)?e.message:'VERIFICATION_NOT_COMPLETED';}
finally{if(client&&proof.beforeIdentity){proof.afterIdentity=(await client.request('GET','/v1/daemon/inflight')).identity;proof.daemonUnchanged=JSON.stringify(proof.beforeIdentity)===JSON.stringify(proof.afterIdentity);}await browser?.close();await writeFile(out+'/reader-metadata-result.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));if(!proof.ok)process.exitCode=1;}
