// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createArtOutputReviewProvider } from '../src/adapters/art-output-review'
import { context, committedReview, cryptoFixture, deferred, input, json, observation, operation, pngFixture, preview, scope, snapshot } from './fixtures/art-output-review'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
const registration = () => ({ needId: scope.needId, operationId: 'art-save-' + 'a'.repeat(32), expectedHistoryRevision: 0, jobId: observation().job.jobId, candidateId: observation().candidateId, observedJobRevision: 4 })
type Fetch = Parameters<typeof createArtOutputReviewProvider>[0]['fetch']
const mockFetch = (implementation: Fetch) => vi.fn<Fetch>(implementation)
describe('fixed same-origin output-review provider', () => {
  it('is passive, reads explicitly and serializes no project path or source identity', async () => {
    const fetch = mockFetch(async () => json(snapshot())), api = createArtOutputReviewProvider({ fetch })
    expect(fetch).not.toHaveBeenCalled(); await api.read(context, scope.needId)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/art-spec/' + scope.projectId + '/workbench/output-review?needId=fixture-icon', expect.objectContaining({ method: 'GET', mode: 'same-origin', credentials: 'same-origin', cache: 'no-store', redirect: 'error' }))
    expect(fetch.mock.calls[0]![1]).not.toHaveProperty('body')
  })
  it('serializes only the reviewed command and displayed receipt, then binds the committed journal', async () => {
    const request = input(), fetch = mockFetch(async () => json(committedReview(request))), api = createArtOutputReviewProvider({ fetch })
    const result = await api.review(context, request)
    expect(result.state).toBe('committed')
    const [path, init] = fetch.mock.calls[0]!
    expect(path.endsWith('/decisions')).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual(request)
    expect(init.body).not.toContain('reviewerId'); expect(init.body).not.toContain('projectPath'); expect(init.body).not.toContain('base64')
  })
  it('validates register and lookup operation namespaces before dispatch', async () => {
    const fetch = mockFetch(async () => json(snapshot())), api = createArtOutputReviewProvider({ fetch })
    await expect(api.registerOutput(context, { ...registration(), operationId: input().command.operationId })).rejects.toMatchObject({ outcome: 'not-sent' })
    await expect(api.lookup(context, { needId: scope.needId, operationId: 'other-operation' })).rejects.toMatchObject({ outcome: 'not-sent' })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('uses the declared resource domain and rejects a receipt for the original scope', async () => {
    const fetch = mockFetch(async () => json(snapshot())), api = createArtOutputReviewProvider({ fetch })
    await expect(api.read({ ...context, resourceDomainId: 'ant' }, scope.needId)).rejects.toMatchObject({ outcome: 'unknown' })
    expect(fetch.mock.calls[0]![0]).toContain('/domains/ant/workbench/output-review')
  })
  it('retains explicit unavailable/null metadata rather than inventing an empty success history', async () => {
    const value = snapshot(), raw = { ...value, history: null, reviews: null, snapshot: { workbenchHash: null, currentJobId: null, currentSourceRevision: null }, capabilities: { registerOutput: false, review: false, immutablePreview: false, historicalPreview: false } }
    const result = await createArtOutputReviewProvider({ fetch: async () => json(raw) }).read(context, scope.needId)
    expect(result.history).toBeNull(); expect(result.reviews).toBeNull(); expect(result.capabilities.review).toBe(false)
  })
  it.each([401, 403])('does not classify a bare HTTP %s write failure as known rejection', async status => {
    const fetch = mockFetch(async () => json({ code: 'AUTH_REQUIRED', error: 'untrusted diagnostics' }, status)), api = createArtOutputReviewProvider({ fetch })
    await expect(api.registerOutput(context, registration())).rejects.toMatchObject({ outcome: 'unknown' }); expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('recognizes only the explicit pre-dispatch rejected envelope without surfacing raw errors', async () => {
    const api = createArtOutputReviewProvider({ fetch: async () => json({ code: 'AUTH_REQUIRED', error: 'PRIVATE RAW TEXT', outcome: 'rejected' }, 401) })
    const result = await api.review(context, input()).catch(error => error)
    expect(result.outcome).toBe('rejected'); expect(String(result)).not.toContain('PRIVATE RAW TEXT')
  })
  it('keeps malformed or mismatched successful review receipts UNKNOWN', async () => {
    const request = input()
    for (const raw of [{ ...committedReview(request), operationId: 'art-review-' + 'b'.repeat(32) }, { ...committedReview(request), kind: 'register' }, { ...committedReview(request), snapshot: snapshot() }]) {
      await expect(createArtOutputReviewProvider({ fetch: async () => json(raw) }).review(context, request)).rejects.toMatchObject({ outcome: 'unknown' })
    }
  })
  it('does not turn not-observed or a namespace-only kind into completion', async () => {
    const id = input().command.operationId
    for (const kind of ['review', null]) {
      const api = createArtOutputReviewProvider({ fetch: async () => json({ ...operation('not-observed', id), kind }) })
      expect((await api.lookup(context, { needId: scope.needId, operationId: id })).state).toBe('not-observed')
    }
  })
  it('verifies complete PNG bytes/SHA before exposing preview and pins the receipt', async () => {
    vi.stubGlobal('crypto', await cryptoFixture()); const image = await pngFixture(), value = snapshot(image.sha256), data = preview(value, image.base64)
    const fetch = mockFetch(async () => json(data)), result = await createArtOutputReviewProvider({ fetch }).previewVersion(context, { needId: scope.needId, versionId: data.versionId, sha256: image.sha256, history: value.history! })
    expect(result.preview.sha256).toBe(image.sha256); expect(result.previewReceipt.fileSha256).toBe(image.sha256)
    expect(fetch.mock.calls[0]![0]).toContain('/versions/' + encodeURIComponent(data.versionId) + '/preview?needId=fixture-icon&sha256=' + image.sha256)
  })
  it('rejects fabricated PNG bytes, changed receipt hashes and another scope', async () => {
    vi.stubGlobal('crypto', await cryptoFixture()); const image = await pngFixture(), value = snapshot(image.sha256), data = preview(value, image.base64)
    for (const raw of [{ ...data, preview: { ...data.preview, base64: 'A'.repeat(image.base64.length) } }, { ...data, previewReceipt: { ...data.previewReceipt, fileSha256: 'f'.repeat(64) } }, { ...data, scope: { ...scope, projectPath: 'D:/other' } }]) {
      await expect(createArtOutputReviewProvider({ fetch: async () => json(raw) }).previewVersion(context, { needId: scope.needId, versionId: data.versionId, sha256: image.sha256, history: value.history! })).rejects.toMatchObject({ outcome: 'unknown' })
    }
  })
  it('keeps a noncooperative timed-out write leased until its transport actually drains', async () => {
    vi.useFakeTimers(); const late = deferred<Response>(), fetch = mockFetch(() => late.promise), api = createArtOutputReviewProvider({ fetch, timeoutMs: 10 })
    const result = api.registerOutput(context, registration()).catch(error => error)
    await vi.advanceTimersByTimeAsync(11)
    expect((await result).outcome).toBe('unknown')
    await expect(api.registerOutput(context, { ...registration(), operationId: 'art-save-' + 'b'.repeat(32) })).rejects.toMatchObject({ outcome: 'not-sent', code: 'busy' })
    expect(fetch).toHaveBeenCalledTimes(1)
    late.resolve(json(operation('rejected', registration().operationId))); await api.waitForIdle()
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not dispatch a pre-aborted operation and rejects over-budget responses', async () => {
    const signal = new AbortController(); signal.abort(); const fetch = mockFetch(async () => json(snapshot())), api = createArtOutputReviewProvider({ fetch })
    await expect(api.registerOutput(context, registration(), signal.signal)).rejects.toMatchObject({ outcome: 'not-sent' }); expect(fetch).not.toHaveBeenCalled()
    await expect(createArtOutputReviewProvider({ fetch: async () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(5 * 1024 * 1024) } }) }).read(context, scope.needId)).rejects.toMatchObject({ outcome: 'unknown' })
  })
})
