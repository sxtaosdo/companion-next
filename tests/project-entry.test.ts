import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, onBeforeUnmount, watch } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import ElementPlus, { ElMessage } from 'element-plus'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import { useRegisteredProjectPage } from '../src/composables/use-registered-project-page'
import { projectSetupProvider } from '../src/project-setup-integration'
import ProjectSetupWizard from '../src/components/ProjectSetupWizard.vue'
import { ProjectSetupError, type ProjectSetupProvider } from '../src/domain/project-setup'
import { useProjectSetupStore } from '../src/stores/project-setup'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { CallCounts, CompanionBrowserProvider, ProjectRead, RuntimeState } from '../src/domain/companion-browser'
import { createCompanionBrowserProvider, type CompanionFetch } from '../src/adapters/companion-browser'
import { companionBrowserProvider, companionEventProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { CreatorOperationError, type CreatorOperationsProvider } from '../src/domain/creator-operations'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { useCompanionProjectEntry } from '../src/composables/use-companion-project-entry'

const id = 'aaaaaaaaaaaaaaaa'
const project = { id, name: '先打开的 Creator', path: '/offline/registered-project', requiredCreatorVersion: '3.8.8' }
const snapshot = (state: RuntimeState = 'ready'): ProjectRead => ({ projects: [{ ...project }], statuses: [{ projectId: id, state, capabilityProfile: 'authoring' }], dashboard: [], warnings: [] })
const counts = (value = 2): CallCounts => ({ sessionId: 'offline-session', counts: { [id]: value }, latest: {} })
function reader(): CompanionBrowserProvider {
  return { label: 'offline reader', runtimeProbesEnabled: true, dashboardDiscoveryEnabled: false,
    loadProjects: vi.fn(async () => snapshot()), loadCounts: vi.fn(async () => counts()), loadLogs: vi.fn(async () => []),
    loadCalls: vi.fn(async () => ({ sessionId: 'offline-session', total: 0, retained: 0, records: [] })) }
}
function actions(): CreatorOperationsProvider {
  return { label: 'offline mutations', run: vi.fn(async () => ({ action: 'focus' as const, acknowledged: true as const })), waitForIdle: vi.fn(async () => {}) }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
let pinia: ReturnType<typeof createPinia>, wrapper: VueWrapper | undefined
const Host = defineComponent({ setup() {
  const store = useCompanionBrowserStore()
  // Match the view's existing source invalidation and leave cleanup.
  watch(companionBrowserProvider, next => { if (store.provider && store.provider !== next) store.disconnect() }, { flush: 'sync', immediate: true })
  useCompanionProjectEntry(store)
  onBeforeUnmount(() => store.cancelReads())
  return () => h('div')
} })
async function enter() { wrapper = mount(Host, { global: { plugins: [pinia] } }); await flushPromises() }
function leave() { wrapper?.unmount(); wrapper = undefined }
function register(source: CompanionBrowserProvider) { registerCompanionBrowserProvider(source, undefined, { projectEntry: 'read' }) }
function visibleAgain() { const store = useCompanionBrowserStore(); store.setLiveVisibility(false); store.setLiveVisibility(true) }
beforeEach(() => { pinia = createPinia(); setActivePinia(pinia); creatorOperationsProvider.value = null })
afterEach(() => { leave(); companionBrowserProvider.value = null; companionEventProvider.value = null; companionProjectEntryProvider.value = null; creatorOperationsProvider.value = null; projectSetupProvider.value = null; ElMessage.closeAll(); sessionStorage.clear(); document.body.innerHTML = ''; vi.useRealTimers() })

describe('explicit normal-workspace project entry', () => {
  it('registers without reading and preserves manual defaults and passive isolation', async () => {
    const source = reader(); registerCompanionBrowserProvider(source); await enter(); visibleAgain(); await flushPromises()
    expect(source.loadProjects).not.toHaveBeenCalled(); leave()
    register({ ...source, runtimeProbesEnabled: false }); await enter(); visibleAgain(); await flushPromises()
    expect(source.loadProjects).not.toHaveBeenCalled(); expect(companionProjectEntryProvider.value).toBeNull()
  })

  it('reads the existing projects/status/counts array contracts on entry, with no setup, calls or SSE', async () => {
    const fetch = vi.fn<CompanionFetch>(async path => new Response(JSON.stringify(path === '/api/projects' ? [project]
      : path === '/api/status' ? snapshot().statuses : path === '/api/calls/counts' ? counts() : null), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const source = createCompanionBrowserProvider({ fetch, runtimeProbes: true, dashboardDiscovery: false }), subscribe = vi.fn()
    registerCompanionBrowserProvider(source, { label: 'offline events', subscribe }, { projectEntry: 'read' })
    creatorOperationsProvider.value = actions()
    expect(fetch).not.toHaveBeenCalled(); await enter()
    const store = useCompanionBrowserStore()
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/projects', '/api/status', '/api/calls/counts'])
    expect(store.connected).toBe(true); expect(store.statuses[0]?.state).toBe('ready'); expect(store.counts).toEqual(counts())
    expect(store.liveEnabled).toBe(false); expect(subscribe).not.toHaveBeenCalled(); expect(creatorOperationsProvider.value.run).not.toHaveBeenCalled()
  })

  it('refreshes retained real snapshots and counts on route reentry without reconnecting', async () => {
    const source = reader(); register(source); await enter(); const store = useCompanionBrowserStore(), disconnect = vi.spyOn(store, 'disconnect')
    leave(); vi.mocked(source.loadProjects).mockResolvedValue(snapshot('stopped')); vi.mocked(source.loadCounts).mockResolvedValue(counts(5)); await enter()
    expect(source.loadProjects).toHaveBeenCalledTimes(2); expect(source.loadCounts).toHaveBeenCalledTimes(2)
    expect(store.statuses[0]?.state).toBe('stopped'); expect(store.counts?.counts[id]).toBe(5); expect(disconnect).not.toHaveBeenCalled()
  })

  it('waits for visibility, makes one read per visible entry and keeps unknown status unknown', async () => {
    const source = reader(), store = useCompanionBrowserStore(); vi.mocked(source.loadProjects).mockResolvedValue({ ...snapshot(), statuses: [], warnings: ['运行状态未取得'] })
    register(source); store.setLiveVisibility(false); await enter(); expect(source.loadProjects).not.toHaveBeenCalled()
    store.setLiveVisibility(true); await flushPromises(); store.setLiveVisibility(true); await flushPromises()
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(store.statuses).toEqual([]); expect(store.warnings).toEqual(['运行状态未取得'])
    visibleAgain(); await flushPromises(); expect(source.loadProjects).toHaveBeenCalledTimes(2)
  })

  it('does not auto-reconnect a manual disconnect until a new route entry', async () => {
    const source = reader(); register(source); await enter(); const store = useCompanionBrowserStore()
    store.disconnect(); visibleAgain(); await flushPromises()
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(store.connected).toBe(false)
    leave(); await enter(); expect(source.loadProjects).toHaveBeenCalledTimes(2); expect(store.connected).toBe(true)
  })

  it('does not cancel or duplicate a manual connection already in flight', async () => {
    const source = reader(), pending = deferred<ProjectRead>(), store = useCompanionBrowserStore(); vi.mocked(source.loadProjects).mockReturnValue(pending.promise)
    register(source); const connection = store.connect(source); await enter(); visibleAgain(); await flushPromises()
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(vi.mocked(source.loadProjects).mock.calls[0]?.[0]?.aborted).toBe(false)
    pending.resolve(snapshot()); await connection; expect(source.loadCounts).toHaveBeenCalledTimes(1)
  })

  it.each(['hidden', 'leave'] as const)('aborts owned project reads on %s and rejects their late completion', async reason => {
    const source = reader(), pending = deferred<ProjectRead>(); vi.mocked(source.loadProjects).mockReturnValue(pending.promise)
    register(source); await enter(); const store = useCompanionBrowserStore(), signal = vi.mocked(source.loadProjects).mock.calls[0]?.[0]
    if (reason === 'hidden') store.setLiveVisibility(false); else leave()
    expect(signal?.aborted).toBe(true); expect(store.projectLoading).toBe(false)
    pending.resolve(snapshot()); await flushPromises(); expect(store.projects).toEqual([]); expect(store.connected).toBe(false); expect(source.loadCounts).not.toHaveBeenCalled()
  })

  it('aborts owned counts on hide and does not accept late stale counts', async () => {
    const source = reader(), pending = deferred<CallCounts>(); vi.mocked(source.loadCounts).mockReturnValue(pending.promise)
    register(source); await enter(); const store = useCompanionBrowserStore(), signal = vi.mocked(source.loadCounts).mock.calls[0]?.[0]
    store.setLiveVisibility(false); expect(signal?.aborted).toBe(true); expect(store.countsLoading).toBe(false)
    pending.resolve(counts(90)); await flushPromises(); expect(store.counts).toBeNull()
  })

  it('does not cancel a newer manual counts read when the older entry is hidden', async () => {
    const source = reader(), older = deferred<CallCounts>(), newer = deferred<CallCounts>()
    vi.mocked(source.loadCounts).mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    register(source); await enter(); const store = useCompanionBrowserStore(), manual = store.refreshCounts()
    const manualSignal = vi.mocked(source.loadCounts).mock.calls[1]?.[0]
    store.setLiveVisibility(false); expect(manualSignal?.aborted).toBe(false)
    newer.resolve(counts(7)); await manual; older.resolve(counts(99)); await flushPromises()
    expect(store.counts?.counts[id]).toBe(7)
  })

  it('cancels old-source reads and never lets late A overwrite the new source B', async () => {
    const first = reader(), second = reader(), pending = deferred<ProjectRead>(); vi.mocked(first.loadProjects).mockReturnValue(pending.promise)
    vi.mocked(second.loadProjects).mockResolvedValue(snapshot('stopped')); register(first); await enter(); register(second); await flushPromises()
    expect(vi.mocked(first.loadProjects).mock.calls[0]?.[0]?.aborted).toBe(true); expect(second.loadProjects).toHaveBeenCalledTimes(1)
    pending.resolve(snapshot()); await flushPromises(); const store = useCompanionBrowserStore()
    expect(store.provider).toBe(second); expect(store.statuses[0]?.state).toBe('stopped'); expect(first.loadCounts).not.toHaveBeenCalled()
  })

  it('invalidates A → B → A even when the final registered source identity is unchanged', async () => {
    const source = reader(), pending = deferred<ProjectRead>(); vi.mocked(source.loadProjects).mockReturnValueOnce(pending.promise).mockResolvedValue(snapshot('stopped'))
    register(source); await enter(); register(reader()); register(source); await flushPromises()
    expect(source.loadProjects).toHaveBeenCalledTimes(2); pending.resolve(snapshot()); await flushPromises()
    expect(useCompanionBrowserStore().statuses[0]?.state).toBe('stopped')
  })

  it('never auto-retries a failed read or invents successful empty data', async () => {
    vi.useFakeTimers(); const source = reader(); vi.mocked(source.loadProjects).mockRejectedValue(new Error('offline unavailable'))
    register(source); await enter(); await vi.advanceTimersByTimeAsync(60_000); const store = useCompanionBrowserStore()
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(source.loadCounts).not.toHaveBeenCalled()
    expect(store.connected).toBe(false); expect(store.projectError).toBe('offline unavailable'); expect(store.counts).toBeNull()
  })

  it('leaves failed counts unknown without retrying the otherwise valid project observation', async () => {
    const source = reader(); vi.mocked(source.loadCounts).mockRejectedValue(new Error('counts unavailable')); register(source); await enter()
    const store = useCompanionBrowserStore(); expect(store.connected).toBe(true); expect(store.counts).toBeNull(); expect(store.countsError).toBe('counts unavailable')
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(source.loadCounts).toHaveBeenCalledTimes(1)
  })

  it.each(['unknown', 'reported-failure'] as const)('never substitutes automatic reentry/visibility reads for a %s operation check', async outcome => {
    const source = reader(), mutations = actions(); vi.mocked(source.loadProjects).mockResolvedValue(snapshot('stopped'))
    mutations.run = vi.fn(async () => { throw new CreatorOperationError('backend-failure', outcome) }); creatorOperationsProvider.value = mutations
    register(source); await enter(); const operations = useCreatorOperationsStore(), store = useCompanionBrowserStore()
    expect(await operations.direct(id, 'start')).toBe(false); expect(operations.blocksAutomaticProjectRead(source)).toBe(true)
    visibleAgain(); await flushPromises(); leave(); await enter()
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(operations.canPrepare(id, 'start')).toBe(false); expect(mutations.run).toHaveBeenCalledTimes(1)
    vi.mocked(source.loadProjects).mockResolvedValue(snapshot('unknown')); await store.refreshProjects()
    expect(operations.blocksAutomaticProjectRead(source)).toBe(true); visibleAgain(); await flushPromises(); expect(source.loadProjects).toHaveBeenCalledTimes(2)
    vi.mocked(source.loadProjects).mockResolvedValue(snapshot('stopped')); await store.refreshProjects()
    expect(operations.blocksAutomaticProjectRead(source)).toBe(false); expect(source.loadProjects).toHaveBeenCalledTimes(3)
    await flushPromises(); expect(source.loadProjects).toHaveBeenCalledTimes(3)
  })

  it.each(['confirmation', 'setup', 'lane'] as const)('does not invalidate an active %s and does not read when its guard later clears', async guard => {
    const source = reader(); register(source); creatorOperationsProvider.value = actions(); await enter()
    const store = useCompanionBrowserStore(), operations = useCreatorOperationsStore(), lane = useProjectOperationLaneStore()
    const lease = guard === 'lane' ? lane.acquire('创建工程') : null
    if (guard === 'confirmation') expect(operations.prepare(id, 'stop')).not.toBeNull()
    if (guard === 'setup') store.pauseProjectPolling(true)
    visibleAgain(); await flushPromises(); expect(source.loadProjects).toHaveBeenCalledTimes(1)
    if (guard === 'confirmation') { expect(operations.prepared).not.toBeNull(); operations.closeDialog() }
    if (guard === 'setup') store.pauseProjectPolling(false)
    if (lease) lane.release(lease)
    await flushPromises(); expect(source.loadProjects).toHaveBeenCalledTimes(1)
  })
})

// Real view/router wiring is part of this contract; fake readers never contact a service.
describe('normal project entry in the actual BrowserView', () => {
  async function mountView() {
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/projects', component: CompanionBrowserView }, { path: '/other', component: { render: () => h('p', 'other page') } },
    ] })
    await router.push('/projects'); await router.isReady()
    wrapper = mount({ render: () => h(RouterView) }, { attachTo: document.body, global: { plugins: [pinia, router, ElementPlus] } })
    await flushPromises(); return router
  }

  it('shows an already-ready Creator on first mount and refreshes changed status after leaving and returning', async () => {
    const source = reader(), mutations = actions(); register(source); creatorOperationsProvider.value = mutations
    const router = await mountView()
    expect(wrapper!.get('.companion-project-card').text()).toContain('已就绪')
    expect(wrapper!.get('.companion-project-card').text()).toContain('打开 Creator')
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(source.loadCounts).toHaveBeenCalledTimes(1)
    await router.push('/other'); await flushPromises(); vi.mocked(source.loadProjects).mockResolvedValue(snapshot('stopped'))
    await router.push('/projects'); await flushPromises()
    expect(wrapper!.get('.companion-project-card').text()).toContain('已停止')
    expect(wrapper!.get('.companion-project-card').text()).toContain('启动 Creator')
    expect(source.loadProjects).toHaveBeenCalledTimes(2); expect(source.loadCounts).toHaveBeenCalledTimes(2)
    expect(mutations.run).not.toHaveBeenCalled(); expect(wrapper!.findAll('[role="dialog"]').filter(dialog => dialog.isVisible())).toEqual([])
  })

  it('preserves unknown registration after closing setup, visibility, tab reentry and route reentry', async () => {
    const source = reader(), path = '/offline/to-register', writer: ProjectSetupProvider = {
      label: 'offline setup writer', register: vi.fn(async () => { throw new ProjectSetupError('timeout', 'unknown') }),
      start: vi.fn(), status: vi.fn(), waitForIdle: vi.fn(async () => {}),
    }
    register(source); projectSetupProvider.value = writer; const router = await mountView(), setup = useProjectSetupStore()
    const wizard = wrapper!.findComponent(ProjectSetupWizard).vm as unknown as { openForProject: () => void; close: () => void }
    wizard.openForProject(); await flushPromises()
    expect(await setup.sendRegistration(setup.prepareRegistration(path), true)).toBe(false)
    expect(setup.registrationReceipt?.phase).toBe('unknown'); expect(useProjectOperationLaneStore().locked).toBe(false)
    wizard.close(); await flushPromises(); expect(useCompanionBrowserStore().projectPollingPaused).toBe(false)
    expect(setup.blocksAutomaticProjectRead(source)).toBe(true)
    visibleAgain(); await flushPromises(); await router.push('/projects?tab=logs'); await router.push('/projects'); await flushPromises()
    await router.push('/other'); await flushPromises(); await router.push('/projects'); await flushPromises()
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(setup.prepareRegistration(path)).toBeNull()
    expect(writer.register).toHaveBeenCalledTimes(1); expect(writer.start).not.toHaveBeenCalled(); expect(writer.status).not.toHaveBeenCalled()
    await useCompanionBrowserStore().refreshProjects(); expect(setup.blocksAutomaticProjectRead(source)).toBe(false)
    expect(setup.prepareRegistration(path)).not.toBeNull(); expect(source.loadProjects).toHaveBeenCalledTimes(2)
  })

  it('refreshes logs-to-projects reentry in the same component without treating unrelated queries as entry', async () => {
    const source = reader(); register(source); const router = await mountView()
    await router.push('/projects?tab=logs'); await flushPromises(); expect(source.loadProjects).toHaveBeenCalledTimes(1)
    vi.mocked(source.loadProjects).mockResolvedValue(snapshot('stopped'))
    await router.push('/projects'); await flushPromises()
    expect(wrapper!.get('.companion-project-card').text()).toContain('已停止'); expect(source.loadProjects).toHaveBeenCalledTimes(2)
    await router.push('/projects?unrelated=value'); await flushPromises(); expect(source.loadProjects).toHaveBeenCalledTimes(2)
    useCompanionBrowserStore().disconnect(); await router.push('/projects?tab=logs'); await router.push('/projects'); await flushPromises()
    expect(source.loadProjects).toHaveBeenCalledTimes(2); expect(useCompanionBrowserStore().connected).toBe(false)
  })
})


describe('actual project route realtime navigation',()=>{
  async function routes(){
    vi.useFakeTimers();const source=reader(),channels:Array<{signal:AbortSignal|undefined;close:ReturnType<typeof vi.fn>}>=[]
    const events={label:'offline route events',subscribe:vi.fn((handlers:import('../src/domain/companion-live').CompanionEventHandlers,signal?:AbortSignal)=>{const close=vi.fn();channels.push({signal,close});handlers.onOpen();return close})}
    registerCompanionBrowserProvider(source,events,{projectEntry:'read'})
    const router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView},{path:'/away',component:defineComponent({render:()=>h('div','away')})},{path:'/shared',component:defineComponent({setup(){useRegisteredProjectPage();return ()=>h('div','shared production entry')}})}]})
    await router.push('/projects');wrapper=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[pinia,router,ElementPlus]}});await flushPromises()
    return {source,events,channels,router,store:useCompanionBrowserStore()}
  }
  it('resumes exactly one stream and snapshot after route return, but preserves a user stop',async()=>{
    const {source,events,channels,router,store}=await routes();store.startLive(events);await vi.advanceTimersByTimeAsync(0);await flushPromises()
    const reads=vi.mocked(source.loadProjects).mock.calls.length,countsBefore=vi.mocked(source.loadCounts).mock.calls.length
    await router.push('/away');await flushPromises();expect(store.liveEnabled).toBe(true);expect(store.liveState).toBe('suspended');expect(channels[0]!.signal?.aborted).toBe(true);expect(channels[0]!.close).toHaveBeenCalledTimes(1)
    await router.push('/projects');await flushPromises();await vi.advanceTimersByTimeAsync(0);await flushPromises()
    expect(store.liveState).toBe('open');expect(channels).toHaveLength(2);expect(source.loadProjects).toHaveBeenCalledTimes(reads+1);expect(source.loadCounts).toHaveBeenCalledTimes(countsBefore+1)
    await vi.advanceTimersByTimeAsync(2999);expect(source.loadProjects).toHaveBeenCalledTimes(reads+1);await vi.advanceTimersByTimeAsync(1);expect(source.loadProjects).toHaveBeenCalledTimes(reads+2)
    const stop=wrapper!.findAll('button').find(button=>button.text()==='停止实时更新');expect(stop).toBeDefined();await stop!.trigger('click');expect(store.liveEnabled).toBe(false)
    await router.push('/away');await router.push('/projects');await flushPromises();await vi.advanceTimersByTimeAsync(0)
    expect(store.liveState).toBe('off');expect(channels).toHaveLength(2)
  })
  it('keeps realtime suspended through shared overview/resource entry and help, then resumes once',async()=>{
    const {source,events,channels,router,store}=await routes();store.startLive(events);await vi.advanceTimersByTimeAsync(0)
    await router.push('/shared');await flushPromises();expect(store.liveEnabled).toBe(true);expect(store.livePageActive).toBe(false);expect(store.liveState).toBe('suspended');expect(channels).toHaveLength(1)
    await router.push('/away');await flushPromises();const reads=vi.mocked(source.loadProjects).mock.calls.length;await vi.advanceTimersByTimeAsync(6000);expect(source.loadProjects).toHaveBeenCalledTimes(reads);expect(channels).toHaveLength(1)
    await router.push('/projects');await flushPromises();await vi.advanceTimersByTimeAsync(0);expect(store.liveState).toBe('open');expect(channels).toHaveLength(2);expect(source.loadProjects).toHaveBeenCalledTimes(reads+1)
  })
  it('does not resume an old event source replaced while the project page is unmounted',async()=>{
    const {events,channels,router,store}=await routes();store.startLive(events);await vi.advanceTimersByTimeAsync(0);await router.push('/away');await flushPromises()
    const subscribe=vi.fn();companionEventProvider.value={label:'replacement',subscribe}
    await router.push('/projects');await flushPromises();await vi.advanceTimersByTimeAsync(0)
    expect(store.liveEnabled).toBe(false);expect(store.liveState).toBe('off');expect(channels).toHaveLength(1);expect(subscribe).not.toHaveBeenCalled()
  })
})
