import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,writeFileSync,readFileSync,mkdirSync,copyFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);
import {startOnce,runChild,classifyStartOutput,readOnlyDiagnosis,inspectLocalUi,createFence,removeFence,formatDesktopResult} from '../scripts/desktop-control.mjs';
function fixture(fn){const root=mkdtempSync(join(tmpdir(),'companion-desktop-test-'));return Promise.resolve().then(()=>fn(root)).finally(()=>rmSync(root,{recursive:true,force:true}));}
test('official gate and no-browser start are dispatched once, and confirmed success clears the fence',()=>fixture(async dir=>{let calls=0;const result=await startOnce({stateDirectory:dir,node:'fixture-node',projectRoot:'/fixture/project',run:async(node,args,options)=>{calls++;assert.equal(node,'fixture-node');assert.deepEqual(args,[join('/fixture/project','scripts','runtime-gate.mjs'),'host-start','--',join('/fixture/project','scripts','start-companion.mjs'),'--no-browser']);assert.equal(options.cwd,'/fixture/project');assert.equal(existsSync(join(dir,'startup.pending')),true);return {code:0,signal:null}}});assert.deepEqual(result,{state:'ready'});assert.equal(calls,1);assert.equal(existsSync(join(dir,'startup.pending')),false)}));
test('uncertain exit persists original fence and blocks later requests without dispatch',()=>fixture(async dir=>{let calls=0;const run=async()=>{calls++;return {code:1,signal:null}};assert.equal((await startOnce({stateDirectory:dir,run})).state,'unknown');const original=readFileSync(join(dir,'startup.pending'),'utf8');await assert.rejects(startOnce({stateDirectory:dir,run}),/START_ALREADY_UNCONFIRMED/);assert.equal(readFileSync(join(dir,'startup.pending'),'utf8'),original);assert.equal(calls,1)}));
test('writes only an allowlisted reason bound to the unchanged original fence',()=>fixture(async dir=>{
 const secret='token-and-raw-private-data',stderr=`${JSON.stringify({gate:'passed',command:[secret]})}\nCompanion Next readiness unconfirmed [ACCOUNT_PROVIDER_UNCONFIRMED]. No restart or retry was issued; an unconfirmed daemon may still be starting.\n${secret}`
 assert.deepEqual(await startOnce({stateDirectory:dir,run:async()=>({code:1,signal:null,stderr})}),{state:'unknown'})
 const pending=JSON.parse(readFileSync(join(dir,'startup.pending'),'utf8')),names=readdirSync(dir).filter(name=>name.endsWith('.diagnostic.json'));assert.deepEqual(names,[`startup-${pending.id}.diagnostic.json`])
 const text=readFileSync(join(dir,names[0]),'utf8'),record=JSON.parse(text);assert.deepEqual(Object.keys(record).sort(),['at','exitCode','id','reason','schemaVersion','stage','state'].sort());assert.equal(record.id,pending.id);assert.equal(record.reason,'ACCOUNT_PROVIDER_UNCONFIRMED');assert.equal(record.stage,'startup');assert.equal(text.includes(secret),false)
}));
test('changed original fence cannot receive a misleading diagnostic',()=>fixture(async dir=>{await startOnce({stateDirectory:dir,run:async()=>{writeFileSync(join(dir,'startup.pending'),'changed');return {code:1,stderr:'private'}}});assert.deepEqual(readdirSync(dir),['startup.pending']);assert.equal(readFileSync(join(dir,'startup.pending'),'utf8'),'changed')}));
test('never turns unknown, malformed or oversized child output into a trusted reason',()=>{assert.deepEqual(classifyStartOutput('{"gate":"blocked","reason":"PACKAGE_LOCK_IDENTITY_MISMATCH"}'),{stage:'runtime-gate',reason:'PACKAGE_LOCK_IDENTITY_MISMATCH'});assert.deepEqual(classifyStartOutput('{"gate":"blocked","reason":"private"}'),{stage:'unknown',reason:'NO_TRUSTED_REASON'});assert.deepEqual(classifyStartOutput('Companion Next startup failed [LOCAL_CONFIG_MISSING]. extra'),{stage:'unknown',reason:'NO_TRUSTED_REASON'});assert.deepEqual(classifyStartOutput('anything',true),{stage:'unknown',reason:'OUTPUT_LIMIT'})});
test('drains real child output without retaining stdout or more than the fixed stderr limit',async()=>{const result=await runChild(process.execPath,['-e',"process.stdout.write('private');process.stderr.write('x'.repeat(40000));process.exitCode=1"],{cwd:process.cwd()});assert.equal(result.code,1);assert.equal(result.truncated,true);assert.equal(result.stderr.length<=32768,true);assert.equal(Object.hasOwn(result,'stdout'),false)});
test('simultaneous clicks share an exclusive durable fence',()=>fixture(async dir=>{let finish,calls=0;const first=startOnce({stateDirectory:dir,run:()=>{calls++;return new Promise(r=>finish=r)}});await assert.rejects(startOnce({stateDirectory:dir,run:async()=>{calls++;return {code:0}}}),/START_ALREADY_UNCONFIRMED/);finish({code:0,signal:null});assert.equal((await first).state,'ready');assert.equal(calls,1)}));
test('a modified original fence is not removed on success',()=>fixture(async dir=>{const result=await startOnce({stateDirectory:dir,run:async()=>{writeFileSync(join(dir,'startup.pending'),'changed');return {code:0,signal:null}}});assert.equal(result.state,'unknown');assert.equal(readFileSync(join(dir,'startup.pending'),'utf8'),'changed')}));
test('read-only diagnosis reports only verified OPEN and hides errors',async()=>{assert.deepEqual(await readOnlyDiagnosis(async()=>({status:{phase:'OPEN'},secret:'not-displayed'}),()=>({state:'missing',reason:'UI_FILES_MISSING'})),{state:'ready',ui:'missing',reason:'UI_FILES_MISSING'});assert.deepEqual(await readOnlyDiagnosis(async()=>({status:{phase:'DRAINING'}})),{state:'unknown',reason:'NOT_READY'});assert.deepEqual(await readOnlyDiagnosis(async()=>{throw Error('private token')}),{state:'unknown',reason:'DIAGNOSIS_UNAVAILABLE'});});
test('fence removal verifies exact original bytes',()=>fixture(async dir=>{const fence=createFence(dir);writeFileSync(fence.file,'other');assert.throws(()=>removeFence(fence),/START_RECORD_CHANGED/);assert.equal(existsSync(fence.file),true)}));

test('packaged controller resolves its project and host from its actual installed location',()=>fixture(async dir=>{
 const project=join(dir,'companion-next'),scripts=join(project,'scripts'),host=join(dir,'cocos-mcp','mcp','dist');mkdirSync(scripts,{recursive:true});mkdirSync(host,{recursive:true});copyFileSync(new URL('../scripts/desktop-control.mjs',import.meta.url),join(scripts,'desktop-control.mjs'));copyFileSync(new URL('../scripts/desktop-recovery.mjs',import.meta.url),join(scripts,'desktop-recovery.mjs'));copyFileSync(new URL('../scripts/desktop-continue.mjs',import.meta.url),join(scripts,'desktop-continue.mjs'));
 writeFileSync(join(scripts,'start-companion.mjs'),"export async function waitForDaemonReadiness(discover) { const client=await discover(); return {status:{phase:client.phase}} }");writeFileSync(join(host,'package.json'),JSON.stringify({type:'module'}));writeFileSync(join(host,'companion-api-client.js'),"export class CompanionApiClient { static async discover(){return {phase:'OPEN'}} }");
 const result=await execFileAsync(process.execPath,[join(scripts,'desktop-control.mjs'),'diagnose'],{cwd:dir});assert.equal(result.stdout.trim(),formatDesktopResult('diagnose',{state:'ready',ui:'unverified',reason:'UI_INSPECTION_UNAVAILABLE'}));
}));

test('OPEN and missing Next file keeps backend ready but does not claim UI ready',()=>fixture(async dir=>{const here=join(dir,'dist','companion'),web=join(here,'web'),status={identity:{entryPath:join(here,'companion-daemon.js')}};mkdirSync(web,{recursive:true});writeFileSync(join(web,'index.html'),'legacy');assert.deepEqual(inspectLocalUi(status),{state:'missing',reason:'UI_FILES_MISSING'});assert.deepEqual(await readOnlyDiagnosis(async()=>({status:{...status,phase:'OPEN'}})),{state:'ready',ui:'missing',reason:'UI_FILES_MISSING'});}));
test('a login or JSON error file is invalid; plausible local HTML is still not HTTP proof',()=>fixture(async dir=>{const here=join(dir,'dist','companion'),web=join(here,'web');mkdirSync(join(web,'next'),{recursive:true});writeFileSync(join(web,'index.html'),'legacy');const file=join(web,'next','index.html'),status={identity:{entryPath:join(here,'companion-daemon.js')}};for(const content of ['{\"error\":\"not found\"}','<!doctype html><html><body>login</body></html>']){writeFileSync(file,content);assert.deepEqual(inspectLocalUi(status),{state:'invalid',reason:'UI_FILES_INVALID'})}writeFileSync(file,'<!doctype html><html><body><div id=\"app\"></div><script type=\"module\" src=\"./assets/app.js\"></script></body></html>');assert.deepEqual(inspectLocalUi(status),{state:'unverified',reason:'UI_HTTP_UNVERIFIED'});}));
test('authentication failure never probes UI or reports ready',async()=>{let checked=0;const result=await readOnlyDiagnosis(async()=>{throw Object.assign(Error('secret'),{code:'DAEMON_AUTH_REJECTED'})},()=>{checked++;return {state:'ready'}});assert.deepEqual(result,{state:'unknown',reason:'DAEMON_AUTH_REJECTED'});assert.equal(checked,0)});

test('Windows panel accepts only one versioned business line, ignoring gate banners',async()=>{
 const ready=formatDesktopResult('diagnose',{state:'ready',ui:'unverified',reason:'UI_HTTP_UNVERIFIED'}),missing=formatDesktopResult('start',{state:'ready',ui:'missing',reason:'UI_FILES_MISSING',start:'confirmed'}),unknown=formatDesktopResult('diagnose',{state:'unknown',reason:'DAEMON_AUTH_REJECTED'});
 const banner=JSON.stringify({lane:'host-start',execPath:'C:/Program Files/nodejs/node.exe',nodeVersion:'v25.2.1',modulesAbi:'141',project:'D:/code/shidai3/P8000/companion-next',packageVersion:'1.3.202',packageSha256:'437e019fec1b3809ce3b7ff92d756aaf88c73f8f7a976e3b7c30bdd6dee78fb0',lockSha256:'bf6565f9db232c26e577abed798a3aca71647197894546cf96281568c54c6410',lockfileVersion:3,gate:'passed',command:['scripts/start-companion.mjs','--no-browser']});const inputs=[
 {text:formatDesktopResult('recover',{state:'recovered'}),action:'recover',want:'recovered'},
 {text:formatDesktopResult('recover',{state:'unknown'}),action:'recover',want:'unknown'},
 {text:formatDesktopResult('recover',{state:'ready'}),action:'recover',want:null},
  {text:banner+'\r\n'+ready+'\r\n',action:'diagnose',want:'ready'},
  {text:banner+'\n'+missing+'\n',action:'start',want:'ready'},
  {text:banner+'\n'+unknown,action:'diagnose',want:'unknown'},
  {text:banner,action:'diagnose',want:null},
  {text:ready+'\n'+ready,action:'diagnose',want:null},
  {text:'COMPANION_DESKTOP_RESULT_V1:{oops}\n'+ready,action:'diagnose',want:null},
  {text:ready,action:'start',want:null},
  {text:formatDesktopResult('start',{state:'ready',ui:'missing',reason:'UI_FILES_MISSING'}),action:'start',want:null},
  {text:formatDesktopResult('diagnose',{state:'ready',ui:'ready',reason:'UI_HTTP_UNVERIFIED'}),action:'diagnose',want:null},
  {text:formatDesktopResult('diagnose',{state:'unknown',reason:'secret'}),action:'diagnose',want:null},
  {text:formatDesktopResult('diagnose',{state:'ready',ui:'missing',reason:'UI_FILES_MISSING',extra:'secret'}),action:'diagnose',want:null},
  {text:'prefix '+ready,action:'diagnose',want:null},
  {text:'COMPANION_DESKTOP_RESULT_V1:{\"schemaVersion\":\"companion-desktop-result-v1\",\"action\":\"diagnose\",\"state\":\"unknown\",\"state\":\"ready\",\"ui\":\"missing\",\"reason\":\"UI_FILES_MISSING\"}',action:'diagnose',want:null},
 ];
 const protocol=join(process.cwd(),'scripts','desktop-protocol.ps1');const script=". $env:DESKTOP_PROTOCOL_PATH; $items=ConvertFrom-Json -InputObject $env:DESKTOP_PROTOCOL_CASES; $rows=@(foreach($item in $items){$r=Read-DesktopResult $item.text $item.action; if($null -eq $r){'NULL'}else{$r.state}}); ConvertTo-Json -InputObject $rows -Compress";
 const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,DESKTOP_PROTOCOL_PATH:protocol,DESKTOP_PROTOCOL_CASES:JSON.stringify(inputs)}});assert.deepEqual(JSON.parse(stdout),inputs.map(x=>x.want??'NULL'));
});

test('wrapper exit is not held hostage by inherited descendant pipes',async()=>{
 const {runExclusive}=await import('../scripts/desktop-control.mjs');
 const code="require('node:child_process').spawn(process.execPath,['-e','setTimeout(()=>{},2000)'],{stdio:['ignore',1,2],detached:true}).unref();console.log('done');";
 const begin=Date.now();const result=await runExclusive(process.execPath,['-e',code]);assert.equal(result.code,0);assert.match(result.stdout,/done/);assert.ok(Date.now()-begin<1800);
});
