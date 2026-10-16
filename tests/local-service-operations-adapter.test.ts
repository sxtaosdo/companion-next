import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalServiceOperationsProvider, LOCAL_SERVICE_OPERATION_LIMITS, LocalServiceOperationError } from '../src/adapters/local-service-operations'
import type { LocalServiceOperationFetch } from '../src/adapters/local-service-operations'
import type { LocalService, LocalServiceOperationCode, LocalServiceOperationOutcome } from '../src/domain/local-service-operations'
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
const fixture = (value: unknown = { running: false }) => vi.fn<LocalServiceOperationFetch>(async () => value instanceof Response ? value : json(value))
const input = (service: LocalService = 'model') => ({ service, action: 'stop' as const })
const stopped = (service: LocalService) => service === 'knowledge' ? { running: false, frameable: false } : { running: false }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
async function failure(pending: Promise<unknown>, code: LocalServiceOperationCode, outcome: LocalServiceOperationOutcome = 'unknown') {
  const error = await pending.then(() => { throw Error('expected failure') }, value => value)
  expect(error).toBeInstanceOf(LocalServiceOperationError); expect(error).toMatchObject({ code, outcome })
  expect(`${error}${JSON.stringify(error)}`).not.toContain('PRIVATE'); return error
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('audited v148 service stop contract, fake transport only', () => {
  it.each(['knowledge', 'model'] as const)('is passive and emits only the fixed %s stop request', async service => {
    const fetch = fixture(stopped(service)), provider = createLocalServiceOperationsProvider({ fetch })
    expect(fetch).not.toHaveBeenCalled(); await provider.waitForIdle(); expect(Object.isFrozen(provider)).toBe(true)
    expect(Object.keys(provider).sort()).toEqual(['label', 'run', 'waitForIdle'])
    expect(await provider.run(input(service))).toEqual({ ...input(service), state: stopped(service) })
    expect(fetch).toHaveBeenCalledOnce(); const [path, init] = fetch.mock.calls[0]!
    expect(path).toBe(`/api/${service === 'knowledge' ? 'knowledge' : 'model'}-service/stop`)
    expect(init).toMatchObject({ method: 'POST', body: '{}', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
    expect(Object.keys(init).sort()).toEqual(['body', 'cache', 'credentials', 'headers', 'method', 'mode', 'redirect', 'signal'])
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
  it('requires injected transport and bounds timeout', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(() => createLocalServiceOperationsProvider(undefined as never)).toThrow(TypeError)
    for (const timeoutMs of [0, -1, NaN, Infinity, 120_001]) expect(() => createLocalServiceOperationsProvider({ fetch: fixture(), timeoutMs })).toThrow(RangeError)
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['start', 'restart', 'launch', 'stop/../start', '', null])('cannot dispatch unaudited or noncontract action %s', async action => {
    const fetch = fixture(); await failure(createLocalServiceOperationsProvider({ fetch }).run({ ...input(), action } as never), 'invalid-input', 'not-dispatched'); expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['knowledge-service', 'model-service', '../PRIVATE', 'https://PRIVATE', 'cli', '', null])('rejects unsafe target %s', async service => {
    const fetch = fixture(); await failure(createLocalServiceOperationsProvider({ fetch }).run({ ...input(), service } as never), 'invalid-input', 'not-dispatched'); expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects extra data, accessors and prototypes without evaluating input getters', async () => {
    const fetch = fixture(), provider = createLocalServiceOperationsProvider({ fetch }), getter = vi.fn(() => 'PRIVATE')
    for (const value of [null, [], Object.create(input()), { ...input(), url: 'https://PRIVATE' }, { ...input(), force: true }, { ...input(), token: 'PRIVATE' }, Object.defineProperty(input(), 'service', { get: getter }), Object.assign(input(), { [Symbol()]: 'PRIVATE' }), new Proxy({}, { ownKeys() { throw Error('PRIVATE') } })]) await failure(provider.run(value as never), 'invalid-input', 'not-dispatched')
    expect(getter).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('snapshots the fixed request before the first microtask', async () => {
    const fetch = fixture(stopped('model')), provider = createLocalServiceOperationsProvider({ fetch }), request = input()
    const pending = provider.run(request); request.service = 'knowledge'; await pending
    expect(fetch.mock.calls[0]![0]).toBe('/api/model-service/stop')
  })
  it.each(['knowledge', 'model'] as const)('recognizes only exact Forbidden as pre-operation rejection for %s', async service => {
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(json({ error: 'Forbidden' }, 403)) }).run(input(service)), 'forbidden', 'rejected')
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(json({ error: 'Forbidden', extra: 'PRIVATE' }, 403)) }).run(input(service)), 'invalid-shape')
  })
  it.each(['knowledge', 'model'] as const)('treats source-proven %s 503 as reported failure without exposing diagnostics', async service => {
    const raw = { ...stopped(service), running: true, error: 'PRIVATE token=PRIVATE' }
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(json(raw, 503)) }).run(input(service)), 'backend-failure', 'reported-failure')
  })
  it.each([null, [], {}, { running: true }, { running: 'false' }, { running: false, error: 'PRIVATE' }, { running: false, token: 'PRIVATE' }, { running: false, frameable: false }])('rejects inconsistent model success %#', async raw => {
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(raw) }).run(input()), 'invalid-shape')
  })
  it.each([{ running: false }, { running: false, frameable: true }, { running: false, frameable: 'false' }, { running: true, frameable: false }, { running: false, frameable: false, error: 'PRIVATE' }])('rejects inconsistent knowledge success %#', async raw => {
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(raw) }).run(input('knowledge')), 'invalid-shape')
  })
  it.each([201, 401, 404, 409, 429, 500, 503])('never trusts status %s alone as rejected or successful', async status => {
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(json({ running: false }, status)) }).run(input()), 'invalid-shape')
  })
  it.each([{ type: 'opaque' }, { type: 'opaqueredirect' }, { redirected: true }])('rejects redirects and opaque responses %#', async props => {
    const response = json(stopped('model')); for (const [key, value] of Object.entries(props)) Object.defineProperty(response, key, { value })
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(response) }).run(input()), 'invalid-shape')
  })
  it('rejects HTML, malformed JSON, oversized responses, excessive chunks and forged errors', async () => {
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(new Response('PRIVATE', { headers: { 'Content-Type': 'text/html' } })) }).run(input()), 'invalid-shape')
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(new Response('PRIVATE', { headers: { 'Content-Type': 'application/json' } })) }).run(input()), 'invalid-shape')
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(json({ running: false, error: 'PRIVATE'.repeat(2000) })) }).run(input()), 'response-too-large')
    const advertised = json(stopped('model')); advertised.headers.set('Content-Length', String(LOCAL_SERVICE_OPERATION_LIMITS.maxResponseBytes + 1))
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(advertised) }).run(input()), 'response-too-large')
    const chunks = new Response(new ReadableStream({ start(controller) { for (let i = 0; i < 65; i++) controller.enqueue(new Uint8Array()); controller.close() } }), { headers: { 'Content-Type': 'application/json' } })
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(chunks) }).run(input()), 'response-too-large')
    const fetch = vi.fn<LocalServiceOperationFetch>(async () => { throw new LocalServiceOperationError('forbidden', 'rejected') })
    await failure(createLocalServiceOperationsProvider({ fetch }).run(input()), 'network-error')
  })
})
describe('single-flight, cancellation and late transport protection', () => {
  it('pre-aborted and same-tick cancelled requests are not dispatched', async () => {
    for (const before of [true, false]) {
      const fetch = fixture(), provider = createLocalServiceOperationsProvider({ fetch }), controller = new AbortController()
      if (before) controller.abort(); const pending = provider.run(input(), controller.signal); if (!before) controller.abort()
      await failure(pending, 'aborted', 'not-dispatched'); await provider.waitForIdle(); expect(fetch).not.toHaveBeenCalled()
    }
  })
  it('blocks a second service while fetch or delayed cancellation remains unsettled', async () => {
    const result = deferred<Response>(), cancelled = deferred<void>(), fetch = vi.fn<LocalServiceOperationFetch>(() => result.promise)
    const provider = createLocalServiceOperationsProvider({ fetch }), controller = new AbortController(), pending = provider.run(input(), controller.signal)
    await flush(); controller.abort(); await failure(pending, 'aborted')
    await failure(provider.run(input('knowledge')), 'busy', 'not-dispatched')
    let idle = false; void provider.waitForIdle().then(() => { idle = true }); await flush(); expect(idle).toBe(false)
    result.resolve(new Response(new ReadableStream({ cancel() { return cancelled.promise } }), { headers: { 'Content-Type': 'application/json' } }))
    await flush(); expect(idle).toBe(false); await failure(provider.run(input('knowledge')), 'busy', 'not-dispatched')
    cancelled.resolve(); await provider.waitForIdle(); expect(idle).toBe(true); expect(fetch).toHaveBeenCalledOnce()
  })
  it('keeps a timeout unknown and does not retry after late success', async () => {
    vi.useFakeTimers(); const result = deferred<Response>(), fetch = vi.fn<LocalServiceOperationFetch>(() => result.promise), provider = createLocalServiceOperationsProvider({ fetch, timeoutMs: 10 })
    const pending = failure(provider.run(input()), 'timeout'); await flush(); await vi.advanceTimersByTimeAsync(11); await pending
    await failure(provider.run(input()), 'busy', 'not-dispatched'); result.resolve(json(stopped('model'))); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledOnce()
  })
  it('retains a pending body-read lease after cancellation and rejects raw reader errors', async () => {
    const controller = new AbortController(), read = deferred<ReadableStreamReadResult<Uint8Array>>(), cancel = deferred<void>()
    const response = json(stopped('model')), reader = { read: () => read.promise, cancel: () => cancel.promise, releaseLock: () => {} }
    Object.defineProperty(response, 'body', { value: { getReader: () => reader } })
    const provider = createLocalServiceOperationsProvider({ fetch: fixture(response) }), pending = provider.run(input(), controller.signal)
    await flush(); controller.abort(); await failure(pending, 'aborted'); await failure(provider.run(input()), 'busy', 'not-dispatched')
    cancel.resolve(); await flush(); await failure(provider.run(input()), 'busy', 'not-dispatched')
    read.reject(new LocalServiceOperationError('forbidden', 'rejected')); await provider.waitForIdle()
  })
})


describe('audited original knowledge start only', () => {
  const request = { service: 'knowledge', action: 'start' } as const
  it.each([true, false])('preserves running:true and frameable:%s without implying login or index readiness', async frameable => {
    const fetch = fixture({ running: true, frameable }), provider = createLocalServiceOperationsProvider({ fetch })
    expect(await provider.run(request)).toEqual({ ...request, state: { running: true, frameable } })
    expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0]![0]).toBe('/api/knowledge-service/start'); expect(fetch.mock.calls[0]![1].body).toBe('{}')
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'POST', credentials: 'same-origin', mode: 'same-origin', redirect: 'error' })
  })
  it.each([{ running: false, frameable: false }, { running: true }, { running: true, frameable: 'yes' }, { running: true, frameable: true, error: 'PRIVATE' }])('rejects invalid start success %#', async raw => {
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(raw) }).run(request), 'invalid-shape')
  })
  it('accepts only source-proven start failure envelope as reported failure', async () => {
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(json({ running: false, frameable: false, error: 'PRIVATE' }, 503)) }).run(request), 'backend-failure', 'reported-failure')
    await failure(createLocalServiceOperationsProvider({ fetch: fixture(json({ running: true, frameable: false, error: 'PRIVATE' }, 503)) }).run(request), 'invalid-shape')
  })
  it('blocks all stops and further starts during an in-flight knowledge start', async () => {
    const result = deferred<Response>(), fetch = vi.fn<LocalServiceOperationFetch>(() => result.promise), provider = createLocalServiceOperationsProvider({ fetch })
    const pending = provider.run(request); await flush()
    await failure(provider.run(input()), 'busy', 'not-dispatched'); await failure(provider.run(input('knowledge')), 'busy', 'not-dispatched'); await failure(provider.run(request), 'busy', 'not-dispatched')
    result.resolve(json({ running: true, frameable: false })); await pending; expect(fetch).toHaveBeenCalledOnce()
  })
  it('never includes script paths, credentials, ownership or project fields in the start request', async () => {
    const fetch = fixture({ running: true, frameable: false }), provider = createLocalServiceOperationsProvider({ fetch })
    for (const extra of [{ token: 'PRIVATE' }, { script: 'PRIVATE' }, { env: {} }, { owned: true }, { projectId: 'PRIVATE' }]) await failure(provider.run({ ...request, ...extra }), 'invalid-input', 'not-dispatched')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('has sufficient bounded time for the original 60-second script plus 45-second service wait', () => {
    expect(LOCAL_SERVICE_OPERATION_LIMITS.timeoutMs).toBe(120_000)
  })
})
