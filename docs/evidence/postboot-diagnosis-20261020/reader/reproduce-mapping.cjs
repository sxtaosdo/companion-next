// Executes only map-extracted core with fake process/FS/network/decryption seams.
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const assert = require('node:assert/strict');
const ts = require('D:/code/shidai3/P8000/cocos-mcp/mcp/node_modules/typescript');
const root = 'D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/';
const map = JSON.parse(fs.readFileSync(root+'knowledge-worker.js.map','utf8'));
const index = map.sources.findIndex(path => path.endsWith('/knowledge-worker-core.ts'));
assert(index >= 0);
const source = map.sourcesContent[index];
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const KB = 'da1051a5-3fff-4198-ba55-017ea79df9c3';
const metadata = { success:true, data:{key_id:3,tenant_id:1,scope_type:'tenant',full_access:false,
 knowledge_base_ids:[KB],capabilities:['retrieve'],expires_at:'2026-11-08T01:25:46.685460+00:00'} };
const sha = input => crypto.createHash('sha256').update(input).digest('hex');
async function scenario(kind) {
 const stdin = new EventEmitter(), lines = new EventEmitter(), exports = {};
 const counts = {fakeLoad:0,backend:0,forbiddenFs:0,forbiddenProcess:0,fakeFetch:0};
 let output = '';
 stdin.destroy = () => stdin.emit('close');
 lines.close = () => lines.emit('close');
 class KnowledgeFault extends Error { constructor(code,status=502){super(code);this.code=code;this.httpStatus=status;} }
 const forbiddenFs = async () => { counts.forbiddenFs++; throw Error('REAL_FS_FORBIDDEN'); };
 const adapter = {KnowledgeFault,KnowledgeAdapter:class{},jsonProcessInFlightCount:()=>0,
  runJsonProcess:async()=>{counts.forbiddenProcess++;throw Error('REAL_PROCESS_FORBIDDEN');}};
 const isolate = {READER_KB:KB,READER_METHODS:['search','listKnowledgeBases','viewKnowledgeBase','listDocuments','viewDocument','listChunks','downloadDocument'],knowledgeWorkerEnv:()=>({})};
 const fakeFetch = async (url,options) => {
  counts.fakeFetch++;
  assert.equal(url,'http://127.0.0.1:8081/api/v1/auth/reader-identity');
  assert.equal(options.headers['X-API-Key'],'SYNTHETIC_FAKE_KEY');
  if(kind==='connection-refused')throw new TypeError('synthetic fetch failed',{cause:Object.assign(new Error('synthetic refused'),{code:'ECONNREFUSED'})});
  if(kind==='http-401')return {ok:false,status:401,body:{}};
  return {ok:true,status:200,body:{async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(metadata));}}};
 };
 const sandbox = {exports,Buffer,AbortController,AbortSignal,Date,fetch:fakeFetch,
  process:{stdin,stdout:{write:text=>{output+=text;}},env:{},platform:'win32'},
  require:name=>{
   if(name==='node:readline')return {createInterface:()=>lines};
   if(name==='node:fs/promises')return {open:forbiddenFs,lstat:forbiddenFs};
   if(name==='node:path')return require('node:path');
   if(name==='./knowledge-adapter.js')return adapter;
   if(name==='./knowledge-isolation.js')return isolate;
   throw Error('IMPORT_NOT_ALLOWED');
  }};
 vm.runInNewContext(compiled,sandbox,{filename:'actual-map-worker-core.cjs'});
 assert.equal(exports.validReaderIdentity(metadata),true);
 const pending = exports.serveReaderWorker({
  load:async path=>{assert.equal(path,'SYNTHETIC_NEVER_OPENED');counts.fakeLoad++;return 'SYNTHETIC_FAKE_KEY';},
  verify:exports.verifyReader,
  backend:()=>{counts.backend++;return {viewKnowledgeBase:async()=>({id:KB})};},
 });
 const request=JSON.stringify({method:'viewKnowledgeBase',input:{kbId:KB},credentialFile:'SYNTHETIC_NEVER_OPENED'});
 stdin.emit('data',Buffer.from(request+'\n'));lines.emit('line',request);
 await pending;
 const reply=JSON.parse(output);
 if(kind==='valid-public-metadata'){assert.equal(reply.ok,true);assert.equal(counts.backend,1);}
 else {assert.equal(reply.ok,false);assert.equal(reply.code,'AUTH_DENIED');assert.equal(reply.status,403);assert.equal(counts.backend,0);}
 assert.equal(counts.forbiddenFs,0);assert.equal(counts.forbiddenProcess,0);
 return {scenario:kind,reply,counts};
}
(async()=>{
 const results=[];
 for(const kind of ['valid-public-metadata','connection-refused','http-401'])results.push(await scenario(kind));
 const result={workerSha256:sha(fs.readFileSync(root+'knowledge-worker.js')),mapSha256:sha(fs.readFileSync(root+'knowledge-worker.js.map')),
  embeddedCoreSource:map.sources[index],embeddedCoreSha256:sha(source),
  actualCoreExecuted:true,actualProcess:false,actualFs:false,actualHttp:false,actualCredentialRead:false,
  KnowledgeFaultShapeStub:true,results};
 fs.writeFileSync(__dirname+'/mapping-proof.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
})().catch(error=>{console.error(error.name+': '+error.message);process.exitCode=1;});
