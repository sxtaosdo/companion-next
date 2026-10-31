import { appendArtOutputVersion, createArtOutputHistory, type ArtOutputHistory, type ArtOutputObservation, type ArtOutputScope, type ArtOutputVersion } from '../../src/domain/art-output-history'
import { createArtVisualReviewLedger, type ArtVisualReviewAuthority, type ArtVisualReviewCommand, type ArtVisualReviewLedger } from '../../src/domain/art-visual-review'

// Synthetic metadata only. No real image, generated asset, account or service is used.
export const scope: ArtOutputScope = { projectId: '1234567890abcdef', projectPath: 'D:/fixture-only', resourceDomainId: 'ant', needId: 'fixture-icon' }
export function observation(): ArtOutputObservation {
  return { scope: { ...scope }, binding: { snapshotSha256: '1'.repeat(64), normHash: '2'.repeat(64), specId: 'fixture-spec', specVersion: 1, needVersion: 1 }, candidateId: 'CANDIDATE-fixture-icon-1', job: {
    projectId: scope.projectId, jobId: 'STUDIO-RUN-fixture-a1b2c3d4', sourceRevision: 'a'.repeat(40), requestHash: '3'.repeat(64), state: 'awaiting_selection', createdAt: '2026-10-25T10:00:00.000Z', origin: 'generated',
    assets: [{ assetId: scope.needId }], candidates: [{ candidateId: 'CANDIDATE-fixture-icon-1', assetId: scope.needId, fileSha256: '4'.repeat(64), width: 1024, height: 1024, hasAlpha: true }],
  } }
}
export function firstHistory(): ArtOutputHistory { return appendArtOutputVersion(createArtOutputHistory(scope), 0, observation()) }
export function nextObservation(): ArtOutputObservation {
  const first = observation()
  return { ...first, binding: { ...first.binding, snapshotSha256: '5'.repeat(64), specVersion: 2, needVersion: 2 }, job: { ...first.job, jobId: 'STUDIO-RUN-fixture-next-b1c2d3e4', sourceRevision: 'b'.repeat(40), requestHash: '6'.repeat(64), createdAt: '2026-10-25T11:00:00.000Z', candidates: [{ ...first.job.candidates[0]!, fileSha256: '7'.repeat(64) }] } }
}
export function twoVersions(): ArtOutputHistory { return appendArtOutputVersion(firstHistory(), 1, nextObservation()) }
export function authority(version: ArtOutputVersion): ArtVisualReviewAuthority {
  return { scope: { ...version.scope }, reviewerId: 'fixture-authenticated-reviewer', reviewedAt: '2026-10-25T12:00:00.000Z', currentSourceRevision: version.sourceRevision,
    job: { projectId: version.scope.projectId, jobId: version.jobId, revision: 4, state: 'awaiting_selection', sourceRevision: version.sourceRevision, requestHash: version.requestHash,
      candidates: [{ candidateId: version.candidateId, assetId: version.scope.needId, fileSha256: version.fileSha256, width: version.width, height: version.height }] },
    display: { versionId: version.versionId, fileSha256: version.fileSha256, jobRevision: 4, sourceRevision: version.sourceRevision, displayed: true },
  }
}
export function command(history = firstHistory(), ledger: ArtVisualReviewLedger = createArtVisualReviewLedger(history.scope), version = history.versions[0]!): ArtVisualReviewCommand {
  return { operationId: 'art-review-' + 'a'.repeat(32), versionId: version.versionId, fileSha256: version.fileSha256, expectedHistoryRevision: history.revision, expectedReviewRevision: ledger.revision, observedJobRevision: 4, decision: 'accepted', comment: '', approved: true }
}
export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
