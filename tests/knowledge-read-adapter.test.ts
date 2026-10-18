import { afterEach, describe, expect, it, vi } from 'vitest'
import { createKnowledgeReadProvider, KNOWLEDGE_READ_LIMITS, KnowledgeReadError } from '../src/adapters/knowledge-read'
import type { KnowledgeFetch, KnowledgeReadCode, KnowledgeReadPath } from '../src/adapters/knowledge-read'
import { isKnowledgeRequestId, KNOWLEDGE_SCHEMA } from '../src/domain/knowledge-read'
import type { KnowledgeReadProvider, KnowledgeSearchInput } from '../src/domain/knowledge-read'

const schemaVersion = KNOWLEDGE_SCHEMA
const status = { schemaVersion, cli: { available: true, compatible: true, version: 'source-v0.8.2' }, retrieval: { auth: 'configured', keyword: 'unverified', kbId: 'kb1', endpoint: 'http://127.0.0.1:8081' }, sync: { available: true, writerEnabled: false, schedulerEnabled: false, sources: [] } }
const source = { id: 'repo-main', label: 'main', channel: 'local', targetSha: 'a'.repeat(40), completedSha: 'b'.repeat(40), freshness: 'stale', pending: 1, jobs: [{ id: 'j1', status: 'done', sourceCommit: 'b'.repeat(40) }], error: { code: 'POLICY_DENIED', message: 'private-token', reason: 'prior_batch' } }
const result = { id: 'ch1', title: '标题', content: '中文\n<script>alert(1)</script>', knowledgeId: 'doc1', source: { channel: 'official', repoId: 'repo1', path: 'docs/a.md', commit: 'c'.repeat(40), blobSha: 'd'.repeat(64) } }
const base = { id: 'kb1', name: '测试库', description: '说明', type: 'document', knowledge_count: 2, chunk_count: 3, is_pinned: false, updated_at: '2026-10-12T00:00:00Z' }
const document = { id: 'doc1', title: '文档', file_name: 'a.md', parse_status: 'completed', file_type: 'md', file_size: 3, updated_at: '2026-10-12T00:00:00Z' }
const download = { schemaVersion, docId: 'doc1', fileName: 'a.md', bytes: 3, content: 'abc', isBase64: false, truncated: false }
const chunk = { id: 'ch1', chunk_index: 0, content: '正文', is_enabled: true }
const agent = { id: 'agent1', name: '助手', description: '只展示元数据', is_builtin: true }
const paths: Record<KnowledgeReadPath, unknown> = {
  '/api/knowledge/status': status, '/api/knowledge-service/status': { running: true, frameable: false }, '/api/model-service/status': { running: true },
  '/api/knowledge/search': { schemaVersion, results: [result], count: 1 }, '/api/knowledge/kb/list': { schemaVersion, items: [base] }, '/api/knowledge/kb/view': { schemaVersion, item: { ...base, embedding_model_id: 'embed1' } },
  '/api/knowledge/doc/list': { schemaVersion, items: [document], truncated: true }, '/api/knowledge/doc/view': { schemaVersion, item: { ...document, description: '正文说明' } }, '/api/knowledge/doc/download': download,
  '/api/knowledge/chunk/list': { schemaVersion, items: [chunk], truncated: false }, '/api/knowledge/agent/list': { schemaVersion, items: [agent] },
}
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } })
function fixture(overrides: Partial<Record<KnowledgeReadPath, unknown>> = {}) {
  const values = { ...paths, ...overrides }
  return vi.fn<KnowledgeFetch>(async (path) => values[path] instanceof Response ? values[path] as Response : json(values[path]))
}
async function expectCode(pending: Promise<unknown>, code: KnowledgeReadCode) {
  const error = await pending.then(() => { throw new Error('Expected rejection') }, (error: unknown) => error)
  expect(error).toBeInstanceOf(KnowledgeReadError)
  expect(error).toMatchObject({ code })
  return error as KnowledgeReadError
}
afterEach(() => vi.useRealTimers())

describe('v148 knowledge-only fixed operation surface', () => {
  it('is inert until called and uses exactly three GETs and eight logical-read POSTs', async () => {
    const fetch = fixture(), provider = createKnowledgeReadProvider({ fetch })
    expect(fetch).not.toHaveBeenCalled()
    expect(Object.keys(provider).sort()).toEqual(['label', 'status', 'loadServiceStates', 'search', 'listKnowledgeBases', 'viewKnowledgeBase', 'listDocuments', 'viewDocument', 'downloadDocument', 'listChunks', 'listAgents'].sort())
    expect(Object.isFrozen(provider)).toBe(true)
    await provider.status(); await provider.loadServiceStates(); await provider.search({ query: '  中文 & ?  ', kbId: 'kb1', limit: 10 })
    await provider.listKnowledgeBases(); await provider.viewKnowledgeBase({ kbId: 'kb1' }); await provider.listDocuments({ kbId: 'kb1', keyword: ' cocos ', limit: 20 })
    await provider.viewDocument({ id: 'doc1' }); await provider.downloadDocument({ id: 'doc1' }); await provider.listChunks({ id: 'doc1', limit: 50 }); await provider.listAgents()
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(Object.keys(paths))
    expect(fetch.mock.calls.slice(3).map(([, init]) => JSON.parse(init.body as string))).toEqual([{ query: '中文 & ?', kbId: 'kb1', limit: 10 }, {}, { kbId: 'kb1' }, { kbId: 'kb1', keyword: 'cocos', limit: 20 }, { id: 'doc1' }, { id: 'doc1' }, { id: 'doc1', limit: 50 }, {}])
    for (const [index, [path, init]] of fetch.mock.calls.entries()) {
      expect(path).not.toMatch(/\?|https:|setup|start|stop|chat|ask|sync/)
      expect(init).toMatchObject({ method: index < 3 ? 'GET' : 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store' })
      expect(init.signal).toBeInstanceOf(AbortSignal)
      expect(new Headers(init.headers).get('authorization')).toBeNull()
      expect(new Headers(init.headers).get('cookie')).toBeNull()
      expect(new Headers(init.headers).get('content-type')).toBe(index < 3 ? null : 'application/json')
      if (index < 3) expect(init.body).toBeUndefined()
    }
  })
  it('keeps source registration, retrieval verification and service reachability independent', async () => {
    const fetch = fixture({ '/api/knowledge/status': { ...status, sync: { ...status.sync, sources: [source], error: { code: 'POLICY_DENIED', reason: 'prior_batch', message: 'password=PRIVATE' } } }, '/api/knowledge-service/status': { running: true, frameable: false, error: 'PRIVATE' }, '/api/model-service/status': { running: false, models: [{ running: true }], token: 'PRIVATE' } })
    const provider = createKnowledgeReadProvider({ fetch }), result = await provider.status(), services = await provider.loadServiceStates()
    expect(result.retrieval).toMatchObject({ auth: 'configured', keyword: 'unverified' })
    expect(result.sync.sources[0]).toMatchObject({ freshness: 'stale', jobs: [{ status: 'done' }] })
    expect(result.sync.error?.code).toBe('POLICY_DENIED')
    expect(services).toEqual({ knowledge: { running: true, frameable: false }, model: { running: false }, warnings: [] })
    expect(JSON.stringify([result, services])).not.toMatch(/PRIVATE|private-token|models/)
    expect(fetch.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })
  it('reports partial failed service reads as unknown, never as stopped or verified', async () => {
    const provider = createKnowledgeReadProvider({ fetch: fixture({ '/api/model-service/status': new Response('password=PRIVATE', { status: 403 }) }) })
    const services = await provider.loadServiceStates()
    expect(services.knowledge?.running).toBe(true)
    expect(services.model).toBeUndefined()
    expect(services.warnings).toHaveLength(1)
    expect(services.warnings[0]).toContain('[forbidden]')
    expect(JSON.stringify(services)).not.toContain('PRIVATE')
  })
  it('strictly projects all response rows and discards nested opaque diagnostics/configuration', async () => {
    const fetch = fixture({
      '/api/knowledge/search': { schemaVersion, results: [{ ...result, token: 'PRIVATE', source: { ...result.source, metadata: 'PRIVATE' } }], count: 1, raw: 'PRIVATE' },
      '/api/knowledge/kb/list': { schemaVersion, items: [{ ...base, embedding_model_id: 'detail-only', model_config: { key: 'PRIVATE' } }] },
      '/api/knowledge/doc/list': { schemaVersion, items: [{ ...document, description: 'detail-only', raw: 'PRIVATE' }], truncated: true },
      '/api/knowledge/chunk/list': { schemaVersion, items: [{ ...chunk, vector: ['PRIVATE'] }], truncated: false },
      '/api/knowledge/agent/list': { schemaVersion, items: [{ ...agent, instructions: 'PRIVATE', credentials: 'PRIVATE' }] },
    })
    const provider = createKnowledgeReadProvider({ fetch })
    expect(await provider.search({ query: 'q' })).toEqual({ results: [result], count: 1 })
    expect(await provider.listKnowledgeBases()).toEqual({ items: [base] })
    expect(await provider.viewKnowledgeBase({ kbId: 'kb1' })).toEqual({ item: { ...base, embedding_model_id: 'embed1' } })
    expect(await provider.listDocuments({})).toEqual({ items: [document], truncated: true })
    expect(await provider.viewDocument({ id: 'doc1' })).toEqual({ item: { ...document, description: '正文说明' } })
    expect(await provider.listChunks({ id: 'doc1' })).toEqual({ items: [chunk], truncated: false })
    expect(await provider.listAgents()).toEqual({ items: [agent] })
  })
  it.each([
    { ...status, schemaVersion: 'v2' }, { ...status, cli: { available: false, compatible: true } },
    { ...status, retrieval: { ...status.retrieval, keyword: 'verified' } }, { ...status, retrieval: { ...status.retrieval, endpoint: 'https://elsewhere?token=PRIVATE' } },
    { ...status, sync: { ...status.sync, sources: [source, source] } }, { ...status, sync: { ...status.sync, sources: [{ ...source, targetSha: 'short' }] } },
    { ...status, sync: { ...status.sync, sources: [{ ...source, pending: -1 }] } }, { ...status, sync: { ...status.sync, sources: [{ ...source, jobs: [{ id: 'j1', status: 'succeeded-unverified' }] }] } },
  ])('rejects malformed or contradictory status %#', async (value) => {
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/status': value }) }).status(), 'invalid-shape')
  })
  it.each([
    { schemaVersion, results: [result], count: 2 }, { schemaVersion, results: [result, result], count: 2 },
    { schemaVersion, results: [{ ...result, content: 'x'.repeat(4001) }], count: 1 },
    { schemaVersion, results: [{ ...result, source: { path: '../secret' } }], count: 1 },
    { schemaVersion, results: [{ ...result, source: { path: 'C:\\secret' } }], count: 1 },
    { schemaVersion, results: [{ ...result, source: { commit: 'fake' } }], count: 1 },
  ])('rejects unsafe search results %#', async (value) => {
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/search': value }) }).search({ query: 'q' }), 'invalid-shape')
  })
  it.each([
    ['/api/knowledge/kb/list', { schemaVersion, items: [{ ...base, knowledge_count: '3' }] }, (p: KnowledgeReadProvider) => p.listKnowledgeBases()],
    ['/api/knowledge/kb/view', { schemaVersion, item: { ...base, id: 'other' } }, (p: KnowledgeReadProvider) => p.viewKnowledgeBase({ kbId: 'kb1' })],
    ['/api/knowledge/doc/list', { schemaVersion, items: [document], truncated: 'yes' }, (p: KnowledgeReadProvider) => p.listDocuments({})],
    ['/api/knowledge/doc/view', { schemaVersion, item: { ...document, id: 'other' } }, (p: KnowledgeReadProvider) => p.viewDocument({ id: 'doc1' })],
    ['/api/knowledge/chunk/list', { schemaVersion, items: [{ ...chunk, chunk_index: -1 }], truncated: false }, (p: KnowledgeReadProvider) => p.listChunks({ id: 'doc1' })],
    ['/api/knowledge/agent/list', { schemaVersion, items: [{ ...agent, is_builtin: 1 }] }, (p: KnowledgeReadProvider) => p.listAgents()],
  ] as const)('rejects malformed %s projection', async (path, response, call) => {
    await expectCode(call(createKnowledgeReadProvider({ fetch: fixture({ [path]: response }) })), 'invalid-shape')
  })
})

describe('knowledge inputs and original-content preview', () => {
  it.each([
    { query: '' }, { query: '  ' }, { query: 'x'.repeat(513) }, { query: '-option' }, { query: 'q\u0000r' }, { query: 'q\nr' },
    { query: 'q', kbId: '../x' }, { query: 'q', kbId: 'x'.repeat(81) }, { query: 'q', limit: 0 }, { query: 'q', limit: 1001 },
    { query: 'q', limit: NaN }, { query: 'q', limit: 2.5 }, { query: 'q', sessionId: 's1' }, { query: 'q', token: 'SECRET' },
  ])('rejects invalid or additional input before dispatch %#', async (input) => {
    const fetch = fixture()
    await expectCode(createKnowledgeReadProvider({ fetch }).search(input as KnowledgeSearchInput), 'invalid-query')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('validates every request separately and permits backend safe identifier punctuation', async () => {
    const fetch = fixture(), p = createKnowledgeReadProvider({ fetch })
    expect(isKnowledgeRequestId('doc:name_1.2-a')).toBe(true)
    expect(isKnowledgeRequestId('a/b')).toBe(false)
    await expectCode(p.viewKnowledgeBase({ kbId: 'bad/id' }), 'invalid-query')
    await expectCode(p.listDocuments({ keyword: '-bad' }), 'invalid-query')
    await expectCode(p.listDocuments({ limit: 101 }), 'invalid-query')
    await expectCode(p.viewDocument({ id: '' }), 'invalid-query')
    await expectCode(p.downloadDocument({ id: 'doc?token' }), 'invalid-query')
    await expectCode(p.listChunks({ id: 'doc1', limit: 1001 }), 'invalid-query')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('returns the complete bounded original preview without creating a download URL or saving data', async () => {
    const fetch = fixture(), provider = createKnowledgeReadProvider({ fetch })
    expect(await provider.downloadDocument({ id: 'doc1' })).toEqual({ docId: 'doc1', fileName: 'a.md', bytes: 3, content: 'abc', isBase64: false, truncated: false })
    expect(fetch).toHaveBeenCalledTimes(1)
    const binary = await createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/doc/download': { ...download, isBase64: true, content: 'AAEC' } }) }).downloadDocument({ id: 'doc1' })
    expect(binary.content).toBe('AAEC')
    const replaced = await createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/doc/download': { ...download, bytes: 1, content: '\ufffd' } }) }).downloadDocument({ id: 'doc1' })
    expect(replaced.bytes).toBe(1)
  })
  it.each([
    { ...download, docId: 'other' }, { ...download, fileName: '../private.txt' }, { ...download, bytes: -1 }, { ...download, bytes: 1048577 },
    { ...download, content: 'too long' }, { ...download, truncated: true }, { ...download, isBase64: true, content: '***' },
    { ...download, isBase64: true, content: 'YQ==' }, { ...download, truncated: undefined },
  ])('rejects mismatched or malformed original previews %#', async (value) => {
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/doc/download': value }) }).downloadDocument({ id: 'doc1' }), 'invalid-shape')
  })
  it('enforces caller-selected list/search bounds and preserves true empty results', async () => {
    const response = { schemaVersion, results: [result, { ...result, id: 'ch2' }], count: 2 }
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/search': response }) }).search({ query: 'q', limit: 1 }), 'invalid-shape')
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/doc/list': { schemaVersion, items: [document, { ...document, id: 'doc2' }], truncated: false } }) }).listDocuments({ limit: 1 }), 'invalid-shape')
    const p = createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/search': { schemaVersion, results: [], count: 0 }, '/api/knowledge/kb/list': { schemaVersion, items: [] } }) })
    expect(await p.search({ query: 'q' })).toEqual({ results: [], count: 0 })
    expect(await p.listKnowledgeBases()).toEqual({ items: [] })
  })
})

describe('knowledge transport budgets, errors and cancellation', () => {
  it.each([401, 403, 429, 500, 503])('returns static safe HTTP %s failures without raw diagnostics', async (status) => {
    const fetch = fixture({ '/api/knowledge/search': json({ code: status === 401 ? 'AUTH_MISSING' : 'UPSTREAM_UNAVAILABLE', error: 'PRIVATE', detail: { token: 'PRIVATE' } }, { status }) })
    const error = await expectCode(createKnowledgeReadProvider({ fetch }).search({ query: 'PRIVATE query' }), status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : status === 429 ? 'busy' : 'http-error')
    expect(error.backendCode).toBe(status === 401 ? 'AUTH_MISSING' : 'UPSTREAM_UNAVAILABLE')
    expect(String(error) + JSON.stringify(error)).not.toContain('PRIVATE')
  })
  it('does not reflect unknown error codes or transport exceptions', async () => {
    const p = createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/status': json({ code: 'SECRET_CODE', error: 'secret' }, { status: 502 }) }) })
    const error = await expectCode(p.status(), 'http-error')
    expect(error.backendCode).toBeUndefined()
    const network = await expectCode(createKnowledgeReadProvider({ fetch: async () => { throw new Error('token=PRIVATE') } }).status(), 'network-error')
    expect(String(network)).not.toContain('PRIVATE')
  })
  it.each([
    new Response('not json', { headers: { 'Content-Type': 'text/html' } }), json({ schemaVersion: 'wrong' }),
    new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    new Response(new Uint8Array([0xff, 0xfe]), { headers: { 'Content-Type': 'application/json' } }),
  ])('rejects non-JSON/invalid/UTF-8 responses %#', async (response) => {
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/status': response }) }).status(), 'invalid-shape')
  })
  it('rejects redirects even when an injected transport follows them', async () => {
    const response = json(status); Object.defineProperty(response, 'redirected', { value: true })
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/status': response }) }).status(), 'invalid-shape')
  })
  it('caps both announced and streamed bytes at 2 MiB and cancels rejected bodies', async () => {
    const cancel = vi.fn(), stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(KNOWLEDGE_READ_LIMITS.maxResponseBytes + 1)) }, cancel })
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/status': new Response(stream, { headers: { 'Content-Type': 'application/json' } }) }) }).status(), 'response-too-large')
    expect(cancel).toHaveBeenCalledTimes(1)
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/status': json(status, { headers: { 'content-length': String(KNOWLEDGE_READ_LIMITS.maxResponseBytes + 1) } }) }) }).status(), 'response-too-large')
  })
  it('accepts a maximum bounded 1 MiB binary preview within the 2 MiB envelope budget', async () => {
    const bytes = KNOWLEDGE_READ_LIMITS.maxDownloadBytes, content = 'AAAA'.repeat(Math.floor(bytes / 3)) + 'AA=='
    const preview = await createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/doc/download': { ...download, bytes, content, isBase64: true, truncated: true } }) }).downloadDocument({ id: 'doc1' })
    expect(preview.bytes).toBe(bytes)
    expect(preview.truncated).toBe(true)
  })
  it('caps zero-byte streaming chunks so endless empty chunks cannot bypass the budget', async () => {
    let sent = 0
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { if (++sent <= KNOWLEDGE_READ_LIMITS.maxResponseChunks + 1) controller.enqueue(new Uint8Array()); else controller.close() } })
    await expectCode(createKnowledgeReadProvider({ fetch: fixture({ '/api/knowledge/status': new Response(stream, { headers: { 'Content-Type': 'application/json' } }) }) }).status(), 'response-too-large')
  })
  it('rejects a pre-cancelled request without touching the transport', async () => {
    const controller = new AbortController(); controller.abort()
    const fetch = fixture()
    await expectCode(createKnowledgeReadProvider({ fetch }).search({ query: 'q' }, controller.signal), 'aborted')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('single-flights status/POST operations while allowing the two independent service reads', async () => {
    let finish!: (value: Response) => void
    const fetch = vi.fn<KnowledgeFetch>((path) => path === '/api/knowledge/search' ? new Promise(resolve => { finish = resolve }) : Promise.resolve(json(paths[path])))
    const p = createKnowledgeReadProvider({ fetch }), search = p.search({ query: 'q' })
    await expectCode(p.listKnowledgeBases(), 'busy')
    await expectCode(p.status(), 'busy')
    expect((await p.loadServiceStates()).model?.running).toBe(true)
    finish(json(paths['/api/knowledge/search'])); await search
    expect(await p.listKnowledgeBases()).toEqual({ items: [base] })
    expect(fetch.mock.calls.filter(([path]) => path === '/api/knowledge/search')).toHaveLength(1)
  })
  it('settles cancellation even if fetch ignores its signal and discards the late response', async () => {
    let finish!: (value: Response) => void
    const fetch = vi.fn<KnowledgeFetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockImplementation(async () => json(paths['/api/knowledge/search']))
    const p = createKnowledgeReadProvider({ fetch }), controller = new AbortController(), pending = p.search({ query: 'old' }, controller.signal)
    const rejected = expectCode(pending, 'aborted')
    await Promise.resolve(); controller.abort(); await rejected
    expect(await p.search({ query: 'new' })).toEqual({ results: [result], count: 1 })
    const cancel = vi.fn(), late = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } })
    finish(late); await Promise.resolve(); await Promise.resolve()
    expect(cancel).toHaveBeenCalledTimes(1)
  })
  it('cancels a stalled body and keeps the aborted result out of the caller', async () => {
    const cancel = vi.fn(), controller = new AbortController(), stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{')) }, cancel })
    const p = createKnowledgeReadProvider({ fetch: async () => new Response(stream, { headers: { 'Content-Type': 'application/json' } }) }), pending = p.status(controller.signal)
    const rejected = expectCode(pending, 'aborted')
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); controller.abort(); await rejected
    expect(cancel).toHaveBeenCalledTimes(1)
  })
  it('uses 30-second reads and 45-second original-preview deadlines without auto-retries', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn<KnowledgeFetch>(() => new Promise(() => undefined)), p = createKnowledgeReadProvider({ fetch })
    const read = expectCode(p.status(), 'timeout')
    await vi.advanceTimersByTimeAsync(29_999); expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1); await read
    const download = expectCode(p.downloadDocument({ id: 'doc1' }), 'timeout')
    await vi.advanceTimersByTimeAsync(44_999); expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1); await download
    expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('times out bodies as well as headers and validates timeout configuration', async () => {
    vi.useFakeTimers()
    const cancel = vi.fn(), p = createKnowledgeReadProvider({ fetch: async () => new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }), timeoutMs: 50 })
    const pending = expectCode(p.status(), 'timeout')
    await vi.advanceTimersByTimeAsync(50); await pending; expect(cancel).toHaveBeenCalledTimes(1)
    for (const timeoutMs of [0, -1, Infinity, NaN, 45_001]) expect(() => createKnowledgeReadProvider({ fetch: fixture(), timeoutMs })).toThrow(RangeError)
  })
})

describe('original sync source writer gate projection',()=>{
 it.each([true,false])('retains explicit writer flags %s without processing credentials',async flag=>{const fetch=fixture({'/api/knowledge/status':{...status,sync:{...status.sync,sources:[{...source,approved:flag,enabled:flag,writerReady:flag,apiKey:'private'}]}}});const value=await createKnowledgeReadProvider({fetch}).status();expect(value.sync.sources[0]).toMatchObject({approved:flag,enabled:flag,writerReady:flag});expect(JSON.stringify(value)).not.toContain('private')})
 it.each(['approved','enabled','writerReady'])('rejects non-boolean source gate %s',async key=>{const fetch=fixture({'/api/knowledge/status':{...status,sync:{...status.sync,sources:[{...source,[key]:'true'}]}}});await expect(createKnowledgeReadProvider({fetch}).status()).rejects.toMatchObject({code:'invalid-shape'})})
})
