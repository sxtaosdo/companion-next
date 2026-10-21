import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startCompanion, openNext, startupEnvironment, discoverBounded, waitForOwnedBrowser, StartupError, BASE, NEXT } from '../scripts/start-companion.mjs';
test('rejects nonlocal or partial overrides before any startup and does not mutate environment', () => {
  assert.throws(() => startupEnvironment({ CREATOR_AI_DAEMON_URL: 'http://localhost:7470', CREATOR_AI_DAEMON_TOKEN: 'test' }), /UNEXPECTED_DAEMON_URL/);
  assert.throws(() => startupEnvironment({ CREATOR_AI_DAEMON_TOKEN: 'test' }), /INCOMPLETE/);
  const original={ DEBUG:'test', PWDEBUG:'1' };const scoped=startupEnvironment(original);
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
  const env={WEKNORA_API_KEY:'test',KNOWLEDGE_SYNC_API_KEY:'test'};const scoped=startupEnvironment(env);assert.equal(scoped.WEKNORA_API_KEY,undefined);assert.equal(scoped.KNOWLEDGE_SYNC_API_KEY,undefined);assert.equal(env.WEKNORA_API_KEY,'test');
});
