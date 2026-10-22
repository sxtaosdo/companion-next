import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startCompanion, openNext, startupEnvironment, discoverBounded, waitForOwnedBrowser, StartupError, BASE, NEXT, APPROVED_STARTUP_CONFIG, validateStartupConfiguration, loadStartupConfiguration } from '../scripts/start-companion.mjs';
test('rejects nonlocal or partial overrides before any startup and does not mutate environment', () => {
  assert.throws(() => startupEnvironment({ CREATOR_AI_DAEMON_URL: 'http://localhost:7470', CREATOR_AI_DAEMON_TOKEN: 'test' }), /UNEXPECTED_DAEMON_URL/);
  assert.throws(() => startupEnvironment({ CREATOR_AI_DAEMON_TOKEN: 'test' }), /INCOMPLETE/);
  const original={ DEBUG:'test', PWDEBUG:'1' };const scoped=startupEnvironment(original, APPROVED_STARTUP_CONFIG);
  assert.equal(scoped.DEBUG,undefined);assert.equal(scoped.PWDEBUG,undefined);assert.equal(original.DEBUG,'test');
});
test('cold and already running paths each use only official start, then bounded status; no-browser never creates a ticket',async()=>{
  for(const runningBefore of [false,true]){
    let starts=0,spawns=0;const requests=[];let running=runningBefore;
    const result=await startCompanion({noBrowser:true},{start:async()=>{starts++;if(!running){spawns++;running=true}},discover:async()=>({baseUrl:BASE,request:async(method,path,_body,signal)=>{requests.push([method,path]);assert(signal instanceof AbortSignal);return {phase:running?'OPEN':'CLOSED',identity:{pid:123}}}}),createBrowser:()=>assert.fail('browser')});
    assert.equal(result.url,NEXT);assert.equal(starts,1);assert.equal(spawns,runningBefore?0:1);assert.deepEqual(requests,[['GET','/v1/daemon/inflight']]);
  }
});
test('unconfirmed startup is not retried and does not open a browser',async()=>{
  let calls=0;await assert.rejects(startCompanion({}, {start:async()=>{calls++;throw Error('timeout')},discover:()=>assert.fail('discover'),createBrowser:()=>assert.fail('browser')}),/timeout/);assert.equal(calls,1);
});
test('only the original auth handler consumes the ticket and only Next is navigated',async()=>{
  const calls=[],closed=[];
  const page={goto:async(url)=>{calls.push(['page',url]);return {status:()=>200}},url:()=>NEXT};
  const browser={newContext:async options=>{assert.equal(options.serviceWorkers,'block');return {request:{get:async(url,options)=>{calls.push(['request',url]);if(url.includes('/auth?')){assert.equal(options.maxRedirects,0);return {status:()=>302,headers:()=>({location:'/'})}}return {status:()=>200}}},newPage:async()=>page}},close:async()=>closed.push(true)};
  await openNext({baseUrl:BASE,request:async()=>({url:BASE+'/auth?code=one-time-test'})},async()=>browser);
  assert.deepEqual(calls.map(c=>c[0]),['request','request','page']);assert.equal(calls.at(-1)[1],NEXT);assert.equal(closed.length,0);
});
test('foreign tickets and failed authentication close only the owned browser and never navigate',async()=>{
  for(const foreign of [true,false]){let closed=0;
    const browser={newContext:async()=>({request:{get:async()=>({status:()=>403,headers:()=>({})})},newPage:()=>assert.fail('page')}),close:async()=>closed++};
    await assert.rejects(openNext({baseUrl:BASE,request:async()=>({url:(foreign?'http://example.invalid':BASE)+'/auth?code=test'})},async()=>browser),foreign?/INVALID_UI_TICKET/:/UI_AUTH_FAILED/);assert.equal(closed,1);
  }
});

test('observes a late official start once without issuing another start',async()=>{
  let starts=0;const result=await startCompanion({noBrowser:true},{start:async()=>{starts++;throw new StartupError('OFFICIAL_START_UNCONFIRMED')},discover:async()=>({baseUrl:BASE,request:async()=>({phase:'OPEN',identity:{pid:456}})})});assert.equal(starts,1);assert.equal(result.pid,456);assert.equal(result.lateReady,true);
});
test('discovery is bounded and a closed owned browser does not keep the command waiting',async()=>{
  await assert.rejects(discoverBounded(()=>new Promise(()=>{}),2),/DISCOVERY_UNCONFIRMED/);
  await waitForOwnedBrowser({isConnected:()=>false,close:async()=>{},once:()=>assert.fail('already disconnected')});
});
test('shared knowledge keys are removed only from child environment',()=>{
  const env={WEKNORA_API_KEY:'test',KNOWLEDGE_SYNC_API_KEY:'test'};const scoped=startupEnvironment(env, APPROVED_STARTUP_CONFIG);assert.equal(scoped.WEKNORA_API_KEY,undefined);assert.equal(scoped.KNOWLEDGE_SYNC_API_KEY,undefined);assert.equal(env.WEKNORA_API_KEY,'test');
});


test('approved machine config has exactly six explicit bindings and rejects mode/path/key drift',()=>{
 const binding={...APPROVED_STARTUP_CONFIG};assert.deepEqual(validateStartupConfiguration(binding),binding);
 for(const value of [null,[],{}, {...binding,CREATOR_AI_ICONS_ENDPOINT:'http://127.0.0.1:8188'}, {...binding,CREATOR_AI_ICONS_MODE:'generation'}, {...binding,CREATOR_AI_ICONS_STORE:'D:/Elsewhere'}, {...binding,CREATOR_AI_ICONS_NODE:'node.exe'}, {...binding,CREATOR_AI_ICONS_NODE:123}]) assert.throws(()=>validateStartupConfiguration(value),StartupError);
 const getter={...binding};Object.defineProperty(getter,'CREATOR_AI_ICONS_STORE',{get:()=>assert.fail('getter must not run'),enumerable:true});assert.throws(()=>validateStartupConfiguration(getter),/LOCAL_CONFIG_VALUE_INVALID/);
 const hidden={...binding};Object.defineProperty(hidden,'extra',{value:'unexpected',enumerable:false});assert.throws(()=>validateStartupConfiguration(hidden),/LOCAL_CONFIG_KEYS_INVALID/);
});

test('machine-local loader fails closed for missing/malformed/oversized/repeated-key configuration',()=>{
 const dir=mkdtempSync(join(tmpdir(),'companion-start-config-')),file=join(dir,'config.json');
 try{
  assert.throws(()=>loadStartupConfiguration(file),/LOCAL_CONFIG_MISSING/);
  writeFileSync(file,'{broken');assert.throws(()=>loadStartupConfiguration(file),/LOCAL_CONFIG_JSON_INVALID/);
  writeFileSync(file,' '.repeat(17000));assert.throws(()=>loadStartupConfiguration(file),/LOCAL_CONFIG_FILE_INVALID/);
  const valid=JSON.stringify(APPROVED_STARTUP_CONFIG);writeFileSync(file,valid);assert.deepEqual(loadStartupConfiguration(file),APPROVED_STARTUP_CONFIG);
  writeFileSync(file,valid.replace('{','{"CREATOR_AI_ICONS_MODE":"generation",'));assert.throws(()=>loadStartupConfiguration(file),/LOCAL_CONFIG_KEYS_INVALID/);
  writeFileSync(file,JSON.stringify({...APPROVED_STARTUP_CONFIG,secret:'not-accepted'}));assert.throws(()=>loadStartupConfiguration(file),/LOCAL_CONFIG_KEYS_INVALID/);
 }finally{rmSync(dir,{recursive:true});}
});

test('offline binding strips all inherited icon capabilities including case variants without mutating its parent',()=>{
 const parent={PATH:'inherited',CREATOR_AI_ICONS_MODE:'generation',CREATOR_AI_ICONS_ENDPOINT:'http://127.0.0.1:8188',CREATOR_AI_ICONS_LEASE:'D:/unrelated',CREATOR_AI_ICONS_ADOPTION_MANIFEST:'D:/unrelated.json',CREATOR_AI_ICONS_ACCEPTANCE_MANIFEST:'D:/other.json',creator_ai_icons_future_feature:'enabled',Creator_Ai_Icons_Store:'D:/wrong',CREATOR_AI_OWNER_CACHE:'D:/unchanged'};
 const original={...parent};const child=startupEnvironment(parent,APPROVED_STARTUP_CONFIG);
 assert.deepEqual(Object.fromEntries(Object.entries(child).filter(([key])=>key.toUpperCase().startsWith('CREATOR_AI_ICONS_'))),APPROVED_STARTUP_CONFIG);
 assert.equal(child.PATH,parent.PATH);assert.equal(child.CREATOR_AI_OWNER_CACHE,parent.CREATOR_AI_OWNER_CACHE);assert.deepEqual(parent,original);
 assert.throws(()=>startupEnvironment(parent,{...APPROVED_STARTUP_CONFIG,CREATOR_AI_ICONS_MODE:'generation'}),/LOCAL_CONFIG_MODE_INVALID/);
});

test('tracked example matches the bounded allowlist and does not become an automatic fallback',()=>{
 const example=JSON.parse(readFileSync(new URL('../companion-start.example.json',import.meta.url),'utf8'));
 assert.deepEqual(validateStartupConfiguration(example),APPROVED_STARTUP_CONFIG);
 assert.throws(()=>loadStartupConfiguration(join(tmpdir(),'nonexistent-companion-machine-config-'+process.pid+'.json')),/LOCAL_CONFIG_MISSING/);
});

test('readiness retries only the snapshot generation race without repeating startup or issuing a ticket',async()=>{
 let starts=0,reads=0;const result=await startCompanion({noBrowser:true},{start:async()=>{starts++},discover:async()=>({baseUrl:BASE,request:async(method,path)=>{assert.equal(method,'GET');assert.equal(path,'/v1/daemon/inflight');if(++reads<3)throw Object.assign(Error('race'),{status:409,code:'DAEMON_GENERATION_CHANGED'});return {phase:'OPEN',identity:{pid:456}}}}),createBrowser:()=>assert.fail('browser')});assert.equal(starts,1);assert.equal(reads,3);assert.equal(result.pid,456);
});
test('permission refusal is not retried as readiness and persistent generation races are bounded',async()=>{
 for(const code of ['FORBIDDEN','DAEMON_GENERATION_CHANGED']){let starts=0,reads=0;await assert.rejects(startCompanion({noBrowser:true},{start:async()=>{starts++},discover:async()=>({baseUrl:BASE,request:async()=>{reads++;throw Object.assign(Error(code),{status:code==='FORBIDDEN'?403:409,code})}}),createBrowser:()=>assert.fail('browser')}),new RegExp(code));assert.equal(starts,1);assert.equal(reads,code==='FORBIDDEN'?1:5);}
});

const { ensureAccountProvider } = await import('../scripts/start-companion.mjs');
test('account dependency uses existing Node22 backend-only launcher and validates exact readiness',async()=>{
 let count=0;const result=await ensureAccountProvider((command,args,options,callback)=>{count++;assert.match(command,/dual-game-build/);assert.equal(args[1],'--backend-only');assert.equal(options.windowsHide,true);callback(null,JSON.stringify({ready:true,port:18001,pid:42}));});assert.equal(result.pid,42);assert.equal(count,1);
 for(const bad of ['{}',JSON.stringify({ready:true,port:8001,pid:42}),'invalid'])await assert.rejects(ensureAccountProvider((_c,_a,_o,callback)=>callback(null,bad)),/ACCOUNT_PROVIDER_UNCONFIRMED/);
});
test('unconfirmed auth dependency prevents Companion startup and browser creation without retry',async()=>{
 let calls=0;await assert.rejects(startCompanion({}, {ensureAuth:async()=>{calls++;throw new StartupError('ACCOUNT_PROVIDER_UNCONFIRMED')},start:()=>assert.fail('must not start'),createBrowser:()=>assert.fail('must not open')}),/ACCOUNT_PROVIDER_UNCONFIRMED/);assert.equal(calls,1);
});
