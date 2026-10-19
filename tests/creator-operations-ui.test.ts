import { afterEach,describe,expect,it,vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory,createRouter } from 'vue-router'
import { DOMWrapper,flushPromises,mount,type VueWrapper } from '@vue/test-utils'
import ElementPlus,{ ElMessage } from 'element-plus'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { companionBrowserProvider,companionEventProvider,registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { creatorOperationsProvider,registerCreatorOperationsProvider } from '../src/creator-operations-integration'
import { projectSetupProvider } from '../src/project-setup-integration'
import type { CompanionBrowserProvider,ManagedStatus } from '../src/domain/companion-browser'
import type { CreatorOperationReply,CreatorOperationsProvider } from '../src/domain/creator-operations'
import { CreatorOperationError } from '../src/domain/creator-operations'
const id='0123456789abcdef'
let wrapper:VueWrapper|undefined
function writer():CreatorOperationsProvider{return {label:'fake v150 actions',run:vi.fn<CreatorOperationsProvider['run']>(async input=>input.action==='focus'?{action:'focus',acknowledged:true}:input.action==='open-folder'?{action:'open-folder',acknowledged:true,path:'D:\\Fixture\\Game'}:input.action==='remove-registration'?{action:'remove-registration',removed:true}:{action:input.action,runtime:{projectId:id,state:input.action==='stop'?'stopped':'bridge-wait',capabilityProfile:'unknown'}}),waitForIdle:vi.fn(async()=>{})}}
async function setup(state:ManagedStatus['state']='stopped',enable=true){
 let runtime:ManagedStatus={projectId:id,state,capabilityProfile:'read-only',...(state==='ready'?{pid:123,creatorVersion:'3.8.8'}:{})}
 const reader:CompanionBrowserProvider={label:'fake real-shape status',runtimeProbesEnabled:true,dashboardDiscoveryEnabled:false,loadProjects:vi.fn(async()=>({projects:[{id,name:'待操作工程',path:'D:\\Fixture\\Game'}],statuses:[{...runtime}],dashboard:[],warnings:[]})),loadCounts:vi.fn(async()=>({sessionId:'s1',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'s1',total:0,retained:0,records:[]}))}
 const api=writer();registerCompanionBrowserProvider(reader);if(enable)registerCreatorOperationsProvider(api)
 const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView},{path:'/elsewhere',component:{template:'<p>Other</p>'}}]})
 await router.push('/projects');await router.isReady();wrapper=mount(CompanionBrowserView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}});await flushPromises()
 return {api,reader,router,pinia,projects:useCompanionBrowserStore(pinia),operations:useCreatorOperationsStore(pinia),setRuntime:(value:ManagedStatus)=>{runtime=value}}
}
const body=()=>new DOMWrapper(document.body)
function button(text:string){const b=body().findAll('button').find(b=>b.isVisible()&&(b.text()===text||b.attributes('aria-label')===text));if(!b)throw Error(`Missing button ${text}`);return b}
async function click(text:string){await button(text).trigger('click');await flushPromises()}
function dialog(){const found=body().findAll('[role="dialog"]').find(item=>item.isVisible());if(!found)throw Error('Missing visible dialog');return found}
const toastText=()=>body().findAll('.el-message__content').filter(item=>item.isVisible()).map(item=>item.text()).join('\n')
async function tip(label:string){const trigger=button(label);await trigger.trigger('click');await flushPromises();const id=trigger.attributes('aria-describedby');expect(id).toBeTruthy();const content=document.getElementById(id!);expect(content).not.toBeNull();return content!.textContent??''}
function expectNoDialog(){expect(body().findAll('[role="dialog"]').filter(item=>item.isVisible())).toHaveLength(0)}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;ElMessage.closeAll();projectSetupProvider.value=null;creatorOperationsProvider.value=null;companionBrowserProvider.value=null;companionEventProvider.value=null;vi.restoreAllMocks();sessionStorage.clear();document.body.innerHTML='';vi.useRealTimers()})
describe('normal Creator operations use a compact explicit action flow',()=>{
 it('keeps readonly UI without lifecycle controls',async()=>{
  const {api,projects,reader}=await setup('stopped',false);await projects.connect(reader);await flushPromises()
  expect(wrapper!.findAll('button').some(x=>['启动 Creator','打开目录','移除登记','操作记录'].includes(x.text()))).toBe(false)
  expect(api.run).not.toHaveBeenCalled()
 })
 it('requires an explicit connection and exposes accessible icon actions without dispatching',async()=>{
  const {api,reader}=await setup();expect(reader.loadProjects).not.toHaveBeenCalled();await click('连接工程服务')
  expect(wrapper!.text()).toContain('已停止');expect(button('启动 Creator').attributes('disabled')).toBeUndefined()
  for(const label of ['刷新真实状态','聚焦 Creator','停止 Creator','重启 Creator']){expect(button(label).attributes('aria-label')).toBe(label);expect(button(label).text()).toBe('')}
  expectNoDialog();expect(api.run).not.toHaveBeenCalled()
 })
 it('one start click sends exactly the original action, shows no second dialog and rereads actual status',async()=>{
  const {api,projects,reader,operations,setRuntime}=await setup();await projects.connect(reader);await flushPromises()
  setRuntime({projectId:id,state:'error',capabilityProfile:'unknown'});await click('启动 Creator')
  expect(api.run).toHaveBeenCalledTimes(1);expect(api.run).toHaveBeenCalledWith({projectId:id,action:'start'},expect.any(AbortSignal))
  expect(operations.dialogOpen).toBe(false);expect(operations.prepared).toBeNull();expectNoDialog()
  expect(reader.loadProjects).toHaveBeenCalledTimes(2);expect(projects.statuses[0]?.state).toBe('error')
  expect(body().find('[data-testid="creator-last-receipt"]').exists()).toBe(false)
  expect(toastText()).toContain('已收到启动回执');expect(toastText()).not.toMatch(/已就绪|启动成功/)
 })
 it('direct start and focus never invoke the separately registered installation flow',async()=>{
  const setupApi={label:'independent setup',register:vi.fn(),start:vi.fn(),status:vi.fn(),waitForIdle:vi.fn(async()=>{})};projectSetupProvider.value=setupApi
  const {api,reader,projects,setRuntime}=await setup();await projects.connect(reader);await flushPromises()
  setRuntime({projectId:id,state:'ready',capabilityProfile:'read-only'});await click('启动 Creator');await click('打开 Creator')
  expect(api.run).toHaveBeenCalledTimes(2);expect(setupApi.register).not.toHaveBeenCalled();expect(setupApi.start).not.toHaveBeenCalled();expect(setupApi.status).not.toHaveBeenCalled()
  expectNoDialog()
 })
 it.each([['stopped','启动 Creator','start'],['ready','打开 Creator','focus']] as const)('shows %s loading, blocks repeats and retains the lane through cleanup',async(state,label,action)=>{
  const {api,projects,reader,operations}=await setup(state);let resolve!:(reply:CreatorOperationReply)=>void,cleanup!:()=>void
  api.run=vi.fn(()=>new Promise<CreatorOperationReply>(done=>{resolve=done}));api.waitForIdle=vi.fn(()=>new Promise<void>(done=>{cleanup=done}))
  await projects.connect(reader);await flushPromises();await click(label)
  const start=button(label);expect(start.classes()).toContain('is-loading');expect(start.attributes('disabled')).toBeDefined()
  expect(button('聚焦 Creator').attributes('disabled')).toBeDefined();expect(button('重启 Creator').attributes('disabled')).toBeDefined()
  await start.trigger('click');await start.trigger('click');expect(api.run).toHaveBeenCalledTimes(1);expect(api.run).toHaveBeenCalledWith({projectId:id,action},expect.any(AbortSignal));expectNoDialog()
  resolve(action==='focus'?{action:'focus',acknowledged:true}:{action:'start',runtime:{projectId:id,state:'bridge-wait',capabilityProfile:'unknown'}});await flushPromises()
  expect(operations.transportPending).toBe(true);expect(button(label).classes()).toContain('is-loading');expect(reader.loadProjects).toHaveBeenCalledTimes(1);expect(toastText()).toBe('')
  cleanup();await flushPromises();expect(operations.transportPending).toBe(false);expect(button(label).classes()).not.toContain('is-loading');expect(reader.loadProjects).toHaveBeenCalledTimes(2);expect(toastText()).toContain(action==='start'?'已收到启动回执':'已收到打开 Creator 回执')
 })
 it('one ready main-button click focuses existing Creator without dispatching start',async()=>{
  const {api,projects,reader}=await setup('ready');await projects.connect(reader);await flushPromises();await click('打开 Creator')
  expect(api.run).toHaveBeenCalledTimes(1);expect(api.run).toHaveBeenCalledWith({projectId:id,action:'focus'},expect.any(AbortSignal))
  expectNoDialog();expect(wrapper!.text()).toContain('3.8.8')
  expect(toastText()).toContain('已收到打开 Creator 回执');expect(toastText()).not.toMatch(/窗口已到前台|启动成功/)
 })
 it('the accessible focus icon uses the same direct one-click path',async()=>{
  const {api,projects,reader}=await setup('ready');await projects.connect(reader);await flushPromises();await click('聚焦 Creator')
  expect(api.run).toHaveBeenCalledTimes(1);expect(api.run).toHaveBeenCalledWith({projectId:id,action:'focus'},expect.any(AbortSignal));expectNoDialog()
 })
 it('keeps missing or in-progress runtime ineligible for starting rather than guessing stopped',async()=>{
  const {api,projects,reader,setRuntime}=await setup('unknown');await projects.connect(reader);await flushPromises()
  expect(button('启动 Creator').attributes('disabled')).toBeDefined();await click('启动 Creator');expect(api.run).not.toHaveBeenCalled()
  for(const state of ['launching','bridge-wait','stopping'] as const){setRuntime({projectId:id,state,capabilityProfile:'unknown'});await projects.refreshProjects();await flushPromises();expect(button('启动 Creator').attributes('disabled')).toBeDefined()}
  expect(api.run).not.toHaveBeenCalled()
 })
 it('keeps failure notice compact and requires a new real read before an explicit retry',async()=>{
  const {api,projects,reader,operations}=await setup();api.run=vi.fn(async()=>{throw new CreatorOperationError('timeout','unknown')})
  await projects.connect(reader);await flushPromises();await click('启动 Creator')
  expect(operations.lastReceipt?.phase).toBe('unknown');expect(reader.loadProjects).toHaveBeenCalledTimes(1);expect(api.run).toHaveBeenCalledTimes(1)
  expect(wrapper!.get('.compact-operation-warning').text()).toContain('需核对状态与日志');expect(wrapper!.text()).not.toContain('后台可能已执行')
  expect(toastText()).toContain('操作结果未知');expect(button('启动 Creator').attributes('disabled')).toBeDefined();expectNoDialog()
  expect(await tip('操作结果详情')).toContain('结果未知');expect(await tip('操作结果详情')).toContain('后台可能已执行')
  await click('刷新真实状态');expect(button('启动 Creator').attributes('disabled')).toBeUndefined();expect(api.run).toHaveBeenCalledTimes(1)
 })
 it('an already-running read cannot clear uncertainty from a later failure',async()=>{
  const {api,projects,reader}=await setup();let reject!:(cause:unknown)=>void,read!:(value:Awaited<ReturnType<CompanionBrowserProvider['loadProjects']>>)=>void
  api.run=vi.fn(()=>new Promise<CreatorOperationReply>((_resolve,fail)=>{reject=fail}));await projects.connect(reader);await flushPromises();await click('启动 Creator')
  vi.mocked(reader.loadProjects).mockImplementationOnce(()=>new Promise(done=>{read=done}));const refreshing=projects.refreshProjects();await flushPromises()
  reject(new CreatorOperationError('network-error','unknown'));await flushPromises()
  read({projects:[{id,name:'待操作工程',path:'D:\\Fixture\\Game'}],statuses:[{projectId:id,state:'stopped',capabilityProfile:'unknown'}],dashboard:[],warnings:[]});await refreshing;await flushPromises()
  expect(button('启动 Creator').attributes('disabled')).toBeDefined();await click('刷新真实状态');expect(button('启动 Creator').attributes('disabled')).toBeUndefined();expect(api.run).toHaveBeenCalledTimes(1)
 })
 it('keeps existing log and call navigation available without adding a history entry',async()=>{
  const {api,projects,reader,router}=await setup();api.run=vi.fn(async()=>{throw new CreatorOperationError('timeout','unknown')})
  await projects.connect(reader);await flushPromises();await click('启动 Creator')
  expect(wrapper!.findAll('button').some(item=>item.text()==='操作记录')).toBe(false);expectNoDialog()
  await wrapper!.get('a[href="/projects?tab=logs"]').trigger('click');await flushPromises();expect(router.currentRoute.value.query.tab).toBe('logs')
  expect(reader.loadLogs).not.toHaveBeenCalled();await click('查询 / 刷新日志');expect(reader.loadLogs).toHaveBeenCalledTimes(1)
  await wrapper!.get('a[href="/projects"]').trigger('click');await flushPromises();expect(button('启动 Creator').attributes('disabled')).toBeDefined()
  await click('展开');await click('查看调用记录');expect(reader.loadCalls).toHaveBeenCalledWith(id,{failed:false},expect.any(AbortSignal));expect(api.run).toHaveBeenCalledTimes(1)
 })
 it('keeps cleanup failure visible and the operation lane closed after an acknowledged direct action',async()=>{
  const {api,projects,reader,operations}=await setup();api.waitForIdle=vi.fn(async()=>{throw new Error('cleanup uncertain')})
  await projects.connect(reader);await flushPromises();await click('启动 Creator')
  expect(operations.lastReceipt?.phase).toBe('acknowledged');expect(operations.transportPending).toBe(true);expect(reader.loadProjects).toHaveBeenCalledTimes(1);expect(toastText()).toBe('')
  expect(wrapper!.get('.compact-warning').text()).toContain('请求尚未结束');expect(await tip('请求清理详情')).toContain('无法确认传输已经结束')
  expect(button('启动 Creator').attributes('disabled')).toBeDefined();await click('启动 Creator');expect(api.run).toHaveBeenCalledTimes(1);expectNoDialog()
 })
 it('does not toast or read a replacement source when a pending request returns late',async()=>{
  const {api,projects,reader,operations}=await setup();let finish!:(reply:CreatorOperationReply)=>void
  api.run=vi.fn(()=>new Promise<CreatorOperationReply>(done=>{finish=done}));await projects.connect(reader);await flushPromises();await click('启动 Creator')
  const replacement={...reader,label:'replacement',loadProjects:vi.fn(async(signal?:AbortSignal)=>reader.loadProjects(signal))};registerCompanionBrowserProvider(replacement);await projects.connect(replacement);await flushPromises()
  finish({action:'start',runtime:{projectId:id,state:'ready',capabilityProfile:'unknown'}});await flushPromises()
  expect(operations.lastReceipt?.phase).toBe('unknown');expect(operations.lastReceipt?.detached).toBe(true)
  expect(replacement.loadProjects).toHaveBeenCalledTimes(1);expect(toastText()).not.toContain('已收到启动回执');expect(toastText()).not.toContain('操作结果未知')
 })
 it('does not read another or reconnected source after acknowledged request cleanup',async()=>{
  const {api,projects,reader}=await setup();let idle!:()=>void;api.waitForIdle=vi.fn(()=>new Promise<void>(done=>{idle=done}))
  await projects.connect(reader);await flushPromises();await click('启动 Creator');const notices=toastText();expect(notices).toBe('')
  projects.disconnect();await projects.connect(reader);await flushPromises();const reads=vi.mocked(reader.loadProjects).mock.calls.length
  idle();await flushPromises();expect(reader.loadProjects).toHaveBeenCalledTimes(reads);expect(toastText()).toBe(notices)
 })
 it('does not reread or publish a late result after leaving the page',async()=>{
  const {api,projects,reader,operations}=await setup();let finish!:(reply:CreatorOperationReply)=>void
  api.run=vi.fn(()=>new Promise<CreatorOperationReply>(done=>{finish=done}));await projects.connect(reader);await flushPromises();await click('启动 Creator')
  wrapper!.unmount();wrapper=undefined;finish({action:'start',runtime:{projectId:id,state:'ready',capabilityProfile:'unknown'}});await flushPromises()
  expect(reader.loadProjects).toHaveBeenCalledTimes(1);expect(operations.lastReceipt?.phase).toBe('unknown');expect(toastText()).toBe('')
 })
 it.each(['unknown','acknowledged'] as const)('does not replay an old %s stop toast after remount and a new action',async(phase)=>{
  const {api,projects,reader,pinia,router}=await setup('ready')
  if(phase==='unknown')vi.mocked(api.run).mockRejectedValueOnce(new CreatorOperationError('timeout','unknown'))
  await projects.connect(reader);await flushPromises();await click('停止 Creator');await click('确认停止此工程')
  expect(toastText()).toContain(phase==='unknown'?'操作结果未知':'已收到操作回执');await click('关闭');await projects.refreshProjects();await flushPromises()
  wrapper!.unmount();wrapper=undefined;ElMessage.closeAll();await flushPromises()
  wrapper=mount(CompanionBrowserView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}});await flushPromises();expect(toastText()).toBe('')
  await click('打开 Creator');expect(api.run).toHaveBeenCalledTimes(2);expect(toastText()).toContain('已收到打开 Creator 回执')
  expect(toastText()).not.toContain('操作结果未知');expect(toastText()).not.toContain('已收到操作回执。')
 })
 it('does not reread after leaving during acknowledged request cleanup',async()=>{
  const {api,projects,reader}=await setup();let idle!:()=>void;api.waitForIdle=vi.fn(()=>new Promise<void>(done=>{idle=done}))
  await projects.connect(reader);await flushPromises();await click('启动 Creator');const notices=toastText();expect(notices).toBe('')
  wrapper!.unmount();wrapper=undefined;idle();await flushPromises();expect(reader.loadProjects).toHaveBeenCalledTimes(1);expect(toastText()).toBe(notices)
 })
})

describe('stop and restart retain exact-target confirmations',()=>{
 it('project metadata changes invalidate a confirmation before send',async()=>{
  const {api,projects,reader,operations}=await setup('ready');await projects.connect(reader);await flushPromises();await click('停止 Creator')
  expect(operations.prepared?.project.id).toBe(id);projects.projects=[{...projects.projects[0]!,path:'D:\\Other'}];await flushPromises();expect(operations.prepared).toBeNull();expect(api.run).not.toHaveBeenCalled()
 })
 it('pauses scheduled project reads while confirmation is open and resumes on close',async()=>{
  vi.useFakeTimers();const {api,projects,reader,operations}=await setup('ready');await projects.connect(reader)
  projects.startLive({label:'fake events',subscribe:()=>()=>{}});await vi.advanceTimersByTimeAsync(0);await flushPromises();await click('停止 Creator');const reads=vi.mocked(reader.loadProjects).mock.calls.length
  await vi.advanceTimersByTimeAsync(4000);await flushPromises();expect(operations.prepared?.project.id).toBe(id);expect(operations.dialogOpen).toBe(true);expect(reader.loadProjects).toHaveBeenCalledTimes(reads)
  expect(button('确认停止此工程').attributes('disabled')).toBeUndefined();await click('关闭');await vi.advanceTimersByTimeAsync(3000);await flushPromises();expect(reader.loadProjects).toHaveBeenCalledTimes(reads+1);expect(api.run).not.toHaveBeenCalled()
 })
 it('manual refresh revokes frozen approval even for an identical snapshot',async()=>{
  const {api,projects,reader,operations}=await setup('ready');await projects.connect(reader);await flushPromises();await click('停止 Creator');await projects.refreshProjects();await flushPromises()
  expect(operations.prepared).toBeNull();expect(api.run).not.toHaveBeenCalled()
 })
 it('stop requires confirmation and never treats its stopped receipt as verified process exit',async()=>{
  const {api,projects,reader,operations}=await setup('ready');await projects.connect(reader);await flushPromises();await click('停止 Creator')
  const confirmation=dialog();for(const text of ['待操作工程',id,'D:\\Fixture\\Game','保存','进程已退出','异常空值'])expect(confirmation.text()).toContain(text)
  expect(api.run).not.toHaveBeenCalled();await click('确认停止此工程');expect(api.run).toHaveBeenCalledTimes(1);expect(api.run).toHaveBeenCalledWith({projectId:id,action:'stop'},expect.any(AbortSignal))
  expect(projects.statuses[0]?.state).toBe('ready');expect(operations.lastReceipt?.message).toContain('不证明操作系统进程已退出');expect(dialog().text()).toContain('不证明操作系统进程已退出');expect(wrapper!.find('[data-testid="creator-last-receipt"]').exists()).toBe(false)
 })
 it('restart cancellation sends nothing while keeping the unsaved-content and Bridge risks',async()=>{
  const {api,projects,reader}=await setup('ready');await projects.connect(reader);await flushPromises();await click('重启 Creator')
  expect(dialog().text()).toContain('Bridge');expect(dialog().text()).toContain('Dashboard');expect(dialog().text()).toContain('保存');await click('关闭');expect(api.run).not.toHaveBeenCalled()
 })
 it('restart Bridge failure is kept without guessing which stage failed or claiming no effects',async()=>{
  const {api,projects,reader,operations}=await setup('ready');api.run=vi.fn(async()=>{throw new CreatorOperationError('backend-failure','reported-failure','DASHBOARD_OPEN_WITHOUT_BRIDGE')})
  await projects.connect(reader);await flushPromises();await click('重启 Creator');await click('确认重启此工程')
  expect(api.run).toHaveBeenCalledWith({projectId:id,action:'restart'},expect.any(AbortSignal));expect(operations.lastReceipt?.phase).toBe('reported-failure')
  expect(dialog().text()).toContain('Bridge');expect(dialog().text()).toContain('也可能已打开后未接入');expect(reader.loadProjects).toHaveBeenCalledTimes(1)
  await click('关闭');expect(await tip('操作结果详情')).toContain('也可能已打开后未接入')
 })
 it('unsaved-text hints remain UNKNOWN rather than fabricating a safe refusal',async()=>{
  const {api,projects,reader,operations}=await setup('ready');api.run=vi.fn(async()=>{throw new CreatorOperationError('backend-failure','unknown',undefined,'unsaved-content')})
  await projects.connect(reader);await flushPromises();await click('停止 Creator');await click('确认停止此工程')
  expect(operations.lastReceipt?.phase).toBe('unknown');expect(dialog().text()).toContain('未保存');expect(dialog().text()).toContain('结果未知')
  expect(button('重启 Creator').attributes('disabled')).toBeDefined();expect(api.run).toHaveBeenCalledTimes(1)
 })
})

describe('registered project management uses the same guarded operation lane',()=>{
 it('requires frozen folder confirmation; cancelling does not open the file manager',async()=>{
  const {api,reader,projects}=await setup('ready');await projects.connect(reader);await flushPromises();await click('打开目录')
  expect(dialog().text()).toContain('D:\\Fixture\\Game');expect(dialog().text()).toContain('工程 ID');expect(dialog().text()).toMatch(/不证明.*窗口/)
  expect(api.run).not.toHaveBeenCalled();await click('关闭');expect(api.run).not.toHaveBeenCalled()
 })
 it('sends one confirmed folder action without turning its receipt into visible-window proof',async()=>{
  const {api,reader,projects,operations}=await setup('ready');await projects.connect(reader);await flushPromises();await click('打开目录');await click('确认打开此工程目录')
  expect(api.run).toHaveBeenCalledTimes(1);expect(api.run).toHaveBeenCalledWith({projectId:id,action:'open-folder'},expect.any(AbortSignal))
  expect(operations.lastReceipt?.reply).toEqual({action:'open-folder',acknowledged:true,path:'D:\\Fixture\\Game'});expect(dialog().text()).toContain('不证明文件管理器窗口已打开');expect(reader.loadProjects).toHaveBeenCalledTimes(2)
 })
 it('removal retains registration, non-atomic binding cleanup and full-default recovery warnings',async()=>{
  const {api,reader,projects}=await setup('ready');await projects.connect(reader);await flushPromises();await click('移除登记')
  for(const text of [id,'不会删除工程文件','停止','工具','不是原子操作','没有一键撤销','full','扩大工具'])expect(dialog().text()).toContain(text)
  expect(api.run).not.toHaveBeenCalled();await click('关闭');expect(api.run).not.toHaveBeenCalled()
 })
 it('removed:true rereads instead of optimistic deletion and keeps readback inside its existing confirmation',async()=>{
  const {api,reader,projects,operations}=await setup('ready');await projects.connect(reader);await flushPromises()
  vi.mocked(reader.loadProjects).mockResolvedValueOnce({projects:[],statuses:[],dashboard:[],warnings:[]});await click('移除登记');await click('确认移除此登记与工具绑定')
  expect(api.run).toHaveBeenCalledTimes(1);expect(api.run).toHaveBeenCalledWith({projectId:id,action:'remove-registration'},expect.any(AbortSignal))
  expect(projects.projects).toEqual([]);expect(reader.loadProjects).toHaveBeenCalledTimes(2);expect(operations.lastReceipt?.phase).toBe('acknowledged')
  expect(dialog().text()).toContain('D:\\Fixture\\Game');expect(dialog().text()).toContain('本次登记列表未包含原工程');expect(dialog().text()).toContain('不证明工具绑定已清理')
  expect(wrapper!.find('[data-testid="creator-last-receipt"]').exists()).toBe(false);await click('关闭');expectNoDialog();expect(operations.lastReceipt?.project.path).toBe('D:\\Fixture\\Game')
 })
 it('preserves removed:false and never presents a remaining registration as deleted',async()=>{
  const {api,reader,projects,operations}=await setup('ready');api.run=vi.fn<CreatorOperationsProvider['run']>(async()=>({action:'remove-registration',removed:false}))
  await projects.connect(reader);await flushPromises();await click('移除登记');await click('确认移除此登记与工具绑定')
  expect(operations.lastReceipt?.reply).toEqual({action:'remove-registration',removed:false});expect(projects.projects).toHaveLength(1)
  expect(dialog().text()).toContain('原工程登记仍存在');expect(dialog().text()).toContain('false')
 })
 it('partial removal failure needs explicit readback, never automatic DELETE retry or fabricated success',async()=>{
  const {api,reader,projects,operations}=await setup('ready');api.run=vi.fn(async()=>{throw new CreatorOperationError('backend-failure','unknown')})
  await projects.connect(reader);await flushPromises();await click('移除登记');await click('确认移除此登记与工具绑定')
  expect(operations.lastReceipt?.phase).toBe('unknown');expect(reader.loadProjects).toHaveBeenCalledTimes(1)
  vi.mocked(reader.loadProjects).mockResolvedValueOnce({projects:[],statuses:[],dashboard:[],warnings:[]});await click('核对登记与状态')
  expect(reader.loadProjects).toHaveBeenCalledTimes(2);expect(api.run).toHaveBeenCalledTimes(1);expect(operations.lastReceipt?.phase).toBe('unknown');expect(dialog().text()).toContain('本次登记列表未包含原工程')
 })
 it('folder path mismatch remains UNKNOWN instead of acknowledging the wrong target',async()=>{
  const {api,reader,projects,operations}=await setup('ready');api.run=vi.fn<CreatorOperationsProvider['run']>(async()=>({action:'open-folder',acknowledged:true,path:'D:\\Other'}))
  await projects.connect(reader);await flushPromises();await click('打开目录');await click('确认打开此工程目录')
  expect(operations.lastReceipt?.phase).toBe('unknown');expect(operations.lastReceipt?.reply).toBeNull();expect(reader.loadProjects).toHaveBeenCalledTimes(1)
 })
 it('pending removal blocks other actions and stop-waiting never cancels the backend deletion',async()=>{
  const {api,reader,projects,operations}=await setup('ready');let finish!:(reply:CreatorOperationReply)=>void,cleanup!:()=>void
  api.run=vi.fn(()=>new Promise<CreatorOperationReply>(done=>{finish=done}));api.waitForIdle=vi.fn(()=>new Promise<void>(done=>{cleanup=done}))
  await projects.connect(reader);await flushPromises();await click('移除登记');await click('确认移除此登记与工具绑定')
  expect(button('停止 Creator').attributes('disabled')).toBeDefined();expect(button('打开目录').attributes('disabled')).toBeDefined();await click('停止等待')
  expect(operations.lastReceipt?.phase).toBe('unknown');expect(operations.transportPending).toBe(true)
  finish({action:'remove-registration',removed:true});cleanup();await flushPromises();expect(operations.lastReceipt?.phase).toBe('unknown');expect(api.run).toHaveBeenCalledTimes(1)
 })
 it('changed source disables old confirmation readback and cannot read a replacement provider',async()=>{
  const {api,reader,projects}=await setup('ready');api.run=vi.fn(async()=>{throw new CreatorOperationError('timeout','unknown')})
  await projects.connect(reader);await flushPromises();await click('移除登记');await click('确认移除此登记与工具绑定')
  projects.disconnect();await flushPromises();expect(button('核对登记与状态').attributes('disabled')).toBeDefined();expect(reader.loadProjects).toHaveBeenCalledTimes(1)
  const replacement={...reader,label:'new source',loadProjects:vi.fn(async(signal?:AbortSignal)=>reader.loadProjects(signal))};registerCompanionBrowserProvider(replacement);await projects.connect(replacement);await flushPromises()
  expect(button('核对登记与状态').attributes('disabled')).toBeDefined();await click('核对登记与状态');expect(replacement.loadProjects).toHaveBeenCalledTimes(1);expect(api.run).toHaveBeenCalledTimes(1)
 })
})

it('uses the existing status tag for expected stop disconnect without rewriting backend error', async () => {
  const { projects, reader, setRuntime } = await setup('ready')
  await projects.connect(reader); await flushPromises()
  await click('停止 Creator')
  setRuntime({ projectId:id, state:'error', capabilityProfile:'unknown', lastError:'Creator Bridge 不可达；当前文档和进程状态未确认，请先查询日志' })
  await click('确认停止此工程'); await click('关闭')
  expect(wrapper!.get('.project-status-trigger .el-tag').text()).toBe('已请求停止')
  expect(wrapper!.text()).toContain('进程退出仍需核对')
  expect(wrapper!.text()).toContain('Creator Bridge 不可达')
  expect(projects.statuses[0]?.state).toBe('error')
  setRuntime({ projectId:id,state:'error',capabilityProfile:'unknown',lastError:'different failure' })
  await projects.refreshProjects(); await flushPromises()
  expect(wrapper!.get('.project-status-trigger .el-tag').text()).toBe('错误')
})
