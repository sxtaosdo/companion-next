import type { LocalService, LocalServiceOperationCode, LocalServiceOperationOutcome, LocalServiceOperationReply, LocalServiceOperationRequest, LocalServiceOperationsProvider } from '../domain/local-service-operations'
import { LOCAL_SERVICE_OPERATION_LIMITS, LocalServiceOperationError, normalizeLocalServiceOperation } from '../domain/local-service-operations'
export { LOCAL_SERVICE_OPERATION_LIMITS, LocalServiceOperationError } from '../domain/local-service-operations'
export type LocalServiceOperationPath = '/api/knowledge-service/start' | '/api/knowledge-service/stop' | '/api/model-service/stop' | '/api/model-service/start'
export type LocalServiceOperationFetch = (input: LocalServiceOperationPath, init: RequestInit) => Promise<Response>
const localFailures = new WeakSet<LocalServiceOperationError>()
const fail = (code: LocalServiceOperationCode, outcome: LocalServiceOperationOutcome = 'unknown') => {
  const error = new LocalServiceOperationError(code, outcome); localFailures.add(error); return error
}
type Track = <T>(pending: Promise<T>) => Promise<T>
function discardBody(response: Response, track: Track): void {
  try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ }
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal, abortError: () => LocalServiceOperationError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, signal: AbortSignal, abortError: () => LocalServiceOperationError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > LOCAL_SERVICE_OPERATION_LIMITS.maxResponseBytes) { discardBody(response, track); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(track(reader.read()), signal, abortError)
      if (next.done) break
      if (!ArrayBuffer.isView(next.value) || Object.prototype.toString.call(next.value) !== '[object Uint8Array]') throw fail('invalid-shape')
      bytes += next.value.byteLength
      if (bytes > LOCAL_SERVICE_OPERATION_LIMITS.maxResponseBytes || ++chunks > LOCAL_SERVICE_OPERATION_LIMITS.maxResponseChunks) throw fail('response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape') }
  } catch (error) {
    if (signal.aborted) throw abortError()
    throw fail(error instanceof LocalServiceOperationError && localFailures.has(error) && error.code === 'response-too-large' ? 'response-too-large' : 'invalid-shape')
  } finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* Outstanding reads retain the lease. */ } }
    try { reader.releaseLock() } catch { /* Abort-unaware reads must actually settle. */ }
  }
}
function stateEnvelope(value: unknown, service: LocalService): { running: boolean; frameable?: boolean; hasError: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('invalid-shape')
  const raw = value as Record<string, unknown>, keys = Object.keys(raw)
  const allowed = service === 'knowledge' ? ['running', 'frameable', 'error'] : ['running', 'error']
  if (keys.some(key => !allowed.includes(key)) || !Object.hasOwn(raw, 'running') || typeof raw.running !== 'boolean') throw fail('invalid-shape')
  if (service === 'knowledge' && (!Object.hasOwn(raw, 'frameable') || typeof raw.frameable !== 'boolean' || (!raw.running && raw.frameable))) throw fail('invalid-shape')
  const hasError = Object.hasOwn(raw, 'error')
  if (hasError && (typeof raw.error !== 'string' || raw.error.length === 0 || raw.error.length > 512)) throw fail('invalid-shape')
  return { running: raw.running, ...(service === 'knowledge' ? { frameable: raw.frameable as boolean } : {}), hasError }
}
function decodeResponse(value: unknown, status: number, request: LocalServiceOperationRequest): LocalServiceOperationReply {
  const { service, action } = request, expectedRunning = action === 'start'
  if (status === 403 && value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 1 && Object.hasOwn(value, 'error') && (value as { error: unknown }).error === 'Forbidden') throw fail('forbidden', 'rejected')
  if (status !== 200 && status !== 503) throw fail('invalid-shape')
  const state = stateEnvelope(value, service)
  if (status === 503 && state.running !== expectedRunning && state.hasError) throw fail('backend-failure', 'reported-failure')
  if (status !== 200 || state.running !== expectedRunning || state.hasError) throw fail('invalid-shape')
  return service === 'knowledge' ? (action === 'start' ? { service, action, state: { running: true, frameable: state.frameable! } } : { service, action, state: { running: false, frameable: false } }) : action === 'start' ? { service, action, state: { running: true } } : { service, action, state: { running: false } }
}
/** Fixed original knowledge/model start/stop endpoints; no global fetch, CLI, arbitrary URL, retry or polling. */
export function createLocalServiceOperationsProvider(options: { fetch: LocalServiceOperationFetch; timeoutMs?: number }): LocalServiceOperationsProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('服务操作适配器需要显式注入同源 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? LOCAL_SERVICE_OPERATION_LIMITS.timeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > LOCAL_SERVICE_OPERATION_LIMITS.timeoutMs) throw new RangeError('服务操作超时必须为 1 至 120000 毫秒。')
  let inFlight: object | undefined, idle = Promise.resolve()
  return Object.freeze({
    label: 'Companion 同源服务操作（原知识 / 模型启动器路由，逐次确认）',
    waitForIdle: () => idle,
    async run(input, signal): Promise<LocalServiceOperationReply> {
      if (signal?.aborted) throw fail('aborted', 'not-dispatched')
      if (inFlight) throw fail('busy', 'not-dispatched')
      let request
      try { request = normalizeLocalServiceOperation(input) } catch { throw fail('invalid-input', 'not-dispatched') }
      const identity = {}
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
            const path: LocalServiceOperationPath = request.service === 'knowledge' ? `/api/knowledge-service/${request.action}` : `/api/model-service/${request.action}`
            return Promise.resolve(transport(path, {
              method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
              headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}',
              signal: controller.signal,
            })).catch(() => { throw fail('network-error') })
          } catch { throw fail('network-error') }
        }).then(response => { if (controller.signal.aborted) discardBody(response, track); return response }))
        const response = await abortable(pending, controller.signal, abortError)
        if (controller.signal.aborted) { discardBody(response, track); throw abortError() }
        if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect') { discardBody(response, track); throw fail('invalid-shape') }
        if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discardBody(response, track); throw fail('invalid-shape') }
        const raw = await boundedJson(response, controller.signal, abortError, track)
        if (controller.signal.aborted) throw abortError()
        return decodeResponse(raw, response.status, request)
      } catch (error) {
        if (controller.signal.aborted) throw abortError()
        if (error instanceof LocalServiceOperationError && localFailures.has(error)) throw error
        throw fail('network-error', invoked ? 'unknown' : 'not-dispatched')
      } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release()
        // Logical cancellation is not proof of server cancellation and cannot release unfinished client operations.
      }
    },
  } satisfies LocalServiceOperationsProvider)
}
