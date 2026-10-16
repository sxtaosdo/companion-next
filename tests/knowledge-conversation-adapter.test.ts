import { afterEach, describe, expect, it, vi } from 'vitest'
import { createKnowledgeConversationProvider, KNOWLEDGE_CONVERSATION_LIMITS, KnowledgeConversationError } from '../src/adapters/knowledge-conversation'
import type { KnowledgeConversationFetch } from '../src/adapters/knowledge-conversation'
import { decodeKnowledgeConversationReply, normalizeKnowledgeConversationRequest } from '../src/domain/knowledge-conversation'
import type { KnowledgeConversationCode, KnowledgeConversationOutcome, KnowledgeConversationReply, KnowledgeConversationRequest } from '../src/domain/knowledge-conversation'

const reply = (): KnowledgeConversationReply => ({ schemaVersion: 'companion-knowledge-v1', answer: '本地 fake 回答', sessionId: 'session-1', references: [{ kbId: 'kb-1', chunkId: 'chunk-1' }] })
const input = (): KnowledgeConversationRequest => ({ query: '如何加载场景？', kbId: 'kb-1' })
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } })
const fixture = (value: unknown = reply()) => vi.fn<KnowledgeConversationFetch>(async () => value instanceof Response ? value : json(value))
const flush = async () => { for (let n = 0; n < 16; n++) await Promise.resolve() }
async function errorFrom(pending: Promise<unknown>, code: KnowledgeConversationCode, outcome: KnowledgeConversationOutcome) {
  const error = await pending.then(() => { throw Error('Expected failure') }, (error: unknown) => error)
  expect(error).toBeInstanceOf(KnowledgeConversationError)
  expect(error).toMatchObject({ code, outcome })
  expect(`${error}${JSON.stringify(error)}`).not.toContain('PRIVATE')
  expect(error).not.toHaveProperty('cause')
  return error as KnowledgeConversationError
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('strict v148 chat request and reply projections', () => {
  it('constructs passively and sends only the fixed chat POST with same-origin cookies', async () => {
    const fetch = fixture(), provider = createKnowledgeConversationProvider({ fetch })
    await expect(provider.waitForIdle()).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled(); expect(Object.isFrozen(provider)).toBe(true)
    expect(Object.keys(provider).sort()).toEqual(['chat', 'label', 'waitForIdle'])
    expect(await provider.chat({ query: '  场景如何加载？  ', kbId: 'kb-1', sessionId: 'old-session' })).toEqual(reply())
    expect(fetch).toHaveBeenCalledOnce()
    const [path, init] = fetch.mock.calls[0]!
    expect(path).toBe('/api/knowledge/chat')
    expect(init).toMatchObject({ method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
    expect(JSON.parse(init.body as string)).toEqual({ query: '场景如何加载？', kbId: 'kb-1', sessionId: 'old-session' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(init.headers).get('authorization')).toBeNull(); expect(new Headers(init.headers).get('cookie')).toBeNull()
  })
  it('requires injection, never touches global fetch, and rejects timeout widening', () => {
    const globalFetch = vi.fn(); vi.stubGlobal('fetch', globalFetch)
    expect(() => createKnowledgeConversationProvider(undefined as never)).toThrow(TypeError)
    expect(() => createKnowledgeConversationProvider({} as never)).toThrow(TypeError)
    for (const timeoutMs of [0, -1, NaN, Infinity, 75_001]) expect(() => createKnowledgeConversationProvider({ fetch: fixture(), timeoutMs })).toThrow(RangeError)
    createKnowledgeConversationProvider({ fetch: fixture(), timeoutMs: 75_000 }); expect(globalFetch).not.toHaveBeenCalled()
  })
  it.each(['', '  ', '-flag', ' -flag ', 'x'.repeat(513), 'a\nb', 'a\rb', 'a\tb', 'a\0b', 'a\u007fb', null, 1])('rejects invalid query %# without transport', async query => {
    const fetch = fixture(), provider = createKnowledgeConversationProvider({ fetch })
    await errorFrom(provider.chat({ query } as KnowledgeConversationRequest), 'invalid-input', 'not-dispatched')
    expect(fetch).not.toHaveBeenCalled(); await expect(provider.waitForIdle()).resolves.toBeUndefined()
  })
  it.each(['', '-x', '../secret', '/x', 'http://PRIVATE', 'x'.repeat(81), '含中文', null, 1])('rejects unsafe request IDs %#', async id => {
    for (const key of ['kbId', 'sessionId']) {
      const fetch = fixture(); await errorFrom(createKnowledgeConversationProvider({ fetch }).chat({ ...input(), [key]: id }), 'invalid-input', 'not-dispatched')
      expect(fetch).not.toHaveBeenCalled()
    }
  })
  it('rejects unknown, inherited, symbol and accessor request properties without evaluating accessors', async () => {
    const get = vi.fn(() => 'PRIVATE'), accessor = Object.defineProperty({}, 'query', { get }), fetch = fixture(), provider = createKnowledgeConversationProvider({ fetch })
    for (const bad of [null, [], {}, Object.create(input()), { ...input(), token: 'PRIVATE' }, { ...input(), [Symbol('PRIVATE')]: true }, accessor]) {
      await errorFrom(provider.chat(bad as KnowledgeConversationRequest), 'invalid-input', 'not-dispatched')
    }
    expect(get).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('accepts inclusive original input ceilings, optional omission and immutable snapshots', async () => {
    const value = { query: '界'.repeat(512), kbId: 'a'.repeat(80), sessionId: 'B'.repeat(80) }, fetch = fixture()
    const provider = createKnowledgeConversationProvider({ fetch }), pending = provider.chat(value)
    value.query = 'PRIVATE'; value.kbId = 'PRIVATE'; await pending
    const body = JSON.parse(fetch.mock.calls[0]![1].body as string)
    expect(body).toEqual({ query: '界'.repeat(512), kbId: 'a'.repeat(80), sessionId: 'B'.repeat(80) })
    expect(new TextEncoder().encode(fetch.mock.calls[0]![1].body as string).length).toBeLessThanOrEqual(4096)
    expect(normalizeKnowledgeConversationRequest(Object.freeze({ query: '\n ok \t', kbId: undefined }))).toEqual({ query: 'ok' })
    expect(decodeKnowledgeConversationReply(Object.freeze(reply()))).toEqual(reply())
  })
  it('preserves HTML, markdown, URL strings, duplicate and empty references only as plain data', async () => {
    const answer = '<img src=x onerror=alert(1)>\n[click](javascript:alert(1))', references = [{}, { kbId: '', chunkId: '' }, { kbId: '<script>1</script>', chunkId: 'https://example.invalid/PRIVATE' }, { kbId: 'same' }, { kbId: 'same' }]
    const extra = { ...reply(), answer, references: references.map(ref => ({ ...ref, url: 'javascript:alert(1)', trustedHTML: '<b>PRIVATE</b>', action: 'delete' })), diagnostics: 'PRIVATE', nextUrl: 'https://example.invalid' }
    const result = await createKnowledgeConversationProvider({ fetch: fixture(extra) }).chat(input())
    expect(result).toEqual({ schemaVersion: 'companion-knowledge-v1', answer, sessionId: 'session-1', references })
    expect(Object.keys(result)).toEqual(['schemaVersion', 'answer', 'sessionId', 'references'])
    expect(result.references[0]).not.toHaveProperty('trustedHTML')
  })
  it('projects only known response fields without evaluating unknown accessors', () => {
    const get = vi.fn(() => { throw Error('PRIVATE') }), value = Object.defineProperty(reply(), 'secret', { get })
    expect(decodeKnowledgeConversationReply(value)).toEqual(reply()); expect(get).not.toHaveBeenCalled()
    expect(() => decodeKnowledgeConversationReply(Object.defineProperty(reply(), 'answer', { get }))).toThrow(KnowledgeConversationError)
    expect(get).not.toHaveBeenCalled()
  })
  it('accepts empty answer, max answer, max references and max text lengths', () => {
    expect(decodeKnowledgeConversationReply({ ...reply(), answer: '', references: [] }).answer).toBe('')
    const value = { ...reply(), answer: 'a'.repeat(12_000), references: Array.from({ length: 20 }, () => ({ kbId: 'x'.repeat(80), chunkId: 'y'.repeat(80) })) }
    expect(decodeKnowledgeConversationReply(value)).toEqual(value)
  })
  it.each([
    { schemaVersion: 'other' }, { answer: 'a'.repeat(12_001) }, { answer: 1 }, { sessionId: '' }, { sessionId: '../PRIVATE' }, { sessionId: 's'.repeat(81) },
    { references: null }, { references: Array.from({ length: 21 }, () => ({})) }, { references: [null] }, { references: [[]] }, { references: [{ kbId: 1 }] },
    { references: [{ chunkId: 'a'.repeat(81) }] }, { references: Array(1) },
  ])('rejects malformed success %# with unknown outcome', async override => {
    await errorFrom(createKnowledgeConversationProvider({ fetch: fixture({ ...reply(), ...override }) }).chat(input()), 'invalid-shape', 'unknown')
  })
  it('requires own success fields and independent projection copies', () => {
    expect(() => decodeKnowledgeConversationReply(Object.create(reply()))).toThrow(KnowledgeConversationError)
    const value = reply(), result = decodeKnowledgeConversationReply(value); value.references[0]!.kbId = 'PRIVATE'
    expect(result.references[0]!.kbId).toBe('kb-1')
  })
})

describe('source-proven rejections and conservative unknown outcomes', () => {
  it.each([
    [403, { error: 'Forbidden' }, 'forbidden', undefined],
    [401, { code: 'AUTH_MISSING', error: '知识库只读身份尚未在本机配置' }, 'unauthorized', 'AUTH_MISSING'],
    [400, { code: 'SCHEMA_INVALID', error: '知识库请求或结果格式不符合约定' }, 'rejected', 'SCHEMA_INVALID'],
    [429, { code: 'BUSY', error: '知识库操作正在进行，请稍后再试' }, 'rejected', 'BUSY'],
  ] as const)('classifies only the verified %s rejection %#', async (status, body, code, backendCode) => {
    const error = await errorFrom(createKnowledgeConversationProvider({ fetch: fixture(json(body, { status })) }).chat(input()), code, 'rejected')
    expect(error.status).toBe(status); expect(error.backendCode).toBe(backendCode)
  })
  it.each([403, 502, 503])('keeps CHAT_UNAVAILABLE/%s separate from global retrieval auth denial', async status => {
    const fetch = fixture(json({ code: 'CHAT_UNAVAILABLE', error: 'PRIVATE credentials' }, { status }))
    const error = await errorFrom(createKnowledgeConversationProvider({ fetch }).chat(input()), 'chat-unavailable', 'unknown')
    expect(error.backendCode).toBe('CHAT_UNAVAILABLE'); expect(error.message).toContain('不据此判定检索权限'); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([
    ['CLI_UNAVAILABLE', 503], ['CLI_INCOMPATIBLE', 503], ['AUTH_DENIED', 403], ['TIMEOUT', 504], ['CANCELLED', 499],
    ['SCHEMA_INVALID', 502], ['OUTPUT_LIMIT', 502], ['UPSTREAM_UNAVAILABLE', 503], ['BUSY', 502], ['AUTH_MISSING', 502],
  ] as const)('keeps CLI/post-dispatch %s/%s unknown without reflecting diagnostics', async (code, status) => {
    const error = await errorFrom(createKnowledgeConversationProvider({ fetch: fixture(json({ code, error: 'PRIVATE query or token' }, { status })) }).chat(input()), 'unconfirmed', 'unknown')
    expect(error.backendCode).toBe(code); expect(error.status).toBe(status)
  })
  it.each([
    [401, { error: 'PRIVATE' }], [403, { error: 'Forbidden', extra: 'PRIVATE' }], [403, { code: 'AUTH_DENIED' }],
    [400, { code: 'SCHEMA_INVALID', error: 'PRIVATE' }], [401, { code: 'AUTH_MISSING', error: '知识库只读身份尚未在本机配置', extra: 'PRIVATE' }],
    [500, { code: 'PRIVATE_FUTURE_CODE', error: 'PRIVATE' }], [500, null],
  ] as const)('never infers non-dispatch from status or incomplete error envelope %#', async (status, body) => {
    await errorFrom(createKnowledgeConversationProvider({ fetch: fixture(json(body, { status })) }).chat(input()), 'unconfirmed', 'unknown')
  })
  it.each([201, 202, 206])('accepts only HTTP200 success, not %s', async status => {
    await errorFrom(createKnowledgeConversationProvider({ fetch: fixture(json(reply(), { status })) }).chat(input()), 'invalid-shape', 'unknown')
  })
  it('does not accept backend error codes with success HTTP200', async () => {
    await errorFrom(createKnowledgeConversationProvider({ fetch: fixture({ code: 'CHAT_UNAVAILABLE', error: 'PRIVATE' }) }).chat(input()), 'invalid-shape', 'unknown')
  })
  it.each(['redirected', 'opaque', 'opaqueredirect', 'html', 'missing-body', 'malformed'])('rejects %s response and never retries', async mode => {
    let response = json(reply())
    if (mode === 'redirected') Object.defineProperty(response, 'redirected', { value: true })
    if (mode === 'opaque' || mode === 'opaqueredirect') Object.defineProperty(response, 'type', { value: mode })
    if (mode === 'html') response = new Response('PRIVATE', { headers: { 'Content-Type': 'text/html' } })
    if (mode === 'missing-body') response = new Response(null, { headers: { 'Content-Type': 'application/json' } })
    if (mode === 'malformed') response = new Response('PRIVATE', { headers: { 'Content-Type': 'application/json' } })
    const fetch = fixture(response); await errorFrom(createKnowledgeConversationProvider({ fetch }).chat(input()), 'invalid-shape', 'unknown'); expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('bounded JSON, fatal UTF-8 and termination fences', () => {
  it.each(['announced', 'actual'])('rejects %s response bytes over 2 MiB and cancels', async mode => {
    const cancel = vi.fn(), response = new Response(new ReadableStream({ start(controller) { if (mode === 'actual') controller.enqueue(new Uint8Array(KNOWLEDGE_CONVERSATION_LIMITS.maxResponseBytes + 1)) }, cancel }),
      { headers: { 'Content-Type': 'application/json', 'Content-Length': mode === 'announced' ? String(KNOWLEDGE_CONVERSATION_LIMITS.maxResponseBytes + 1) : '2' } })
    await errorFrom(createKnowledgeConversationProvider({ fetch: fixture(response) }).chat(input()), 'response-too-large', 'unknown')
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('accepts exact 2 MiB budget, counting even unknown projected fields', async () => {
    const value = { ...reply(), ignored: '' }, used = new TextEncoder().encode(JSON.stringify(value)).length
    value.ignored = 'a'.repeat(KNOWLEDGE_CONVERSATION_LIMITS.maxResponseBytes - used)
    expect(await createKnowledgeConversationProvider({ fetch: fixture(value) }).chat(input())).toEqual(reply())
  })
  it('rejects too many chunks including empty chunks', async () => {
    const cancel = vi.fn(), response = new Response(new ReadableStream({ start(controller) { for (let n = 0; n <= 4096; n++) controller.enqueue(new Uint8Array()) }, cancel }), { headers: { 'Content-Type': 'application/json' } })
    await errorFrom(createKnowledgeConversationProvider({ fetch: fixture(response) }).chat(input()), 'response-too-large', 'unknown')
    expect(cancel).toHaveBeenCalledOnce()
  })
  it.each([{ bytes: [0xc3, 0x28] }, { bytes: [0xed, 0xa0, 0x80] }, { bytes: [0xc3] }])('rejects malformed or incomplete UTF-8 %#', async ({ bytes }) => {
    const response = new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/json' } })
    await errorFrom(createKnowledgeConversationProvider({ fetch: fixture(response) }).chat(input()), 'invalid-shape', 'unknown')
  })
  it('accepts valid multi-byte UTF-8 split across byte chunks', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(reply())), response = new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close() } }), { headers: { 'Content-Type': 'application/json' } })
    expect(await createKnowledgeConversationProvider({ fetch: fixture(response) }).chat(input())).toEqual(reply())
  })
  it('does not dispatch pre-aborted or synchronously cancelled calls', async () => {
    const fetch = fixture(), provider = createKnowledgeConversationProvider({ fetch }), first = new AbortController(), second = new AbortController()
    first.abort(); await errorFrom(provider.chat(input(), first.signal), 'aborted', 'not-dispatched')
    const pending = provider.chat(input(), second.signal); second.abort()
    await errorFrom(pending, 'aborted', 'not-dispatched'); expect(fetch).not.toHaveBeenCalled()
    await provider.waitForIdle(); expect(await provider.chat(input())).toEqual(reply())
  })
  it('prevents concurrent requests even before the dispatch microtask', async () => {
    const fetch = fixture(), provider = createKnowledgeConversationProvider({ fetch }), pending = provider.chat(input())
    await errorFrom(provider.chat(input()), 'busy', 'not-dispatched'); await pending
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('retains the lease through ignored-abort fetch AND its late body cancellation', async () => {
    let finish!: (response: Response) => void, finishCancel!: () => void
    const fetch = vi.fn<KnowledgeConversationFetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockImplementation(async () => json(reply()))
    const provider = createKnowledgeConversationProvider({ fetch }), controller = new AbortController()
    const pending = errorFrom(provider.chat(input(), controller.signal), 'aborted', 'unknown'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await flush(); controller.abort(); await pending
    expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.chat(input()), 'busy', 'not-dispatched')
    const cancel = vi.fn(() => new Promise<void>(resolve => { finishCancel = resolve }))
    finish(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } })); await flush()
    expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.chat(input()), 'busy', 'not-dispatched')
    finishCancel(); await flush(); expect(idle).toHaveBeenCalledOnce()
    await provider.waitForIdle(); expect(await provider.chat(input())).toEqual(reply()); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('bounds default waiting at 75000 ms without unlocking unsettled fetch or retrying', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn<KnowledgeConversationFetch>(() => new Promise(() => undefined)), provider = createKnowledgeConversationProvider({ fetch }), idle = vi.fn()
    const pending = errorFrom(provider.chat(input()), 'timeout', 'unknown'); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(74_999); expect(idle).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1); await pending
    expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(true); expect(idle).not.toHaveBeenCalled()
    await errorFrom(provider.chat(input()), 'busy', 'not-dispatched'); await vi.advanceTimersByTimeAsync(150_000); expect(fetch).toHaveBeenCalledOnce()
  })
  it('retains stalled-body cancellation until actual cancellation settles', async () => {
    vi.useFakeTimers(); let finish!: () => void
    const cancel = vi.fn(() => new Promise<void>(resolve => { finish = resolve })), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } })
    const fetch = vi.fn<KnowledgeConversationFetch>().mockResolvedValueOnce(response).mockImplementation(async () => json(reply())), provider = createKnowledgeConversationProvider({ fetch, timeoutMs: 20 })
    const pending = errorFrom(provider.chat(input()), 'timeout', 'unknown'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(20); await pending
    expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.chat(input()), 'busy', 'not-dispatched')
    finish(); await flush(); expect(idle).toHaveBeenCalledOnce(); expect(await provider.chat(input())).toEqual(reply())
  })
  it('does not unlock when custom reader cancellation settles but the read ignores it', async () => {
    vi.useFakeTimers(); let finishRead!: (value: ReadableStreamReadResult<Uint8Array>) => void
    const read = vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(resolve => { finishRead = resolve })), cancel = vi.fn(async () => undefined), releaseLock = vi.fn()
    const response = json(reply()); Object.defineProperty(response, 'body', { value: { getReader: () => ({ read, cancel, releaseLock }) } })
    const fetch = vi.fn<KnowledgeConversationFetch>().mockResolvedValueOnce(response).mockImplementation(async () => json(reply())), provider = createKnowledgeConversationProvider({ fetch, timeoutMs: 20 })
    const pending = errorFrom(provider.chat(input()), 'timeout', 'unknown'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(20); await pending
    expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.chat(input()), 'busy', 'not-dispatched')
    finishRead({ done: true, value: undefined }); await flush(); expect(idle).toHaveBeenCalledOnce(); expect(await provider.chat(input())).toEqual(reply())
  })
  it('retains rejected-response discard cancellation before permitting another chat', async () => {
    let finish!: () => void
    const cancel = vi.fn(() => new Promise<void>(resolve => { finish = resolve })), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'text/html' } })
    const fetch = fixture(response), provider = createKnowledgeConversationProvider({ fetch }), pending = errorFrom(provider.chat(input()), 'invalid-shape', 'unknown'), idle = vi.fn()
    void provider.waitForIdle().then(idle); await pending
    expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.chat(input()), 'busy', 'not-dispatched')
    finish(); await flush(); expect(idle).toHaveBeenCalledOnce()
  })
  it('does not let an old signal or finally release the next request lease', async () => {
    let finish!: (response: Response) => void
    const first = new AbortController(), second = new AbortController()
    const fetch = vi.fn<KnowledgeConversationFetch>().mockResolvedValueOnce(json(reply())).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const provider = createKnowledgeConversationProvider({ fetch }); await provider.chat(input(), first.signal); await provider.waitForIdle()
    const pending = provider.chat(input(), second.signal); await flush(); first.abort(); await flush()
    expect(fetch.mock.calls[1]![1].signal!.aborted).toBe(false); await errorFrom(provider.chat(input()), 'busy', 'not-dispatched')
    finish(json(reply())); await pending; await provider.waitForIdle(); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('releases after a settled failure, and only a new explicit call sends again', async () => {
    const fetch = vi.fn<KnowledgeConversationFetch>().mockRejectedValueOnce(Error('PRIVATE')).mockImplementation(async () => json(reply())), provider = createKnowledgeConversationProvider({ fetch })
    await errorFrom(provider.chat(input()), 'network-error', 'unknown'); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledOnce()
    expect(await provider.chat(input())).toEqual(reply()); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each(['throw', 'reject'])('does not trust a transport %s claiming non-dispatch or retaining diagnostics', async mode => {
    const claimed = new KnowledgeConversationError('rejected', 'not-dispatched'); claimed.message = 'PRIVATE'
    const fetch = vi.fn<KnowledgeConversationFetch>(() => { if (mode === 'throw') throw claimed; return Promise.reject(claimed) })
    const provider = createKnowledgeConversationProvider({ fetch })
    await errorFrom(provider.chat(input()), 'network-error', 'unknown'); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledOnce()
  })
  it('does not trust a reader failure claiming rejection or retaining diagnostics', async () => {
    const claimed = new KnowledgeConversationError('rejected', 'rejected'); claimed.message = 'PRIVATE'
    const cancel = vi.fn(async () => undefined), response = json(reply())
    Object.defineProperty(response, 'body', { value: { getReader: () => ({ read: () => Promise.reject(claimed), cancel, releaseLock: vi.fn() }) } })
    const provider = createKnowledgeConversationProvider({ fetch: fixture(response) })
    await errorFrom(provider.chat(input()), 'invalid-shape', 'unknown'); await provider.waitForIdle(); expect(cancel).toHaveBeenCalledOnce()
  })
})
