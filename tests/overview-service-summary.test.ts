import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import OverviewServiceSummary from '../src/components/OverviewServiceSummary.vue'
import { OVERVIEW_SERVICE_INTERVAL, useOverviewServiceStatus } from '../src/composables/use-overview-service-status'
import { companionBrowserProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { knowledgeReadProvider } from '../src/knowledge-read-integration'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { CreatorOperationError, type CreatorOperationsProvider } from '../src/domain/creator-operations'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import type { KnowledgeReadProvider, KnowledgeServiceStates } from '../src/domain/knowledge-read'
import { createKnowledgeReadProvider, type KnowledgeFetch } from '../src/adapters/knowledge-read'

const good = (): KnowledgeServiceStates => ({ knowledge: { running: true, frameable: false }, model: { running: true }, warnings: [] })
function source(): CompanionBrowserProvider { return { label: '登记来源', runtimeProbesEnabled: true, loadProjects: vi.fn(async () => ({ projects: [{ id: 'aaaaaaaaaaaaaaaa', name: '隔离工程', path: '/offline/project' }], statuses: [{ projectId: 'aaaaaaaaaaaaaaaa', state: 'ready' as const, capabilityProfile: 'authoring' as const }], dashboard: [], warnings: [] })), loadCounts: vi.fn(), loadLogs: vi.fn(), loadCalls: vi.fn() } }
function reader(): KnowledgeReadProvider { return { label: '原服务来源', loadServiceStates: vi.fn(async () => good()), status: vi.fn(), search: vi.fn(), listKnowledgeBases: vi.fn(), viewKnowledgeBase: vi.fn(), listDocuments: vi.fn(), viewDocument: vi.fn(), downloadDocument: vi.fn(), listChunks: vi.fn(), listAgents: vi.fn() } }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (value: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail }); return { promise, resolve, reject } }
let wrapper: VueWrapper | undefined, state: ReturnType<typeof useOverviewServiceStatus>
let read: CompanionBrowserProvider, knowledge: KnowledgeReadProvider, directory: ReturnType<typeof useCompanionBrowserStore>
const Harness = defineComponent({ setup() { state = useOverviewServiceStatus(); return () => h('div') } })
async function enter() { wrapper = mount(Harness); await flushPromises() }
function visibility(value: 'visible' | 'hidden') { Object.defineProperty(document, 'visibilityState', { configurable: true, value }); document.dispatchEvent(new Event('visibilitychange')) }
beforeEach(() => {
  setActivePinia(createPinia()); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-20T10:05:00Z'))
  vi.stubGlobal('fetch', vi.fn()); vi.stubEnv('MODE', 'companion-workspace'); visibility('visible')
  read = source(); knowledge = reader(); registerCompanionBrowserProvider(read, undefined, { projectEntry: 'read' }); knowledgeReadProvider.value = knowledge
  directory = useCompanionBrowserStore(); directory.provider = read; directory.connected = true; directory.observedAt = new Date().toISOString()
})
afterEach(() => {
  wrapper?.unmount(); wrapper = undefined; companionBrowserProvider.value = null; companionProjectEntryProvider.value = null; knowledgeReadProvider.value = null; creatorOperationsProvider.value = null
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); document.body.innerHTML = ''
})
describe('overview service status lifecycle', () => {
  it('uses only original service GETs, never project reads, CLI, SSE or writes', async () => {
    const fetcher = vi.fn<KnowledgeFetch>(async path => new Response(JSON.stringify(path === '/api/knowledge-service/status' ? { running: true, frameable: false } : { running: true }), { status: 200 }))
    knowledgeReadProvider.value = createKnowledgeReadProvider({ fetch: fetcher })
    await enter()
    expect(fetcher.mock.calls.map(([path]) => path)).toEqual(['/api/knowledge-service/status', '/api/model-service/status'])
    for (const [, init] of fetcher.mock.calls) expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin' })
    expect(read.loadProjects).not.toHaveBeenCalled(); expect(read.loadCounts).not.toHaveBeenCalled(); expect(read.loadLogs).not.toHaveBeenCalled()
    expect(directory.liveEnabled).toBe(false); expect(fetch).not.toHaveBeenCalled()
  })
  it('waits 15 seconds after completion and coalesces manual reads with the pending flight', async () => {
    const pending = deferred<KnowledgeServiceStates>(); knowledge.loadServiceStates = vi.fn(() => pending.promise)
    await enter(); void state.refresh(); void state.refresh()
    await vi.advanceTimersByTimeAsync(60_000); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    pending.resolve(good()); await flushPromises(); expect(state.loading.value).toBe(false)
    await vi.advanceTimersByTimeAsync(OVERVIEW_SERVICE_INTERVAL - 1); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(2)
  })
  it('allows slow service GETs across background project polls without aborting or restarting the 15-second cadence', async () => {
    const pending = deferred<KnowledgeServiceStates>(); knowledge.loadServiceStates = vi.fn(() => pending.promise)
    await enter(); const signal = vi.mocked(knowledge.loadServiceStates).mock.calls[0]![0]!
    for (let poll = 0; poll < 3; poll++) {
      await vi.advanceTimersByTimeAsync(3_000)
      directory.backgroundProjectRead = true; directory.projectLoading = true; directory.countsLoading = true
      await nextTick(); expect(signal.aborted).toBe(false)
      directory.projectLoading = false; directory.countsLoading = false; directory.backgroundProjectRead = false
      await nextTick()
    }
    expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    pending.resolve(good()); await flushPromises(); expect(state.services.value?.model?.running).toBe(true)
    for (let poll = 0; poll < 4; poll++) {
      await vi.advanceTimersByTimeAsync(3_000); directory.projectLoading = true; await nextTick(); directory.projectLoading = false; await nextTick()
    }
    expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3_000); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(2)
  })
  it('keeps the previous visible snapshot while refreshing and marks failed results unknown without losing last success time', async () => {
    await enter(); const first = state.observedAt.value, value = state.services.value
    const pending = deferred<KnowledgeServiceStates>(); knowledge.loadServiceStates = vi.fn(() => pending.promise)
    void state.refresh(); await flushPromises(); expect(state.services.value).toBe(value); expect(state.observedAt.value).toBe(first)
    pending.reject(Error('offline')); await flushPromises()
    expect(state.services.value).toBe(value); expect(state.error.value).toContain('未知'); expect(state.stale.value).toBe(true); expect(state.observedAt.value).toBe(first)
  })
  it('does not advance the last valid service timestamp when both status GETs have no valid response', async () => {
    await enter(); const before = state.observedAt.value
    await vi.advanceTimersByTimeAsync(1_000)
    knowledge.loadServiceStates = vi.fn(async () => ({ warnings: ['两项读取失败'] }))
    await state.refresh()
    expect(state.observedAt.value).toBe(before); expect(state.error.value).toContain('未取得有效')
    expect(state.services.value?.knowledge).toBeUndefined(); expect(state.services.value?.model).toBeUndefined()
  })
  it('aborts hidden requests, drops late replies and reads again when visible', async () => {
    const pending = deferred<KnowledgeServiceStates>(); knowledge.loadServiceStates = vi.fn(() => pending.promise)
    await enter(); const signal = vi.mocked(knowledge.loadServiceStates).mock.calls[0]![0]!
    visibility('hidden'); expect(signal.aborted).toBe(true)
    pending.resolve(good()); await flushPromises(); expect(state.services.value).toBeNull()
    await vi.advanceTimersByTimeAsync(60_000); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    knowledge.loadServiceStates = vi.fn(async () => good()); visibility('visible'); await flushPromises()
    expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1); expect(state.services.value?.model?.running).toBe(true)
  })
  it.each(['project', 'knowledge'] as const)('rejects a late reply after replacing the %s source', async kind => {
    const pending = deferred<KnowledgeServiceStates>(); knowledge.loadServiceStates = vi.fn(() => pending.promise)
    await enter(); const signal = vi.mocked(knowledge.loadServiceStates).mock.calls[0]![0]!
    if (kind === 'knowledge') knowledgeReadProvider.value = reader()
    else {
      knowledge.loadServiceStates = vi.fn(async () => good())
      const next = { ...source(), label: '替换登记来源' }; registerCompanionBrowserProvider(next, undefined, { projectEntry: 'read' }); directory.provider = next
    }
    await flushPromises(); expect(signal.aborted).toBe(true)
    pending.resolve({ knowledge: { running: false, frameable: false }, model: { running: false }, warnings: ['旧来源'] }); await flushPromises()
    expect(state.services.value?.warnings).not.toContain('旧来源'); expect(state.services.value?.model?.running).toBe(true)
  })
  it('cleans up timers and aborts on unmount, rejecting an uncooperative late reply', async () => {
    const pending = deferred<KnowledgeServiceStates>(); knowledge.loadServiceStates = vi.fn(() => pending.promise)
    await enter(); const signal = vi.mocked(knowledge.loadServiceStates).mock.calls[0]![0]!
    wrapper!.unmount(); wrapper = undefined; expect(signal.aborted).toBe(true)
    pending.resolve(good()); await flushPromises(); await vi.advanceTimersByTimeAsync(60_000)
    expect(state.services.value).toBeNull(); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0)
  })
  it('suspends in KeepAlive and supplements the read on activation', async () => {
    const show = ref(true)
    wrapper = mount(defineComponent({ setup: () => () => h(KeepAlive, null, { default: () => show.value ? h(Harness) : null }) }))
    await flushPromises(); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    show.value = false; await nextTick(); await vi.advanceTimersByTimeAsync(60_000); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    show.value = true; await nextTick(); await flushPromises(); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(2)
  })
  it('respects global pause, permits one guarded manual refresh, and never overwrites global preference', async () => {
    directory.livePreferred = false; await enter(); expect(knowledge.loadServiceStates).not.toHaveBeenCalled()
    state.togglePaused(); expect(directory.livePreferred).toBe(false); expect(state.paused.value).toBe(true)
    await state.refresh(); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    directory.livePreferred = true; await flushPromises(); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(2)
    state.togglePaused(); await vi.advanceTimersByTimeAsync(60_000); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(2)
    state.togglePaused(); await flushPromises(); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(3)
  })
  it('keeps explicit service pause across unmount/remount and source replacement in the same Pinia session', async () => {
    await enter(); state.togglePaused(); expect(state.localPaused.value).toBe(true)
    wrapper!.unmount(); wrapper = undefined
    await enter(); expect(state.localPaused.value).toBe(true)
    expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    const next = reader(); knowledgeReadProvider.value = next; await flushPromises()
    await vi.advanceTimersByTimeAsync(60_000); expect(next.loadServiceStates).not.toHaveBeenCalled()
    state.togglePaused(); await flushPromises(); expect(next.loadServiceStates).toHaveBeenCalledTimes(1)
    expect(directory.livePreferred).toBe(true); expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps evidence but blocks manual and automatic reads during operation UNKNOWN/confirmation barriers', async () => {
    await enter(); const before = state.observedAt.value
    const lane = useProjectOperationLaneStore(), lease = lane.acquire('隔离操作')!
    expect(state.blockedReason.value).not.toBe(''); expect(state.stale.value).toBe(true)
    await state.refresh(); await vi.advanceTimersByTimeAsync(60_000); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1); expect(state.observedAt.value).toBe(before)
    lane.release(lease); await flushPromises(); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(2)
    directory.projectPollingPaused = true; await state.refresh(); expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(2)
  })
  it('preserves actual UNKNOWN receipts and revisions, and cannot reconcile them by refreshing the summary', async () => {
    await directory.connect(read)
    await enter(); const observed = state.observedAt.value
    const actions: CreatorOperationsProvider = { label: '隔离操作', run: vi.fn(async () => { throw new CreatorOperationError('timeout', 'unknown') }), waitForIdle: vi.fn(async () => {}) }
    creatorOperationsProvider.value = actions
    const operations = useCreatorOperationsStore(); await operations.direct('aaaaaaaaaaaaaaaa', 'focus')
    expect(operations.lastReceipt?.phase).toBe('unknown')
    const receipt = operations.lastReceipt, revision = directory.projectSnapshotRevision
    expect(state.blockedReason.value).toContain('未知')
    await state.refresh(); await vi.advanceTimersByTimeAsync(60_000)
    expect(knowledge.loadServiceStates).toHaveBeenCalledTimes(1)
    expect(state.observedAt.value).toBe(observed); expect(state.stale.value).toBe(true)
    expect(directory.projectSnapshotRevision).toBe(revision); expect(operations.lastReceipt).toBe(receipt)
    expect(actions.run).toHaveBeenCalledTimes(1)
  })
  it.each(['passive', 'unapproved', 'disconnected', 'preview'] as const)('never probes in %s mode or without an approved connected source', async kind => {
    if (kind === 'passive') { read = { ...read, runtimeProbesEnabled: false }; companionBrowserProvider.value = read; directory.provider = read; companionProjectEntryProvider.value = null }
    if (kind === 'unapproved') companionProjectEntryProvider.value = null
    if (kind === 'disconnected') directory.connected = false
    if (kind === 'preview') vi.stubEnv('MODE', 'companion-readonly')
    await enter(); await state.refresh(); await vi.advanceTimersByTimeAsync(60_000)
    expect(knowledge.loadServiceStates).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('shows a compact summary with unknown failure, evidence times, expandable detail and only a management link', async () => {
    knowledge.loadServiceStates = vi.fn(async () => ({ knowledge: { running: true, frameable: false }, warnings: ['模型启动器响应缺失'] }))
    wrapper = mount(OverviewServiceSummary, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot/></a>' } } } }); await flushPromises()
    expect(wrapper.get('[aria-label="服务摘要"]').text()).toContain('模型启动器：未知')
    expect(wrapper.findAll('time')).toHaveLength(2); expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(wrapper.get('details').text()).toContain('ComfyUI：未知'); expect(wrapper.get('details').text()).toContain('不代表模型已加载')
    expect(wrapper.get('a').attributes('href')).toBe('/knowledge?tab=models')
    expect(wrapper.findAll('button').map(button => button.text())).toEqual(['刷新服务状态', '暂停服务更新'])
    expect(knowledge.status).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
})
