import { isKnowledgeRequestId, KNOWLEDGE_POLICY_REASONS, KNOWLEDGE_SCHEMA } from '../domain/knowledge-read'
import type { KnowledgeAgent, KnowledgeBase, KnowledgeChunk, KnowledgeDocument, KnowledgeDocumentDownload, KnowledgeIssue, KnowledgeReadProvider, KnowledgeResult, KnowledgeSearchResponse, KnowledgeServiceStates, KnowledgeSource, KnowledgeStatus } from '../domain/knowledge-read'

const PATHS = {
  status: '/api/knowledge/status', knowledgeService: '/api/knowledge-service/status', modelService: '/api/model-service/status',
  search: '/api/knowledge/search', kbList: '/api/knowledge/kb/list', kbView: '/api/knowledge/kb/view',
  docList: '/api/knowledge/doc/list', docView: '/api/knowledge/doc/view', docDownload: '/api/knowledge/doc/download',
  chunkList: '/api/knowledge/chunk/list', agentList: '/api/knowledge/agent/list',
} as const
export type KnowledgeReadPath = typeof PATHS[keyof typeof PATHS]
export type KnowledgeFetch = (input: KnowledgeReadPath, init: RequestInit) => Promise<Response>
type Endpoint = keyof typeof PATHS
export type KnowledgeReadCode = 'unauthorized' | 'forbidden' | 'timeout' | 'aborted' | 'invalid-shape' | 'response-too-large' | 'http-error' | 'network-error' | 'invalid-query' | 'busy'
const messages: Record<KnowledgeReadCode, string> = {
  unauthorized: '需要已有的 Companion 会话或知识库只读身份（401）。', forbidden: 'Companion 会话或知识库访问范围拒绝读取（403）。',
  timeout: '知识库只读查询超时。', aborted: '知识库只读查询已取消。', 'invalid-shape': '响应不符合已核实的 v148 知识库读取契约。',
  'response-too-large': '知识库响应超出安全读取预算。', 'http-error': '知识库只读接口返回失败状态。',
  'network-error': '未能完成同源知识库连接。', 'invalid-query': '知识库查询参数无效。', busy: '知识库已有读取正在进行，请等待或取消。',
}
const backendMessages = {
  CLI_UNAVAILABLE: '知识库 CLI 不可用。', CLI_INCOMPATIBLE: '知识库 CLI 版本或能力不兼容。', AUTH_MISSING: '知识库只读身份尚未配置。',
  AUTH_DENIED: '知识库身份或访问范围被拒绝。', UPSTREAM_UNAVAILABLE: '知识库服务暂不可用。', TIMEOUT: '知识库操作超时。',
  CANCELLED: '知识库操作已取消。', SCHEMA_INVALID: '知识库请求或响应格式不符合约定。', OUTPUT_LIMIT: '知识库结果超过长度上限。',
  SOURCE_NOT_APPROVED: '来源或通道未登记。', WRITER_DISABLED: '后端同步写入未启用；当前页面仅提供查询。',
  POLICY_DENIED: '后端同步策略未批准或拒绝操作；当前页面仅提供查询。', SYNC_OUTCOME_UNKNOWN: '后端同步结果尚未确认；状态摘要不是成功证据。', BUSY: '知识库已有操作正在进行。',
} as const
export type KnowledgeBackendCode = keyof typeof backendMessages
/** Only closed, local text and numeric HTTP status are retained; never response diagnostics or queries. */
export class KnowledgeReadError extends Error {
  constructor(readonly code: KnowledgeReadCode, readonly endpoint?: Endpoint, readonly status?: number, readonly backendCode?: KnowledgeBackendCode) {
    super(backendCode ? backendMessages[backendCode] : messages[code])
    this.name = code === 'aborted' ? 'AbortError' : 'KnowledgeReadError'
  }
}
export const KNOWLEDGE_READ_LIMITS = Object.freeze({
  maxResponseBytes: 2 * 1024 * 1024, maxResponseChunks: 4096, maxRequestBytes: 4096,
  defaultTimeoutMs: 30_000, downloadTimeoutMs: 45_000, maxTimeoutMs: 45_000,
  maxSearchResults: 1000, maxListRows: 1000, maxSources: 100, maxSourceJobs: 10,
  maxQueryLength: 512, maxDownloadBytes: 1024 * 1024,
})
const fail = (endpoint: Endpoint, code: KnowledgeReadCode, status?: number, backendCode?: KnowledgeBackendCode) => new KnowledgeReadError(code, endpoint, status, backendCode)
function record(value: unknown, endpoint: Endpoint): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail(endpoint, 'invalid-shape')
  return value as Record<string, unknown>
}
function envelope(value: unknown, endpoint: Endpoint): Record<string, unknown> {
  const result = record(value, endpoint)
  if (result.schemaVersion !== KNOWLEDGE_SCHEMA) throw fail(endpoint, 'invalid-shape')
  return result
}
function text(value: unknown, endpoint: Endpoint, max: number, empty = true): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw fail(endpoint, 'invalid-shape')
  return value
}
function bool(value: unknown, endpoint: Endpoint): boolean { if (typeof value !== 'boolean') throw fail(endpoint, 'invalid-shape'); return value }
function count(value: unknown, endpoint: Endpoint, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw fail(endpoint, 'invalid-shape')
  return value
}
function oneOf<T extends string>(value: unknown, choices: readonly T[], endpoint: Endpoint): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) throw fail(endpoint, 'invalid-shape')
  return value as T
}
function list(value: unknown, endpoint: Endpoint, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw fail(endpoint, 'invalid-shape')
  return value
}
function unique<T>(values: T[], key: (entry: T) => string, endpoint: Endpoint): T[] {
  if (new Set(values.map(key)).size !== values.length) throw fail(endpoint, 'invalid-shape')
  return values
}
function sha(value: unknown, endpoint: Endpoint): string {
  const result = text(value, endpoint, 64, false)
  if (!/^[a-f0-9]{40,64}$/i.test(result)) throw fail(endpoint, 'invalid-shape')
  return result
}
function knownBackendCode(value: unknown): KnowledgeBackendCode | undefined {
  return typeof value === 'string' && Object.hasOwn(backendMessages, value) ? value as KnowledgeBackendCode : undefined
}
function issue(value: unknown, endpoint: Endpoint): KnowledgeIssue {
  const raw = record(value, endpoint)
  text(raw.code, endpoint, 80, false)
  const code = knownBackendCode(raw.code) ?? 'UPSTREAM_UNAVAILABLE'
  return { code, message: backendMessages[code], ...(raw.reason === undefined ? {} : { reason: oneOf(raw.reason, KNOWLEDGE_POLICY_REASONS, endpoint) }) }
}
function source(value: unknown): KnowledgeSource {
  const endpoint = 'status'
  const raw = record(value, endpoint)
  const id = text(raw.id, endpoint, 64, false)
  if (!/^[a-z][a-z0-9._-]{0,63}$/.test(id)) throw fail(endpoint, 'invalid-shape')
  const result: KnowledgeSource = { id, label: text(raw.label, endpoint, 100), channel: oneOf(raw.channel, ['local', 'official'], endpoint) }
  for (const key of ['approved', 'enabled', 'writerReady'] as const) if (raw[key] !== undefined) result[key] = bool(raw[key], endpoint)
  for (const key of ['targetSha', 'completedSha'] as const) if (raw[key] !== undefined) result[key] = sha(raw[key], endpoint)
  if (raw.freshness !== undefined) result.freshness = oneOf(raw.freshness, ['unknown', 'current', 'stale', 'blocked', 'syncing', 'disabled'] as const, endpoint)
  if (raw.pending !== undefined) result.pending = count(raw.pending, endpoint)
  if (raw.error !== undefined) result.error = issue(raw.error, endpoint)
  if (raw.jobs !== undefined) result.jobs = unique(list(raw.jobs, endpoint, KNOWLEDGE_READ_LIMITS.maxSourceJobs).map((value) => {
    const raw = record(value, endpoint)
    const id = text(raw.id, endpoint, 128, false)
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(id)) throw fail(endpoint, 'invalid-shape')
    return { id, status: oneOf(raw.status, ['queued', 'pending', 'running', 'blocked', 'done', 'complete', 'completed', 'unknown', 'cancelled', 'planned'], endpoint), ...(raw.sourceCommit === undefined ? {} : { sourceCommit: sha(raw.sourceCommit, endpoint) }) }
  }), (entry) => entry.id, endpoint)
  return result
}
function decodeStatus(value: unknown): KnowledgeStatus {
  const endpoint = 'status'
  const raw = envelope(value, endpoint), cli = record(raw.cli, endpoint), retrieval = record(raw.retrieval, endpoint), sync = record(raw.sync, endpoint)
  const result: KnowledgeStatus = {
    cli: { available: bool(cli.available, endpoint), compatible: bool(cli.compatible, endpoint), ...(cli.version === undefined ? {} : { version: text(cli.version, endpoint, 80, false) }), ...(cli.error === undefined ? {} : { error: issue(cli.error, endpoint) }) },
    retrieval: { auth: oneOf(retrieval.auth, ['missing', 'configured', 'verified', 'denied'], endpoint), keyword: oneOf(retrieval.keyword, ['unverified', 'verified'], endpoint), kbId: text(retrieval.kbId, endpoint, 80, false), endpoint: oneOf(retrieval.endpoint, ['http://127.0.0.1:8081'], endpoint) },
    sync: { available: bool(sync.available, endpoint), writerEnabled: bool(sync.writerEnabled, endpoint), schedulerEnabled: bool(sync.schedulerEnabled, endpoint), sources: unique(list(sync.sources, endpoint, KNOWLEDGE_READ_LIMITS.maxSources).map(source), (entry) => `${entry.id}/${entry.channel}`, endpoint), ...(sync.error === undefined ? {} : { error: issue(sync.error, endpoint) }) },
  }
  if (!isKnowledgeRequestId(result.retrieval.kbId) || (result.cli.compatible && !result.cli.available) || (result.retrieval.keyword === 'verified' && result.retrieval.auth !== 'verified')) throw fail(endpoint, 'invalid-shape')
  return result
}
function decodeSearch(value: unknown, limit: number): KnowledgeSearchResponse {
  const endpoint = 'search', raw = envelope(value, endpoint)
  const results = unique(list(raw.results, endpoint, limit).map((value) => {
    const raw = record(value, endpoint)
    const result: KnowledgeResult = { id: text(raw.id, endpoint, 160, false), title: text(raw.title, endpoint, 200), content: text(raw.content, endpoint, 4000) }
    if (raw.knowledgeId !== undefined) result.knowledgeId = text(raw.knowledgeId, endpoint, 160)
    if (raw.source !== undefined) {
      const entry = record(raw.source, endpoint), projected: NonNullable<KnowledgeResult['source']> = {}
      if (entry.channel !== undefined) projected.channel = oneOf(entry.channel, ['local', 'official'] as const, endpoint)
      if (entry.repoId !== undefined) projected.repoId = text(entry.repoId, endpoint, 100)
      if (entry.path !== undefined) {
        const path = text(entry.path, endpoint, 512)
        if (/^(?:[a-z]:|[\\/])/i.test(path) || path.split(/[\\/]/).includes('..')) throw fail(endpoint, 'invalid-shape')
        projected.path = path
      }
      for (const key of ['commit', 'blobSha'] as const) if (entry[key] !== undefined) projected[key] = sha(entry[key], endpoint)
      result.source = projected
    }
    return result
  }), (entry) => entry.id, endpoint)
  if (count(raw.count, endpoint) !== results.length) throw fail(endpoint, 'invalid-shape')
  return { results, count: results.length }
}
/** Types are intentionally narrower than v148's primitive-only projector. Unknown fields are omitted. */
function row(value: unknown, endpoint: Endpoint, strings: readonly string[], numbers: readonly string[], booleans: readonly string[]): Record<string, string | number | boolean> & { id: string } {
  const raw = record(value, endpoint)
  const result: Record<string, string | number | boolean> & { id: string } = { id: text(raw.id, endpoint, 200, false) }
  for (const key of strings) if (raw[key] !== undefined) result[key] = text(raw[key], endpoint, key === 'content' || key === 'description' ? 4000 : 200)
  for (const key of numbers) if (raw[key] !== undefined) result[key] = count(raw[key], endpoint)
  for (const key of booleans) if (raw[key] !== undefined) result[key] = bool(raw[key], endpoint)
  return result
}
function base(value: unknown, endpoint: Endpoint): KnowledgeBase { return row(value, endpoint, ['name', 'description', 'type', 'updated_at', ...(endpoint === 'kbView' ? ['embedding_model_id'] : [])], ['knowledge_count', 'chunk_count'], ['is_pinned']) }
function document(value: unknown, endpoint: Endpoint): KnowledgeDocument { return row(value, endpoint, ['title', 'file_name', 'parse_status', 'file_type', 'updated_at', ...(endpoint === 'docView' ? ['description'] : [])], ['file_size'], []) }
function chunk(value: unknown, endpoint: Endpoint): KnowledgeChunk { return row(value, endpoint, ['content'], ['chunk_index'], ['is_enabled']) }
function agent(value: unknown, endpoint: Endpoint): KnowledgeAgent { return row(value, endpoint, ['name', 'description'], [], ['is_builtin']) }
function rows<T extends { id: string }>(value: unknown, endpoint: Endpoint, decode: (value: unknown, endpoint: Endpoint) => T, max: number): { items: T[] } {
  return { items: unique(list(envelope(value, endpoint).items, endpoint, max).map((value) => decode(value, endpoint)), (entry) => entry.id, endpoint) }
}
function item<T extends { id: string }>(value: unknown, endpoint: Endpoint, decode: (value: unknown, endpoint: Endpoint) => T, expectedId: string): { item: T } {
  const result = decode(envelope(value, endpoint).item, endpoint)
  if (result.id !== expectedId) throw fail(endpoint, 'invalid-shape')
  return { item: result }
}
function decodeDownload(value: unknown, expectedId: string): KnowledgeDocumentDownload {
  const endpoint = 'docDownload', raw = envelope(value, endpoint)
  const result: KnowledgeDocumentDownload = { docId: text(raw.docId, endpoint, 80, false), fileName: text(raw.fileName, endpoint, 200, false), bytes: count(raw.bytes, endpoint, KNOWLEDGE_READ_LIMITS.maxDownloadBytes), truncated: bool(raw.truncated, endpoint), isBase64: bool(raw.isBase64, endpoint), content: '' }
  if (result.docId !== expectedId || /[\\/\r\n\t]/.test(result.fileName) || (result.truncated && result.bytes !== KNOWLEDGE_READ_LIMITS.maxDownloadBytes) || typeof raw.content !== 'string') throw fail(endpoint, 'invalid-shape')
  if (result.isBase64) {
    if (raw.content.length > Math.ceil(KNOWLEDGE_READ_LIMITS.maxDownloadBytes / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw.content)) throw fail(endpoint, 'invalid-shape')
    const bytes = raw.content.length / 4 * 3 - (raw.content.endsWith('==') ? 2 : raw.content.endsWith('=') ? 1 : 0)
    if (bytes !== result.bytes) throw fail(endpoint, 'invalid-shape')
  } else if (raw.content.length > result.bytes || new TextEncoder().encode(raw.content).byteLength > result.bytes * 3) throw fail(endpoint, 'invalid-shape')
  // Original bytes can decode to replacement characters; do not rewrite the source preview.
  result.content = raw.content
  return result
}
function input(value: unknown, endpoint: Endpoint, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail(endpoint, 'invalid-query')
  const result = value as Record<string, unknown>
  if (Object.keys(result).some((key) => !keys.includes(key))) throw fail(endpoint, 'invalid-query')
  return result
}
function requestId(value: unknown, endpoint: Endpoint): string { if (!isKnowledgeRequestId(value)) throw fail(endpoint, 'invalid-query'); return value }
function query(value: unknown, endpoint: Endpoint): string {
  if (typeof value !== 'string') throw fail(endpoint, 'invalid-query')
  const result = value.trim()
  if (!result || result.length > KNOWLEDGE_READ_LIMITS.maxQueryLength || result.startsWith('-') || /[\u0000-\u001f\u007f]/u.test(result)) throw fail(endpoint, 'invalid-query')
  return result
}
function limit(value: unknown, endpoint: Endpoint, fallback: number, max: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > max) throw fail(endpoint, 'invalid-query')
  return value
}
function discardBody(response: Response): void { try { void response.body?.cancel().catch(() => undefined) } catch { /* Never retain diagnostics. */ } }
function abortable<T>(pending: Promise<T>, signal: AbortSignal, error: () => KnowledgeReadError): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(error()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, endpoint: Endpoint, signal: AbortSignal, abortError: () => KnowledgeReadError): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > KNOWLEDGE_READ_LIMITS.maxResponseBytes) { discardBody(response); throw fail(endpoint, 'response-too-large') }
  if (!response.body) throw fail(endpoint, 'invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(reader.read(), signal, abortError)
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > KNOWLEDGE_READ_LIMITS.maxResponseBytes || ++chunks > KNOWLEDGE_READ_LIMITS.maxResponseChunks) throw fail(endpoint, 'response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode()
    complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail(endpoint, 'invalid-shape') }
  } catch (error) { if (error instanceof KnowledgeReadError) throw error; throw fail(endpoint, 'invalid-shape') }
  finally {
    if (!complete) { try { void reader.cancel().catch(() => undefined) } catch { /* Already closed. */ } }
    try { reader.releaseLock() } catch { /* Signal-unaware streams may still have a read pending. */ }
  }
}
/** Passive fixed-path client. Cookie auth only; no token/base URL, polling, connection setup or writer methods. */
export function createKnowledgeReadProvider(options: { fetch: KnowledgeFetch; timeoutMs?: number }): KnowledgeReadProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('知识库适配器需要显式注入同源 fetch。')
  const configuredTimeoutMs = options.timeoutMs
  if (configuredTimeoutMs !== undefined && (!Number.isFinite(configuredTimeoutMs) || configuredTimeoutMs < 1 || configuredTimeoutMs > KNOWLEDGE_READ_LIMITS.maxTimeoutMs)) throw new RangeError('知识库超时必须为 1 至 45000 毫秒。')
  const transport = options.fetch, inFlight = new Map<string, object>()
  async function read<T>(endpoint: Endpoint, decode: (value: unknown) => T, signal?: AbortSignal, body?: Record<string, unknown>): Promise<T> {
    if (signal?.aborted) throw fail(endpoint, 'aborted')
    const key = endpoint === 'knowledgeService' || endpoint === 'modelService' ? endpoint : 'knowledge'
    if (inFlight.has(key)) throw fail(endpoint, 'busy')
    const contents = body === undefined ? undefined : JSON.stringify(body)
    if (contents && new TextEncoder().encode(contents).byteLength > KNOWLEDGE_READ_LIMITS.maxRequestBytes) throw fail(endpoint, 'invalid-query')
    const identity = {}, controller = new AbortController()
    inFlight.set(key, identity)
    let timedOut = false
    const cancel = () => controller.abort()
    signal?.addEventListener('abort', cancel, { once: true })
    const timeoutMs = configuredTimeoutMs ?? (endpoint === 'docDownload' ? KNOWLEDGE_READ_LIMITS.downloadTimeoutMs : KNOWLEDGE_READ_LIMITS.defaultTimeoutMs)
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    const abortError = () => fail(endpoint, signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted')
    try {
      const pending = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw abortError()
        return transport(PATHS[endpoint], { method: body === undefined ? 'GET' : 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(contents === undefined ? {} : { body: contents }), signal: controller.signal })
      })
      void pending.then((response) => { if (controller.signal.aborted) discardBody(response) }, () => undefined)
      const response = await abortable(pending, controller.signal, abortError)
      if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect') { discardBody(response); throw fail(endpoint, 'invalid-shape') }
      const json = /^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')
      if (!response.ok) {
        let backendCode: KnowledgeBackendCode | undefined
        if (json) {
          try { const value = await boundedJson(response, endpoint, controller.signal, abortError); if (value && typeof value === 'object' && !Array.isArray(value)) backendCode = knownBackendCode((value as Record<string, unknown>).code) }
          catch (error) { if (controller.signal.aborted || (error instanceof KnowledgeReadError && error.code === 'response-too-large')) throw error }
        } else discardBody(response)
        throw fail(endpoint, response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : response.status === 429 ? 'busy' : 'http-error', response.status, backendCode)
      }
      if (!json) { discardBody(response); throw fail(endpoint, 'invalid-shape') }
      const result = decode(await boundedJson(response, endpoint, controller.signal, abortError))
      if (controller.signal.aborted) throw abortError()
      return result
    } catch (error) {
      if (controller.signal.aborted) throw abortError()
      if (error instanceof KnowledgeReadError) throw error
      throw fail(endpoint, 'network-error')
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', cancel)
      if (inFlight.get(key) === identity) inFlight.delete(key)
    }
  }
  return Object.freeze({
    label: 'Companion 同源知识库只读接口（v148 契约）',
    status(signal?: AbortSignal) { return read('status', decodeStatus, signal) },
    async loadServiceStates(signal?: AbortSignal, service?: 'knowledge' | 'model'): Promise<KnowledgeServiceStates> {
      const [knowledge, model] = await Promise.allSettled([
        service === 'model' ? Promise.resolve(undefined) : read('knowledgeService', (value) => { const raw = record(value, 'knowledgeService'); const running = bool(raw.running, 'knowledgeService'), frameable = bool(raw.frameable, 'knowledgeService'); if (!running && frameable) throw fail('knowledgeService', 'invalid-shape'); return { running, frameable } }, signal),
        service === 'knowledge' ? Promise.resolve(undefined) : read('modelService', (value) => ({ running: bool(record(value, 'modelService').running, 'modelService') }), signal),
      ])
      if (signal?.aborted) throw fail('knowledgeService', 'aborted')
      return { ...(knowledge.status === 'fulfilled' && knowledge.value ? { knowledge: knowledge.value } : {}), ...(model.status === 'fulfilled' && model.value ? { model: model.value } : {}), warnings: [
        ...(knowledge.status === 'rejected' ? [`知识库服务状态未知：[${(knowledge.reason as KnowledgeReadError).code}]；不能据此判定已停止。`] : []),
        ...(model.status === 'rejected' ? [`模型启动器状态未知：[${(model.reason as KnowledgeReadError).code}]；不能据此判定已停止。`] : []),
      ] }
    },
    async search(value, signal) {
      const raw = input(value, 'search', ['query', 'kbId', 'limit']), selectedLimit = limit(raw.limit, 'search', 10, 1000)
      return read('search', (body) => decodeSearch(body, selectedLimit), signal, { query: query(raw.query, 'search'), ...(raw.kbId === undefined ? {} : { kbId: requestId(raw.kbId, 'search') }), ...(raw.limit === undefined ? {} : { limit: selectedLimit }) })
    },
    listKnowledgeBases(signal) { return read('kbList', (value) => rows(value, 'kbList', base, KNOWLEDGE_READ_LIMITS.maxListRows), signal, {}) },
    async viewKnowledgeBase(value, signal) {
      const kbId = requestId(input(value, 'kbView', ['kbId']).kbId, 'kbView')
      return read('kbView', (body) => item(body, 'kbView', base, kbId), signal, { kbId })
    },
    async listDocuments(value, signal) {
      const raw = input(value, 'docList', ['kbId', 'keyword', 'limit']), selectedLimit = limit(raw.limit, 'docList', 20, 100)
      return read('docList', (body) => ({ ...rows(body, 'docList', document, selectedLimit), truncated: bool(envelope(body, 'docList').truncated, 'docList') }), signal, { ...(raw.kbId === undefined ? {} : { kbId: requestId(raw.kbId, 'docList') }), ...(raw.keyword === undefined ? {} : { keyword: query(raw.keyword, 'docList') }), ...(raw.limit === undefined ? {} : { limit: selectedLimit }) })
    },
    async viewDocument(value, signal) {
      const id = requestId(input(value, 'docView', ['id']).id, 'docView')
      return read('docView', (body) => item(body, 'docView', document, id), signal, { id })
    },
    async downloadDocument(value, signal) {
      const id = requestId(input(value, 'docDownload', ['id']).id, 'docDownload')
      return read('docDownload', (body) => decodeDownload(body, id), signal, { id })
    },
    async listChunks(value, signal) {
      const raw = input(value, 'chunkList', ['id', 'limit']), selectedLimit = limit(raw.limit, 'chunkList', 50, 1000)
      return read('chunkList', (body) => ({ ...rows(body, 'chunkList', chunk, selectedLimit), truncated: bool(envelope(body, 'chunkList').truncated, 'chunkList') }), signal, { id: requestId(raw.id, 'chunkList'), ...(raw.limit === undefined ? {} : { limit: selectedLimit }) })
    },
    listAgents(signal) { return read('agentList', (value) => rows(value, 'agentList', agent, KNOWLEDGE_READ_LIMITS.maxListRows), signal, {}) },
  } satisfies KnowledgeReadProvider)
}
