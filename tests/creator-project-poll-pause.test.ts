import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import type { CompanionBrowserProvider, ProjectRead } from '../src/domain/companion-browser'
import type { CompanionEventHandlers, CompanionEventProvider } from '../src/domain/companion-live'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'

const data: ProjectRead = { projects: [{ id: 'aaaaaaaaaaaaaaaa', name: '确认中的工程', path: '/fake/confirmation' }],
  statuses: [{ projectId: 'aaaaaaaaaaaaaaaa', state: 'stopped', capabilityProfile: 'authoring' }], dashboard: [], warnings: [] }
function readProvider(): CompanionBrowserProvider {
  return { label: 'fake polling reader', loadProjects: vi.fn(async () => structuredClone(data)), loadLogs: vi.fn(async () => []),
    loadCounts: vi.fn(async () => ({ sessionId: 'session-1', counts: {}, latest: {} })),
    loadCalls: vi.fn(async () => ({ sessionId: 'session-1', total: 0, retained: 0, records: [] })) }
}
function eventProvider() {
  const channels: Array<{ handlers: CompanionEventHandlers; signal?: AbortSignal; close: ReturnType<typeof vi.fn> }> = []
  const provider: CompanionEventProvider = { label: 'fake event reader', subscribe: vi.fn((handlers, signal) => {
    const close = vi.fn(); channels.push({ handlers, signal, close }); handlers.onOpen(); return close
  }) }
  return { provider, channels }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
async function setup() {
  const reader = readProvider(), events = eventProvider(), store = useCompanionBrowserStore()
  await store.connect(reader); store.startLive(events.provider); await flushPromises()
  return { store, reader, events }
}
beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers() })
afterEach(() => { useCompanionBrowserStore().disconnect(); vi.clearAllTimers(); vi.useRealTimers() })

describe('confirmation pauses only scheduled project polling', () => {
  it('removes an already queued immediate poll without touching live events, counts or logs', async () => {
    const { store, reader, events } = await setup()
    expect(store.liveEnabled).toBe(true); expect(store.liveState).toBe('open')
    store.pauseProjectPolling(true)
    expect(store.projectPollingPaused).toBe(true)
    await vi.advanceTimersByTimeAsync(12000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1)
    expect(reader.loadCounts).toHaveBeenCalledTimes(2)
    expect(reader.loadLogs).toHaveBeenCalledTimes(1)
    expect(events.channels).toHaveLength(1); expect(events.channels[0]!.signal?.aborted).toBe(false)
    expect(events.channels[0]!.close).not.toHaveBeenCalled()
    expect(store.liveEnabled).toBe(true); expect(store.liveState).toBe('open')
    events.channels[0]!.handlers.onLog()
    await vi.advanceTimersByTimeAsync(400)
    expect(reader.loadLogs).toHaveBeenCalledTimes(2)
  })
  it('pauses a queued ordinary poll and resumes once after the full ordinary interval', async () => {
    const { store, reader } = await setup()
    await vi.advanceTimersByTimeAsync(0); expect(reader.loadProjects).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(2999); store.pauseProjectPolling(true)
    await vi.advanceTimersByTimeAsync(12000); expect(reader.loadProjects).toHaveBeenCalledTimes(2)
    store.pauseProjectPolling(false)
    expect(store.projectPollingPaused).toBe(false)
    await vi.advanceTimersByTimeAsync(2999); expect(reader.loadProjects).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1); expect(reader.loadProjects).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(6000); expect(reader.loadProjects).toHaveBeenCalledTimes(5)
  })
  it('never cancels a manual read, and manual refresh remains available during the pause', async () => {
    const { store, reader } = await setup(), pending = deferred<ProjectRead>()
    store.pauseProjectPolling(true)
    reader.loadProjects = vi.fn(() => pending.promise)
    const reading = store.refreshProjects(), signal = vi.mocked(reader.loadProjects).mock.calls[0]?.[0]
    store.pauseProjectPolling(true)
    expect(signal?.aborted).toBe(false); expect(store.projectLoading).toBe(true)
    pending.resolve(structuredClone(data)); await reading
    expect(store.projectLoading).toBe(false); expect(store.projectSnapshotRevision).toBe(2)
    reader.loadProjects = vi.fn(async () => structuredClone(data))
    await store.refreshProjects(); expect(reader.loadProjects).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(15000); expect(reader.loadProjects).toHaveBeenCalledTimes(1)
  })
  it('lets an in-flight scheduled read finish but never schedules a hidden successor while paused', async () => {
    const { store, reader } = await setup(), pending = deferred<ProjectRead>()
    reader.loadProjects = vi.fn(() => pending.promise)
    await vi.advanceTimersByTimeAsync(0)
    const signal = vi.mocked(reader.loadProjects).mock.calls[0]?.[0]
    store.pauseProjectPolling(true); expect(signal?.aborted).toBe(false)
    pending.resolve(structuredClone(data)); await flushPromises()
    await vi.advanceTimersByTimeAsync(15000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1); expect(store.projectLoading).toBe(false)
    reader.loadProjects = vi.fn(async () => structuredClone(data))
    store.pauseProjectPolling(false); await vi.advanceTimersByTimeAsync(3000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1)
  })
  it('does not multiply timers through repeated pause/resume or a pending poll completion', async () => {
    const { store, reader } = await setup(), pending = deferred<ProjectRead>()
    reader.loadProjects = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue(data)
    await vi.advanceTimersByTimeAsync(0)
    for (let count = 0; count < 10; count++) { store.pauseProjectPolling(true); store.pauseProjectPolling(false); store.pauseProjectPolling(false) }
    await vi.advanceTimersByTimeAsync(6000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1)
    pending.resolve(data); await flushPromises()
    await vi.advanceTimersByTimeAsync(12000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(5)
    expect(vi.getTimerCount()).toBe(1)
  })
  it('unpausing while hidden does not restart reads; visibility restores normal polling', async () => {
    const { store, reader, events } = await setup()
    store.pauseProjectPolling(true); store.setLiveVisibility(false); store.pauseProjectPolling(false)
    await vi.advanceTimersByTimeAsync(15000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1); expect(store.liveState).toBe('suspended')
    expect(events.channels[0]!.signal?.aborted).toBe(true)
    store.setLiveVisibility(true); await vi.advanceTimersByTimeAsync(0)
    expect(reader.loadProjects).toHaveBeenCalledTimes(2); expect(events.channels).toHaveLength(2)
  })
  it('remaining paused across hide/show keeps project reads stopped and resumes events', async () => {
    const { store, reader, events } = await setup()
    store.pauseProjectPolling(true); store.setLiveVisibility(false); store.setLiveVisibility(true)
    await vi.advanceTimersByTimeAsync(10000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1); expect(events.channels).toHaveLength(2)
    expect(store.liveEnabled).toBe(true); expect(store.projectPollingPaused).toBe(true)
    store.pauseProjectPolling(false); await vi.advanceTimersByTimeAsync(3000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(2)
  })
  it.each(['stop', 'leave', 'disconnect'] as const)('cannot restart polling after %s', async ending => {
    const { store, reader } = await setup()
    store.pauseProjectPolling(true)
    if (ending === 'stop') store.stopLive()
    if (ending === 'leave') store.cancelReads()
    if (ending === 'disconnect') store.disconnect()
    store.pauseProjectPolling(false)
    await vi.advanceTimersByTimeAsync(15000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1); expect(store.liveEnabled).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('preserves a live confirmation pause across a realtime restart without accumulating timers', async () => {
    const { store, reader, events } = await setup()
    store.pauseProjectPolling(true)
    for (let count = 0; count < 3; count++) store.startLive(events.provider)
    await vi.advanceTimersByTimeAsync(10000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1); expect(store.projectPollingPaused).toBe(true)
    expect(events.channels).toHaveLength(4)
    expect(events.channels.slice(0, -1).every(channel => channel.signal?.aborted)).toBe(true)
    store.pauseProjectPolling(false); await vi.advanceTimersByTimeAsync(9000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(4); expect(vi.getTimerCount()).toBe(1)
  })
  it('disconnect resets the temporary pause and an explicit fresh live session can poll normally', async () => {
    const { store, reader, events } = await setup()
    store.pauseProjectPolling(true); store.disconnect()
    expect(store.projectPollingPaused).toBe(false)
    await store.connect(reader); store.startLive(events.provider)
    await vi.advanceTimersByTimeAsync(0)
    expect(reader.loadProjects).toHaveBeenCalledTimes(3)
  })
  it('stale in-flight callbacks cannot resurrect polling after stop and pause release', async () => {
    const { store, reader } = await setup(), pending = deferred<ProjectRead>()
    reader.loadProjects = vi.fn(() => pending.promise)
    await vi.advanceTimersByTimeAsync(0)
    store.pauseProjectPolling(true); store.cancelReads(); store.pauseProjectPolling(false)
    pending.resolve(data); await flushPromises(); await vi.advanceTimersByTimeAsync(15000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0)
  })
})
