import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ServicesView from '../src/views/ServicesView.vue'
import { useServiceStatusStore } from '../src/stores/service-status'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { useProjectSetupStore } from '../src/stores/project-setup'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { useWorkspaceStore } from '../src/stores/workspace'
import { companionBrowserProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { knowledgeReadProvider } from '../src/knowledge-read-integration'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { projectSetupProvider } from '../src/project-setup-integration'
import { CreatorOperationError, type CreatorOperationsProvider } from '../src/domain/creator-operations'
import { ProjectSetupError, type ProjectSetupProvider } from '../src/domain/project-setup'
import { RUNTIME_STATES, runtimeStateLabel, type CompanionBrowserProvider, type ProjectRead, type RuntimeState } from '../src/domain/companion-browser'
import type { KnowledgeReadProvider, KnowledgeServiceStates } from '../src/domain/knowledge-read'
import { createCompanionBrowserProvider, type CompanionFetch } from '../src/adapters/companion-browser'
import { createKnowledgeReadProvider, type KnowledgeFetch } from '../src/adapters/knowledge-read'

const id = 'aaaaaaaaaaaaaaaa', other = 'bbbbbbbbbbbbbbbb'
const project = { id, name: '实际工程', path: '/offline/registered-project', requiredCreatorVersion: '3.8.8' }
const snapshot = (state: RuntimeState = 'ready'): ProjectRead => ({ projects: [{ ...project }], statuses: [{ projectId: id, state, creatorVersion: '3.8.8', capabilityProfile: 'authoring', sessionId: 'bridge-session' }], dashboard: [], warnings: [] })
const states = (): KnowledgeServiceStates => ({ knowledge: { running: true, frameable: false }, model: { running: true }, warnings: [] })
function source(): CompanionBrowserProvider { return { label: '原 Companion 来源', runtimeProbesEnabled: true, dashboardDiscoveryEnabled: false, loadProjects: vi.fn(async () => snapshot()), loadCounts: vi.fn(async () => ({ sessionId: 's1', counts: {}, latest: {} })), loadLogs: vi.fn(async () => []), loadCalls: vi.fn() } }
function knowledge(): KnowledgeReadProvider { return { label: '原知识服务来源', status: vi.fn(), loadServiceStates: vi.fn(async () => states()), search: vi.fn(), listKnowledgeBases: vi.fn(), viewKnowledgeBase: vi.fn(), listDocuments: vi.fn(), viewDocument: vi.fn(), downloadDocument: vi.fn(), listChunks: vi.fn(), listAgents: vi.fn() } }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
let pinia: ReturnType<typeof createPinia>, wrapper: VueWrapper | undefined
async function enter() { wrapper = mount(ServicesView, { attachTo: document.body, global: { plugins: [pinia, ElementPlus] } }); await flushPromises() }
function leave() { wrapper?.unmount(); wrapper = undefined }
function refreshButton() { return wrapper!.get('.service-status-toolbar button.el-button') }
beforeEach(() => { pinia = createPinia(); setActivePinia(pinia); vi.stubGlobal('fetch', vi.fn()); vi.stubEnv('MODE', 'companion-workspace') })
afterEach(() => { leave(); companionBrowserProvider.value = null; companionProjectEntryProvider.value = null; knowledgeReadProvider.value = null; creatorOperationsProvider.value = null; projectSetupProvider.value = null; document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('isolated real service reads', () => {
  it('is inert on binding, uses only the approved four GETs and never writes the shared operation snapshot', async () => {
    const projectsFetch = vi.fn<CompanionFetch>(async path => json(path === '/api/projects' ? [project] : snapshot().statuses))
    const servicesFetch = vi.fn<KnowledgeFetch>(async path => json(path === '/api/knowledge-service/status' ? { running: true, frameable: false } : { running: true }))
    const projectSource = createCompanionBrowserProvider({ fetch: projectsFetch, dashboardDiscovery: false })
    const knowledgeSource = createKnowledgeReadProvider({ fetch: servicesFetch })
    const store = useServiceStatusStore(), browser = useCompanionBrowserStore()
    store.bind(projectSource, knowledgeSource)
    expect(projectsFetch).not.toHaveBeenCalled(); expect(servicesFetch).not.toHaveBeenCalled()
    await store.refresh()
    expect(projectsFetch.mock.calls.map(([path]) => path)).toEqual(['/api/projects', '/api/status'])
    expect(servicesFetch.mock.calls.map(([path]) => path)).toEqual(['/api/knowledge-service/status', '/api/model-service/status'])
    for (const [, init] of [...projectsFetch.mock.calls, ...servicesFetch.mock.calls]) expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', redirect: 'error' })
    expect(store.projects?.projects).toEqual([project]); expect(store.services).toEqual(states())
    expect(store.projectObservedAt).not.toBe(''); expect(store.serviceObservedAt).not.toBe('')
    expect(browser.projectSnapshotRevision).toBe(0); expect(browser.provider).toBeNull(); expect(browser.connected).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('deduplicates clicks through the whole flight, including synchronous provider re-entry', async () => {
    const store = useServiceStatusStore(), read = source(), service = knowledge(), projectWait = deferred<ProjectRead>(), serviceWait = deferred<KnowledgeServiceStates>()
    read.loadProjects = vi.fn(() => { void store.refresh(); return projectWait.promise })
    service.loadServiceStates = vi.fn(() => serviceWait.promise)
    store.bind(read, service); const first = store.refresh(); const second = store.refresh()
    void second; await flushPromises()
    expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(service.loadServiceStates).toHaveBeenCalledTimes(1)
    projectWait.resolve(snapshot()); await flushPromises(); expect(store.loading).toBe(true)
    void store.refresh(); expect(read.loadProjects).toHaveBeenCalledTimes(1)
    serviceWait.resolve(states()); await first; expect(store.loading).toBe(false)
    expect(read.loadCounts).not.toHaveBeenCalled(); expect(service.status).not.toHaveBeenCalled()
  })

  it('keeps valid partial responses and missing state unknown, with no stale success after a failed retry', async () => {
    const projectFetch = vi.fn<CompanionFetch>(async path => path === '/api/status' ? json({}, 503) : json([project]))
    const serviceFetch = vi.fn<KnowledgeFetch>(async path => path === '/api/model-service/status' ? json({}, 403) : json({ running: false, frameable: false }))
    const store = useServiceStatusStore(); store.bind(createCompanionBrowserProvider({ fetch: projectFetch, dashboardDiscovery: false }), createKnowledgeReadProvider({ fetch: serviceFetch }))
    await store.refresh()
    expect(store.projects?.projects).toEqual([project]); expect(store.projects?.statuses).toEqual([])
    expect(store.projects?.warnings.join(' ')).toContain('未知')
    expect(store.services?.knowledge?.running).toBe(false); expect(store.services?.model).toBeUndefined()
    expect(store.services?.warnings.join(' ')).toContain('forbidden')
    projectFetch.mockImplementation(async () => { throw new Error('private raw diagnostic') })
    serviceFetch.mockImplementation(async () => { throw new Error('private raw diagnostic') })
    await store.refresh()
    expect(store.projects).toBeNull(); expect(store.projectObservedAt).toBe(''); expect(store.projectError).toContain('失败')
    expect(store.services?.knowledge).toBeUndefined(); expect(store.services?.model).toBeUndefined()
    expect(JSON.stringify(store.$state)).not.toContain('private raw diagnostic')
  })

  it('cancels source A and rejects late values after B or A → B → A replacement', async () => {
    const store = useServiceStatusStore(), a = source(), b = source(), late = deferred<ProjectRead>()
    a.loadProjects = vi.fn(() => late.promise); store.bind(a, null); const first = store.refresh(); await flushPromises()
    const signal = vi.mocked(a.loadProjects).mock.calls[0]![0]!
    store.bind(b, null); await store.refresh(); const bTime = store.projectObservedAt
    expect(signal.aborted).toBe(true); expect(store.projects?.projects).toEqual([project])
    late.resolve({ ...snapshot(), projects: [] }); await first
    expect(store.projectProvider).toBe(b); expect(store.projectObservedAt).toBe(bTime); expect(store.projects?.projects).toEqual([project])
    const again = deferred<ProjectRead>(); a.loadProjects = vi.fn(() => again.promise)
    store.bind(a, null); const old = store.refresh(); await flushPromises(); store.bind(b, null); store.bind(a, null)
    again.resolve(snapshot()); await old; expect(store.projects).toBeNull(); expect(store.projectObservedAt).toBe('')
  })

  it('never allows passive mode to use knowledge or a probe-enabled project reader', async () => {
    const store = useServiceStatusStore(), active = source(), service = knowledge()
    store.bind(active, service, { passive: true }); await store.refresh()
    expect(store.hasSource).toBe(false); expect(active.loadProjects).not.toHaveBeenCalled(); expect(service.loadServiceStates).not.toHaveBeenCalled()
    const read = { ...source(), runtimeProbesEnabled: false }
    store.bind(read, service); await store.refresh()
    expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(service.loadServiceStates).not.toHaveBeenCalled(); expect(service.status).not.toHaveBeenCalled()
  })

  it('blocks manual and automatic-style reads while a lane is held, cancels an in-flight read and never releases the lease', async () => {
    const store = useServiceStatusStore(), read = source(), service = knowledge(), lane = useProjectOperationLaneStore()
    store.bind(read, service); await store.refresh()
    const wait = deferred<ProjectRead>(); read.loadProjects = vi.fn(() => wait.promise)
    const pending = store.refresh(); await flushPromises(); const signal = vi.mocked(read.loadProjects).mock.calls[0]![0]!
    const lease = lane.acquire('创建工程')!; expect(signal.aborted).toBe(true); expect(store.projects).toBeNull(); expect(store.services).toBeNull()
    await store.refresh(); expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(lane.locked).toBe(true)
    wait.resolve(snapshot()); await pending; expect(store.projects).toBeNull(); expect(lane.locked).toBe(true)
    lane.release(lease); await flushPromises(); expect(read.loadProjects).toHaveBeenCalledTimes(1)
  })

  it('does not clear UNKNOWN operation barriers, alter receipts or advance the shared revision', async () => {
    const read = source(), browser = useCompanionBrowserStore(), actions: CreatorOperationsProvider = { label: 'offline actions', run: vi.fn(async () => { throw new CreatorOperationError('timeout', 'unknown') }), waitForIdle: vi.fn(async () => {}) }
    creatorOperationsProvider.value = actions; await browser.connect(read)
    const operations = useCreatorOperationsStore(); await operations.direct(id, 'focus')
    expect(operations.lastReceipt?.phase).toBe('unknown'); const receipt = operations.lastReceipt, revision = browser.projectSnapshotRevision
    const store = useServiceStatusStore(); store.bind(read, knowledge()); await store.refresh()
    expect(store.blockedReason).toContain('未知'); expect(store.projects).toBeNull(); expect(read.loadProjects).toHaveBeenCalledTimes(1)
    expect(browser.projectSnapshotRevision).toBe(revision); expect(operations.lastReceipt).toBe(receipt); expect(operations.canPrepare(id, 'focus')).toBe(false)
    expect(actions.run).toHaveBeenCalledTimes(1)
  })

  it('blocks a frozen Creator confirmation and a project-setup confirmation without dismissing either', async () => {
    const read = source(), browser = useCompanionBrowserStore(); creatorOperationsProvider.value = { label: 'offline actions', run: vi.fn(), waitForIdle: vi.fn() }; await browser.connect(read)
    const operations = useCreatorOperationsStore(), draft = operations.prepare(id, 'stop')!, store = useServiceStatusStore()
    store.bind(read, knowledge()); await store.refresh(); expect(store.projects).toBeNull(); expect(operations.prepared).toBe(draft)
    operations.closeDialog();
    const writer: ProjectSetupProvider = { label: 'offline setup', register: vi.fn(), start: vi.fn(), status: vi.fn(), waitForIdle: vi.fn(async () => {}) }
    projectSetupProvider.value = writer
    const setup = useProjectSetupStore(), preview = setup.prepareRegistration('/offline/new-project')!
    expect(preview).not.toBeNull(); await store.refresh()
    expect(setup.preparedRegistration).toBe(preview); expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(store.projects).toBeNull(); expect(writer.register).not.toHaveBeenCalled()
  })

  it('preserves a real unknown registration result and only unblocks after an explicit engineering readback', async () => {
    const read = source(), browser = useCompanionBrowserStore()
    const writer: ProjectSetupProvider = { label: 'offline setup', register: vi.fn(async () => { throw new ProjectSetupError('timeout', 'unknown') }), start: vi.fn(), status: vi.fn(), waitForIdle: vi.fn(async () => {}) }
    projectSetupProvider.value = writer; await browser.connect(read)
    const store = useServiceStatusStore(), setup = useProjectSetupStore(); store.bind(read, knowledge()); await store.refresh()
    expect(store.projects).not.toBeNull()
    await setup.sendRegistration(setup.prepareRegistration('/offline/new-project'), true)
    const receipt = setup.registrationReceipt, revision = browser.projectSnapshotRevision
    expect(receipt?.phase).toBe('unknown'); expect(store.projects).toBeNull(); expect(store.blockedReason).toContain('未知')
    await store.refresh(); expect(browser.projectSnapshotRevision).toBe(revision); expect(setup.registrationReceipt).toBe(receipt)
    expect(read.loadProjects).toHaveBeenCalledTimes(2); expect(writer.register).toHaveBeenCalledTimes(1)
    await browser.refreshProjects(); expect(store.blockedReason).toBe('')
    expect(store.projects).toBeNull(); expect(setup.registrationReceipt).toBe(receipt)
  })

  it('does not cancel or duplicate an already-running shared project read', async () => {
    const read = source(), wait = deferred<ProjectRead>(), browser = useCompanionBrowserStore(), store = useServiceStatusStore()
    read.loadProjects = vi.fn(() => wait.promise)
    const pending = browser.connect(read); store.bind(read, knowledge()); await store.refresh()
    expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(vi.mocked(read.loadProjects).mock.calls[0]![0]!.aborted).toBe(false)
    expect(store.projects).toBeNull(); expect(store.blockedReason).not.toBe('')
    wait.resolve(snapshot()); await pending; expect(store.blockedReason).toBe(''); expect(store.projects).toBeNull()
  })

})

describe('service status DOM and lifecycle', () => {
  it('reads exactly once on an opted-in normal entry and displays actual sources, timestamps and all eight Creator states', async () => {
    const read = source(), service = knowledge()
    read.loadProjects = vi.fn(async () => ({ projects: RUNTIME_STATES.map((state, index) => ({ ...project, id: `p${index}`, name: `工程 ${state}` })), statuses: RUNTIME_STATES.map((state, index) => ({ ...snapshot(state).statuses[0]!, projectId: `p${index}` })), dashboard: [], warnings: [] }))
    registerCompanionBrowserProvider(read, undefined, { projectEntry: 'read' }); knowledgeReadProvider.value = service
    await enter(); await flushPromises()
    expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(service.loadServiceStates).toHaveBeenCalledTimes(1); expect(service.status).not.toHaveBeenCalled()
    expect(wrapper!.findAll('.creator-status-row')).toHaveLength(8)
    for (const [index,state] of RUNTIME_STATES.entries()) expect(wrapper!.findAll('.creator-status-row')[index]!.get('.companion-status-tag').text()).toBe(runtimeStateLabel(state))
    expect(wrapper!.text()).toContain('原 Companion 来源'); expect(wrapper!.text()).toContain('原知识服务来源'); expect(wrapper!.findAll('time').length).toBeGreaterThan(2)
    expect(wrapper!.get('[data-service="comfyui"] .el-tag').text()).toBe('状态未知 · 待核对')
    expect(wrapper!.get('[data-service="model"] .el-tag').text()).toBe('启动器可达')
    expect(wrapper!.text()).not.toContain('示例'); expect(wrapper!.text()).not.toContain('连接边界')
    expect(read.loadCounts).not.toHaveBeenCalled(); expect(read.loadLogs).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves manual-only registration, partial errors and unknown versions without counting discovered or orphan projects', async () => {
    const read = source(), service = knowledge()
    read.loadProjects = vi.fn(async (): Promise<ProjectRead> => ({ projects: [{ ...project }, { id: other, name: '缺少状态工程', path: '/missing' }], statuses: [{ projectId: 'orphan', state: 'ready', capabilityProfile: 'authoring' }], dashboard: [{ path: '/unregistered', name: '未登记工程', source: 'dashboard', exists: true }], warnings: ['运行状态未取得有效数据'] }))
    service.loadServiceStates = vi.fn(async () => ({ model: { running: true }, warnings: ['知识库服务状态未知：[forbidden]'] }))
    registerCompanionBrowserProvider(read); knowledgeReadProvider.value = service; await enter()
    expect(read.loadProjects).not.toHaveBeenCalled(); await refreshButton().trigger('click'); await flushPromises()
    expect(wrapper!.findAll('.creator-status-row')).toHaveLength(2); expect(wrapper!.text()).toContain('2 个已登记工程')
    expect(wrapper!.findAll('.creator-status-row .el-tag').every(tag => tag.text() === '未读取')).toBe(true)
    expect(wrapper!.text()).toContain('未读取'); expect(wrapper!.text()).toContain('未返回'); expect(wrapper!.text()).not.toContain('orphan'); expect(wrapper!.text()).not.toContain('未登记工程')
    expect(wrapper!.get('[data-service="knowledge"] .el-tag').text()).toBe('读取失败'); expect(wrapper!.get('[data-service="knowledge"]').find('time').exists()).toBe(false)
    expect(wrapper!.text()).toContain('部分服务状态读取失败'); expect(refreshButton().text()).toBe('重试读取')
    const tip = wrapper!.get('button[aria-label="工程状态读取详情"]'); await tip.trigger('focus'); await flushPromises()
    expect(tip.attributes('aria-describedby')).toBeTruthy(); await tip.trigger('keydown', { key: 'Escape' }); expect(tip.attributes('aria-describedby')).toBeUndefined()
    service.loadServiceStates = vi.fn(async () => ({ knowledge: { running: false, frameable: false }, model: { running: false }, warnings: [] }))
    await refreshButton().trigger('click'); await flushPromises()
    expect(wrapper!.get('[data-service="knowledge"] .el-tag').text()).toBe('未连接'); expect(wrapper!.get('[data-service="model"] .el-tag').text()).toBe('未连接')
    expect(wrapper!.get('[data-service="knowledge"]').text()).not.toContain('已停止'); expect(wrapper!.get('[data-service="model"]').text()).not.toContain('已停止')
  })

  it('keeps dedicated hosts on real unknown data even with an existing workspace demo and no source', async () => {
    await useWorkspaceStore().openDemo(); await enter()
    expect(wrapper!.find('[data-testid="real-service-status"]').exists()).toBe(true); expect(wrapper!.text()).not.toContain('示例')
    expect(refreshButton().attributes('disabled')).toBeDefined(); expect(wrapper!.text()).toContain('工程数量未读取')
    expect(wrapper!.text()).not.toContain('0 个已登记工程'); expect(fetch).not.toHaveBeenCalled()
  })

  it('shows zero registrations only after a valid empty response and clears success on an explicit failed retry', async () => {
    const read = source(); read.loadProjects = vi.fn(async () => ({ projects: [], statuses: [], dashboard: [], warnings: [] }))
    registerCompanionBrowserProvider(read, undefined, { projectEntry: 'read' }); await enter()
    expect(wrapper!.text()).toContain('0 个已登记工程'); expect(wrapper!.text()).toContain('暂无已登记工程')
    read.loadProjects = vi.fn(async () => { throw Error('private token') }); await refreshButton().trigger('click'); await flushPromises()
    expect(wrapper!.get('[data-service="companion"] .el-tag').text()).toBe('读取失败'); expect(wrapper!.text()).toContain('工程数量未读取')
    expect(wrapper!.findAll('time')).toHaveLength(0); expect(wrapper!.text()).not.toContain('private token')
  })

  it('does not retry a blocked entry when the lane is released; explicit retry remains available', async () => {
    const read = source(), lane = useProjectOperationLaneStore(), lease = lane.acquire('导入工程')!
    registerCompanionBrowserProvider(read, undefined, { projectEntry: 'read' }); await enter()
    expect(read.loadProjects).not.toHaveBeenCalled(); expect(refreshButton().attributes('disabled')).toBeDefined()
    lane.release(lease); await flushPromises(); expect(read.loadProjects).not.toHaveBeenCalled()
    await refreshButton().trigger('click'); await flushPromises(); expect(read.loadProjects).toHaveBeenCalledTimes(1)
  })

  it.each(['leave', 'hidden', 'replace'] as const)('cancels on %s and discards late source evidence', async change => {
    const read = source(), service = knowledge(), late = deferred<ProjectRead>(), lateService = deferred<KnowledgeServiceStates>()
    read.loadProjects = vi.fn(() => late.promise); service.loadServiceStates = vi.fn(() => lateService.promise)
    registerCompanionBrowserProvider(read, undefined, { projectEntry: 'read' }); knowledgeReadProvider.value = service; await enter()
    const signal = vi.mocked(read.loadProjects).mock.calls[0]![0]!, store = useServiceStatusStore()
    if (change === 'leave') leave()
    if (change === 'hidden') { vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')) }
    if (change === 'replace') registerCompanionBrowserProvider(source())
    await flushPromises(); expect(signal.aborted).toBe(true)
    late.resolve(snapshot()); lateService.resolve(states()); await flushPromises()
    expect(store.projects).toBeNull(); expect(store.services).toBeNull(); expect(store.loading).toBe(false)
  })

  it('does not auto-retry failed entry reads', async () => {
    const read = source(); read.loadProjects = vi.fn(async () => { throw Error('offline') }); registerCompanionBrowserProvider(read, undefined, { projectEntry: 'read' })
    await enter(); await flushPromises(); expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(refreshButton().text()).toBe('重试读取')
  })

  it('readonly entry stays manual and only requests stored registrations with no knowledge or runtime probes', async () => {
    vi.stubEnv('MODE', 'companion-readonly')
    const fetcher = vi.fn<CompanionFetch>(async () => json([project])), read = createCompanionBrowserProvider({ fetch: fetcher, runtimeProbes: false }), service = knowledge()
    registerCompanionBrowserProvider(read, undefined, { projectEntry: 'read' }); knowledgeReadProvider.value = service; await enter()
    expect(fetcher).not.toHaveBeenCalled(); await refreshButton().trigger('click'); await flushPromises()
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual(['/api/projects']); expect(service.loadServiceStates).not.toHaveBeenCalled(); expect(service.status).not.toHaveBeenCalled()
    expect(wrapper!.text()).toContain('被动只读状态'); expect(wrapper!.get('.creator-status-row .el-tag').text()).toBe('运行状态未探测')
  })
})
