import { AI_JOB_ACTION_LIMITS, AiJobActionError, decodeAiJobActionResponse, validateAiJobActionSubmission } from '../domain/ai-job-actions'
import type { AiJobAction, AiJobActionCode, AiJobActionOutcome, AiJobActionsProvider } from '../domain/ai-job-actions'
export type AiJobActionsPath = `/api/icons/${string}/${AiJobAction}`
export type AiJobActionsFetch = (input: AiJobActionsPath, init: RequestInit) => Promise<Response>
type Track = <T>(promise: Promise<T>) => Promise<T>
const fail = (code: AiJobActionCode, outcome: AiJobActionOutcome = 'unknown', status?: number) => new AiJobActionError(code, outcome, status)
function discard(response: Response, track: Track) { try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ } }
function abortable<T>(pending: Promise<T>, signal: AbortSignal, error: () => AiJobActionError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(error()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, cause => { signal.removeEventListener('abort', abort); reject(cause) })
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, signal: AbortSignal, error: () => AiJobActionError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > AI_JOB_ACTION_LIMITS.maxResponseBytes) { discard(response, track); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(track(reader.read()), signal, error)
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > AI_JOB_ACTION_LIMITS.maxResponseBytes || ++chunks > AI_JOB_ACTION_LIMITS.maxChunks) throw fail('response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape') }
  } catch (cause) { if (cause instanceof AiJobActionError) throw cause; throw fail('invalid-shape') }
  finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* Lease remains held for unresolved reads. */ } }
    try { reader.releaseLock() } catch { /* A non-cooperative reader must not free the transport lease. */ }
  }
}
// Only failures proven to occur before dispatch/persistence are classified as rejected.
// ICON_SCHEMA_INVALID / ICON_OUTCOME_UNCONFIRMED and image-write faults can follow effects and remain UNKNOWN.
function serverFailure(raw: unknown, status: number, operation: AiJobAction): AiJobActionError {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('unconfirmed', 'unknown', status)
  const data = raw as Record<string, unknown>
  if (Reflect.ownKeys(data).length !== 3 || !Object.hasOwn(data, 'code') || !Object.hasOwn(data, 'error') || !Object.hasOwn(data, 'retryable')
    || typeof data.code !== 'string' || data.error !== data.code || data.retryable !== false) return fail('unconfirmed', 'unknown', status)
  if(status===400&&data.code==='IMAGE_TRANSPARENCY_REQUIRED')return fail('image-transparency-required','rejected',status)
  if(status===400&&data.code==='IMAGE_CONTENT_EMPTY')return fail('image-content-empty','rejected',status)
  if(status===409&&operation==='import-variant'&&data.code==='ART_REVIEW_SOURCE_UNCONFIRMED')return fail('art-review-unconfirmed','rejected',status)
  if (status === 409 && ['STALE_JOB', 'TASK_STATE_BLOCKED'].includes(data.code)) return fail('stale', 'conflict', status)
  if (status === 400 && data.code === 'INVALID_INPUT' || status === 404 && data.code === 'PROJECT_NOT_FOUND'
    || status === 429 && data.code === 'ICON_WORKER_BUSY' || status === 503 && ['ICON_ADAPTER_DISABLED', 'ICON_CONFIG_INVALID'].includes(data.code)
    || status === 409 && data.code === 'GENERATION_DISABLED') return fail('rejected', 'rejected', status)
  return fail('unconfirmed', 'unknown', status)
}
/** Fixed same-origin cookie transport; no global fetch, credentials discovery, background retry or lifecycle start. */
export function createAiJobActionsProvider(options: { fetch: AiJobActionsFetch; timeoutMs?: number }): AiJobActionsProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('原任务操作需要显式注入同源 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? AI_JOB_ACTION_LIMITS.timeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > AI_JOB_ACTION_LIMITS.timeoutMs) throw new RangeError('原任务操作超时必须为 1 至 20000 毫秒。')
  let inFlight = false, idle = Promise.resolve()
  return Object.freeze({
    label: 'Companion 原图标任务显式操作（v150 同源合同）', waitForIdle: () => idle,
    async execute(projectId, submission, signal) {
      if (signal?.aborted) throw fail('aborted', 'not-sent')
      if (inFlight) throw fail('busy', 'not-sent')
      const frozen = validateAiJobActionSubmission(projectId, submission), body = JSON.stringify(frozen.input)
      if (new TextEncoder().encode(body).byteLength > AI_JOB_ACTION_LIMITS.maxRequestBytes) throw fail('invalid-input', 'not-sent')
      inFlight = true
      let resolveIdle!: () => void
      idle = new Promise<void>(resolve => { resolveIdle = resolve })
      const controller = new AbortController()
      let invoked = false, processingDone = false, activeOperations = 0, timedOut = false, released = false
      const release = () => { if (!released && processingDone && activeOperations === 0) { released = true; inFlight = false; resolveIdle() } }
      const track: Track = promise => { activeOperations++; void promise.then(() => { activeOperations--; release() }, () => { activeOperations--; release() }); return promise }
      const cancel = () => controller.abort(), error = () => fail(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted', invoked ? 'unknown' : 'not-sent')
      signal?.addEventListener('abort', cancel, { once: true })
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      try {
        const pending = track(Promise.resolve().then(() => {
          if (controller.signal.aborted) throw error()
          invoked = true
          return transport(`/api/icons/${projectId}/${frozen.operation}`, { method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body, signal: controller.signal })
        }).then(response => { if (controller.signal.aborted) discard(response, track); return response }))
        const response = await abortable(pending, controller.signal, error)
        if (controller.signal.aborted) { discard(response, track); throw error() }
        if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect') { discard(response, track); throw fail('invalid-shape') }
        if (response.status === 401 || response.status === 403) { discard(response, track); throw fail(response.status === 401 ? 'unauthorized' : 'forbidden', 'rejected', response.status) }
        if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discard(response, track); throw fail('invalid-shape') }
        const raw = await boundedJson(response, controller.signal, error, track)
        if (controller.signal.aborted) throw error()
        if (!response.ok) throw serverFailure(raw, response.status, frozen.operation)
        if (response.status !== 200) throw fail('invalid-shape')
        return decodeAiJobActionResponse(raw, projectId, frozen)
      } catch (cause) {
        if (controller.signal.aborted) throw error()
        if (cause instanceof AiJobActionError) throw cause
        throw fail('network-error', invoked ? 'unknown' : 'not-sent')
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release() }
    },
  } satisfies AiJobActionsProvider)
}
