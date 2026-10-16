import { AI_TASK_CREATION_LIMITS, AiTaskCreationError, decodeAiTaskCreationResponse, decodeAiTaskInspection, validateAiTaskSubmission } from '../domain/ai-task-creation'
import type { AiTaskCreationCode, AiTaskCreationProvider, AiTaskCreationSubmission } from '../domain/ai-task-creation'
export type AiTaskCreationPath = `/api/icons/${string}/${'inspect' | 'enqueue' | 'adopt'}`
export type AiTaskCreationFetch = (input: AiTaskCreationPath, init: RequestInit) => Promise<Response>
type Track = <T>(pending: Promise<T>) => Promise<T>
const fail = (code: AiTaskCreationCode, sent = true, status?: number) => new AiTaskCreationError(code, sent ? 'unknown' : 'not-sent', status)
function abortable<T>(pending: Promise<T>, signal: AbortSignal, error: () => AiTaskCreationError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(error()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, cause => { signal.removeEventListener('abort', abort); reject(cause) })
    if (signal.aborted) abort()
  })
}
function discard(response: Response, track: Track) { try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ } }
async function json(response: Response, signal: AbortSignal, error: () => AiTaskCreationError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > AI_TASK_CREATION_LIMITS.maxResponseBytes) { discard(response, track); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0, chunks = 0, content = '', complete = false
  try {
    while (true) {
      const next = await abortable(track(reader.read()), signal, error)
      if (next.done) break
      size += next.value.byteLength
      if (size > AI_TASK_CREATION_LIMITS.maxResponseBytes || ++chunks > AI_TASK_CREATION_LIMITS.maxChunks) throw fail('response-too-large')
      content += decoder.decode(next.value, { stream: true })
    }
    content += decoder.decode(); complete = true
    try { return JSON.parse(content) as unknown } catch { throw fail('invalid-shape') }
  } catch (cause) { if (cause instanceof AiTaskCreationError) throw cause; throw fail('invalid-shape') }
  finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* An unresolved read retains the transport lease. */ } }
    try { reader.releaseLock() } catch { /* No early lease release. */ }
  }
}
/** Exact original endpoints, existing Cookie, no credentials discovery, retry, service start or ambient fetch. */
export function createAiTaskCreationProvider(options: { fetch: AiTaskCreationFetch; timeoutMs?: number }): AiTaskCreationProvider {
  if (typeof options?.fetch !== 'function') throw new TypeError('任务创建需要显式注入同源 fetch。')
  const transport = options.fetch, timeoutMs = options.timeoutMs ?? AI_TASK_CREATION_LIMITS.timeoutMs
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > AI_TASK_CREATION_LIMITS.timeoutMs) throw new RangeError('任务创建超时必须为 1 至 20000 毫秒。')
  let busy = false, idle = Promise.resolve()
  async function request<T>(projectId: string, value: AiTaskCreationSubmission, inspecting: boolean, decode: (raw: unknown, frozen: AiTaskCreationSubmission) => T | Promise<T>, signal?: AbortSignal): Promise<T> {
    if (busy) throw fail('busy', false)
    if (signal?.aborted) throw fail('aborted', false)
    const frozen = validateAiTaskSubmission(projectId, value), operation = inspecting ? 'inspect' : frozen.operation
    const body = JSON.stringify(inspecting ? { request: frozen.input.request, resourceBinding: frozen.input.resourceBinding } : frozen.input)
    if (new TextEncoder().encode(body).byteLength > AI_TASK_CREATION_LIMITS.maxRequestBytes) throw fail('invalid-input', false)
    busy = true
    let resolveIdle!: () => void
    idle = new Promise<void>(resolve => { resolveIdle = resolve })
    const controller = new AbortController()
    let invoked = false, processingDone = false, active = 0, released = false, timedOut = false
    const release = () => { if (!released && processingDone && active === 0) { released = true; busy = false; resolveIdle() } }
    const track: Track = pending => { active++; void pending.then(() => { active--; release() }, () => { active--; release() }); return pending }
    const cancel = () => controller.abort(), error = () => fail(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted', invoked)
    signal?.addEventListener('abort', cancel, { once: true })
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    try {
      const pending = track(Promise.resolve().then(() => {
        if (controller.signal.aborted) throw error()
        invoked = true
        return transport(`/api/icons/${projectId}/${operation}`, { method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body, signal: controller.signal })
      }).then(response => { if (controller.signal.aborted) discard(response, track); return response }))
      const response = await abortable(pending, controller.signal, error)
      if (controller.signal.aborted) { discard(response, track); throw error() }
      if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect') { discard(response, track); throw fail('invalid-shape') }
      if (response.status === 401 || response.status === 403) { discard(response, track); throw fail(response.status === 401 ? 'unauthorized' : 'forbidden', invoked, response.status) }
      if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discard(response, track); throw fail('invalid-shape') }
      const raw = await json(response, controller.signal, error, track)
      if (controller.signal.aborted) throw error()
      // Every failure after transport invocation is UNKNOWN. No server retry hint can authorize replay.
      if (!response.ok) throw fail('unconfirmed', invoked, response.status)
      if (response.status !== 200) throw fail('invalid-shape')
      const result = await abortable(track(Promise.resolve().then(() => decode(raw, frozen))), controller.signal, error)
      if (controller.signal.aborted) throw error()
      return result
    } catch (cause) {
      if (controller.signal.aborted) throw error()
      if (cause instanceof AiTaskCreationError) throw fail(cause.code, invoked, cause.status)
      throw fail('network-error', invoked)
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release() }
  }
  return Object.freeze({ label: 'Companion 原单图检查与排队（v150 同源合同）', waitForIdle: () => idle,
    inspect: (projectId, submission, signal) => request(projectId, submission, true, decodeAiTaskInspection, signal),
    execute: (projectId, submission, signal) => request(projectId, submission, false, decodeAiTaskCreationResponse, signal),
  } satisfies AiTaskCreationProvider)
}
