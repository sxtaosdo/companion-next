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
export interface AiJobBudget { maxAssets: 2; candidatesPerAsset: 1; submissionAttempts: 1 }
export interface AiJobSnapshot {
  projectId: string; jobId: string; revision: number; state: AiJobState; sourceRevision: string; requestHash: string
  profile: string; budget: AiJobBudget; createdAt: string; assets: Array<{ assetId: string; relativePath: string }>
  candidates: AiJobCandidate[]; selectedIds: string[]; import: AiJobImport | null; workerResident: false; productionVerified: false
  mode?: AiJobMode; origin?: 'generated' | 'adopted'; errorCode?: string | null
  resourceSnapshot?: AiJobResourceSnapshot
  productAcceptance?: AiJobProductAcceptance
}
export interface AiJobsView {
  schemaVersion: 'companion-icons-v1'; projectId: string; sourceRevision: string; jobs: AiJobSnapshot[]
  profile: AiJobBudget & { id: string }; mode?: AiJobMode; adoptionSources?: Array<{ sourceId: string; fileSha256: string }>
  schedulerEnabled: false; workerResident: false
}
export interface AiJobPreview { candidateId: string; mimeType: 'image/png'; base64: string; sha256: string; width: 1024; height: 1024 }
export interface AiJobsReadProvider {
  readonly label: string
  /** Optional for standalone reads; mutation pipelines require tracked I/O drainage. */
  waitForIdle?(): Promise<void>
  readJobs(projectId: string, signal?: AbortSignal): Promise<AiJobsView>
  readStatus(projectId: string, jobId: string, signal?: AbortSignal): Promise<AiJobSnapshot>
  previewCandidate(projectId: string, jobId: string, candidate: AiJobCandidate, signal?: AbortSignal): Promise<AiJobPreview>
}
export type AiJobsReadEndpoint = 'jobs' | 'status' | 'candidate'
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
  const importReceipt = decodeImport(raw.import)
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
    ...(resourceSnapshot ? { resourceSnapshot } : {}), ...(productAcceptance ? { productAcceptance } : {}) }
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
export async function verifyAiJobPreview(value: unknown, candidate: AiJobCandidate): Promise<AiJobPreview> {
  const expected = decodeAiJobCandidate(candidate), raw = record(value)
  if (!isAiCandidateId(expected.candidateId) || (raw.schemaVersion !== undefined && raw.schemaVersion !== 'companion-icons-v1') || raw.candidateId !== expected.candidateId || raw.mimeType !== 'image/png') throw invalid()
  const base64 = text(raw.base64, AI_JOBS_READ_LIMITS.maxBase64Length)
  if (base64.length < 76 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw invalid()
  let binary: string
  try { binary = atob(base64); if (btoa(binary) !== base64) throw invalid() } catch { throw invalid() }
  if (binary.length > AI_JOBS_READ_LIMITS.maxCandidateBytes) throw new AiJobsReadError('response-too-large', 'candidate')
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0)), view = new DataView(bytes.buffer)
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) throw invalid()
  let offset = 8, count = 0, idat = false, ended = false, afterIdat = false
  while (offset < bytes.length) {
    if (++count > AI_JOBS_READ_LIMITS.maxChunks || offset + 12 > bytes.length) throw invalid()
    const size = view.getUint32(offset), end = offset + 12 + size, type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (end > bytes.length || crc32(bytes, offset + 4, end - 4) !== view.getUint32(end - 4)) throw invalid()
    if (count === 1) {
      if (type !== 'IHDR' || size !== 13 || view.getUint32(offset + 8) !== 1024 || view.getUint32(offset + 12) !== 1024
        || bytes[offset + 16] !== 8 || bytes[offset + 17] !== 6 || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] !== 0) throw invalid()
    } else if (type === 'IDAT') { if (afterIdat || size === 0) throw invalid(); idat = true }
    else if (type === 'IEND') { if (!idat || size !== 0 || end !== bytes.length) throw invalid(); ended = true }
    else if (type === 'tEXt') { if (idat) afterIdat = true; if (size > 256 * 1024) throw invalid() }
    // Conservative client subset: static RGBA, no APNG, compressed metadata, executable or external content.
    else throw invalid()
    offset = end
  }
  if (!ended) throw invalid()
  if (!globalThis.crypto?.subtle) throw new AiJobsReadError('verification-unavailable', 'candidate')
  let digest: ArrayBuffer
  try { digest = await globalThis.crypto.subtle.digest('SHA-256', bytes) } catch { throw new AiJobsReadError('verification-unavailable', 'candidate') }
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  if (actual !== expected.fileSha256) throw invalid()
  return { candidateId: expected.candidateId, mimeType: 'image/png', base64, sha256: actual, width: 1024, height: 1024 }
}
export const AI_JOB_STATE_LABELS: Record<AiJobState, string> = {
  queued: '已入队', waiting_service: '等待服务', running: '任务执行中', unknown: '生成结果未知', failed: '任务失败', reusable: '发现可复用内容',
  awaiting_selection: '等待审阅选择', selected: '已保存候选选择', import_unknown: '导入结果未知', imported_pending_verification: '已导入，待运行验收', blocked: '任务受阻',
}
