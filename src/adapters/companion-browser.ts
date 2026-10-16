import { LOG_LEVELS, LOG_SOURCES, RUNTIME_STATES } from '../domain/companion-browser'
import type { CallCounts, CallLatest, CallPage, CallRecord, CapabilityProfile, CompanionBrowserProvider, DashboardProject, LogFilter, LogLevel, LogRecord, LogSource, ManagedProject, ManagedStatus, RuntimeState } from '../domain/companion-browser'

export type CompanionReadPath = '/api/projects' | '/api/status' | '/api/dashboard/projects' | '/api/calls/counts' | `/api/logs?${string}` | `/api/projects/${string}/calls?${string}`
export type CompanionFetch = (input: CompanionReadPath, init: RequestInit) => Promise<Response>
export type CompanionReadCode = 'unauthorized' | 'forbidden' | 'timeout' | 'aborted' | 'invalid-shape' | 'response-too-large' | 'http-error' | 'network-error' | 'invalid-query' | 'busy'
type Endpoint = 'projects' | 'status' | 'dashboard' | 'logs' | 'counts' | 'calls'
const failureText: Record<CompanionReadCode, string> = {
  unauthorized: '需要已有的 Companion 会话（401）。', forbidden: 'Companion 拒绝读取（403），请核对已有会话与同源部署。',
  timeout: '只读查询超时。', aborted: '只读查询已取消。', 'invalid-shape': '响应不符合已核实的 v148 只读契约。',
  'response-too-large': '响应超出只读查询的安全预算。', 'http-error': '只读接口返回失败状态。',
  'network-error': '只读接口未能完成连接。', 'invalid-query': '只读查询参数无效。', busy: '并行只读查询已达到上限。',
}
/** No raw URL, query, response body, cause, transport error, path or credential is included. */
export class CompanionBrowserError extends Error {
  constructor(readonly code: CompanionReadCode, readonly endpoint?: Endpoint, readonly status?: number) {
    super(`${endpoint ? `${endpoint}: ` : ''}${failureText[code]}`)
    this.name = code === 'aborted' ? 'AbortError' : 'CompanionBrowserError'
  }
}
export const COMPANION_READ_LIMITS = Object.freeze({
  maxResponseBytes: 1_048_576, maxResponseChunks: 2048, maxProjects: 200, maxDashboardProjects: 500,
  maxLogs: 1000, defaultLogLimit: 200, maxCallsPerPage: 50, maxRetainedCalls: 1000,
  maxConcurrentRequests: 6, maxFilterValues: 200, maxSearchLength: 512,
  defaultTimeoutMs: 4000, maxTimeoutMs: 10_000,
})
/** Defense in depth for display-only error/log summaries; adapted from v148 call-history cleanText. */
function displayText(value: string): string {
  return value
    .replace(/data:[^\s;,]+;base64,[\w+/=\r\n]+/gi, '[image/data omitted]')
    .replace(/\b[A-Za-z0-9+/]{160,}={0,2}\b/g, '[large data omitted]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\b(Bearer|Basic)\s+[^\s,;"'}]+/gi, '$1 [redacted]')
    .replace(/((?:token|password|passwd|authorization|secret|api[-_]?key|credential)[\w-]*["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*')/gi, '$1[redacted]')
    .replace(/\bcookie\s*:\s*[^\r\n]+/gi, 'cookie: [redacted]')
    .replace(/((?:token|password|passwd|authorization|secret|api[-_]?key|credential)[\w-]*["']?\s*[:=]\s*)["']?[^\s&,;"'}]+["']?/gi, '$1[redacted]')
}
const fail = (endpoint: Endpoint, code: CompanionReadCode, status?: number) => new CompanionBrowserError(code, endpoint, status)
function record(value: unknown, endpoint: Endpoint): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail(endpoint, 'invalid-shape')
  return value as Record<string, unknown>
}
function list(value: unknown, endpoint: Endpoint, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw fail(endpoint, 'invalid-shape')
  return value
}
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
function id(value: unknown, endpoint: Endpoint): string {
  if (!validId(value)) throw fail(endpoint, 'invalid-shape')
  return value
}
function text(value: unknown, endpoint: Endpoint, max = 256, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw fail(endpoint, 'invalid-shape')
  return value
}
function count(value: unknown, endpoint: Endpoint, min = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) throw fail(endpoint, 'invalid-shape')
  return value
}
function time(value: unknown, endpoint: Endpoint): string {
  const result = text(value, endpoint, 64)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) throw fail(endpoint, 'invalid-shape')
  return result
}
function oneOf<T extends string>(value: unknown, values: readonly T[], endpoint: Endpoint): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw fail(endpoint, 'invalid-shape')
  return value as T
}
function knownOrUnknown<T extends string>(value: unknown, values: readonly T[]): T | 'unknown' {
  return typeof value === 'string' && values.includes(value as T) ? value as T : 'unknown'
}
function optionalText(value: unknown, endpoint: Endpoint, max = 256): string | undefined { return value === undefined ? undefined : text(value, endpoint, max, true) }
function unique<T>(values: T[], key: (value: T) => string, endpoint: Endpoint): T[] {
  if (new Set(values.map(key)).size !== values.length) throw fail(endpoint, 'invalid-shape')
  return values
}
function decodeProjects(value: unknown): ManagedProject[] {
  return unique(list(value, 'projects', COMPANION_READ_LIMITS.maxProjects).map((raw) => {
    const item = record(raw, 'projects')
    const version = optionalText(item.requiredCreatorVersion, 'projects', 64)
    return { id: id(item.id, 'projects'), name: text(item.name, 'projects', 256), path: text(item.path, 'projects', 4096), ...(version === undefined ? {} : { requiredCreatorVersion: version }) }
  }), (item) => item.id, 'projects')
}
function decodeStatuses(value: unknown): ManagedStatus[] {
  return unique(list(value, 'status', COMPANION_READ_LIMITS.maxProjects).map((raw) => {
    const item = record(raw, 'status')
    const result: ManagedStatus = {
      projectId: id(item.projectId, 'status'), state: knownOrUnknown(item.state, RUNTIME_STATES) as RuntimeState,
      capabilityProfile: knownOrUnknown(item.capabilityProfile, ['read-only', 'authoring', 'full-control']) as CapabilityProfile,
    }
    for (const key of ['creatorVersion', 'dashboardVersion', 'dashboardProgress', 'instanceId', 'sessionId'] as const) {
      const value = optionalText(item[key], 'status', key.endsWith('Version') ? 64 : 256)
      if (value !== undefined) result[key] = value
    }
    if (item.lastError !== undefined) result.lastError = displayText(text(item.lastError, 'status', 8192, true))
    if (item.launchSource === 'dashboard') result.launchSource = 'dashboard'
    if (item.pid !== undefined) result.pid = count(item.pid, 'status', 1)
    return result
  }), (item) => item.projectId, 'status')
}
function decodeDashboard(value: unknown): DashboardProject[] {
  return unique(list(value, 'dashboard', COMPANION_READ_LIMITS.maxDashboardProjects).map((raw) => {
    const item = record(raw, 'dashboard')
    if (typeof item.exists !== 'boolean') throw fail('dashboard', 'invalid-shape')
    const result: DashboardProject = { path: text(item.path, 'dashboard', 4096), name: text(item.name, 'dashboard', 256), source: knownOrUnknown(item.source, ['dashboard', 'creator-editor']), exists: item.exists }
    for (const key of ['version', 'progress', 'state'] as const) {
      const value = optionalText(item[key], 'dashboard', 256)
      if (value !== undefined) result[key] = value
    }
    if (item.lastOpenedAt !== undefined) {
      if (typeof item.lastOpenedAt !== 'number' || !Number.isFinite(item.lastOpenedAt) || item.lastOpenedAt < 0 || item.lastOpenedAt > Number.MAX_SAFE_INTEGER) throw fail('dashboard', 'invalid-shape')
      result.lastOpenedAt = item.lastOpenedAt
    }
    if (item.running !== undefined) {
      if (typeof item.running !== 'boolean') throw fail('dashboard', 'invalid-shape')
      result.running = item.running
    }
    if (item.pid !== undefined) result.pid = count(item.pid, 'dashboard', 1)
    return result
  }), (item) => item.path, 'dashboard')
}
function decodeLogs(value: unknown, limit: number): LogRecord[] {
  return unique(list(value, 'logs', limit).map((raw) => {
    const item = record(raw, 'logs')
    const result: LogRecord = {
      id: id(item.id, 'logs'), projectId: id(item.projectId, 'logs'), source: knownOrUnknown(item.source, LOG_SOURCES), level: knownOrUnknown(item.level, LOG_LEVELS),
      time: time(item.time, 'logs'), message: displayText(text(item.message, 'logs', 8192, true)),
    }
    for (const key of ['instanceId', 'sessionId', 'operationId'] as const) {
      const value = optionalText(item[key], 'logs', 256)
      if (value !== undefined) result[key] = value
    }
    return result
  }), (item) => item.id, 'logs')
}
function decodeLatest(value: unknown, endpoint: 'counts' | 'calls'): CallLatest {
  const item = record(value, endpoint)
  const result: CallLatest = { id: id(item.id, endpoint), operationNameZh: text(item.operationNameZh, endpoint, 2000), startedAt: time(item.startedAt, endpoint), status: oneOf(item.status, ['running', 'success', 'failed'], endpoint) }
  if (item.durationMs !== undefined) result.durationMs = count(item.durationMs, endpoint)
  return result
}
function decodeCounts(value: unknown): CallCounts {
  const item = record(value, 'counts')
  const rawCounts = record(item.counts, 'counts')
  const rawLatest = record(item.latest, 'counts')
  if (Object.keys(rawCounts).length > COMPANION_READ_LIMITS.maxProjects || Object.keys(rawLatest).length > COMPANION_READ_LIMITS.maxProjects) throw fail('counts', 'invalid-shape')
  const counts: CallCounts['counts'] = Object.create(null)
  const latest: CallCounts['latest'] = Object.create(null)
  for (const [key, value] of Object.entries(rawCounts)) counts[id(key, 'counts')] = count(value, 'counts')
  for (const [key, value] of Object.entries(rawLatest)) {
    if (!Object.hasOwn(counts, key) || counts[key]! < 1) throw fail('counts', 'invalid-shape')
    latest[id(key, 'counts')] = decodeLatest(value, 'counts')
  }
  return { sessionId: id(item.sessionId, 'counts'), counts, latest }
}
/** Shared v148 call projection for HTTP pages and the bounded SSE call envelope. */
export function decodeCalls(value: unknown, projectId: string, options: { failed: boolean; before?: number }): CallPage {
  const item = record(value, 'calls')
  const total = count(item.total, 'calls')
  const retained = count(item.retained, 'calls')
  if (retained > total || retained > COMPANION_READ_LIMITS.maxRetainedCalls) throw fail('calls', 'invalid-shape')
  const records: CallRecord[] = unique(list(item.records, 'calls', COMPANION_READ_LIMITS.maxCallsPerPage).map((raw) => {
    const entry = record(raw, 'calls')
    const latest = decodeLatest(entry, 'calls')
    const result: CallRecord = {
      ...latest, sequence: count(entry.sequence, 'calls', 1), projectId: id(entry.projectId, 'calls'), operation: text(entry.operation, 'calls', 2000),
      source: oneOf(entry.source, ['mcp', 'cli', 'web'], 'calls'), inputSummary: displayText(text(entry.inputSummary, 'calls', 2000, true)),
    }
    for (const key of ['resultSummary', 'errorSummary'] as const) {
      const value = optionalText(entry[key], 'calls', 2000)
      if (value !== undefined) result[key] = displayText(value)
    }
    if (result.projectId !== projectId || result.sequence > total || (options.before !== undefined && result.sequence >= options.before) || (options.failed && result.status !== 'failed')) throw fail('calls', 'invalid-shape')
    return result
  }), (entry) => entry.id, 'calls')
  if (records.length > retained || records.some((entry, index) => index > 0 && entry.sequence >= records[index - 1]!.sequence)) throw fail('calls', 'invalid-shape')
  const result: CallPage = { sessionId: id(item.sessionId, 'calls'), total, retained, records }
  if (item.nextBefore !== undefined) {
    const next = count(item.nextBefore, 'calls', 1)
    if (!records.length || next !== records.at(-1)!.sequence || next <= 1 || (options.before !== undefined && next >= options.before)) throw fail('calls', 'invalid-shape')
    result.nextBefore = next
  }
  return result
}
function discardBody(response: Response): void { try { void response.body?.cancel().catch(() => undefined) } catch { /* No body retained. */ } }
function abortable<T>(pending: Promise<T>, signal: AbortSignal, error: () => CompanionBrowserError): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(error()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, endpoint: Endpoint, signal: AbortSignal, abortError: () => CompanionBrowserError): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > COMPANION_READ_LIMITS.maxResponseBytes) { discardBody(response); throw fail(endpoint, 'response-too-large') }
  if (!response.body) throw fail(endpoint, 'invalid-shape')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const result = await abortable(reader.read(), signal, abortError)
      if (result.done) break
      bytes += result.value.byteLength
      if (bytes > COMPANION_READ_LIMITS.maxResponseBytes || ++chunks > COMPANION_READ_LIMITS.maxResponseChunks) throw fail(endpoint, 'response-too-large')
      body += decoder.decode(result.value, { stream: true })
    }
    body += decoder.decode()
    complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail(endpoint, 'invalid-shape') }
  } catch (error) {
    if (error instanceof CompanionBrowserError) throw error
    throw fail(endpoint, 'invalid-shape')
  } finally {
    if (!complete) { try { void reader.cancel().catch(() => undefined) } catch { /* Already closed. */ } }
    try { reader.releaseLock() } catch { /* An injected reader may still be pending. */ }
  }
}
function logQuery(filter: LogFilter): { path: CompanionReadPath; limit: number; sources?: readonly LogSource[]; levels?: readonly LogLevel[] } {
  if (!filter || typeof filter !== 'object') throw fail('logs', 'invalid-query')
  const query = new URLSearchParams()
  const add = (key: string, values: readonly string[] | undefined, valid: (value: unknown) => boolean) => {
    if (values === undefined) return
    if (!Array.isArray(values) || values.length > COMPANION_READ_LIMITS.maxFilterValues || values.some((value) => !valid(value))) throw fail('logs', 'invalid-query')
    for (const value of new Set(values)) query.append(key, value)
  }
  add('projectId', filter.projectIds, validId)
  // "unknown" is a client-only fallback. Fetch broadly for that facet, then filter the projection.
  add('source', filter.sources, (value) => typeof value === 'string' && [...LOG_SOURCES, 'unknown'].includes(value as LogSource))
  add('level', filter.levels, (value) => typeof value === 'string' && [...LOG_LEVELS, 'unknown'].includes(value as LogLevel))
  const unknownSource = filter.sources?.includes('unknown') ?? false
  const unknownLevel = filter.levels?.includes('unknown') ?? false
  if (unknownSource) query.delete('source')
  if (unknownLevel) query.delete('level')
  if (filter.search !== undefined) {
    if (typeof filter.search !== 'string' || filter.search.length > COMPANION_READ_LIMITS.maxSearchLength || /[\u0000-\u001f\u007f]/u.test(filter.search)) throw fail('logs', 'invalid-query')
    if (filter.search) query.set('search', filter.search)
  }
  const limit = filter.limit ?? COMPANION_READ_LIMITS.defaultLogLimit
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > COMPANION_READ_LIMITS.maxLogs) throw fail('logs', 'invalid-query')
  query.set('limit', String(limit))
  return { path: `/api/logs?${query}`, limit, ...(unknownSource ? { sources: [...filter.sources!] } : {}), ...(unknownLevel ? { levels: [...filter.levels!] } : {}) }
}
/** Passive, manually invoked same-origin GET client. It never creates an EventSource or accepts a base URL/token. */
export function createCompanionBrowserProvider(options: { fetch: CompanionFetch; timeoutMs?: number; runtimeProbes?: boolean; dashboardDiscovery?: boolean }): CompanionBrowserProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('只读适配器需要显式注入 fetch。')
  const transport = options.fetch
  const timeoutMs = options.timeoutMs ?? COMPANION_READ_LIMITS.defaultTimeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > COMPANION_READ_LIMITS.maxTimeoutMs) throw new RangeError('只读查询超时必须为 1 至 10000 毫秒。')
  const inFlight = new Set<object>()
  async function read<T>(path: CompanionReadPath, endpoint: Endpoint, decode: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw fail(endpoint, 'aborted')
    if (inFlight.size >= COMPANION_READ_LIMITS.maxConcurrentRequests) throw fail(endpoint, 'busy')
    const identity = {}
    inFlight.add(identity)
    const controller = new AbortController()
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
      if (response.redirected || response.type === 'opaque' || !/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discardBody(response); throw fail(endpoint, 'invalid-shape') }
      const value = decode(await boundedJson(response, endpoint, controller.signal, abortError))
      if (controller.signal.aborted) throw abortError()
      return value
    } catch (error) {
      if (controller.signal.aborted) throw abortError()
      if (error instanceof CompanionBrowserError) throw error
      throw fail(endpoint, 'network-error')
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); inFlight.delete(identity) }
  }
  const runtimeProbesEnabled = options.runtimeProbes !== false
  const dashboardDiscoveryEnabled = runtimeProbesEnabled && options.dashboardDiscovery !== false
  return Object.freeze({
    label: runtimeProbesEnabled ? (dashboardDiscoveryEnabled ? 'Companion 同源查询接口（含运行与 Dashboard 发现）' : 'Companion 正常工程模式（真实状态，不自动发现 Dashboard）') : 'Companion 同源登记与记录（不探测运行状态）',
    runtimeProbesEnabled,
    dashboardDiscoveryEnabled,
    async loadProjects(signal?: AbortSignal) {
      if (!runtimeProbesEnabled) {
        const projects = await read('/api/projects', 'projects', decodeProjects, signal)
        return { projects, statuses: [], dashboard: [], warnings: ['运行状态未探测；未请求 Bridge 状态或 Dashboard / CIM 发现。空状态列表不代表工程已停止，最近打开时间也未读取。'] }
      }
      const [projects, statuses, dashboard] = await Promise.allSettled([
        read('/api/projects', 'projects', decodeProjects, signal), read('/api/status', 'status', decodeStatuses, signal), dashboardDiscoveryEnabled ? read('/api/dashboard/projects', 'dashboard', decodeDashboard, signal) : Promise.resolve([] as DashboardProject[]),
      ])
      if (signal?.aborted) throw fail('projects', 'aborted')
      if (projects.status === 'rejected') throw projects.reason
      const statusValues = statuses.status === 'fulfilled' ? statuses.value : []
      const warnings = statuses.status === 'rejected' ? [`运行状态未取得有效数据：[${(statuses.reason as CompanionBrowserError).code}]。空状态列表不能证明服务为 0 或工程已停止；所有缺少状态的工程须显示为未知。`] : []
      if (!dashboardDiscoveryEnabled) warnings.push('Dashboard 发现未启用；最近打开时间未读取。运行状态来自本次 Bridge 状态查询。')
      warnings.push(...(dashboard.status === 'rejected' ? [`Dashboard 工程列表未取得有效数据：[${(dashboard.reason as CompanionBrowserError).code}]。空列表不能证明没有 Dashboard 工程。`] : []))
      if (projects.value.some((project) => !statusValues.some((status) => status.projectId === project.id))) warnings.push('部分登记工程缺少状态，须显示为未知。')
      if (statusValues.some((status) => !projects.value.some((project) => project.id === status.projectId))) warnings.push('部分运行状态没有对应工程登记，未据此创建工程。')
      return { projects: projects.value, statuses: statusValues, dashboard: dashboard.status === 'fulfilled' ? dashboard.value : [], warnings }
    },
    async loadLogs(filter: LogFilter, signal?: AbortSignal) {
      const query = logQuery(filter)
      const logs = await read(query.path, 'logs', (body) => decodeLogs(body, query.limit), signal)
      return logs.filter((entry) => (!query.sources || query.sources.includes(entry.source)) && (!query.levels || query.levels.includes(entry.level)))
    },
    loadCounts(signal?: AbortSignal) { return read('/api/calls/counts', 'counts', decodeCounts, signal) },
    async loadCalls(projectId: string, options: { failed: boolean; before?: number }, signal?: AbortSignal) {
      if (!validId(projectId) || !options || typeof options.failed !== 'boolean' || (options.before !== undefined && (!Number.isSafeInteger(options.before) || options.before < 1))) throw fail('calls', 'invalid-query')
      const selection = { failed: options.failed, before: options.before }
      const query = new URLSearchParams({ limit: String(COMPANION_READ_LIMITS.maxCallsPerPage) })
      if (selection.failed) query.set('status', 'failed')
      if (selection.before !== undefined) query.set('before', String(selection.before))
      return read(`/api/projects/${encodeURIComponent(projectId)}/calls?${query}`, 'calls', (body) => decodeCalls(body, projectId, selection), signal)
    },
  })
}
