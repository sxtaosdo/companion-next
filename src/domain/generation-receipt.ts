import type { PlannedBatch, ResourcePlan, ResourceRequirement } from './resource-planning'
import { parseResourcePlan } from './resource-plan-import'
import type { GenerationSource } from './generation-source'

export const MAX_GENERATION_FILE_BYTES = 16 * 1024 * 1024
export const MAX_GENERATION_DIMENSION = 8192
export const MAX_GENERATION_RECEIPTS = 32
export const GENERATION_RECEIPT_JSON_LIMIT_BYTES = 524_288

type Frozen<T> = T extends object ? { readonly [K in keyof T]: Frozen<T[K]> } : T
export type GenerationReceiptContext = Frozen<{
  schemaVersion: 1
  kind: 'companion-generation-receipt-context'
  planId: string
  planCreatedAt: string
  scope: ResourcePlan['scope']
  binding: ResourcePlan['binding']
  requirement: ResourceRequirement
  batch: PlannedBatch
  generationSource: Exclude<GenerationSource, 'unselected'>
}>
export type GenerationReceipt = Frozen<{
  schemaVersion: 1
  kind: 'companion-generation-receipt'
  id: string
  measuredAt: string
  context: GenerationReceiptContext
  artifact: 'master'
  status: 'needs-review'
  sourceDeclaration: 'user-declared'
  sourceVerification: 'not-verified'
  file: {
    name: string
    byteLength: number
    sha256: string
    format: 'png'
    width: number
    height: number
    pngColorType: 0 | 2 | 3 | 4 | 6
    bitDepth: number
    interlace: 0 | 1
    /** Only IHDR color types 4/6 declare an alpha channel; this never examines pixels. */
    alphaDeclared: boolean
    hasTransparencyChunk: boolean
  }
  checks: {
    pngStructure: 'checked'
    dimensions: 'matched' | 'mismatch'
    fullDecode: 'not-checked'
    pixelTransparency: 'not-checked'
    visualReview: 'not-checked'
    ownerApproval: 'not-checked'
  }
  savedToProject: false
  imported: false
  bound: false
  runtime: 'not-checked'
}>
export interface GenerationFileInput { name: string; bytes: Uint8Array }
export interface GenerationInspectionOptions { subtle?: Pick<SubtleCrypto, 'digest'> }

// This slice has no receipt import. A JSON claim, including a copied export, cannot
// become byte-measurement evidence. Frozen objects remain safe in shallow stores.
const contexts = new WeakSet<object>()
const receipts = new WeakSet<object>()
function freeze<T>(value: T): Frozen<T> {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value as Frozen<T>
}
function contextData(plan: ResourcePlan, requirementId: string): GenerationReceiptContext {
  // The existing strict import boundary rejects unknown fields and fabricated
  // execution/approval states even when an external object was cast to ResourcePlan.
  const p = parseResourcePlan(JSON.stringify(plan))
  if (p.generationSource === 'unselected') throw new Error('回收前须明确选择生成来源')
  const requirement = p.requirements.find((item) => item.id === requirementId)
  if (!requirement) throw new Error('回收需求不存在')
  if (requirement.ownerProtected) throw new Error('Owner 保护项不能回收生成文件')
  const batch = p.batches.find((item) => item.requirementIds.includes(requirementId))
  if (!batch) throw new Error('只可回收已编入批次的母图需求')
  return {
    schemaVersion: 1, kind: 'companion-generation-receipt-context',
    planId: p.id, planCreatedAt: p.createdAt, scope: p.scope, binding: p.binding,
    requirement, batch, generationSource: p.generationSource,
  }
}
/** A detached, serializable snapshot. Creating it never submits or generates anything. */
export function createReceiptContext(plan: ResourcePlan, requirementId: string): GenerationReceiptContext {
  const context = freeze(contextData(plan, requirementId))
  contexts.add(context)
  return context
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`
  return JSON.stringify(value)
}
/** Compare every relevant semantic field, not just IDs or JSON property ordering. */
export function contextMatchesPlan(context: GenerationReceiptContext, plan: ResourcePlan | undefined): boolean {
  if (!context || !contexts.has(context) || !plan) return false
  try { return canonical(context) === canonical(contextData(plan, context.requirement.id)) }
  catch { return false }
}

const signature = [137, 80, 78, 71, 13, 10, 26, 10]
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c >>> 0
}
function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff
  for (let index = start; index < end; index++) c = crcTable[(c ^ bytes[index]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
type PngMetadata = Pick<GenerationReceipt['file'], 'width' | 'height' | 'pngColorType' | 'bitDepth' | 'interlace' | 'alphaDeclared' | 'hasTransparencyChunk'>
/** Bounded PNG framing, CRC and core chunk-order checks, NOT an image decoder. */
function inspectPng(bytes: Uint8Array): PngMetadata {
  if (bytes.length < 57 || signature.some((value, index) => bytes[index] !== value)) throw new Error('文件不是完整 PNG，不能作为回收证据')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let metadata: PngMetadata | undefined
  let offset = 8
  let chunks = 0
  let paletteEntries = 0
  let transparency = false
  let idatStarted = false
  let idatEnded = false
  let idatBytes = 0
  const zlibHeader: number[] = []
  let ended = false
  while (offset < bytes.length) {
    if (++chunks > 8192) throw new Error('PNG 块数量超过安全上限')
    if (bytes.length - offset < 12) throw new Error('PNG 块被截断')
    const length = view.getUint32(offset)
    const end = offset + 12 + length
    if (length > 0x7fffffff || end > bytes.length) throw new Error('PNG 块长度无效或被截断')
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) throw new Error('PNG 块类型无效')
    if (crc32(bytes, offset + 4, end - 4) !== view.getUint32(end - 4)) throw new Error('PNG CRC 校验失败')
    if (!metadata && type !== 'IHDR') throw new Error('PNG 首块必须是 IHDR')
    if (idatStarted && type !== 'IDAT') idatEnded = true
    const data = offset + 8
    if (type === 'IHDR') {
      if (metadata || length !== 13) throw new Error('PNG IHDR 重复或长度无效')
      const width = view.getUint32(data)
      const height = view.getUint32(data + 4)
      if (width < 1 || height < 1 || width > MAX_GENERATION_DIMENSION || height > MAX_GENERATION_DIMENSION || width * height > MAX_GENERATION_DIMENSION ** 2) throw new Error('PNG 实际尺寸须为 1–8192，且不超过 8192² 像素')
      const bitDepth = bytes[data + 8]
      const pngColorType = bytes[data + 9]
      const allowedDepths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }
      if (!allowedDepths[pngColorType]?.includes(bitDepth)) throw new Error('PNG 颜色类型或位深无效')
      if (bytes[data + 10] !== 0 || bytes[data + 11] !== 0 || ![0, 1].includes(bytes[data + 12])) throw new Error('PNG 压缩、滤波或交错标记无效')
      metadata = { width, height, pngColorType: pngColorType as PngMetadata['pngColorType'], bitDepth, interlace: bytes[data + 12] as 0 | 1, alphaDeclared: pngColorType === 4 || pngColorType === 6, hasTransparencyChunk: false }
    } else if (type === 'PLTE') {
      if (idatStarted || paletteEntries || transparency || length === 0 || length > 768 || length % 3 !== 0 || [0, 4].includes(metadata!.pngColorType)) throw new Error('PNG 调色板结构或顺序无效')
      paletteEntries = length / 3
      if (metadata!.pngColorType === 3 && paletteEntries > 2 ** metadata!.bitDepth) throw new Error('PNG 调色板超过位深容量')
    } else if (type === 'tRNS') {
      const colorType = metadata!.pngColorType
      if (transparency || idatStarted || [4, 6].includes(colorType) || (colorType === 0 && length !== 2) || (colorType === 2 && length !== 6) || (colorType === 3 && (!paletteEntries || !length || length > paletteEntries))) throw new Error('PNG 透明声明结构或顺序无效')
      if (colorType === 0 || colorType === 2) {
        for (let sample = 0; sample < length; sample += 2) if (view.getUint16(data + sample) >= 2 ** metadata!.bitDepth) throw new Error('PNG 透明声明样本超出位深')
      }
      transparency = true
    } else if (type === 'IDAT') {
      if (idatEnded || (metadata!.pngColorType === 3 && !paletteEntries)) throw new Error('PNG IDAT 必须连续且在所需调色板之后')
      idatStarted = true
      idatBytes += length
      for (let index = 0; index < length && zlibHeader.length < 2; index++) zlibHeader.push(bytes[data + index])
    } else if (type === 'IEND') {
      if (length !== 0 || !idatStarted || idatBytes < 6 || end !== bytes.length) throw new Error('PNG 缺少非空图像数据、IEND 无效或存在尾随数据')
      ended = true
    } else if (['acTL', 'fcTL', 'fdAT'].includes(type)) {
      throw new Error('本片只回收静态 PNG 母图，不支持 APNG')
    } else if (type[0] === type[0].toUpperCase()) {
      throw new Error('PNG 包含不支持的关键块')
    }
    offset = end
  }
  if (!metadata || !ended) throw new Error('PNG 缺少完整 IHDR / IDAT / IEND')
  const [cmf, flg] = zlibHeader
  if ((cmf & 15) !== 8 || (cmf >>> 4) > 7 || ((cmf << 8) + flg) % 31 !== 0 || (flg & 32) !== 0) throw new Error('PNG 图像数据 zlib 头无效')
  return { ...metadata, hasTransparencyChunk: transparency }
}
function fileName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 180 || /[\\/:\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value) || value === '.' || value === '..') throw new Error('文件名须为无路径文本，最多 180 字符')
  return value
}
function isUint8Array(value: unknown): value is Uint8Array {
  // Native internal-slot checks support iframe/worker realms without trusting
  // user-overridable toString(), constructors, or byteLength properties.
  const tag = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), Symbol.toStringTag)?.get
  return ArrayBuffer.isView(value) && tag?.call(value) === 'Uint8Array'
}
function isSha256Buffer(value: unknown): value is ArrayBuffer {
  try { return Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!.call(value) === 32 }
  catch { return false }
}
/** Measures only caller-selected bytes. No filesystem, URL, provider, decode, or save. */
export async function inspectGenerationFile(context: GenerationReceiptContext, file: GenerationFileInput, options: GenerationInspectionOptions = {}): Promise<GenerationReceipt> {
  if (!context || !contexts.has(context)) throw new Error('请从当前计划创建回收上下文；外部 JSON 不是实测证据')
  if (!file || !isUint8Array(file.bytes)) throw new Error('回收需要实际文件 Uint8Array；外部 JSON 或交接草稿不是图片')
  const name = fileName(file.name)
  if (!file.bytes.byteLength || file.bytes.byteLength > MAX_GENERATION_FILE_BYTES) throw new Error('PNG 文件须非空且不超过 16 MiB')
  // Detach before awaiting so later caller edits cannot change what was hashed.
  const bytes = new Uint8Array(file.bytes)
  const metadata = inspectPng(bytes)
  const subtle = options.subtle ?? globalThis.crypto?.subtle
  if (!subtle) throw new Error('当前环境没有 SHA-256 能力，未创建回执')
  const digest = await subtle.digest('SHA-256', bytes)
  if (!isSha256Buffer(digest)) throw new Error('SHA-256 测量失败，未创建回执')
  const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
  const receipt: GenerationReceipt = freeze({
    schemaVersion: 1, kind: 'companion-generation-receipt', id: crypto.randomUUID(), measuredAt: new Date().toISOString(),
    context, artifact: 'master', status: 'needs-review', sourceDeclaration: 'user-declared', sourceVerification: 'not-verified',
    file: { name, byteLength: bytes.byteLength, sha256, format: 'png', ...metadata },
    checks: { pngStructure: 'checked', dimensions: metadata.width === context.requirement.defaultSize.width && metadata.height === context.requirement.defaultSize.height ? 'matched' : 'mismatch', fullDecode: 'not-checked', pixelTransparency: 'not-checked', visualReview: 'not-checked', ownerApproval: 'not-checked' },
    savedToProject: false, imported: false, bound: false, runtime: 'not-checked',
  })
  receipts.add(receipt)
  return receipt
}
/** Read-only audit output. This JSON is not a receipt-import or project-save contract. */
export function exportGenerationReceipts(items: readonly GenerationReceipt[]): string {
  if (!Array.isArray(items) || !items.length || items.length > MAX_GENERATION_RECEIPTS) throw new Error('请导出 1–32 份实测回执，空输出不能冒充成功')
  const seen = new Set<string>()
  for (const receipt of items) {
    if (!receipt || !receipts.has(receipt)) throw new Error('只能导出本次文件实测产生的原始回执；外部 JSON 不是实测证据')
    const identity = `${canonical(receipt.context)}:${receipt.file.sha256}`
    if (seen.has(identity)) throw new Error('同一上下文与 SHA-256 的回执不能重复导出')
    seen.add(identity)
  }
  const contents = JSON.stringify({
    schemaVersion: 1, kind: 'companion-generation-receipts',
    disclaimer: '仅人工选取文件的字节实测与有限 PNG 结构检查记录。来源仅用户声明；未验证外部生成协议、完整解码、像素透明质量或视觉批准，未保存到项目、导入、绑定或运行。此 JSON 不能导入为已验证证据。',
    receipts: items,
  }, null, 2)
  if (new TextEncoder().encode(contents).byteLength > GENERATION_RECEIPT_JSON_LIMIT_BYTES) throw new Error('回执超过 512 KiB 导出预算，请拆分；现有回执保持不变')
  return contents
}
