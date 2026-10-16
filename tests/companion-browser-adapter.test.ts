import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompanionBrowserError, COMPANION_READ_LIMITS, createCompanionBrowserProvider } from '../src/adapters/companion-browser'
import type { CompanionFetch, CompanionReadCode, CompanionReadPath } from '../src/adapters/companion-browser'
import { filterLogs, mergeCalls, RUNTIME_STATES, runtimeStateLabel } from '../src/domain/companion-browser'
import type { CallPage, CallRecord, LogFilter, LogRecord } from '../src/domain/companion-browser'

const stamp = '2026-10-12T10:00:00.000Z'
const project = { id: 'p1', name: '星际工程', path: 'C:\\Games\\星际工程', requiredCreatorVersion: '3.8.8' }
const status = { projectId: 'p1', state: 'ready', creatorVersion: '3.8.8', capabilityProfile: 'authoring' }
const dashboard = { name: '星际工程', path: project.path, version: '3.8.8', lastOpenedAt: 1_760_000_000, source: 'dashboard', exists: true, progress: 'open', state: 'normal', running: true, pid: 123 }
const log: LogRecord = { id: 'log-1', projectId: 'p1', source: 'bridge', level: 'info', time: stamp, message: '场景已读取' }
const call: CallRecord = { id: 'call-1', sequence: 3, projectId: 'p1', operation: 'scene_get_tree', operationNameZh: '读取场景树', source: 'mcp', startedAt: stamp, status: 'success', durationMs: 30, inputSummary: '{}', resultSummary: '{"count":3}' }
const page: CallPage = { sessionId: 'session-1', total: 3, retained: 3, records: [call], nextBefore: 3 }
const latest = { id: call.id, operationNameZh: call.operationNameZh, startedAt: stamp, status: call.status, durationMs: 30 }
const counts = { sessionId: 'session-1', counts: { p1: 3 }, latest: { p1: latest } }
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } })
function fixture(overrides: Partial<Record<'projects' | 'status' | 'dashboard' | 'logs' | 'counts' | 'calls', unknown>> = {}) {
  const values = { projects: [project], status: [status], dashboard: [dashboard], logs: [log], counts, calls: page, ...overrides }
  return vi.fn<CompanionFetch>(async (path) => {
    const key = path === '/api/projects' ? 'projects' : path === '/api/status' ? 'status' : path === '/api/dashboard/projects' ? 'dashboard' : path === '/api/calls/counts' ? 'counts' : path.startsWith('/api/logs?') ? 'logs' : 'calls'
    return values[key] instanceof Response ? values[key] as Response : json(values[key])
  })
}
async function expectCode(pending: Promise<unknown>, code: CompanionReadCode) {
  const error = await pending.then(() => { throw new Error('Expected rejection') }, (error: unknown) => error)
  expect(error).toBeInstanceOf(CompanionBrowserError)
  expect(error).toMatchObject({ code })
  return error as CompanionBrowserError
}
afterEach(() => { vi.useRealTimers() })

describe('v148 fixed same-origin read contract', () => {
  it('is passive and exposes only manually invoked reads, with GET and same-origin session credentials', async () => {
    const fetch = fixture()
    const provider = createCompanionBrowserProvider({ fetch })
    expect(fetch).not.toHaveBeenCalled()
    expect(Object.keys(provider).sort()).toEqual(['dashboardDiscoveryEnabled', 'label', 'loadCalls', 'loadCounts', 'loadDashboardProjects', 'loadLogs', 'loadProjects', 'runtimeProbesEnabled'])
    expect(Object.isFrozen(provider)).toBe(true)
    await provider.loadProjects()
    await provider.loadLogs({})
    await provider.loadCounts()
    await provider.loadCalls('p1', { failed: false })
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/projects', '/api/status', '/api/dashboard/projects', '/api/logs?limit=200', '/api/calls/counts', '/api/projects/p1/calls?limit=50'])
    for (const [, init] of fetch.mock.calls) {
      expect(init).toMatchObject({ method: 'GET', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' } })
      expect(init.signal).toBeInstanceOf(AbortSignal)
      expect(init.body).toBeUndefined()
      expect(new Headers(init.headers).get('authorization')).toBeNull()
    }
  })
  it('projects only verified managed fields and preserves Dashboard timestamp units', async () => {
    const fetch = fixture({ projects: [{ ...project, connectionPath: '/private/connection.json', creatorExecutable: 'secret-exe', token: 'secret-token', styleApproval: 'approved' }], status: [{ ...status, launchSource: 'dashboard', dashboardVersion: '2.1.0', dashboardProgress: 'open', instanceId: 'instance-1', sessionId: 'session-1', pid: 234, preview: { url: 'https://private' }, token: 'secret-token' }], dashboard: [{ ...dashboard, connectionPath: '/private' }] })
    const result = await createCompanionBrowserProvider({ fetch }).loadProjects()
    expect(result.projects).toEqual([project])
    expect(result.statuses).toEqual([{ ...status, launchSource: 'dashboard', dashboardVersion: '2.1.0', dashboardProgress: 'open', instanceId: 'instance-1', sessionId: 'session-1', pid: 234 }])
    expect(result.dashboard).toEqual([dashboard])
    expect(result.warnings).toEqual([])
    expect(JSON.stringify(result)).not.toMatch(/secret|private|connectionPath|styleApproval|preview/)
  })
  it.each(RUNTIME_STATES)('preserves %s without converting it into ready', async (state) => {
    const result = await createCompanionBrowserProvider({ fetch: fixture({ status: [{ ...status, state }] }) }).loadProjects()
    expect(result.statuses[0]!.state).toBe(state)
    expect(runtimeStateLabel(state)).not.toBe('未知')
  })
  it.each([undefined, 'future-state', null, 42])('uses unknown for unrecognized or absent runtime state %s', async (state) => {
    const result = await createCompanionBrowserProvider({ fetch: fixture({ status: [{ projectId: 'p1', state, capabilityProfile: 'administrator' }] }) }).loadProjects()
    expect(result.statuses[0]).toEqual({ projectId: 'p1', state: 'unknown', capabilityProfile: 'unknown' })
    expect(runtimeStateLabel('unknown')).toBe('未知')
  })
  it('reports missing and orphan statuses without synthesizing registered projects', async () => {
    const result = await createCompanionBrowserProvider({ fetch: fixture({ status: [{ projectId: 'other', state: 'ready' }] }) }).loadProjects()
    expect(result.projects).toEqual([project])
    expect(result.statuses[0]!.projectId).toBe('other')
    expect(result.warnings).toHaveLength(2)
  })
  it('accepts confirmed zero projects and statuses', async () => {
    const result = await createCompanionBrowserProvider({ fetch: fixture({ projects: [], status: [], dashboard: [] }) }).loadProjects()
    expect(result).toEqual({ projects: [], statuses: [], dashboard: [], warnings: [] })
  })
  it('fails the whole project read if registration failed, rather than returning false zeros', async () => {
    const fetch = fixture({ projects: new Response('token=SECRET', { status: 503 }) })
    const error = await expectCode(createCompanionBrowserProvider({ fetch }).loadProjects(), 'http-error')
    expect(error.endpoint).toBe('projects')
    expect(String(error)).not.toContain('SECRET')
  })
  it('marks a failed Dashboard read explicitly while keeping confirmed project/status reads', async () => {
    const result = await createCompanionBrowserProvider({ fetch: fixture({ dashboard: new Response('password=SECRET', { status: 403 }) }) }).loadProjects()
    expect(result.projects).toEqual([project])
    expect(result.statuses).toEqual([status])
    expect(result.dashboard).toEqual([])
    expect(result.warnings.join(' ')).toContain('[forbidden]')
    expect(result.warnings.join(' ')).toContain('不能证明没有')
    expect(JSON.stringify(result)).not.toContain('SECRET')
  })
  it.each([
    { projects: { projects: [project] } }, { projects: [{ ...project, path: null }] }, { projects: [project, project] },
    { projects: [{ ...project, id: '../../secrets' }] }, { projects: [{ ...project, name: 'x'.repeat(257) }] },
  ])('rejects malformed mandatory project data %#', async (overrides) => {
    await expectCode(createCompanionBrowserProvider({ fetch: fixture(overrides) }).loadProjects(), 'invalid-shape')
  })
  it.each([
    new Response('token=SECRET', { status: 503 }), [status, status], [{ ...status, pid: -1 }], [{ ...status, creatorVersion: {} }],
  ].map((value) => ({ value })))('keeps confirmed registrations but marks failed or malformed status reads unknown %#', async ({ value }) => {
    const result = await createCompanionBrowserProvider({ fetch: fixture({ status: value }) }).loadProjects()
    expect(result.projects).toEqual([project])
    expect(result.statuses).toEqual([])
    expect(result.dashboard).toEqual([dashboard])
    expect(result.warnings.join(' ')).toContain('状态未取得有效数据')
    expect(result.warnings.join(' ')).toContain('不能证明服务为 0 或工程已停止')
    expect(JSON.stringify(result)).not.toContain('SECRET')
  })
  it('redacts common credential forms from displayed backend status errors', async () => {
    const lastError = 'Cannot connect token=secret-one password="secret two" Bearer secret-three https://bob:secret-four@host.test\ncookie: sid=secret-five'
    const result = await createCompanionBrowserProvider({ fetch: fixture({ status: [{ ...status, lastError }] }) }).loadProjects()
    expect(result.statuses[0]!.lastError).toContain('Cannot connect')
    expect(result.statuses[0]!.lastError).toContain('[redacted]')
    expect(result.statuses[0]!.lastError).not.toContain('secret')
  })
})

describe('v148 bounded logs and filter semantics', () => {
  it('sends repeated query values with OR semantics, deduplicates, and encodes literal text', async () => {
    const fetch = fixture()
    const filter = { projectIds: ['p1', 'p2', 'p1'], sources: ['bridge', 'compile'] as const, levels: ['warning', 'error'] as const, search: 'error & token? 中文', limit: 1000 }
    await createCompanionBrowserProvider({ fetch }).loadLogs(filter)
    const path = fetch.mock.calls[0]![0]
    expect(path.startsWith('/api/logs?')).toBe(true)
    const query = new URL(path, 'http://localhost').searchParams
    expect(query.getAll('projectId')).toEqual(['p1', 'p2'])
    expect(query.getAll('source')).toEqual(['bridge', 'compile'])
    expect(query.getAll('level')).toEqual(['warning', 'error'])
    expect(query.get('search')).toBe(filter.search)
    expect(query.get('limit')).toBe('1000')
    expect([...query.keys()]).not.toContain('token')
  })
  it('retains DebugEvent identifiers, excludes arbitrary remote fields, and safely normalizes unknown source/level', async () => {
    const fetch = fixture({ logs: [{ ...log, source: 'future-source<script>', level: 'future-level', instanceId: 'i1', sessionId: 's1', operationId: 'o1', message: 'password=PRIVATE', token: 'PRIVATE' }] })
    const result = await createCompanionBrowserProvider({ fetch }).loadLogs({})
    expect(result).toEqual([{ ...log, source: 'unknown', level: 'unknown', instanceId: 'i1', sessionId: 's1', operationId: 'o1', message: 'password=[redacted]' }])
    expect(JSON.stringify(result)).not.toContain('PRIVATE')
    expect(JSON.stringify(result)).not.toContain('future-source')
  })
  it('filters normalized unknown sources client-side from a bounded broad query', async () => {
    const fetch = fixture({ logs: [log, { ...log, id: 'log-2', source: 'a-new-source' }] })
    const result = await createCompanionBrowserProvider({ fetch }).loadLogs({ sources: ['unknown'] })
    expect(result.map((entry) => entry.id)).toEqual(['log-2'])
    expect(fetch.mock.calls[0]![0]).toBe('/api/logs?limit=200')
  })
  it.each([
    { projectIds: ['../bad'] }, { projectIds: ['p1?token=SECRET'] }, { sources: ['not-supported'] }, { levels: ['fatal'] },
    { search: 'x'.repeat(513) }, { search: 'a\u0000b' }, { limit: 0 }, { limit: 1001 }, { limit: NaN }, { limit: 2.5 },
    { projectIds: Array.from({ length: 201 }, (_, index) => `p${index}`) },
  ])('rejects invalid log query before fetch %#', async (filter) => {
    const fetch = fixture()
    await expectCode(createCompanionBrowserProvider({ fetch }).loadLogs(filter as LogFilter), 'invalid-query')
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([[log, log], [{ ...log, time: 'yesterday' }], [{ ...log, message: 'x'.repeat(8193) }], [{ ...log, id: null }]].map((logs) => ({ logs })))('rejects malformed log data %#', async ({ logs }) => {
    expect(Array.isArray(logs)).toBe(true)
    await expectCode(createCompanionBrowserProvider({ fetch: fixture({ logs }) }).loadLogs({}), 'invalid-shape')
  })
  it('applies OR within facets and AND across facets with case-insensitive literal search', () => {
    const logs: LogRecord[] = [log, { ...log, id: '2', projectId: 'p2', source: 'compile', level: 'error', message: 'BUILD failed' }, { ...log, id: '3', projectId: 'p3', level: 'error', message: 'build failed' }]
    expect(filterLogs(logs, { projectIds: ['p1', 'p2'], sources: ['bridge', 'compile'], levels: ['error'], search: 'bUiLd' }).map((entry) => entry.id)).toEqual(['2'])
    expect(filterLogs(logs, { projectIds: [], sources: [], levels: [], limit: 1 }).map((entry) => entry.id)).toEqual(['3'])
    expect(filterLogs(logs, { limit: 0 })).toEqual([])
    expect(logs).toHaveLength(3)
  })
})

describe('v148 call session/count/retention/page contract', () => {
  it('preserves backend session/count/latest and ignores arbitrary fields', async () => {
    const result = await createCompanionBrowserProvider({ fetch: fixture({ counts: { ...counts, token: 'PRIVATE', latest: { p1: { ...latest, input: 'PRIVATE' } } } }) }).loadCounts()
    expect(result).toEqual(counts)
    expect(Object.getPrototypeOf(result.counts)).toBeNull()
    expect(Object.getPrototypeOf(result.latest)).toBeNull()
    expect(JSON.stringify(result)).not.toContain('PRIVATE')
  })
  it('requests fixed 50-record failed pages and preserves total versus retained versus records', async () => {
    const fetch = fixture({ calls: { ...page, total: 1500, retained: 1000, records: [{ ...call, sequence: 600, status: 'failed', source: 'cli', errorSummary: 'compile failed', rawResult: 'PRIVATE' }], nextBefore: 600 } })
    const result = await createCompanionBrowserProvider({ fetch }).loadCalls('p1', { failed: true, before: 700 })
    expect(fetch.mock.calls[0]![0]).toBe('/api/projects/p1/calls?limit=50&status=failed&before=700')
    expect(result).toMatchObject({ sessionId: 'session-1', total: 1500, retained: 1000, nextBefore: 600 })
    expect(result.records).toHaveLength(1)
    expect(result.records[0]).toMatchObject({ source: 'cli', status: 'failed', errorSummary: 'compile failed' })
    expect(JSON.stringify(result)).not.toContain('PRIVATE')
  })
  it('preserves an explicitly confirmed empty call session', async () => {
    const result = await createCompanionBrowserProvider({ fetch: fixture({ calls: { sessionId: 's2', total: 0, retained: 0, records: [] } }) }).loadCalls('p1', { failed: false })
    expect(result).toEqual({ sessionId: 's2', total: 0, retained: 0, records: [] })
  })
  it.each([
    { ...counts, sessionId: '' }, { ...counts, counts: { p1: -1 } }, { ...counts, counts: { p1: 1.2 } },
    { ...counts, counts: { p1: Number.MAX_SAFE_INTEGER + 1 } }, { ...counts, counts: {}, latest: { p1: latest } },
    { ...counts, latest: { p1: { ...latest, status: 'unknown' } } },
    { ...counts, counts: JSON.parse('{"__proto__":1}') },
  ])('rejects inconsistent or unsafe count envelopes %#', async (value) => {
    await expectCode(createCompanionBrowserProvider({ fetch: fixture({ counts: value }) }).loadCounts(), 'invalid-shape')
  })
  it.each([
    { ...page, retained: 4 }, { ...page, total: 1001, retained: 1001 }, { ...page, records: [{ ...call, projectId: 'other' }] },
    { ...page, records: [call, call] }, { ...page, records: [{ ...call, sequence: 4 }] },
    { ...page, records: [{ ...call, source: 'unknown' }] }, { ...page, records: [{ ...call, durationMs: -1 }] },
    { ...page, records: [{ ...call, status: 'stopped' }] }, { ...page, records: [{ ...call, inputSummary: 'x'.repeat(2001) }] },
    { ...page, records: [{ ...call, sequence: 2 }, { ...call, id: 'c2', sequence: 3 }] },
    { ...page, nextBefore: 2 }, { ...page, nextBefore: 0 }, { ...page, records: [], nextBefore: 3 },
  ])('rejects malformed or cross-project pages %#', async (value) => {
    await expectCode(createCompanionBrowserProvider({ fetch: fixture({ calls: value }) }).loadCalls('p1', { failed: false }), 'invalid-shape')
  })
  it('rejects records violating the requested failed or before filter', async () => {
    await expectCode(createCompanionBrowserProvider({ fetch: fixture() }).loadCalls('p1', { failed: true }), 'invalid-shape')
    await expectCode(createCompanionBrowserProvider({ fetch: fixture() }).loadCalls('p1', { failed: false, before: 3 }), 'invalid-shape')
  })
  it.each(['../p1', 'https://private', 'p1/other', 'p1?token=SECRET', '', 'p'.repeat(129)])('rejects unsafe project ID %s without network access', async (projectId) => {
    const fetch = fixture()
    await expectCode(createCompanionBrowserProvider({ fetch }).loadCalls(projectId, { failed: false }), 'invalid-query')
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid pagination %s without network access', async (before) => {
    const fetch = fixture()
    await expectCode(createCompanionBrowserProvider({ fetch }).loadCalls('p1', { failed: false, before }), 'invalid-query')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('snapshots call query options so later caller mutation cannot reinterpret the response', async () => {
    const options = { failed: false, before: 9 }
    const pending = createCompanionBrowserProvider({ fetch: fixture() }).loadCalls('p1', options)
    options.failed = true
    options.before = 1
    expect(await pending).toEqual(page)
  })
  it('merges newest first, deduplicates, and never lets stale running replace completed calls', () => {
    const finished = { ...call, status: 'failed' as const }
    expect(mergeCalls([finished], [{ ...call, status: 'running' }])).toEqual([finished])
    expect(mergeCalls([{ ...call, status: 'running' }], [finished])).toEqual([finished])
    const records = Array.from({ length: 1100 }, (_, index) => ({ ...call, id: `c${index}`, sequence: index + 1 }))
    const merged = mergeCalls([], records)
    expect(merged).toHaveLength(1000)
    expect(merged[0]!.sequence).toBe(1100)
    expect(merged.at(-1)!.sequence).toBe(101)
  })
})

describe('bounded transport and safe failures', () => {
  it.each([[401, 'unauthorized'], [403, 'forbidden'], [500, 'http-error']] as const)('never reads or echoes HTTP %s error bodies', async (status, code) => {
    const response = new Response('SECRET token=private', { status })
    const read = vi.spyOn(response, 'text')
    const error = await expectCode(createCompanionBrowserProvider({ fetch: vi.fn(async () => response) }).loadCounts(), code)
    expect(read).not.toHaveBeenCalled()
    expect(error.status).toBe(status)
    expect(JSON.stringify(error)).not.toMatch(/SECRET|private/)
    expect(String(error)).not.toMatch(/SECRET|private/)
    expect('cause' in error).toBe(false)
  })
  it('does not echo transport exceptions', async () => {
    const error = await expectCode(createCompanionBrowserProvider({ fetch: async () => { throw new Error('token=PRIVATE at /private/file') } }).loadCounts(), 'network-error')
    expect(String(error)).not.toMatch(/PRIVATE|private/)
  })
  it.each([
    () => new Response(JSON.stringify(counts), { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('{not-json SECRET}', { headers: { 'Content-Type': 'application/json' } }),
    () => new Response(new Uint8Array([0xff]), { headers: { 'Content-Type': 'application/json' } }),
    () => { const response = json(counts); Object.defineProperty(response, 'redirected', { value: true }); return response },
  ])('rejects non-JSON, malformed UTF-8 and redirected success responses %#', async (make) => {
    await expectCode(createCompanionBrowserProvider({ fetch: async () => make() }).loadCounts(), 'invalid-shape')
  })
  it('rejects an oversized declared response before reading it', async () => {
    const response = json(counts, { headers: { 'Content-Length': String(COMPANION_READ_LIMITS.maxResponseBytes + 1) } })
    await expectCode(createCompanionBrowserProvider({ fetch: async () => response }).loadCounts(), 'response-too-large')
    expect(response.bodyUsed).toBe(true)
  })
  it('enforces the actual byte limit without trusting content-length', async () => {
    const response = new Response(' '.repeat(COMPANION_READ_LIMITS.maxResponseBytes + 1), { headers: { 'Content-Type': 'application/json', 'Content-Length': '1' } })
    await expectCode(createCompanionBrowserProvider({ fetch: async () => response }).loadCounts(), 'response-too-large')
  })
  it('bounds response chunk count including empty chunks', async () => {
    let chunks = 0
    const cancelled = vi.fn()
    const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array()); chunks += 1 }, cancel: cancelled })
    await expectCode(createCompanionBrowserProvider({ fetch: async () => new Response(body, { headers: { 'Content-Type': 'application/json' } }) }).loadCounts(), 'response-too-large')
    expect(chunks).toBeLessThanOrEqual(COMPANION_READ_LIMITS.maxResponseChunks + 2)
    expect(cancelled).toHaveBeenCalled()
  })
  it('times out an injected fetch that ignores abort', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn<CompanionFetch>(() => new Promise(() => undefined))
    const pending = expectCode(createCompanionBrowserProvider({ fetch, timeoutMs: 20 }).loadCounts(), 'timeout')
    await vi.advanceTimersByTimeAsync(21)
    await pending
    expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('times out a body read that never completes and cancels the reader', async () => {
    vi.useFakeTimers()
    const cancelled = vi.fn()
    const body = new ReadableStream<Uint8Array>({ cancel: cancelled })
    const pending = expectCode(createCompanionBrowserProvider({ fetch: async () => new Response(body, { headers: { 'Content-Type': 'application/json' } }), timeoutMs: 20 }).loadCounts(), 'timeout')
    await vi.advanceTimersByTimeAsync(21)
    await pending
    expect(cancelled).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('pre-aborted reads make no requests', async () => {
    const fetch = fixture()
    const controller = new AbortController(); controller.abort()
    const provider = createCompanionBrowserProvider({ fetch })
    await expectCode(provider.loadProjects(controller.signal), 'aborted')
    await expectCode(provider.loadLogs({}, controller.signal), 'aborted')
    await expectCode(provider.loadCounts(controller.signal), 'aborted')
    await expectCode(provider.loadCalls('p1', { failed: false }, controller.signal), 'aborted')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('settles explicit cancellation immediately and disposes a late response', async () => {
    let release!: (response: Response) => void
    const fetch = vi.fn<CompanionFetch>(() => new Promise((resolve) => { release = resolve }))
    const controller = new AbortController()
    const pending = expectCode(createCompanionBrowserProvider({ fetch }).loadCounts(controller.signal), 'aborted')
    await Promise.resolve()
    controller.abort()
    await pending
    const response = json(counts)
    const cancel = vi.spyOn(response.body!, 'cancel')
    release(response)
    await Promise.resolve(); await Promise.resolve()
    expect(cancel).toHaveBeenCalled()
  })
  it('rejects the entire project result after explicit cancellation even if some reads succeeded', async () => {
    const fetch = vi.fn<CompanionFetch>((path) => path === '/api/dashboard/projects' ? new Promise(() => undefined) : Promise.resolve(json(path === '/api/projects' ? [project] : [status])))
    const controller = new AbortController()
    const pending = expectCode(createCompanionBrowserProvider({ fetch }).loadProjects(controller.signal), 'aborted')
    await Promise.resolve(); await Promise.resolve()
    controller.abort()
    await pending
  })
  it('bounds concurrent reads but frees the slots synchronously when cancelled for immediate replacement', async () => {
    const fetch = vi.fn<CompanionFetch>(() => new Promise(() => undefined))
    const provider = createCompanionBrowserProvider({ fetch })
    const controller = new AbortController()
    const pending = Array.from({ length: COMPANION_READ_LIMITS.maxConcurrentRequests }, () => expectCode(provider.loadCounts(controller.signal), 'aborted'))
    await expectCode(provider.loadCounts(), 'busy')
    controller.abort()
    const replacement = new AbortController()
    const next = expectCode(provider.loadCounts(replacement.signal), 'aborted')
    replacement.abort()
    await Promise.all([...pending, next])
  })
  it.each([0, -1, NaN, Infinity, 10001])('rejects invalid timeout %s without contacting transport', (timeoutMs) => {
    const fetch = fixture()
    expect(() => createCompanionBrowserProvider({ fetch, timeoutMs })).toThrow(RangeError)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('requires explicit transport injection', () => {
    expect(() => createCompanionBrowserProvider({} as { fetch: CompanionFetch })).toThrow(TypeError)
  })
  it('does not accept caller URL/header/token overrides at runtime', async () => {
    const fetch = fixture()
    const options = { fetch, baseUrl: 'https://evil.test', token: 'PRIVATE', headers: { Authorization: 'Bearer PRIVATE' } }
    await createCompanionBrowserProvider(options).loadCounts()
    expect(fetch.mock.calls[0]![0]).toBe('/api/calls/counts' satisfies CompanionReadPath)
    expect(JSON.stringify(fetch.mock.calls)).not.toMatch(/evil|PRIVATE|Authorization/)
  })
})
