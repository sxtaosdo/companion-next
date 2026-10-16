import { isAiProjectId } from './ai-resource-read'

export type AiReferenceMimeType = 'image/png' | 'image/jpeg' | 'image/webp'
export interface AiReferenceUploadInput { base64: string; approved: true }
export interface AiReferenceUploadReceipt {
  schemaVersion: 'companion-icons-v1'; relativePath: string; sha256: string; width: number; height: number; mimeType: 'image/png'
  originalRelativePath: string; originalSha256: string
}
export interface AiReferenceUploadProvider {
  readonly label: string
  /** Passive completion barrier for cross-operation leases; never starts or retries work. */
  waitForIdle(): Promise<void>
  uploadReference(projectId: string, input: AiReferenceUploadInput, signal?: AbortSignal): Promise<AiReferenceUploadReceipt>
}
export type AiReferenceUploadOutcome = 'not-sent' | 'rejected' | 'unknown'
export type AiReferenceUploadCode = 'invalid-input' | 'invalid-file' | 'unsupported-type' | 'animated-image' | 'invalid-dimensions' | 'decode-failed' | 'hash-unavailable'
  | 'busy' | 'aborted' | 'timeout' | 'unauthorized' | 'forbidden' | 'rejected' | 'unconfirmed' | 'invalid-shape' | 'response-too-large' | 'network-error'
const failureText: Record<AiReferenceUploadCode, string> = {
  'invalid-input': '参考图上传参数无效，未发送请求。', 'invalid-file': '参考图文件结构无效或超过 4 MiB，未发送请求。',
  'unsupported-type': '参考图只支持静态 PNG、JPEG 或 WebP，未发送请求。', 'animated-image': '参考图不支持 APNG、GIF 或动态 WebP，未发送请求。',
  'invalid-dimensions': '参考图每边须为 1–4096 像素，且最多 1600 万像素，未发送请求。', 'decode-failed': '参考图像素解码未通过，未发送请求。',
  'hash-unavailable': '无法核验参考图 SHA-256，未发送请求。', busy: '已有参考图上传尚未结束，未发送新请求。',
  aborted: '已停止等待参考图上传；文件可能已写入，请先核对。', timeout: '参考图上传等待超时；文件可能已写入，请先核对。',
  unauthorized: 'Companion 会话无效（401），参考图上传被拒绝。', forbidden: 'Companion 拒绝参考图上传（403），请核对已有会话与同源部署。',
  rejected: 'Companion 已明确拒绝本次参考图上传。', unconfirmed: '参考图上传结果未确认；原图或规范化图可能已写入，请勿直接重发。',
  'invalid-shape': '参考图上传回执不符合已核实契约；文件可能已写入，请勿直接重发。',
  'response-too-large': '参考图上传响应超过安全读取预算，写入结果未知。', 'network-error': '参考图上传连接未正常完成，写入结果未知。',
}
/** Closed local metadata only: never retain server bodies, raw errors, causes, filenames or URLs. */
export class AiReferenceUploadError extends Error {
  constructor(readonly code: AiReferenceUploadCode, readonly outcome: AiReferenceUploadOutcome, readonly status?: number) {
    super(outcome === 'not-sent' && (code === 'aborted' || code === 'timeout') ? '参考图上传已取消或超时，未发送请求。' : failureText[code])
    this.name = 'AiReferenceUploadError'
  }
}
export const AI_REFERENCE_UPLOAD_LIMITS = Object.freeze({
  maxFileBytes: 4 * 1024 * 1024, maxDimension: 4096, maxPixels: 16_000_000, maxContainerChunks: 8192,
  maxBase64Length: Math.ceil(4 * 1024 * 1024 / 3) * 4, maxRequestBytes: 6 * 1024 * 1024,
  maxResponseBytes: 8192, maxResponseChunks: 4096, maxConcurrentRequests: 1, defaultTimeoutMs: 20_000, maxTimeoutMs: 20_000,
})
export type LocalReferenceFile = Pick<Blob, 'size' | 'type' | 'arrayBuffer'> & { readonly name?: string }
export type AiReferenceDecode = (file: Blob) => Promise<{ width: number; height: number }>
export interface PreparedLocalReference {
  readonly base64: string; readonly sha256: string; readonly width: number; readonly height: number
  readonly mimeType: AiReferenceMimeType; readonly byteLength: number; readonly pixelDecoded: boolean
}
export interface ReferenceByteMetadata { width: number; height: number; mimeType: AiReferenceMimeType; extension: 'png' | 'jpg' | 'webp' }
const prepared = new WeakSet<object>()
export function isPreparedLocalReference(value: unknown): value is PreparedLocalReference { return !!value && typeof value === 'object' && prepared.has(value) }
const invalid = (code: AiReferenceUploadCode = 'invalid-file') => new AiReferenceUploadError(code, 'not-sent')
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid('invalid-input')
  const raw = value as Record<string, unknown>, own = Reflect.ownKeys(raw)
  if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key)) || keys.some(key => !Object.hasOwn(raw, key))) throw invalid('invalid-input')
  return raw
}
function dimensions(width: unknown, height: unknown): { width: number; height: number } {
  if (typeof width !== 'number' || typeof height !== 'number' || !Number.isInteger(width) || !Number.isInteger(height)
    || width < 1 || height < 1 || width > AI_REFERENCE_UPLOAD_LIMITS.maxDimension || height > AI_REFERENCE_UPLOAD_LIMITS.maxDimension
    || width * height > AI_REFERENCE_UPLOAD_LIMITS.maxPixels) throw invalid('invalid-dimensions')
  return { width, height }
}
const textAt = (bytes: Uint8Array, start: number, size: number) => String.fromCharCode(...bytes.subarray(start, start + size))
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) { let c = n; for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0 }
function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff
  for (let index = start; index < end; index++) c = crcTable[(c ^ bytes[index]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
/** Reads only bounded TIFF IFD0 orientation. Other EXIF metadata is neither copied nor trusted. */
function exifOrientation(bytes: Uint8Array): number {
  if (textAt(bytes, 0, 6) === 'Exif\0\0') bytes = bytes.subarray(6)
  if (bytes.length < 8) throw invalid()
  const order = textAt(bytes, 0, 2), little = order === 'II', view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (!['II', 'MM'].includes(order) || view.getUint16(2, little) !== 42) throw invalid()
  const start = view.getUint32(4, little)
  if (start < 8 || start + 2 > bytes.length) throw invalid()
  const count = view.getUint16(start, little)
  if (count > 4096 || start + 2 + count * 12 + 4 > bytes.length) throw invalid()
  let orientation = 1, found = false
  for (let n = 0; n < count; n++) {
    const at = start + 2 + n * 12
    if (view.getUint16(at, little) !== 0x112) continue
    if (found || view.getUint16(at + 2, little) !== 3 || view.getUint32(at + 4, little) !== 1) throw invalid()
    orientation = view.getUint16(at + 8, little); found = true
    if (orientation < 1 || orientation > 8) throw invalid()
  }
  return orientation
}
function orient(size: { width: number; height: number }, orientation: number) { return orientation >= 5 ? { width: size.height, height: size.width } : size }
/** Framing/CRC/chunk ordering only. This never inflates IDAT or claims pixel validity. */
function png(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let size: { width: number; height: number } | undefined, offset = 8, chunks = 0, color = -1, depth = 0, palette = 0
  let transparency = false, idat = false, idatEnded = false, idatBytes = 0, ended = false, orientation = 1, exif = false
  const zlib: number[] = []
  while (offset < bytes.length) {
    if (++chunks > AI_REFERENCE_UPLOAD_LIMITS.maxContainerChunks || bytes.length - offset < 12) throw invalid()
    const length = view.getUint32(offset), end = offset + 12 + length, type = textAt(bytes, offset + 4, 4), at = offset + 8
    if (length > 0x7fffffff || end > bytes.length || !/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type) || crc32(bytes, offset + 4, end - 4) !== view.getUint32(end - 4)) throw invalid()
    if (!size && type !== 'IHDR') throw invalid()
    if (idat && type !== 'IDAT') idatEnded = true
    if (type === 'IHDR') {
      if (size || length !== 13) throw invalid()
      size = dimensions(view.getUint32(at), view.getUint32(at + 4)); depth = bytes[at + 8]; color = bytes[at + 9]
      const depths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }
      if (!depths[color]?.includes(depth) || bytes[at + 10] !== 0 || bytes[at + 11] !== 0 || ![0, 1].includes(bytes[at + 12])) throw invalid()
    } else if (type === 'PLTE') {
      if (idat || palette || transparency || !length || length > 768 || length % 3 || [0, 4].includes(color)) throw invalid()
      palette = length / 3; if (color === 3 && palette > 2 ** depth) throw invalid()
    } else if (type === 'tRNS') {
      if (transparency || idat || [4, 6].includes(color) || color === 0 && length !== 2 || color === 2 && length !== 6 || color === 3 && (!palette || !length || length > palette)) throw invalid()
      if (color === 0 || color === 2) for (let n = 0; n < length; n += 2) if (view.getUint16(at + n) >= 2 ** depth) throw invalid()
      transparency = true
    } else if (type === 'IDAT') {
      if (idatEnded || color === 3 && !palette) throw invalid()
      idat = true; idatBytes += length
      for (let n = 0; n < length && zlib.length < 2; n++) zlib.push(bytes[at + n])
    } else if (type === 'IEND') {
      if (length || !idat || idatBytes < 6 || end !== bytes.length) throw invalid()
      ended = true
    } else if (['acTL', 'fcTL', 'fdAT'].includes(type)) throw invalid('animated-image')
    else if (type === 'eXIf') { if (exif) throw invalid(); orientation = exifOrientation(bytes.subarray(at, end - 4)); exif = true }
    else if (type[0] === type[0].toUpperCase()) throw invalid()
    offset = end
  }
  const [cmf, flg] = zlib
  if (!size || !ended || (cmf & 15) !== 8 || (cmf >>> 4) > 7 || ((cmf << 8) + flg) % 31 !== 0 || (flg & 32)) throw invalid()
  return orient(size, orientation)
}
/** Bounded JPEG marker/scan framing and SOF dimensions, not a JPEG pixel decoder. */
function jpeg(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 2, markers = 0, size: { width: number; height: number } | undefined, scanned = false, ended = false, orientation = 1, exif = false
  while (offset < bytes.length) {
    if (++markers > AI_REFERENCE_UPLOAD_LIMITS.maxContainerChunks || bytes[offset++] !== 0xff) throw invalid()
    while (bytes[offset] === 0xff) offset++
    const marker = bytes[offset++]
    if (marker === 0xd9) { if (!scanned || offset !== bytes.length) throw invalid(); ended = true; break }
    if (marker === 0 || marker === 0xd8 || marker === 1 || marker >= 0xd0 && marker <= 0xd7 || offset + 2 > bytes.length) throw invalid()
    const length = view.getUint16(offset), at = offset + 2, end = offset + length
    if (length < 2 || end > bytes.length) throw invalid()
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (size || length < 11 || bytes[at] !== 8 || ![1, 3, 4].includes(bytes[at + 5]) || length !== 8 + 3 * bytes[at + 5]) throw invalid()
      size = dimensions(view.getUint16(at + 3), view.getUint16(at + 1))
    } else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) throw invalid('unsupported-type')
    else if (marker === 0xe1 && textAt(bytes, at, 6) === 'Exif\0\0') {
      if (exif) throw invalid(); orientation = exifOrientation(bytes.subarray(at, end)); exif = true
    }
    offset = end
    if (marker === 0xda) {
      if (!size || length < 8 || length !== 6 + 2 * bytes[at]) throw invalid()
      scanned = true
      // Escaped FF and restart markers belong to entropy data. Every byte is visited at most once.
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) { offset++; continue }
        const next = bytes[offset + 1]
        if (next === 0 || next >= 0xd0 && next <= 0xd7) { offset += 2; continue }
        if (next === 0xff) { offset++; continue }
        break
      }
    }
  }
  if (!size || !ended) throw invalid()
  return orient(size, orientation)
}
/** RIFF bounds, image header dimensions and animation flags; never a WebP pixel decoder. */
function webp(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 20) throw invalid()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(4, true) + 8 !== bytes.length) throw invalid()
  let offset = 12, chunks = 0, size: { width: number; height: number } | undefined, canvas: typeof size, orientation = 1, exif = false
  const uint24 = (at: number) => bytes[at] | bytes[at + 1] << 8 | bytes[at + 2] << 16
  while (offset < bytes.length) {
    if (++chunks > AI_REFERENCE_UPLOAD_LIMITS.maxContainerChunks || offset + 8 > bytes.length) throw invalid()
    const type = textAt(bytes, offset, 4), length = view.getUint32(offset + 4, true), at = offset + 8, end = at + length, padded = end + (length % 2)
    if (padded > bytes.length || length % 2 && bytes[end] !== 0) throw invalid()
    if (type === 'ANIM' || type === 'ANMF') throw invalid('animated-image')
    if (type === 'VP8X') {
      if (offset !== 12 || canvas || length !== 10 || (bytes[at] & 0xc1) || bytes[at + 1] || bytes[at + 2] || bytes[at + 3]) throw invalid()
      if (bytes[at] & 2) throw invalid('animated-image')
      canvas = dimensions(1 + uint24(at + 4), 1 + uint24(at + 7))
    } else if (type === 'VP8 ') {
      if (size || length < 10 || bytes[at] & 1 || textAt(bytes, at + 3, 3) !== '\x9d\x01\x2a') throw invalid()
      size = dimensions(view.getUint16(at + 6, true) & 0x3fff, view.getUint16(at + 8, true) & 0x3fff)
    } else if (type === 'VP8L') {
      if (size || length < 5 || bytes[at] !== 0x2f) throw invalid()
      const bits = view.getUint32(at + 1, true)
      if (bits >>> 29) throw invalid()
      size = dimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
    } else if (type === 'EXIF') { if (exif) throw invalid(); orientation = exifOrientation(bytes.subarray(at, end)); exif = true }
    offset = padded
  }
  if (!size || canvas && (canvas.width !== size.width || canvas.height !== size.height)) throw invalid()
  return orient(size, orientation)
}
/** Bounded byte/container preflight only; the browser decode and original service must still verify pixels. */
export function inspectReferenceBytes(bytes: Uint8Array): ReferenceByteMetadata {
  try {
    if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > AI_REFERENCE_UPLOAD_LIMITS.maxFileBytes) throw invalid()
    if (pngSignature.every((value, index) => bytes[index] === value)) return { ...png(bytes), mimeType: 'image/png', extension: 'png' }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ...jpeg(bytes), mimeType: 'image/jpeg', extension: 'jpg' }
    if (textAt(bytes, 0, 4) === 'RIFF' && textAt(bytes, 8, 4) === 'WEBP') return { ...webp(bytes), mimeType: 'image/webp', extension: 'webp' }
    if (['GIF87a', 'GIF89a'].includes(textAt(bytes, 0, 6))) throw invalid('animated-image')
    throw invalid('unsupported-type')
  } catch (error) { if (error instanceof AiReferenceUploadError) throw error; throw invalid() }
}
export async function sha256ReferenceBytes(bytes: Uint8Array): Promise<string> {
  try {
    if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > AI_REFERENCE_UPLOAD_LIMITS.maxFileBytes || !globalThis.crypto?.subtle) throw invalid('hash-unavailable')
    const digest = await globalThis.crypto.subtle.digest('SHA-256', Uint8Array.from(bytes).buffer)
    if (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!.call(digest) !== 32) throw invalid('hash-unavailable')
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
  } catch { throw invalid('hash-unavailable') }
}
function base64FromBytes(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(binary)
}
export function validateAiReferenceUploadInput(value: unknown, projectId: string): { input: AiReferenceUploadInput; bytes: Uint8Array; metadata: ReferenceByteMetadata } {
  try {
    if (!isAiProjectId(projectId)) throw invalid('invalid-input')
    const raw = exact(value, ['base64', 'approved']), base64 = raw.base64
    if (raw.approved !== true || typeof base64 !== 'string' || base64.length < 4 || base64.length > AI_REFERENCE_UPLOAD_LIMITS.maxBase64Length
      || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw invalid('invalid-input')
    const binary = atob(base64), bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    if (base64FromBytes(bytes) !== base64) throw invalid('invalid-input')
    return { input: { base64, approved: true }, bytes, metadata: inspectReferenceBytes(bytes) }
  } catch (error) { if (error instanceof AiReferenceUploadError) throw error; throw invalid('invalid-input') }
}
/** Original bytes are retained only in this in-memory prepared value; no storage, URL, upload or approval side effects. */
export async function prepareLocalReference(file: LocalReferenceFile, options: { decode?: AiReferenceDecode } = {}): Promise<PreparedLocalReference> {
  try {
    if (!file || !Number.isInteger(file.size) || file.size < 1 || file.size > AI_REFERENCE_UPLOAD_LIMITS.maxFileBytes || typeof file.arrayBuffer !== 'function') throw invalid()
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw invalid('unsupported-type')
    const size = file.size, mimeType = file.type, buffer = await file.arrayBuffer()
    if (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')!.get!.call(buffer) !== size) throw invalid()
    const bytes = Uint8Array.from(new Uint8Array(buffer)), metadata = inspectReferenceBytes(bytes)
    if (metadata.mimeType !== mimeType) throw invalid('unsupported-type')
    let pixelDecoded = false
    if (options.decode) {
      try {
        const decoded = await options.decode(new Blob([bytes], { type: mimeType }))
        const measured = dimensions(decoded.width, decoded.height)
        if (measured.width !== metadata.width || measured.height !== metadata.height) throw invalid('decode-failed')
        pixelDecoded = true
      } catch { throw invalid('decode-failed') }
    }
    const sha256 = await sha256ReferenceBytes(bytes)
    const result = Object.freeze({ base64: base64FromBytes(bytes), sha256, width: metadata.width, height: metadata.height, mimeType: metadata.mimeType, byteLength: bytes.byteLength, pixelDecoded })
    prepared.add(result); return result
  } catch (error) { if (error instanceof AiReferenceUploadError) throw error; throw invalid() }
}
/** Exact eight-field v148 receipt, cryptographically bound to the submitted original, including EXIF-oriented dimensions. */
export function decodeAiReferenceUploadReceipt(value: unknown, original: Pick<PreparedLocalReference, 'sha256' | 'mimeType' | 'width' | 'height'>): AiReferenceUploadReceipt {
  try {
    const raw = exact(value, ['schemaVersion', 'relativePath', 'sha256', 'width', 'height', 'mimeType', 'originalRelativePath', 'originalSha256'])
    const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }, extension = extensions[original.mimeType]
    const size = dimensions(raw.width, raw.height)
    if (raw.schemaVersion !== 'companion-icons-v1' || raw.mimeType !== 'image/png' || typeof raw.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(raw.sha256)
      || !/^[a-f0-9]{64}$/.test(original.sha256) || !extension || raw.originalSha256 !== original.sha256
      || raw.relativePath !== `art/reference/companion/${raw.sha256}.png` || raw.originalRelativePath !== `art/reference/companion/original/${original.sha256}.${extension}`
      || size.width !== original.width || size.height !== original.height) throw invalid()
    return Object.freeze({ schemaVersion: 'companion-icons-v1', relativePath: raw.relativePath as string, sha256: raw.sha256, ...size, mimeType: 'image/png', originalRelativePath: raw.originalRelativePath as string, originalSha256: original.sha256 })
  } catch { throw new AiReferenceUploadError('invalid-shape', 'unknown') }
}
