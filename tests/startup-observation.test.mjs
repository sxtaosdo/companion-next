import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as startup from '../scripts/start-companion.mjs';
const {startCompanion,StartupError,BASE}=startup;
const status=pid=>({schemaVersion:'companion-daemon-inflight-v1',phase:'OPEN',generation:1,observedAt:new Date().toISOString(),identity:{pid,startupEpoch:'11111111-1111-4111-8111-111111111111',entryPath:startup.DAEMON_ENTRY,entrySha256:'a'.repeat(64)},counts:{},unknown:[]});
const missing=()=>new Error('Cannot securely read daemon state',{cause:{code:'ENOENT'}});
const race=()=>Object.assign(Error('private race detail'),{status:409,code:'DAEMON_GENERATION_CHANGED'});
test('official adapter requests existing JSON protocol once and retains only bounded failure classification',async()=>{
 let calls=0;const output={schemaVersion:'cocos-tool-result-v1',tool:'creator_ai_cli',status:'FAILED',data:null,error:{code:'INVALID_REQUEST',message:'DAEMON_PORT_OCCUPIED: port 32180; secret-token-must-not-leak'}};
 await assert.rejects(startup.officialStart({},(_command,args,options,callback)=>{calls++;assert.deepEqual(args.slice(1),['daemon','start','--json']);assert.equal(options.windowsHide,true);callback(Object.assign(Error('sensitive process error'),{code:1}),JSON.stringify(output),'private stderr');}),error=>error instanceof StartupError&&error.code==='OFFICIAL_START_PORT_OCCUPIED'&&!JSON.stringify(error).includes('secret')&&!JSON.stringify(error).includes('stderr'));
 assert.equal(calls,1);
});
test('official JSON PASSED supplies only an optional positive launched PID, never auth URLs',async()=>{
 const result=await startup.officialStart({},(_command,_args,_options,callback)=>callback(null,JSON.stringify({schemaVersion:'cocos-tool-result-v1',tool:'daemon_start',status:'PASSED',data:{started:true,pid:42,status:{running:true,auth:'secret'}}})));
 assert.deepEqual(result,{confirmed:true,pid:42});
});
test('late locator and socket readiness plus more than five generation races are read-only observations of one start',async()=>{
 let starts=0,discoveries=0,reads=0,now=0;const result=await startCompanion({noBrowser:true},{start:async()=>{starts++;throw new StartupError('OFFICIAL_START_UNCONFIRMED')},discover:async()=>{if(++discoveries<3)throw missing();return {baseUrl:BASE,request:async()=>{if(++reads===1)throw new TypeError('fetch failed',{cause:{code:'ECONNREFUSED'}});if(reads<9)throw race();return status(42);}}},readiness:{now:()=>now,delay:async ms=>{now+=ms},timeoutMs:1000,pollMs:10}});
 assert.equal(starts,1);assert.equal(result.pid,42);assert.equal(result.lateReady,true);assert.equal(discoveries,11);assert.equal(reads,9);
});
test('known child exit remains a true failure after one failed read and never launches again',async()=>{
 let starts=0,reads=0;await assert.rejects(startCompanion({noBrowser:true},{start:async()=>{starts++;throw new StartupError('OFFICIAL_START_FAILED',{reason:'child-exited'})},discover:async()=>{reads++;throw missing();}}),error=>error.code==='OFFICIAL_START_FAILED');assert.equal(starts,1);assert.equal(reads,1);
});
test('foreign program response is not accepted as daemon readiness or used to restart a port occupant',async()=>{
 let starts=0,reads=0;await assert.rejects(startCompanion({noBrowser:true},{start:async()=>{starts++;throw new StartupError('OFFICIAL_START_PORT_OCCUPIED')},discover:async()=>({baseUrl:BASE,request:async()=>{reads++;return {phase:'OPEN',identity:{pid:42}}}})}),error=>error.code==='OFFICIAL_START_PORT_OCCUPIED');assert.equal(starts,1);assert.equal(reads,1);
});
test('hung discovery is bounded and reports uncertainty, without declaring the daemon failed or retrying start',async()=>{
 let starts=0;await assert.rejects(startCompanion({noBrowser:true},{start:async()=>{starts++},discover:()=>new Promise(()=>{}),readiness:{timeoutMs:3,pollMs:1}}),error=>error.code==='DAEMON_READINESS_UNCONFIRMED');assert.equal(starts,1);
});
test('auth rejection is a distinct terminal read failure, never a readiness retry',async()=>{
 let reads=0;await assert.rejects(startCompanion({noBrowser:true},{start:async()=>{},discover:async()=>({baseUrl:BASE,request:async()=>{reads++;throw Object.assign(Error('credential detail'),{status:403,code:'FORBIDDEN'})}})}),error=>error.code==='DAEMON_AUTH_REJECTED');assert.equal(reads,1);
});
test('existing correctly identified OPEN service is reused through the one existing official ensure path',async()=>{
 let starts=0;const result=await startCompanion({noBrowser:true},{start:async()=>{starts++;return {confirmed:true}},discover:async()=>({baseUrl:BASE,request:async()=>status(42)}),createBrowser:()=>assert.fail('browser')});assert.equal(starts,1);assert.equal(result.pid,42);assert.equal(result.lateReady,false);
});
test('a launched-PID mismatch and a draining daemon never count as confirmed readiness',async()=>{
 for(const value of [{...status(43)},{...status(42),phase:'DRAINING'}])await assert.rejects(startCompanion({noBrowser:true},{start:async()=>({confirmed:true,pid:42}),discover:async()=>({baseUrl:BASE,request:async()=>value})}),error=>['DAEMON_START_IDENTITY_CHANGED','DAEMON_NOT_READY'].includes(error.code));
});

test('actual CLI JSON failures distinguish startup deadline, timeout, child exit and unavailable executable without retaining raw output',async()=>{
 const envelope=message=>JSON.stringify({schemaVersion:'cocos-tool-result-v1',tool:'creator_ai_cli',status:'FAILED',data:null,error:{code:'INVALID_REQUEST',message}});
 for(const [error,stdout,code,reason] of [
  [Object.assign(Error('private'),{code:1}),envelope('Creator AI Companion daemon did not become ready within 8 seconds (private detail)'),'OFFICIAL_START_UNCONFIRMED','cli-readiness-deadline'],
  [Object.assign(Error('private'),{killed:true,signal:'SIGTERM'}),'private partial stdout','OFFICIAL_START_UNCONFIRMED','cli-timeout'],
  [Object.assign(Error('private'),{code:1}),envelope('Creator AI Companion daemon exited immediately; private detail'),'OFFICIAL_START_FAILED','child-exited'],
  [Object.assign(Error('private'),{code:'ENOENT'}),'','OFFICIAL_START_FAILED','executable-unavailable'],
  [Object.assign(Error('private'),{code:1}),'private malformed stdout','OFFICIAL_START_UNCONFIRMED','cli-protocol'],
 ])await assert.rejects(startup.officialStart({},(_c,_a,_o,callback)=>callback(error,stdout,'private stderr')),failure=>failure.code===code&&failure.reason===reason&&!JSON.stringify(failure).includes('private'));
});
test('a hung health promise is bounded even when an injected transport ignores AbortSignal',async()=>{
 let starts=0,reads=0,signal;await assert.rejects(startCompanion({noBrowser:true},{start:async()=>{starts++},discover:async()=>({baseUrl:BASE,request:(_method,_path,_body,activeSignal)=>{reads++;signal=activeSignal;return new Promise(()=>{})}}),readiness:{timeoutMs:3,pollMs:1}}),failure=>failure.code==='DAEMON_READINESS_UNCONFIRMED'&&failure.stage==='health');assert.equal(starts,1);assert.equal(reads,1);assert.equal(signal.aborted,true);
});
test('uses the installed cancellable authenticated health request and rejects an unrecognized daemon entry',async()=>{
 const result=await startCompanion({noBrowser:true},{start:async()=>{},discover:async()=>({baseUrl:BASE,daemonInFlight:()=>assert.fail('uncancellable method is not needed'),request:async(method,path,_body,signal)=>{assert.equal(method,'GET');assert.equal(path,'/v1/daemon/inflight');assert(signal instanceof AbortSignal);return status(42)}})});assert.equal(result.pid,42);
 await assert.rejects(startCompanion({noBrowser:true},{start:async()=>{},discover:async()=>({baseUrl:BASE,request:async()=>({...status(42),identity:{...status(42).identity,entryPath:'C:/unrelated/service.js'}})})}),failure=>failure.code==='DAEMON_IDENTITY_UNVERIFIED');
});
test('startup terminal output contains only stable classification and never raw diagnostic secrets',()=>{
 const raw=Error('Bearer private-secret http://127.0.0.1:32180/auth?code=private-ticket');
 const unknown=startup.startupFailureSummary(raw);assert.match(unknown,/readiness unconfirmed \[LOCAL_START_UNCONFIRMED\]/);assert.doesNotMatch(unknown,/private|Bearer|auth\?/);
 const known=startup.startupFailureSummary(new StartupError('OFFICIAL_START_UNCONFIRMED',{stage:'official-start',reason:'cli-readiness-deadline',exitCode:1}));assert.match(known,/stage=official-start, reason=cli-readiness-deadline, cliExit=1/);assert.doesNotMatch(known,/startup failed/);
});

test('one cold start shares the original 65s budget after the official CLI 8s deadline', async () => {
  let now = 0, starts = 0, reads = 0;
  const result = await startCompanion({ noBrowser: true }, {
    start: async () => { starts++; now = 8000; throw new StartupError('OFFICIAL_START_UNCONFIRMED', { reason: 'cli-readiness-deadline', exitCode: 1 }); },
    discover: async () => { reads++; if (now < 24000) throw missing(); return { baseUrl: BASE, request: async () => status(42) }; },
    readiness: { now: () => now, delay: async ms => { now += ms; }, pollMs: 100 },
    createBrowser: () => assert.fail('no browser'),
  });
  assert.equal(starts, 1); assert.equal(result.pid, 42); assert.equal(now, 24000);
  assert.equal(result.lateReady, true); assert.equal(result.officialReason, 'cli-readiness-deadline');
  assert(reads > 100);
});

test('an absent cold-start locator exhausts 65s total, not 65s plus another observation window', async () => {
  let now = 0, starts = 0;
  await assert.rejects(startCompanion({ noBrowser: true }, {
    start: async () => { starts++; now = 8000; throw new StartupError('OFFICIAL_START_UNCONFIRMED', { reason: 'cli-readiness-deadline', exitCode: 1 }); },
    discover: async () => { throw missing(); },
    readiness: { now: () => now, delay: async ms => { now += ms; }, pollMs: 100 },
  }), error => error.code === 'DAEMON_READINESS_UNCONFIRMED' && error.reason === 'locator-not-yet-present'
    && error.officialReason === 'cli-readiness-deadline' && error.officialExitCode === 1);
  assert.equal(starts, 1); assert.equal(now, 65000);
});

test('a fully consumed CLI budget does not silently allocate another ten seconds', async () => {
  let now = 0, reads = 0;
  await assert.rejects(startCompanion({ noBrowser: true }, {
    start: async () => { now = 65000; throw new StartupError('OFFICIAL_START_UNCONFIRMED', { reason: 'cli-timeout' }); },
    discover: async () => { reads++; return { baseUrl: BASE, request: async () => status(42) }; },
    readiness: { now: () => now },
  }), error => error.code === 'DAEMON_READINESS_UNCONFIRMED' && error.reason === 'startup-budget-exhausted');
  assert.equal(reads, 0);
});

test('a single health read is capped at ten seconds inside the shared 65s startup budget', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal, starts = 0;
  const pending = startCompanion({ noBrowser: true }, {
    start: async () => { starts++; },
    discover: async () => ({ baseUrl: BASE, request: (_m, _p, _b, activeSignal) => { signal = activeSignal; return new Promise(() => {}); } }),
  });
  const assertion = assert.rejects(pending, error => error.code === 'DAEMON_READINESS_UNCONFIRMED' && error.stage === 'health');
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert(signal instanceof AbortSignal);
  t.mock.timers.tick(9999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); await assertion;
  assert.equal(signal.aborted, true); assert.equal(starts, 1);
});

test('a new listener with an old locator permits one changed-credential identity read only', async () => {
  let starts = 0, discoveries = 0;
  const requests = [];
  const result = await startCompanion({ noBrowser: true }, {
    start: async () => { starts++; throw new StartupError('OFFICIAL_START_UNCONFIRMED', { reason: 'cli-readiness-deadline' }); },
    discover: async () => {
      const old = ++discoveries === 1;
      return { baseUrl: BASE, apiToken: old ? 'old-test-token' : 'current-test-token', request: async (method, path, body, signal) => {
        requests.push([method, path]); assert.equal(body, undefined); assert(signal instanceof AbortSignal);
        if (old) throw Object.assign(Error('private old credential'), { status: 403 });
        return status(42);
      } };
    },
    createBrowser: () => assert.fail('no browser or ticket'),
  });
  assert.equal(starts, 1); assert.equal(discoveries, 2); assert.equal(result.pid, 42);
  assert.deepEqual(requests, [['GET', '/v1/daemon/inflight'], ['GET', '/v1/daemon/inflight']]);
});

test('unchanged, missing and explicit fixed credentials never replay a rejected identity read', async () => {
  for (const apiToken of ['fixed-test-token', undefined, '']) {
    let discoveries = 0, reads = 0;
    await assert.rejects(startCompanion({ noBrowser: true }, {
      start: async () => {},
      discover: async () => { discoveries++; return { baseUrl: BASE, apiToken, request: async () => { reads++; throw Object.assign(Error('private denial'), { status: 403 }); } }; },
    }), failure => failure.code === 'DAEMON_AUTH_REJECTED');
    assert.equal(reads, 1); assert(discoveries <= 2);
  }
});

test('changed credentials cannot bypass a current rejection, foreign locator or launched PID mismatch', async () => {
  for (const outcome of ['denied', 'foreign', 'pid-mismatch']) {
    let discoveries = 0, reads = 0;
    await assert.rejects(startCompanion({ noBrowser: true }, {
      start: async () => ({ confirmed: true, pid: 42 }),
      discover: async () => {
        const old = ++discoveries === 1;
        return { baseUrl: !old && outcome === 'foreign' ? 'http://127.0.0.1:32181' : BASE, apiToken: old ? 'old-test-token' : 'current-test-token', request: async () => {
          reads++;
          if (old || outcome === 'denied') throw Object.assign(Error('private denial'), { status: 403 });
          return status(43);
        } };
      },
    }), failure => failure.code === ({ denied: 'DAEMON_AUTH_REJECTED', foreign: 'UNEXPECTED_DAEMON_URL', 'pid-mismatch': 'DAEMON_START_IDENTITY_CHANGED' })[outcome]);
    assert.equal(discoveries, 2); assert.equal(reads, outcome === 'foreign' ? 1 : 2);
  }
});

test('a changed token permits the same bounded recovery for 401 and failed rediscovery stays terminal', async () => {
  for (const unavailable of [false, true]) {
    let discoveries = 0, reads = 0;
    const pending = startCompanion({ noBrowser: true }, {
      start: async () => {},
      discover: async () => {
        const old = ++discoveries === 1;
        if (!old && unavailable) throw missing();
        return { baseUrl: BASE, apiToken: old ? 'old-test-token' : 'current-test-token', request: async () => {
          reads++; if (old) throw Object.assign(Error('private credential'), { status: 401 }); return status(42);
        } };
      },
    });
    if (unavailable) await assert.rejects(pending, failure => failure.code === 'DAEMON_AUTH_REJECTED' && failure.reason === 'credential-refresh-unconfirmed');
    else assert.equal((await pending).pid, 42);
    assert.equal(discoveries, 2); assert.equal(reads, unavailable ? 1 : 2);
  }
});

test('auth rediscovery is allowed only once across transient generation observations', async () => {
  let discoveries = 0, reads = 0;
  await assert.rejects(startCompanion({ noBrowser: true }, {
    start: async () => {},
    discover: async () => ({ baseUrl: BASE, apiToken: 'test-token-' + ++discoveries, request: async () => {
      reads++; if (reads === 2) throw race(); throw Object.assign(Error('denied'), { status: 403 });
    } }),
    readiness: { pollMs: 1 },
  }), failure => failure.code === 'DAEMON_AUTH_REJECTED');
  assert.equal(discoveries, 3); assert.equal(reads, 3);
});

test('credential rediscovery uses the existing health timer and cannot allocate another read budget', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let discoveries = 0, signal;
  const pending = startCompanion({ noBrowser: true }, {
    start: async () => {},
    discover: async () => {
      if (++discoveries === 2) return new Promise(() => {});
      return { baseUrl: BASE, apiToken: 'old-test-token', request: async (_m, _p, _b, activeSignal) => {
        signal = activeSignal; throw Object.assign(Error('denied'), { status: 403 });
      } };
    },
  });
  const assertion = assert.rejects(pending, failure => failure.code === 'DAEMON_READINESS_UNCONFIRMED' && failure.stage === 'discovery');
  for (let i = 0; i < 12; i++) await Promise.resolve();
  assert.equal(discoveries, 2); assert.equal(signal.aborted, false);
  t.mock.timers.tick(10_000); await assertion;
  assert.equal(signal.aborted, true); assert.equal(discoveries, 2);
});

test('credential rediscovery cannot issue health after the shared startup deadline', async () => {
  let now = 0, discoveries = 0, reads = 0;
  await assert.rejects(startCompanion({ noBrowser: true }, {
    start: async () => { now = 64_000; },
    discover: async () => {
      const old = ++discoveries === 1;
      if (!old) now = 65_000;
      return { baseUrl: BASE, apiToken: old ? 'old-test-token' : 'current-test-token', request: async () => {
        reads++; throw Object.assign(Error('denied'), { status: 403 });
      } };
    },
    readiness: { now: () => now },
  }), failure => failure.code === 'DAEMON_READINESS_UNCONFIRMED' && failure.reason === 'deadline');
  assert.equal(discoveries, 2); assert.equal(reads, 1);
});
