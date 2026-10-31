import {readFileSync,lstatSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,existsSync,realpathSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const save=(p,v)=>{let fd;try{fd=openSync(p,'wx',0o600);writeFileSync(fd,JSON.stringify(v));fsyncSync(fd)}finally{if(fd!==undefined)closeSync(fd)}};
const fail=()=>{throw Error('CONTINUATION_UNCONFIRMED')};
function read(p){const s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>8192)fail();return readFileSync(p)}
// Caller holds the shared Windows mutex. Account observation never starts it.
export async function continueAccountReady({directory,locked,observe,start,now=()=>new Date().toISOString()}){
 if(locked!==true)fail();
 for(let p=resolve(directory);;p=dirname(p)){if(lstatSync(p).isSymbolicLink()||resolve(realpathSync(p)).toLowerCase()!==p.toLowerCase())fail();if(dirname(p)===p)break;}
 const pendingPath=join(directory,'startup.pending'),bytes=read(pendingPath),pending=JSON.parse(bytes);
 if(pending.schemaVersion!=='desktop-start-v1'||!/^[a-f0-9-]{36}$/.test(pending.id))fail();
 const diagnostic=JSON.parse(read(join(directory,`startup-${pending.id}.diagnostic.json`)));
 if(diagnostic.schemaVersion!=='desktop-start-diagnostic-v1'||diagnostic.id!==pending.id||diagnostic.state!=='unknown'||diagnostic.stage!=='startup'||diagnostic.reason!=='ACCOUNT_PROVIDER_UNCONFIRMED'||diagnostic.exitCode!==1||diagnostic.signal)fail();
 let prefix=`startup-${pending.id}.continuation`;
 const firstIntent=join(directory,prefix+'.intent.json');
 if(existsSync(firstIntent)){
  const audit=JSON.parse(read(join(directory,prefix+'.recovery.json')));
  if(audit.schemaVersion!=='desktop-continuation-recovery-v1'||audit.id!==pending.id||audit.state!=='retry-available'||audit.originalSha256!==sha(bytes)||audit.intentSha256!==sha(read(firstIntent))||audit.resultSha256!==sha(read(join(directory,prefix+'.result.json'))))fail();
  prefix+='-2';
 }
 const intentPath=join(directory,prefix+'.intent.json');if(existsSync(intentPath))fail();
 const first=await observe(),second=await observe();
 const valid=o=>o?.healthy===true&&o.noStartingProcess===true&&Number.isSafeInteger(o.pid)&&o.pid>0&&typeof o.creation==='string'&&o.creation.length>0;
 if(!valid(first)||!valid(second)||JSON.stringify(first)!==JSON.stringify(second)||sha(read(pendingPath))!==sha(bytes))fail();
 save(intentPath,{schemaVersion:'desktop-account-continuation-v1',id:pending.id,at:now(),originalSha256:sha(bytes),historicalOutcome:'unknown',account:first});
 let result;
 try{result=await start(first);if(result?.state!=='ready')fail()}catch(error){const codes=new Set(['OFFICIAL_START_UNCONFIRMED','OFFICIAL_START_FAILED','OFFICIAL_START_PORT_OCCUPIED','DAEMON_READINESS_UNCONFIRMED','DAEMON_IDENTITY_UNVERIFIED','DAEMON_DISCOVERY_UNCONFIRMED','DAEMON_AUTH_REJECTED','DAEMON_START_IDENTITY_CHANGED','ACCOUNT_CHANGED','CONTINUATION_UNCONFIRMED']);const code=codes.has(error?.code)?error.code:codes.has(error?.message)?error.message:'UNCLASSIFIED_FAILURE';const reasons=new Set(['cli-timeout','cli-error','cli-protocol','cli-readiness-deadline','child-exited','port-occupied','executable-unavailable','startup-budget-exhausted','deadline','connection-not-yet-ready']);save(join(directory,prefix+'.result.json'),{state:'unknown',id:pending.id,at:now(),code,...(reasons.has(error?.reason)?{reason:error.reason}:{}),...(reasons.has(error?.officialReason)?{officialReason:error.officialReason}:{}),...(Number.isSafeInteger(error?.exitCode)?{exitCode:error.exitCode}:{})});return {state:'unknown'}}
 save(join(directory,prefix+'.result.json'),{state:'ready',id:pending.id,at:now(),historicalOutcome:'unknown',pid:result.pid});
 if(sha(read(pendingPath))!==sha(bytes))fail();
 const archive=join(directory,`startup-${pending.id}.pending.archive`);if(existsSync(archive))fail();renameSync(pendingPath,archive);
 return {state:'ready'};
}

// Read-only settlement of the first unknown continuation. A retry is a separate
// explicit action; none of the original intent/result bytes are rewritten.
export async function inspectContinuation({directory,locked,query,observe,delay=ms=>new Promise(r=>setTimeout(r,ms)),now=()=>new Date().toISOString()}){
 if(locked!==true)fail();for(let p=resolve(directory);;p=dirname(p)){if(lstatSync(p).isSymbolicLink()||resolve(realpathSync(p)).toLowerCase()!==p.toLowerCase())fail();if(dirname(p)===p)break;}
 const pendingPath=join(directory,'startup.pending'),bytes=read(pendingPath),pending=JSON.parse(bytes);if(pending.schemaVersion!=='desktop-start-v1'||!/^[a-f0-9-]{36}$/.test(pending.id))fail();
 const prefix=`startup-${pending.id}.continuation`,intentBytes=read(join(directory,prefix+'.intent.json')),resultBytes=read(join(directory,prefix+'.result.json')),intent=JSON.parse(intentBytes),result=JSON.parse(resultBytes);
 if(intent.schemaVersion!=='desktop-account-continuation-v1'||intent.id!==pending.id||intent.originalSha256!==sha(bytes)||result.id!==pending.id||result.state!=='unknown'||!Number.isFinite(Date.parse(result.at))||Date.parse(now())-Date.parse(result.at)<60000)fail();
 const verifyOriginal=()=>{if(sha(read(pendingPath))!==sha(bytes)||sha(read(join(directory,prefix+'.intent.json')))!==sha(intentBytes)||sha(read(join(directory,prefix+'.result.json')))!==sha(resultBytes))fail()};
 const firstQuery=await query();
 if(firstQuery?.state==='ready'&&Number.isSafeInteger(firstQuery.pid)&&firstQuery.pid>0){verifyOriginal();save(join(directory,prefix+'.settled.json'),{schemaVersion:'desktop-continuation-settled-v1',id:pending.id,historicalOutcome:'unknown',state:'ready',pid:firstQuery.pid,at:now()});const archive=join(directory,`startup-${pending.id}.pending.archive`);if(existsSync(archive))fail();renameSync(pendingPath,archive);return {state:'ready'}}
 if(firstQuery?.state!=='absent')fail();
 if(existsSync(join(directory,prefix+'-2.intent.json')))fail();
 const valid=o=>o?.complete===true&&o.noStartingProcess===true&&o.daemonAbsent===true&&o.healthy===true&&Number.isSafeInteger(o.pid)&&o.pid>0&&typeof o.creation==='string';
 const first=await observe();if(!valid(first))fail();await delay(1000);const second=await observe();if(!valid(second)||JSON.stringify(first)!==JSON.stringify(second)||(await query())?.state!=='absent')fail();verifyOriginal();
 const auditPath=join(directory,prefix+'.recovery.json');
 if(existsSync(auditPath)){const audit=JSON.parse(read(auditPath));if(audit.schemaVersion!=='desktop-continuation-recovery-v1'||audit.id!==pending.id||audit.state!=='retry-available'||audit.originalSha256!==sha(bytes)||audit.intentSha256!==sha(intentBytes)||audit.resultSha256!==sha(resultBytes))fail()}
 else save(auditPath,{schemaVersion:'desktop-continuation-recovery-v1',id:pending.id,state:'retry-available',historicalOutcome:'unknown',at:now(),originalSha256:sha(bytes),intentSha256:sha(intentBytes),resultSha256:sha(resultBytes),observations:[first,second]});
 return {state:'retry-available'};
}
