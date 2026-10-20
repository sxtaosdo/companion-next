import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const W='C:/Users/33272/AppData/Local/Temp/companion-knowledge-resume-20261020';
const start=JSON.parse(await readFile(W+'/start-result.json','utf8'));
if(start.state!=='HEALTHY')throw Error('SERVICE_NOT_VERIFIED_HEALTHY');
const base='http://127.0.0.1:32180',kb='da1051a5-3fff-4198-ba55-017ea79df9c3',doc='97c5935f-6114-43e9-8ead-d0319f61ab9a';
const previous=JSON.parse(await readFile('D:/code/shidai3/P8000/companion-next/docs/evidence/knowledge-auth-recovery-20261019/recovery-4264-proof.json','utf8'));
const loc=JSON.parse(await readFile(process.env.APPDATA+'/Creator AI Companion/daemon.json','utf8'));
if(loc.identity.pid!==7156||loc.identity.entrySha256!=='70df42a8f84e6bf9d32c050919fcb91565ff4b53ff9f85a3b1e50664d267ca65')throw Error('EXISTING_COMPANION_CHANGED');
const sha=value=>createHash('sha256').update(value).digest('hex');
const proof={atUtc:new Date().toISOString(),daemonIdentity:loc.identity,servicePid:start.pid,scope:{kbId:kb,documentId:doc,documentsRequested:1,globalCorpusTraversed:false},steps:[],ok:false,rawContentArchived:false,readerCredentialInspected:false,readerCredentialReplaced:false,permissionsChanged:false,loginSessionPosts:0,writeOrIndexRequests:0,searchRequests:0,askOrChatRequests:0,modelOrCreatorActions:0,browserLaunched:false};
let phase='local-session';
const check=(condition,code)=>{if(!condition)throw Error(code)};
const {request}=createRequire('D:/code/shidai3/P8000/cocos-mcp/mcp/package.json')('playwright');
const ctx=await request.newContext({timeout:45000});
try{
 const auth=await fetch(base+'/v1/ui/session',{method:'POST',headers:{authorization:'Bearer '+loc.apiToken,'content-type':'application/json'},body:'{}'});
 check(auth.ok,'LOCAL_SESSION_FAILED');const ticket=await auth.json();check(ticket.url.startsWith(base+'/auth?code='),'LOCAL_SESSION_ORIGIN');
 check((await ctx.get(ticket.url,{maxRedirects:0})).status()===302,'LOCAL_SESSION_COOKIE');proof.loginSessionPosts=1;
 async function read(path,data){
  phase=path;const response=data===undefined?await ctx.get(base+path):await ctx.post(base+path,{headers:{Origin:base},data});
  const body=await response.json();const code=typeof body.code==='string'&&/^[A-Z_]{1,50}$/.test(body.code)?body.code:null;
  proof.steps.push({path,status:response.status(),backendCode:code});
  check(response.ok(),'READ_HTTP_FAILED');return body;
 }
 const before=await read('/api/knowledge/status');proof.statusBefore={auth:before.retrieval?.auth,keyword:before.retrieval?.keyword,kbIdMatches:before.retrieval?.kbId===kb};
 const meta=await read('/api/knowledge/kb/view',{kbId:kb});check(meta.item?.id===kb,'KB_ID_MISMATCH');proof.kb={idMatch:true};
 const docs=await read('/api/knowledge/doc/list',{kbId:kb,limit:1});check(Array.isArray(docs.items)&&docs.items.length<=1,'DOCUMENT_LIST_BOUND');proof.documentList={count:docs.items.length,truncated:docs.truncated};
 const view=await read('/api/knowledge/doc/view',{id:doc});check(view.item?.id===doc,'DOCUMENT_ID_MISMATCH');proof.document={idMatch:true,reportedBytes:view.item.file_size};
 const chunks=await read('/api/knowledge/chunk/list',{id:doc,limit:1});check(Array.isArray(chunks.items)&&chunks.items.length===1,'CHUNK_BOUND');proof.chunks={count:chunks.items.length,truncated:chunks.truncated,items:chunks.items.map(x=>({id:x.id,index:x.chunk_index,contentSha256:sha(x.content??'')}))};
 const original=await read('/api/knowledge/doc/download',{id:doc});check(original.docId===doc&&original.truncated===false&&typeof original.content==='string','ORIGINAL_SHAPE');
 const bytes=Buffer.from(original.content,original.isBase64?'base64':'utf8');const contentSha256=sha(bytes);
 check(bytes.length===original.bytes&&original.bytes===2235&&contentSha256===previous.original.contentSha256,'ORIGINAL_CHANGED');
 proof.original={verified:true,bytes:bytes.length,truncated:false,isBase64:original.isBase64,contentSha256,matchesYesterdayOriginal:true};
 proof.searchRequests++;const search=await read('/api/knowledge/search',{query:'shidai3',kbId:kb,limit:1});
 check(Array.isArray(search.results)&&search.results.length===1&&search.count===1,'SEARCH_BOUND');
 proof.search={query:'shidai3',limit:1,count:search.count,items:search.results.map(x=>({id:x.id,knowledgeId:x.knowledgeId,contentSha256:sha(x.content??''),titleSha256:sha(x.title??'')})),keywordOnlySourceVerified:true};
 const after=await read('/api/knowledge/status');check(after.retrieval?.auth==='verified'&&after.retrieval?.keyword==='verified'&&after.retrieval?.kbId===kb,'FINAL_RETRIEVAL_NOT_VERIFIED');
 check(after.sync?.writerEnabled===false&&after.sync?.schedulerEnabled===false,'WRITER_SCOPE_CHANGED');
 proof.statusAfter={auth:after.retrieval.auth,keyword:after.retrieval.keyword,kbIdMatches:true,writerEnabled:after.sync.writerEnabled,schedulerEnabled:after.sync.schedulerEnabled};
 proof.ok=true;
}catch(error){proof.failure={phase,code:/^[A-Z_]+$/.test(error?.message??'')?error.message:'REQUEST_OR_ASSERTION_FAILED'};process.exitCode=1;}
finally{await ctx.dispose();await writeFile(W+'/reader-result.json',JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(proof));}
