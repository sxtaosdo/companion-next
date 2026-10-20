import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { nextTick } from 'vue'
import { createProjectSetupProvider } from '../src/adapters/project-setup'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import { projectDisplayPathKey, projectDisplayRank } from '../src/domain/companion-project-display'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { companionBrowserProvider, companionEventProvider, registerCompanionBrowserProvider, isCompanionReadHost } from '../src/companion-browser-integration'
import { createCreatorOperationsProvider } from '../src/adapters/creator-operations'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { projectSetupProvider } from '../src/project-setup-integration'
import type { CompanionEventHandlers } from '../src/domain/companion-live'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
let wrapper:VueWrapper|undefined
function fixture():CompanionBrowserProvider{return {label:'OFFLINE TEST',loadProjects:vi.fn(async()=>({projects:[{id:'p1',name:'有状态',path:'/p1'},{id:'p2',name:'未读状态',path:'/p2',requiredCreatorVersion:'3.8.8'}],statuses:[{projectId:'p1',state:'ready' as const,capabilityProfile:'read-only' as const}],dashboard:[],warnings:[]})),loadCounts:vi.fn(async()=>({sessionId:'s1',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'s1',total:0,retained:0,records:[]}))}}
async function setup(path='/projects'){const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView}]});await router.push(path);await router.isReady();wrapper=mount(CompanionBrowserView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}});await flushPromises();return {store:useCompanionBrowserStore(pinia),router}}
function button(text:string){const found=wrapper!.findAll('button').find(b=>b.text().includes(text)||b.attributes('aria-label')===text);if(!found)throw Error(`Missing button ${text}`);return found}
async function tip(label:string){const trigger=wrapper!.get(`button[aria-label="${label}"]`);await trigger.trigger('click');await flushPromises();const id=trigger.attributes('aria-describedby');expect(id).toBeTruthy();const content=document.getElementById(id!);expect(content).not.toBeNull();return content!.textContent??''}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;ElMessage.closeAll();creatorOperationsProvider.value=null;projectSetupProvider.value=null;companionBrowserProvider.value=null;companionEventProvider.value=null;vi.useRealTimers();vi.restoreAllMocks();sessionStorage.clear();document.body.innerHTML=''})
describe('Companion read UI and host identity',()=>{
 it('does not steal slash from the CLI dialog button',async()=>{const p=fixture();registerCompanionBrowserProvider(p);const {store}=await setup();await store.connect(p);await flushPromises();await button('使用 CLI').trigger('click');await flushPromises();const target=document.querySelector<HTMLElement>('[data-testid="cli-use-dialog"] button')!;expect(target).not.toBeNull();target.focus();const event=new KeyboardEvent('keydown',{key:'/',bubbles:true,cancelable:true});target.dispatchEvent(event);expect(event.defaultPrevented).toBe(false);expect(document.activeElement).toBe(target)})
 it('leaves slash with any visible modal and restores it after that modal closes',async()=>{await setup();const modal=document.createElement('section');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');document.body.append(modal);vi.spyOn(modal,'getClientRects').mockReturnValue({length:1} as DOMRectList);const active=new KeyboardEvent('keydown',{key:'/',bubbles:true,cancelable:true});document.body.dispatchEvent(active);expect(active.defaultPrevented).toBe(false);modal.remove();const closed=new KeyboardEvent('keydown',{key:'/',bubbles:true,cancelable:true});document.body.dispatchEvent(closed);expect(closed.defaultPrevented).toBe(true)})
 it('does not let a hidden dialog or modifier keys break ordinary slash search',async()=>{await setup();const modal=document.createElement('section');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.style.display='none';document.body.append(modal);const normal=new KeyboardEvent('keydown',{key:'/',bubbles:true,cancelable:true});document.body.dispatchEvent(normal);expect(normal.defaultPrevented).toBe(true);for(const modifier of ['ctrlKey','altKey','metaKey']){const event=new KeyboardEvent('keydown',{key:'/',bubbles:true,cancelable:true,[modifier]:true});document.body.dispatchEvent(event);expect(event.defaultPrevented).toBe(false)}})
 it('restores both local filters from the no-match empty action without any extra reads',async()=>{const p=fixture();registerCompanionBrowserProvider(p);const {store}=await setup();await store.connect(p);await flushPromises();await wrapper!.get('input[aria-label="搜索登记工程"]').setValue('does-not-match');wrapper!.findComponent({name:'ElSelect'}).vm.$emit('update:modelValue','stopped');await nextTick();expect(wrapper!.findAll('.companion-project-card')).toHaveLength(0);const reads=vi.mocked(p.loadProjects).mock.calls.length;await button('清除筛选').trigger('click');expect((wrapper!.get('input[aria-label="搜索登记工程"]').element as HTMLInputElement).value).toBe('');expect(wrapper!.findAll('.companion-project-card')).toHaveLength(2);expect(p.loadProjects).toHaveBeenCalledTimes(reads)})
 it('opens only the existing setup dialog from a verified empty registry and respects the lane',async()=>{const fetch=vi.fn();projectSetupProvider.value=createProjectSetupProvider({fetch});const p=fixture();vi.mocked(p.loadProjects).mockResolvedValue({projects:[],statuses:[],dashboard:[],warnings:[]});registerCompanionBrowserProvider(p);const {store}=await setup();await store.connect(p);await flushPromises();expect(wrapper!.text()).toContain('尚未登记工程');const lane=useProjectOperationLaneStore(),lease=lane.acquire('existing')!;await nextTick();expect(button('添加项目').attributes('disabled')).toBeDefined();lane.release(lease);await nextTick();await button('添加项目').trigger('click');await flushPromises();expect(document.querySelector('[role="dialog"]')?.textContent).toContain('已有工程：登记与安装接入');expect(fetch).not.toHaveBeenCalled()})
 it('does not label a failed or unconnected read as an empty registered workspace',async()=>{const fetch=vi.fn();projectSetupProvider.value=createProjectSetupProvider({fetch});const p=fixture();vi.mocked(p.loadProjects).mockRejectedValue(new Error('offline'));registerCompanionBrowserProvider(p);const {store}=await setup();expect(wrapper!.text()).not.toContain('尚未登记工程');await store.connect(p);await flushPromises();expect(wrapper!.text()).toContain('工程读取失败，请重新读取');expect(wrapper!.findAll('button').some(b=>b.text()==='添加项目')).toBe(false);expect(fetch).not.toHaveBeenCalled()})
 it('ticks recent-call milliseconds locally, pauses when hidden and cleans up on unmount',async()=>{const p=fixture();registerCompanionBrowserProvider(p);const {store}=await setup();await store.connect(p);await flushPromises();const start=Date.parse('2026-10-18T12:00:00Z');vi.useFakeTimers();vi.setSystemTime(start);const baseline=vi.getTimerCount();store.counts={sessionId:'s',counts:{p1:1},latest:{p1:{id:'r',operationNameZh:'读取场景',status:'running',startedAt:new Date(start).toISOString()}}};await nextTick();expect(vi.getTimerCount()).toBe(baseline+1);const calls=vi.mocked(p.loadProjects).mock.calls.length;vi.advanceTimersByTime(300);await nextTick();expect(wrapper!.get('.project-call-summary').text()).toContain('300ms');let visibility:DocumentVisibilityState='hidden';vi.spyOn(document,'visibilityState','get').mockImplementation(()=>visibility);document.dispatchEvent(new Event('visibilitychange'));await nextTick();const paused=wrapper!.get('.project-call-summary').text();vi.advanceTimersByTime(1000);await nextTick();expect(wrapper!.get('.project-call-summary').text()).toBe(paused);visibility='visible';document.dispatchEvent(new Event('visibilitychange'));await nextTick();expect(wrapper!.get('.project-call-summary').text()).toContain('1300ms');expect(p.loadProjects).toHaveBeenCalledTimes(calls);expect(p.loadCounts).toHaveBeenCalledTimes(1);wrapper!.unmount();wrapper=undefined;/* Element Plus releases its modal body lock after 200ms; a leaked interval still remains after this settles. */await vi.advanceTimersByTimeAsync(200);expect(vi.getTimerCount()).toBe(baseline)})
 it('binds Dashboard tooltip data to its project without extra reads or permanent details',async()=>{
  const p=fixture();vi.mocked(p.loadProjects).mockResolvedValue({projects:[{id:'p1',name:'Dashboard工程',path:'/p1'},{id:'p2',name:'另一工程',path:'/p2'}],statuses:[{projectId:'p1',state:'launching',capabilityProfile:'unknown',launchSource:'dashboard',dashboardVersion:'2.4.0',dashboardProgress:'waiting-dashboard'}],dashboard:[],warnings:[]})
  registerCompanionBrowserProvider(p);const {store}=await setup();await store.connect(p);await flushPromises()
  const cards=wrapper!.findAll('.companion-project-card'),calls=vi.mocked(p.loadProjects).mock.calls.length
  const first=cards.find(card=>card.text().includes('Dashboard工程'))!,second=cards.find(card=>card.text().includes('另一工程'))!
  expect(first.text()).not.toContain('Dashboard 状态');expect(first.text()).not.toContain('2.4.0')
  const trigger=first.get('.project-status-trigger');await trigger.trigger('focus');await flushPromises()
  expect(document.getElementById(trigger.attributes('aria-describedby')!)?.textContent).toBe('Dashboard 2.4.0\nDashboard 状态 waiting-dashboard')
  expect(second.get('.project-status-trigger').attributes('tabindex')).toBeUndefined()
  expect(vi.mocked(p.loadProjects).mock.calls.length).toBe(calls)
  store.disconnect();await flushPromises();expect(wrapper!.findAll('.project-status-trigger')).toHaveLength(0)
 })
 it('labels passive connection as unprobed and keeps its explanation in a tooltip',async()=>{
  const p={...fixture(),runtimeProbesEnabled:false};p.loadProjects=vi.fn(async()=>({projects:[{id:'p1',name:'只读登记',path:'/fixture'}],statuses:[],dashboard:[],warnings:['运行状态未探测']}));registerCompanionBrowserProvider(p);await setup();await button('连接 Companion').trigger('click');await flushPromises()
  const card=wrapper!.get('.companion-project-card');expect(card.text()).toContain('运行状态未探测');expect(card.text()).not.toContain('已停止');expect(card.text()).toContain('最近打开未读取')
  expect(wrapper!.text()).not.toContain('不探测 Bridge');expect(await tip('工程连接说明')).toContain('不探测 Bridge 或 Dashboard')
 })
 it('preserves opened-first ordering without treating missing or unknown state as opened',()=>{expect(projectDisplayRank('ready',100)).toEqual([1,100]);expect(projectDisplayRank('stopped',200)).toEqual([0,200]);expect(projectDisplayRank(undefined,undefined)).toEqual([0,0]);expect(projectDisplayRank('unknown',300)).toEqual([0,300])})
 it('normalizes Windows display paths without changing POSIX case identity',()=>{expect(projectDisplayPathKey('C:\\Game\\')).toBe(projectDisplayPathKey('c:/Game'));expect(projectDisplayPathKey('/Game')).not.toBe(projectDisplayPathKey('/game'))})
 it('registers only an explicit read build on the exact local host, never inferred from Picker path',()=>{for(const mode of ['development','production','picker'])expect(isCompanionReadHost(mode,{protocol:'http:',hostname:'127.0.0.1'})).toBe(false);expect(isCompanionReadHost('companion-readonly',{protocol:'http:',hostname:'127.0.0.1'})).toBe(true);for(const hostname of ['localhost','example.com','127.0.0.2'])expect(isCompanionReadHost('companion-readonly',{protocol:'http:',hostname})).toBe(false)})
 it('does not fetch, embed the old UI or show fictitious zero counts on entry',async()=>{
  const p=fixture();registerCompanionBrowserProvider(p);await setup();expect(p.loadProjects).not.toHaveBeenCalled();expect(p.loadCounts).not.toHaveBeenCalled();expect(p.loadLogs).not.toHaveBeenCalled();expect(p.loadCalls).not.toHaveBeenCalled()
  expect(wrapper!.text()).toContain('工程数量未读取');expect(wrapper!.findAll('iframe')).toHaveLength(0);expect(wrapper!.findAll('[role="dialog"]').filter(item=>item.isVisible())).toHaveLength(0)
 })
 it('reads only after explicit connect and leaves missing runtime and counts unknown',async()=>{
  const p=fixture();registerCompanionBrowserProvider(p);await setup();await button('连接 Companion').trigger('click');await flushPromises()
  expect(wrapper!.findAll('.companion-project-card')).toHaveLength(2);const missing=wrapper!.findAll('.companion-project-card')[1]!
  expect(missing.text()).toContain('未知');expect(missing.text()).toContain('调用总数未记录');expect(missing.text()).toContain('当前 Creator未读取工程要求版本3.8.8');expect(p.loadLogs).not.toHaveBeenCalled();expect(p.loadCalls).not.toHaveBeenCalled()
  expect(await tip('调用统计说明')).toContain('没有记录不推断为零')
 })
 it('opens tools help for the exact project without extra project or call reads',async()=>{const p=fixture();registerCompanionBrowserProvider(p);const {store,router}=await setup();await store.connect(p);await flushPromises();const reads=vi.mocked(p.loadProjects).mock.calls.length;await button('工具范围').trigger('click');await flushPromises();expect(router.currentRoute.value.path).toBe('/help');expect(router.currentRoute.value.query).toEqual({topic:'tools',project:'p1'});expect(p.loadProjects).toHaveBeenCalledTimes(reads);expect(p.loadCalls).not.toHaveBeenCalled()})
 it('opens calls for the explicit project, shows empty only after actual response and never replays',async()=>{
  const p=fixture();registerCompanionBrowserProvider(p);const {router}=await setup();await button('连接 Companion').trigger('click');await flushPromises();await button('查看调用记录').trigger('click');await flushPromises()
  expect(router.currentRoute.value.query.tab).toBe('calls');expect(wrapper!.text()).toContain('本次查询没有匹配调用');expect(p.loadCalls).toHaveBeenCalledTimes(1);expect(p.loadCalls).toHaveBeenCalledWith('p1',{failed:false},expect.any(AbortSignal))
  expect(wrapper!.text()).not.toContain('不执行或重放');expect(await tip('调用记录说明')).toContain('不执行或重放工具调用')
 })
 it('opens the exact project history from its recent-call summary without replaying',async()=>{
  const p=fixture();vi.mocked(p.loadCounts).mockResolvedValue({sessionId:'s1',counts:{p1:0,p2:1},latest:{p2:{id:'r2',operationNameZh:'读取场景',startedAt:'2026-10-17T00:00:00Z',status:'success'}}})
  registerCompanionBrowserProvider(p);const {store,router}=await setup();await store.connect(p);await flushPromises()
  const summary=wrapper!.get('button.project-call-summary');expect(summary.attributes('type')).toBe('button');expect(summary.attributes('aria-label')).toBe('查看 未读状态 的调用记录');expect(summary.text()).toContain('读取场景')
  expect(p.loadCalls).not.toHaveBeenCalled();expect(wrapper!.findAll('button.project-call-summary')).toHaveLength(1)
  await summary.trigger('click');await flushPromises();expect(router.currentRoute.value.query.tab).toBe('calls');expect(store.callProjectId).toBe('p2');expect(p.loadCalls).toHaveBeenCalledExactlyOnceWith('p2',{failed:false},expect.any(AbortSignal))
 })
 it('retains the original Chinese history statuses while preserving wire values and readonly expansion',async()=>{
  const p=fixture(),statuses=['running','success','failed'] as const
  vi.mocked(p.loadCalls).mockResolvedValue({sessionId:'s1',total:3,retained:3,records:statuses.map((status,index)=>({id:`call-${index}`,sequence:3-index,projectId:'p1',operation:`read_${index}`,operationNameZh:'读取状态',source:'mcp' as const,startedAt:'2026-10-20T00:00:00Z',status,inputSummary:'{}',...(status==='failed'?{errorSummary:'已记录的业务错误'}:{})}))})
  registerCompanionBrowserProvider(p);const {store}=await setup();await button('连接 Companion').trigger('click');await flushPromises();await button('查看调用记录').trigger('click');await flushPromises()
  const rows=wrapper!.findAll('details.companion-call-record');expect(rows).toHaveLength(3)
  for(const [index,label] of ['进行中','成功','失败'].entries()){const summary=rows[index]!.get('summary');expect(summary.text()).toContain(label);expect(summary.text()).not.toContain(statuses[index]!);await summary.trigger('click')}
  expect(store.records.map(record=>record.status)).toEqual(statuses);expect(p.loadCalls).toHaveBeenCalledTimes(1)
 })
 it('retains actual call pagination while moving capacity limits into an accessible tip',async()=>{
  const p=fixture();vi.mocked(p.loadCalls).mockResolvedValueOnce({sessionId:'s1',total:80,retained:80,nextBefore:31,records:[]}).mockResolvedValueOnce({sessionId:'s1',total:80,retained:80,records:[]})
  registerCompanionBrowserProvider(p);await setup();await button('连接 Companion').trigger('click');await flushPromises();await button('查看调用记录').trigger('click');await flushPromises()
  expect(wrapper!.text()).toContain('累计 80 次');expect(wrapper!.text()).toContain('保留 80 条');expect(await tip('调用分页说明')).toContain('每页最多50条')
  await button('加载更多（50 条）').trigger('click');await flushPromises();expect(p.loadCalls).toHaveBeenNthCalledWith(2,'p1',{failed:false,before:31},expect.any(AbortSignal));expect(wrapper!.text()).not.toContain('加载更多（50 条）')
 })
 it('keeps logs manual and invalidates old display after filter changes',async()=>{
  const p=fixture();registerCompanionBrowserProvider(p);const {store}=await setup('/projects?tab=logs');await store.connect(p);await flushPromises();expect(p.loadLogs).not.toHaveBeenCalled()
  await button('查询 / 刷新日志').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('本次条件返回空日志');store.logFilter.search='new';await flushPromises();expect(wrapper!.text()).toContain('筛选已变');expect(p.loadLogs).toHaveBeenCalledTimes(1)
  expect(await tip('日志范围说明')).toContain('最多最新200条');expect(await tip('日志范围说明')).toContain('无历史分页')
 })
 it.each([true,false])('keeps manual-refresh logs mounted and preserves bottom following=%s',async following=>{
  const p=fixture();registerCompanionBrowserProvider(p);const {store}=await setup('/projects?tab=logs');await store.connect(p)
  const log={id:'l1',projectId:'p1',source:'bridge' as const,level:'info' as const,time:'2026-10-17T00:00:00Z',message:'existing log'}
  vi.mocked(p.loadLogs).mockResolvedValueOnce([log]);await button('查询 / 刷新日志').trigger('click');await flushPromises()
  const pane=wrapper!.get('.companion-log-pane').element as HTMLElement
  const height=1000
  Object.defineProperties(pane,{scrollHeight:{configurable:true,get:()=>height},clientHeight:{configurable:true,get:()=>200}})
  pane.scrollTop=following?800:200;await wrapper!.get('.companion-log-pane').trigger('scroll')
  let resolve!:(logs:typeof log[])=>void
  vi.mocked(p.loadLogs).mockImplementationOnce(()=>new Promise(r=>{resolve=r}))
  await button('查询 / 刷新日志').trigger('click');await flushPromises()
  expect(store.logsLoading).toBe(true)
  expect(wrapper!.get('.companion-log-pane article').text()).toContain('existing log')
  expect(pane.scrollTop).toBe(following?800:200)
  // Keep layout fixed: jsdom has no layout engine; real scroll geometry needs browser QA.
  resolve([log,{...log,id:'l2',message:'new log'}])
  await flushPromises()
  await wrapper!.get('.companion-log-pane').trigger('scroll')
  expect(wrapper!.get('.companion-log-pane').element).toBe(pane)
  expect(wrapper!.findAll('.companion-log-pane article')).toHaveLength(2)
  expect(pane.scrollTop).toBe(following?1000:200)
  expect(wrapper!.find('.companion-scroll-latest').exists()).toBe(!following)
 })
 it('checks provider identity immediately after returning from another route',async()=>{
  const old=fixture();registerCompanionBrowserProvider(old);const pinia=createPinia(),store=useCompanionBrowserStore(pinia);await store.connect(old);registerCompanionBrowserProvider(fixture());const router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView}]});await router.push('/projects');await router.isReady();wrapper=mount(CompanionBrowserView,{global:{plugins:[pinia,router,ElementPlus]}});await flushPromises();expect(store.connected).toBe(false);expect(store.provider).toBeNull();expect(store.projects).toEqual([])
 })
 it('disconnects on composition-root changes and cancels pending reads on unmount',async()=>{
  const p=fixture();registerCompanionBrowserProvider(p);const {store}=await setup();await store.connect(p);registerCompanionBrowserProvider(fixture());await flushPromises();expect(store.connected).toBe(false);expect(store.projects).toEqual([]);const cancel=vi.spyOn(store,'suspendReads');wrapper!.unmount();wrapper=undefined;expect(cancel).toHaveBeenCalledTimes(1)
 })
 it('requires a second explicit action for realtime and cleans it up on unmount',async()=>{
  const p=fixture(),close=vi.fn();let handlers!:CompanionEventHandlers;const subscribe=vi.fn((h:CompanionEventHandlers)=>{handlers=h;return close});registerCompanionBrowserProvider(p,{label:'OFFLINE SSE',subscribe});const {store}=await setup()
  expect(button('启用实时更新').attributes('disabled')).toBeDefined();await store.connect(p);await flushPromises();expect(subscribe).not.toHaveBeenCalled();await button('启用实时更新').trigger('click');expect(subscribe).toHaveBeenCalledTimes(1);handlers.onOpen();await flushPromises()
  expect(wrapper!.get('[data-testid="live-state"]').text()).toBe('事件流已连接');expect(wrapper!.text()).not.toContain('没有回放或心跳');expect(await tip('实时更新说明')).toContain('没有回放或心跳')
  wrapper!.unmount();wrapper=undefined;expect(close).toHaveBeenCalledTimes(1);expect(store.liveEnabled).toBe(true);expect(store.liveState).toBe('suspended')
 })
 it('pauses only live logs through the visible controls',async()=>{
  registerCompanionBrowserProvider(fixture(),{label:'OFFLINE SSE',subscribe:()=>()=>{}});const {store}=await setup('/projects?tab=logs');await store.connect(companionBrowserProvider.value!);await button('启用实时更新').trigger('click');await button('暂停实时日志').trigger('click')
  expect(store.logsPaused).toBe(true);expect(store.liveEnabled).toBe(true);expect(wrapper!.text()).toContain('实时日志已暂停');expect(await tip('日志范围说明')).toContain('手动查询、工程和调用仍可读取');await button('恢复实时日志').trigger('click');expect(store.logsPaused).toBe(false)
 })
 it('obeys document visibility and detaches old-provider subscriptions',async()=>{
  const close=vi.fn(),subscribe=vi.fn(()=>close);registerCompanionBrowserProvider(fixture(),{label:'OFFLINE SSE',subscribe});const {store}=await setup();await store.connect(companionBrowserProvider.value!);await button('启用实时更新').trigger('click');vi.spyOn(document,'visibilityState','get').mockReturnValue('hidden');document.dispatchEvent(new Event('visibilitychange'));await flushPromises();expect(store.liveState).toBe('suspended');expect(close).toHaveBeenCalledTimes(1);vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');document.dispatchEvent(new Event('visibilitychange'));await flushPromises();expect(subscribe).toHaveBeenCalledTimes(2);companionEventProvider.value={label:'replacement',subscribe:()=>()=>{}};expect(store.liveEnabled).toBe(false);expect(close).toHaveBeenCalledTimes(2)
 })
 it('shows each Dashboard informational notice once per connection, not on every poll',async()=>{
  const p=fixture(),info=vi.spyOn(ElMessage,'info');const first='Dashboard 发现未启用：本会话仅查询 Bridge 状态。',second='Dashboard 发现未启用：最近打开时间未读取。';let warnings=[first]
  vi.mocked(p.loadProjects).mockImplementation(async()=>({projects:[{id:'p1',name:'工程',path:'/p1'}],statuses:[],dashboard:[],warnings:[...warnings]}));registerCompanionBrowserProvider(p);const {store}=await setup();await store.connect(p);await flushPromises()
  expect(info).toHaveBeenCalledTimes(1);expect(wrapper!.findAll('.compact-warning')).toHaveLength(0);expect(wrapper!.text()).not.toContain(first)
  await store.refreshProjects();await store.refreshProjects();await flushPromises();expect(info).toHaveBeenCalledTimes(1)
  warnings=[first,second];await store.refreshProjects();await flushPromises();expect(info).toHaveBeenCalledTimes(2)
  store.disconnect();await store.connect(p);await flushPromises();expect(info).toHaveBeenCalledTimes(4)
 })
 it('keeps important read failures persistently visible in compact form with full tooltip details',async()=>{
  const p=fixture(),warning='运行状态未取得：Bridge 请求失败，请核对原后台日志。';vi.mocked(p.loadProjects).mockResolvedValue({projects:[{id:'p1',name:'状态失败',path:'/p1'}],statuses:[],dashboard:[],warnings:[warning]})
  registerCompanionBrowserProvider(p);const {store}=await setup();await store.connect(p);await flushPromises()
  expect(wrapper!.get('.compact-warning').text()).toBe('运行状态读取失败，请刷新重试。');expect(wrapper!.get('.companion-project-card').text()).toContain('未知');expect(wrapper!.text()).not.toContain('Bridge 请求失败')
  expect(await tip('读取问题详情')).toBe(warning);await store.refreshProjects();await flushPromises();expect(wrapper!.get('.compact-warning').text()).toContain('运行状态读取失败')
 })
 it('retains actual connection errors instead of reducing them to transient success notices',async()=>{
  const p=fixture();vi.mocked(p.loadProjects).mockRejectedValue(new Error('原服务不可达'));registerCompanionBrowserProvider(p);const {store}=await setup();await button('连接 Companion').trigger('click');await flushPromises()
  expect(store.connected).toBe(false);expect(wrapper!.text()).toContain('工程读取失败');expect(wrapper!.text()).toContain('原服务不可达');expect(wrapper!.findAll('.companion-project-card')).toHaveLength(0)
 })
})


describe('normal workspace explicit log filter reads',()=>{
 it.each([false,true])('queries edited filters with live paused=%s without dispatching Creator',async paused=>{
  const fetch=vi.fn();creatorOperationsProvider.value=createCreatorOperationsProvider({fetch});const p=fixture();registerCompanionBrowserProvider(p);const {store}=await setup('/projects?tab=logs');await store.connect(p);await flushPromises();expect(p.loadLogs).not.toHaveBeenCalled();store.liveEnabled=paused;store.logsPaused=paused;store.logFilter.search='exact';await flushPromises();expect(p.loadLogs).toHaveBeenCalledTimes(1);expect(p.loadLogs).toHaveBeenLastCalledWith(expect.objectContaining({search:'exact'}),expect.any(AbortSignal));expect(fetch).not.toHaveBeenCalled()
 })
 it.each(['/projects','/projects?tab=calls','passive'])('does not auto-query outside normal visible log workspace: %s',async mode=>{
  creatorOperationsProvider.value=createCreatorOperationsProvider({fetch:vi.fn()});const p:CompanionBrowserProvider={...fixture(),...(mode==='passive'?{runtimeProbesEnabled:false}:{})};registerCompanionBrowserProvider(p);const {store}=await setup(mode==='passive'?'/projects?tab=logs':mode);await store.connect(p);store.logFilter.search='new';await flushPromises();expect(p.loadLogs).not.toHaveBeenCalled()
 })
})
