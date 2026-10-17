import evidence from './fixtures/ai-history-after-runtime-20261017.json'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAiJobsReadProvider, type AiJobsReadFetch } from '../src/adapters/ai-jobs-read'
import { decodeAiJobStatus } from '../src/domain/ai-jobs-read'
import { AI_JOB_ACTIONS, aiJobActionAllowed } from '../src/domain/ai-job-actions'
import { testCrypto } from './fixtures/generation-png'

// These are captured service responses after real scene/Preview/Build acceptance advanced HEAD.
// The injected transport never contacts that service or starts Python, Creator, or a model.
const projectId = 'a79f4915296f4091', jobId = 'STUDIO-RUN-icon-mvc3kj0s-b2d4ee94'
const status = evidence.files['history-status-response.json'].value
const preview = evidence.files['history-variant-response.json'].value
const proof = evidence.files['history-regression-receipt.json'].value
afterEach(() => vi.unstubAllGlobals())

describe('real historical96 task after independent runtime source checkpoints', () => {
  it('retains original import source and write barriers while accepting the current history HEAD', () => {
    const job = decodeAiJobStatus(status, projectId, jobId)
    expect(job.sourceRevision).toBe('796a233a424749ac0baecf5c7001a514ac8ef2d6')
    expect(job.historyOnly?.currentSourceRevision).toBe('c80b890bc8ee2485c15ed4d0522bdc4418a0c55f')
    expect(job.historyOnly?.currentSourceRevision).toBe(proof.currentFixtureHead)
    expect(job.revision).toBe(6); expect(job.import).toBeNull()
    for (const action of AI_JOB_ACTIONS) expect(aiJobActionAllowed(action, job)).toBe(false)
    expect(proof.tasksUnchangedByRead).toBe(true); expect(proof.importPostCount).toBe(0)
  })

  it('reads the recorded status and real colored96 PNG through existing bounded same-origin adapters', async () => {
    vi.stubGlobal('crypto', testCrypto)
    const transport = vi.fn<AiJobsReadFetch>(async (path) => {
      const value = path === `/api/icons/${projectId}/status` ? status
        : path === `/api/icons/${projectId}/variant-preview` ? preview : null
      if (value === null) throw new Error('No other endpoint is authorized by this regression')
      return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
    })
    const reader = createAiJobsReadProvider({ fetch: transport }), job = await reader.readStatus(projectId, jobId)
    if (!reader.previewVariant) throw new Error('Existing variant reader missing')
    const image = await reader.previewVariant(projectId, job)
    expect(image).toMatchObject({ width: 96, height: 96,
      operationId: 'icon-import-710dd9df6d2038390b667d9b76af5996',
      sha256: 'fe10e97c530d9cd03908e77dddaa9413a8284baab8c22bb461e7bb05b4638654',
      receiptSha256: '88be3fd8f4234bb151a929a562c2901242aa1f1d81477258fa942814768821ca' })
    expect(transport).toHaveBeenCalledTimes(2)
    expect(transport.mock.calls.map(([path]) => path)).toEqual([
      `/api/icons/${projectId}/status`, `/api/icons/${projectId}/variant-preview`,
    ])
    for (const [, init] of transport.mock.calls) expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store' })
    await reader.waitForIdle?.()
  })

  it('rejects restamping the recorded original source as the later runtime/evidence commit', () => {
    const relabeled = structuredClone(status)
    relabeled.job.sourceRevision = proof.currentFixtureHead
    expect(() => decodeAiJobStatus(relabeled, projectId, jobId)).toThrow()
  })
})
