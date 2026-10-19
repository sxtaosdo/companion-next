import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {resolve,join,sep,extname} from 'node:path';
const W='C:/Users/33272/AppData/Local/Temp/companion-next-project-list-closeout-20261019';
const staticRoot='D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion/web/next';
const base='http://127.0.0.1:32180',mode=process.argv[2];
if(!['--simulated','--registry-live'].includes(mode))throw Error('MODE');
const simulated=mode==='--simulated',sha=x=>createHash('sha256').update(x).digest('hex');
const assert=(ok,code)=>{if(!ok)throw Error(code)};
const ids=['0123456789abcdef','1123456789abcdef','2123456789abcdef'];
const fixtures=ids.map((id,index)=>({id,name:['合成 Ready','合成 Stopped','合成 Unknown'][index],path:`C:/fixture-only/project-${index}`,requiredCreatorVersion:'3.8.8'}));
const requests=[],blocked=[],pageErrors=[],staticHashes=[],statusSuppressed=[];let browser,stage='setup',phase=0,registry,loc;
const statusRows=()=>[{projectId:ids[0],state:phase?'stopped':'ready',...(phase?{}:{creatorVersion:'3.8.8',sessionId:'synthetic-only',pid:100}),capabilityProfile:phase?'unknown':'authoring'},{projectId:ids[1],state:phase?'ready':'stopped',...(phase?{creatorVersion:'3.8.8',sessionId:'synthetic-only-2',pid:101}:{}),capabilityProfile:phase?'authoring':'unknown'}];
async function inflight(){const r=await fetch(base+'/v1/daemon/inflight',{headers:{authorization:`Bearer ${loc.apiToken}`}});assert(r.ok,'INFLIGHT_READ');const v=await r.json();assert(v.identity.pid===10820&&v.identity.startupEpoch==='7601ac9d-a500-46d8-8db0-9a0f28e7569c','INSTANCE_CHANGED');return {identity:v.identity,phase:v.phase,nativeAwaiting:v.counts.nativeAwaiting,nativeUncertain:v.counts.nativeUncertain,nativeEpochUnproven:v.counts.nativeEpochUnproven,unknown:v.unknown};}
try{
 const {chromium}=createRequire('D:/code/shidai3/P8000/cocos-mcp/mcp/package.json')('playwright');
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu','--disable-gpu-compositing']});
 const context=await browser.newContext({viewport:{width:1440,height:1080}});let before;
 if(!simulated){
  stage='one-session';loc=JSON.parse(await readFile(join(process.env.APPDATA,'Creator AI Companion/daemon.json'),'utf8'));before=await inflight();
  const r=await fetch(base+'/v1/ui/session',{method:'POST',headers:{authorization:`Bearer ${loc.apiToken}`,'content-type':'application/json'},body:'{}'});assert(r.ok,'SESSION');const entry=await r.json();assert(entry.url.startsWith(base+'/auth?code='),'ENTRY');assert((await context.request.get(entry.url,{maxRedirects:0})).status()===302,'LOGIN');
 }
 await context.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin!==base||r.method()!=='GET'){blocked.push({method:r.method(),path:u.pathname});return route.abort();}
  requests.push(u.pathname);
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(u.pathname.startsWith('/next/')){
   const file=resolve(staticRoot,decodeURIComponent(u.pathname.slice(6)));assert(file.startsWith(resolve(staticRoot)+sep),'STATIC_PATH');
   if(simulated){const bytes=await readFile(file);staticHashes.push({path:u.pathname,sha256:sha(bytes)});return route.fulfill({status:200,body:bytes,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'})[extname(file)]??'application/octet-stream'});}
   return route.continue();
  }
  if(u.pathname==='/api/status'){
   if(simulated)return json(statusRows());
   statusSuppressed.push('GET /api/status');return json({error:'LOCAL_TEST_PREVENTS_GLOBAL_NATIVE_STATUS_PROBES'},503);
  }
  if(u.pathname==='/api/projects'){
   if(simulated)return json(fixtures);
   const response=await route.fetch();assert(response.status()===200,'REGISTRY_RESPONSE');registry=await response.json();assert(Array.isArray(registry),'REGISTRY_SHAPE');return route.fulfill({response});
  }
  if(u.pathname==='/api/calls/counts')return simulated?json({sessionId:'synthetic-project-session',counts:{},latest:{}}):route.continue();
  blocked.push({method:r.method(),path:u.pathname});return route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',()=>pageErrors.push('PAGE_ERROR'));
 stage='open';await page.goto(base+'/next/index.html#/projects',{waitUntil:'networkidle'});
 if(!await page.getByText('已连接',{exact:true}).count())await page.getByRole('button',{name:'连接工程服务',exact:true}).click();
 await page.getByText('已连接',{exact:true}).waitFor();
 const cards=page.locator('.companion-project-card'),search=page.getByRole('textbox',{name:'搜索登记工程',exact:true});
 const card=id=>page.locator(`.companion-project-card`).filter({has:page.locator(`button[aria-controls="project-detail-${id}"]`)});
 const toggle=id=>page.locator(`button[aria-controls="project-detail-${id}"]`);
 async function count(n){await page.waitForFunction(n=>document.querySelectorAll('.companion-project-card').length===n,n);}
 async function expanded(id,value){assert(await toggle(id).getAttribute('aria-expanded')===String(value),'EXPANSION_'+id);}
 if(simulated){
  stage='default-collapse';await count(3);await expanded(ids[0],true);await expanded(ids[1],false);await expanded(ids[2],true);
  assert((await card(ids[0]).textContent()).includes('就绪'),'READY_LABEL');assert((await card(ids[1]).textContent()).includes('已停止'),'STOPPED_LABEL');assert((await card(ids[2]).textContent()).includes('未知'),'UNKNOWN_LABEL');
  const beforeLocal=requests.filter(p=>p.startsWith('/api/')).length;
  await search.fill('合成 Stopped');await count(1);await search.fill(ids[0]);await count(1);await search.fill('C:/fixture-only/project-2');await count(1);
  await search.fill('NO_MATCH_FIXTURE');await count(0);await page.getByRole('button',{name:'清除筛选',exact:true}).click();await count(3);
  const filter=page.getByRole('combobox',{name:'工程状态筛选',exact:true});await filter.press('ArrowDown');await page.getByRole('option',{name:'已停止',exact:true}).click();await count(1);assert((await cards.textContent()).includes('合成 Stopped'),'STOPPED_FILTER');
  await filter.press('ArrowDown');await page.getByRole('option',{name:'运行 / 启动中',exact:true}).click();await count(1);assert((await cards.textContent()).includes('合成 Ready'),'RUNNING_FILTER');
  await filter.press('ArrowDown');await page.getByRole('option',{name:'全部',exact:true}).click();await count(3);
  await toggle(ids[0]).click();await expanded(ids[0],false);await toggle(ids[1]).click();await expanded(ids[1],true);
  assert(requests.filter(p=>p.startsWith('/api/')).length===beforeLocal,'LOCAL_UI_CREATED_READS');
  stage='status-change';phase=1;const next=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/status');await page.getByRole('button',{name:'刷新真实状态',exact:true}).click();await next;await page.getByText('已连接',{exact:true}).waitFor();
  await expanded(ids[0],false);await expanded(ids[1],true);assert((await card(ids[0]).textContent()).includes('已停止'),'NEW_STOPPED_LABEL');assert((await card(ids[1]).textContent()).includes('就绪'),'NEW_READY_LABEL');
  stage='same-context-reload';await page.reload({waitUntil:'networkidle'});if(!await page.getByText('已连接',{exact:true}).count())await page.getByRole('button',{name:'连接工程服务',exact:true}).click();await page.getByText('已连接',{exact:true}).waitFor();await expanded(ids[0],false);await expanded(ids[1],true);
  assert(!blocked.length&&!pageErrors.length,'UNEXPECTED_ACTIVITY');
  await browser.close();browser=undefined;await writeFile(join(W,'project-list-simulated-proof.json'),JSON.stringify({atUtc:new Date().toISOString(),mode:'DEPLOYED_STATIC_BYTES_WITH_ALL_API_SIMULATED',defaultReadyExpanded:true,defaultStoppedCollapsed:true,unknownDistinct:true,nameIdPathSearch:true,clearFilter:true,statusFilters:true,manualPreferencesSurviveStatusAndReload:true,localUiCreatesNoApiRequests:true,staticHashes,requests,blocked,pageErrors,actualNetworkRequests:0,actualLoginPosts:0,actualBusinessWrites:0,creatorOrModelActions:0,userBrowserUntouched:true,ownedBrowserClosed:true},null,2)+'\n',{flag:'wx'});
 }else{
  stage='real-registry';assert(registry,'NO_REGISTRY');await count(registry.length);
  for(const p of registry){assert(await toggle(p.id).count()===1,'REGISTRY_CARD_ID');assert((await card(p.id).textContent()).includes(p.name),'REGISTRY_CARD_NAME');}
  const target=registry.find(p=>p.id==='a79f4915296f4091');assert(target&&/variant-import-acceptance-20261017/.test(target.path)&&!/P1060/i.test(target.path),'TARGET_NOT_TASK_OWNED');
  const beforeLocal=requests.filter(p=>p.startsWith('/api/')).length;
  await search.fill(target.id);await count(1);assert((await cards.textContent()).includes(target.name),'LIVE_ID_SEARCH');
  const was=await toggle(target.id).getAttribute('aria-expanded');await toggle(target.id).click();await expanded(target.id,was!=='true');await toggle(target.id).click();await expanded(target.id,was==='true');
  await search.fill('NO_MATCH_THIS_OWNED_CONTEXT');await count(0);await page.getByRole('button',{name:'清除筛选',exact:true}).click();await count(registry.length);
  assert(requests.filter(p=>p.startsWith('/api/')).length===beforeLocal,'LIVE_LOCAL_UI_CREATED_READS');
  await search.fill(target.id);await count(1);await page.locator('.companion-project-card').first().screenshot({path:join(W,'registry-target-path-masked.png'),mask:[page.locator('.companion-project-path')]});
  const after=await inflight();assert(JSON.stringify(before)===JSON.stringify(after),'DAEMON_NATIVE_STATE_CHANGED');assert(!blocked.length&&!pageErrors.length,'UNEXPECTED_ACTIVITY');
  await browser.close();browser=undefined;await writeFile(join(W,'project-list-registry-proof.json'),JSON.stringify({atUtc:new Date().toISOString(),mode:'REAL_REGISTRY_COUNTS_STATIC_WITH_GLOBAL_STATUS_LOCALLY_BLOCKED',realRegistryCount:registry.length,allRegistryIdsNamesMatchUi:true,target:{id:target.id,pathSha256:sha(target.path),taskOwned:true},targetSearchAndCollapse:true,clearFilter:true,localUiCreatesNoApiRequests:true,globalStatusRequestsSent:0,statusSuppressed,currentRuntimeVerified:false,runtimeBoundary:'Global status probes Native for every registration; not sent. UI statuses are unknown due locally simulated 503. Reuse prior real status-to-UI receipt only as historical evidence.',before,after,requests,blocked,pageErrors,actualLoginPosts:1,actualBusinessWrites:0,creatorOrModelActions:0,userBrowserUntouched:true,ownedBrowserClosed:true},null,2)+'\n',{flag:'wx'});
 }
 console.log(JSON.stringify({ok:true,mode,blocked:blocked.length,pageErrors:pageErrors.length}));
}catch(error){console.error(JSON.stringify({ok:false,mode,stage,diagnostic:String(error?.message??'').split('\n')[0].slice(0,200)}));process.exitCode=1;}finally{await browser?.close();}
