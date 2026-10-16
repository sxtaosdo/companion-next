import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createAiTaskCreationProvider } from '../src/adapters/ai-task-creation'
import { AI_TASK_CREATION_LIMITS, buildAiTaskSubmission } from '../src/domain/ai-task-creation'
import { resourceView } from './fixtures/ai-resource-read'
import { testCrypto } from './fixtures/generation-png'
import type { AiJobsView } from '../src/domain/ai-jobs-read'
const id = '0123456789abcdef', runId = 'STUDIO-RUN-icon-test-0123abcd'
const jobs: AiJobsView = { schemaVersion: 'companion-icons-v1', projectId: id, sourceRevision: 'b'.repeat(40), jobs: [], profile: { id: 'local-icon-v1', maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, workerResident: false, schedulerEnabled: false }
const submission = () => buildAiTaskSubmission({ name: 'gem', assetId: 'gem', purpose: '奖励', prompt: '绿色宝石', sourceId: '' }, resourceView(), jobs, runId)
const inspection = () => ({ schemaVersion: 'companion-icons-v1', jobId: runId, sourceRevision: jobs.sourceRevision, profile: jobs.profile, gap: { requiredMissing: ['gem'], blockedExisting: [], existingTargets: [] } })
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
beforeEach(() => vi.stubGlobal('crypto', testCrypto))
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('same-origin creation transport and cleanup leases', () => {
  it('is inert until explicit invocation and inspect omits approved/sourceId/internal data', async () => { const fetch = vi.fn(async () => response(inspection())), p = createAiTaskCreationProvider({ fetch }); expect(fetch).not.toHaveBeenCalled(); await p.inspect(id, submission()); expect(fetch).toHaveBeenCalledTimes(1); const [path, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit]; expect(path).toBe(`/api/icons/${id}/inspect`); expect(init).toMatchObject({ method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store' }); expect(JSON.parse(init.body as string)).toEqual({ request: submission().input.request, resourceBinding: submission().input.resourceBinding }); expect(JSON.stringify(init)).not.toMatch(/Bearer|endpoint|executable|sourceSha256/) })
  it('serializes only strict enqueue/adopt body with approved true', async () => { const fetch = vi.fn(async () => response({ broken: true })), p = createAiTaskCreationProvider({ fetch }); await expect(p.execute(id, submission())).rejects.toMatchObject({ code: 'invalid-shape', outcome: 'unknown' }); expect(JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)).toEqual(submission().input) })
  it.each([400, 401, 403, 409, 429, 500, 502, 503])('retains UNKNOWN after dispatched HTTP %s, never retries', async status => { const fetch = vi.fn(async () => response({ error: 'INVALID_INPUT', code: 'INVALID_INPUT', retryable: false }, status)), p = createAiTaskCreationProvider({ fetch }); await expect(p.execute(id, submission())).rejects.toMatchObject({ outcome: 'unknown' }); expect(fetch).toHaveBeenCalledTimes(1); await p.waitForIdle() })
  it('rejects invalid body and pre-abort before calling transport', async () => { const fetch = vi.fn(), p = createAiTaskCreationProvider({ fetch }); const s = submission(); s.input.approved = false as true; await expect(p.execute(id, s)).rejects.toMatchObject({ outcome: 'not-sent' }); const controller = new AbortController(); controller.abort(); await expect(p.execute(id, submission(), controller.signal)).rejects.toMatchObject({ outcome: 'not-sent' }); expect(fetch).not.toHaveBeenCalled() })
  it('keeps busy and idle unresolved after a timed-out noncooperative fetch and late cancellation', async () => {
    vi.useFakeTimers(); const delayed = deferred<Response>(), cancelled = deferred<void>(), fetch = vi.fn(() => delayed.promise), p = createAiTaskCreationProvider({ fetch, timeoutMs: 10 })
    const pending = p.execute(id, submission()); const caught = expect(pending).rejects.toMatchObject({ code: 'timeout', outcome: 'unknown' }); await vi.advanceTimersByTimeAsync(11); await caught
    let idle = false; void p.waitForIdle().then(() => { idle = true }); await expect(p.inspect(id, submission())).rejects.toMatchObject({ code: 'busy', outcome: 'not-sent' }); expect(idle).toBe(false)
    delayed.resolve({ body: { cancel: () => cancelled.promise } } as unknown as Response); await Promise.resolve(); await Promise.resolve(); expect(idle).toBe(false); cancelled.resolve(); await p.waitForIdle(); expect(idle).toBe(true); expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('holds transport lease through hung read and cancel even after body timeout', async () => {
    vi.useFakeTimers(); const reading = deferred<ReadableStreamReadResult<Uint8Array>>(), cancelling = deferred<void>(), reader = { read: () => reading.promise, cancel: () => cancelling.promise, releaseLock: vi.fn() }
    const fetch = vi.fn(async () => ({ headers: new Headers({ 'Content-Type': 'application/json' }), body: { getReader: () => reader }, ok: true, status: 200, redirected: false, type: 'basic' } as unknown as Response)), p = createAiTaskCreationProvider({ fetch, timeoutMs: 10 })
    const caught = expect(p.inspect(id, submission())).rejects.toMatchObject({ code: 'timeout' }); await vi.advanceTimersByTimeAsync(11); await caught
    let idle = false; void p.waitForIdle().then(() => { idle = true }); cancelling.resolve(); await Promise.resolve(); expect(idle).toBe(false); reading.resolve({ done: true, value: undefined }); await p.waitForIdle(); expect(idle).toBe(true)
  })
  it.each(['oversize-header', 'oversize-body', 'chunks', 'invalid-json', 'wrong-mime', 'redirect'] as const)('rejects %s safely', async kind => {
    let reply = response(inspection())
    if (kind === 'oversize-header') reply = new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(AI_TASK_CREATION_LIMITS.maxResponseBytes + 1) } })
    if (kind === 'oversize-body') reply = new Response('x'.repeat(AI_TASK_CREATION_LIMITS.maxResponseBytes + 1), { headers: { 'Content-Type': 'application/json' } })
    if (kind === 'chunks') reply = new Response(new ReadableStream({ start(c) { for (let i = 0; i <= AI_TASK_CREATION_LIMITS.maxChunks; i++) c.enqueue(new Uint8Array()); c.close() } }), { headers: { 'Content-Type': 'application/json' } })
    if (kind === 'invalid-json') reply = new Response('{PRIVATE', { headers: { 'Content-Type': 'application/json' } })
    if (kind === 'wrong-mime') reply = new Response('{}', { headers: { 'Content-Type': 'text/html' } })
    if (kind === 'redirect') Object.defineProperty(reply, 'redirected', { value: true })
    const p = createAiTaskCreationProvider({ fetch: vi.fn(async () => reply) }); await expect(p.execute(id, submission())).rejects.toMatchObject({ outcome: 'unknown' }); await p.waitForIdle()
  })
})
