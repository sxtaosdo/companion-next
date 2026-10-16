import { describe, expect, it } from 'vitest'
import { decodeAiJobResourceSnapshot } from '../src/domain/ai-resource-snapshot'
import { decodeAiJobSnapshot, AiJobsReadError } from '../src/domain/ai-jobs-read'
import { resourceView } from './fixtures/ai-resource-read'
const id = '0123456789abcdef'
function sealed() { const view = resourceView(); return { state: 'sealed', version: 1, hash: view.hash, presetId: 'default', config: view.config, referenceSnapshots: [{ relativePath: 'art/reference/a.png', sha256: 'e'.repeat(64) }] } }
function job() { return { projectId: id, jobId: 'STUDIO-RUN-icon-test-0123abcd', revision: 1, state: 'selected', sourceRevision: 'a'.repeat(40), requestHash: 'b'.repeat(64), profile: 'local-icon-v1', budget: { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, createdAt: '', assets: [{ assetId: 'gem', relativePath: 'assets/icons/gem.png' }], candidates: [], selectedIds: [], import: null, workerResident: false, productionVerified: false } }
describe('original job sealed resource projection', () => {
  it('retains v2 sealed identity, sizes and reference evidence without private metadata', () => {
    const value = sealed(), output = decodeAiJobResourceSnapshot({ ...value, privatePath: 'SECRET', configBytes: 'SECRET' }, id)
    expect(output).toEqual(value); expect(JSON.stringify(output)).not.toContain('SECRET')
    expect(output).not.toBe(value); if (output.state === 'sealed') output.config.style.references.push('assets/new.png')
    expect(value.config!.style.references).toEqual(['art/reference/a.png'])
  })
  it('retains unavailable honestly and does not turn absent into unavailable or a default config', () => {
    expect(decodeAiJobResourceSnapshot({ state: 'unavailable', config: 'SECRET' }, id)).toEqual({ state: 'unavailable' })
    expect(decodeAiJobSnapshot(job(), id).resourceSnapshot).toBeUndefined()
  })
  it('projects a legacy v1 sealed preset without upgrading it to v2', () => {
    const value = sealed(), config = value.config!
    const legacy = { schemaVersion: 'project-resource-config-v1', version: 1, designResolution: config.designResolution, orientation: config.orientation,
      iconPresets: [{ id: 'small', label: 'small', displaySize: { width: 128, height: 128 }, outputPixels: { width: 1024, height: 1024 } }],
      style: config.style, composition: config.composition, background: { format: 'png', transparent: true }, destination: { directory: 'assets/icons', naming: 'kebab-case' } }
    expect(decodeAiJobResourceSnapshot({ ...value, presetId: 'small', config: legacy, referenceSnapshots: undefined }, id)).toMatchObject({ state: 'sealed', presetId: 'small', config: { schemaVersion: 'project-resource-config-v1' } })
  })
  it.each([
    (v: any) => { v.state = 'trusted' }, (v: any) => { v.version = 0 }, (v: any) => { v.version = 2 },
    (v: any) => { v.hash = 'A'.repeat(64) }, (v: any) => { v.hash = null }, (v: any) => { v.presetId = 'other' },
    (v: any) => { v.config.projectId = 'fedcba9876543210' }, (v: any) => { v.config.destination.exportDirectory = '../escape' },
    (v: any) => { delete v.referenceSnapshots }, (v: any) => { v.referenceSnapshots = [] },
    (v: any) => { v.referenceSnapshots[0].relativePath = 'assets/other.png' }, (v: any) => { v.referenceSnapshots[0].sha256 = 'bad' },
    (v: any) => { v.referenceSnapshots[0].relativePath = 'https://outside' }, (v: any) => { v.referenceSnapshots.push(v.referenceSnapshots[0]) },
  ])('rejects inconsistent seal %# without surfacing raw backend content', mutate => {
    const value = sealed(); mutate(value)
    expect(() => decodeAiJobResourceSnapshot(value, id)).toThrow()
    expect(() => decodeAiJobSnapshot({ ...job(), resourceSnapshot: value }, id)).toThrow(AiJobsReadError)
  })
  it('does not require reference evidence when v2 contains no references', () => {
    const value = sealed(); value.config!.style.references = []
    expect(decodeAiJobResourceSnapshot({ ...value, referenceSnapshots: undefined }, id)).toMatchObject({ state: 'sealed' })
  })
})
