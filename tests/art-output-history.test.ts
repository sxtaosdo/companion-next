// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { appendArtOutputVersion, assertArtOutputPreview, compareArtOutputVersions, createArtOutputHistory, decodeArtOutputHistory, getArtOutputVersion } from '../src/domain/art-output-history'
import { clone, firstHistory, nextObservation, observation, scope, twoVersions } from './fixtures/art-review-version-fixtures'

describe('immutable output registration (synthetic metadata)', () => {
  it('registers the matching asset and its frozen input without modifying caller values', () => {
    const input = observation(), before = clone(input), empty = createArtOutputHistory(scope)
    const result = appendArtOutputVersion(empty, 0, input)
    expect(input).toEqual(before); expect(empty.versions).toEqual([])
    expect(result.revision).toBe(1); expect(result.versions[0]!.binding).toEqual(input.binding)
    expect(result.versions[0]!.fileSha256).toBe(input.job.candidates[0]!.fileSha256)
    expect(Object.isFrozen(result.versions[0]!.binding)).toBe(true)
    expect(Reflect.set(result.versions[0]!.binding, 'specVersion', 99)).toBe(false)
  })
  it('appends without rewriting the old output, spec snapshot or registration order', () => {
    const first = firstHistory(), result = appendArtOutputVersion(first, 1, nextObservation())
    expect(first.revision).toBe(1); expect(result.versions[0]).toEqual(first.versions[0])
    expect(result.versions.map(version => version.ordinal)).toEqual([1, 2])
    expect(result.versions.map(version => version.binding.specVersion)).toEqual([1, 2])
  })
  it('treats exact duplicate observations as idempotent after later registrations', () => {
    const history = twoVersions()
    expect(appendArtOutputVersion(history, 0, observation())).toEqual(history)
  })
  it('does not turn later selection/job revision metadata into a new image version', () => {
    const input = observation(), history = firstHistory()
    const next = { ...input, job: { ...input.job, state: 'selected', revision: 100 } }
    expect(appendArtOutputVersion(history, 1, next)).toEqual(history)
  })
  it('keeps separate job versions even when their bytes happen to be identical', () => {
    const first = observation(), second = nextObservation()
    const result = appendArtOutputVersion(firstHistory(), 1, { ...second, job: { ...second.job, candidates: first.job.candidates } })
    expect(result.versions).toHaveLength(2)
    expect(compareArtOutputVersions(result, result.versions[0]!.versionId, result.versions[1]!.versionId, 'b'.repeat(40)).sameContent).toBe(true)
  })
  it('rejects conflicting bytes under the same immutable job/candidate identity', () => {
    const input = observation()
    expect(() => appendArtOutputVersion(firstHistory(), 1, { ...input, job: { ...input.job, candidates: [{ ...input.job.candidates[0]!, fileSha256: 'f'.repeat(64) }] } })).toThrow('ART_OUTPUT_VERSION_CONFLICT')
  })
  it('rejects retroactive frozen-input changes under an existing identity', () => {
    const input = observation()
    expect(() => appendArtOutputVersion(firstHistory(), 1, { ...input, binding: { ...input.binding, specVersion: 2 } })).toThrow('ART_OUTPUT_VERSION_CONFLICT')
  })
  it.each(['unknown', 'import_unknown', 'running', 'queued', 'failed', 'blocked', 'not-a-state'])('does not register an unconfirmed %s source', state => {
    const input = observation()
    expect(() => appendArtOutputVersion(createArtOutputHistory(scope), 0, { ...input, job: { ...input.job, state } })).toThrow('ART_OUTPUT_SOURCE_UNCONFIRMED')
  })
  it.each(['projectId', 'projectPath', 'resourceDomainId', 'needId'] as const)('rejects a different %s scope', key => {
    const input = observation(), value = key === 'projectId' ? 'f'.repeat(16) : key === 'projectPath' ? 'D:/other' : key === 'resourceDomainId' ? 'cook' : 'other-need'
    expect(() => appendArtOutputVersion(createArtOutputHistory(scope), 0, { ...input, scope: { ...scope, [key]: value } })).toThrow('ART_OUTPUT_SCOPE_MISMATCH')
  })
  it('rejects another asset in the same multi-asset job', () => {
    const input = observation()
    expect(() => appendArtOutputVersion(createArtOutputHistory(scope), 0, { ...input, job: { ...input.job, candidates: [{ ...input.job.candidates[0]!, assetId: 'other' }] } })).toThrow('ART_OUTPUT_SCOPE_MISMATCH')
  })
  it('rejects duplicate candidate identities instead of choosing the first', () => {
    const input = observation()
    expect(() => appendArtOutputVersion(createArtOutputHistory(scope), 0, { ...input, job: { ...input.job, candidates: [...input.job.candidates, ...input.job.candidates] } })).toThrow('ART_OUTPUT_SOURCE_UNCONFIRMED')
  })
  it('rejects stale or future CAS revisions without altering history', () => {
    const history = firstHistory(), before = clone(history)
    expect(() => appendArtOutputVersion(history, 0, nextObservation())).toThrow('ART_OUTPUT_HISTORY_STALE')
    expect(() => appendArtOutputVersion(history, 99, observation())).toThrow('ART_OUTPUT_HISTORY_STALE')
    expect(history).toEqual(before)
  })
  it('preserves unspecified/adopted provenance without labelling it generated', () => {
    const input = observation(), { origin: _origin, ...withoutOrigin } = input.job
    expect(appendArtOutputVersion(createArtOutputHistory(scope), 0, { ...input, job: withoutOrigin }).versions[0]!.origin).toBe('unspecified')
    expect(appendArtOutputVersion(createArtOutputHistory(scope), 0, { ...input, job: { ...input.job, origin: 'adopted' } }).versions[0]!.origin).toBe('adopted')
  })
  it('rejects invalid UTC dates instead of normalizing them into another day', () => {
    const input = observation()
    expect(() => appendArtOutputVersion(createArtOutputHistory(scope), 0, { ...input, job: { ...input.job, createdAt: '2026-02-30T10:00:00Z' } })).toThrow('ART_OUTPUT_SCHEMA_INVALID')
  })
  it('decodes a persisted history without sharing mutable input references', () => {
    const input = clone(firstHistory()), result = decodeArtOutputHistory(input)
    Reflect.set(input.versions[0]!.binding, 'specVersion', 99)
    expect(result.versions[0]!.binding.specVersion).toBe(1)
  })
  it('rejects a forged registration order, duplicate identity and extra acceptance flag', () => {
    const history = firstHistory(), version = history.versions[0]!
    expect(() => decodeArtOutputHistory({ ...history, versions: [{ ...version, ordinal: 2 }] })).toThrow()
    expect(() => decodeArtOutputHistory({ ...history, revision: 2, versions: [version, { ...version, ordinal: 2 }] })).toThrow()
    expect(() => decodeArtOutputHistory({ ...history, productionVerified: true })).toThrow()
  })
})

describe('read-only comparison and preview identity', () => {
  it('compares two explicit immutable versions and marks historical source data', () => {
    const history = twoVersions(), before = clone(history)
    const result = compareArtOutputVersions(history, history.versions[0]!.versionId, history.versions[1]!.versionId, 'b'.repeat(40))
    expect(result).toMatchObject({ mode: 'read-only', historyRevision: 2, sameContent: false, leftHistorical: true, rightHistorical: false, bindingChanged: true, sourceChanged: true, requestChanged: true })
    expect(history).toEqual(before); expect(Object.isFrozen(result.left)).toBe(true)
    expect(result).not.toHaveProperty('accepted'); expect(result).not.toHaveProperty('productionVerified')
  })
  it('never silently substitutes the latest output for a missing or identical choice', () => {
    const history = twoVersions(), id = history.versions[0]!.versionId
    expect(() => getArtOutputVersion(history, 'missing')).toThrow('ART_OUTPUT_VERSION_MISSING')
    expect(() => compareArtOutputVersions(history, id, id, 'a'.repeat(40))).toThrow('ART_OUTPUT_COMPARISON_SAME_VERSION')
    expect(() => compareArtOutputVersions(history, id, 'missing', 'a'.repeat(40))).toThrow('ART_OUTPUT_VERSION_MISSING')
  })
  it('binds the verified adapter metadata to exactly the displayed version', () => {
    const version = firstHistory().versions[0]!, preview = { candidateId: version.candidateId, sha256: version.fileSha256, width: 1024, height: 1024, mimeType: 'image/png' }
    expect(() => assertArtOutputPreview(version, preview)).not.toThrow()
    for (const changed of [{ sha256: 'f'.repeat(64) }, { candidateId: 'CANDIDATE-other-1' }, { width: 128 }, { mimeType: 'image/jpeg' }]) expect(() => assertArtOutputPreview(version, { ...preview, ...changed })).toThrow('ART_OUTPUT_PREVIEW_MISMATCH')
  })
})
