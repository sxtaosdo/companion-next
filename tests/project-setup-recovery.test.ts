import {afterEach,beforeEach,it,expect,vi} from 'vitest'
import {createPinia,setActivePinia} from 'pinia'
import {createProjectSetupProvider} from '../src/adapters/project-setup'
import {projectSetupProvider} from '../src/project-setup-integration'
import {useCompanionBrowserStore} from '../src/stores/companion-browser'
import {useProjectSetupStore} from '../src/stores/project-setup'
import {useProjectOperationLaneStore} from '../src/stores/project-operation-lane'
const id='aaaaaaaaaaaaaaaa',op='11111111-1111-4111-8111-111111111111',next='22222222-2222-4222-8222-222222222222'
const project={id,name:'isolated',path:'/isolated/project'},time='2026-10-20T00:00:00.000Z'
const options=[{startCreator:false,configureCodex:true},{startCreator:true,configureCodex:true}]
const json=(raw:unknown,status=200)=>new Response(JSON.stringify(raw),{status,headers:{'Content-Type':'application/json'}})
beforeEach(()=>{vi.useFakeTimers();setActivePinia(createPinia());projectSetupProvider.value=null})
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();projectSetupProvider.value=null})
async function fixture(selected=options[0]!) {
 let operationId=op, stage='complete',effect:Record<string,unknown>={mcpName:'cocos-isolated'}, failRead=false,postStatus=202
 const calls:{path:string;method:string;body?:unknown}[]=[]
 const transport=vi.fn(async(path:string,init:RequestInit)=>{
  calls.push({path,method:init.method!,...(init.body?{body:JSON.parse(init.body as string)}:{})})
  if(path==='/api/setup/options-v1'&&init.method==='GET')return json({optionsContractVersion:1,strictOptions:true,reusePolicy:'same-effective-options'})
  if(init.method==='POST')return postStatus===409?json({code:'SETUP_OPTIONS_CONFLICT',retryable:false,error:'PRIVATE'},409):json({operationId,optionsContractVersion:1,effectiveOptions:selected,reused:false},202)
  if(failRead)throw Error('PRIVATE transport diagnostic')
  return json({id:operationId,projectId:id,projectPath:project.path,stage,startedAt:time,updatedAt:time,optionsContractVersion:1,effectiveOptions:selected,...effect})
 })
 projectSetupProvider.value=createProjectSetupProvider({fetch:transport})
 const browser=useCompanionBrowserStore();await browser.connect({label:'isolated reader',loadProjects:async()=>({projects:[project],statuses:[],dashboard:[],warnings:[]}),loadLogs:async()=>[],loadCounts:async()=>({sessionId:'isolated',counts:{},latest:{}}),loadCalls:async()=>({sessionId:'isolated',total:0,retained:0,records:[]})})
 const store=useProjectSetupStore(),lane=useProjectOperationLaneStore()
 const prepare=()=>store.prepareSetup(id,{installBridge:true,acknowledgeReuse:true,acknowledgeToolScope:true,...selected})
 return {store,lane,calls,prepare,set:(value:{operationId?:string;stage?:string;effect?:Record<string,unknown>;failRead?:boolean;postStatus?:number})=>{if(value.operationId!==undefined)operationId=value.operationId;if(value.stage!==undefined)stage=value.stage;if(value.effect!==undefined)effect=value.effect;if(value.failRead!==undefined)failRead=value.failRead;if(value.postStatus!==undefined)postStatus=value.postStatus}}
}
it.each(options)('failed strict %j retains partial-effects warning and requires fresh confirmation for a second POST',async selected=>{
 const f=await fixture(selected);f.set({stage:'failed',effect:{error:'PRIVATE credential'}})
 const first=f.prepare()!;expect(await f.store.sendSetup(first,true)).toBe(true);await vi.advanceTimersByTimeAsync(1000)
 expect(f.store.setupReceipt?.phase).toBe('failed');expect(f.store.setupReceipt?.message).toContain('没有整体回滚');expect(f.store.completedUsage).toBeNull();expect(f.lane.locked).toBe(false)
 await vi.advanceTimersByTimeAsync(5000);expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1)
 expect(await f.store.sendSetup(first,true)).toBe(false)
 f.set({operationId:next,stage:'complete',effect:{mcpName:'cocos-isolated'}})
 const second=f.prepare()!;expect(second).not.toBe(first);expect(await f.store.sendSetup(second,true)).toBe(true);await vi.advanceTimersByTimeAsync(1000)
 expect(f.store.setupReceipt?.operationId).toBe(next);expect(f.store.completedUsage?.project.id).toBe(id);expect(f.lane.locked).toBe(false)
 expect(f.calls.filter(c=>c.method==='POST').map(c=>c.body)).toEqual([{projectId:id,...selected},{projectId:id,...selected}])
})
it.each(options)('strict %j read failure permits only explicit same-ID GET recovery, never POST replay',async selected=>{
 const f=await fixture(selected);f.set({failRead:true});await f.store.sendSetup(f.prepare(),true);await vi.advanceTimersByTimeAsync(1000)
 expect(f.store.setupReceipt?.phase).toBe('paused');expect(f.lane.locked).toBe(true);expect(f.store.canResume).toBe(true)
 await vi.advanceTimersByTimeAsync(5000);expect(f.calls.filter(c=>c.path===`/api/setup/${op}`)).toHaveLength(1)
 f.set({failRead:false});expect(await f.store.resume()).toBe(true);expect(f.store.setupReceipt?.phase).toBe('complete');expect(f.lane.locked).toBe(false)
 expect(f.calls.filter(c=>c.path===`/api/setup/${op}`)).toHaveLength(2);expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1)
})
it.each([{startCreator:false,configureCodex:true},{startCreator:true,configureCodex:false}])('unselected step effect %j is UNKNOWN and retains write barrier',async selected=>{
 const f=await fixture(selected);f.set({effect:selected.startCreator?{mcpName:'unexpected'}:{runtime:{projectId:id,state:'ready'}}});await f.store.sendSetup(f.prepare(),true);await vi.advanceTimersByTimeAsync(1000)
 expect(f.store.setupReceipt?.phase).toBe('unknown');expect(f.lane.locked).toBe(true);expect(f.store.completedSetup).toBeNull();expect(f.store.completedUsage).toBeNull();expect(f.calls.filter(c=>c.method==='POST')).toHaveLength(1)
})
it('complete plus backend error suppresses completion usage and never displays raw error',async()=>{
 const f=await fixture();f.set({effect:{mcpName:'cocos-isolated',error:'PRIVATE credential'}});await f.store.sendSetup(f.prepare(),true);await vi.advanceTimersByTimeAsync(1000)
 expect(f.store.setupReceipt?.snapshot?.failureReported).toBe(true);expect(f.store.completedSetup).toBeNull();expect(f.store.completedUsage).toBeNull();expect(JSON.stringify(f.store.setupReceipt)).not.toContain('PRIVATE')
})
it('invalid MCP identity suppresses usage even after matching strict completion',async()=>{
 const f=await fixture();f.set({effect:{mcpName:'cocos; PRIVATE command'}});await f.store.sendSetup(f.prepare(),true);await vi.advanceTimersByTimeAsync(1000)
 expect(f.store.setupReceipt?.phase).toBe('complete');expect(f.store.completedSetup?.project.id).toBe(id);expect(f.store.completedUsage).toBeNull()
})
it('strict conflict is rejected with no GET tracking; a fresh approval is required',async()=>{
 const f=await fixture();f.set({postStatus:409});const first=f.prepare();expect(await f.store.sendSetup(first,true)).toBe(false);expect(f.store.setupReceipt?.phase).toBe('rejected');expect(f.lane.locked).toBe(false);expect(await f.store.sendSetup(first,true)).toBe(false)
 expect(f.calls.map(c=>c.method)).toEqual(['GET','POST']);expect(JSON.stringify(f.store.setupReceipt)).not.toContain('PRIVATE')
})
