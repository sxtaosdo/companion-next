import { decodeToolCatalog, decodeToolPreset, isToolPresetId } from './tool-presets-read'
import type { ToolCatalogEntry, ToolPreset, ToolPresetExport } from './tool-presets-read'

/** A page-local, portable v148 draft. No operation here saves or assigns a server preset. */
export const TOOL_PRESET_DRAFT_LIMITS = Object.freeze({
  maxBytes: 1_048_576, maxPresets: 20, maxTools: 512, maxDepth: 8,
})
export type ToolPresetDraftCode =
  | 'invalid-json' | 'invalid-shape' | 'unknown-field' | 'unsupported-schema'
  | 'input-too-large' | 'output-too-large' | 'too-deep' | 'invalid-id' | 'reserved-id'
  | 'invalid-name' | 'reserved-name' | 'invalid-tools' | 'duplicate-tool' | 'overlapping-tools'
  | 'duplicate-id' | 'duplicate-name' | 'existing-id-conflict' | 'existing-name-conflict'
  | 'too-many-presets' | 'unknown-catalog' | 'unknown-tools' | 'invalid-existing-presets' | 'identity-unavailable'
const messages: Record<ToolPresetDraftCode, string> = {
  'invalid-json': 'JSON 无法解析，请检查文件格式。',
  'invalid-shape': '草稿不符合 v148 工具预设格式。',
  'unknown-field': '草稿包含格式未定义的字段，请检查原文件。',
  'unsupported-schema': '仅支持 schemaVersion 为 1 的工具预设。',
  'input-too-large': '导入 JSON 超过 1 MiB 限制。',
  'output-too-large': '规范化后的导出 JSON 超过 1 MiB 限制。',
  'too-deep': 'JSON 嵌套层数超出安全限制。',
  'invalid-id': '草稿标识格式无效。',
  'reserved-id': 'core 和 full 是内置标识，草稿必须使用新的自定义标识。',
  'invalid-name': '草稿名称须为 1 至 40 个字符。',
  'reserved-name': 'core 和 full 是保留名称，请使用其他名称。',
  'invalid-tools': '工具列表格式无效或超出安全限制。',
  'duplicate-tool': '同一工具列表中不能重复列出工具。',
  'overlapping-tools': '同一工具不能同时启用和禁用。',
  'duplicate-id': '本批草稿存在重复标识。',
  'duplicate-name': '本批草稿存在重复名称。',
  'existing-id-conflict': '草稿标识与已读取的自定义预设冲突。',
  'existing-name-conflict': '草稿名称与已读取的自定义预设冲突。',
  'too-many-presets': '草稿与已读取的自定义预设合计不能超过 20 项。',
  'unknown-catalog': '需要先成功读取当前工具目录，才能验证或导出草稿。',
  'unknown-tools': '草稿或已读取的自定义预设包含当前工具目录中不存在的工具。',
  'invalid-existing-presets': '已读取的预设数据无法验证，请重新读取后再试。',
  'identity-unavailable': '无法生成新的草稿标识，请重新打开页面后再试。',
}
/** Closed local text: never reflect uploaded content, tool IDs, names or causes. */
export class ToolPresetDraftError extends Error {
  constructor(readonly code: ToolPresetDraftCode) {
    super(messages[code])
    this.name = 'ToolPresetDraftError'
  }
}
const fail = (code: ToolPresetDraftCode): never => { throw new ToolPresetDraftError(code) }
const presetKeys = ['id', 'name', 'baseProfile', 'enabled', 'disabled', 'builtIn', 'updatedAt']
function strictRecord(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('invalid-shape')
  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return fail('invalid-shape')
  const own = Reflect.ownKeys(value)
  if (own.some((key) => typeof key !== 'string' || !keys.includes(key))) return fail('unknown-field')
  if (own.length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) return fail('invalid-shape')
  // Do not run getters or toJSON supplied by injected callers.
  if (own.some((key) => !('value' in Object.getOwnPropertyDescriptor(value, key)!))) return fail('invalid-shape')
  return value as Record<string, unknown>
}
function normalizeTools(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > TOOL_PRESET_DRAFT_LIMITS.maxTools) return fail('invalid-tools')
  // Array.from also checks sparse slots instead of silently retaining holes.
  const names = Array.from(value, (name: unknown) => {
    if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(name)) return fail('invalid-tools')
    return name
  })
  if (new Set(names).size !== names.length) return fail('duplicate-tool')
  return names.sort()
}
function normalizeDraft(value: unknown): ToolPreset {
  const raw = strictRecord(value, presetKeys)
  if (!isToolPresetId(raw.id)) return fail('invalid-id')
  if (raw.id === 'core' || raw.id === 'full') return fail('reserved-id')
  if (raw.builtIn !== false) return fail('invalid-shape')
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 40 || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(raw.name)) return fail('invalid-name')
  const name = raw.name.trim()
  if (['core', 'full'].includes(name.toLowerCase())) return fail('reserved-name')
  const enabled = normalizeTools(raw.enabled), disabled = normalizeTools(raw.disabled)
  const disabledNames = new Set(disabled)
  if (enabled.some((tool) => disabledNames.has(tool))) return fail('overlapping-tools')
  try {
    // Reuse verified lexical, profile and real-calendar UTC timestamp rules.
    return decodeToolPreset({ ...raw, name, enabled, disabled })
  } catch { return fail('invalid-shape') }
}
function normalizedCollection(value: unknown): ToolPresetExport {
  const raw = strictRecord(value, ['schemaVersion', 'presets'])
  if (raw.schemaVersion !== 1) return fail('unsupported-schema')
  if (!Array.isArray(raw.presets) || !raw.presets.length) return fail('invalid-shape')
  if (raw.presets.length > TOOL_PRESET_DRAFT_LIMITS.maxPresets) return fail('too-many-presets')
  const presets = Array.from(raw.presets, normalizeDraft)
  const ids = new Set<string>(), names = new Set<string>()
  for (const preset of presets) {
    if (ids.has(preset.id)) return fail('duplicate-id')
    if (names.has(preset.name.toLowerCase())) return fail('duplicate-name')
    ids.add(preset.id); names.add(preset.name.toLowerCase())
  }
  return { schemaVersion: 1, presets }
}
function boundedOutput(value: ToolPresetExport): string {
  const output = `${JSON.stringify(value, null, 2)}\n`
  if (new TextEncoder().encode(output).byteLength > TOOL_PRESET_DRAFT_LIMITS.maxBytes) return fail('output-too-large')
  return output
}
function checkJsonDepth(text: string): void {
  let quoted = false, escaped = false, depth = 0
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{' || char === '[') {
      if (++depth > TOOL_PRESET_DRAFT_LIMITS.maxDepth) return fail('too-deep')
    } else if (char === '}' || char === ']') depth--
  }
}
/** Strict import parsing preserves unknown-tool references for later catalog validation. */
export function parsePresetDraftImport(text: string): ToolPresetExport {
  if (typeof text !== 'string') return fail('invalid-json')
  if (text.length > TOOL_PRESET_DRAFT_LIMITS.maxBytes || new TextEncoder().encode(text).byteLength > TOOL_PRESET_DRAFT_LIMITS.maxBytes) return fail('input-too-large')
  checkJsonDepth(text)
  let value: unknown
  try { value = JSON.parse(text) } catch { return fail('invalid-json') }
  const result = normalizedCollection(value)
  boundedOutput(result)
  return result
}
function checkedExisting(value: readonly ToolPreset[]): ToolPreset[] {
  const maxCustom = TOOL_PRESET_DRAFT_LIMITS.maxPresets
  if (!Array.isArray(value) || value.length > maxCustom + 2) return fail('invalid-existing-presets')
  let presets: ToolPreset[]
  try { presets = Array.from(value, (preset) => decodeToolPreset(preset)) } catch { return fail('invalid-existing-presets') }
  const custom = presets.filter((preset) => !preset.builtIn)
  if (new Set(presets.map((preset) => preset.id)).size !== presets.length || new Set(custom.map((preset) => preset.name.toLowerCase())).size !== custom.length || custom.length > maxCustom) return fail('invalid-existing-presets')
  return presets
}
function checkConflicts(presets: readonly ToolPreset[], existing: readonly ToolPreset[]): void {
  const custom = existing.filter((preset) => !preset.builtIn)
  const ids = new Set(custom.map((preset) => preset.id)), names = new Set(custom.map((preset) => preset.name.toLowerCase()))
  if (presets.some((preset) => ids.has(preset.id))) return fail('existing-id-conflict')
  if (presets.some((preset) => names.has(preset.name.toLowerCase()))) return fail('existing-name-conflict')
  if (presets.length + custom.length > TOOL_PRESET_DRAFT_LIMITS.maxPresets) return fail('too-many-presets')
}
/**
 * Catalog means the caller's current, successfully read bounded directory, not a permission grant.
 * Missing/invalid directory and unknown references fail closed; no items are silently dropped.
 */
export function validateDraftCollection(value: unknown, catalog: readonly ToolCatalogEntry[] | undefined, existingPresets: readonly ToolPreset[] = []): ToolPresetExport {
  const result = normalizedCollection(value)
  boundedOutput(result)
  const existing = checkedExisting(existingPresets)
  checkConflicts(result.presets, existing)
  let tools: ToolCatalogEntry[]
  try { tools = decodeToolCatalog(catalog) } catch { return fail('unknown-catalog') }
  const names = new Set(tools.map((tool) => tool.name))
  if ([...result.presets, ...existing].some((preset) => [...preset.enabled, ...preset.disabled].some((tool) => !names.has(tool)))) return fail('unknown-tools')
  return result
}
export interface ClonePresetDraftOptions { id?: string; now?: string; name?: string }
/** Always creates a detached custom identity, even when the source is already custom. */
export function clonePresetDraft(source: ToolPreset, existingPresets: readonly ToolPreset[] = [], options: ClonePresetDraftOptions = {}): ToolPreset {
  let checked: ToolPreset
  try {
    const raw = strictRecord(source, presetKeys)
    // Custom page drafts use the same strict name normalization as import/export.
    // Built-in source metadata must remain an exact verified built-in record.
    checked = raw.builtIn === false ? normalizeDraft(raw) : decodeToolPreset(raw)
  } catch (error) {
    if (error instanceof ToolPresetDraftError) throw error
    return fail('invalid-shape')
  }
  // This is an occupancy list, not an export. Local drafts may be temporarily invalid,
  // and an imported conflicting ID must still be repairable by making a new copy.
  if (!Array.isArray(existingPresets) || existingPresets.length > TOOL_PRESET_DRAFT_LIMITS.maxPresets * 2 + 2) return fail('invalid-existing-presets')
  const ids = new Set<string>(), names = new Set<string>()
  for (const preset of [...existingPresets, checked]) {
    if (!preset || typeof preset !== 'object') return fail('invalid-existing-presets')
    if (isToolPresetId(preset.id)) ids.add(preset.id)
    if (!preset.builtIn && typeof preset.name === 'string' && preset.name.trim().length <= 40) names.add(preset.name.trim().toLowerCase())
  }
  let id = options.id
  if (id === undefined) {
    if (typeof globalThis.crypto?.randomUUID !== 'function') return fail('identity-unavailable')
    try { id = `preset-${globalThis.crypto.randomUUID()}` } catch { return fail('identity-unavailable') }
  }
  if (id === checked.id) return fail(checked.builtIn ? 'reserved-id' : 'existing-id-conflict')
  let name = options.name
  if (name === undefined) {
    for (let index = 1; index <= names.size + 1; index++) {
      const suffix = index === 1 ? ' copy' : ` copy ${index}`
      let prefix = checked.name.slice(0, 40 - suffix.length).trimEnd()
      // Avoid cutting a UTF-16 surrogate pair at the length boundary.
      if (/[\uD800-\uDBFF]$/u.test(prefix)) prefix = prefix.slice(0, -1)
      const candidate = `${prefix}${suffix}`
      if (!names.has(candidate.toLowerCase())) { name = candidate; break }
    }
  }
  const draft = normalizeDraft({ ...checked, id, name, builtIn: false, updatedAt: options.now ?? new Date().toISOString() })
  if (ids.has(draft.id)) return fail('existing-id-conflict')
  if (names.has(draft.name.toLowerCase())) return fail('existing-name-conflict')
  return draft
}
/** Export is the final fail-closed check, never an assertion of server persistence or assignment. */
export function serializePresetDrafts(value: unknown, catalog: readonly ToolCatalogEntry[] | undefined, existingPresets: readonly ToolPreset[] = []): string {
  return boundedOutput(validateDraftCollection(value, catalog, existingPresets))
}
