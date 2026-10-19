import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {join,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {SetupService,ProjectRegistry,BridgeInstaller} from './runtime.mjs';
const receipts=[];
const evidenceRoot=new URL('.',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
function deferred(){let release;const promise=new Promise(r=>release=r);return {promise,release};}
async function settled(service,id){for(let i=0;i<300;i++){const op=service.get(id);if(['complete','failed'].includes(op.stage)&&!service.hasActiveOperations())return op;await new Promise(r=>setTimeout(r,5));}throw Error('isolated task failed to settle');}
async function fixture({fail,hold}={}){
 const root=await mkdtemp(join(tmpdir(),'next-setup01-11-')),project=join(root,'project'),home=join(root,'fake-home'),bundle=join(root,'bundle');
 for(const dir of [project,home,bundle])await mkdir(dir);
 await writeFile(join(bundle,'package.json'),JSON.stringify({name:'creator-ai-bridge',version:'fixture-1'}));
 await writeFile(join(bundle,'main.js'),'// inert fixture, never loaded\n');
 const registry=new ProjectRegistry(join(root,'registry.json')),installer=new BridgeInstaller(bundle,join(root,'installs.json'));
 const calls=[],config=join(home,'controlled-config.json');
 const inside=p=>{const rel=relative(root,resolve(p));assert.ok(rel&&!rel.startsWith('..')&&!resolve(p).endsWith(':'));};
 const deps={
  addProject:async p=>{inside(p);calls.push('register');await hold;return registry.add(p);},
  installBridge:async p=>{inside(p.path);calls.push('bridge');if(fail==='bridge')throw Error('controlled-bridge-failure');return installer.install(p);},
  startCreator:async id=>{calls.push('controlled-creator');return {projectId:id,state:fail==='creator'?'error':'ready',lastError:'controlled-not-ready',sessionId:'controlled-session'};},
  configureCodex:async(p,codexPath)=>{calls.push('controlled-codex');assert.equal(codexPath,join(home,'never-executed-codex'));await writeFile(config,JSON.stringify({projectId:p.id,name:'controlled-mcp'}));if(fail==='codex')throw Error('controlled-codex-after-write-failure');return {name:'controlled-mcp'};},
  verify:async()=>{calls.push('controlled-verify');if(fail==='verify')throw Error('controlled-verify-failure');}
 };
 return {root,project,home,bundle,registry,installer,calls,config,service:new SetupService(deps),options:startCreator=>({startCreator,configureCodex:true,codexPath:join(home,'never-executed-codex')})};
}
for(const startCreator of [false,true]){
 test(`deployed setup ${startCreator?'11':'01'}: real temporary registry/bridge, frozen options, controlled Codex callback`,async()=>{
  const f=await fixture(),options=f.options(startCreator),first=f.service.start(f.project,options);
  options.startCreator=!startCreator;options.configureCodex=false;
  const op=await settled(f.service,first.id);
  assert.equal(first.reused,false);assert.equal(op.stage,'complete');assert.equal(op.optionsContractVersion,1);
  assert.deepEqual(op.effectiveOptions,f.options(startCreator));assert.equal(op.mcpName,'controlled-mcp');
  assert.deepEqual(f.calls,['register','bridge',...(startCreator?['controlled-creator']:[]),'controlled-codex',...(startCreator?['controlled-verify']:[])]);
  assert.equal((await f.registry.list())[0].id,op.projectId);
  assert.equal(await readFile(join(f.project,'extensions/creator-ai-bridge/main.js'),'utf8'),await readFile(join(f.bundle,'main.js'),'utf8'));
  assert.equal(JSON.parse(await readFile(f.config,'utf8')).projectId,op.projectId);
  const clone=f.service.get(op.id);clone.effectiveOptions.configureCodex=false;assert.equal(f.service.get(op.id).effectiveOptions.configureCodex,true);
  assert.ok((await readdir(join(f.project,'extensions'))).every(x=>!x.includes('.companion-')&&!x.includes('.backup-')));
  receipts.push({scenario:startCreator?'11-success':'01-success',root:f.root,stage:op.stage,options:op.effectiveOptions,calls:f.calls});
 });
 test(`deployed setup ${startCreator?'11':'01'}: same-option reuse and opposite-option conflict reserve before external side effects`,async()=>{
  const gate=deferred(),f=await fixture({hold:gate.promise}),options=f.options(startCreator),first=f.service.start(f.project,options);
  assert.equal(f.service.hasActiveOperations(),true);
  const same=f.service.start(` ${f.project} `,{...options});assert.equal(same.id,first.id);assert.equal(same.reused,true);
  for(const changed of [{...options,startCreator:!startCreator},{...options,configureCodex:false},{...options,codexPath:join(f.home,'different')}])assert.throws(()=>f.service.start(f.project,changed),e=>e.code==='SETUP_OPTIONS_CONFLICT'&&e.httpStatus===409&&e.activeOperationId===first.id);
  assert.deepEqual(f.calls,['register']);assert.deepEqual(await f.registry.list(),[]);
  gate.release();assert.equal((await settled(f.service,first.id)).stage,'complete');
  assert.equal(f.calls.filter(x=>x==='register').length,1);
  receipts.push({scenario:startCreator?'11-reuse-conflict':'01-reuse-conflict',root:f.root,calls:f.calls});
 });
}
for(const fail of ['bridge','creator','codex','verify'])test(`failure ${fail}: terminal releases admission but does not promise rollback of earlier effects`,async()=>{
 const f=await fixture({fail}),first=f.service.start(f.project,f.options(true)),op=await settled(f.service,first.id);
 assert.equal(op.stage,'failed');assert.match(op.error,/controlled-/);assert.equal(f.service.hasActiveOperations(),false);
 assert.equal((await f.registry.list()).length,1);
 if(fail==='bridge')assert.deepEqual(f.calls,['register','bridge']);
 if(fail==='creator'){assert.deepEqual(f.calls,['register','bridge','controlled-creator']);await assert.rejects(readFile(f.config),{code:'ENOENT'});}
 if(fail==='codex')assert.ok(!f.calls.includes('controlled-verify'));
 if(['codex','verify'].includes(fail))assert.equal(JSON.parse(await readFile(f.config,'utf8')).projectId,op.projectId);
 // Earlier registration and successful bridge install are deliberately retained by the original service.
 if(fail!=='bridge')assert.equal(await readFile(join(f.project,'extensions/creator-ai-bridge/main.js'),'utf8'),'// inert fixture, never loaded\n');
 assert.equal(op.mcpName,fail==='verify'?'controlled-mcp':undefined);
 const next=f.service.start(f.project,{startCreator:false,configureCodex:false});assert.equal(next.reused,false);assert.notEqual(next.id,first.id);
 const terminal=await settled(f.service,next.id);assert.equal(terminal.stage,fail==='bridge'?'failed':'complete');
 assert.equal(f.service.get(first.id).stage,'failed');
 receipts.push({scenario:`failure-${fail}`,root:f.root,stage:op.stage,earlierEffectsRetained:true,explicitNewRequestStage:terminal.stage,calls:f.calls});
});
test.after(async()=>{if(receipts.length===8)await writeFile(join(evidenceRoot,'receipts.json'),JSON.stringify({scope:'isolated deployed-source orchestration; Creator and Codex callbacks controlled; not production installation',receipts},null,2));});
