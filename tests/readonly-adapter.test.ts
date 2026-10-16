import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSameOriginReadOnlyProvider, READ_ONLY_LIMITS, ReadOnlyAdapterError } from '../src/adapters/same-origin-readonly'
import type { ReadEndpoint, ReadOnlyFetch } from '../src/adapters/same-origin-readonly'

const project = { id: '21e82e1c233998ab', name: '星际工程', requiredCreatorVersion: '3.8.8' }
const status = { projectId: project.id, state: 'ready', creatorVersion: '3.8.8' }
const json = (value: unknown, init?: ResponseInit) => {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(value), { ...init, headers })
}
const fetchValues = (projects: unknown = [project], statuses: unknown = [status]) => vi.fn<ReadOnlyFetch>(async (endpoint) =>
  json(endpoint === '/api/projects' ? projects : statuses))
const never = () => new Promise<Response>(() => undefined)
const getError = (promise: Promise<unknown>): Promise<ReadOnlyAdapterError> => promise.then(
  () => { throw new Error('Expected rejection') },
  (error: unknown) => { expect(error).toBeInstanceOf(ReadOnlyAdapterError); return error as ReadOnlyAdapterError },
)

afterEach(() => { vi.useRealTimers() })

describe('passive same-origin read-only adapter', () => {
  it('constructs without requests, uses only two fixed GET routes and no credential/header overrides', async () => {
    const fetch = fetchValues()
    const provider = createSameOriginReadOnlyProvider({ fetch })
    expect(fetch).not.toHaveBeenCalled()
    expect(provider.mode).toBe('live')
    expect(Object.keys(provider).sort()).toEqual(['label', 'loadSnapshot', 'mode'])
    await provider.loadSnapshot()
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/projects', '/api/status'])
    for (const [, init] of fetch.mock.calls) {
      expect(init).toMatchObject({
        method: 'GET', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      expect(init.signal).toBeInstanceOf(AbortSignal)
      expect(init.body).toBeUndefined()
      expect(new Headers(init.headers).get('authorization')).toBeNull()
    }
  })

  it('projects only verified fields and never synthesizes revision, resources or validation evidence', async () => {
    const fetch = fetchValues([{ ...project, path: 'C:\\Users\\private\\game', connectionPath: '/private/token',
      creatorExecutable: '/private/creator', spec: { version: 'invented' }, protectedAssets: 42, styleApproval: 'approved' }],
    [{ ...status, lastError: '/private/error includes secrets', sessionId: 'secret-session', pid: 444,
      preview: { state: 'running', url: 'http://private.invalid/?secret=abc' }, revision: 'claimed-revision' }])
    const before = Date.now()
    const snapshot = await createSameOriginReadOnlyProvider({ fetch }).loadSnapshot()
    expect(snapshot.projects).toEqual([{ id: project.id, name: project.name, engineVersion: '3.8.8', styleApproval: 'unknown', protectedAssets: null }])
    expect(snapshot.resources).toEqual([])
    expect(snapshot.projects[0]?.spec).toBeUndefined()
    expect(snapshot.source.revision).toBeUndefined()
    expect(Date.parse(snapshot.source.observedAt!)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(snapshot.source.observedAt!)).toBeLessThanOrEqual(Date.now())
    expect(snapshot.services.find((service) => service.id === `creator:${project.id}`)).toMatchObject({ state: 'available', version: '3.8.8' })
    expect(snapshot.services.filter((service) => ['model-service', 'knowledge-service'].includes(service.id)).map((service) => [service.state, service.checkedAt])).toEqual([['unknown', undefined], ['unknown', undefined]])
    const serialized = JSON.stringify(snapshot)
    for (const forbidden of ['private', 'secret-session', 'claimed-revision', 'invented', 'protectedAssets":42']) expect(serialized).not.toContain(forbidden)
    expect(serialized).toContain('当前旧版协议与完整功能兼容性仍待核验')
  })

  it.each([
    ['ready', 'available'], ['stopped', 'unavailable'], ['launching', 'degraded'], ['bridge-wait', 'degraded'],
    ['stopping', 'degraded'], ['crashed', 'unavailable'], ['incompatible', 'degraded'], ['error', 'unavailable'],
  ])('maps exact runtime state %s to %s, not HTTP success or misleading ready flags', async (state, expected) => {
    const snapshot = await createSameOriginReadOnlyProvider({ fetch: fetchValues([project], [{ ...status, state, ready: true, running: true }]) }).loadSnapshot()
    expect(snapshot.services.find((service) => service.id === `creator:${project.id}`)?.state).toBe(expected)
  })

  it('accepts valid empty arrays without inventing a project or ready Creator', async () => {
    const snapshot = await createSameOriginReadOnlyProvider({ fetch: fetchValues([], []) }).loadSnapshot()
    expect(snapshot.projects).toEqual([])
    expect(snapshot.services.filter((service) => service.id.startsWith('creator:'))).toEqual([])
    expect(snapshot.source.observedAt).toBeDefined()
  })

  it('keeps missing project statuses unknown and does not invent projects from orphan statuses', async () => {
    const snapshot = await createSameOriginReadOnlyProvider({ fetch: fetchValues([project], [{ ...status, projectId: 'orphan' }]) }).loadSnapshot()
    expect(snapshot.projects).toHaveLength(1)
    expect(snapshot.services.find((service) => service.id === `creator:${project.id}`)).toMatchObject({ state: 'unknown' })
    expect(snapshot.services.find((service) => service.id === `creator:${project.id}`)?.checkedAt).toBeUndefined()
    expect(snapshot.services.find((service) => service.id === 'creator:orphan')?.name).toBe('未关联工程 · Creator / Bridge')
    expect(snapshot.source.limitations.join(' ')).toContain('没有匹配的工程登记')
  })

  it.each([
    { running: true, projects: [status] },
    [{ projectId: project.id, status: 'ready' }],
    [{ ...status, state: 'READY' }],
    [{ ...status, state: true }],
    [{ ...status, creatorVersion: 388 }],
    [status, status],
  ])('rejects wrapped /v1 status, aliases and invalid status records %#', async (statuses) => {
    const snapshot = await createSameOriginReadOnlyProvider({ fetch: fetchValues([project], statuses) }).loadSnapshot()
    expect(snapshot.services.find((service) => service.id === `creator:${project.id}`)?.state).toBe('unknown')
    expect(snapshot.services.find((service) => service.id === 'companion-read-api')?.state).toBe('degraded')
    expect(snapshot.source.limitations.join(' ')).toContain('/api/status [invalid-shape]')
  })

  it.each([
    { projects: [project] }, [null], [{ id: project.id, path: '/private/game' }],
    [{ ...project, id: '/private/project' }], [{ ...project, name: 'C:\\private\\project' }],
    [{ ...project, name: '<script>alert(1)</script>' }], [{ ...project, requiredCreatorVersion: 388 }],
    [project, project], Array.from({ length: READ_ONLY_LIMITS.maxRecordsPerEndpoint + 1 }, (_, index) => ({ ...project, id: String(index) })),
  ])('rejects unsafe or invalid project shapes without leaking them %#', async (projects) => {
    const snapshot = await createSameOriginReadOnlyProvider({ fetch: fetchValues(projects, []) }).loadSnapshot()
    expect(snapshot.projects).toEqual([])
    expect(snapshot.source.limitations.join(' ')).toContain('/api/projects [invalid-shape]')
    expect(JSON.stringify(snapshot)).not.toContain('private')
  })

  it.each([[401, 'unauthorized'], [403, 'forbidden'], [503, 'http-error']])('reports %s safely without reading the error body', async (httpStatus, code) => {
    const fetch = vi.fn<ReadOnlyFetch>(async (endpoint) => endpoint === '/api/projects'
      ? new Response('secret error at C:\\private\\account', { status: Number(httpStatus) }) : json([status]))
    const snapshot = await createSameOriginReadOnlyProvider({ fetch }).loadSnapshot()
    expect(snapshot.projects).toEqual([])
    expect(snapshot.source.limitations.join(' ')).toContain(`[${code}]`)
    expect(JSON.stringify(snapshot)).not.toContain('secret')
    expect(snapshot.source.observedAt).toBeDefined()
  })

  it('reports two failures structurally without fabricating a successful timestamp', async () => {
    const fetch = vi.fn<ReadOnlyFetch>(async (endpoint) => endpoint === '/api/projects'
      ? new Response('private forbidden', { status: 403 }) : json({ running: true, projects: [] }))
    const error = await getError(createSameOriginReadOnlyProvider({ fetch }).loadSnapshot())
    expect(error.code).toBe('all-reads-failed')
    expect(error.failures).toEqual([{ endpoint: '/api/projects', code: 'forbidden', status: 403 }, { endpoint: '/api/status', code: 'invalid-shape' }])
    expect(JSON.stringify(error)).not.toContain('private')
    expect(JSON.stringify(error)).not.toContain('observedAt')
  })

  it.each([
    () => new Response('<html>login private</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{malformed-private', { headers: { 'content-type': 'application/json' } }),
    () => new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } }),
  ])('rejects non-JSON, malformed JSON and invalid UTF-8 safely %#', async (response) => {
    const error = await getError(createSameOriginReadOnlyProvider({ fetch: async () => response() }).loadSnapshot())
    expect(error.failures.map((failure) => failure.code)).toEqual(['invalid-shape', 'invalid-shape'])
    expect(JSON.stringify(error)).not.toContain('private')
  })

  it('rejects fetch failures with generic errors and no upstream text', async () => {
    const error = await getError(createSameOriginReadOnlyProvider({ fetch: async () => { throw new Error('/private/secret ECONNREFUSED') } }).loadSnapshot())
    expect(error.failures.map((failure) => failure.code)).toEqual(['network-error', 'network-error'])
    expect(error.message).not.toContain('ECONNREFUSED')
  })

  it('limits both advertised and streamed response size', async () => {
    for (const advertised of [true, false]) {
      const fetch: ReadOnlyFetch = async () => new Response(' '.repeat(READ_ONLY_LIMITS.maxResponseBytes + 1), {
        headers: { 'content-type': 'application/json', ...(advertised ? { 'content-length': String(READ_ONLY_LIMITS.maxResponseBytes + 1) } : {}) },
      })
      const error = await getError(createSameOriginReadOnlyProvider({ fetch }).loadSnapshot())
      expect(error.failures.every((failure) => failure.code === 'response-too-large')).toBe(true)
    }
  })

  it('makes no request for a pre-aborted caller', async () => {
    const fetch = fetchValues()
    const controller = new AbortController()
    controller.abort()
    const error = await getError(createSameOriginReadOnlyProvider({ fetch }).loadSnapshot(controller.signal))
    expect(error.code).toBe('aborted')
    expect(error.name).toBe('AbortError')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('settles explicit cancellation even when transport ignores abort and never publishes a partial snapshot', async () => {
    const controller = new AbortController()
    const fetch = vi.fn<ReadOnlyFetch>((endpoint) => endpoint === '/api/projects' ? Promise.resolve(json([project])) : never())
    const provider = createSameOriginReadOnlyProvider({ fetch })
    const pending = getError(provider.loadSnapshot(controller.signal))
    await Promise.resolve()
    await Promise.resolve()
    controller.abort()
    expect((await pending).code).toBe('aborted')
    expect(fetch.mock.calls.every(([, init]) => init.signal?.aborted)).toBe(true)
  })

  it('times out fetch and stalled response body reads and removes timer after settlement', async () => {
    vi.useFakeTimers()
    for (const stalledBody of [false, true]) {
      const fetch: ReadOnlyFetch = stalledBody
        ? async () => new Response(new ReadableStream<Uint8Array>({ start() { /* Remains open until cancelled. */ } }), { headers: { 'content-type': 'application/json' } })
        : never
      const pending = getError(createSameOriginReadOnlyProvider({ fetch, timeoutMs: 100 }).loadSnapshot())
      await vi.advanceTimersByTimeAsync(100)
      expect((await pending).failures.map((failure) => failure.code)).toEqual(['timeout', 'timeout'])
      expect(vi.getTimerCount()).toBe(0)
    }
  })

  it('preserves the successful endpoint read time when another endpoint times out', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-11T08:00:00Z'))
    const pending = createSameOriginReadOnlyProvider({
      fetch: (endpoint: ReadEndpoint) => endpoint === '/api/projects' ? Promise.resolve(json([project])) : never(), timeoutMs: 1000,
    }).loadSnapshot()
    await vi.advanceTimersByTimeAsync(1000)
    const snapshot = await pending
    expect(snapshot.source.observedAt).toBe('2026-10-11T08:00:00.000Z')
    expect(snapshot.source.limitations.join(' ')).toContain('/api/status [timeout]')
    expect(snapshot.services.find((service) => service.id === `creator:${project.id}`)?.state).toBe('unknown')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects concurrent loads without extra requests, then allows retry after cancellation', async () => {
    const fetch = vi.fn<ReadOnlyFetch>(never)
    const provider = createSameOriginReadOnlyProvider({ fetch })
    const controller = new AbortController()
    const first = getError(provider.loadSnapshot(controller.signal))
    expect((await getError(provider.loadSnapshot())).code).toBe('busy')
    expect(fetch).toHaveBeenCalledTimes(2)
    controller.abort()
    await first
    fetch.mockImplementation(async (endpoint) => json(endpoint === '/api/projects' ? [project] : [status]))
    expect((await provider.loadSnapshot()).projects).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('allows immediate replacement after abort without old cleanup unlocking the newer load', async () => {
    const fetch = vi.fn<ReadOnlyFetch>(never)
    const provider = createSameOriginReadOnlyProvider({ fetch })
    const oldController = new AbortController()
    const old = getError(provider.loadSnapshot(oldController.signal))
    oldController.abort()
    const nextController = new AbortController()
    const next = getError(provider.loadSnapshot(nextController.signal))
    expect((await old).code).toBe('aborted')
    expect((await getError(provider.loadSnapshot())).code).toBe('busy')
    nextController.abort()
    expect((await next).code).toBe('aborted')
  })

  it('cleans up the caller abort listener and deadline on successful completion', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const fetch = fetchValues()
    await createSameOriginReadOnlyProvider({ fetch }).loadSnapshot(controller.signal)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
    controller.abort()
    expect(fetch.mock.calls.every(([, init]) => !init.signal?.aborted)).toBe(true)
  })

  it('requires explicit transport and validates bounded timeout configuration', () => {
    expect(() => createSameOriginReadOnlyProvider({ fetch: undefined as unknown as ReadOnlyFetch })).toThrow(TypeError)
    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 10_001]) {
      expect(() => createSameOriginReadOnlyProvider({ fetch: fetchValues(), timeoutMs })).toThrow(RangeError)
    }
  })
})
