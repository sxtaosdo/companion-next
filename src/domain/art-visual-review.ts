import { ArtOutputContractError, artOutputVersionId, decodeArtOutputHistory, decodeArtOutputScope, decodeArtOutputVersion, getArtOutputVersion, sameArtOutputScope, type ArtOutputHistory, type ArtOutputScope, type ArtOutputVersion } from './art-output-history'

/** Visual decisions are independent of candidate selection, import and runtime
 * acceptance. These immutable events never modify an AiJobSnapshot. */
export type ArtVisualDecision = 'accepted' | 'rework'
export interface ArtVisualReviewCommand {
  readonly operationId: string
  readonly versionId: string
  readonly fileSha256: string
  readonly expectedHistoryRevision: number
  readonly expectedReviewRevision: number
  readonly observedJobRevision: number
  readonly decision: ArtVisualDecision
  /** Optional in the approved prototype; blank is valid for either decision. */
  readonly comment: string
  readonly approved: true
}
export interface ArtVisualReviewEvent {
  readonly revision: number
  readonly command: ArtVisualReviewCommand
  readonly version: ArtOutputVersion
  readonly reviewerId: string
  readonly reviewedAt: string
}
export interface ArtVisualReviewLedger {
  readonly schemaVersion: 'art-visual-review-v1'
  readonly scope: ArtOutputScope
  readonly revision: number
  readonly events: readonly ArtVisualReviewEvent[]
}
/** Supplied by authenticated server context, not copied from a request body.
 * The active job is a freshly decoded observation of this exact output. */
export interface ArtVisualReviewAuthority {
  readonly scope: ArtOutputScope
  readonly reviewerId: string
  readonly reviewedAt: string
  readonly currentSourceRevision: string
  readonly job: {
    readonly projectId: string; readonly jobId: string; readonly revision: number
    readonly state: string; readonly sourceRevision: string; readonly requestHash: string
    readonly historyOnly?: unknown
    readonly candidates: readonly { readonly candidateId: string; readonly assetId: string; readonly fileSha256: string; readonly width: number; readonly height: number }[]
  }
  /** Created only after the existing verified preview was rendered successfully.
   * This is explicit user/display acknowledgement, not cryptographic proof. */
  readonly display: {
    readonly versionId: string; readonly fileSha256: string
    readonly jobRevision: number; readonly sourceRevision: string; readonly displayed: true
  }
}
const fail = (code = 'ART_REVIEW_SCHEMA_INVALID'): never => { throw new ArtOutputContractError(code) }
function record(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const prototype = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value)
  if (prototype !== Object.prototype && prototype !== null || Reflect.ownKeys(value).some(key => typeof key !== 'string' || !('value' in descriptors[key]!))) return fail()
  if (keys && (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)))) return fail()
  return value as Record<string, unknown>
}
function integer(value: unknown, min = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) return fail()
  return value as number
}
function text(value: unknown, max: number, pattern?: RegExp): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value) || pattern && !pattern.test(value)) return fail()
  return value
}
function timestamp(value: unknown): string {
  const result = text(value, 40, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  if (!Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction: string | undefined) => '.' + (fraction ?? '').padEnd(3, '0') + 'Z')) return fail()
  return result
}
export function decodeArtVisualReviewCommand(value: unknown): ArtVisualReviewCommand {
  const row = record(value, ['operationId', 'versionId', 'fileSha256', 'expectedHistoryRevision', 'expectedReviewRevision', 'observedJobRevision', 'decision', 'comment', 'approved'])
  if (!['accepted', 'rework'].includes(row.decision as string) || row.approved !== true || typeof row.comment !== 'string' || row.comment.length > 2048 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(row.comment)) return fail()
  return Object.freeze({ operationId: text(row.operationId, 43, /^art-review-[a-f0-9]{32}$/), versionId: text(row.versionId, 201), fileSha256: text(row.fileSha256, 64, /^[a-f0-9]{64}$/), expectedHistoryRevision: integer(row.expectedHistoryRevision, 1), expectedReviewRevision: integer(row.expectedReviewRevision), observedJobRevision: integer(row.observedJobRevision), decision: row.decision as ArtVisualDecision, comment: row.comment.trim(), approved: true })
}
export function decodeArtVisualReviewLedger(value: unknown): ArtVisualReviewLedger {
  const row = record(value, ['schemaVersion', 'scope', 'revision', 'events'])
  if (row.schemaVersion !== 'art-visual-review-v1' || !Array.isArray(row.events)) return fail()
  const scope = decodeArtOutputScope(row.scope)
  const events = row.events.map((value, index): ArtVisualReviewEvent => {
    const event = record(value, ['revision', 'command', 'version', 'reviewerId', 'reviewedAt'])
    const command = decodeArtVisualReviewCommand(event.command), version = decodeArtOutputVersion(event.version)
    if (integer(event.revision, 1) !== index + 1 || command.expectedReviewRevision !== index || command.versionId !== version.versionId || command.fileSha256 !== version.fileSha256 || command.expectedHistoryRevision < version.ordinal || !sameArtOutputScope(scope, version.scope)) return fail()
    return Object.freeze({ revision: index + 1, command, version, reviewerId: text(event.reviewerId, 200), reviewedAt: timestamp(event.reviewedAt) })
  })
  if (integer(row.revision) !== events.length || new Set(events.map(event => event.command.operationId)).size !== events.length) return fail()
  const versions = new Map<string, string>()
  for (const event of events) {
    const serialized = JSON.stringify(event.version), previous = versions.get(event.version.versionId)
    if (previous !== undefined && previous !== serialized) return fail('ART_REVIEW_OUTPUT_MISMATCH')
    versions.set(event.version.versionId, serialized)
  }
  return Object.freeze({ schemaVersion: 'art-visual-review-v1', scope, revision: events.length, events: Object.freeze(events) })
}
export function createArtVisualReviewLedger(scope: ArtOutputScope): ArtVisualReviewLedger {
  return decodeArtVisualReviewLedger({ schemaVersion: 'art-visual-review-v1', scope, revision: 0, events: [] })
}
/** Authoritative pure transition. The host must persist it atomically with CAS
 * and operation identity. An UNKNOWN transport is reconciled by the same ID,
 * never translated into a decision or retried under a fresh operation ID. */
export function recordArtVisualReview(ledger: ArtVisualReviewLedger, history: ArtOutputHistory, input: ArtVisualReviewCommand, authority: ArtVisualReviewAuthority): ArtVisualReviewLedger {
  const current = decodeArtVisualReviewLedger(ledger), outputs = decodeArtOutputHistory(history), command = decodeArtVisualReviewCommand(input)
  const scope = decodeArtOutputScope(authority.scope), reviewerId = text(authority.reviewerId, 200), reviewedAt = timestamp(authority.reviewedAt)
  if (!sameArtOutputScope(scope, current.scope) || !sameArtOutputScope(scope, outputs.scope)) return fail('ART_REVIEW_SCOPE_MISMATCH')
  const existing = current.events.find(event => event.command.operationId === command.operationId)
  if (existing) {
    if (existing.reviewerId !== reviewerId || JSON.stringify(existing.command) !== JSON.stringify(command)) return fail('ART_REVIEW_OPERATION_CONFLICT')
    if (JSON.stringify(getArtOutputVersion(outputs, existing.version.versionId)) !== JSON.stringify(existing.version)) return fail('ART_REVIEW_OUTPUT_MISMATCH')
    // Exact committed operation readback stays idempotent after later revisions.
    return current
  }
  if (command.expectedReviewRevision !== current.revision || command.expectedHistoryRevision !== outputs.revision) return fail('ART_REVIEW_STALE')
  const version = getArtOutputVersion(outputs, command.versionId), job = record(authority.job), display = record(authority.display)
  if (command.fileSha256 !== version.fileSha256 || job.projectId !== scope.projectId || job.jobId !== version.jobId || job.sourceRevision !== version.sourceRevision || job.requestHash !== version.requestHash) return fail('ART_REVIEW_OUTPUT_MISMATCH')
  if (job.historyOnly !== undefined || authority.currentSourceRevision !== version.sourceRevision || !['reusable', 'awaiting_selection', 'selected', 'imported_pending_verification'].includes(job.state as string)) return fail('ART_REVIEW_SOURCE_UNCONFIRMED')
  if (integer(job.revision) !== command.observedJobRevision) return fail('ART_REVIEW_STALE')
  if (!Array.isArray(job.candidates)) return fail('ART_REVIEW_OUTPUT_MISMATCH')
  const candidates = job.candidates.filter(candidate => record(candidate).candidateId === version.candidateId)
  if (candidates.length !== 1) return fail('ART_REVIEW_OUTPUT_MISMATCH')
  const candidate = record(candidates[0])
  if (candidate.assetId !== scope.needId || candidate.fileSha256 !== version.fileSha256 || candidate.width !== version.width || candidate.height !== version.height || artOutputVersionId(job.jobId as string, candidate.candidateId as string) !== command.versionId) return fail('ART_REVIEW_OUTPUT_MISMATCH')
  if (display.displayed !== true || display.versionId !== version.versionId || display.fileSha256 !== version.fileSha256 || display.jobRevision !== command.observedJobRevision || display.sourceRevision !== version.sourceRevision) return fail('ART_REVIEW_PREVIEW_UNCONFIRMED')
  const event = { revision: current.revision + 1, command, version, reviewerId, reviewedAt }
  return decodeArtVisualReviewLedger({ ...current, revision: event.revision, events: [...current.events, event] })
}
/** Version-local visual state only; no global 'latest accepted' projection. */
export function artVisualReviewState(ledger: ArtVisualReviewLedger, history: ArtOutputHistory, versionId: string) {
  const current = decodeArtVisualReviewLedger(ledger), outputs = decodeArtOutputHistory(history), version = getArtOutputVersion(outputs, versionId)
  if (!sameArtOutputScope(current.scope, outputs.scope)) return fail('ART_REVIEW_SCOPE_MISMATCH')
  const events = current.events.filter(event => event.version.versionId === versionId)
  if (events.some(event => JSON.stringify(event.version) !== JSON.stringify(version))) return fail('ART_REVIEW_OUTPUT_MISMATCH')
  const latest = events.at(-1)
  return Object.freeze({ kind: 'visual-only' as const, versionId, fileSha256: version.fileSha256, state: latest?.command.decision ?? 'unreviewed', reviewRevision: latest?.revision ?? null, latest: latest ?? null })
}

export interface ArtVisualReviewAttempt {
  readonly scope: ArtOutputScope
  readonly command: ArtVisualReviewCommand
  readonly state: 'submitting' | 'unknown' | 'completed' | 'rejected'
}
export type ArtVisualReviewOutcome =
  | { readonly state: 'completed'; readonly operationId: string; readonly ledger: ArtVisualReviewLedger }
  | { readonly state: 'rejected'; readonly operationId: string }
  | { readonly state: 'unknown'; readonly operationId: string }
export function beginArtVisualReviewAttempt(previous: ArtVisualReviewAttempt | null, scope: ArtOutputScope, input: ArtVisualReviewCommand): ArtVisualReviewAttempt {
  if (previous) {
    const old = decodeReviewAttempt(previous)
    if (old.state === 'submitting' || old.state === 'unknown') return fail('ART_REVIEW_PENDING_BLOCKED')
  }
  return Object.freeze({ scope: decodeArtOutputScope(scope), command: decodeArtVisualReviewCommand(input), state: 'submitting' })
}
function decodeReviewAttempt(value: unknown): ArtVisualReviewAttempt {
  const row = record(value, ['scope', 'command', 'state'])
  if (!['submitting', 'unknown', 'completed', 'rejected'].includes(row.state as string)) return fail()
  return Object.freeze({ scope: decodeArtOutputScope(row.scope), command: decodeArtVisualReviewCommand(row.command), state: row.state as ArtVisualReviewAttempt['state'] })
}
/** Only a known rejected response or exact committed operation readback releases
 * UNKNOWN. Network errors/timeouts must be passed as unknown by the adapter. */
export function settleArtVisualReviewAttempt(attempt: ArtVisualReviewAttempt, outcome: ArtVisualReviewOutcome): ArtVisualReviewAttempt {
  const current = decodeReviewAttempt(attempt), result = record(outcome)
  if (result.operationId !== current.command.operationId || !['completed', 'rejected', 'unknown'].includes(result.state as string)) return fail('ART_REVIEW_OPERATION_CONFLICT')
  const terminal = current.state === 'completed' || current.state === 'rejected'
  if (terminal && result.state !== current.state) {
    if (result.state === 'unknown') return current // A late timeout cannot erase a known terminal receipt.
    return fail('ART_REVIEW_OPERATION_CONFLICT')
  }
  if (result.state === 'completed') {
    const ledger = decodeArtVisualReviewLedger(result.ledger)
    const event = ledger.events.find(event => event.command.operationId === current.command.operationId)
    if (!sameArtOutputScope(ledger.scope, current.scope) || !event || JSON.stringify(event.command) !== JSON.stringify(current.command)) return fail('ART_REVIEW_OPERATION_CONFLICT')
  }
  return Object.freeze({ ...current, state: result.state as ArtVisualReviewAttempt['state'] })
}
