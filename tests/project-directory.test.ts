import { afterEach,describe,expect,it,vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory,createRouter,RouterView } from 'vue-router'
import { DOMWrapper,flushPromises,mount,type VueWrapper } from '@vue/test-utils'
import ElementPlus,{ ElMessage } from 'element-plus'
import { createProjectSetupProvider,type ProjectSetupFetch } from '../src/adapters/project-setup'
import { ProjectSetupError,type ProjectSetupProvider } from '../src/domain/project-setup'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useProjectSetupStore } from '../src/stores/project-setup'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { companionBrowserProvider,companionEventProvider,companionProjectEntryProvider,registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { projectSetupProvider,registerProjectSetupProvider } from '../src/project-setup-integration'
const target={id:'0123456789abcdef',name:'Registered',path:'D:\\Fixture\\Registered'}
const chosen='D:\\Fixture\\未登记工程',original='D:\\Fixture\\Original'
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve}}
let wrapper:VueWrapper|undefined
afterEach(()=>{wrapper?.unmount();wrapper=undefined;companionBrowserProvider.value=null;companionEventProvider.value=null;companionProjectEntryProvider.value=null;creatorOperationsProvider.value=null;projectSetupProvider.value=null;ElMessage.closeAll();sessionStorage.clear();document.body.innerHTML='';vi.useRealTimers()})

describe('original native directory endpoint, controlled transports only',()=>{
 it('is passive until explicitly called and sends the original empty same-origin POST',async()=>{
  const fetch=vi.fn<ProjectSetupFetch>(async()=>json({path:chosen})),api=createProjectSetupProvider({fetch})
  expect(fetch).not.toHaveBeenCalled();expect(await api.pickDirectory!()).toBe(chosen)
  expect(fetch).toHaveBeenCalledTimes(1)
  const [url,init]=fetch.mock.calls[0]!
  expect(url).toBe('/api/pick-directory');expect(init).toMatchObject({method:'POST',body:'{}',credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error'})
  expect(init.headers).toEqual({Accept:'application/json','Content-Type':'application/json'});expect(init.signal).toBeInstanceOf(AbortSignal)
  await api.waitForIdle();expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('returns a distinct user cancel without synthesizing a path',async()=>{
  const api=createProjectSetupProvider({fetch:async()=>json({cancelled:true})});expect(await api.pickDirectory!()).toBeUndefined()
 })
 it.each([{},null,[],{path:''},{path:'relative'},{cancelled:false},{path:chosen,cancelled:true},{path:chosen,token:'PRIVATE'}])('rejects ambiguous or invalid directory replies',async value=>{
  await expect(createProjectSetupProvider({fetch:async()=>json(value)}).pickDirectory!()).rejects.toMatchObject({code:'invalid-shape'})
 })
 it.each([403,500])('keeps HTTP %s as a failure without raw diagnostics',async status=>{
  const raw=status===403?{error:'Forbidden'}:{error:'PRIVATE credentials'}
  try{await createProjectSetupProvider({fetch:async()=>json(raw,status)}).pickDirectory!();throw Error('should fail')}catch(error){expect(error).toBeInstanceOf(ProjectSetupError);expect(String(error)).not.toContain('PRIVATE');expect(error).toMatchObject({code:status===403?'forbidden':'backend-failure'})}
 })
 it('keeps waiting for the user beyond the generic timeout without aborting the native request',async()=>{
  vi.useFakeTimers();const held=deferred<Response>(),fetch=vi.fn<ProjectSetupFetch>(()=>held.promise),api=createProjectSetupProvider({fetch,timeoutMs:20})
  const picking=api.pickDirectory!()
  await vi.advanceTimersByTimeAsync(120_001)
  expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(false)
  await expect(api.pickDirectory!()).rejects.toMatchObject({code:'busy',outcome:'not-dispatched'})
  expect(fetch).toHaveBeenCalledTimes(1);held.resolve(json({path:chosen}));expect(await picking).toBe(chosen);await api.waitForIdle();expect(fetch).toHaveBeenCalledTimes(1)
 })
})

async function setup(pick:()=>Promise<string|undefined>=async()=>chosen){
 const source:CompanionBrowserProvider={label:'controlled existing source',runtimeProbesEnabled:true,dashboardDiscoveryEnabled:false,
  loadProjects:vi.fn(async()=>({projects:[target],statuses:[],dashboard:[],warnings:[]})),loadCounts:vi.fn(async()=>({sessionId:'test',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'test',total:0,retained:0,records:[]}))}
 const api:ProjectSetupProvider={label:'controlled original setup',pickDirectory:vi.fn(pick),register:vi.fn(async()=>target),start:vi.fn(),status:vi.fn(),waitForIdle:vi.fn(async()=>{})}
 registerCompanionBrowserProvider(source);registerProjectSetupProvider(api)
 const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView},{path:'/elsewhere',component:{template:'<p>Elsewhere</p>'}}]})
 await router.push('/projects');await router.isReady();wrapper=mount(RouterView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}})
 const projects=useCompanionBrowserStore(pinia);await projects.connect(source);await flushPromises()
 return {api,source,projects,router,lane:useProjectOperationLaneStore(pinia),store:useProjectSetupStore(pinia)}
}
const body=()=>new DOMWrapper(document.body)
function button(text:string){const value=body().findAll('button').find(b=>b.text()===text||b.attributes('aria-label')===text);if(!value)throw Error('Missing '+text);return value}
async function click(text:string){await button(text).trigger('click');await flushPromises();if(text==='添加已有工程'){await button('下一步').trigger('click');await flushPromises()}}
const input=()=>body().get('input[aria-label="已有工程绝对路径"]')
const pathValue=()=>(input().element as HTMLInputElement).value

describe('original select-directory interaction in the existing wizard',()=>{
 it('only fills the path, invalidates the old registration confirmation and leaves all writes explicit',async()=>{
  const {api,store}=await setup();expect(api.pickDirectory).not.toHaveBeenCalled();await click('添加已有工程')
  await input().setValue(original);await click('核对仅登记');expect(store.preparedRegistration?.path).toBe(original)
  await click('选择目录…');expect(pathValue()).toBe(chosen);expect(store.preparedRegistration).toBeNull()
  expect(api.register).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled();expect(api.status).not.toHaveBeenCalled()
  await click('核对仅登记');expect(store.preparedRegistration?.path).toBe(chosen);expect(api.register).not.toHaveBeenCalled()
 })
 it('cancel keeps the existing input and causes no registration or refresh',async()=>{
  const {api,source}=await setup(async()=>undefined);await click('添加已有工程');await input().setValue(original);await click('选择目录…')
  expect(pathValue()).toBe(original);expect(api.register).not.toHaveBeenCalled();expect(source.loadProjects).toHaveBeenCalledTimes(1)
 })
 it('coalesces repeated clicks and holds the lane until actual client cleanup',async()=>{
  const pending=deferred<string|undefined>(),idle=deferred<void>(),{api,lane}=await setup(()=>pending.promise)
  api.waitForIdle=vi.fn(()=>idle.promise);await click('添加已有工程');await click('选择目录…');await click('选择目录…')
  expect(api.pickDirectory).toHaveBeenCalledTimes(1);expect(lane.locked).toBe(true);expect(button('核对仅登记').attributes('disabled')).toBeDefined()
  pending.resolve(chosen);await flushPromises();expect(lane.locked).toBe(true);idle.resolve();await flushPromises();expect(lane.locked).toBe(false)
 })
 it('closing discards a late path without claiming to close the system dialog',async()=>{
  const pending=deferred<string|undefined>(),{api,lane}=await setup(()=>pending.promise);await click('添加已有工程');await input().setValue(original)
  await click('选择目录…');await click('关闭向导');expect(lane.locked).toBe(true)
  pending.resolve(chosen);await flushPromises();expect(lane.locked).toBe(false);await click('添加已有工程');expect(pathValue()).toBe(original);expect(api.pickDirectory).toHaveBeenCalledTimes(1)
 })
 it('navigation keeps pending exclusion and never dispatches or applies an old result on return',async()=>{
  const pending=deferred<string|undefined>(),{api,lane,router}=await setup(()=>pending.promise);await click('添加已有工程');await click('选择目录…')
  await router.push('/elsewhere');await flushPromises();expect(lane.locked).toBe(true);await router.push('/projects');await flushPromises()
  expect(button('添加已有工程').attributes('disabled')).toBeDefined();pending.resolve(chosen);await flushPromises();expect(lane.locked).toBe(false)
  await click('添加已有工程');expect(pathValue()).not.toBe(chosen);expect(api.pickDirectory).toHaveBeenCalledTimes(1);expect(api.register).not.toHaveBeenCalled()
 })
 it('source changes discard a late selection',async()=>{
  const pending=deferred<string|undefined>(),{projects,source}=await setup(()=>pending.promise);await click('添加已有工程');await input().setValue(original);await click('选择目录…')
  projects.disconnect();await projects.connect({...source,label:'new source'});pending.resolve(chosen);await flushPromises();expect(pathValue()).toBe(original)
 })
 it('failed native request is explicit, retains input and never retries automatically',async()=>{
  const {api,lane}=await setup(async()=>{throw new ProjectSetupError('network-error')});await click('添加已有工程');await input().setValue(original);await click('选择目录…')
  expect(pathValue()).toBe(original);expect(body().text()).toContain('请先核对原系统窗口');expect(lane.locked).toBe(true);await click('选择目录…');expect(api.pickDirectory).toHaveBeenCalledTimes(1);expect(api.register).not.toHaveBeenCalled()
 })
 it('rejects an invalid custom provider path before it can replace the input',async()=>{
  await setup(async()=>'relative');await click('添加已有工程');await input().setValue(original);await click('选择目录…');expect(pathValue()).toBe(original);expect(body().text()).toContain('无效')
 })
 it('does not expose a native picker when the current provider lacks the capability',async()=>{
  const {api}=await setup();delete api.pickDirectory;await click('添加已有工程');expect(body().findAll('button').some(b=>b.text()==='选择目录…')).toBe(false)
 })
})
