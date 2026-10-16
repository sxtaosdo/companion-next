import { decodeAiResourceConfigV2, isAiProjectId } from './ai-resource-read'
import type { AiResourceConfigV2, AiResourceView } from './ai-resource-read'

export interface AiResourceSaveInput { config: AiResourceConfigV2; expectedHash: string | null; approved: true }
export interface AiResourceSaveProvider {
  readonly label: string
  saveConfig(projectId: string, input: AiResourceSaveInput, signal?: AbortSignal): Promise<AiResourceView>
}
export type AiResourceSaveOutcome = 'not-sent' | 'rejected' | 'conflict' | 'unknown'
export type AiResourceSaveCode = 'invalid-input' | 'busy' | 'aborted' | 'timeout' | 'unauthorized' | 'forbidden' | 'stale' | 'rejected' | 'unconfirmed' | 'invalid-shape' | 'response-too-large' | 'network-error'
const failureText: Record<AiResourceSaveCode, string> = {
  'invalid-input': 'AI 配置保存参数无效，未发送请求。', busy: '已有 AI 配置保存请求尚未结束，未发送新请求。',
  aborted: '已停止等待 AI 配置保存；是否发送及保存结果请核对状态。', timeout: 'AI 配置保存等待超时，保存结果未知，请先重新读取核对。',
  unauthorized: 'Companion 会话无效（401），保存请求被拒绝。', forbidden: 'Companion 拒绝保存（403），请核对已有会话与同源部署。',
  stale: 'AI 配置已变化，保存发生冲突；请重新读取后核对。', rejected: 'Companion 已明确拒绝本次 AI 配置保存。',
  unconfirmed: 'AI 配置保存结果未确认，请先重新读取核对。', 'invalid-shape': '保存响应不符合已核实的契约，保存结果未知。',
  'response-too-large': '保存响应超过安全读取预算，保存结果未知。', 'network-error': '保存连接未正常完成，保存结果未知，请先重新读取核对。',
}
/** Closed local metadata only. Never stores raw server messages, codes, response bodies, causes or URLs. */
export class AiResourceSaveError extends Error {
  constructor(readonly code: AiResourceSaveCode, readonly outcome: AiResourceSaveOutcome, readonly status?: number) {
    super(code === 'aborted' && outcome === 'not-sent' ? 'AI 配置保存已取消，未发送请求。' : failureText[code])
    this.name = 'AiResourceSaveError'
  }
}
export const AI_RESOURCE_SAVE_LIMITS = Object.freeze({
  maxRequestBytes: 128 * 1024, maxResponseBytes: 128 * 1024, maxResponseChunks: 4096,
  maxConcurrentRequests: 1, defaultTimeoutMs: 20_000, maxTimeoutMs: 20_000,
})
const invalid = () => new AiResourceSaveError('invalid-input', 'not-sent')
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const raw = value as Record<string, unknown>, own = Reflect.ownKeys(raw)
  if (own.length !== keys.length || own.some((key) => typeof key !== 'string' || !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(raw, key))) throw invalid()
  return raw
}
/** Matches the original strict v2 schema, with the reader's safe-display text and safe-integer bounds. */
export function validateAiResourceConfigV2(value: unknown, projectId: string): AiResourceConfigV2 {
  try {
    if (!isAiProjectId(projectId)) throw invalid()
    const raw = exact(value, ['schemaVersion', 'projectId', 'version', 'designResolution', 'orientation', 'iconSize', 'style', 'background', 'composition', 'destination'])
    exact(raw.designResolution, ['width', 'height']); exact(raw.iconSize, ['width', 'height'])
    const style = exact(raw.style, ['description', 'references'])
    exact(raw.background, ['format', 'transparent', 'color']); exact(raw.composition, ['centered', 'paddingPercent'])
    exact(raw.destination, ['directory', 'exportDirectory', 'naming'])
    if (typeof style.description !== 'string') throw invalid()
    return decodeAiResourceConfigV2({ ...raw, style: { description: style.description.trim(), references: style.references } }, projectId)
  } catch { throw invalid() }
}
export function validateAiResourceSaveInput(value: unknown, projectId: string): AiResourceSaveInput {
  try {
    const raw = exact(value, ['config', 'expectedHash', 'approved'])
    if (raw.approved !== true || raw.expectedHash !== null && (typeof raw.expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.expectedHash))) throw invalid()
    return { config: validateAiResourceConfigV2(raw.config, projectId), expectedHash: raw.expectedHash as string | null, approved: true }
  } catch { throw invalid() }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
/** Compares normalized editable configs; array order and color case are intentionally significant. Invalid input never matches. */
export function aiResourceConfigsEqual(a: unknown, b: unknown, options: { ignoreVersion?: boolean } = {}): boolean {
  try {
    const first = validateAiResourceConfigV2(a, (a as AiResourceConfigV2).projectId), second = validateAiResourceConfigV2(b, (b as AiResourceConfigV2).projectId)
    if (options.ignoreVersion) { first.version = 1; second.version = 1 }
    return canonical(first) === canonical(second)
  } catch { return false }
}
const fields = ['designResolution.width', 'designResolution.height', 'orientation', 'iconSize.width', 'iconSize.height', 'style.description', 'style.references', 'background.format', 'background.transparent', 'background.color', 'composition.centered', 'composition.paddingPercent', 'destination.directory', 'destination.exportDirectory', 'destination.naming'] as const
export type AiResourceConfigField = typeof fields[number]
export interface AiResourceConfigChange { field: AiResourceConfigField; before: string; after: string }
/** Leaf review diff. Identity/schema/version are context, not editable fields. Supports incomplete server drafts. */
export function aiResourceConfigChanges(before: AiResourceConfigV2 | null, after: AiResourceConfigV2): AiResourceConfigChange[] {
  const at = (config: AiResourceConfigV2 | null, field: AiResourceConfigField): string => {
    if (!config) return ''
    let value: unknown = config
    for (const key of field.split('.')) value = (value as Record<string, unknown>)[key]
    if (field === 'style.description' && typeof value === 'string') return value.trim()
    return typeof value === 'string' ? value : canonical(value)
  }
  return fields.flatMap(field => { const oldValue = at(before, field), newValue = at(after, field); return oldValue === newValue ? [] : [{ field, before: oldValue, after: newValue }] })
}
