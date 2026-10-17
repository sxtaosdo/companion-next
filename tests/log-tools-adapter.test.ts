import { describe,it,expect,vi } from 'vitest'
import { createLogToolsProvider,type LogToolFetch } from '../src/adapters/log-tools'
import { normalizeLogTool,LOG_TOOL_LIMITS } from '../src/domain/log-tools'
const id='0123456789abcdef',other='fedcba9876543210'
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}})
const diagnostic=()=>({generatedAt:'2026-10-17T00:00:00Z',projectId:id,status:{projectId:id,state:'stopped',secret:'private',lastError:'token=private'},logs:[{projectId:id,message:'Bearer private',source:'bridge'}]})
describe('original bounded log tool contract',()=>{
 it('sends DELETE only project filters and accepts zero without invented success count',async()=>{
  const fetch=vi.fn<LogToolFetch>(async()=>json({cleared:0})),api=createLogToolsProvider({fetch})
  expect(fetch).not.toHaveBeenCalled();expect(await api.run({action:'clear',projectIds:[id,other]})).toEqual({action:'clear',cleared:0})
  const [path,init]=fetch.mock.calls[0]!;expect(path).toBe(`/api/logs?projectId=${id}&projectId=${other}`);expect(init).toMatchObject({method:'DELETE',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store'});expect(init.body).toBeUndefined()
 })
 it('all projects uses original unfiltered path',async()=>{const fetch=vi.fn<LogToolFetch>(async()=>json({cleared:2}));await createLogToolsProvider({fetch}).run({action:'clear',projectIds:[]});expect(fetch.mock.calls[0]![0]).toBe('/api/logs')})
 it.each([{cleared:-1},{cleared:0.5},{cleared:'1'},{cleared:1,extra:true},{}])('rejects malformed clear reply %j',async reply=>{await expect(createLogToolsProvider({fetch:async()=>json(reply)}).run({action:'clear',projectIds:[]})).rejects.toMatchObject({code:'invalid-shape',outcome:'unknown'})})
 it('keeps only same project diagnostic, strips credentials before text/download',async()=>{
  const fetch=vi.fn<LogToolFetch>(async()=>json(diagnostic()));const reply=await createLogToolsProvider({fetch}).run({action:'diagnostic',projectId:id})
  expect(fetch.mock.calls[0]).toMatchObject([`/api/projects/${id}/diagnostic`,{method:'POST',body:'{}'}]);expect(reply.action).toBe('diagnostic');if(reply.action!=='diagnostic')throw Error();expect(reply.text).toContain('[redacted]');expect(reply.text).not.toContain('private');expect(JSON.parse(reply.text).status.state).toBe('stopped')
 })
 it.each(['{"Cookie":"session=private"}',"'cookie': 'session=private'",'Cookie=session=private'])('redacts serialized Cookie log text %s',async message=>{const d=diagnostic();d.logs[0]!.message=message;const reply=await createLogToolsProvider({fetch:async()=>json(d)}).run({action:'diagnostic',projectId:id});if(reply.action!=='diagnostic')throw Error();expect(reply.text).not.toContain('private');expect(reply.text).toContain('[redacted]')})
 it('redacts the remainder of escaped quoted Cookie values',async()=>{const d=diagnostic();d.logs[0]!.message=String.raw`{"Cookie":"session=\"private\""}`;const reply=await createLogToolsProvider({fetch:async()=>json(d)}).run({action:'diagnostic',projectId:id});if(reply.action!=='diagnostic')throw Error();expect(reply.text).not.toContain('private')})
 it.each(['root','status','log'])('rejects foreign %s project diagnostics',async field=>{const d=diagnostic();if(field==='root')d.projectId=other;else if(field==='status')d.status.projectId=other;else d.logs[0]!.projectId=other;await expect(createLogToolsProvider({fetch:async()=>json(d)}).run({action:'diagnostic',projectId:id})).rejects.toMatchObject({code:'invalid-shape'})})
 it.each([403,500])('does not surface raw error bodies at %s',async status=>{await expect(createLogToolsProvider({fetch:async()=>json({error:'secret credentials'},status)}).run({action:'clear',projectIds:[]})).rejects.toMatchObject({code:status===403?'forbidden':'backend-failure',outcome:status===403?'rejected':'unknown'})})
 it('rejects large advertised content without reading it',async()=>{const response=json(diagnostic());response.headers.set('content-length',String(LOG_TOOL_LIMITS.maxResponseBytes+1));await expect(createLogToolsProvider({fetch:async()=>response}).run({action:'diagnostic',projectId:id})).rejects.toMatchObject({code:'response-too-large'})})
 it.each([{action:'clear',projectIds:[id,id]},{action:'clear',projectIds:['../bad']},{action:'clear',projectIds:[],sources:['bridge']},{action:'diagnostic',projectId:'bad'}])('rejects unapproved request %j without transport',async input=>{const fetch=vi.fn();await expect(createLogToolsProvider({fetch}).run(input as never)).rejects.toMatchObject({outcome:'not-dispatched'});expect(fetch).not.toHaveBeenCalled()})
 it('holds transport lease after abort-unaware fetch until it really settles',async()=>{
  let resolve!:(r:Response)=>void;const fetch=vi.fn<LogToolFetch>(()=>new Promise(r=>{resolve=r})),api=createLogToolsProvider({fetch,timeoutMs:10})
  await expect(api.run({action:'clear',projectIds:[]})).rejects.toMatchObject({code:'timeout',outcome:'unknown'})
  await expect(api.run({action:'clear',projectIds:[]})).rejects.toMatchObject({code:'busy'});let idle=false;void api.waitForIdle().then(()=>{idle=true});await Promise.resolve();expect(idle).toBe(false)
  resolve(json({cleared:1}));await api.waitForIdle();expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('rejects accessor inputs without evaluating them',()=>{const getter=vi.fn();expect(()=>normalizeLogTool({get action(){getter();return 'clear'},projectIds:[]})).toThrow();expect(getter).not.toHaveBeenCalled()})
})
