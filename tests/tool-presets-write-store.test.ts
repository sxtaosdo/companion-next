import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createToolPresetWriteProvider } from '../src/adapters/tool-presets-write'
import { useToolPresetsWriteStore } from '../src/stores/tool-presets-write'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import type { ToolPresetWriteContext } from '../src/stores/tool-presets-write'
import { ToolPresetWriteError } from '../src/domain/tool-presets-write'
import type { ToolPresetWriteProvider, ToolPresetWriteReceipt } from '../src/domain/tool-presets-write'
import type { ToolCatalogEntry, ToolPreset, ToolPresetReadProvider } from '../src/domain/tool-presets-read'
const builtins: ToolPreset[] = ['core', 'full'].map(id => ({ id, name: id === 'core' ? '核心工具' : '全部工具', baseProfile: id as 'core' | 'full', enabled: [], disabled: [], builtIn: true, updatedAt: '1970-01-01T00:00:00.000Z' }))
const custom = (id = 'custom', name = '自定义'): ToolPreset => ({ id, name, baseProfile: 'core', enabled: ['scene_save'], disabled: [], builtIn: false, updatedAt: '2026-10-15T00:00:00.000Z' })
const tools: ToolCatalogEntry[] = [{ name: 'scene_save', displayNameZh: '保存', description: 'fixture', profile: 'full', scope: 'scene', access: 'read' }]
function fixture() {
  const reader: ToolPresetReadProvider = { label: '原同源宿主', loadTools: vi.fn(async () => tools), loadPresets: vi.fn(async () => ({ presets: [...builtins, custom()], selectedPresetId: 'full' })), exportPreset: vi.fn() }
  const writer: ToolPresetWriteProvider = { label: 'writer', execute: vi.fn(async input => ({ kind: 'preset' as const, preset: input.operation.kind === 'import' ? input.operation.presets[0]! : input.operation.preset, batchSize: input.operation.kind === 'import' ? input.operation.presets.length : 1 })), waitForIdle: vi.fn(async () => undefined) }
  const projectProvider = { label: '登记源', loadProjects: vi.fn(), loadLogs: vi.fn(), loadCounts: vi.fn(), loadCalls: vi.fn() } satisfies CompanionBrowserProvider
  const context: ToolPresetWriteContext = { reader, writer, projectId: 'p1', registeredProjects: [{ id: 'p1', name: '甲工程', path: '/A' }, { id: 'p2', name: '乙工程', path: '/B' }], registrationProvider: projectProvider, expectedRegistrationProvider: projectProvider, registrationRevision: 1, tools: [...tools], presets: [...builtins, custom()], selectedPresetId: 'full', previewPresetId: 'custom', toolsReady: true, presetsReady: true, loading: false, draftRevision: 0 }
  const store = useToolPresetsWriteStore(); store.syncContext(context)
  return { reader, writer, context, store }
}
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => vi.useRealTimers())
describe('tool preset writes freeze confirmation and isolate uncertain outcomes', () => {
  it('never writes on initialization, prepare, false approval or a forged plan', async () => {
    const { store, writer } = fixture(), plan = store.prepareRename('新名称')!
    expect(plan).toBeDefined(); expect(Object.isFrozen(plan.operation)).toBe(true)
    expect(writer.execute).not.toHaveBeenCalled()
    await store.confirm(plan, false); await store.confirm({ ...plan }, true)
    expect(writer.execute).not.toHaveBeenCalled()
    expect(await store.confirm(plan, true)).toBe(true); expect(writer.execute).toHaveBeenCalledTimes(1)
    expect(store.status).toBe('acknowledged'); expect(store.needsRefresh).toBe(true)
    expect(store.prepareRename('再改')).toBeUndefined()
  })
  it.each(['project', 'draft', 'tools', 'presets', 'reader', 'writer', 'registration', 'preview', 'project-path', 'project-provider', 'expected-project-provider', 'project-revision'] as const)('invalidates confirmation after %s changes, including A→B→A', async field => {
    const { store, context, writer } = fixture(), plan = store.prepareRename('新名称')!
    const changed = { ...context }
    if (field === 'project') changed.projectId = 'p2'
    if (field === 'draft') changed.draftRevision++
    if (field === 'tools') changed.tools = [...tools]
    if (field === 'presets') changed.presets = [...context.presets]
    if (field === 'reader') changed.reader = { ...context.reader! }
    if (field === 'writer') changed.writer = { ...context.writer! }
    if (field === 'registration') changed.registeredProjects = []
    if (field === 'preview') changed.previewPresetId = 'core'
    if (field === 'project-path') changed.registeredProjects = context.registeredProjects.map(project => ({ ...project, path: '/switched' }))
    if (field === 'project-provider') changed.registrationProvider = { ...context.registrationProvider! }
    if (field === 'expected-project-provider') changed.expectedRegistrationProvider = { ...context.expectedRegistrationProvider! }
    if (field === 'project-revision') changed.registrationRevision++
    store.syncContext(changed); store.syncContext(context)
    expect(await store.confirm(plan, true)).toBe(false); expect(writer.execute).not.toHaveBeenCalled()
  })
  it('catches in-place changes at confirm even without a watcher callback', async () => {
    const { store, writer, context } = fixture(), plan = store.prepareRename('新名称')!
    context.presets[2]!.name = '来自其他读取'; expect(await store.confirm(plan, true)).toBe(false); expect(writer.execute).not.toHaveBeenCalled()
  })
  it('requires registered specific project and snapshots previous plus target content and changed names', async () => {
    const { store, context, writer } = fixture()
    store.syncContext({ ...context, expectedRegistrationProvider: { ...context.expectedRegistrationProvider! } }); expect(store.prepareAssign()).toBeUndefined()
    store.syncContext({ ...context, previewPresetId: 'core' })
    const plan = store.prepareAssign()!; expect(plan.projectPath).toBe('/A'); expect(plan.registrationLabel).toBe('登记源'); expect(plan.projectName).toBe('甲工程'); expect(plan.projectId).toBe('p1'); expect(plan.removed).toEqual(['scene_save'])
    expect(plan.operation).toMatchObject({ kind: 'assign', projectId: 'p1', previous: { id: 'full' }, preset: { id: 'core' } })
    await store.confirm(plan, true); expect(writer.execute).toHaveBeenCalledTimes(1)
    store.syncContext({ ...context, projectId: 'unknown', registeredProjects: [], tools: [...tools], presets: [...context.presets] })
    expect(store.prepareAssign()).toBeUndefined()
  })
  it('blocks built-in edits and stores the exact batch, not a local-only success', async () => {
    const { store, context, writer } = fixture()
    store.syncContext({ ...context, previewPresetId: 'core' }); expect(store.prepareRename('新名称')).toBeUndefined(); expect(store.prepareDelete()).toBeUndefined(); expect(store.prepareUpdate(custom())).toBeUndefined()
    const candidates = [custom('one', '第一'), custom('two', '第二')], plan = store.prepareImport(candidates)!
    candidates[0]!.name = '晚到修改'
    await store.confirm(plan, true); expect(writer.execute).toHaveBeenCalledTimes(1)
    expect(vi.mocked(writer.execute).mock.calls[0]![0].operation).toMatchObject({ kind: 'import', presets: [{ name: '第一' }, { name: '第二' }] })
    expect(store.notice).toContain('仅包含批次首项')
  })
  it('retains UNKNOWN on explicit readback even if current data matches, and never retries automatically', async () => {
    const { store, writer, reader, context } = fixture()
    writer.execute = vi.fn(async () => { throw new ToolPresetWriteError('timeout', 'unknown') })
    const plan = store.prepareRename('自定义')!; expect(await store.confirm(plan, true)).toBe(false)
    expect(store.status).toBe('unknown'); expect(store.prepareRename('新名称')).toBeUndefined()
    await store.readBack(); expect(reader.loadPresets).toHaveBeenCalledWith('p1', expect.any(AbortSignal)); expect(store.observation?.matches).toBe(true)
    expect(store.status).toBe('unknown'); expect(writer.execute).toHaveBeenCalledTimes(1); expect(store.acknowledgeUnknown(false)).toBe(false)
    expect(store.acknowledgeUnknown(true)).toBe(true); expect(store.needsRefresh).toBe(true)
    expect(store.prepareRename('新名称')).toBeUndefined()
    store.syncContext({ ...context, tools: [...tools], presets: [...context.presets] }); expect(store.prepareRename('新名称')).toBeDefined()
    expect(writer.execute).toHaveBeenCalledTimes(1)
  })
  it('keeps frozen original context during readback even after switching project/source', async () => {
    const { store, writer, reader, context } = fixture(); writer.execute = async () => { throw new ToolPresetWriteError('network-error', 'unknown') }
    const plan = store.prepareRename('自定义')!; await store.confirm(plan, true)
    const replacement: ToolPresetReadProvider = { ...reader, loadPresets: vi.fn() }
    store.syncContext({ ...context, projectId: 'p2', reader: replacement }); await store.readBack()
    expect(reader.loadPresets).toHaveBeenCalledWith('p1', expect.any(AbortSignal)); expect(replacement.loadPresets).not.toHaveBeenCalled(); expect(store.observation?.projectId).toBe('p1')
  })
  it('locks single flight across cancel, leave, replacement and late receipt until the old lease settles', async () => {
    const { store, writer, context } = fixture(); let settle!: (reply: ToolPresetWriteReceipt) => void, idle!: () => void
    writer.execute = vi.fn<ToolPresetWriteProvider['execute']>(() => new Promise<ToolPresetWriteReceipt>(resolve => { settle = resolve })); writer.waitForIdle = vi.fn(() => new Promise<void>(resolve => { idle = resolve }))
    const plan = store.prepareRename('新名称')!, pending = store.confirm(plan, true); store.cancelWait(); store.leave()
    const replacement: ToolPresetWriteProvider = { label: 'replacement', execute: vi.fn(), waitForIdle: async () => undefined }
    store.syncContext({ ...context, writer: replacement }); expect(store.status).toBe('unknown'); expect(store.sending).toBe(true); expect(store.prepareRename('其他')).toBeUndefined()
    settle({ kind: 'preset', preset: custom('custom', '新名称'), batchSize: 1 }); await Promise.resolve(); await Promise.resolve()
    expect(store.sending).toBe(true); await store.readBack(); expect(store.observation).toBeNull()
    idle(); await pending; expect(store.sending).toBe(false); expect(store.status).toBe('unknown'); expect(store.receipt).toBeNull(); expect(replacement.execute).not.toHaveBeenCalled()
  })
  it('keeps a real adapter hung-body lease across replacement and cannot read back or release UNKNOWN early', async () => {
    vi.useFakeTimers()
    const { store, context, reader } = fixture()
    let finishRead!: (value: ReadableStreamReadResult<Uint8Array>) => void, finishCancel!: () => void
    const response = { status: 200, redirected: false, type: 'basic', headers: new Headers({ 'content-type': 'application/json' }), body: { getReader: () => ({ read: () => new Promise<ReadableStreamReadResult<Uint8Array>>(resolve => { finishRead = resolve }), cancel: () => new Promise<void>(resolve => { finishCancel = resolve }), releaseLock: () => undefined }) } } as unknown as Response
    const writer = createToolPresetWriteProvider({ fetch: async () => response, timeoutMs: 10 })
    store.syncContext({ ...context, writer })
    const pending = store.confirm(store.prepareRename('新名称')!, true)
    await vi.advanceTimersByTimeAsync(11)
    expect(store.status).toBe('unknown'); expect(store.sending).toBe(true)
    store.leave(); store.syncContext(context); await store.readBack()
    expect(reader.loadPresets).not.toHaveBeenCalled(); expect(store.prepareRename('其他')).toBeUndefined()
    finishCancel(); await Promise.resolve(); expect(store.sending).toBe(true)
    finishRead({ done: true, value: undefined }); await pending
    expect(store.sending).toBe(false); expect(store.status).toBe('unknown'); expect(store.receipt).toBeNull()
  })
  it('does not retry in-use deletion or infer that fallback-to-full was approved', async () => {
    const { store, writer } = fixture(); writer.execute = vi.fn(async () => { throw new ToolPresetWriteError('in-use', 'rejected', 409, ['p1', 'p2']) })
    await store.confirm(store.prepareDelete()!, true)
    expect(store.status).toBe('rejected'); expect(store.inUseProjectIds).toEqual(['p1', 'p2']); expect(store.notice).toContain('回退 full'); expect(writer.execute).toHaveBeenCalledTimes(1)
  })
  it('does not trust injected provider success when its target or batch is wrong', async () => {
    const { store, writer } = fixture(); writer.execute = async () => ({ kind: 'preset', preset: custom('wrong', '新名称'), batchSize: 1 })
    await store.confirm(store.prepareRename('新名称')!, true); expect(store.status).toBe('unknown'); expect(store.receipt).toBeNull()
  })
  it.each(['update', 'assign', 'import'] as const)('keeps %s bound to its original attempt across A→B→A while dispatched', async kind => {
    const { store, writer, context, reader } = fixture()
    let finish!: (reply: ToolPresetWriteReceipt) => void, idle!: () => void
    writer.execute = vi.fn<ToolPresetWriteProvider['execute']>(() => new Promise(resolve => { finish = resolve }))
    writer.waitForIdle = vi.fn(() => new Promise<void>(resolve => { idle = resolve }))
    const plan = kind === 'update' ? store.prepareUpdate({ ...custom('draft-source', '覆盖后'), enabled: [], disabled: ['scene_save'] })!
      : kind === 'assign' ? store.prepareAssign()! : store.prepareImport([custom('import-one', '导入一'), custom('import-two', '导入二')])!
    const pending = store.confirm(plan, true)
    const operation = vi.mocked(writer.execute).mock.calls[0]![0].operation
    const signal = vi.mocked(writer.execute).mock.calls[0]![1]!
    store.syncContext({ ...context, projectId: 'p2' }); store.syncContext(context)
    expect(signal.aborted).toBe(true); expect(store.status).toBe('unknown'); expect(store.sending).toBe(true)
    expect(store.attempt?.projectId).toBe('p1'); expect(store.attempt?.projectPath).toBe('/A')
    expect(store.prepareRename('不能并发')).toBeUndefined()
    if (operation.kind === 'delete') throw new Error('Unexpected deletion')
    finish({ kind: 'preset', preset: operation.kind === 'import' ? operation.presets[0]! : operation.preset, batchSize: operation.kind === 'import' ? operation.presets.length : 1 })
    await Promise.resolve(); await Promise.resolve()
    expect(store.sending).toBe(true); expect(store.receipt).toBeNull()
    idle(); expect(await pending).toBe(false)
    expect(store.status).toBe('unknown'); expect(store.needsRefresh).toBe(true)
    await store.readBack()
    expect(reader.loadPresets).toHaveBeenCalledWith('p1', expect.any(AbortSignal))
    expect(store.observation?.projectPath).toBe('/A'); expect(store.status).toBe('unknown')
    expect(writer.execute).toHaveBeenCalledTimes(1)
  })

  it.each(['tools', 'presets'] as const)('retains the readback lease when %s rejects before the other read settles, including route leave', async failed => {
    const { store, writer, reader, context } = fixture()
    writer.execute = async () => { throw new ToolPresetWriteError('timeout', 'unknown') }
    await store.confirm(store.prepareRename('自定义')!, true)
    let reject!: (error: Error) => void, finish!: (value: unknown) => void
    const failedRead = new Promise<never>((_, fail) => { reject = fail })
    const pendingRead = new Promise<unknown>(resolve => { finish = resolve })
    reader.loadTools = vi.fn(() => (failed === 'tools' ? failedRead : pendingRead) as ReturnType<ToolPresetReadProvider['loadTools']>)
    reader.loadPresets = vi.fn(() => (failed === 'presets' ? failedRead : pendingRead) as ReturnType<ToolPresetReadProvider['loadPresets']>)
    const pending = store.readBack(); reject(new Error('fixture failure'))
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(store.readingBack).toBe(true); expect(store.error).toContain('显式回读未完成')
    store.leave(); store.syncContext(context)
    expect(store.readingBack).toBe(true); expect(store.locked).toBe(true)
    await store.readBack(); expect(reader.loadTools).toHaveBeenCalledTimes(1); expect(reader.loadPresets).toHaveBeenCalledTimes(1)
    finish(failed === 'tools' ? { presets: [...builtins, custom()], selectedPresetId: 'full' } : tools)
    await pending
    expect(store.readingBack).toBe(false); expect(store.status).toBe('unknown'); expect(store.observation).toBeNull()
  })

})


describe('separately confirmed linked-preset removal preserves store protections',()=>{
 it('freezes the explicit reset flag, requires approval, and reports only validated affected ids',async()=>{
  const {store,writer}=fixture();writer.execute=vi.fn<ToolPresetWriteProvider['execute']>(async()=>({kind:'deleted',projectIds:['p1','p2']}))
  const plan=store.prepareDelete(true)!;expect(plan.title).toContain('关联工程回退全部工具');expect(Object.isFrozen(plan.operation)).toBe(true)
  expect(plan.operation).toMatchObject({kind:'delete',preset:{id:'custom'},resetLinkedProjects:true});expect(writer.execute).not.toHaveBeenCalled()
  expect(await store.confirm(plan,false)).toBe(false);expect(writer.execute).not.toHaveBeenCalled()
  expect(await store.confirm(plan,true)).toBe(true);expect(writer.execute).toHaveBeenCalledOnce();expect(store.notice).toContain('2 个关联工程已回退 full');expect(store.receipt).toEqual({kind:'deleted',projectIds:['p1','p2']})
  expect(store.needsRefresh).toBe(true);expect(store.prepareDelete(true)).toBeUndefined()
 })
 it('invalidates explicit reset confirmation when the registration snapshot changes and returns',async()=>{
  const {store,writer,context}=fixture(),plan=store.prepareDelete(true)!
  store.syncContext({...context,registrationRevision:context.registrationRevision+1});store.syncContext(context)
  expect(await store.confirm(plan,true)).toBe(false);expect(writer.execute).not.toHaveBeenCalled()
 })
 it('retains UNKNOWN after reset timeout and matching readback, without ordinary or reset resubmission',async()=>{
  const {store,writer,reader}=fixture();writer.execute=vi.fn(async()=>{throw new ToolPresetWriteError('timeout','unknown')})
  const plan=store.prepareDelete(true)!;expect(await store.confirm(plan,true)).toBe(false)
  vi.mocked(reader.loadPresets).mockResolvedValue({presets:builtins,selectedPresetId:'full'})
  await store.readBack();expect(store.observation?.matches).toBe(true);expect(store.status).toBe('unknown');expect(store.prepareDelete()).toBeUndefined();expect(store.prepareDelete(true)).toBeUndefined();expect(writer.execute).toHaveBeenCalledOnce()
 })
})
