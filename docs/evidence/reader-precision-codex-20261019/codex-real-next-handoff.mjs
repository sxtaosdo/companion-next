import {CompanionApiClient} from 'file:///D:/code/shidai3/P8000/cocos-mcp/mcp/dist/companion-api-client.js';
import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {randomUUID,createHash} from 'node:crypto';
const root='C:/Users/33272/AppData/Local/Temp/companion-safe-parity-20261019',base='http://127.0.0.1:32180',marker='COMPANION_PREFILL_ONLY_20261019_'+randomUUID().replaceAll('-',''),literal='creator-ai setup "/absolute/path/to/cocos-project"';
const proof={at:new Date().toISOString(),marker,materialFixtureOnly:true,handlerOrTransportMocked:false,sendSubmitted:false,blocked:[],pageErrors:[],clicked:false};let browser;
await writeFile(root+'/codex-test-marker.txt',marker,{flag:'wx'});
try{
 const client=await CompanionApiClient.discover();if(client.baseUrl!==base)throw Error('ORIGIN_MISMATCH');
 const {chromium}=createRequire('D:/code/shidai3/P8000/cocos-mcp/mcp/package.json')('playwright');browser=await chromium.launch({channel:'msedge',headless:false});
 const ctx=await browser.newContext({extraHTTPHeaders:{Origin:base}});const session=await client.request('POST','/v1/ui/session',{});if((await ctx.request.get(session.url,{maxRedirects:0})).status()!==302)throw Error('AUTH_FAILED');
 await ctx.route('**/*',async route=>{
  const q=route.request(),u=new URL(q.url());
  if(u.origin===base&&q.method()==='GET'&&/^\/next\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(u.pathname)){
   const response=await route.fetch(),original=await response.text();if(original.split(literal).length!==2)throw Error('FIXTURE_LITERAL_NOT_UNIQUE');const changed=original.replace(literal,marker);if(changed.replace(marker,literal)!==original)throw Error('FIXTURE_CHANGED_MORE_THAN_DATA');
   proof.fixture={path:u.pathname,onlyLiteralReplaced:true,originalSha256:createHash('sha256').update(original).digest('hex')};
   const headers=response.headers();delete headers['content-length'];delete headers['content-encoding'];return route.fulfill({response,body:changed,headers});
  }
  if(u.origin===base&&q.method()==='GET'&&(u.pathname.startsWith('/next/')||u.pathname==='/api/projects'))return route.continue();
  if(u.protocol==='codex:')return route.continue();
  proof.blocked.push({method:q.method(),path:u.pathname});return route.abort();
 });
 const page=await ctx.newPage();page.on('pageerror',e=>proof.pageErrors.push(e.message));await page.goto(base+'/next/index.html#/help?topic=cli',{waitUntil:'domcontentloaded'});
 const block=page.locator('.help-code-block').filter({has:page.locator('pre').filter({hasText:marker})});await block.waitFor({state:'visible'});if(await block.count()!==1)throw Error('NEXT_MARKER_BLOCK_NOT_UNIQUE');
 execFileSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-STA','-File',root+'/codex-structural-check.ps1','-Phase','Before'],{windowsHide:true});
 await page.bringToFront();await block.getByRole('button',{name:'发送到 Codex',exact:true}).click({noWaitAfter:true});proof.clicked=true;
 await page.screenshot({path:root+'/codex-real-next-marker.png'});await writeFile(root+'/codex-handoff-ready.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({clicked:true,marker,fixture:proof.fixture}));
 // Keep only our own browser alive briefly for native protocol confirmation and exact-marker cleanup.
 for(let i=0;i<120;i++){try{await readFile(root+'/codex-handoff-finish.flag');break}catch{}await new Promise(r=>setTimeout(r,500));}
}catch(e){proof.error=['ORIGIN_MISMATCH','AUTH_FAILED','FIXTURE_LITERAL_NOT_UNIQUE','FIXTURE_CHANGED_MORE_THAN_DATA','NEXT_MARKER_BLOCK_NOT_UNIQUE'].includes(e.message)?e.message:'HANDOFF_CHECK_NOT_COMPLETED';}
finally{await browser?.close();await writeFile(root+'/codex-real-next-result.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({clicked:proof.clicked,error:proof.error,blocked:proof.blocked,pageErrors:proof.pageErrors}));if(!proof.clicked||proof.error)process.exitCode=1;}
