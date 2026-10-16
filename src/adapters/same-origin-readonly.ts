import type { Project, ReadOnlyCompanionProvider, ServiceState, ServiceStatus, WorkspaceSnapshot } from '../domain/contracts'

/** Only these verified v133 read routes can be requested by this adapter. */
export type ReadEndpoint = '/api/projects' | '/api/status'
export type ReadFailureCode = 'unauthorized' | 'forbidden' | 'timeout' | 'aborted' | 'invalid-shape' | 'response-too-large' | 'http-error' | 'network-error'
export interface ReadFailure { endpoint: ReadEndpoint; code: ReadFailureCode; status?: number }
export type AdapterErrorCode = ReadFailureCode | 'all-reads-failed' | 'busy'
export type ReadOnlyFetch = (input: ReadEndpoint, init: RequestInit) => Promise<Response>

const failureText: Record<AdapterErrorCode, string> = {
  unauthorized: '需要已有的 Companion 会话（401）。',
  forbidden: 'Companion 拒绝读取（403），需核实会话与同源条件。',
  timeout: '只读查询超时。',
  aborted: '只读查询已取消。',
  'invalid-shape': '响应不符合已核实的只读契约。',
  'response-too-large': '响应超出只读查询的安全预算。',
  'http-error': '只读接口返回失败状态。',
  'network-error': '只读接口未能完成连接。',
  'all-reads-failed': '两个只读接口均未取得有效数据。',
  busy: '已有只读查询正在进行，请取消或等待其结束。',
}

/** Deliberately contains no upstream error body, filesystem path or credential. */
export class ReadOnlyAdapterError extends Error {
  readonly code: AdapterErrorCode
  readonly failures: readonly ReadFailure[]
  constructor(code: AdapterErrorCode, failures: readonly ReadFailure[] = []) {
    super(code === 'all-reads-failed' && failures.length
      ? `${failureText[code]} ${failures.map((failure) => `${failure.endpoint} [${failure.code}]：${failureText[failure.code]}`).join(' ')}`
      : failureText[code])
    this.name = code === 'aborted' ? 'AbortError' : 'ReadOnlyAdapterError'
    this.code = code
    this.failures = Object.freeze(failures.map((failure) => Object.freeze({ ...failure })))
  }
}

export const READ_ONLY_LIMITS = Object.freeze({
  requestsPerSnapshot: 2,
  maxResponseBytes: 131_072,
  maxResponseChunks: 1024,
  maxRecordsPerEndpoint: 200,
  defaultTimeoutMs: 4000,
  maxTimeoutMs: 10_000,
})

const runtimeStates = ['stopped', 'launching', 'bridge-wait', 'ready', 'stopping', 'crashed', 'incompatible', 'error'] as const
type RuntimeState = typeof runtimeStates[number]
interface RuntimeRead { projectId: string; state: RuntimeState; creatorVersion?: string }
interface SuccessfulRead<T> { value: T; observedAt: string }

const compatibilityLimits = [
  '适配依据为 v133 历史源码；当前旧版协议与完整功能兼容性仍待核验。',
  '仅查询工程登记与 Creator / Bridge 状态；没有读取资源、规格、审批、导入、绑定或运行验收证据。',
  '模型服务、知识库与 Companion 源码修订号未读取；HTTP 成功不代表所有服务就绪。',
  '这是一次有界快照，无自动轮询或 SSE 订阅；两次查询非原子同步，来源时间为最后一次有效读取时间。',
]

function fail(endpoint: ReadEndpoint, code: ReadFailureCode, status?: number): ReadOnlyAdapterError {
  return new ReadOnlyAdapterError(code, [{ endpoint, code, ...(status === undefined ? {} : { status }) }])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value)
}

function validName(value: unknown): value is string {
  // Registered project names are names, not filesystem paths or display markup.
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160
    && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\\/<>]/u.test(value)
}

function validVersion(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= 64
    && /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(value))
}

function readArray(value: unknown, endpoint: ReadEndpoint): unknown[] {
  if (!Array.isArray(value) || value.length > READ_ONLY_LIMITS.maxRecordsPerEndpoint) throw fail(endpoint, 'invalid-shape')
  return value
}

function decodeProjects(value: unknown): Project[] {
  const ids = new Set<string>()
  return readArray(value, '/api/projects').map((entry) => {
    if (!isRecord(entry) || !validId(entry.id) || !validName(entry.name)
      || !validVersion(entry.requiredCreatorVersion) || ids.has(entry.id)) throw fail('/api/projects', 'invalid-shape')
    ids.add(entry.id)
    // Explicit field projection. Never spread remote objects into UI data.
    return {
      id: entry.id,
      name: entry.name.trim(),
      ...(entry.requiredCreatorVersion === undefined ? {} : { engineVersion: entry.requiredCreatorVersion }),
      styleApproval: 'unknown',
      protectedAssets: null,
    }
  })
}

function decodeStatuses(value: unknown): RuntimeRead[] {
  const ids = new Set<string>()
  return readArray(value, '/api/status').map((entry) => {
    if (!isRecord(entry) || !validId(entry.projectId) || typeof entry.state !== 'string'
      || !runtimeStates.some((state) => state === entry.state) || !validVersion(entry.creatorVersion)
      || ids.has(entry.projectId)) throw fail('/api/status', 'invalid-shape')
    ids.add(entry.projectId)
    return {
      projectId: entry.projectId,
      state: entry.state as RuntimeState,
      ...(entry.creatorVersion === undefined ? {} : { creatorVersion: entry.creatorVersion }),
    }
  })
}

function discardBody(response: Response): void {
  try { void response.body?.cancel().catch(() => undefined) } catch { /* No response text is retained. */ }
}

/** The abort race also settles injected transports that do not honor the signal. */
function abortable<T>(pending: Promise<T>, signal: AbortSignal, error: () => ReadOnlyAdapterError): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(error()) }
    signal.addEventListener('abort', abort, { once: true })
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}

async function readBoundedJson(response: Response, endpoint: ReadEndpoint, signal: AbortSignal, abortError: () => ReadOnlyAdapterError): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > READ_ONLY_LIMITS.maxResponseBytes) {
    discardBody(response)
    throw fail(endpoint, 'response-too-large')
  }
  if (!response.body) throw fail(endpoint, 'invalid-shape')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let total = 0
  let chunks = 0
  let text = ''
  let complete = false
  try {
    while (true) {
      const result = await abortable(reader.read(), signal, abortError)
      if (result.done) break
      total += result.value.byteLength
      chunks += 1
      if (total > READ_ONLY_LIMITS.maxResponseBytes || chunks > READ_ONLY_LIMITS.maxResponseChunks) throw fail(endpoint, 'response-too-large')
      text += decoder.decode(result.value, { stream: true })
    }
    text += decoder.decode()
    complete = true
    try { return JSON.parse(text) as unknown } catch { throw fail(endpoint, 'invalid-shape') }
  } catch (error) {
    if (error instanceof ReadOnlyAdapterError) throw error
    // A truncated body, invalid UTF-8, or a body read failure is not valid evidence.
    throw fail(endpoint, 'invalid-shape')
  } finally {
    if (!complete) { try { void reader.cancel().catch(() => undefined) } catch { /* Already closed. */ } }
    try { reader.releaseLock() } catch { /* An uncooperative transport may still have a pending read. */ }
  }
}

const runtimeProjection: Record<RuntimeState, { state: ServiceState; detail: string }> = {
  ready: { state: 'available', detail: '后端报告该工程 Creator / Bridge 已就绪；未执行导入、绑定或运行验收。' },
  stopped: { state: 'unavailable', detail: '后端报告该工程已停止。' },
  launching: { state: 'degraded', detail: '后端报告该工程正在启动，尚未就绪。' },
  'bridge-wait': { state: 'degraded', detail: '后端报告该工程正在等待 Bridge，尚未就绪。' },
  stopping: { state: 'degraded', detail: '后端报告该工程正在停止。' },
  crashed: { state: 'unavailable', detail: '后端报告该工程异常退出；未展示原始错误正文。' },
  incompatible: { state: 'degraded', detail: '后端报告该工程存在兼容性问题，不能视为已就绪。' },
  error: { state: 'unavailable', detail: '后端报告该工程发生错误；未展示原始错误正文。' },
}

function projectServices(projects: Project[], statuses: SuccessfulRead<RuntimeRead[]> | undefined): ServiceStatus[] {
  const byId = new Map(statuses?.value.map((entry) => [entry.projectId, entry]) ?? [])
  // Status-only records remain visible without inventing registered projects.
  const ids = new Set([...projects.map((project) => project.id), ...byId.keys()])
  const names = new Map(projects.map((project) => [project.id, project.name]))
  return [...ids].map((id) => {
    const status = byId.get(id)
    return {
      id: `creator:${id}`,
      name: names.has(id) ? `${names.get(id)} · Creator / Bridge` : '未关联工程 · Creator / Bridge',
      role: '单个工程的后端运行状态',
      ...(status ? runtimeProjection[status.state] : { state: 'unknown' as const, detail: '没有取得该工程的运行状态，不能判定是否就绪。' }),
      ...(status && statuses ? { checkedAt: statuses.observedAt } : {}),
      ...(status?.creatorVersion === undefined ? {} : { version: status.creatorVersion }),
    }
  })
}

/**
 * Passive factory: construction does not register, authenticate or connect.
 * The host may explicitly inject same-origin browser fetch after deployment review.
 * There is deliberately no base URL, token, proxy, polling or write operation.
 */
export function createSameOriginReadOnlyProvider(options: { fetch: ReadOnlyFetch; timeoutMs?: number }): ReadOnlyCompanionProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('只读适配器需要显式注入 fetch。')
  const transport = options.fetch
  const requestedTimeout = options.timeoutMs ?? READ_ONLY_LIMITS.defaultTimeoutMs
  if (!Number.isFinite(requestedTimeout) || requestedTimeout < 1 || requestedTimeout > READ_ONLY_LIMITS.maxTimeoutMs) {
    throw new RangeError('只读查询超时必须为 1 至 10000 毫秒。')
  }
  let activeLoad: object | null = null
  return Object.freeze({
    mode: 'live' as const,
    label: 'Companion 同源只读接口（v133 契约待核对）',
    async loadSnapshot(signal?: AbortSignal): Promise<WorkspaceSnapshot> {
      if (signal?.aborted) throw new ReadOnlyAdapterError('aborted')
      if (activeLoad) throw new ReadOnlyAdapterError('busy')
      const loadIdentity = {}
      activeLoad = loadIdentity
      const controller = new AbortController()
      let cancelled = false
      let timedOut = false
      const cancel = () => {
        cancelled = true
        // A store may abort and immediately start its replacement load in one turn.
        if (activeLoad === loadIdentity) activeLoad = null
        controller.abort()
      }
      signal?.addEventListener('abort', cancel, { once: true })
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, requestedTimeout)

      async function read<T>(endpoint: ReadEndpoint, decode: (body: unknown) => T): Promise<SuccessfulRead<T>> {
        const abortError = () => fail(endpoint, cancelled ? 'aborted' : timedOut ? 'timeout' : 'aborted')
        try {
          if (controller.signal.aborted) throw abortError()
          const pending = Promise.resolve().then(() => {
            if (controller.signal.aborted) throw abortError()
            return transport(endpoint, {
              method: 'GET', mode: 'same-origin', credentials: 'same-origin', redirect: 'error',
              cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
            })
          })
          // Dispose a late response from an injected transport after cancellation.
          void pending.then((response) => { if (controller.signal.aborted) discardBody(response) }, () => undefined)
          const response = await abortable(pending, controller.signal, abortError)
          if (response.status === 401 || response.status === 403) {
            discardBody(response)
            throw fail(endpoint, response.status === 401 ? 'unauthorized' : 'forbidden', response.status)
          }
          if (!response.ok) { discardBody(response); throw fail(endpoint, 'http-error', response.status) }
          if (response.redirected || !/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) {
            discardBody(response)
            throw fail(endpoint, 'invalid-shape')
          }
          const value = decode(await readBoundedJson(response, endpoint, controller.signal, abortError))
          if (controller.signal.aborted) throw abortError()
          return { value, observedAt: new Date().toISOString() }
        } catch (error) {
          if (controller.signal.aborted) throw abortError()
          if (error instanceof ReadOnlyAdapterError) throw error
          throw fail(endpoint, 'network-error')
        }
      }

      try {
        const [projectsResult, statusesResult] = await Promise.allSettled([
          read('/api/projects', decodeProjects), read('/api/status', decodeStatuses),
        ])
        // Explicit user cancellation must never publish a partial stale snapshot.
        if (cancelled || signal?.aborted) throw new ReadOnlyAdapterError('aborted')
        const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : undefined
        const statuses = statusesResult.status === 'fulfilled' ? statusesResult.value : undefined
        const failures = [projectsResult, statusesResult].flatMap((result) => result.status === 'rejected'
          ? (result.reason as ReadOnlyAdapterError).failures : [])
        if (!projects && !statuses) throw new ReadOnlyAdapterError('all-reads-failed', failures)
        const observedAt = [projects?.observedAt, statuses?.observedAt].filter((value): value is string => value !== undefined).sort().at(-1)!
        const partial = failures.map((failure) => `部分读取失败 ${failure.endpoint} [${failure.code}]${failure.status === undefined ? '' : ` HTTP ${failure.status}`}：${failureText[failure.code]}`)
        const missingStatuses = projects?.value.some((project) => !statuses?.value.some((status) => status.projectId === project.id))
        const unlinkedStatuses = statuses?.value.some((status) => !projects?.value.some((project) => project.id === status.projectId))
        return {
          projects: projects?.value ?? [],
          resources: [],
          services: [
            { id: 'companion-read-api', name: 'Companion 只读接口', role: '工程登记与运行状态查询',
              state: failures.length ? 'degraded' : 'available', checkedAt: observedAt,
              detail: failures.length ? '仅部分接口取得有效数据；其他服务状态仍需分别核实。' : '两个只读接口取得有效数据；其他服务状态仍需分别核实。' },
            ...projectServices(projects?.value ?? [], statuses),
            { id: 'model-service', name: '模型服务', role: '未包含在本次只读查询中', state: 'unknown', detail: '没有读取状态。' },
            { id: 'knowledge-service', name: '知识库服务', role: '未包含在本次只读查询中', state: 'unknown', detail: '没有读取状态。' },
          ],
          source: {
            label: 'Companion 同源只读快照', observedAt,
            limitations: [...compatibilityLimits, ...partial,
              ...(missingStatuses ? ['部分已登记工程缺少运行状态，已保留为未知。'] : []),
              ...(unlinkedStatuses ? ['部分运行状态没有匹配的工程登记；没有据此创建工程。'] : [])],
          },
        }
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', cancel)
        if (activeLoad === loadIdentity) activeLoad = null
      }
    },
  })
}
