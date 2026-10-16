import { afterEach, describe, expect, it, vi } from 'vitest'
import { createToolPresetReadProvider, TOOL_PRESET_READ_LIMITS, ToolPresetReadError } from '../src/adapters/tool-presets-read'
import type { ToolPresetFetch, ToolPresetReadPath } from '../src/adapters/tool-presets-read'
import { decodeToolCatalog, decodeToolPreset, decodeToolPresetExport, decodeToolPresetRead, effectiveToolNames, serializeToolPresetExport, validateToolPresetCatalog } from '../src/domain/tool-presets-read'
import type { ToolCatalogEntry, ToolPreset, ToolPresetReadCode } from '../src/domain/tool-presets-read'

const stamp = '2026-10-13T05:00:00.000Z'
const core: ToolPreset = { id: 'core', name: '核心工具', baseProfile: 'core', enabled: [], disabled: [], builtIn: true, updatedAt: '1970-01-01T00:00:00.000Z' }
const full: ToolPreset = { ...core, id: 'full', name: '全部工具', baseProfile: 'full' }
const custom: ToolPreset = { id: 'preset-one', name: '场景阅读', baseProfile: 'core', enabled: ['asset_write'], disabled: ['scene_get_tree'], builtIn: false, updatedAt: stamp }
const tools: ToolCatalogEntry[] = [
  { name: 'scene_get_tree', displayNameZh: '读取场景树', description: 'Read the active scene', profile: 'core', scope: 'scene', access: 'read' },
  { name: 'asset_write', displayNameZh: '写入资产', description: 'Write an asset', profile: 'full', scope: 'asset', access: 'write' },
  // v148's name heuristic marks this read, although the operation can change editor selection.
  { name: 'editor_set_selection', displayNameZh: '设置选中', description: 'Set selection', profile: 'full', scope: 'editor', access: 'read' },
]
const read = { presets: [core, full, custom], selectedPresetId: custom.id }
const exported = { schemaVersion: 1, presets: [custom] }
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } })
function fixture(overrides: Partial<Record<'tools' | 'presets' | 'export', unknown>> = {}) {
  const values = { tools, presets: read, export: exported, ...overrides }
  return vi.fn<ToolPresetFetch>(async (path) => {
    const value = values[path === '/api/tools' ? 'tools' : path.endsWith('/export') ? 'export' : 'presets']
    return value instanceof Response ? value : json(value)
  })
}
async function expectCode(pending: Promise<unknown>, code: ToolPresetReadCode) {
  const error = await pending.then(() => { throw new Error('Expected rejection') }, (error: unknown) => error)
  expect(error).toBeInstanceOf(ToolPresetReadError)
  expect(error).toMatchObject({ code })
  return error as ToolPresetReadError
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('fixed v148 tool-range read surface', () => {
  it('is inert until explicit use and exposes only the three approved reads', async () => {
    const fetch = fixture(), provider = createToolPresetReadProvider({ fetch })
    expect(fetch).not.toHaveBeenCalled()
    expect(Object.keys(provider).sort()).toEqual(['exportPreset', 'label', 'loadPresets', 'loadTools'])
    expect(Object.isFrozen(provider)).toBe(true)
    expect(await provider.loadTools()).toEqual(tools)
    expect(await provider.loadPresets(undefined)).toEqual(read)
    expect(await provider.loadPresets('project-1.v2_test')).toEqual(read)
    expect(await provider.exportPreset(custom.id)).toEqual(exported)
    expect(fetch.mock.calls.map(([path]) => path)).toEqual(['/api/tools', '/api/tool-presets', '/api/tool-presets?projectId=project-1.v2_test', '/api/tool-presets/preset-one/export'])
    for (const [path, init] of fetch.mock.calls) {
      expect(path).not.toMatch(/https?:|\/import|\/select|\/manage|token|password/)
      expect(init).toMatchObject({ method: 'GET', mode: 'same-origin', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } })
      expect(init.body).toBeUndefined()
      expect(init.signal).toBeInstanceOf(AbortSignal)
      expect(new Headers(init.headers).get('authorization')).toBeNull()
      expect(new Headers(init.headers).get('cookie')).toBeNull()
    }
  })
  it('requires explicit fetch injection and never touches global fetch during construction or validation', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(() => createToolPresetReadProvider(undefined as never)).toThrow(TypeError)
    expect(() => createToolPresetReadProvider({} as never)).toThrow(TypeError)
    createToolPresetReadProvider({ fetch: fixture() })
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['', ' ', '../p', 'a/b', 'a?token=x', 'a#b', '//other', 'https://other', '中文', 'p\n1', 'a%2fb', '-p', 'x'.repeat(129), null, 1])('rejects invalid project IDs before transport: %#', async (id) => {
    const fetch = fixture()
    await expectCode(createToolPresetReadProvider({ fetch }).loadPresets(id as string), 'invalid-query')
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['', ' ', '../p', 'a/b', 'a?token=x', 'a.b', 'p\n1', 'x'.repeat(81), null, 1])('rejects invalid preset IDs before transport: %#', async (id) => {
    const fetch = fixture()
    await expectCode(createToolPresetReadProvider({ fetch }).exportPreset(id as string), 'invalid-query')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('strictly projects nested and envelope extras, including exports before serialization', async () => {
    const fetch = fixture({
      tools: tools.map((tool) => ({ ...tool, token: 'PRIVATE', schema: { secret: 'PRIVATE' }, permissions: 'full-control' })),
      presets: { ...read, presets: read.presets.map((preset) => ({ ...preset, hidden: 'PRIVATE' })), projectSelections: { unrelated: 'PRIVATE' } },
      export: { ...exported, presets: [{ ...custom, password: 'PRIVATE', enabledRaw: ['PRIVATE'] }], secret: 'PRIVATE' },
    })
    const provider = createToolPresetReadProvider({ fetch })
    expect(await provider.loadTools()).toEqual(tools)
    expect(await provider.loadPresets('p1')).toEqual(read)
    expect(await provider.exportPreset(custom.id)).toEqual(exported)
    expect(serializeToolPresetExport({ ...exported, raw: 'PRIVATE', presets: [{ ...custom, token: 'PRIVATE' }] })).toBe(`${JSON.stringify(exported, null, 2)}\n`)
  })
  it('returns fresh independent arrays rather than retaining caller-mutable schema input', () => {
    const decoded = decodeToolPresetRead(read)
    decoded.presets[2]!.enabled.push('another')
    expect(custom.enabled).toEqual(['asset_write'])
    const result = decodeToolPresetExport(exported)
    result.presets[0]!.disabled.length = 0
    expect(custom.disabled).toEqual(['scene_get_tree'])
  })
  it('does not invent registration or permissions from a successful arbitrary project lookup', async () => {
    const result = await createToolPresetReadProvider({ fetch: fixture() }).loadPresets('unregistered-project')
    expect(Object.keys(result).sort()).toEqual(['presets', 'selectedPresetId'])
    expect(result).not.toHaveProperty('project')
    expect(tools[2]!.access).toBe('read')
    expect(effectiveToolNames(full, tools).has('asset_write')).toBe(true)
    expect(result).not.toHaveProperty('capabilityProfile')
  })
})

describe('tool catalog and full preset schema validation', () => {
  it('accepts synthetic 117-row current-size and 512-row bounded catalogs', () => {
    for (const count of [117, 512]) expect(decodeToolCatalog(Array.from({ length: count }, (_, index) => ({ ...tools[0], name: `tool_${index}` })))).toHaveLength(count)
  })
  it.each([
    null, {}, [], [tools[0], tools[0]], Array.from({ length: 513 }, (_, index) => ({ ...tools[0], name: `tool_${index}` })),
    [{ ...tools[0], name: '' }], [{ ...tools[0], name: 'bad/tool' }], [{ ...tools[0], name: 'x'.repeat(129) }],
    [{ ...tools[0], profile: 'administrator' }], [{ ...tools[0], access: 'execute' }], [{ ...tools[0], access: true }],
    [{ ...tools[0], displayNameZh: undefined }], [{ ...tools[0], scope: '' }], [{ ...tools[0], scope: 'x\nsecret' }],
    [{ ...tools[0], description: 'x\u0000secret' }], [{ ...tools[0], description: 'x'.repeat(8193) }], [{ ...tools[0], displayNameZh: '\u202esecret' }],
  ])('rejects malformed/empty/duplicate/unknown tool catalog %#', async (value) => {
    await expectCode(createToolPresetReadProvider({ fetch: fixture({ tools: value }) }).loadTools(), 'invalid-shape')
  })
  it.each([
    null, [], {}, { ...custom, id: '' }, { ...custom, id: 'x'.repeat(81) }, { ...custom, id: 'a/b' },
    { ...custom, name: '' }, { ...custom, name: ' '.repeat(2) }, { ...custom, name: ' trim ' }, { ...custom, name: 'x'.repeat(41) },
    { ...custom, name: 'cOrE' }, { ...custom, name: 'FuLl' }, { ...custom, baseProfile: 'future' }, { ...custom, builtIn: undefined },
    { ...custom, enabled: ['asset_write', 'asset_write'] }, { ...custom, disabled: ['scene_get_tree', 'scene_get_tree'] },
    { ...custom, enabled: ['scene_get_tree'] }, { ...custom, enabled: 'asset_write' }, { ...custom, enabled: ['bad/name'] },
    { ...custom, disabled: Array.from({ length: 513 }, (_, index) => `tool_${index}`) },
    { ...custom, updatedAt: 'yesterday' }, { ...custom, updatedAt: '2026-02-30T00:00:00Z' }, { ...custom, updatedAt: '2025-02-29T00:00:00Z' },
    { ...custom, updatedAt: '2026-10-13T24:00:00Z' }, { ...custom, updatedAt: '2026-10-13T00:00:60Z' }, { ...custom, updatedAt: '2026-10-13T00:00:00+08:00' },
    { ...custom, updatedAt: '2026-00-13T00:00:00Z' }, { ...custom, updatedAt: '2026-13-13T00:00:00Z' },
    { ...custom, builtIn: true }, { ...custom, id: 'core' }, { ...core, builtIn: false }, { ...core, name: 'Core' },
    { ...core, baseProfile: 'full' }, { ...core, enabled: ['asset_write'] }, { ...core, updatedAt: stamp }, { ...full, disabled: ['scene_get_tree'] },
  ])('rejects malformed or contradictory preset %#', (value) => {
    expect(() => decodeToolPreset(value)).toThrow(ToolPresetReadError)
  })
  it('accepts real UTC date precision from the original z.iso.datetime schema', () => {
    for (const updatedAt of ['2024-02-29T00:00Z', '2026-10-13T01:02:03Z', '2026-10-13T01:02:03.123456Z']) expect(decodeToolPreset({ ...custom, updatedAt }).updatedAt).toBe(updatedAt)
  })
  it.each([
    null, {}, { presets: [], selectedPresetId: 'full' }, { presets: [core], selectedPresetId: 'core' },
    { presets: [full], selectedPresetId: 'full' }, { presets: [core, full, custom, custom], selectedPresetId: 'full' },
    { presets: [core, full, custom, { ...custom, id: 'other', name: custom.name.toUpperCase() }], selectedPresetId: 'full' },
    { presets: [core, full, { ...custom, name: 'My Tools' }, { ...custom, id: 'other', name: 'my tools' }], selectedPresetId: 'full' },
    { presets: [core, full, custom], selectedPresetId: 'missing' }, { presets: [core, full], selectedPresetId: undefined },
    { presets: [core, full, ...Array.from({ length: 21 }, (_, index) => ({ ...custom, id: `preset-${index}`, name: `Preset ${index}` }))], selectedPresetId: 'full' },
  ])('rejects invalid lists, duplicates, missing builtins and stale selection %#', async (value) => {
    await expectCode(createToolPresetReadProvider({ fetch: fixture({ presets: value }) }).loadPresets('p1'), 'invalid-shape')
  })
  it('accepts exactly twenty custom presets plus both builtins', () => {
    const presets = [core, full, ...Array.from({ length: 20 }, (_, index) => ({ ...custom, id: `preset-${index}`, name: `Preset ${index}` }))]
    expect(decodeToolPresetRead({ presets, selectedPresetId: 'full' }).presets).toHaveLength(22)
  })
  it('preserves the original allowance for custom names equal to builtin Chinese labels', () => {
    const presets = [core, full, { ...custom, name: '核心工具' }, { ...custom, id: 'custom-full', name: '全部工具' }]
    expect(decodeToolPresetRead({ presets, selectedPresetId: 'custom-full' })).toEqual({ presets, selectedPresetId: 'custom-full' })
  })
  it('validates lexical schema without catalog, then rejects either enabled or disabled unknown references', () => {
    for (const changed of [{ ...custom, enabled: ['unknown_tool'] }, { ...custom, disabled: ['unknown_tool'] }]) {
      expect(decodeToolPresetRead({ ...read, presets: [core, full, changed] }).presets[2]).toEqual(changed)
      expect(() => validateToolPresetCatalog(changed, tools)).toThrow(expect.objectContaining({ code: 'unknown-tool' }))
      expect(() => effectiveToolNames(changed, tools)).toThrow(expect.objectContaining({ code: 'unknown-tool' }))
    }
  })
  it('computes the original visibility union and differences without a permission interpretation', () => {
    expect([...effectiveToolNames(core, tools)]).toEqual(['scene_get_tree'])
    expect([...effectiveToolNames(full, tools)]).toEqual(tools.map((tool) => tool.name))
    expect([...effectiveToolNames(custom, tools)]).toEqual(['asset_write'])
    expect([...effectiveToolNames({ ...custom, baseProfile: 'full' }, tools)]).toEqual(['asset_write', 'editor_set_selection'])
    expect(() => effectiveToolNames(full, [])).toThrow(ToolPresetReadError)
    expect(() => effectiveToolNames({ ...custom, baseProfile: 'future' } as never, tools)).toThrow(ToolPresetReadError)
    expect(() => effectiveToolNames(full, [tools[0]!, tools[0]!])).toThrow(ToolPresetReadError)
    expect(custom.enabled).toEqual(['asset_write'])
  })
})

describe('single-preset projected export', () => {
  it('accepts custom export unchanged and the original builtin-to-custom clone semantics', async () => {
    expect(await createToolPresetReadProvider({ fetch: fixture() }).exportPreset(custom.id)).toEqual(exported)
    for (const source of [core, full]) {
      const clone = { ...source, id: 'preset-12345678-1234-1234-1234-123456789abc', name: `${source.name} copy`, builtIn: false, updatedAt: stamp }
      const value = { schemaVersion: 1, presets: [clone] }
      expect(await createToolPresetReadProvider({ fetch: fixture({ export: value }) }).exportPreset(source.id)).toEqual(value)
      expect(clone.id).not.toBe(source.id)
    }
  })
  it.each([
    null, {}, { schemaVersion: '1', presets: [custom] }, { schemaVersion: 2, presets: [custom] },
    { schemaVersion: 1, presets: [] }, { schemaVersion: 1, presets: [custom, custom] }, { schemaVersion: 1, presets: [core] },
    { schemaVersion: 1, presets: [{ ...custom, builtIn: true }] }, { schemaVersion: 1, presets: [{ ...custom, id: 'full' }] },
  ])('rejects unsupported versions and non-single-custom exports %#', async (value) => {
    await expectCode(createToolPresetReadProvider({ fetch: fixture({ export: value }) }).exportPreset('full'), 'invalid-shape')
    expect(() => serializeToolPresetExport(value)).toThrow(ToolPresetReadError)
  })
})

describe('transport bounds, safe failures and cancellation', () => {
  it.each([401, 403, 404, 429, 500])('uses fixed safe messages for HTTP %s without reading the failure body', async (status) => {
    const cancel = vi.fn(), body = new ReadableStream<Uint8Array>({ cancel })
    const response = new Response(body, { status, headers: { 'Content-Type': 'application/json' } })
    const error = await expectCode(createToolPresetReadProvider({ fetch: fixture({ tools: response }) }).loadTools(), status === 401 ? 'unauthorized' : status === 403 ? 'forbidden' : 'http-error')
    expect(error.status).toBe(status)
    expect(error).not.toHaveProperty('cause')
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('never reflects transport exception or backend diagnostics', async () => {
    const network = await expectCode(createToolPresetReadProvider({ fetch: async () => { throw new Error('token=PRIVATE; file=C:/private') } }).loadTools(), 'network-error')
    const server = await expectCode(createToolPresetReadProvider({ fetch: fixture({ tools: json({ error: 'password=PRIVATE' }, { status: 500 }) }) }).loadTools(), 'http-error')
    expect(String(network) + JSON.stringify(network) + String(server) + JSON.stringify(server)).not.toMatch(/PRIVATE|password|token|C:\//)
  })
  it.each([
    () => new Response('[]', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response(''), () => new Response(null, { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    () => new Response(new Uint8Array([0xff, 0xfe]), { headers: { 'Content-Type': 'application/json' } }),
    () => new Response(new Uint8Array([0xe4, 0xb8]), { headers: { 'Content-Type': 'application/json' } }),
  ])('rejects unsupported MIME, empty/null body, malformed JSON and invalid/truncated UTF-8 %#', async (response) => {
    await expectCode(createToolPresetReadProvider({ fetch: fixture({ tools: response() }) }).loadTools(), 'invalid-shape')
  })
  it.each(['redirected', 'opaque', 'opaqueredirect'])('rejects %s injected responses despite the fetch redirect restriction', async (kind) => {
    const response = json(tools)
    Object.defineProperty(response, kind === 'redirected' ? kind : 'type', { value: kind === 'redirected' ? true : kind })
    await expectCode(createToolPresetReadProvider({ fetch: fixture({ tools: response }) }).loadTools(), 'invalid-shape')
  })
  it('reads valid multibyte UTF-8 across split stream chunks', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(tools))
    const stream = new ReadableStream<Uint8Array>({ start(controller) { for (let offset = 0; offset < bytes.length; offset += 7) controller.enqueue(bytes.slice(offset, offset + 7)); controller.close() } })
    expect(await createToolPresetReadProvider({ fetch: fixture({ tools: new Response(stream, { headers: { 'Content-Type': 'application/json' } }) }) }).loadTools()).toEqual(tools)
  })
  it('rejects announced excessive size and cancels without buffering', async () => {
    const cancel = vi.fn(), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json', 'Content-Length': String(TOOL_PRESET_READ_LIMITS.maxResponseBytes + 1) } })
    await expectCode(createToolPresetReadProvider({ fetch: fixture({ tools: response }) }).loadTools(), 'response-too-large')
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('rejects one oversized frame independently of a lying content length', async () => {
    const cancel = vi.fn(), response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(TOOL_PRESET_READ_LIMITS.maxResponseBytes + 1)) }, cancel }), { headers: { 'Content-Type': 'application/json', 'Content-Length': '2' } })
    await expectCode(createToolPresetReadProvider({ fetch: fixture({ tools: response }) }).loadTools(), 'response-too-large')
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('enforces cumulative bytes and a chunk budget including empty frames', async () => {
    for (const mode of ['bytes', 'chunks']) {
      const cancel = vi.fn()
      const response = new Response(new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(mode === 'bytes' ? 524289 : 0)) }, cancel }), { headers: { 'Content-Type': 'application/json' } })
      await expectCode(createToolPresetReadProvider({ fetch: fixture({ tools: response }) }).loadTools(), 'response-too-large')
      expect(cancel).toHaveBeenCalledOnce()
    }
  })
  it('allows exactly three independent requests and rejects the fourth without dispatch', async () => {
    const finish: Array<(value: Response) => void> = []
    const fetch = vi.fn<ToolPresetFetch>(() => new Promise((resolve) => finish.push(resolve)))
    const provider = createToolPresetReadProvider({ fetch })
    const first = provider.loadTools(), second = provider.loadPresets('p1'), third = provider.exportPreset(custom.id)
    await expectCode(provider.loadTools(), 'busy')
    expect(fetch).toHaveBeenCalledTimes(3)
    finish[0]!(json(tools)); finish[1]!(json(read)); finish[2]!(json(exported))
    await Promise.all([first, second, third])
  })
  it('does not dispatch already-aborted requests or synchronous caller cancellation', async () => {
    const fetch = fixture(), provider = createToolPresetReadProvider({ fetch }), first = new AbortController(), second = new AbortController()
    first.abort()
    await expectCode(provider.loadTools(first.signal), 'aborted')
    const pending = provider.loadPresets('p1', second.signal); second.abort()
    await expectCode(pending, 'aborted')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('settles cancellation when fetch ignores abort, releases its slot and cancels late bodies', async () => {
    let finish!: (value: Response) => void
    const fetch = vi.fn<ToolPresetFetch>().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockImplementation(async () => json(tools))
    const provider = createToolPresetReadProvider({ fetch }), controller = new AbortController(), pending = provider.loadTools(controller.signal)
    const rejected = expectCode(pending, 'aborted')
    await Promise.resolve(); controller.abort(); await rejected
    expect(await provider.loadTools()).toEqual(tools)
    const cancel = vi.fn(); finish(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } }))
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('cancels a stalled stream and never exposes its partial body', async () => {
    const cancel = vi.fn(), controller = new AbortController()
    const response = new Response(new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode('[{"name":"PRIVATE')) }, cancel }), { headers: { 'Content-Type': 'application/json' } })
    const pending = createToolPresetReadProvider({ fetch: fixture({ tools: response }) }).loadTools(controller.signal)
    const rejected = expectCode(pending, 'aborted')
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); controller.abort()
    expect(String(await rejected)).not.toContain('PRIVATE')
    expect(cancel).toHaveBeenCalledOnce()
  })
  it('bounds both stalled headers and stalled bodies at four seconds with no retry', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn<ToolPresetFetch>(() => new Promise(() => undefined)), provider = createToolPresetReadProvider({ fetch })
    const rejected = expectCode(provider.loadTools(), 'timeout')
    await vi.advanceTimersByTimeAsync(3999); expect(fetch).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1); await rejected
    expect(fetch).toHaveBeenCalledOnce()
    const cancel = vi.fn(), response = new Response(new ReadableStream<Uint8Array>({ cancel }), { headers: { 'Content-Type': 'application/json' } })
    const bodyRejected = expectCode(createToolPresetReadProvider({ fetch: fixture({ tools: response }) }).loadTools(), 'timeout')
    await vi.advanceTimersByTimeAsync(4000); await bodyRejected
    expect(cancel).toHaveBeenCalledOnce()
  })
  it.each([0, -1, NaN, Infinity, 4001])('rejects unsafe timeout configuration %s', (timeoutMs) => {
    expect(() => createToolPresetReadProvider({ fetch: fixture(), timeoutMs })).toThrow(RangeError)
  })
  it('does not allow cancellation of one call to cancel another in-flight endpoint', async () => {
    const finish = new Map<ToolPresetReadPath, (value: Response) => void>()
    const fetch = vi.fn<ToolPresetFetch>((path) => new Promise((resolve) => { finish.set(path, resolve) }))
    const provider = createToolPresetReadProvider({ fetch }), controller = new AbortController()
    const toolsCall = expectCode(provider.loadTools(controller.signal), 'aborted'), presetsCall = provider.loadPresets('p1')
    await Promise.resolve(); controller.abort(); await toolsCall
    const presetSignal = fetch.mock.calls.find(([path]) => path.startsWith('/api/tool-presets'))![1].signal!
    expect(presetSignal.aborted).toBe(false)
    finish.get('/api/tool-presets?projectId=p1')!(json(read)); expect(await presetsCall).toEqual(read)
    finish.get('/api/tools')!(json(tools))
  })
})
