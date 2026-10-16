import { decodeToolCatalog, decodeToolPresetExport, decodeToolPresetRead, isToolPresetId, isToolPresetProjectId, TOOL_PRESET_READ_LIMITS, ToolPresetReadError } from '../domain/tool-presets-read'
import type { ToolPresetReadCode, ToolPresetReadEndpoint, ToolPresetReadProvider } from '../domain/tool-presets-read'

export { TOOL_PRESET_READ_LIMITS, ToolPresetReadError } from '../domain/tool-presets-read'
export type { ToolPresetReadCode } from '../domain/tool-presets-read'
export type ToolPresetReadPath = '/api/tools' | '/api/tool-presets' | `/api/tool-presets?projectId=${string}` | `/api/tool-presets/${string}/export`
export type ToolPresetFetch = (input: ToolPresetReadPath, init: RequestInit) => Promise<Response>
const fail = (endpoint: ToolPresetReadEndpoint, code: ToolPresetReadCode, status?: number) => new ToolPresetReadError(code, endpoint, status)
function discardBody(response: Response): void { try { void response.body?.cancel().catch(() => undefined) } catch { /* Retain no response. */ } }
function abortable<T>(pending: Promise<T>, signal: AbortSignal, error: () => ToolPresetReadError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(error()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, endpoint: ToolPresetReadEndpoint, signal: AbortSignal, abortError: () => ToolPresetReadError): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > TOOL_PRESET_READ_LIMITS.maxResponseBytes) { discardBody(response); throw fail(endpoint, 'response-too-large') }
  if (!response.body) throw fail(endpoint, 'invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const result = await abortable(reader.read(), signal, abortError)
      if (result.done) break
      bytes += result.value.byteLength
      if (bytes > TOOL_PRESET_READ_LIMITS.maxResponseBytes || ++chunks > TOOL_PRESET_READ_LIMITS.maxResponseChunks) throw fail(endpoint, 'response-too-large')
      body += decoder.decode(result.value, { stream: true })
    }
    body += decoder.decode()
    complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail(endpoint, 'invalid-shape') }
  } catch (error) {
    if (error instanceof ToolPresetReadError) throw error
    throw fail(endpoint, 'invalid-shape')
  } finally {
    if (!complete) { try { void reader.cancel().catch(() => undefined) } catch { /* Already closed. */ } }
    try { reader.releaseLock() } catch { /* An injected reader may still be pending. */ }
  }
}
/** Passive fixed-path GET adapter. No base URL, token, writer, retry, timer polling or auto-connect surface. */
export function createToolPresetReadProvider(options: { fetch: ToolPresetFetch; timeoutMs?: number }): ToolPresetReadProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('工具范围只读适配器需要显式注入 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? TOOL_PRESET_READ_LIMITS.defaultTimeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > TOOL_PRESET_READ_LIMITS.maxTimeoutMs) throw new RangeError('工具范围读取超时必须为 1 至 4000 毫秒。')
  const inFlight = new Set<object>()
  async function read<T>(path: ToolPresetReadPath, endpoint: ToolPresetReadEndpoint, decode: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw fail(endpoint, 'aborted')
    if (inFlight.size >= TOOL_PRESET_READ_LIMITS.maxConcurrentRequests) throw fail(endpoint, 'busy')
    const identity = {}, controller = new AbortController()
    inFlight.add(identity)
    let timedOut = false
    const cancel = () => { inFlight.delete(identity); controller.abort() }
    signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => { timedOut = true; inFlight.delete(identity); controller.abort() }, timeoutMs)
    const abortError = () => fail(endpoint, signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted')
    try {
      const pending = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw abortError()
        return transport(path, { method: 'GET', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal })
      })
      void pending.then((response) => { if (controller.signal.aborted) discardBody(response) }, () => undefined)
      const response = await abortable(pending, controller.signal, abortError)
      if (!response.ok) {
        discardBody(response)
        throw fail(endpoint, response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : 'http-error', response.status)
      }
      if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect' || !/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discardBody(response); throw fail(endpoint, 'invalid-shape') }
      const result = decode(await boundedJson(response, endpoint, controller.signal, abortError))
      if (controller.signal.aborted) throw abortError()
      return result
    } catch (error) {
      if (controller.signal.aborted) throw abortError()
      if (error instanceof ToolPresetReadError) throw error
      throw fail(endpoint, 'network-error')
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); inFlight.delete(identity) }
  }
  return Object.freeze({
    label: 'Companion 工具目录与范围同源只读接口（v148 契约）',
    loadTools(signal?: AbortSignal) { return read('/api/tools', 'tools', decodeToolCatalog, signal) },
    async loadPresets(projectId: string | undefined, signal?: AbortSignal) {
      if (projectId !== undefined && !isToolPresetProjectId(projectId)) throw fail('presets', 'invalid-query')
      return read(projectId === undefined ? '/api/tool-presets' : `/api/tool-presets?projectId=${encodeURIComponent(projectId)}`, 'presets', decodeToolPresetRead, signal)
    },
    async exportPreset(presetId: string, signal?: AbortSignal) {
      if (!isToolPresetId(presetId)) throw fail('export', 'invalid-query')
      return read(`/api/tool-presets/${encodeURIComponent(presetId)}/export`, 'export', decodeToolPresetExport, signal)
    },
  } satisfies ToolPresetReadProvider)
}
