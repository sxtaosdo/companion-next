import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { clonePresetDraft, parsePresetDraftImport, serializePresetDrafts, ToolPresetDraftError, TOOL_PRESET_DRAFT_LIMITS, validateDraftCollection } from '../domain/tool-preset-drafts'
import { decodeToolCatalog, decodeToolPresetRead } from '../domain/tool-presets-read'
import type { ToolCatalogEntry, ToolPreset, ToolPresetReadProvider, ToolProfile } from '../domain/tool-presets-read'

export interface ToolPresetDraftSource {
  readonly kind: 'clone' | 'import' | 'local-copy'
  readonly providerLabel: string
  readonly projectId: string
  readonly presetId: string
  readonly presetName: string
  readonly updatedAt: string
}
export interface ToolPresetDraft { readonly preset: ToolPreset; readonly source: ToolPresetDraftSource }
export interface ToolPresetDraftContext {
  provider: ToolPresetReadProvider | null
  projectId: string
  tools: readonly ToolCatalogEntry[]
  presets: readonly ToolPreset[]
  toolsReady: boolean
  presetsReady: boolean
  loading: boolean
}
export interface PreparedDraftImport { readonly presets: readonly ToolPreset[]; readonly requiresReplacement: boolean }
export interface PreparedDraftExport { readonly json: string; readonly filename: string }
export type ToolPresetDraftMode = 'default' | 'enabled' | 'disabled'
export interface ToolPresetDraftValidation { status: 'unverified' | 'invalid' | 'valid'; message: string }
interface Backup { drafts: readonly ToolPresetDraft[]; activeId: string }
interface AcceptedContext { revision: number; tools: ToolCatalogEntry[]; presets: ToolPreset[] }
const unverified = '当前工具目录与预设列表尚未确认，工具成员关系及导入冲突未核验。'
const frozenPreset = (preset: ToolPreset): ToolPreset => Object.freeze({ ...preset, enabled: Object.freeze([...preset.enabled]) as unknown as string[], disabled: Object.freeze([...preset.disabled]) as unknown as string[] })
const frozenDraft = (preset: ToolPreset, source: ToolPresetDraftSource): ToolPresetDraft => Object.freeze({ preset: frozenPreset(preset), source: Object.freeze({ ...source }) })

/** Page-only state. It has no persistence, transport methods or service project selection. */
export const useToolPresetDraftsStore = defineStore('tool-preset-drafts', () => {
  const items = shallowRef<readonly ToolPresetDraft[]>(Object.freeze([]))
  const selectedId = ref(''), error = ref(''), revision = ref(0), contextRevision = ref(0)
  const importPlan = shallowRef<PreparedDraftImport | null>(null), exportPlan = shallowRef<PreparedDraftExport | null>(null)
  const backup = shallowRef<Backup | null>(null), accepted = shallowRef<AcceptedContext | null>(null)
  let context: ToolPresetDraftContext | null = null, contextFingerprint = ''
  let importRevision = -1, exportRevision = -1
  const drafts = computed(() => items.value), activeId = computed(() => selectedId.value)
  const active = computed(() => items.value.find(draft => draft.preset.id === selectedId.value))
  const preparedImport = computed(() => importPlan.value), preparedExport = computed(() => exportPlan.value)
  const backupAvailable = computed(() => backup.value !== null)
  const contextAccepted = computed(() => accepted.value !== null && accepted.value.revision === contextRevision.value)
  const validation = computed<ToolPresetDraftValidation>(() => {
    if (items.value.length) {
      try { parsePresetDraftImport(JSON.stringify(payload())) }
      catch (cause) { return { status: 'invalid', message: message(cause) } }
    }
    if (!contextAccepted.value || !accepted.value) return { status: 'unverified', message: unverified }
    if (!items.value.length) return { status: 'unverified', message: '尚无本地草稿。' }
    try {
      validateDraftCollection(payload(), accepted.value.tools, accepted.value.presets)
      return { status: 'valid', message: '已按本次确认的只读目录与预设快照核验；尚未写入服务。' }
    } catch (cause) { return { status: 'invalid', message: message(cause) } }
  })
  function message(cause: unknown) {
    return cause instanceof ToolPresetDraftError ? new ToolPresetDraftError(cause.code).message : '草稿操作未完成，请检查输入并重新读取目录与预设。'
  }
  function payload() { return { schemaVersion: 1, presets: items.value.map(draft => draft.preset) } }
  function clearImport() { importPlan.value = null; importRevision = -1 }
  function invalidatePlans() { clearImport(); exportPlan.value = null; exportRevision = -1 }
  function changed() { revision.value++; invalidatePlans(); error.value = '' }
  function fingerprint(next: ToolPresetDraftContext) {
    try { return JSON.stringify([next.projectId, next.toolsReady, next.presetsReady, next.loading, next.tools, next.presets]) }
    catch { return null }
  }
  /** Feed every loading, failure and identity transition synchronously from the read-only store. */
  function syncContext(next: ToolPresetDraftContext) {
    const signature = fingerprint(next)
    const same = context && signature !== null && signature === contextFingerprint && next.provider === context.provider && next.tools === context.tools && next.presets === context.presets
    context = { ...next }
    contextFingerprint = signature ?? ''
    if (same) return
    contextRevision.value++; accepted.value = null; changed()
  }
  // Recheck raw values at action endpoints too, including accidental in-place caller changes.
  function invalidateContext() { context = null; contextFingerprint = ''; contextRevision.value++; accepted.value = null; changed() }
  function guardContext() {
    if (context && fingerprint(context) !== contextFingerprint) syncContext(context)
  }
  function ready() { return context?.provider && context.toolsReady && context.presetsReady && !context.loading }
  function acceptCurrentContext(): boolean {
    guardContext(); changed(); accepted.value = null
    if (!ready() || !context) { error.value = unverified; return false }
    try {
      const tools = decodeToolCatalog(context.tools)
      const presets = decodeToolPresetRead({ presets: context.presets, selectedPresetId: 'full' }).presets
      accepted.value = { revision: contextRevision.value, tools, presets }
      return true
    } catch (cause) { error.value = message(cause); return false }
  }
  function source(preset: ToolPreset, kind: ToolPresetDraftSource['kind']): ToolPresetDraftSource {
    return { kind, providerLabel: kind === 'import' ? 'JSON 导入' : context?.provider?.label ?? '本地草稿', projectId: kind === 'import' ? '' : context?.projectId ?? '', presetId: preset.id, presetName: preset.name, updatedAt: preset.updatedAt }
  }
  function assign(next: readonly ToolPresetDraft[], preferredId = selectedId.value) {
    items.value = Object.freeze([...next])
    selectedId.value = next.some(draft => draft.preset.id === preferredId) ? preferredId : next[0]?.preset.id ?? ''
    changed()
  }
  function saveBackup() { backup.value = { drafts: items.value, activeId: selectedId.value } }
  function selectActive(id: string) {
    if (id === selectedId.value || !items.value.some(draft => draft.preset.id === id)) return
    selectedId.value = id; changed()
  }
  function cloneFrom(id: string): ToolPresetDraft | undefined {
    guardContext(); invalidatePlans(); error.value = ''
    if (!context?.provider || !context.presetsReady || context.loading) { error.value = '请先读取当前预设列表，再选择要复制的预设。'; return }
    if (items.value.length >= TOOL_PRESET_DRAFT_LIMITS.maxPresets) { error.value = '本地最多保留 20 个草稿。'; return }
    try {
      const presets = decodeToolPresetRead({ presets: context.presets, selectedPresetId: 'full' }).presets
      const original = presets.find(preset => preset.id === id)
      if (!original) { error.value = '所选来源不在当前已读预设中，请重新选择。'; return }
      const preset = clonePresetDraft(original, [...presets, ...items.value.map(draft => draft.preset)])
      const draft = frozenDraft(preset, source(original, 'clone'))
      // Choosing this current snapshot is explicit. A missing catalog still leaves the copy unverified.
      if (ready()) acceptCurrentContext()
      assign([...items.value, draft], preset.id)
      return draft
    } catch (cause) { error.value = message(cause); return }
  }
  /** Explicitly replace a local item with a fresh custom copy; never silently change imported IDs. */
  function replaceAsNewCopy(id: string): ToolPresetDraft | undefined {
    guardContext(); invalidatePlans(); error.value = ''
    const original = items.value.find(draft => draft.preset.id === id)
    if (!original) return
    try {
      const occupied = [...(context?.presetsReady ? context.presets : []), ...items.value.map(draft => draft.preset)]
      const preset = clonePresetDraft(original.preset, occupied)
      const draft = frozenDraft(preset, { ...original.source, kind: 'local-copy', presetId: original.preset.id, presetName: original.preset.name, updatedAt: original.preset.updatedAt })
      saveBackup(); assign(items.value.map(item => item === original ? draft : item), preset.id)
      return draft
    } catch (cause) { error.value = message(cause); return }
  }
  function replaceEdited(id: string, patch: Partial<Pick<ToolPreset, 'name' | 'baseProfile' | 'enabled' | 'disabled'>>): boolean {
    guardContext(); invalidatePlans(); error.value = ''
    if (!items.value.some(draft => draft.preset.id === id)) return false
    // A text field may temporarily be empty, reserved or duplicate while the user edits it.
    // Retain that input locally; the validation report and export endpoint stay strict.
    if (patch.name !== undefined && (typeof patch.name !== 'string' || patch.name.length > 40)) { error.value = '草稿名称最多 40 个字符。'; return false }
    if (patch.baseProfile !== undefined && patch.baseProfile !== 'core' && patch.baseProfile !== 'full') { error.value = '基础范围仅支持 core 或 full。'; return false }
    assign(items.value.map(draft => draft.preset.id === id ? frozenDraft({ ...draft.preset, ...patch, updatedAt: new Date().toISOString() }, draft.source) : draft))
    return true
  }
  function edit(id: string, patch: { name?: string; baseProfile?: ToolProfile }): boolean {
    // Copy only these two fields even when called from untyped code.
    return replaceEdited(id, { ...(patch.name === undefined ? {} : { name: patch.name }), ...(patch.baseProfile === undefined ? {} : { baseProfile: patch.baseProfile }) })
  }
  function setToolMode(id: string, toolName: string, mode: ToolPresetDraftMode): boolean {
    guardContext(); invalidatePlans(); error.value = ''
    const original = items.value.find(draft => draft.preset.id === id)?.preset
    if (!original || !['default', 'enabled', 'disabled'].includes(mode)) return false
    if (mode !== 'default') {
      try {
        if (!context?.provider || !context.toolsReady || context.loading || !decodeToolCatalog(context.tools).some(tool => tool.name === toolName)) {
          error.value = '仅能为当前已读取目录中的工具新增覆盖项。'; return false
        }
      } catch { error.value = '当前工具目录未核验，请先重新读取。'; return false }
    }
    const enabled = original.enabled.filter(name => name !== toolName), disabled = original.disabled.filter(name => name !== toolName)
    if (mode === 'enabled') enabled.push(toolName)
    if (mode === 'disabled') disabled.push(toolName)
    return replaceEdited(id, { enabled, disabled })
  }
  function prepareImport(json: string): PreparedDraftImport | undefined {
    guardContext(); invalidatePlans(); error.value = ''
    try {
      const checked = parsePresetDraftImport(json)
      const result = Object.freeze({ presets: Object.freeze(checked.presets.map(frozenPreset)), requiresReplacement: items.value.length > 0 })
      importPlan.value = result; importRevision = revision.value
      return result
    } catch (cause) { error.value = message(cause); return }
  }
  function applyImport(prepared: PreparedDraftImport, replaceConfirmed = false): boolean {
    guardContext(); error.value = ''
    if (prepared !== importPlan.value || importRevision !== revision.value) { error.value = '导入预览已失效，请重新解析当前 JSON。'; return false }
    if (items.value.length && !replaceConfirmed) { error.value = '请明确确认替换当前本地草稿；原集合会保留一份可恢复备份。'; return false }
    try {
      // Do not trust a previous check alone at the mutating endpoint.
      const checked = parsePresetDraftImport(JSON.stringify({ schemaVersion: 1, presets: prepared.presets }))
      const next = checked.presets.map(preset => frozenDraft(preset, source(preset, 'import')))
      if (items.value.length) saveBackup()
      assign(next)
      return true
    } catch (cause) { error.value = message(cause); return false }
  }
  function remove(id: string): boolean {
    guardContext()
    if (!items.value.some(draft => draft.preset.id === id)) return false
    saveBackup(); assign(items.value.filter(draft => draft.preset.id !== id)); return true
  }
  function restoreBackup(confirmReplace: boolean): boolean {
    guardContext()
    if (!backup.value) return false
    if (!confirmReplace) { error.value = '请明确确认恢复备份并替换当前本地草稿。'; return false }
    const previous = backup.value, preferredId = selectedId.value
    saveBackup()
    const restoredActive = previous.drafts.some(draft => draft.preset.id === preferredId) ? preferredId : previous.activeId
    assign(previous.drafts, restoredActive)
    return true
  }
  function prepareExport(): PreparedDraftExport | undefined {
    guardContext(); invalidatePlans(); error.value = ''
    if (!ready() || !contextAccepted.value || !accepted.value || !context) { error.value = unverified; return }
    try {
      // Both the live read state and complete current payload are revalidated at the endpoint.
      const currentTools = decodeToolCatalog(context.tools)
      const currentPresets = decodeToolPresetRead({ presets: context.presets, selectedPresetId: 'full' }).presets
      const json = serializePresetDrafts(payload(), currentTools, currentPresets)
      if (new TextEncoder().encode(json).byteLength > TOOL_PRESET_DRAFT_LIMITS.maxBytes) { error.value = '导出 JSON 超出安全预算，未准备下载。'; return }
      const result = Object.freeze({ json, filename: 'companion-tool-preset-drafts.json' })
      exportPlan.value = result; exportRevision = revision.value
      return result
    } catch (cause) { error.value = message(cause); return }
  }
  function isPreparedCurrent(prepared: PreparedDraftExport): boolean {
    guardContext()
    return prepared === exportPlan.value && exportRevision === revision.value && Boolean(ready()) && contextAccepted.value
  }
  return { drafts, activeId, active, error, revision, contextRevision, validation, preparedImport, preparedExport, backupAvailable, contextAccepted, syncContext, invalidateContext, leave: invalidateContext, acceptCurrentContext, cloneFrom, replaceAsNewCopy, edit, setToolMode, selectActive, prepareImport, applyImport, clearImport, cancelImportPreview: clearImport, remove, restoreBackup, prepareExport, isPreparedCurrent }
})
