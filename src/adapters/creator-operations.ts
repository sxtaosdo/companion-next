import { RUNTIME_STATES } from '../domain/companion-browser'
import type { ManagedStatus } from '../domain/companion-browser'
import type { CreatorAction, CreatorOperationCode, CreatorOperationOutcome, CreatorOperationReply, CreatorOperationsProvider } from '../domain/creator-operations'
import { CREATOR_OPERATION_LIMITS, CreatorOperationError, normalizeCreatorOperation } from '../domain/creator-operations'
export { CREATOR_OPERATION_LIMITS, CreatorOperationError } from '../domain/creator-operations'
export type { CreatorOperationCode, CreatorOperationOutcome } from '../domain/creator-operations'
export type CreatorOperationPath = `/api/projects/${string}` | `/api/projects/${string}/${Exclude<CreatorAction, 'remove-registration'>}`
export type CreatorOperationFetch = (input: CreatorOperationPath, init: RequestInit) => Promise<Response>
const localFailures = new WeakSet<CreatorOperationError>()
const fail = (code: CreatorOperationCode, outcome: CreatorOperationOutcome = 'unknown', backendCode?: string, reportedReason?: 'unsaved-content') => {
  const error = new CreatorOperationError(code, outcome, backendCode, reportedReason)
  localFailures.add(error); return error
}
type Track = <T>(pending: Promise<T>) => Promise<T>
function discardBody(response: Response, track: Track): void {
  try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ }
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal, abortError: () => CreatorOperationError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, signal: AbortSignal, abortError: () => CreatorOperationError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > CREATOR_OPERATION_LIMITS.maxResponseBytes) { discardBody(response, track); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(track(reader.read()), signal, abortError)
      if (next.done) break
      if (!ArrayBuffer.isView(next.value) || Object.prototype.toString.call(next.value) !== '[object Uint8Array]') throw fail('invalid-shape')
      bytes += next.value.byteLength
      if (bytes > CREATOR_OPERATION_LIMITS.maxResponseBytes || ++chunks > CREATOR_OPERATION_LIMITS.maxResponseChunks) throw fail('response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape') }
  } catch (error) {
    if (signal.aborted) throw abortError()
    throw fail(error instanceof CreatorOperationError && localFailures.has(error) && error.code === 'response-too-large' ? 'response-too-large' : 'invalid-shape')
  } finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* Outstanding reads retain the lease. */ } }
    try { reader.releaseLock() } catch { /* Abort-unaware reads must actually settle. */ }
  }
}
const backendCodes = Object.freeze([
  'DASHBOARD_NOT_FOUND', 'DASHBOARD_AUTOMATION_DENIED', 'DASHBOARD_WINDOW_NOT_ACCESSIBLE', 'DASHBOARD_PROJECT_NOT_FOUND',
  'DASHBOARD_PROJECT_AMBIGUOUS', 'DASHBOARD_IMPORT_FAILED', 'DASHBOARD_VERSION_MISMATCH', 'DASHBOARD_LAUNCH_TIMEOUT',
  'DASHBOARD_OPEN_WITHOUT_BRIDGE', 'DASHBOARD_UNSUPPORTED_PLATFORM',
])
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('invalid-shape')
  return value as Record<string, unknown>
}
function serverFailure(value: unknown, status: number, action: CreatorAction): CreatorOperationError {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('invalid-shape')
  const raw = value as Record<string, unknown>, keys = Object.keys(raw)
  if (status === 403 && keys.length === 1 && keys[0] === 'error' && raw.error === 'Forbidden') return fail('forbidden', 'rejected')
  if (action === 'open-folder' || action === 'remove-registration') {
    // v148 DELETE clears router cache, registry and preset binding in separate steps.
    // A plain 500 may follow partial effects; no error text, inferred rollback or retry.
    if (status === 500 && keys.length === 1 && keys[0] === 'error' && typeof raw.error === 'string') return fail('backend-failure', 'unknown')
    return fail('invalid-shape')
  }
  if ((action === 'stop' || action === 'restart') && status === 500 && keys.length === 1 && keys[0] === 'error' && typeof raw.error === 'string' && raw.error.includes('未保存')) {
    // A local display hint, not a stable backend code or proof that no operation took effect.
    return fail('backend-failure', 'unknown', undefined, 'unsaved-content')
  }
  const backendCode = Object.hasOwn(raw, 'code') && typeof raw.code === 'string' && backendCodes.includes(raw.code) ? raw.code : undefined
  const exact = keys.length >= 3 && keys.length <= 4 && ['error', 'code', 'retryable'].every(key => Object.hasOwn(raw, key)) && keys.every(key => ['error', 'code', 'retryable', 'details'].includes(key))
  const detailsValid = !Object.hasOwn(raw, 'details') || (raw.details !== null && typeof raw.details === 'object' && !Array.isArray(raw.details))
  if (backendCode && exact && typeof raw.error === 'string' && raw.retryable === false && detailsValid
    && status === (backendCode === 'DASHBOARD_UNSUPPORTED_PLATFORM' ? 501 : 409)) {
    // The Dashboard may already have imported/opened Creator before reporting failure.
    return fail('backend-failure', 'reported-failure', backendCode)
  }
  return fail('invalid-shape')
}
/** Same display-only credential filtering as the existing read adapter; raw errors/details are never projected. */
function displayText(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw fail('invalid-shape')
  return value
    .replace(/data:[^\s;,]+;base64,[\w+/=\r\n]+/gi, '[image/data omitted]')
    .replace(/\b[A-Za-z0-9+/]{160,}={0,2}\b/g, '[large data omitted]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\b(Bearer|Basic)\s+[^\s,;"'}]+/gi, '$1 [redacted]')
    .replace(/((?:token|password|passwd|authorization|secret|api[-_]?key|credential)[\w-]*["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*')/gi, '$1[redacted]')
    .replace(/\bcookie\s*:\s*[^\r\n]+/gi, 'cookie: [redacted]')
    .replace(/((?:token|password|passwd|authorization|secret|api[-_]?key|credential)[\w-]*["']?\s*[:=]\s*)["']?[^\s&,;"'}]+["']?/gi, '$1[redacted]')
}
function openedPath(value: unknown): string {
  const path = displayText(value, 4096)
  // Preserve the exact registry path for the store's frozen-target comparison. If the
  // privacy filter would rewrite it, reject instead of leaking or inventing a path.
  if (path !== value || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(path)) throw fail('invalid-shape')
  const drive = /^[A-Za-z]:[\\/](?![\\/])/.test(path) && !/[<>:"|?*]/.test(path.slice(2))
  const unc = /^\\\\(?!(?:\.{1,2}|\?)\\)[^\\/\s:?<>"|*]+\\[^\\/:?<>"|*]+(?:\\[^/:?<>"|*]*)?$/.test(path)
  const posix = /^\/(?!\/)/.test(path)
  if (!drive && !unc && !posix) throw fail('invalid-shape')
  return path
}
function decodeRuntime(value: unknown, projectId: string, action: 'start' | 'stop' | 'restart'): ManagedStatus {
  const raw = object(value)
  if (!Object.hasOwn(raw, 'projectId') || !Object.hasOwn(raw, 'state') || raw.projectId !== projectId || typeof raw.state !== 'string' || !RUNTIME_STATES.includes(raw.state as typeof RUNTIME_STATES[number])) throw fail('invalid-shape')
  // stop acknowledges only the backend's stopped state; it does not prove process exit.
  if (action === 'stop' && raw.state !== 'stopped') throw fail('invalid-shape')
  const result: ManagedStatus = { projectId, state: raw.state as typeof RUNTIME_STATES[number], capabilityProfile: 'unknown' }
  if (Object.hasOwn(raw, 'capabilityProfile')) {
    if (!['read-only', 'authoring', 'full-control'].includes(raw.capabilityProfile as string)) throw fail('invalid-shape')
    result.capabilityProfile = raw.capabilityProfile as ManagedStatus['capabilityProfile']
  }
  for (const key of ['creatorVersion', 'dashboardVersion', 'dashboardProgress', 'instanceId', 'sessionId'] as const) {
    if (Object.hasOwn(raw, key)) result[key] = displayText(raw[key], key.endsWith('Version') ? 64 : 256)
  }
  if (Object.hasOwn(raw, 'launchSource')) {
    if (raw.launchSource !== 'dashboard') throw fail('invalid-shape')
    result.launchSource = 'dashboard'
  }
  if (Object.hasOwn(raw, 'pid')) {
    if (typeof raw.pid !== 'number' || !Number.isSafeInteger(raw.pid) || raw.pid < 1) throw fail('invalid-shape')
    result.pid = raw.pid
  }
  // lastError, preview URLs, details and unknown properties are deliberately not returned.
  return result
}
/** One operation lane: v148 management contract; v148/v150 lifecycle source evidence. No real-host validation. */
export function createCreatorOperationsProvider(options: { fetch: CreatorOperationFetch; timeoutMs?: number }): CreatorOperationsProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('Creator 操作适配器需要显式注入同源 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? CREATOR_OPERATION_LIMITS.timeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > CREATOR_OPERATION_LIMITS.timeoutMs) throw new RangeError('Creator 操作超时必须为 1 至 120000 毫秒。')
  let inFlight: object | undefined, idle = Promise.resolve()
  return Object.freeze({
    label: 'Companion 同源工程操作（v148 管理合同；v148/v150 生命周期源码已核，实机未验）',
    waitForIdle: () => idle,
    async run(input, signal): Promise<CreatorOperationReply> {
      if (signal?.aborted) throw fail('aborted', 'not-dispatched')
      if (inFlight) throw fail('busy', 'not-dispatched')
      let request
      try { request = normalizeCreatorOperation(input) } catch { throw fail('invalid-input', 'not-dispatched') }
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
            const remove = request.action === 'remove-registration'
            const path: CreatorOperationPath = remove ? `/api/projects/${request.projectId}` : `/api/projects/${request.projectId}/${request.action}`
            return Promise.resolve(transport(path, {
              method: remove ? 'DELETE' : 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
              ...(remove ? { headers: { Accept: 'application/json' } } : { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: '{}' }),
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
        if (!response.ok) throw serverFailure(raw, response.status, request.action)
        if (response.status !== 200) throw fail('invalid-shape')
        if (request.action === 'open-folder') {
          const opened = object(raw)
          if (Object.keys(opened).length !== 2 || !Object.hasOwn(opened, 'ok') || !Object.hasOwn(opened, 'path') || opened.ok !== true) throw fail('invalid-shape')
          return { action: 'open-folder', acknowledged: true, path: openedPath(opened.path) }
        }
        if (request.action === 'remove-registration') {
          const removed = object(raw)
          if (Object.keys(removed).length !== 1 || !Object.hasOwn(removed, 'removed') || typeof removed.removed !== 'boolean') throw fail('invalid-shape')
          // false is valid and proves neither registry removal nor preset-binding cleanup.
          return { action: 'remove-registration', removed: removed.removed }
        }
        if (request.action !== 'focus') return { action: request.action, runtime: decodeRuntime(raw, request.projectId, request.action) }
        const focus = object(raw)
        if (Object.keys(focus).length !== 1 || !Object.hasOwn(focus, 'ok') || focus.ok !== true) throw fail('invalid-shape')
        return { action: 'focus', acknowledged: true }
      } catch (error) {
        if (controller.signal.aborted) throw abortError()
        if (error instanceof CreatorOperationError && localFailures.has(error)) throw error
        throw fail('network-error', invoked ? 'unknown' : 'not-dispatched')
      } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release()
        // Logical cancellation is not proof of server cancellation and cannot release unfinished client operations.
      }
    },
  } satisfies CreatorOperationsProvider)
}
