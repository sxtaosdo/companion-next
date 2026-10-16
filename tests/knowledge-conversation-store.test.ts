import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { KNOWLEDGE_CONVERSATION_STORE_LIMITS, useKnowledgeConversationStore } from '../src/stores/knowledge-conversation'
import type { KnowledgeConversationContext } from '../src/stores/knowledge-conversation'
import { KnowledgeConversationError } from '../src/domain/knowledge-conversation'
import type { KnowledgeConversationProvider, KnowledgeConversationReply } from '../src/domain/knowledge-conversation'
import { useKnowledgeReadStore } from '../src/stores/knowledge-read'
import { knowledgeFixture } from './knowledge-read-fixture'

const reply = (sessionId = 'session-1', answer = '纯文本 <script>never execute</script>'): KnowledgeConversationReply => ({
  schemaVersion: 'companion-knowledge-v1', sessionId, answer, references: [{ kbId: 'kb-1', chunkId: '<a href="https://invalid.test">' }, {}],
})
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function fixture() {
  const provider: KnowledgeConversationProvider = { label: 'OFFLINE CHAT TEST', chat: vi.fn(async () => reply()), waitForIdle: vi.fn(async () => {}) }
  const context: KnowledgeConversationContext = { provider, readIdentity: {}, kbId: 'kb-1', scopeKey: 'workspace:local-a', ready: true }
  const store = useKnowledgeConversationStore(); store.syncContext(context)
  return { store, provider, context }
}
const tick = async () => { for (let index = 0; index < 8; index++) await Promise.resolve() }
async function ask(store: ReturnType<typeof useKnowledgeConversationStore>, query = '问题') { store.query = query; return store.send(store.prepareSend(), true) }
beforeEach(() => setActivePinia(createPinia()))

describe('explicit knowledge conversation preparation and authorization', () => {
  it('is inert and never persists query, answer, or sessions', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem'), set = vi.spyOn(Storage.prototype, 'setItem')
    const store = useKnowledgeConversationStore()
    expect(store.turns).toEqual([]); expect(store.prepared).toBeNull(); expect(store.activeSessionId).toBeNull()
    expect(store.prepareSend()).toBeNull()
    const { provider } = fixture(); expect(provider.chat).not.toHaveBeenCalled(); expect(provider.waitForIdle).not.toHaveBeenCalled()
    await ask(store); store.leave()
    expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled()
  })
  it('freezes an explicit preview without authorizing or dispatching it', async () => {
    const { store, provider } = fixture(); store.query = '  提问  '
    const prepared = store.prepareSend()!
    expect(prepared).toEqual({ query: '提问', kbId: 'kb-1', sessionId: null, providerLabel: provider.label, scopeKey: 'workspace:local-a', revision: store.revision })
    expect(Object.isFrozen(prepared)).toBe(true); expect(store.phase).toBe('prepared')
    expect(await store.send(prepared, false)).toBe(false); expect(provider.chat).not.toHaveBeenCalled()
    expect(await store.send({ ...prepared }, true)).toBe(false); expect(provider.chat).not.toHaveBeenCalled()
    expect(await store.send(prepared, true)).toBe(true); expect(await store.send(prepared, true)).toBe(false)
    expect(provider.chat).toHaveBeenCalledTimes(1)
  })
  it.each(['', '../kb', 'wrong kb', '--kb'])('requires a concrete safe KB, including when no default was read: %s', kbId => {
    const { store, provider, context } = fixture(); store.syncContext({ ...context, kbId }); store.query = 'q'
    expect(store.prepareSend()).toBeNull(); expect(provider.chat).not.toHaveBeenCalled()
  })
  it.each(['', '-unsafe', 'one\ntwo', 'x'.repeat(513)])('validates the full query before preparation: %s', query => {
    const { store, provider } = fixture(); store.query = query
    expect(store.prepareSend()).toBeNull(); expect(provider.chat).not.toHaveBeenCalled()
  })
  it('revokes edited previews, including query A to B to A', async () => {
    const { store, provider } = fixture(); store.query = 'A'; const prepared = store.prepareSend()!
    store.query = 'B'; store.query = 'A'
    expect(store.prepared).toBeNull(); expect(await store.send(prepared, true)).toBe(false); expect(provider.chat).not.toHaveBeenCalled()
  })
  it('retains preparation for identical context but revokes every identity or scope change', async () => {
    for (const change of [{ kbId: 'kb-2' }, { scopeKey: 'new-project-metadata' }, { readIdentity: {} }, { ready: false }, { provider: null }]) {
      setActivePinia(createPinia()); const { store, provider, context } = fixture(); store.query = 'A'; const prepared = store.prepareSend()!
      store.syncContext({ ...context }); expect(store.prepared).toBe(prepared)
      store.syncContext({ ...context, ...change }); store.syncContext(context)
      expect(await store.send(prepared, true)).toBe(false); expect(provider.chat).not.toHaveBeenCalled()
    }
  })
  it('sends exactly the frozen question and explicit KB, never local scope, provider label or fake project binding', async () => {
    const { store, provider } = fixture(); await ask(store, '第一问')
    expect(vi.mocked(provider.chat).mock.calls[0]![0]).toEqual({ query: '第一问', kbId: 'kb-1' })
    expect(Object.isFrozen(vi.mocked(provider.chat).mock.calls[0]![0])).toBe(true)
    expect(store.query).toBe(''); expect(store.activeSessionId).toBe('session-1'); expect(store.turns[0]?.answer).toContain('<script>')
    expect(Object.isFrozen(store.turns)).toBe(true); expect(Object.isFrozen(store.turns[0])).toBe(true); expect(Object.isFrozen(store.turns[0]?.references)).toBe(true)
    expect(store.prepareSend()).toBeNull(); expect(provider.chat).toHaveBeenCalledTimes(1)
    await ask(store, '续问'); expect(vi.mocked(provider.chat).mock.calls[1]![0]).toEqual({ query: '续问', kbId: 'kb-1', sessionId: 'session-1' })
  })
  it('blocks double clicks and preserves a later draft even when changed back to the sent text', async () => {
    const { store, provider } = fixture(), result = deferred<KnowledgeConversationReply>()
    vi.mocked(provider.chat).mockReturnValue(result.promise); store.query = 'A'; const prepared = store.prepareSend()!
    const send = store.send(prepared, true); expect(store.busy).toBe(true); expect(store.transportPending).toBe(true)
    expect(await store.send(prepared, true)).toBe(false)
    store.query = 'B'; store.query = 'A'; expect(store.prepareSend()).toBeNull()
    result.resolve(reply()); await send
    expect(store.query).toBe('A'); expect(store.turns[0]?.query).toBe('A'); expect(provider.chat).toHaveBeenCalledTimes(1)
  })
})

describe('session retention, isolation and settlement fence', () => {
  it('leaving, reconnecting and changing scopes cannot implicitly clear an unknown-send fence', async () => {
    const { store, provider, context } = fixture()
    vi.mocked(provider.chat).mockRejectedValueOnce(new KnowledgeConversationError('timeout', 'unknown'))
    await ask(store, 'same question'); expect(store.requiresNewConversation).toBe(true)
    store.leave(); store.syncContext(context)
    expect(store.requiresNewConversation).toBe(true); expect(store.prepareSend()).toBeNull()
    store.syncContext({ ...context, scopeKey: 'other-project' })
    expect(store.requiresNewConversation).toBe(true); expect(store.prepareSend()).toBeNull()
    expect(store.newConversation(false)).toBe(false)
    expect(store.newConversation(true)).toBe(true); expect(store.prepareSend()).not.toBeNull()
    expect(provider.chat).toHaveBeenCalledTimes(1)
  })
  it.each(['unknown', 'rejected'] as const)('preserves the old session and record after %s and requires an explicit new generation', async outcome => {
    const { store, provider } = fixture(); await ask(store)
    vi.mocked(provider.chat).mockRejectedValueOnce(new KnowledgeConversationError('network-error', outcome))
    expect(await ask(store, '可能失败的续问')).toBe(false)
    expect(store.activeSessionId).toBe('session-1'); expect(store.turns[1]).toMatchObject({ query: '可能失败的续问', requestSessionId: 'session-1', sessionId: null, status: outcome })
    expect(store.requiresNewConversation).toBe(true); expect(store.prepareSend()).toBeNull(); expect(store.newConversation(false)).toBe(false)
    expect(store.activeSessionId).toBe('session-1'); expect(provider.chat).toHaveBeenCalledTimes(2)
    expect(store.newConversation(true)).toBe(true); expect(store.activeSessionId).toBeNull(); expect(store.turns).toHaveLength(2)
    expect(store.turns.every(turn => turn.detached)).toBe(true)
    await ask(store, '明确新会话'); expect(vi.mocked(provider.chat).mock.calls[2]![0]).toEqual({ query: '明确新会话', kbId: 'kb-1' })
  })
  it('permits a known not-dispatched failure to be prepared again, still requiring fresh confirmation', async () => {
    const { store, provider } = fixture(); await ask(store)
    vi.mocked(provider.chat).mockRejectedValueOnce(new KnowledgeConversationError('busy', 'not-dispatched'))
    expect(await ask(store, 'busy')).toBe(false); expect(store.activeSessionId).toBe('session-1'); expect(store.requiresNewConversation).toBe(false)
    const prepared = store.prepareSend(); expect(prepared?.sessionId).toBe('session-1'); expect(await store.send(prepared, false)).toBe(false)
    expect(provider.chat).toHaveBeenCalledTimes(2); expect(await store.send(prepared, true)).toBe(true)
  })
  it('marks cancel unknown immediately but keeps a global fence across new generations and provider replacement', async () => {
    const { store, provider, context } = fixture(), result = deferred<KnowledgeConversationReply>(), idle = deferred<void>()
    vi.mocked(provider.chat).mockReturnValue(result.promise); vi.mocked(provider.waitForIdle).mockReturnValue(idle.promise)
    const send = ask(store, 'old'); expect(store.cancel()).toBe(true)
    expect(store.phase).toBe('unknown'); expect(store.busy).toBe(false); expect(store.transportPending).toBe(true)
    expect(vi.mocked(provider.chat).mock.calls[0]![1]?.aborted).toBe(true)
    store.newConversation(true)
    const other = { ...provider, label: 'other', chat: vi.fn(async () => reply('other')) }
    store.syncContext({ ...context, provider: other }); store.query = 'new'
    expect(store.prepareSend()).toBeNull(); await tick(); expect(provider.waitForIdle).toHaveBeenCalledTimes(1)
    result.resolve(reply('late-session')); await tick()
    expect(store.activeSessionId).toBeNull(); expect(store.turns[0]).toMatchObject({ status: 'unknown', detached: true, sessionId: null })
    expect(store.transportPending).toBe(true); expect(other.chat).not.toHaveBeenCalled()
    idle.resolve(); expect(await send).toBe(false); expect(store.transportPending).toBe(false); expect(store.prepareSend()).not.toBeNull()
  })
  it('keeps timeout and malformed response outcomes unknown, including while the provider is draining', async () => {
    const { store, provider } = fixture(), idle = deferred<void>()
    vi.mocked(provider.chat).mockRejectedValue(new KnowledgeConversationError('timeout', 'unknown')); vi.mocked(provider.waitForIdle).mockReturnValue(idle.promise)
    const send = ask(store); await tick(); expect(store.phase).toBe('unknown'); expect(store.transportPending).toBe(true); expect(store.prepareSend()).toBeNull()
    idle.resolve(); await send; expect(store.requiresNewConversation).toBe(true); expect(store.turns).toHaveLength(1)
  })
  it('fails closed forever when idle settlement rejects, even after source changes or new conversation', async () => {
    const { store, provider, context } = fixture()
    vi.mocked(provider.waitForIdle).mockRejectedValue(new Error('PRIVATE_IDLE_TOKEN'))
    expect(await ask(store)).toBe(true); expect(store.transportPending).toBe(true); expect(store.phase).toBe('succeeded')
    expect(store.turns[0]?.status).toBe('succeeded'); expect(store.error).toContain('无法确认传输')
    expect(store.activeSessionId).toBe('session-1'); expect(store.turns[0]?.answer).toContain('纯文本')
    store.newConversation(true); store.syncContext({ ...context, readIdentity: {} }); store.query = 'again'
    expect(store.prepareSend()).toBeNull(); expect(JSON.stringify(store.$state)).not.toContain('PRIVATE_IDLE_TOKEN')
  })
  it.each(['leave', 'kb', 'scope', 'reader', 'provider'] as const)('never adopts late results after %s and A to B to A', async change => {
    const { store, provider, context } = fixture(), result = deferred<KnowledgeConversationReply>(), idle = deferred<void>()
    vi.mocked(provider.chat).mockReturnValue(result.promise); vi.mocked(provider.waitForIdle).mockReturnValue(idle.promise)
    const send = ask(store, 'original')
    if (change === 'leave') store.leave()
    else store.syncContext({ ...context, ...(change === 'kb' ? { kbId: 'kb-2' } : change === 'scope' ? { scopeKey: 'scope-B' } : change === 'reader' ? { readIdentity: {} } : { provider: { ...provider } }) })
    store.syncContext(context); result.resolve(reply('must-never-adopt')); idle.resolve(); await send
    expect(store.activeSessionId).toBeNull(); expect(store.turns[0]).toMatchObject({ status: 'unknown', detached: true, providerLabel: provider.label, kbId: 'kb-1', scopeKey: context.scopeKey })
    expect(store.turns[0]?.answer).toBeNull()
  })
  it('leaving preserves the current unsent draft while revoking preview and session adoption', async () => {
    const { store } = fixture(); await ask(store); store.query = 'unsent local draft'; const prepared = store.prepareSend()!
    store.leave(); expect(store.query).toBe('unsent local draft'); expect(store.prepared).toBeNull(); expect(store.activeSessionId).toBeNull()
    expect(await store.send(prepared, true)).toBe(false); expect(store.turns[0]?.sessionId).toBe('session-1')
  })
  it('retains completed old-context history without reusing a session on return', async () => {
    const { store, context } = fixture(); await ask(store)
    store.syncContext({ ...context, kbId: 'kb-2' }); store.syncContext(context)
    expect(store.activeSessionId).toBeNull(); expect(store.turns[0]).toMatchObject({ sessionId: 'session-1', detached: true, status: 'succeeded' })
    store.query = 'new'; expect(store.prepareSend()?.sessionId).toBeNull()
  })
  it('does not turn a received success into a cancellation while only transport drainage remains', async () => {
    const { store, provider } = fixture(), idle = deferred<void>()
    vi.mocked(provider.waitForIdle).mockReturnValue(idle.promise)
    const send = ask(store); await tick(); expect(store.phase).toBe('succeeded'); expect(store.transportPending).toBe(true)
    expect(store.cancel()).toBe(false); store.newConversation(true)
    expect(store.turns[0]).toMatchObject({ status: 'succeeded', detached: true, sessionId: 'session-1' })
    idle.resolve(); expect(await send).toBe(true)
  })
  it('revalidates returned shapes and suppresses diagnostic fields and exceptions', async () => {
    const { store, provider } = fixture()
    vi.mocked(provider.chat).mockResolvedValueOnce({ ...reply(), token: 'PRIVATE_TOKEN' } as KnowledgeConversationReply)
    await ask(store); expect(JSON.stringify(store.turns)).not.toContain('PRIVATE_TOKEN')
    vi.mocked(provider.chat).mockResolvedValueOnce({ ...reply(), sessionId: '../unsafe', token: 'PRIVATE_TOKEN' } as KnowledgeConversationReply)
    await ask(store); expect(store.phase).toBe('unknown'); expect(store.activeSessionId).toBe('session-1'); expect(store.turns[1]?.answer).toBeNull()
    expect(JSON.stringify(store.turns)).not.toContain('PRIVATE_TOKEN')
  })
  it('CHAT_UNAVAILABLE cannot mutate retrieval authentication or logical-read results', async () => {
    const reads = useKnowledgeReadStore(); await reads.connect(knowledgeFixture()); await reads.run('bases')
    const priorStatus = reads.status, priorResult = reads.result
    const { store, provider } = fixture(); vi.mocked(provider.chat).mockRejectedValue(new KnowledgeConversationError('chat-unavailable', 'unknown', 'CHAT_UNAVAILABLE'))
    await ask(store); expect(store.turns[0]?.errorCode).toBe('chat-unavailable'); expect(reads.status).toBe(priorStatus); expect(reads.result).toBe(priorResult)
  })
})

describe('bounded in-memory history', () => {
  it('caps all generations at twenty turns and requires explicit local clearing', async () => {
    const { store, provider } = fixture()
    for (let index = 0; index < KNOWLEDGE_CONVERSATION_STORE_LIMITS.maxTurns; index++) { expect(await ask(store, `q${index}`)).toBe(true); store.newConversation(true) }
    store.query = 'blocked'; expect(store.prepareSend()).toBeNull(); expect(provider.chat).toHaveBeenCalledTimes(20); expect(store.error).toContain('容量')
    expect(store.clearCompleted(false)).toBe(false); expect(store.turns).toHaveLength(20)
    expect(store.clearCompleted(true)).toBe(true); expect(store.turns).toHaveLength(0); expect(store.prepareSend()).not.toBeNull()
  })
  it('reserves byte capacity before sending without silently evicting any records', async () => {
    const { store, provider, context } = fixture(); store.syncContext({ ...context, scopeKey: '\u0000'.repeat(KNOWLEDGE_CONVERSATION_STORE_LIMITS.maxScopeLength) })
    vi.mocked(provider.chat).mockResolvedValue(reply('large', '\u0000'.repeat(12_000)))
    let count = 0
    for (; count < 20; count++) { store.query = `q${count}`; const prepared = store.prepareSend(); if (!prepared) break; expect(await store.send(prepared, true)).toBe(true) }
    expect(count).toBeGreaterThan(0); expect(count).toBeLessThan(20); expect(store.turns).toHaveLength(count)
    expect(store.retainedBytes).toBeLessThanOrEqual(KNOWLEDGE_CONVERSATION_STORE_LIMITS.maxBytes); expect(store.error).toContain('容量')
  })
  it('never clears unknown records, and new conversation only detaches them', async () => {
    const { store, provider } = fixture(); await ask(store)
    vi.mocked(provider.chat).mockRejectedValueOnce(new Error('private'))
    await ask(store, 'unknown'); store.newConversation(true)
    expect(store.clearCompleted(true)).toBe(true); expect(store.turns).toHaveLength(1)
    expect(store.turns[0]).toMatchObject({ status: 'unknown', query: 'unknown', requestSessionId: 'session-1', sessionId: null, detached: true })
  })
})
