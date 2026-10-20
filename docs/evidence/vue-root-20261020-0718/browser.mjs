import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=createRequire('D:/code/shidai3/P8000/cocos-mcp/mcp/package.json')('playwright');
const W=import.meta.dirname,sha=s=>createHash('sha256').update(s).digest('hex');
const loc=JSON.parse(await readFile(join(process.env.APPDATA,'Creator AI Companion','daemon.json'),'utf8'));
const deploy=JSON.parse(await readFile(join(W,'deployment.json'),'utf8'));
if(loc.baseUrl!=='http://127.0.0.1:32180')throw Error('Unexpected origin');
let browser;const errors=[],blocked=[],requests=[];const first='214a2184be887306',second='cdc0709d4eaaa8a2',project='04c4cde24ee76d83';
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1100}});
 const tokenReply=await ctx.request.post(loc.baseUrl+'/v1/ui/session',{headers:{Authorization:'Bearer '+loc.apiToken},data:{}});if(tokenReply.status()!==200)throw Error('Local UI session failed');
 const ticket=await tokenReply.json();const auth=await ctx.request.get(ticket.url);if(auth.status()!==200)throw Error('UI auth failed');
 const http=[];
 for(const f of deploy.files){const r=await ctx.request.get(loc.baseUrl+'/'+f.path,{headers:{'Cache-Control':'no-cache'}});const bytes=await r.body();if(r.status()!==200||sha(bytes)!==f.sha256)throw Error('Static HTTP bytes differ: '+f.path);http.push({path:f.path,status:r.status(),sha256:sha(bytes)});}
 const before=await (await ctx.request.get(loc.baseUrl+'/api/calls/counts')).json();
 const failed=await (await ctx.request.get(loc.baseUrl+`/api/projects/${project}/calls?status=failed&limit=50`)).json();
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.name));
 await page.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==loc.baseUrl||r.method()!=='GET'||!u.pathname.startsWith('/next/')&&!['/api/projects','/api/calls/counts',`/api/projects/${project}/calls`].includes(u.pathname)){blocked.push({phase:'actual-read',method:r.method(),path:u.pathname});return route.abort();}if(u.pathname.startsWith('/api/'))requests.push({phase:'actual-read',method:r.method(),path:u.pathname});return route.continue();});
 await page.goto(loc.baseUrl+'/next/index.html#/projects?tab=calls',{waitUntil:'domcontentloaded'});
 const connect=page.getByRole('button',{name:'连接工程服务',exact:true});if(await connect.isVisible())await connect.click();
 await page.locator('.companion-filters .el-select').nth(0).click();await page.getByRole('option',{name:'ant-cook',exact:true}).click();
 await page.locator('.companion-filters .el-select').nth(1).click();await page.getByRole('option',{name:'仅失败',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('details.companion-call-record').length===2);
 const actual=[];
 for(const record of failed.records){const row=page.locator('details.companion-call-record').filter({has:page.locator('summary code',{hasText:record.operation})});const summary=await row.locator('summary').textContent();if(!summary.includes('失败')||summary.includes(' · failed · '))throw Error('Original Chinese status not restored');await row.locator('summary').click();const value=await row.locator('pre').last().textContent();if(sha(value)!==sha(record.errorSummary))throw Error('Existing actual error differs');actual.push({operation:record.operation,statusLabel:'失败',errorSummarySha256:sha(value)});}
 await page.close();
 // Isolate only the project registry and state. All writes and native status probes remain blocked.
 const ui=await ctx.newPage();ui.on('pageerror',e=>errors.push(e.name));
 const fixtureProjects=[{id:first,name:'Fixture A',path:'D:/VueFixture/A'},{id:second,name:'Fixture B',path:'D:/VueFixture/B'}];
 await ui.route('**/*',async route=>{const r=route.request(),u=new URL(r.url());if(u.origin!==loc.baseUrl||r.method()!=='GET'){blocked.push({phase:'isolated-ui',method:r.method(),path:u.pathname});return route.abort();}requests.push({phase:'isolated-ui',method:r.method(),path:u.pathname});if(u.pathname==='/api/projects')return route.fulfill({json:fixtureProjects});if(u.pathname==='/api/status')return route.fulfill({json:fixtureProjects.map(p=>({projectId:p.id,state:'stopped',capabilityProfile:'unknown'}))});if(u.pathname==='/api/calls/counts')return route.fulfill({json:{sessionId:'vue-isolated',counts:{},latest:{}}});if(u.pathname==='/api/dashboard/projects')return route.fulfill({json:[]});if(u.pathname.startsWith('/next/')||u.pathname==='/api/tool-presets'||u.pathname==='/api/tools'||u.pathname===`/api/projects/${second}/tool-preset`)return route.continue();blocked.push({phase:'isolated-ui',method:r.method(),path:u.pathname});return route.abort();});
 await ui.goto(loc.baseUrl+'/next/index.html#/projects',{waitUntil:'domcontentloaded'});await ui.getByRole('button',{name:'连接工程服务',exact:true}).click();
 await ui.getByRole('button',{name:'添加已有工程',exact:true}).click();await ui.getByRole('textbox',{name:'已有工程绝对路径',exact:true}).fill('D:/VueFixture/DraftA');await ui.getByRole('button',{name:'关闭向导',exact:true}).click();
 const card=ui.locator('.companion-project-card').filter({hasText:'Fixture B'});const expand=card.getByRole('button',{name:'展开',exact:true});if(await expand.count())await expand.click();
 await card.getByRole('button',{name:'安装 / 更新接入',exact:true}).click();const actualPath=await ui.getByRole('textbox',{name:'已有工程绝对路径',exact:true}).inputValue();if(actualPath!=='D:/VueFixture/B')throw Error('Card B retained another project draft');await ui.getByRole('button',{name:'关闭向导',exact:true}).click();
 await card.getByRole('button',{name:'工具范围',exact:true}).click();await ui.locator('.help-topic-nav button').filter({hasText:'CLI'}).first().click();if(!ui.url().includes('project='+second))throw Error('Help topic lost project');await ui.locator('.help-topic-nav button').filter({hasText:'工具清单'}).click();if(!ui.url().includes('project='+second))throw Error('Return topic lost project');
 await ui.goto(loc.baseUrl+'/next/index.html#/migration',{waitUntil:'domcontentloaded'});await ui.getByRole('heading',{name:'前端迁移判定',exact:true}).waitFor();await ui.getByRole('heading',{name:'宿主与真实集成状态',exact:true}).waitFor();
 const after=await (await ctx.request.get(loc.baseUrl+'/api/calls/counts')).json();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Call counts changed during frontend checks');if(errors.length)throw Error('Page error');if(blocked.some(r=>r.method!=='GET'))throw Error('Unexpected business mutation attempt');
 const result={atUtc:new Date().toISOString(),sourceCommit:deploy.sourceCommit,staticHttp:http,actualRead:{failedDetails:actual,countsBeforeAfterEqual:true},isolatedDeployedUi:{cardBPath:actualPath,helpProjectPreserved:second,scopeLayersPresent:true,registryAndStatusFixture:true},pageErrors:errors,requests,blocked,productionMutationRequests:0,cursorActions:0,creatorActions:0,modelActions:0,userWindowsUntouched:true,browserClosed:true};await writeFile(join(W,'browser-result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:true,httpFiles:http.length,actualChineseFailureDetails:actual.length,cardContext:true,helpContext:true,scopeLayers:true,pageErrors:errors.length}));
}catch(e){await writeFile(join(W,'browser-failure.json'),JSON.stringify({atUtc:new Date().toISOString(),error:e.message,requests,blocked,pageErrors:errors},null,2)+'\n');console.log(JSON.stringify({passed:false,error:e.message}));process.exitCode=1;}
finally{if(browser)await browser.close();}
