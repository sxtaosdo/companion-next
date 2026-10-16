import { decodeToolPresetWriteReceipt, TOOL_PRESET_WRITE_LIMITS, ToolPresetWriteError, validateToolPresetWriteInput } from '../domain/tool-presets-write'
import type { ToolPresetWriteCode, ToolPresetWriteOutcome, ToolPresetWriteProvider } from '../domain/tool-presets-write'
import { isToolPresetProjectId } from '../domain/tool-presets-read'
export type ToolPresetWritePath = '/api/tool-presets' | '/api/tool-presets/import' | `/api/tool-presets/${string}` | `/api/projects/${string}/tool-preset`
export type ToolPresetWriteFetch = (input: ToolPresetWritePath, init: RequestInit) => Promise<Response>
const fail = (code: ToolPresetWriteCode, outcome: ToolPresetWriteOutcome = 'unknown', status?: number) => new ToolPresetWriteError(code, outcome, status)
type Track = <T>(pending: Promise<T>) => Promise<T>
function discard(response: Response, track: Track) { try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* Ignore discarded body. */ } }
function abortable<T>(pending: Promise<T>, signal: AbortSignal, aborted: () => ToolPresetWriteError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(aborted()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, () => { signal.removeEventListener('abort', abort); reject(fail('network-error')) })
    if (signal.aborted) abort()
  })
}
async function json(response: Response, signal: AbortSignal, aborted: () => ToolPresetWriteError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > TOOL_PRESET_WRITE_LIMITS.maxResponseBytes) { discard(response, track); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, text = '', complete = false
  try {
    while (true) {
      const part = await abortable(track(reader.read()), signal, aborted)
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > TOOL_PRESET_WRITE_LIMITS.maxResponseBytes || ++chunks > TOOL_PRESET_WRITE_LIMITS.maxResponseChunks) throw fail('response-too-large')
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode(); complete = true
    return JSON.parse(text) as unknown
  } catch (error) { if (error instanceof ToolPresetWriteError) throw error; throw fail('invalid-shape') }
  finally { if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* Ignore. */ } }; try { reader.releaseLock() } catch { /* Injected stream may still be pending. */ } }
}
/** Existing same-origin cookie session only. No forced-delete query, credentials, registration, automatic retry or readback. */
export function createToolPresetWriteProvider(options: { fetch: ToolPresetWriteFetch; timeoutMs?: number }): ToolPresetWriteProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('工具预设写入需要显式注入 fetch。')
  const timeoutMs = options.timeoutMs ?? TOOL_PRESET_WRITE_LIMITS.defaultTimeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > TOOL_PRESET_WRITE_LIMITS.maxTimeoutMs) throw new RangeError('工具预设写入超时必须为 1 至 20000 毫秒。')
  const transport = options.fetch
  let inFlight = false, idle = Promise.resolve()
  return Object.freeze({
    label: 'Companion 工具预设同源持久化接口（v148）',
    waitForIdle: () => idle,
    async execute(input, signal) {
      if (signal?.aborted) throw fail('aborted', 'not-sent')
      const { operation } = validateToolPresetWriteInput(input)
      let path: ToolPresetWritePath, method: 'POST' | 'PATCH' | 'DELETE', body: string | undefined
      if (operation.kind === 'delete') { path = `/api/tool-presets/${encodeURIComponent(operation.preset.id)}`; method = 'DELETE' }
      else if (operation.kind === 'assign') { path = `/api/projects/${encodeURIComponent(operation.projectId)}/tool-preset`; method = 'POST'; body = JSON.stringify({ presetId: operation.preset.id }) }
      else if (operation.kind === 'import') { path = '/api/tool-presets/import'; method = 'POST'; body = JSON.stringify({ schemaVersion: 1, presets: operation.presets }) }
      else {
        path = operation.kind === 'create' ? '/api/tool-presets' : `/api/tool-presets/${encodeURIComponent(operation.before.id)}`
        method = operation.kind === 'create' ? 'POST' : 'PATCH'
        const preset = operation.preset
        // Explicit fields avoid sourcePresetId defaults changing after confirmation.
        body = JSON.stringify({ name: preset.name, baseProfile: preset.baseProfile, enabled: [...preset.enabled].sort(), disabled: [...preset.disabled].sort() })
      }
      if (body && new TextEncoder().encode(body).byteLength > TOOL_PRESET_WRITE_LIMITS.maxRequestBytes) throw fail('invalid-input', 'not-sent')
      if (inFlight) throw fail('busy', 'not-sent')
      inFlight = true
      const controller = new AbortController()
      let resolveIdle!: () => void
      idle = new Promise<void>(resolve => { resolveIdle = resolve })
      let invoked = false, processingDone = false, timedOut = false, activeOperations = 0, released = false
      const release = () => { if (!released && processingDone && activeOperations === 0) { released = true; inFlight = false; resolveIdle() } }
      const track: Track = pending => { activeOperations++; void pending.then(() => { activeOperations--; release() }, () => { activeOperations--; release() }); return pending }
      const cancel = () => controller.abort()
      signal?.addEventListener('abort', cancel, { once: true })
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      const aborted = () => fail(timedOut ? 'timeout' : 'aborted', invoked ? 'unknown' : 'not-sent')
      try {
        if (signal?.aborted) controller.abort()
        const pending = track(Promise.resolve().then(() => {
          if (controller.signal.aborted) throw aborted()
          invoked = true
          return transport(path, { method, mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body }), signal: controller.signal })
        }).then(response => { if (controller.signal.aborted) discard(response, track); return response }))
        const response = await abortable(pending, controller.signal, aborted)
        if (response.status === 401 || response.status === 403) { discard(response, track); throw fail(response.status === 401 ? 'unauthorized' : 'forbidden', 'rejected', response.status) }
        if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect' || !/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discard(response, track); throw fail('invalid-shape') }
        const raw = await json(response, controller.signal, aborted, track)
        if (controller.signal.aborted) throw aborted()
        if (operation.kind === 'delete' && response.status === 409 && raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const ids = (raw as { projectIds?: unknown }).projectIds
          if (Array.isArray(ids) && ids.length > 0 && ids.length <= 1000 && ids.every(isToolPresetProjectId) && new Set(ids).size === ids.length) throw new ToolPresetWriteError('in-use', 'rejected', 409, ids)
        }
        const expectedStatus = operation.kind === 'create' || operation.kind === 'import' ? 201 : 200
        if (response.status !== expectedStatus) throw fail('unconfirmed', 'unknown', response.status)
        return decodeToolPresetWriteReceipt(raw, operation)
      } catch (error) {
        if (controller.signal.aborted) throw aborted()
        if (error instanceof ToolPresetWriteError) throw error
        throw fail('network-error', invoked ? 'unknown' : 'not-sent')
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release() }
    },
  } satisfies ToolPresetWriteProvider)
}
