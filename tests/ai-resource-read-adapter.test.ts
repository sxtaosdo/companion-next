import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { testCrypto as webcrypto } from './fixtures/generation-png'
import { createAiResourceReadProvider, AI_RESOURCE_READ_LIMITS, AiResourceReadError } from '../src/adapters/ai-resource-read'
import type { AiResourceFetch, AiResourceReadPath } from '../src/adapters/ai-resource-read'
import { decodeAiResourceView, decodeAiReferencePreview, isAiProjectId, isAiReferencePath, verifyAiReferencePreview } from '../src/domain/ai-resource-read'
import type { AiResourceConfigV1, AiResourceConfigV2, AiResourceReadCode, AiResourceView, AiReferencePreview } from '../src/domain/ai-resource-read'
const id = '0123456789abcdef', other = 'fedcba9876543210'
const png: AiReferencePreview = {
  base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==',
  sha256: '4ff6ab670a58c14270e034e2090d9a432caa263a14e0a25785386b0c12f880b5', width: 1, height: 1, mimeType: 'image/png',
}
const preview = () => ({ schemaVersion: 'companion-icons-v1', ...png })
function v2(): AiResourceConfigV2 {
  return { schemaVersion: 'project-resource-config-v2', projectId: id, version: 2, designResolution: { width: 720, height: 1280 }, orientation: 'portrait',
    iconSize: { width: 256, height: 256 }, style: { description: '明亮卡通\n保留轮廓', references: ['art/reference/a.png'] },
    background: { format: 'png', transparent: true, color: '#ffffff' }, composition: { centered: true, paddingPercent: 10 },
    destination: { directory: 'assets/icons', exportDirectory: 'art/final/icons', naming: 'kebab-case' } }
}
function view(): AiResourceView {
  const config = v2()
  return { schemaVersion: 'companion-icons-v1', projectId: id, state: 'valid', version: config.version, hash: 'a'.repeat(64), relativePath: `${id}.ai-icons.json`,
    migrationRequired: false, config, draft: structuredClone(config), issues: [],
    detected: { designResolution: { width: 720, height: 1280 }, designSource: 'settings/v2/packages/project.json', resourceDirectories: ['assets/icons', 'assets'] },
    capabilities: { outputPixels: { width: 1024, height: 1024 }, format: 'png', overwrite: false, referencesAsModelInput: false } }
}
function missing(): AiResourceView {
  const value = view(); value.state = 'missing'; value.config = null; value.version = null; value.hash = null
  value.draft = { ...v2(), version: 1, iconSize: { width: 0, height: 0 }, style: { description: '', references: [] }, destination: { directory: 'assets/icons', exportDirectory: 'art/final/companion', naming: 'kebab-case' } }
  return value
}
function legacy(): AiResourceView {
  const value = view(), current = v2()
  const config: AiResourceConfigV1 = { schemaVersion: 'project-resource-config-v1', version: current.version, designResolution: current.designResolution, orientation: current.orientation,
    iconPresets: [{ id: 'small-icon', label: '小图', displaySize: { width: 8192, height: 8192 }, outputPixels: { width: 1024, height: 1024 } }],
    style: current.style, background: { format: 'png', transparent: true }, composition: current.composition, destination: { directory: 'assets/icons', naming: 'kebab-case' } }
  value.config = config; value.migrationRequired = true; value.relativePath = 'resource-config.json'
  value.draft.iconSize = { width: 8192, height: 8192 }; value.draft.destination.exportDirectory = 'art/final/companion'
  return value
}
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } })
function fixture(config: unknown = view(), reference: unknown = preview()) {
  return vi.fn<AiResourceFetch>(async (path) => { const value = path.endsWith('/resource-config') ? config : reference; return value instanceof Response ? value : json(value) })
}
async function expectCode(pending: Promise<unknown>, code: AiResourceReadCode) {
  const error = await pending.then(() => { throw new Error('Expected rejection') }, (error: unknown) => error)
  expect(error).toBeInstanceOf(AiResourceReadError); expect(error).toMatchObject({ code }); return error as AiResourceReadError
}
beforeEach(() => { vi.stubGlobal('crypto', webcrypto) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('v148 AI resource passive fixed read-only POST surface', () => {
  it('config-only retains POST resource-config but fences preview before transport', async () => {const fetch=fixture(),options={fetch,referencePreview:false},p=createAiResourceReadProvider(options);expect(p.referencePreviewEnabled).toBe(false);await p.readConfig(id);options.referencePreview=true;await expectCode(p.previewReference(id,'art/reference/a.png'),'capability-disabled');expect(fetch.mock.calls.map(([path])=>path)).toEqual([`/api/icons/${id}/resource-config`])})
  it('constructs passively and exposes exactly the two verified reads', async () => {
    const fetch = fixture(), provider = createAiResourceReadProvider({ fetch })
    expect(fetch).not.toHaveBeenCalled(); expect(Object.isFrozen(provider)).toBe(true)
    expect(Object.keys(provider).sort()).toEqual(['label', 'previewReference', 'readConfig', 'referencePreviewEnabled', 'waitForIdle'])
    expect(await provider.readConfig(id)).toEqual(view())
    expect(await provider.previewReference(id, 'art/reference/a.png')).toEqual(png)
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([`/api/icons/${id}/resource-config`, `/api/icons/${id}/reference-preview`])
    expect(fetch.mock.calls.map(([, init]) => init.body)).toEqual(['{}', '{"relativePath":"art/reference/a.png"}'])
    for (const [path, init] of fetch.mock.calls) {
      expect(init).toMatchObject({ method: 'POST', mode: 'same-origin', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
      expect(init.signal).toBeInstanceOf(AbortSignal)
      expect(new Headers(init.headers).get('authorization')).toBeNull(); expect(new Headers(init.headers).get('cookie')).toBeNull()
      expect(path).not.toMatch(/https?:|token|save|upload|export|enqueue|resume|import|run-next|\/v1\//)
    }
  })
  it('requires explicit injection and does not touch global fetch', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(() => createAiResourceReadProvider(undefined as never)).toThrow(TypeError)
    expect(() => createAiResourceReadProvider({} as never)).toThrow(TypeError)
    createAiResourceReadProvider({ fetch: fixture() }); expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['', 'a', '0123456789ABCDEf', '0123456789abcdef0', '../config', 'https://other', 'a?token=x', '0123456789abcde\n', null, 1])('rejects invalid project before either endpoint %#', async (projectId) => {
    const fetch = fixture(), provider = createAiResourceReadProvider({ fetch })
    expect(isAiProjectId(projectId)).toBe(false)
    await expectCode(provider.readConfig(projectId as string), 'invalid-query')
    await expectCode(provider.previewReference(projectId as string, 'assets/a.png'), 'invalid-query')
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['', '../a.png', 'assets/../a.png', 'assets//a.png', 'assets/%2e%2e/a.png', '/assets/a.png', 'https://example/a.png', '//other/assets/a.png', 'data:image/png;base64,x', 'file:///a.png', 'assets/a.svg', 'assets/a.png?x', 'assets/a.png#x', 'assets\\a.png', 'assets/a:b.png', 'assets/CON.png', 'assets/com1/a.png', 'assets/a./b.png', 'assets/.hidden.png', 'art/reference/a.exe', 'assets/a\n.png', 'assets/' + 'a'.repeat(241) + '.png', null, 3])('rejects unsafe reference path before transport %#', async (relativePath) => {
    const fetch = fixture(); expect(isAiReferencePath(relativePath)).toBe(false)
    await expectCode(createAiResourceReadProvider({ fetch }).previewReference(id, relativePath as string), 'invalid-query'); expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['assets/a.png', 'art/reference/companion/a-b_1.webp', 'assets/dir/a.jpg', 'assets/dir/A.JPEG', 'Assets/A.PNG'])('accepts the verified safe reference grammar %s', (path) => { expect(isAiReferencePath(path)).toBe(true) })
  it.each([0, -1, NaN, Infinity, 20_001])('rejects unsafe timeout config %s', (timeoutMs) => { expect(() => createAiResourceReadProvider({ fetch: fixture(), timeoutMs })).toThrow(RangeError) })
})

describe('v148 config projection, draft distinctions and identity coherence', () => {
  it('accepts valid v2, missing and null-design default proposals', () => {
    expect(decodeAiResourceView(view(), id)).toEqual(view())
    expect(decodeAiResourceView(missing(), id)).toEqual(missing())
    const value = missing(); value.detected = { designResolution: null, designSource: null, resourceDirectories: [] }
    value.draft.designResolution = { width: 0, height: 0 }; value.draft.orientation = 'portrait'; value.draft.destination.directory = 'assets'
    expect(decodeAiResourceView(value, id)).toEqual(value)
  })
  it.each(['.hidden.ai-icons.json', '.ai-icons.json', 'another-project-name.ai-icons.json'])('accepts original ownership-selected config basename %s', (relativePath) => { const value = view(); value.relativePath = relativePath; expect(decodeAiResourceView(value, id).relativePath).toBe(relativePath) })
  it('preserves incomplete invalid persisted metadata separately from a proposed draft', () => {
    for (const code of ['INVALID_JSON', 'INVALID_FIELD', 'RESOURCE_PROJECT_MISMATCH'] as const) {
      const value = missing(); value.state = 'invalid'; value.hash = 'b'.repeat(64)
      value.version = code === 'INVALID_JSON' ? null : 9; value.issues = [{ field: code === 'INVALID_JSON' ? 'config' : code === 'INVALID_FIELD' ? '' : 'projectId', code }]
      const result = decodeAiResourceView(value, id); expect(result.config).toBeNull(); expect(result.draft.version).toBe(1); expect(result.version).toBe(value.version)
    }
  })
  it('retains valid persisted config when changed engine design or missing references make the view invalid', () => {
    const value = view(); value.state = 'invalid'; value.detected.designResolution = { width: 1280, height: 720 }
    value.draft.designResolution = { width: 1280, height: 720 }; value.draft.orientation = 'landscape'
    value.issues = [{ field: 'designResolution', code: 'ENGINE_DESIGN_CHANGED' }, { field: 'style.references', code: 'REFERENCE_NOT_FOUND' }]
    const result = decodeAiResourceView(value, id)
    expect(result.config!.designResolution).toEqual({ width: 720, height: 1280 }); expect(result.draft.designResolution).toEqual({ width: 1280, height: 720 })
  })
  it('accepts v1 migration proposals including 8192 sizes, duplicate legacy paths and disagreeing presets', () => {
    const value = legacy(); expect(decodeAiResourceView(value, id)).toEqual(value)
    const config = value.config as AiResourceConfigV1
    config.style.references = ['assets/CON.png', 'assets/CON.png']; value.draft.style.references = [...config.style.references]
    expect(decodeAiResourceView(value, id).draft.style.references).toEqual(config.style.references)
    expect(isAiReferencePath(config.style.references[0])).toBe(false)
    config.iconPresets.push({ ...config.iconPresets[0]!, id: 'other', displaySize: { width: 32, height: 64 } }); value.draft.iconSize = { width: 0, height: 0 }
    expect(decodeAiResourceView(value, id).draft.iconSize).toEqual({ width: 0, height: 0 })
  })
  it('projects unknown envelope/config/draft fields without retaining private metadata', () => {
    const value = view(), config = value.config as AiResourceConfigV2
    const result = decodeAiResourceView({ ...value, secret: 'PRIVATE', config: { ...config, secret: 'PRIVATE', background: { ...config.background, token: 'PRIVATE' } }, draft: { ...value.draft, password: 'PRIVATE' } }, id)
    expect(result).toEqual(view()); expect(JSON.stringify(result)).not.toContain('PRIVATE')
    result.draft.style.references.push('assets/new.png'); expect(value.draft.style.references).toEqual(['art/reference/a.png']); expect(result.config!.style.references).toEqual(['art/reference/a.png'])
  })
  it.each([
    (v: any) => { v.schemaVersion = 'future' }, (v: any) => { v.projectId = other }, (v: any) => { v.config.projectId = other }, (v: any) => { v.draft.projectId = other },
    (v: any) => { v.state = 'ready' }, (v: any) => { v.state = 'missing' }, (v: any) => { v.state = 'invalid' }, (v: any) => { v.version = 3 },
    (v: any) => { v.version = 0 }, (v: any) => { v.hash = null }, (v: any) => { v.hash = 'A'.repeat(64) }, (v: any) => { v.migrationRequired = true },
    (v: any) => { v.relativePath = '../resource-config.json' }, (v: any) => { v.relativePath = 'https://site/config.ai-icons.json' },
    (v: any) => { v.relativePath = '/config.ai-icons.json' }, (v: any) => { v.relativePath = 'assets/file.json' },
    (v: any) => { v.config.orientation = 'landscape' }, (v: any) => { v.config.designResolution.width = 8193 }, (v: any) => { v.config.designResolution.width = 0 },
    (v: any) => { v.config.iconSize.width = 4097 }, (v: any) => { v.config.iconSize = { width: 4096, height: 4096 } },
    (v: any) => { v.config.style.description = '' }, (v: any) => { v.config.style.description = ' trim ' },
    (v: any) => { v.config.style.description = 'x'.repeat(1501) }, (v: any) => { v.config.style.description = 'x\u0000token' },
    (v: any) => { v.config.style.references = ['assets/a.png', 'assets/a.png'] }, (v: any) => { v.config.style.references = ['assets/CON.png'] },
    (v: any) => { v.config.style.references = Array(5).fill('assets/a.png') }, (v: any) => { v.config.background.transparent = 'true' },
    (v: any) => { v.config.background.format = 'svg' }, (v: any) => { v.config.background.color = '#fff' },
    (v: any) => { v.config.composition.paddingPercent = 41 }, (v: any) => { v.config.composition.centered = false },
    (v: any) => { v.config.destination.directory = 'art/final' }, (v: any) => { v.config.destination.exportDirectory = 'assets' },
    (v: any) => { v.config.destination.exportDirectory = 'art/final/CON' }, (v: any) => { v.config.destination.exportDirectory = 'art/final/a.b' },
    (v: any) => { v.config.destination.naming = 'camelCase' }, (v: any) => { v.draft.style.description = 'changed' },
    (v: any) => { v.detected.designSource = '/hidden/settings.json' }, (v: any) => { v.detected.designResolution = null },
    (v: any) => { v.detected.resourceDirectories = ['assets/private'] }, (v: any) => { v.detected.resourceDirectories = ['assets', 'assets/icons'] },
    (v: any) => { v.capabilities.overwrite = true }, (v: any) => { v.capabilities.referencesAsModelInput = true }, (v: any) => { v.capabilities.outputPixels.width = 512 },
    (v: any) => { v.issues = [{ field: 'config', code: 'PRIVATE_ERROR' }] }, (v: any) => { v.issues = [{ field: 'http://secret', code: 'INVALID_FIELD' }] },
  ])('rejects malformed or contradictory config views %#', (mutate) => { const value = view(); mutate(value); expect(() => decodeAiResourceView(value, id)).toThrow(AiResourceReadError) })
  it('rejects malformed absence and invalid-state combinations', () => {
    const bad: AiResourceView[] = []
    let value = missing(); value.relativePath = 'resource-config.json'; bad.push(value)
    value = missing(); value.version = 1; bad.push(value)
    value = missing(); value.draft.iconSize.width = 10; bad.push(value)
    value = missing(); value.state = 'invalid'; value.hash = 'b'.repeat(64); value.version = 1; value.issues = [{ field: 'config', code: 'INVALID_JSON' }]; bad.push(value)
    value = missing(); value.state = 'invalid'; value.hash = 'b'.repeat(64); value.issues = [{ field: 'projectId', code: 'RESOURCE_PROJECT_MISMATCH' }]; bad.push(value)
    value = view(); value.state = 'invalid'; value.issues = [{ field: 'designResolution', code: 'ENGINE_DESIGN_CHANGED' }]; bad.push(value)
    value = view(); value.state = 'invalid'; value.issues = [{ field: 'style.references', code: 'REFERENCE_NOT_FOUND' }, { field: 'style.references', code: 'REFERENCE_NOT_FOUND' }]; bad.push(value)
    for (const entry of bad) expect(() => decodeAiResourceView(entry, id)).toThrow(AiResourceReadError)
    for (const entry of [null, {}, [], { ...view(), detected: null }]) expect(() => decodeAiResourceView(entry, id)).toThrow(AiResourceReadError)
  })
  it('rejects invalid legacy preset schemas and false migration claims', () => {
    for (const mutate of [
      (v: any) => { v.config.iconPresets = [] }, (v: any) => { v.config.iconPresets.push(v.config.iconPresets[0]) },
      (v: any) => { v.config.iconPresets[0].displaySize.width = 8193 }, (v: any) => { v.config.iconPresets[0].outputPixels.width = 512 },
      (v: any) => { v.config.iconPresets[0].id = 'Bad_Id' }, (v: any) => { v.config.background.transparent = false },
      (v: any) => { v.migrationRequired = false }, (v: any) => { v.draft.iconSize.width = 256 },
    ]) { const value = legacy(); mutate(value); expect(() => decodeAiResourceView(value, id)).toThrow(AiResourceReadError) }
  })
})

describe('canonical bounded PNG preview and hash verification', () => {
  it('accepts normalized bytes, checks SHA256, and returns only preview fields', async () => {
    expect(decodeAiReferencePreview({ ...preview(), relativePath: '/PRIVATE', originalSha256: 'PRIVATE', token: 'PRIVATE' })).toEqual(png)
    expect(decodeAiReferencePreview(png)).toEqual(png)
    expect(await verifyAiReferencePreview(preview())).toEqual(png)
    await expectCode(verifyAiReferencePreview({ ...preview(), sha256: '0'.repeat(64) }), 'invalid-shape')
    await expectCode(createAiResourceReadProvider({ fetch: fixture(view(), png) }).previewReference(id, 'assets/a.png'), 'invalid-shape')
  })
  it.each([
    null, {}, [], { ...preview(), schemaVersion: 'future' }, { ...preview(), mimeType: 'image/svg+xml' }, { ...preview(), sha256: 'A'.repeat(64) },
    { ...preview(), width: 2 }, { ...preview(), height: 0 }, { ...preview(), width: 4097 }, { ...preview(), width: 4096, height: 4096 },
    { ...preview(), base64: 'data:image/png;base64,' + png.base64 }, { ...preview(), base64: png.base64 + '\n' },
    { ...preview(), base64: png.base64.replace('==', '=') }, { ...preview(), base64: png.base64.slice(0, -3) + 'h==' },
    { ...preview(), base64: 'iVBORw0KGgo=' }, { ...preview(), base64: btoa('<svg onload="PRIVATE"/>') },
  ])('rejects invalid preview wire metadata/base64 %#', (value) => { expect(() => decodeAiReferencePreview(value)).toThrow(AiResourceReadError) })
  it('rejects damaged CRC, non-RGBA/header dimensions, trailing bytes, truncation and embedded metadata', () => {
    const original = Uint8Array.from(atob(png.base64), c => c.charCodeAt(0))
    for (const index of [0, 8, 12, 16, 20, 24, 25, 26, 27, 28, 29, 45, original.length - 1]) {
      const bytes = original.slice(); bytes[index] = bytes[index]! ^ 1
      expect(() => decodeAiReferencePreview({ ...preview(), base64: btoa(String.fromCharCode(...bytes)) })).toThrow(AiResourceReadError)
    }
    for (const bytes of [new Uint8Array([...original, 0]), original.slice(0, -12), original.slice(0, 33)]) expect(() => decodeAiReferencePreview({ ...preview(), base64: btoa(String.fromCharCode(...bytes)) })).toThrow(AiResourceReadError)
  })
  it('rejects excessive decoded bytes even if encoded length is just within its rounded bound', () => {
    const base64 = 'A'.repeat(AI_RESOURCE_READ_LIMITS.maxPreviewBase64Length)
    expect(() => decodeAiReferencePreview({ ...preview(), base64 })).toThrow(AiResourceReadError)
  })
  it('fails closed when Web Crypto is absent or errors, without retaining diagnostic detail', async () => {
    vi.stubGlobal('crypto', {})
    await expectCode(verifyAiReferencePreview(preview()), 'verification-unavailable')
    vi.stubGlobal('crypto', { subtle: { digest: async () => { throw Error('PRIVATE') } } })
    expect(String(await expectCode(verifyAiReferencePreview(preview()), 'verification-unavailable'))).not.toContain('PRIVATE')
  })
})

describe('transport content limits, diagnostics, cancellation and independent deadlines', () => {
  it.each([[401, 'unauthorized'], [403, 'forbidden'], [404, 'http-error'], [409, 'http-error'], [500, 'http-error'], [503, 'http-error']] as const)('maps HTTP %s locally and discards raw error bodies', async (status, code) => {
    const response = json({ code: 'PRIVATE_CODE', error: 'token=PRIVATE' }, { status }), cancel = vi.spyOn(response.body!, 'cancel')
    const error = await expectCode(createAiResourceReadProvider({ fetch: fixture(response) }).readConfig(id), code)
    expect(error.status).toBe(status); expect(error).not.toHaveProperty('cause'); expect(JSON.stringify(error)).not.toContain('PRIVATE'); expect(cancel).toHaveBeenCalledOnce()
  })
  it('scrubs transport rejection and does not retry', async () => {
    const fetch = vi.fn<AiResourceFetch>(async () => { throw Error('https://host/?token=PRIVATE') })
    const error = await expectCode(createAiResourceReadProvider({ fetch }).readConfig(id), 'network-error')
    expect(String(error)).not.toContain('PRIVATE'); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each(['redirected', 'opaque', 'opaqueredirect'])('rejects %s responses', async (kind) => {
    const response = json(view()); Object.defineProperty(response, kind === 'redirected' ? kind : 'type', { value: kind === 'redirected' ? true : kind })
    await expectCode(createAiResourceReadProvider({ fetch: fixture(response) }).readConfig(id), 'invalid-shape')
  })
  it.each(['text/html', 'text/plain', 'application/javascript', 'image/png', ''])('rejects content type %s', async (type) => {
    await expectCode(createAiResourceReadProvider({ fetch: fixture(new Response(JSON.stringify(view()), { headers: { 'Content-Type': type } })) }).readConfig(id), 'invalid-shape')
  })
  it('rejects malformed JSON, invalid UTF8, missing body and incompatible envelope', async () => {
    for (const response of [new Response('PRIVATE not json'), new Response(new Uint8Array([0xff, 0xfe])), new Response(null), json({ ok: true, data: view() })]) {
      response.headers.set('Content-Type', 'application/json')
      expect(String(await expectCode(createAiResourceReadProvider({ fetch: fixture(response) }).readConfig(id), 'invalid-shape'))).not.toContain('PRIVATE')
    }
  })
  it('reads UTF8 safely across stream boundaries', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(view())), stream = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); c.close() } })
    expect(await createAiResourceReadProvider({ fetch: fixture(new Response(stream, { headers: { 'Content-Type': 'application/json' } })) }).readConfig(id)).toEqual(view())
  })
  it.each(['resource-config', 'reference-preview'] as const)('bounds announced %s bytes and cancels without buffering', async (endpoint) => {
    const max = endpoint === 'resource-config' ? AI_RESOURCE_READ_LIMITS.maxConfigResponseBytes : AI_RESOURCE_READ_LIMITS.maxPreviewResponseBytes
    const cancel = vi.fn(), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json', 'Content-Length': String(max + 1) } })
    const provider = createAiResourceReadProvider({ fetch: fixture(response, response) })
    await expectCode(endpoint === 'resource-config' ? provider.readConfig(id) : provider.previewReference(id, 'assets/a.png'), 'response-too-large'); expect(cancel).toHaveBeenCalledOnce()
  })
  it('bounds actual bytes regardless of lying length and counts empty chunks', async () => {
    for (const mode of ['single', 'cumulative', 'chunks']) {
      const cancel = vi.fn(), response = new Response(new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(mode === 'single' ? AI_RESOURCE_READ_LIMITS.maxConfigResponseBytes + 1 : mode === 'cumulative' ? 65537 : 0)) }, cancel }), { headers: { 'Content-Type': 'application/json', 'Content-Length': '2' } })
      await expectCode(createAiResourceReadProvider({ fetch: fixture(response) }).readConfig(id), 'response-too-large'); expect(cancel).toHaveBeenCalledOnce()
    }
  })
  it('holds cancelled fetch slots and drain until late body disposal settles', async () => {
    const controllers = Array.from({ length: 3 }, () => new AbortController())
    const waits: Array<{ resolve: (response: Response) => void; cancel: () => void }> = []
    const fetch = vi.fn<AiResourceFetch>(() => {
      let finish!: (response: Response) => void, finishCancel!: () => void
      const pending = new Promise<Response>(resolve => { finish = resolve }), disposal = new Promise<void>(resolve => { finishCancel = resolve })
      const response = json(view()); Object.defineProperty(response, 'body', { value: { cancel: () => disposal } })
      waits.push({ resolve: () => finish(response), cancel: finishCancel }); return pending
    }), provider = createAiResourceReadProvider({ fetch })
    const pending = controllers.map(controller => expectCode(provider.readConfig(id, controller.signal), 'aborted'))
    await expectCode(provider.previewReference(id, 'assets/a.png'), 'busy'); expect(fetch).toHaveBeenCalledTimes(3)
    let idle = false; const drained = provider.waitForIdle!().then(() => { idle = true })
    controllers.forEach(controller => controller.abort()); await Promise.all(pending)
    await expectCode(provider.readConfig(id), 'busy'); expect(idle).toBe(false)
    waits.forEach(wait => wait.resolve(json(view()))); for (let i = 0; i < 8; i++) await Promise.resolve()
    await expectCode(provider.readConfig(id), 'busy'); expect(idle).toBe(false)
    waits.forEach(wait => wait.cancel()); await drained; expect(idle).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
  it('keeps drain pending for both non-cooperative body read and cancellation', async () => {
    vi.useFakeTimers(); let finishRead!: (value: ReadableStreamReadResult<Uint8Array>) => void, finishCancel!: () => void
    const read = new Promise<ReadableStreamReadResult<Uint8Array>>(resolve => { finishRead = resolve }), cancel = new Promise<void>(resolve => { finishCancel = resolve })
    const response = json(view()); Object.defineProperty(response, 'body', { value: { getReader: () => ({ read: () => read, cancel: () => cancel, releaseLock: () => undefined }) } })
    const provider = createAiResourceReadProvider({ fetch: fixture(response), timeoutMs: 10 }), pending = expectCode(provider.readConfig(id), 'timeout')
    await vi.advanceTimersByTimeAsync(11); await pending
    let idle = false; const drained = provider.waitForIdle!().then(() => { idle = true })
    finishRead({ done: true, value: undefined }); await vi.advanceTimersByTimeAsync(0); expect(idle).toBe(false)
    finishCancel(); await drained; expect(idle).toBe(true)
  })
  it('never dispatches pre-aborted or synchronously cancelled calls', async () => {
    const fetch = fixture(), provider = createAiResourceReadProvider({ fetch }), first = new AbortController(), second = new AbortController(); first.abort()
    await expectCode(provider.readConfig(id, first.signal), 'aborted')
    const pending = provider.previewReference(id, 'assets/a.png', second.signal); second.abort(); await expectCode(pending, 'aborted'); expect(fetch).not.toHaveBeenCalled()
  })
  it('settles on caller cancellation when fetch ignores abort and cancels a late body', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn<AiResourceFetch>().mockImplementationOnce(() => new Promise(r => { finish = r })).mockImplementation(async () => json(view()))
    const provider = createAiResourceReadProvider({ fetch }), controller = new AbortController(), rejected = expectCode(provider.readConfig(id, controller.signal), 'aborted')
    await Promise.resolve(); controller.abort(); await rejected; expect(await provider.readConfig(id)).toEqual(view())
    const cancel = vi.fn(); finish(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); expect(cancel).toHaveBeenCalledOnce()
  })
  it('bounds config headers at 4s, preview headers at 20s and stalled body independently of transport abort', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn<AiResourceFetch>(() => new Promise(() => undefined)), provider = createAiResourceReadProvider({ fetch })
    const config = expectCode(provider.readConfig(id), 'timeout'), reference = expectCode(provider.previewReference(id, 'assets/a.png'), 'timeout')
    await vi.advanceTimersByTimeAsync(3999); expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1); await config; expect(fetch.mock.calls[1]![1].signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(16000); await reference; expect(fetch).toHaveBeenCalledTimes(2)
    const cancel = vi.fn(), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } })
    const body = expectCode(createAiResourceReadProvider({ fetch: fixture(response), timeoutMs: 50 }).readConfig(id), 'timeout')
    await vi.advanceTimersByTimeAsync(50); await body; expect(cancel).toHaveBeenCalledOnce()
  })
  it('cancels stalled partial bodies without exposing buffered content', async () => {
    const cancel = vi.fn(), controller = new AbortController(), response = new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('{"PRIVATE')) }, cancel }), { headers: { 'Content-Type': 'application/json' } })
    const pending = expectCode(createAiResourceReadProvider({ fetch: fixture(response) }).readConfig(id, controller.signal), 'aborted')
    for (let i = 0; i < 8; i++) await Promise.resolve()
    controller.abort(); expect(String(await pending)).not.toContain('PRIVATE'); expect(cancel).toHaveBeenCalledOnce()
  })
  it('also bounds asynchronous digest and retains drain after timeout until verification settles', async () => {
    vi.useFakeTimers(); let finish!: (value: ArrayBuffer) => void
    const digest = vi.fn(() => new Promise<ArrayBuffer>(r => { finish = r })); vi.stubGlobal('crypto', { subtle: { digest } })
    const provider = createAiResourceReadProvider({ fetch: fixture(), timeoutMs: 50 }), pending = expectCode(provider.previewReference(id, 'assets/a.png'), 'timeout')
    await vi.advanceTimersByTimeAsync(49); expect(digest).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1); await pending
    let idle = false; const drained = provider.waitForIdle!().then(() => { idle = true }); await Promise.resolve(); expect(idle).toBe(false)
    finish(new Uint8Array(32).buffer); await drained; expect(idle).toBe(true)
  })
  it('keeps cancellation isolated between config and preview calls', async () => {
    const finish = new Map<AiResourceReadPath, (value: Response) => void>(), fetch = vi.fn<AiResourceFetch>(path => new Promise(r => { finish.set(path, r) }))
    const provider = createAiResourceReadProvider({ fetch }), controller = new AbortController(), config = expectCode(provider.readConfig(id, controller.signal), 'aborted'), reference = provider.previewReference(id, 'assets/a.png')
    await Promise.resolve(); controller.abort(); await config; expect(fetch.mock.calls[1]![1].signal?.aborted).toBe(false)
    finish.get(`/api/icons/${id}/reference-preview`)!(json(preview())); expect(await reference).toEqual(png)
    finish.get(`/api/icons/${id}/resource-config`)!(json(view()))
  })
})
