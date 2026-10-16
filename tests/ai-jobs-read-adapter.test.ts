import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testCrypto } from './fixtures/generation-png'
import { createAiJobsReadProvider } from '../src/adapters/ai-jobs-read'
import type { AiJobsReadFetch } from '../src/adapters/ai-jobs-read'
import { AI_JOBS_BACKEND_ERRORS, AI_JOBS_READ_LIMITS, AiJobsReadError, AI_JOB_STATES, decodeAiJobSnapshot, decodeAiJobsView, decodeAiJobStatus, verifyAiJobPreview } from '../src/domain/ai-jobs-read'
import type { AiJobSnapshot } from '../src/domain/ai-jobs-read'
const id = '0123456789abcdef', other = 'fedcba9876543210', jobId = 'STUDIO-RUN-icon-demo-0123abcd', candidateId = 'CANDIDATE-gem-1'
function job(): AiJobSnapshot { return { projectId: id, jobId, revision: 1, state: 'unknown', sourceRevision: 'a'.repeat(40), requestHash: 'b'.repeat(64), profile: 'local-icon-v1', budget: { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, createdAt: '2026-10-15T13:00:00Z', assets: [{ assetId: 'gem', relativePath: 'assets/icons/gem.png' }], candidates: [{ candidateId, assetId: 'gem', fileSha256: 'c'.repeat(64), width: 1024, height: 1024, hasAlpha: true }], selectedIds: [], import: null, workerResident: false, productionVerified: false } }
function jobs() { return { schemaVersion: 'companion-icons-v1', projectId: id, sourceRevision: 'a'.repeat(40), jobs: [job()], profile: { id: 'local-icon-v1', ...job().budget }, schedulerEnabled: false, workerResident: false } }
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
const fetcher = (value: unknown = jobs()) => vi.fn<AiJobsReadFetch>(async () => json(value))
function crc(bytes: Uint8Array) { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0) } return (value ^ 0xffffffff) >>> 0 }
function chunk(name: string, data: Uint8Array) { const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer); view.setUint32(0, data.length); bytes.set([...name].map(char => char.charCodeAt(0)), 4); bytes.set(data, 8); view.setUint32(bytes.length - 4, crc(bytes.subarray(4, bytes.length - 4))); return bytes }
async function png(extra?: string, width = 1024) {
  const name = 'node:zlib', { deflateSync } = await import(name) as { deflateSync: (value: Uint8Array) => Uint8Array }
  const header = new Uint8Array(13), view = new DataView(header.buffer); view.setUint32(0, width); view.setUint32(4, 1024); header.set([8, 6, 0, 0, 0], 8)
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), ...(extra ? [chunk(extra, new Uint8Array([97, 0, 98]))] : []), chunk('IDAT', deflateSync(new Uint8Array((width * 4 + 1) * 1024))), chunk('IEND', new Uint8Array())]
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length, 0)); let offset = 0; for (const part of parts) { bytes.set(part, offset); offset += part.length }
  const digest = await testCrypto.subtle.digest('SHA-256', bytes)
  return { bytes, base64: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')), sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') }
}
beforeEach(() => vi.stubGlobal('crypto', testCrypto))
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('verified original jobs/status/candidate contract', () => {
  it('is passive and offers only three reads with fixed same-origin paths and exact methods/bodies', async () => {
    const image = await png(), value = job(); value.candidates[0]!.fileSha256 = image.sha256
    const fetch = vi.fn<AiJobsReadFetch>(async path => json(path.endsWith('/jobs') ? jobs() : path.endsWith('/status') ? { schemaVersion: 'companion-icons-v1', job: value } : { schemaVersion: 'companion-icons-v1', candidateId, mimeType: 'image/png', base64: image.base64 }))
    const provider = createAiJobsReadProvider({ fetch }); expect(fetch).not.toHaveBeenCalled(); expect(Object.keys(provider).sort()).toEqual(['label', 'previewCandidate', 'readJobs', 'readStatus', 'waitForIdle'])
    await provider.readJobs(id); await provider.waitForIdle!(); await provider.readStatus(id, jobId); expect((await provider.previewCandidate(id, jobId, value.candidates[0]!)).sha256).toBe(image.sha256)
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([`/api/icons/${id}/jobs`, `/api/icons/${id}/status`, `/api/icons/${id}/candidate`])
    expect(fetch.mock.calls.map(([, init]) => [init.method, init.body])).toEqual([['GET', undefined], ['POST', JSON.stringify({ jobId })], ['POST', JSON.stringify({ jobId, candidateId })]])
    for (const [, init] of fetch.mock.calls) { expect(init).toMatchObject({ mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store' }); expect(new Headers(init.headers).get('authorization')).toBeNull(); expect(new Headers(init.headers).get('cookie')).toBeNull() }
  })
  it.each(['../x', `${id}?x`, other.toUpperCase(), '', 'https://example.com'])('refuses bad project before transport %s', async bad => { const fetch = fetcher(), p = createAiJobsReadProvider({ fetch }); await expect(p.readJobs(bad)).rejects.toMatchObject({ code: 'invalid-query' }); await expect(p.readStatus(bad, jobId)).rejects.toMatchObject({ code: 'invalid-query' }); await expect(p.previewCandidate(bad, jobId, job().candidates[0]!)).rejects.toMatchObject({ code: 'invalid-query' }); expect(fetch).not.toHaveBeenCalled() })
  it('refuses unbounded/URL job or candidate IDs before transport', async () => { const fetch = fetcher(), p = createAiJobsReadProvider({ fetch }); await expect(p.readStatus(id, 'https://outside')).rejects.toMatchObject({ code: 'invalid-query' }); await expect(p.previewCandidate(id, jobId, { ...job().candidates[0]!, candidateId: '../x' })).rejects.toMatchObject({ code: 'invalid-query' }); expect(fetch).not.toHaveBeenCalled() })
  it.each(AI_JOB_STATES)('preserves exact state %s without promoting completion', state => { expect(decodeAiJobSnapshot({ ...job(), state }, id).state).toBe(state) })
  it('preserves independent uncertain import effect and lease state', () => { const value = job(); value.state = 'import_unknown'; value.import = { operationId: `icon-import-${'a'.repeat(32)}`, state: 'STARTED', effectApplied: 'UNKNOWN', leaseState: 'RELEASED', errorCode: null, tools: [{ tool: 'asset_import', operationId: 'old-import', status: 'STARTED' }] }; expect(decodeAiJobSnapshot(value, id).import).toEqual(value.import) })
  it('drops unknown raw metadata rather than exposing credentials, URLs or unsupported acceptance claims', () => { const value = { ...job(), privateToken: 'secret', productAcceptance: { state: 'unavailable', reasonCode: 'ACCEPTANCE_EVIDENCE_UNCONFIRMED', quote: 'SECRET' }, resourceSnapshot: { state: 'unavailable', url: 'https://outside' } }; expect(decodeAiJobSnapshot(value, id)).toEqual({ ...job(), resourceSnapshot: { state: 'unavailable' }, productAcceptance: { state: 'unavailable', reasonCode: 'ACCEPTANCE_EVIDENCE_UNCONFIRMED' } }) })
  it('rejects dispatch acknowledgements, cross-project jobs, duplicate identities, broken relationships and excessive lists', () => {
    expect(() => decodeAiJobStatus({ schemaVersion: 'companion-icons-v1', dispatchAccepted: true, job: job() }, id, jobId)).toThrow(AiJobsReadError)
    for (const mutation of [() => ({ ...jobs(), projectId: other }), () => ({ ...jobs(), jobs: [{ ...job(), projectId: other }] }), () => ({ ...jobs(), jobs: [job(), job()] }), () => ({ ...jobs(), jobs: Array.from({ length: 101 }, job) }), () => ({ ...jobs(), schedulerEnabled: true }), () => ({ ...jobs(), sourceRevision: 'a'.repeat(64) })]) expect(() => decodeAiJobsView(mutation(), id)).toThrow(AiJobsReadError)
    for (const invalid of [{ revision: 0 }, { state: 'completed' }, { productionVerified: true }, { import: undefined }, { assets: [] }, { selectedIds: ['missing'] }, { candidates: [{ ...job().candidates[0], assetId: 'missing' }] }, { candidates: [job().candidates[0], job().candidates[0]] }, { requestHash: 'https://outside' }]) expect(() => decodeAiJobSnapshot({ ...job(), ...invalid }, id)).toThrow(AiJobsReadError)
  })
  it.each([401, 403, 404, 409, 429, 500, 503, 201, 202])('rejects HTTP %s without raw body or retry', async status => { const fetch = vi.fn<AiJobsReadFetch>(async () => json({ error: 'SECRET' }, { status })); await expect(createAiJobsReadProvider({ fetch }).readJobs(id)).rejects.toMatchObject({ status, code: status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'http-error' }); expect(fetch).toHaveBeenCalledTimes(1) })
  it('rejects oversized and non-JSON responses', async () => { const huge = vi.fn<AiJobsReadFetch>(async () => json(jobs(), { headers: { 'Content-Length': String(AI_JOBS_READ_LIMITS.maxJsonBytes + 1) } })); await expect(createAiJobsReadProvider({ fetch: huge }).readJobs(id)).rejects.toMatchObject({ code: 'response-too-large' }); const html = vi.fn<AiJobsReadFetch>(async () => new Response('<script>bad</script>', { headers: { 'Content-Type': 'text/html' } })); await expect(createAiJobsReadProvider({ fetch: html }).readJobs(id)).rejects.toMatchObject({ code: 'invalid-shape' }) })
  it('times out non-cooperative transport, caps unresolved requests and never retries automatically', async () => { vi.useFakeTimers(); const fetch = vi.fn<AiJobsReadFetch>(() => new Promise(() => undefined)), p = createAiJobsReadProvider({ fetch, timeoutMs: 10 }); const pending = [p.readJobs(id), p.readJobs(id), p.readJobs(id)].map(promise => promise.catch(error => error)); await vi.advanceTimersByTimeAsync(11); expect((await Promise.all(pending)).map(error => error.code)).toEqual(['timeout', 'timeout', 'timeout']); await expect(p.readJobs(id)).rejects.toMatchObject({ code: 'busy' }); expect(fetch).toHaveBeenCalledTimes(3) })
  it('explicit abort settles immediately even when injected transport ignores it', async () => { const controller = new AbortController(), fetch = vi.fn<AiJobsReadFetch>(() => new Promise(() => undefined)); const result = createAiJobsReadProvider({ fetch }).readJobs(id, controller.signal); controller.abort(); await expect(result).rejects.toMatchObject({ code: 'aborted' }) })
})
describe('candidate content verification', () => {
  it('allows bounded static PNG text metadata and pins the actual SHA', async () => { const image = await png('tEXt'), candidate = { ...job().candidates[0]!, fileSha256: image.sha256 }; expect((await verifyAiJobPreview({ candidateId, mimeType: 'image/png', base64: image.base64 }, candidate)).width).toBe(1024) })
  it('rejects foreign identity, SHA mismatch, wrong dimensions, animation and noncanonical base64', async () => {
    const image = await png(), candidate = { ...job().candidates[0]!, fileSha256: image.sha256 }, value = { candidateId, mimeType: 'image/png', base64: image.base64 }
    for (const raw of [{ ...value, candidateId: 'CANDIDATE-other-1' }, { ...value, mimeType: 'image/svg+xml' }, { ...value, base64: image.base64 + '\n' }, { ...value, base64: 'https://outside/image.png' }]) await expect(verifyAiJobPreview(raw, candidate)).rejects.toBeInstanceOf(AiJobsReadError)
    await expect(verifyAiJobPreview(value, job().candidates[0]!)).rejects.toBeInstanceOf(AiJobsReadError)
    for (const [extra, width] of [['acTL', 1024], ['iCCP', 1024], [undefined, 16]] as const) { const wrong = await png(extra, width); await expect(verifyAiJobPreview({ ...value, base64: wrong.base64 }, { ...candidate, fileSha256: wrong.sha256 })).rejects.toBeInstanceOf(AiJobsReadError) }
    const corrupt = image.bytes.slice(); corrupt[29] = corrupt[29]! ^ 1; await expect(verifyAiJobPreview({ ...value, base64: btoa(Array.from(corrupt, byte => String.fromCharCode(byte)).join('')) }, candidate)).rejects.toBeInstanceOf(AiJobsReadError)
  })
  it('does not display unverified bytes if digest support is unavailable', async () => { const image = await png(); vi.stubGlobal('crypto', undefined); await expect(verifyAiJobPreview({ candidateId, mimeType: 'image/png', base64: image.base64 }, { ...job().candidates[0]!, fileSha256: image.sha256 })).rejects.toMatchObject({ code: 'verification-unavailable' }) })
})

describe('read lifetime and closed backend error reasons', () => {
  it.each(Object.entries(AI_JOBS_BACKEND_ERRORS))('preserves only verified backend code %s', async (code, reason) => {
    const fetch = vi.fn<AiJobsReadFetch>(async () => json({ error: code, code, retryable: false, detail: 'private-path-and-secret' }, { status: reason.status }))
    const result = await createAiJobsReadProvider({ fetch }).readJobs(id).catch(error => error)
    expect(result).toMatchObject({ code: 'http-error', backendCode: code, message: reason.message }); expect(String(result)).not.toContain('private'); expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not trust arbitrary, mismatched, retryable or wrongly-statused backend error data', async () => {
    for (const error of [{ error: 'SECRET', code: 'SECRET', retryable: false }, { error: 'other', code: 'ICON_ADAPTER_DISABLED', retryable: false }, { error: 'ICON_ADAPTER_DISABLED', code: 'ICON_ADAPTER_DISABLED', retryable: true }, { error: 'PROJECT_NOT_FOUND', code: 'PROJECT_NOT_FOUND', retryable: false }]) {
      const fetch = vi.fn<AiJobsReadFetch>(async () => json(error, { status: 503 })), result = await createAiJobsReadProvider({ fetch }).readJobs(id).catch(error => error)
      expect(result.backendCode).toBeUndefined(); expect(String(result)).not.toContain('SECRET')
    }
  })
  it('keeps each concurrency slot until both non-cooperative body read and cancel actually settle', async () => {
    vi.useFakeTimers()
    const waits: Array<{ read: (value: ReadableStreamReadResult<Uint8Array>) => void; cancel: () => void }> = []
    const fetch = vi.fn<AiJobsReadFetch>(async () => {
      if (waits.length >= 3) return json(jobs())
      let finishRead!: (value: ReadableStreamReadResult<Uint8Array>) => void, finishCancel!: () => void
      const pendingRead = new Promise<ReadableStreamReadResult<Uint8Array>>(resolve => { finishRead = resolve }), pendingCancel = new Promise<void>(resolve => { finishCancel = resolve })
      waits.push({ read: finishRead, cancel: finishCancel })
      const response = json(jobs())
      Object.defineProperty(response, 'body', { value: { getReader: () => ({ read: () => pendingRead, cancel: () => pendingCancel, releaseLock: () => undefined }) } })
      return response
    })
    const p = createAiJobsReadProvider({ fetch, timeoutMs: 10 }), pending = [p.readJobs(id), p.readJobs(id), p.readJobs(id)].map(promise => promise.catch(error => error))
    await vi.advanceTimersByTimeAsync(11); expect((await Promise.all(pending)).every(error => error.code === 'timeout')).toBe(true)
    await expect(p.readJobs(id)).rejects.toMatchObject({ code: 'busy' }); expect(fetch).toHaveBeenCalledTimes(3)
    let idle = false; const drained = p.waitForIdle!().then(() => { idle = true })
    waits.forEach(wait => wait.read({ done: true, value: undefined })); await vi.advanceTimersByTimeAsync(0); expect(idle).toBe(false)
    await expect(p.readJobs(id)).rejects.toMatchObject({ code: 'busy' })
    waits.forEach(wait => wait.cancel()); await drained; expect(idle).toBe(true)
    expect((await p.readJobs(id)).jobs).toHaveLength(1)
  })
  it('retains late-fetch disposal budget until cancellation settles', async () => {
    vi.useFakeTimers()
    const waits: Array<{ resolve: (response: Response) => void; cancel: () => void }> = []
    const fetch = vi.fn<AiJobsReadFetch>(() => { let resolve!: (response: Response) => void, cancel!: () => void; const promise = new Promise<Response>(r => { resolve = r }); const cancellation = new Promise<void>(r => { cancel = r }); const response = json(jobs()); Object.defineProperty(response, 'body', { value: { cancel: () => cancellation } }); waits.push({ resolve: () => resolve(response), cancel }); return promise })
    const p = createAiJobsReadProvider({ fetch, timeoutMs: 10 }), pending = [p.readJobs(id), p.readJobs(id), p.readJobs(id)].map(promise => promise.catch(error => error))
    await vi.advanceTimersByTimeAsync(11); await Promise.all(pending); waits.forEach(wait => wait.resolve(json(jobs()))); await vi.advanceTimersByTimeAsync(0)
    await expect(p.readJobs(id)).rejects.toMatchObject({ code: 'busy' }); waits.forEach(wait => wait.cancel()); await vi.advanceTimersByTimeAsync(0)
    const controller = new AbortController(), next = p.readJobs(id, controller.signal).catch(error => error); await vi.advanceTimersByTimeAsync(0); expect(fetch).toHaveBeenCalledTimes(4); controller.abort(); expect((await next).code).toBe('aborted'); waits[3]!.resolve(json(jobs())); waits[3]!.cancel(); await vi.advanceTimersByTimeAsync(0)
  })
  it('retains verification budget while SHA digest is unresolved after timeout', async () => {
    const image = await png(), digest = await testCrypto.subtle.digest('SHA-256', image.bytes), waiters: Array<(value: ArrayBuffer) => void> = []
    vi.stubGlobal('crypto', { subtle: { digest: () => new Promise<ArrayBuffer>(resolve => waiters.push(resolve)) } }); vi.useFakeTimers()
    const fetch = fetcher({ schemaVersion: 'companion-icons-v1', candidateId, mimeType: 'image/png', base64: image.base64 }), p = createAiJobsReadProvider({ fetch, timeoutMs: 10 }), candidate = { ...job().candidates[0]!, fileSha256: image.sha256 }
    const pending = [p.previewCandidate(id, jobId, candidate), p.previewCandidate(id, jobId, candidate), p.previewCandidate(id, jobId, candidate)].map(promise => promise.catch(error => error))
    await vi.advanceTimersByTimeAsync(11); await Promise.all(pending); expect(waiters).toHaveLength(3); await expect(p.readJobs(id)).rejects.toMatchObject({ code: 'busy' }); waiters.forEach(resolve => resolve(digest)); await vi.advanceTimersByTimeAsync(0)
  })
})
