/** Original Companion v148 icon-adapter schema; the four icon modules are unchanged in v150. */
import { isAiProjectId } from './ai-resource-read'
import { decodeAiJobResourceSnapshot } from './ai-resource-snapshot'
import type { AiJobResourceSnapshot } from './ai-resource-snapshot'
import { decodeAiJobProductAcceptance } from './ai-job-acceptance'
import type { AiJobProductAcceptance } from './ai-job-acceptance'
export const AI_JOB_STATES = ['queued', 'waiting_service', 'running', 'unknown', 'failed', 'reusable', 'awaiting_selection', 'selected', 'import_unknown', 'imported_pending_verification', 'blocked'] as const
export type AiJobState = typeof AI_JOB_STATES[number]
export type AiJobMode = 'generation' | 'offline_import_only'
export interface AiJobCandidate { candidateId: string; assetId: string; fileSha256: string; width: 1024; height: 1024; hasAlpha: true }
export interface AiJobImport {
  operationId: string; state: string; effectApplied: boolean | 'UNKNOWN'; leaseState: 'RELEASED' | 'UNKNOWN' | 'RETAINED'; errorCode: string | null
  tools: Array<{ tool: string; operationId: string; status: string }>
}
export interface AiJobVariantImport extends AiJobImport {
  active: boolean
  artifact?: { kind: 'variant'; candidateId: string; width: number; height: number; fileSha256: string; receiptSha256: string; destinationUrl: string }
}
export interface AiJobBudget { maxAssets: 2; candidatesPerAsset: 1; submissionAttempts: 1 }
export interface AiVariantDispatchObservation {
  schemaVersion: 'variant-dispatch-observation-v1'; state: 'not-started'; effectApplied: false
  originalReceipt: null; leaseDisposition: 'not-claimed'; reason: 'KNOWN_LEGACY_PREPARE_REJECTED_BEFORE_READ_WRITE'
  binding: { projectId: string; jobId: string; revision: number; requestHash: string; sourceRevision: string; candidateId: string;
    motherSha256: string; configHash: string; width: number; height: number; fileSha256: string; receiptSha256: string; destinationUrl: string }
  taskSha256: string; observedAt: string
}
export interface AiJobSnapshot {
  projectId: string; jobId: string; revision: number; state: AiJobState; sourceRevision: string; requestHash: string
  profile: string; budget: AiJobBudget; createdAt: string; assets: Array<{ assetId: string; relativePath: string }>
  candidates: AiJobCandidate[]; selectedIds: string[]; import: AiJobImport | null; workerResident: false; productionVerified: false
  mode?: AiJobMode; origin?: 'generated' | 'adopted'; errorCode?: string | null
  resourceSnapshot?: AiJobResourceSnapshot
  productAcceptance?: AiJobProductAcceptance
  variantImport?: AiJobVariantImport
  variantDispatchObservation?: AiVariantDispatchObservation
  historyOnly?: { reason: 'SOURCE_REVISION_CHANGED'; currentSourceRevision: string }
}
export interface AiJobsView {
  schemaVersion: 'companion-icons-v1'; projectId: string; sourceRevision: string; jobs: AiJobSnapshot[]
  profile: AiJobBudget & { id: string }; mode?: AiJobMode; adoptionSources?: Array<{ sourceId: string; fileSha256: string }>
  schedulerEnabled: false; workerResident: false
}
export interface AiJobPreview { candidateId: string; mimeType: 'image/png'; base64: string; sha256: string; width: 1024; height: 1024 }
export interface AiPngPreview { candidateId: string; mimeType: 'image/png'; base64: string; sha256: string; width: number; height: number }
export interface AiVariantPreview extends AiPngPreview { operationId: string; receiptSha256: string }
export interface AiJobsReadProvider {
  readonly label: string
  /** Optional for standalone reads; mutation pipelines require tracked I/O drainage. */
  waitForIdle?(): Promise<void>
  readJobs(projectId: string, signal?: AbortSignal): Promise<AiJobsView>
  readStatus(projectId: string, jobId: string, signal?: AbortSignal): Promise<AiJobSnapshot>
  previewCandidate(projectId: string, jobId: string, candidate: AiJobCandidate, signal?: AbortSignal): Promise<AiJobPreview>
  previewVariant?(projectId: string, job: AiJobSnapshot, signal?: AbortSignal): Promise<AiVariantPreview>
}
export type AiJobsReadEndpoint = 'jobs' | 'status' | 'candidate' | 'variant-preview'
export type AiJobsReadCode = 'unauthorized' | 'forbidden' | 'timeout' | 'aborted' | 'invalid-shape' | 'response-too-large' | 'http-error' | 'network-error' | 'invalid-query' | 'busy' | 'verification-unavailable'
const messages: Record<AiJobsReadCode, string> = {
  unauthorized: '需要已有的 Companion 会话（401）。', forbidden: 'Companion 拒绝任务读取（403），请核对已有会话与同源部署。',
  timeout: '任务读取超时；后台读取过程是否结束尚未确认。', aborted: '已取消本页读取；这不能证明后台进程已经结束。',
  'invalid-shape': '任务响应未通过已核合同或候选完整性校验。', 'response-too-large': '任务响应超出安全读取预算。',
  'http-error': '原任务接口返回失败；未把失败转换为空历史或任务完成。', 'network-error': '未能完成同源任务读取。',
  'invalid-query': '任务读取参数无效。', busy: '已有任务读取尚未结束，请稍后明确重试读取。',
  'verification-unavailable': '当前环境无法校验候选 SHA-256，未显示图片。',
}
export const AI_JOBS_BACKEND_ERRORS = {
  HISTORY_READ_ONLY: { status: 409, message: '此任务绑定旧工程版本，仅可查看历史；没有重新执行或改写任务。' },
  VARIANT_PROVENANCE_UNAVAILABLE: { status: 409, message: '变体文件或收据未通过来源校验，未显示图像。' },
  VARIANT_BINDING_MISMATCH: { status: 409, message: '变体与原任务绑定不一致，未显示图像。' },
  REVISION_MISMATCH: { status: 409, message: '原后台因工程版本变化拒绝读取旧任务；需修复只读历史合同，未改写任务或重试导入。' },
  ICON_ADAPTER_DISABLED: { status: 503, message: '原图标任务后端未启用或可信配置不完整；未启动或补装任何服务。' },
  ICON_CONFIG_INVALID: { status: 503, message: '原图标任务后端配置无效，请核对原后台配置。' },
  IMAGE_PROCESSING_UNAVAILABLE: { status: 503, message: '原后台图片处理能力不可用，候选读取尚未完成。' },
  ICON_OUTCOME_UNCONFIRMED: { status: 503, message: '原后台未确认本次任务读取结果；这不能说明原任务未执行或未写入。' },
  ICON_WORKER_BUSY: { status: 429, message: '原图标任务 worker 正忙；没有自动重试或新建任务。' },
  PROJECT_NOT_FOUND: { status: 404, message: '原后台已找不到这个登记工程，请重新核对工程登记。' },
  ICON_SCHEMA_INVALID: { status: 502, message: '原任务后端结果未通过原服务合同校验。' },
  IMAGE_RESULT_INVALID: { status: 502, message: '原后台未能确认有效的 PNG 图片结果。' },
} as const
export type AiJobsBackendCode = keyof typeof AI_JOBS_BACKEND_ERRORS
export class AiJobsReadError extends Error {
  constructor(readonly code: AiJobsReadCode, readonly endpoint?: AiJobsReadEndpoint, readonly status?: number, readonly backendCode?: AiJobsBackendCode) {
    super(backendCode ? AI_JOBS_BACKEND_ERRORS[backendCode].message : messages[code]); this.name = code === 'aborted' ? 'AbortError' : 'AiJobsReadError'
  }
}
export const AI_JOBS_READ_LIMITS = Object.freeze({ maxJobs: 100, maxJsonBytes: 4 * 1024 * 1024, maxCandidateJsonBytes: 13 * 1024 * 1024,
  maxCandidateBytes: 9 * 1024 * 1024, maxBase64Length: 12 * 1024 * 1024, maxChunks: 4096, timeoutMs: 20_000, maxConcurrent: 3 })
const invalid = () => new AiJobsReadError('invalid-shape')
const sha = /^[a-f0-9]{64}$/, revision = /^[a-f0-9]{40}$/, errorCode = /^[A-Z0-9_]{1,80}$/
const unsafeText = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u
export const isAiJobId = (value: unknown): value is string => typeof value === 'string' && /^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/.test(value)
export const isAiCandidateId = (value: unknown): value is string => typeof value === 'string' && value.length <= 100 && /^CANDIDATE-[a-z0-9-]+-1$/.test(value)
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(); return value as Record<string, unknown> }
function text(value: unknown, max: number): string { if (typeof value !== 'string' || value.length > max || unsafeText.test(value)) throw invalid(); return value }
function pattern(value: unknown, expression: RegExp, max = 200): string { const result = text(value, max); if (!expression.test(result)) throw invalid(); return result }
function rows(value: unknown, max: number, min = 0): unknown[] { if (!Array.isArray(value) || value.length > max || value.length < min) throw invalid(); return value }
function member<T extends string>(value: unknown, options: readonly T[]): T { if (typeof value !== 'string' || !options.includes(value as T)) throw invalid(); return value as T }
function budget(value: unknown): AiJobBudget { const raw = record(value); if (raw.maxAssets !== 2 || raw.candidatesPerAsset !== 1 || raw.submissionAttempts !== 1) throw invalid(); return { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 } }
export function decodeAiJobCandidate(value: unknown): AiJobCandidate {
  const raw = record(value)
  if (raw.width !== 1024 || raw.height !== 1024 || raw.hasAlpha !== true) throw invalid()
  return { candidateId: text(raw.candidateId, 100), assetId: text(raw.assetId, 80), fileSha256: pattern(raw.fileSha256, sha, 64), width: 1024, height: 1024, hasAlpha: true }
}
function decodeImport(value: unknown): AiJobImport | null {
  if (value === null) return null
  const raw = record(value)
  if (raw.effectApplied !== true && raw.effectApplied !== false && raw.effectApplied !== 'UNKNOWN') throw invalid()
  return { operationId: pattern(raw.operationId, /^icon-import-[a-f0-9]{32}$/), state: text(raw.state, 80), effectApplied: raw.effectApplied,
    leaseState: member(raw.leaseState, ['RELEASED', 'UNKNOWN', 'RETAINED']), errorCode: raw.errorCode === null ? null : pattern(raw.errorCode, errorCode, 80),
    tools: rows(raw.tools, 20).map(value => { const tool = record(value); return { tool: pattern(tool.tool, /^[a-z_]{1,80}$/), operationId: text(tool.operationId, 200), status: text(tool.status, 30) } }) }
}
function decodeVariantImport(value: unknown, candidates: AiJobCandidate[], selectedIds: string[]): AiJobVariantImport {
  const raw = record(value), summary = decodeImport(raw)
  if (!summary || typeof raw.active !== 'boolean') throw invalid()
  let artifact: AiJobVariantImport['artifact']
  if (raw.artifact !== undefined) {
    const item = record(raw.artifact)
    if (item.kind !== 'variant' || !isAiCandidateId(item.candidateId) || !selectedIds.includes(item.candidateId)
      || !candidates.some(candidate => candidate.candidateId === item.candidateId)
      || typeof item.width !== 'number' || typeof item.height !== 'number' || !Number.isInteger(item.width) || !Number.isInteger(item.height)
      || item.width < 1 || item.height < 1 || item.width > 4096 || item.height > 4096 || item.width * item.height > 16_000_000) throw invalid()
    const destinationUrl = text(item.destinationUrl, 512)
    if (!/^db:\/\/assets\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.png$/.test(destinationUrl)
      || destinationUrl.slice('db://assets/'.length).split('/').some(segment => segment === '.' || segment === '..')) throw invalid()
    artifact = { kind: 'variant', candidateId: item.candidateId, width: item.width, height: item.height,
      fileSha256: pattern(item.fileSha256, sha, 64), receiptSha256: pattern(item.receiptSha256, sha, 64), destinationUrl }
  }
  return { ...summary, active: raw.active, ...(artifact ? { artifact } : {}) }
}
function decodeVariantDispatchObservation(value: unknown, job: Record<string, unknown>, candidates: AiJobCandidate[], selectedIds: string[], resource?: AiJobResourceSnapshot): AiVariantDispatchObservation {
  const raw = record(value), b = record(raw.binding)
  const exact = (item: Record<string, unknown>, keys: string[]) => Object.keys(item).length === keys.length && keys.every(key => Object.hasOwn(item, key))
  if (!exact(raw, ['schemaVersion','state','effectApplied','originalReceipt','leaseDisposition','reason','binding','taskSha256','observedAt'])
    || !exact(b, ['projectId','jobId','revision','requestHash','sourceRevision','candidateId','motherSha256','configHash','width','height','fileSha256','receiptSha256','destinationUrl'])
    || raw.schemaVersion !== 'variant-dispatch-observation-v1' || raw.state !== 'not-started' || raw.effectApplied !== false
    || raw.originalReceipt !== null || raw.leaseDisposition !== 'not-claimed' || raw.reason !== 'KNOWN_LEGACY_PREPARE_REJECTED_BEFORE_READ_WRITE'
    || job.state !== 'selected' || job.import !== null || job.variantImport !== undefined || job.historyOnly !== undefined
    || b.projectId !== job.projectId || b.jobId !== job.jobId || b.revision !== job.revision || b.requestHash !== job.requestHash || b.sourceRevision !== job.sourceRevision
    || selectedIds.length !== 1 || b.candidateId !== selectedIds[0] || !isAiCandidateId(b.candidateId)
    || candidates.find(c => c.candidateId === b.candidateId)?.fileSha256 !== b.motherSha256 || resource?.state !== 'sealed' || resource.hash !== b.configHash
    || typeof b.width !== 'number' || typeof b.height !== 'number' || !Number.isInteger(b.width) || !Number.isInteger(b.height)
    || b.width < 1 || b.height < 1 || b.width > 4096 || b.height > 4096 || b.width * b.height > 16_000_000) throw invalid()
  const destinationUrl = text(b.destinationUrl,512)
  if (!/^db:\/\/assets\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.png$/.test(destinationUrl) || destinationUrl.split('/').some(p => p === '.' || p === '..')) throw invalid()
  const observedAt = text(raw.observedAt,60)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(observedAt) || !Number.isFinite(Date.parse(observedAt))) throw invalid()
  return { schemaVersion: 'variant-dispatch-observation-v1', state: 'not-started', effectApplied: false, originalReceipt: null, leaseDisposition: 'not-claimed',
    reason: 'KNOWN_LEGACY_PREPARE_REJECTED_BEFORE_READ_WRITE', taskSha256: pattern(raw.taskSha256,sha,64), observedAt,
    binding: { projectId: job.projectId as string, jobId: job.jobId as string, revision: job.revision as number,
      requestHash: pattern(b.requestHash,sha,64), sourceRevision: pattern(b.sourceRevision,revision,40), candidateId: b.candidateId,
      motherSha256: pattern(b.motherSha256,sha,64), configHash: pattern(b.configHash,sha,64), width: b.width, height: b.height,
      fileSha256: pattern(b.fileSha256,sha,64), receiptSha256: pattern(b.receiptSha256,sha,64), destinationUrl } }
}
/** Sealed config is validated metadata; it is never production acceptance. */
export function decodeAiJobSnapshot(value: unknown, projectId: string, jobId?: string): AiJobSnapshot {
  const raw = record(value)
  if (!isAiProjectId(projectId) || raw.projectId !== projectId || !isAiJobId(raw.jobId) || (jobId !== undefined && raw.jobId !== jobId)
    || typeof raw.revision !== 'number' || !Number.isSafeInteger(raw.revision) || raw.revision < 1 || raw.workerResident !== false || raw.productionVerified !== false) throw invalid()
  const assets = rows(raw.assets, 2, 1).map(value => { const asset = record(value); return { assetId: text(asset.assetId, 80), relativePath: text(asset.relativePath, 512) } })
  const candidates = rows(raw.candidates, 2).map(decodeAiJobCandidate), selectedIds = rows(raw.selectedIds, 2).map(value => text(value, 100))
  const assetIds = assets.map(asset => asset.assetId), candidateIds = candidates.map(candidate => candidate.candidateId)
  if (new Set(assetIds).size !== assetIds.length || new Set(candidateIds).size !== candidateIds.length || new Set(selectedIds).size !== selectedIds.length
    || candidates.some(candidate => !assetIds.includes(candidate.assetId)) || selectedIds.some(id => !candidateIds.includes(id))) throw invalid()
  let resourceSnapshot: AiJobResourceSnapshot | undefined
  try { if (raw.resourceSnapshot !== undefined) resourceSnapshot = decodeAiJobResourceSnapshot(raw.resourceSnapshot, projectId) } catch { throw invalid() }
  const variantDispatchObservation = raw.variantDispatchObservation === undefined ? undefined : decodeVariantDispatchObservation(raw.variantDispatchObservation, raw, candidates, selectedIds, resourceSnapshot)
  const importReceipt = decodeImport(raw.import)
  const variantImport = raw.variantImport === undefined ? undefined : decodeVariantImport(raw.variantImport, candidates, selectedIds)
  let historyOnly: AiJobSnapshot['historyOnly']
  if (raw.historyOnly !== undefined) {
    const history = record(raw.historyOnly), currentSourceRevision = pattern(history.currentSourceRevision, revision, 40)
    if (history.reason !== 'SOURCE_REVISION_CHANGED' || currentSourceRevision === raw.sourceRevision) throw invalid()
    historyOnly = { reason: 'SOURCE_REVISION_CHANGED', currentSourceRevision }
  }
  let productAcceptance: AiJobProductAcceptance | undefined
  try {
    if (raw.productAcceptance !== undefined) productAcceptance = decodeAiJobProductAcceptance(raw.productAcceptance)
    if (productAcceptance && productAcceptance.state !== 'unavailable' && (raw.state !== 'imported_pending_verification'
      || importReceipt?.state !== 'imported_pending_verification' || importReceipt.effectApplied !== true || selectedIds.length !== 1)) throw invalid()
  } catch { throw invalid() }
  return { projectId, jobId: raw.jobId, revision: raw.revision, state: member(raw.state, AI_JOB_STATES), sourceRevision: pattern(raw.sourceRevision, revision, 40),
    requestHash: pattern(raw.requestHash, sha, 64), profile: text(raw.profile, 80), budget: budget(raw.budget), createdAt: text(raw.createdAt, 60), assets, candidates,
    selectedIds, import: importReceipt, workerResident: false, productionVerified: false,
    ...(raw.mode !== undefined ? { mode: member(raw.mode, ['generation', 'offline_import_only'] as const) } : {}),
    ...(raw.origin !== undefined ? { origin: member(raw.origin, ['generated', 'adopted'] as const) } : {}),
    ...(raw.errorCode !== undefined ? { errorCode: raw.errorCode === null ? null : pattern(raw.errorCode, errorCode, 80) } : {}),
    ...(resourceSnapshot ? { resourceSnapshot } : {}), ...(productAcceptance ? { productAcceptance } : {}), ...(variantImport ? { variantImport } : {}), ...(variantDispatchObservation ? { variantDispatchObservation } : {}), ...(historyOnly ? { historyOnly } : {}) }
}
export function decodeAiJobsView(value: unknown, projectId: string): AiJobsView {
  const raw = record(value), profile = record(raw.profile)
  if (raw.schemaVersion !== 'companion-icons-v1' || raw.projectId !== projectId || !isAiProjectId(projectId) || raw.schedulerEnabled !== false || raw.workerResident !== false) throw invalid()
  const jobs = rows(raw.jobs, AI_JOBS_READ_LIMITS.maxJobs).map(value => decodeAiJobSnapshot(value, projectId))
  if (new Set(jobs.map(job => job.jobId)).size !== jobs.length) throw invalid()
  return { schemaVersion: 'companion-icons-v1', projectId, sourceRevision: pattern(raw.sourceRevision, revision, 40), jobs,
    profile: { id: text(profile.id, 80), ...budget(profile) }, schedulerEnabled: false, workerResident: false,
    ...(raw.mode !== undefined ? { mode: member(raw.mode, ['generation', 'offline_import_only'] as const) } : {}),
    ...(raw.adoptionSources !== undefined ? { adoptionSources: rows(raw.adoptionSources, 20).map(value => { const source = record(value); return { sourceId: pattern(source.sourceId, /^[a-z][a-z0-9-]{0,79}$/), fileSha256: pattern(source.fileSha256, sha, 64) } }) } : {}) }
}
export function decodeAiJobStatus(value: unknown, projectId: string, jobId: string): AiJobSnapshot {
  const raw = record(value)
  // A dispatch acknowledgement includes a pre-execution snapshot and is never accepted as a status read.
  if (raw.schemaVersion !== 'companion-icons-v1' || raw.dispatchAccepted !== undefined) throw invalid()
  return decodeAiJobSnapshot(raw.job, projectId, jobId)
}
const crcTable = Array.from({ length: 256 }, (_, value) => { let crc = value; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); return crc >>> 0 })
function crc32(bytes: Uint8Array, start: number, end: number) { let crc = 0xffffffff; for (let i = start; i < end; i++) crc = crcTable[(crc ^ bytes[i]!) & 255]! ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0 }
/** Fixed PNG content, never a URL or path. SHA and dimensions are pinned to the selected snapshot. */
export async function verifyAiPngPreview(value: unknown, expected: { candidateId: string; fileSha256: string; width: number; height: number }, endpoint: AiJobsReadEndpoint = 'candidate'): Promise<AiPngPreview> {
  const raw = record(value)
  if (!sha.test(expected.fileSha256) || !Number.isInteger(expected.width) || !Number.isInteger(expected.height) || expected.width < 1 || expected.height < 1
    || expected.width > 4096 || expected.height > 4096 || expected.width * expected.height > 16_000_000) throw invalid()
  if (!isAiCandidateId(expected.candidateId) || (raw.schemaVersion !== undefined && raw.schemaVersion !== 'companion-icons-v1') || raw.candidateId !== expected.candidateId || raw.mimeType !== 'image/png') throw invalid()
  const base64 = text(raw.base64, AI_JOBS_READ_LIMITS.maxBase64Length)
  if (base64.length < 76 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw invalid()
  let binary: string
  try { binary = atob(base64); if (btoa(binary) !== base64) throw invalid() } catch { throw invalid() }
  if (binary.length > AI_JOBS_READ_LIMITS.maxCandidateBytes) throw new AiJobsReadError('response-too-large', endpoint)
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0)), view = new DataView(bytes.buffer)
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) throw invalid()
  let offset = 8, count = 0, idat = false, ended = false, afterIdat = false
  while (offset < bytes.length) {
    if (++count > AI_JOBS_READ_LIMITS.maxChunks || offset + 12 > bytes.length) throw invalid()
    const size = view.getUint32(offset), end = offset + 12 + size, type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (end > bytes.length || crc32(bytes, offset + 4, end - 4) !== view.getUint32(end - 4)) throw invalid()
    if (count === 1) {
      if (type !== 'IHDR' || size !== 13 || view.getUint32(offset + 8) !== expected.width || view.getUint32(offset + 12) !== expected.height
        || bytes[offset + 16] !== 8 || bytes[offset + 17] !== 6 || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] !== 0) throw invalid()
    } else if (type === 'IDAT') { if (afterIdat || size === 0) throw invalid(); idat = true }
    else if (type === 'IEND') { if (!idat || size !== 0 || end !== bytes.length) throw invalid(); ended = true }
    else if (type === 'tEXt') { if (idat) afterIdat = true; if (size > 256 * 1024) throw invalid() }
    // Conservative client subset: static RGBA, no APNG, compressed metadata, executable or external content.
    else throw invalid()
    offset = end
  }
  if (!ended) throw invalid()
  if (!globalThis.crypto?.subtle) throw new AiJobsReadError('verification-unavailable', endpoint)
  let digest: ArrayBuffer
  try { digest = await globalThis.crypto.subtle.digest('SHA-256', bytes) } catch { throw new AiJobsReadError('verification-unavailable', endpoint) }
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  if (actual !== expected.fileSha256) throw invalid()
  return { candidateId: expected.candidateId, mimeType: 'image/png', base64, sha256: actual, width: expected.width, height: expected.height }
}
export async function verifyAiJobPreview(value: unknown, candidate: AiJobCandidate): Promise<AiJobPreview> {
  return { ...await verifyAiPngPreview(value, decodeAiJobCandidate(candidate)), width: 1024, height: 1024 }
}
export async function verifyAiVariantPreview(value: unknown, job: AiJobSnapshot): Promise<AiVariantPreview> {
  const expected = job.variantImport, artifact = expected?.artifact, raw = record(value), preview = record(raw.preview)
  const mother = job.candidates.find(row => row.candidateId === artifact?.candidateId)
  if (!expected || !artifact || !mother || raw.schemaVersion !== 'companion-icons-v1' || raw.projectId !== job.projectId || raw.jobId !== job.jobId
    || raw.operationId !== expected.operationId || preview.sha256 !== artifact.fileSha256 || preview.receiptSha256 !== artifact.receiptSha256 || preview.sourceSha256 !== mother.fileSha256
    || preview.width !== artifact.width || preview.height !== artifact.height) throw invalid()
  const checked = await verifyAiPngPreview(preview, { candidateId: artifact.candidateId, fileSha256: artifact.fileSha256, width: artifact.width, height: artifact.height }, 'variant-preview')
  return { ...checked, operationId: expected.operationId, receiptSha256: artifact.receiptSha256 }
}
export const AI_JOB_STATE_LABELS: Record<AiJobState, string> = {
  queued: '已入队', waiting_service: '等待服务', running: '任务执行中', unknown: '生成结果未知', failed: '任务失败', reusable: '发现可复用内容',
  awaiting_selection: '等待审阅选择', selected: '已保存候选选择', import_unknown: '导入结果未知', imported_pending_verification: '已导入，待运行验收', blocked: '任务受阻',
}
