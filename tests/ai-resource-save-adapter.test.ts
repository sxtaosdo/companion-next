import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAiResourceSaveProvider, AI_RESOURCE_SAVE_LIMITS, AiResourceSaveError } from '../src/adapters/ai-resource-save'
import type { AiResourceSaveFetch } from '../src/adapters/ai-resource-save'
import { aiResourceConfigChanges, aiResourceConfigsEqual, validateAiResourceConfigV2, validateAiResourceSaveInput } from '../src/domain/ai-resource-save'
import type { AiResourceSaveCode, AiResourceSaveInput, AiResourceSaveOutcome } from '../src/domain/ai-resource-save'
import type { AiResourceConfigV2, AiResourceView } from '../src/domain/ai-resource-read'
const id = '0123456789abcdef', other = 'fedcba9876543210'
function config(): AiResourceConfigV2 {
  return { schemaVersion: 'project-resource-config-v2', projectId: id, version: 2, designResolution: { width: 720, height: 1280 }, orientation: 'portrait',
    iconSize: { width: 256, height: 256 }, style: { description: '明亮卡通\n保留轮廓', references: ['art/reference/a.png'] },
    background: { format: 'png', transparent: true, color: '#aBcDeF' }, composition: { centered: true, paddingPercent: 10 },
    destination: { directory: 'assets/icons', exportDirectory: 'art/final/icons', naming: 'kebab-case' } }
}
const input = (): AiResourceSaveInput => ({ config: config(), expectedHash: 'b'.repeat(64), approved: true })
function view(): AiResourceView {
  const saved = { ...config(), version: 3 }
  return { schemaVersion: 'companion-icons-v1', projectId: id, state: 'valid', version: 3, hash: 'a'.repeat(64), relativePath: `${id}.ai-icons.json`,
    migrationRequired: false, config: saved, draft: structuredClone(saved), issues: [],
    detected: { designResolution: { width: 720, height: 1280 }, designSource: 'settings/v2/packages/project.json', resourceDirectories: ['assets/icons', 'assets'] },
    capabilities: { outputPixels: { width: 1024, height: 1024 }, format: 'png', overwrite: false, referencesAsModelInput: false } }
}
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } })
const fixture = (response: unknown = view()) => vi.fn<AiResourceSaveFetch>(async () => response instanceof Response ? response : json(response))
const failure = (code: string, status = 409) => json({ error: code, code, retryable: false }, { status })
async function expectError(promise: Promise<unknown>, code: AiResourceSaveCode, outcome: AiResourceSaveOutcome) {
  const error = await promise.then(() => { throw Error('Expected error') }, (error: unknown) => error)
  expect(error).toBeInstanceOf(AiResourceSaveError); expect(error).toMatchObject({ code, outcome }); return error as AiResourceSaveError
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('strict editable v2 input and review semantics', () => {
  it('trims only the description, clones every nested object and preserves meaningful values', () => {
    const value = config(); value.style.description = `  ${value.style.description}\n `
    const result = validateAiResourceConfigV2(value, id)
    expect(result).toEqual(config()); expect(result).not.toBe(value); expect(value.style.description.startsWith('  ')).toBe(true)
    result.style.references.push('assets/next.png'); expect(value.style.references).toEqual(['art/reference/a.png'])
    expect(result.background.color).toBe('#aBcDeF')
    value.style.description = ' '.repeat(2000) + 'valid' + ' '.repeat(2000)
    expect(validateAiResourceConfigV2(value, id).style.description).toBe('valid')
  })
  it.each(['root', 'designResolution', 'iconSize', 'style', 'background', 'composition', 'destination'])('rejects unknown fields at %s without silently projecting', (field) => {
    const value: any = config(); (field === 'root' ? value : value[field]).unknown = 'PRIVATE'
    expect(() => validateAiResourceConfigV2(value, id)).toThrow(AiResourceSaveError)
  })
  it.each([
    (v: any) => { v.schemaVersion = 'project-resource-config-v1' }, (v: any) => { v.projectId = other },
    (v: any) => { v.version = 0 }, (v: any) => { v.version = Number.MAX_SAFE_INTEGER + 1 },
    (v: any) => { v.designResolution = { width: 0, height: 1280 } }, (v: any) => { v.designResolution.width = 8193 },
    (v: any) => { v.designResolution.height = 1.1 }, (v: any) => { v.orientation = 'landscape' },
    (v: any) => { v.iconSize = { width: 4096, height: 4096 } }, (v: any) => { v.iconSize.width = 4097 },
    (v: any) => { v.style.description = '   ' }, (v: any) => { v.style.description = 'x'.repeat(1501) },
    (v: any) => { v.style.description = 'x\u0000PRIVATE' }, (v: any) => { v.style.description = '\u202ePRIVATE' },
    (v: any) => { v.style.references = ['assets/a.png', 'assets/a.png'] }, (v: any) => { v.style.references = Array(5).fill('assets/a.png') },
    (v: any) => { v.style.references = ['assets/CON.png'] }, (v: any) => { v.style.references = ['assets/x./a.png'] },
    (v: any) => { v.style.references = ['assets/../a.png'] }, (v: any) => { v.style.references = ['https://private/a.png'] },
    (v: any) => { v.style.references = ['assets/a.svg'] }, (v: any) => { v.style.references = ['assets/a.png?token=PRIVATE'] },
    (v: any) => { v.background.transparent = 1 }, (v: any) => { v.background.color = '#fff' }, (v: any) => { v.background.format = 'jpg' },
    (v: any) => { v.composition.centered = false }, (v: any) => { v.composition.paddingPercent = Infinity }, (v: any) => { v.composition.paddingPercent = 40.1 },
    (v: any) => { v.destination.directory = 'art/final' }, (v: any) => { v.destination.exportDirectory = 'assets' },
    (v: any) => { v.destination.exportDirectory = 'art/final/con' }, (v: any) => { v.destination.exportDirectory = 'art/final/a.b' },
    (v: any) => { v.destination.naming = 'anything' }, (v: any) => { delete v.destination },
  ])('rejects malformed editable configs %#', (mutate) => { const value = config(); mutate(value); expect(() => validateAiResourceConfigV2(value, id)).toThrow(AiResourceSaveError) })
  it('preserves original path semantics rather than normalizing case, references or destination grammar', () => {
    const value = config(); value.destination.directory = 'assets/a.'; value.style.references = ['Assets/A.PNG', 'assets/a.png']; value.composition.paddingPercent = 0.25
    expect(validateAiResourceConfigV2(value, id)).toEqual(value)
  })
  it('rejects missing input, inherited fields, symbol properties and approval/hash coercion', () => {
    for (const value of [null, {}, [], { ...input(), approved: false }, { ...input(), approved: 'true' }, { ...input(), expectedHash: undefined }, { ...input(), expectedHash: 'A'.repeat(64) }, { ...input(), extra: true }]) {
      expect(() => validateAiResourceSaveInput(value, id)).toThrow(AiResourceSaveError)
    }
    const value = config(); Object.defineProperty(value, 'hidden', { value: 1 }); expect(() => validateAiResourceConfigV2(value, id)).toThrow()
    expect(() => validateAiResourceConfigV2({ ...config(), [Symbol('x')]: true }, id)).toThrow()
    const inherited = Object.create(config()); expect(() => validateAiResourceConfigV2(inherited, id)).toThrow()
    expect(validateAiResourceSaveInput({ ...input(), expectedHash: null }, id).expectedHash).toBeNull()
  })
  it('compares canonical content and reports stable leaf changes with incomplete drafts', () => {
    const a = config(), b = Object.fromEntries(Object.entries(a).reverse()) as unknown as AiResourceConfigV2
    expect(aiResourceConfigsEqual(a, b)).toBe(true)
    b.version = 100; expect(aiResourceConfigsEqual(a, b)).toBe(false); expect(aiResourceConfigsEqual(a, b, { ignoreVersion: true })).toBe(true)
    expect(aiResourceConfigsEqual(null, b)).toBe(false)
    const changed = config(); changed.background.color = '#ABCDEF'; changed.iconSize.width = 128; changed.style.description = ` ${changed.style.description} `
    expect(aiResourceConfigChanges(a, changed)).toEqual([{ field: 'iconSize.width', before: '256', after: '128' }, { field: 'background.color', before: '#aBcDeF', after: '#ABCDEF' }])
    expect(aiResourceConfigsEqual(a, changed)).toBe(false)
    a.style.references = ['assets/a.png', 'assets/b.png']; b.style = { ...a.style, references: [...a.style.references].reverse() }
    expect(aiResourceConfigsEqual(a, b, { ignoreVersion: true })).toBe(false)
    const draft = config(); draft.iconSize = { width: 0, height: 0 }; draft.style.description = ''
    expect(aiResourceConfigChanges(draft, config()).map(change => change.field)).toEqual(['iconSize.width', 'iconSize.height', 'style.description'])
    expect(aiResourceConfigChanges(null, config()).length).toBeGreaterThan(0)
  })
})

describe('passive fixed-path explicit v148 save transport', () => {
  it('constructs without transport and exposes only an explicitly invoked save', async () => {
    const fetch = fixture(), provider = createAiResourceSaveProvider({ fetch }), value = input()
    expect(fetch).not.toHaveBeenCalled(); expect(Object.isFrozen(provider)).toBe(true); expect(Object.keys(provider).sort()).toEqual(['label', 'saveConfig'])
    expect(await provider.saveConfig(id, value)).toEqual(view()); expect(fetch).toHaveBeenCalledOnce()
    const [path, init] = fetch.mock.calls[0]!
    expect(path).toBe(`/api/icons/${id}/resource-config-save`)
    expect(init).toMatchObject({ method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
    expect(init.signal).toBeInstanceOf(AbortSignal); expect(JSON.parse(init.body as string)).toEqual(value)
    expect(new Headers(init.headers).get('authorization')).toBeNull(); expect(new Headers(init.headers).get('cookie')).toBeNull()
  })
  it('requires injection and never consults global fetch or starts anything automatically', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(() => createAiResourceSaveProvider(undefined as never)).toThrow(TypeError); expect(() => createAiResourceSaveProvider({} as never)).toThrow(TypeError)
    createAiResourceSaveProvider({ fetch: fixture() }); expect(fetch).not.toHaveBeenCalled()
  })
  it.each([0, -1, NaN, Infinity, 20_001])('rejects invalid timeout %s', timeoutMs => { expect(() => createAiResourceSaveProvider({ fetch: fixture(), timeoutMs })).toThrow(RangeError) })
  it.each(['', '../project', 'A'.repeat(16), 'a'.repeat(15), 'a'.repeat(17), 'https://PRIVATE', null, 5])('rejects unsafe project ids before any transport %#', async projectId => {
    const fetch = fixture(); await expectError(createAiResourceSaveProvider({ fetch }).saveConfig(projectId as string, input()), 'invalid-input', 'not-sent'); expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects missing approval and unknown input keys without dispatch', async () => {
    const fetch = fixture(), provider = createAiResourceSaveProvider({ fetch })
    for (const value of [{ ...input(), approved: false }, { ...input(), extra: true }, { config: config(), expectedHash: null }]) await expectError(provider.saveConfig(id, value as AiResourceSaveInput), 'invalid-input', 'not-sent')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('snapshots and normalizes input before awaiting transport', async () => {
    const fetch = fixture(), provider = createAiResourceSaveProvider({ fetch }), value = input(); value.config.style.description = ` ${value.config.style.description} `
    const pending = provider.saveConfig(id, value); value.config.style.description = 'MUTATED'; value.expectedHash = null
    await pending; expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual(input())
  })
})

describe('known rejections versus unknown outcomes', () => {
  it.each([[401, 'unauthorized'], [403, 'forbidden']] as const)('HTTP %s is known rejection and body is discarded', async (status, code) => {
    const response = json({ private: 'PRIVATE' }, { status }), cancel = vi.spyOn(response.body!, 'cancel')
    const error = await expectError(createAiResourceSaveProvider({ fetch: fixture(response) }).saveConfig(id, input()), code, 'rejected')
    expect(error.status).toBe(status); expect(cancel).toHaveBeenCalledOnce(); expect(error).not.toHaveProperty('cause')
  })
  it.each([['INVALID_INPUT', 400], ['PROJECT_NOT_FOUND', 404], ['ICON_ADAPTER_DISABLED', 503], ['ICON_CONFIG_INVALID', 503], ['RESOURCE_CONFIG_BUSY', 409], ['RESOURCE_PROJECT_MISMATCH', 409], ['RESOURCE_DESIGN_MISMATCH', 409], ['RESOURCE_REFERENCE_INVALID', 409]] as const)('maps verified prewrite %s as rejection', async (code, status) => {
    const error = await expectError(createAiResourceSaveProvider({ fetch: fixture(failure(code, status)) }).saveConfig(id, input()), 'rejected', 'rejected')
    expect(JSON.stringify(error)).not.toContain(code)
  })
  it('distinguishes stale conflict without automatic retry', async () => {
    const fetch = fixture(failure('RESOURCE_CONFIG_STALE'))
    await expectError(createAiResourceSaveProvider({ fetch }).saveConfig(id, input()), 'stale', 'conflict'); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(['RESOURCE_CONFIG_SAVE_UNCONFIRMED', 'ICON_OUTCOME_UNCONFIRMED', 'RESOURCE_CONFIG_CONFLICT', 'RESOURCE_PATH_INVALID', 'RESOURCE_CONFIG_INVALID', 'PRIVATE_FUTURE_CODE'])('keeps %s outcome unknown', async code => {
    const error = await expectError(createAiResourceSaveProvider({ fetch: fixture(failure(code)) }).saveConfig(id, input()), 'unconfirmed', 'unknown')
    expect(`${error}${JSON.stringify(error)}`).not.toContain(code); expect(error).not.toHaveProperty('cause')
  })
  it.each([{ code: 'RESOURCE_CONFIG_STALE' }, { code: 'RESOURCE_CONFIG_STALE', error: 'PRIVATE', retryable: false }, { code: 'RESOURCE_CONFIG_STALE', error: 'RESOURCE_CONFIG_STALE', retryable: true }])('does not trust incomplete or contradictory failure envelopes %#', async value => {
    await expectError(createAiResourceSaveProvider({ fetch: fixture(json(value, { status: 409 })) }).saveConfig(id, input()), 'unconfirmed', 'unknown')
  })
  it('does not treat known code with wrong HTTP status or success status as a rejection', async () => {
    await expectError(createAiResourceSaveProvider({ fetch: fixture(failure('RESOURCE_CONFIG_STALE', 500)) }).saveConfig(id, input()), 'unconfirmed', 'unknown')
    await expectError(createAiResourceSaveProvider({ fetch: fixture(failure('RESOURCE_CONFIG_STALE', 200)) }).saveConfig(id, input()), 'invalid-shape', 'unknown')
  })
  it('scrubs thrown transport messages and does not retry', async () => {
    const fetch = vi.fn<AiResourceSaveFetch>(async () => { throw Error('https://PRIVATE/?token=PRIVATE') })
    const error = await expectError(createAiResourceSaveProvider({ fetch }).saveConfig(id, input()), 'network-error', 'unknown')
    expect(`${error}${JSON.stringify(error)}`).not.toContain('PRIVATE'); expect(fetch).toHaveBeenCalledOnce(); expect(error).not.toHaveProperty('cause')
  })
  it('treats a synchronous transport throw as dispatched and uncertain', async () => {
    const fetch = vi.fn<AiResourceSaveFetch>(() => { throw Error('PRIVATE') })
    await expectError(createAiResourceSaveProvider({ fetch }).saveConfig(id, input()), 'network-error', 'unknown')
  })
})

describe('success verification and bounded responses', () => {
  it.each([201, 202, 206])('does not treat unverified HTTP %s as a completed save', async status => {
    await expectError(createAiResourceSaveProvider({ fetch: fixture(json(view(), { status })) }).saveConfig(id, input()), 'invalid-shape', 'unknown')
  })
  it.each([
    (v: any) => { v.projectId = other }, (v: any) => { v.config.projectId = other }, (v: any) => { v.version = 5 },
    (v: any) => { v.hash = null }, (v: any) => { v.state = 'invalid' }, (v: any) => { v.draft.style.description = 'different' },
    (v: any) => { v.config.style.description = 'stale'; v.draft.style.description = 'stale' },
    (v: any) => { v.config.background.color = '#ABCDEF'; v.draft.background.color = '#ABCDEF' },
    (v: any) => { v.migrationRequired = true }, (v: any) => { v.capabilities.overwrite = true },
  ])('rejects malformed, cross-project and stale-content success %#', async mutate => {
    const saved = view(); mutate(saved); await expectError(createAiResourceSaveProvider({ fetch: fixture(saved) }).saveConfig(id, input()), 'invalid-shape', 'unknown')
  })
  it('leaves expected next version to the store because submitted version is not the server baseline', async () => {
    const saved = view(); saved.version = 11; saved.config!.version = 11; saved.draft.version = 11
    expect((await createAiResourceSaveProvider({ fetch: fixture(saved) }).saveConfig(id, input())).version).toBe(11)
  })
  it('projects private response fields away', async () => {
    const saved = { ...view(), secret: 'PRIVATE' }
    expect(await createAiResourceSaveProvider({ fetch: fixture(saved) }).saveConfig(id, input())).toEqual(view())
  })
  it.each(['redirected', 'opaque', 'opaqueredirect'])('does not trust %s responses even with rejection status', async kind => {
    const response = failure('RESOURCE_CONFIG_STALE', 403); Object.defineProperty(response, kind === 'redirected' ? kind : 'type', { value: kind === 'redirected' ? true : kind })
    await expectError(createAiResourceSaveProvider({ fetch: fixture(response) }).saveConfig(id, input()), 'invalid-shape', 'unknown')
  })
  it.each(['text/html', 'text/plain', 'application/javascript', ''])('rejects content type %s as unknown', async type => {
    await expectError(createAiResourceSaveProvider({ fetch: fixture(new Response(JSON.stringify(view()), { headers: { 'Content-Type': type } })) }).saveConfig(id, input()), 'invalid-shape', 'unknown')
  })
  it('rejects malformed JSON, invalid UTF8, empty body and wrapped responses without retaining contents', async () => {
    for (const response of [new Response('PRIVATE'), new Response(new Uint8Array([0xff, 0xfe])), new Response(null), json({ data: view() })]) {
      response.headers.set('Content-Type', 'application/json')
      expect(String(await expectError(createAiResourceSaveProvider({ fetch: fixture(response) }).saveConfig(id, input()), 'invalid-shape', 'unknown'))).not.toContain('PRIVATE')
    }
  })
  it('reads split multibyte UTF8 without loss', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(view())), stream = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); c.close() } })
    expect(await createAiResourceSaveProvider({ fetch: fixture(new Response(stream, { headers: { 'Content-Type': 'application/json' } })) }).saveConfig(id, input())).toEqual(view())
  })
  it.each(['announced', 'single', 'cumulative', 'chunks'])('bounds %s response and cancels remaining data', async mode => {
    const cancel = vi.fn(), response = new Response(new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(mode === 'single' ? AI_RESOURCE_SAVE_LIMITS.maxResponseBytes + 1 : mode === 'cumulative' ? 65_537 : 0)) }, cancel }), { headers: { 'Content-Type': 'application/json', 'Content-Length': mode === 'announced' ? String(AI_RESOURCE_SAVE_LIMITS.maxResponseBytes + 1) : '2' } })
    await expectError(createAiResourceSaveProvider({ fetch: fixture(response) }).saveConfig(id, input()), 'response-too-large', 'unknown'); expect(cancel).toHaveBeenCalledOnce()
  })
})

describe('one writer, cancellation and timeout uncertainty', () => {
  it('never dispatches pre-aborted and synchronously cancelled requests', async () => {
    const fetch = fixture(), provider = createAiResourceSaveProvider({ fetch }), first = new AbortController(), second = new AbortController(); first.abort()
    await expectError(provider.saveConfig(id, input(), first.signal), 'aborted', 'not-sent')
    const pending = provider.saveConfig(id, input(), second.signal); second.abort(); await expectError(pending, 'aborted', 'not-sent'); expect(fetch).not.toHaveBeenCalled()
    expect(await provider.saveConfig(id, input())).toEqual(view())
  })
  it('permits only one pending save and keeps its lock after local cancellation until fetch settles', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<AiResourceSaveFetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockImplementation(async () => json(view()))
    const provider = createAiResourceSaveProvider({ fetch }), controller = new AbortController(), pending = expectError(provider.saveConfig(id, input(), controller.signal), 'aborted', 'unknown')
    await Promise.resolve(); await expectError(provider.saveConfig(id, input()), 'busy', 'not-sent'); controller.abort(); await pending
    await expectError(provider.saveConfig(id, input()), 'busy', 'not-sent'); expect(fetch).toHaveBeenCalledOnce()
    const cancel = vi.fn(); finish(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
    await new Promise(resolve => setTimeout(resolve, 0)); expect(cancel).toHaveBeenCalledOnce()
    expect(await provider.saveConfig(id, input())).toEqual(view()); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('times out ignored-abort transport without unlocking or retrying', async () => {
    vi.useFakeTimers(); const fetch = vi.fn<AiResourceSaveFetch>(() => new Promise(() => undefined)), provider = createAiResourceSaveProvider({ fetch, timeoutMs: 20 })
    const pending = expectError(provider.saveConfig(id, input()), 'timeout', 'unknown')
    await vi.advanceTimersByTimeAsync(20); await pending; await expectError(provider.saveConfig(id, input()), 'busy', 'not-sent')
    await vi.advanceTimersByTimeAsync(60_000); expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(true)
  })
  it('bounds default header waiting and stalled body waiting', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn<AiResourceSaveFetch>(() => new Promise(() => undefined)), provider = createAiResourceSaveProvider({ fetch })
    const pending = expectError(provider.saveConfig(id, input()), 'timeout', 'unknown')
    await vi.advanceTimersByTimeAsync(AI_RESOURCE_SAVE_LIMITS.defaultTimeoutMs); await pending
    const cancel = vi.fn(), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } })
    const body = expectError(createAiResourceSaveProvider({ fetch: fixture(response), timeoutMs: 25 }).saveConfig(id, input()), 'timeout', 'unknown')
    await vi.advanceTimersByTimeAsync(25); await body; expect(cancel).toHaveBeenCalledOnce()
  })
  it('aborting a stalled body is outcome unknown, never a rollback claim', async () => {
    const cancel = vi.fn(), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }), controller = new AbortController()
    const pending = expectError(createAiResourceSaveProvider({ fetch: fixture(response) }).saveConfig(id, input(), controller.signal), 'aborted', 'unknown')
    await new Promise(resolve => setTimeout(resolve, 0)); controller.abort(); const error = await pending
    expect(error.message).not.toContain('回退'); expect(error.message).not.toContain('未发送'); expect(cancel).toHaveBeenCalledOnce()
  })
  it('releases its lock after a settled network error and allows only a new explicit call', async () => {
    const fetch = vi.fn<AiResourceSaveFetch>().mockRejectedValueOnce(Error('PRIVATE')).mockImplementation(async () => json(view())), provider = createAiResourceSaveProvider({ fetch })
    await expectError(provider.saveConfig(id, input()), 'network-error', 'unknown'); expect(fetch).toHaveBeenCalledOnce()
    expect(await provider.saveConfig(id, input())).toEqual(view()); expect(fetch).toHaveBeenCalledTimes(2)
  })
})
