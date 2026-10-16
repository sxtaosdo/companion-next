import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { watch } from 'vue'
import type { CompanionBrowserProvider, ManagedProject, ProjectRead } from '../src/domain/companion-browser'
import { ProjectSetupError, PROJECT_SETUP_LIMITS } from '../src/domain/project-setup'
import type { ProjectSetupProvider, SetupSnapshot } from '../src/domain/project-setup'
import { projectSetupProvider } from '../src/project-setup-integration'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { useProjectSetupStore } from '../src/stores/project-setup'
import type { CreatorOperationReply, CreatorOperationRequest } from '../src/domain/creator-operations'
import type { SetupConsents } from '../src/stores/project-setup'

const A = 'aaaaaaaaaaaaaaaa', B = 'bbbbbbbbbbbbbbbb'
const ID = '11111111-1111-4111-8111-111111111111', OTHER_ID = '22222222-2222-4222-8222-222222222222'
const projectA = { id: A, name: '工程 A', path: '/fixture/a', requiredCreatorVersion: '3.8.7' }
const projectB = { id: B, name: '工程 B', path: '/fixture/b' }
const consents: SetupConsents = { installBridge: true, startCreator: true, configureCodex: true, acknowledgeReuse: true, acknowledgeToolScope: true }
const snapshot = (): ProjectRead => ({ projects: [{ ...projectA }, { ...projectB }], statuses: [
  { projectId: A, state: 'stopped', capabilityProfile: 'authoring' }, { projectId: B, state: 'stopped', capabilityProfile: 'authoring' },
], dashboard: [], warnings: [] })
const progress = (stage: SetupSnapshot['stage'] = 'installing-bridge'): SetupSnapshot => ({ id: ID, projectPath: projectA.path,
  projectId: A, stage, startedAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T00:01:00.000Z' })
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (cause: unknown) => void
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
function reader(overrides: Partial<CompanionBrowserProvider> = {}): CompanionBrowserProvider {
  return { label: 'fake original reader', loadProjects: vi.fn(async () => snapshot()), loadLogs: vi.fn(async () => []),
    loadCounts: vi.fn(async () => ({ sessionId: 'fake', counts: {}, latest: {} })),
    loadCalls: vi.fn(async () => ({ sessionId: 'fake', total: 0, retained: 0, records: [] })), ...overrides }
}
function writer(overrides: Partial<ProjectSetupProvider> = {}): ProjectSetupProvider {
  return { label: 'fake original setup writer', register: vi.fn(async () => ({ ...projectA })), start: vi.fn(async () => ({ operationId: ID })),
    status: vi.fn(async () => progress()), waitForIdle: vi.fn(async () => {}), ...overrides }
}
async function setup(read = reader(), provider = writer()) {
  projectSetupProvider.value = provider
  const browser = useCompanionBrowserStore(), store = useProjectSetupStore(), lane = useProjectOperationLaneStore()
  await browser.connect(read)
  return { browser, store, lane, read, provider }
}
async function tick(ms = 1000) { await vi.advanceTimersByTimeAsync(ms); await flushPromises() }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }); vi.setSystemTime(new Date('2026-10-15T00:00:00Z'))
  setActivePinia(createPinia()); projectSetupProvider.value = null; creatorOperationsProvider.value = null
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers() })

describe('opaque separately confirmed registration and full setup, fake sources only', () => {
  it('does nothing automatically, requires original reader + writer and fresh registered IDs', async () => {
    const store = useProjectSetupStore(), provider = writer()
    projectSetupProvider.value = provider
    expect(store.prepareRegistration('/fixture/new')).toBeNull(); expect(store.prepareSetup(A, consents)).toBeNull()
    expect(provider.register).not.toHaveBeenCalled(); expect(provider.start).not.toHaveBeenCalled()
    const browser = useCompanionBrowserStore(); await browser.connect(reader())
    expect(store.prepareSetup('/fixture/a', consents)).toBeNull(); expect(store.prepareSetup('cccccccccccccccc', consents)).toBeNull()
    browser.projectSnapshotRevision = 0
    expect(store.prepareRegistration('/fixture/new')).toBeNull()
  })
  it('freezes all project metadata, flags and source labels without freezing browser data', async () => {
    const { store, browser, provider } = await setup(), draft = store.prepareSetup(A, consents)!
    expect(draft.project).toEqual(projectA); expect(draft.sourceLabel).toContain(provider.label)
    expect(draft.observedAt).toBe(browser.observedAt); expect(draft.snapshotRevision).toBe(browser.projectSnapshotRevision)
    expect(Object.isFrozen(draft)).toBe(true); expect(Object.isFrozen(draft.project)).toBe(true); expect(Object.isFrozen(draft.consents)).toBe(true)
    expect(draft.project).not.toBe(browser.projects[0]); expect(Object.isFrozen(browser.projects[0])).toBe(false)
    expect(provider.start).not.toHaveBeenCalled()
  })
  it.each(Object.keys(consents) as Array<keyof SetupConsents>)('requires literal true for %s, never backend false-like defaults', async key => {
    const { store, provider } = await setup()
    for (const value of [false, undefined, null, 0, 1, 'false', 'true']) {
      expect(store.prepareSetup(A, { ...consents, [key]: value } as SetupConsents)).toBeNull()
    }
    expect(provider.start).not.toHaveBeenCalled()
  })
  it('requires an exact one-use preview and true confirmation; registration never starts setup', async () => {
    const { store, provider } = await setup(), preview = store.prepareRegistration('/entered/alias')!
    expect(await store.sendRegistration({ ...preview }, true)).toBe(false)
    expect(await store.sendRegistration(preview, false)).toBe(false)
    expect(await store.sendRegistration(preview, 1 as unknown as boolean)).toBe(false)
    expect(await store.sendRegistration(preview, true)).toBe(true)
    expect(await store.sendRegistration(preview, true)).toBe(false)
    expect(provider.register).toHaveBeenCalledExactlyOnceWith('/entered/alias', expect.any(AbortSignal)); expect(provider.start).not.toHaveBeenCalled()
    expect(store.registrationReceipt).toMatchObject({ phase: 'acknowledged', requestedPath: '/entered/alias', project: projectA })
    expect(store.registrationReceipt?.message).toContain('实际路径')
  })
  it('consumes setup permission before provider reentrancy and sends only the frozen registered ID', async () => {
    const { store, provider } = await setup(), draft = store.prepareSetup(A, consents)!
    let repeat: Promise<boolean> | undefined
    provider.start = vi.fn(async id => { expect(id).toBe(A); repeat = store.sendSetup(draft, true); return { operationId: ID } })
    expect(await store.sendSetup({ ...draft }, true)).toBe(false); expect(await store.sendSetup(draft, false)).toBe(false)
    expect(await store.sendSetup(draft, true)).toBe(true); expect(await repeat).toBe(false)
    expect(provider.start).toHaveBeenCalledExactlyOnceWith(A, expect.any(AbortSignal)); expect(store.preparedSetup).toBeNull()
  })
  it.each(['new-path', 'new-project', 'clear', 'manual-read', 'metadata', 'revision', 'reader', 'writer', 'connection', 'reader-label', 'writer-label'] as const)(
    'invalidates old approvals after %s, including switching away and back', async kind => {
      const { store, browser, read, provider } = await setup(), registration = store.prepareRegistration('/fixture/new')!
      const change = async () => {
        if (kind === 'new-path') store.prepareRegistration('/fixture/other')
        if (kind === 'new-project') store.prepareSetup(B, consents)
        if (kind === 'clear') store.clearPrepared()
        if (kind === 'manual-read') await browser.refreshProjects()
        if (kind === 'metadata') { browser.projects = [{ ...projectA, name: 'other' }, projectB]; browser.projects = snapshot().projects }
        if (kind === 'revision') browser.projectSnapshotRevision++
        if (kind === 'reader') { browser.provider = reader(); browser.provider = read }
        if (kind === 'writer') { projectSetupProvider.value = writer(); projectSetupProvider.value = provider }
        if (kind === 'connection') { browser.connected = false; browser.connected = true }
        if (kind === 'reader-label') Object.assign(read, { label: `${read.label} changed` })
        if (kind === 'writer-label') Object.assign(provider, { label: `${provider.label} changed` })
      }
      await change(); expect(await store.sendRegistration(registration, true)).toBe(false)
      const draft = store.prepareSetup(A, consents)!
      await change(); expect(await store.sendSetup(draft, true)).toBe(false)
      expect(provider.register).not.toHaveBeenCalled(); expect(provider.start).not.toHaveBeenCalled()
    })
  it('does not optimistically modify browser registry/status, request tools, or refresh', async () => {
    const { store, browser, read, provider } = await setup(), before = JSON.stringify({ projects: browser.projects, statuses: browser.statuses })
    await store.sendRegistration(store.prepareRegistration('/fixture/new')!, true)
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    expect(JSON.stringify({ projects: browser.projects, statuses: browser.statuses })).toBe(before)
    expect(read.loadProjects).toHaveBeenCalledTimes(1); expect(provider.status).not.toHaveBeenCalled()
    expect(provider.register).toHaveBeenCalledTimes(1); expect(provider.start).toHaveBeenCalledTimes(1)
  })
})

describe('registration uncertainty and actual transport cleanup', () => {
  it.each(['rejected', 'not-dispatched'] as const)('releases %s only after cleanup', async outcome => {
    const idle = deferred<void>(), { store, lane, provider } = await setup(reader(), writer({
      register: vi.fn().mockRejectedValue(new ProjectSetupError('forbidden', outcome)), waitForIdle: () => idle.promise,
    }))
    const sending = store.sendRegistration(store.prepareRegistration('/fixture/new')!, true)
    await flushPromises(); expect(store.registrationReceipt?.phase).toBe(outcome); expect(lane.locked).toBe(true)
    expect(store.prepareRegistration('/fixture/new')).toBeNull()
    idle.resolve(); expect(await sending).toBe(false); expect(lane.locked).toBe(false)
    expect(store.prepareRegistration('/fixture/new')).not.toBeNull(); expect(provider.register).toHaveBeenCalledTimes(1)
  })
  it('keeps an unknown receipt and requires a new original read STARTED after the result', async () => {
    const run = deferred<ManagedProject>(), reading = deferred<ProjectRead>(), read = reader()
    const { store, browser, lane } = await setup(read, writer({ register: () => run.promise }))
    const sending = store.sendRegistration(store.prepareRegistration('/fixture/new')!, true)
    read.loadProjects = vi.fn(() => reading.promise); const inFlight = browser.refreshProjects()
    run.reject(new ProjectSetupError('network-error', 'unknown')); await sending
    expect(lane.locked).toBe(false); expect(store.registrationReceipt?.phase).toBe('unknown')
    reading.resolve(snapshot()); await inFlight
    expect(store.prepareRegistration('/fixture/new')).toBeNull()
    read.loadProjects = vi.fn(async () => snapshot()); await browser.refreshProjects()
    expect(store.prepareRegistration('/fixture/new')).not.toBeNull(); expect(store.registrationReceipt?.phase).toBe('unknown')
  })
  it('accepts a new original read synchronously started by unknown receipt publication', async () => {
    const { store, browser } = await setup(reader(), writer({ register: vi.fn().mockRejectedValue(new ProjectSetupError('timeout')) }))
    let reading: Promise<void> | undefined
    const unwatch = watch(() => store.registrationReceipt?.phase, phase => { if (phase === 'unknown') reading = browser.refreshProjects() }, { flush: 'sync' })
    await store.sendRegistration(store.prepareRegistration('/fixture/new')!, true); await reading; unwatch()
    expect(store.prepareRegistration('/fixture/new')).not.toBeNull(); expect(store.registrationReceipt?.phase).toBe('unknown')
  })
  it('does not let a different reader or stale read clear the original-source uncertainty', async () => {
    const { store, browser, read } = await setup(reader(), writer({ register: vi.fn().mockRejectedValue(new ProjectSetupError('timeout')) }))
    await store.sendRegistration(store.prepareRegistration('/fixture/new')!, true)
    await browser.connect(reader()); expect(store.prepareRegistration('/fixture/new')).toBeNull()
    await browser.connect(read); expect(store.prepareRegistration('/fixture/new')).not.toBeNull()
    expect(store.registrationReceipt?.phase).toBe('unknown')
  })
  it.each(['stop', 'leave', 'hidden', 'reader', 'writer', 'reconnect'] as const)('ignores late registration after %s and holds the lease through actual cleanup', async kind => {
    const run = deferred<ManagedProject>(), idle = deferred<void>()
    const { store, browser, lane, provider, read } = await setup(reader(), writer({ register: vi.fn(() => run.promise), waitForIdle: () => idle.promise }))
    const sending = store.sendRegistration(store.prepareRegistration('/fixture/new')!, true)
    if (kind === 'stop') store.stopWaiting()
    if (kind === 'leave') store.leave()
    if (kind === 'hidden') store.setVisible(false)
    if (kind === 'reader') browser.provider = reader()
    if (kind === 'writer') projectSetupProvider.value = writer()
    if (kind === 'reconnect') await browser.connect(read)
    expect(store.registrationReceipt?.phase).toBe('unknown'); expect(store.pending).toBe(false)
    expect(vi.mocked(provider.register).mock.calls[0]?.[1]?.aborted).toBe(true)
    run.resolve(projectA); await flushPromises(); expect(store.registrationReceipt?.phase).toBe('unknown'); expect(lane.locked).toBe(true)
    idle.resolve(); expect(await sending).toBe(false); expect(lane.locked).toBe(false)
  })
  it('keeps acknowledged registration and blocks writes after cleanup failure', async () => {
    const { store, lane } = await setup(reader(), writer({ waitForIdle: vi.fn().mockRejectedValue(new Error('cleanup')) }))
    expect(await store.sendRegistration(store.prepareRegistration('/fixture/new')!, true)).toBe(true)
    expect(store.registrationReceipt?.phase).toBe('acknowledged'); expect(lane.locked).toBe(true)
    expect(store.prepareSetup(A, consents)).toBeNull(); expect(store.error).toContain('传输')
  })
})

describe('accepted setup keeps the shared lease until a matching terminal and cleanup', () => {
  it('treats 202 as acceptance, polls serial GETs every second, never marks complete optimistically', async () => {
    const { store, provider, lane } = await setup()
    expect(await store.sendSetup(store.prepareSetup(A, consents)!, true)).toBe(true)
    expect(store.setupReceipt?.phase).toBe('tracking'); expect(lane.locked).toBe(true); expect(store.pending).toBe(false)
    expect(provider.status).not.toHaveBeenCalled(); await tick(999); expect(provider.status).not.toHaveBeenCalled()
    await tick(1); expect(provider.status).toHaveBeenCalledTimes(1)
    await tick(1000); expect(provider.status).toHaveBeenCalledTimes(2)
    expect(provider.start).toHaveBeenCalledTimes(1); expect(store.setupReceipt?.phase).toBe('tracking')
    expect(store.setupReceipt?.message).toContain('不能证明')
  })
  it.each(['complete', 'failed'] as const)('only releases %s after actual terminal transport cleanup', async stage => {
    const idle = deferred<void>(), provider = writer({ status: vi.fn(async () => progress(stage)) })
    const { store, lane } = await setup(reader(), provider)
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    provider.waitForIdle = vi.fn(() => idle.promise)
    await tick(); expect(store.setupReceipt?.phase).toBe(stage); expect(lane.locked).toBe(true)
    expect(store.prepareRegistration('/fixture/new')).toBeNull(); expect(store.canResume).toBe(false)
    if (stage === 'failed') expect(store.setupReceipt?.message).toContain('部分改动')
    else { expect(store.setupReceipt?.message).toContain('不能据此保证'); expect(store.setupReceipt?.message).toContain('请求选项') }
    idle.resolve(); await flushPromises(); expect(lane.locked).toBe(false)
    await tick(10_000); expect(provider.status).toHaveBeenCalledTimes(1); expect(provider.start).toHaveBeenCalledTimes(1)
  })
  it('allows a failed terminal legitimately lacking projectId while never promising rollback', async () => {
    const failed = progress('failed'); delete failed.projectId
    const { store, lane } = await setup(reader(), writer({ status: vi.fn(async () => failed) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true); await tick()
    expect(store.setupReceipt?.phase).toBe('failed'); expect(store.setupReceipt?.snapshot?.projectId).toBeUndefined()
    expect(store.setupReceipt?.message).toContain('没有整体回滚'); expect(lane.locked).toBe(false)
  })
  it('does not infer false-like options, reused, Creator readiness or Codex effects from completion', async () => {
    const original = { ...progress('complete'), options: { startCreator: false, configureCodex: 0 }, reused: false }
    const { store } = await setup(reader(), writer({ status: vi.fn(async () => original) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true); await tick()
    expect(store.setupReceipt?.phase).toBe('complete')
    expect(store.setupReceipt?.snapshot).not.toHaveProperty('options'); expect(store.setupReceipt?.snapshot).not.toHaveProperty('reused')
    expect(store.setupReceipt?.snapshot?.runtime).toBeUndefined(); expect(store.setupReceipt?.snapshot?.mcpName).toBeUndefined()
    expect(store.setupReceipt?.message).toContain('不能据此保证')
  })
  it.each(['rejected', 'not-dispatched'] as const)('releases explicit setup %s only after idle and never polls', async outcome => {
    const idle = deferred<void>(), { store, provider, lane } = await setup(reader(), writer({
      start: vi.fn().mockRejectedValue(new ProjectSetupError('forbidden', outcome)), waitForIdle: () => idle.promise,
    }))
    const sending = store.sendSetup(store.prepareSetup(A, consents)!, true)
    await flushPromises(); expect(store.setupReceipt?.phase).toBe(outcome); expect(lane.locked).toBe(true)
    idle.resolve(); expect(await sending).toBe(false); expect(lane.locked).toBe(false)
    await tick(5000); expect(provider.status).not.toHaveBeenCalled()
  })
  it.each([undefined, '', 'arbitrary-id', OTHER_ID.replace('-4222-', '-1222-')])('unknown acceptance with invalid operation ID %s stays locked with no retry path', async operationId => {
    const { store, lane, provider } = await setup(reader(), writer({ start: vi.fn(async () => ({ operationId } as { operationId: string })) }))
    expect(await store.sendSetup(store.prepareSetup(A, consents)!, true)).toBe(false)
    expect(store.setupReceipt?.phase).toBe('unknown'); expect(store.canResume).toBe(false); expect(lane.locked).toBe(true)
    expect(await store.resume()).toBe(false); await tick(5000); expect(provider.status).not.toHaveBeenCalled()
    expect(store.prepareSetup(A, consents)).toBeNull(); expect(provider.start).toHaveBeenCalledTimes(1)
  })
  it('unknown POST cannot be unlocked by fresh read, leave or source reconnection', async () => {
    const { store, browser, read, provider, lane } = await setup(reader(), writer({ start: vi.fn().mockRejectedValue(new ProjectSetupError('network-error')) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    await browser.refreshProjects(); store.leave(); store.setVisible(true); await browser.connect(read)
    expect(lane.locked).toBe(true); expect(store.setupReceipt?.phase).toBe('unknown'); expect(store.canResume).toBe(false)
    expect(await store.resume()).toBe(false); expect(provider.start).toHaveBeenCalledTimes(1); expect(provider.status).not.toHaveBeenCalled()
  })
  it('keeps terminal receipt but fails closed when terminal waitForIdle fails', async () => {
    const { store, provider, lane } = await setup(reader(), writer({ status: vi.fn(async () => progress('complete')) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    provider.waitForIdle = vi.fn().mockRejectedValue(new Error('cleanup failed')); await tick()
    expect(store.setupReceipt?.phase).toBe('complete'); expect(lane.locked).toBe(true); expect(store.canResume).toBe(false)
    expect(store.error).toContain('传输'); expect(store.prepareSetup(B, consents)).toBeNull()
  })
})

describe('untrusted status, explicit GET resume and long-running jobs', () => {
  it.each([
    { id: OTHER_ID }, { id: 'not-a-uuid' }, { projectPath: '/other/path' }, { projectPath: '/fixture/a/' }, { projectId: B },
    { runtime: { projectId: B, state: 'ready' } }, { stage: 'success' }, { stage: false }, { startedAt: 'yesterday' },
    { failureReported: 'false' }, { bridge: { status: false, version: '1', targetPath: '/fixture/a/extensions' } },
  ])('never releases a mismatching or malformed terminal: %j', async changed => {
    const { store, provider, lane } = await setup(reader(), writer({ status: vi.fn(async () => ({ ...progress('complete'), ...changed }) as SetupSnapshot) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true); await tick()
    expect(store.setupReceipt?.phase).toBe('paused'); expect(store.setupReceipt?.snapshot).toBeUndefined()
    expect(lane.locked).toBe(true); expect(store.tracking).toBe(false); expect(store.canResume).toBe(true)
    await tick(5000); expect(provider.status).toHaveBeenCalledTimes(1); expect(provider.start).toHaveBeenCalledTimes(1)
  })
  it('pauses on GET failure and explicitly retries only the same operation GET', async () => {
    const { store, provider, lane } = await setup(reader(), writer({ status: vi.fn().mockRejectedValue(new ProjectSetupError('forbidden', 'rejected')) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true); await tick()
    expect(store.canResume).toBe(true); expect(lane.locked).toBe(true); expect(store.setupReceipt?.operationId).toBe(ID)
    provider.status = vi.fn(async () => progress('complete'))
    expect(await store.resume()).toBe(true); expect(provider.status).toHaveBeenCalledExactlyOnceWith(ID, expect.any(AbortSignal))
    expect(provider.start).toHaveBeenCalledTimes(1); expect(lane.locked).toBe(false); expect(store.setupReceipt?.phase).toBe('complete')
  })
  it('keeps no overlapping HTTP calls through pause/late GET/actual cleanup and ignores a late terminal', async () => {
    const response = deferred<SetupSnapshot>(), idle = deferred<void>()
    const { store, provider, lane } = await setup(reader(), writer({ status: vi.fn(() => response.promise) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    provider.waitForIdle = vi.fn(() => idle.promise); await tick(); store.stopWaiting()
    expect(store.setupReceipt?.phase).toBe('paused'); expect(store.canResume).toBe(false); expect(await store.resume()).toBe(false)
    expect(vi.mocked(provider.status).mock.calls[0]?.[1]?.aborted).toBe(true)
    response.resolve(progress('complete')); await tick(10_000)
    expect(store.setupReceipt?.phase).toBe('paused'); expect(store.setupReceipt?.snapshot).toBeUndefined(); expect(lane.locked).toBe(true)
    expect(provider.status).toHaveBeenCalledTimes(1)
    idle.resolve(); await flushPromises(); expect(store.canResume).toBe(true)
    provider.waitForIdle = vi.fn(async () => {}); provider.status = vi.fn(async () => progress('complete'))
    await store.resume(); expect(store.setupReceipt?.phase).toBe('complete'); expect(lane.locked).toBe(false)
    expect(provider.start).toHaveBeenCalledTimes(1)
  })
  it.each(['hidden', 'leave'] as const)('%s retains the receipt and operation; showing again requires explicit resume', async kind => {
    const { store, provider, lane } = await setup()
    await store.sendSetup(store.prepareSetup(A, consents)!, true); await tick()
    if (kind === 'hidden') store.setVisible(false); else store.leave()
    const receipt = store.setupReceipt
    expect(receipt?.phase).toBe('paused'); expect(receipt?.snapshot?.stage).toBe('installing-bridge')
    await tick(10_000); expect(provider.status).toHaveBeenCalledTimes(1); expect(store.canResume).toBe(false); expect(lane.locked).toBe(true)
    store.setVisible(true); await tick(10_000); expect(provider.status).toHaveBeenCalledTimes(1); expect(store.canResume).toBe(true)
    expect(store.setupReceipt).toEqual(receipt); await store.resume(); expect(provider.status).toHaveBeenCalledTimes(2)
    expect(provider.start).toHaveBeenCalledTimes(1)
  })
  it('pauses at fifteen minutes without cancelling the backend or releasing the lease', async () => {
    const { store, provider, lane } = await setup()
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    await tick(PROJECT_SETUP_LIMITS.maxPollMs)
    expect(store.setupReceipt?.phase).toBe('paused'); expect(store.setupReceipt?.message).toContain('15 分钟')
    expect(lane.locked).toBe(true); expect(store.canResume).toBe(true); expect(provider.start).toHaveBeenCalledTimes(1)
    const calls = vi.mocked(provider.status).mock.calls.length
    await tick(10_000); expect(provider.status).toHaveBeenCalledTimes(calls)
    await store.resume(); expect(provider.status).toHaveBeenCalledTimes(calls + 1); expect(provider.start).toHaveBeenCalledTimes(1)
  })
  it.each(['reader-a-b-a', 'writer-a-b-a', 'same-reader-reconnect', 'connection-a-b-a', 'project-a-b-a'] as const)(
    'permanently detaches the original operation after %s and never queries the new context', async kind => {
      const { store, browser, read, provider, lane } = await setup(), otherRead = reader(), otherWrite = writer()
      await store.sendSetup(store.prepareSetup(A, consents)!, true)
      if (kind === 'reader-a-b-a') { browser.provider = otherRead; browser.provider = read }
      if (kind === 'writer-a-b-a') { projectSetupProvider.value = otherWrite; projectSetupProvider.value = provider }
      if (kind === 'same-reader-reconnect') await browser.connect(read)
      if (kind === 'connection-a-b-a') { browser.connected = false; browser.connected = true }
      if (kind === 'project-a-b-a') { browser.projects = [{ ...projectA, path: '/other' }]; browser.projects = snapshot().projects }
      expect(store.canResume).toBe(false); expect(await store.resume()).toBe(false); await tick(5000)
      expect(lane.locked).toBe(true); expect(store.setupReceipt?.phase).toBe('paused')
      expect(provider.status).not.toHaveBeenCalled(); expect(otherWrite.status).not.toHaveBeenCalled(); expect(otherRead.loadProjects).not.toHaveBeenCalled()
      expect(provider.start).toHaveBeenCalledTimes(1)
    })
  it('manual identical project refresh invalidates approvals but does not detach the active original task', async () => {
    const { store, browser } = await setup()
    await store.sendSetup(store.prepareSetup(A, consents)!, true); await browser.refreshProjects()
    store.stopWaiting(); expect(store.canResume).toBe(true); await store.resume()
    expect(store.setupReceipt?.phase).toBe('tracking')
  })
  it('does not release uncertain accepted setup when an aborted old GET finally cleans up after source change', async () => {
    const response = deferred<SetupSnapshot>(), idle = deferred<void>()
    const { store, provider, browser, lane } = await setup(reader(), writer({ status: vi.fn(() => response.promise) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    provider.waitForIdle = vi.fn(() => idle.promise); await tick(); browser.provider = reader()
    response.resolve(progress('complete')); idle.resolve(); await flushPromises()
    expect(store.setupReceipt?.phase).toBe('paused'); expect(store.setupReceipt?.snapshot).toBeUndefined(); expect(lane.locked).toBe(true)
    expect(store.canResume).toBe(false)
  })
})

describe('one shared same-page write lane with the real Creator store', () => {
  function creators() {
    creatorOperationsProvider.value = { label: 'fake Creator writer', run: vi.fn(async (input: CreatorOperationRequest): Promise<CreatorOperationReply> => input.action === 'focus'
      ? { action: 'focus', acknowledged: true } : input.action === 'open-folder'
        ? { action: 'open-folder', acknowledged: true, path: projectA.path } : input.action === 'remove-registration'
          ? { action: 'remove-registration', removed: true } : { action: input.action, runtime: { projectId: input.projectId, state: 'stopped', capabilityProfile: 'authoring' } }),
    waitForIdle: vi.fn(async () => {}) }
    return useCreatorOperationsStore()
  }
  it('accepted setup blocks all six Creator actions until matching terminal cleanup', async () => {
    const { store, provider } = await setup(), creator = creators()
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    for (const action of ['start', 'focus', 'stop', 'restart', 'open-folder', 'remove-registration'] as const) expect(creator.prepare(B, action)).toBeNull()
    provider.status = vi.fn(async () => progress('complete')); await tick()
    expect(creator.prepare(B, 'focus')).not.toBeNull()
  })
  it('Creator pending transport and cleanup blocks both registration and setup', async () => {
    const { store } = await setup(), creator = creators(), idle = deferred<void>()
    creatorOperationsProvider.value!.waitForIdle = vi.fn(() => idle.promise)
    const sending = creator.send(creator.prepare(A, 'focus')!, true); await flushPromises()
    expect(store.prepareRegistration('/fixture/new')).toBeNull(); expect(store.prepareSetup(A, consents)).toBeNull()
    idle.resolve(); expect(await sending).toBe(true)
    expect(store.prepareRegistration('/fixture/new')).not.toBeNull(); expect(store.prepareSetup(A, consents)).not.toBeNull()
  })
  it('registration acknowledgement does not free the Creator lane until actual cleanup', async () => {
    const idle = deferred<void>(), { store } = await setup(reader(), writer({ waitForIdle: () => idle.promise })), creator = creators()
    const sending = store.sendRegistration(store.prepareRegistration('/fixture/new')!, true); await flushPromises()
    expect(store.registrationReceipt?.phase).toBe('acknowledged'); expect(creator.prepare(A, 'focus')).toBeNull()
    idle.resolve(); await sending; expect(creator.prepare(A, 'focus')).not.toBeNull()
  })
})


describe('synchronous reentry, initial computed dependencies and pending transport guards', () => {
  it('canResume evaluated before any operation becomes true after an accepted pause', async () => {
    const { store } = await setup()
    expect(store.canResume).toBe(false)
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    expect(store.canResume).toBe(false); store.stopWaiting(); expect(store.canResume).toBe(true)
  })
  it('retains a new setup started synchronously on the previous terminal lane unlock', async () => {
    const { store, lane, provider } = await setup(reader(), writer({ status: vi.fn(async () => progress('complete')) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    let next: Promise<boolean> | undefined, started = false
    const unwatch = watch(() => lane.locked, locked => {
      if (!locked && !started) { started = true; next = store.sendSetup(store.prepareSetup(A, consents)!, true) }
    }, { flush: 'sync' })
    await tick(); expect(await next).toBe(true); unwatch()
    expect(lane.locked).toBe(true); expect(store.setupReceipt?.phase).toBe('tracking')
    await tick(); expect(provider.status).toHaveBeenCalledTimes(2); expect(provider.start).toHaveBeenCalledTimes(2)
    expect(store.setupReceipt?.phase).toBe('complete'); expect(lane.locked).toBe(false)
  })
  it('retains new registration started synchronously on the previous registration lane unlock', async () => {
    const second = deferred<ManagedProject>(), provider = writer()
    vi.mocked(provider.register).mockResolvedValueOnce(projectA).mockImplementationOnce(() => second.promise)
    const { store, lane } = await setup(reader(), provider)
    let next: Promise<boolean> | undefined, started = false
    const unwatch = watch(() => lane.locked, locked => {
      if (!locked && !started) { started = true; next = store.sendRegistration(store.prepareRegistration('/fixture/second')!, true) }
    }, { flush: 'sync' })
    await store.sendRegistration(store.prepareRegistration('/fixture/first')!, true)
    expect(lane.locked).toBe(true); expect(store.pending).toBe(true)
    store.stopWaiting(); expect(store.registrationReceipt?.phase).toBe('unknown')
    second.resolve(projectB); expect(await next).toBe(false); unwatch()
    expect(lane.locked).toBe(false); expect(store.registrationReceipt?.requestedPath).toBe('/fixture/second')
    expect(store.registrationReceipt?.phase).toBe('unknown')
  })
  it('does not overwrite a pause synchronously triggered by the accepted pending=false boundary', async () => {
    const { store, provider } = await setup()
    let left = false
    const unwatch = watch(() => store.pending, (pending, previous) => {
      if (!pending && previous && !left) { left = true; store.leave() }
    }, { flush: 'sync' })
    expect(await store.sendSetup(store.prepareSetup(A, consents)!, true)).toBe(true); unwatch()
    expect(store.setupReceipt?.phase).toBe('paused'); expect(store.tracking).toBe(false)
    await tick(5000); expect(provider.status).not.toHaveBeenCalled()
    store.setVisible(true); expect(store.canResume).toBe(true)
    await store.resume(); expect(provider.status).toHaveBeenCalledTimes(1)
  })
  it('never starts GET before accepted POST cleanup is actually idle', async () => {
    const idle = deferred<void>(), { store, provider, lane } = await setup(reader(), writer({ waitForIdle: () => idle.promise }))
    const sending = store.sendSetup(store.prepareSetup(A, consents)!, true)
    await flushPromises(); await tick(5000)
    expect(store.setupReceipt?.phase).toBe('tracking'); expect(provider.status).not.toHaveBeenCalled(); expect(lane.locked).toBe(true)
    store.stopWaiting(); expect(store.canResume).toBe(false)
    idle.resolve(); expect(await sending).toBe(true); expect(store.canResume).toBe(true)
    await store.resume(); expect(provider.status).toHaveBeenCalledTimes(1); expect(provider.start).toHaveBeenCalledTimes(1)
  })
  it('aborts pending setup POST without accepting its late operation ID or unlocking', async () => {
    const response = deferred<{ operationId: string }>(), idle = deferred<void>()
    const { store, provider, lane } = await setup(reader(), writer({ start: vi.fn(() => response.promise), waitForIdle: () => idle.promise }))
    const sending = store.sendSetup(store.prepareSetup(A, consents)!, true)
    store.stopWaiting(); expect(store.setupReceipt?.phase).toBe('unknown'); expect(store.pending).toBe(false)
    response.resolve({ operationId: ID }); idle.resolve(); expect(await sending).toBe(false)
    expect(store.setupReceipt?.operationId).toBeUndefined(); expect(lane.locked).toBe(true); expect(store.canResume).toBe(false)
    await tick(5000); expect(provider.status).not.toHaveBeenCalled(); expect(provider.start).toHaveBeenCalledTimes(1)
  })
  it('the fifteen-minute deadline aborts an in-flight status GET but waits for cleanup before resume', async () => {
    const response = deferred<SetupSnapshot>(), idle = deferred<void>()
    const { store, provider, lane } = await setup(reader(), writer({ status: vi.fn(() => response.promise) }))
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    provider.waitForIdle = vi.fn(() => idle.promise); await tick(PROJECT_SETUP_LIMITS.maxPollMs)
    expect(store.setupReceipt?.phase).toBe('paused'); expect(store.setupReceipt?.message).toContain('15 分钟')
    expect(vi.mocked(provider.status).mock.calls[0]?.[1]?.aborted).toBe(true)
    expect(store.canResume).toBe(false); expect(lane.locked).toBe(true)
    response.resolve(progress('complete')); idle.resolve(); await flushPromises()
    expect(store.setupReceipt?.phase).toBe('paused'); expect(store.canResume).toBe(true); expect(lane.locked).toBe(true)
  })
})


describe('in-place provider metadata is checked again at each transport boundary', () => {
  it.each(['read-label', 'write-label', 'project-name'] as const)('detaches an active task after raw %s mutation even without a Vue change event', async kind => {
    const { store, browser, read, provider, lane } = await setup()
    await store.sendSetup(store.prepareSetup(A, consents)!, true)
    if (kind === 'read-label') Object.assign(read, { label: 'raw replaced reader label' })
    if (kind === 'write-label') Object.assign(provider, { label: 'raw replaced writer label' })
    if (kind === 'project-name') browser.projects[0]!.name = 'raw changed metadata'
    await tick()
    expect(store.setupReceipt?.phase).toBe('paused'); expect(store.tracking).toBe(false); expect(store.canResume).toBe(false)
    expect(provider.status).not.toHaveBeenCalled(); expect(lane.locked).toBe(true)
  })
})


it('revalidates cached resumability before tracking and permanently detaches a raw label change', async () => {
  const { store, provider, lane } = await setup()
  await store.sendSetup(store.prepareSetup(A, consents)!, true)
  store.stopWaiting(); expect(store.canResume).toBe(true)
  const originalLabel = provider.label
  Object.assign(provider, { label: 'raw replacement while paused' })
  expect(store.canResume).toBe(true) // A raw shallowRef member does not invalidate this computed cache.
  expect(await store.resume()).toBe(false)
  expect(store.setupReceipt?.phase).toBe('paused'); expect(store.tracking).toBe(false); expect(store.canResume).toBe(false)
  expect(provider.status).not.toHaveBeenCalled(); expect(lane.locked).toBe(true)
  Object.assign(provider, { label: originalLabel })
  expect(await store.resume()).toBe(false); await tick(5000)
  expect(store.setupReceipt?.phase).toBe('paused'); expect(store.tracking).toBe(false); expect(store.canResume).toBe(false)
  expect(provider.status).not.toHaveBeenCalled(); expect(provider.start).toHaveBeenCalledTimes(1); expect(lane.locked).toBe(true)
})
