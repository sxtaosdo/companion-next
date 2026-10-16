import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { createPinia,setActivePinia } from 'pinia'
import { createMemoryHistory,createRouter,RouterView } from 'vue-router'
import { DOMWrapper,flushPromises,mount,type VueWrapper } from '@vue/test-utils'
import ElementPlus,{ ElMessage } from 'element-plus'
import { createCompanionBrowserProvider,type CompanionFetch } from '../src/adapters/companion-browser'
import type { CompanionBrowserProvider,DashboardProject } from '../src/domain/companion-browser'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { companionBrowserProvider,companionEventProvider,companionProjectEntryProvider,registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { projectSetupProvider,registerProjectSetupProvider } from '../src/project-setup-integration'
import type { ProjectSetupProvider } from '../src/domain/project-setup'
const id='0123456789abcdef',target={id,name:'已登记工程',path:'D:\\Fixture\\Registered'}
const discovered:DashboardProject[]=[
 {path:'d:/fixture/registered/',name:'Dashboard 已登记',source:'dashboard',exists:true,version:'3.8.8',lastOpenedAt:1760000000000},
 {path:'D:\\Fixture\\Unregistered',name:'未登记运行工程',source:'dashboard',exists:true,running:true,pid:1234,version:'3.8.8',progress:'open',lastOpenedAt:1761000000000},
 {path:'D:\\Fixture\\Missing',name:'已移走工程',source:'creator-editor',exists:false},
]
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return {promise,resolve}}
function reader(overrides:Partial<CompanionBrowserProvider>={}):CompanionBrowserProvider{return {
 label:'test existing same-origin reader',runtimeProbesEnabled:true,dashboardDiscoveryEnabled:false,
 loadProjects:vi.fn<CompanionBrowserProvider['loadProjects']>(async()=>({projects:[target],statuses:[{projectId:id,state:'ready',capabilityProfile:'authoring'}],dashboard:[],warnings:[]})),
 loadDashboardProjects:vi.fn(async()=>discovered),loadCounts:vi.fn(async()=>({sessionId:'test-session',counts:{},latest:{}})),
 loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'test-session',total:0,retained:0,records:[]})),...overrides,
}}
let wrapper:VueWrapper|undefined
beforeEach(()=>setActivePinia(createPinia()))
afterEach(()=>{wrapper?.unmount();wrapper=undefined;companionBrowserProvider.value=null;companionEventProvider.value=null;companionProjectEntryProvider.value=null;creatorOperationsProvider.value=null;projectSetupProvider.value=null;ElMessage.closeAll();sessionStorage.clear();document.body.innerHTML='';vi.useRealTimers()})

describe('explicit Dashboard transport, separate from project polling',()=>{
 it('uses only the existing authenticated GET when explicitly requested',async()=>{
  const fetch=vi.fn<CompanionFetch>(async path=>json(path==='/api/projects'?[target]:path==='/api/status'?[]:discovered))
  const api=createCompanionBrowserProvider({fetch,dashboardDiscovery:false})
  expect(fetch).not.toHaveBeenCalled();await api.loadProjects()
  expect(fetch.mock.calls.map(([path])=>path)).toEqual(['/api/projects','/api/status'])
  expect(await api.loadDashboardProjects!()).toEqual(discovered)
  const [path,options]=fetch.mock.calls.at(-1)!
  expect(path).toBe('/api/dashboard/projects');expect(options).toMatchObject({method:'GET',credentials:'same-origin',mode:'same-origin',redirect:'error',cache:'no-store'})
  expect(options.headers).toEqual({Accept:'application/json'})
 })
 it('never registers the discovery capability in passive readonly mode',()=>{
  const fetch=vi.fn<CompanionFetch>(),api=createCompanionBrowserProvider({fetch,runtimeProbes:false,dashboardDiscovery:false})
  expect(api.loadDashboardProjects).toBeUndefined();expect(fetch).not.toHaveBeenCalled()
 })
 it.each([401,403,500])('retains HTTP %s as an explicit read failure',async status=>{
  const api=createCompanionBrowserProvider({fetch:async()=>json({error:'test'},status),dashboardDiscovery:false})
  await expect(api.loadDashboardProjects!()).rejects.toMatchObject({status})
 })
 it.each([[{path:'D:/bad',name:'bad',source:'dashboard'}],[discovered[0],discovered[0]],{projects:discovered}])('rejects invalid or duplicate discovery data',async value=>{
  const api=createCompanionBrowserProvider({fetch:async()=>json(value),dashboardDiscovery:false})
  await expect(api.loadDashboardProjects!()).rejects.toMatchObject({code:'invalid-shape'})
 })
})

describe('Dashboard observation ownership and cancellation',()=>{
 it('keeps discovery manual across connect, refresh, and repeated 3-second status polls',async()=>{
  vi.useFakeTimers();const api=reader(),store=useCompanionBrowserStore();await store.connect(api)
  expect(api.loadDashboardProjects).not.toHaveBeenCalled();await store.refreshDashboard()
  store.startLive({label:'test events',subscribe:()=>()=>{}})
  await vi.advanceTimersByTimeAsync(6500);await store.refreshProjects()
  expect(api.loadDashboardProjects).toHaveBeenCalledTimes(1);expect(store.dashboard).toEqual(discovered)
  expect(store.projects).toEqual([target]);expect(store.dashboardRead).toBe(true);expect(store.dashboardObservedAt).not.toBe('')
 })
 it('coalesces repeated clicks and discards a canceled result',async()=>{
  const pending=deferred<DashboardProject[]>(),api=reader({loadDashboardProjects:vi.fn(()=>pending.promise)}),store=useCompanionBrowserStore()
  await store.connect(api);const first=store.refreshDashboard();await store.refreshDashboard()
  expect(api.loadDashboardProjects).toHaveBeenCalledTimes(1);store.cancelDashboardRead()
  expect(vi.mocked(api.loadDashboardProjects!).mock.calls[0]![0]!.aborted).toBe(true)
  pending.resolve(discovered);await first;expect(store.dashboard).toEqual([]);expect(store.dashboardRead).toBe(false);expect(store.dashboardLoading).toBe(false)
 })
 it('drops the old snapshot on failure while preserving registered projects and their state',async()=>{
  const api=reader(),store=useCompanionBrowserStore();await store.connect(api);await store.refreshDashboard()
  vi.mocked(api.loadDashboardProjects!).mockRejectedValueOnce(Error('Dashboard temporarily unavailable'))
  await store.refreshDashboard();expect(store.dashboard).toEqual([]);expect(store.dashboardRead).toBe(false);expect(store.dashboardError).toContain('unavailable')
  expect(store.connected).toBe(true);expect(store.projects).toEqual([target]);expect(store.statuses[0]!.state).toBe('ready')
 })
 it('isolates a pending old source across disconnect and reconnection',async()=>{
  const pending=deferred<DashboardProject[]>(),old=reader({loadDashboardProjects:vi.fn(()=>pending.promise)}),store=useCompanionBrowserStore()
  await store.connect(old);const reading=store.refreshDashboard();store.disconnect();await store.connect(reader())
  pending.resolve(discovered);await reading;expect(store.dashboard).toEqual([]);expect(store.dashboardRead).toBe(false);expect(store.dashboardError).toBe('')
 })
 it('distinguishes an actual empty response from never read',async()=>{
  const store=useCompanionBrowserStore();await store.connect(reader({loadDashboardProjects:async()=>[]}))
  expect(store.dashboardRead).toBe(false);await store.refreshDashboard();expect(store.dashboardRead).toBe(true);expect(store.dashboard).toEqual([])
 })
})

async function setupUi(source=reader()){
 const pinia=createPinia(),store=useCompanionBrowserStore(pinia)
 const setup:ProjectSetupProvider={label:'test existing registration',register:vi.fn(async()=>target),start:vi.fn(async()=>({operationId:'unused-operation'})),status:vi.fn(),waitForIdle:vi.fn(async()=>{})}
 registerCompanionBrowserProvider(source);registerProjectSetupProvider(setup)
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView},{path:'/elsewhere',component:{template:'<p>Elsewhere</p>'}}]})
 await router.push('/projects');await router.isReady();wrapper=mount(RouterView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}})
 await store.connect(source);await flushPromises();return {store,setup,source,router}
}
function button(text:string){const found=new DOMWrapper(document.body).findAll('button').find(b=>b.text()===text||b.attributes('aria-label')===text);if(!found)throw Error('Missing button '+text);return found}
async function click(text:string){await button(text).trigger('click');await flushPromises()}
const body=()=>new DOMWrapper(document.body)

describe('original Dashboard select-to-registration interaction',()=>{
 it('loads explicitly, labels real state, disables missing paths and only fills the chosen path',async()=>{
  const {setup,source,store}=await setupUi();await click('添加已有工程')
  expect(body().text()).toContain('尚未读取 Dashboard 工程');expect(source.loadDashboardProjects).not.toHaveBeenCalled()
  await click('刷新 Dashboard 工程')
  const items=body().findAll('.dashboard-item');expect(items).toHaveLength(3)
  expect(items[0]!.text()).toContain('Dashboard 已启动 · PID 1234');expect(items[0]!.text()).toContain('Creator 3.8.8');expect(items[0]!.text()).toContain('状态 open')
  const missing=items.find(b=>b.text().includes('已移走工程'))!;expect(missing.attributes('disabled')).toBeDefined();expect(missing.text()).toContain('路径不存在')
  const registered=items.find(b=>b.text().includes('Dashboard 已登记'))!;expect(registered.text()).toContain('已接入 · ready')
  await items[0]!.trigger('click');await flushPromises()
  expect((body().get('input[aria-label="已有工程绝对路径"]').element as HTMLInputElement).value).toBe(discovered[1]!.path)
  expect(setup.register).not.toHaveBeenCalled();expect(setup.start).not.toHaveBeenCalled();expect(store.projects).toEqual([target])
  expect(body().find('[data-testid="registration-confirm"]').exists()).toBe(false)
  await click('核对仅登记');expect(body().get('[data-testid="registration-confirm"]').text()).toContain(discovered[1]!.path)
  expect(setup.register).not.toHaveBeenCalled();await click('关闭向导')
  expect(wrapper!.get('.companion-project-card').text()).not.toContain('最近打开未读取')
 })
 it('shows a failed refresh without stale selectable items or false empty-success text',async()=>{
  const {source}=await setupUi();await click('添加已有工程');await click('刷新 Dashboard 工程')
  vi.mocked(source.loadDashboardProjects!).mockRejectedValueOnce(Error('Discovery failed'))
  await click('刷新 Dashboard 工程');expect(body().findAll('.dashboard-item')).toHaveLength(0)
  expect(body().text()).toContain('Dashboard 工程读取失败');expect(body().text()).not.toContain('本次未读到 Dashboard')
 })
 it('closing or leaving cancels pending discovery and navigation cannot redispatch it',async()=>{
  const pending=deferred<DashboardProject[]>(),source=reader({loadDashboardProjects:vi.fn(()=>pending.promise)})
  const {router,store}=await setupUi(source);await click('添加已有工程');await click('刷新 Dashboard 工程')
  expect(button('刷新 Dashboard 工程').attributes('disabled')).toBeDefined();await click('关闭向导')
  expect(vi.mocked(source.loadDashboardProjects!).mock.calls[0]![0]!.aborted).toBe(true)
  pending.resolve(discovered);await flushPromises();expect(store.dashboard).toEqual([])
  await router.push('/elsewhere');await router.push('/projects');await flushPromises()
  expect(source.loadDashboardProjects).toHaveBeenCalledTimes(1);expect(store.projects).toEqual([target])
 })
 it('renders host text as text and never injects Dashboard HTML',async()=>{
  await setupUi(reader({loadDashboardProjects:async()=>[{...discovered[1]!,name:'<img src=x onerror=alert(1)>'}]}))
  await click('添加已有工程');await click('刷新 Dashboard 工程')
  expect(body().get('.dashboard-item').text()).toContain('<img');expect(body().find('.dashboard-item img').exists()).toBe(false)
 })
})
