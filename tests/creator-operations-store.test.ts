import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { watch } from 'vue'
import { flushPromises } from '@vue/test-utils'
import type { CompanionBrowserProvider, ManagedStatus, ProjectRead, RuntimeState } from '../src/domain/companion-browser'
import { CreatorOperationError } from '../src/domain/creator-operations'
import type { CreatorAction, CreatorOperationReply, CreatorOperationsProvider } from '../src/domain/creator-operations'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import type { ProjectOperationLease } from '../src/stores/project-operation-lane'
import type { DirectCreatorAction, PreparedCreatorOperation } from '../src/stores/creator-operations'

const A = 'aaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbb'
const projectA = { id: A, name: '原工程 A', path: '/fixture/registered-a', requiredCreatorVersion: '3.8.7' }
const projectB = { id: B, name: '工程 B', path: '/fixture/registered-b' }
const status = (projectId = A, state: RuntimeState = 'stopped'): ManagedStatus => ({ projectId, state, capabilityProfile: 'authoring' })
const snapshot = (state: RuntimeState = 'stopped'): ProjectRead => ({ projects: [{ ...projectA }, { ...projectB }], statuses: [status(A, state), status(B)], dashboard: [], warnings: [] })
const reply = (state: RuntimeState = 'launching'): CreatorOperationReply => ({ action: 'start', runtime: status(A, state) })
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (cause: unknown) => void
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
function reader(overrides: Partial<CompanionBrowserProvider> = {}): CompanionBrowserProvider {
  return { label: 'fake registered project reader', loadProjects: vi.fn(async () => snapshot()), loadLogs: vi.fn(async () => []),
    loadCounts: vi.fn(async () => ({ sessionId: 'fake-session', counts: {}, latest: {} })),
    loadCalls: vi.fn(async () => ({ sessionId: 'fake-session', total: 0, retained: 0, records: [] })), ...overrides }
}
function actions(overrides: Partial<CreatorOperationsProvider> = {}): CreatorOperationsProvider {
  return { label: 'fake lifecycle transport', run: vi.fn(async (input): Promise<CreatorOperationReply> => input.action === 'focus'
    ? { action: 'focus', acknowledged: true }
    : input.action === 'open-folder' ? { action: 'open-folder', acknowledged: true, path: input.projectId === A ? projectA.path : projectB.path }
    : input.action === 'remove-registration' ? { action: 'remove-registration', removed: true }
    : { action: input.action, runtime: status(input.projectId, input.action === 'stop' ? 'stopped' : 'launching') }),
  waitForIdle: vi.fn(async () => {}), ...overrides }
}
async function setup(read = reader(), provider = actions()) {
  creatorOperationsProvider.value = provider
  const browser = useCompanionBrowserStore(), store = useCreatorOperationsStore()
  await browser.connect(read)
  return { browser, store, read, provider }
}
beforeEach(() => { setActivePinia(createPinia()); creatorOperationsProvider.value = null })

describe('single-click start/focus, fake providers only', () => {
  it.each(['start', 'focus'] as const)('%s freezes the exact snapshot and never publishes a dialog or prepared phase', async action => {
    const { store, browser, read, provider } = await setup()
    const dialogs: boolean[] = [], previews: Array<PreparedCreatorOperation | null> = [], phases: string[] = []
    const stops = [watch(() => store.dialogOpen, value => dialogs.push(value), { flush: 'sync' }),
      watch(() => store.prepared, value => previews.push(value), { flush: 'sync' }),
      watch(() => store.display.phase, value => phases.push(value), { flush: 'sync' })]
    const revision = browser.projectSnapshotRevision, observedAt = browser.observedAt
    expect(await store.direct(B, action)).toBe(true)
    stops.forEach(stop => stop())
    expect(dialogs).toEqual([]); expect(previews).toEqual([]); expect(phases).not.toContain('prepared')
    expect(store.dialogOpen).toBe(false); expect(store.prepared).toBeNull()
    expect(provider.run).toHaveBeenCalledExactlyOnceWith({ projectId: B, action }, expect.any(AbortSignal))
    const record = store.lastReceipt!
    expect(record).toMatchObject({ action, project: projectB, runtime: status(B), phase: 'acknowledged',
      snapshotRevision: revision, observedAt, detached: false })
    expect(record.source).toMatchObject({ readLabel: read.label, operationLabel: provider.label })
    expect(Object.isFrozen(record)).toBe(true); expect(Object.isFrozen(record.project)).toBe(true)
    expect(Object.isFrozen(record.runtime)).toBe(true); expect(Object.isFrozen(record.source)).toBe(true)
    expect(store.isReceiptCurrent(record.id)).toBe(true)
    expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(browser.statuses[1]).toEqual(status(B))
  })

  it.each(['stop', 'restart', 'open-folder', 'remove-registration', 'create', '', null, undefined])(
    'rejects unsupported direct action %s at runtime without bypassing its confirmation', async action => {
      const { store, provider } = await setup()
      expect(await store.direct(A, action as DirectCreatorAction)).toBe(false)
      expect(store.error).toContain('仅支持启动或聚焦'); expect(store.dialogOpen).toBe(false)
      expect(store.prepared).toBeNull(); expect(store.receipts).toEqual([]); expect(provider.run).not.toHaveBeenCalled()
    })

  it.each(['ready', 'launching', 'bridge-wait', 'stopping', 'unknown'] as const)('keeps the %s start guard without opening a dialog', async state => {
    const { store, provider } = await setup(reader({ loadProjects: async () => snapshot(state) }))
    expect(await store.direct(A, 'start')).toBe(false)
    expect(provider.run).not.toHaveBeenCalled(); expect(store.dialogOpen).toBe(false); expect(store.lastReceipt).toBeNull()
  })

  it('requires a connected registered target and real start status, while focus keeps its existing eligibility', async () => {
    const store = useCreatorOperationsStore(), browser = useCompanionBrowserStore(), provider = actions()
    creatorOperationsProvider.value = provider
    expect(await store.direct(A, 'start')).toBe(false)
    await browser.connect(reader({ loadProjects: async () => ({ ...snapshot(), statuses: [] }) }))
    expect(await store.direct(A, 'start')).toBe(false)
    expect(await store.direct('unregistered', 'focus')).toBe(false)
    expect(await store.direct(A, 'focus')).toBe(true)
    expect(store.lastReceipt?.runtime).toBeNull(); expect(provider.run).toHaveBeenCalledTimes(1)
  })

  it('consumes approval before provider re-entry and blocks repeated clicks through actual cleanup', async () => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
    const { store, provider } = await setup(reader(), actions({ waitForIdle: () => idle.promise }))
    const lane = useProjectOperationLaneStore()
    let repeated: Promise<boolean> | undefined
    provider.run = vi.fn(() => {
      expect(store.prepared).toBeNull(); expect(store.dialogOpen).toBe(false); expect(lane.locked).toBe(true)
      expect(lane.acquire('创建工程')).toBeNull(); repeated = store.direct(A, 'start')
      return run.promise
    })
    const sending = store.direct(A, 'start')
    expect(await repeated).toBe(false); expect(await store.direct(A, 'start')).toBe(false)
    expect(await store.direct(B, 'focus')).toBe(false)
    run.resolve(reply()); await flushPromises()
    expect(store.lastReceipt?.phase).toBe('acknowledged'); expect(store.pending).toBe(false)
    expect(store.transportPending).toBe(true); expect(lane.locked).toBe(true)
    expect(await store.direct(B, 'focus')).toBe(false)
    idle.resolve(); expect(await sending).toBe(true)
    expect(store.transportPending).toBe(false); expect(lane.locked).toBe(false)
    expect(provider.run).toHaveBeenCalledTimes(1); expect(store.receipts).toHaveLength(1)
  })

  it('revokes an old confirmation without allowing synchronous direct re-entry', async () => {
    const { store, provider } = await setup(), old = store.prepare(B, 'remove-registration')!
    let repeated: Promise<boolean> | undefined
    const stop = watch(() => store.prepared, value => { if (!value) repeated = store.direct(B, 'focus') }, { flush: 'sync' })
    expect(await store.direct(A, 'start')).toBe(true)
    stop()
    expect(await repeated).toBe(false); expect(await store.send(old, true)).toBe(false)
    expect(store.dialogOpen).toBe(false); expect(provider.run).toHaveBeenCalledTimes(1)
    expect(store.lastReceipt?.project.id).toBe(A)
  })

  it.each(['创建工程', '导入工程'])('shares the same-page %s lane without queueing or auto-retrying', async description => {
    const { store, provider } = await setup(), lane = useProjectOperationLaneStore(), lease = lane.acquire(description)!
    expect(await store.direct(A, 'start')).toBe(false); expect(await store.direct(B, 'focus')).toBe(false)
    expect(store.error).toContain(description); expect(store.dialogOpen).toBe(false); expect(store.receipts).toEqual([])
    expect(lane.release(lease)).toBe(true); await flushPromises()
    expect(provider.run).not.toHaveBeenCalled()
    expect(await store.direct(A, 'start')).toBe(true); expect(provider.run).toHaveBeenCalledTimes(1)
  })

  it.each(['reader', 'transport', 'connection', 'project', 'runtime'] as const)(
    'rejects synchronous %s A → B → A during lane acquisition before any dispatch', async kind => {
      const { store, browser, read, provider } = await setup(), lane = useProjectOperationLaneStore()
      const stop = watch(() => lane.locked, locked => {
        if (!locked) return
        if (kind === 'reader') { browser.provider = reader(); browser.provider = read }
        if (kind === 'transport') { creatorOperationsProvider.value = actions(); creatorOperationsProvider.value = provider }
        if (kind === 'connection') { browser.connected = false; browser.connected = true }
        if (kind === 'project') { browser.projects = [{ ...projectA, path: '/other' }, projectB]; browser.projects = [{ ...projectA }, projectB] }
        if (kind === 'runtime') { browser.statuses = [status(A, 'ready'), status(B)]; browser.statuses = [status(), status(B)] }
      }, { flush: 'sync' })
      expect(await store.direct(A, 'start')).toBe(false)
      stop()
      expect(provider.run).not.toHaveBeenCalled(); expect(store.receipts).toEqual([])
      expect(store.dialogOpen).toBe(false); expect(store.transportPending).toBe(false); expect(lane.locked).toBe(false)
    })

  it('does not dispatch after a synchronous receipt observer detaches the just-published operation', async () => {
    const { store, browser, read, provider } = await setup()
    const stop = watch(() => store.lastReceipt?.phase, phase => {
      if (phase === 'sending') { browser.provider = reader(); browser.provider = read }
    }, { flush: 'sync' })
    expect(await store.direct(A, 'start')).toBe(false)
    stop()
    expect(provider.run).not.toHaveBeenCalled(); expect(store.lastReceipt).toMatchObject({ phase: 'unknown', detached: true })
    expect(store.isReceiptCurrent(store.lastReceipt!.id)).toBe(false); expect(store.transportPending).toBe(false)
  })

  it.each(['reader', 'transport', 'connection', 'project'] as const)(
    'retains detached UNKNOWN on pending %s A → B → A and ignores the late response', async kind => {
      const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
      const { store, browser, read, provider } = await setup(reader(), actions({ run: vi.fn(() => run.promise), waitForIdle: () => idle.promise }))
      const sending = store.direct(A, 'start'), recordId = store.lastReceipt!.id
      if (kind === 'reader') { browser.provider = reader(); browser.provider = read }
      if (kind === 'transport') { creatorOperationsProvider.value = actions(); creatorOperationsProvider.value = provider }
      if (kind === 'connection') { browser.connected = false; browser.connected = true }
      if (kind === 'project') { browser.projects = [{ ...projectA, path: '/other' }, projectB]; browser.projects = [{ ...projectA }, projectB] }
      run.resolve(reply('ready')); await flushPromises()
      expect(store.lastReceipt).toMatchObject({ id: recordId, phase: 'unknown', project: projectA, detached: true })
      expect(store.isReceiptCurrent(recordId)).toBe(false); expect(store.transportPending).toBe(true)
      idle.resolve(); expect(await sending).toBe(false)
      expect(await store.refreshStatus(recordId)).toBe(false); expect(provider.run).toHaveBeenCalledTimes(1)
      expect(read.loadProjects).toHaveBeenCalledTimes(1)
    })

  it('suppresses the direct success result if the acknowledged source changes during cleanup', async () => {
    const idle = deferred<void>(), { store, browser, read } = await setup(reader(), actions({ waitForIdle: () => idle.promise }))
    const sending = store.direct(A, 'start')
    await flushPromises(); expect(store.lastReceipt?.phase).toBe('acknowledged')
    const id = store.lastReceipt!.id
    browser.provider = reader(); browser.provider = read
    expect(store.lastReceipt).toMatchObject({ phase: 'acknowledged', detached: true })
    expect(store.transportPending).toBe(true); expect(store.isReceiptCurrent(id)).toBe(false)
    idle.resolve(); expect(await sending).toBe(false); expect(await store.refreshStatus(id)).toBe(false)
  })

  it.each(['throw', 'reject'] as const)('retains the real cleanup lock after %s and permits only readonly refresh', async kind => {
    const { store, browser, read, provider } = await setup(reader(), actions({ waitForIdle: kind === 'throw'
      ? () => { throw new Error('cleanup did not settle') } : () => Promise.reject(new Error('cleanup did not settle')) }))
    expect(await store.direct(A, 'start')).toBe(false)
    expect(store.lastReceipt?.phase).toBe('acknowledged'); expect(store.error).toContain('无法确认传输已经结束')
    expect(useProjectOperationLaneStore().locked).toBe(true)
    store.closeDialog(); store.leave()
    expect(await store.direct(B, 'focus')).toBe(false); expect(store.prepare(B, 'open-folder')).toBeNull()
    await browser.refreshProjects(); await browser.refreshLogs()
    expect(read.loadProjects).toHaveBeenCalledTimes(2); expect(read.loadLogs).toHaveBeenCalledTimes(1)
    expect(provider.run).toHaveBeenCalledTimes(1); expect(store.transportPending).toBe(true)
  })

  it('retains UNKNOWN and its read barrier after cancel, suppresses late success, and never auto-retries', async () => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
    const { store, browser, provider } = await setup(reader(), actions({ run: vi.fn(() => run.promise), waitForIdle: () => idle.promise }))
    const sending = store.direct(A, 'start'), id = store.lastReceipt!.id
    expect(store.cancelWaiting()).toBe(true)
    run.resolve(reply('ready')); await flushPromises()
    expect(store.lastReceipt).toMatchObject({ phase: 'unknown', detached: false, reply: null })
    expect(store.isReceiptCurrent(id)).toBe(true); expect(await store.refreshStatus(id)).toBe(false)
    expect(await store.direct(A, 'start')).toBe(false)
    idle.resolve(); expect(await sending).toBe(false)
    expect(await store.direct(A, 'start')).toBe(false); expect(store.canPrepare(B, 'start')).toBe(true)
    await browser.refreshProjects()
    expect(store.canPrepare(A, 'start')).toBe(true); expect(provider.run).toHaveBeenCalledTimes(1)
    expect(store.lastReceipt?.phase).toBe('unknown')
  })

  it.each(['not-dispatched', 'rejected', 'reported-failure', 'unknown'] as const)(
    'keeps direct %s failure receipts and the existing uncertainty rules without a modal or retry', async outcome => {
      const failure = new CreatorOperationError('network-error', outcome)
      const { store, browser, provider } = await setup(reader(), actions({ run: vi.fn().mockRejectedValue(failure) }))
      expect(await store.direct(A, 'start')).toBe(false)
      expect(store.lastReceipt).toMatchObject({ phase: outcome, project: projectA, reply: null, detached: false })
      expect(store.isReceiptCurrent(store.lastReceipt!.id)).toBe(true); expect(store.dialogOpen).toBe(false)
      expect(await store.refreshStatus(store.lastReceipt!.id)).toBe(false)
      expect(store.canPrepare(A, 'start')).toBe(outcome === 'not-dispatched' || outcome === 'rejected')
      await browser.refreshProjects()
      expect(store.canPrepare(A, 'start')).toBe(true); expect(provider.run).toHaveBeenCalledTimes(1)
    })

  it('does not let a read already in flight clear direct UNKNOWN', async () => {
    const run = deferred<CreatorOperationReply>(), readback = deferred<ProjectRead>()
    const read = reader(), { store, browser } = await setup(read, actions({ run: () => run.promise }))
    const sending = store.direct(A, 'start')
    read.loadProjects = vi.fn(() => readback.promise)
    const reading = browser.refreshProjects()
    expect(store.cancelWaiting()).toBe(true); expect(await sending).toBe(false)
    readback.resolve(snapshot()); await reading
    expect(store.canPrepare(A, 'start')).toBe(false)
    await browser.refreshProjects(); expect(store.canPrepare(A, 'start')).toBe(true)
    run.resolve(reply('ready')); await flushPromises(); expect(store.lastReceipt?.phase).toBe('unknown')
  })

  it.each(['start', 'focus'] as const)('offers an explicit guarded status reread after a current %s acknowledgement', async action => {
    const { store, browser, read, provider } = await setup()
    expect(await store.direct(A, action)).toBe(true)
    const id = store.lastReceipt!.id, revision = browser.projectSnapshotRevision
    expect(read.loadProjects).toHaveBeenCalledTimes(1)
    expect(await store.refreshStatus(id)).toBe(true)
    expect(browser.projectSnapshotRevision).toBe(revision + 1); expect(read.loadProjects).toHaveBeenCalledTimes(2)
    expect(provider.run).toHaveBeenCalledTimes(1); expect(store.lastReceipt?.phase).toBe('acknowledged')
  })

  it.each(['reader', 'transport', 'connection'] as const)(
    'does not re-associate completed receipts after %s A → B → A', async kind => {
      const { store, browser, read, provider } = await setup()
      expect(await store.direct(A, 'start')).toBe(true)
      const id = store.lastReceipt!.id
      expect(store.isReceiptCurrent(id)).toBe(true)
      if (kind === 'reader') { browser.provider = reader(); browser.provider = read }
      if (kind === 'transport') { creatorOperationsProvider.value = actions(); creatorOperationsProvider.value = provider }
      if (kind === 'connection') { browser.connected = false; browser.connected = true }
      expect(store.isReceiptCurrent(id)).toBe(false); expect(await store.refreshStatus(id)).toBe(false)
      expect(store.lastReceipt).toMatchObject({ phase: 'acknowledged', detached: false })
      expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(provider.run).toHaveBeenCalledTimes(1)
    })

  it('does not refresh a replaced receipt or start a duplicate status read', async () => {
    const { store, browser, read, provider } = await setup()
    await store.direct(A, 'start'); const oldId = store.lastReceipt!.id
    await store.direct(B, 'focus'); const id = store.lastReceipt!.id
    expect(await store.refreshStatus(oldId)).toBe(false)
    const result = deferred<ProjectRead>(); read.loadProjects = vi.fn(() => result.promise)
    const reading = store.refreshStatus(id)
    expect(browser.projectLoading).toBe(true); expect(await store.refreshStatus(id)).toBe(false)
    result.resolve(snapshot()); expect(await reading).toBe(true)
    expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(provider.run).toHaveBeenCalledTimes(2)
  })

  it('refuses readback evidence if the source changes away and back while status is reading', async () => {
    const { store, browser, read } = await setup()
    await store.direct(A, 'start'); const id = store.lastReceipt!.id
    const result = deferred<ProjectRead>(); read.loadProjects = vi.fn(() => result.promise)
    const reading = store.refreshStatus(id)
    browser.provider = reader(); browser.provider = read
    result.resolve(snapshot()); expect(await reading).toBe(false)
    expect(store.isReceiptCurrent(id)).toBe(false)
  })

  it('returns false after a failed status reread rather than claiming a verified status', async () => {
    const { store, browser, read } = await setup()
    await store.direct(A, 'start'); const id = store.lastReceipt!.id
    read.loadProjects = vi.fn().mockRejectedValue(new Error('read unavailable'))
    expect(await store.refreshStatus(id)).toBe(false)
    expect(browser.connected).toBe(false); expect(store.lastReceipt?.phase).toBe('acknowledged')
  })
})

describe('Creator and setup shared mutation exclusion, fake providers only', () => {
  const allActions: readonly CreatorAction[] = ['start', 'focus', 'stop', 'restart', 'open-folder', 'remove-registration']

  it.each(allActions)('blocks %s preparation while setup owns the lane and retains the old receipt', async action => {
    const { store, provider } = await setup(reader({ loadProjects: async () => snapshot(action === 'stop' ? 'ready' : 'stopped') }))
    await store.send(store.prepare(A, 'focus')!, true)
    const old = store.lastReceipt, visible = store.receipt, lane = useProjectOperationLaneStore()
    const setupLease = lane.acquire('创建工程')!
    expect(store.canPrepare(A, action)).toBe(false)
    expect(store.blockingReason(A, action)).toContain('创建工程')
    expect(store.prepare(A, action)).toBeNull()
    expect(store.lastReceipt).toBe(old); expect(store.receipt).toBe(visible)
    expect(store.receipts).toHaveLength(1); expect(provider.run).toHaveBeenCalledTimes(1)
    expect(lane.release(setupLease)).toBe(true)
    await flushPromises()
    expect(provider.run).toHaveBeenCalledTimes(1); expect(store.prepared).toBeNull()
  })

  it.each(allActions)('rechecks the lane before %s send and consumes a blocked approval without losing history', async action => {
    const { store, provider } = await setup(reader({ loadProjects: async () => snapshot(action === 'stop' ? 'ready' : 'stopped') }))
    await store.send(store.prepare(A, 'focus')!, true)
    const old = store.lastReceipt, draft = store.prepare(A, action)!, lane = useProjectOperationLaneStore()
    const setupLease = lane.acquire('导入工程')!
    expect(await store.send(draft, true)).toBe(false)
    expect(store.error).toContain('导入工程'); expect(store.prepared).toBeNull()
    expect(store.lastReceipt).toBe(old); expect(store.receipts).toHaveLength(1)
    expect(provider.run).toHaveBeenCalledTimes(1)
    expect(lane.release(setupLease)).toBe(true)
    await flushPromises()
    expect(await store.send(draft, true)).toBe(false)
    expect(provider.run).toHaveBeenCalledTimes(1)
    expect(await store.send(store.prepare(A, action)!, true)).toBe(true)
    expect(provider.run).toHaveBeenCalledTimes(2)
  })

  it('consumes approval before synchronous provider re-entry and keeps competing setup acquisition out', async () => {
    const { store, provider } = await setup(), lane = useProjectOperationLaneStore(), draft = store.prepare(A, 'start')!
    let repeated: Promise<boolean> | undefined, competing: ProjectOperationLease | null | undefined
    provider.run = vi.fn(async () => {
      expect(store.prepared).toBeNull(); expect(lane.locked).toBe(true)
      expect(lane.description).toBe('启动 / 打开 Creator')
      competing = lane.acquire('创建工程'); repeated = store.send(draft, true)
      return reply()
    })
    expect(await store.send(draft, true)).toBe(true)
    expect(await repeated).toBe(false); expect(competing).toBeNull()
    expect(provider.run).toHaveBeenCalledTimes(1); expect(lane.locked).toBe(false)
  })

  it('loses an acquisition race safely if setup acquires during approval consumption', async () => {
    const { store, provider } = await setup(), lane = useProjectOperationLaneStore(), draft = store.prepare(A, 'start')!
    let setupLease: ProjectOperationLease | null = null
    const stop = watch(() => store.prepared, value => {
      if (!value) setupLease = lane.acquire('创建工程')
    }, { flush: 'sync' })
    expect(await store.send(draft, true)).toBe(false)
    stop()
    expect(setupLease).not.toBeNull(); expect(provider.run).not.toHaveBeenCalled()
    expect(store.lastReceipt).toBeNull(); expect(store.transportPending).toBe(false)
    expect(lane.release(setupLease!)).toBe(true)
    await flushPromises()
    expect(await store.send(draft, true)).toBe(false); expect(provider.run).not.toHaveBeenCalled()
  })

  it('retains the shared lease through acknowledged cleanup and releases only after actual idle', async () => {
    const idle = deferred<void>(), { store } = await setup(reader(), actions({ waitForIdle: () => idle.promise }))
    const lane = useProjectOperationLaneStore(), sending = store.send(store.prepare(A, 'start')!, true)
    await flushPromises()
    expect(store.lastReceipt?.phase).toBe('acknowledged'); expect(store.pending).toBe(false)
    expect(lane.locked).toBe(true); expect(lane.acquire('创建工程')).toBeNull()
    store.closeDialog(); store.leave(); creatorOperationsProvider.value = actions()
    expect(lane.locked).toBe(true)
    idle.resolve(); expect(await sending).toBe(true)
    expect(lane.locked).toBe(false); expect(store.transportPending).toBe(false)
    const setupLease = lane.acquire('创建工程')!
    expect(setupLease).not.toBeNull(); expect(lane.release(setupLease)).toBe(true)
  })

  it.each(['throw', 'reject'] as const)('fails closed on cleanup %s across context changes', async kind => {
    const provider = actions({ waitForIdle: kind === 'throw'
      ? () => { throw new Error('fake cleanup failed') }
      : () => Promise.reject(new Error('fake cleanup failed')) })
    const { store, browser } = await setup(reader(), provider), lane = useProjectOperationLaneStore()
    expect(await store.send(store.prepare(A, 'start')!, true)).toBe(true)
    expect(store.lastReceipt?.phase).toBe('acknowledged'); expect(lane.locked).toBe(true)
    store.closeDialog(); store.leave(); creatorOperationsProvider.value = actions()
    await browser.refreshProjects(); await browser.refreshLogs()
    expect(lane.acquire('创建工程')).toBeNull(); expect(store.transportPending).toBe(true)
    expect(store.blockingReason(A, 'start')).toContain('无法确认传输已经结束')
    for (const action of allActions) expect(store.prepare(A, action)).toBeNull()
    expect(provider.run).toHaveBeenCalledTimes(1)
  })

  it('keeps UNKNOWN and its runtime read barrier after cancellation, holding the lane until idle', async () => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
    const { store, browser, provider } = await setup(reader(), actions({ run: vi.fn(() => run.promise), waitForIdle: () => idle.promise }))
    const lane = useProjectOperationLaneStore(), sending = store.send(store.prepare(A, 'start')!, true)
    expect(store.cancelWaiting()).toBe(true)
    await flushPromises()
    expect(store.lastReceipt?.phase).toBe('unknown'); expect(lane.locked).toBe(true)
    expect(lane.acquire('创建工程')).toBeNull()
    run.resolve(reply('ready')); await flushPromises()
    expect(lane.locked).toBe(true); expect(store.lastReceipt?.phase).toBe('unknown')
    idle.resolve(); expect(await sending).toBe(false)
    expect(lane.locked).toBe(false); expect(store.canPrepare(A, 'start')).toBe(false)
    expect(store.canPrepare(B, 'start')).toBe(true)
    await browser.refreshProjects()
    expect(store.canPrepare(A, 'start')).toBe(true)
    expect(store.lastReceipt?.phase).toBe('unknown'); expect(provider.run).toHaveBeenCalledTimes(1)
  })
})

describe('Creator operation confirmation store, all providers are fakes', () => {
  it('does no read or operation by itself and requires a connected registered target', () => {
    const browser = useCompanionBrowserStore(), store = useCreatorOperationsStore(), provider = actions()
    creatorOperationsProvider.value = provider
    expect(store.prepare(A, 'start')).toBeNull()
    expect(browser.provider).toBeNull(); expect(provider.run).not.toHaveBeenCalled()
    expect(store.lastReceipt).toBeNull(); expect(store.transportPending).toBe(false)
  })
  it('freezes the complete identity, runtime, source identities and observation', async () => {
    const { store, browser, provider } = await setup()
    const draft = store.prepare(A, 'start')!
    expect(draft.project).toEqual(projectA); expect(draft.runtime).toEqual(status())
    expect(draft.source).toMatchObject({ readLabel: 'fake registered project reader', operationLabel: provider.label })
    expect(draft.source.readIdentity).not.toBe(draft.source.operationIdentity)
    expect(draft.observedAt).toBe(browser.observedAt)
    expect(draft.snapshotRevision).toBe(browser.projectSnapshotRevision)
    expect(Object.isFrozen(draft)).toBe(true); expect(Object.isFrozen(draft.project)).toBe(true)
    expect(Object.isFrozen(draft.runtime)).toBe(true); expect(Object.isFrozen(draft.source)).toBe(true)
    expect(browser.projects[0]).not.toBe(draft.project); expect(Object.isFrozen(browser.projects[0])).toBe(false)
    expect(provider.run).not.toHaveBeenCalled(); expect(store.dialogOpen).toBe(true)
  })
  it('requires exact one-use opaque preview and explicit true confirmation', async () => {
    const { store, provider } = await setup(), draft = store.prepare(A, 'start')!
    expect(await store.send(draft, false)).toBe(false)
    expect(await store.send(draft, 1 as unknown as boolean)).toBe(false)
    expect(await store.send({ ...draft }, true)).toBe(false)
    expect(await store.send(JSON.parse(JSON.stringify(draft)) as PreparedCreatorOperation, true)).toBe(false)
    expect(await store.send(draft, true)).toBe(true)
    expect(store.prepared).toBeNull()
    expect(await store.send(draft, true)).toBe(false)
    expect(provider.run).toHaveBeenCalledTimes(1)
    expect(provider.run).toHaveBeenCalledWith({ projectId: A, action: 'start' }, expect.any(AbortSignal))
  })
  it('invalidates old previews when replacing the draft or closing the dialog', async () => {
    const { store, provider } = await setup(), first = store.prepare(A, 'start')!, second = store.prepare(B, 'start')!
    expect(await store.send(first, true)).toBe(false)
    store.closeDialog()
    expect(await store.send(second, true)).toBe(false)
    expect(store.dialogOpen).toBe(false); expect(provider.run).not.toHaveBeenCalled()
  })
  it('invalidates on completed identical snapshot even at the same observation timestamp', async () => {
    const { store, browser } = await setup(), draft = store.prepare(A, 'start')!
    const date = browser.observedAt
    await browser.refreshProjects(); browser.observedAt = date
    expect(browser.projectSnapshotRevision).toBe(draft.snapshotRevision + 1)
    expect(store.prepared).toBeNull(); expect(await store.send(draft, true)).toBe(false)
  })
  it.each(['project', 'status', 'operation-provider', 'read-provider', 'connection'] as const)(
    'invalidates pre-confirmation %s changes including A -> B -> A', async kind => {
      const { store, browser, provider, read } = await setup(), draft = store.prepare(A, 'start')!
      if (kind === 'project') { browser.projects = [{ ...projectA, path: '/different/path' }, projectB]; browser.projects = [{ ...projectA }, projectB] }
      if (kind === 'status') { browser.statuses = [status(A, 'ready')]; browser.statuses = [status()] }
      if (kind === 'operation-provider') { creatorOperationsProvider.value = actions(); creatorOperationsProvider.value = provider }
      if (kind === 'read-provider') { browser.provider = reader(); browser.provider = read }
      if (kind === 'connection') { browser.connected = false; browser.connected = true }
      expect(store.prepared).toBeNull(); expect(await store.send(draft, true)).toBe(false)
      expect(provider.run).not.toHaveBeenCalled()
    })
  it('rechecks unreactive field mutations at dispatch and never sends a newly changed target', async () => {
    const { store, browser, provider } = await setup(), draft = store.prepare(A, 'start')!
    browser.projects[0]!.path = '/replaced-without-reactive-assignment'
    expect(await store.send(draft, true)).toBe(false); expect(provider.run).not.toHaveBeenCalled()
  })
  it('does not accept malformed or unregistered target IDs', async () => {
    const { store, browser, provider } = await setup()
    expect(store.prepare('cccccccccccccccc', 'start')).toBeNull()
    browser.projects = [{ id: '../not-registered-id', name: 'bad', path: '/fake' }]
    browser.statuses = [status('../not-registered-id')]
    expect(store.prepare('../not-registered-id', 'focus')).toBeNull(); expect(provider.run).not.toHaveBeenCalled()
  })
  it.each(['launching', 'bridge-wait', 'stopping', 'ready', 'unknown'] as const)('blocks start for %s but permits an explicit focus', async state => {
    const { store, provider } = await setup(reader({ loadProjects: async () => snapshot(state) }))
    expect(store.prepare(A, 'start')).toBeNull()
    const draft = store.prepare(A, 'focus')!
    expect(draft).not.toBeNull(); expect(await store.send(draft, true)).toBe(true)
    expect(provider.run).toHaveBeenCalledTimes(1)
    expect(provider.run).toHaveBeenCalledWith({ projectId: A, action: 'focus' }, expect.any(AbortSignal))
    expect(store.receipt?.message).toContain('聚焦'); expect(store.receipt?.message).toContain('未因此启动')
  })
  it('missing runtime stays null, blocks start, and allows focus without inventing stopped', async () => {
    const { store } = await setup(reader({ loadProjects: async () => ({ ...snapshot(), statuses: [], warnings: ['runtime unavailable'] }) }))
    expect(store.prepare(A, 'start')).toBeNull(); expect(store.error).toContain('不能把未知视为已停止')
    expect(store.prepare(A, 'focus')?.runtime).toBeNull()
  })
  it('receives a start acknowledgement without replacing the browser status or claiming final readiness', async () => {
    const { store, browser, read } = await setup(), draft = store.prepare(A, 'start')!
    expect(await store.send(draft, true)).toBe(true)
    expect(store.receipt?.phase).toBe('acknowledged'); expect(store.receipt?.reply).toEqual(reply())
    expect(store.receipt?.message).toContain('不等于最终就绪')
    expect(browser.statuses[0]?.state).toBe('stopped')
    expect(read.loadProjects).toHaveBeenCalledTimes(1)
  })
  it('consumes approval synchronously and holds a single flight until transport is truly idle', async () => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>(), provider = actions({ run: vi.fn(() => run.promise), waitForIdle: vi.fn(() => idle.promise) })
    const { store } = await setup(reader(), provider), draft = store.prepare(A, 'start')!
    const sending = store.send(draft, true)
    expect(store.prepared).toBeNull(); expect(store.pending).toBe(true); expect(store.transportPending).toBe(true)
    expect(await store.send(draft, true)).toBe(false); expect(store.prepare(B, 'start')).toBeNull()
    run.resolve(reply()); await flushPromises()
    expect(store.pending).toBe(false); expect(store.transportPending).toBe(true); expect(store.receipt?.phase).toBe('acknowledged')
    expect(store.cancelWaiting()).toBe(false); expect(store.prepare(B, 'start')).toBeNull()
    idle.resolve(); expect(await sending).toBe(true); expect(store.transportPending).toBe(false)
    expect(store.prepare(B, 'start')).not.toBeNull(); expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it('cancels only local waiting, retains UNKNOWN with original identity, and ignores late success', async () => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>(), provider = actions({ run: vi.fn(() => run.promise), waitForIdle: () => idle.promise })
    const { store } = await setup(reader(), provider), draft = store.prepare(A, 'start')!, sending = store.send(draft, true)
    expect(store.cancelWaiting()).toBe(true); expect(store.cancelWaiting()).toBe(false)
    expect(store.pending).toBe(false); expect(store.transportPending).toBe(true)
    expect(store.lastReceipt).toMatchObject({ project: projectA, phase: 'unknown', errorCode: 'aborted', reply: null })
    expect(vi.mocked(provider.run).mock.calls[0]?.[1]?.aborted).toBe(true)
    run.resolve(reply('ready')); await flushPromises()
    expect(store.lastReceipt?.phase).toBe('unknown'); expect(store.lastReceipt?.reply).toBeNull()
    idle.resolve(); expect(await sending).toBe(false)
    expect(store.canPrepare(A, 'start')).toBe(false); expect(store.canPrepare(B, 'start')).toBe(true)
  })
  it('closing a waiting dialog keeps the receipt and the transport lease', async () => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
    const { store } = await setup(reader(), actions({ run: () => run.promise, waitForIdle: () => idle.promise }))
    const sending = store.send(store.prepare(A, 'start')!, true)
    store.closeDialog()
    expect(store.prepared).toBeNull(); expect(store.receipt).toBeNull(); expect(store.dialogOpen).toBe(false)
    expect(store.lastReceipt?.phase).toBe('unknown'); expect(store.transportPending).toBe(true)
    run.resolve(reply()); idle.resolve(); await sending
    expect(store.lastReceipt?.phase).toBe('unknown'); expect(store.receipt).toBeNull()
  })
  it.each(['leave', 'disconnect', 'replace-project', 'replace-provider'] as const)(
    '%s detaches the old operation, keeps its identity and refuses to adopt late replies', async kind => {
      const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
      const { store, browser } = await setup(reader(), actions({ run: () => run.promise, waitForIdle: () => idle.promise }))
      const sending = store.send(store.prepare(A, 'start')!, true)
      if (kind === 'leave') store.leave()
      if (kind === 'disconnect') browser.disconnect()
      if (kind === 'replace-project') browser.projects = [{ ...projectA, name: '新工程', path: '/new/path' }, projectB]
      if (kind === 'replace-provider') creatorOperationsProvider.value = actions()
      expect(store.lastReceipt).toMatchObject({ phase: 'unknown', project: projectA, detached: true })
      expect(store.transportPending).toBe(true); expect(store.receipt).toBeNull()
      run.resolve(reply('ready')); idle.resolve(); expect(await sending).toBe(false)
      expect(store.lastReceipt?.phase).toBe('unknown')
    })
  it('rejects a second dispatch from synchronous provider re-entry', async () => {
    const { store, provider } = await setup(), draft = store.prepare(A, 'start')!
    let repeated: Promise<boolean> | undefined
    provider.run = vi.fn(async () => { repeated = store.send(draft, true); return reply() })
    expect(await store.send(draft, true)).toBe(true)
    expect(await repeated).toBe(false); expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it('an unreactive target change before a late rejection remains detached UNKNOWN', async () => {
    const run = deferred<CreatorOperationReply>()
    const { store, browser } = await setup(reader(), actions({ run: () => run.promise }))
    const sending = store.send(store.prepare(A, 'start')!, true)
    browser.projects[0]!.path = '/different-target'
    run.reject(new CreatorOperationError('backend-failure', 'reported-failure'))
    expect(await sending).toBe(false)
    expect(store.lastReceipt).toMatchObject({ phase: 'unknown', project: projectA, detached: true })
    expect(store.receipt).toBeNull()
  })
  it('a final failure cannot be downgraded by a synchronous close reaction', async () => {
    const { store } = await setup(reader(), actions({ run: async () => { throw new CreatorOperationError('backend-failure', 'reported-failure') } }))
    const stop = watch(() => store.lastReceipt?.phase, phase => { if (phase === 'reported-failure') store.closeDialog() }, { flush: 'sync' })
    expect(await store.send(store.prepare(A, 'start')!, true)).toBe(false)
    stop()
    expect(store.lastReceipt?.phase).toBe('reported-failure'); expect(store.cancelWaiting()).toBe(false)
  })
  it('a normal real status refresh while awaiting does not detach the operation', async () => {
    const run = deferred<CreatorOperationReply>(), read = reader()
    const { store, browser } = await setup(read, actions({ run: () => run.promise }))
    const sending = store.send(store.prepare(A, 'start')!, true)
    read.loadProjects = async () => snapshot('launching')
    await browser.refreshProjects()
    expect(store.pending).toBe(true); expect(store.receipt?.phase).toBe('sending')
    run.resolve(reply('bridge-wait')); expect(await sending).toBe(true)
    expect(store.lastReceipt?.detached).toBe(false); expect(browser.statuses[0]?.state).toBe('launching')
  })
  it.each(['unknown', 'reported-failure'] as const)('requires a later original-project status read after %s and never rewrites the old outcome', async outcome => {
    const provider = actions({ run: vi.fn().mockRejectedValueOnce(new CreatorOperationError('backend-failure', outcome)).mockResolvedValue(reply()) })
    const { store, browser, read } = await setup(reader(), provider)
    expect(await store.send(store.prepare(A, 'start')!, true)).toBe(false)
    const original = store.lastReceipt!
    expect(original.phase).toBe(outcome); expect(store.prepare(A, 'start')).toBeNull()
    expect(store.canPrepare(B, 'start')).toBe(true)
    await browser.refreshLogs(); expect(store.canPrepare(A, 'start')).toBe(false)
    read.loadProjects = async () => ({ ...snapshot(), statuses: [status(B)] })
    await browser.refreshProjects(); expect(store.canPrepare(A, 'start')).toBe(false)
    read.loadProjects = async () => snapshot('unknown')
    await browser.refreshProjects(); expect(store.canPrepare(A, 'focus')).toBe(false)
    read.loadProjects = async () => snapshot()
    await browser.refreshProjects(); expect(store.canPrepare(A, 'start')).toBe(true)
    expect(store.lastReceipt).toEqual(original)
    const newDraft = store.prepare(A, 'start')!
    expect(provider.run).toHaveBeenCalledTimes(1)
    expect(await store.send(newDraft, true)).toBe(true)
    expect(store.receipts[0]).toEqual(original); expect(store.receipts).toHaveLength(2)
    expect(read.loadLogs).toHaveBeenCalledTimes(1)
  })
  it('a read started before uncertainty cannot clear the UNKNOWN barrier when it returns later', async () => {
    const run = deferred<CreatorOperationReply>(), projectRead = deferred<ProjectRead>(), read = reader()
    const { store, browser } = await setup(read, actions({ run: () => run.promise }))
    const sending = store.send(store.prepare(A, 'start')!, true)
    read.loadProjects = () => projectRead.promise
    const reading = browser.refreshProjects()
    store.cancelWaiting(); await sending
    projectRead.resolve(snapshot()); await reading
    expect(store.canPrepare(A, 'start')).toBe(false)
    read.loadProjects = async () => snapshot()
    await browser.refreshProjects(); expect(store.canPrepare(A, 'start')).toBe(true)
    run.resolve(reply())
  })
  it('a different source or changed project identity cannot clear the original source barrier', async () => {
    const originalRead = reader(), provider = actions({ run: vi.fn().mockRejectedValue(new CreatorOperationError('timeout', 'unknown')) })
    const { store, browser } = await setup(originalRead, provider)
    await store.send(store.prepare(A, 'start')!, true)
    const otherRead = reader({ loadProjects: async () => snapshot() })
    await browser.connect(otherRead)
    // A distinct source is a distinct context, but it never resolves the old receipt.
    expect(store.canPrepare(A, 'start')).toBe(true); expect(store.lastReceipt?.phase).toBe('unknown')
    browser.provider = originalRead
    expect(store.canPrepare(A, 'start')).toBe(false)
    await browser.refreshProjects()
    expect(store.canPrepare(A, 'start')).toBe(true); expect(store.lastReceipt?.phase).toBe('unknown')
  })
  it.each(['not-dispatched', 'rejected'] as const)('preserves %s errors without claiming uncertainty or auto-retrying', async outcome => {
    const provider = actions({ run: vi.fn().mockRejectedValue(new CreatorOperationError(outcome === 'rejected' ? 'forbidden' : 'busy', outcome)) })
    const { store } = await setup(reader(), provider)
    expect(await store.send(store.prepare(A, 'start')!, true)).toBe(false)
    expect(store.lastReceipt?.phase).toBe(outcome); expect(store.canPrepare(A, 'start')).toBe(true)
    expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it.each([
    { action: 'focus', acknowledged: true },
    { action: 'start', runtime: status(B, 'ready') },
    { action: 'start', runtime: { ...status(), state: 'invented-state' } },
    null,
  ])('treats an unverifiable reply as UNKNOWN', async badReply => {
    const { store } = await setup(reader(), actions({ run: async () => badReply as CreatorOperationReply }))
    expect(await store.send(store.prepare(A, 'start')!, true)).toBe(false)
    expect(store.lastReceipt).toMatchObject({ phase: 'unknown', errorCode: 'invalid-shape', reply: null })
    expect(store.canPrepare(A, 'start')).toBe(false)
  })
  it('treats unexpected rejection as UNKNOWN without exposing provider errors or retrying', async () => {
    const provider = actions({ run: vi.fn().mockRejectedValue(new Error('private transport details')) })
    const { store } = await setup(reader(), provider)
    await store.send(store.prepare(A, 'start')!, true)
    expect(store.lastReceipt?.phase).toBe('unknown'); expect(store.error).not.toContain('private transport')
    expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it('keeps an acknowledged receipt when closing or changing source during cleanup', async () => {
    const idle = deferred<void>()
    const { store } = await setup(reader(), actions({ waitForIdle: () => idle.promise }))
    const sending = store.send(store.prepare(A, 'start')!, true)
    await flushPromises(); expect(store.receipt?.phase).toBe('acknowledged')
    store.closeDialog(); creatorOperationsProvider.value = actions()
    expect(store.lastReceipt).toMatchObject({ phase: 'acknowledged', project: projectA, detached: true })
    expect(store.transportPending).toBe(true); expect(store.cancelWaiting()).toBe(false)
    idle.resolve(); expect(await sending).toBe(true)
    expect(store.lastReceipt?.phase).toBe('acknowledged')
  })
  it('fails closed after waitForIdle rejects and still allows read-only status/log refreshes', async () => {
    const provider = actions({ waitForIdle: vi.fn().mockRejectedValue(new Error('cannot establish cleanup')) })
    const { store, browser, read } = await setup(reader(), provider)
    expect(await store.send(store.prepare(A, 'start')!, true)).toBe(true)
    expect(store.lastReceipt?.phase).toBe('acknowledged'); expect(store.transportPending).toBe(true)
    expect(store.error).toContain('无法确认传输已经结束')
    store.closeDialog(); store.leave(); creatorOperationsProvider.value = actions()
    await browser.refreshProjects(); await browser.refreshLogs()
    expect(read.loadProjects).toHaveBeenCalledTimes(2); expect(read.loadLogs).toHaveBeenCalledTimes(1)
    expect(store.prepare(A, 'start')).toBeNull(); expect(store.prepare(B, 'focus')).toBeNull()
    expect(provider.run).toHaveBeenCalledTimes(1); expect(store.lastReceipt?.phase).toBe('acknowledged')
  })
})

describe.each(['stop', 'restart'] as const)('%s confirmation and settlement, fake transport only', action => {
  const readReady = () => reader({ loadProjects: vi.fn(async () => snapshot('ready')) })
  const lifecycleReply = (state: RuntimeState = action === 'stop' ? 'stopped' : 'launching'): CreatorOperationReply => ({ action, runtime: status(A, state) })

  it.each(['ready', 'crashed', 'incompatible', 'error'] as const)('permits known %s without inventing or requiring a PID', async state => {
    const { store, provider } = await setup(reader({ loadProjects: async () => snapshot(state) }))
    const draft = store.prepare(A, action)!
    expect(draft).not.toBeNull(); expect(draft.action).toBe(action)
    expect(draft.runtime?.pid).toBeUndefined()
    expect(await store.send(draft, true)).toBe(true)
    expect(provider.run).toHaveBeenCalledWith({ projectId: A, action }, expect.any(AbortSignal))
  })
  it('uses stopped only for restart and does not present an old status as proof of OS exit', async () => {
    const { store, provider } = await setup()
    expect(store.canPrepare(A, action)).toBe(action === 'restart')
    if (action === 'stop') {
      expect(store.prepare(A, action)).toBeNull()
      expect(store.error).toContain('不能证明操作系统进程已退出')
      expect(store.error).toContain('先刷新真实状态')
    } else {
      expect(store.prepare(A, action)?.runtime?.state).toBe('stopped')
    }
    expect(provider.run).not.toHaveBeenCalled()
  })
  it.each(['launching', 'bridge-wait', 'stopping', 'unknown'] as const)('never blindly dispatches from %s', async state => {
    const { store, provider } = await setup(reader({ loadProjects: async () => snapshot(state) }))
    expect(store.canPrepare(A, action)).toBe(false)
    expect(store.prepare(A, action)).toBeNull()
    expect(store.error).toContain('刷新')
    expect(provider.run).not.toHaveBeenCalled()
  })
  it('blocks missing runtime and malformed action without synthesizing a state', async () => {
    const { store, provider } = await setup(reader({ loadProjects: async () => ({ ...snapshot(), statuses: [] }) }))
    expect(store.prepare(A, action)).toBeNull()
    expect(store.error).toContain('不能把未知视为已停止')
    expect(store.prepare(A, 'delete' as CreatorAction)).toBeNull()
    expect(store.error).toContain('操作类型无效')
    expect(provider.run).not.toHaveBeenCalled()
  })
  it('freezes the exact action, target and sources and requires one explicit opaque approval', async () => {
    const { store, provider } = await setup(readReady())
    const draft = store.prepare(A, action)!
    expect(draft).toMatchObject({ action, project: projectA, runtime: status(A, 'ready') })
    expect(Object.isFrozen(draft)).toBe(true); expect(Object.isFrozen(draft.source)).toBe(true)
    expect(await store.send({ ...draft }, true)).toBe(false)
    expect(await store.send(draft, false)).toBe(false)
    expect(await store.send(draft, 1 as unknown as boolean)).toBe(false)
    expect(await store.send(draft, true)).toBe(true)
    expect(await store.send(draft, true)).toBe(false)
    expect(provider.run).toHaveBeenCalledTimes(1)
    expect(store.lastReceipt?.action).toBe(action)
  })
  it.each(['project', 'status', 'operation-provider', 'read-provider', 'connection'] as const)(
    'revokes pre-confirmation %s changes, including A -> B -> A', async kind => {
      const { store, browser, provider, read } = await setup(readReady()), draft = store.prepare(A, action)!
      if (kind === 'project') { browser.projects = [{ ...projectA, path: '/other' }, projectB]; browser.projects = [{ ...projectA }, projectB] }
      if (kind === 'status') { browser.statuses = [status(A, 'crashed')]; browser.statuses = [status(A, 'ready')] }
      if (kind === 'operation-provider') { creatorOperationsProvider.value = actions(); creatorOperationsProvider.value = provider }
      if (kind === 'read-provider') { browser.provider = reader(); browser.provider = read }
      if (kind === 'connection') { browser.connected = false; browser.connected = true }
      expect(store.prepared).toBeNull()
      expect(await store.send(draft, true)).toBe(false)
      expect(provider.run).not.toHaveBeenCalled()
    })
  it('closing an unsent confirmation invalidates it without issuing an operation', async () => {
    const { store, provider } = await setup(readReady()), draft = store.prepare(A, action)!
    store.closeDialog()
    expect(await store.send(draft, true)).toBe(false)
    expect(store.lastReceipt).toBeNull(); expect(provider.run).not.toHaveBeenCalled()
  })
  it('keeps a single flight through cleanup and never duplicates a synchronous re-entry', async () => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
    const { store, provider } = await setup(readReady(), actions({ waitForIdle: () => idle.promise }))
    const draft = store.prepare(A, action)!
    let repeated: Promise<boolean> | undefined
    provider.run = vi.fn(() => { repeated = store.send(draft, true); return run.promise })
    const sending = store.send(draft, true)
    expect(await repeated).toBe(false)
    expect(store.prepare(A, action === 'stop' ? 'restart' : 'stop')).toBeNull()
    expect(store.prepare(B, 'start')).toBeNull()
    run.resolve(lifecycleReply()); await flushPromises()
    expect(store.lastReceipt?.phase).toBe('acknowledged'); expect(store.pending).toBe(false)
    expect(store.transportPending).toBe(true); expect(store.prepare(B, 'focus')).toBeNull()
    idle.resolve(); expect(await sending).toBe(true)
    expect(store.transportPending).toBe(false); expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it('keeps backend acknowledgement separate from authoritative status and readiness or OS exit', async () => {
    const { store, browser, read } = await setup(readReady())
    expect(await store.send(store.prepare(A, action)!, true)).toBe(true)
    expect(store.lastReceipt?.reply).toEqual(lifecycleReply())
    expect(Object.isFrozen(store.lastReceipt?.reply)).toBe(true)
    expect(store.lastReceipt?.phase).toBe('acknowledged')
    expect(store.lastReceipt?.message).toContain('后台已返回')
    if (action === 'stop') {
      expect(store.lastReceipt?.message).toContain('stopped 回执')
      expect(store.lastReceipt?.message).toContain('不证明操作系统进程已退出')
    } else {
      expect(store.lastReceipt?.message).toContain('不等于最终就绪')
      expect(store.lastReceipt?.message).toContain('不证明操作系统进程退出已获确认')
    }
    expect(browser.statuses[0]?.state).toBe('ready')
    expect(read.loadProjects).toHaveBeenCalledTimes(1)
  })
  it.each(['success', 'rejection'] as const)('local cancellation preserves UNKNOWN after late %s', async result => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
    const { store, provider } = await setup(readReady(), actions({ run: vi.fn(() => run.promise), waitForIdle: () => idle.promise }))
    const sending = store.send(store.prepare(A, action)!, true)
    expect(store.cancelWaiting()).toBe(true); expect(store.cancelWaiting()).toBe(false)
    expect(vi.mocked(provider.run).mock.calls[0]?.[1]?.aborted).toBe(true)
    expect(store.transportPending).toBe(true)
    if (result === 'success') run.resolve(lifecycleReply())
    else run.reject(new CreatorOperationError('backend-failure', 'reported-failure', 'DASHBOARD_OPEN_WITHOUT_BRIDGE'))
    await flushPromises()
    expect(store.lastReceipt).toMatchObject({ action, phase: 'unknown', errorCode: 'aborted', project: projectA, reply: null })
    idle.resolve(); expect(await sending).toBe(false)
    expect(store.canPrepare(A, action)).toBe(false); expect(store.canPrepare(A, 'focus')).toBe(false)
    expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it.each(['leave', 'close-dialog', 'disconnect', 'replace-project', 'replace-operation-provider', 'replace-read-provider'] as const)(
    '%s cannot apply a late reply to a new context', async kind => {
      const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
      const { store, browser } = await setup(readReady(), actions({ run: () => run.promise, waitForIdle: () => idle.promise }))
      const sending = store.send(store.prepare(A, action)!, true)
      if (kind === 'leave') store.leave()
      if (kind === 'close-dialog') store.closeDialog()
      if (kind === 'disconnect') browser.disconnect()
      if (kind === 'replace-project') browser.projects = [{ ...projectA, path: '/new-target' }, projectB]
      if (kind === 'replace-operation-provider') creatorOperationsProvider.value = actions()
      if (kind === 'replace-read-provider') browser.provider = reader()
      expect(store.receipt).toBeNull(); expect(store.transportPending).toBe(true)
      expect(store.lastReceipt).toMatchObject({ action, phase: 'unknown', project: projectA, reply: null, detached: kind !== 'close-dialog' })
      run.resolve(lifecycleReply()); idle.resolve(); expect(await sending).toBe(false)
      expect(store.lastReceipt?.phase).toBe('unknown'); expect(store.lastReceipt?.reply).toBeNull()
    })
  it.each(['unknown', 'reported-failure'] as const)('%s requires a later real original-project status read and a new approval', async outcome => {
    const provider = actions({ run: vi.fn().mockRejectedValueOnce(new CreatorOperationError('backend-failure', outcome)).mockResolvedValue(lifecycleReply()) })
    const { store, browser, read } = await setup(readReady(), provider)
    const draft = store.prepare(A, action)!
    expect(await store.send(draft, true)).toBe(false)
    const original = store.lastReceipt!
    expect(original.phase).toBe(outcome); expect(store.prepare(A, action)).toBeNull()
    await browser.refreshLogs(); expect(store.canPrepare(A, action)).toBe(false)
    read.loadProjects = async () => ({ ...snapshot(), statuses: [status(B)] })
    await browser.refreshProjects(); expect(store.canPrepare(A, action)).toBe(false)
    read.loadProjects = async () => snapshot('unknown')
    await browser.refreshProjects(); expect(store.canPrepare(A, action)).toBe(false)
    read.loadProjects = async () => snapshot('ready')
    await browser.refreshProjects(); expect(store.canPrepare(A, action)).toBe(true)
    expect(await store.send(draft, true)).toBe(false)
    expect(store.lastReceipt).toEqual(original); expect(provider.run).toHaveBeenCalledTimes(1)
    expect(await store.send(store.prepare(A, action)!, true)).toBe(true)
    expect(provider.run).toHaveBeenCalledTimes(2); expect(store.receipts[0]).toEqual(original)
  })
  it('does not release UNKNOWN from a status read already in flight when cancellation occurred', async () => {
    const run = deferred<CreatorOperationReply>(), projectRead = deferred<ProjectRead>()
    const { store, browser, read } = await setup(readReady(), actions({ run: () => run.promise }))
    const sending = store.send(store.prepare(A, action)!, true)
    read.loadProjects = () => projectRead.promise
    const reading = browser.refreshProjects()
    store.cancelWaiting(); await sending
    projectRead.resolve(snapshot('ready')); await reading
    expect(store.canPrepare(A, action)).toBe(false)
    read.loadProjects = async () => snapshot('ready')
    await browser.refreshProjects(); expect(store.canPrepare(A, action)).toBe(true)
    run.resolve(lifecycleReply()); await flushPromises()
    expect(store.lastReceipt?.phase).toBe('unknown')
  })
  it.each(['unknown', 'reported-failure'] as const)('keeps an unverified unsaved-content hint within its %s outcome', async outcome => {
    const provider = actions({ run: vi.fn().mockRejectedValue(new CreatorOperationError('backend-failure', outcome, undefined, 'unsaved-content')) })
    const { store } = await setup(readReady(), provider)
    expect(await store.send(store.prepare(A, action)!, true)).toBe(false)
    expect(store.lastReceipt).toMatchObject({ phase: outcome, errorCode: 'backend-failure', reply: null })
    expect(store.lastReceipt?.message).toContain('后台错误提到未保存内容，前端未核实')
    expect(store.lastReceipt?.message).toContain('Creator 检查/保存后重新读取真实状态')
    expect(store.lastReceipt?.message).toContain(outcome === 'unknown' ? '结果未知' : '可能已有部分影响')
    expect(store.canPrepare(A, action)).toBe(false); expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it.each(['wrong-action', 'wrong-project', 'invalid-state', 'missing-runtime'] as const)('treats %s replies as UNKNOWN instead of rewriting them into start replies', async kind => {
    let invalid: unknown = lifecycleReply()
    if (kind === 'wrong-action') invalid = { action: 'start', runtime: status(A, 'launching') }
    if (kind === 'wrong-project') invalid = { action, runtime: status(B, action === 'stop' ? 'stopped' : 'launching') }
    if (kind === 'invalid-state') invalid = { action, runtime: { ...status(), state: 'invented' } }
    if (kind === 'missing-runtime') invalid = { action }
    const { store } = await setup(readReady(), actions({ run: async () => invalid as CreatorOperationReply }))
    expect(await store.send(store.prepare(A, action)!, true)).toBe(false)
    expect(store.lastReceipt).toMatchObject({ action, phase: 'unknown', errorCode: 'invalid-shape', reply: null })
    expect(store.canPrepare(A, action)).toBe(false)
  })
  it('keeps all operation types blocked after cleanup failure while allowing read-only refresh', async () => {
    const provider = actions({ waitForIdle: vi.fn().mockRejectedValue(new Error('cleanup uncertain')) })
    const { store, browser, read } = await setup(readReady(), provider)
    expect(await store.send(store.prepare(A, action)!, true)).toBe(true)
    store.closeDialog(); store.leave(); creatorOperationsProvider.value = actions()
    await browser.refreshProjects(); await browser.refreshLogs()
    for (const next of ['start', 'focus', 'stop', 'restart'] as const) expect(store.prepare(A, next)).toBeNull()
    expect(store.transportPending).toBe(true); expect(store.error).toContain('无法确认传输已经结束')
    expect(store.lastReceipt?.phase).toBe('acknowledged')
    expect(read.loadProjects).toHaveBeenCalledTimes(2); expect(read.loadLogs).toHaveBeenCalledTimes(1)
    expect(provider.run).toHaveBeenCalledTimes(1)
  })
})

describe('backend stop/restart receipt boundaries', () => {
  it.each(['launching', 'bridge-wait', 'ready', 'stopping', 'crashed', 'incompatible', 'error', 'unknown'] as const)(
    'a stop receipt claiming %s is UNKNOWN, even when its shape is otherwise valid', async state => {
      const { store } = await setup(reader({ loadProjects: async () => snapshot('ready') }), actions({ run: async () => ({ action: 'stop', runtime: status(A, state) }) }))
      expect(await store.send(store.prepare(A, 'stop')!, true)).toBe(false)
      expect(store.lastReceipt).toMatchObject({ phase: 'unknown', errorCode: 'invalid-shape', reply: null })
      expect(store.canPrepare(A, 'restart')).toBe(false)
    })
  it('does not treat the shorthand OPEN_WITHOUT_BRIDGE as the verified backend code', async () => {
    const provider = actions({ run: vi.fn().mockRejectedValue(new CreatorOperationError('backend-failure', 'reported-failure', 'OPEN_WITHOUT_BRIDGE')) })
    const { store } = await setup(reader({ loadProjects: async () => snapshot('ready') }), provider)
    expect(await store.send(store.prepare(A, 'restart')!, true)).toBe(false)
    expect(store.lastReceipt).toMatchObject({ phase: 'reported-failure', errorCode: 'backend-failure', reply: null })
    expect(store.lastReceipt?.message).toContain('可能已有部分影响')
    expect(store.lastReceipt?.message).not.toContain('Bridge 不可用')
    expect(store.lastReceipt?.message).not.toContain('也可能已打开后未接入')
    expect(store.canPrepare(A, 'restart')).toBe(false)
    expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it('reports DASHBOARD_OPEN_WITHOUT_BRIDGE conservatively without claiming that nothing happened or clearing the read barrier', async () => {
    const provider = actions({ run: vi.fn().mockRejectedValue(new CreatorOperationError('backend-failure', 'reported-failure', 'DASHBOARD_OPEN_WITHOUT_BRIDGE')) })
    const { store, browser } = await setup(reader({ loadProjects: async () => snapshot('ready') }), provider)
    expect(await store.send(store.prepare(A, 'restart')!, true)).toBe(false)
    expect(store.lastReceipt).toMatchObject({ action: 'restart', phase: 'reported-failure', errorCode: 'backend-failure', reply: null })
    expect(store.lastReceipt?.message).toContain('Bridge 不可用')
    expect(store.lastReceipt?.message).toContain('也可能已打开后未接入')
    expect(store.lastReceipt?.message).toContain('可能已有部分影响')
    expect(store.canPrepare(A, 'restart')).toBe(false)
    await browser.refreshProjects()
    expect(store.canPrepare(A, 'restart')).toBe(true)
    expect(store.lastReceipt?.phase).toBe('reported-failure'); expect(provider.run).toHaveBeenCalledTimes(1)
  })
})

const registrationSnapshot = (): ProjectRead => ({ ...snapshot(), statuses: [] })
const managementReply = (action: 'open-folder' | 'remove-registration'): CreatorOperationReply => action === 'open-folder'
  ? { action, acknowledged: true, path: projectA.path } : { action, removed: true }

describe.each(['open-folder', 'remove-registration'] as const)('%s shares the original guarded lane', action => {
  it.each(['missing', 'unknown', 'launching', 'bridge-wait', 'stopping'] as const)('requires registration but no runtime prerequisite for %s', async state => {
    const { store, provider } = await setup(reader({ loadProjects: async () => state === 'missing' ? registrationSnapshot() : snapshot(state) }))
    const draft = store.prepare(A, action)!
    expect(draft).toMatchObject({ action, project: projectA })
    expect(draft.runtime).toEqual(state === 'missing' ? null : status(A, state))
    expect(Object.isFrozen(draft.project)).toBe(true); expect(Object.isFrozen(draft.source)).toBe(true)
    expect(await store.send(draft, false)).toBe(false)
    expect(await store.send({ ...draft }, true)).toBe(false)
    expect(await store.send(draft, true)).toBe(true)
    expect(await store.send(draft, true)).toBe(false)
    expect(provider.run).toHaveBeenCalledExactlyOnceWith({ projectId: A, action }, expect.any(AbortSignal))
  })
  it('blocks a read-only source and unregistered or malformed targets', async () => {
    const { store, provider, browser } = await setup()
    creatorOperationsProvider.value = null
    expect(store.prepare(A, action)).toBeNull(); expect(store.error).toContain('未提供工程操作能力')
    creatorOperationsProvider.value = provider
    expect(store.prepare('cccccccccccccccc', action)).toBeNull()
    browser.projects = [{ id: '../unsafe', name: 'invalid', path: '/fixture/unsafe' }]
    expect(store.prepare('../unsafe', action)).toBeNull()
    expect(provider.run).not.toHaveBeenCalled()
  })
  it('does not mutate authoritative browser projects or status and does not automatically read', async () => {
    const { store, browser, read } = await setup()
    const originalProjects = browser.projects, originalStatuses = browser.statuses
    expect(await store.send(store.prepare(A, action)!, true)).toBe(true)
    expect(browser.projects).toBe(originalProjects); expect(browser.statuses).toBe(originalStatuses)
    expect(browser.projects).toEqual(snapshot().projects); expect(browser.statuses).toEqual(snapshot().statuses)
    expect(store.lastReceipt?.reply).toEqual(managementReply(action))
    expect(Object.isFrozen(store.lastReceipt?.reply)).toBe(true)
    expect(read.loadProjects).toHaveBeenCalledTimes(1)
  })
  it.each(['unknown', 'reported-failure'] as const)('requires a fresh registration read after %s without inventing runtime or rewriting the receipt', async outcome => {
    const { store, browser, read, provider } = await setup(reader({ loadProjects: vi.fn(async () => registrationSnapshot()) }),
      actions({ run: vi.fn().mockRejectedValue(new CreatorOperationError('backend-failure', outcome)) }))
    expect(await store.send(store.prepare(A, action)!, true)).toBe(false)
    const original = store.lastReceipt!
    expect(original.phase).toBe(outcome); expect(original.message).toContain('不会自动重发')
    if (action === 'remove-registration') {
      expect(original.message).toContain('两份文件写入并非原子操作')
      expect(original.message).toContain('失败可能已有部分影响')
      expect(original.message).toContain('路由缓存')
    }
    expect(store.canPrepare(A, 'open-folder')).toBe(false)
    expect(store.canPrepare(A, 'remove-registration')).toBe(false)
    await browser.refreshLogs(); expect(store.canPrepare(A, action)).toBe(false)
    await browser.refreshProjects()
    expect(store.canPrepare(A, action)).toBe(true); expect(store.canPrepare(A, 'start')).toBe(false)
    expect(browser.statuses).toEqual([]); expect(store.lastReceipt).toEqual(original)
    expect(provider.run).toHaveBeenCalledTimes(1); expect(read.loadProjects).toHaveBeenCalledTimes(2)
  })
  it('does not let a read already in flight clear registration uncertainty', async () => {
    const run = deferred<CreatorOperationReply>(), projectRead = deferred<ProjectRead>(), read = reader()
    const { store, browser } = await setup(read, actions({ run: () => run.promise }))
    const sending = store.send(store.prepare(A, action)!, true)
    read.loadProjects = () => projectRead.promise
    const reading = browser.refreshProjects()
    store.cancelWaiting(); await sending
    projectRead.resolve(registrationSnapshot()); await reading
    expect(store.canPrepare(A, action)).toBe(false); expect(store.registrationReadback).toBeNull()
    read.loadProjects = async () => registrationSnapshot()
    await browser.refreshProjects()
    expect(store.canPrepare(A, action)).toBe(true); expect(store.lastReceipt?.phase).toBe('unknown')
    run.resolve(managementReply(action))
  })
  it('shares global single-flight and cleanup blocking with all existing action types', async () => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
    const { store, provider } = await setup(reader(), actions({ run: vi.fn(() => run.promise), waitForIdle: () => idle.promise }))
    const draft = store.prepare(A, action)!, sending = store.send(draft, true)
    for (const next of ['start', 'focus', 'stop', 'restart', 'open-folder', 'remove-registration'] as const) expect(store.prepare(B, next)).toBeNull()
    expect(await store.send(draft, true)).toBe(false)
    run.resolve(managementReply(action)); await flushPromises()
    expect(store.pending).toBe(false); expect(store.transportPending).toBe(true)
    for (const next of ['start', 'focus', 'stop', 'restart', 'open-folder', 'remove-registration'] as const) expect(store.prepare(B, next)).toBeNull()
    idle.resolve(); expect(await sending).toBe(true)
    expect(store.canPrepare(B, 'open-folder')).toBe(true); expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it.each(['cancel', 'close-dialog', 'leave', 'disconnect', 'read-provider', 'operation-provider', 'identity'] as const)('%s never adopts a late result or releases the cleanup lease early', async kind => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
    const { store, browser, provider } = await setup(reader(), actions({ run: vi.fn(() => run.promise), waitForIdle: () => idle.promise }))
    const sending = store.send(store.prepare(A, action)!, true)
    if (kind === 'cancel') store.cancelWaiting()
    if (kind === 'close-dialog') store.closeDialog()
    if (kind === 'leave') store.leave()
    if (kind === 'disconnect') browser.disconnect()
    if (kind === 'read-provider') browser.provider = reader()
    if (kind === 'operation-provider') creatorOperationsProvider.value = actions()
    if (kind === 'identity') browser.projects = [{ ...projectA, path: '/replacement' }, projectB]
    expect(store.transportPending).toBe(true)
    expect(store.lastReceipt).toMatchObject({ action, project: projectA, phase: 'unknown', reply: null })
    expect(vi.mocked(provider.run).mock.calls[0]?.[1]?.aborted).toBe(true)
    run.resolve(managementReply(action)); await flushPromises()
    expect(store.lastReceipt?.phase).toBe('unknown'); expect(store.lastReceipt?.reply).toBeNull()
    idle.resolve(); expect(await sending).toBe(false)
    expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it('cannot bypass an original lifecycle runtime barrier with a registration-only snapshot', async () => {
    const read = reader(), { store, browser } = await setup(read, actions({ run: async () => { throw new CreatorOperationError('timeout', 'unknown') } }))
    await store.send(store.prepare(A, 'start')!, true)
    read.loadProjects = async () => registrationSnapshot()
    await browser.refreshProjects(); expect(store.canPrepare(A, action)).toBe(false)
    read.loadProjects = async () => snapshot('unknown')
    await browser.refreshProjects(); expect(store.canPrepare(A, action)).toBe(false)
    read.loadProjects = async () => snapshot()
    await browser.refreshProjects(); expect(store.canPrepare(A, action)).toBe(true)
    expect(store.lastReceipt?.phase).toBe('unknown')
  })
  it('keeps all writes blocked after cleanup failure but retains read-only access', async () => {
    const { store, browser, provider } = await setup(reader(), actions({ waitForIdle: vi.fn().mockRejectedValue(new Error('failed cleanup')) }))
    expect(await store.send(store.prepare(A, action)!, true)).toBe(true)
    await browser.refreshProjects(); await browser.refreshLogs()
    for (const next of ['start', 'focus', 'stop', 'restart', 'open-folder', 'remove-registration'] as const) expect(store.prepare(B, next)).toBeNull()
    expect(store.transportPending).toBe(true); expect(store.lastReceipt?.phase).toBe('acknowledged')
    expect(provider.run).toHaveBeenCalledTimes(1)
  })
})

describe('management reply validation', () => {
  it.each(['/fixture/registered-a/', '/fixture/./registered-a', '/FIXTURE/registered-a', '/fixture/registered-b', '', null])('requires the exact frozen folder path: %s is UNKNOWN', async path => {
    const { store } = await setup(reader(), actions({ run: async () => ({ action: 'open-folder', acknowledged: true, path } as CreatorOperationReply) }))
    expect(await store.send(store.prepare(A, 'open-folder')!, true)).toBe(false)
    expect(store.lastReceipt).toMatchObject({ phase: 'unknown', errorCode: 'invalid-shape', reply: null, project: projectA })
    expect(store.canPrepare(A, 'remove-registration')).toBe(false)
  })
  it.each([{}, { action: 'focus', acknowledged: true }, { action: 'open-folder', acknowledged: false, path: projectA.path }])('rejects a malformed folder acknowledgement %j', async invalid => {
    const { store } = await setup(reader(), actions({ run: async () => invalid as CreatorOperationReply }))
    expect(await store.send(store.prepare(A, 'open-folder')!, true)).toBe(false)
    expect(store.lastReceipt?.phase).toBe('unknown')
  })
  it.each([undefined, null, 0, 1, 'false', 'true'])('never coerces removed=%s into a successful receipt', async removed => {
    const { store } = await setup(reader(), actions({ run: async () => ({ action: 'remove-registration', removed } as unknown as CreatorOperationReply) }))
    expect(await store.send(store.prepare(A, 'remove-registration')!, true)).toBe(false)
    expect(store.lastReceipt).toMatchObject({ phase: 'unknown', errorCode: 'invalid-shape', reply: null })
  })
  it.each([true, false])('preserves removed=%s without changing registry/status or claiming deletion/stopping', async removed => {
    const { store, browser, read } = await setup(reader(), actions({ run: async () => ({ action: 'remove-registration', removed }) }))
    expect(await store.send(store.prepare(A, 'remove-registration')!, true)).toBe(true)
    expect(store.lastReceipt?.reply).toEqual({ action: 'remove-registration', removed })
    expect(store.lastReceipt?.message).toContain(`removed=${removed}`)
    expect(store.lastReceipt?.message).toContain('不删除工程文件'); expect(store.lastReceipt?.message).toContain('不停止 Creator')
    if (removed) expect(store.lastReceipt?.message).toContain('默认 full 可能扩大工具范围')
    else expect(store.lastReceipt?.message).toContain('不能证明此前登记或绑定操作没有影响')
    expect(browser.projects).toEqual(snapshot().projects); expect(browser.statuses).toEqual(snapshot().statuses)
    expect(store.registrationReadback).toBeNull(); expect(read.loadProjects).toHaveBeenCalledTimes(1)
  })
})

describe('removal readback is fresh registration evidence, never a rewritten operation result', () => {
  it('requires an actual finalized last removal receipt before offering a guarded refresh', async () => {
    const { store, read } = await setup()
    expect(store.canRefreshRegistration).toBe(false); expect(await store.refreshRegistration()).toBe(false)
    store.prepare(A, 'remove-registration')
    expect(store.canRefreshRegistration).toBe(false); expect(await store.refreshRegistration()).toBe(false)
    await store.send(store.prepare(A, 'focus')!, true)
    expect(store.canRefreshRegistration).toBe(false); expect(store.registrationReadback).toBeNull()
    expect(await store.refreshRegistration()).toBe(false); expect(read.loadProjects).toHaveBeenCalledTimes(1)
  })
  it.each(['present', 'absent', 'changed'] as const)('reports %s after a new original-reader snapshot without needing runtime', async presence => {
    const { store, browser, read, provider } = await setup()
    await store.send(store.prepare(A, 'remove-registration')!, true)
    const original = store.lastReceipt!, beforeRevision = browser.projectSnapshotRevision
    expect(store.canRefreshRegistration).toBe(true); expect(store.registrationReadback).toBeNull()
    read.loadProjects = vi.fn(async () => ({ ...registrationSnapshot(), projects: presence === 'absent' ? [projectB]
      : presence === 'changed' ? [{ ...projectA, path: '/new/same-id' }, projectB] : [projectA, projectB] }))
    expect(await store.refreshRegistration()).toBe(true)
    expect(store.registrationReadback).toEqual({ projectId: A, presence, observedAt: browser.observedAt })
    expect(Object.isFrozen(store.registrationReadback)).toBe(true)
    expect(browser.projectSnapshotRevision).toBe(beforeRevision + 1); expect(browser.statuses).toEqual([])
    expect(store.lastReceipt).toEqual(original); expect(provider.run).toHaveBeenCalledTimes(1)
    expect(read.loadProjects).toHaveBeenCalledTimes(1)
  })
  it.each(['name', 'path', 'requiredCreatorVersion'] as const)('compares the full frozen identity when %s changes on the same ID', async field => {
    const { store, read } = await setup()
    await store.send(store.prepare(A, 'remove-registration')!, true)
    read.loadProjects = async () => ({ ...registrationSnapshot(), projects: [{ ...projectA, [field]: 'changed-value' }, projectB] })
    await store.refreshRegistration(); expect(store.registrationReadback?.presence).toBe('changed')
  })
  it.each(['unknown', 'reported-failure'] as const)('a fresh absent snapshot preserves the original %s receipt and does not resend', async outcome => {
    const { store, read, provider } = await setup(reader(), actions({ run: vi.fn().mockRejectedValue(new CreatorOperationError('backend-failure', outcome)) }))
    await store.send(store.prepare(A, 'remove-registration')!, true)
    const original = store.lastReceipt!
    read.loadProjects = async () => ({ ...registrationSnapshot(), projects: [projectB] })
    expect(await store.refreshRegistration()).toBe(true)
    expect(store.registrationReadback?.presence).toBe('absent'); expect(store.lastReceipt).toEqual(original)
    expect(store.lastReceipt?.phase).toBe(outcome); expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it('does not let a completed pre-result snapshot or an in-flight pre-result read count as readback', async () => {
    const run = deferred<CreatorOperationReply>(), projectRead = deferred<ProjectRead>(), read = reader()
    const { store, browser } = await setup(read, actions({ run: () => run.promise }))
    const sending = store.send(store.prepare(A, 'remove-registration')!, true)
    expect(store.canRefreshRegistration).toBe(false); expect(await store.refreshRegistration()).toBe(false)
    await browser.refreshProjects(); expect(store.registrationReadback).toBeNull()
    read.loadProjects = () => projectRead.promise
    const reading = browser.refreshProjects()
    run.resolve({ action: 'remove-registration', removed: true }); await sending
    expect(store.canRefreshRegistration).toBe(false); expect(await store.refreshRegistration()).toBe(false)
    projectRead.resolve(registrationSnapshot()); await reading
    expect(store.registrationReadback).toBeNull(); expect(store.canRefreshRegistration).toBe(true)
    read.loadProjects = async () => registrationSnapshot()
    expect(await store.refreshRegistration()).toBe(true); expect(store.registrationReadback?.presence).toBe('present')
  })
  it('admits a new read synchronously triggered by receipt publication, but never before the result boundary', async () => {
    const { store, browser } = await setup()
    let reading: Promise<void> | undefined
    const stop = watch(() => store.lastReceipt?.phase, phase => { if (phase === 'acknowledged') reading = browser.refreshProjects() }, { flush: 'sync' })
    await store.send(store.prepare(A, 'remove-registration')!, true)
    await reading; stop()
    expect(store.registrationReadback?.presence).toBe('present')
  })
  it('refuses a second read while the first refresh is in flight and never duplicates the operation', async () => {
    const { store, read, provider } = await setup(), pendingRead = deferred<ProjectRead>()
    await store.send(store.prepare(A, 'remove-registration')!, true)
    read.loadProjects = vi.fn(() => pendingRead.promise)
    const reading = store.refreshRegistration()
    expect(store.canRefreshRegistration).toBe(false)
    expect(await store.refreshRegistration()).toBe(false); expect(read.loadProjects).toHaveBeenCalledTimes(1)
    pendingRead.resolve(registrationSnapshot()); expect(await reading).toBe(true)
    expect(provider.run).toHaveBeenCalledTimes(1)
  })
  it('allows readback while cleanup still owns the global write lane', async () => {
    const idle = deferred<void>(), { store, read } = await setup(reader(), actions({ waitForIdle: () => idle.promise }))
    const sending = store.send(store.prepare(A, 'remove-registration')!, true)
    await flushPromises(); expect(store.transportPending).toBe(true)
    expect(store.canRefreshRegistration).toBe(true)
    expect(await store.refreshRegistration()).toBe(true); expect(store.registrationReadback?.presence).toBe('present')
    expect(store.prepare(B, 'start')).toBeNull(); expect(read.loadProjects).toHaveBeenCalledTimes(2)
    idle.resolve(); expect(await sending).toBe(true)
  })
  it('does not qualify a failed read, preserve stale evidence, or reconnect on behalf of an old receipt', async () => {
    const { store, read, browser } = await setup()
    await store.send(store.prepare(A, 'remove-registration')!, true)
    await store.refreshRegistration(); expect(store.registrationReadback?.presence).toBe('present')
    read.loadProjects = vi.fn().mockRejectedValue(new Error('read failed'))
    expect(await store.refreshRegistration()).toBe(false)
    expect(store.registrationReadback).toBeNull(); expect(store.canRefreshRegistration).toBe(false)
    expect(store.lastReceipt?.phase).toBe('acknowledged'); expect(await store.refreshRegistration()).toBe(false)
    expect(read.loadProjects).toHaveBeenCalledTimes(1)
    read.loadProjects = async () => registrationSnapshot()
    await browser.connect(read)
    expect(store.canRefreshRegistration).toBe(false); expect(store.registrationReadback).toBeNull()
  })
  it.each(['other-reader', 'a-b-a', 'reconnect-same-reader', 'disconnect-reconnect-flag'] as const)('permanently unlinks the old receipt after %s even when new snapshots succeed', async kind => {
    const { store, browser, read } = await setup(), otherRead = reader()
    await store.send(store.prepare(A, 'remove-registration')!, true)
    await store.refreshRegistration(); expect(store.registrationReadback?.presence).toBe('present')
    if (kind === 'other-reader') await browser.connect(otherRead)
    if (kind === 'a-b-a') { browser.provider = otherRead; browser.provider = read }
    if (kind === 'reconnect-same-reader') await browser.connect(read)
    if (kind === 'disconnect-reconnect-flag') { browser.connected = false; browser.connected = true }
    expect(store.registrationReadback).toBeNull(); expect(store.canRefreshRegistration).toBe(false)
    const readCount = vi.mocked(read.loadProjects).mock.calls.length, otherCount = vi.mocked(otherRead.loadProjects).mock.calls.length
    expect(await store.refreshRegistration()).toBe(false)
    expect(read.loadProjects).toHaveBeenCalledTimes(readCount); expect(otherRead.loadProjects).toHaveBeenCalledTimes(otherCount)
    await browser.refreshProjects()
    expect(store.registrationReadback).toBeNull(); expect(store.canRefreshRegistration).toBe(false)
    expect(store.lastReceipt?.phase).toBe('acknowledged')
  })
  it('never qualifies a read whose reader changes away and back while it is in flight', async () => {
    const { store, browser, read } = await setup(), projectRead = deferred<ProjectRead>()
    await store.send(store.prepare(A, 'remove-registration')!, true)
    read.loadProjects = () => projectRead.promise
    const reading = store.refreshRegistration()
    browser.provider = reader(); browser.provider = read
    projectRead.resolve(registrationSnapshot()); expect(await reading).toBe(false)
    expect(store.registrationReadback).toBeNull(); expect(store.canRefreshRegistration).toBe(false)
  })
  it('allows a manual fresh original-reader read to clear a registration barrier but never relinks an old receipt session', async () => {
    const read = reader(), { store, browser } = await setup(read, actions({ run: async () => { throw new CreatorOperationError('timeout', 'unknown') } }))
    await store.send(store.prepare(A, 'remove-registration')!, true)
    browser.provider = reader(); browser.provider = read
    expect(store.canPrepare(A, 'open-folder')).toBe(false)
    read.loadProjects = async () => registrationSnapshot()
    await browser.refreshProjects()
    expect(store.canPrepare(A, 'open-folder')).toBe(true)
    expect(store.canRefreshRegistration).toBe(false); expect(store.registrationReadback).toBeNull()
    expect(store.lastReceipt?.phase).toBe('unknown')
  })
  it('binds evidence to the latest receipt rather than showing an earlier removal result for a later action', async () => {
    const { store, browser } = await setup()
    await store.send(store.prepare(A, 'remove-registration')!, true)
    await store.refreshRegistration(); expect(store.registrationReadback?.presence).toBe('present')
    await store.send(store.prepare(B, 'focus')!, true)
    expect(store.registrationReadback).toBeNull(); expect(store.canRefreshRegistration).toBe(false)
    await browser.refreshProjects(); expect(store.registrationReadback).toBeNull()
  })
})


describe('the pre-existing lifecycle lane also blocks management dispatch', () => {
  it.each(['start', 'focus', 'stop', 'restart'] as const)('%s blocks folder/removal through pending and cleanup', async action => {
    const run = deferred<CreatorOperationReply>(), idle = deferred<void>()
    const { store } = await setup(reader({ loadProjects: async () => snapshot(action === 'stop' ? 'ready' : 'stopped') }),
      actions({ run: () => run.promise, waitForIdle: () => idle.promise }))
    const sending = store.send(store.prepare(A, action)!, true)
    expect(store.prepare(B, 'open-folder')).toBeNull(); expect(store.prepare(B, 'remove-registration')).toBeNull()
    run.resolve(action === 'focus' ? { action, acknowledged: true } : { action, runtime: status(A, action === 'stop' ? 'stopped' : 'launching') })
    await flushPromises()
    expect(store.transportPending).toBe(true)
    expect(store.prepare(B, 'open-folder')).toBeNull(); expect(store.prepare(B, 'remove-registration')).toBeNull()
    idle.resolve(); expect(await sending).toBe(true)
    expect(store.canPrepare(B, 'open-folder')).toBe(true); expect(store.canPrepare(B, 'remove-registration')).toBe(true)
  })
})
