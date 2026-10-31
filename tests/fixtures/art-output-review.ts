import { vi } from 'vitest'
import type { WorkbenchContext } from '../../src/adapters/art-workbench'
import type { AiJobSnapshot } from '../../src/domain/ai-jobs-read'
import type { WorkbenchNeed } from '../../src/domain/art-workbench'
import { appendArtOutputVersion, createArtOutputHistory, type ArtOutputObservation, type ArtOutputScope } from '../../src/domain/art-output-history'
import { createArtVisualReviewLedger, recordArtVisualReview } from '../../src/domain/art-visual-review'
import type { ArtOutputReviewInput, ArtOutputReviewOperation, ArtOutputReviewProvider, ArtOutputReviewSnapshot, ArtOutputVersionPreview } from '../../src/adapters/art-output-review'
import type { ArtOutputPendingStorage } from '../../src/stores/art-output-review-pending'

// Isolated UI/API fixtures; no real service, project, image file or model output.
export const source = {}
export const scope: ArtOutputScope = { projectId: '1234567890abcdef', projectPath: 'D:/fixture-only', resourceDomainId: null, needId: 'fixture-icon' }
export const context: WorkbenchContext = { projectId: scope.projectId, projectPath: scope.projectPath, source }
export const receiptId = '12345678-1234-4123-8123-123456789abc'
export function observation(fileSha256 = '4'.repeat(64)): ArtOutputObservation {
  return { scope, binding: { snapshotSha256: '1'.repeat(64), normHash: '2'.repeat(64), specId: 'icon', specVersion: 1, needVersion: 1 }, candidateId: 'CANDIDATE-fixture-icon-1', job: { projectId: scope.projectId, jobId: 'STUDIO-RUN-fixture-a1b2c3d4', sourceRevision: 'a'.repeat(40), requestHash: '3'.repeat(64), state: 'awaiting_selection', createdAt: '2026-10-25T10:00:00Z', origin: 'generated', assets: [{ assetId: scope.needId }], candidates: [{ candidateId: 'CANDIDATE-fixture-icon-1', assetId: scope.needId, fileSha256, width: 1024, height: 1024, hasAlpha: true }] } }
}
export function job(fileSha256 = '4'.repeat(64)): AiJobSnapshot {
  const value = observation(fileSha256).job
  return { ...value, revision: 4, state: 'awaiting_selection', profile: 'local-icon-v1', budget: { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, assets: [{ assetId: scope.needId, relativePath: 'assets/art/fixture.png' }], candidates: [{ ...value.candidates[0]!, width: 1024, height: 1024, hasAlpha: true }], selectedIds: [], import: null, workerResident: false, productionVerified: false }
}
export function need(): WorkbenchNeed { return { id: scope.needId, name: 'Fixture icon', version: 1, content: 'Synthetic fixture only', specId: 'icon', specVersion: 1, spec: { id: 'icon', name: 'Fixture spec', category: 'icon', version: 1, sizePolicy: 'fixed', width: 128, height: 128, destination: 'assets/art', exportDirectory: 'art/final', imageOutput: 'transparent-png', style: '', references: [] }, references: [], jobId: job().jobId } }
export function snapshot(fileSha256 = '4'.repeat(64), empty = false): ArtOutputReviewSnapshot {
  const history = empty ? createArtOutputHistory(scope) : appendArtOutputVersion(createArtOutputHistory(scope), 0, observation(fileSha256))
  return { schemaVersion: 'art-output-review-snapshot-v1', scope, history, reviews: createArtVisualReviewLedger(scope), observedAt: '2026-10-25T12:00:00Z', capabilities: { registerOutput: true, review: true, immutablePreview: true, historicalPreview: false }, snapshot: { workbenchHash: 'b'.repeat(64), currentJobId: job().jobId, currentSourceRevision: 'a'.repeat(40) } }
}
export function preview(value = snapshot(), base64 = 'c3ludGhldGljLXByb3ZpZGVyLWZpeHR1cmU='): ArtOutputVersionPreview {
  const version = value.history!.versions[0]!
  return { schemaVersion: 'art-output-review-preview-v1', scope, versionId: version.versionId, jobRevision: 4, sourceRevision: version.sourceRevision, preview: { candidateId: version.candidateId, mimeType: 'image/png', base64, sha256: version.fileSha256, width: 1024, height: 1024 }, previewReceipt: { id: receiptId, versionId: version.versionId, fileSha256: version.fileSha256, jobRevision: 4, sourceRevision: version.sourceRevision } }
}
export function input(value = snapshot(), operationId = 'art-review-' + 'a'.repeat(32)): ArtOutputReviewInput {
  const image = preview(value), version = value.history!.versions[0]!
  return { needId: scope.needId, command: { operationId, versionId: version.versionId, fileSha256: version.fileSha256, expectedHistoryRevision: value.history!.revision, expectedReviewRevision: value.reviews!.revision, observedJobRevision: 4, decision: 'accepted', comment: '', approved: true }, displayAcknowledgement: { receiptId, versionId: version.versionId, fileSha256: version.fileSha256, jobRevision: 4, sourceRevision: image.sourceRevision, displayed: true } }
}
export function committedReview(request = input(), value = snapshot()): ArtOutputReviewOperation {
  const { receiptId: _receipt, ...display } = request.displayAcknowledgement
  const reviews = recordArtVisualReview(value.reviews!, value.history!, request.command, { scope, reviewerId: 'fixture-principal', reviewedAt: '2026-10-25T12:01:00Z', currentSourceRevision: 'a'.repeat(40), job: job(value.history!.versions[0]!.fileSha256), display })
  return { schemaVersion: 'art-output-review-operation-v1', scope, operationId: request.command.operationId, kind: 'review', state: 'committed', snapshot: { ...value, reviews } }
}
export function operation(state: ArtOutputReviewOperation['state'], operationId = input().command.operationId, value = snapshot()): ArtOutputReviewOperation { return { schemaVersion: 'art-output-review-operation-v1', scope, operationId, state, kind: operationId.startsWith('art-save-') ? 'register' : 'review', snapshot: value } }
export function provider(value = snapshot()) {
  return { endpoint: 'fixture-only:art-output-review', label: 'Synthetic fixture', waitForIdle: vi.fn(async () => {}), read: vi.fn<ArtOutputReviewProvider['read']>(async () => value), registerOutput: vi.fn<ArtOutputReviewProvider['registerOutput']>(async (_context, request) => ({ schemaVersion: 'art-output-review-operation-v1', scope, operationId: request.operationId, kind: 'register', state: 'committed', snapshot: snapshot(value.history?.versions[0]?.fileSha256) })), previewVersion: vi.fn<ArtOutputReviewProvider['previewVersion']>(async () => preview(value)), review: vi.fn<ArtOutputReviewProvider['review']>(async (_context, request) => committedReview(request, value)), lookup: vi.fn<ArtOutputReviewProvider['lookup']>(async (_context, request) => operation('not-observed', request.operationId, value)) }
}
export function storage(): ArtOutputPendingStorage & { values: Map<string, string> } { const values = new Map<string, string>(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: key => { values.delete(key) } } }
export function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } }) }
export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
export function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
export async function cryptoFixture(): Promise<Crypto> { const module = 'node:crypto'; const { webcrypto } = await import(module) as { webcrypto: Crypto }; return webcrypto }
// Same conservative in-memory PNG fixture technique as existing ai-jobs-read
// adapter tests. Called only by isolated tests; never writes an image file.
export async function pngFixture() {
  const module = 'node:zlib', { deflateSync } = await import(module) as { deflateSync: (value: Uint8Array) => Uint8Array }
  const crc = (bytes: Uint8Array) => { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = value >>> 1 ^ (value & 1 ? 0xedb88320 : 0) } return (value ^ 0xffffffff) >>> 0 }
  const chunk = (name: string, data: Uint8Array) => { const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer); view.setUint32(0, data.length); bytes.set([...name].map(char => char.charCodeAt(0)), 4); bytes.set(data, 8); view.setUint32(bytes.length - 4, crc(bytes.subarray(4, bytes.length - 4))); return bytes }
  const header = new Uint8Array(13), view = new DataView(header.buffer); view.setUint32(0, 1024); view.setUint32(4, 1024); header.set([8, 6, 0, 0, 0], 8)
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(new Uint8Array((1024 * 4 + 1) * 1024))), chunk('IEND', new Uint8Array())]
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length }
  const digest = await (await cryptoFixture()).subtle.digest('SHA-256', bytes)
  return { base64: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')), sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') }
}
