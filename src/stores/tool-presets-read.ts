import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { effectiveToolNames, serializeToolPresetExport, decodeToolCatalog, decodeToolPresetRead, decodeToolPresetExport, ToolPresetReadError, validateToolPresetCatalog } from '../domain/tool-presets-read'
import type { ToolCatalogEntry, ToolPreset, ToolPresetReadProvider } from '../domain/tool-presets-read'
export interface PreparedPresetExport { json: string; filename: string }
export const useToolPresetsReadStore = defineStore('tool-presets-read', () => {
  const provider = shallowRef<ToolPresetReadProvider | null>(null)
  const tools = shallowRef<ToolCatalogEntry[]>([]), presets = shallowRef<ToolPreset[]>([])
  const toolsRead = ref(false), presetsRead = ref(false), toolsLoading = ref(false), presetsLoading = ref(false), exportLoading = ref(false)
  const toolsError = ref(''), presetsError = ref(''), exportError = ref('')
  const projectId = ref(''), selectedPresetId = ref(''), previewPresetId = ref('')
  const preparedExport = shallowRef<PreparedPresetExport | null>(null)
  const preview = computed(() => presets.value.find(preset => preset.id === previewPresetId.value))
  const scope = computed(() => {
    if (!toolsRead.value || !presetsRead.value || !preview.value) return { names: null, error: '' }
    try { return { names: effectiveToolNames(preview.value, tools.value), error: '' } }
    catch { return { names: null, error: '预设引用与当前工具目录不一致，范围未核验，请重新读取。' } }
  })
  let epoch = 0
  const versions = { tools: 0, presets: 0, export: 0 }
  const controllers: Partial<Record<keyof typeof versions, AbortController>> = {}
  function cancel(key: keyof typeof versions) { versions[key]++; controllers[key]?.abort(); delete controllers[key] }
  function begin(key: keyof typeof versions) {
    cancel(key)
    const controller = new AbortController(), identity = epoch, version = versions[key], source = provider.value
    controllers[key] = controller
    return { signal: controller.signal, current: () => identity === epoch && versions[key] === version && source === provider.value }
  }
  function clearExport() { cancel('export'); exportLoading.value = false; preparedExport.value = null; exportError.value = '' }
  function clearPresets() { cancel('presets'); presetsLoading.value = false; presetsRead.value = false; presets.value = []; selectedPresetId.value = ''; previewPresetId.value = ''; presetsError.value = ''; clearExport() }
  function cancelReads() { epoch++; cancel('tools'); toolsLoading.value = false; clearPresets() }
  function disconnect() { cancelReads(); provider.value = null; tools.value = []; toolsRead.value = false; toolsError.value = ''; projectId.value = '' }
  function setProjectContext(id: string, registeredIds: readonly string[]) {
    if (id && !registeredIds.includes(id)) { clearPresets(); projectId.value = ''; presetsError.value = '该工程未在当前已读取登记中，请先刷新工程列表。'; return }
    if (projectId.value !== id) { projectId.value = id; clearPresets() }
  }
  function selectPreview(id: string) { clearExport(); previewPresetId.value = presets.value.some(preset => preset.id === id) ? id : '' }
  function message(error: unknown) { return error instanceof ToolPresetReadError ? new ToolPresetReadError(error.code).message : '只读查询未完成；未显示内部诊断。' }
  async function loadTools(next?: ToolPresetReadProvider) {
    if (next && next !== provider.value) { disconnect(); provider.value = next }
    const active = provider.value
    if (!active || toolsLoading.value) return
    const read = begin('tools'); toolsLoading.value = true; toolsError.value = ''; toolsRead.value = false; tools.value = []; clearExport()
    try { const result = await active.loadTools(read.signal); if (read.current()) { tools.value = decodeToolCatalog(result); toolsRead.value = true } }
    catch (error) { if (read.current()) toolsError.value = message(error) }
    finally { if (read.current()) toolsLoading.value = false }
  }
  async function loadPresets() {
    const active = provider.value
    if (!active || presetsLoading.value) return
    clearPresets(); const read = begin('presets'), context = projectId.value; presetsLoading.value = true
    try { const result = await active.loadPresets(context || undefined, read.signal); if (!read.current() || context !== projectId.value) return
      const checked = decodeToolPresetRead(result); presets.value = checked.presets; selectedPresetId.value = checked.selectedPresetId; previewPresetId.value = checked.selectedPresetId; presetsRead.value = true
    } catch (error) { if (read.current()) presetsError.value = message(error) }
    finally { if (read.current()) presetsLoading.value = false }
  }
  function sameOverrides(left: ToolPreset, right: ToolPreset) {
    return left.baseProfile === right.baseProfile && ['enabled', 'disabled'].every(key => {
      const field = key as 'enabled' | 'disabled'
      return JSON.stringify([...left[field]].sort()) === JSON.stringify([...right[field]].sort())
    })
  }
  async function exportCurrent(): Promise<PreparedPresetExport | undefined> {
    const active = provider.value, original = preview.value
    if (!active || !presetsRead.value || !original || exportLoading.value || toolsLoading.value) return
    clearExport(); const read = begin('export'); exportLoading.value = true
    const context = projectId.value, id = previewPresetId.value
    try {
      const response = await active.exportPreset(id, read.signal)
      if (!read.current() || context !== projectId.value || id !== previewPresetId.value) return
      const result = decodeToolPresetExport(response)
      const exported = result.presets[0]
      const matches = exported && !exported.builtIn && sameOverrides(original, exported) && (original.builtIn
        ? !presets.value.some(preset => preset.id === exported.id) && exported.name === `${original.name} copy` && exported.updatedAt !== original.updatedAt
        : exported.id === original.id && exported.name === original.name && exported.updatedAt === original.updatedAt)
      if (!matches) { exportError.value = '导出与所预览的预设不一致，可能已被其他页面修改；请重新读取后再导出。'; return }
      if (toolsRead.value) validateToolPresetCatalog(exported!, tools.value)
      const prepared = { json: serializeToolPresetExport(result), filename: 'companion-tool-preset.json' }
      // Projection is already bounded by the reader; keep the serialized download bounded too.
      if (new TextEncoder().encode(prepared.json).byteLength > 1_048_576) { exportError.value = '导出 JSON 超出安全预算，未触发下载。'; return }
      preparedExport.value = prepared
      return prepared
    } catch (error) { if (read.current()) exportError.value = message(error) }
    finally { if (read.current()) exportLoading.value = false }
  }
  function isPreparedCurrent(value: PreparedPresetExport) { return preparedExport.value === value }
  return { provider, tools, presets, toolsRead, presetsRead, toolsLoading, presetsLoading, exportLoading, toolsError, presetsError, exportError, projectId, selectedPresetId, previewPresetId, preview, scope, preparedExport, loadTools, loadPresets, selectPreview, setProjectContext, exportCurrent, isPreparedCurrent, disconnect, cancelReads }
})
