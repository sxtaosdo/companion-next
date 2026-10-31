import {readFileSync,lstatSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,existsSync,realpathSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=()=>{throw Error('START_RECOVERY_UNCONFIRMED')};
// This primitive requires its caller to hold the same OS mutex as start.
// It never launches a service or changes the historical outcome to success.
export async function recoverLocalStart({directory,observe,locked,now=Date.now,delay=ms=>new Promise(r=>setTimeout(r,ms))}){
 if(locked!==true||typeof observe!=='function')fail();
 for(let p=resolve(directory);;p=dirname(p)){if(lstatSync(p).isSymbolicLink()||resolve(realpathSync(p)).toLowerCase()!==p.toLowerCase())fail();if(dirname(p)===p)break;}
 const file=join(directory,'startup.pending'),s=lstatSync(file);
 if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>4096)fail();
 const bytes=readFileSync(file),record=JSON.parse(bytes.toString('utf8'));
 if(record.schemaVersion!=='desktop-start-v1'||!/^[a-f0-9-]{36}$/.test(record.id)||!Number.isFinite(Date.parse(record.at)))fail();
 const at=Date.parse(record.at);if(now()-at<300000)fail();
 const verify=o=>{if(o?.schemaVersion!=='desktop-start-observation-v1'||o.complete!==true||o.active!==false||o.portsAbsent!==true||!Number.isFinite(o.bootTime)||o.bootTime<=at||o.bootTime>now()||typeof o.machine!=='string'||!o.machine||typeof o.bootIdentity!=='string'||!o.bootIdentity)fail();};
 const first=await observe();verify(first);await delay(1000);const second=await observe();verify(second);
 if(first.machine!==second.machine||first.bootIdentity!==second.bootIdentity||first.bootTime!==second.bootTime||hash(readFileSync(file))!==hash(bytes))fail();
 const proof={schemaVersion:'desktop-start-recovery-v1',id:record.id,originalSha256:hash(bytes),historicalOutcome:'unknown',currentObservation:'no-controlled-local-start-activity-after-reboot',at:new Date(now()).toISOString(),observations:[first,second]};
 const archive=join(directory,`startup-${record.id}.pending.archive`);if(existsSync(archive))fail();
 // Each checked attempt has its own receipt. If a crash precedes the rename,
 // retry retains the old receipt and repeats all observations instead of
 // being permanently blocked by an already-written proof file.
 const target=join(directory,`startup-${record.id}.${randomUUID()}.recovery.json`);let fd;
 try{fd=openSync(target,'wx',0o600);writeFileSync(fd,JSON.stringify(proof));fsyncSync(fd);}finally{if(fd!==undefined)closeSync(fd);}
 // Rename preserves every original byte. A crash leaves either the pending
 // record or its archive; the receipt never authorizes automatic replay.
 if(hash(readFileSync(file))!==hash(bytes))fail();
 renameSync(file,archive);
 return {state:'recovered',historicalOutcome:'unknown',automaticStart:false};
}
