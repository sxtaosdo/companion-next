import { AI_JOBS_BACKEND_ERRORS, AI_JOBS_READ_LIMITS, AiJobsReadError, decodeAiJobCandidate, decodeAiJobsView, decodeAiJobStatus, decodeAiJobSnapshot, isAiJobId, isAiCandidateId, verifyAiJobPreview, verifyAiVariantPreview } from '../domain/ai-jobs-read'
import { isAiProjectId } from '../domain/ai-resource-read'
import type { AiJobsReadProvider, AiJobsReadEndpoint, AiJobsReadCode, AiJobsBackendCode } from '../domain/ai-jobs-read'
export type AiJobsReadPath = `/api/icons/${string}/jobs` | `/api/icons/${string}/status` | `/api/icons/${string}/candidate` | `/api/icons/${string}/variant-preview`
export type AiJobsReadFetch = (input: AiJobsReadPath, init: RequestInit) => Promise<Response>
function fail(code: AiJobsReadCode, endpoint: AiJobsReadEndpoint, status?: number) { return new AiJobsReadError(code, endpoint, status) }
type Track = <T>(promise: Promise<T>) => Promise<T>
function discard(response: Response): Promise<void> { try { return response.body?.cancel().catch(() => undefined) ?? Promise.resolve() } catch { return Promise.resolve() } }
function abortable<T>(pending: Promise<T>, signal: AbortSignal, error: () => AiJobsReadError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(error()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, endpoint: AiJobsReadEndpoint, signal: AbortSignal, abortError: () => AiJobsReadError, track: Track, maximum?: number) {
  const limit = maximum ?? (endpoint === 'candidate' || endpoint === 'variant-preview' ? AI_JOBS_READ_LIMITS.maxCandidateJsonBytes : AI_JOBS_READ_LIMITS.maxJsonBytes)
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > limit) { void track(discard(response)); throw fail('response-too-large', endpoint) }
  if (!response.body) throw fail('invalid-shape', endpoint)
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(track(reader.read()), signal, abortError)
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > limit || ++chunks > AI_JOBS_READ_LIMITS.maxChunks) throw fail('response-too-large', endpoint)
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape', endpoint) }
  } catch (error) { if (error instanceof AiJobsReadError) throw error; throw fail('invalid-shape', endpoint) }
  finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* No unbounded reader cleanup. */ } }
    try { reader.releaseLock() } catch { /* A non-cooperative injected reader can remain pending. */ }
  }
}
/** Only original jobs GET and status/candidate POST. No write operation, poller or arbitrary endpoint. */
export function createAiJobsReadProvider(options: { fetch: AiJobsReadFetch; timeoutMs?: number }): AiJobsReadProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('任务读取需要显式注入同源 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? AI_JOBS_READ_LIMITS.timeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > AI_JOBS_READ_LIMITS.timeoutMs) throw new RangeError('任务读取超时必须为 1 至 20000 毫秒。')
  const active = new Set<object>(), idleWaiters = new Set<() => void>()
  async function read<T>(projectId: string, endpoint: AiJobsReadEndpoint, body: object | undefined, decode: (value: unknown) => T | Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw fail('aborted', endpoint)
    if (active.size >= AI_JOBS_READ_LIMITS.maxConcurrent) throw fail('busy', endpoint)
    const identity = {}, controller = new AbortController()
    active.add(identity)
    let timedOut = false, settled = false, pendingWork = 0
    const release = () => { if (settled && pendingWork === 0) { active.delete(identity); if (!active.size) { for (const resolve of idleWaiters) resolve(); idleWaiters.clear() } } }
    const track: Track = <T>(promise: Promise<T>): Promise<T> => {
      pendingWork++
      return promise.then(value => { pendingWork--; release(); return value }, error => { pendingWork--; release(); throw error })
    }
    const cancel = () => controller.abort(), abortError = () => fail(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted', endpoint)
    signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    const pending = track(Promise.resolve().then(() => {
      if (controller.signal.aborted) throw abortError()
      return transport(`/api/icons/${projectId}/${endpoint}`, {
        method: endpoint === 'jobs' ? 'GET' : 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
        headers: endpoint === 'jobs' ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
      })
    }).then(async response => {
      // Keep the slot until late-body disposal also settles. Never release it at headers.
      if (controller.signal.aborted) await discard(response)
      return response
    }))
    try {
      const response = await abortable(pending, controller.signal, abortError)
      if (response.status !== 200) {
        let backendCode: AiJobsBackendCode | undefined
        if (!response.redirected && response.type !== 'opaque' && response.type !== 'opaqueredirect' && /^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) {
          try {
            const raw = await boundedJson(response, endpoint, controller.signal, abortError, track, 8192)
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
              const error = raw as Record<string, unknown>
              if (typeof error.code === 'string' && Object.hasOwn(AI_JOBS_BACKEND_ERRORS, error.code) && error.error === error.code && error.retryable === false
                && AI_JOBS_BACKEND_ERRORS[error.code as AiJobsBackendCode].status === response.status) backendCode = error.code as AiJobsBackendCode
            }
          } catch { if (controller.signal.aborted) throw abortError() }
        } else void track(discard(response))
        throw new AiJobsReadError(response.status === 401 ? 'unauthorized' : response.status === 403 ? 'forbidden' : 'http-error', endpoint, response.status, backendCode)
      }
      if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect' || !/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { void track(discard(response)); throw fail('invalid-shape', endpoint) }
      const raw = await boundedJson(response, endpoint, controller.signal, abortError, track)
      if (controller.signal.aborted) throw abortError()
      const result = await abortable(track(Promise.resolve().then(() => { if (controller.signal.aborted) throw abortError(); return decode(raw) })), controller.signal, abortError)
      if (controller.signal.aborted) throw abortError()
      return result
    } catch (error) {
      if (controller.signal.aborted) throw abortError()
      if (error instanceof AiJobsReadError) throw error
      throw fail('network-error', endpoint)
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); settled = true; release() }
  }
  return Object.freeze({
    label: 'Companion 原图标任务历史与候选读取（v150 同源合同）',
    waitForIdle: () => active.size ? new Promise<void>(resolve => idleWaiters.add(resolve)) : Promise.resolve(),
    async readJobs(projectId, signal) {
      if (!isAiProjectId(projectId)) throw fail('invalid-query', 'jobs')
      return read(projectId, 'jobs', undefined, value => decodeAiJobsView(value, projectId), signal)
    },
    async readStatus(projectId, jobId, signal) {
      if (!isAiProjectId(projectId) || !isAiJobId(jobId)) throw fail('invalid-query', 'status')
      return read(projectId, 'status', { jobId }, value => decodeAiJobStatus(value, projectId, jobId), signal)
    },
    async previewCandidate(projectId, jobId, candidate, signal) {
      let expected
      try { expected = decodeAiJobCandidate(candidate) } catch { throw fail('invalid-query', 'candidate') }
      if (!isAiProjectId(projectId) || !isAiJobId(jobId) || !isAiCandidateId(expected.candidateId)) throw fail('invalid-query', 'candidate')
      return read(projectId, 'candidate', { jobId, candidateId: expected.candidateId }, async value => {
        if (!value || typeof value !== 'object' || (value as Record<string, unknown>).schemaVersion !== 'companion-icons-v1') throw fail('invalid-shape', 'candidate')
        return verifyAiJobPreview(value, expected)
      }, signal)
    },
    async previewVariant(projectId, job, signal) {
      let checked
      try { checked = decodeAiJobSnapshot(job, projectId) } catch { throw fail('invalid-query', 'variant-preview') }
      if (!checked.variantImport?.artifact) throw fail('invalid-query', 'variant-preview')
      return read(projectId, 'variant-preview', { jobId: checked.jobId, operationId: checked.variantImport.operationId }, value => verifyAiVariantPreview(value, checked), signal)
    },
  } satisfies AiJobsReadProvider)
}
