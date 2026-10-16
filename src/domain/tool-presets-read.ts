/** Verified v148 tool visibility metadata. Neither profile nor access grants Creator permissions. */
export type ToolProfile = 'core' | 'full'
export interface ToolCatalogEntry {
  name: string
  displayNameZh: string
  description: string
  profile: ToolProfile
  scope: string
  /** Legacy tool-name heuristic, not a capability or authorization decision. */
  access: 'read' | 'write'
}
export interface ToolPreset {
  id: string
  name: string
  baseProfile: ToolProfile
  enabled: string[]
  disabled: string[]
  builtIn: boolean
  updatedAt: string
}
export interface ToolPresetRead { presets: ToolPreset[]; selectedPresetId: string }
export interface ToolPresetExport { schemaVersion: 1; presets: ToolPreset[] }
export interface ToolPresetReadProvider {
  readonly label: string
  loadTools(signal?: AbortSignal): Promise<ToolCatalogEntry[]>
  /** A returned selection is not evidence that projectId is registered. */
  loadPresets(projectId: string | undefined, signal?: AbortSignal): Promise<ToolPresetRead>
  /** Built-in exports are new custom clones; source identity must be checked against the selected metadata. */
  exportPreset(presetId: string, signal?: AbortSignal): Promise<ToolPresetExport>
}
export type ToolPresetReadEndpoint = 'tools' | 'presets' | 'export'
export type ToolPresetReadCode = 'unauthorized' | 'forbidden' | 'timeout' | 'aborted' | 'invalid-shape' | 'response-too-large' | 'http-error' | 'network-error' | 'invalid-query' | 'busy' | 'unknown-tool'
const failureText: Record<ToolPresetReadCode, string> = {
  unauthorized: '需要已有的 Companion 会话（401）。',
  forbidden: 'Companion 拒绝读取工具范围（403），请核对已有会话与同源部署。',
  timeout: '工具范围只读查询超时。', aborted: '工具范围只读查询已取消。',
  'invalid-shape': '工具范围响应不符合已核实的 v148 契约，请刷新后重试。',
  'response-too-large': '工具范围响应超出安全读取预算。',
  'http-error': '工具范围只读接口返回失败状态。', 'network-error': '未能完成同源工具范围连接。',
  'invalid-query': '工具范围查询参数无效。', busy: '工具范围并行读取已达到上限。',
  'unknown-tool': '工具范围引用了当前目录中未知的工具，请刷新目录与方案。',
}
/** Closed local text only. Never retain transport diagnostics, raw bodies, identifiers, URLs or causes. */
export class ToolPresetReadError extends Error {
  constructor(readonly code: ToolPresetReadCode, readonly endpoint?: ToolPresetReadEndpoint, readonly status?: number) {
    super(failureText[code])
    this.name = code === 'aborted' ? 'AbortError' : 'ToolPresetReadError'
  }
}
export const TOOL_PRESET_READ_LIMITS = Object.freeze({
  maxTools: 512, maxPresets: 22, maxResponseBytes: 1_048_576, maxResponseChunks: 2048,
  maxConcurrentRequests: 3, defaultTimeoutMs: 4000, maxTimeoutMs: 4000,
})
const builtInStamp = '1970-01-01T00:00:00.000Z'
const builtInNames = { core: '核心工具', full: '全部工具' } as const
const invalid = (endpoint: ToolPresetReadEndpoint) => new ToolPresetReadError('invalid-shape', endpoint)
export function isToolPresetId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) }
export function isToolPresetProjectId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value) }
function record(value: unknown, endpoint: ToolPresetReadEndpoint): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(endpoint)
  return value as Record<string, unknown>
}
function text(value: unknown, max: number, endpoint: ToolPresetReadEndpoint, multiline = false): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || (multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u : /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u).test(value)) throw invalid(endpoint)
  return value
}
function profile(value: unknown, endpoint: ToolPresetReadEndpoint): ToolProfile {
  if (value !== 'core' && value !== 'full') throw invalid(endpoint)
  return value
}
function toolName(value: unknown, endpoint: ToolPresetReadEndpoint): string {
  // MCP tool IDs from the verified specs; this is lexical validation, not a membership check.
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw invalid(endpoint)
  return value
}
function list(value: unknown, max: number, endpoint: ToolPresetReadEndpoint): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw invalid(endpoint)
  return value
}
function unique<T>(values: T[], key: (value: T) => string, endpoint: ToolPresetReadEndpoint): T[] {
  if (new Set(values.map(key)).size !== values.length) throw invalid(endpoint)
  return values
}
function timestamp(value: unknown, endpoint: ToolPresetReadEndpoint): string {
  const result = text(value, 64, endpoint)
  // z.iso.datetime() uses UTC (no offset/local mode); validate real calendar days as well.
  const parts = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?Z$/.exec(result)
  if (!parts) throw invalid(endpoint)
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3])
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]!) throw invalid(endpoint)
  return result
}
/** Strict field projection: unknown fields never reach display or downloaded JSON. */
export function decodeToolCatalog(value: unknown): ToolCatalogEntry[] {
  const endpoint = 'tools'
  const rows = unique(list(value, TOOL_PRESET_READ_LIMITS.maxTools, endpoint).map((value) => {
    const raw = record(value, endpoint)
    if (raw.access !== 'read' && raw.access !== 'write') throw invalid(endpoint)
    return {
      name: toolName(raw.name, endpoint), displayNameZh: text(raw.displayNameZh, 256, endpoint),
      description: text(raw.description, 8192, endpoint, true), profile: profile(raw.profile, endpoint),
      scope: text(raw.scope, 128, endpoint), access: raw.access,
    } satisfies ToolCatalogEntry
  }), (entry) => entry.name, endpoint)
  if (!rows.length) throw invalid(endpoint)
  return rows
}
export function decodeToolPreset(value: unknown, endpoint: ToolPresetReadEndpoint = 'presets'): ToolPreset {
  const raw = record(value, endpoint)
  if (!isToolPresetId(raw.id) || typeof raw.builtIn !== 'boolean') throw invalid(endpoint)
  const result: ToolPreset = {
    id: raw.id, name: text(raw.name, 40, endpoint), baseProfile: profile(raw.baseProfile, endpoint),
    enabled: unique(list(raw.enabled, TOOL_PRESET_READ_LIMITS.maxTools, endpoint).map((name) => toolName(name, endpoint)), (name) => name, endpoint),
    disabled: unique(list(raw.disabled, TOOL_PRESET_READ_LIMITS.maxTools, endpoint).map((name) => toolName(name, endpoint)), (name) => name, endpoint),
    builtIn: raw.builtIn, updatedAt: timestamp(raw.updatedAt, endpoint),
  }
  if (result.name !== result.name.trim() || result.enabled.some((name) => result.disabled.includes(name))) throw invalid(endpoint)
  const reserved = result.id === 'core' || result.id === 'full'
  if (result.builtIn !== reserved) throw invalid(endpoint)
  if (reserved) {
    if (result.name !== builtInNames[result.id as ToolProfile] || result.baseProfile !== result.id || result.enabled.length || result.disabled.length || result.updatedAt !== builtInStamp) throw invalid(endpoint)
  } else if (['core', 'full'].includes(result.name.toLowerCase())) throw invalid(endpoint)
  return result
}
export function decodeToolPresetRead(value: unknown): ToolPresetRead {
  const raw = record(value, 'presets')
  const presets = unique(list(raw.presets, TOOL_PRESET_READ_LIMITS.maxPresets, 'presets').map((value) => decodeToolPreset(value)), (preset) => preset.id, 'presets')
  // v148 reserves the English core/full names, but permits custom names equal to the built-in Chinese labels.
  unique(presets.filter((preset) => !preset.builtIn), (preset) => preset.name.toLowerCase(), 'presets')
  if (!presets.some((preset) => preset.id === 'core') || !presets.some((preset) => preset.id === 'full') || !isToolPresetId(raw.selectedPresetId) || !presets.some((preset) => preset.id === raw.selectedPresetId)) throw invalid('presets')
  return { presets, selectedPresetId: raw.selectedPresetId }
}
export function decodeToolPresetExport(value: unknown): ToolPresetExport {
  const raw = record(value, 'export')
  if (raw.schemaVersion !== 1) throw invalid('export')
  const presets = list(raw.presets, 1, 'export').map((value) => decodeToolPreset(value, 'export'))
  if (presets.length !== 1 || presets[0]!.builtIn) throw invalid('export')
  return { schemaVersion: 1, presets }
}
/** Safe serialization reprojects even values obtained from a custom/injected provider. */
export function serializeToolPresetExport(value: unknown): string { return `${JSON.stringify(decodeToolPresetExport(value), null, 2)}\n` }
/** A missing/invalid catalog and unknown overrides fail closed, never fall back to the full profile. */
export function validateToolPresetCatalog(preset: ToolPreset, tools: readonly ToolCatalogEntry[]): void {
  const checked = decodeToolPreset(preset)
  const names = new Set(decodeToolCatalog(tools).map((tool) => tool.name))
  if ([...checked.enabled, ...checked.disabled].some((name) => !names.has(name))) throw new ToolPresetReadError('unknown-tool', 'presets')
}
/** The v148 visibility algorithm only. Creator Bridge permissions are independently enforced. */
export function effectiveToolNames(preset: ToolPreset, tools: readonly ToolCatalogEntry[]): Set<string> {
  validateToolPresetCatalog(preset, tools)
  const names = new Set(tools.filter((tool) => preset.baseProfile === 'full' || tool.profile === 'core').map((tool) => tool.name))
  for (const name of preset.disabled) names.delete(name)
  for (const name of preset.enabled) names.add(name)
  return names
}
