import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const {chromium}=createRequire('D:/code/shidai3/P8000/cocos-mcp/mcp/package.json')('playwright');
const W=import.meta.dirname, sha=s=>createHash('sha256').update(s).digest('hex');
const loc=JSON.parse(await readFile(join(process.env.APPDATA,'Creator AI Companion','daemon.json'),'utf8'));
if(loc.baseUrl!=='http://127.0.0.1:32180')throw Error('Unexpected daemon origin');
const pid='04c4cde24ee76d83',seen=[],blocked=[],errors=[];
let browser;
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 const ticketReply=await ctx.request.post(loc.baseUrl+'/v1/ui/session',{headers:{Authorization:'Bearer '+loc.apiToken},data:{}});
 if(ticketReply.status()!==200)throw Error('Local UI session unavailable');
 const ticket=await ticketReply.json();
 const page=await ctx.newPage();page.on('pageerror',()=>errors.push('pageerror'));
 await page.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  const permitted=u.origin===loc.baseUrl&&r.method()==='GET'&&(u.pathname.startsWith('/next/')||u.pathname==='/ui'||u.pathname.startsWith('/ui/')||u.pathname==='/api/projects'||u.pathname==='/api/calls/counts'||u.pathname===`/api/projects/${pid}/calls`);
  if(!permitted){blocked.push({method:r.method(),path:u.pathname});return route.abort();}
  if(u.pathname.startsWith('/api/'))seen.push({method:r.method(),path:u.pathname,query:u.search});
  return route.continue();
 });
 // Consume auth through the context request API: cookies are shared, HTML scripts never execute.
 const auth=await ctx.request.get(ticket.url);if(auth.status()!==200)throw Error('Local UI ticket unavailable');
 const before=await (await ctx.request.get(loc.baseUrl+'/api/calls/counts')).json();
 const api=await (await ctx.request.get(loc.baseUrl+`/api/projects/${pid}/calls?status=failed&limit=50`)).json();
 if(api.records.length!==2||api.records.some(r=>r.status!=='failed'||!r.errorSummary))throw Error('Natural failed records changed; inspect without generating data');
 await page.goto(loc.baseUrl+'/next/index.html#/projects?tab=calls',{waitUntil:'domcontentloaded'});
 const connect=page.getByRole('button',{name:'连接工程服务',exact:true});
 if(await connect.isVisible())await connect.click();
 await page.locator('.companion-filters .el-select').nth(0).click();
 await page.getByRole('option',{name:'ant-cook',exact:true}).click();
 await page.locator('.companion-filters .el-select').nth(1).click();
 await page.getByRole('option',{name:'仅失败',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('details.companion-call-record').length===2,{},{timeout:15000});
 const receipts=[];
 for(const record of api.records){
  const detail=page.locator('details.companion-call-record').filter({has:page.locator('summary code',{hasText:record.operation})});
  if(await detail.count()!==1)throw Error('Expected one actual operation row');
  await detail.locator('summary').click();
  if(await detail.getAttribute('open')===null)throw Error('Detail not expanded');
  const rendered=await detail.locator('pre').last().textContent();
  if(!rendered||sha(rendered)!==sha(record.errorSummary))throw Error('Actual rendered error summary differs from real API');
  receipts.push({id:record.id,sequence:record.sequence,operation:record.operation,status:record.status,errorSummarySha256:sha(rendered),errorSummaryBytes:Buffer.byteLength(rendered),expanded:true,actualApiMatch:true});
 }
 const after=await (await ctx.request.get(loc.baseUrl+'/api/calls/counts')).json();
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Call counts changed during read-only UI check');
 if(seen.some(r=>r.method!=='GET')||blocked.some(r=>r.method!=='GET'))throw Error('Unexpected mutation attempt');
 const proof={atUtc:new Date().toISOString(),actualDeployedUi:true,headlessIsolatedBrowser:true,newListener:false,userBrowserUntouched:true,projectId:pid,failedDetailsPassed:receipts,total:api.total,retained:api.retained,failedOnlyUiRows:2,secondPageButtonPresent:await page.getByRole('button',{name:'加载更多（50 条）',exact:true}).count()>0,countsBeforeAfterEqual:true,apiRequests:seen,blockedUnrelatedReads:blocked,pageErrors:errors,generatedToolCalls:0,configurationWrites:0,creatorActions:0};
 await writeFile(join(W,'result.json'),JSON.stringify(proof,null,2)+'\n');
 console.log(JSON.stringify({passed:true,failedDetails:2,countsUnchanged:true,secondPageVerified:false,pageErrors:errors.length}));
}catch(e){await writeFile(join(W,'failure.json'),JSON.stringify({atUtc:new Date().toISOString(),error:e.message,seen,blocked,pageErrors:errors},null,2)+'\n');console.log(JSON.stringify({passed:false,error:e.message}));process.exitCode=1;}
finally{if(browser)await browser.close();}
