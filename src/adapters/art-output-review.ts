import type { WorkbenchContext } from './art-workbench'
import { resourceDomainRoute } from '../domain/art-resource-domains'
import { verifyAiPngPreview, type AiPngPreview } from '../domain/ai-jobs-read'
import { artOutputVersionId, assertArtOutputPreview, decodeArtOutputHistory, decodeArtOutputScope, getArtOutputVersion, sameArtOutputScope, type ArtOutputHistory, type ArtOutputScope } from '../domain/art-output-history'
import { decodeArtVisualReviewCommand, decodeArtVisualReviewLedger, type ArtVisualReviewCommand, type ArtVisualReviewLedger } from '../domain/art-visual-review'

export class ArtOutputReviewError extends Error {
  constructor(readonly code: string, readonly outcome: 'not-sent' | 'rejected' | 'unknown' = 'unknown') { super('ART_OUTPUT_REVIEW_' + code.toUpperCase()); this.name = 'ArtOutputReviewError' }
}
export interface ArtOutputReviewSnapshot {
  readonly schemaVersion: 'art-output-review-snapshot-v1'; readonly scope: ArtOutputScope
  readonly history: ArtOutputHistory | null; readonly reviews: ArtVisualReviewLedger | null; readonly observedAt: string
  readonly capabilities: { readonly registerOutput: boolean; readonly review: boolean; readonly immutablePreview: boolean; readonly historicalPreview: boolean; readonly blockedReason?: string }
  readonly snapshot: { readonly workbenchHash: string | null; readonly currentJobId: string | null; readonly currentSourceRevision: string | null }
}
export interface ArtOutputRegisterInput { readonly needId: string; readonly operationId: string; readonly expectedHistoryRevision: number; readonly jobId: string; readonly candidateId: string; readonly observedJobRevision: number }
export interface ArtOutputDisplayAcknowledgement { readonly receiptId: string; readonly versionId: string; readonly fileSha256: string; readonly jobRevision: number; readonly sourceRevision: string; readonly displayed: true }
export interface ArtOutputReviewInput { readonly needId: string; readonly command: ArtVisualReviewCommand; readonly displayAcknowledgement: ArtOutputDisplayAcknowledgement }
export interface ArtOutputReviewOperation { readonly schemaVersion: 'art-output-review-operation-v1'; readonly scope: ArtOutputScope; readonly operationId: string; readonly state: 'committed' | 'rejected' | 'unknown' | 'not-observed'; readonly kind: 'register' | 'review' | null; readonly code?: string; readonly snapshot?: ArtOutputReviewSnapshot }
export interface ArtOutputVersionPreview { readonly schemaVersion: 'art-output-review-preview-v1'; readonly scope: ArtOutputScope; readonly versionId: string; readonly jobRevision: number; readonly sourceRevision: string; readonly preview: AiPngPreview; readonly previewReceipt: { readonly id: string; readonly versionId: string; readonly fileSha256: string; readonly jobRevision: number; readonly sourceRevision: string } }
export interface ArtOutputReviewProvider {
  readonly endpoint: string; readonly label: string; waitForIdle(): Promise<void>
  read(context: WorkbenchContext, needId: string, signal?: AbortSignal): Promise<ArtOutputReviewSnapshot>
  registerOutput(context: WorkbenchContext, input: ArtOutputRegisterInput, signal?: AbortSignal): Promise<ArtOutputReviewOperation>
  previewVersion(context: WorkbenchContext, input: { needId: string; versionId: string; sha256: string; history: ArtOutputHistory }, signal?: AbortSignal): Promise<ArtOutputVersionPreview>
  review(context: WorkbenchContext, input: ArtOutputReviewInput, signal?: AbortSignal): Promise<ArtOutputReviewOperation>
  lookup(context: WorkbenchContext, input: { needId: string; operationId: string }, signal?: AbortSignal): Promise<ArtOutputReviewOperation>
}
const invalid = (): never => { throw new ArtOutputReviewError('invalid-response') }
function object(value: unknown, required: readonly string[], optional: readonly string[] = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  const row = value as Record<string, unknown>, keys = Object.keys(row)
  if (required.some(key => !Object.hasOwn(row, key)) || keys.some(key => !required.includes(key) && !optional.includes(key))) return invalid()
  return row
}
const sha = /^[a-f0-9]{64}$/, revision = /^[a-f0-9]{40}$/, needPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/, jobPattern = /^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/, candidatePattern = /^CANDIDATE-[a-z0-9-]+-1$/
function string(value: unknown, max: number, pattern?: RegExp): string { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value) || pattern && !pattern.test(value)) return invalid(); return value }
function integer(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) return invalid(); return value as number }
function scope(context: WorkbenchContext, needId: string) { return decodeArtOutputScope({ projectId: context.projectId, projectPath: context.projectPath, resourceDomainId: context.resourceDomainId ?? null, needId: string(needId, 80, needPattern) }) }
function scopeMatches(value: unknown, expected: ArtOutputScope) { const actual = decodeArtOutputScope(value); if (!sameArtOutputScope(actual, expected)) return invalid(); return actual }
function kindOf(operationId: string): 'register' | 'review' { if (/^art-save-[a-f0-9]{32}$/.test(operationId)) return 'register'; if (/^art-review-[a-f0-9]{32}$/.test(operationId)) return 'review'; return invalid() }
export function decodeArtOutputRegisterInput(value: unknown): ArtOutputRegisterInput {
  const row = object(value, ['needId', 'operationId', 'expectedHistoryRevision', 'jobId', 'candidateId', 'observedJobRevision'])
  const operationId = string(row.operationId, 41, /^art-save-[a-f0-9]{32}$/)
  return Object.freeze({ needId: string(row.needId, 80, needPattern), operationId, expectedHistoryRevision: integer(row.expectedHistoryRevision), jobId: string(row.jobId, 100, jobPattern), candidateId: string(row.candidateId, 100, candidatePattern), observedJobRevision: integer(row.observedJobRevision) })
}
export function decodeArtOutputReviewInput(value: unknown): ArtOutputReviewInput {
  const row = object(value, ['needId', 'command', 'displayAcknowledgement']), command = decodeArtVisualReviewCommand(row.command)
  const claim = object(row.displayAcknowledgement, ['receiptId', 'versionId', 'fileSha256', 'jobRevision', 'sourceRevision', 'displayed'])
  if (claim.displayed !== true || claim.versionId !== command.versionId || claim.fileSha256 !== command.fileSha256 || claim.jobRevision !== command.observedJobRevision) return invalid()
  const displayAcknowledgement: ArtOutputDisplayAcknowledgement = Object.freeze({ receiptId: string(claim.receiptId, 36, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/), versionId: command.versionId, fileSha256: command.fileSha256, jobRevision: command.observedJobRevision, sourceRevision: string(claim.sourceRevision, 40, revision), displayed: true })
  return Object.freeze({ needId: string(row.needId, 80, needPattern), command, displayAcknowledgement })
}
export function decodeArtOutputReviewSnapshot(value: unknown, expected: ArtOutputScope): ArtOutputReviewSnapshot {
  const row = object(value, ['schemaVersion', 'scope', 'history', 'reviews', 'observedAt', 'capabilities', 'snapshot'])
  if (row.schemaVersion !== 'art-output-review-snapshot-v1') return invalid()
  const actual = scopeMatches(row.scope, expected), history = row.history === null ? null : decodeArtOutputHistory(row.history), reviews = row.reviews === null ? null : decodeArtVisualReviewLedger(row.reviews)
  if (history && !sameArtOutputScope(history.scope, actual) || reviews && !sameArtOutputScope(reviews.scope, actual)) return invalid()
  if (reviews?.events.length && !history) return invalid()
  for (const event of reviews?.events ?? []) if (JSON.stringify(getArtOutputVersion(history!, event.version.versionId)) !== JSON.stringify(event.version)) return invalid()
  const caps = object(row.capabilities, ['registerOutput', 'review', 'immutablePreview', 'historicalPreview'], ['blockedReason'])
  if (typeof caps.registerOutput !== 'boolean' || typeof caps.review !== 'boolean' || typeof caps.immutablePreview !== 'boolean' || typeof caps.historicalPreview !== 'boolean') return invalid()
  const current = object(row.snapshot, ['workbenchHash', 'currentJobId', 'currentSourceRevision'])
  const observedAt = string(row.observedAt, 60); if (!Number.isFinite(Date.parse(observedAt))) return invalid()
  return Object.freeze({ schemaVersion: 'art-output-review-snapshot-v1', scope: actual, history, reviews, observedAt,
    capabilities: Object.freeze({ registerOutput: caps.registerOutput, review: caps.review, immutablePreview: caps.immutablePreview, historicalPreview: caps.historicalPreview, ...(caps.blockedReason === undefined ? {} : { blockedReason: string(caps.blockedReason, 120, /^[A-Z][A-Z0-9_]+$/) }) }),
    snapshot: Object.freeze({ workbenchHash: current.workbenchHash === null ? null : string(current.workbenchHash, 64, sha), currentJobId: current.currentJobId === null ? null : string(current.currentJobId, 100, jobPattern), currentSourceRevision: current.currentSourceRevision === null ? null : string(current.currentSourceRevision, 40, revision) }) })
}
function decodeOperation(value: unknown, expected: ArtOutputScope, operationId: string): ArtOutputReviewOperation {
  const row = object(value, ['schemaVersion', 'scope', 'operationId', 'state', 'kind'], ['code', 'snapshot']), expectedKind = kindOf(operationId)
  if (row.schemaVersion !== 'art-output-review-operation-v1' || row.operationId !== operationId || !['committed', 'rejected', 'unknown', 'not-observed'].includes(row.state as string)) return invalid()
  if (row.kind !== expectedKind && !(row.state === 'not-observed' && row.kind === null)) return invalid()
  const actual = scopeMatches(row.scope, expected), snapshot = row.snapshot === undefined ? undefined : decodeArtOutputReviewSnapshot(row.snapshot, actual)
  if (row.state === 'committed' && (!snapshot?.history || !snapshot.reviews)) return invalid()
  if (row.state === 'committed' && expectedKind === 'review' && !snapshot!.reviews!.events.some(event => event.command.operationId === operationId)) return invalid()
  return Object.freeze({ schemaVersion: 'art-output-review-operation-v1', scope: actual, operationId, state: row.state as ArtOutputReviewOperation['state'], kind: row.kind as ArtOutputReviewOperation['kind'], ...(row.code === undefined ? {} : { code: string(row.code, 120, /^[A-Z][A-Z0-9_]+$/) }), ...(snapshot ? { snapshot } : {}) })
}
export type ArtOutputOperationIntent = { readonly kind: 'register'; readonly input: ArtOutputRegisterInput; readonly expectedFileSha256: string } | { readonly kind: 'review'; readonly input: ArtOutputReviewInput; readonly expectedFileSha256: string }
export function assertArtOutputOperationBinding(operation: ArtOutputReviewOperation, intent: ArtOutputOperationIntent): void {
  const id = intent.kind === 'register' ? intent.input.operationId : intent.input.command.operationId
  if (operation.operationId !== id || operation.kind !== intent.kind && operation.state !== 'not-observed') return invalid()
  if (operation.state !== 'committed') return
  if (!operation.snapshot?.history || !operation.snapshot.reviews) return invalid()
  const versionId = intent.kind === 'register' ? artOutputVersionId(intent.input.jobId, intent.input.candidateId) : intent.input.command.versionId
  const version = getArtOutputVersion(operation.snapshot.history, versionId)
  if (version.fileSha256 !== intent.expectedFileSha256) return invalid()
  if (intent.kind === 'review') {
    const event = operation.snapshot.reviews.events.find(event => event.command.operationId === id)
    if (!event || JSON.stringify(event.command) !== JSON.stringify(decodeArtVisualReviewCommand(intent.input.command)) || JSON.stringify(event.version) !== JSON.stringify(version)) return invalid()
  }
}
type Track = <T>(work: Promise<T>) => Promise<T>
function abortable<T>(work: Promise<T>, signal: AbortSignal, failure: () => ArtOutputReviewError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(failure()) }
    signal.addEventListener('abort', abort, { once: true })
    void work.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
function discard(response: Response, track: Track) { try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostic or credential exposure. */ } }
async function boundedJson(response: Response, limit: number, signal: AbortSignal, failure: () => ArtOutputReviewError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) { discard(response, track); throw new ArtOutputReviewError('response-too-large') }
  if (!response.body) return invalid()
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }); let body = '', bytes = 0, chunks = 0, complete = false
  try {
    while (true) { const next = await abortable(track(reader.read()), signal, failure); if (next.done) break; bytes += next.value.byteLength; if (bytes > limit || ++chunks > 4096) throw new ArtOutputReviewError('response-too-large'); body += decoder.decode(next.value, { stream: true }) }
    body += decoder.decode(); const result: unknown = JSON.parse(body); complete = true; return result
  } finally { if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* Lease retained until cancellation settles. */ } } try { reader.releaseLock() } catch { /* Pending noncooperative reader. */ } }
}
/** Explicit same-origin provider. No default fetch, token, discovery, retry or polling. */
export function createArtOutputReviewProvider(options: { fetch: (path: string, init: RequestInit) => Promise<Response>; timeoutMs?: number }): ArtOutputReviewProvider {
  if (typeof options.fetch !== 'function') throw new TypeError('Explicit fetch required')
  const timeout = options.timeoutMs ?? 20_000; if (!Number.isFinite(timeout) || timeout < 1 || timeout > 20_000) throw new RangeError('Invalid timeout')
  let leases = 0, writeLeased = false; const idle = new Set<() => void>()
  async function request<T>(context: WorkbenchContext, needId: string, suffix: string, decode: (raw: unknown, expected: ArtOutputScope) => T | Promise<T>, signal?: AbortSignal, input?: object, preview = false): Promise<T> {
    let expected: ArtOutputScope
    try { expected = scope(context, needId); if (!context.source || typeof context.source !== 'object') throw Error() } catch { throw new ArtOutputReviewError('invalid-input', 'not-sent') }
    if (signal?.aborted) throw new ArtOutputReviewError('aborted', 'not-sent')
    if (leases >= 3 || input && writeLeased) throw new ArtOutputReviewError('busy', 'not-sent')
    const body = input ? JSON.stringify(input) : undefined
    if (body && new TextEncoder().encode(body).byteLength > 32_768) throw new ArtOutputReviewError('invalid-input', 'not-sent')
    const path = resourceDomainRoute(expected.projectId, context.resourceDomainId) + '/workbench/output-review' + suffix
    leases++; if (input) writeLeased = true
    const controller = new AbortController(); let invoked = false, done = false, active = 0, released = false, timedOut = false
    const release = () => { if (!released && done && !active) { released = true; leases--; if (input) writeLeased = false; if (!leases) { for (const finish of idle) finish(); idle.clear() } } }
    const track: Track = work => { active++; void work.then(() => { active--; release() }, () => { active--; release() }); return work }
    const cancel = () => controller.abort(), failure = () => new ArtOutputReviewError(timedOut ? 'timeout' : 'aborted', invoked ? 'unknown' : 'not-sent')
    signal?.addEventListener('abort', cancel, { once: true }); const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeout)
    try {
      const work = track(Promise.resolve().then(() => { if (controller.signal.aborted) throw failure(); invoked = true; return options.fetch(path, { method: input ? 'POST' : 'GET', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', ...(input ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body } : {}), signal: controller.signal }) }).then(response => { if (controller.signal.aborted) discard(response, track); return response }))
      const response = await abortable(work, controller.signal, failure)
      if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect' || !/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discard(response, track); return invalid() }
      const raw = await boundedJson(response, preview ? 13 * 1024 * 1024 : 4 * 1024 * 1024, controller.signal, failure, track)
      if (!response.ok) {
        if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
          const error = raw as Record<string, unknown>
          if (Object.keys(error).length === 3 && typeof error.error === 'string' && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{1,119}$/.test(error.code) && error.outcome === 'rejected') throw new ArtOutputReviewError(error.code, 'rejected')
        }
        throw new ArtOutputReviewError('http-unconfirmed')
      }
      if (response.status !== 200) return invalid()
      const result = await abortable(track(Promise.resolve().then(() => decode(raw, expected))), controller.signal, failure)
      if (controller.signal.aborted) throw failure()
      return result
    } catch (error) {
      if (controller.signal.aborted) throw failure()
      if (error instanceof ArtOutputReviewError) throw error
      throw new ArtOutputReviewError('invalid-or-network', invoked ? 'unknown' : 'not-sent')
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); done = true; release() }
  }
  return Object.freeze({ endpoint: 'same-origin:art-output-review-v1', label: '真实版本与人工视觉审阅接口', waitForIdle: () => leases ? new Promise<void>(resolve => idle.add(resolve)) : Promise.resolve(),
    read: (context, needId, signal) => request(context, needId, '?needId=' + encodeURIComponent(needId), decodeArtOutputReviewSnapshot, signal),
    registerOutput: (context, input, signal) => { let clean: ArtOutputRegisterInput; try { clean = decodeArtOutputRegisterInput(input) } catch { return Promise.reject(new ArtOutputReviewError('invalid-input', 'not-sent')) } return request(context, clean.needId, '/register', (raw, expected) => { const operation = decodeOperation(raw, expected, clean.operationId); if (operation.state === 'committed') getArtOutputVersion(operation.snapshot!.history!, artOutputVersionId(clean.jobId, clean.candidateId)); return operation }, signal, clean) },
    review: (context, input, signal) => { let clean: ArtOutputReviewInput; try { clean = decodeArtOutputReviewInput(input) } catch { return Promise.reject(new ArtOutputReviewError('invalid-input', 'not-sent')) } return request(context, clean.needId, '/decisions', (raw, expected) => { const operation = decodeOperation(raw, expected, clean.command.operationId); assertArtOutputOperationBinding(operation, { kind: 'review', input: clean, expectedFileSha256: clean.command.fileSha256 }); return operation }, signal, clean) },
    lookup: (context, input, signal) => { try { kindOf(input.operationId); string(input.needId, 80, needPattern) } catch { return Promise.reject(new ArtOutputReviewError('invalid-input', 'not-sent')) } return request(context, input.needId, '/operations/' + encodeURIComponent(input.operationId) + '?needId=' + encodeURIComponent(input.needId), (raw, expected) => decodeOperation(raw, expected, input.operationId), signal) },
    previewVersion: (context, input, signal) => { let version: ReturnType<typeof getArtOutputVersion>; try { const expected = scope(context, input.needId); if (!sameArtOutputScope(input.history.scope, expected)) return Promise.reject(new ArtOutputReviewError('invalid-input', 'not-sent')); version = getArtOutputVersion(input.history, input.versionId); if (version.fileSha256 !== input.sha256) throw Error() } catch { return Promise.reject(new ArtOutputReviewError('invalid-input', 'not-sent')) }
      return request(context, input.needId, '/versions/' + encodeURIComponent(input.versionId) + '/preview?needId=' + encodeURIComponent(input.needId) + '&sha256=' + encodeURIComponent(input.sha256), async (raw, expected) => {
        const row = object(raw, ['schemaVersion', 'scope', 'versionId', 'jobRevision', 'sourceRevision', 'preview', 'previewReceipt'])
        if (row.schemaVersion !== 'art-output-review-preview-v1' || row.versionId !== version.versionId || row.sourceRevision !== version.sourceRevision) return invalid()
        const actual = scopeMatches(row.scope, expected), jobRevision = integer(row.jobRevision), data = object(row.preview, ['candidateId', 'mimeType', 'base64', 'sha256', 'width', 'height'])
        if (data.sha256 !== version.fileSha256) return invalid()
        const verified = await verifyAiPngPreview(data, { candidateId: version.candidateId, fileSha256: version.fileSha256, width: version.width, height: version.height })
        assertArtOutputPreview(version, verified)
        const receipt = object(row.previewReceipt, ['id', 'versionId', 'fileSha256', 'jobRevision', 'sourceRevision'])
        if (receipt.versionId !== version.versionId || receipt.fileSha256 !== version.fileSha256 || receipt.jobRevision !== jobRevision || receipt.sourceRevision !== version.sourceRevision) return invalid()
        return Object.freeze({ schemaVersion: 'art-output-review-preview-v1', scope: actual, versionId: version.versionId, jobRevision, sourceRevision: version.sourceRevision, preview: Object.freeze(verified), previewReceipt: Object.freeze({ id: string(receipt.id, 36, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/), versionId: version.versionId, fileSha256: version.fileSha256, jobRevision, sourceRevision: version.sourceRevision }) })
      }, signal, undefined, true)
    },
  } satisfies ArtOutputReviewProvider)
}
