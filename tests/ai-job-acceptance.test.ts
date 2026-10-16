import { describe, expect, it } from 'vitest'
import { decodeAiJobProductAcceptance } from '../src/domain/ai-job-acceptance'
import { decodeAiJobSnapshot, AiJobsReadError } from '../src/domain/ai-jobs-read'
const id = '0123456789abcdef', candidateId = 'CANDIDATE-gem-1'
function blocked() { return { state: 'blocked', reasonCode: 'UI_TRANSACTION_UNKNOWN', recordedAt: '2026-10-15T14:00:00Z', receiptSha256: 'd'.repeat(64), operationId: 'original.ui:123', scene: 'partial', compile: 'passed', preview: 'not_run', build: 'not_run', designResolution: { width: 750, height: 1334, verified: false } } }
function manual() { return { state: 'owner_manual_passed', recordedAt: '2026-10-15T14:00:00Z', receiptSha256: 'd'.repeat(64), operationId: 'original.ui:123', ownerReportedAt: '2026-10-15T14:01:00+00:00', sourceMessageId: `Sentinel_${'a'.repeat(32)}`, scope: 'import_and_runtime_visibility', automationState: 'unknown' } }
function job() { return { projectId: id, jobId: 'STUDIO-RUN-icon-test-0123abcd', revision: 2, state: 'imported_pending_verification', sourceRevision: 'a'.repeat(40), requestHash: 'b'.repeat(64), profile: 'local-icon-v1', budget: { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, createdAt: '', assets: [{ assetId: 'gem', relativePath: 'assets/icons/gem.png' }], candidates: [{ candidateId, assetId: 'gem', fileSha256: 'c'.repeat(64), width: 1024, height: 1024, hasAlpha: true }], selectedIds: [candidateId], import: { operationId: `icon-import-${'f'.repeat(32)}`, state: 'imported_pending_verification', effectApplied: true, leaseState: 'RELEASED', errorCode: null, tools: [] }, workerResident: false, productionVerified: false } }
describe('original acceptance receipt projection', () => {
  it('keeps blocked, unavailable and owner attestations distinct from productionVerified', () => {
    for (const value of [blocked(), manual(), { state: 'unavailable', reasonCode: 'ACCEPTANCE_EVIDENCE_UNCONFIRMED' }]) {
      expect(decodeAiJobProductAcceptance({ ...value, receiptPath: 'PRIVATE', quote: 'SECRET', url: 'https://outside' })).toEqual(value)
      const result = decodeAiJobSnapshot({ ...job(), productAcceptance: value }, id)
      expect(result.productAcceptance).toEqual(value); expect(result.productionVerified).toBe(false)
      expect(JSON.stringify(result)).not.toMatch(/PRIVATE|SECRET|https:/)
    }
  })
  it.each([
    { state: 'passed' }, { reasonCode: 'ALL_PASSED' }, { scene: 'passed' }, { preview: 'passed' }, { build: 'passed' },
    { designResolution: { width: 750, height: 1334, verified: true } }, { designResolution: { width: 720, height: 1280, verified: false } },
    { operationId: '<script>' }, { receiptSha256: 'https://outside' }, { recordedAt: '<img>' }, { recordedAt: 'tomorrow' },
  ])('rejects unsupported blocked evidence %#', patch => expect(() => decodeAiJobProductAcceptance({ ...blocked(), ...patch })).toThrow())
  it.each([{ scope: 'all-production' }, { automationState: 'passed' }, { sourceMessageId: 'https://outside' }, { ownerReportedAt: 'not-a-date' }])('never promotes manual acceptance %#', patch => expect(() => decodeAiJobProductAcceptance({ ...manual(), ...patch })).toThrow())
  it.each([{ state: 'selected' }, { import: null }, { selectedIds: [] }, { import: { ...job().import, effectApplied: 'UNKNOWN' } }, { import: { ...job().import, state: 'STARTED' } }])('requires original imported identity before projecting positive/manual receipt %#', patch => {
    expect(() => decodeAiJobSnapshot({ ...job(), ...patch, productAcceptance: manual() }, id)).toThrow(AiJobsReadError)
  })
  it('keeps absence distinct from unavailable evidence', () => {
    expect(decodeAiJobSnapshot(job(), id).productAcceptance).toBeUndefined()
    expect(decodeAiJobSnapshot({ ...job(), state: 'selected', import: null, productAcceptance: { state: 'unavailable', reasonCode: 'ACCEPTANCE_EVIDENCE_UNCONFIRMED' } }, id).productAcceptance?.state).toBe('unavailable')
  })
})
