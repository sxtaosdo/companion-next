import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProjectSetupProvider, PROJECT_SETUP_LIMITS, ProjectSetupError } from '../src/adapters/project-setup'
import type { ProjectSetupFetch } from '../src/adapters/project-setup'
import { SETUP_STAGES } from '../src/domain/project-setup'
import type { ProjectSetupErrorCode, ProjectSetupProvider } from '../src/domain/project-setup'
import { RUNTIME_STATES } from '../src/domain/companion-browser'

const projectId = '0123456789abcdef', otherProjectId = 'fedcba9876543210'
const operationId = '01234567-89ab-4cde-8f01-23456789abcd', otherOperationId = 'fedcba98-7654-4321-9012-3456789abcde'
const projectPath = 'C:\\Projects\\演示工程', targetPath = `${projectPath}\\extensions\\creator-ai-bridge`
const timestamp = '2026-10-15T04:00:00.000Z'
const methods = ['register', 'start', 'status'] as const
type Method = typeof methods[number]
const statuses = { register: 201, start: 202, status: 200 }
const project = () => ({ id: projectId, name: '演示工程', path: projectPath, requiredCreatorVersion: '3.8.8' })
const snapshot = () => ({ id: operationId, projectPath, projectId, projectName: '演示工程', stage: 'complete', startedAt: timestamp, updatedAt: timestamp,
  bridge: { status: 'current', version: '1.4.8', targetPath }, runtime: { projectId, state: 'ready', creatorVersion: '3.8.8' }, mcpName: 'creator-ai' })
const success = (method: Method) => method === 'register' ? project() : method === 'start' ? { operationId } : snapshot()
const input = (method: Method) => method === 'register' ? projectPath : method === 'start' ? projectId : operationId
const path = (method: Method) => method === 'register' ? '/api/projects' : method === 'start' ? '/api/setup' : `/api/setup/${operationId}`
const run = (provider: ProjectSetupProvider, method: Method, signal?: AbortSignal) => provider[method](input(method), signal)
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } })
const fixture = (method: Method, value: unknown = success(method)) => vi.fn<ProjectSetupFetch>(async () => value instanceof Response ? value : json(value, { status: statuses[method] }))
const flush = async () => { for (let n = 0; n < 20; n++) await Promise.resolve() }
async function errorFrom(pending: Promise<unknown>, code: ProjectSetupErrorCode, outcome: ProjectSetupError['outcome'] = 'unknown') {
  const error = await pending.then(() => { throw Error('Expected failure') }, (error: unknown) => error)
  expect(error).toBeInstanceOf(ProjectSetupError)
  expect(error).toMatchObject({ code, outcome })
  expect(`${error}${JSON.stringify(error)}`).not.toContain('PRIVATE')
  expect(error).not.toHaveProperty('cause'); expect(error).not.toHaveProperty('details')
  return error as ProjectSetupError
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('passive v148 project setup source contract, fake transports only', () => {
  it.each(methods)('sends only the exact fixed same-origin %s method, path and fields', async method => {
    const ambient = vi.fn(() => { throw Error('Unexpected ambient fetch') }); vi.stubGlobal('fetch', ambient)
    const fetch = fixture(method), provider = createProjectSetupProvider({ fetch })
    expect(Object.isFrozen(provider)).toBe(true)
    expect(Object.keys(provider).sort()).toEqual(['label', 'pickDirectory', 'register', 'scaffold', 'start', 'status', 'waitForIdle'])
    expect(provider.label).toContain('v148'); expect(provider.label).toContain('实机未验')
    await provider.waitForIdle(); expect(fetch).not.toHaveBeenCalled()
    expect(await run(provider, method)).toEqual(success(method)); expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe(path(method))
    expect(init).toMatchObject({ method: method === 'status' ? 'GET' : 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    if (method === 'status') {
      expect(Object.keys(init).sort()).toEqual(['cache', 'credentials', 'headers', 'method', 'mode', 'redirect', 'signal'])
      expect(init).not.toHaveProperty('body'); expect(init.headers).toEqual({ Accept: 'application/json' })
    } else {
      expect(Object.keys(init).sort()).toEqual(['body', 'cache', 'credentials', 'headers', 'method', 'mode', 'redirect', 'signal'])
      expect(init.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json' })
      expect(init.body).toBe(JSON.stringify(method === 'register' ? { path: projectPath } : { projectId, startCreator: true, configureCodex: true }))
    }
    expect(new Headers(init.headers).get('authorization')).toBeNull(); expect(new Headers(init.headers).get('cookie')).toBeNull()
    await provider.waitForIdle(); await flush(); expect(fetch).toHaveBeenCalledOnce(); expect(ambient).not.toHaveBeenCalled()
  })
  it('requires injected transport and cannot widen the 120-second wait', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(() => createProjectSetupProvider(undefined as never)).toThrow(TypeError)
    expect(() => createProjectSetupProvider({} as never)).toThrow(TypeError)
    for (const timeoutMs of [0, -1, NaN, Infinity, 120_001]) expect(() => createProjectSetupProvider({ fetch: fixture('start'), timeoutMs })).toThrow(RangeError)
    createProjectSetupProvider({ fetch: fixture('start'), timeoutMs: 120_000 })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not accept constructor overrides for URLs, bearer tokens, proxying or setup options', async () => {
    const fetch = fixture('start'), provider = createProjectSetupProvider({ fetch, url: 'https://PRIVATE', baseUrl: '//PRIVATE', token: 'PRIVATE', proxy: 'PRIVATE',
      headers: { Authorization: 'Bearer PRIVATE' }, startCreator: false, configureCodex: false, codexPath: '/PRIVATE' } as never)
    await provider.start(projectId)
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('/api/setup'); expect(init.body).toBe(JSON.stringify({ projectId, startCreator: true, configureCodex: true }))
    expect(JSON.stringify(init)).not.toContain('PRIVATE'); expect(init).not.toHaveProperty('startCreator')
  })
  it('treats registration canonicalization as a returned target and projects only the public project fields', async () => {
    const raw = { ...project(), path: 'D:\\Canonical\\演示工程', connectionPath: '/PRIVATE', creatorExecutable: '/PRIVATE', token: 'PRIVATE', details: { sessionId: 'PRIVATE' }, error: 'PRIVATE',
      ...JSON.parse('{"__proto__":{"PRIVATE":true}}') }
    const fetch = fixture('register', raw), provider = createProjectSetupProvider({ fetch })
    expect(await provider.register(projectPath)).toEqual({ ...project(), path: raw.path })
    expect(fetch.mock.calls[0]![1].body).toBe(JSON.stringify({ path: projectPath })); expect(Object.prototype).not.toHaveProperty('PRIVATE')
  })
  it.each([
    projectPath, 'C:/Projects/My Game', 'd:\\', '\\\\server\\share\\演示工程', '\\\\server.example.test\\shared projects', '/home/user/Projects/My Game', '/', `/projects/${'工'.repeat(4086)}`,
  ])('preserves valid absolute input and response paths exactly: %#', async path => {
    const fetch = fixture('register', { ...project(), path }), provider = createProjectSetupProvider({ fetch })
    expect(await provider.register(path)).toEqual({ ...project(), path }); expect(fetch.mock.calls[0]![1].body).toBe(JSON.stringify({ path }))
    expect((await createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), projectPath: path, bridge: { ...snapshot().bridge, targetPath: path } }) }).status(operationId)).projectPath).toBe(path)
  })
  const badPaths: unknown[] = [null, 1, {}, [], '', ' ', 'Projects/Game', '../PRIVATE', 'C:relative', '\\relative', '\\\\server', '\\\\server\\', '//example.invalid/PRIVATE',
    'https://example.invalid/PRIVATE', 'file:///PRIVATE', 'data:text/plain,PRIVATE', '\\\\?\\C:\\PRIVATE', '\\\\.\\PRIVATE', 'C://PRIVATE', 'C:\\PRIVATE?force=true',
    ' /projects/game', '/projects/game ', '/PRIVATE\u0000x', '/PRIVATE\tvalue', '/PRIVATE\nvalue', '/PRIVATE\rvalue', '/PRIVATE\u007fvalue', '/PRIVATE\u0085value',
    '/PRIVATE\u2028value', '/PRIVATE\u2029value', '/PRIVATE\u202evalue', '/PRIVATE\u2066value', `/projects/${'工'.repeat(4087)}`,
    '/projects/token=PRIVATE', 'C:\\Projects\\password=PRIVATE', '/projects/Bearer PRIVATE', '/projects/Cookie: PRIVATE',
    '/projects/https://user:PRIVATE@example.invalid', '/projects/data:image/png;base64,PRIVATE', `/projects/${'A'.repeat(160)}`]
  it.each(badPaths)('rejects unsafe or malformed registration input path before fetch: %#', async path => {
    const fetch = fixture('register'), provider = createProjectSetupProvider({ fetch })
    await errorFrom(provider.register(path as string), 'invalid-input', 'not-dispatched')
    expect(fetch).not.toHaveBeenCalled(); await provider.waitForIdle()
  })
  it.each(badPaths)('rejects unsafe or malformed projected project/setup/Bridge path: %#', async path => {
    await errorFrom(createProjectSetupProvider({ fetch: fixture('register', { ...project(), path }) }).register(projectPath), 'invalid-shape')
    await errorFrom(createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), projectPath: path }) }).status(operationId), 'invalid-shape')
    await errorFrom(createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), bridge: { ...snapshot().bridge, targetPath: path } }) }).status(operationId), 'invalid-shape')
  })
  const badProjectIds: unknown[] = ['', '../PRIVATE', 'https://example.invalid', '0123456789ABCDEf', '0123456789abcde', '0123456789abcdef0', '%30'.repeat(16), `${projectId}\n`, ` ${projectId}`, null, 1, {}, []]
  it.each(badProjectIds)('rejects non-contract project IDs before dispatch and when returned: %#', async id => {
    const fetch = fixture('start'), provider = createProjectSetupProvider({ fetch })
    await errorFrom(provider.start(id as string), 'invalid-input', 'not-dispatched'); expect(fetch).not.toHaveBeenCalled()
    await errorFrom(createProjectSetupProvider({ fetch: fixture('register', { ...project(), id }) }).register(projectPath), 'invalid-shape')
    await errorFrom(createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), projectId: id }) }).status(operationId), 'invalid-shape')
    await errorFrom(createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), runtime: { projectId: id, state: 'ready' } }) }).status(operationId), 'invalid-shape')
  })
  const badOperationIds: unknown[] = ['', '../PRIVATE', 'https://example.invalid', operationId.toUpperCase(), operationId.replace('-4cde-', '-1cde-'), operationId.replace('-8f01-', '-7f01-'),
    operationId.replaceAll('-', ''), `${operationId}/../cancel`, `${operationId}?cancel=true`, `${operationId}#PRIVATE`, `${operationId}\n`, ` ${operationId}`, null, 1, {}, []]
  it.each(badOperationIds)('rejects non-UUIDv4 setup IDs before dispatch and in replies: %#', async id => {
    const fetch = fixture('status'), provider = createProjectSetupProvider({ fetch })
    await errorFrom(provider.status(id as string), 'invalid-input', 'not-dispatched'); expect(fetch).not.toHaveBeenCalled()
    await errorFrom(createProjectSetupProvider({ fetch: fixture('start', { operationId: id }) }).start(projectId), 'invalid-shape')
    await errorFrom(createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), id }) }).status(operationId), 'invalid-shape')
  })
  it.each(methods)('rejects object/boxed/accessor inputs for %s without evaluating them', async method => {
    const getter = vi.fn(() => { throw Error('PRIVATE') }), value = Object.defineProperty({}, 'path', { get: getter })
    const fetch = fixture(method), provider = createProjectSetupProvider({ fetch })
    for (const bad of [value, new String(input(method)), { projectId, projectPath, operationId, startCreator: false, codexPath: '/PRIVATE' }, new Proxy({}, { get: getter })]) {
      await errorFrom(provider[method](bad as string), 'invalid-input', 'not-dispatched')
    }
    expect(getter).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it.each([null, [], {}, { id: projectId }, { name: 'project', path: projectPath }, { ...project(), name: null }, { ...project(), name: '' }, { ...project(), name: 'x'.repeat(257) },
    { ...project(), name: 'x\u0000y' }, { ...project(), requiredCreatorVersion: null }, { ...project(), requiredCreatorVersion: '' }, { ...project(), requiredCreatorVersion: 'x'.repeat(65) }])('rejects malformed registration reply %#', async raw => {
    await errorFrom(createProjectSetupProvider({ fetch: fixture('register', raw) }).register(projectPath), 'invalid-shape')
  })
  it.each([null, [], {}, { id: operationId }, { operationId, status: 'complete' }, { operationId, projectPath }, { operationId, token: 'PRIVATE' },
    { operationId, ...JSON.parse('{"__proto__":{"PRIVATE":true}}') }])('accepts only exact setup-start {operationId}, rejecting %#', async raw => {
    await errorFrom(createProjectSetupProvider({ fetch: fixture('start', raw) }).start(projectId), 'invalid-shape')
  })
  it.each(SETUP_STAGES)('preserves source stage %s without inventing completed option guarantees', async stage => {
    const raw = { id: operationId, projectPath, stage, startedAt: timestamp, updatedAt: timestamp }
    const fetch = fixture('status', raw), result = await createProjectSetupProvider({ fetch }).status(operationId)
    expect(result).toEqual(raw); expect(result).not.toHaveProperty('startCreator'); expect(result).not.toHaveProperty('configureCodex')
    expect(result).not.toHaveProperty('bridge'); expect(result).not.toHaveProperty('runtime'); expect(result).not.toHaveProperty('mcpName')
    expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0]![1].method).toBe('GET')
  })
  it.each(RUNTIME_STATES)('projects only the actual runtime %s state and limited safe fields', async state => {
    const raw = { ...snapshot(), runtime: { projectId, state, creatorVersion: '3.8.8', pid: 12, sessionId: 'PRIVATE', instanceId: 'PRIVATE', token: 'PRIVATE',
      capabilityProfile: 'full-control', launchSource: 'dashboard', lastError: 'PRIVATE', details: { PRIVATE: true } } }
    expect(await createProjectSetupProvider({ fetch: fixture('status', raw) }).status(operationId)).toEqual({ ...snapshot(), runtime: { projectId, state, creatorVersion: '3.8.8' } })
  })
  it.each(['installed', 'updated', 'current'])('preserves the source Bridge %s result and drops unrecognized fields', async status => {
    const raw = { ...snapshot(), bridge: { status, version: '1.4.8', targetPath, token: 'PRIVATE', details: 'PRIVATE' } }
    expect((await createProjectSetupProvider({ fetch: fixture('status', raw) }).status(operationId)).bridge).toEqual({ status, version: '1.4.8', targetPath })
  })
  it('projects failure presence and safe allowlisted codes without raw errors, credentials or host internals', async () => {
    const raw = { ...snapshot(), stage: 'failed', error: 'PRIVATE token=PRIVATE', errorCode: 'DASHBOARD_OPEN_WITHOUT_BRIDGE', details: { PRIVATE: true }, token: 'PRIVATE', sessionId: 'PRIVATE', pid: 55,
      connectionPath: '/PRIVATE', creatorExecutable: '/PRIVATE', nextUrl: 'https://PRIVATE', startCreator: true, configureCodex: true, failureReported: false,
      ...JSON.parse('{"__proto__":{"PRIVATE":true}}') }
    const result = await createProjectSetupProvider({ fetch: fixture('status', raw) }).status(operationId)
    expect(result).toEqual({ ...snapshot(), stage: 'failed', failureReported: true, errorCode: 'DASHBOARD_OPEN_WITHOUT_BRIDGE' })
    expect(JSON.stringify(result)).not.toContain('PRIVATE'); expect(Object.prototype).not.toHaveProperty('PRIVATE')
  })
  it.each(['DASHBOARD_NOT_FOUND', 'DASHBOARD_AUTOMATION_DENIED', 'DASHBOARD_WINDOW_NOT_ACCESSIBLE', 'DASHBOARD_PROJECT_NOT_FOUND',
    'DASHBOARD_PROJECT_AMBIGUOUS', 'DASHBOARD_IMPORT_FAILED', 'DASHBOARD_VERSION_MISMATCH', 'DASHBOARD_LAUNCH_TIMEOUT',
    'DASHBOARD_OPEN_WITHOUT_BRIDGE', 'DASHBOARD_UNSUPPORTED_PLATFORM'])('allows only a known Dashboard error code: %s', async errorCode => {
    expect((await createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), stage: 'failed', error: 'PRIVATE', errorCode }) }).status(operationId)).errorCode).toBe(errorCode)
  })
  it('drops unknown error codes and never trusts an injected failureReported field', async () => {
    expect(await createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), failureReported: true, errorCode: 'PRIVATE_NEW_CODE' }) }).status(operationId)).toEqual(snapshot())
    expect((await createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), error: '' }) }).status(operationId)).failureReported).toBe(true)
  })
  it('redacts credentials in display fields instead of copying them', async () => {
    const name = 'token=PRIVATE; Bearer PRIVATE; Cookie: PRIVATE', safe = 'token=[redacted]; Bearer [redacted]; cookie: [redacted]'
    const result = await createProjectSetupProvider({ fetch: fixture('register', { ...project(), name, requiredCreatorVersion: 'secret=PRIVATE' }) }).register(projectPath)
    expect(result).toEqual({ ...project(), name: safe, requiredCreatorVersion: 'secret=[redacted]' })
    const status = await createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), projectName: name, mcpName: name, bridge: { ...snapshot().bridge, version: 'token=PRIVATE' }, runtime: { projectId, state: 'ready', creatorVersion: 'token=PRIVATE' } }) }).status(operationId)
    expect(status.projectName).toBe(safe); expect(status.mcpName).toBe(safe); expect(JSON.stringify(status)).not.toContain('PRIVATE')
  })
  it.each(['id', 'projectPath', 'stage', 'startedAt', 'updatedAt'])('requires own setup field %s', async key => {
    const raw: Record<string, unknown> = snapshot(); delete raw[key]
    await errorFrom(createProjectSetupProvider({ fetch: fixture('status', raw) }).status(operationId), 'invalid-shape')
  })
  it.each([
    null, [], {}, { ...snapshot(), id: otherOperationId }, { ...snapshot(), stage: null }, { ...snapshot(), stage: 'ready' }, { ...snapshot(), stage: 'COMPLETE' },
    { ...snapshot(), projectName: null }, { ...snapshot(), projectName: '' }, { ...snapshot(), projectName: 'x'.repeat(257) },
    { ...snapshot(), bridge: null }, { ...snapshot(), bridge: [] }, { ...snapshot(), bridge: {} }, { ...snapshot(), bridge: { status: 'current', version: '1' } },
    { ...snapshot(), bridge: { ...snapshot().bridge, status: 'ready' } }, { ...snapshot(), bridge: { ...snapshot().bridge, version: null } },
    { ...snapshot(), bridge: { ...snapshot().bridge, version: '' } }, { ...snapshot(), bridge: { ...snapshot().bridge, version: 'x'.repeat(65) } },
    { ...snapshot(), runtime: null }, { ...snapshot(), runtime: [] }, { ...snapshot(), runtime: {} }, { ...snapshot(), runtime: { projectId } },
    { ...snapshot(), runtime: { projectId, state: 'unknown' } }, { ...snapshot(), runtime: { projectId: otherProjectId, state: 'ready' } },
    { ...snapshot(), runtime: { projectId, state: 'ready', creatorVersion: null } }, { ...snapshot(), runtime: { projectId, state: 'ready', creatorVersion: 'x'.repeat(65) } },
    { ...snapshot(), mcpName: null }, { ...snapshot(), mcpName: '' }, { ...snapshot(), mcpName: 'x'.repeat(257) }, { ...snapshot(), mcpName: 'x\u0000y' },
    { ...snapshot(), error: null }, { ...snapshot(), error: {} }, { ...snapshot(), errorCode: 12 },
  ])('rejects malformed setup snapshot %#', async raw => {
    await errorFrom(createProjectSetupProvider({ fetch: fixture('status', raw) }).status(operationId), 'invalid-shape')
  })
  it.each([null, 0, '', 'now', '2026-10-15', '2026-10-15T04:00:00Z', '2026-10-15T04:00:00.000+00:00', '2026-02-30T04:00:00.000Z',
    '2026-13-15T04:00:00.000Z', '2026-10-15T25:00:00.000Z', `${timestamp}\n`, 'PRIVATE'])('rejects non-source or invalid date %#', async date => {
    for (const field of ['startedAt', 'updatedAt']) await errorFrom(createProjectSetupProvider({ fetch: fixture('status', { ...snapshot(), [field]: date }) }).status(operationId), 'invalid-shape')
  })
  it('requires own required fields and ignores inherited optional fields', async () => {
    const inherited = { id: projectId, name: 'PRIVATE', path: projectPath, requiredCreatorVersion: 'PRIVATE', operationId, projectId, projectName: 'PRIVATE',
      projectPath, stage: 'complete', startedAt: timestamp, updatedAt: timestamp, bridge: {}, runtime: {}, mcpName: 'PRIVATE', error: 'PRIVATE', errorCode: 'DASHBOARD_NOT_FOUND' }
    for (const [key, value] of Object.entries(inherited)) Object.defineProperty(Object.prototype, key, { value, configurable: true, writable: true })
    try {
      await errorFrom(createProjectSetupProvider({ fetch: fixture('register', {}) }).register(projectPath), 'invalid-shape')
      await errorFrom(createProjectSetupProvider({ fetch: fixture('start', {}) }).start(projectId), 'invalid-shape')
      await errorFrom(createProjectSetupProvider({ fetch: fixture('status', {}) }).status(operationId), 'invalid-shape')
      expect(await createProjectSetupProvider({ fetch: fixture('register', { id: projectId, name: 'project', path: projectPath }) }).register(projectPath)).toEqual({ id: projectId, name: 'project', path: projectPath })
      const minimal = { id: operationId, projectPath, stage: 'registering', startedAt: timestamp, updatedAt: timestamp }
      expect(await createProjectSetupProvider({ fetch: fixture('status', minimal) }).status(operationId)).toEqual(minimal)
    } finally { for (const key of Object.keys(inherited)) Reflect.deleteProperty(Object.prototype, key) }
  })
})

describe('bounded and sanitized setup transport with no automatic writes or retries', () => {
  it.each(methods)('classifies only exact 403 Forbidden as rejected for %s', async method => {
    const fetch = fixture(method, json({ error: 'Forbidden' }, { status: 403 })), provider = createProjectSetupProvider({ fetch })
    await errorFrom(run(provider, method), 'forbidden', 'rejected'); await provider.waitForIdle(); await flush(); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(methods)('keeps all other HTTP failures unknown and drops raw diagnostics for %s', async method => {
    for (const [status, raw] of [[403, { error: 'Forbidden', details: 'PRIVATE' }], [401, { error: 'Forbidden' }], [400, { error: 'PRIVATE' }],
      [404, { error: 'PRIVATE' }], [409, { error: 'PRIVATE', code: 'DASHBOARD_NOT_FOUND', retryable: false, details: { PRIVATE: true } }], [500, { error: 'PRIVATE' }], [501, { error: 'PRIVATE' }]] as const) {
      const fetch = fixture(method, json(raw, { status })), provider = createProjectSetupProvider({ fetch })
      await errorFrom(run(provider, method), 'backend-failure'); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledOnce()
    }
    for (const raw of [null, [], {}, { message: 'PRIVATE' }]) await errorFrom(run(createProjectSetupProvider({ fetch: fixture(method, json(raw, { status: 500 })) }), method), 'invalid-shape')
  })
  it.each(methods)('requires the exact success status for %s', async method => {
    for (const status of [200, 201, 202, 203]) if (status !== statuses[method]) await errorFrom(run(createProjectSetupProvider({ fetch: fixture(method, json(success(method), { status })) }), method), 'invalid-shape')
  })
  it.each(methods)('rejects redirects, opaque, non-JSON and malformed response bodies for %s', async method => {
    const redirected = json(success(method), { status: statuses[method] }); Object.defineProperty(redirected, 'redirected', { value: true })
    const opaque = json(success(method), { status: statuses[method] }); Object.defineProperty(opaque, 'type', { value: 'opaque' })
    const opaqueRedirect = json(success(method), { status: statuses[method] }); Object.defineProperty(opaqueRedirect, 'type', { value: 'opaqueredirect' })
    for (const response of [redirected, opaque, opaqueRedirect, new Response('PRIVATE', { status: statuses[method], headers: { 'Content-Type': 'text/html' } }),
      new Response('{PRIVATE', { status: statuses[method], headers: { 'Content-Type': 'application/json' } }), new Response(null, { status: statuses[method], headers: { 'Content-Type': 'application/json' } }),
      new Response('{}', { status: statuses[method], headers: { 'Content-Type': 'application/jsonp' } }), new Response('{}', { status: statuses[method] })]) {
      const fetch = fixture(method, response); await errorFrom(run(createProjectSetupProvider({ fetch }), method), 'invalid-shape'); expect(fetch).toHaveBeenCalledOnce()
    }
  })
  it.each(methods)('enforces byte and chunk response budgets for %s', async method => {
    const oversize = new Response('x'.repeat(PROJECT_SETUP_LIMITS.maxResponseBytes + 1), { status: statuses[method], headers: { 'Content-Type': 'application/json' } })
    const declared = json(success(method), { status: statuses[method], headers: { 'Content-Length': `${PROJECT_SETUP_LIMITS.maxResponseBytes + 1}` } })
    const chunked = new Response(new ReadableStream({ start(controller) { for (let n = 0; n <= PROJECT_SETUP_LIMITS.maxResponseChunks; n++) controller.enqueue(new Uint8Array()); controller.close() } }), { status: statuses[method], headers: { 'Content-Type': 'application/json' } })
    for (const response of [oversize, declared, chunked]) await errorFrom(run(createProjectSetupProvider({ fetch: fixture(method, response) }), method), 'response-too-large')
  })
  it.each(methods)('accepts exactly 512 chunks for %s', async method => {
    const response = new Response(new ReadableStream({ start(controller) {
      for (let n = 1; n < PROJECT_SETUP_LIMITS.maxResponseChunks; n++) controller.enqueue(new Uint8Array())
      controller.enqueue(new TextEncoder().encode(JSON.stringify(success(method)))); controller.close()
    } }), { status: statuses[method], headers: { 'Content-Type': 'application/json' } })
    expect(await run(createProjectSetupProvider({ fetch: fixture(method, response) }), method)).toEqual(success(method))
  })
  it('accepts exactly 128 KiB, counts bytes instead of characters, and does not trust a short declared length', async () => {
    const base = JSON.stringify({ ...project(), ignored: '' }), baseBytes = new TextEncoder().encode(base).byteLength
    const exact = JSON.stringify({ ...project(), ignored: 'x'.repeat(PROJECT_SETUP_LIMITS.maxResponseBytes - baseBytes) })
    expect(new TextEncoder().encode(exact).byteLength).toBe(PROJECT_SETUP_LIMITS.maxResponseBytes)
    expect(await createProjectSetupProvider({ fetch: fixture('register', new Response(exact, { status: 201, headers: { 'Content-Type': 'application/json', 'Content-Length': '1' } })) }).register(projectPath)).toEqual(project())
    const tooLarge = JSON.stringify({ ...project(), ignored: '工'.repeat(50_000) })
    expect(tooLarge.length).toBeLessThan(PROJECT_SETUP_LIMITS.maxResponseBytes)
    await errorFrom(createProjectSetupProvider({ fetch: fixture('register', new Response(tooLarge, { status: 201, headers: { 'Content-Type': 'application/json', 'Content-Length': '1' } })) }).register(projectPath), 'response-too-large')
  })
  it.each([[0xc3, 0x28], [0xed, 0xa0, 0x80], [0xc3]])('rejects invalid UTF-8 bytes %s', async (...bytes) => {
    const response = new Response(new Uint8Array(bytes), { status: 201, headers: { 'Content-Type': 'application/json' } })
    await errorFrom(createProjectSetupProvider({ fetch: fixture('register', response) }).register(projectPath), 'invalid-shape')
  })
  it('accepts multibyte UTF-8 split across chunks', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(project()))
    const response = new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close() } }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    expect(await createProjectSetupProvider({ fetch: fixture('register', response) }).register(projectPath)).toEqual(project())
  })
  it.each(methods)('does not dispatch a pre-aborted or synchronously cancelled %s request', async method => {
    const fetch = fixture(method), provider = createProjectSetupProvider({ fetch }), first = new AbortController(), second = new AbortController()
    first.abort(); await errorFrom(run(provider, method, first.signal), 'aborted', 'not-dispatched')
    const pending = run(provider, method, second.signal); second.abort(); await errorFrom(pending, 'aborted', 'not-dispatched')
    expect(fetch).not.toHaveBeenCalled(); await provider.waitForIdle()
  })
  it.each(methods)('keeps one lane across all methods and targets while %s is active', async method => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<ProjectSetupFetch>(() => new Promise(resolve => { finish = resolve })), provider = createProjectSetupProvider({ fetch }), pending = run(provider, method)
    for (const blocked of methods) await errorFrom(run(provider, blocked), 'busy', 'not-dispatched')
    await errorFrom(provider.register('/another/project'), 'busy', 'not-dispatched'); await errorFrom(provider.start(otherProjectId), 'busy', 'not-dispatched')
    await errorFrom(provider.status(otherOperationId), 'busy', 'not-dispatched')
    finish(json(success(method), { status: statuses[method] })); expect(await pending).toEqual(success(method)); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(methods)('waits for abort-aware %s transport rejection before releasing the lane', async method => {
    const fetch = vi.fn<ProjectSetupFetch>().mockImplementationOnce((_path, init) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => { queueMicrotask(() => reject(Error('PRIVATE'))) }, { once: true })
    })).mockImplementation(async () => json(success(method), { status: statuses[method] }))
    const provider = createProjectSetupProvider({ fetch }), controller = new AbortController(), pending = errorFrom(run(provider, method, controller.signal), 'aborted')
    await flush(); controller.abort(); await pending; await provider.waitForIdle()
    expect(await run(provider, method)).toEqual(success(method)); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each(methods)('retains the %s lease through ignored-abort fetch and late response cancellation', async method => {
    let finish!: (response: Response) => void, finishCancel!: () => void
    const fetch = vi.fn<ProjectSetupFetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockImplementation(async () => json(success(method), { status: statuses[method] }))
    const provider = createProjectSetupProvider({ fetch }), controller = new AbortController(), pending = errorFrom(run(provider, method, controller.signal), 'aborted'), idle = vi.fn()
    void provider.waitForIdle().then(idle); await flush(); controller.abort(); await pending
    expect(idle).not.toHaveBeenCalled(); for (const blocked of methods) await errorFrom(run(provider, blocked), 'busy', 'not-dispatched')
    const cancel = vi.fn(() => new Promise<void>(resolve => { finishCancel = resolve }))
    finish(new Response(new ReadableStream({ cancel }), { status: statuses[method], headers: { 'Content-Type': 'application/json' } })); await flush()
    expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.start(projectId), 'busy', 'not-dispatched')
    finishCancel(); await provider.waitForIdle(); await flush(); expect(idle).toHaveBeenCalledOnce()
    expect(await run(provider, method)).toEqual(success(method)); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it.each(methods)('bounds %s default wait at 120 seconds without retrying or releasing an unsettled transport', async method => {
    vi.useFakeTimers(); let finish!: (response: Response) => void
    const fetch = vi.fn<ProjectSetupFetch>(() => new Promise(resolve => { finish = resolve })), provider = createProjectSetupProvider({ fetch }), idle = vi.fn()
    const pending = errorFrom(run(provider, method), 'timeout'); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(119_999); expect(idle).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1); await pending; expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(true); expect(idle).not.toHaveBeenCalled()
    await errorFrom(provider.start(projectId), 'busy', 'not-dispatched'); await vi.advanceTimersByTimeAsync(240_000); expect(fetch).toHaveBeenCalledOnce()
    finish(json(success(method), { status: statuses[method] })); await provider.waitForIdle(); await flush(); expect(idle).toHaveBeenCalledOnce()
  })
  it.each(methods)('retains stalled %s body cancellation until it actually settles', async method => {
    vi.useFakeTimers(); let finish!: () => void
    const cancel = vi.fn(() => new Promise<void>(resolve => { finish = resolve })), response = new Response(new ReadableStream({ cancel }), { status: statuses[method], headers: { 'Content-Type': 'application/json' } })
    const fetch = vi.fn<ProjectSetupFetch>().mockResolvedValueOnce(response).mockImplementation(async () => json(success(method), { status: statuses[method] })), provider = createProjectSetupProvider({ fetch, timeoutMs: 20 })
    const pending = errorFrom(run(provider, method), 'timeout'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(20); await pending; expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled()
    await errorFrom(provider.start(projectId), 'busy', 'not-dispatched'); finish(); await provider.waitForIdle(); await flush(); expect(idle).toHaveBeenCalledOnce()
    expect(await run(provider, method)).toEqual(success(method))
  })
  it('does not release after cancellation settles while an abort-unaware reader remains pending', async () => {
    vi.useFakeTimers(); let finishRead!: (value: ReadableStreamReadResult<Uint8Array>) => void
    const read = vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(resolve => { finishRead = resolve })), cancel = vi.fn(async () => undefined), releaseLock = vi.fn()
    const response = json(snapshot()); Object.defineProperty(response, 'body', { value: { getReader: () => ({ read, cancel, releaseLock }) } })
    const fetch = vi.fn<ProjectSetupFetch>().mockResolvedValueOnce(response).mockImplementation(async () => json(snapshot())), provider = createProjectSetupProvider({ fetch, timeoutMs: 20 })
    const pending = errorFrom(provider.status(operationId), 'timeout'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(20); await pending; expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled()
    await errorFrom(provider.register(projectPath), 'busy', 'not-dispatched'); finishRead({ done: true, value: undefined }); await provider.waitForIdle(); await flush()
    expect(idle).toHaveBeenCalledOnce(); expect(await provider.status(operationId)).toEqual(snapshot())
    expect(fetch.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })
  it('waits for discarded rejected-response body cancellation to settle', async () => {
    let finish!: () => void
    const cancel = vi.fn(() => new Promise<void>(resolve => { finish = resolve })), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'text/html' } })
    const provider = createProjectSetupProvider({ fetch: fixture('status', response) }), pending = errorFrom(provider.status(operationId), 'invalid-shape'), idle = vi.fn()
    void provider.waitForIdle().then(idle); await pending; expect(idle).not.toHaveBeenCalled()
    await errorFrom(provider.start(projectId), 'busy', 'not-dispatched'); finish(); await provider.waitForIdle(); await flush(); expect(idle).toHaveBeenCalledOnce()
  })
  it('does not let old cancellation abort or release a newer request', async () => {
    let finish!: (response: Response) => void
    const first = new AbortController(), second = new AbortController(), fetch = vi.fn<ProjectSetupFetch>().mockResolvedValueOnce(json(project(), { status: 201 })).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const provider = createProjectSetupProvider({ fetch }); await provider.register(projectPath, first.signal); await provider.waitForIdle()
    const pending = provider.start(projectId, second.signal); await flush(); first.abort(); await flush()
    expect(fetch.mock.calls[1]![1].signal!.aborted).toBe(false); await errorFrom(provider.status(operationId), 'busy', 'not-dispatched')
    finish(json({ operationId }, { status: 202 })); expect(await pending).toEqual({ operationId }); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('releases settled failures and sends again only on a new explicit call', async () => {
    const fetch = vi.fn<ProjectSetupFetch>().mockRejectedValueOnce(Error('PRIVATE')).mockImplementation(async () => json(snapshot())), provider = createProjectSetupProvider({ fetch })
    await errorFrom(provider.status(operationId), 'network-error'); await provider.waitForIdle(); await flush(); expect(fetch).toHaveBeenCalledOnce()
    expect(await provider.status(operationId)).toEqual(snapshot()); expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })
  it.each(['throw', 'reject'])('sanitizes transport %s even when it claims safe rejection', async mode => {
    const claimed = new ProjectSetupError('forbidden', 'rejected'); claimed.message = 'PRIVATE'
    const fetch = vi.fn<ProjectSetupFetch>(() => { if (mode === 'throw') throw claimed; return Promise.reject(claimed) })
    const provider = createProjectSetupProvider({ fetch }); await errorFrom(provider.start(projectId), 'network-error'); await provider.waitForIdle(); expect(fetch).toHaveBeenCalledOnce()
  })
  it('does not trust a response property claiming a safe rejection', async () => {
    const claimed = new ProjectSetupError('forbidden', 'rejected'); claimed.message = 'PRIVATE'
    const response = json(snapshot()); Object.defineProperty(response, 'redirected', { get() { throw claimed } })
    const provider = createProjectSetupProvider({ fetch: fixture('status', response) }); await errorFrom(provider.status(operationId), 'network-error'); await provider.waitForIdle()
  })
  it('sanitizes reader errors instead of trusting rejection or diagnostics', async () => {
    const claimed = new ProjectSetupError('forbidden', 'rejected'); claimed.message = 'PRIVATE'
    const cancel = vi.fn(async () => undefined), response = json(snapshot())
    Object.defineProperty(response, 'body', { value: { getReader: () => ({ read: () => Promise.reject(claimed), cancel, releaseLock: vi.fn() }) } })
    const provider = createProjectSetupProvider({ fetch: fixture('status', response) }); await errorFrom(provider.status(operationId), 'invalid-shape'); await provider.waitForIdle(); expect(cancel).toHaveBeenCalledOnce()
  })
  it.each(['PRIVATE', new Uint16Array([0x7b]), null])('rejects non-Uint8Array body chunks %#', async value => {
    const cancel = vi.fn(async () => undefined), response = json(snapshot())
    Object.defineProperty(response, 'body', { value: { getReader: () => ({ read: async () => ({ done: false, value }), cancel, releaseLock: vi.fn() }) } })
    const provider = createProjectSetupProvider({ fetch: fixture('status', response) }); await errorFrom(provider.status(operationId), 'invalid-shape'); await provider.waitForIdle(); expect(cancel).toHaveBeenCalledOnce()
  })
})
