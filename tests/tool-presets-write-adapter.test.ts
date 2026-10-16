import { afterEach, describe, expect, it, vi } from 'vitest'
import { createToolPresetWriteProvider } from '../src/adapters/tool-presets-write'
import type { ToolPresetWriteFetch } from '../src/adapters/tool-presets-write'
import { decodeToolPresetWriteReceipt, ToolPresetWriteError, validateToolPresetWriteContext, validateToolPresetWriteInput } from '../src/domain/tool-presets-write'
import type { ToolPresetWriteInput, ToolPresetWriteOperation } from '../src/domain/tool-presets-write'
import type { ToolCatalogEntry, ToolPreset } from '../src/domain/tool-presets-read'
const stamp = '2026-10-15T00:00:00.000Z'
const builtins: ToolPreset[] = ['core', 'full'].map(id => ({ id, name: id === 'core' ? '核心工具' : '全部工具', baseProfile: id as 'core' | 'full', enabled: [], disabled: [], builtIn: true, updatedAt: '1970-01-01T00:00:00.000Z' }))
const custom = (id = 'custom', name = '自定义'): ToolPreset => ({ id, name, baseProfile: 'core', enabled: ['scene_save'], disabled: [], builtIn: false, updatedAt: stamp })
const tools: ToolCatalogEntry[] = [{ name: 'scene_save', displayNameZh: '保存', description: 'fixture', profile: 'full', scope: 'scene', access: 'read' }, { name: 'project_list', displayNameZh: '列表', description: 'fixture', profile: 'core', scope: 'Companion', access: 'read' }]
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const input = (operation: ToolPresetWriteOperation): ToolPresetWriteInput => ({ operation, approved: true })
const update = (): ToolPresetWriteInput => input({ kind: 'update', before: custom(), preset: { ...custom(), name: '新名称' } })
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
afterEach(() => vi.useRealTimers())
describe('tool preset legacy write contract, synthetic transport only', () => {
  it('is passive; sends only explicit legacy fields to five fixed routes with same-origin cookies', async () => {
    const replies = [response(custom('server-created', '新建'), 201), response(custom('custom', '新名称')), response(custom('imported', '导入'), 201), response(builtins[0]), response({ deleted: true, projectIds: [] })]
    const transport = vi.fn<ToolPresetWriteFetch>(async () => replies.shift()!), provider = createToolPresetWriteProvider({ fetch: transport })
    expect(transport).not.toHaveBeenCalled()
    await provider.execute(input({ kind: 'create', source: builtins[0]!, preset: custom('draft', '新建') }))
    await provider.execute(update())
    await provider.execute(input({ kind: 'import', presets: [custom('imported', '导入'), custom('second', '第二')] }))
    await provider.execute(input({ kind: 'assign', projectId: 'project-1', previous: builtins[1]!, preset: builtins[0]! }))
    await provider.execute(input({ kind: 'delete', preset: custom() }))
    expect(transport.mock.calls.map(([path, init]) => [path, init.method])).toEqual([['/api/tool-presets', 'POST'], ['/api/tool-presets/custom', 'PATCH'], ['/api/tool-presets/import', 'POST'], ['/api/projects/project-1/tool-preset', 'POST'], ['/api/tool-presets/custom', 'DELETE']])
    for (const [, init] of transport.mock.calls) expect(init).toMatchObject({ mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store' })
    expect(JSON.parse(transport.mock.calls[0]![1].body as string)).toEqual({ name: '新建', baseProfile: 'core', enabled: ['scene_save'], disabled: [] })
    expect(JSON.parse(transport.mock.calls[2]![1].body as string).presets).toHaveLength(2)
    expect(JSON.parse(transport.mock.calls[3]![1].body as string)).toEqual({ presetId: 'core' })
    expect(transport.mock.calls[4]![1].body).toBeUndefined()
    expect(JSON.stringify(transport.mock.calls)).not.toContain('confirm=true')
  })
  it('rejects missing approval, built-in writes, extra fields, paths, duplicate imports and size before dispatch', async () => {
    const transport = vi.fn<ToolPresetWriteFetch>(), provider = createToolPresetWriteProvider({ fetch: transport })
    const invalid = [ { ...update(), approved: false }, input({ kind: 'delete', preset: builtins[0]! }), input({ kind: 'update', before: custom(), preset: { ...custom(), id: 'other' } }), { ...update(), token: 'never-send' }, input({ kind: 'assign', projectId: '../../outside', previous: builtins[0]!, preset: builtins[1]! }), input({ kind: 'import', presets: [custom(), custom()] }), input({ kind: 'delete', preset: { ...custom(), name: 'x'.repeat(41) } }) ]
    for (const value of invalid) await expect(provider.execute(value as ToolPresetWriteInput)).rejects.toMatchObject({ outcome: 'not-sent' })
    expect(transport).not.toHaveBeenCalled()
  })
  it('rejects unknown tools, duplicate names, unregistered assignment and stale before snapshots locally', () => {
    const snapshot = { presets: [...builtins, custom()], selectedPresetId: 'full' }
    const reject = (operation: ToolPresetWriteOperation) => expect(() => validateToolPresetWriteContext(operation, tools, snapshot, ['p1'])).toThrow()
    reject({ kind: 'create', source: builtins[0]!, preset: custom('new') })
    reject({ kind: 'import', presets: [{ ...custom('new', '另一个'), enabled: ['unknown'] }] })
    reject({ kind: 'update', before: { ...custom(), updatedAt: '2026-10-14T00:00:00.000Z' }, preset: custom() })
    reject({ kind: 'assign', projectId: 'not-registered', previous: builtins[1]!, preset: builtins[0]! })
    reject({ kind: 'assign', projectId: 'p1', previous: builtins[0]!, preset: builtins[1]! })
    expect(() => validateToolPresetWriteContext({ kind: 'update', before: custom(), preset: { ...custom(), name: '已改名' } }, tools, snapshot, ['p1'])).not.toThrow()
    const full = Array.from({ length: 20 }, (_, i) => custom(`c${i}`, `名称${i}`))
    expect(() => validateToolPresetWriteContext({ kind: 'import', presets: [custom('new', '新增')] }, tools, { presets: [...builtins, ...full], selectedPresetId: 'full' }, [])).toThrow()
  })
  it('freezes each request before dispatch; no caller mutation changes the wire body', async () => {
    const transport = vi.fn<ToolPresetWriteFetch>(async () => response(custom('custom', '新名称'))), provider = createToolPresetWriteProvider({ fetch: transport })
    const value = update(), pending = provider.execute(value)
    if (value.operation.kind === 'update') { value.operation.preset.name = '晚到改名'; value.operation.preset.enabled.push('unknown') }
    await pending
    expect(JSON.parse(transport.mock.calls[0]![1].body as string).name).toBe('新名称')
  })
  it('requires exact corresponding receipts and does not call a malformed response success', async () => {
    const bad = [response(custom('wrong', '新名称')), response({ ...custom('custom', '新名称'), enabled: [] }), response(custom('custom', '新名称'), 201), new Response('secret error', { status: 500 }), new Response('[]', { headers: { 'Content-Type': 'application/json' } })]
    for (const value of bad) await expect(createToolPresetWriteProvider({ fetch: async () => value }).execute(update())).rejects.toMatchObject({ outcome: 'unknown' })
    expect(() => decodeToolPresetWriteReceipt({ deleted: true, projectIds: ['p1'] }, { kind: 'delete', preset: custom() })).toThrow(ToolPresetWriteError)
  })
  it('uses only the non-forced deletion contract; validated in-use IDs are rejected without exposing raw errors', async () => {
    const transport = vi.fn<ToolPresetWriteFetch>(async () => response({ error: 'secret path/token', projectIds: ['p1', 'p2'] }, 409)), provider = createToolPresetWriteProvider({ fetch: transport })
    const error = await provider.execute(input({ kind: 'delete', preset: custom() })).catch(error => error)
    expect(error).toMatchObject({ code: 'in-use', outcome: 'rejected', projectIds: ['p1', 'p2'] })
    expect(error.message).not.toContain('secret'); expect(error.message).toContain('回退 full')
    expect(transport).toHaveBeenCalledTimes(1); expect(transport.mock.calls[0]![0]).toBe('/api/tool-presets/custom')
  })
  it('does not classify malformed 409/500 bodies as proof of no write', async () => {
    for (const reply of [response({ projectIds: ['../evil'] }, 409), response({ projectIds: [] }, 409), response({ error: 'written but chmod failed' }, 500)]) await expect(createToolPresetWriteProvider({ fetch: async () => reply }).execute(input({ kind: 'delete', preset: custom() }))).rejects.toMatchObject({ outcome: 'unknown' })
  })
  it('treats 401/403 as pre-route rejection and sanitizes transport failures', async () => {
    for (const status of [401, 403]) await expect(createToolPresetWriteProvider({ fetch: async () => response({ secret: 'never reflect' }, status) }).execute(update())).rejects.toMatchObject({ outcome: 'rejected', status })
    const error = await createToolPresetWriteProvider({ fetch: async () => { throw new Error('TOKEN-secret') } }).execute(update()).catch(error => error)
    expect(error.message).not.toContain('TOKEN-secret'); expect(error.outcome).toBe('unknown')
  })
  it('cancels synchronously before dispatch and retains fetch lease after timeout until actual settlement', async () => {
    vi.useFakeTimers()
    const controller = new AbortController(), transport = vi.fn<ToolPresetWriteFetch>(), first = createToolPresetWriteProvider({ fetch: transport })
    const before = first.execute(update(), controller.signal).catch(error => error); controller.abort()
    expect((await before).outcome).toBe('not-sent'); expect(transport).not.toHaveBeenCalled()
    let resolve!: (response: Response) => void
    const slow = vi.fn<ToolPresetWriteFetch>(() => new Promise(r => { resolve = r })), provider = createToolPresetWriteProvider({ fetch: slow, timeoutMs: 10 })
    const pending = provider.execute(update()).catch(error => error); await tick(); await vi.advanceTimersByTimeAsync(11)
    expect(await pending).toMatchObject({ code: 'timeout', outcome: 'unknown' })
    await expect(provider.execute(update())).rejects.toMatchObject({ code: 'busy', outcome: 'not-sent' })
    let idle = false; void provider.waitForIdle().then(() => { idle = true }); await tick(); expect(idle).toBe(false)
    resolve(response(custom('custom', '新名称'))); await provider.waitForIdle(); expect(idle).toBe(true); expect(slow).toHaveBeenCalledTimes(1)
  })
  it('retains its lease for hung body reads AND cancellation after headers returned', async () => {
    vi.useFakeTimers()
    let finishRead!: (value: ReadableStreamReadResult<Uint8Array>) => void, finishCancel!: () => void
    const read = vi.fn(() => new Promise<ReadableStreamReadResult<Uint8Array>>(resolve => { finishRead = resolve })), cancel = vi.fn(() => new Promise<void>(resolve => { finishCancel = resolve }))
    const fakeResponse = { status: 200, redirected: false, type: 'basic', headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({ read, cancel, releaseLock: vi.fn() }) } } as unknown as Response
    const transport = vi.fn<ToolPresetWriteFetch>(async () => fakeResponse), provider = createToolPresetWriteProvider({ fetch: transport, timeoutMs: 10 })
    const pending = provider.execute(update()).catch(error => error); await tick(); await vi.advanceTimersByTimeAsync(11)
    expect(await pending).toMatchObject({ code: 'timeout', outcome: 'unknown' }); expect(cancel).toHaveBeenCalledTimes(1)
    let idle = false; void provider.waitForIdle().then(() => { idle = true })
    finishCancel(); await tick(); expect(idle).toBe(false)
    await expect(provider.execute(update())).rejects.toMatchObject({ code: 'busy' })
    finishRead({ done: true, value: undefined }); await provider.waitForIdle(); expect(idle).toBe(true)
  })
  it('retains discarded late-response body cancellation until it settles', async () => {
    vi.useFakeTimers(); let finishFetch!: (value: Response) => void, finishCancel!: () => void
    const provider = createToolPresetWriteProvider({ fetch: () => new Promise(resolve => { finishFetch = resolve }), timeoutMs: 10 })
    const pending = provider.execute(update()).catch(error => error); await tick(); await vi.advanceTimersByTimeAsync(11); await pending
    finishFetch({ body: { cancel: () => new Promise<void>(resolve => { finishCancel = resolve }) } } as unknown as Response); await tick()
    await expect(provider.execute(update())).rejects.toMatchObject({ code: 'busy' }); finishCancel(); await provider.waitForIdle()
  })
  it('bounds content length, actual UTF-8 bytes, chunks and malformed UTF-8', async () => {
    const oversizedHeader = new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '1048577' } })
    await expect(createToolPresetWriteProvider({ fetch: async () => oversizedHeader }).execute(update())).rejects.toMatchObject({ code: 'response-too-large', outcome: 'unknown' })
    for (const chunks of [[new Uint8Array(1_048_577)], Array.from({ length: 2049 }, () => new Uint8Array()), [new Uint8Array([255])]]) {
      const stream = new ReadableStream<Uint8Array>({ start(controller) { chunks.forEach(chunk => controller.enqueue(chunk)); controller.close() } })
      const response = new Response(stream, { headers: { 'content-type': 'application/json' } })
      await expect(createToolPresetWriteProvider({ fetch: async () => response }).execute(update())).rejects.toMatchObject({ outcome: 'unknown' })
    }
  })
  it('revalidates source and reserved field semantics at the public domain boundary', () => {
    expect(() => validateToolPresetWriteInput(input({ kind: 'create', source: builtins[0]!, preset: { ...custom(), name: 'full' } }))).toThrow()
    expect(() => validateToolPresetWriteInput(input({ kind: 'import', presets: [{ ...custom(), enabled: ['scene_save', 'scene_save'] }] }))).toThrow()
    expect(() => validateToolPresetWriteInput(input({ kind: 'import', presets: [{ ...custom(), disabled: ['scene_save'] }] }))).toThrow()
  })
})
