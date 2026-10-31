/** Candidate contract only. No persistence, file access, transport or image verification.
 * Observations must come from the existing decoded job/verified-preview adapters.
 * A history ordinal is registration order, never generation time or job revision. */
export class ArtOutputContractError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'ArtOutputContractError' }
}
const fail = (code = 'ART_OUTPUT_SCHEMA_INVALID'): never => { throw new ArtOutputContractError(code) }
const hash = /^[a-f0-9]{64}$/
const sourceRevision = /^[a-f0-9]{40}$/
const jobId = /^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/
const candidateId = /^CANDIDATE-[a-z0-9-]+-1$/
const entityId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/
const controls = /[\u0000-\u001f\u007f]/
function object(value: unknown, keys?: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return fail()
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !('value' in descriptors[key]!))) return fail()
  if (keys && (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)))) return fail()
  return value as Record<string, unknown>
}
function text(value: unknown, max: number, pattern?: RegExp): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || controls.test(value) || pattern && !pattern.test(value)) return fail()
  return value
}
function integer(value: unknown, min = 1): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) return fail()
  return value as number
}
function timestamp(value: unknown): string {
  const result = text(value, 40, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  if (!Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction: string | undefined) => '.' + (fraction ?? '').padEnd(3, '0') + 'Z')) return fail()
  return result
}
export interface ArtOutputScope {
  readonly projectId: string
  readonly projectPath: string
  /** Explicit host-declared domain; null means the original project scope. */
  readonly resourceDomainId: string | null
  readonly needId: string
}
export interface ArtOutputBinding {
  /** Actual frozen task snapshot receipt, never a hash made from the latest draft. */
  readonly snapshotSha256: string
  readonly normHash: string
  readonly specId: string
  readonly specVersion: number
  readonly needVersion: number
}
export interface ArtOutputVersion {
  readonly versionId: string
  readonly ordinal: number
  readonly scope: ArtOutputScope
  readonly binding: ArtOutputBinding
  readonly jobId: string
  readonly candidateId: string
  readonly sourceRevision: string
  readonly requestHash: string
  readonly fileSha256: string
  readonly width: 1024
  readonly height: 1024
  readonly mimeType: 'image/png'
  readonly origin: 'generated' | 'adopted' | 'unspecified'
  readonly createdAt: string
}
export interface ArtOutputHistory {
  readonly schemaVersion: 'art-output-history-v1'
  readonly scope: ArtOutputScope
  readonly revision: number
  readonly versions: readonly ArtOutputVersion[]
}
/** Structural projection of an already decoded AiJobSnapshot. Extra job metadata
 * is ignored; generation/acceptance claims are never manufactured from it. */
export interface ArtOutputObservation {
  readonly scope: ArtOutputScope
  readonly binding: ArtOutputBinding
  readonly job: {
    readonly projectId: string; readonly jobId: string; readonly sourceRevision: string
    readonly requestHash: string; readonly state: string; readonly createdAt: string
    readonly origin?: 'generated' | 'adopted'
    readonly assets: readonly { readonly assetId: string }[]
    readonly candidates: readonly { readonly candidateId: string; readonly assetId: string; readonly fileSha256: string; readonly width: number; readonly height: number; readonly hasAlpha: boolean }[]
  }
  readonly candidateId: string
}
export function decodeArtOutputScope(value: unknown): ArtOutputScope {
  const row = object(value, ['projectId', 'projectPath', 'resourceDomainId', 'needId'])
  const domain = row.resourceDomainId
  if (domain !== null && (typeof domain !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(domain) || domain === 'legacy')) return fail()
  return Object.freeze({ projectId: text(row.projectId, 16, /^[a-f0-9]{16}$/), projectPath: text(row.projectPath, 1024), resourceDomainId: domain as string | null, needId: text(row.needId, 80, entityId) })
}
export function decodeArtOutputBinding(value: unknown): ArtOutputBinding {
  const row = object(value, ['snapshotSha256', 'normHash', 'specId', 'specVersion', 'needVersion'])
  return Object.freeze({ snapshotSha256: text(row.snapshotSha256, 64, hash), normHash: text(row.normHash, 64, hash), specId: text(row.specId, 80, entityId), specVersion: integer(row.specVersion), needVersion: integer(row.needVersion) })
}
export function sameArtOutputScope(left: ArtOutputScope, right: ArtOutputScope): boolean {
  return JSON.stringify(decodeArtOutputScope(left)) === JSON.stringify(decodeArtOutputScope(right))
}
export function artOutputVersionId(job: string, candidate: string): string {
  return text(job, 100, jobId) + ':' + text(candidate, 100, candidateId)
}
export function decodeArtOutputVersion(value: unknown): ArtOutputVersion {
  const row = object(value, ['versionId', 'ordinal', 'scope', 'binding', 'jobId', 'candidateId', 'sourceRevision', 'requestHash', 'fileSha256', 'width', 'height', 'mimeType', 'origin', 'createdAt'])
  const id = artOutputVersionId(text(row.jobId, 100, jobId), text(row.candidateId, 100, candidateId))
  if (row.versionId !== id || row.width !== 1024 || row.height !== 1024 || row.mimeType !== 'image/png' || !['generated', 'adopted', 'unspecified'].includes(row.origin as string)) return fail()
  return Object.freeze({ versionId: id, ordinal: integer(row.ordinal), scope: decodeArtOutputScope(row.scope), binding: decodeArtOutputBinding(row.binding), jobId: row.jobId as string, candidateId: row.candidateId as string, sourceRevision: text(row.sourceRevision, 40, sourceRevision), requestHash: text(row.requestHash, 64, hash), fileSha256: text(row.fileSha256, 64, hash), width: 1024, height: 1024, mimeType: 'image/png', origin: row.origin as ArtOutputVersion['origin'], createdAt: timestamp(row.createdAt) })
}
export function decodeArtOutputHistory(value: unknown): ArtOutputHistory {
  const row = object(value, ['schemaVersion', 'scope', 'revision', 'versions'])
  if (row.schemaVersion !== 'art-output-history-v1' || !Array.isArray(row.versions)) return fail()
  const scope = decodeArtOutputScope(row.scope), versions = row.versions.map(decodeArtOutputVersion)
  if (integer(row.revision, 0) !== versions.length || versions.some((version, index) => version.ordinal !== index + 1 || !sameArtOutputScope(version.scope, scope)) || new Set(versions.map(version => version.versionId)).size !== versions.length) return fail()
  return Object.freeze({ schemaVersion: 'art-output-history-v1', scope, revision: versions.length, versions: Object.freeze(versions) })
}
export function createArtOutputHistory(scope: ArtOutputScope): ArtOutputHistory {
  return decodeArtOutputHistory({ schemaVersion: 'art-output-history-v1', scope, revision: 0, versions: [] })
}
export function appendArtOutputVersion(history: ArtOutputHistory, expectedRevision: number, observation: ArtOutputObservation): ArtOutputHistory {
  const current = decodeArtOutputHistory(history), scope = decodeArtOutputScope(observation.scope), job = object(observation.job)
  integer(expectedRevision, 0)
  if (expectedRevision > current.revision) return fail('ART_OUTPUT_HISTORY_STALE')
  if (!sameArtOutputScope(scope, current.scope) || job.projectId !== scope.projectId) return fail('ART_OUTPUT_SCOPE_MISMATCH')
  if (!['reusable', 'awaiting_selection', 'selected', 'imported_pending_verification'].includes(job.state as string)) return fail('ART_OUTPUT_SOURCE_UNCONFIRMED')
  if (!Array.isArray(job.assets) || !Array.isArray(job.candidates) || job.assets.filter(asset => object(asset).assetId === scope.needId).length !== 1) return fail('ART_OUTPUT_SOURCE_UNCONFIRMED')
  const candidates = job.candidates.filter(candidate => object(candidate).candidateId === observation.candidateId)
  if (candidates.length !== 1) return fail('ART_OUTPUT_SOURCE_UNCONFIRMED')
  const candidate = object(candidates[0])
  if (candidate.assetId !== scope.needId || candidate.hasAlpha !== true) return fail('ART_OUTPUT_SCOPE_MISMATCH')
  const id = artOutputVersionId(job.jobId as string, observation.candidateId), existing = current.versions.find(version => version.versionId === id)
  const proposed = decodeArtOutputVersion({ versionId: id, ordinal: existing?.ordinal ?? current.revision + 1, scope, binding: observation.binding, jobId: job.jobId, candidateId: observation.candidateId, sourceRevision: job.sourceRevision, requestHash: job.requestHash, fileSha256: candidate.fileSha256, width: candidate.width, height: candidate.height, mimeType: 'image/png', origin: job.origin ?? 'unspecified', createdAt: job.createdAt })
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(proposed)) return fail('ART_OUTPUT_VERSION_CONFLICT')
    return current // Exact duplicate observation; immutable row and ordinal stay unchanged.
  }
  if (expectedRevision !== current.revision) return fail('ART_OUTPUT_HISTORY_STALE')
  return decodeArtOutputHistory({ ...current, revision: current.revision + 1, versions: [...current.versions, proposed] })
}
export function getArtOutputVersion(history: ArtOutputHistory, versionId: string): ArtOutputVersion {
  const value = decodeArtOutputHistory(history).versions.find(version => version.versionId === versionId)
  return value ?? fail('ART_OUTPUT_VERSION_MISSING')
}
/** Checks metadata binding only. The existing verifyAiJobPreview adapter must
 * first verify the actual bytes. This function does not claim to hash pixels. */
export function assertArtOutputPreview(version: ArtOutputVersion, preview: { candidateId: string; sha256: string; width: number; height: number; mimeType: string }): void {
  const current = decodeArtOutputVersion(version), claim = object(preview)
  if (claim.candidateId !== current.candidateId || claim.sha256 !== current.fileSha256 || claim.width !== current.width || claim.height !== current.height || claim.mimeType !== current.mimeType) return fail('ART_OUTPUT_PREVIEW_MISMATCH')
}
export function compareArtOutputVersions(history: ArtOutputHistory, leftId: string, rightId: string, currentSourceRevision: string) {
  const current = decodeArtOutputHistory(history), source = text(currentSourceRevision, 40, sourceRevision)
  if (leftId === rightId) return fail('ART_OUTPUT_COMPARISON_SAME_VERSION')
  const left = getArtOutputVersion(current, leftId), right = getArtOutputVersion(current, rightId)
  return Object.freeze({ mode: 'read-only' as const, scope: current.scope, historyRevision: current.revision, left, right,
    sameContent: left.fileSha256 === right.fileSha256,
    leftHistorical: left.sourceRevision !== source, rightHistorical: right.sourceRevision !== source,
    bindingChanged: JSON.stringify(left.binding) !== JSON.stringify(right.binding),
    sourceChanged: left.sourceRevision !== right.sourceRevision, requestChanged: left.requestHash !== right.requestHash })
}
