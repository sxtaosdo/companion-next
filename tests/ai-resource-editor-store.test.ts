import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { testCrypto } from './fixtures/generation-png'
import { resourceView } from './fixtures/ai-resource-read'
import { AI_EDITOR_FENCE_KEY, useAiResourceEditorStore } from '../src/stores/ai-resource-editor'
import type { AiEditorContext, AiEditorFenceStorage } from '../src/stores/ai-resource-editor'
import { AiResourceSaveError } from '../src/domain/ai-resource-save'
import type { AiResourceSaveInput, AiResourceSaveProvider } from '../src/domain/ai-resource-save'
import type { AiResourceReadProvider, AiResourceView } from '../src/domain/ai-resource-read'
const id = '0123456789abcdef', other = 'fedcba9876543210'
const context: AiEditorContext = { project: { id, name: '项目 A', path: '/fixture/a' }, source: {} }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
function storageFixture() {
  const values = new Map<string, string>()
  const storage: AiEditorFenceStorage = { getItem: vi.fn(key => values.get(key) ?? null), setItem: vi.fn((key, value) => { values.set(key, value) }) }
  return { values, storage }
}
function saved(input: AiResourceSaveInput, version = 2): AiResourceView {
  const value = resourceView(); value.config = { ...structuredClone(input.config), version }; value.draft = structuredClone(value.config); value.version = version; value.hash = 'b'.repeat(64); return value
}
function setup(view = resourceView(), previousStorage?: AiEditorFenceStorage) {
  const store = useAiResourceEditorStore(), { storage, values } = storageFixture()
  const reader: AiResourceReadProvider = { label: 'offline', readConfig: vi.fn(async () => resourceView()), previewReference: vi.fn(async () => { throw Error('unused') }) }
  const writer: AiResourceSaveProvider = { label: 'offline', saveConfig: vi.fn(async (_id, input) => saved(input, (view.version ?? 0) + 1)) }
  store.setFenceStorage(previousStorage ?? storage); expect(store.open(context, view, reader, writer)).toBe(true)
  return { store, reader, writer, storage: previousStorage ?? storage, values }
}
function edit(store: ReturnType<typeof useAiResourceEditorStore>) { store.draft!.style.description = '已修改的风格'; store.setConfirmed(true) }
async function untilSaving(writer: AiResourceSaveProvider) { await vi.waitFor(() => expect(writer.saveConfig).toHaveBeenCalledTimes(1)) }
function missingView(): AiResourceView {
  const value = resourceView(); value.state = 'missing'; value.config = null; value.hash = null; value.version = null
  value.draft.iconSize = { width: 0, height: 0 }; value.draft.style = { description: '', references: [] }; value.draft.destination.exportDirectory = 'art/final/companion'
  return value
}
beforeEach(() => { setActivePinia(createPinia()); vi.stubGlobal('crypto', testCrypto) })
describe('AI resource editor confirmation and frozen context', () => {
  it('opens a copy without reading or saving; nothing is preapproved', () => {
    const input = resourceView(), { store, reader, writer } = setup(input)
    expect(store.mode).toBe('edit'); expect(store.confirmed).toBe(false); expect(store.canSave).toBe(false)
    store.draft!.style.description = 'local'; expect(input.draft.style.description).toBe('明亮卡通')
    expect(reader.readConfig).not.toHaveBeenCalled(); expect(writer.saveConfig).not.toHaveBeenCalled(); expect(Object.isFrozen(store.base)).toBe(true)
  })
  it('never saves without the exact explicit confirmation and resets it synchronously on every edit', async () => {
    const { store, reader, writer } = setup(); store.draft!.style.description = 'local'
    await store.save(context, reader, writer); expect(writer.saveConfig).not.toHaveBeenCalled()
    store.setConfirmed(true); expect(store.canSave).toBe(true)
    store.draft!.iconSize.width = 512; expect(store.confirmed).toBe(false); expect(store.canSave).toBe(false)
    await store.save(context, reader, writer); expect(writer.saveConfig).not.toHaveBeenCalled()
  })
  it('prevents unchanged v2 resubmission but reports a normalized saved-to-proposed diff', async () => {
    const { store, reader, writer } = setup(); store.setConfirmed(true); expect(store.canSave).toBe(false)
    await store.save(context, reader, writer); expect(writer.saveConfig).not.toHaveBeenCalled()
    store.draft!.style.description = '  新风格  '; expect(store.diff).toContainEqual({ field: 'style.description', before: '明亮卡通', after: '新风格' })
    store.setConfirmed(true); expect(await store.save(context, reader, writer)).toBe(true)
    expect(vi.mocked(writer.saveConfig).mock.calls[0]![1].config.style.description).toBe('新风格')
    expect(store.phase).toBe('saved'); expect(store.confirmed).toBe(false); expect(store.base?.version).toBe(2)
  })
  it.each(['id', 'name', 'path', 'source', 'reader', 'writer'] as const)('invalidates %s identity while protecting the draft', async kind => {
    const { store, reader, writer } = setup(); edit(store)
    const next = { project: { ...context.project }, source: context.source }
    if (kind === 'id') next.project.id = other
    if (kind === 'name') next.project.name = 'renamed'
    if (kind === 'path') next.project.path = '/elsewhere'
    if (kind === 'source') next.source = {}
    await store.save(next, kind === 'reader' ? { ...reader } : reader, kind === 'writer' ? { ...writer } : writer)
    expect(writer.saveConfig).not.toHaveBeenCalled(); expect(store.phase).toBe('invalidated'); expect(store.draft!.style.description).toBe('已修改的风格')
    expect(store.confirmed).toBe(false)
  })
  it.each(['projectId', 'version', 'designResolution'] as const)('locks %s in the editable draft', async field => {
    const { store, reader, writer } = setup(); edit(store)
    if (field === 'projectId') store.draft!.projectId = other
    if (field === 'version') store.draft!.version = 90
    if (field === 'designResolution') store.draft!.designResolution.width = 800
    store.setConfirmed(true); expect(store.errors.length).toBeGreaterThan(0)
    await store.save(context, reader, writer); expect(writer.saveConfig).not.toHaveBeenCalled()
  })
  it('creates from missing using expectedHash null, wire version 1, and server result version 1', async () => {
    const { store, reader, writer } = setup(missingView()); expect(store.mode).toBe('create'); expect(store.errors.length).toBeGreaterThan(0)
    store.draft!.iconSize = { width: 128, height: 256 }; edit(store)
    expect(await store.save(context, reader, writer)).toBe(true)
    expect(vi.mocked(writer.saveConfig).mock.calls[0]![1]).toMatchObject({ expectedHash: null, approved: true, config: { version: 1 } })
    expect(store.base?.version).toBe(1)
  })
  it('allows a missing undetected design to be filled and derives orientation', async () => {
    const value = missingView(); value.detected.designResolution = null; value.detected.designSource = null; value.draft.designResolution = { width: 0, height: 0 }; value.draft.orientation = 'portrait'
    const { store, reader, writer } = setup(value)
    store.draft!.designResolution = { width: 1600, height: 900 }; store.draft!.iconSize = { width: 256, height: 256 }; edit(store)
    expect(store.draft!.orientation).toBe('landscape'); expect(store.errors).toEqual([])
    writer.saveConfig = vi.fn(async (_id, input) => { const result = saved(input, 1); result.detected.designResolution = null; result.detected.designSource = null; return result })
    expect(await store.save(context, reader, writer)).toBe(true)
  })
  it('initializes invalid original version separately from the default draft version', () => {
    const value = missingView(); value.state = 'invalid'; value.hash = 'a'.repeat(64); value.version = 7; value.issues = [{ field: 'style.description', code: 'INVALID_FIELD' }]
    const { store } = setup(value); expect(store.mode).toBe('edit'); expect(store.draft!.version).toBe(7); store.draft!.iconSize = { width: 256, height: 256 }; edit(store); expect(store.errors).toEqual([])
  })
  it('migrates a v1 with mixed preset sizes only after selecting a single valid size', async () => {
    const value = resourceView(), v2 = value.config!; if (v2.schemaVersion !== 'project-resource-config-v2') throw Error('fixture')
    const { projectId: _projectId, iconSize: _iconSize, ...common } = v2
    value.config = { ...common, schemaVersion: 'project-resource-config-v1', background: { format: 'png', transparent: true }, destination: { directory: 'assets/icons', naming: 'kebab-case' }, iconPresets: [{ id: 'small', label: '小', displaySize: { width: 64, height: 64 }, outputPixels: { width: 1024, height: 1024 } }, { id: 'big', label: '大', displaySize: { width: 256, height: 256 }, outputPixels: { width: 1024, height: 1024 } }] }
    value.migrationRequired = true; value.draft.iconSize = { width: 0, height: 0 }; value.draft.destination.exportDirectory = 'art/final/companion'
    const { store, reader, writer } = setup(value); expect(store.mode).toBe('migrate'); expect(store.errors.length).toBeGreaterThan(0)
    store.draft!.iconSize = { width: 256, height: 256 };
    for (const field of ['iconSize.width', 'iconSize.height', 'background.color', 'destination.exportDirectory']) expect(store.diff.find(change => change.field === field)?.before).toBe('（v2 新增，原配置未保存此字段）')
    store.setConfirmed(true); expect(await store.save(context, reader, writer)).toBe(true)
    expect(store.mode).toBe('edit')
  })
  it('does not treat directly mutating the confirmation ref as an explicit per-edit approval', async () => {
    const { store, reader, writer } = setup(); store.draft!.style.description = 'local'; store.confirmed = true
    expect(store.canSave).toBe(false); await store.save(context, reader, writer); expect(writer.saveConfig).not.toHaveBeenCalled()
  })
  it('reopens a retained dirty draft only against the original complete context and same fresh read', () => {
    const { store, reader, writer } = setup(); edit(store); store.leave(); expect(store.contextValid).toBe(false)
    expect(store.open(context, resourceView(), reader, writer)).toBe(true); expect(store.contextValid).toBe(true); expect(store.dirty).toBe(true); expect(store.phase).toBe('editing'); expect(store.confirmed).toBe(false)
    store.setConfirmed(true); expect(store.canSave).toBe(true)
  })
  it('shows retained content in a different project without restoring write permission', async () => {
    const { store, reader, writer } = setup(); edit(store); store.leave()
    const next = { ...context, project: { ...context.project, id: other } }
    expect(store.open(next, resourceView(other), reader, writer)).toBe(false)
    expect(store.showRetained()).toBe(true); expect(store.project?.id).toBe(id); expect(store.contextValid).toBe(false)
    store.setConfirmed(true); await store.save(next, reader, writer); expect(writer.saveConfig).not.toHaveBeenCalled(); expect(store.draft!.style.description).toBe('已修改的风格')
  })
  it('offers a changed fresh read for explicit adoption when reopening, protecting unsaved content', () => {
    const { store, reader, writer } = setup(); edit(store); store.leave(); const changed = resourceView(); changed.hash = 'c'.repeat(64)
    expect(store.open(context, changed, reader, writer)).toBe(true); expect(store.phase).toBe('conflict-current'); expect(store.draft!.style.description).toBe('已修改的风格')
    expect(store.observedCurrent?.hash).toBe(changed.hash); expect(store.adoptCurrent(false)).toBe(false); expect(store.adoptCurrent(true)).toBe(true); expect(store.base?.hash).toBe(changed.hash)
  })
  it('does not allow unsafe version increment or invalid drafts to enter the transport', async () => {
    const value = resourceView(); value.version = Number.MAX_SAFE_INTEGER; value.config!.version = value.version; value.draft.version = value.version
    const { store, reader, writer } = setup(value); edit(store); expect(store.errors.join('')).toContain('递增'); await store.save(context, reader, writer); expect(writer.saveConfig).not.toHaveBeenCalled()
    store.draft!.style.description = ''; expect(store.diff).toEqual([])
  })

})
describe('durable pending fence and non-retry outcomes', () => {
  it('writes only bounded metadata before transport and rejects duplicate saves', async () => {
    const { store, reader, writer, values } = setup(), wait = deferred<AiResourceView>()
    writer.saveConfig = vi.fn((_id, _input) => { expect(values.get(AI_EDITOR_FENCE_KEY)).toBeTruthy(); return wait.promise }); edit(store)
    const pending = store.save(context, reader, writer); await untilSaving(writer)
    const text = values.get(AI_EDITOR_FENCE_KEY)!; expect(text).not.toContain('风格'); expect(text).not.toContain('/fixture'); expect(text).not.toContain('art/reference')
    expect(Object.keys(JSON.parse(text)[0]).sort()).toEqual(['expectedHash', 'expectedVersion', 'id', 'targetCanonicalDigest'])
    await store.save(context, reader, writer); expect(writer.saveConfig).toHaveBeenCalledTimes(1)
    wait.resolve(saved(vi.mocked(writer.saveConfig).mock.calls[0]![1])); expect(await pending).toBe(true)
    expect(JSON.parse(values.get(AI_EDITOR_FENCE_KEY)!)).toEqual([])
  })
  it.each(['unavailable', 'get-throws', 'write-throws', 'write-lost', 'corrupt'] as const)('blocks dispatch for %s storage while retaining editable draft', async kind => {
    const { store, reader, writer } = (() => {
      if (kind === 'unavailable') { const state = setup(); state.store.close(true); setActivePinia(createPinia()); const s = useAiResourceEditorStore(); s.setFenceStorage(null); s.open(context, resourceView(), state.reader, state.writer); return { store: s, reader: state.reader, writer: state.writer } }
      const storage: AiEditorFenceStorage = { getItem: () => kind === 'get-throws' ? (() => { throw Error('secret') })() : kind === 'corrupt' ? '{invalid}' : null, setItem: () => { if (kind === 'write-throws') throw Error('secret') } }
      return setup(resourceView(), storage)
    })()
    edit(store); await store.save(context, reader, writer); expect(writer.saveConfig).not.toHaveBeenCalled(); expect(store.storageBlocked).toBe(true); expect(store.error).not.toContain('secret'); expect(store.draft).not.toBeNull()
  })
  it.each(['not-sent', 'rejected', 'conflict', 'unknown'] as const)('classifies %s without automatic retry', async outcome => {
    const { store, reader, writer, values } = setup(); writer.saveConfig = vi.fn(async () => { throw new AiResourceSaveError(outcome === 'conflict' ? 'stale' : outcome === 'not-sent' ? 'busy' : outcome === 'rejected' ? 'forbidden' : 'timeout', outcome) }); edit(store)
    await store.save(context, reader, writer); expect(store.phase).toBe(outcome); expect(store.confirmed).toBe(false); expect(writer.saveConfig).toHaveBeenCalledTimes(1); expect(reader.readConfig).not.toHaveBeenCalled()
    expect(JSON.parse(values.get(AI_EDITOR_FENCE_KEY)!)).toHaveLength(['unknown', 'conflict'].includes(outcome) ? 1 : 0)
    await store.save(context, reader, writer); expect(writer.saveConfig).toHaveBeenCalledTimes(1)
  })
  it.each(['project', 'wrong-version', 'wrong-content', 'same-hash', 'malformed'] as const)('treats %s success as unknown, preserving the fence', async kind => {
    const { store, reader, writer } = setup(); writer.saveConfig = vi.fn(async (_id, input) => {
      const result = saved(input)
      if (kind === 'project') return resourceView(other)
      if (kind === 'wrong-version') { result.version = 5; result.config!.version = 5; result.draft.version = 5 }
      if (kind === 'wrong-content') { result.config!.style.description = 'different'; result.draft.style.description = 'different' }
      if (kind === 'same-hash') result.hash = 'a'.repeat(64)
      if (kind === 'malformed') return {} as AiResourceView
      return result
    }); edit(store); expect(await store.save(context, reader, writer)).toBe(false); expect(store.phase).toBe('unknown'); expect(store.pendingFence).not.toBeNull(); expect(store.base?.version).toBe(1)
  })
  it('retains unknown across page reload and never resubmits from the same old hash readback', async () => {
    const first = setup(); first.writer.saveConfig = vi.fn(async () => { throw Error('secret diagnostics') }); edit(first.store); await first.store.save(context, first.reader, first.writer)
    expect(first.store.error).not.toContain('secret'); setActivePinia(createPinia())
    const next = setup(resourceView(), first.storage); expect(next.store.phase).toBe('unknown'); edit(next.store); await next.store.save(context, next.reader, next.writer); expect(next.writer.saveConfig).not.toHaveBeenCalled()
    await next.store.reconcile(context, next.reader, next.writer); expect(next.store.phase).toBe('unknown'); expect(next.store.reconciliation).toBe('unchanged'); expect(next.store.adoptCurrent(true)).toBe(false); expect(next.store.pendingFence).not.toBeNull()
  })
  it('requires an explicit readback then separate discard confirmation to adopt matching content', async () => {
    const { store, reader, writer } = setup(); let target!: AiResourceView
    writer.saveConfig = vi.fn(async (_id, input) => { target = saved(input); throw new AiResourceSaveError('timeout', 'unknown') }); edit(store)
    await store.save(context, reader, writer); store.draft!.style.description = 'new unsaved local draft'; reader.readConfig = vi.fn(async () => target)
    expect(store.adoptCurrent(true)).toBe(false); expect(await store.reconcile(context, reader, writer)).toBe(true)
    expect(store.phase).toBe('observed-matching'); expect(store.draft!.style.description).toBe('new unsaved local draft'); expect(store.error).toContain('不证明')
    expect(store.adoptCurrent(false)).toBe(false); expect(store.pendingFence).not.toBeNull()
    expect(store.adoptCurrent(true)).toBe(true); expect(store.draft!.style.description).toBe('已修改的风格'); expect(store.pendingFence).toBeNull(); expect(store.confirmed).toBe(false)
    expect(writer.saveConfig).toHaveBeenCalledTimes(1)
  })
  it('adopts a conflicting current config only explicitly and keeps raw read errors private', async () => {
    const { store, reader, writer } = setup(); writer.saveConfig = vi.fn(async () => { throw new AiResourceSaveError('stale', 'conflict') }); edit(store); await store.save(context, reader, writer)
    reader.readConfig = vi.fn(async () => { throw Error('secret-server-path') }); expect(await store.reconcile(context, reader, writer)).toBe(false); expect(store.error).not.toContain('secret')
    const current = resourceView(); current.hash = 'c'.repeat(64); reader.readConfig = vi.fn(async () => current)
    await store.reconcile(context, reader, writer); expect(store.phase).toBe('conflict-current'); expect(store.dirty).toBe(true); expect(store.adoptCurrent(true)).toBe(true); expect(store.base?.hash).toBe(current.hash)
  })
  it.each(['leave', 'close', 'context'] as const)('keeps late %s save outcomes unknown and its durable fence protected', async kind => {
    const { store, reader, writer, values } = setup(), wait = deferred<AiResourceView>(); let signal: AbortSignal | undefined
    writer.saveConfig = vi.fn((_id, _input, abort) => { signal = abort; return wait.promise }); edit(store); const pending = store.save(context, reader, writer); await untilSaving(writer)
    if (kind === 'leave') store.leave()
    if (kind === 'close') { expect(store.close()).toBe(false); expect(store.close(true)).toBe(true) }
    if (kind === 'context') store.syncContext({ ...context, project: { ...context.project, path: '/changed' } }, reader, writer)
    expect(signal?.aborted).toBe(true); expect(store.phase).toBe('unknown')
    wait.resolve(saved(vi.mocked(writer.saveConfig).mock.calls[0]![1])); expect(await pending).toBe(false)
    expect(store.phase).toBe('unknown'); expect(JSON.parse(values.get(AI_EDITOR_FENCE_KEY)!)).toHaveLength(1)
    if (kind !== 'close') expect(store.draft!.style.description).toBe('已修改的风格')
  })
  it('does not overwrite edits made while save response is pending', async () => {
    const { store, reader, writer } = setup(), wait = deferred<AiResourceView>(); writer.saveConfig = vi.fn(() => wait.promise); edit(store)
    const pending = store.save(context, reader, writer); await untilSaving(writer); store.draft!.style.description = 'newer unsaved'
    wait.resolve(saved(vi.mocked(writer.saveConfig).mock.calls[0]![1])); expect(await pending).toBe(true)
    expect(store.draft!.style.description).toBe('newer unsaved'); expect(store.draft!.version).toBe(2); expect(store.confirmed).toBe(false); expect(store.dirty).toBe(true); expect(store.phase).toBe('editing')
  })
  it('cancels preflight when an edit occurs before asynchronous digest completion without dispatch or a fence', async () => {
    const { store, reader, writer, values } = setup(); const wait = deferred<ArrayBuffer>()
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn(() => wait.promise) } }); edit(store)
    const pending = store.save(context, reader, writer); expect(store.phase).toBe('preparing'); store.draft!.style.description = 'edited during preflight'
    wait.resolve(new ArrayBuffer(32)); expect(await pending).toBe(false); expect(writer.saveConfig).not.toHaveBeenCalled(); expect(values.has(AI_EDITOR_FENCE_KEY)).toBe(false); expect(store.confirmed).toBe(false)
  })
  it('keeps an unresolved re-open unknown while permitting explicit readback in the original context', async () => {
    const { store, reader, writer } = setup(); writer.saveConfig = vi.fn(async () => { throw new AiResourceSaveError('timeout', 'unknown') }); edit(store); await store.save(context, reader, writer); store.leave()
    expect(store.open(context, resourceView(), reader, writer)).toBe(true); expect(store.contextValid).toBe(true); expect(store.phase).toBe('unknown')
    expect(await store.reconcile(context, reader, writer)).toBe(true); expect(reader.readConfig).toHaveBeenCalledTimes(1); expect(store.phase).toBe('unknown')
  })
  it('preserves unknown protection when a current read fails or returns a mismatched project', async () => {
    const { store, reader, writer } = setup(); writer.saveConfig = vi.fn(async () => { throw new AiResourceSaveError('timeout', 'unknown') }); edit(store); await store.save(context, reader, writer)
    reader.readConfig = vi.fn(async () => resourceView(other)); expect(await store.reconcile(context, reader, writer)).toBe(false); expect(store.phase).toBe('unknown'); expect(store.observedCurrent).toBeNull(); expect(store.pendingFence).not.toBeNull()
  })
  it('clears a definitively rejected conflict only through explicit adoption even when its readback has the old hash', async () => {
    const { store, reader, writer } = setup(); writer.saveConfig = vi.fn(async () => { throw new AiResourceSaveError('stale', 'conflict') }); edit(store); await store.save(context, reader, writer)
    await store.reconcile(context, reader, writer); expect(store.phase).toBe('conflict-current'); expect(store.pendingFence).not.toBeNull(); expect(store.adoptCurrent(true)).toBe(true); expect(store.confirmed).toBe(false)
  })
  it('retains the fence if deletion fails after an otherwise verified save', async () => {
    const { store, reader, writer, storage } = setup(); const realSet = storage.setItem
    storage.setItem = vi.fn((key, value) => { if (value === '[]') throw Error('secret'); realSet(key, value) }); edit(store)
    expect(await store.save(context, reader, writer)).toBe(false); expect(store.phase).toBe('unknown'); expect(store.storageBlocked).toBe(true); expect(store.pendingFence).not.toBeNull(); expect(store.base?.version).toBe(1)
  })
  it('rejects corrupted fence metadata and preserves unrelated pending project metadata', async () => {
    const { values, storage } = storageFixture(); const otherFence = { id: other, expectedHash: null, expectedVersion: 1, targetCanonicalDigest: 'a'.repeat(64) }; values.set(AI_EDITOR_FENCE_KEY, JSON.stringify([otherFence]))
    const { store, reader, writer } = setup(resourceView(), storage); edit(store); expect(await store.save(context, reader, writer)).toBe(true); expect(JSON.parse(values.get(AI_EDITOR_FENCE_KEY)!)).toEqual([otherFence])
    store.close(true); setActivePinia(createPinia()); values.set(AI_EDITOR_FENCE_KEY, JSON.stringify([{ ...otherFence, config: 'not permitted' }]))
    const blocked = setup(resourceView(), storage); expect(blocked.store.storageBlocked).toBe(true); edit(blocked.store); await blocked.store.save(context, blocked.reader, blocked.writer); expect(blocked.writer.saveConfig).not.toHaveBeenCalled()
  })

  it('retains a verified stale conflict across repeated same-hash readbacks before explicit adoption', async () => {
    const { store, reader, writer } = setup(); writer.saveConfig = vi.fn(async () => { throw new AiResourceSaveError('stale', 'conflict') }); edit(store)
    await store.save(context, reader, writer); await store.reconcile(context, reader, writer); expect(store.phase).toBe('conflict-current')
    await store.reconcile(context, reader, writer); expect(store.phase).toBe('conflict-current'); expect(store.reconciliation).toBe('conflict-current')
    expect(store.adoptCurrent(true)).toBe(true); expect(store.pendingFence).toBeNull(); expect(writer.saveConfig).toHaveBeenCalledTimes(1)
  })
  it('retains the verified stale conclusion across leave and reopen with the exact original binding', async () => {
    const { store, reader, writer } = setup(); writer.saveConfig = vi.fn(async () => { throw new AiResourceSaveError('stale', 'conflict') }); edit(store)
    await store.save(context, reader, writer); await store.reconcile(context, reader, writer); store.leave()
    expect(store.open(context, resourceView(), reader, writer)).toBe(true); expect(store.phase).toBe('conflict')
    await store.reconcile(context, reader, writer); expect(store.phase).toBe('conflict-current'); expect(store.adoptCurrent(true)).toBe(true)
  })
  it('does not persist conflict certainty across reload: the same original hash remains unknown', async () => {
    const first = setup(); first.writer.saveConfig = vi.fn(async () => { throw new AiResourceSaveError('stale', 'conflict') }); edit(first.store)
    await first.store.save(context, first.reader, first.writer); await first.store.reconcile(context, first.reader, first.writer)
    expect(first.store.phase).toBe('conflict-current'); setActivePinia(createPinia())
    const next = setup(resourceView(), first.storage); expect(next.store.phase).toBe('unknown')
    await next.store.reconcile(context, next.reader, next.writer); expect(next.store.phase).toBe('unknown'); expect(next.store.adoptCurrent(true)).toBe(false)
    expect(next.writer.saveConfig).not.toHaveBeenCalled(); expect(next.store.pendingFence).not.toBeNull()
  })
  it.each(['reader', 'writer'] as const)('invalidates conflict certainty when the %s identity changes, even if the original later returns', async identity => {
    const { store, reader, writer } = setup(); writer.saveConfig = vi.fn(async () => { throw new AiResourceSaveError('stale', 'conflict') }); edit(store)
    await store.save(context, reader, writer)
    store.syncContext(context, identity === 'reader' ? { ...reader } : reader, identity === 'writer' ? { ...writer } : writer); store.leave()
    expect(store.open(context, resourceView(), reader, writer)).toBe(true); expect(store.phase).toBe('unknown')
    await store.reconcile(context, reader, writer); expect(store.phase).toBe('unknown'); expect(store.adoptCurrent(true)).toBe(false)
  })

})

describe('reference upload opaque lease isolation', () => {
  it('blocks saving and another lease, but retains ownership through close until transport settlement', async () => {
    const { store, reader, writer } = setup(); edit(store)
    const ticket = store.beginReferenceUpload(context, reader, writer)!
    expect(ticket).toBeTruthy(); expect(store.referenceUploadActive).toBe(true); expect(store.confirmed).toBe(false)
    store.setConfirmed(true); expect(store.canSave).toBe(false); await store.save(context, reader, writer)
    expect(writer.saveConfig).not.toHaveBeenCalled(); expect(store.beginReferenceUpload(context, reader, writer)).toBeNull()
    expect(store.close()).toBe(false); expect(store.close(true)).toBe(true); expect(store.referenceUploadActive).toBe(true)
    expect(store.appendUploadedReference(ticket, 'art/reference/upload.png')).toBe(false)
    expect(store.finishReferenceUpload({ kind: 'ai-reference-upload' })).toBe(false)
    expect(store.finishReferenceUpload(ticket)).toBe(true); expect(store.referenceUploadActive).toBe(false)
  })
  it('checks full original context, valid form and unchanged reference list while retaining newer style edits', () => {
    const { store, reader, writer } = setup()
    expect(store.beginReferenceUpload({ ...context, source: {} }, reader, writer)).toBeNull()
    expect(store.beginReferenceUpload(context, { ...reader }, writer)).toBeNull()
    expect(store.beginReferenceUpload(context, reader, { ...writer })).toBeNull()
    const ticket = store.beginReferenceUpload(context, reader, writer)!
    store.draft!.style.description = 'newer'; expect(store.appendUploadedReference(ticket, 'art/reference/upload.png')).toBe(true)
    expect(store.draft!.style.description).toBe('newer'); expect(store.appendUploadedReference(ticket, 'art/reference/upload.png')).toBe(false)
    store.finishReferenceUpload(ticket); const next = store.beginReferenceUpload(context, reader, writer)!
    store.draft!.style.references.push('art/reference/another.png')
    expect(store.appendUploadedReference(next, 'art/reference/late.png')).toBe(false); store.finishReferenceUpload(next)
  })
  it('refuses readonly editors, unknown saves and full reference lists', () => {
    const { store, reader, writer } = setup()
    expect(store.canBeginReferenceUpload(context, reader, null)).toBe(false)
    store.draft!.style.references = ['art/reference/a.png','art/reference/b.png','art/reference/c.png','art/reference/d.png']
    expect(store.beginReferenceUpload(context, reader, writer)).toBeNull()
  })
})
