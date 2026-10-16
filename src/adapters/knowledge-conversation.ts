import type { KnowledgeConversationBackendCode, KnowledgeConversationCode, KnowledgeConversationOutcome, KnowledgeConversationProvider } from '../domain/knowledge-conversation'
import { KNOWLEDGE_CONVERSATION_LIMITS, KnowledgeConversationError, decodeKnowledgeConversationReply, normalizeKnowledgeConversationRequest } from '../domain/knowledge-conversation'
export { KNOWLEDGE_CONVERSATION_LIMITS, KnowledgeConversationError } from '../domain/knowledge-conversation'
export type { KnowledgeConversationBackendCode, KnowledgeConversationCode, KnowledgeConversationOutcome } from '../domain/knowledge-conversation'
export type KnowledgeConversationPath = '/api/knowledge/chat'
export type KnowledgeConversationFetch = (input: KnowledgeConversationPath, init: RequestInit) => Promise<Response>
const fail = (code: KnowledgeConversationCode, outcome: KnowledgeConversationOutcome = 'unknown', backendCode?: KnowledgeConversationBackendCode, status?: number) => new KnowledgeConversationError(code, outcome, backendCode, status)
type Track = <T>(pending: Promise<T>) => Promise<T>
function discardBody(response: Response, track: Track): void {
  try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ }
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal, abortError: () => KnowledgeConversationError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, signal: AbortSignal, abortError: () => KnowledgeConversationError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > KNOWLEDGE_CONVERSATION_LIMITS.maxResponseBytes) { discardBody(response, track); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(track(reader.read()), signal, abortError)
      if (next.done) break
      // Response streams may belong to another realm (for example browser/host test bridges).
      if (!ArrayBuffer.isView(next.value) || Object.prototype.toString.call(next.value) !== '[object Uint8Array]') throw fail('invalid-shape')
      bytes += next.value.byteLength
      if (bytes > KNOWLEDGE_CONVERSATION_LIMITS.maxResponseBytes || ++chunks > KNOWLEDGE_CONVERSATION_LIMITS.maxResponseChunks) throw fail('response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape') }
  } catch (error) {
    // A transport/reader may reject with any Error instance; never reuse its message or claimed outcome.
    if (signal.aborted) throw abortError()
    throw fail(error instanceof KnowledgeConversationError && error.code === 'response-too-large' ? 'response-too-large' : 'invalid-shape')
  }
  finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* Outstanding reads retain the lease. */ } }
    try { reader.releaseLock() } catch { /* Abort-unaware reads must settle before the lease is released. */ }
  }
}
const backendCodes: readonly KnowledgeConversationBackendCode[] = ['CLI_UNAVAILABLE', 'CLI_INCOMPATIBLE', 'AUTH_MISSING', 'AUTH_DENIED', 'CHAT_UNAVAILABLE', 'UPSTREAM_UNAVAILABLE', 'TIMEOUT', 'CANCELLED', 'SCHEMA_INVALID', 'OUTPUT_LIMIT', 'BUSY']
/** Only source-proven pre-chat responses establish rejection; status alone never proves non-dispatch. */
function serverFailure(value: unknown, status: number): KnowledgeConversationError {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('unconfirmed', 'unknown', undefined, status)
  const raw = value as Record<string, unknown>, keys = Object.keys(raw)
  // http-server forbidden() precedes handleKnowledge and is distinct from CHAT_UNAVAILABLE/403.
  if (status === 403 && keys.length === 1 && raw.error === 'Forbidden') return fail('forbidden', 'rejected', undefined, status)
  const backendCode = typeof raw.code === 'string' && backendCodes.includes(raw.code as KnowledgeConversationBackendCode) ? raw.code as KnowledgeConversationBackendCode : undefined
  if (backendCode === 'CHAT_UNAVAILABLE') return fail('chat-unavailable', 'unknown', backendCode, status)
  const exact = keys.length === 2 && keys.includes('code') && keys.includes('error')
  // AUTH_MISSING is ready() before chat; SCHEMA_INVALID/400 is route/body/request validation.
  // All CLI failures, unexpected envelopes and other statuses remain unknown, including AUTH_DENIED.
  if (exact && backendCode === 'AUTH_MISSING' && status === 401 && raw.error === '知识库只读身份尚未在本机配置') return fail('unauthorized', 'rejected', backendCode, status)
  if (exact && backendCode === 'SCHEMA_INVALID' && status === 400 && raw.error === '知识库请求或结果格式不符合约定') return fail('rejected', 'rejected', backendCode, status)
  if (exact && backendCode === 'BUSY' && status === 429 && raw.error === '知识库操作正在进行，请稍后再试') return fail('rejected', 'rejected', backendCode, status)
  return fail('unconfirmed', 'unknown', backendCode, status)
}
/** Explicit-action only. No global fetch, token, arbitrary URL, retry, polling, service start or other operations. */
export function createKnowledgeConversationProvider(options: { fetch: KnowledgeConversationFetch; timeoutMs?: number }): KnowledgeConversationProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('知识库问答适配器需要显式注入同源 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? KNOWLEDGE_CONVERSATION_LIMITS.defaultTimeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > KNOWLEDGE_CONVERSATION_LIMITS.maxTimeoutMs) throw new RangeError('知识库问答超时必须为 1 至 75000 毫秒。')
  let inFlight: object | undefined, idle = Promise.resolve()
  return Object.freeze({
    label: 'Companion 同源知识库问答接口（v148 契约）',
    waitForIdle: () => idle,
    async chat(input, signal) {
      if (signal?.aborted) throw fail('aborted', 'not-dispatched')
      if (inFlight) throw fail('busy', 'not-dispatched')
      const body = JSON.stringify(normalizeKnowledgeConversationRequest(input)), identity = {}
      inFlight = identity
      let resolveIdle!: () => void
      idle = new Promise<void>(resolve => { resolveIdle = resolve })
      const controller = new AbortController()
      let invoked = false, processingDone = false, activeOperations = 0, timedOut = false, released = false
      const release = () => {
        if (!released && processingDone && activeOperations === 0) {
          released = true
          if (inFlight === identity) inFlight = undefined
          resolveIdle()
        }
      }
      const track: Track = pending => {
        activeOperations++
        void pending.then(() => { activeOperations--; release() }, () => { activeOperations--; release() })
        return pending
      }
      const cancel = () => controller.abort()
      signal?.addEventListener('abort', cancel, { once: true })
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      const abortError = () => fail(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted', invoked ? 'unknown' : 'not-dispatched')
      try {
        if (signal?.aborted) controller.abort()
        const pending = track(Promise.resolve().then(() => {
          if (controller.signal.aborted) throw abortError()
          invoked = true
          try {
            return Promise.resolve(transport('/api/knowledge/chat', {
              method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body, signal: controller.signal,
            })).catch(() => { throw fail('network-error') })
          } catch { throw fail('network-error') }
        }).then(response => { if (controller.signal.aborted) discardBody(response, track); return response }))
        const response = await abortable(pending, controller.signal, abortError)
        if (controller.signal.aborted) { discardBody(response, track); throw abortError() }
        if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect') { discardBody(response, track); throw fail('invalid-shape') }
        if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discardBody(response, track); throw fail('invalid-shape') }
        const raw = await boundedJson(response, controller.signal, abortError, track)
        if (controller.signal.aborted) throw abortError()
        if (!response.ok) throw serverFailure(raw, response.status)
        if (response.status !== 200) throw fail('invalid-shape')
        return decodeKnowledgeConversationReply(raw)
      } catch (error) {
        if (controller.signal.aborted) throw abortError()
        if (error instanceof KnowledgeConversationError) throw error
        throw fail('network-error', invoked ? 'unknown' : 'not-dispatched')
      } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release()
        // Logical rejection cannot release until fetch, pending reads and cancellation actually settle.
      }
    },
  } satisfies KnowledgeConversationProvider)
}
