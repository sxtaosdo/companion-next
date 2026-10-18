import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {createPinia,setActivePinia} from 'pinia'
import {createProjectSetupProvider} from '../src/adapters/project-setup'
import type {ProjectSetupFetch} from '../src/adapters/project-setup'
import type {EffectiveSetupOptions,ProjectSetupProvider,SetupSnapshot} from '../src/domain/project-setup'
import {projectSetupProvider} from '../src/project-setup-integration'
import {useCompanionBrowserStore} from '../src/stores/companion-browser'
import {useProjectSetupStore} from '../src/stores/project-setup'
import {useProjectOperationLaneStore} from '../src/stores/project-operation-lane'
const id='aaaaaaaaaaaaaaaa', operationId='11111111-1111-4111-8111-111111111111'
const project={id,name:'fake',path:'/fake/project'},time='2026-10-18T00:00:00.000Z'
const capabilities={optionsContractVersion:1,strictOptions:true,reusePolicy:'same-effective-options'}
const combinations=[{startCreator:false,configureCodex:false},{startCreator:true,configureCodex:false},{startCreator:false,configureCodex:true},{startCreator:true,configureCodex:true}]
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
const started=(effectiveOptions:EffectiveSetupOptions)=>({operationId,optionsContractVersion:1 as const,effectiveOptions,reused:false})
beforeEach(()=>{setActivePinia(createPinia());projectSetupProvider.value=null})
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();projectSetupProvider.value=null})
describe('strict setup adapter isolated transports',()=>{
 it.each(combinations)('uses exclusive route and frozen exact options %j',async options=>{
  const fetch=vi.fn<ProjectSetupFetch>(async(_path,init)=>init.method==='GET'?json(capabilities):json(started(options),202));const provider=createProjectSetupProvider({fetch})
  const pending=provider.startStrict!(id,options);const result=await pending
  expect(result).toEqual(started(options));expect(fetch.mock.calls.map(c=>[c[0],c[1].method])).toEqual([['/api/setup/options-v1','GET'],['/api/setup/options-v1','POST']]);expect(JSON.parse(fetch.mock.calls[1]![1].body as string)).toEqual({projectId:id,...options})
 });
 it('does not POST to an old server and never falls back to the legacy endpoint',async()=>{
  const fetch=vi.fn<ProjectSetupFetch>(async()=>json({error:'Not found'},404));const provider=createProjectSetupProvider({fetch});await expect(provider.startStrict!(id,combinations[0]!)).rejects.toMatchObject({code:'options-unsupported',outcome:'not-dispatched'});expect(fetch).toHaveBeenCalledTimes(1)
 });
 it('dedicated POST still fails safely if server changes after capability GET',async()=>{
  const fetch=vi.fn<ProjectSetupFetch>(async(_p,i)=>i.method==='GET'?json(capabilities):json({error:'Not found'},404));await expect(createProjectSetupProvider({fetch}).startStrict!(id,combinations[0]!)).rejects.toMatchObject({code:'options-unsupported',outcome:'rejected'});expect(fetch.mock.calls.every(c=>c[0]==='/api/setup/options-v1')).toBe(true)
 });
 it.each(['version','flags','reused','missing'] as const)('rejects unverified 202 %s as UNKNOWN',async kind=>{
  const raw:any=started(combinations[0]!);if(kind==='version')raw.optionsContractVersion=2;if(kind==='flags')raw.effectiveOptions=combinations[3];if(kind==='reused')delete raw.reused;if(kind==='missing')delete raw.effectiveOptions
  const fetch=vi.fn<ProjectSetupFetch>(async(_p,i)=>i.method==='GET'?json(capabilities):json(raw,202));await expect(createProjectSetupProvider({fetch}).startStrict!(id,combinations[0]!)).rejects.toMatchObject({code:'invalid-shape',outcome:'unknown'});expect(fetch).toHaveBeenCalledTimes(2)
 });
 it('maps strict conflict to rejected without exposing private diagnostics',async()=>{
  const fetch=vi.fn<ProjectSetupFetch>(async(_p,i)=>i.method==='GET'?json(capabilities):json({error:'PRIVATE',code:'SETUP_OPTIONS_CONFLICT',retryable:false},409));await expect(createProjectSetupProvider({fetch}).startStrict!(id,combinations[0]!)).rejects.toMatchObject({code:'options-conflict',outcome:'rejected'})
 });
});
async function storeFixture(options:EffectiveSetupOptions,snapshotOptions:EffectiveSetupOptions=options,replyOptions:EffectiveSetupOptions=options){
 const snapshot:SetupSnapshot={id:operationId,projectId:id,projectPath:project.path,stage:'complete',startedAt:time,updatedAt:time,optionsContractVersion:1,effectiveOptions:snapshotOptions,...(snapshotOptions.configureCodex?{mcpName:'cocos-fake'}:{})}
 const provider:ProjectSetupProvider={label:'fake strict setup',register:vi.fn(async()=>project),start:vi.fn(async()=>({operationId})),startStrict:vi.fn(async()=>started(replyOptions)),status:vi.fn(async()=>snapshot),waitForIdle:vi.fn(async()=>{})}
 projectSetupProvider.value=provider;const browser=useCompanionBrowserStore();await browser.connect({label:'fake strict reader',loadProjects:async()=>({projects:[project],statuses:[],dashboard:[],warnings:[]}),loadLogs:async()=>[],loadCounts:async()=>({sessionId:'fake',counts:{},latest:{}}),loadCalls:async()=>({sessionId:'fake',total:0,retained:0,records:[]})})
 const store=useProjectSetupStore(),lane=useProjectOperationLaneStore(),consents={installBridge:true,acknowledgeReuse:true,acknowledgeToolScope:true,...options}
 return {provider,store,lane,consents}
}
describe('strict setup store immutable approvals',()=>{
 it.each(combinations)('completes only matching 202 and GET %j',async options=>{
  vi.useFakeTimers();const {provider,store,lane,consents}=await storeFixture(options);const draft=store.prepareSetup(id,consents)!;expect(draft.effectiveOptions).toEqual(options);expect(Object.isFrozen(draft.effectiveOptions)).toBe(true)
  consents.startCreator=!consents.startCreator;expect(await store.sendSetup(draft,true)).toBe(true);expect(provider.start).not.toHaveBeenCalled();expect(provider.startStrict).toHaveBeenCalledWith(id,options,expect.any(AbortSignal));await vi.advanceTimersByTimeAsync(1000);expect(store.setupReceipt?.phase).toBe('complete');expect(store.setupReceipt?.effectiveOptions).toEqual(options);expect(lane.locked).toBe(false);expect(store.completedSetup?.project.id).toBe(id);expect(!!store.completedUsage).toBe(options.configureCodex)
 });
 it('keeps write barrier on mismatched 202 and never retries',async()=>{
  const {store,lane,provider,consents}=await storeFixture(combinations[0]!,combinations[0]!,combinations[3]!);expect(await store.sendSetup(store.prepareSetup(id,consents),true)).toBe(false);expect(store.setupReceipt?.phase).toBe('unknown');expect(lane.locked).toBe(true);expect(provider.startStrict).toHaveBeenCalledTimes(1);expect(provider.status).not.toHaveBeenCalled();expect(store.completedSetup).toBeNull()
 });
 it('cannot treat mismatched complete snapshot as completed or unlock writes',async()=>{
  vi.useFakeTimers();const {store,lane,consents,provider}=await storeFixture(combinations[0]!,combinations[3]!);expect(await store.sendSetup(store.prepareSetup(id,consents),true)).toBe(true);await vi.advanceTimersByTimeAsync(1000);expect(store.setupReceipt?.phase).toBe('unknown');expect(store.completedSetup).toBeNull();expect(store.completedUsage).toBeNull();expect(lane.locked).toBe(true);expect(provider.startStrict).toHaveBeenCalledTimes(1)
 });
});

describe('real adapter to store contract conflict',()=>{
 it.each(['version','invalid-options','missing','different-flags'])('retains UNKNOWN for GET %s',async kind=>{
  vi.useFakeTimers();const options=combinations[0]!,{store,lane,consents}=await storeFixture(options)
  const raw:any={id:operationId,projectId:id,projectPath:project.path,stage:'complete',startedAt:time,updatedAt:time,optionsContractVersion:1,effectiveOptions:options}
  if(kind==='version')raw.optionsContractVersion=2;if(kind==='invalid-options')raw.effectiveOptions={startCreator:'false',configureCodex:false};if(kind==='missing'){delete raw.optionsContractVersion;delete raw.effectiveOptions}if(kind==='different-flags')raw.effectiveOptions=combinations[3]
  const fetch=vi.fn<ProjectSetupFetch>(async(path,init)=>path==='/api/setup/options-v1'?(init.method==='GET'?json(capabilities):json(started(options),202)):json(raw));projectSetupProvider.value=createProjectSetupProvider({fetch})
  expect(await store.sendSetup(store.prepareSetup(id,consents),true)).toBe(true);await vi.advanceTimersByTimeAsync(1000);expect(store.setupReceipt?.phase).toBe('unknown');expect(store.completedSetup).toBeNull();expect(lane.locked).toBe(true);expect(fetch.mock.calls.filter(c=>c[1].method==='POST')).toHaveLength(1)
 })
})
