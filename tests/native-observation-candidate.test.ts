import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NativeObservationCandidate } from '../host/native-observation-candidate'
import type { NativeIdentity, NativeTerminalVerifier, VerifiedNativeTerminal } from '../host/native-observation-candidate'

beforeAll(async () => {
  const builtin = 'node:crypto'
  const { webcrypto } = await import(builtin)
  vi.stubGlobal('crypto', webcrypto)
})
afterAll(() => vi.unstubAllGlobals())
const originalEpoch = '62e066f5-5081-43e4-a19c-242889e46a90'
const inputSha256 = 'a'.repeat(64)
const id = (changes: Partial<NativeIdentity> = {}): NativeIdentity => ({ daemonEpoch: 'candidate-epoch', requestId: 'wire-request-1', operationId: 'outer-operation-1', projectId: 'isolated-project', sessionId: 'isolated-creator-session', method: 'scene.getTree', inputSha256, ...changes })
function setup(verifyOverride?: NativeTerminalVerifier) {
  let now = Date.parse('2026-10-19T08:00:00.000Z'), mono = 1000
  const clock = { wallNow: () => new Date(now).toISOString(), monotonicNow: () => mono }
  const proofs = new Map<unknown, VerifiedNativeTerminal>()
  const verify = verifyOverride ?? (async (value: unknown) => proofs.get(value) ?? null)
  const legacy = [{ daemonEpoch: originalEpoch, count: 2, observedAt: '2026-10-19T05:19:41.233Z', evidenceRef: 'daemon-inflight-final.json', evidenceSha256: 'b'.repeat(64) }]
  const tracker = new NativeObservationCandidate({ legacyUnknown: legacy, verifyTerminal: verify, clock })
  async function proof(identity: NativeIdentity = id(), response: unknown = { id: identity.requestId, ok: true, result: { complete: true } }): Promise<VerifiedNativeTerminal> {
    const responseBytes = new TextEncoder().encode(JSON.stringify(response))
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', responseBytes))
    const responseSha256 = Array.from(digest, x => x.toString(16).padStart(2, '0')).join('')
    return { kind: 'native-execution-terminal-v1', identity, receiptId: `receipt-${identity.daemonEpoch}-${identity.requestId}`, verifierId: 'isolated-native-journal-verifier', source: 'native-journal', terminalState: 'SUCCEEDED', responseObservedAt: clock.wallNow(), responseSha256, responseBytes }
  }
  async function deliver(value: VerifiedNativeTerminal, target = id()) {
    const opaque = {}; proofs.set(opaque, value)
    return tracker.reconcile(target.daemonEpoch, target.requestId, opaque)
  }
  function beginSent(identity = id()) { tracker.begin(identity); tracker.attemptSend(identity.daemonEpoch, identity.requestId) }
  return { tracker, clock, legacy, proof, deliver, beginSent, tick: (ms = 100) => { now += ms; mono += ms }, rewindMono: () => { mono = 0 } }
}

describe('offline Native observations with no host integration', () => {
  it('requires an explicit legacy baseline; does not fabricate two request records', () => {
    const s = setup()
    expect(s.tracker.snapshot().observations).toEqual([])
    expect(s.tracker.snapshot().legacyUnknown).toEqual(s.legacy)
    expect(s.tracker.snapshot().counts).toEqual({ awaiting: 0, identifiedUnknown: 0, legacyUnknown: 2, blocking: 2 })
    expect(() => new NativeObservationCandidate({ legacyUnknown: undefined as never, verifyTerminal: async () => null, clock: s.clock })).toThrow('BASELINE_REQUIRED')
    expect(() => new NativeObservationCandidate({ legacyUnknown: [{ ...s.legacy[0]!, count: -1 }], verifyTerminal: async () => null, clock: s.clock })).toThrow('INVALID_LEGACY')
  })
  it('a proven failure before any send attempt completes locally, without a native receipt', () => {
    const s = setup(); s.tracker.begin(id()); s.tick(); s.tracker.localFailure(id().daemonEpoch, id().requestId, 'connection-failed')
    const r = s.tracker.snapshot()
    expect(r.observations[0]).toMatchObject({ state: 'terminal', reason: 'failed-before-send-attempt', elapsedMs: 100 })
    expect(r.observations[0]?.terminal).toBeUndefined(); expect(r.counts.blocking).toBe(2)
  })
  it.each(['timeout', 'disconnected', 'aborted', 'invalid-response'] as const)('keeps sent %s unresolved', reason => {
    const s = setup(); s.beginSent(); s.tick(); s.tracker.localFailure(id().daemonEpoch, id().requestId, reason)
    expect(s.tracker.snapshot().counts).toMatchObject({ identifiedUnknown: 1, legacyUnknown: 2, blocking: 3 })
  })
  it('marks attempted before transport, including a synchronous send throw, and never retries', async () => {
    const s = setup(); s.tracker.begin(id())
    const send = vi.fn(() => { expect(s.tracker.snapshot().observations[0]?.sendAttemptedAt).toBeDefined(); throw new Error('transport-failure') })
    await expect(s.tracker.dispatch(id().daemonEpoch, id().requestId, send)).rejects.toThrow('transport-failure')
    expect(s.tracker.snapshot().counts.identifiedUnknown).toBe(1)
    await expect(s.tracker.dispatch(id().daemonEpoch, id().requestId, send)).rejects.toThrow('ALREADY_CLOSED_OR_ATTEMPTED')
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('refuses transport dispatch after local pre-send settlement; records a bypassed late attempt as unknown', async () => {
    const s = setup(); s.tracker.begin(id()); s.tracker.localFailure(id().daemonEpoch, id().requestId, 'connection-failed')
    const send = vi.fn(); await expect(s.tracker.dispatch(id().daemonEpoch, id().requestId, send)).rejects.toThrow(); expect(send).not.toHaveBeenCalled()
    s.tracker.attemptSend(id().daemonEpoch, id().requestId)
    expect(s.tracker.snapshot().observations[0]).toMatchObject({ state: 'unknown', reason: 'send-after-local-settlement' })
  })
  it('a matching late terminal closes only its identified record and preserves the anonymous two', async () => {
    const s = setup(); s.beginSent(); s.tracker.localFailure(id().daemonEpoch, id().requestId, 'disconnected'); s.tick()
    const result = await s.deliver(await s.proof())
    expect(result, JSON.stringify(s.tracker.snapshot().audit)).toBe('accepted')
    expect(s.tracker.snapshot().counts).toEqual({ awaiting: 0, identifiedUnknown: 0, legacyUnknown: 2, blocking: 2 })
    expect(s.tracker.snapshot().observations[0]?.localFailure).toBe('disconnected')
    expect(s.tracker.snapshot().audit.map(x => x.action)).toEqual(['begin', 'send-attempted', 'local-settlement', 'terminal-accepted'])
  })
  it('accepts a verified explicit protocol rejection while keeping its failed outcome', async () => {
    const s = setup(); s.beginSent(); const p = await s.proof(id(), { id: id().requestId, ok: false, error: { code: 'INVALID_REQUEST', message: 'isolated failure' } }); p.terminalState = 'FAILED'
    expect(await s.deliver(p)).toBe('accepted'); expect(s.tracker.snapshot().observations[0]?.terminal?.terminalState).toBe('FAILED')
  })
  it.each(['TIMEOUT', 'INTERNAL_ERROR', 'UNRECOGNIZED_ERROR'])('does not treat %s as Native completion', async code => {
    const s = setup(); s.beginSent(); s.tracker.localFailure(id().daemonEpoch, id().requestId, 'timeout')
    const p = await s.proof(id(), { id: id().requestId, ok: false, error: { code, message: 'isolated failure' } }); p.terminalState = 'FAILED'
    expect(await s.deliver(p)).toBe('rejected'); expect(s.tracker.snapshot().counts.blocking).toBe(3)
    expect(s.tracker.snapshot().audit.at(-1)?.reason).toBe('nonterminal-protocol-response')
  })
  it('does not accept arbitrary caller proofs, PASSED or HTTP acceptance as verified native evidence', async () => {
    const s = setup(); s.beginSent()
    for (const value of [{ status: 'PASSED' }, { status: 202 }, await s.proof()]) expect(await s.tracker.reconcile(id().daemonEpoch, id().requestId, value)).toBe('rejected')
    expect(s.tracker.snapshot().counts.awaiting).toBe(1)
  })
  it.each(['daemonEpoch', 'requestId', 'operationId', 'projectId', 'sessionId', 'method', 'inputSha256'] as const)('rejects a verified receipt for a different %s', async field => {
    const s = setup(); s.beginSent(); const p = await s.proof(); p.identity[field] = field === 'inputSha256' ? 'c'.repeat(64) : 'different'
    expect(await s.deliver(p)).toBe('rejected'); expect(s.tracker.snapshot().counts.awaiting).toBe(1)
    expect(s.tracker.snapshot().audit.at(-1)?.reason).toBe('evidence-identity-mismatch')
  })
  it('checks the actual wire ID and computes the response hash from copied raw bytes', async () => {
    const s = setup(); s.beginSent()
    expect(await s.deliver(await s.proof(id(), { id: 'other-wire-id', ok: true, result: null }))).toBe('rejected')
    expect(s.tracker.snapshot().audit.at(-1)?.reason).toBe('invalid-wire-response')
    const p = await s.proof(); p.responseSha256 = '0'.repeat(64)
    expect(await s.deliver(p)).toBe('rejected'); expect(s.tracker.snapshot().observations[0]?.terminal).toBeUndefined()
    expect(s.tracker.snapshot().audit.at(-1)?.reason).toBe('response-hash-mismatch')
  })
  it.each([-1, 1])('rejects response time outside send/verification interval (%s)', async offset => {
    const s = setup(); s.beginSent(); const p = await s.proof()
    p.responseObservedAt = new Date(Date.parse(p.responseObservedAt) + offset).toISOString()
    expect(await s.deliver(p)).toBe('rejected')
    expect(s.tracker.snapshot().audit.at(-1)?.reason).toBe('evidence-time-mismatch')
  })
  it('rejects a regressed monotonic clock instead of proving a terminal', async () => {
    const s = setup(); s.beginSent(); const p = await s.proof(); s.rewindMono()
    expect(await s.deliver(p)).toBe('rejected'); expect(s.tracker.snapshot().counts.awaiting).toBe(1)
  })
  it('rejects terminal evidence before any send', async () => {
    const s = setup(); s.tracker.begin(id()); expect(await s.deliver(await s.proof())).toBe('rejected')
    expect(s.tracker.snapshot().counts.awaiting).toBe(1)
  })
  it('same receipt is idempotent even with concurrent verification', async () => {
    const s = setup(); s.beginSent(); const p = await s.proof()
    expect((await Promise.all([s.deliver(p), s.deliver(p)])).sort()).toEqual(['accepted', 'duplicate'])
    s.tracker.localFailure(id().daemonEpoch, id().requestId, 'timeout')
    expect(s.tracker.snapshot().observations[0]?.state).toBe('terminal'); expect(s.tracker.snapshot().counts.blocking).toBe(2)
  })
  it('retains conflicting evidence, reblocks, and never erases the original terminal', async () => {
    const s = setup(); s.beginSent(); const original = await s.proof(); await s.deliver(original)
    const conflict = await s.proof(id(), { id: id().requestId, ok: false, error: { code: 'NOT_FOUND', message: 'isolated failure' } }); conflict.terminalState = 'FAILED'
    expect(await s.deliver(conflict)).toBe('rejected')
    const r = s.tracker.snapshot().observations[0]!
    expect(r.state).toBe('unknown'); expect(r.terminal?.responseSha256).toBe(original.responseSha256)
    expect(r.conflicts[0]?.responseSha256).toBe(conflict.responseSha256)
    expect(await s.deliver(original)).toBe('rejected'); expect(s.tracker.snapshot().counts.blocking).toBe(3)
  })
  it('one receipt cannot settle another request', async () => {
    const s = setup(); s.beginSent(); const first = await s.proof(); await s.deliver(first)
    const second = id({ requestId: 'wire-request-2', operationId: 'outer-2' }); s.beginSent(second)
    const p = await s.proof(second); p.receiptId = first.receiptId
    expect(await s.deliver(p, second)).toBe('rejected'); expect(s.tracker.snapshot().counts.awaiting).toBe(1)
    expect(s.tracker.snapshot().audit.at(-1)?.reason).toBe('receipt-already-bound')
  })
  it('same receipt with a changed legal observation time is conflicting, not duplicate', async () => {
    const s = setup(); s.beginSent(); s.tick(50); const p = await s.proof(); await s.deliver(p); s.tick(50)
    const changed = { ...p, responseObservedAt: s.clock.wallNow() }
    expect(await s.deliver(changed)).toBe('rejected'); expect(s.tracker.snapshot().counts.identifiedUnknown).toBe(1)
    expect(s.tracker.snapshot().observations[0]?.conflicts[0]?.responseObservedAt).toBe(changed.responseObservedAt)
  })
  it.each([
    { id: 'wire-request-1', ok: true },
    { id: 'wire-request-1', ok: true, result: null, error: { code: 'NOT_FOUND', message: 'bad' } },
    { id: 'wire-request-1', ok: true, result: null, extra: 'not-in-protocol' },
    { id: 'wire-request-1', ok: false, error: { code: 'NOT_FOUND' } },
    { id: 'wire-request-1', ok: false, error: { code: 'NOT_FOUND', message: 'bad', extra: true } },
  ])('rejects malformed or mixed protocol envelope %j', async response => {
    const s = setup(); s.beginSent(); const p = await s.proof(id(), response); p.terminalState = response.ok ? 'SUCCEEDED' : 'FAILED'
    expect(await s.deliver(p)).toBe('rejected'); expect(s.tracker.snapshot().counts.awaiting).toBe(1)
    expect(s.tracker.snapshot().audit.at(-1)?.reason).toBe('invalid-wire-response')
  })
  it('keeps every epoch unknown; a new epoch and reused outer ID cannot overwrite old observations', async () => {
    const s = setup(); s.beginSent(); s.tracker.localFailure(id().daemonEpoch, id().requestId, 'disconnected')
    expect(() => s.tracker.begin(id({ projectId: 'other-project' }))).toThrow('REQUEST_ID_REUSED')
    const next = id({ daemonEpoch: 'next-epoch' }); s.beginSent(next); await s.deliver(await s.proof(next), next)
    expect(s.tracker.snapshot().observations).toHaveLength(2)
    expect(s.tracker.snapshot().counts).toMatchObject({ identifiedUnknown: 1, legacyUnknown: 2, blocking: 3 })
    expect(await s.deliver(await s.proof(next), id())).toBe('rejected')
  })
  it('does not expose writable internal state or retain raw response contents', async () => {
    const s = setup(); const mutable = id(); s.beginSent(mutable); mutable.projectId = 'mutated'; const p = await s.proof(); await s.deliver(p)
    const view = s.tracker.snapshot(); view.observations[0]!.identity.projectId = 'tampered'; view.observations[0]!.terminal!.responseSha256 = '0'.repeat(64); view.legacyUnknown[0]!.count = 0; view.audit.length = 0
    const actual = s.tracker.snapshot()
    expect(actual.observations[0]?.identity.projectId).toBe(id().projectId); expect(actual.counts.blocking).toBe(2)
    expect(actual.observations[0]?.terminal?.responseSha256).toBe(p.responseSha256); expect(actual.audit.length).toBeGreaterThan(0)
    expect(JSON.stringify(actual)).not.toContain('responseBytes'); expect(actual.observations[0]?.identity.operationId).toBe('outer-operation-1')
  })
  it('verifier exceptions are audited and cannot settle the request or expose error payloads', async () => {
    const s = setup(async () => { throw new Error('secret-not-for-audit') }); s.beginSent()
    expect(await s.tracker.reconcile(id().daemonEpoch, id().requestId, {})).toBe('rejected')
    expect(s.tracker.snapshot().counts.blocking).toBe(3); expect(JSON.stringify(s.tracker.snapshot())).not.toContain('secret-not-for-audit')
  })
})
