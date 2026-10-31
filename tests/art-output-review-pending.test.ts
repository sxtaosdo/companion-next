// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ArtOutputReviewRecovery, artOutputPendingId } from '../src/stores/art-output-review-pending'
import { committedReview, input, operation, scope, storage } from './fixtures/art-output-review'

const intent = () => ({ kind: 'review' as const, input: input(), expectedFileSha256: '4'.repeat(64) })
describe('application-scoped review recovery metadata', () => {
  it('persists and reads back intent before dispatch and restores submitting as UNKNOWN', () => {
    const memory = storage(), recovery = new ArtOutputReviewRecovery('fixture', scope, memory), pending = recovery.begin(intent())
    expect(pending.state).toBe('submitting'); expect(pending.reviewAttempt?.state).toBe('submitting')
    const restored = new ArtOutputReviewRecovery('fixture', scope, memory).load()!
    expect(restored.state).toBe('unknown'); expect(restored.reviewAttempt?.state).toBe('unknown'); expect(artOutputPendingId(restored)).toBe(input().command.operationId)
    const raw = memory.values.get(recovery.key)!; expect(raw).not.toContain('base64'); expect(raw).not.toContain('cookie'); expect(raw).not.toContain('reviewerId')
  })
  it('blocks a new operation until exact terminal readback, without changing another scope', () => {
    const memory = storage(), recovery = new ArtOutputReviewRecovery('fixture', scope, memory); recovery.begin(intent())
    expect(() => recovery.begin({ ...intent(), input: { ...input(), command: { ...input().command, operationId: 'art-review-' + 'b'.repeat(32) } } })).toThrow()
    expect(new ArtOutputReviewRecovery('fixture', { ...scope, needId: 'other' }, memory).load()).toBeNull()
    expect(recovery.settle(operation('not-observed'))).toBe(false); expect(recovery.load()?.state).toBe('unknown')
    expect(recovery.settle(committedReview())).toBe(true); expect(recovery.load()).toBeNull()
  })
  it('retains a late committed receipt for explicit original-operation lookup, not automatic association', () => {
    const memory = storage(), recovery = new ArtOutputReviewRecovery('fixture-late', scope, memory); recovery.begin(intent()); recovery.retainLate(committedReview())
    expect(recovery.hasLateReceipt()).toBe(true); expect(recovery.load()?.state).toBe('unknown')
    expect(recovery.settle(committedReview())).toBe(true); expect(recovery.hasLateReceipt()).toBe(false)
    recovery.retainLate(committedReview()); expect(recovery.load()).toBeNull()
  })
  it('does not clear original intent for a different command or original SHA', () => {
    const recovery = new ArtOutputReviewRecovery('fixture-conflict', scope, storage()); recovery.begin(intent())
    const changed = { ...input(), command: { ...input().command, decision: 'rework' as const } }
    expect(() => recovery.settle(committedReview(changed))).toThrow(); expect(recovery.load()).not.toBeNull()
    expect(() => recovery.settle({ ...committedReview(), scope: { ...scope, resourceDomainId: 'cook' } })).toThrow(); expect(recovery.load()).not.toBeNull()
  })
  it('fails closed on unreadable, corrupt or silently discarded recovery metadata', () => {
    const memory = storage(), recovery = new ArtOutputReviewRecovery('fixture-broken', scope, memory)
    memory.values.set(recovery.key, '{invalid'); expect(() => recovery.begin(intent())).toThrow(); expect(memory.values.get(recovery.key)).toBe('{invalid')
    expect(() => new ArtOutputReviewRecovery('quota', scope, { getItem: () => null, setItem: () => { throw Error('quota') }, removeItem: () => {} }).begin(intent())).toThrow()
    expect(() => new ArtOutputReviewRecovery('discard', scope, { getItem: () => null, setItem: () => {}, removeItem: () => {} }).begin(intent())).toThrow()
  })
  it('keeps pending records when removal cannot be verified', () => {
    const memory = storage(), recovery = new ArtOutputReviewRecovery('fixture-remove', scope, { ...memory, removeItem: () => {} }); recovery.begin(intent())
    expect(() => recovery.settle(committedReview())).toThrow(); expect(recovery.load()).not.toBeNull()
  })
})
