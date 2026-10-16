import {afterEach,describe,expect,it,vi} from 'vitest'
import {createPinia} from 'pinia'
import {DOMWrapper,flushPromises,mount,type VueWrapper} from '@vue/test-utils'
import {createMemoryHistory,createRouter,RouterView} from 'vue-router'
import ElementPlus,{ElMessage} from 'element-plus'
import {createProjectSetupProvider,type ProjectSetupFetch} from '../src/adapters/project-setup'
import {ProjectSetupError,type ProjectScaffoldInput,type ProjectSetupProvider} from '../src/domain/project-setup'
import type {CompanionBrowserProvider} from '../src/domain/companion-browser'
import {companionBrowserProvider,companionEventProvider,companionProjectEntryProvider,registerCompanionBrowserProvider} from '../src/companion-browser-integration'
import {creatorOperationsProvider} from '../src/creator-operations-integration'
import {projectSetupProvider,registerProjectSetupProvider} from '../src/project-setup-integration'
import {useCompanionBrowserStore} from '../src/stores/companion-browser'
import {useProjectScaffoldStore} from '../src/stores/project-scaffold'
import {useProjectOperationLaneStore} from '../src/stores/project-operation-lane'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
const target={id:'0123456789abcdef',name:'Existing',path:'D:\\Fixture\\Existing'},parent='D:\\Fixture',created='D:\\Fixture\\新工程'
const create:ProjectScaffoldInput={mode:'create',parentPath:parent,projectName:'新工程',creatorVersion:'3.8.8'}
const initialize:ProjectScaffoldInput={mode:'initialize',path:'D:\\Fixture\\Empty',creatorVersion:'3.8.8'}
const reply={path:created,creatorVersion:'3.8.8' as const}
const json=(value:unknown,status=201)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>resolve=done);return {promise,resolve}}
let wrapper:VueWrapper|undefined
afterEach(()=>{wrapper?.unmount();wrapper=undefined;companionBrowserProvider.value=null;projectSetupProvider.value=null;companionEventProvider.value=null;companionProjectEntryProvider.value=null;creatorOperationsProvider.value=null;ElMessage.closeAll();sessionStorage.clear();document.body.innerHTML='';vi.useRealTimers()})

describe('original scaffold adapter with controlled transports',()=>{
 it.each([create,initialize])('sends only the fixed same-origin $mode request and requires201',async input=>{
  const fetch=vi.fn<ProjectSetupFetch>(async()=>json(reply)),api=createProjectSetupProvider({fetch})
  expect(fetch).not.toHaveBeenCalled();expect(await api.scaffold!(input)).toEqual(reply);expect(fetch).toHaveBeenCalledOnce()
  expect(fetch.mock.calls[0]).toEqual(['/api/projects/scaffold',expect.objectContaining({method:'POST',body:JSON.stringify(input),credentials:'same-origin',mode:'same-origin',redirect:'error',cache:'no-store'})]);await api.waitForIdle()
 })
 it.each(['','../escape','a/b','a\\b','CON','NUL.png','bad.',' bad','bad?'])('rejects unsafe segment %s before dispatch',async projectName=>{
  const fetch=vi.fn<ProjectSetupFetch>();await expect(createProjectSetupProvider({fetch}).scaffold!({...create,projectName})).rejects.toMatchObject({code:'invalid-input',outcome:'not-dispatched'});expect(fetch).not.toHaveBeenCalled()
 })
 it.each([{...create,creatorVersion:'3.9.0'},{...create,parentPath:'relative'},{...create,command:'PRIVATE'},{...initialize,path:'relative'},{...initialize,parentPath:parent}])('rejects altered contracts before dispatch',async input=>{
  const fetch=vi.fn<ProjectSetupFetch>();await expect(createProjectSetupProvider({fetch}).scaffold!(input as never)).rejects.toMatchObject({outcome:'not-dispatched'});expect(fetch).not.toHaveBeenCalled()
 })
 it.each([null,{},[],{path:'relative',creatorVersion:'3.8.8'},{...reply,creatorVersion:'3.8.7'},{...reply,token:'PRIVATE'}])('keeps malformed replies uncertain',async raw=>{
  await expect(createProjectSetupProvider({fetch:async()=>json(raw)}).scaffold!(create)).rejects.toMatchObject({code:'invalid-shape',outcome:'unknown'})
 })
 it('requires201 and never exposes raw backend errors',async()=>{
  await expect(createProjectSetupProvider({fetch:async()=>json(reply,200)}).scaffold!(create)).rejects.toMatchObject({code:'invalid-shape',outcome:'unknown'})
  try{await createProjectSetupProvider({fetch:async()=>json({error:'PRIVATE credentials'},500)}).scaffold!(create);throw Error('expected rejection')}catch(error){expect(error).toBeInstanceOf(ProjectSetupError);expect(String(error)).not.toContain('PRIVATE');expect(error).toMatchObject({outcome:'unknown'})}
 })
 it('shares transport exclusion with register and the native directory picker',async()=>{
  const held=deferred<Response>(),fetch=vi.fn<ProjectSetupFetch>(()=>held.promise),api=createProjectSetupProvider({fetch}),pending=api.scaffold!(create)
  await expect(api.register(target.path)).rejects.toMatchObject({code:'busy'});await expect(api.pickDirectory!()).rejects.toMatchObject({code:'busy'})
  held.resolve(json(reply));await pending;await api.waitForIdle();expect(fetch).toHaveBeenCalledOnce()
 })
 it('does not release unfinished client cleanup after the filesystem request times out',async()=>{
  vi.useFakeTimers();const held=deferred<Response>(),api=createProjectSetupProvider({fetch:()=>held.promise,timeoutMs:20}),outcome=api.scaffold!(create).catch(error=>error)
  await vi.advanceTimersByTimeAsync(21);expect(await outcome).toMatchObject({code:'timeout',outcome:'unknown'});await expect(api.register(target.path)).rejects.toMatchObject({code:'busy'})
  held.resolve(json(reply));await api.waitForIdle()
 })
})

async function setup(dispatch:NonNullable<ProjectSetupProvider['scaffold']>=async()=>reply,ui=false){
 const source:CompanionBrowserProvider={label:'controlled original source',runtimeProbesEnabled:true,dashboardDiscoveryEnabled:false,loadProjects:vi.fn(async()=>({projects:[target],statuses:[],dashboard:[],warnings:[]})),loadCounts:vi.fn(async()=>({sessionId:'test',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'test',total:0,retained:0,records:[]}))}
 const api:ProjectSetupProvider={label:'controlled scaffold',scaffold:vi.fn(dispatch),pickDirectory:vi.fn(async()=>parent),register:vi.fn(async()=>target),start:vi.fn(),status:vi.fn(),waitForIdle:vi.fn(async()=>{})}
 registerCompanionBrowserProvider(source);registerProjectSetupProvider(api)
 const pinia=createPinia(),projects=useCompanionBrowserStore(pinia),store=useProjectScaffoldStore(pinia),lane=useProjectOperationLaneStore(pinia)
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView},{path:'/elsewhere',component:{template:'<p>Elsewhere</p>'}}]});await router.push('/projects');await router.isReady()
 if(ui)wrapper=mount(RouterView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}})
 await projects.connect(source);await flushPromises();return {api,source,projects,store,lane,router}
}
describe('scaffold approval and same-session uncertainty',()=>{
 it('consumes only the exact approved preview once and never auto-registers',async()=>{
  const {store,api}=await setup(),preview=store.prepare(create)!
  expect(api.scaffold).not.toHaveBeenCalled();expect(await store.send({...preview},true)).toBeNull();expect(await store.send(preview,false)).toBeNull()
  expect(await store.send(preview,true)).toEqual(reply);expect(await store.send(preview,true)).toBeNull();expect(api.scaffold).toHaveBeenCalledOnce();expect(api.register).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled()
 })
 it('freezes approved input and retains the lane while the original write is pending',async()=>{
  const held=deferred<typeof reply>(),{store,api,lane}=await setup(()=>held.promise),preview=store.prepare({...create})!
  expect(Object.isFrozen(preview.input)).toBe(true);const pending=store.send(preview,true);expect(lane.locked).toBe(true);expect(store.prepared).toBeNull();expect(store.prepare(initialize)).toBeNull()
  held.resolve(reply);await pending;expect(lane.locked).toBe(false);expect(api.scaffold).toHaveBeenCalledOnce()
 })
 it('invalidates unsent approval when the source method changes',async()=>{
  const {store,api}=await setup(),preview=store.prepare(create)!;api.scaffold=vi.fn(async()=>reply);expect(await store.send(preview,true)).toBeNull();expect(api.scaffold).not.toHaveBeenCalled()
 })
 it.each([new ProjectSetupError('network-error'),new ProjectSetupError('backend-failure'),null,{path:'relative',creatorVersion:'3.8.8'},{...reply,creatorVersion:'3.8.7'}])('retains exclusion after an unknown or invalid result',async response=>{
  const {store,api,lane}=await setup(async()=>{if(response instanceof Error)throw response;return response as never});await store.send(store.prepare(create),true)
  expect(lane.locked).toBe(true);expect(store.receipt?.phase).toBe('unknown');expect(store.prepare(initialize)).toBeNull();expect(api.scaffold).toHaveBeenCalledOnce()
 })
 it('releases a confirmed rejection only after cleanup',async()=>{
  const held=deferred<void>(),{store,api,lane}=await setup(async()=>{throw new ProjectSetupError('forbidden','rejected')});api.waitForIdle=vi.fn(()=>held.promise)
  const pending=store.send(store.prepare(create),true);await flushPromises();expect(lane.locked).toBe(true);held.resolve();await pending;expect(lane.locked).toBe(false);expect(store.receipt?.phase).toBe('rejected')
 })
 it('does not release a known result when client cleanup fails',async()=>{
  const {store,api,lane}=await setup();api.waitForIdle=vi.fn(async()=>{throw Error('PRIVATE')});await store.send(store.prepare(create),true)
  expect(lane.locked).toBe(true);expect(store.receipt?.phase).toBe('acknowledged');expect(store.error).not.toContain('PRIVATE')
 })
})
const body=()=>new DOMWrapper(document.body)
function button(text:string){const found=body().findAll('button').find(node=>node.text()===text);if(!found)throw Error('Missing '+text);return found}
async function click(text:string){await button(text).trigger('click');await flushPromises()}
async function chooseSource(mode:string){await body().get(`input[value="${mode}"]`).setValue(true);await flushPromises()}
const pathInput=()=>body().get('input[aria-label="已有工程绝对路径"]')
async function prepareCreate(){await click('添加已有工程');await chooseSource('create');await body().get('input[aria-label="新工程父目录"]').setValue(parent);await body().get('input[aria-label="新工程名称"]').setValue('新工程');await click('核对创建工程')}
describe('four original source choices and explicit continuation',()=>{
 it('creates only after confirmation then fills the registration path with no follow-on write',async()=>{
  const {api}=await setup(undefined,true);await prepareCreate();expect(api.scaffold).not.toHaveBeenCalled();expect(body().text()).toContain('请求目标：'+created)
  await click('确认创建工程');expect((pathInput().element as HTMLInputElement).value).toBe(created);expect(api.scaffold).toHaveBeenCalledWith(create);expect(api.register).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled();expect(api.status).not.toHaveBeenCalled();expect(body().get('[data-testid="scaffold-receipt"]').text()).toContain('尚未登记')
 })
 it('initializes the explicitly supplied empty directory through the old mode',async()=>{
  const {api}=await setup(async()=>({path:initialize.path,creatorVersion:'3.8.8'}),true);await click('添加已有工程');await chooseSource('initialize');await pathInput().setValue(initialize.path)
  await click('核对初始化目录');expect(api.scaffold).not.toHaveBeenCalled();await click('确认初始化空目录');expect(api.scaffold).toHaveBeenCalledWith(initialize);expect(api.register).not.toHaveBeenCalled()
 })
 it('selects a parent directory without changing the registration path or creating files',async()=>{
  const {api}=await setup(undefined,true);await click('添加已有工程');await pathInput().setValue(target.path);await chooseSource('create');await click('选择父目录…')
  expect((body().get('input[aria-label="新工程父目录"]').element as HTMLInputElement).value).toBe(parent);expect((pathInput().element as HTMLInputElement).value).toBe(target.path);expect(api.scaffold).not.toHaveBeenCalled()
 })
 it('invalidates prepared approval on a form edit',async()=>{
  const {api}=await setup(undefined,true);await prepareCreate();await body().get('input[aria-label="新工程名称"]').setValue('Other');expect(body().find('[data-testid="scaffold-confirm"]').exists()).toBe(false);expect(api.scaffold).not.toHaveBeenCalled()
 })
 it('keeps a late result as history after close and never fills a reopened form',async()=>{
  const held=deferred<typeof reply>(),{api,lane}=await setup(()=>held.promise,true);await prepareCreate();await click('确认创建工程');expect(lane.locked).toBe(true);await click('关闭向导')
  held.resolve(reply);await flushPromises();expect(lane.locked).toBe(false);await click('添加已有工程');expect((pathInput().element as HTMLInputElement).value).not.toBe(created);expect(body().get('[data-testid="scaffold-receipt"]').text()).toContain(created);expect(api.scaffold).toHaveBeenCalledOnce();expect(api.register).not.toHaveBeenCalled()
 })
 it('keeps exclusion across navigation until the original response and never applies its old path',async()=>{
  const held=deferred<typeof reply>(),{router,lane,api}=await setup(()=>held.promise,true);await prepareCreate();await click('确认创建工程');await router.push('/elsewhere');await flushPromises();expect(lane.locked).toBe(true)
  held.resolve(reply);await flushPromises();expect(lane.locked).toBe(false);await router.push('/projects');await flushPromises();await click('添加已有工程');expect((pathInput().element as HTMLInputElement).value).not.toBe(created);expect(api.scaffold).toHaveBeenCalledOnce()
 })
 it('never applies a result after replacing the reader source',async()=>{
  const held=deferred<typeof reply>(),{projects,source,api}=await setup(()=>held.promise,true);await prepareCreate();await click('确认创建工程');projects.disconnect();await projects.connect({...source,label:'different source'});held.resolve(reply);await flushPromises()
  expect((pathInput().element as HTMLInputElement).value).not.toBe(created);expect(api.register).not.toHaveBeenCalled()
 })
 it('does not offer confirmation without the original scaffold capability',async()=>{
  const {api}=await setup(undefined,true);delete api.scaffold;await prepareCreate();expect(button('核对创建工程').attributes('disabled')).toBeDefined();expect(body().find('[data-testid="scaffold-confirm"]').exists()).toBe(false)
 })
})
