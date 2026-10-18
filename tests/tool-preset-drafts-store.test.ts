import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useToolPresetDraftsStore } from '../src/stores/tool-preset-drafts'
import type { ToolPresetDraftContext } from '../src/stores/tool-preset-drafts'
import { useToolPresetsReadStore } from '../src/stores/tool-presets-read'
import type { ToolCatalogEntry, ToolPreset, ToolPresetReadProvider } from '../src/domain/tool-presets-read'
const catalog: ToolCatalogEntry[] = [
  { name: 'scene_read', displayNameZh: '读取场景', description: '读取', profile: 'core', scope: 'scene', access: 'read' },
  { name: 'scene_save', displayNameZh: '保存场景', description: '保存', profile: 'full', scope: 'scene', access: 'write' },
]
const presets: ToolPreset[] = [
  { id: 'core', name: '核心工具', baseProfile: 'core', enabled: [], disabled: [], builtIn: true, updatedAt: '1970-01-01T00:00:00.000Z' },
  { id: 'full', name: '全部工具', baseProfile: 'full', enabled: [], disabled: [], builtIn: true, updatedAt: '1970-01-01T00:00:00.000Z' },
  { id: 'remote-custom', name: '远端自定义', baseProfile: 'core', enabled: ['scene_save'], disabled: ['scene_read'], builtIn: false, updatedAt: '2026-10-13T00:00:00.000Z' },
]
function preset(id = 'local-1', name = '本地草稿'): ToolPreset { return { ...presets[2]!, id, name, enabled: [], disabled: [] } }
function json(rows: ToolPreset[] = [preset()]) { return JSON.stringify({ schemaVersion: 1, presets: rows }) }
function fixture(): ToolPresetDraftContext {
  const provider: ToolPresetReadProvider = { label: 'OFFLINE', loadTools: vi.fn(async () => structuredClone(catalog)), loadPresets: vi.fn(async () => ({ presets: structuredClone(presets), selectedPresetId: 'full' })), exportPreset: vi.fn(async () => ({ schemaVersion: 1 as const, presets: [preset()] })) }
  return { provider, projectId: 'project-a', tools: structuredClone(catalog), presets: structuredClone(presets), toolsReady: true, presetsReady: true, loading: false }
}
function setup() { const store = useToolPresetDraftsStore(), context = fixture(); store.syncContext(context); return { store, context } }
function imported(store: ReturnType<typeof useToolPresetDraftsStore>, rows = [preset()]) { const plan = store.prepareImport(json(rows))!; expect(plan).toBeDefined(); expect(store.applyImport(plan, true)).toBe(true) }
beforeEach(() => setActivePinia(createPinia()))
describe('page-only tool preset draft collection', () => {
  it('selects the complete category in one local revision, preserving other scopes and server presets',()=>{const {store,context}=setup();context.tools=[...context.tools,{name:'project_list',displayNameZh:'工程',description:'read',profile:'core',scope:'project',access:'read'}];store.syncContext(context);const draft=store.cloneFrom('core')!;store.setToolMode(draft.preset.id,'project_list','disabled');const before=JSON.stringify(context.presets),version=store.revision;expect(store.setScopeSelection(draft.preset.id,'scene',true)).toBe(true);expect(store.revision).toBe(version+1);expect(store.active!.preset.enabled).toEqual(['scene_save']);expect(store.active!.preset.disabled).toEqual(['project_list']);expect(JSON.stringify(context.presets)).toBe(before);expect(context.provider!.loadTools).not.toHaveBeenCalled();expect(context.provider!.loadPresets).not.toHaveBeenCalled()})
  it.each(['core','full'] as const)('clears a full category while retaining %s inheritance semantics',base=>{const {store}=setup(),draft=store.cloneFrom(base)!;expect(store.setScopeSelection(draft.preset.id,'scene',false)).toBe(true);expect(store.active!.preset.enabled).toEqual([]);expect(store.active!.preset.disabled).toEqual(base==='core'?['scene_read']:['scene_read','scene_save']);expect(store.setScopeSelection(draft.preset.id,'scene',true)).toBe(true);expect(store.active!.preset.disabled).toEqual([]);expect(store.active!.preset.enabled).toEqual(base==='core'?['scene_save']:[])})
  it('rejects unknown/loading catalog categories without changing the draft',()=>{const {store,context}=setup(),draft=store.cloneFrom('core')!;const before=JSON.stringify(store.active!.preset),version=store.revision;expect(store.setScopeSelection(draft.preset.id,'not-a-scope',true)).toBe(false);expect(JSON.stringify(store.active!.preset)).toBe(before);expect(store.revision).toBe(version);store.syncContext({...context,loading:true});expect(store.setScopeSelection(draft.preset.id,'scene',true)).toBe(false);expect(JSON.stringify(store.active!.preset)).toBe(before)})
  it('keeps unknown overrides outside the selected category for explicit repair',()=>{const {store}=setup();imported(store,[{...preset(),enabled:['old_unknown']}]);expect(store.setScopeSelection('local-1','scene',true)).toBe(true);expect(store.active!.preset.enabled).toEqual(['old_unknown','scene_save'])})
  it('retains Pinia memory without persistence, transport calls or service selection changes', () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem'), { store, context } = setup(), reads = useToolPresetsReadStore()
    reads.selectedPresetId = 'full'
    const draft = store.cloneFrom('core')!
    expect(draft).toBeDefined(); expect(useToolPresetDraftsStore().drafts).toHaveLength(1)
    store.selectActive(draft.preset.id); store.edit(draft.preset.id, { name: '页面副本' })
    expect(reads.selectedPresetId).toBe('full'); expect(storage).not.toHaveBeenCalled()
    expect(context.provider!.loadTools).not.toHaveBeenCalled(); expect(context.provider!.loadPresets).not.toHaveBeenCalled(); expect(context.provider!.exportPreset).not.toHaveBeenCalled()
  })
  it.each(['core', 'full', 'remote-custom'])('clones %s to a new custom ID and frozen detached source', id => {
    const { store, context } = setup(), before = JSON.stringify(context.presets), draft = store.cloneFrom(id)!
    expect(draft.preset.id).not.toBe(id); expect(draft.preset.builtIn).toBe(false)
    expect(draft.source.presetId).toBe(id); expect(draft.source.projectId).toBe('project-a'); expect(Object.isFrozen(draft.source)).toBe(true)
    expect(Object.isFrozen(draft.preset.enabled)).toBe(true); expect(store.activeId).toBe(draft.preset.id)
    store.edit(draft.preset.id, { name: '新的页面名称', baseProfile: 'full' }); store.setToolMode(draft.preset.id, 'scene_read', 'enabled')
    expect(JSON.stringify(context.presets)).toBe(before); expect(store.active!.source.presetName).toBe(context.presets.find(p => p.id === id)!.name)
  })
  it('does not clone stale or unknown read selections', () => {
    const { store, context } = setup(); expect(store.cloneFrom('missing')).toBeUndefined()
    store.syncContext({ ...context, presetsReady: false }); expect(store.cloneFrom('core')).toBeUndefined(); expect(store.drafts).toHaveLength(0)
  })
  it('switches each tool between default, enabled and disabled without overlap', () => {
    const { store } = setup(); imported(store)
    expect(store.setToolMode('local-1', 'scene_read', 'enabled')).toBe(true)
    expect(store.active!.preset.enabled).toEqual(['scene_read']); expect(store.active!.preset.disabled).toEqual([])
    expect(store.setToolMode('local-1', 'scene_read', 'disabled')).toBe(true)
    expect(store.active!.preset.enabled).toEqual([]); expect(store.active!.preset.disabled).toEqual(['scene_read'])
    expect(store.setToolMode('local-1', 'scene_read', 'default')).toBe(true)
    expect(store.active!.preset.enabled).toEqual([]); expect(store.active!.preset.disabled).toEqual([])
  })
  it('retains temporary empty, reserved and duplicate names for repair but cannot export them', () => {
    const { store } = setup(); imported(store, [preset('a', '名称一'), preset('b', '名称二')]); store.acceptCurrentContext()
    for (const name of ['', 'full', '名称二']) {
      expect(store.edit('a', { name })).toBe(true); expect(store.drafts[0]!.preset.name).toBe(name)
      expect(store.validation.status).toBe('invalid'); expect(store.prepareExport()).toBeUndefined()
    }
    expect(store.edit('a', { name: '修复名称' })).toBe(true); expect(store.validation.status).toBe('valid'); expect(store.prepareExport()).toBeDefined()
  })
  it('ignores injected ID, source and builtIn fields in an edit patch', () => {
    const { store } = setup(); imported(store)
    store.edit('local-1', { name: '仍为本地项', id: 'core', builtIn: true, source: { kind: 'server' } } as never)
    expect(store.active!.preset.id).toBe('local-1'); expect(store.active!.preset.builtIn).toBe(false); expect(store.active!.source.kind).toBe('import')
  })
  it('keeps a clone without a directory unverified and blocks enabled additions', () => {
    const { store, context } = setup(); store.syncContext({ ...context, tools: [], toolsReady: false })
    const draft = store.cloneFrom('remote-custom')!
    expect(draft).toBeDefined(); expect(store.validation.status).toBe('unverified'); expect(store.prepareExport()).toBeUndefined()
    expect(store.setToolMode(draft.preset.id, 'scene_read', 'enabled')).toBe(false)
    expect(store.setToolMode(draft.preset.id, 'scene_save', 'default')).toBe(true)
  })
  it('supports all twenty imported presets and caps further local cloning', () => {
    const { store } = setup(), rows = Array.from({ length: 20 }, (_, index) => preset(`p${index}`, `本地 ${index}`))
    imported(store, rows); expect(store.drafts).toHaveLength(20); expect(store.cloneFrom('core')).toBeUndefined()
    expect(store.prepareImport(json([...rows, preset('extra', '额外')]))).toBeUndefined(); expect(store.drafts).toHaveLength(20)
  })
  it('imports before reading a catalog and retains unknown tools until an explicit repair', () => {
    const store = useToolPresetDraftsStore(); imported(store, [{ ...preset(), enabled: ['old_tool'] }])
    expect(store.validation.status).toBe('unverified'); expect(store.prepareExport()).toBeUndefined()
    store.syncContext(fixture()); expect(store.validation.status).toBe('unverified'); expect(store.acceptCurrentContext()).toBe(true)
    expect(store.validation.status).toBe('invalid'); expect(store.prepareExport()).toBeUndefined()
    expect(store.setToolMode('local-1', 'old_tool', 'enabled')).toBe(false)
    expect(store.setToolMode('local-1', 'old_tool', 'default')).toBe(true)
    expect(store.validation.status).toBe('valid'); expect(store.prepareExport()).toBeDefined()
  })
  it('requires explicit replacement confirmation and keeps one recoverable old collection', () => {
    const { store } = setup(); imported(store, [preset('old', '旧集合')]); const preview = store.prepareImport(json([preset('new', '新集合')]))!
    expect(preview.requiresReplacement).toBe(true); expect(store.applyImport(preview)).toBe(false); expect(store.activeId).toBe('old')
    expect(store.applyImport(preview, true)).toBe(true); expect(store.activeId).toBe('new'); expect(store.backupAvailable).toBe(true)
    expect(store.restoreBackup(false)).toBe(false); expect(store.activeId).toBe('new')
    expect(store.restoreBackup(true)).toBe(true); expect(store.activeId).toBe('old')
    expect(store.restoreBackup(true)).toBe(true); expect(store.activeId).toBe('new')
  })
  it('rejects failed or unsafe parsing without damaging either current drafts or backup', () => {
    const { store } = setup(); imported(store, [preset('old', '旧集合')]); imported(store, [preset('new', '新集合')])
    for (const bad of ['{', JSON.stringify({ schemaVersion: 1, presets: [preset()], projectSelections: { p: 'local-1' } }), json([{ ...preset(), source: 'authority' } as never]), ' '.repeat(1_048_577)]) {
      expect(store.prepareImport(bad)).toBeUndefined(); expect(store.activeId).toBe('new'); expect(store.backupAvailable).toBe(true)
    }
    expect(store.restoreBackup(true)).toBe(true); expect(store.activeId).toBe('old')
  })
  it('does not silently remap imported IDs that conflict with the server', () => {
    const { store } = setup(); imported(store, [presets[2]!]); store.acceptCurrentContext()
    expect(store.activeId).toBe('remote-custom'); expect(store.validation.status).toBe('invalid'); expect(store.prepareExport()).toBeUndefined()
    expect(store.active!.preset.id).toBe('remote-custom')
  })
  it('explicitly makes the edited local item a new copy and preserves its old version for restore', () => {
    const { store } = setup(); imported(store, [presets[2]!]); store.acceptCurrentContext(); store.edit('remote-custom', { name: '已编辑本地项' })
    store.setToolMode('remote-custom', 'scene_save', 'default')
    const copy = store.replaceAsNewCopy('remote-custom')!
    expect(copy).toBeDefined(); expect(copy.preset.id).not.toBe('remote-custom'); expect(copy.preset.name).toContain('已编辑本地项')
    expect(copy.preset.enabled).toEqual([]); expect(copy.preset.disabled).toEqual(['scene_read']); expect(store.drafts).toHaveLength(1)
    expect(store.prepareExport()).toBeDefined(); expect(store.restoreBackup(true)).toBe(true)
    expect(store.activeId).toBe('remote-custom'); expect(store.active!.preset.name).toBe('已编辑本地项')
  })
  it('backs up explicit removal and preserves a still-present active ID on restore', () => {
    const { store } = setup(); imported(store, [preset('a', '甲'), preset('b', '乙')]); store.selectActive('b')
    expect(store.remove('a')).toBe(true); expect(store.activeId).toBe('b'); expect(store.restoreBackup(true)).toBe(true)
    expect(store.activeId).toBe('b'); expect(store.drafts).toHaveLength(2)
    expect(store.remove('missing')).toBe(false); expect(store.drafts).toHaveLength(2)
  })
  it('exports the whole batch as bounded original JSON and proves only preparation identity', () => {
    const { store } = setup(); imported(store, [preset('a', '甲'), preset('b', '乙')]); store.acceptCurrentContext()
    const result = store.prepareExport()!
    expect(JSON.parse(result.json)).toEqual({ schemaVersion: 1, presets: [preset('a', '甲'), preset('b', '乙')] })
    expect(result.filename).toBe('companion-tool-preset-drafts.json'); expect(store.isPreparedCurrent(result)).toBe(true)
    expect(store.isPreparedCurrent({ ...result })).toBe(false); expect(Object.isFrozen(result)).toBe(true)
  })
  it('requires service custom count plus local count to remain at most twenty', () => {
    const { store, context } = setup(), rows = Array.from({ length: 20 }, (_, index) => preset(`p${index}`, `本地 ${index}`))
    imported(store, rows); store.acceptCurrentContext(); expect(store.prepareExport()).toBeUndefined()
    store.syncContext({ ...context, presets: context.presets.slice(0, 2) }); store.acceptCurrentContext()
    expect(JSON.parse(store.prepareExport()!.json).presets).toHaveLength(20)
  })
  it.each(['loading', 'tools-failed', 'presets-failed', 'provider', 'project', 'tools', 'presets'] as const)('revokes both export and replacement handles immediately on %s', change => {
    const { store, context } = setup(); imported(store); store.acceptCurrentContext(); const ready = store.prepareExport()!; expect(ready).toBeDefined()
    const alter = (): ToolPresetDraftContext => {
      if (change === 'loading') return { ...context, loading: true }
      if (change === 'tools-failed') return { ...context, toolsReady: false }
      if (change === 'presets-failed') return { ...context, presetsReady: false }
      if (change === 'provider') return { ...context, provider: fixture().provider }
      if (change === 'project') return { ...context, projectId: 'project-b' }
      if (change === 'tools') return { ...context, tools: structuredClone(context.tools) }
      return { ...context, presets: structuredClone(context.presets) }
    }
    store.syncContext(alter()); expect(store.isPreparedCurrent(ready)).toBe(false); expect(store.preparedExport).toBeNull(); expect(store.contextAccepted).toBe(false)
    const importPreview = store.prepareImport(json([preset('replacement', '替换')]))!
    store.syncContext(context); expect(store.applyImport(importPreview, true)).toBe(false); expect(store.activeId).toBe('local-1')
  })
  it('does not automatically trust a reread or an A→B→A context round trip', () => {
    const { store, context } = setup(); imported(store); store.acceptCurrentContext(); const ready = store.prepareExport()!; expect(ready).toBeDefined()
    store.syncContext({ ...context, projectId: 'project-b' }); store.syncContext(context)
    expect(store.prepareExport()).toBeUndefined(); expect(store.isPreparedCurrent(ready)).toBe(false); expect(store.drafts).toHaveLength(1)
    expect(store.acceptCurrentContext()).toBe(true); expect(store.prepareExport()).toBeDefined()
  })
  it('detects in-place raw catalog mutation again at the export identity check', () => {
    const { store, context } = setup(); imported(store); store.acceptCurrentContext(); const ready = store.prepareExport()!; expect(ready).toBeDefined()
    ;(context.tools as ToolCatalogEntry[]).pop()
    expect(store.isPreparedCurrent(ready)).toBe(false); expect(store.contextAccepted).toBe(false); expect(store.prepareExport()).toBeUndefined()
  })
  it('retains draft memory across leaving and returning but requires a new explicit snapshot acceptance', () => {
    const { store, context } = setup(); imported(store); store.acceptCurrentContext(); const ready = store.prepareExport()!; expect(ready).toBeDefined()
    store.leave(); expect(store.drafts).toHaveLength(1); expect(store.isPreparedCurrent(ready)).toBe(false)
    store.syncContext(context); expect(store.prepareExport()).toBeUndefined(); store.acceptCurrentContext(); expect(store.prepareExport()).toBeDefined()
  })
  it.each(['edit', 'mode', 'selection', 'remove', 'clear-import'] as const)('makes a pending import unusable after %s', action => {
    const { store } = setup(); imported(store, [preset('a', '甲'), preset('b', '乙')]); const plan = store.prepareImport(json())!
    if (action === 'edit') store.edit('a', { name: '新甲' })
    if (action === 'mode') store.setToolMode('a', 'scene_read', 'enabled')
    if (action === 'selection') store.selectActive('b')
    if (action === 'remove') store.remove('a')
    if (action === 'clear-import') store.clearImport()
    expect(store.applyImport(plan, true)).toBe(false); expect(store.drafts.some(d => d.preset.id === 'local-1')).toBe(false)
  })
  it('does not allow callers to mutate prepared imports or current frozen drafts by reference', () => {
    const { store } = setup(), plan = store.prepareImport(json())!
    expect(() => (plan.presets as ToolPreset[]).push(preset('extra', '额外'))).toThrow()
    expect(() => { plan.presets[0]!.name = '篡改' }).toThrow()
    expect(store.applyImport({ ...plan }, true)).toBe(false); expect(store.applyImport(plan)).toBe(true)
    expect(() => store.drafts[0]!.preset.enabled.push('bad')).toThrow(); expect(() => { (store.drafts[0]!.source as { projectId: string }).projectId = 'bad' }).toThrow()
  })
  it('does not invalidate accepted context or an export on an identical sync emission', () => {
    const { store, context } = setup(); imported(store); store.acceptCurrentContext(); const ready = store.prepareExport()!, revision = store.revision
    store.syncContext({ ...context }); expect(store.revision).toBe(revision); expect(store.isPreparedCurrent(ready)).toBe(true)
  })
  it('allows a new clone beside a temporarily invalid sibling without repairing or losing that sibling', () => {
    const { store } = setup(); imported(store); store.edit('local-1', { name: '' })
    expect(store.cloneFrom('core')).toBeDefined(); expect(store.drafts).toHaveLength(2)
    expect(store.drafts.find(draft => draft.preset.id === 'local-1')!.preset.name).toBe('')
    expect(store.validation.status).toBe('invalid'); expect(store.prepareExport()).toBeUndefined()
  })
  it('does not refresh frozen provenance when a new project snapshot is explicitly accepted', () => {
    const { store, context } = setup(), draft = store.cloneFrom('core')!, origin = draft.source
    store.syncContext({ ...context, projectId: 'project-b' }); store.acceptCurrentContext(); store.edit(draft.preset.id, { name: '再次编辑' })
    expect(store.active!.source).toEqual(origin); expect(store.active!.source.projectId).toBe('project-a')
  })
  it('revokes a prepared export when edits or active selection change the reviewed state', () => {
    const { store } = setup(); imported(store, [preset('a', '甲'), preset('b', '乙')]); store.acceptCurrentContext()
    const first = store.prepareExport()!; expect(first).toBeDefined(); store.selectActive('b'); expect(store.isPreparedCurrent(first)).toBe(false)
    const second = store.prepareExport()!; store.edit('b', { name: '新乙' }); expect(store.isPreparedCurrent(second)).toBe(false)
    const third = store.prepareExport()!; store.setToolMode('b', 'scene_read', 'enabled'); expect(store.isPreparedCurrent(third)).toBe(false)
  })
  it('fails export when the current service snapshot itself has an unknown tool reference', () => {
    const { store, context } = setup(); imported(store)
    const changed = structuredClone(context.presets); changed[2]!.enabled = ['removed_tool']
    store.syncContext({ ...context, presets: changed }); expect(store.acceptCurrentContext()).toBe(true)
    expect(store.validation.status).toBe('invalid'); expect(store.prepareExport()).toBeUndefined()
  })
  it('detects in-place service preset mutation at the endpoint even without a sync emission', () => {
    const { store, context } = setup(); imported(store); store.acceptCurrentContext(); const ready = store.prepareExport()!; expect(ready).toBeDefined()
    context.presets[2]!.name = '已变化'
    expect(store.isPreparedCurrent(ready)).toBe(false); expect(store.prepareExport()).toBeUndefined(); expect(store.activeId).toBe('local-1')
  })

  it('does not invent a project origin for imported JSON while cloning keeps the read snapshot project', () => {
    const { store, context } = setup(); expect(context.projectId).toBe('project-a')
    imported(store)
    expect(store.active!.source).toMatchObject({ kind: 'import', projectId: '', presetId: 'local-1', presetName: '本地草稿' })
    const clone = store.cloneFrom('core')!
    expect(clone.source).toMatchObject({ kind: 'clone', projectId: 'project-a', presetId: 'core', presetName: '核心工具' })
  })

})
