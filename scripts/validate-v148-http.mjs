/** Approved one-shot validation against original v148 HTTP class, independent test data only. */
import assert from 'node:assert/strict'
import { request as nodeRequest } from 'node:http'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
const root=resolve('.test-artifacts/v148-host-runtime')
const {createV148IsolatedHost,KnowledgeAdapter}=await import(pathToFileURL(join(root,'built/v148-host.mjs')).href)
const {createCompanionBrowserProvider}=await import(pathToFileURL(join(root,'built/companion-browser.mjs')).href)
const {createKnowledgeReadProvider}=await import(pathToFileURL(join(root,'built/knowledge-read.mjs')).href)
const stateDir=join(root,'independent-state');await mkdir(stateDir,{recursive:true})
assert.deepEqual(await readdir(stateDir),[],'Independent state must start empty')
const checks=[],instances=[],unhandled=[],streamControllers=new Set()
const onUnhandled=error=>unhandled.push(error?.name??'unknown')
process.on('unhandledRejection',onUnhandled)
const check=async(name,fn)=>{await fn();checks.push(name)}
async function within(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),ms)})])}finally{clearTimeout(timer)}}
const schemaVersion='companion-knowledge-v1'
let statusFails=false,searches=0,downloadReads=0,cancelObserved=false
let pendingSearchStarted,resolveSearchAbort
const searchStarted=new Promise(r=>{pendingSearchStarted=r}),searchAborted=new Promise(r=>{resolveSearchAbort=r})
const sampleProject={id:'fixture1',name:'Isolated HTTP fixture',path:'/not-a-user-project',connectionPath:'/never-read/connection.json',requiredCreatorVersion:'3.8.8'}
const knowledge={
 async status(){return {schemaVersion,cli:{available:true,compatible:true,version:'fixture-only'},retrieval:{auth:'configured',keyword:'unverified',kbId:'kb1',endpoint:'http://127.0.0.1:8081'},sync:{available:true,writerEnabled:false,schedulerEnabled:false,sources:[]}}},
 async search(input,signal){searches++;if(input.query==='delay'){pendingSearchStarted();return new Promise(resolve=>signal.addEventListener('abort',()=>{cancelObserved=true;resolveSearchAbort();resolve({schemaVersion,results:[],count:0})},{once:true}))}return {schemaVersion,results:[{id:'chunk1',title:'Fixture',content:'Independent test content',knowledgeId:'doc1'}],count:1}},
 async listKnowledgeBases(){return {schemaVersion,items:[{id:'kb1',name:'Fixture KB'}]}},
 async viewKnowledgeBase(input){return {schemaVersion,item:{id:input.kbId,name:'Fixture KB'}}},
 async listDocuments(){return {schemaVersion,items:[{id:'doc1',title:'Fixture document'}],truncated:false}},
 async viewDocument(input){return {schemaVersion,item:{id:input.id,title:'Fixture document'}}},
 async downloadDocument(input){downloadReads++;return {schemaVersion,docId:input.id,fileName:'fixture.txt',bytes:3,truncated:false,isBase64:false,content:'abc'}},
 async listChunks(){return {schemaVersion,items:[{id:'chunk1',content:'Fixture chunk'}],truncated:false}},
 async listAgents(){return {schemaVersion,items:[{id:'agent1',name:'Fixture metadata'}]}},
}
const primary=createV148IsolatedHost({webRoot:resolve('dist-companion'),isolatedStateDirectory:stateDir,testReaders:{projects:{async listProjects(){return [sampleProject]},async listDashboardProjects(){return [{path:sampleProject.path,name:sampleProject.name,source:'dashboard',exists:false}]},async listStatuses(){if(statusFails)throw new Error('Independent forced status failure');return [{projectId:'fixture1',state:'ready',capabilityProfile:'read-only',creatorVersion:'3.8.8'}]}},aiLauncher:{async status(){return {running:true}}},knowledgeService:{async status(){return {running:true,frameable:false}}}},existingApprovedKnowledgeBackend:knowledge})
const secondary=createV148IsolatedHost({webRoot:resolve('dist-companion'),isolatedStateDirectory:stateDir,testReaders:{},existingApprovedKnowledgeBackend:new KnowledgeAdapter({fileAvailable:async()=>false,runJson:async()=>{throw new Error('Subprocess must never execute in this test')}})})
const cookieJars=new Map()
async function open(instance){const entry=await instance.server.listen();assert.equal(entry.host,'127.0.0.1');const base=`http://127.0.0.1:${entry.port}`;instances.push({instance,base});return {base,entry:entry.url}}
function request(base,path,{headers={},...init}={}){assert(path.startsWith('/')&&!path.startsWith('//'));return fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(6000),...init,headers:{...headers}})}
async function authenticated(base,path,init={}){return request(base,path,{...init,headers:{Cookie:cookieJars.get(base),...(init.method&&init.method!=='GET'?{Origin:base}:{}),...init.headers}})}
async function rawHostStatus(base){const target=new URL(base);assert.equal(target.hostname,'127.0.0.1');return new Promise((resolve,reject)=>{const req=nodeRequest({hostname:'127.0.0.1',port:target.port,path:'/api/projects',method:'GET',headers:{Host:'localhost',Cookie:cookieJars.get(base)}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject);req.setTimeout(6000,()=>req.destroy(new Error('raw Host check timeout')));req.end()})}
async function login(base,entry){const auth=await fetch(entry,{redirect:'manual',signal:AbortSignal.timeout(6000)});assert.equal(auth.status,302);assert.equal(auth.headers.get('location'),'/');const header=auth.headers.get('set-cookie');assert(header?.includes('HttpOnly'));assert(header?.includes('SameSite=Strict'));assert(header?.includes('Path=/'));const cookie=header.split(';')[0];assert(cookie.startsWith('creator_ai_session='));cookieJars.set(base,cookie)}
try {
 const one=await open(primary),two=await open(secondary)
 await check('unauthenticated API and static denied',async()=>{assert.equal((await request(one.base,'/api/projects')).status,403);assert.equal((await request(one.base,'/')).status,403)})
 await check('invalid startup code denied',async()=>{assert.equal((await request(one.base,'/auth?code=invalid')).status,403)})
 await check('one-time login sets HttpOnly Strict session cookie',async()=>{await login(one.base,one.entry);assert.equal((await fetch(one.entry,{redirect:'manual',signal:AbortSignal.timeout(6000)})).status,403);await login(two.base,two.entry)})
 await check('instance sessions cannot be reused across ports',async()=>{assert.equal((await request(two.base,'/api/projects',{headers:{Cookie:cookieJars.get(one.base)}})).status,403)})
 await check('Host and POST Origin remain strict without CORS',async()=>{assert.equal(await rawHostStatus(one.base),403);for(const Origin of ['http://elsewhere.invalid','null'])assert.equal((await authenticated(one.base,'/api/knowledge/kb/list',{method:'POST',body:'{}',headers:{Origin,'Content-Type':'application/json'}})).status,403);assert.equal((await request(one.base,'/api/knowledge/kb/list',{method:'POST',body:'{}',headers:{Cookie:cookieJars.get(one.base),'Content-Type':'application/json'}})).status,403);assert.equal((await authenticated(one.base,'/api/projects')).headers.get('access-control-allow-origin'),null)})
 await check('current Companion build is served by original static handler',async()=>{const r=await authenticated(one.base,'/');assert.equal(r.status,200);const html=await r.text();assert(html.includes('id="app"'));const asset=html.match(/src="([^"]+\.js)"/)?.[1];assert(asset);const a=await authenticated(one.base,new URL(asset,one.base+'/').pathname);assert.equal(a.status,200);assert(a.headers.get('content-type')?.includes('javascript'))})
 const transport=base=>async(path,init)=>{assert(path.startsWith('/api/'));assert.equal(init.mode,'same-origin');assert.equal(init.credentials,'same-origin');assert.equal(init.redirect,'error');return authenticated(base,path,init)}
 const projects=createCompanionBrowserProvider({fetch:transport(one.base)})
 const kb=createKnowledgeReadProvider({fetch:transport(one.base)})
 await check('new project adapter consumes original three GET handlers',async()=>{const data=await projects.loadProjects();assert.equal(data.projects[0].id,'fixture1');assert.equal(data.statuses[0].state,'ready');assert.equal(data.dashboard[0].exists,false);assert(!JSON.stringify(data).includes('connectionPath'))})
 await check('original failed status yields explicit partial read, not stopped',async()=>{statusFails=true;try{const data=await projects.loadProjects();assert.equal(data.projects.length,1);assert.equal(data.statuses.length,0);assert(data.warnings.length>0)}finally{statusFails=false}})
 primary.logs.append({projectId:'fixture1',source:'bridge',level:'warning',message:'Fixture warning'})
 await check('real memory log store and original filtered log GET integrate',async()=>{const logs=await projects.loadLogs({projectIds:['fixture1'],levels:['warning'],search:'fixture'});assert.equal(logs.length,1);assert.equal(logs[0].message,'Fixture warning')})
 const call=primary.server.calls.begin('fixture1','scene_get_tree','web',{purpose:'fixture-only'});primary.server.calls.finish('fixture1',call,{count:1})
 await check('new call adapter reads actual isolated CallHistoryStore',async()=>{const counts=await projects.loadCounts(),page=await projects.loadCalls('fixture1',{failed:false});assert.equal(counts.counts.fixture1,1);assert.equal(page.records[0].status,'success');assert.equal(page.sessionId,counts.sessionId)})
 await check('new knowledge adapter consumes original status and service routes',async()=>{const s=await kb.status(),services=await kb.loadServiceStates();assert.equal(s.retrieval.keyword,'unverified');assert.equal(services.model.running,true);assert.equal(services.knowledge.frameable,false)})
 await check('all eight logical-read POSTs traverse original authenticated dispatcher',async()=>{assert.equal((await kb.search({query:'fixture',kbId:'kb1'})).count,1);assert.equal((await kb.listKnowledgeBases()).items[0].id,'kb1');assert.equal((await kb.viewKnowledgeBase({kbId:'kb1'})).item.id,'kb1');assert.equal((await kb.listDocuments({kbId:'kb1'})).items[0].id,'doc1');assert.equal((await kb.viewDocument({id:'doc1'})).item.id,'doc1');assert.equal((await kb.downloadDocument({id:'doc1'})).content,'abc');assert.equal((await kb.listChunks({id:'doc1'})).items[0].id,'chunk1');assert.equal((await kb.listAgents()).items[0].id,'agent1');assert.equal(downloadReads,1)})
 await check('unbound read capabilities fail rather than report empty or stopped',async()=>{for(const path of ['/api/projects','/api/status','/api/dashboard/projects','/api/model-service/status','/api/knowledge-service/status'])assert.equal((await authenticated(two.base,path)).status,501)})
 await check('actual KnowledgeAdapter without identity returns missing auth through original HTTP',async()=>{const p=createKnowledgeReadProvider({fetch:transport(two.base)});const s=await p.status();assert.equal(s.cli.available,false);assert.equal(s.retrieval.auth,'missing');await assert.rejects(p.search({query:'fixture'}),error=>error.code==='unauthorized'&&error.backendCode==='AUTH_MISSING')})
 await check('knowledge writer/chat and service lifecycle routes remain denied by typed binder',async()=>{for(const path of ['/api/knowledge/chat','/api/knowledge/agent/ask','/api/knowledge/sync/run','/api/knowledge/sync/dry-run'])assert.equal((await authenticated(one.base,path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);for(const path of ['/api/model-service/start','/api/model-service/stop','/api/knowledge-service/start','/api/knowledge-service/stop','/api/pick-directory'])assert.equal((await authenticated(one.base,path,{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}})).status,403)})
 await check('log clear and preset writes cannot persist test state',async()=>{assert.equal((await authenticated(one.base,'/api/logs',{method:'DELETE'})).status,403);assert.equal((await authenticated(one.base,'/api/tool-presets',{method:'POST',body:'{"name":"fixture"}',headers:{'Content-Type':'application/json'}})).status,403);assert.equal(primary.logs.query().length,1);assert.deepEqual(await readdir(stateDir),[])})
 await check('malformed and oversized knowledge POSTs fail before reader invocation',async()=>{const before=searches;for(const body of ['{','{"query":"'+('x'.repeat(5000))+'"}'])assert.equal((await authenticated(one.base,'/api/knowledge/search',{method:'POST',body,headers:{'Content-Type':'application/json'}})).status,400);assert.equal(searches,before)})
 await check('client cancellation reaches original HTTP abort signal',async()=>{const abort=new AbortController();streamControllers.add(abort);const pending=authenticated(one.base,'/api/knowledge/search',{method:'POST',body:'{"query":"delay"}',headers:{'Content-Type':'application/json'},signal:abort.signal});const rejected=assert.rejects(pending);await within(searchStarted,2000,'Reader entry');abort.abort();await rejected;await within(searchAborted,2000,'Reader abort');assert(cancelObserved)})
 await check('real SSE subscribes, delivers log and named call, and removes listeners after abort',async()=>{
   const abort=new AbortController();streamControllers.add(abort);const r=await authenticated(one.base,'/api/events',{signal:abort.signal});assert.equal(r.status,200);assert(r.headers.get('content-type')?.includes('text/event-stream'));const reader=r.body.getReader(),decoder=new TextDecoder();let text=decoder.decode((await reader.read()).value);assert(text.includes(': connected'));assert.equal(primary.logs.listenerCount('event'),1);primary.logs.append({projectId:'fixture1',source:'bridge',level:'info',message:'SSE fixture event'});primary.server.calls.begin('fixture1','fixture_call','web',{});const timer=setTimeout(()=>abort.abort(),2500);try{while(!text.includes('SSE fixture event')||!text.includes('event: call')){const next=await reader.read();assert(!next.done);text+=decoder.decode(next.value)}}finally{clearTimeout(timer);abort.abort();await reader.cancel().catch(()=>{});reader.releaseLock()}
   for(let i=0;i<50&&(primary.logs.listenerCount('event')||primary.server.calls.listenerCount('call'));i++)await new Promise(r=>setTimeout(r,20));assert.equal(primary.logs.listenerCount('event'),0);assert.equal(primary.server.calls.listenerCount('call'),0);assert.equal((await authenticated(one.base,'/api/projects')).status,200)
 })
 await check('unhandled promise failures and persisted state remain absent',async()=>{assert.deepEqual(unhandled,[]);assert.deepEqual(await readdir(stateDir),[])})
} finally {
 cookieJars.clear()
 for(const controller of streamControllers)controller.abort()
 const closeResults=await Promise.allSettled(instances.map(({instance})=>instance.server.close()))
 process.removeListener('unhandledRejection',onUnhandled)
 if(closeResults.some(result=>result.status==='rejected'))throw new Error('Temporary instance close failed; closure is unverified.')
}
await check('all temporary listeners refuse requests after verified close',async()=>{for(const {base} of instances)await assert.rejects(fetch(base+'/api/projects',{signal:AbortSignal.timeout(1000)}),error=>error.cause?.code==='ECONNREFUSED')})
const result={schemaVersion:1,sourceHead:'f6dcac804fb9ad806e8094594c7820a71cfab7b8',observedAt:new Date().toISOString(),passed:checks.length,checks,originalHttpClass:true,independentFixtures:true,actualKnowledgeIdentityMissingTest:true,ownerDataRead:false,ownerCookieOrTokenRead:false,locatorWritten:false,temporaryServersClosed:instances.length,browserVisualTest:false,realBridgeOrKnowledgeIndexTest:false,unhandledErrors:unhandled.length}
await writeFile(join(root,'HTTP-VALIDATION.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
