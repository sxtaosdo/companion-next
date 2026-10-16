import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMPANION_EVENT_LIMITS, createCompanionEventProvider } from '../src/adapters/companion-events'
import type { CompanionEventSource, CompanionEventSourceFactory, CompanionEventType } from '../src/adapters/companion-events'
import { CompanionEventError } from '../src/domain/companion-live'
import type { CompanionEventCode, CompanionEventHandlers } from '../src/domain/companion-live'

const stamp = '2026-10-13T05:00:00.000Z'
const call = { id: 'call-3', sequence: 3, projectId: 'p1', operation: 'scene_get_tree', operationNameZh: '读取场景树', source: 'mcp', startedAt: stamp, status: 'success', durationMs: 30, inputSummary: '{}', resultSummary: '{"count":3}' }
const update = { sessionId: 'session-1', total: 3, record: call }
const log = { id: 'log-1', projectId: 'p1', source: 'bridge', level: 'info', time: stamp, message: '场景已读取' }

class FakeEventSource implements CompanionEventSource {
  readonly listeners = new Map<CompanionEventType, Set<EventListener>>()
  readonly history: [CompanionEventType, EventListener][] = []
  readonly close = vi.fn()
  readonly addEventListener = vi.fn((type: CompanionEventType, listener: EventListener) => {
    const entries = this.listeners.get(type) ?? new Set<EventListener>()
    entries.add(listener)
    this.listeners.set(type, entries)
    this.history.push([type, listener])
  })
  readonly removeEventListener = vi.fn((type: CompanionEventType, listener: EventListener) => { this.listeners.get(type)?.delete(listener) })
  emit(type: CompanionEventType, data?: unknown) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(new MessageEvent(type, { data }))
  }
  emitLate(type: CompanionEventType, data?: unknown) {
    for (const [registered, listener] of this.history) if (registered === type) listener(new MessageEvent(type, { data }))
  }
  get listenerCount() { return [...this.listeners.values()].reduce((total, values) => total + values.size, 0) }
}
function setup(signal?: AbortSignal) {
  const source = new FakeEventSource()
  const createEventSource = vi.fn<CompanionEventSourceFactory>(() => source)
  const handlers = { onOpen: vi.fn(), onLog: vi.fn(), onCall: vi.fn(), onError: vi.fn() } satisfies CompanionEventHandlers
  const provider = createCompanionEventProvider({ createEventSource })
  return { source, createEventSource, handlers, provider, subscribe: () => provider.subscribe(handlers, signal) }
}
function expectClosed(fixture: ReturnType<typeof setup>, code: CompanionEventCode = 'invalid-frame') {
  const { source, handlers } = fixture
  expect(source.close).toHaveBeenCalledTimes(1)
  expect(source.listenerCount).toBe(0)
  expect(handlers.onError).toHaveBeenCalledTimes(1)
  const error = handlers.onError.mock.calls[0]![0]
  expect(error).toBeInstanceOf(CompanionEventError)
  expect(error).toMatchObject({ code })
  expect(String(error)).not.toMatch(/PRIVATE|secret-value|https?:|\/api\//)
  expect('cause' in error).toBe(false)
  return error as CompanionEventError
}
afterEach(() => { vi.useRealTimers() })

describe('explicit fixed same-origin event subscription', () => {
  it('remains passive until subscribe and only listens to the four known event types', () => {
    const fixture = setup()
    expect(fixture.createEventSource).not.toHaveBeenCalled()
    expect(Object.isFrozen(fixture.provider)).toBe(true)
    expect(Object.keys(fixture.provider).sort()).toEqual(['label', 'subscribe'])
    const unsubscribe = fixture.subscribe()
    expect(fixture.createEventSource).toHaveBeenCalledExactlyOnceWith('/api/events')
    expect(fixture.source.history.map(([type]) => type)).toEqual(['open', 'message', 'call', 'error'])
    fixture.source.emit('open', 'PRIVATE')
    expect(fixture.handlers.onOpen).toHaveBeenCalledExactlyOnceWith()
    unsubscribe()
  })
  it('does not construct a transport for an already aborted subscription', () => {
    const controller = new AbortController()
    controller.abort()
    const fixture = setup(controller.signal)
    const unsubscribe = fixture.subscribe()
    unsubscribe()
    expect(fixture.createEventSource).not.toHaveBeenCalled()
    expect(fixture.handlers.onError).not.toHaveBeenCalled()
  })
  it('requires an explicit factory without consulting any global transport', () => {
    expect(() => createCompanionEventProvider({} as Parameters<typeof createCompanionEventProvider>[0])).toThrow('显式注入')
  })
  it('accepts the native EventSource shape without constructing it during registration', () => {
    const nativeFactory: CompanionEventSourceFactory = (path) => new EventSource(path)
    const provider = createCompanionEventProvider({ createEventSource: nativeFactory })
    expect(typeof provider.subscribe).toBe('function')
  })
})

describe('bounded default DebugEvent refresh hints', () => {
  it('validates logs but only signals a refresh, without forwarding secrets or remote fields', () => {
    const fixture = setup()
    const unsubscribe = fixture.subscribe()
    fixture.source.emit('message', JSON.stringify({ ...log, message: 'Bearer PRIVATE', token: 'PRIVATE', raw: { url: 'https://private.test' }, instanceId: 'i1', sessionId: 's1', operationId: 'o1' }))
    expect(fixture.handlers.onLog).toHaveBeenCalledExactlyOnceWith()
    expect(fixture.handlers.onCall).not.toHaveBeenCalled()
    expect(fixture.handlers.onError).not.toHaveBeenCalled()
    unsubscribe()
  })
  it.each(['', ' ', '\r\n\t'])('ignores an empty default frame %j without inventing a heartbeat guarantee', (data) => {
    const fixture = setup()
    const unsubscribe = fixture.subscribe()
    fixture.source.emit('message', data)
    expect(fixture.handlers.onLog).not.toHaveBeenCalled()
    expect(fixture.handlers.onError).not.toHaveBeenCalled()
    unsubscribe()
  })
  it.each([
    null, [], {}, true, 42, 'PRIVATE', { ...log, id: '' }, { ...log, projectId: '../PRIVATE' },
    { ...log, time: 'yesterday' }, { ...log, time: '2026-20-13T05:00:00.000Z' },
    { ...log, source: 'future-source' }, { ...log, level: 'fatal' }, { ...log, message: null },
    { ...log, message: 'x'.repeat(8193) }, { ...log, operationId: {} }, { ...log, message: 'PRIVATE\u0000' },
  ])('rejects non-DebugEvent JSON %# and closes the stream', (payload) => {
    const fixture = setup()
    const unsubscribe = fixture.subscribe()
    fixture.source.emit('message', JSON.stringify(payload))
    expectClosed(fixture)
    expect(fixture.handlers.onLog).not.toHaveBeenCalled()
    unsubscribe()
    expect(fixture.source.close).toHaveBeenCalledTimes(1)
  })
  it.each([undefined, null, 3, {}, '{PRIVATE', 'data: PRIVATE'])('rejects malformed default event data %#', (data) => {
    const fixture = setup()
    fixture.subscribe()
    fixture.source.emit('message', data)
    expectClosed(fixture)
  })
  it.each(['message', 'call'] as const)('enforces the UTF-8 byte budget for %s, including multibyte input', (type) => {
    const fixture = setup()
    fixture.subscribe()
    const data = JSON.stringify({ ignored: '界'.repeat(COMPANION_EVENT_LIMITS.maxFrameBytes / 2) })
    expect(data.length).toBeLessThan(COMPANION_EVENT_LIMITS.maxFrameBytes)
    fixture.source.emit(type, data)
    expectClosed(fixture, 'frame-too-large')
  })
  it('rejects an oversized whitespace frame before treating it as an empty hint', () => {
    const fixture = setup()
    fixture.subscribe()
    fixture.source.emit('message', ' '.repeat(COMPANION_EVENT_LIMITS.maxFrameBytes + 1))
    expectClosed(fixture, 'frame-too-large')
  })
})

describe('v148 call envelopes share the existing strict HTTP projection', () => {
  it('projects known fields, redacts summaries, and drops arbitrary payload data', () => {
    const fixture = setup()
    const unsubscribe = fixture.subscribe()
    fixture.source.emit('call', JSON.stringify({ ...update, secret: 'PRIVATE', record: { ...call, status: 'failed', inputSummary: 'password="PRIVATE"', resultSummary: 'Bearer PRIVATE', errorSummary: 'https://alice:PRIVATE@host.test token=PRIVATE', rawInput: 'PRIVATE', rawResult: 'PRIVATE', token: 'PRIVATE' } }))
    expect(fixture.handlers.onCall).toHaveBeenCalledTimes(1)
    expect(fixture.handlers.onCall.mock.calls[0]![0]).toEqual({ ...update, record: { ...call, status: 'failed', inputSummary: 'password=[redacted]', resultSummary: 'Bearer [redacted]', errorSummary: 'https://[redacted]@host.test token=[redacted]' } })
    expect(JSON.stringify(fixture.handlers.onCall.mock.calls)).not.toContain('PRIVATE')
    expect(fixture.handlers.onLog).not.toHaveBeenCalled()
    unsubscribe()
  })
  it('accepts begin then finish with the original per-project sequence and total', () => {
    const fixture = setup()
    const unsubscribe = fixture.subscribe()
    fixture.source.emit('call', JSON.stringify({ ...update, record: { ...call, status: 'running', durationMs: undefined, resultSummary: undefined } }))
    fixture.source.emit('call', JSON.stringify(update))
    fixture.source.emit('call', JSON.stringify({ ...update, total: 4 }))
    expect(fixture.handlers.onCall.mock.calls.map(([value]) => value.record.status)).toEqual(['running', 'success', 'success'])
    expect(fixture.handlers.onError).not.toHaveBeenCalled()
    unsubscribe()
  })
  it.each([
    null, [], {}, { ...update, sessionId: '' }, { ...update, sessionId: '../PRIVATE' },
    { ...update, total: 0 }, { ...update, total: -1 }, { ...update, total: 2 }, { ...update, total: 2.5 },
    { ...update, total: Number.MAX_SAFE_INTEGER + 1 }, { ...update, record: null },
    ...[
      { id: '' }, { id: '../PRIVATE' }, { projectId: '../PRIVATE' }, { projectId: {} }, { sequence: 0 }, { sequence: 4 },
      { sequence: 1.2 }, { sequence: Number.MAX_SAFE_INTEGER + 1 }, { source: 'other' }, { status: 'stopped' },
      { durationMs: -1 }, { durationMs: 0.5 }, { durationMs: undefined }, { resultSummary: undefined },
      { operation: {} }, { operationNameZh: 'x'.repeat(2001) }, { startedAt: 'yesterday' },
      { inputSummary: 'x'.repeat(2001) }, { resultSummary: {} }, { errorSummary: 'unexpected on success' },
      { status: 'failed' }, { status: 'running' },
    ].map((changes) => ({ ...update, record: { ...call, ...changes } })),
    { ...update, total: 1003 },
    { ...update, total: 4, record: { ...call, status: 'running', durationMs: undefined, resultSummary: undefined } },
  ])('rejects inconsistent call fields and original lifecycle semantics %#', (payload) => {
    const fixture = setup()
    fixture.subscribe()
    fixture.source.emit('call', JSON.stringify(payload))
    expectClosed(fixture)
    expect(fixture.handlers.onCall).not.toHaveBeenCalled()
  })
  it('rejects empty named call frames rather than counting them as a heartbeat', () => {
    const fixture = setup()
    fixture.subscribe()
    fixture.source.emit('call', '')
    expectClosed(fixture)
  })
})

describe('terminal connection handling, cleanup and callback isolation', () => {
  it.each(['unsubscribe', 'abort', 'error', 'invalid-frame'] as const)('detaches everything and rejects late callbacks after %s', (action) => {
    const controller = new AbortController()
    const fixture = setup(controller.signal)
    const unsubscribe = fixture.subscribe()
    if (action === 'unsubscribe') unsubscribe()
    if (action === 'abort') controller.abort()
    if (action === 'error') fixture.source.emit('error', 'https://private.test/?token=PRIVATE')
    if (action === 'invalid-frame') fixture.source.emit('call', '{PRIVATE')
    expect(fixture.source.listenerCount).toBe(0)
    expect(fixture.source.removeEventListener).toHaveBeenCalledTimes(4)
    expect(fixture.source.close).toHaveBeenCalledTimes(1)
    for (const [type, data] of [['open', undefined], ['message', JSON.stringify(log)], ['call', JSON.stringify(update)], ['error', 'PRIVATE']] as const) fixture.source.emitLate(type, data)
    expect(fixture.handlers.onOpen).not.toHaveBeenCalled()
    expect(fixture.handlers.onLog).not.toHaveBeenCalled()
    expect(fixture.handlers.onCall).not.toHaveBeenCalled()
    expect(fixture.handlers.onError).toHaveBeenCalledTimes(action === 'error' || action === 'invalid-frame' ? 1 : 0)
    unsubscribe()
    controller.abort()
    expect(fixture.source.close).toHaveBeenCalledTimes(1)
  })
  it('closes before reporting connection failures and never automatically reconnects', () => {
    vi.useFakeTimers()
    const fixture = setup()
    fixture.handlers.onError.mockImplementation(() => {
      expect(fixture.source.close).toHaveBeenCalledTimes(1)
      expect(fixture.source.listenerCount).toBe(0)
    })
    fixture.subscribe()
    fixture.source.emit('error', { url: 'https://private.test', message: 'PRIVATE' })
    expectClosed(fixture, 'connection-error')
    vi.advanceTimersByTime(60_000)
    expect(fixture.createEventSource).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('sanitizes constructor exceptions and removes the abort listener', () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const fixture = setup(controller.signal)
    fixture.createEventSource.mockImplementation(() => { throw new Error('https://private.test/?token=PRIVATE') })
    const unsubscribe = fixture.subscribe()
    const error = fixture.handlers.onError.mock.calls[0]![0]
    expect(error).toMatchObject({ code: 'connection-error' })
    expect(String(error)).not.toContain('PRIVATE')
    expect('cause' in error).toBe(false)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    unsubscribe()
    controller.abort()
    expect(fixture.handlers.onError).toHaveBeenCalledTimes(1)
  })
  it('closes a transport returned after the factory synchronously aborted', () => {
    const controller = new AbortController()
    const fixture = setup(controller.signal)
    fixture.createEventSource.mockImplementation(() => { controller.abort(); return fixture.source })
    const unsubscribe = fixture.subscribe()
    expect(fixture.source.close).toHaveBeenCalledTimes(1)
    expect(fixture.source.addEventListener).not.toHaveBeenCalled()
    expect(fixture.handlers.onError).not.toHaveBeenCalled()
    unsubscribe()
    expect(fixture.source.close).toHaveBeenCalledTimes(1)
  })
  it('cleans up a partially registered transport when listener registration throws', () => {
    const fixture = setup()
    const register = fixture.source.addEventListener.getMockImplementation()!
    fixture.source.addEventListener.mockImplementation((type, listener) => {
      register(type, listener)
      if (type === 'message') throw new Error('PRIVATE')
    })
    fixture.subscribe()
    expectClosed(fixture, 'connection-error')
    expect(fixture.source.removeEventListener).toHaveBeenCalledTimes(2)
  })
  it('continues closing and isolates callbacks even if injected cleanup methods throw', () => {
    const fixture = setup()
    fixture.subscribe()
    fixture.source.removeEventListener.mockImplementation(() => { throw new Error('PRIVATE') })
    fixture.source.close.mockImplementation(() => { throw new Error('PRIVATE') })
    fixture.source.emit('error', 'PRIVATE')
    expect(fixture.source.removeEventListener).toHaveBeenCalledTimes(4)
    expect(fixture.source.close).toHaveBeenCalledTimes(1)
    fixture.source.emitLate('call', JSON.stringify(update))
    fixture.source.emitLate('error', 'PRIVATE')
    expect(fixture.handlers.onCall).not.toHaveBeenCalled()
    expect(fixture.handlers.onError).toHaveBeenCalledTimes(1)
    expect(String(fixture.handlers.onError.mock.calls[0]![0])).not.toContain('PRIVATE')
  })
  it('allows caller-controlled replacement while previous callbacks stay inert', () => {
    const fixture = setup()
    const first = fixture.subscribe()
    const oldCall = fixture.source.history.find(([type]) => type === 'call')![1]
    first()
    const replacement = new FakeEventSource()
    fixture.createEventSource.mockReturnValue(replacement)
    const second = fixture.subscribe()
    oldCall(new MessageEvent('call', { data: JSON.stringify(update) }))
    replacement.emit('call', JSON.stringify(update))
    expect(fixture.handlers.onCall).toHaveBeenCalledExactlyOnceWith(update)
    expect(fixture.createEventSource).toHaveBeenCalledTimes(2)
    second()
    expect(replacement.close).toHaveBeenCalledTimes(1)
  })
})
