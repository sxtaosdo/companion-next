import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { createCompanionBrowserProvider } from '../src/adapters/companion-browser'
import type { CompanionFetch } from '../src/adapters/companion-browser'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { CompanionEventError, type CompanionEventHandlers, type CompanionEventProvider } from '../src/domain/companion-live'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
const stamp = '2026-10-19T00:00:00Z'
const oldLog = { id: 'old', projectId: 'p1', source: 'bridge', level: 'info', time: stamp, message: 'old snapshot' }
const newLog = { id: 'new', projectId: 'p2', source: 'compile', level: 'error', time: stamp, message: 'BUILD & fail?' }

beforeEach(() => { setActivePinia(createPinia()); vi.useFakeTimers() })
afterEach(() => { useCompanionBrowserStore().disconnect(); vi.useRealTimers() })

it('keeps multi-source filters and paused manual reads across reconnect, rejecting old stream and HTTP results', async () => {
  const pending = deferred<Response>()
  let logReads = 0
  const fetch = vi.fn<CompanionFetch>(async path => {
    if (path === '/api/projects') return json([{ id: 'p1', name: 'One', path: '/fixture/one' }, { id: 'p2', name: 'Two', path: '/fixture/two' }])
    if (path === '/api/status' || path === '/api/dashboard/projects') return json([])
    if (path === '/api/calls/counts') return json({ sessionId: 's1', counts: {}, latest: {} })
    if (path.startsWith('/api/logs?')) return ++logReads === 1 ? pending.promise : json([newLog])
    throw new Error('Unexpected offline request')
  })
  const channels: Array<{ handlers: CompanionEventHandlers; signal?: AbortSignal }> = []
  const events: CompanionEventProvider = {
    label: 'Offline reconnect fixture',
    subscribe(handlers, signal) { channels.push({ handlers, signal }); return vi.fn() },
  }
  const store = useCompanionBrowserStore()
  await store.connect(createCompanionBrowserProvider({ fetch }))
  store.startLive(events)
  const old = channels[0]!
  old.handlers.onOpen()
  await flushPromises()
  await vi.advanceTimersByTimeAsync(400)
  expect(logReads).toBe(1)
  const oldSignal = fetch.mock.calls.find(([path]) => path.startsWith('/api/logs?'))![1].signal!

  store.pauseLogs(true)
  store.logFilter = { projectIds: ['p1', 'p2'], sources: ['bridge', 'compile'], levels: ['warning', 'error'], search: 'BUILD & fail?', limit: 200 }
  old.handlers.onError(new CompanionEventError('connection-error'))
  expect(old.signal?.aborted).toBe(true)
  expect(oldSignal.aborted).toBe(true)
  await vi.advanceTimersByTimeAsync(1000)
  expect(channels).toHaveLength(2)
  const current = channels[1]!
  current.handlers.onOpen()
  for (let i = 0; i < 100; i++) { old.handlers.onOpen(); old.handlers.onLog(); current.handlers.onLog() }
  pending.resolve(json([oldLog]))
  await flushPromises()
  await vi.advanceTimersByTimeAsync(800)
  expect(logReads).toBe(1)
  expect(store.logs).toEqual([])
  expect(store.logsRead).toBe(false)
  expect(store.logsPaused).toBe(true)
  expect(store.liveState).toBe('open')

  // The old UI's explicit refresh remains usable while automatic log updates are paused.
  await store.refreshLogs()
  expect(logReads).toBe(2)
  expect(store.logs.map(log => log.id)).toEqual(['new'])
  const queries = () => fetch.mock.calls.filter(([path]) => path.startsWith('/api/logs?')).map(([path]) => new URL(path, 'http://offline.invalid').searchParams)
  expect(queries()[1]!.getAll('projectId')).toEqual(['p1', 'p2'])
  expect(queries()[1]!.getAll('source')).toEqual(['bridge', 'compile'])
  expect(queries()[1]!.getAll('level')).toEqual(['warning', 'error'])
  expect(queries()[1]!.get('search')).toBe('BUILD & fail?')

  store.pauseLogs(false)
  for (let i = 0; i < 100; i++) current.handlers.onLog()
  await vi.advanceTimersByTimeAsync(400)
  expect(logReads).toBe(3)
  expect(queries()[2]!.toString()).toBe(queries()[1]!.toString())
  const readsBeforeLateHints = logReads
  for (let i = 0; i < 100; i++) old.handlers.onLog()
  await vi.advanceTimersByTimeAsync(800)
  expect(logReads).toBe(readsBeforeLateHints)
  expect(store.logs.map(log => log.id)).toEqual(['new'])
  expect(store.logsRead).toBe(true)
  expect(fetch.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  store.stopLive()
  expect(vi.getTimerCount()).toBe(0)
})
