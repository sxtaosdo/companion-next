// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { appendArtOutputVersion } from '../src/domain/art-output-history'
import { artVisualReviewState, beginArtVisualReviewAttempt, createArtVisualReviewLedger, decodeArtVisualReviewCommand, decodeArtVisualReviewLedger, recordArtVisualReview, settleArtVisualReviewAttempt } from '../src/domain/art-visual-review'
import { authority, clone, command, firstHistory, nextObservation, scope, twoVersions } from './fixtures/art-review-version-fixtures'

function context() {
  const history = firstHistory(), ledger = createArtVisualReviewLedger(scope), version = history.versions[0]!
  return { history, ledger, version, input: command(history, ledger), actor: authority(version) }
}
function reviewed() { const value = context(); return { ...value, result: recordArtVisualReview(value.ledger, value.history, value.input, value.actor) } }

describe('version-local visual decisions (no production acceptance)', () => {
  it('records authenticated reviewer, exact output and frozen input as a visual decision only', () => {
    const value = context(), before = clone(value)
    const result = recordArtVisualReview(value.ledger, value.history, value.input, value.actor)
    expect(result.revision).toBe(1)
    expect(result.events[0]).toMatchObject({ reviewerId: value.actor.reviewerId, reviewedAt: value.actor.reviewedAt, command: { decision: 'accepted' }, version: value.version })
    expect(artVisualReviewState(result, value.history, value.version.versionId)).toMatchObject({ kind: 'visual-only', state: 'accepted', reviewRevision: 1 })
    expect(result.events[0]).not.toHaveProperty('productionVerified')
    expect(result.events[0]).not.toHaveProperty('productAcceptance')
    expect(value).toEqual(before); expect(Object.isFrozen(result.events[0]!.version.binding)).toBe(true)
  })
  it('records return without inventing a mandatory reason, a retry or a job-state mutation', () => {
    const value = context(), input = { ...value.input, decision: 'rework' as const, comment: '' }
    const result = recordArtVisualReview(value.ledger, value.history, input, value.actor)
    expect(artVisualReviewState(result, value.history, value.version.versionId).state).toBe('rework')
    expect(result.events[0]!.command.comment).toBe('')
    expect(value.actor.job.state).toBe('awaiting_selection'); expect(value.ledger.events).toEqual([])
  })
  it('appends a later explicit decision without overwriting the earlier review', () => {
    const value = reviewed(), next = { ...command(value.history, value.result), operationId: 'art-review-' + 'b'.repeat(32), decision: 'rework' as const, comment: 'Adjust the silhouette.' }
    const result = recordArtVisualReview(value.result, value.history, next, { ...value.actor, reviewedAt: '2026-10-25T12:01:00Z' })
    expect(result.events.map(event => event.command.decision)).toEqual(['accepted', 'rework'])
    expect(result.events[0]).toEqual(value.result.events[0])
    expect(artVisualReviewState(result, value.history, value.version.versionId).state).toBe('rework')
  })
  it('leaves a newly generated version unreviewed while preserving an older accepted version', () => {
    const value = reviewed(), history = appendArtOutputVersion(value.history, 1, nextObservation())
    expect(artVisualReviewState(value.result, history, history.versions[1]!.versionId)).toMatchObject({ state: 'unreviewed', reviewRevision: null })
    expect(artVisualReviewState(value.result, history, history.versions[0]!.versionId).state).toBe('accepted')
    expect(history.revision).toBe(2)
  })
  it('makes an exact committed operation idempotent even after later job/history revisions', () => {
    const value = reviewed(), history = twoVersions()
    const lateActor = { ...value.actor, currentSourceRevision: 'b'.repeat(40), job: { ...value.actor.job, revision: 99, state: 'unknown' } }
    expect(recordArtVisualReview(value.result, history, value.input, lateActor)).toEqual(value.result)
  })
  it('rejects operation-ID reuse with a different decision or authenticated actor', () => {
    const value = reviewed()
    expect(() => recordArtVisualReview(value.result, value.history, { ...value.input, decision: 'rework' }, value.actor)).toThrow('ART_REVIEW_OPERATION_CONFLICT')
    expect(() => recordArtVisualReview(value.result, value.history, value.input, { ...value.actor, reviewerId: 'other-reviewer' })).toThrow('ART_REVIEW_OPERATION_CONFLICT')
  })
  it('checks output identity on committed-operation readback as well as on first write', () => {
    const value = reviewed(), altered = { ...value.history, versions: [{ ...value.version, fileSha256: 'f'.repeat(64) }] }
    expect(() => recordArtVisualReview(value.result, altered, value.input, value.actor)).toThrow('ART_REVIEW_OUTPUT_MISMATCH')
  })
  it.each(['unknown', 'import_unknown', 'running', 'queued', 'failed', 'blocked'])('does not record a new review while the job is %s', state => {
    const value = context()
    expect(() => recordArtVisualReview(value.ledger, value.history, value.input, { ...value.actor, job: { ...value.actor.job, state } })).toThrow('ART_REVIEW_SOURCE_UNCONFIRMED')
    expect(value.ledger.events).toEqual([])
  })
  it('keeps historical-source review blocked while history remains readable', () => {
    const value = context()
    expect(() => recordArtVisualReview(value.ledger, value.history, value.input, { ...value.actor, currentSourceRevision: 'b'.repeat(40) })).toThrow('ART_REVIEW_SOURCE_UNCONFIRMED')
    expect(() => recordArtVisualReview(value.ledger, value.history, value.input, { ...value.actor, job: { ...value.actor.job, historyOnly: { reason: 'SOURCE_REVISION_CHANGED' } } })).toThrow('ART_REVIEW_SOURCE_UNCONFIRMED')
  })
  it('rejects stale job, output-history and review revisions independently', () => {
    const value = context()
    expect(() => recordArtVisualReview(value.ledger, value.history, { ...value.input, observedJobRevision: 3 }, value.actor)).toThrow('ART_REVIEW_STALE')
    expect(() => recordArtVisualReview(value.ledger, twoVersions(), value.input, value.actor)).toThrow('ART_REVIEW_STALE')
    expect(() => recordArtVisualReview(value.ledger, value.history, { ...value.input, expectedReviewRevision: 1 }, value.actor)).toThrow('ART_REVIEW_STALE')
  })
  it.each(['projectId', 'projectPath', 'resourceDomainId', 'needId'] as const)('rejects a cross-%s authority', key => {
    const value = context(), changed = key === 'projectId' ? 'f'.repeat(16) : key === 'projectPath' ? 'D:/other' : key === 'resourceDomainId' ? 'cook' : 'other'
    expect(() => recordArtVisualReview(value.ledger, value.history, value.input, { ...value.actor, scope: { ...scope, [key]: changed } })).toThrow('ART_REVIEW_SCOPE_MISMATCH')
  })
  it('rejects a changed SHA or a candidate belonging to another asset', () => {
    const value = context()
    expect(() => recordArtVisualReview(value.ledger, value.history, { ...value.input, fileSha256: 'f'.repeat(64) }, value.actor)).toThrow('ART_REVIEW_OUTPUT_MISMATCH')
    const job = { ...value.actor.job, candidates: [{ ...value.actor.job.candidates[0]!, assetId: 'other' }] }
    expect(() => recordArtVisualReview(value.ledger, value.history, value.input, { ...value.actor, job })).toThrow('ART_REVIEW_OUTPUT_MISMATCH')
  })
  it('rejects a different request snapshot and duplicate candidate identities', () => {
    const value = context()
    expect(() => recordArtVisualReview(value.ledger, value.history, value.input, { ...value.actor, job: { ...value.actor.job, requestHash: 'f'.repeat(64) } })).toThrow('ART_REVIEW_OUTPUT_MISMATCH')
    expect(() => recordArtVisualReview(value.ledger, value.history, value.input, { ...value.actor, job: { ...value.actor.job, candidates: [...value.actor.job.candidates, ...value.actor.job.candidates] } })).toThrow('ART_REVIEW_OUTPUT_MISMATCH')
  })
  it('requires the same successfully displayed preview and observed job revision', () => {
    const value = context()
    for (const changed of [{ fileSha256: 'f'.repeat(64) }, { versionId: 'other' }, { jobRevision: 3 }, { sourceRevision: 'b'.repeat(40) }]) expect(() => recordArtVisualReview(value.ledger, value.history, value.input, { ...value.actor, display: { ...value.actor.display, ...changed } })).toThrow('ART_REVIEW_PREVIEW_UNCONFIRMED')
    const actor = clone(value.actor); Reflect.set(actor.display, 'displayed', false)
    expect(() => recordArtVisualReview(value.ledger, value.history, value.input, actor)).toThrow('ART_REVIEW_PREVIEW_UNCONFIRMED')
  })
  it('rejects missing consent, unsupported decisions and extra production-acceptance fields', () => {
    const value = context()
    expect(() => decodeArtVisualReviewCommand({ ...value.input, approved: false })).toThrow()
    expect(() => decodeArtVisualReviewCommand({ ...value.input, decision: 'production-pass' })).toThrow()
    expect(() => decodeArtVisualReviewCommand({ ...value.input, productionVerified: true })).toThrow()
  })
  it('decodes immutable review events and rejects retroactive version drift', () => {
    const value = reviewed(), next = { ...command(value.history, value.result), operationId: 'art-review-' + 'b'.repeat(32) }
    const two = recordArtVisualReview(value.result, value.history, next, value.actor), raw = clone(two)
    Reflect.set(raw.events[1]!.version, 'fileSha256', 'f'.repeat(64)); Reflect.set(raw.events[1]!.command, 'fileSha256', 'f'.repeat(64))
    expect(() => decodeArtVisualReviewLedger(raw)).toThrow('ART_REVIEW_OUTPUT_MISMATCH')
    const copied = decodeArtVisualReviewLedger(clone(two))
    expect(copied).toEqual(two); expect(Object.isFrozen(copied.events)).toBe(true)
  })
})

describe('review transport UNKNOWN retains the original operation', () => {
  it('blocks another submission after UNKNOWN, even when switching targets', () => {
    const value = context(), pending = beginArtVisualReviewAttempt(null, scope, value.input)
    const unknown = settleArtVisualReviewAttempt(pending, { state: 'unknown', operationId: value.input.operationId })
    expect(unknown).toMatchObject({ state: 'unknown', command: value.input, scope })
    expect(() => beginArtVisualReviewAttempt(unknown, { ...scope, resourceDomainId: 'cook' }, { ...value.input, operationId: 'art-review-' + 'b'.repeat(32) })).toThrow('ART_REVIEW_PENDING_BLOCKED')
    expect(() => beginArtVisualReviewAttempt(pending, scope, value.input)).toThrow('ART_REVIEW_PENDING_BLOCKED')
  })
  it('resolves UNKNOWN only from the exact committed operation readback', () => {
    const value = reviewed(), pending = beginArtVisualReviewAttempt(null, scope, value.input)
    const unknown = settleArtVisualReviewAttempt(pending, { state: 'unknown', operationId: value.input.operationId })
    const completed = settleArtVisualReviewAttempt(unknown, { state: 'completed', operationId: value.input.operationId, ledger: value.result })
    expect(completed.state).toBe('completed'); expect(completed.command).toEqual(value.input)
    expect(settleArtVisualReviewAttempt(completed, { state: 'unknown', operationId: value.input.operationId })).toEqual(completed)
  })
  it('does not accept an empty/mismatching ledger as successful completion', () => {
    const value = context(), pending = beginArtVisualReviewAttempt(null, scope, value.input)
    expect(() => settleArtVisualReviewAttempt(pending, { state: 'completed', operationId: value.input.operationId, ledger: value.ledger })).toThrow('ART_REVIEW_OPERATION_CONFLICT')
    const committed = recordArtVisualReview(value.ledger, value.history, { ...value.input, decision: 'rework' }, value.actor)
    expect(() => settleArtVisualReviewAttempt(pending, { state: 'completed', operationId: value.input.operationId, ledger: committed })).toThrow('ART_REVIEW_OPERATION_CONFLICT')
  })
  it('rejects late outcomes for another operation instead of releasing the original', () => {
    const value = context(), pending = beginArtVisualReviewAttempt(null, scope, value.input)
    for (const state of ['unknown', 'rejected'] as const) expect(() => settleArtVisualReviewAttempt(pending, { state, operationId: 'art-review-' + 'b'.repeat(32) })).toThrow('ART_REVIEW_OPERATION_CONFLICT')
    expect(pending.state).toBe('submitting')
  })
  it('allows a known rejection to release UNKNOWN without manufacturing a review event', () => {
    const value = context(), pending = beginArtVisualReviewAttempt(null, scope, value.input)
    const unknown = settleArtVisualReviewAttempt(pending, { state: 'unknown', operationId: value.input.operationId })
    const rejected = settleArtVisualReviewAttempt(unknown, { state: 'rejected', operationId: value.input.operationId })
    expect(rejected.state).toBe('rejected'); expect(value.ledger.events).toEqual([])
    expect(beginArtVisualReviewAttempt(rejected, scope, { ...value.input, operationId: 'art-review-' + 'b'.repeat(32) }).state).toBe('submitting')
    expect(settleArtVisualReviewAttempt(rejected, { state: 'unknown', operationId: value.input.operationId })).toEqual(rejected)
  })
  it('does not replace a known terminal outcome with its conflicting opposite', () => {
    const value = reviewed(), pending = beginArtVisualReviewAttempt(null, scope, value.input)
    const completed = settleArtVisualReviewAttempt(pending, { state: 'completed', operationId: value.input.operationId, ledger: value.result })
    expect(() => settleArtVisualReviewAttempt(completed, { state: 'rejected', operationId: value.input.operationId })).toThrow('ART_REVIEW_OPERATION_CONFLICT')
    const rejected = settleArtVisualReviewAttempt(pending, { state: 'rejected', operationId: value.input.operationId })
    expect(() => settleArtVisualReviewAttempt(rejected, { state: 'completed', operationId: value.input.operationId, ledger: value.result })).toThrow('ART_REVIEW_OPERATION_CONFLICT')
  })
})
