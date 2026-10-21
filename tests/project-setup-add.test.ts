import { reactive } from 'vue'
import {beforeEach,afterEach,it,expect,vi} from 'vitest'
import {createPinia,setActivePinia} from 'pinia'
import {useProjectSetupAddStore} from '../src/stores/project-setup-add'
import {useCompanionBrowserStore} from '../src/stores/companion-browser'
import {useProjectOperationLaneStore} from '../src/stores/project-operation-lane'
import {projectSetupProvider} from '../src/project-setup-integration'
import {toolPresetReadProvider} from '../src/tool-presets-read-integration'
import {projectConnectionsProvider} from '../src/project-connections-integration'
import {createProjectSetupProvider,type ProjectSetupFetch} from '../src/adapters/project-setup'
import type {ProjectSetupProvider,SetupSnapshot} from '../src/domain/project-setup'
const path='D:/Fixture/Add',id='0123456789abcdef',operationId='11111111-1111-4111-8111-111111111111',options={startCreator:true,configureCodex:false}
const project={id,path,name:'Add'},preset={id:'full',name:'全部工具',baseProfile:'full' as const,enabled:[],disabled:[],builtIn:true,updatedAt:'1970-01-01T00:00:00.000Z'}
const snap=(stage:SetupSnapshot['stage']='installing-bridge'):SetupSnapshot=>({id:operationId,projectId:id,projectPath:path,stage,startedAt:'',updatedAt:'1970-01-01T00:00:00.000Z',optionsContractVersion:1,effectiveOptions:options})
beforeEach(()=>{vi.useFakeTimers();setActivePinia(createPinia());projectSetupProvider.value=null;toolPresetReadProvider.value=null;projectConnectionsProvider.value=null})
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers()})
async function fixture(registered=false){
 let list=registered?[project]:[]
 const reader={label:'reader',loadProjects:vi.fn(async()=>({projects:list,statuses:[],dashboard:[],warnings:[]})),loadCounts:async()=>({sessionId:'s',counts:{},latest:{}}),loadLogs:async()=>[],loadCalls:async()=>({sessionId:'s',total:0,retained:0,records:[]})}
 const api:ProjectSetupProvider={label:'setup',register:vi.fn(async()=>project),start:vi.fn(async()=>({operationId})),startPathStrict:vi.fn(async()=>({operationId,optionsContractVersion:1 as const,effectiveOptions:options,reused:false})),status:vi.fn(async()=>snap()),waitForIdle:vi.fn(async()=>{})}
 const readScope={label:'scope',loadTools:vi.fn(async()=>[]),loadPresets:vi.fn(async()=>({presets:[preset,{...preset,id:'core',name:'核心工具',baseProfile:'core' as const}],selectedPresetId:'full'})),exportPreset:vi.fn()}
 const connections={label:'connections',run:vi.fn(async()=>({key:'ok',text:'ok'})),waitForIdle:vi.fn(async()=>{})}
 projectSetupProvider.value=api;toolPresetReadProvider.value=readScope;projectConnectionsProvider.value=connections
 const browser=useCompanionBrowserStore();await browser.connect(reader);const store=useProjectSetupAddStore(),lane=useProjectOperationLaneStore()
 return {store,lane,api,browser,reader,readScope,connections,registered:()=>{list=[project]}}
}
it('selects scope without writing then starts one atomic path task with old true/false options',async()=>{
 const {store,api,readScope,lane}=await fixture();expect(await store.prepare(path)).toBe(true)
 expect(readScope.loadPresets).toHaveBeenCalledWith(undefined,expect.any(AbortSignal));expect(api.register).not.toHaveBeenCalled();expect(api.startPathStrict).not.toHaveBeenCalled()
 await store.start();expect(api.startPathStrict).toHaveBeenCalledExactlyOnceWith(path,options,expect.any(AbortSignal));expect(api.register).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled();expect(lane.locked).toBe(true);expect(store.phase).toBe('tracking');await store.start();expect(api.startPathStrict).toHaveBeenCalledOnce()
})
it('persists preselected scope only after real completion and actual registration readback',async()=>{
 const {store,api,connections,registered,lane}=await fixture();await store.prepare(path);await store.start();registered();vi.mocked(api.status).mockResolvedValue(snap('complete'))
 await vi.advanceTimersByTimeAsync(1000);expect(store.phase).toBe('complete');expect(store.project).toEqual(project);expect(lane.locked).toBe(false)
 expect(connections.run).toHaveBeenCalledExactlyOnceWith({kind:'setup-scope',projectId:id,setupOperationId:operationId,preset},expect.any(AbortSignal));expect(api.register).not.toHaveBeenCalled()
})
it('preserves existing scope without writing if the selection was not explicitly changed',async()=>{
 const {store,api,connections,lane}=await fixture(true);await store.prepare(path);await store.start();vi.mocked(api.status).mockResolvedValue(snap('complete'));await vi.advanceTimersByTimeAsync(1000)
 expect(store.phase).toBe('complete');expect(connections.run).not.toHaveBeenCalled();expect(lane.locked).toBe(false)
})
it('cannot turn a lost POST or an unknown scope write into a retry',async()=>{
 const f=await fixture();await f.store.prepare(path);f.api.startPathStrict=vi.fn(async()=>{throw Error('lost')});await f.store.start();expect(f.store.phase).toBe('unknown');expect(f.lane.locked).toBe(true);await f.store.start();expect(f.api.startPathStrict).toHaveBeenCalledOnce();expect(f.store.canResume).toBe(false)
})
it('only resumes original status after pause, rejects foreign paths/options and never repeats setup',async()=>{
 const {store,api,lane}=await fixture();await store.prepare(path);await store.start();store.pause();expect(store.canResume).toBe(true)
 vi.mocked(api.status).mockResolvedValue({...snap(),projectPath:'D:/Other'});await store.resume();expect(store.phase).toBe('paused');expect(lane.locked).toBe(true);expect(api.startPathStrict).toHaveBeenCalledOnce()
 vi.mocked(api.status).mockResolvedValue({...snap(),effectiveOptions:{startCreator:true,configureCodex:true}});await store.resume();expect(store.phase).toBe('paused');expect(api.startPathStrict).toHaveBeenCalledOnce()
})
it('does not replay a scope write whose response was lost',async()=>{
 const {store,api,connections,registered,lane}=await fixture();await store.prepare(path);await store.start();registered();vi.mocked(api.status).mockResolvedValue(snap('complete'));connections.run=vi.fn(async()=>{throw Error('lost scope')})
 await vi.advanceTimersByTimeAsync(1000);expect(store.phase).toBe('paused');await store.resume();expect(connections.run).toHaveBeenCalledOnce();expect(lane.locked).toBe(true);expect(store.phase).not.toBe('complete')
})
it('invalidates an unlaunched path preview when source changes',async()=>{
 const {store,browser,api}=await fixture();await store.prepare(path);browser.disconnect();expect(store.canStart).toBe(false);await store.start();expect(api.startPathStrict).not.toHaveBeenCalled()
})
it('sends exactly strict capability GET and one path POST, with no pre-registration or Codex',async()=>{
 const fetch=vi.fn<ProjectSetupFetch>(async(_url,init)=>new Response(JSON.stringify(init.method==='GET'?{optionsContractVersion:1,strictOptions:true,reusePolicy:'same-effective-options'}:{operationId,optionsContractVersion:1 as const,effectiveOptions:options,reused:false}),{status:init.method==='GET'?200:202,headers:{'content-type':'application/json'}}))
 await createProjectSetupProvider({fetch}).startPathStrict!(path,options);expect(fetch).toHaveBeenCalledTimes(2);expect(JSON.parse(fetch.mock.calls[1]![1].body as string)).toEqual({projectPath:path,...options});expect(fetch.mock.calls.every(c=>c[0]==='/api/setup/options-v1')).toBe(true)
})

it('fences a dispatched operation when a provider label changes in place, including ABA',async()=>{
 const f=await fixture();const live=reactive(f.api);projectSetupProvider.value=live;await f.store.prepare(path);await f.store.start();const original=live.label;Reflect.set(live,'label','changed');expect(f.store.phase).toBe('unknown');expect(f.lane.locked).toBe(true);Reflect.set(live,'label',original);await f.store.start();expect(f.api.startPathStrict).toHaveBeenCalledOnce()
})
it('does not start a new project if its required scope writer is unavailable',async()=>{
 const f=await fixture();projectConnectionsProvider.value=null;await f.store.prepare(path);expect(f.store.canStart).toBe(false);await f.store.start();expect(f.api.startPathStrict).not.toHaveBeenCalled();expect(f.api.register).not.toHaveBeenCalled()
})
