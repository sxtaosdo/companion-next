import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
import LocalServiceControls from '../src/components/LocalServiceControls.vue'
import { localServiceOperationsProvider, registerLocalServiceOperationsProvider, isCompanionLocalServiceHost } from '../src/local-service-operations-integration'
import { knowledgeReadProvider, registerKnowledgeReadProvider } from '../src/knowledge-read-integration'
import { useLocalServiceOperationsStore } from '../src/stores/local-service-operations'
import { useWorkspaceStore } from '../src/stores/workspace'
import { LocalServiceOperationError, type LocalServiceOperationsProvider, type LocalServiceOperationReply } from '../src/domain/local-service-operations'
import { knowledgeFixture, deferred } from './knowledge-read-fixture'
let wrapper: VueWrapper | undefined
function provider(): LocalServiceOperationsProvider { return { label: 'OFFLINE STOP UI', run: vi.fn(async (input): Promise<LocalServiceOperationReply> => input.action === 'start' ? input.service === 'model' ? { service: 'model', action: 'start', state: { running: true } } : { service: 'knowledge', action: 'start', state: { running: true, frameable: false } } : input.service === 'model' ? { service: 'model', action: 'stop', state: { running: false } } : { service: 'knowledge', action: 'stop', state: { running: false, frameable: false } }), waitForIdle: vi.fn(async () => {}) } }
async function setup(options: { p?: LocalServiceOperationsProvider | null; modelsOnly?: boolean; knowledgeOnly?: boolean; r?: ReturnType<typeof knowledgeFixture> } = {}) {
  const pinia = createPinia(), p = options.p === undefined ? provider() : options.p, r = options.r ?? knowledgeFixture()
  registerKnowledgeReadProvider(r); if (p) registerLocalServiceOperationsProvider(p)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }] }); await router.push('/knowledge'); await router.isReady()
  wrapper = mount(LocalServiceControls, { props: { modelsOnly: options.modelsOnly, knowledgeOnly: options.knowledgeOnly }, attachTo: document.body, global: { plugins: [pinia, ElementPlus, router] } }); await flushPromises()
  return { p: p!, r, pinia, router, store: useLocalServiceOperationsStore(pinia), workspace: useWorkspaceStore(pinia) }
}
function button(text: string) { const found = wrapper!.findAll('button').find(value => value.text() === text); if (!found) throw Error(`missing ${text}`); return found }
async function click(text: string) { await button(text).trigger('click'); await flushPromises() }
async function check() { const checkbox = wrapper!.get('[aria-label="确认本次服务关闭"]'); await (checkbox.element.matches('input') ? checkbox : checkbox.get('input')).setValue(true) }
async function prepare(service = '模型启动器') { await click('读取当前服务状态'); await click(`核对关闭${service}`) }
async function stop(service = '模型启动器') { await prepare(service); await check(); await click('确认并关闭这一次') }
afterEach(() => { wrapper?.unmount(); wrapper = undefined; localServiceOperationsProvider.value = null; knowledgeReadProvider.value = null; document.body.innerHTML = '' })
describe('service controls build boundary', () => {
  it.each(['production', 'development', 'test', 'companion-readonly', 'companion-config-editor', 'companion-knowledge-chat'])('denies operation registration in %s', mode => expect(isCompanionLocalServiceHost(mode, { protocol: 'http:', hostname: '127.0.0.1' })).toBe(false))
  it.each([{ protocol: 'https:', hostname: '127.0.0.1' }, { protocol: 'http:', hostname: 'localhost' }, { protocol: 'http:', hostname: 'example.test' }, { protocol: 'file:', hostname: '' }])('denies nonexact transport %#', location => expect(isCompanionLocalServiceHost('companion-workspace', location)).toBe(false))
  it('permits only the exact workspace host and registration is passive', () => { const p = provider(); registerLocalServiceOperationsProvider(p); expect(isCompanionLocalServiceHost('companion-workspace', { protocol: 'http:', hostname: '127.0.0.1' })).toBe(true); expect(p.run).not.toHaveBeenCalled() })
})
describe('explicit service-control UI and source protection', () => {
  it('keeps knowledge-only controls free of model and ComfyUI UI',async()=>{
    const {p}=await setup({knowledgeOnly:true});expect(wrapper!.text()).not.toContain('模型');expect(wrapper!.text()).not.toContain('Comfy')
    expect(wrapper!.findAll('.service-card')).toHaveLength(1);expect(button('核对关闭知识库服务').exists()).toBe(true);expect(p.run).not.toHaveBeenCalled()
  })
  it('does not leak model receipts or missing-model warnings into knowledge controls',async()=>{
    const {r,p}=await setup({modelsOnly:true});vi.mocked(r.loadServiceStates).mockResolvedValue({knowledge:{running:true,frameable:false},model:{running:false},warnings:[]});await click('读取当前服务状态');await click('启动服务');expect(p.run).toHaveBeenCalledOnce()
    await wrapper!.setProps({modelsOnly:false,knowledgeOnly:true});vi.mocked(r.loadServiceStates).mockResolvedValue({knowledge:{running:true,frameable:false},warnings:[]});await click('读取当前服务状态')
    expect(wrapper!.text()).not.toContain('模型');expect(wrapper!.text()).not.toContain('Comfy');expect(wrapper!.find('.service-receipt').exists()).toBe(false)
  })
  it('restores the original knowledge-only external link after explicit running/unframeable state', async () => {
    const { p, r } = await setup()
    vi.mocked(r.loadServiceStates).mockResolvedValue({ knowledge: { running: true, frameable: false }, model: { running: true }, warnings: [] })
    expect(wrapper!.find('a').exists()).toBe(false)
    await click('读取当前服务状态')
    const link = wrapper!.get('a')
    expect(link.text()).toBe('打开知识后台')
    expect(link.attributes()).toMatchObject({ href: 'http://127.0.0.1:8081/', target: '_blank', rel: 'noopener noreferrer' })
    expect(wrapper!.text()).toContain('不能嵌进来')
    expect(r.loadServiceStates).toHaveBeenCalledOnce();expect(r.status).not.toHaveBeenCalled();expect(p.run).not.toHaveBeenCalled()
    expect(wrapper!.findAll('iframe,object,img')).toHaveLength(0)
  })
  it.each([
    { knowledge: { running: false, frameable: false }, model: { running: true }, warnings: [] },
    { knowledge: { running: true, frameable: true }, model: { running: true }, warnings: [] },
    { model: { running: true }, warnings: [] },
  ])('keeps the fallback link absent for stopped, frameable or unknown knowledge state %#', async states => {
    const { r } = await setup();vi.mocked(r.loadServiceStates).mockResolvedValue(states)
    await click('读取当前服务状态');expect(wrapper!.find('a').exists()).toBe(false)
  })
  it('restores the fixed original knowledge iframe only after explicit running/frameable status', async () => {
    const { r, p } = await setup()
    vi.mocked(r.loadServiceStates).mockResolvedValue({ knowledge: { running: true, frameable: true }, model: { running: true }, warnings: [] })
    expect(wrapper!.find('iframe').exists()).toBe(false)
    await click('读取当前服务状态')
    expect(wrapper!.get('iframe').attributes()).toMatchObject({ src: 'http://127.0.0.1:8081/', title: '本机知识库', referrerpolicy: 'no-referrer' })
    expect(wrapper!.find('a').exists()).toBe(false);expect(p.run).not.toHaveBeenCalled();expect(r.status).not.toHaveBeenCalled()
  })
  it('detaches the knowledge iframe during refresh, failed reads and provider changes', async () => {
    const { r } = await setup();const states={ knowledge: { running: true, frameable: true }, model: { running: true }, warnings: [] }
    vi.mocked(r.loadServiceStates).mockResolvedValue(states);await click('读取当前服务状态');expect(wrapper!.find('iframe').exists()).toBe(true)
    const pending=deferred<Awaited<ReturnType<typeof r.loadServiceStates>>>();vi.mocked(r.loadServiceStates).mockReturnValueOnce(pending.promise)
    await click('读取当前服务状态');expect(wrapper!.find('iframe').exists()).toBe(false)
    pending.reject(Error('isolated failed state'));await flushPromises();expect(wrapper!.find('iframe').exists()).toBe(false)
    await click('读取当前服务状态');expect(wrapper!.find('iframe').exists()).toBe(true)
    registerKnowledgeReadProvider(knowledgeFixture());await flushPromises();expect(wrapper!.find('iframe').exists()).toBe(false)
  })
  it('does not carry a running knowledge iframe into model navigation or service UNKNOWN', async () => {
    const p=provider();vi.mocked(p.run).mockRejectedValue(new LocalServiceOperationError('network-error','unknown'))
    const {r,router,store}=await setup({p});vi.mocked(r.loadServiceStates).mockResolvedValue({knowledge:{running:true,frameable:true},model:{running:true},warnings:[]})
    await click('读取当前服务状态');expect(wrapper!.find('iframe').exists()).toBe(true)
    await router.push('/knowledge?tab=models');await flushPromises();await click('读取当前服务状态');expect(wrapper!.find('iframe').exists()).toBe(false)
    await router.push('/knowledge');await flushPromises();await stop('知识库服务');await click('读取当前服务状态')
    expect(store.blockedUnknown).toBe(true);expect(wrapper!.find('iframe').exists()).toBe(false)
  })
  it.each([true, false])('never embeds without a write host when modelsOnly=%s', async modelsOnly => {
    const {r}=await setup({modelsOnly,p:null});vi.mocked(r.loadServiceStates).mockResolvedValue({knowledge:{running:true,frameable:true},model:{running:true},warnings:[]})
    await click('读取当前服务状态');expect(wrapper!.find('iframe').exists()).toBe(false)
  })
  it('does not turn the old model iframe into a new external-link capability', async () => {
    const { r, p } = await setup({ modelsOnly: true })
    vi.mocked(r.loadServiceStates).mockResolvedValue({ knowledge: { running: true, frameable: false }, model: { running: true }, warnings: [] })
    await click('读取当前服务状态');expect(wrapper!.findAll('a')).toHaveLength(0);expect(wrapper!.get('iframe').attributes('src')).toBe('http://127.0.0.1:8090/');expect(p.run).not.toHaveBeenCalled()
  })
  it('removes the old link during refresh and on failed reads, without retaining success', async () => {
    const { r } = await setup();vi.mocked(r.loadServiceStates).mockResolvedValue({ knowledge: { running: true, frameable: false }, model: { running: true }, warnings: [] })
    await click('读取当前服务状态');expect(wrapper!.find('a').exists()).toBe(true)
    const pending = deferred<Awaited<ReturnType<typeof r.loadServiceStates>>>()
    vi.mocked(r.loadServiceStates).mockReturnValue(pending.promise)
    await click('读取当前服务状态');expect(wrapper!.find('a').exists()).toBe(false)
    pending.reject(Error('test status failure'));await flushPromises();expect(wrapper!.find('a').exists()).toBe(false)
  })
  it('invalidates the link on source and route changes without executing the link or operations', async () => {
    const { r, p, router } = await setup();vi.mocked(r.loadServiceStates).mockResolvedValue({ knowledge: { running: true, frameable: false }, model: { running: true }, warnings: [] })
    await click('读取当前服务状态');expect(wrapper!.find('a').exists()).toBe(true)
    await router.push('/knowledge?tab=models');await flushPromises();expect(wrapper!.find('a').exists()).toBe(false)
    await click('读取当前服务状态');expect(wrapper!.find('a').exists()).toBe(true)
    registerKnowledgeReadProvider(knowledgeFixture());await flushPromises();expect(wrapper!.find('a').exists()).toBe(false);expect(p.run).not.toHaveBeenCalled()
  })
  it('does not probe, use CLI, run operations or create iframe/links on mount', async () => {
    const { p, r } = await setup(); expect(r.loadServiceStates).not.toHaveBeenCalled(); expect(r.status).not.toHaveBeenCalled(); expect(p.run).not.toHaveBeenCalled()
    expect(button('核对关闭模型启动器').attributes('disabled')).toBeDefined(); expect(wrapper!.findAll('iframe,a,object,img')).toHaveLength(0)
    expect(wrapper!.findAll('button').some(value => value.text().includes('启动') && !value.text().includes('关闭模型启动器'))).toBe(false)
    expect(wrapper!.text()).toContain('沿用原本机启动器面板'); expect(wrapper!.text()).toContain('不能保证只关闭本页')
  })
  it('explains absent capability and does not silently use read-only builds', async () => {
    const { r } = await setup({ p: null }); expect(button('读取当前服务状态').attributes('disabled')).toBeDefined(); expect(wrapper!.text()).toContain('当前构建未接入服务启停能力'); expect(r.loadServiceStates).not.toHaveBeenCalled()
  })
  it('reads just the two service-status capability endpoints on explicit request', async () => {
    const { p, r } = await setup(); await click('读取当前服务状态'); expect(r.loadServiceStates).toHaveBeenCalledOnce(); expect(r.status).not.toHaveBeenCalled(); expect(p.run).not.toHaveBeenCalled(); expect(wrapper!.text()).toContain('本次读取：服务可达')
  })
  it.each(['知识库服务', '模型启动器'])('needs separate confirmation for every %s close', async service => {
    const { p } = await setup(); await prepare(service); expect(p.run).not.toHaveBeenCalled(); expect(button('确认并关闭这一次').attributes('disabled')).toBeDefined()
    expect(wrapper!.text()).toContain('所有客户端'); await check(); await click('确认并关闭这一次'); expect(p.run).toHaveBeenCalledOnce()
    expect(wrapper!.text()).toContain('已收到关闭回执'); expect(wrapper!.text()).toContain('不证明所有相关进程均已结束')
    await prepare(service); expect(button('确认并关闭这一次').attributes('disabled')).toBeDefined(); await check(); await click('确认并关闭这一次'); expect(p.run).toHaveBeenCalledTimes(2)
  })
  it('keeps model guidance in the existing accessible tip', async () => {
    const {p}=await setup({modelsOnly:true})
    expect(wrapper!.text()).not.toContain('关闭启动器不等于终止已运行的模型')
    const tip=wrapper!.get('button[aria-label="模型服务说明"]')
    await tip.trigger('focus');await flushPromises()
    expect(document.body.textContent).toContain('关闭启动器不等于终止已运行的模型')
    await tip.trigger('keydown',{key:'Escape'});await flushPromises()
    expect(tip.attributes('aria-describedby')).toBeUndefined();expect(p.run).not.toHaveBeenCalled()
  })
  it('invalidates a checked confirmation on route, project or provider changes', async () => {
    const { p, store, workspace, router } = await setup()
    for (const change of ['project', 'route', 'provider']) {
      await prepare(); await check()
      if (change === 'project') workspace.selectedProjectId = 'new-project'
      else if (change === 'route') await router.push('/knowledge?tab=models')
      else registerLocalServiceOperationsProvider(provider())
      await nextTick(); expect(store.prepared).toBeNull(); expect(wrapper!.find('[aria-label="本次服务关闭确认"]').exists()).toBe(false)
    }
    expect(p.run).not.toHaveBeenCalled()
  })
  it('invalidates a checked confirmation on read source or modelsOnly changes', async () => {
    const { p, store } = await setup(); await prepare(); await check(); registerKnowledgeReadProvider(knowledgeFixture()); await nextTick(); expect(store.prepared).toBeNull()
    await prepare(); await check(); await wrapper!.setProps({ modelsOnly: true }); expect(store.prepared).toBeNull(); expect(p.run).not.toHaveBeenCalled()
  })
  it('blocks rapid double confirmation and another service while pending', async () => {
    const p = provider(), result = deferred<LocalServiceOperationReply>(); vi.mocked(p.run).mockReturnValue(result.promise); await setup({ p }); await prepare(); await check()
    const execute = button('确认并关闭这一次'); await execute.trigger('click'); await execute.trigger('click'); expect(p.run).toHaveBeenCalledOnce()
    expect(button('核对关闭知识库服务').attributes('disabled')).toBeDefined(); expect(button('读取当前服务状态').attributes('disabled')).toBeDefined()
    result.resolve({ service: 'model', action: 'stop', state: { running: false } }); await flushPromises()
  })
  it('keeps UNKNOWN after status refresh; no retry and no successful late receipt', async () => {
    const p = provider(), result = deferred<LocalServiceOperationReply>(); vi.mocked(p.run).mockReturnValue(result.promise); const { store } = await setup({ p }); await stop(); await click('停止等待关闭回执')
    expect(store.blockedUnknown).toBe(true); expect(wrapper!.text()).toContain('刷新状态不会解除此保护')
    result.resolve({ service: 'model', action: 'stop', state: { running: false } }); await flushPromises(); await click('读取当前服务状态')
    expect(store.records[0]!.status).toBe('unknown'); expect(button('核对关闭模型启动器').attributes('disabled')).toBeDefined(); expect(p.run).toHaveBeenCalledOnce()
  })
  it('does not echo backend errors or render URLs/HTML as actions', async () => {
    const p = provider(); vi.mocked(p.run).mockRejectedValue(Error('PRIVATE <iframe src="https://invalid.test">')); await setup({ p }); await stop()
    expect(wrapper!.text()).not.toContain('PRIVATE'); expect(wrapper!.findAll('iframe,a,object,img')).toHaveLength(0)
  })
  it('keeps backend reported failure distinct from unknown', async () => {
    const p = provider(); vi.mocked(p.run).mockRejectedValue(new LocalServiceOperationError('backend-failure', 'reported-failure')); await setup({ p }); await stop('知识库服务')
    expect(wrapper!.text()).toContain('后台报告未关闭'); expect(wrapper!.text()).toContain('可能已有进程或文件受到影响')
  })
  it('leaving cannot turn a late reply into current success', async () => {
    const p = provider(), result = deferred<LocalServiceOperationReply>(); vi.mocked(p.run).mockReturnValue(result.promise); const { store } = await setup({ p }); await stop(); wrapper!.unmount(); wrapper = undefined
    result.resolve({ service: 'model', action: 'stop', state: { running: false } }); await flushPromises()
    expect(store.records[0]).toMatchObject({ status: 'unknown', detached: true, reply: null }); expect(store.states).toBeNull()
  })
})


describe('knowledge start UI retains original flow with explicit side-effect review', () => {
  it('shows a real start only after explicit unreachable status and confirms the original script', async () => {
    const { p, r } = await setup(); vi.mocked(r.loadServiceStates).mockResolvedValue({ knowledge: { running: false, frameable: false }, model: { running: false }, warnings: [] })
    await click('读取当前服务状态'); await click('核对启动知识库服务'); expect(p.run).not.toHaveBeenCalled(); expect(button('确认并启动这一次').attributes('disabled')).toBeDefined()
    for (const text of ['ExecutionPolicy Bypass', '既有 JWT', '127.0.0.1:8081', '检查摘要、日志和 PID', 'disabled', '数据库']) expect(wrapper!.text()).toContain(text)
    const checkbox = wrapper!.get('[aria-label="确认本次服务启动"]'); await (checkbox.element.matches('input') ? checkbox : checkbox.get('input')).setValue(true)
    await click('确认并启动这一次'); expect(p.run).toHaveBeenCalledOnce(); expect(vi.mocked(p.run).mock.calls[0]![0]).toEqual({ service: 'knowledge', action: 'start' })
    expect(wrapper!.text()).toContain('已收到启动回执'); expect(wrapper!.text()).toContain('不代表登录、检索或索引就绪'); expect(wrapper!.findAll('iframe,a,object')).toHaveLength(0)
  })
  it('uses the original one-click model start with no review or checkbox', async () => {
    const {r,p}=await setup({modelsOnly:true});vi.mocked(r.loadServiceStates).mockResolvedValue({model:{running:false},warnings:[]});await click('读取当前服务状态')
    vi.mocked(r.loadServiceStates).mockResolvedValue({model:{running:true},warnings:[]});await click('启动服务')
    expect(p.run).toHaveBeenCalledOnce();expect(vi.mocked(p.run).mock.calls[0]![0]).toEqual({service:'model',action:'start'})
    expect(wrapper!.find('.service-confirm').exists()).toBe(false);expect(wrapper!.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper!.get('iframe').attributes('src')).toBe('http://127.0.0.1:8090/')
  })
})


describe('original model page iframe lifecycle',()=>{
 it('reads status on model entry only, embeds the original page and does not dispatch an operation',async()=>{const {r,p}=await setup({modelsOnly:true});expect(r.loadServiceStates).toHaveBeenCalledOnce();expect(r.status).not.toHaveBeenCalled();expect(p.run).not.toHaveBeenCalled();expect(wrapper!.get('iframe').attributes()).toMatchObject({src:'http://127.0.0.1:8090/',title:'本地 AI 服务启动器',referrerpolicy:'no-referrer'});expect(wrapper!.find('a').exists()).toBe(false)})
 it('removes model frame on failed reads and while the original stop is pending',async()=>{
   const p=provider(),result=deferred<LocalServiceOperationReply>(),{r}=await setup({modelsOnly:true,p})
   vi.mocked(r.loadServiceStates).mockRejectedValueOnce(Error('offline'));await click('读取当前服务状态');expect(wrapper!.find('iframe').exists()).toBe(false)
   await click('读取当前服务状态');expect(wrapper!.find('iframe').exists()).toBe(true)
   vi.mocked(p.run).mockReturnValueOnce(result.promise);await button('关闭服务').trigger('click');await flushPromises();expect(wrapper!.find('iframe').exists()).toBe(false)
   await button('关闭服务').trigger('click');expect(p.run).toHaveBeenCalledOnce();expect(wrapper!.find('.service-confirm').exists()).toBe(false)
   vi.mocked(r.loadServiceStates).mockResolvedValue({model:{running:false},warnings:[]});result.resolve({service:'model',action:'stop',state:{running:false}});await flushPromises()
   expect(button('启动服务').exists()).toBe(true);expect(wrapper!.find('iframe').exists()).toBe(false)
 })
 it('retains UNKNOWN and prevents a second model dispatch after interrupted waiting',async()=>{
   const p=provider(),result=deferred<LocalServiceOperationReply>(),{store}=await setup({modelsOnly:true,p});vi.mocked(p.run).mockReturnValueOnce(result.promise)
   await click('关闭服务');await click('停止等待关闭回执');result.resolve({service:'model',action:'stop',state:{running:false}});await flushPromises();await click('读取当前服务状态')
   expect(store.blockedUnknown).toBe(true);expect(button('关闭服务').attributes('disabled')).toBeDefined();expect(p.run).toHaveBeenCalledOnce();expect(wrapper!.find('iframe').exists()).toBe(false)
 })
})


describe('serial model entry probe during source/tab changes',()=>{
 it.each(['source','tab'] as const)('waits for the previous read and probes only the latest %s context once',async change=>{const first=knowledgeFixture(),pending=deferred<Awaited<ReturnType<typeof first.loadServiceStates>>>();vi.mocked(first.loadServiceStates).mockReturnValueOnce(pending.promise).mockResolvedValue({model:{running:false},warnings:[]});const {p,store}=await setup({modelsOnly:true,r:first});expect(store.reading).toBe(true);let current=first;if(change==='source'){current=knowledgeFixture();vi.mocked(current.loadServiceStates).mockResolvedValue({model:{running:false},warnings:[]});registerKnowledgeReadProvider(current)}else{await wrapper!.setProps({modelsOnly:false});await wrapper!.setProps({modelsOnly:true})}await flushPromises();expect(current.loadServiceStates).toHaveBeenCalledTimes(change==='source'?0:1);pending.resolve({model:{running:true},warnings:[]});await flushPromises();expect(current.loadServiceStates).toHaveBeenCalledTimes(change==='source'?1:2);expect(store.states?.model?.running).toBe(false);expect(wrapper!.find('iframe').exists()).toBe(false);expect(p.run).not.toHaveBeenCalled();await flushPromises();expect(current.loadServiceStates).toHaveBeenCalledTimes(change==='source'?1:2)})
 it('drops a queued entry probe on unmount instead of starting a detached request',async()=>{const first=knowledgeFixture(),pending=deferred<Awaited<ReturnType<typeof first.loadServiceStates>>>();vi.mocked(first.loadServiceStates).mockReturnValue(pending.promise);await setup({modelsOnly:true,r:first});await wrapper!.setProps({modelsOnly:false});await wrapper!.setProps({modelsOnly:true});wrapper!.unmount();wrapper=undefined;pending.resolve({model:{running:true},warnings:[]});await flushPromises();expect(first.loadServiceStates).toHaveBeenCalledOnce()})
})
