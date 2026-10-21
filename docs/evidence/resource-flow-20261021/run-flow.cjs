const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=__dirname, py='C:/Users/33272/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const api='D:/code/shidai3/P9000/ai-game-studio/project/tools/local-icons/companion_api.py';
const project={id:'aabbccddeeff0011',path:path.join(root,'project')},store=path.join(root,'store');
const {IconResourceConfigs,IconImageAssets,iconCanonicalJson}=require('./installed-classes.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=[];const record=(stage,detail)=>{results.push({stage,status:'ACTUAL_PASS',detail});fs.writeFileSync(path.join(root,'records','results.json'),JSON.stringify(results,null,2));console.log(stage,'PASS');};
function run(file,args,options={}){const x=cp.spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout:20000,...options});if(x.error||x.status!==0)throw Error(x.error?.message||x.stderr||'process failed');return x.stdout.trim();}
function git(args){return run('git',['-C',project.path,...args]);}
function studio(op,body,extra=[]){const raw=run(py,['-B',api,'--operation',op,'--project',project.path,'--project-id',project.id,'--store',store,'--offline-import-only',...extra],{input:JSON.stringify(body),env:{...process.env,PYTHONDONTWRITEBYTECODE:'1',PYTHONUTF8:'1'}});const value=JSON.parse(raw);fs.writeFileSync(path.join(root,'records',op+'.json'),JSON.stringify(value,null,2));return value;}
(async()=>{
 for(const sub of ['assets/icons','art/reference','settings/v2/packages'])fs.mkdirSync(path.join(project.path,sub),{recursive:true});
 fs.writeFileSync(path.join(project.path,'README.md'),'Synthetic offline fixture only; no production project.');
 fs.writeFileSync(path.join(project.path,'settings/v2/packages/project.json'),JSON.stringify({general:{designResolution:{width:750,height:1334}}}));
 git(['init','--quiet']);git(['add','README.md','settings']);git(['-c','user.name=Offline Test','-c','user.email=offline@example.invalid','-c','core.hooksPath=NUL','commit','--quiet','-m','Synthetic fixture baseline']);
 const revision=git(['rev-parse','HEAD']);assert.match(revision,/^[0-9a-f]{40}$/);record('isolated_git_head',{revision,registeredToHost:false});
 const generated=JSON.parse(run(py,['-B',path.join(root,'make-fixture.py')]));
 const png=fs.readFileSync(generated.sourcePath);assert.equal(sha(png),generated.sha256);
 fs.copyFileSync(generated.sourcePath,path.join(project.path,'art/reference/synthetic-reference.png'));
 record('synthetic_png',{...generated,modelGenerated:false});
 const images=new IconImageAssets({pythonPath:py,storePath:store});
 const resources=new IconResourceConfigs(store,(p,refs)=>images.snapshotReferences(p,refs));
 const missing=await resources.read(project);assert.equal(missing.state,'missing');assert.equal(missing.hash,null);assert.equal(missing.draft.iconSize.width,0);record('missing_draft',{state:missing.state,detected:missing.detected});
 const config={...missing.draft,iconSize:{width:96,height:96},style:{description:'Synthetic CPU test only; not model-generated.',references:['art/reference/synthetic-reference.png']}};
 const saved=await resources.save(project,{config,expectedHash:null,approved:true});assert.equal(saved.state,'valid');assert.equal(saved.version,1);
 const reread=await new IconResourceConfigs(store).read(project);assert.deepEqual(reread.config,saved.config);assert.equal(reread.hash,saved.hash);assert.equal(sha(fs.readFileSync(path.join(project.path,saved.relativePath))),saved.hash);record('save_reread',{relativePath:saved.relativePath,version:saved.version,hash:saved.hash});
 await assert.rejects(()=>resources.save(project,{config,expectedHash:null,approved:true}),e=>e.code==='RESOURCE_CONFIG_STALE');record('stale_save_rejected',{code:'RESOURCE_CONFIG_STALE'});
 const request={schemaVersion:'local-icon-requests-v1',projectId:project.id,runId:'STUDIO-RUN-offline-fixture-deadbeef',sourceRevision:revision,visualSpec:'Synthetic offline validation; no generation.',assets:[{assetId:'synthetic-offline-icon',relativePath:'assets/icons/synthetic-offline-icon.png',prompt:'Synthetic offline fixture only; never submit generation.',purpose:'Offline protocol validation',required:true}]};
 const binding={version:saved.version,hash:saved.hash,presetId:'default'};
 const prepared=await resources.prepare(project,request,binding,true);fs.writeFileSync(path.join(root,'records','prepared.json'),JSON.stringify(prepared,null,2));
 const capsule=await resources.snapshot({projectId:project.id,jobId:request.runId,sourceRevision:revision,requestHash:sha(iconCanonicalJson(prepared))});assert.equal(capsule.state,'sealed');assert.equal(capsule.referenceSnapshots[0].sha256,generated.sha256);record('prepare_sealed',{hash:capsule.hash,referenceSnapshots:capsule.referenceSnapshots,referencesAsModelInput:false});
 const inspect=studio('inspect',{request:prepared});assert.equal(inspect.ok,true);assert.deepEqual(inspect.data.gap.requiredMissing,['synthetic-offline-icon']);record('studio_inspect',{gap:inspect.data.gap});
 for(const op of ['enqueue','run-next','resume']){const value=studio(op,{});assert.equal(value.ok,false);assert.equal(value.error.code,'GENERATION_DISABLED');record(op+'_offline_rejected',{code:value.error.code});}
 const manifest={schemaVersion:'local-icon-adoption-manifest-v1',sources:[{sourceId:'synthetic-test',sourcePath:generated.sourcePath,fileSha256:generated.sha256,provenance:{generator:'synthetic-cpu-test-not-generated',sourceProjectId:null,sourceRunId:null,sourceRevision:null,sourceCandidateId:null,sourceArtifactSha256:null,sourcePromptId:null},evidence:[]}]};
 const manifestPath=path.join(root,'sources','synthetic-manifest-not-eligible.json');fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
 const adoption=studio('adopt',{request:prepared,sourceId:'synthetic-test',approved:true},['--adoption-manifest',manifestPath]);assert.equal(adoption.ok,false);assert.equal(adoption.error.code,'ADOPTION_SOURCE_INVALID');record('synthetic_adoption_rejected',{code:adoption.error.code,reason:'Synthetic is not existing comfyui-local provenance; no attribution falsified.'});
 const options={base64:png.toString('base64'),sourceSha256:generated.sha256,assetId:'synthetic-cpu-only',width:96,height:96,directory:'art/final/companion',transparent:true,color:'#ffffff',allowUpscale:false,expectedTargetSha256:null};
 const exported=await images.exportVariant(project,options);assert.equal(exported.created,true);const bytes=fs.readFileSync(path.join(project.path,exported.relativePath));assert.equal(sha(bytes),exported.sha256);
 const again=await images.exportVariant(project,options);assert.equal(again.created,false);assert.equal(again.sha256,exported.sha256);record('cpu_export_actual_not_task_export',{...exported,bindingAbsent:true,sameBytesReused:true});
 const collision={...options,assetId:'collision-test'};const collisionPath=path.join(project.path,options.directory,`collision-test-96x96-${generated.sha256.slice(0,12)}.png`);fs.writeFileSync(collisionPath,'Existing test-owned sentinel; do not overwrite.');const before=sha(fs.readFileSync(collisionPath));await assert.rejects(()=>images.exportVariant(project,collision),e=>e.code==='OVERWRITE_FORBIDDEN');assert.equal(sha(fs.readFileSync(collisionPath)),before);record('cpu_no_overwrite',{code:'OVERWRITE_FORBIDDEN',sentinelHash:before});
 const receiptDir=path.join(store,'companion-variant-receipts',project.id),receiptNames=fs.readdirSync(receiptDir);assert.equal(receiptNames.length,1);const receiptPath=path.join(receiptDir,receiptNames[0]),receiptBytes=fs.readFileSync(receiptPath),receipt=JSON.parse(receiptBytes);assert.equal(receipt.sha256,exported.sha256);assert.equal(receipt.sourceSha256,generated.sha256);assert.equal(receipt.runtimeImported,false);record('cpu_receipt_readback',{receiptPath,receiptSha256:sha(receiptBytes),schemaVersion:receipt.schemaVersion,runtimeImported:false});
 fs.writeFileSync(path.join(root,'records','output-path.json'),JSON.stringify({path:path.join(project.path,exported.relativePath),sha256:exported.sha256}));
 record('boundaries',{listenersOpened:0,modelRequests:0,hostRegistration:false,productionWrites:0,adoptSelectTaskExport:'BLOCKED_TRUSTED_EXISTING_GENERATED_PNG_AND_MANIFEST_REQUIRED',simulatedStages:[]});
})().catch(e=>{fs.writeFileSync(path.join(root,'records','failure.json'),JSON.stringify({message:e.message,code:e.code,stack:e.stack},null,2));console.error(e);process.exitCode=1;});
