import { AI_RESOURCE_READ_LIMITS, AiResourceReadError, decodeAiResourceView, isAiProjectId, isAiReferencePath, verifyAiReferencePreview } from '../domain/ai-resource-read'
import type { AiResourceReadCode, AiResourceReadEndpoint, AiResourceReadProvider } from '../domain/ai-resource-read'
export { AI_RESOURCE_READ_LIMITS, AiResourceReadError } from '../domain/ai-resource-read'
export type { AiResourceReadCode } from '../domain/ai-resource-read'
export type AiResourceReadPath = `/api/icons/${string}/resource-config` | `/api/icons/${string}/reference-preview`
export type AiResourceFetch = (input: AiResourceReadPath, init: RequestInit) => Promise<Response>
const fail = (endpoint: AiResourceReadEndpoint, code: AiResourceReadCode, status?: number) => new AiResourceReadError(code, endpoint, status)
type Track = <T>(promise: Promise<T>) => Promise<T>
function discardBody(response: Response): Promise<void> { try { return response.body?.cancel().catch(() => undefined) ?? Promise.resolve() } catch { return Promise.resolve() } }
function abortable<T>(pending: Promise<T>, signal: AbortSignal, error: () => AiResourceReadError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(error()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, endpoint: AiResourceReadEndpoint, signal: AbortSignal, abortError: () => AiResourceReadError, track: Track): Promise<unknown> {
  const maxBytes = endpoint === 'resource-config' ? AI_RESOURCE_READ_LIMITS.maxConfigResponseBytes : AI_RESOURCE_READ_LIMITS.maxPreviewResponseBytes
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > maxBytes) { void track(discardBody(response)); throw fail(endpoint, 'response-too-large') }
  if (!response.body) throw fail(endpoint, 'invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const result = await abortable(track(reader.read()), signal, abortError)
      if (result.done) break
      bytes += result.value.byteLength
      if (bytes > maxBytes || ++chunks > AI_RESOURCE_READ_LIMITS.maxResponseChunks) throw fail(endpoint, 'response-too-large')
      body += decoder.decode(result.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail(endpoint, 'invalid-shape') }
  } catch (error) { if (error instanceof AiResourceReadError) throw error; throw fail(endpoint, 'invalid-shape') }
  finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* Closed. */ } }
    try { reader.releaseLock() } catch { /* An injected reader may remain pending. */ }
  }
}
/** Passive fixed-path read-only POSTs. No arbitrary URL, token, writer, retry, polling or automatic connection. */
export function createAiResourceReadProvider(options: { fetch: AiResourceFetch; timeoutMs?: number; referencePreview?: boolean }): AiResourceReadProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('AI 资源只读适配器需要显式注入 fetch。')
  const transport = options.fetch, configuredTimeout = options.timeoutMs
  if (configuredTimeout !== undefined && (!Number.isFinite(configuredTimeout) || configuredTimeout < 1 || configuredTimeout > AI_RESOURCE_READ_LIMITS.maxTimeoutMs)) throw new RangeError('AI 资源读取超时必须为 1 至 20000 毫秒。')
  const referencePreviewEnabled = options.referencePreview !== false
  const inFlight = new Set<object>(), idleWaiters = new Set<() => void>()
  async function read<T>(projectId: string, endpoint: AiResourceReadEndpoint, body: object, decode: (value: unknown) => T | Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw fail(endpoint, 'aborted')
    if (inFlight.size >= AI_RESOURCE_READ_LIMITS.maxConcurrentRequests) throw fail(endpoint, 'busy')
    const timeoutMs = configuredTimeout ?? (endpoint === 'resource-config' ? AI_RESOURCE_READ_LIMITS.defaultConfigTimeoutMs : AI_RESOURCE_READ_LIMITS.defaultPreviewTimeoutMs)
    const identity = {}, controller = new AbortController()
    inFlight.add(identity)
    let timedOut = false, settled = false, pendingWork = 0
    const release = () => { if (settled && pendingWork === 0) { inFlight.delete(identity); if (!inFlight.size) { for (const resolve of idleWaiters) resolve(); idleWaiters.clear() } } }
    const track: Track = <T>(promise: Promise<T>): Promise<T> => {
      pendingWork++
      return promise.then(value => { pendingWork--; release(); return value }, cause => { pendingWork--; release(); throw cause })
    }
    const cancel = () => controller.abort()
    signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    const abortError = () => fail(endpoint, signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted')
    try {
      const pending = track(Promise.resolve().then(() => {
        if (controller.signal.aborted) throw abortError()
        return transport(`/api/icons/${projectId}/${endpoint}`, {
          method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
        })
      }).then(async response => { if (controller.signal.aborted) await discardBody(response); return response }))
      const response = await abortable(pending, controller.signal, abortError)
      if (!response.ok) {
        let code: AiResourceReadCode = response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : 'http-error'
        // Retain only verified closed business codes, never backend diagnostics.
        if ([404, 503].includes(response.status) && !response.redirected && response.type !== 'opaque' && response.type !== 'opaqueredirect' && /^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) {
          try {
            const raw = await boundedJson(response, endpoint, controller.signal, abortError, track)
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
              const businessCode = (raw as Record<string, unknown>).code
              if (response.status === 503 && businessCode === 'ICON_ADAPTER_DISABLED') code = 'adapter-disabled'
              if (response.status === 404 && businessCode === 'PROJECT_NOT_FOUND') code = 'project-unavailable'
            }
          } catch { if (controller.signal.aborted) throw abortError() }
        } else void track(discardBody(response))
        throw fail(endpoint, code, response.status)
      }
      if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect' || !/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { void track(discardBody(response)); throw fail(endpoint, 'invalid-shape') }
      const raw = await boundedJson(response, endpoint, controller.signal, abortError, track)
      if (controller.signal.aborted) throw abortError()
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (raw as Record<string, unknown>).schemaVersion !== 'companion-icons-v1') throw fail(endpoint, 'invalid-shape')
      const result = await abortable(track(Promise.resolve().then(() => { if (controller.signal.aborted) throw abortError(); return decode(raw) })), controller.signal, abortError)
      if (controller.signal.aborted) throw abortError()
      return result
    } catch (error) {
      if (controller.signal.aborted) throw abortError()
      if (error instanceof AiResourceReadError) throw error
      throw fail(endpoint, 'network-error')
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); settled = true; release() }
  }
  return Object.freeze({
    label: referencePreviewEnabled ? 'Companion AI 配置与参考图同源查询（v148 契约）' : 'Companion AI 配置文件读取（参考图处理未启用）',
    referencePreviewEnabled,
    waitForIdle: () => inFlight.size ? new Promise<void>(resolve => idleWaiters.add(resolve)) : Promise.resolve(),
    async readConfig(projectId: string, signal?: AbortSignal) {
      if (!isAiProjectId(projectId)) throw fail('resource-config', 'invalid-query')
      return read(projectId, 'resource-config', {}, (value) => decodeAiResourceView(value, projectId), signal)
    },
    async previewReference(projectId: string, relativePath: string, signal?: AbortSignal) {
      if (!referencePreviewEnabled) throw fail('reference-preview', 'capability-disabled')
      if (!isAiProjectId(projectId) || !isAiReferencePath(relativePath)) throw fail('reference-preview', 'invalid-query')
      return read(projectId, 'reference-preview', { relativePath }, verifyAiReferencePreview, signal)
    },
  } satisfies AiResourceReadProvider)
}
