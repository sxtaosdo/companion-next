import { CompanionApiClient } from 'file:///D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion-api-client.js';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir, lstat, open, rename } from 'node:fs/promises';
import { join } from 'node:path';
const repo='D:/code/shidai3/P8000/companion-next',host='D:/code/shidai3/P8000/cocos-mcp',live=host+'/mcp/dist/companion/web/next',out='C:/Users/33272/AppData/Local/Temp/companion-safe-parity-20261019',base='http://127.0.0.1:32180';
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(r,...args)=>execFileSync('git',['-C',r,'--work-tree='+r,...args],{windowsHide:true,maxBuffer:128*1024*1024});
const sharedState=()=>Object.fromEntries(['HEAD','status','diff','index'].map(k=>[k,sha(git(host,...({HEAD:['rev-parse','HEAD'],status:['status','--porcelain=v1','--untracked-files=all'],diff:['diff','--binary'],index:['diff','--cached','--binary']}[k])))]));
async function files(root,prefix=''){let result={};for(const name of await readdir(join(root,prefix))){const rel=prefix?prefix+'/'+name:name,detail=await lstat(join(root,rel));if(detail.isSymbolicLink())throw Error('REPARSE_POINT');if(detail.isDirectory())Object.assign(result,await files(root,rel));else if(detail.isFile())result[rel]=sha(await readFile(join(root,rel)));}return result;}
async function replaceIndex(bytes){const stage=join(live,'index.html.safe-parity-stage');const f=await open(stage,'wx');try{await f.writeFile(bytes);await f.sync()}finally{await f.close()}await rename(stage,join(live,'index.html'));}
if(git(repo,'status','--porcelain').toString().trim())throw Error('CLEAN_CHECKPOINT_REQUIRED');
const c=await CompanionApiClient.discover();if(c.baseUrl!==base)throw Error('ORIGIN_MISMATCH');
const identity=async()=>(await c.request('GET','/v1/daemon/inflight')).identity;
const beforeIdentity=await identity(),beforeShared=sharedState(),beforeStatic=await files(live),expected=await files(repo+'/dist-companion-workspace');
const registryRoot=join(process.env.APPDATA,'Creator AI Companion'),registries={};
for(const name of ['projects.json','tool-presets.json'])registries[name]=sha(await readFile(join(registryRoot,name)));
const indexBefore=await readFile(join(live,'index.html'));await writeFile(out+'/static-index-before.html',indexBefore,{flag:'wx'});
const proof={at:new Date().toISOString(),sourceCommit:git(repo,'rev-parse','HEAD').toString().trim(),beforeIdentity,expected,steps:[],realReaderLoaded:false,restarts:0,businessWrites:0,blocked:[],pageErrors:[]};
let installed=false,browser;
try{
 for(const [rel,hash] of Object.entries(expected)){
  if(!/^(?:index\.html|favicon\.svg|assets\/[A-Za-z0-9._-]+\.(?:js|css|svg|png|ico))$/.test(rel))throw Error('STATIC_PATH_REJECTED');
  if(rel==='index.html')continue;
  try{if(sha(await readFile(join(live,rel)))!==hash)throw Error('HASH_COLLISION');}
  catch(e){if(e.code!=='ENOENT')throw e;await writeFile(join(live,rel),await readFile(join(repo,'dist-companion-workspace',rel)),{flag:'wx'});}
 }
 await replaceIndex(await readFile(repo+'/dist-companion-workspace/index.html'));installed=true;
 const {chromium}=createRequire(host+'/mcp/package.json')('playwright');
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']});
 const ctx=await browser.newContext({extraHTTPHeaders:{Origin:base}});
 const session=await c.request('POST','/v1/ui/session',{});
 if((await ctx.request.get(session.url,{maxRedirects:0})).status()!==302)throw Error('UI_AUTH_FAILED');
 proof.http=[];
 for(const [rel,hash]of Object.entries(expected)){const r=await ctx.request.get(base+'/next/'+rel);const actual=sha(await r.body());proof.http.push({path:'/next/'+rel,status:r.status(),sha256:actual});if(r.status()!==200||actual!==hash)throw Error('HTTP_STATIC_MISMATCH');}
 await ctx.route('**/*',route=>{const q=route.request(),u=new URL(q.url());if(u.origin===base&&q.method()==='GET'&&(u.pathname.startsWith('/next/')||u.pathname==='/api/projects'))return route.continue();proof.blocked.push({method:q.method(),path:u.pathname});return route.abort();});
 const page=await ctx.newPage();page.on('pageerror',e=>proof.pageErrors.push(e.message));
 await page.goto(base+'/next/index.html#/changelog',{waitUntil:'domcontentloaded'});
 await page.getByText('保护登记回读与客户端接入提示',{exact:false}).waitFor({state:'visible',timeout:15000});
 await page.screenshot({path:out+'/changelog-live.png'});proof.changelogVisible=true;
 const afterStatic=await files(live);proof.staticMatches=Object.entries(expected).every(([p,h])=>afterStatic[p]===h);proof.oldAssetsPreserved=Object.entries(beforeStatic).filter(([p])=>p!=='index.html').every(([p,h])=>afterStatic[p]===h);
 proof.afterIdentity=await identity();proof.daemonUnchanged=JSON.stringify(proof.afterIdentity)===JSON.stringify(beforeIdentity);proof.sharedUnchanged=JSON.stringify(sharedState())===JSON.stringify(beforeShared);
 proof.registriesUnchanged={};for(const[n,h]of Object.entries(registries))proof.registriesUnchanged[n]=sha(await readFile(join(registryRoot,n)))===h;
 if(!proof.staticMatches||!proof.oldAssetsPreserved||!proof.daemonUnchanged||!proof.sharedUnchanged||Object.values(proof.registriesUnchanged).some(v=>!v)||proof.pageErrors.length||proof.blocked.length)throw Error('PRESERVATION_OR_PAGE_CHECK_FAILED');
 proof.ok=true;
}catch(e){proof.error=String(e.message??e);if(installed){await replaceIndex(indexBefore);proof.indexRolledBack=true;}}
finally{await browser?.close();await writeFile(out+'/static-deployment.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({ok:proof.ok,error:proof.error,daemonUnchanged:proof.daemonUnchanged,staticMatches:proof.staticMatches,oldAssetsPreserved:proof.oldAssetsPreserved,sharedUnchanged:proof.sharedUnchanged,registriesUnchanged:proof.registriesUnchanged,changelogVisible:proof.changelogVisible,blocked:proof.blocked,pageErrors:proof.pageErrors,indexRolledBack:proof.indexRolledBack}));if(!proof.ok)process.exitCode=1;}
