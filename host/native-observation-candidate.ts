/** Offline host candidate only. No daemon import, listener, reset, cancellation or persistence adapter. */
export interface NativeIdentity {
  daemonEpoch: string
  requestId: string
  operationId: string
  projectId: string
  sessionId: string
  method: string
  inputSha256: string
}
export interface LegacyNativeUnknown {
  daemonEpoch: string
  count: number
  observedAt: string
  evidenceRef: string
  evidenceSha256: string
}
/** Produced by a trusted host adapter, never by an HTTP caller or a UI checkbox.
 * The adapter must establish native execution completion, not merely transport completion/acceptance.
 */
export interface VerifiedNativeTerminal {
  kind: 'native-execution-terminal-v1'
  identity: NativeIdentity
  receiptId: string
  verifierId: string
  source: 'native-response' | 'native-journal'
  terminalState: 'SUCCEEDED' | 'FAILED'
  responseObservedAt: string
  responseSha256: string
  responseBytes: Uint8Array
}
export type NativeTerminalVerifier = (untrusted: unknown) => Promise<VerifiedNativeTerminal | null>
export interface NativeClock { wallNow(): string; monotonicNow(): number }
export type NativeLocalFailure = 'connection-failed' | 'send-failed' | 'timeout' | 'disconnected' | 'aborted' | 'invalid-response'
type State = 'awaiting-send' | 'awaiting-terminal' | 'unknown' | 'terminal'
interface TerminalSummary {
  receiptId: string; verifierId: string; source: VerifiedNativeTerminal['source']
  terminalState: VerifiedNativeTerminal['terminalState']; responseSha256: string
  responseObservedAt: string; verifiedAt: string
}
interface Observation {
  identity: NativeIdentity; createdAt: string; state: State
  sendAttemptedAt?: string; localSettledAt?: string; localFailure?: NativeLocalFailure
  reason?: string; terminal?: TerminalSummary; conflicts: TerminalSummary[]; conflictingTerminal: boolean
  elapsedMs: number
}
interface InternalObservation extends Observation { startedMono: number }
interface AuditEvent { sequence: number; at: string; daemonEpoch: string; requestId: string; action: string; reason?: string }
const identityFields = ['daemonEpoch', 'requestId', 'operationId', 'projectId', 'sessionId', 'method', 'inputSha256'] as const
const hash = /^[a-f0-9]{64}$/
const failures: readonly string[] = ['connection-failed', 'send-failed', 'timeout', 'disconnected', 'aborted', 'invalid-response']
// Deliberately small candidate allowlist. Unknown protocol errors remain unresolved.
const terminalErrors = new Set(['INVALID_REQUEST', 'NOT_FOUND', 'UNSUPPORTED', 'READ_ONLY', 'VERSION_MISMATCH'])
function text(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f]/.test(value) }
function timestamp(value: unknown): value is string { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value }
function identity(value: NativeIdentity): NativeIdentity {
  if (!value || !identityFields.every(k => text(value[k])) || !hash.test(value.inputSha256)) throw new Error('INVALID_NATIVE_IDENTITY')
  return Object.fromEntries(identityFields.map(k => [k, value[k]])) as unknown as NativeIdentity
}
function sameIdentity(a: NativeIdentity, b: NativeIdentity): boolean { return identityFields.every(k => a[k] === b[k]) }
function key(epoch: string, requestId: string): string { if (!text(epoch) || !text(requestId)) throw new Error('INVALID_NATIVE_KEY'); return JSON.stringify([epoch, requestId]) }
function wireResponse(value: unknown): value is { id: string; ok: boolean; result?: unknown; error?: { code: string; message: string } } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const r = value as Record<string, unknown>
  if (!text(r.id) || typeof r.ok !== 'boolean') return false
  const allowed = r.ok ? ['id', 'ok', 'result'] : ['id', 'ok', 'error']
  if (Object.keys(r).length !== 3 || !allowed.every(k => Object.hasOwn(r, k))) return false
  if (r.ok) return true
  if (!r.error || typeof r.error !== 'object' || Array.isArray(r.error)) return false
  const e = r.error as Record<string, unknown>
  return typeof e.code === 'string' && typeof e.message === 'string' && Object.keys(e).every(k => ['code', 'message', 'details'].includes(k))
}
async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes)
  return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', copy)), b => b.toString(16).padStart(2, '0')).join('')
}

export class NativeObservationCandidate {
  private readonly observations = new Map<string, InternalObservation>()
  private readonly audit: AuditEvent[] = []
  private readonly receiptOwners = new Map<string, string>()
  private readonly legacy: LegacyNativeUnknown[]
  constructor(private readonly options: { legacyUnknown: readonly LegacyNativeUnknown[]; verifyTerminal: NativeTerminalVerifier; clock: NativeClock }) {
    if (!Array.isArray(options.legacyUnknown) || typeof options.verifyTerminal !== 'function') throw new Error('EXPLICIT_NATIVE_BASELINE_REQUIRED')
    const epochs = new Set<string>()
    let legacyTotal = 0
    this.legacy = options.legacyUnknown.map(item => {
      if (!item || !text(item.daemonEpoch) || epochs.has(item.daemonEpoch) || !Number.isSafeInteger(item.count) || item.count <= 0
        || !timestamp(item.observedAt) || !text(item.evidenceRef) || !hash.test(item.evidenceSha256)) throw new Error('INVALID_LEGACY_NATIVE_BASELINE')
      epochs.add(item.daemonEpoch)
      legacyTotal += item.count
      if (!Number.isSafeInteger(legacyTotal)) throw new Error('INVALID_LEGACY_NATIVE_BASELINE')
      return { daemonEpoch: item.daemonEpoch, count: item.count, observedAt: item.observedAt, evidenceRef: item.evidenceRef, evidenceSha256: item.evidenceSha256 }
    })
    // Capture the trusted dependency references; later mutation of options cannot replace them.
    this.options = { legacyUnknown: [], verifyTerminal: options.verifyTerminal, clock: { wallNow: options.clock.wallNow.bind(options.clock), monotonicNow: options.clock.monotonicNow.bind(options.clock) } }
    this.time()
  }
  private time(): { at: string; mono: number } {
    const at = this.options.clock.wallNow(), mono = this.options.clock.monotonicNow()
    if (!timestamp(at) || !Number.isFinite(mono) || mono < 0) throw new Error('INVALID_NATIVE_CLOCK')
    return { at, mono }
  }
  private event(record: InternalObservation, action: string, reason?: string): void {
    const { at, mono } = this.time()
    record.elapsedMs = Math.max(record.elapsedMs, mono - record.startedMono)
    this.audit.push({ sequence: this.audit.length + 1, at, daemonEpoch: record.identity.daemonEpoch, requestId: record.identity.requestId, action, ...(reason ? { reason } : {}) })
  }
  private get(epoch: string, requestId: string): InternalObservation {
    const record = this.observations.get(key(epoch, requestId))
    if (!record) throw new Error('NATIVE_OBSERVATION_NOT_FOUND')
    return record
  }
  begin(input: NativeIdentity): void {
    const id = identity(input), idKey = key(id.daemonEpoch, id.requestId)
    // A reused wire request ID is rejected even after terminal completion and even for a different project.
    if (this.observations.has(idKey)) throw new Error('NATIVE_REQUEST_ID_REUSED')
    const { at, mono } = this.time()
    const record: InternalObservation = { identity: id, createdAt: at, state: 'awaiting-send', conflicts: [], conflictingTerminal: false, elapsedMs: 0, startedMono: mono }
    this.observations.set(idKey, record)
    this.event(record, 'begin')
  }
  /** MUST run synchronously before the transport send is attempted, including a send that throws. */
  attemptSend(epoch: string, requestId: string): void {
    const record = this.get(epoch, requestId)
    if (record.sendAttemptedAt) return
    record.sendAttemptedAt = this.time().at
    // A delayed send after an alleged pre-send failure invalidates that local conclusion.
    record.state = record.localSettledAt ? 'unknown' : 'awaiting-terminal'
    if (record.localSettledAt) record.reason = 'send-after-local-settlement'
    this.event(record, 'send-attempted', record.reason)
  }
  /** Preferred transport boundary: reserves exactly one attempt before invoking transport code. */
  async dispatch(epoch: string, requestId: string, send: () => void | Promise<void>): Promise<void> {
    const record = this.get(epoch, requestId)
    if (record.sendAttemptedAt || record.localSettledAt || record.terminal) throw new Error('NATIVE_SEND_ALREADY_CLOSED_OR_ATTEMPTED')
    this.attemptSend(epoch, requestId)
    try { await send() } catch (error) { this.localFailure(epoch, requestId, 'send-failed'); throw error }
  }
  localFailure(epoch: string, requestId: string, reason: NativeLocalFailure): void {
    if (!failures.includes(reason)) throw new Error('INVALID_LOCAL_FAILURE')
    const record = this.get(epoch, requestId)
    if (record.localSettledAt || record.terminal) return
    record.localSettledAt = this.time().at
    record.localFailure = reason
    record.state = record.sendAttemptedAt ? 'unknown' : 'terminal'
    record.reason = record.sendAttemptedAt ? reason : 'failed-before-send-attempt'
    this.event(record, 'local-settlement', record.reason)
  }
  async reconcile(epoch: string, requestId: string, untrusted: unknown): Promise<'accepted' | 'duplicate' | 'rejected'> {
    const record = this.get(epoch, requestId)
    const reject = (reason: string) => { this.event(record, 'evidence-rejected', reason); return 'rejected' as const }
    let proof: VerifiedNativeTerminal | null
    try { proof = await this.options.verifyTerminal(untrusted); proof = proof === null ? null : structuredClone(proof) } catch { return reject('verification-failed') }
    if (!proof || proof.kind !== 'native-execution-terminal-v1') return reject('no-verified-native-terminal')
    let proofIdentity: NativeIdentity
    try { proofIdentity = identity(proof.identity) } catch { return reject('invalid-evidence-identity') }
    if (!sameIdentity(record.identity, proofIdentity)) return reject('evidence-identity-mismatch')
    if (!record.sendAttemptedAt) return reject('no-send-attempt')
    if (!text(proof.receiptId) || !text(proof.verifierId) || !['native-response', 'native-journal'].includes(proof.source)
      || !['SUCCEEDED', 'FAILED'].includes(proof.terminalState) || !hash.test(proof.responseSha256)
      || !ArrayBuffer.isView(proof.responseBytes) || Object.prototype.toString.call(proof.responseBytes) !== '[object Uint8Array]'
      || proof.responseBytes.byteLength === 0 || proof.responseBytes.byteLength > 1024 * 1024 || !timestamp(proof.responseObservedAt)) return reject('invalid-terminal-evidence')
    let response: unknown
    try { response = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(proof.responseBytes)) } catch { return reject('invalid-response-bytes') }
    if (!wireResponse(response) || response.id !== record.identity.requestId) return reject('invalid-wire-response')
    if (response.ok ? proof.terminalState !== 'SUCCEEDED' : proof.terminalState !== 'FAILED' || typeof response.error?.code !== 'string' || !terminalErrors.has(response.error.code)) return reject('nonterminal-protocol-response')
    if (await sha256(proof.responseBytes) !== proof.responseSha256) return reject('response-hash-mismatch')
    const { at, mono } = this.time()
    if (Date.parse(record.createdAt) > Date.parse(record.sendAttemptedAt) || Date.parse(proof.responseObservedAt) < Date.parse(record.sendAttemptedAt)
      || Date.parse(proof.responseObservedAt) > Date.parse(at) || mono < record.startedMono) return reject('evidence-time-mismatch')
    const idKey = key(epoch, requestId), owner = this.receiptOwners.get(proof.receiptId)
    if (owner && owner !== idKey) return reject('receipt-already-bound')
    // No await below this point: concurrent verifications are reconciled atomically against current state.
    if (record.terminal) {
      const previous = record.terminal
      if (previous.receiptId === proof.receiptId && previous.responseSha256 === proof.responseSha256 && previous.terminalState === proof.terminalState
        && previous.verifierId === proof.verifierId && previous.source === proof.source
        && previous.responseObservedAt === proof.responseObservedAt && !record.conflictingTerminal) {
        this.event(record, 'duplicate-terminal'); return 'duplicate'
      }
      record.conflictingTerminal = true; record.state = 'unknown'; record.reason = 'conflicting-terminal-evidence'
      record.conflicts.push({ receiptId: proof.receiptId, verifierId: proof.verifierId, source: proof.source, terminalState: proof.terminalState,
        responseSha256: proof.responseSha256, responseObservedAt: proof.responseObservedAt, verifiedAt: at })
      return reject('conflicting-terminal-evidence')
    }
    if (record.conflictingTerminal) return reject('conflicting-terminal-evidence')
    record.terminal = { receiptId: proof.receiptId, verifierId: proof.verifierId, source: proof.source, terminalState: proof.terminalState,
      responseSha256: proof.responseSha256, responseObservedAt: proof.responseObservedAt, verifiedAt: at }
    this.receiptOwners.set(proof.receiptId, idKey)
    record.state = 'terminal'; record.reason = 'verified-native-terminal'
    this.event(record, 'terminal-accepted')
    return 'accepted'
  }
  snapshot() {
    const observations: Observation[] = Array.from(this.observations.values(), ({ startedMono: _startedMono, ...record }) => structuredClone(record))
    const awaiting = observations.filter(r => r.state === 'awaiting-send' || r.state === 'awaiting-terminal').length
    const identifiedUnknown = observations.filter(r => r.state === 'unknown').length
    const legacyUnknown = this.legacy.reduce((total, r) => total + r.count, 0)
    return { schemaVersion: 'native-observation-candidate-v1' as const, candidateOnly: true as const, observations,
      legacyUnknown: structuredClone(this.legacy), audit: structuredClone(this.audit),
      counts: { awaiting, identifiedUnknown, legacyUnknown, blocking: awaiting + identifiedUnknown + legacyUnknown } }
  }
}
