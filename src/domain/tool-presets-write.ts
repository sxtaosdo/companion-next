import { decodeToolCatalog, decodeToolPreset, decodeToolPresetRead, isToolPresetId, isToolPresetProjectId, validateToolPresetCatalog } from './tool-presets-read'
import type { ToolCatalogEntry, ToolPreset, ToolPresetRead } from './tool-presets-read'
import { parsePresetDraftImport, validateDraftCollection } from './tool-preset-drafts'

export type ToolPresetWriteOperation =
  | { kind: 'create'; source: ToolPreset; preset: ToolPreset }
  | { kind: 'update'; before: ToolPreset; preset: ToolPreset }
  | { kind: 'import'; presets: ToolPreset[] }
  | { kind: 'assign'; projectId: string; previous: ToolPreset; preset: ToolPreset }
  | { kind: 'delete'; preset: ToolPreset; resetLinkedProjects?: true }
export interface ToolPresetWriteInput { operation: ToolPresetWriteOperation; approved: true }
export type ToolPresetWriteReceipt = { kind: 'preset'; preset: ToolPreset; batchSize: number } | { kind: 'deleted'; projectIds: string[] }
export interface ToolPresetWriteProvider {
  readonly label: string
  execute(input: ToolPresetWriteInput, signal?: AbortSignal): Promise<ToolPresetWriteReceipt>
  /** Resolves only after all dispatched fetch/body/cancel I/O actually settles. */
  waitForIdle(): Promise<void>
}
export type ToolPresetWriteOutcome = 'not-sent' | 'rejected' | 'unknown'
export type ToolPresetWriteCode = 'invalid-input' | 'busy' | 'aborted' | 'timeout' | 'unauthorized' | 'forbidden' | 'in-use' | 'invalid-shape' | 'response-too-large' | 'network-error' | 'unconfirmed'
const messages: Record<ToolPresetWriteCode, string> = {
  'invalid-input': '工具预设参数或确认无效，未发送请求。', busy: '已有工具预设请求尚未结束，未发送新请求。',
  aborted: '已停止等待；宿主可能仍完成持久化，结果未知，不会自动重试。', timeout: '等待超时；持久化结果未知，不会自动重试。',
  unauthorized: '现有 Companion 会话无效，宿主拒绝本次请求（401）。', forbidden: '宿主拒绝本次请求（403）。',
  'in-use': '该预设仍被工程使用，普通删除已拒绝。若要删除并使所有关联工程回退 full，须另行准备并明确确认；不会自动重试。',
  'invalid-shape': '回执无法与本次确认内容对应，持久化结果未知。', 'response-too-large': '回执超过安全预算，持久化结果未知。',
  'network-error': '连接未正常完成，持久化结果未知。', unconfirmed: '宿主未返回可确认的操作回执，结果未知。',
}
export class ToolPresetWriteError extends Error {
  readonly projectIds: readonly string[]
  constructor(readonly code: ToolPresetWriteCode, readonly outcome: ToolPresetWriteOutcome, readonly status?: number, projectIds: readonly string[] = []) {
    super(code === 'aborted' && outcome === 'not-sent' ? '请求已在发送前取消。' : messages[code])
    this.name = 'ToolPresetWriteError'
    this.projectIds = Object.freeze(projectIds.filter(isToolPresetProjectId).slice(0, 1000))
  }
}
export const TOOL_PRESET_WRITE_LIMITS = Object.freeze({ maxRequestBytes: 1_048_576, maxResponseBytes: 1_048_576, maxResponseChunks: 2048, defaultTimeoutMs: 20_000, maxTimeoutMs: 20_000 })
const invalid = () => new ToolPresetWriteError('invalid-input', 'not-sent')
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw invalid()
  const own = Reflect.ownKeys(value)
  if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key) || !('value' in Object.getOwnPropertyDescriptor(value, key)!))) throw invalid()
  return value as Record<string, unknown>
}
const fields = ['id', 'name', 'baseProfile', 'enabled', 'disabled', 'builtIn', 'updatedAt']
function preset(value: unknown): ToolPreset { exact(value, fields); return decodeToolPreset(value) }
function custom(value: unknown): ToolPreset { const result = preset(value); if (result.builtIn) throw invalid(); return result }
/** Full snapshots travel locally for confirmation and receipt matching. Only legacy request fields are transmitted. */
export function validateToolPresetWriteInput(value: unknown): ToolPresetWriteInput {
  try {
    const raw = exact(value, ['operation', 'approved'])
    if (raw.approved !== true || !raw.operation || typeof raw.operation !== 'object') throw invalid()
    const kindDescriptor = Object.getOwnPropertyDescriptor(raw.operation, 'kind')
    if (!kindDescriptor || !('value' in kindDescriptor)) throw invalid()
    const kind: unknown = kindDescriptor.value
    let operation: ToolPresetWriteOperation
    if (kind === 'create') {
      const op = exact(raw.operation, ['kind', 'source', 'preset']); operation = { kind, source: preset(op.source), preset: custom(op.preset) }
      if (operation.source.id === operation.preset.id) throw invalid()
    } else if (kind === 'update') {
      const op = exact(raw.operation, ['kind', 'before', 'preset']); operation = { kind, before: custom(op.before), preset: custom(op.preset) }
      if (operation.before.id !== operation.preset.id) throw invalid()
    } else if (kind === 'import') {
      const op = exact(raw.operation, ['kind', 'presets'])
      if (!Array.isArray(op.presets) || !op.presets.length || op.presets.length > 20) throw invalid()
      const entries = Array.from(op.presets, custom)
      operation = { kind, presets: parsePresetDraftImport(JSON.stringify({ schemaVersion: 1, presets: entries })).presets }
    } else if (kind === 'assign') {
      const op = exact(raw.operation, ['kind', 'projectId', 'previous', 'preset'])
      if (!isToolPresetProjectId(op.projectId)) throw invalid()
      operation = { kind, projectId: op.projectId, previous: preset(op.previous), preset: preset(op.preset) }
    } else if (kind === 'delete') {
      const reset = Object.prototype.hasOwnProperty.call(raw.operation, 'resetLinkedProjects')
      const op = exact(raw.operation, reset ? ['kind', 'preset', 'resetLinkedProjects'] : ['kind', 'preset'])
      if (reset && op.resetLinkedProjects !== true) throw invalid()
      operation = { kind, preset: custom(op.preset), ...(reset ? { resetLinkedProjects: true as const } : {}) }
    } else throw invalid()
    if (new TextEncoder().encode(JSON.stringify(operation)).byteLength > TOOL_PRESET_WRITE_LIMITS.maxRequestBytes) throw invalid()
    return { operation, approved: true }
  } catch { throw invalid() }
}
export function sameToolPreset(left: ToolPreset, right: ToolPreset, ignore: readonly ('id' | 'updatedAt')[] = []): boolean {
  try {
    const a = preset(left), b = preset(right)
    return fields.every(key => ignore.includes(key as 'id' | 'updatedAt') || (key === 'enabled' || key === 'disabled'
      ? JSON.stringify([...a[key]].sort()) === JSON.stringify([...b[key]].sort())
      : a[key as keyof ToolPreset] === b[key as keyof ToolPreset]))
  } catch { return false }
}
/** Fail closed against the current bounded read snapshot; never infer project registration from the default full response. */
export function validateToolPresetWriteContext(operation: ToolPresetWriteOperation, tools: readonly ToolCatalogEntry[], snapshot: ToolPresetRead, registeredProjectIds: readonly string[]): void {
  const checked = validateToolPresetWriteInput({ operation, approved: true }).operation
  const catalog = decodeToolCatalog(tools), current = decodeToolPresetRead(snapshot)
  for (const item of current.presets) validateToolPresetCatalog(item, catalog)
  const has = (item: ToolPreset) => current.presets.some(existing => sameToolPreset(existing, item))
  if (checked.kind === 'create') {
    if (!has(checked.source)) throw invalid()
    validateDraftCollection({ schemaVersion: 1, presets: [checked.preset] }, catalog, current.presets)
  } else if (checked.kind === 'import') {
    validateDraftCollection({ schemaVersion: 1, presets: checked.presets }, catalog, current.presets)
  } else if (checked.kind === 'update') {
    if (!has(checked.before)) throw invalid()
    validateDraftCollection({ schemaVersion: 1, presets: [checked.preset] }, catalog, current.presets.filter(item => item.id !== checked.before.id))
  } else if (checked.kind === 'assign') {
    if (!registeredProjectIds.includes(checked.projectId) || !has(checked.previous) || !has(checked.preset) || current.selectedPresetId !== checked.previous.id) throw invalid()
  } else if (!has(checked.preset)) throw invalid()
}
export function decodeToolPresetWriteReceipt(raw: unknown, operation: ToolPresetWriteOperation): ToolPresetWriteReceipt {
  const mismatch = () => new ToolPresetWriteError('invalid-shape', 'unknown')
  try {
    if (operation.kind === 'delete') {
      const value = exact(raw, ['deleted', 'projectIds'])
      // Only the separately confirmed legacy deletion may reset associations.
      if (value.deleted !== true || !Array.isArray(value.projectIds) || value.projectIds.length > 1000 || !value.projectIds.every(isToolPresetProjectId) || new Set(value.projectIds).size !== value.projectIds.length || (!operation.resetLinkedProjects && value.projectIds.length)) throw mismatch()
      return { kind: 'deleted', projectIds: [...value.projectIds] }
    }
    const result = decodeToolPreset(raw), expected = operation.kind === 'import' ? operation.presets[0]! : operation.preset
    const ignore = operation.kind === 'create' ? ['id', 'updatedAt'] as const : operation.kind === 'update' ? ['updatedAt'] as const : []
    if (!sameToolPreset(result, expected, ignore) || operation.kind === 'create' && (!isToolPresetId(result.id) || result.builtIn || result.id === operation.source.id)) throw mismatch()
    return { kind: 'preset', preset: result, batchSize: operation.kind === 'import' ? operation.presets.length : 1 }
  } catch { throw mismatch() }
}
