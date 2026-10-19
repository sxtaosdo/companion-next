import {CompanionApiClient} from 'file:///D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion-api-client.js';
import {readFile,writeFile,mkdir,open,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const root='C:/Users/33272/AppData/Local/Temp/companion-reader-denial-diagnosis-20261019',host='D:/code/shidai3/P8000/cocos-mcp',live=host+'/mcp/dist/companion',sha=b=>createHash('sha256').update(b).digest('hex');
const build=JSON.parse(await readFile(root+'/worker-build-proof.json','utf8'));if(!build.baselineByteIdentical)throw Error('BUILD_PROOF_MISSING');
const git=(...args)=>execFileSync('git',['-C',host,'--work-tree='+host,...args],{windowsHide:true,maxBuffer:128*1024*1024});
const state=()=>Object.fromEntries(Object.entries({head:['rev-parse','HEAD'],status:['status','--porcelain=v1','--untracked-files=all'],diff:['diff','--binary'],index:['diff','--cached','--binary']}).map(([k,args])=>[k,sha(git(...args))]));
const client=await CompanionApiClient.discover();if(client.baseUrl!=='http://127.0.0.1:32180')throw Error('ORIGIN_MISMATCH');
const before=await client.request('GET','/v1/daemon/inflight');
const proof={at:new Date().toISOString(),before,build,sharedBefore:state(),credentialConfigChanged:false,credentialReadByAgent:false,restart:false,installed:false};
const registryRoot=join(process.env.APPDATA,'Creator AI Companion'),registries={};for(const name of ['projects.json','tool-presets.json'])registries[name]=sha(await readFile(join(registryRoot,name)));
const guardedFiles=['companion-daemon.js','creator-ai.js'],unchanged={};for(const name of guardedFiles)unchanged[name]=sha(await readFile(join(live,name)));
// Worker requests own short children. Refuse replacement while any counted work or UNKNOWN is present.
if(before.schemaVersion!=='companion-daemon-inflight-v1'||before.phase!=='OPEN'||!before.counts||Object.entries(before.counts).some(([name,n])=>typeof n!=='number'||n<0||n>(name==='http'?1:0))||before.unknown?.length)throw Error('DAEMON_NOT_IDLE');
proof.idleCheck={httpIncludesThisObservation:true,allOtherCountsZero:true,unknownEmpty:true};
await mkdir(root+'/worker-backup');for(const name of ['knowledge-worker.js','knowledge-worker.js.map'])await writeFile(root+'/worker-backup/'+name,await readFile(join(live,name)),{flag:'wx'});
if(sha(await readFile(live+'/knowledge-worker.js'))!==build.baselineSha256)throw Error('WORKER_CHANGED_BEFORE_INSTALL');
async function replace(name,bytes){const stage=join(live,name+'.expiry-stage');const f=await open(stage,'wx');try{await f.writeFile(bytes);await f.sync()}finally{await f.close()}await rename(stage,join(live,name));}
try{
 for(const [name,expected]of [['knowledge-worker.js.map',build.newMapSha256],['knowledge-worker.js',build.newSha256]]){const bytes=await readFile(root+'/candidate/'+name);if(sha(bytes)!==expected)throw Error('CANDIDATE_SHA_MISMATCH');await replace(name,bytes);}
 proof.installed=true;proof.after=await client.request('GET','/v1/daemon/inflight');proof.identityUnchanged=JSON.stringify(proof.before.identity)===JSON.stringify(proof.after.identity);proof.sharedUnchanged=JSON.stringify(state())===JSON.stringify(proof.sharedBefore);
 proof.runtimeUnchanged={};for(const[n,h]of Object.entries(unchanged))proof.runtimeUnchanged[n]=sha(await readFile(join(live,n)))===h;
 proof.registriesUnchanged={};for(const[n,h]of Object.entries(registries))proof.registriesUnchanged[n]=sha(await readFile(join(registryRoot,n)))===h;
 proof.workerSha256=sha(await readFile(live+'/knowledge-worker.js'));proof.workerMapSha256=sha(await readFile(live+'/knowledge-worker.js.map'));
 if(!proof.identityUnchanged||!proof.sharedUnchanged||Object.values(proof.runtimeUnchanged).some(v=>!v)||Object.values(proof.registriesUnchanged).some(v=>!v)||proof.workerSha256!==build.newSha256||proof.workerMapSha256!==build.newMapSha256)throw Error('INSTALL_PRESERVATION_FAILED');proof.ok=true;
}catch(e){proof.error=String(e.message??e);for(const name of ['knowledge-worker.js.map','knowledge-worker.js'])await replace(name,await readFile(root+'/worker-backup/'+name));proof.rolledBack=true;}
finally{await writeFile(root+'/worker-deployment.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));if(!proof.ok)process.exitCode=1;}
