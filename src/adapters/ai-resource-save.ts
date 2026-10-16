import { decodeAiResourceView } from '../domain/ai-resource-read'
import type { AiResourceSaveCode, AiResourceSaveOutcome, AiResourceSaveProvider } from '../domain/ai-resource-save'
import { AI_RESOURCE_SAVE_LIMITS, AiResourceSaveError, aiResourceConfigsEqual, validateAiResourceSaveInput } from '../domain/ai-resource-save'
export { AI_RESOURCE_SAVE_LIMITS, AiResourceSaveError } from '../domain/ai-resource-save'
export type { AiResourceSaveCode, AiResourceSaveOutcome } from '../domain/ai-resource-save'
export type AiResourceSavePath = `/api/icons/${string}/resource-config-save`
export type AiResourceSaveFetch = (input: AiResourceSavePath, init: RequestInit) => Promise<Response>
const fail = (code: AiResourceSaveCode, outcome: AiResourceSaveOutcome = 'unknown', status?: number) => new AiResourceSaveError(code, outcome, status)
function discardBody(response: Response): void { try { void response.body?.cancel().catch(() => undefined) } catch { /* No raw diagnostics. */ } }
function abortable<T>(pending: Promise<T>, signal: AbortSignal, abortError: () => AiResourceSaveError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, () => {
      signal.removeEventListener('abort', abort); reject(fail('network-error'))
    })
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, signal: AbortSignal, abortError: () => AiResourceSaveError): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > AI_RESOURCE_SAVE_LIMITS.maxResponseBytes) { discardBody(response); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(reader.read(), signal, abortError)
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > AI_RESOURCE_SAVE_LIMITS.maxResponseBytes || ++chunks > AI_RESOURCE_SAVE_LIMITS.maxResponseChunks) throw fail('response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape') }
  } catch (error) { if (error instanceof AiResourceSaveError) throw error; throw fail('invalid-shape') }
  finally {
    if (!complete) { try { void reader.cancel().catch(() => undefined) } catch { /* No raw diagnostics. */ } }
    try { reader.releaseLock() } catch { /* Injected streams may ignore cancellation. */ }
  }
}
// Only source-verified pre-write rejections. File-read/path errors can also arise after a write, so remain unknown.
const rejectedCodes: Readonly<Record<string, number>> = Object.freeze({
  INVALID_INPUT: 400, PROJECT_NOT_FOUND: 404, ICON_ADAPTER_DISABLED: 503, ICON_CONFIG_INVALID: 503,
  RESOURCE_CONFIG_BUSY: 409, RESOURCE_PROJECT_MISMATCH: 409, RESOURCE_DESIGN_MISMATCH: 409, RESOURCE_REFERENCE_INVALID: 409,
})
function serverFailure(raw: unknown, status: number): AiResourceSaveError {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('unconfirmed', 'unknown', status)
  const value = raw as Record<string, unknown>
  if (typeof value.code !== 'string' || value.error !== value.code || value.retryable !== false) return fail('unconfirmed', 'unknown', status)
  if (value.code === 'RESOURCE_CONFIG_STALE' && status === 409) return fail('stale', 'conflict', status)
  if (Object.hasOwn(rejectedCodes, value.code) && rejectedCodes[value.code] === status) return fail('rejected', 'rejected', status)
  return fail('unconfirmed', 'unknown', status)
}
/** Passive, explicitly approved fixed-path save only. No host selection, auto-confirmation, retry, readback or polling. */
export function createAiResourceSaveProvider(options: { fetch: AiResourceSaveFetch; timeoutMs?: number }): AiResourceSaveProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('AI 配置保存适配器需要显式注入 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? AI_RESOURCE_SAVE_LIMITS.defaultTimeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > AI_RESOURCE_SAVE_LIMITS.maxTimeoutMs) throw new RangeError('AI 配置保存超时必须为 1 至 20000 毫秒。')
  let inFlight = false
  return Object.freeze({
    label: 'Companion AI 配置同源保存接口（v148 契约）',
    async saveConfig(projectId, input, signal) {
      if (signal?.aborted) throw fail('aborted', 'not-sent')
      const validated = validateAiResourceSaveInput(input, projectId), body = JSON.stringify(validated)
      if (new TextEncoder().encode(body).byteLength > AI_RESOURCE_SAVE_LIMITS.maxRequestBytes) throw fail('invalid-input', 'not-sent')
      if (inFlight) throw fail('busy', 'not-sent')
      inFlight = true
      const controller = new AbortController()
      let invoked = false, transportSettled = false, processingDone = false, timedOut = false
      const release = () => { if (transportSettled && processingDone) inFlight = false }
      const cancel = () => controller.abort()
      signal?.addEventListener('abort', cancel, { once: true })
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      const abortError = () => fail(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted', invoked ? 'unknown' : 'not-sent')
      try {
        // The microtask boundary allows synchronous UI cancellation to stop before dispatch.
        const pending = Promise.resolve().then(() => {
          if (controller.signal.aborted) throw abortError()
          invoked = true
          return transport(`/api/icons/${projectId}/resource-config-save`, {
            method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body, signal: controller.signal,
          })
        })
        void pending.then(response => {
          transportSettled = true
          if (controller.signal.aborted) discardBody(response)
          release()
        }, () => { transportSettled = true; release() })
        const response = await abortable(pending, controller.signal, abortError)
        if (controller.signal.aborted) { discardBody(response); throw abortError() }
        if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect') { discardBody(response); throw fail('invalid-shape') }
        if (response.status === 401 || response.status === 403) {
          discardBody(response); throw fail(response.status === 401 ? 'unauthorized' : 'forbidden', 'rejected', response.status)
        }
        if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discardBody(response); throw fail('invalid-shape') }
        const raw = await boundedJson(response, controller.signal, abortError)
        if (controller.signal.aborted) throw abortError()
        if (!response.ok) throw serverFailure(raw, response.status)
        if (response.status !== 200) throw fail('invalid-shape')
        try {
          const saved = decodeAiResourceView(raw, projectId)
          if (saved.state !== 'valid' || !saved.hash || saved.version === null || saved.migrationRequired || saved.config?.schemaVersion !== 'project-resource-config-v2'
            || !aiResourceConfigsEqual(saved.config, validated.config, { ignoreVersion: true })) throw fail('invalid-shape')
          // Only the store owns the prior current version; it must also check the server's expected next version.
          return saved
        } catch { throw fail('invalid-shape') }
      } catch (error) {
        if (controller.signal.aborted) throw abortError()
        if (error instanceof AiResourceSaveError) throw error
        throw fail('network-error', invoked ? 'unknown' : 'not-sent')
      } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release()
        // A fetch which ignores abort keeps this provider busy until its actual promise settles.
      }
    },
  } satisfies AiResourceSaveProvider)
}
