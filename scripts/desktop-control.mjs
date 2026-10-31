import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,openSync,writeFileSync,closeSync,fsyncSync,readFileSync,unlinkSync,lstatSync,realpathSync,statSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {recoverLocalStart} from './desktop-recovery.mjs';
import {continueAccountReady,inspectContinuation} from './desktop-continue.mjs';
import http from 'node:http';
const execFileAsync=promisify(execFile);
const powershell='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const safeParent=(directory)=>{mkdirSync(directory,{recursive:true});for(let p=resolve(directory);;p=dirname(p)){const s=lstatSync(p);if(s.isSymbolicLink())throw Error('UNSAFE_STATE_DIRECTORY');const real=realpathSync(p);if(resolve(real).toLowerCase()!==p.toLowerCase())throw Error('UNSAFE_STATE_DIRECTORY');if(dirname(p)===p)break;}};
const digest=s=>createHash('sha256').update(s).digest('hex');
export function createFence(directory){safeParent(directory);const file=join(directory,'startup.pending'),id=randomUUID(),content=JSON.stringify({schemaVersion:'desktop-start-v1',id,at:new Date().toISOString()});let fd;try{fd=openSync(file,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('START_ALREADY_UNCONFIRMED');throw e;}try{writeFileSync(fd,content);fsyncSync(fd); }finally{closeSync(fd);}return {file,id,digest:digest(content)};}
function assertFence(fence){const s=lstatSync(fence.file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||digest(readFileSync(fence.file))!==fence.digest)throw Error('START_RECORD_CHANGED');}
export function removeFence(fence){assertFence(fence);unlinkSync(fence.file);}
const OUTPUT_LIMIT=32*1024;
const GATE_REASONS=new Set(['RUNTIME_VERSION_INVALID','HOST_START_REQUIRES_NODE_25_ABI_141','PACKAGE_LOCK_IDENTITY_MISMATCH','PACKAGE_LOCK_DEPENDENCY_MISMATCH','UNKNOWN_RUNTIME_LANE']);
const START_REASONS=new Set(['ACCOUNT_PROVIDER_UNCONFIRMED','LOCAL_CONFIG_MISSING','LOCAL_CONFIG_UNREADABLE','LOCAL_CONFIG_FILE_INVALID','LOCAL_CONFIG_JSON_INVALID','LOCAL_CONFIG_KEYS_INVALID','LOCAL_CONFIG_VALUE_INVALID','LOCAL_CONFIG_PATH_INVALID','LOCAL_CONFIG_MODE_INVALID','LOCAL_CONFIG_BINDING_NOT_APPROVED','INCOMPLETE_DAEMON_OVERRIDE','UNEXPECTED_DAEMON_URL','OFFICIAL_START_UNCONFIRMED','OFFICIAL_START_FAILED','OFFICIAL_START_PORT_OCCUPIED','DAEMON_READINESS_UNCONFIRMED','DAEMON_IDENTITY_UNVERIFIED','DAEMON_DISCOVERY_UNCONFIRMED','DAEMON_AUTH_REJECTED','DAEMON_START_IDENTITY_CHANGED','LOCAL_START_UNCONFIRMED']);
// Only publish fixed, non-secret reason codes. Child text and gate metadata never reach disk or UI.
export function classifyStartOutput(stderr,truncated=false){
 if(truncated)return {stage:'unknown',reason:'OUTPUT_LIMIT'};
 for(const line of stderr.split(/\r?\n/)){try{const value=JSON.parse(line);if(value?.gate==='blocked'&&GATE_REASONS.has(value.reason))return {stage:'runtime-gate',reason:value.reason};}catch{}}
 for(const line of stderr.split(/\r?\n/)){const match=/^Companion Next (?:startup failed|readiness unconfirmed) \[([A-Z_]+)\](?: \([^\r\n]*\))?\. No restart or retry was issued; an unconfirmed daemon may still be starting\.$/.exec(line);if(match&&START_REASONS.has(match[1]))return {stage:'startup',reason:match[1]};}
 return {stage:'unknown',reason:'NO_TRUSTED_REASON'};
}
function saveDiagnostic(fence,result){
 const reason=classifyStartOutput(typeof result.stderr==='string'?result.stderr:'',result.truncated===true),record={schemaVersion:'desktop-start-diagnostic-v1',id:fence.id,at:new Date().toISOString(),state:'unknown',...reason,...(Number.isSafeInteger(result.code)?{exitCode:result.code}:{}),...(result.signal?{signal:'TERMINATED'}:{})};
 safeParent(dirname(fence.file));assertFence(fence);const target=join(dirname(fence.file),`startup-${fence.id}.diagnostic.json`);let fd;try{fd=openSync(target,'wx',0o600);writeFileSync(fd,JSON.stringify(record));fsyncSync(fd);}finally{if(fd!==undefined)closeSync(fd);}
}
export function runChild(executable,args,options){return new Promise((done,reject)=>{const child=spawn(executable,args,{cwd:options.cwd,windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});let stderr='',bytes=0,truncated=false;child.stdout.on('data',()=>{});child.stderr.on('data',chunk=>{const value=Buffer.from(chunk);bytes+=value.length;if(bytes>OUTPUT_LIMIT){truncated=true;return}stderr+=value.toString('utf8');});child.once('error',reject);child.once('close',(code,signal)=>done({code,signal,stderr,truncated}));});}
export async function startOnce({stateDirectory,node=process.execPath,projectRoot=root,run=runChild}){const fence=createFence(stateDirectory);let dispatched=false;try{const pending=run(node,[join(projectRoot,'scripts','runtime-gate.mjs'),'host-start','--',join(projectRoot,'scripts','start-companion.mjs'),'--no-browser'],{cwd:projectRoot});dispatched=true;const result=await pending;if(result.code!==0||result.signal){try{saveDiagnostic(fence,result)}catch{}return {state:'unknown'};}removeFence(fence);return {state:'ready'};}catch{if(!dispatched){try{removeFence(fence);}catch{}}else{try{saveDiagnostic(fence,{})}catch{}}return {state:'unknown'};}}
export function inspectLocalUi(status){
 try{const entry=status?.identity?.entryPath;if(typeof entry!=='string'||!entry)throw Error();const here=dirname(entry),candidates=[join(here,'web'),resolve(here,'../../..','web'),resolve(here,'../..','web')];let root;
  for(const candidate of candidates){try{if(statSync(join(candidate,'index.html')).isFile()){root=candidate;break;}}catch(error){if(error.code!=='ENOENT')throw error;}}
  root??=candidates[0];const target=join(root,'next','index.html');let stat;try{stat=statSync(target)}catch(error){if(error.code==='ENOENT')return {state:'missing',reason:'UI_FILES_MISSING'};throw error;}
  if(!stat.isFile()||stat.size>1024*1024)return {state:'invalid',reason:'UI_FILES_INVALID'};const html=readFileSync(target,'utf8');if(!/^\s*<!doctype\s+html\b/i.test(html)||!/<div\s+id=["']app["']/i.test(html)||!/<script\s+type=["']module["']/i.test(html))return {state:'invalid',reason:'UI_FILES_INVALID'};
  // Static bytes on disk do not prove authenticated HTTP access or asset loading.
  return {state:'unverified',reason:'UI_HTTP_UNVERIFIED'};
 }catch{return {state:'unverified',reason:'UI_INSPECTION_UNAVAILABLE'};}
}
export async function readOnlyDiagnosis(readiness,uiCheck=inspectLocalUi){let observed;try{observed=await readiness();if(observed?.status?.phase!=='OPEN')return {state:'unknown',reason:'NOT_READY'};}catch(error){const allowed=['DAEMON_AUTH_REJECTED','DAEMON_IDENTITY_UNVERIFIED','DAEMON_START_IDENTITY_CHANGED','DAEMON_NOT_READY','UNEXPECTED_DAEMON_URL','DAEMON_READINESS_UNCONFIRMED','DAEMON_DISCOVERY_UNCONFIRMED'];return {state:'unknown',reason:allowed.includes(error?.code)?error.code:'DIAGNOSIS_UNAVAILABLE'};}try{const ui=await uiCheck(observed.status);return {state:'ready',ui:['missing','invalid','unverified','ready'].includes(ui?.state)?ui.state:'unverified',reason:['UI_FILES_MISSING','UI_FILES_INVALID','UI_HTTP_UNVERIFIED','UI_INSPECTION_UNAVAILABLE'].includes(ui?.reason)?ui.reason:'UI_HTTP_UNVERIFIED'};}catch{return {state:'ready',ui:'unverified',reason:'UI_INSPECTION_UNAVAILABLE'};}}
export function formatDesktopResult(action,result){return 'COMPANION_DESKTOP_RESULT_V1:'+JSON.stringify({schemaVersion:'companion-desktop-result-v1',action,...result});}
function emit(action,result){console.log(formatDesktopResult(action,result));}
async function main(){const [action,internal]=process.argv.slice(2);if(!['start','diagnose','recover','continue','inspect-continuation'].includes(action)||process.argv.length>(internal?4:3)||internal&&internal!=='--mutex-held')throw Error('INVALID_ACTION');
 if(['start','recover','continue','inspect-continuation'].includes(action)&&!internal){const result=await runExclusive(powershell,['-NoProfile','-NonInteractive','-File',join(root,'scripts','desktop-exclusive.ps1'),'-Action',action]);process.stdout.write(result.stdout);if(result.code!==0)process.exitCode=1;return;}
 if(internal){await execFileAsync(powershell,['-NoProfile','-NonInteractive','-File',join(root,'scripts','desktop-verify-lock.ps1'),'-OwnerPid',String(process.ppid)],{windowsHide:true,timeout:10000,maxBuffer:1024});}
 if(action==='inspect-continuation'){
 const directory=join(process.env.LOCALAPPDATA||'', 'CompanionNext','desktop-launch');if(!process.env.LOCALAPPDATA)throw Error('STATE_DIRECTORY_UNAVAILABLE');
 const query=async()=>{const reachable=await new Promise((done,reject)=>{const q=http.get('http://127.0.0.1:32180/',r=>{r.resume();done(true)});q.setTimeout(3000,()=>q.destroy(Error('DAEMON_QUERY_TIMEOUT')));q.on('error',e=>e.code==='ECONNREFUSED'?done(false):reject(e))});if(!reachable)return {state:'absent'};const {waitForDaemonReadiness}=await import('./start-companion.mjs');const {CompanionApiClient}=await import(pathToFileURL(resolve(root,'../cocos-mcp/mcp/dist/companion-api-client.js')).href);const r=await waitForDaemonReadiness(()=>CompanionApiClient.discover(),{timeoutMs:3000});return {state:'ready',pid:r.status.identity.pid}};
 const observe=async()=>{const account=await observeAccount();const {stdout}=await execFileAsync(powershell,['-NoProfile','-NonInteractive','-File',join(root,'scripts','desktop-continuation-observation.ps1')],{windowsHide:true,timeout:15000,maxBuffer:16384});const current=JSON.parse(stdout);if(account.pid!==current.pid||account.creation!==current.creation)throw Error('ACCOUNT_CHANGED');return {...current,healthy:true}};
 emit(action,await inspectContinuation({directory,locked:true,query,observe}));return;
 }
 if(action==='continue'){
 const directory=join(process.env.LOCALAPPDATA||'', 'CompanionNext','desktop-launch');if(!process.env.LOCALAPPDATA)throw Error('STATE_DIRECTORY_UNAVAILABLE');
 const observe=observeAccount;
 const value=await continueAccountReady({directory,locked:true,observe,start:async(account)=>{const {startupEnvironment,startCompanion,officialStart}=await import('./start-companion.mjs');const env=startupEnvironment();const {CompanionApiClient}=await import(pathToFileURL(resolve(root,'../cocos-mcp/mcp/dist/companion-api-client.js')).href);const result=await startCompanion({noBrowser:true},{ensureAuth:async()=>{if(JSON.stringify(await observe())!==JSON.stringify(account))throw Error('ACCOUNT_CHANGED')},start:()=>officialStart(env),discover:()=>CompanionApiClient.discover()});return {state:'ready',pid:result.pid}}});emit(action,value);return;
 }
 if(action==='recover'){const directory=join(process.env.LOCALAPPDATA||'', 'CompanionNext','desktop-launch');if(!process.env.LOCALAPPDATA)throw Error('STATE_DIRECTORY_UNAVAILABLE');await recoverLocalStart({directory,locked:true,observe:async()=>{const {stdout}=await execFileAsync(powershell,['-NoProfile','-NonInteractive','-File',join(root,'scripts','desktop-observation.ps1')],{windowsHide:true,timeout:15000,maxBuffer:16384});return JSON.parse(stdout)}});emit(action,{state:'recovered'});return;}
 if(action==='start'){const directory=join(process.env.LOCALAPPDATA||'', 'CompanionNext','desktop-launch');if(!process.env.LOCALAPPDATA)throw Error('STATE_DIRECTORY_UNAVAILABLE');const started=await startOnce({stateDirectory:directory});if(started.state!=='ready'){emit(action,started);return;}try{emit(action,{...await diagnosis(),start:'confirmed'});}catch{emit(action,{state:'unknown',reason:'DIAGNOSIS_UNAVAILABLE',start:'confirmed'});}return;}
 emit(action,await diagnosis());}
async function diagnosis(){const host=resolve(root,'../cocos-mcp/mcp');const [{waitForDaemonReadiness},{CompanionApiClient}]=await Promise.all([import('./start-companion.mjs'),import(pathToFileURL(join(host,'dist/companion-api-client.js')).href)]);return readOnlyDiagnosis(()=>waitForDaemonReadiness(()=>CompanionApiClient.discover(),{timeoutMs:10000}));}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{const action=process.argv[2];if(['start','diagnose','recover','continue','inspect-continuation'].includes(action))emit(action,{state:'unknown'});process.exitCode=1;});

// A detached grandchild can inherit a pipe after the actual wrapper has exited.
// Observe wrapper exit, then bound pipe draining; never terminate its descendants.
export function runExclusive(executable,args){return new Promise((done,reject)=>{
 const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});let stdout='',bytes=0,overflow=false,settled=false,timer;
 const finish=code=>{if(settled)return;settled=true;clearTimeout(timer);child.stdout.destroy();child.stderr.destroy();done({code,stdout:overflow?'':stdout})};
 child.stdout.on('data',b=>{bytes+=b.length;if(bytes>131072){overflow=true;return}stdout+=b.toString('utf8')});child.stderr.on('data',()=>{});
 child.once('error',e=>{if(!settled){settled=true;reject(e)}});
 child.once('exit',code=>{timer=setTimeout(()=>finish(code),300)});child.once('close',code=>finish(code));
})}

const observeAccount=async()=>{const {stdout}=await execFileAsync(powershell,['-NoProfile','-NonInteractive','-File',join(root,'scripts','desktop-account-observation.ps1')],{windowsHide:true,timeout:15000,maxBuffer:16384});const identity=JSON.parse(stdout);await new Promise((done,reject)=>{const q=http.get('http://127.0.0.1:18001/admin/base/open/eps',r=>{let body='';r.on('data',b=>{body+=b;if(body.length>1048576)q.destroy(Error('BODY_LIMIT'))});r.on('end',()=>{try{if(r.statusCode!==200||JSON.parse(body).code!==1000)throw Error('ACCOUNT_NOT_READY');done()}catch(e){reject(e)}})});q.setTimeout(3000,()=>q.destroy(Error('ACCOUNT_TIMEOUT')));q.on('error',reject)});return {...identity,healthy:true}};
