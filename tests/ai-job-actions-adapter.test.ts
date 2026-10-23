import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAiJobActionsProvider } from '../src/adapters/ai-job-actions'
import type { AiJobActionsFetch } from '../src/adapters/ai-job-actions'
import { AI_JOB_ACTION_LIMITS, aiJobActionAllowed, decodeAiJobActionResponse, validateAiJobActionSubmission } from '../src/domain/ai-job-actions'
import type { AiJobAction, AiJobActionSubmission } from '../src/domain/ai-job-actions'
import type { AiJobSnapshot } from '../src/domain/ai-jobs-read'
const id = '0123456789abcdef', jobId = 'STUDIO-RUN-icon-demo-0123abcd', candidateId = 'CANDIDATE-gem-1'
function job(state: AiJobSnapshot['state'] = 'queued'): AiJobSnapshot { return { projectId: id, jobId, revision: 1, state, sourceRevision: 'a'.repeat(40), requestHash: 'b'.repeat(64), mode: 'generation', profile: 'local-icon-v1', budget: { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, createdAt: '2026-10-15T13:00:00Z', assets: [{ assetId: 'gem', relativePath: 'assets/icons/gem.png' }], candidates: [{ candidateId, assetId: 'gem', fileSha256: 'c'.repeat(64), width: 1024, height: 1024, hasAlpha: true }], selectedIds: ['selected','imported_pending_verification'].includes(state) ? [candidateId] : [], import: null, workerResident: false, productionVerified: false, resourceSnapshot: { state: 'sealed', version: 1, hash: 'd'.repeat(64), presetId: 'default', config: { schemaVersion: 'project-resource-config-v2', projectId: id, version: 1, designResolution: { width: 720, height: 1280 }, orientation: 'portrait', iconSize: { width: 256, height: 256 }, style: { description: 'Gem', references: [] }, background: { format: 'png', transparent: true, color: '#ffffff' }, composition: { centered: true, paddingPercent: 10 }, destination: { directory: 'assets/icons', exportDirectory: 'art/final/icons', naming: 'kebab-case' } } } } }
function submission(operation: AiJobAction = 'run-next'): AiJobActionSubmission {
  const snapshot = job(operation === 'resume' ? 'unknown' : operation === 'select' ? 'awaiting_selection' : ['import','export-variant'].includes(operation) ? 'selected' : 'queued'), base = { jobId, revision: 1 }
  const input = operation === 'run-next' ? { ...base, gpuUseApproved: true as const } : operation === 'resume' ? base : operation === 'select' ? { ...base, selectedIds: [candidateId], approved: true as const }
    : operation === 'import' ? { ...base, approved: true as const } : { ...base, candidateId, width: 256, height: 256, allowUpscale: false, expectedTargetSha256: null, approved: true as const }
  return { operation, snapshot, input, approved: true }
}
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
function response(input: AiJobActionSubmission): unknown {
  if (input.operation === 'select') return { schemaVersion: 'companion-icons-v1', job: { ...input.snapshot, revision: 2, state: 'selected', selectedIds: [candidateId] } }
  if (input.operation === 'export-variant') return { schemaVersion: 'companion-icons-v1', jobId, revision: 1, candidateId, relativePath: `art/final/icons/gem-256x256-${'c'.repeat(12)}.png`, sha256: 'e'.repeat(64), sourceSha256: 'c'.repeat(64), width: 256, height: 256, created: true, upscaled: false, qualityLimit: null }
  return { schemaVersion: 'companion-icons-v1', dispatchAccepted: true, workerResident: false, job: input.snapshot }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
afterEach(() => vi.useRealTimers())
describe('strict original action contract', () => {
  it.each(['run-next','resume','select','import','export-variant'] as const)('%s only uses approved original fixed POST with same-origin cookie', async operation => {
    const input = submission(operation), fetch = vi.fn<AiJobActionsFetch>(async () => json(response(input))), provider = createAiJobActionsProvider({ fetch })
    expect(fetch).not.toHaveBeenCalled()
    const result = await provider.execute(id, input)
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/icons/${id}/${operation}`, expect.objectContaining({ method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', body: JSON.stringify(input.input) }))
    expect(Object.keys(fetch.mock.calls[0]![1].headers!)).toEqual(['Accept','Content-Type'])
    expect(result.kind).toBe(operation === 'select' ? 'selection' : operation === 'export-variant' ? 'variant' : 'dispatch')
  })
  it('acceptance remains an execution-before snapshot and cannot become completed status', () => { const input = submission(); expect(decodeAiJobActionResponse(response(input), id, input)).toMatchObject({ kind: 'dispatch', dispatchAccepted: true, job: { state: 'queued', revision: 1, productionVerified: false } }) })
  it('enforces original state matrix and offline generation denial', () => {
    const states: AiJobSnapshot['state'][] = ['queued','waiting_service','running','unknown','failed','reusable','awaiting_selection','selected','import_unknown','imported_pending_verification','blocked']
    for (const state of states) {
      expect(aiJobActionAllowed('run-next', job(state))).toBe(['queued','waiting_service'].includes(state))
      expect(aiJobActionAllowed('resume', job(state))).toBe(['unknown','running'].includes(state))
      expect(aiJobActionAllowed('select', job(state))).toBe(['awaiting_selection','selected'].includes(state))
      expect(aiJobActionAllowed('import', job(state))).toBe(state === 'selected')
    }
    expect(aiJobActionAllowed('run-next', { ...job(), mode: 'offline_import_only' })).toBe(false)
  })
  it('rejects extra fields, absent explicit local approval, paths, tokens, arbitrary operations and stale request before fetch', async () => {
    const fetch = vi.fn<AiJobActionsFetch>(), provider = createAiJobActionsProvider({ fetch }), good = submission()
    for (const bad of [{ ...good, approved: false }, { ...good, operation: 'start-model' }, { ...good, token: 'secret' }, { ...good, input: { ...good.input, jobId: '../escape' } }, { ...good, input: { ...good.input, revision: 2 } }, { ...good, input: { ...good.input, gpuUseApproved: false } }, { ...good, input: { ...good.input, endpoint: 'https://other' } }]) await expect(provider.execute(id, bad as AiJobActionSubmission)).rejects.toMatchObject({ outcome: 'not-sent' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('allows only distinct current candidate IDs and selected sealed variants without overwrite', () => {
    const select = submission('select'), variant = submission('export-variant')
    for (const selectedIds of [[], [candidateId,candidateId], ['CANDIDATE-other-1'], [candidateId,'CANDIDATE-other-1','CANDIDATE-third-1']]) expect(() => validateAiJobActionSubmission(id, { ...select, input: { ...select.input, selectedIds } })).toThrow()
    for (const extra of [{ expectedTargetSha256: 'e'.repeat(64) }, { candidateId: 'CANDIDATE-other-1' }, { width: 0 }, { width: 4096, height: 4096 }, { width: 2048, height: 2048, allowUpscale: false }]) expect(() => validateAiJobActionSubmission(id, { ...variant, input: { ...variant.input, ...extra } })).toThrow()
    expect(() => validateAiJobActionSubmission(id, { ...variant, snapshot: { ...variant.snapshot, resourceSnapshot: { state: 'unavailable' } } })).toThrow()
  })
  it.each([{ dispatchAccepted: false }, { workerResident: true }, { schemaVersion: 'other' }, { job: { ...job(), revision: 2 } }, { job: { ...job(), projectId: 'fedcba9876543210' } }, { job: { ...job(), requestHash: 'f'.repeat(64) } }, { job: { ...job(), sourceRevision: 'f'.repeat(40) } }, { job: { ...job(), candidates: [] } }])('rejects mismatched accepted response %#', delta => {
    const input = submission(); expect(() => decodeAiJobActionResponse({ ...(response(input) as object), ...delta }, id, input)).toThrow()
  })
  it('pins variant identity, exact derived filename, source SHA, size and quality limitation', () => {
    const input = submission('export-variant'), good = response(input) as object
    for (const delta of [{ schemaVersion: 'companion-icon-variant-v1' }, { relativePath: 'assets/secret.png' }, { sourceSha256: 'f'.repeat(64) }, { width: 512 }, { upscaled: true }, { qualityLimit: 'any text' }, { candidateId: 'CANDIDATE-other-1' }]) expect(() => decodeAiJobActionResponse({ ...good, ...delta }, id, input)).toThrow()
  })
  it.each([[409,'STALE_JOB','conflict'],[409,'TASK_STATE_BLOCKED','conflict'],[429,'ICON_WORKER_BUSY','rejected'],[503,'ICON_ADAPTER_DISABLED','rejected'],[503,'ICON_OUTCOME_UNCONFIRMED','unknown'],[502,'ICON_SCHEMA_INVALID','unknown'],[409,'IMAGE_WRITE_UNCONFIRMED','unknown'],[409,'OVERWRITE_FORBIDDEN','unknown']] as const)('classifies %s %s conservatively', async (status, code, outcome) => {
    const fetch = vi.fn<AiJobActionsFetch>(async () => json({ error: code, code, retryable: false }, status))
    await expect(createAiJobActionsProvider({ fetch }).execute(id, submission())).rejects.toMatchObject({ outcome }); expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not project raw errors and does not retry', async () => { const fetch = vi.fn<AiJobActionsFetch>(async () => json({ error: 'SECRET', code: 'SECRET', retryable: false, path: '/secret' }, 409)); const result = await createAiJobActionsProvider({ fetch }).execute(id, submission()).catch(e => e); expect(result.outcome).toBe('unknown'); expect(String(result)).not.toContain('SECRET'); expect(fetch).toHaveBeenCalledTimes(1) })
})
describe('single-flight I/O lease and response budgets', () => {
  it('retains unresolved fetch and late-body cancellation lease after timeout', async () => {
    vi.useFakeTimers(); const headers = deferred<Response>(), cancellation = deferred<void>(), fetch = vi.fn<AiJobActionsFetch>(() => headers.promise), provider = createAiJobActionsProvider({ fetch, timeoutMs: 10 })
    const pending = provider.execute(id, submission()).catch(e => e); await vi.advanceTimersByTimeAsync(11); expect((await pending).outcome).toBe('unknown')
    let idle = false; void provider.waitForIdle().then(() => { idle = true })
    await expect(provider.execute(id, submission())).rejects.toMatchObject({ code: 'busy', outcome: 'not-sent' })
    const late = json({}); Object.defineProperty(late, 'body', { value: { cancel: () => cancellation.promise } }); headers.resolve(late); await vi.advanceTimersByTimeAsync(0)
    expect(idle).toBe(false); cancellation.resolve(); await provider.waitForIdle(); expect(idle).toBe(true); expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('retains both body-read and body-cancel promises when abort is ignored', async () => {
    vi.useFakeTimers(); const read = deferred<ReadableStreamReadResult<Uint8Array>>(), cancellation = deferred<void>(), response = json({})
    Object.defineProperty(response, 'body', { value: { getReader: () => ({ read: () => read.promise, cancel: () => cancellation.promise, releaseLock: () => undefined }) } })
    const provider = createAiJobActionsProvider({ fetch: async () => response, timeoutMs: 10 }), pending = provider.execute(id, submission()).catch(e => e)
    await vi.advanceTimersByTimeAsync(11); expect((await pending).code).toBe('timeout')
    read.resolve({ done: true, value: undefined }); await vi.advanceTimersByTimeAsync(0); await expect(provider.execute(id, submission())).rejects.toMatchObject({ code: 'busy' })
    cancellation.resolve(); await provider.waitForIdle()
  })
  it('pre-abort sends nothing; post-invocation cancellation never claims rejection', async () => {
    const fetch = vi.fn<AiJobActionsFetch>(() => new Promise(() => undefined)), provider = createAiJobActionsProvider({ fetch }), abort = new AbortController(); abort.abort()
    await expect(provider.execute(id, submission(), abort.signal)).rejects.toMatchObject({ outcome: 'not-sent' }); expect(fetch).not.toHaveBeenCalled()
    const second = new AbortController(), pending = provider.execute(id, submission(), second.signal).catch(e => e); await Promise.resolve(); second.abort(); expect((await pending).outcome).toBe('unknown')
  })
  it('freezes exact request bytes before caller mutation', async () => { const input = submission(), fetch = vi.fn<AiJobActionsFetch>(async () => json(response(submission()))), pending = createAiJobActionsProvider({ fetch }).execute(id, input); input.input.revision = 999; input.snapshot.requestHash = 'f'.repeat(64); await pending; expect(JSON.parse(String(fetch.mock.calls[0]![1].body)).revision).toBe(1) })
  it('enforces bounded content length and rejects redirect/opaque/non-JSON without following', async () => {
    const large = json({}); large.headers.set('content-length', String(AI_JOB_ACTION_LIMITS.maxResponseBytes + 1))
    const html = new Response('SECRET', { headers: { 'content-type': 'text/html' } }), redirect = json({}); Object.defineProperty(redirect, 'redirected', { value: true })
    for (const response of [large, html, redirect]) await expect(createAiJobActionsProvider({ fetch: async () => response }).execute(id, submission())).rejects.toMatchObject({ outcome: 'unknown' })
  })
})

describe('proven pre-persistence image rejection',()=>{
 it.each([['IMAGE_TRANSPARENCY_REQUIRED','image-transparency-required','真实透明像素'],['IMAGE_CONTENT_EMPTY','image-content-empty','没有可见内容']])('keeps %s definite and does not retry',async(backendCode,code,message)=>{const fetch=vi.fn<AiJobActionsFetch>(async()=>json({code:backendCode,error:backendCode,retryable:false},400)),p=createAiJobActionsProvider({fetch});await expect(p.execute(id,submission('export-variant'))).rejects.toMatchObject({code,outcome:'rejected',status:400,message:expect.stringContaining(message!)});expect(fetch).toHaveBeenCalledOnce();await p.waitForIdle()})
 it('does not misclassify the same text with the wrong HTTP status as safe rejection',async()=>{const fetch=vi.fn<AiJobActionsFetch>(async()=>json({code:'IMAGE_TRANSPARENCY_REQUIRED',error:'IMAGE_TRANSPARENCY_REQUIRED',retryable:false},503)),p=createAiJobActionsProvider({fetch});await expect(p.execute(id,submission('export-variant'))).rejects.toMatchObject({outcome:'unknown'});expect(fetch).toHaveBeenCalledOnce()})
})
