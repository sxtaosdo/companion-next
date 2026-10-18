import type { KnowledgeSyncBackendCode, KnowledgeSyncCode, KnowledgeSyncOutcome, KnowledgeSyncProvider } from '../domain/knowledge-sync'
import { KNOWLEDGE_SYNC_LIMITS, KnowledgeSyncError, decodeKnowledgeSyncReply, normalizeKnowledgeSyncRequest, knowledgeSyncReason } from '../domain/knowledge-sync'
export { KNOWLEDGE_SYNC_LIMITS, KnowledgeSyncError } from '../domain/knowledge-sync'
export type { KnowledgeSyncBackendCode, KnowledgeSyncCode, KnowledgeSyncOutcome } from '../domain/knowledge-sync'
export type KnowledgeSyncPath = '/api/knowledge/sync/dry-run' | '/api/knowledge/sync/run'
export type KnowledgeSyncFetch = (input: KnowledgeSyncPath, init: RequestInit) => Promise<Response>
const fail = (code: KnowledgeSyncCode, outcome: KnowledgeSyncOutcome = 'unknown', backendCode?: KnowledgeSyncBackendCode, status?: number) => new KnowledgeSyncError(code, outcome, backendCode, status)
type Track = <T>(pending: Promise<T>) => Promise<T>
function discardBody(response: Response, track: Track): void {
  try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ }
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal, abortError: () => KnowledgeSyncError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, signal: AbortSignal, abortError: () => KnowledgeSyncError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > KNOWLEDGE_SYNC_LIMITS.maxResponseBytes) { discardBody(response, track); throw fail('response-too-large') }
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
      if (bytes > KNOWLEDGE_SYNC_LIMITS.maxResponseBytes || ++chunks > KNOWLEDGE_SYNC_LIMITS.maxResponseChunks) throw fail('response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape') }
  } catch (error) {
    // A transport/reader may reject with any Error instance; never reuse its message or claimed outcome.
    if (signal.aborted) throw abortError()
    throw fail(error instanceof KnowledgeSyncError && error.code === 'response-too-large' ? 'response-too-large' : 'invalid-shape')
  }
  finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* Outstanding reads retain the lease. */ } }
    try { reader.releaseLock() } catch { /* Abort-unaware reads must settle before the lease is released. */ }
  }
}
const backendCodes:readonly KnowledgeSyncBackendCode[]=['POLICY_DENIED','WRITER_DISABLED','SOURCE_NOT_APPROVED','AUTH_DENIED','AUTH_MISSING','BUSY','SCHEMA_INVALID','SYNC_OUTCOME_UNKNOWN','UPSTREAM_UNAVAILABLE','TIMEOUT','CANCELLED','OUTPUT_LIMIT']
/** Old sync() only preserves these explicit policy/auth/busy denials; other sent failures stay unknown. */
function serverFailure(value:unknown,status:number):KnowledgeSyncError {
  if(!value||typeof value!=='object'||Array.isArray(value))return fail('unconfirmed','unknown',undefined,status)
  const raw=value as Record<string,unknown>
  if(status===403&&Object.keys(raw).length===1&&raw.error==='Forbidden')return fail('forbidden','rejected',undefined,status)
  const code=typeof raw.code==='string'&&backendCodes.includes(raw.code as KnowledgeSyncBackendCode)?raw.code as KnowledgeSyncBackendCode:undefined
  const rejected=code!==undefined&&['POLICY_DENIED','WRITER_DISABLED','SOURCE_NOT_APPROVED','AUTH_DENIED','AUTH_MISSING','BUSY'].includes(code)
  return new KnowledgeSyncError(rejected?'rejected':'unconfirmed',rejected?'rejected':'unknown',code,status,knowledgeSyncReason(raw.reason))
}
/** Explicit-action only. No global fetch, token, arbitrary URL, retry, polling, service start or other operations. */
export function createKnowledgeSyncProvider(options: { fetch: KnowledgeSyncFetch; timeoutMs?: number }): KnowledgeSyncProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('知识同步适配器需要显式注入同源 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? KNOWLEDGE_SYNC_LIMITS.defaultTimeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > KNOWLEDGE_SYNC_LIMITS.maxTimeoutMs) throw new RangeError('知识同步超时必须为 1 至 75000 毫秒。')
  let inFlight: object | undefined, idle = Promise.resolve()
  return Object.freeze({
    label: 'Companion 同源知识同步接口（v148 契约）',
    waitForIdle: () => idle,
    async sync(operation, input, signal) {
      if (signal?.aborted) throw fail('aborted', 'not-dispatched')
      if (inFlight) throw fail('busy', 'not-dispatched')
      if (operation !== 'dry-run' && operation !== 'run') throw fail('invalid-input', 'not-dispatched')
      const frozen = normalizeKnowledgeSyncRequest(input), body = JSON.stringify(frozen), identity = {}
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
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, options.timeoutMs ?? (operation === 'run' ? 75_000 : 45_000))
      const abortError = () => fail(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted', invoked ? 'unknown' : 'not-dispatched')
      try {
        if (signal?.aborted) controller.abort()
        const pending = track(Promise.resolve().then(() => {
          if (controller.signal.aborted) throw abortError()
          invoked = true
          try {
            return Promise.resolve(transport(operation === 'run' ? '/api/knowledge/sync/run' : '/api/knowledge/sync/dry-run', {
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
        return decodeKnowledgeSyncReply(raw, operation, frozen)
      } catch (error) {
        if (controller.signal.aborted) throw abortError()
        if (error instanceof KnowledgeSyncError) throw error
        throw fail('network-error', invoked ? 'unknown' : 'not-dispatched')
      } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release()
        // Logical rejection cannot release until fetch, pending reads and cancellation actually settle.
      }
    },
  } satisfies KnowledgeSyncProvider)
}
