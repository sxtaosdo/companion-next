/** Read-only projection of the verified Companion v148 icon-resource contract. */
export interface AiSize { width: number; height: number }
export type AiOrientation = 'portrait' | 'landscape' | 'square'
export interface AiResourceStyle { description: string; references: string[] }
interface AiResourceCommon {
  version: number
  designResolution: AiSize
  orientation: AiOrientation
  style: AiResourceStyle
  composition: { centered: true; paddingPercent: number }
}
export interface AiResourceConfigV1 extends AiResourceCommon {
  schemaVersion: 'project-resource-config-v1'
  iconPresets: Array<{ id: string; label: string; displaySize: AiSize; outputPixels: { width: 1024; height: 1024 } }>
  background: { format: 'png'; transparent: true }
  destination: { directory: string; naming: 'kebab-case' }
}
export interface AiResourceConfigV2 extends AiResourceCommon {
  schemaVersion: 'project-resource-config-v2'
  projectId: string
  iconSize: AiSize
  background: { format: 'png'; transparent: boolean; color: string }
  destination: { directory: string; exportDirectory: string; naming: 'kebab-case' }
}
export type AiResourceConfig = AiResourceConfigV1 | AiResourceConfigV2
/** A server proposal, not a validated persisted v2 config: can have 0 sizes/empty style or inherited v1 sizes. */
export type AiResourceDraft = AiResourceConfigV2
export type AiResourceIssueCode = 'INVALID_JSON' | 'INVALID_FIELD' | 'RESOURCE_PROJECT_MISMATCH' | 'ENGINE_DESIGN_CHANGED' | 'REFERENCE_NOT_FOUND'
export interface AiResourceView {
  schemaVersion: 'companion-icons-v1'
  projectId: string
  state: 'valid' | 'missing' | 'invalid'
  version: number | null
  hash: string | null
  relativePath: string
  migrationRequired: boolean
  config: AiResourceConfig | null
  draft: AiResourceDraft
  issues: Array<{ field: string; code: AiResourceIssueCode }>
  detected: { designResolution: AiSize | null; designSource: string | null; resourceDirectories: string[] }
  capabilities: { outputPixels: { width: 1024; height: 1024 }; format: 'png'; overwrite: false; referencesAsModelInput: false }
}
export interface AiReferencePreview { base64: string; sha256: string; width: number; height: number; mimeType: 'image/png' }
export interface AiResourceReadProvider {
  readonly label: string
  readonly referencePreviewEnabled?: boolean
  /** Optional for standalone reads; mutation pipelines require tracked I/O drainage. */
  waitForIdle?(): Promise<void>
  readConfig(projectId: string, signal?: AbortSignal): Promise<AiResourceView>
  previewReference(projectId: string, relativePath: string, signal?: AbortSignal): Promise<AiReferencePreview>
}
export type AiResourceReadEndpoint = 'resource-config' | 'reference-preview'
export type AiResourceReadCode = 'unauthorized' | 'forbidden' | 'timeout' | 'aborted' | 'invalid-shape' | 'response-too-large' | 'http-error' | 'network-error' | 'invalid-query' | 'busy' | 'verification-unavailable' | 'capability-disabled'
const failureText: Record<AiResourceReadCode, string> = {
  'capability-disabled': '此只读预览未启用参考图处理；未调用后台 Python。',
  unauthorized: '需要已有的 Companion 会话（401）。',
  forbidden: 'Companion 拒绝读取 AI 资源（403），请核对已有会话与同源部署。',
  timeout: 'AI 资源只读查询超时。', aborted: 'AI 资源只读查询已取消。',
  'invalid-shape': 'AI 资源响应不符合已核实的 v148 契约，请刷新后重试。',
  'response-too-large': 'AI 资源响应超出安全读取预算。',
  'http-error': 'AI 资源只读接口返回失败状态。', 'network-error': '未能完成同源 AI 资源连接。',
  'invalid-query': 'AI 资源查询参数无效。', busy: 'AI 资源并行读取已达到上限。',
  'verification-unavailable': '当前环境无法校验参考图像，请使用支持安全摘要校验的浏览器。',
}
/** Closed local diagnostics only; never retain a raw response, URL, cause or server error. */
export class AiResourceReadError extends Error {
  constructor(readonly code: AiResourceReadCode, readonly endpoint?: AiResourceReadEndpoint, readonly status?: number) {
    super(failureText[code]); this.name = code === 'aborted' ? 'AbortError' : 'AiResourceReadError'
  }
}
export const AI_RESOURCE_READ_LIMITS = Object.freeze({
  maxConfigResponseBytes: 128 * 1024, maxPreviewResponseBytes: 6 * 1024 * 1024,
  maxPreviewBytes: 4 * 1024 * 1024, maxPreviewBase64Length: Math.ceil(4 * 1024 * 1024 / 3) * 4,
  maxResponseChunks: 4096, maxPngChunks: 4096, maxConcurrentRequests: 3, defaultConfigTimeoutMs: 4000,
  defaultPreviewTimeoutMs: 20_000, defaultTimeoutMs: 20_000, maxTimeoutMs: 20_000,
})
const configEndpoint = 'resource-config', previewEndpoint = 'reference-preview'
const invalid = (endpoint: AiResourceReadEndpoint = configEndpoint) => new AiResourceReadError('invalid-shape', endpoint)
const shaPattern = /^[a-f0-9]{64}$/
const unsafeText = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u
const reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
export function isAiProjectId(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{16}$/.test(value) }
function relativePath(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 240 && value.length > 0 && !value.includes('\\') && !value.includes(':') && !value.startsWith('/')
    && value.split('/').every((part) => /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(part) && part !== '..')
}
function legacyReference(value: unknown): value is string { return relativePath(value) && /^(?:art\/reference\/|assets\/).+\.(?:png|jpe?g|webp)$/i.test(value) }
/** Request validator. Legacy config metadata is intentionally more permissive than preview requests. */
export function isAiReferencePath(value: unknown): value is string {
  return legacyReference(value) && value.split('/').every((part) => !part.endsWith('.') && !reserved.test(part))
}
function record(value: unknown, endpoint: AiResourceReadEndpoint = configEndpoint): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(endpoint)
  return value as Record<string, unknown>
}
function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER, endpoint: AiResourceReadEndpoint = configEndpoint): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) throw invalid(endpoint)
  return value
}
function size(value: unknown, max = 8192, min = 1): AiSize {
  const raw = record(value)
  return { width: integer(raw.width, min, max), height: integer(raw.height, min, max) }
}
function string(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || unsafeText.test(value)) throw invalid()
  return value
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw invalid()
  return value
}
function orientation(value: AiSize): AiOrientation { return value.width === value.height ? 'square' : value.width < value.height ? 'portrait' : 'landscape' }
function style(value: unknown, legacy: boolean, draft: boolean): AiResourceStyle {
  const raw = record(value), description = string(raw.description, 1500, draft)
  if (description !== description.trim()) throw invalid()
  const references = array(raw.references, 4).map((reference) => {
    if (!(legacy ? legacyReference(reference) : isAiReferencePath(reference))) throw invalid()
    return reference as string
  })
  if (!legacy && new Set(references).size !== references.length) throw invalid()
  return { description, references }
}
function directory(value: unknown): string {
  if (!relativePath(value) || !(value === 'assets' || value.startsWith('assets/'))) throw invalid()
  return value
}
function exportDirectory(value: unknown): string {
  if (!relativePath(value) || !(value === 'art/final' || value.startsWith('art/final/'))
    || !value.split('/').every((part) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(part) && !reserved.test(part))) throw invalid()
  return value
}
function common(raw: Record<string, unknown>, legacy: boolean, draft: boolean): AiResourceCommon {
  const designResolution = size(raw.designResolution, 8192, draft ? 0 : 1), composition = record(raw.composition)
  if (!['portrait', 'landscape', 'square'].includes(raw.orientation as string) || (designResolution.width > 0 && designResolution.height > 0 && raw.orientation !== orientation(designResolution))
    || composition.centered !== true || typeof composition.paddingPercent !== 'number' || !Number.isFinite(composition.paddingPercent) || composition.paddingPercent < 0 || composition.paddingPercent > 40) throw invalid()
  return { version: integer(raw.version, 1), designResolution, orientation: raw.orientation as AiOrientation, style: style(raw.style, legacy, draft), composition: { centered: true, paddingPercent: composition.paddingPercent } }
}
function decodeV2(value: unknown, projectId: string, draft = false, legacy = false): AiResourceConfigV2 {
  const raw = record(value), background = record(raw.background), destination = record(raw.destination)
  const iconSize = size(raw.iconSize, legacy ? 8192 : 4096, draft ? 0 : 1)
  if (raw.schemaVersion !== 'project-resource-config-v2' || raw.projectId !== projectId || !isAiProjectId(raw.projectId)
    || (!legacy && iconSize.width * iconSize.height > 16_000_000) || background.format !== 'png' || typeof background.transparent !== 'boolean'
    || typeof background.color !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(background.color) || destination.naming !== 'kebab-case') throw invalid()
  return {
    schemaVersion: 'project-resource-config-v2', projectId, ...common(raw, legacy, draft), iconSize,
    background: { format: 'png', transparent: background.transparent, color: background.color },
    destination: { directory: directory(destination.directory), exportDirectory: exportDirectory(destination.exportDirectory), naming: 'kebab-case' },
  }
}
/** Validated persisted-v2 projection shared with the strict editable-config boundary. */
export function decodeAiResourceConfigV2(value: unknown, expectedProjectId: string): AiResourceConfigV2 {
  return decodeV2(value, expectedProjectId)
}
export function decodeAiResourceConfig(value: unknown, projectId: string): AiResourceConfig {
  const raw = record(value)
  if (raw.schemaVersion === 'project-resource-config-v2') return decodeV2(raw, projectId)
  const background = record(raw.background), destination = record(raw.destination)
  if (raw.schemaVersion !== 'project-resource-config-v1' || background.format !== 'png' || background.transparent !== true || destination.naming !== 'kebab-case') throw invalid()
  const iconPresets = array(raw.iconPresets, 8).map((value) => {
    const preset = record(value), output = record(preset.outputPixels), label = string(preset.label, 60)
    if (typeof preset.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(preset.id) || label !== label.trim() || output.width !== 1024 || output.height !== 1024) throw invalid()
    return { id: preset.id, label, displaySize: size(preset.displaySize), outputPixels: { width: 1024 as const, height: 1024 as const } }
  })
  if (!iconPresets.length || new Set(iconPresets.map((preset) => preset.id)).size !== iconPresets.length) throw invalid()
  return { schemaVersion: 'project-resource-config-v1', ...common(raw, true, false), iconPresets, background: { format: 'png', transparent: true }, destination: { directory: directory(destination.directory), naming: 'kebab-case' } }
}
const detectedDirectories = ['assets/resources/common/texture', 'assets/bundle/endless/art/characters', 'assets/icons', 'assets/art', 'assets/resources/textures', 'assets']
function detected(value: unknown): AiResourceView['detected'] {
  const raw = record(value), designResolution = raw.designResolution === null ? null : size(raw.designResolution)
  if (raw.designSource !== (designResolution ? 'settings/v2/packages/project.json' : null)) throw invalid()
  const resourceDirectories = array(raw.resourceDirectories, detectedDirectories.length).map((value) => {
    if (typeof value !== 'string' || !detectedDirectories.includes(value)) throw invalid()
    return value
  })
  if (new Set(resourceDirectories).size !== resourceDirectories.length || resourceDirectories.some((value, index) => index > 0 && detectedDirectories.indexOf(value) <= detectedDirectories.indexOf(resourceDirectories[index - 1]!))) throw invalid()
  return { designResolution, designSource: raw.designSource as string | null, resourceDirectories }
}
function defaultDraft(projectId: string, source: AiResourceView['detected']): AiResourceDraft {
  return {
    schemaVersion: 'project-resource-config-v2', projectId, version: 1,
    designResolution: source.designResolution ? { ...source.designResolution } : { width: 0, height: 0 }, orientation: source.designResolution ? orientation(source.designResolution) : 'portrait',
    iconSize: { width: 0, height: 0 }, style: { description: '', references: [] }, background: { format: 'png', transparent: true, color: '#ffffff' },
    composition: { centered: true, paddingPercent: 10 }, destination: { directory: source.resourceDirectories[0] ?? 'assets', exportDirectory: 'art/final/companion', naming: 'kebab-case' },
  }
}
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false
  const first = Object.keys(a), second = Object.keys(b)
  return first.length === second.length && first.every((key) => Object.hasOwn(b, key) && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}
function expectedDraft(config: AiResourceConfig | null, projectId: string, source: AiResourceView['detected']): AiResourceDraft {
  if (!config) return defaultDraft(projectId, source)
  let draft: AiResourceDraft
  if (config.schemaVersion === 'project-resource-config-v2') draft = decodeV2(config, projectId)
  else {
    const first = config.iconPresets[0]!.displaySize
    draft = {
      schemaVersion: 'project-resource-config-v2', projectId, version: config.version, designResolution: { ...config.designResolution }, orientation: config.orientation,
      iconSize: config.iconPresets.every((preset) => equal(preset.displaySize, first)) ? { ...first } : { width: 0, height: 0 },
      style: { description: config.style.description, references: [...config.style.references] }, background: { ...config.background, color: '#ffffff' },
      composition: { ...config.composition }, destination: { ...config.destination, exportDirectory: 'art/final/companion' },
    }
  }
  if (source.designResolution && !equal(source.designResolution, config.designResolution)) {
    draft.designResolution = { ...source.designResolution }; draft.orientation = orientation(source.designResolution)
  }
  return draft
}
function issues(value: unknown): AiResourceView['issues'] {
  return array(value, 20).map((value) => {
    const raw = record(value)
    if (raw.code === 'INVALID_FIELD') {
      const field = string(raw.field, 240, true)
      if (field && !/^(?:[A-Za-z][A-Za-z0-9]*|[0-9]+)(?:\.(?:[A-Za-z][A-Za-z0-9]*|[0-9]+))*$/.test(field)) throw invalid()
      return { field, code: raw.code }
    }
    const fields = { INVALID_JSON: 'config', RESOURCE_PROJECT_MISMATCH: 'projectId', ENGINE_DESIGN_CHANGED: 'designResolution', REFERENCE_NOT_FOUND: 'style.references' } as const
    if (typeof raw.code !== 'string' || !Object.hasOwn(fields, raw.code) || raw.field !== fields[raw.code as keyof typeof fields]) throw invalid()
    return { field: raw.field as string, code: raw.code as AiResourceIssueCode }
  })
}
/** Reproject every field, pin project identity, and verify the exact v148 persisted-config/draft relationship. */
export function decodeAiResourceView(value: unknown, expectedProjectId: string): AiResourceView {
  const raw = record(value), source = detected(raw.detected), faults = issues(raw.issues)
  if (!isAiProjectId(expectedProjectId) || raw.projectId !== expectedProjectId || raw.schemaVersion !== 'companion-icons-v1'
    || !['valid', 'missing', 'invalid'].includes(raw.state as string) || typeof raw.migrationRequired !== 'boolean'
    || typeof raw.relativePath !== 'string' || raw.relativePath.length > 255 || /[\\/:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(raw.relativePath)
    || !(raw.relativePath === 'resource-config.json' || raw.relativePath.endsWith('.ai-icons.json'))) throw invalid()
  const config = raw.config === null ? null : decodeAiResourceConfig(raw.config, expectedProjectId)
  const version = raw.version === null ? null : integer(raw.version, 1)
  const hash = raw.hash === null ? null : typeof raw.hash === 'string' && shaPattern.test(raw.hash) ? raw.hash : (() => { throw invalid() })()
  const legacy = config?.schemaVersion === 'project-resource-config-v1'
  const draft = decodeV2(raw.draft, expectedProjectId, true, legacy)
  if (!equal(draft, expectedDraft(config, expectedProjectId, source)) || raw.migrationRequired !== legacy) throw invalid()
  const capabilities = record(raw.capabilities), output = record(capabilities.outputPixels)
  if (output.width !== 1024 || output.height !== 1024 || capabilities.format !== 'png' || capabilities.overwrite !== false || capabilities.referencesAsModelInput !== false) throw invalid()
  if (raw.state === 'missing') {
    if (config !== null || version !== null || hash !== null || faults.length || raw.relativePath !== `${expectedProjectId}.ai-icons.json`) throw invalid()
  } else {
    if (hash === null || (raw.state === 'valid' ? config === null || faults.length > 0 : faults.length === 0)) throw invalid()
    if (config) {
      const changed = source.designResolution !== null && !equal(source.designResolution, config.designResolution)
      if (version !== config.version || faults.some((issue) => issue.code !== 'ENGINE_DESIGN_CHANGED' && issue.code !== 'REFERENCE_NOT_FOUND')
        || faults.filter((issue) => issue.code === 'ENGINE_DESIGN_CHANGED').length !== (changed ? 1 : 0)
        || faults.filter((issue) => issue.code === 'REFERENCE_NOT_FOUND').length > config.style.references.length) throw invalid()
      if (changed && faults[0]?.code !== 'ENGINE_DESIGN_CHANGED') throw invalid()
    } else {
      if (faults.some((issue) => !['INVALID_JSON', 'INVALID_FIELD', 'RESOURCE_PROJECT_MISMATCH'].includes(issue.code))) throw invalid()
      if (faults[0]?.code === 'INVALID_JSON' && (faults.length !== 1 || version !== null)) throw invalid()
      if (faults[0]?.code === 'RESOURCE_PROJECT_MISMATCH' && (faults.length !== 1 || version === null)) throw invalid()
      if (faults.some((issue) => issue.code !== faults[0]!.code)) throw invalid()
    }
  }
  return {
    schemaVersion: 'companion-icons-v1', projectId: expectedProjectId, state: raw.state as AiResourceView['state'], version, hash, relativePath: raw.relativePath,
    migrationRequired: legacy, config, draft, issues: faults, detected: source,
    capabilities: { outputPixels: { width: 1024, height: 1024 }, format: 'png', overwrite: false, referencesAsModelInput: false },
  }
}
const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  return crc >>> 0
})
function crc32(bytes: Uint8Array, start: number, end: number): number {
  let crc = 0xffffffff
  for (let offset = start; offset < end; offset++) crc = crcTable[(crc ^ bytes[offset]!) & 255]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function previewBytes(base64: unknown): Uint8Array {
  if (typeof base64 !== 'string' || base64.length < 44 || base64.length > AI_RESOURCE_READ_LIMITS.maxPreviewBase64Length
    || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw invalid(previewEndpoint)
  const length = base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
  if (length > AI_RESOURCE_READ_LIMITS.maxPreviewBytes) throw new AiResourceReadError('response-too-large', previewEndpoint)
  let binary: string
  try { binary = atob(base64); if (btoa(binary) !== base64) throw invalid(previewEndpoint) } catch { throw invalid(previewEndpoint) }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}
/** Validates canonical base64, normalized metadata-free RGBA PNG structure/CRCs and IHDR dimensions. */
export function decodeAiReferencePreview(value: unknown): AiReferencePreview {
  const raw = record(value, previewEndpoint)
  // A previously projected preview can be rechecked, but an incompatible wire envelope cannot.
  if ((raw.schemaVersion !== undefined && raw.schemaVersion !== 'companion-icons-v1') || raw.mimeType !== 'image/png' || typeof raw.sha256 !== 'string' || !shaPattern.test(raw.sha256)) throw invalid(previewEndpoint)
  const width = integer(raw.width, 1, 4096, previewEndpoint), height = integer(raw.height, 1, 4096, previewEndpoint)
  if (width * height > 16_000_000) throw invalid(previewEndpoint)
  const bytes = previewBytes(raw.base64), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length < 57 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) throw invalid(previewEndpoint)
  let offset = 8, chunks = 0, imageData = 0, ended = false
  while (offset < bytes.length) {
    if (++chunks > AI_RESOURCE_READ_LIMITS.maxPngChunks || offset + 12 > bytes.length) throw invalid(previewEndpoint)
    const length = view.getUint32(offset), end = offset + 12 + length
    if (end > bytes.length || crc32(bytes, offset + 4, end - 4) !== view.getUint32(end - 4)) throw invalid(previewEndpoint)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (chunks === 1) {
      if (type !== 'IHDR' || length !== 13 || view.getUint32(offset + 8) !== width || view.getUint32(offset + 12) !== height
        || bytes[offset + 16] !== 8 || bytes[offset + 17] !== 6 || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] !== 0) throw invalid(previewEndpoint)
    } else if (type === 'IDAT') { if (!length) throw invalid(previewEndpoint); imageData += length }
    else if (type === 'IEND') { if (length !== 0 || imageData === 0 || end !== bytes.length) throw invalid(previewEndpoint); ended = true }
    else throw invalid(previewEndpoint)
    offset = end
  }
  if (!ended) throw invalid(previewEndpoint)
  return { base64: raw.base64 as string, sha256: raw.sha256, width, height, mimeType: 'image/png' }
}
/** No network or image execution: cryptographic digest verification of already-bounded normalized PNG bytes. */
export async function verifyAiReferencePreview(value: unknown): Promise<AiReferencePreview> {
  const preview = decodeAiReferencePreview(value)
  if (!globalThis.crypto?.subtle) throw new AiResourceReadError('verification-unavailable', previewEndpoint)
  let digest: ArrayBuffer
  try { digest = await globalThis.crypto.subtle.digest('SHA-256', previewBytes(preview.base64)) }
  catch { throw new AiResourceReadError('verification-unavailable', previewEndpoint) }
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  if (sha256 !== preview.sha256) throw invalid(previewEndpoint)
  return preview
}
