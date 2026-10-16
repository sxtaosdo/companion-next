import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCreatorOperationsProvider, CREATOR_OPERATION_LIMITS, CreatorOperationError } from '../src/adapters/creator-operations'
import type { CreatorOperationFetch } from '../src/adapters/creator-operations'
import type { CreatorAction, CreatorOperationCode, CreatorOperationOutcome, CreatorOperationRequest } from '../src/domain/creator-operations'
import { RUNTIME_STATES } from '../src/domain/companion-browser'

const projectId = '0123456789abcdef'
const lifecycleActions = ['start', 'focus', 'stop', 'restart'] as const
const managementActions = ['open-folder', 'remove-registration'] as const
const actions = [...lifecycleActions, ...managementActions] as const
const runtimeActions = ['start', 'stop', 'restart'] as const
const folderPath = 'C:\\Projects\\演示工程'
const input = (action: CreatorAction = 'start'): CreatorOperationRequest => ({ projectId, action })
const runtime = () => ({ projectId, state: 'ready', creatorVersion: '3.8.8', pid: 3242, sessionId: 'session-1', capabilityProfile: 'authoring', launchSource: 'dashboard' })
const success = (action: CreatorAction) => action === 'focus' ? { ok: true } : action === 'open-folder' ? { ok: true, path: folderPath } : action === 'remove-registration' ? { removed: true } : { ...runtime(), state: action === 'stop' ? 'stopped' : 'ready' }
const expectedSuccess = (action: CreatorAction) => action === 'focus' ? { action, acknowledged: true } : action === 'open-folder' ? { action, acknowledged: true, path: folderPath } : action === 'remove-registration' ? { action, removed: true } : { action, runtime: success(action) }
const requestPath = (action: CreatorAction) => action === 'remove-registration' ? `/api/projects/${projectId}` : `/api/projects/${projectId}/${action}`
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } })
const fixture = (value: unknown = runtime()) => vi.fn<CreatorOperationFetch>(async () => value instanceof Response ? value : json(value))
const flush = async () => { for (let n = 0; n < 16; n++) await Promise.resolve() }
async function errorFrom(pending: Promise<unknown>, code: CreatorOperationCode, outcome: CreatorOperationOutcome) {
  const error = await pending.then(() => { throw Error('Expected failure') }, (error: unknown) => error)
  expect(error).toBeInstanceOf(CreatorOperationError)
  expect(error).toMatchObject({ code, outcome })
  expect(`${error}${JSON.stringify(error)}`).not.toContain('PRIVATE')
  expect(error).not.toHaveProperty('cause')
  return error as CreatorOperationError
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('v148 management and v148/v150 lifecycle source contracts, using fake transports only', () => {
  it.each(actions)('constructs passively and sends only the exact same-origin %s method, path and body', async action => {
    const fetch = fixture(success(action)), provider = createCreatorOperationsProvider({ fetch })
    await expect(provider.waitForIdle()).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled(); expect(Object.isFrozen(provider)).toBe(true)
    expect(Object.keys(provider).sort()).toEqual(['label', 'run', 'waitForIdle'])
    expect(await provider.run(input(action))).toEqual(expectedSuccess(action))
    expect(fetch).toHaveBeenCalledOnce()
    const [path, init] = fetch.mock.calls[0]!
    expect(path).toBe(requestPath(action)); expect(path).not.toContain('/remove-registration')
    expect(init).toMatchObject({ method: action === 'remove-registration' ? 'DELETE' : 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store' })
    if (action === 'remove-registration') {
      expect(init).not.toHaveProperty('body'); expect(init.headers).toEqual({ Accept: 'application/json' })
      expect(Object.keys(init).sort()).toEqual(['cache', 'credentials', 'headers', 'method', 'mode', 'redirect', 'signal'])
    } else {
      expect(init.body).toBe('{}'); expect(init.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' })
      expect(Object.keys(init).sort()).toEqual(['body', 'cache', 'credentials', 'headers', 'method', 'mode', 'redirect', 'signal'])
    }
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(init.headers).get('authorization')).toBeNull(); expect(new Headers(init.headers).get('cookie')).toBeNull()
  })
  it('requires explicit transport injection and cannot widen the 120-second limit', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(() => createCreatorOperationsProvider(undefined as never)).toThrow(TypeError)
    expect(() => createCreatorOperationsProvider({} as never)).toThrow(TypeError)
    for (const timeoutMs of [0, -1, NaN, Infinity, 120_001]) expect(() => createCreatorOperationsProvider({ fetch: fixture(), timeoutMs })).toThrow(RangeError)
    createCreatorOperationsProvider({ fetch: fixture(), timeoutMs: 120_000 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['', '../PRIVATE', 'https://example.invalid', '0123456789ABCDEf', '0123456789abcde', '0123456789abcdef0', '%30'.repeat(16), 'a'.repeat(15) + '\n', null, 1])('rejects unsafe or non-contract project ID %# before dispatch', async projectId => {
    const fetch = fixture(), provider = createCreatorOperationsProvider({ fetch })
    for (const action of actions) await errorFrom(provider.run({ ...input(action), projectId } as CreatorOperationRequest), 'invalid-input', 'not-dispatched')
    expect(fetch).not.toHaveBeenCalled(); await provider.waitForIdle()
  })
  it.each(['setup', 'delete', 'remove', 'open-folder?path=PRIVATE', 'remove-registration/force', 'start/../stop', 'stop/../restart', 'restart?force=true', 'START', 'STOP', 'RESTART', '', null, 1])('rejects unsupported action %# with no fallback', async action => {
    const fetch = fixture(); await errorFrom(createCreatorOperationsProvider({ fetch }).run({ ...input(), action } as CreatorOperationRequest), 'invalid-input', 'not-dispatched')
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(actions)('rejects additional %s URL/token/body/force options, arrays, prototype inputs and accessors without evaluating them', async action => {
    const fetch = fixture(), provider = createCreatorOperationsProvider({ fetch }), getter = vi.fn(() => { throw Error('PRIVATE') })
    const badInputs = [null, [], Object.create(input(action)), Object.assign(Object.create({ token: 'PRIVATE' }), input(action)), { ...input(action), url: 'https://PRIVATE' }, { ...input(action), token: 'PRIVATE' }, { ...input(action), body: {} }, { ...input(action), force: true }, { ...input(action), path: folderPath },
      JSON.parse(`{"projectId":"0123456789abcdef","action":"${action}","__proto__":{"token":"PRIVATE"}}`),
      Object.defineProperty(input(action), 'projectId', { get: getter }), Object.defineProperty(input(action), 'action', { get: getter }),
      Object.assign(input(action), { [Symbol('PRIVATE')]: true }), new Proxy({}, { ownKeys() { throw Error('PRIVATE') } })]
    for (const bad of badInputs) await errorFrom(provider.run(bad as CreatorOperationRequest), 'invalid-input', 'not-dispatched')
    expect(getter).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it.each(actions)('accepts a null-prototype %s request and snapshots it before the transport microtask', async action => {
    const request = Object.assign(Object.create(null), input(action)) as CreatorOperationRequest
    const fetch = fixture(success(action)), provider = createCreatorOperationsProvider({ fetch }), pending = provider.run(request)
    request.projectId = 'fedcba9876543210'; request.action = action === 'focus' ? 'restart' : 'focus'
    expect(await pending).toEqual(expectedSuccess(action))
    expect(fetch.mock.calls[0]![0]).toBe(requestPath(action))
  })
  it('ignores inherited optional fields and rejects inherited required response fields', async () => {
    const inherited = { projectId, state: 'ready', creatorVersion: 'PRIVATE', pid: 99, ok: true, path: folderPath, removed: true, error: 'Forbidden', code: 'DASHBOARD_NOT_FOUND', retryable: false }
    for (const [key, value] of Object.entries(inherited)) Object.defineProperty(Object.prototype, key, { value, configurable: true, writable: true })
    try {
      await errorFrom(createCreatorOperationsProvider({ fetch: fixture({}) }).run(input()), 'invalid-shape', 'unknown')
      await errorFrom(createCreatorOperationsProvider({ fetch: fixture({ unknown: true }) }).run(input('focus')), 'invalid-shape', 'unknown')
      await errorFrom(createCreatorOperationsProvider({ fetch: fixture({ ok: true }) }).run(input('open-folder')), 'invalid-shape', 'unknown')
      await errorFrom(createCreatorOperationsProvider({ fetch: fixture({ path: folderPath }) }).run(input('open-folder')), 'invalid-shape', 'unknown')
      await errorFrom(createCreatorOperationsProvider({ fetch: fixture({ unknown: true }) }).run(input('remove-registration')), 'invalid-shape', 'unknown')
      await errorFrom(createCreatorOperationsProvider({ fetch: fixture(json({ unknown: true }, { status: 403 })) }).run(input()), 'invalid-shape', 'unknown')
      await errorFrom(createCreatorOperationsProvider({ fetch: fixture(json({ details: {} }, { status: 409 })) }).run(input()), 'invalid-shape', 'unknown')
      expect(await createCreatorOperationsProvider({ fetch: fixture({ projectId, state: 'stopped' }) }).run(input())).toEqual({ action: 'start', runtime: { projectId, state: 'stopped', capabilityProfile: 'unknown' } })
    } finally {
      for (const key of Object.keys(inherited)) Reflect.deleteProperty(Object.prototype, key)
    }
  })
  it.each(RUNTIME_STATES)('accepts the actual %s state without inventing readiness or a configured Bridge', async state => {
    for (const action of ['start', 'restart'] as const) expect(await createCreatorOperationsProvider({ fetch: fixture({ projectId, state }) }).run(input(action))).toEqual({ action, runtime: { projectId, state, capabilityProfile: 'unknown' } })
  })
  it.each(RUNTIME_STATES)('requires stop HTTP200 to report stopped rather than trusting %s', async state => {
    const pending = createCreatorOperationsProvider({ fetch: fixture({ projectId, state }) }).run(input('stop'))
    if (state === 'stopped') expect(await pending).toEqual({ action: 'stop', runtime: { projectId, state: 'stopped', capabilityProfile: 'unknown' } })
    else await errorFrom(pending, 'invalid-shape', 'unknown')
  })
  it('projects stop status without claiming process exit or inventing a success flag', async () => {
    expect(await createCreatorOperationsProvider({ fetch: fixture(success('stop')) }).run(input('stop'))).toEqual(expectedSuccess('stop'))
  })
  it.each(runtimeActions)('projects verified %s status fields but never errors, details, preview URLs, credentials or unknown fields', async action => {
    const raw = { ...success(action), instanceId: 'instance-1', dashboardVersion: '2.2.2', dashboardProgress: 'token=PRIVATE; Bearer PRIVATE; Cookie: PRIVATE',
      lastError: 'PRIVATE error', details: { password: 'PRIVATE' }, preview: { url: 'https://PRIVATE' }, creatorExecutable: 'PRIVATE', token: 'PRIVATE', nextUrl: 'https://PRIVATE',
      ...JSON.parse('{"__proto__":{"PRIVATE":true}}') }
    const result = await createCreatorOperationsProvider({ fetch: fixture(raw) }).run(input(action))
    expect(result).toEqual({ action, runtime: { ...success(action), instanceId: 'instance-1', dashboardVersion: '2.2.2', dashboardProgress: 'token=[redacted]; Bearer [redacted]; cookie: [redacted]' } })
    expect(JSON.stringify(result)).not.toContain('PRIVATE'); expect(Object.prototype).not.toHaveProperty('PRIVATE')
  })
  it.each([
    { projectId: 'fedcba9876543210' }, { projectId: '' }, { state: 'unknown' }, { state: 'new-state' }, { state: null }, { pid: 0 }, { pid: -1 }, { pid: 1.5 }, { pid: '42' },
    { capabilityProfile: 'root' }, { capabilityProfile: null }, { launchSource: 'direct' }, { sessionId: null }, { creatorVersion: 'x'.repeat(65) },
    { dashboardProgress: 'x'.repeat(257) }, { instanceId: 'x\u0000y' }, { dashboardVersion: 1 },
  ])('rejects a mismatched or malformed runtime %# as unknown', async override => {
    for (const action of runtimeActions) await errorFrom(createCreatorOperationsProvider({ fetch: fixture({ ...success(action), ...override }) }).run(input(action)), 'invalid-shape', 'unknown')
  })
  it.each([null, [], {}, { ok: true }, { projectId }, { state: 'ready' }])('rejects missing runtime contract %#', async raw => {
    for (const action of runtimeActions) await errorFrom(createCreatorOperationsProvider({ fetch: fixture(raw) }).run(input(action)), 'invalid-shape', 'unknown')
  })
  it.each([null, [], {}, { ok: false }, { ok: 'true' }, { ok: true, token: 'PRIVATE' }, runtime()])('requires exactly focus {ok:true}, not %#', async raw => {
    await errorFrom(createCreatorOperationsProvider({ fetch: fixture(raw) }).run(input('focus')), 'invalid-shape', 'unknown')
  })
  it('labels management as a v148 source contract without claiming v150 management or real-host validation', () => {
    const provider = createCreatorOperationsProvider({ fetch: fixture() })
    expect(provider.label).toContain('v148 管理合同'); expect(provider.label).toContain('v148/v150 生命周期源码已核'); expect(provider.label).toContain('实机未验')
  })
  it.each([
    folderPath, 'C:/Projects/My Game', 'd:\\', '\\\\server\\share\\演示工程', '\\\\server.example.test\\shared projects',
    '/home/user/Projects/My Game', '/', `/projects/${'工'.repeat(4086)}`,
  ])('preserves an absolute open-folder path exactly for the store target check: %#', async path => {
    const fetch = fixture({ ok: true, path })
    expect(await createCreatorOperationsProvider({ fetch }).run(input('open-folder'))).toEqual({ action: 'open-folder', acknowledged: true, path })
    expect(fetch.mock.calls[0]![1].body).toBe('{}'); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([
    null, 1, {}, [], '', 'Projects/Game', '../PRIVATE', 'C:relative', '\\relative', '\\\\server', '\\\\server\\',
    '//example.invalid/PRIVATE', 'https://example.invalid/PRIVATE', 'file:///PRIVATE', 'data:text/plain,PRIVATE',
    '\\\\?\\C:\\PRIVATE', '\\\\.\\PRIVATE', 'C://example.invalid/PRIVATE', 'C:\\PRIVATE?force=true',
    '/PRIVATE\u0000x', '/PRIVATE\tvalue', '/PRIVATE\nvalue', '/PRIVATE\rvalue', '/PRIVATE\u007fvalue', '/PRIVATE\u0085value',
    '/PRIVATE\u2028value', '/PRIVATE\u2029value', '/PRIVATE\u202evalue', '/PRIVATE\u2066value', `/projects/${'工'.repeat(4087)}`,
    '/projects/token=PRIVATE', 'C:\\Projects\\password=PRIVATE', '/projects/Bearer PRIVATE', '/projects/Cookie: PRIVATE',
    '/projects/https://user:PRIVATE@example.invalid', '/projects/data:image/png;base64,PRIVATE', `/projects/${'A'.repeat(160)}`,
  ])('rejects unsafe, nonabsolute, oversized or privacy-bearing open-folder path %# without echoing it', async path => {
    await errorFrom(createCreatorOperationsProvider({ fetch: fixture({ ok: true, path }) }).run(input('open-folder')), 'invalid-shape', 'unknown')
  })
  it.each([
    null, [], {}, { ok: true }, { path: folderPath }, { ok: false, path: folderPath }, { ok: 'true', path: folderPath },
    { ok: true, path: folderPath, extra: 'PRIVATE' }, { ok: true, path: folderPath, removed: true },
    { ok: true, path: folderPath, ...JSON.parse('{"__proto__":{"secret":"PRIVATE"}}') },
    { acknowledged: true, path: folderPath }, { removed: true }, runtime(),
  ])('requires exactly open-folder {ok:true,path:string}, not %#', async raw => {
    await errorFrom(createCreatorOperationsProvider({ fetch: fixture(raw) }).run(input('open-folder')), 'invalid-shape', 'unknown')
  })
  it.each([true, false])('preserves remove-registration removed:%s without inventing preset cleanup or a success flag', async removed => {
    const fetch = fixture({ removed }), provider = createCreatorOperationsProvider({ fetch })
    expect(await provider.run(input('remove-registration'))).toEqual({ action: 'remove-registration', removed })
    await provider.waitForIdle(); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([
    null, [], {}, { removed: 'true' }, { removed: 'false' }, { removed: 1 }, { removed: 0 }, { removed: null },
    { ok: true }, { removed: true, ok: true }, { removed: false, error: 'PRIVATE' }, { removed: true, path: folderPath },
    { removed: true, ...JSON.parse('{"__proto__":{"secret":"PRIVATE"}}') }, runtime(),
  ])('requires exactly remove-registration {removed:boolean}, not %#', async raw => {
    await errorFrom(createCreatorOperationsProvider({ fetch: fixture(raw) }).run(input('remove-registration')), 'invalid-shape', 'unknown')
  })
})

describe('source-proven rejection and post-dispatch uncertainty', () => {
  it.each(actions)('classifies only the exact Forbidden/403 envelope as rejected for %s', async action => {
    const error = await errorFrom(createCreatorOperationsProvider({ fetch: fixture(json({ error: 'Forbidden' }, { status: 403 })) }).run(input(action)), 'forbidden', 'rejected')
    expect(error.backendCode).toBeUndefined(); expect(error.reportedReason).toBeUndefined()
  })
  it.each([
    'DASHBOARD_NOT_FOUND', 'DASHBOARD_AUTOMATION_DENIED', 'DASHBOARD_WINDOW_NOT_ACCESSIBLE', 'DASHBOARD_PROJECT_NOT_FOUND',
    'DASHBOARD_PROJECT_AMBIGUOUS', 'DASHBOARD_IMPORT_FAILED', 'DASHBOARD_VERSION_MISMATCH', 'DASHBOARD_LAUNCH_TIMEOUT',
    'DASHBOARD_OPEN_WITHOUT_BRIDGE', 'DASHBOARD_UNSUPPORTED_PLATFORM',
  ])('classifies %s as reported-failure and never claims that Creator was unaffected', async code => {
    const fetch = fixture(json({ error: 'PRIVATE message', code, retryable: false, details: { token: 'PRIVATE' } }, { status: code === 'DASHBOARD_UNSUPPORTED_PLATFORM' ? 501 : 409 }))
    const error = await errorFrom(createCreatorOperationsProvider({ fetch }).run(input()), 'backend-failure', 'reported-failure')
    expect(error.backendCode).toBe(code); expect(error.message).toContain('可能已有部分影响'); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(lifecycleActions)('preserves structured OPEN_WITHOUT_BRIDGE/409 reported-failure for %s without inferring no effect', async action => {
    const fetch = fixture(json({ error: 'PRIVATE 未保存', code: 'DASHBOARD_OPEN_WITHOUT_BRIDGE', retryable: false, details: { token: 'PRIVATE' } }, { status: 409 }))
    const error = await errorFrom(createCreatorOperationsProvider({ fetch }).run(input(action)), 'backend-failure', 'reported-failure')
    expect(error.backendCode).toBe('DASHBOARD_OPEN_WITHOUT_BRIDGE'); expect(error.reportedReason).toBeUndefined(); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(managementActions)('keeps plain %s HTTP500 unknown, drops private errors and never retries partial management effects', async action => {
    const fetch = fixture(json({ error: 'PRIVATE token=PRIVATE 未保存' }, { status: 500 })), provider = createCreatorOperationsProvider({ fetch })
    const error = await errorFrom(provider.run(input(action)), 'backend-failure', 'unknown')
    expect(error.backendCode).toBeUndefined(); expect(error.reportedReason).toBeUndefined(); expect(error).not.toHaveProperty('details')
    await provider.waitForIdle(); await flush(); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(managementActions)('does not infer a lifecycle error contract for %s', async action => {
    const fetch = fixture(json({ error: 'PRIVATE', code: 'DASHBOARD_OPEN_WITHOUT_BRIDGE', retryable: false, details: {} }, { status: 409 }))
    const error = await errorFrom(createCreatorOperationsProvider({ fetch }).run(input(action)), 'invalid-shape', 'unknown')
    expect(error.backendCode).toBeUndefined(); expect(error.reportedReason).toBeUndefined(); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(lifecycleActions)('preserves plain HTTP500 invalid-shape/unknown handling for %s', async action => {
    const error = await errorFrom(createCreatorOperationsProvider({ fetch: fixture(json({ error: 'PRIVATE' }, { status: 500 })) }).run(input(action)), 'invalid-shape', 'unknown')
    expect(error.backendCode).toBeUndefined(); expect(error.reportedReason).toBeUndefined()
  })
  it.each(['stop', 'restart'] as const)('extracts only a local unsaved-content hint from %s plain HTTP500 and keeps its outcome unknown', async action => {
    for (const message of ['Creator 有未保存的 Scene 或 Prefab，已取消停止', 'PRIVATE token=PRIVATE 未保存 PRIVATE']) {
      const fetch = fixture(json({ error: message }, { status: 500 })), provider = createCreatorOperationsProvider({ fetch })
      const error = await errorFrom(provider.run(input(action)), 'backend-failure', 'unknown')
      expect(error.reportedReason).toBe('unsaved-content'); expect(error.backendCode).toBeUndefined()
      expect(error.message).not.toContain(message); expect(error).not.toHaveProperty('details'); expect(fetch).toHaveBeenCalledOnce()
      await provider.waitForIdle()
    }
  })
  it.each(['start', 'focus'] as const)('does not reuse an unsaved-content hint for %s', async action => {
    const error = await errorFrom(createCreatorOperationsProvider({ fetch: fixture(json({ error: 'PRIVATE 未保存' }, { status: 500 })) }).run(input(action)), 'invalid-shape', 'unknown')
    expect(error.backendCode).toBeUndefined(); expect(error.reportedReason).toBeUndefined()
  })
  it.each([
    [500, { error: 'PRIVATE' }], [500, { error: 'PRIVATE 未保存', code: 'UNSAVED_CONTENT' }], [500, { error: 'PRIVATE 未保存', details: {} }],
    [500, { error: 'PRIVATE 未保存', retryable: false }], [500, { error: ['PRIVATE 未保存'] }], [500, { message: 'PRIVATE 未保存' }],
    [500, ['PRIVATE 未保存']], [500, 'PRIVATE 未保存'], [500, null], [409, { error: 'PRIVATE 未保存' }], [403, { error: 'PRIVATE 未保存' }],
    [400, { error: 'PRIVATE 未保存' }], [501, { error: 'PRIVATE 未保存' }], [200, { error: 'PRIVATE 未保存' }],
  ] as const)('does not invent unsaved safety or retain diagnostics from malformed/non-contract envelopes %#', async (status, body) => {
    for (const action of ['stop', 'restart'] as const) {
      const error = await errorFrom(createCreatorOperationsProvider({ fetch: fixture(json(body, { status })) }).run(input(action)), 'invalid-shape', 'unknown')
      expect(error.backendCode).toBeUndefined(); expect(error.reportedReason).toBeUndefined()
    }
  })
  it.each([
    [403, { error: 'Forbidden', extra: 'PRIVATE' }], [401, { error: 'Forbidden' }], [404, {}], [409, null],
    [409, { error: 'PRIVATE', code: 'PRIVATE_UNKNOWN', retryable: false }], [409, { error: 'PRIVATE', code: 'DASHBOARD_UNSUPPORTED_PLATFORM', retryable: false }],
    [501, { error: 'PRIVATE', code: 'DASHBOARD_NOT_FOUND', retryable: false }], [409, { code: 'DASHBOARD_NOT_FOUND', retryable: false }],
    [409, { error: 'PRIVATE', code: 'DASHBOARD_NOT_FOUND', retryable: true }], [409, { error: 'PRIVATE', code: 'DASHBOARD_NOT_FOUND', retryable: false, details: [] }],
    [409, { error: 'PRIVATE', code: 'DASHBOARD_NOT_FOUND', retryable: false, token: 'PRIVATE' }],
  ] as const)('does not infer rejection or retain unverified backend codes %#', async (status, body) => {
    for (const action of actions) {
      const error = await errorFrom(createCreatorOperationsProvider({ fetch: fixture(json(body, { status })) }).run(input(action)), 'invalid-shape', 'unknown')
      expect(error.backendCode).toBeUndefined(); expect(error.reportedReason).toBeUndefined()
    }
  })
  it.each([201, 202, 206])('accepts only HTTP200, not %s', async status => {
    for (const action of actions) await errorFrom(createCreatorOperationsProvider({ fetch: fixture(json(success(action), { status })) }).run(input(action)), 'invalid-shape', 'unknown')
  })
  it('does not accept an error envelope at HTTP200', async () => {
    await errorFrom(createCreatorOperationsProvider({ fetch: fixture({ error: 'PRIVATE', code: 'DASHBOARD_NOT_FOUND', retryable: false }) }).run(input()), 'invalid-shape', 'unknown')
  })
  it.each(['redirected', 'opaque', 'opaqueredirect', 'html', 'missing-body', 'malformed'])('rejects %s and never follows or retries', async mode => {
    let response = json(runtime())
    if (mode === 'redirected') Object.defineProperty(response, 'redirected', { value: true })
    if (mode === 'opaque' || mode === 'opaqueredirect') Object.defineProperty(response, 'type', { value: mode })
    if (mode === 'html') response = new Response('PRIVATE', { headers: { 'Content-Type': 'text/html' } })
    if (mode === 'missing-body') response = new Response(null, { headers: { 'Content-Type': 'application/json' } })
    if (mode === 'malformed') response = new Response('PRIVATE', { headers: { 'Content-Type': 'application/json' } })
    const fetch = fixture(response)
    await errorFrom(createCreatorOperationsProvider({ fetch }).run(input()), 'invalid-shape', 'unknown'); expect(fetch).toHaveBeenCalledOnce()
  })
})

describe('bounded bytes/chunks, cancellation and actual settlement', () => {
  it.each(['announced', 'actual'])('cancels %s response exceeding 128 KiB for every action', async mode => {
    for (const action of actions) {
      const cancel = vi.fn(), response = new Response(new ReadableStream({ start(controller) { if (mode === 'actual') controller.enqueue(new Uint8Array(CREATOR_OPERATION_LIMITS.maxResponseBytes + 1)) }, cancel }),
        { headers: { 'Content-Type': 'application/json', 'Content-Length': mode === 'announced' ? String(CREATOR_OPERATION_LIMITS.maxResponseBytes + 1) : '2' } })
      await errorFrom(createCreatorOperationsProvider({ fetch: fixture(response) }).run(input(action)), 'response-too-large', 'unknown')
      expect(cancel).toHaveBeenCalledOnce()
    }
  })
  it('accepts the exact byte budget including ignored fields', async () => {
    const raw = { ...runtime(), ignored: '' }, used = new TextEncoder().encode(JSON.stringify(raw)).length
    raw.ignored = 'a'.repeat(CREATOR_OPERATION_LIMITS.maxResponseBytes - used)
    expect(await createCreatorOperationsProvider({ fetch: fixture(raw) }).run(input())).toEqual({ action: 'start', runtime: runtime() })
  })
  it.each(actions)('accepts the exact 128 KiB budget for %s without weakening its reply shape', async action => {
    const body = JSON.stringify(success(action)), used = new TextEncoder().encode(body).length
    const response = new Response(body + ' '.repeat(CREATOR_OPERATION_LIMITS.maxResponseBytes - used), { headers: { 'Content-Type': 'application/json' } })
    expect(await createCreatorOperationsProvider({ fetch: fixture(response) }).run(input(action))).toEqual(expectedSuccess(action))
  })
  it.each(actions)('counts even empty chunks and cancels beyond 512 for %s', async action => {
    const cancel = vi.fn(), response = new Response(new ReadableStream({ start(controller) { for (let n = 0; n <= CREATOR_OPERATION_LIMITS.maxResponseChunks; n++) controller.enqueue(new Uint8Array()) }, cancel }), { headers: { 'Content-Type': 'application/json' } })
    await errorFrom(createCreatorOperationsProvider({ fetch: fixture(response) }).run(input(action)), 'response-too-large', 'unknown'); expect(cancel).toHaveBeenCalledOnce()
  })
  it.each(actions)('accepts exactly 512 chunks including empty chunks for %s', async action => {
    const response = new Response(new ReadableStream({ start(controller) {
      for (let n = 1; n < CREATOR_OPERATION_LIMITS.maxResponseChunks; n++) controller.enqueue(new Uint8Array())
      controller.enqueue(new TextEncoder().encode(JSON.stringify(success(action)))); controller.close()
    } }), { headers: { 'Content-Type': 'application/json' } })
    expect(await createCreatorOperationsProvider({ fetch: fixture(response) }).run(input(action))).toEqual(expectedSuccess(action))
  })
  it.each([[0xc3, 0x28], [0xed, 0xa0, 0x80], [0xc3]])('rejects invalid UTF-8 bytes %s', async (...bytes) => {
    const response = new Response(new Uint8Array(bytes), { headers: { 'Content-Type': 'application/json' } })
    await errorFrom(createCreatorOperationsProvider({ fetch: fixture(response) }).run(input()), 'invalid-shape', 'unknown')
  })
  it('accepts multibyte UTF-8 split across chunks', async () => {
    const raw = { ...runtime(), dashboardProgress: '正在启动' }, bytes = new TextEncoder().encode(JSON.stringify(raw))
    const response = new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close() } }), { headers: { 'Content-Type': 'application/json' } })
    expect(await createCreatorOperationsProvider({ fetch: fixture(response) }).run(input())).toEqual({ action: 'start', runtime: raw })
  })
  it.each(actions)('does not dispatch pre-aborted or synchronously cancelled %s operations', async action => {
    const fetch = fixture(success(action)), provider = createCreatorOperationsProvider({ fetch }), first = new AbortController(), second = new AbortController()
    first.abort(); await errorFrom(provider.run(input(action), first.signal), 'aborted', 'not-dispatched')
    const pending = provider.run(input(action), second.signal); second.abort(); await errorFrom(pending, 'aborted', 'not-dispatched')
    expect(fetch).not.toHaveBeenCalled(); await provider.waitForIdle()
  })
  it.each(actions)('prevents double click and cross-project/action concurrency while %s is active', async action => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<CreatorOperationFetch>(() => new Promise(resolve => { finish = resolve })), provider = createCreatorOperationsProvider({ fetch }), pending = provider.run(input(action))
    for (const blocked of actions) {
      await errorFrom(provider.run(input(blocked)), 'busy', 'not-dispatched')
      await errorFrom(provider.run({ projectId: 'fedcba9876543210', action: blocked }), 'busy', 'not-dispatched')
    }
    finish(json(success(action))); expect(await pending).toEqual(expectedSuccess(action)); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(actions)('releases an abort-aware %s transport only after its rejection settles', async action => {
    const fetch = vi.fn<CreatorOperationFetch>().mockImplementationOnce((_path, init) => new Promise((_resolve, rejectPending) => {
      init.signal!.addEventListener('abort', () => { queueMicrotask(() => rejectPending(Error('PRIVATE abort'))) }, { once: true })
    })).mockImplementation(async () => json(success(action)))
    const provider = createCreatorOperationsProvider({ fetch }), controller = new AbortController()
    const pending = errorFrom(provider.run(input(action), controller.signal), 'aborted', 'unknown')
    await flush(); controller.abort(); await pending; await provider.waitForIdle()
    expect(await provider.run(input(action))).toEqual(expectedSuccess(action)); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each(actions)('retains the %s lease through ignored-abort fetch and its late body cancellation', async action => {
    let finish!: (response: Response) => void, finishCancel!: () => void
    const fetch = vi.fn<CreatorOperationFetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockImplementation(async () => json(success(action)))
    const provider = createCreatorOperationsProvider({ fetch }), controller = new AbortController()
    const pending = errorFrom(provider.run(input(action), controller.signal), 'aborted', 'unknown'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await flush(); controller.abort(); await pending
    expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.run(input('focus')), 'busy', 'not-dispatched')
    const cancel = vi.fn(() => new Promise<void>(resolve => { finishCancel = resolve }))
    finish(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } })); await flush()
    expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.run(input()), 'busy', 'not-dispatched')
    finishCancel(); await flush(); expect(idle).toHaveBeenCalledOnce(); await provider.waitForIdle()
    expect(await provider.run(input(action))).toEqual(expectedSuccess(action)); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each(actions)('bounds %s default waiting at 120 seconds without unlocking an unsettled transport or retrying', async action => {
    vi.useFakeTimers()
    const fetch = vi.fn<CreatorOperationFetch>(() => new Promise(() => undefined)), provider = createCreatorOperationsProvider({ fetch }), idle = vi.fn()
    const pending = errorFrom(provider.run(input(action)), 'timeout', 'unknown'); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(119_999); expect(idle).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1); await pending
    expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(true); expect(idle).not.toHaveBeenCalled()
    await errorFrom(provider.run(input()), 'busy', 'not-dispatched'); await vi.advanceTimersByTimeAsync(240_000); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(actions)('retains a stalled %s body until reader cancellation actually settles', async action => {
    vi.useFakeTimers(); let finish!: () => void
    const cancel = vi.fn(() => new Promise<void>(resolve => { finish = resolve })), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } })
    const fetch = vi.fn<CreatorOperationFetch>().mockResolvedValueOnce(response).mockImplementation(async () => json(success(action))), provider = createCreatorOperationsProvider({ fetch, timeoutMs: 20 })
    const pending = errorFrom(provider.run(input(action)), 'timeout', 'unknown'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(20); await pending
    expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.run(input()), 'busy', 'not-dispatched')
    finish(); await flush(); expect(idle).toHaveBeenCalledOnce(); expect(await provider.run(input(action))).toEqual(expectedSuccess(action))
  })
  it('does not unlock when reader cancellation settles but an abort-unaware read remains pending', async () => {
    vi.useFakeTimers(); let finishRead!: (value: ReadableStreamReadResult<Uint8Array>) => void
    const read = vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(resolve => { finishRead = resolve })), cancel = vi.fn(async () => undefined), releaseLock = vi.fn()
    const response = json(runtime()); Object.defineProperty(response, 'body', { value: { getReader: () => ({ read, cancel, releaseLock }) } })
    const fetch = vi.fn<CreatorOperationFetch>().mockResolvedValueOnce(response).mockImplementation(async () => json(runtime())), provider = createCreatorOperationsProvider({ fetch, timeoutMs: 20 })
    const pending = errorFrom(provider.run(input()), 'timeout', 'unknown'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(20); await pending
    expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.run(input()), 'busy', 'not-dispatched')
    finishRead({ done: true, value: undefined }); await flush(); expect(idle).toHaveBeenCalledOnce(); expect(await provider.run(input())).toEqual({ action: 'start', runtime: runtime() })
  })
  it('retains rejected-response discard cancellation until actual settlement', async () => {
    let finish!: () => void
    const cancel = vi.fn(() => new Promise<void>(resolve => { finish = resolve })), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'text/html' } })
    const provider = createCreatorOperationsProvider({ fetch: fixture(response) }), pending = errorFrom(provider.run(input()), 'invalid-shape', 'unknown'), idle = vi.fn()
    void provider.waitForIdle().then(idle); await pending
    expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.run(input()), 'busy', 'not-dispatched')
    finish(); await flush(); expect(idle).toHaveBeenCalledOnce()
  })
  it('does not let an old cancellation release or abort a newer request', async () => {
    let finish!: (response: Response) => void
    const first = new AbortController(), second = new AbortController(), fetch = vi.fn<CreatorOperationFetch>().mockResolvedValueOnce(json(runtime())).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const provider = createCreatorOperationsProvider({ fetch }); await provider.run(input(), first.signal); await provider.waitForIdle()
    const pending = provider.run(input('focus'), second.signal); await flush(); first.abort(); await flush()
    expect(fetch.mock.calls[1]![1].signal!.aborted).toBe(false); await errorFrom(provider.run(input()), 'busy', 'not-dispatched')
    finish(json({ ok: true })); expect(await pending).toEqual({ action: 'focus', acknowledged: true }); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('releases settled failures and only sends again for a new explicit request', async () => {
    const fetch = vi.fn<CreatorOperationFetch>().mockRejectedValueOnce(Error('PRIVATE')).mockImplementation(async () => json(runtime())), provider = createCreatorOperationsProvider({ fetch })
    await errorFrom(provider.run(input()), 'network-error', 'unknown'); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledOnce()
    expect(await provider.run(input())).toEqual({ action: 'start', runtime: runtime() }); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each(['throw', 'reject'])('sanitizes transport %s even when it claims rejection', async mode => {
    const claimed = new CreatorOperationError('forbidden', 'rejected', 'PRIVATE'); claimed.message = 'PRIVATE'
    const fetch = vi.fn<CreatorOperationFetch>(() => { if (mode === 'throw') throw claimed; return Promise.reject(claimed) })
    const provider = createCreatorOperationsProvider({ fetch }); await errorFrom(provider.run(input()), 'network-error', 'unknown'); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledOnce()
  })
  it('does not trust an injected response property claiming a safe rejection', async () => {
    const claimed = new CreatorOperationError('forbidden', 'rejected', 'PRIVATE'); claimed.message = 'PRIVATE'
    const response = json(runtime()); Object.defineProperty(response, 'redirected', { get() { throw claimed } })
    const provider = createCreatorOperationsProvider({ fetch: fixture(response) })
    await errorFrom(provider.run(input()), 'network-error', 'unknown'); await provider.waitForIdle()
  })
  it('sanitizes reader errors instead of trusting claimed rejection or diagnostics', async () => {
    const claimed = new CreatorOperationError('forbidden', 'rejected', 'PRIVATE'); claimed.message = 'PRIVATE'
    const cancel = vi.fn(async () => undefined), response = json(runtime())
    Object.defineProperty(response, 'body', { value: { getReader: () => ({ read: () => Promise.reject(claimed), cancel, releaseLock: vi.fn() }) } })
    const provider = createCreatorOperationsProvider({ fetch: fixture(response) }); await errorFrom(provider.run(input()), 'invalid-shape', 'unknown'); await provider.waitForIdle(); expect(cancel).toHaveBeenCalledOnce()
  })
})
