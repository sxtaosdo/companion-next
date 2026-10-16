import { RUNTIME_STATES } from '../domain/companion-browser'
import type { ManagedProject } from '../domain/companion-browser'
import { PROJECT_SETUP_LIMITS, ProjectSetupError, SETUP_STAGES, validateProjectPath, validateProjectScaffoldInput, validateSetupOperationId, validateSetupProjectId } from '../domain/project-setup'
import type { ProjectScaffoldResult, ProjectSetupErrorCode, ProjectSetupProvider, SetupSnapshot } from '../domain/project-setup'
export { PROJECT_SETUP_LIMITS, ProjectSetupError } from '../domain/project-setup'
export type ProjectSetupPath = '/api/projects' | '/api/projects/scaffold' | '/api/pick-directory' | '/api/setup' | `/api/setup/${string}`
export type ProjectSetupFetch = (input: ProjectSetupPath, init: RequestInit) => Promise<Response>

const localFailures = new WeakSet<ProjectSetupError>()
function fail(code: ProjectSetupErrorCode, outcome: ProjectSetupError['outcome'] = 'unknown'): ProjectSetupError {
  const error = new ProjectSetupError(code, outcome)
  localFailures.add(error)
  return error
}
type Track = <T>(pending: Promise<T>) => Promise<T>
function discardBody(response: Response, track: Track): void {
  try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ }
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal, abortError: () => ProjectSetupError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, signal: AbortSignal, abortError: () => ProjectSetupError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > PROJECT_SETUP_LIMITS.maxResponseBytes) { discardBody(response, track); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(track(reader.read()), signal, abortError)
      if (next.done) break
      if (!ArrayBuffer.isView(next.value) || Object.prototype.toString.call(next.value) !== '[object Uint8Array]') throw fail('invalid-shape')
      bytes += next.value.byteLength
      if (bytes > PROJECT_SETUP_LIMITS.maxResponseBytes || ++chunks > PROJECT_SETUP_LIMITS.maxResponseChunks) throw fail('response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape') }
  } catch (error) {
    if (signal.aborted) throw abortError()
    throw fail(error instanceof ProjectSetupError && localFailures.has(error) && error.code === 'response-too-large' ? 'response-too-large' : 'invalid-shape')
  } finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* An outstanding read still retains the lane. */ } }
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
function required(raw: Record<string, unknown>, keys: readonly string[]): void {
  if (!keys.every(key => Object.hasOwn(raw, key))) throw fail('invalid-shape')
}
/** Display-only fields use the existing adapter's credential filter. Paths may never be rewritten. */
function displayText(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value || value.length > max || /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(value)) throw fail('invalid-shape')
  return value
    .replace(/data:[^\s;,]+;base64,[\w+/=\r\n]+/gi, '[image/data omitted]')
    .replace(/\b[A-Za-z0-9+/]{160,}={0,2}\b/g, '[large data omitted]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\b(Bearer|Basic)\s+[^\s,;"'}]+/gi, '$1 [redacted]')
    .replace(/((?:token|password|passwd|authorization|secret|api[-_]?key|credential)[\w-]*["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*')/gi, '$1[redacted]')
    .replace(/\bcookie\s*:\s*[^\r\n]+/gi, 'cookie: [redacted]')
    .replace(/((?:token|password|passwd|authorization|secret|api[-_]?key|credential)[\w-]*["']?\s*[:=]\s*)["']?[^\s&,;"'}]+["']?/gi, '$1[redacted]')
}
function safePath(value: unknown): string {
  try {
    const path = validateProjectPath(value)
    if (displayText(path, PROJECT_SETUP_LIMITS.maxPath) !== path) throw fail('invalid-shape')
    return path
  } catch { throw fail('invalid-shape') }
}
function projectId(value: unknown): string {
  try { return validateSetupProjectId(value) } catch { throw fail('invalid-shape') }
}
function operationId(value: unknown): string {
  try { return validateSetupOperationId(value) } catch { throw fail('invalid-shape') }
}
function date(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw fail('invalid-shape')
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw fail('invalid-shape')
  return value
}
function decodeProject(value: unknown): ManagedProject {
  const raw = object(value)
  required(raw, ['id', 'name', 'path'])
  const result: ManagedProject = { id: projectId(raw.id), name: displayText(raw.name, 256), path: safePath(raw.path) }
  if (Object.hasOwn(raw, 'requiredCreatorVersion')) result.requiredCreatorVersion = displayText(raw.requiredCreatorVersion, 64)
  // Registry canonicalization can legitimately change the submitted path. The store freezes this returned target.
  return result
}
function decodeDirectory(value: unknown): string | undefined {
  const raw = object(value), keys = Object.keys(raw)
  if (keys.length !== 1) throw fail('invalid-shape')
  if (keys[0] === 'cancelled' && raw.cancelled === true) return undefined
  if (keys[0] === 'path') return safePath(raw.path)
  throw fail('invalid-shape')
}
function decodeScaffold(value:unknown):ProjectScaffoldResult {
 const raw=object(value)
 if(Object.keys(raw).sort().join(',')!=='creatorVersion,path'||raw.creatorVersion!=='3.8.8')throw fail('invalid-shape')
 return {path:safePath(raw.path),creatorVersion:'3.8.8'}
}
function decodeStarted(value: unknown): { operationId: string } {
  const raw = object(value)
  required(raw, ['operationId'])
  if (Object.keys(raw).length !== 1) throw fail('invalid-shape')
  return { operationId: operationId(raw.operationId) }
}
function decodeSnapshot(value: unknown, requestedId: string): SetupSnapshot {
  const raw = object(value)
  required(raw, ['id', 'projectPath', 'stage', 'startedAt', 'updatedAt'])
  if (operationId(raw.id) !== requestedId || typeof raw.stage !== 'string' || !SETUP_STAGES.includes(raw.stage as SetupSnapshot['stage'])) throw fail('invalid-shape')
  const result: SetupSnapshot = { id: requestedId, projectPath: safePath(raw.projectPath), stage: raw.stage as SetupSnapshot['stage'], startedAt: date(raw.startedAt), updatedAt: date(raw.updatedAt) }
  if (Object.hasOwn(raw, 'projectId')) result.projectId = projectId(raw.projectId)
  if (Object.hasOwn(raw, 'projectName')) result.projectName = displayText(raw.projectName, 256)
  if (Object.hasOwn(raw, 'bridge')) {
    const bridge = object(raw.bridge)
    required(bridge, ['status', 'version', 'targetPath'])
    if (bridge.status !== 'installed' && bridge.status !== 'updated' && bridge.status !== 'current') throw fail('invalid-shape')
    result.bridge = { status: bridge.status, version: displayText(bridge.version, 64), targetPath: safePath(bridge.targetPath) }
  }
  if (Object.hasOwn(raw, 'runtime')) {
    const runtime = object(raw.runtime)
    required(runtime, ['projectId', 'state'])
    const id = projectId(runtime.projectId)
    if ((result.projectId !== undefined && result.projectId !== id) || typeof runtime.state !== 'string' || !RUNTIME_STATES.includes(runtime.state as typeof RUNTIME_STATES[number])) throw fail('invalid-shape')
    result.runtime = { projectId: id, state: runtime.state as typeof RUNTIME_STATES[number] }
    if (Object.hasOwn(runtime, 'creatorVersion')) result.runtime.creatorVersion = displayText(runtime.creatorVersion, 64)
  }
  if (Object.hasOwn(raw, 'mcpName')) result.mcpName = displayText(raw.mcpName, 256)
  if (Object.hasOwn(raw, 'error')) {
    if (typeof raw.error !== 'string') throw fail('invalid-shape')
    result.failureReported = true
  }
  if (Object.hasOwn(raw, 'errorCode')) {
    if (typeof raw.errorCode !== 'string') throw fail('invalid-shape')
    if (backendCodes.includes(raw.errorCode)) result.errorCode = raw.errorCode
  }
  // Unknown fields, raw errors, details, executable/connection paths, tokens, sessions and PIDs are never projected.
  // Even complete does not prove the submitted options ran: the host may have reused an active path's operation.
  return result
}
function serverFailure(value: unknown, status: number): ProjectSetupError {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('invalid-shape')
  const raw = value as Record<string, unknown>, keys = Object.keys(raw)
  if (status === 403 && keys.length === 1 && keys[0] === 'error' && raw.error === 'Forbidden') return fail('forbidden', 'rejected')
  if (Object.hasOwn(raw, 'error') && typeof raw.error === 'string') return fail('backend-failure')
  return fail('invalid-shape')
}
/** Passive v148 source contract. Only explicit register/start calls write; status is a read, never a backend cancellation. */
export function createProjectSetupProvider(options: { fetch: ProjectSetupFetch; timeoutMs?: number }): ProjectSetupProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('工程配置适配器需要显式注入同源 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? PROJECT_SETUP_LIMITS.timeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > PROJECT_SETUP_LIMITS.timeoutMs) throw new RangeError('工程配置超时必须为 1 至 120000 毫秒。')
  let inFlight: object | undefined, idle = Promise.resolve()
  async function request<T>(path: ProjectSetupPath, method: 'GET' | 'POST', status: number, decode: (raw: unknown) => T, body: string | undefined, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw fail('aborted', 'not-dispatched')
    if (inFlight) throw fail('busy', 'not-dispatched')
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
    // A native dialog waits for the user. Aborting fetch cannot close ShowDialog.
    const timer = path === '/api/pick-directory' ? undefined : setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    const abortError = () => fail(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted', invoked ? 'unknown' : 'not-dispatched')
    try {
      if (signal?.aborted) controller.abort()
      const pending = track(Promise.resolve().then(() => {
        if (controller.signal.aborted) throw abortError()
        invoked = true
        try {
          return Promise.resolve(transport(path, {
            method, mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
            ...(method === 'POST' ? { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body } : { headers: { Accept: 'application/json' } }),
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
      if (!response.ok) throw serverFailure(raw, response.status)
      if (response.status !== status) throw fail('invalid-shape')
      return decode(raw)
    } catch (error) {
      if (controller.signal.aborted) throw abortError()
      if (error instanceof ProjectSetupError && localFailures.has(error)) throw error
      throw fail('network-error', invoked ? 'unknown' : 'not-dispatched')
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release()
      // Logical cancellation never releases unfinished client operations or asserts backend cancellation.
    }
  }
  return Object.freeze({
    label: 'Companion 同源工程登记与完整配置（v148 源码合同，实机未验）',
    waitForIdle: () => idle,
    async pickDirectory(signal) {
      return request('/api/pick-directory', 'POST', 200, decodeDirectory, '{}', signal)
    },
    async scaffold(input,signal){
      let target:ReturnType<typeof validateProjectScaffoldInput>
      try{
        target=validateProjectScaffoldInput(input)
        if(target.mode==='initialize')safePath(target.path)
        else if(safePath(target.parentPath)!==target.parentPath||displayText(target.projectName,128)!==target.projectName)throw fail('invalid-input','not-dispatched')
      }catch{throw fail('invalid-input','not-dispatched')}
      return request('/api/projects/scaffold','POST',201,decodeScaffold,JSON.stringify(target),signal)
    },
    async register(path, signal) {
      let target: string
      try { target = safePath(path) } catch { throw fail('invalid-input', 'not-dispatched') }
      return request('/api/projects', 'POST', 201, decodeProject, JSON.stringify({ path: target }), signal)
    },
    async start(id, signal) {
      let target: string
      try { target = validateSetupProjectId(id) } catch { throw fail('invalid-input', 'not-dispatched') }
      return request('/api/setup', 'POST', 202, decodeStarted, JSON.stringify({ projectId: target, startCreator: true, configureCodex: true }), signal)
    },
    async status(id, signal) {
      let target: string
      try { target = validateSetupOperationId(id) } catch { throw fail('invalid-input', 'not-dispatched') }
      return request(`/api/setup/${target}`, 'GET', 200, raw => decodeSnapshot(raw, target), undefined, signal)
    },
  } satisfies ProjectSetupProvider)
}
