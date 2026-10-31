import { aiResourceSnapshotOutput } from './ai-resource-snapshot'
import { decodeAiJobSnapshot, isAiCandidateId, isAiJobId } from './ai-jobs-read'
import type { AiJobSnapshot } from './ai-jobs-read'
import { isAiProjectId } from './ai-resource-read'

/** Fixed original job routes, including the already-deployed independent variant importer. */
export const AI_JOB_ACTIONS = ['run-next', 'resume', 'select', 'import', 'export-variant', 'import-variant'] as const
export type AiJobAction = typeof AI_JOB_ACTIONS[number]
export type AiJobActionInput = { jobId: string; revision: number; gpuUseApproved: true }
  | { jobId: string; revision: number }
  | { jobId: string; revision: number; selectedIds: string[]; approved: true }
  | { jobId: string; revision: number; approved: true }
  | { jobId: string; revision: number; candidateId: string; width: number; height: number; allowUpscale: boolean; expectedTargetSha256: null; approved: true }
  | { jobId: string; revision: number; candidateId: string; width: number; height: number; destinationUrl: string; expectedVariantSha256: string; expectedReceiptSha256: string; approved: true }
/** approved is local consent evidence. Only input is serialized, preserving the original strict wire schema. */
export interface AiJobActionSubmission { operation: AiJobAction; input: AiJobActionInput; snapshot: AiJobSnapshot; approved: true }
export interface AiJobVariantReceipt {
  jobId: string; revision: number; candidateId: string; relativePath: string; sha256: string; sourceSha256: string
  width: number; height: number; created: boolean; upscaled: boolean; qualityLimit: 'Upscaling adds no new detail.' | null
  receiptSha256?: string
}
export type AiJobActionResult = { kind: 'dispatch'; dispatchAccepted: true; job: AiJobSnapshot; artifact?: 'variant'; operationId?: string }
  | { kind: 'selection'; job: AiJobSnapshot } | { kind: 'variant'; receipt: AiJobVariantReceipt }
export interface AiJobActionsProvider {
  readonly label: string
  execute(projectId: string, submission: AiJobActionSubmission, signal?: AbortSignal): Promise<AiJobActionResult>
  /** Resolves only after transport, outstanding body reads and late cancellation actually settle. */
  waitForIdle(): Promise<void>
}
export type AiJobActionOutcome = 'not-sent' | 'rejected' | 'conflict' | 'unknown'
export type AiJobActionCode = 'image-transparency-required' | 'image-content-empty' | 'art-review-unconfirmed' | 'invalid-input' | 'busy' | 'aborted' | 'timeout' | 'unauthorized' | 'forbidden' | 'stale' | 'rejected' | 'unconfirmed' | 'invalid-shape' | 'response-too-large' | 'network-error'
const messages: Record<AiJobActionCode, string> = {
  'image-transparency-required':'候选图片没有真实透明像素，未导出；请先取得符合透明要求的图片。',
  'image-content-empty':'候选图片完全透明，没有可见内容，未导出。',
  'art-review-unconfirmed':'原后台在导入前拒绝：请先完成并确认当前候选的视觉审阅，再重新核对导入。',
  'invalid-input': '本次原任务操作参数或状态不符合已核合同，未发送请求。', busy: '已有原任务操作或请求清理尚未结束，未重复发送。',
  aborted: '已停止等待原任务操作；后台可能已经执行，请刷新同一个原任务。', timeout: '原任务操作等待超时；结果未知，不能重复提交。',
  unauthorized: 'Companion 会话无效（401），操作被拒绝。', forbidden: 'Companion 拒绝本次操作（403），请核对已有同源会话。',
  stale: '原任务版本或状态已变化；请刷新同一个原任务后重新核对。', rejected: '原后台已明确拒绝本次操作；没有自动重试。',
  unconfirmed: '原任务操作结果未确认，可能已经执行；请核对原任务。', 'invalid-shape': '操作响应未通过原任务身份与合同校验，结果未知。',
  'response-too-large': '操作响应超出安全读取预算，结果未知。', 'network-error': '操作连接未完成，结果未知；没有重复提交。',
}
export class AiJobActionError extends Error {
  constructor(readonly code: AiJobActionCode, readonly outcome: AiJobActionOutcome, readonly status?: number) {
    super(code === 'aborted' && outcome === 'not-sent' ? '原任务操作已取消，未发送请求。' : messages[code]); this.name = 'AiJobActionError'
  }
}
export const AI_JOB_ACTION_LIMITS = Object.freeze({ maxRequestBytes: 128 * 1024, maxResponseBytes: 256 * 1024, maxChunks: 4096, timeoutMs: 20_000 })
const invalid = () => new AiJobActionError('invalid-input', 'not-sent')
const shape = () => new AiJobActionError('invalid-shape', 'unknown')
const sha = /^[a-f0-9]{64}$/
/** Fixed sibling filename, from the sealed destination and the actual exported file identity. */
export function aiVariantDestination(job: AiJobSnapshot, variant: { candidateId: string; width: number; height: number; sha256: string }): string {
  const candidate = job.candidates.find(row => row.candidateId === variant.candidateId), output = aiResourceSnapshotOutput(job.resourceSnapshot,candidate?.assetId)
  if (!output || !candidate || !sha.test(variant.sha256)) throw invalid()
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(candidate.assetId)) throw invalid()
  const destination = `db://${output.directory}/${candidate.assetId}-${variant.width}x${variant.height}-${variant.sha256.slice(0, 12)}.png`
  if (!/^db:\/\/assets\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.png$/.test(destination) || destination.split('/').some(part => part === '.' || part === '..')) throw invalid()
  return destination
}
export function aiJobActionCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(aiJobActionCanonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${aiJobActionCanonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Reflect.ownKeys(value).length !== keys.length
    || Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) throw invalid()
  return value as Record<string, unknown>
}
export function aiJobActionIdentityMatches(a: AiJobSnapshot, b: AiJobSnapshot): boolean {
  return a.projectId === b.projectId && a.jobId === b.jobId && a.requestHash === b.requestHash && a.sourceRevision === b.sourceRevision
    && aiJobActionCanonical(a.assets) === aiJobActionCanonical(b.assets)
    && (!(a.resourceSnapshot?.state==='sealed' && 'kind' in a.resourceSnapshot || b.resourceSnapshot?.state==='sealed' && 'kind' in b.resourceSnapshot) || aiJobActionCanonical(a.resourceSnapshot)===aiJobActionCanonical(b.resourceSnapshot))
}
export function aiJobActionAllowed(operation: AiJobAction, job: AiJobSnapshot, offlineOnly = false): boolean {
  // The mother job can remain selected after a variant import. Preserve that separate binding.
  if (job.variantImport !== undefined || job.historyOnly !== undefined) return false
  if ((offlineOnly || job.mode === 'offline_import_only') && (operation === 'run-next' || operation === 'resume')) return false
  if (operation === 'run-next') return ['queued', 'waiting_service'].includes(job.state)
  if (operation === 'resume') return ['unknown', 'running'].includes(job.state)
  if (operation === 'select') return ['awaiting_selection', 'selected'].includes(job.state)
  if (operation === 'import') return job.state === 'selected' && job.selectedIds.length > 0
  return ['selected', 'imported_pending_verification'].includes(job.state) && job.selectedIds.length === 1
    && !!aiResourceSnapshotOutput(job.resourceSnapshot,job.candidates.find(c=>c.candidateId===job.selectedIds[0])?.assetId)
}
export function validateAiJobActionSubmission(projectId: string, value: unknown): AiJobActionSubmission {
  try {
    const raw = exact(value, ['operation', 'input', 'snapshot', 'approved'])
    if (!isAiProjectId(projectId) || raw.approved !== true || !AI_JOB_ACTIONS.includes(raw.operation as AiJobAction)) throw invalid()
    const operation = raw.operation as AiJobAction, snapshot = decodeAiJobSnapshot(raw.snapshot, projectId)
    if (!aiJobActionAllowed(operation, snapshot)) throw invalid()
    const fields = operation === 'run-next' ? ['gpuUseApproved'] : operation === 'select' ? ['selectedIds', 'approved'] : operation === 'import' ? ['approved']
      : operation === 'export-variant' ? ['candidateId', 'width', 'height', 'allowUpscale', 'expectedTargetSha256', 'approved']
      : operation === 'import-variant' ? ['candidateId', 'width', 'height', 'destinationUrl', 'expectedVariantSha256', 'expectedReceiptSha256', 'approved'] : []
    const input = exact(raw.input, ['jobId', 'revision', ...fields])
    if (!isAiJobId(input.jobId) || input.jobId !== snapshot.jobId || input.revision !== snapshot.revision) throw invalid()
    if (operation === 'run-next' && input.gpuUseApproved !== true || ['select', 'import', 'export-variant', 'import-variant'].includes(operation) && input.approved !== true) throw invalid()
    if (operation === 'select') {
      if (!Array.isArray(input.selectedIds) || input.selectedIds.length < 1 || input.selectedIds.length > 2 || new Set(input.selectedIds).size !== input.selectedIds.length) throw invalid()
      const candidates = input.selectedIds.map(id => { if (!isAiCandidateId(id)) throw invalid(); const candidate = snapshot.candidates.find(c => c.candidateId === id); if (!candidate) throw invalid(); return candidate })
      if (new Set(candidates.map(c => c.assetId)).size !== candidates.length) throw invalid()
    }
    if (operation === 'import' && snapshot.selectedIds.some(id => !isAiCandidateId(id))) throw invalid()
    if (operation === 'export-variant' || operation === 'import-variant') {
      const candidate = snapshot.candidates.find(c => c.candidateId === input.candidateId)
      if (!candidate || !isAiCandidateId(input.candidateId) || snapshot.selectedIds[0] !== input.candidateId || typeof input.width !== 'number' || typeof input.height !== 'number'
        || !Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < 1 || input.height < 1 || input.width > 4096 || input.height > 4096 || input.width * input.height > 16_000_000
        ) throw invalid()
      if (operation === 'export-variant' && (typeof input.allowUpscale !== 'boolean' || input.expectedTargetSha256 !== null || input.width > 1024 && input.height > 1024 && !input.allowUpscale)) throw invalid()
      if (operation === 'import-variant' && (typeof input.expectedVariantSha256 !== 'string' || !sha.test(input.expectedVariantSha256)
        || typeof input.expectedReceiptSha256 !== 'string' || !sha.test(input.expectedReceiptSha256)
        || input.destinationUrl !== aiVariantDestination(snapshot, { candidateId: input.candidateId, width: input.width, height: input.height, sha256: input.expectedVariantSha256 }))) throw invalid()
    }
    return { operation, input: JSON.parse(JSON.stringify(input)) as AiJobActionInput, snapshot, approved: true }
  } catch { throw invalid() }
}
/** The HTTP response uses companion-icons-v1; companion-icon-variant-v1 belongs to the stored receipt file only. */
export function decodeAiJobActionResponse(value: unknown, projectId: string, submission: AiJobActionSubmission): AiJobActionResult {
  try {
    const checked = validateAiJobActionSubmission(projectId, submission), expected = checked.snapshot
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw shape()
    const raw = value as Record<string, unknown>
    if (raw.schemaVersion !== 'companion-icons-v1') throw shape()
    if (checked.operation === 'export-variant') {
      const input = checked.input as Extract<AiJobActionInput, { candidateId: string }>, candidate = expected.candidates.find(c => c.candidateId === input.candidateId)!
      const output = aiResourceSnapshotOutput(expected.resourceSnapshot,candidate.assetId)
      if (!output) throw shape()
      const upscaled = input.width > 1024 && input.height > 1024
      const path = `${output.exportDirectory}/${candidate.assetId}-${input.width}x${input.height}-${candidate.fileSha256.slice(0, 12)}.png`
      if (raw.jobId !== expected.jobId || raw.revision !== expected.revision || raw.candidateId !== candidate.candidateId || raw.relativePath !== path
        || typeof raw.sha256 !== 'string' || !sha.test(raw.sha256) || raw.sourceSha256 !== candidate.fileSha256 || raw.width !== input.width || raw.height !== input.height
        || typeof raw.created !== 'boolean' || raw.upscaled !== upscaled || raw.qualityLimit !== (upscaled ? 'Upscaling adds no new detail.' : null) || raw.dispatchAccepted !== undefined) throw shape()
      return { kind: 'variant', receipt: { jobId: expected.jobId, revision: expected.revision, candidateId: candidate.candidateId, relativePath: path, sha256: raw.sha256,
        sourceSha256: candidate.fileSha256, width: input.width, height: input.height, created: raw.created, upscaled, qualityLimit: upscaled ? 'Upscaling adds no new detail.' : null,
        ...(raw.receiptSha256 === undefined ? {} : { receiptSha256: typeof raw.receiptSha256 === 'string' && sha.test(raw.receiptSha256) ? raw.receiptSha256 : (() => { throw shape() })() }) } }
    }
    const job = decodeAiJobSnapshot(raw.job, projectId, expected.jobId)
    if (!aiJobActionIdentityMatches(expected, job) || aiJobActionCanonical(job.candidates) !== aiJobActionCanonical(expected.candidates)) throw shape()
    if (checked.operation === 'select') {
      if (raw.dispatchAccepted !== undefined || job.revision <= expected.revision || job.state !== 'selected'
        || aiJobActionCanonical([...job.selectedIds].sort()) !== aiJobActionCanonical([...(checked.input as { selectedIds: string[] }).selectedIds].sort())) throw shape()
      return { kind: 'selection', job }
    }
    if (checked.operation === 'import-variant' && raw.artifact !== 'variant') throw shape()
    if (raw.dispatchAccepted !== true || raw.workerResident !== false || job.revision !== expected.revision || job.state !== expected.state
      || aiJobActionCanonical(job.selectedIds) !== aiJobActionCanonical(expected.selectedIds)) throw shape()
    if (raw.operationId !== undefined && (checked.operation !== 'import-variant' || typeof raw.operationId !== 'string' || !/^icon-import-[a-f0-9]{32}$/.test(raw.operationId))) throw shape()
    return { kind: 'dispatch', dispatchAccepted: true, job, ...(checked.operation === 'import-variant' ? { artifact: 'variant' as const } : {}), ...(typeof raw.operationId === 'string' ? { operationId: raw.operationId } : {}) }
  } catch { throw shape() }
}
/** Revalidate even an injected provider result. A normalized dispatch is still a pre-execution acknowledgement. */
export function validateAiJobActionResult(value: AiJobActionResult, projectId: string, submission: AiJobActionSubmission): AiJobActionResult {
  if (!value || typeof value !== 'object') throw shape()
  if (value.kind === 'dispatch') return decodeAiJobActionResponse({ schemaVersion: 'companion-icons-v1', dispatchAccepted: value.dispatchAccepted, workerResident: false, job: value.job,
    ...(value.artifact === undefined ? {} : { artifact: value.artifact }), ...(value.operationId === undefined ? {} : { operationId: value.operationId }) }, projectId, submission)
  if (value.kind === 'selection') return decodeAiJobActionResponse({ schemaVersion: 'companion-icons-v1', job: value.job }, projectId, submission)
  if (value.kind === 'variant') return decodeAiJobActionResponse({ schemaVersion: 'companion-icons-v1', ...value.receipt }, projectId, submission)
  throw shape()
}
