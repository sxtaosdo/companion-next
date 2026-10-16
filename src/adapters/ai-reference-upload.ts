import type { AiReferenceUploadCode, AiReferenceUploadOutcome, AiReferenceUploadProvider } from '../domain/ai-reference-upload'
import { AI_REFERENCE_UPLOAD_LIMITS, AiReferenceUploadError, decodeAiReferenceUploadReceipt, sha256ReferenceBytes, validateAiReferenceUploadInput } from '../domain/ai-reference-upload'
export { AI_REFERENCE_UPLOAD_LIMITS, AiReferenceUploadError } from '../domain/ai-reference-upload'
export type { AiReferenceUploadCode, AiReferenceUploadOutcome } from '../domain/ai-reference-upload'
export type AiReferenceUploadPath = `/api/icons/${string}/reference-upload`
export type AiReferenceUploadFetch = (input: AiReferenceUploadPath, init: RequestInit) => Promise<Response>
const fail = (code: AiReferenceUploadCode, outcome: AiReferenceUploadOutcome = 'unknown', status?: number) => new AiReferenceUploadError(code, outcome, status)
type Track = <T>(pending: Promise<T>) => Promise<T>
function discardBody(response: Response, track: Track): void {
  try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ }
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal, abortError: () => AiReferenceUploadError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => {
      signal.removeEventListener('abort', abort)
      reject(error instanceof AiReferenceUploadError ? error : fail('network-error'))
    })
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, signal: AbortSignal, abortError: () => AiReferenceUploadError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > AI_REFERENCE_UPLOAD_LIMITS.maxResponseBytes) { discardBody(response, track); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(track(reader.read()), signal, abortError)
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > AI_REFERENCE_UPLOAD_LIMITS.maxResponseBytes || ++chunks > AI_REFERENCE_UPLOAD_LIMITS.maxResponseChunks) throw fail('response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape') }
  } catch (error) { if (error instanceof AiReferenceUploadError) throw error; throw fail('invalid-shape') }
  finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ } }
    try { reader.releaseLock() } catch { /* A transport which ignores cancellation stays single-flight. */ }
  }
}
// Verified in v148 IconImageAssets.uploadReference/process and IconAdapter.executeConfigured, before either persist.
// IMAGE_INPUT_LIMIT is deliberately absent: readSafe can raise it during either persistence operation.
// IMAGE_PATH_UNSAFE, OVERWRITE_FORBIDDEN and IMAGE_WRITE_UNCONFIRMED may occur after the original was written.
const rejectedCodes: Readonly<Record<string, readonly number[]>> = Object.freeze({
  INVALID_INPUT: [400], PROJECT_NOT_FOUND: [404], ICON_ADAPTER_DISABLED: [503], ICON_CONFIG_INVALID: [503],
  IMAGE_INVALID: [400], IMAGE_ANIMATED: [400], IMAGE_DIMENSIONS_INVALID: [400], IMAGE_TYPE_UNSUPPORTED: [400],
  IMAGE_PROCESSING_UNAVAILABLE: [503], IMAGE_RESULT_INVALID: [502], IMAGE_OUTPUT_LIMIT: [400, 409],
})
function serverFailure(raw: unknown, status: number): AiReferenceUploadError {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('unconfirmed', 'unknown', status)
  const value = raw as Record<string, unknown>, keys = Reflect.ownKeys(value)
  if (keys.length !== 3 || keys.some(key => !['error', 'code', 'retryable'].includes(String(key))) || typeof value.code !== 'string'
    || value.error !== value.code || value.retryable !== false) return fail('unconfirmed', 'unknown', status)
  if (Object.hasOwn(rejectedCodes, value.code) && rejectedCodes[value.code].includes(status)) return fail('rejected', 'rejected', status)
  return fail('unconfirmed', 'unknown', status)
}
/** Passive, explicitly approved fixed-path upload. No host discovery, global fetch, retry, polling, preview or config save. */
export function createAiReferenceUploadProvider(options: { fetch: AiReferenceUploadFetch; timeoutMs?: number }): AiReferenceUploadProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('参考图上传适配器需要显式注入 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? AI_REFERENCE_UPLOAD_LIMITS.defaultTimeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > AI_REFERENCE_UPLOAD_LIMITS.maxTimeoutMs) throw new RangeError('参考图上传超时必须为 1 至 20000 毫秒。')
  let inFlight = false, idle = Promise.resolve()
  return Object.freeze({
    label: 'Companion AI 参考图同源上传接口（v148 契约）',
    waitForIdle: () => idle,
    async uploadReference(projectId, input, signal) {
      if (signal?.aborted) throw fail('aborted', 'not-sent')
      if (inFlight) throw fail('busy', 'not-sent')
      const validated = validateAiReferenceUploadInput(input, projectId), body = JSON.stringify(validated.input)
      if (new TextEncoder().encode(body).byteLength > AI_REFERENCE_UPLOAD_LIMITS.maxRequestBytes) throw fail('invalid-input', 'not-sent')
      inFlight = true
      let resolveIdle!: () => void
      idle = new Promise<void>(resolve => { resolveIdle = resolve })
      const controller = new AbortController()
      let invoked = false, processingDone = false, activeOperations = 0, timedOut = false
      let released = false
      const release = () => {
        if (!released && activeOperations === 0 && processingDone) { released = true; inFlight = false; resolveIdle() }
      }
      const track: Track = pending => {
        activeOperations++
        void pending.then(() => { activeOperations--; release() }, () => { activeOperations--; release() })
        return pending
      }
      const cancel = () => controller.abort()
      signal?.addEventListener('abort', cancel, { once: true })
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      const abortError = () => fail(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted', invoked ? 'unknown' : 'not-sent')
      try {
        // Hash the exact immutable request snapshot, never a claimed hash or mutable caller object.
        const sha256 = await abortable(sha256ReferenceBytes(validated.bytes), controller.signal, abortError)
        if (controller.signal.aborted) throw abortError()
        const pending = track(Promise.resolve().then(() => {
          if (controller.signal.aborted) throw abortError()
          invoked = true
          return transport(`/api/icons/${projectId}/reference-upload`, {
            method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body, signal: controller.signal,
          })
        }).then(response => { if (controller.signal.aborted) discardBody(response, track); return response }))
        const response = await abortable(pending, controller.signal, abortError)
        if (controller.signal.aborted) { discardBody(response, track); throw abortError() }
        if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect') { discardBody(response, track); throw fail('invalid-shape') }
        if (response.status === 401 || response.status === 403) {
          discardBody(response, track); throw fail(response.status === 401 ? 'unauthorized' : 'forbidden', 'rejected', response.status)
        }
        if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discardBody(response, track); throw fail('invalid-shape') }
        const raw = await boundedJson(response, controller.signal, abortError, track)
        if (controller.signal.aborted) throw abortError()
        if (!response.ok) throw serverFailure(raw, response.status)
        if (response.status !== 200) throw fail('invalid-shape')
        return decodeAiReferenceUploadReceipt(raw, { ...validated.metadata, sha256 })
      } catch (error) {
        if (controller.signal.aborted) throw abortError()
        if (error instanceof AiReferenceUploadError) throw error
        throw fail('network-error', invoked ? 'unknown' : 'not-sent')
      } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release()
        // Ignored aborts retain the lease until fetch, outstanding reads and body cancellation actually settle.
      }
    },
  } satisfies AiReferenceUploadProvider)
}
