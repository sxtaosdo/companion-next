const fs=require("node:fs"),path=require("node:path"),cp=require("node:child_process"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const root=__dirname,python="C:/ai/ComfyUI/py/python.exe",project={id:"aabbccddeeff0011",path:path.join(root,"project")},store=path.join(root,"store"),sha=b=>crypto.createHash("sha256").update(b).digest("hex");
const {IconImageAssets}=require("./installed-classes.cjs");
function execute(args,input){const x=cp.spawnSync(python,["-B",...args],{input,encoding:"utf8",windowsHide:true,timeout:20000,env:{...process.env,PYTHONDONTWRITEBYTECODE:"1",PYTHONUTF8:"1"}});if(x.error||x.status!==0)throw Error(x.error?.message||x.stderr);return JSON.parse(x.stdout);}
(async()=>{
 const environment=execute(["-c","import json,sys,PIL;print(json.dumps(dict(python=sys.executable,version=sys.version,pillow=PIL.__version__)))"]);
 const source=fs.readFileSync(path.join(root,"sources/synthetic-not-generated.png")),sourceSha=sha(source),prepared=JSON.parse(fs.readFileSync(path.join(root,"records/prepared.json"),"utf8"));
 const configPath=path.join(project.path,project.id+".ai-icons.json"),configBefore=sha(fs.readFileSync(configPath));
 const inspect=execute(["D:/code/shidai3/P9000/ai-game-studio/project/tools/local-icons/companion_api.py","--operation","inspect","--project",project.path,"--project-id",project.id,"--store",store,"--offline-import-only"],JSON.stringify({request:prepared}));assert.equal(inspect.ok,true);assert.deepEqual(inspect.data.gap.requiredMissing,["synthetic-offline-icon"]);
 fs.writeFileSync(path.join(root,"records/approved-python-inspect.json"),JSON.stringify(inspect,null,2));
 const images=new IconImageAssets({pythonPath:python,storePath:store});
 const options={base64:source.toString("base64"),sourceSha256:sourceSha,assetId:"synthetic-comfy-python-cpu-only",width:96,height:96,directory:"art/final/companion",transparent:true,color:"#ffffff",allowUpscale:false,expectedTargetSha256:null};
 const output=await images.exportVariant(project,options);assert.equal(output.created,true);
 const outputPath=path.join(project.path,output.relativePath),bytes=fs.readFileSync(outputPath);assert.equal(sha(bytes),output.sha256);
 const pixel=execute(["-c","from PIL import Image;import hashlib,json,sys; p=sys.argv[1]; im=Image.open(p); im.load(); a=im.getchannel(\"A\"); print(json.dumps(dict(format=im.format,size=list(im.size),mode=im.mode,alpha=list(a.getextrema()),sha256=hashlib.sha256(open(p,\"rb\").read()).hexdigest())))",outputPath]);assert.deepEqual(pixel.size,[96,96]);assert.deepEqual(pixel.alpha,[0,255]);assert.equal(pixel.mode,"RGBA");assert.equal(pixel.sha256,output.sha256);
 const receiptRoot=path.join(store,"companion-variant-receipts",project.id),receipts=fs.readdirSync(receiptRoot).map(n=>{const p=path.join(receiptRoot,n),b=fs.readFileSync(p);return {p,b,j:JSON.parse(b)};}).filter(x=>x.j.relativePath===output.relativePath);assert.equal(receipts.length,1);const receipt=receipts[0];assert.equal(receipt.j.sha256,output.sha256);assert.equal(receipt.j.sourceSha256,sourceSha);assert.equal(receipt.j.schemaVersion,"companion-icon-variant-v1");assert.equal(receipt.j.runtimeImported,false);
 assert.equal(sha(fs.readFileSync(configPath)),configBefore);
 const result={status:"ACTUAL_PASS",environment,inspectPassed:true,export:output,png:pixel,receiptPath:receipt.p,receiptSha256:sha(receipt.b),configUnchanged:true,scope:"approved Python inspect + direct actual CPU class only; not full host binding or adopted task export",modelRequests:0,listenersOpened:0};
 fs.writeFileSync(path.join(root,"records/approved-python-check.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{fs.writeFileSync(path.join(root,"records/approved-python-failure.json"),JSON.stringify({message:e.message,code:e.code,stack:e.stack},null,2));console.error(e);process.exitCode=1;});
