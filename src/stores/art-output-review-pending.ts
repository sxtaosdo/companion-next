import { assertArtOutputOperationBinding, decodeArtOutputRegisterInput, decodeArtOutputReviewInput, type ArtOutputOperationIntent, type ArtOutputReviewOperation } from '../adapters/art-output-review'
import { decodeArtOutputScope, sameArtOutputScope, type ArtOutputScope } from '../domain/art-output-history'
import { beginArtVisualReviewAttempt, settleArtVisualReviewAttempt, type ArtVisualReviewAttempt } from '../domain/art-visual-review'

export interface ArtOutputPendingStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export type ArtOutputPending = ArtOutputOperationIntent & { readonly scope: ArtOutputScope; readonly state: 'submitting' | 'unknown'; readonly reviewAttempt: ArtVisualReviewAttempt | null }
export class ArtOutputRecoveryError extends Error { constructor() { super('ART_OUTPUT_RECOVERY_BLOCKED'); this.name = 'ArtOutputRecoveryError' } }
export const artOutputPendingId = (value: ArtOutputPending) => value.kind === 'review' ? value.input.command.operationId : value.input.operationId
const lateReceipts = new WeakMap<ArtOutputPendingStorage, Map<string, ArtOutputReviewOperation>>()
/** Application recovery metadata only; never cookies, tokens, image bytes or an
 * authoritative review ledger. Reads exactly one known application key. */
export class ArtOutputReviewRecovery {
  readonly key: string
  readonly scope: ArtOutputScope
  private late() { let entries = lateReceipts.get(this.storage); if (!entries) { entries = new Map<string, ArtOutputReviewOperation>(); lateReceipts.set(this.storage, entries) } return entries }
  constructor(endpoint: string, scope: ArtOutputScope, private readonly storage: ArtOutputPendingStorage) {
    this.scope = decodeArtOutputScope(scope)
    this.key = 'companion-art-output-review-pending-v1:' + JSON.stringify([endpoint, this.scope.projectId, this.scope.projectPath, this.scope.resourceDomainId, this.scope.needId])
  }
  private decode(value: unknown, recovering: boolean): ArtOutputPending {
    try {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error()
      const row = value as Record<string, unknown>
      if (Object.keys(row).length !== 6 || row.schemaVersion !== 'art-output-review-pending-v1' || !['submitting', 'unknown'].includes(row.state as string) || !sameArtOutputScope(decodeArtOutputScope(row.scope), this.scope) || typeof row.expectedFileSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.expectedFileSha256)) throw Error()
      const state = recovering ? 'unknown' : row.state as 'submitting' | 'unknown'
      if (row.kind === 'register') {
        const input = decodeArtOutputRegisterInput(row.input); if (input.needId !== this.scope.needId) throw Error()
        return Object.freeze({ kind: 'register', input, expectedFileSha256: row.expectedFileSha256, scope: this.scope, state, reviewAttempt: null })
      }
      if (row.kind !== 'review') throw Error()
      const input = decodeArtOutputReviewInput(row.input); if (input.needId !== this.scope.needId || input.command.fileSha256 !== row.expectedFileSha256) throw Error()
      const initial = beginArtVisualReviewAttempt(null, this.scope, input.command)
      const reviewAttempt = state === 'unknown' ? settleArtVisualReviewAttempt(initial, { state: 'unknown', operationId: input.command.operationId }) : initial
      return Object.freeze({ kind: 'review', input, expectedFileSha256: row.expectedFileSha256, scope: this.scope, state, reviewAttempt })
    } catch { throw new ArtOutputRecoveryError() }
  }
  private serialize(value: ArtOutputPending): string { return JSON.stringify({ schemaVersion: 'art-output-review-pending-v1', scope: value.scope, kind: value.kind, input: value.input, expectedFileSha256: value.expectedFileSha256, state: value.state }) }
  load(): ArtOutputPending | null {
    try { const raw = this.storage.getItem(this.key); if (raw === null) return null; if (raw.length > 32_768) throw Error(); return this.decode(JSON.parse(raw), true) } catch { throw new ArtOutputRecoveryError() }
  }
  private persist(value: ArtOutputPending): void {
    try { const raw = this.serialize(value); if (raw.length > 32_768) throw Error(); this.storage.setItem(this.key, raw); if (this.storage.getItem(this.key) !== raw) throw Error() } catch { throw new ArtOutputRecoveryError() }
  }
  begin(intent: ArtOutputOperationIntent): ArtOutputPending {
    if (this.load()) throw new ArtOutputRecoveryError()
    const pending = this.decode({ schemaVersion: 'art-output-review-pending-v1', scope: this.scope, ...intent, state: 'submitting' }, false)
    this.persist(pending); this.late().delete(this.key) // Must succeed and read back before any transport is invoked.
    return pending
  }
  markUnknown(operationId: string): ArtOutputPending | null {
    const current = this.load()
    if (!current || artOutputPendingId(current) !== operationId) return current
    const result = Object.freeze({ ...current, state: 'unknown' as const })
    this.persist(result); return result
  }
  hasLateReceipt(): boolean { return this.late().has(this.key) }
  retainLate(operation: ArtOutputReviewOperation): void {
    const current = this.load()
    if (!current || operation.operationId !== artOutputPendingId(current)) return
    if (!sameArtOutputScope(operation.scope, this.scope)) throw new ArtOutputRecoveryError()
    assertArtOutputOperationBinding(operation, current)
    this.late().set(this.key, operation); this.markUnknown(operation.operationId)
  }
  settle(operation: ArtOutputReviewOperation): boolean {
    const current = this.load()
    if (!current || !sameArtOutputScope(operation.scope, this.scope)) throw new ArtOutputRecoveryError()
    assertArtOutputOperationBinding(operation, current)
    if (operation.state === 'unknown' || operation.state === 'not-observed') { this.markUnknown(operation.operationId); return false }
    if (current.reviewAttempt) settleArtVisualReviewAttempt(current.reviewAttempt, operation.state === 'committed'
      ? { state: 'completed', operationId: operation.operationId, ledger: operation.snapshot!.reviews! }
      : { state: 'rejected', operationId: operation.operationId })
    this.clear(operation.operationId); return true
  }
  /** Only a proven local not-sent or explicit pre-dispatch rejection may use this.
   * A failure of a lookup/read request must never clear the original operation. */
  knownUnsentOrRejected(operationId: string): void { this.clear(operationId) }
  private clear(operationId: string): void {
    const current = this.load(); if (!current || artOutputPendingId(current) !== operationId) throw new ArtOutputRecoveryError()
    try { this.storage.removeItem(this.key); if (this.storage.getItem(this.key) !== null) throw Error(); this.late().delete(this.key) } catch { throw new ArtOutputRecoveryError() }
  }
}
