import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAiReferenceUploadProvider, AI_REFERENCE_UPLOAD_LIMITS, AiReferenceUploadError } from '../src/adapters/ai-reference-upload'
import type { AiReferenceUploadFetch } from '../src/adapters/ai-reference-upload'
import { decodeAiReferenceUploadReceipt, inspectReferenceBytes, isPreparedLocalReference, prepareLocalReference, sha256ReferenceBytes, validateAiReferenceUploadInput } from '../src/domain/ai-reference-upload'
import type { AiReferenceUploadCode, AiReferenceUploadInput, AiReferenceUploadOutcome, AiReferenceUploadReceipt, LocalReferenceFile } from '../src/domain/ai-reference-upload'
const cryptoModule: string = 'node:crypto', zlibModule: string = 'node:zlib'
type TestHash = { update(bytes: Uint8Array): TestHash; digest(encoding: 'hex'): string }
const { createHash } = await import(cryptoModule) as { createHash(algorithm: string): TestHash }
const { deflateSync } = await import(zlibModule) as { deflateSync(bytes: Uint8Array): Uint8Array }
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const id = '0123456789abcdef'
function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0)); let at = 0
  for (const part of parts) { result.set(part, at); at += part.length }
  return result
}
const ascii = (s: string) => new Uint8Array([...s].map(char => char.charCodeAt(0)))
function chunk(type: string, data = new Uint8Array()): Uint8Array {
  const result = new Uint8Array(data.length + 12), view = new DataView(result.buffer)
  view.setUint32(0, data.length); result.set(ascii(type), 4); result.set(data, 8)
  let crc = 0xffffffff
  for (const byte of result.subarray(4, result.length - 4)) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1 }
  view.setUint32(result.length - 4, (crc ^ 0xffffffff) >>> 0); return result
}
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
function header(width = 2, height = 3): Uint8Array {
  const bytes = new Uint8Array(13), view = new DataView(bytes.buffer)
  view.setUint32(0, width); view.setUint32(4, height); bytes[8] = 8; bytes[9] = 6
  return chunk('IHDR', bytes)
}
const compressed = new Uint8Array(deflateSync(new Uint8Array((2 * 4 + 1) * 3)))
const png = (width = 2, height = 3, extra = new Uint8Array()) => concat(signature, header(width, height), extra, chunk('IDAT', compressed), chunk('IEND'))
const base64 = (bytes: Uint8Array) => { let value = ''; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value) }
const input = (bytes = png()): AiReferenceUploadInput => ({ base64: base64(bytes), approved: true })
const file = (bytes = png(), type = 'image/png'): LocalReferenceFile => ({ name: 'PRIVATE-source.png', type, size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer })
function receipt(bytes = png()): AiReferenceUploadReceipt {
  const measured = inspectReferenceBytes(bytes), originalSha256 = digest(bytes), sha256 = 'b'.repeat(64)
  return { schemaVersion: 'companion-icons-v1', relativePath: `art/reference/companion/${sha256}.png`, sha256, width: measured.width, height: measured.height,
    mimeType: 'image/png', originalRelativePath: `art/reference/companion/original/${originalSha256}.${measured.extension}`, originalSha256 }
}
const json = (value: unknown, init?: ResponseInit) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json; charset=utf-8', ...init?.headers } })
const fixture = (value: unknown = receipt()) => vi.fn<AiReferenceUploadFetch>(async () => value instanceof Response ? value : json(value))
const failure = (code: string, status = 409) => json({ error: code, code, retryable: false }, { status })
async function errorFrom(pending: Promise<unknown>, code: AiReferenceUploadCode, outcome: AiReferenceUploadOutcome) {
  const error = await pending.then(() => { throw Error('Expected failure') }, (error: unknown) => error)
  expect(error).toBeInstanceOf(AiReferenceUploadError); expect(error).toMatchObject({ code, outcome }); return error as AiReferenceUploadError
}
const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve() }
function exif(orientation: number, little = true): Uint8Array {
  const result = new Uint8Array(26), view = new DataView(result.buffer)
  result.set(ascii(little ? 'II' : 'MM')); view.setUint16(2, 42, little); view.setUint32(4, 8, little); view.setUint16(8, 1, little)
  view.setUint16(10, 0x112, little); view.setUint16(12, 3, little); view.setUint32(14, 1, little); view.setUint16(18, orientation, little)
  return result
}
function jpegSegment(marker: number, data: Uint8Array) { const prefix = new Uint8Array([255, marker, 0, 0]); new DataView(prefix.buffer).setUint16(2, data.length + 2); return concat(prefix, data) }
// Synthetic marker fixtures intentionally do not claim to be pixel-decodable JPEGs.
function jpeg(orientation = 1, width = 2, height = 3, little = true): Uint8Array {
  const sof = new Uint8Array([8, height >>> 8, height & 255, width >>> 8, width & 255, 1, 1, 0x11, 0])
  return concat(new Uint8Array([255, 216]), jpegSegment(0xe1, concat(ascii('Exif\0\0'), exif(orientation, little))), jpegSegment(0xc0, sof), jpegSegment(0xda, new Uint8Array([1, 1, 0, 0, 63, 0])), new Uint8Array([0, 255, 0, 255, 208, 1, 255, 217]))
}
function webpChunk(type: string, data: Uint8Array) {
  const result = new Uint8Array(8 + data.length + (data.length % 2)); result.set(ascii(type)); new DataView(result.buffer).setUint32(4, data.length, true); result.set(data, 8); return result
}
function riff(...chunks: Uint8Array[]) { const data = concat(ascii('WEBP'), ...chunks), result = concat(ascii('RIFF'), new Uint8Array(4), data); new DataView(result.buffer).setUint32(4, data.length, true); return result }
function webp(width = 2, height = 3) { const data = new Uint8Array(5); data[0] = 0x2f; new DataView(data.buffer).setUint32(1, (width - 1) | (height - 1) << 14, true); return riff(webpChunk('VP8L', data)) }
beforeEach(() => {
  // Real SHA-256 with deterministic promise timing; no network and no GPU.
  vi.stubGlobal('crypto', { subtle: { digest: async (_: string, buffer: ArrayBuffer) => Uint8Array.from(digest(new Uint8Array(buffer)).match(/../g)!, pair => parseInt(pair, 16)).buffer } })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('bounded original-file preparation', () => {
  it('measures actual PNG bytes, freezes private provenance and never mistakes structure for pixel decoding', async () => {
    const prepared = await prepareLocalReference(file())
    expect(prepared).toEqual({ base64: input().base64, sha256: digest(png()), width: 2, height: 3, mimeType: 'image/png', byteLength: png().length, pixelDecoded: false })
    expect(Object.isFrozen(prepared)).toBe(true); expect(isPreparedLocalReference(prepared)).toBe(true)
    expect(isPreparedLocalReference({ ...prepared })).toBe(false); expect(isPreparedLocalReference(JSON.parse(JSON.stringify(prepared)))).toBe(false)
    expect(JSON.stringify(prepared)).not.toContain('PRIVATE'); expect(await sha256ReferenceBytes(png())).toBe(digest(png()))
  })
  it('decodes a detached Blob of the exact uploaded bytes before granting pixelDecoded', async () => {
    const decode = vi.fn(async (blob: Blob) => { expect(blob.size).toBe(png().length); expect(blob.type).toBe('image/png'); return { width: 2, height: 3 } })
    expect((await prepareLocalReference(file(), { decode })).pixelDecoded).toBe(true); expect(decode).toHaveBeenCalledOnce()
  })
  it('does not keep the file buffer mutable while awaiting local decode', async () => {
    const bytes = png(), original = Uint8Array.from(bytes)
    const result = await prepareLocalReference({ ...file(bytes), arrayBuffer: async () => bytes.buffer }, { decode: async () => { bytes.fill(0); return { width: 2, height: 3 } } })
    expect(result.base64).toBe(base64(original)); expect(result.sha256).toBe(digest(original))
  })
  it.each([0, -1, 1.5, AI_REFERENCE_UPLOAD_LIMITS.maxFileBytes + 1])('rejects file size %s before reading', async size => {
    const read = vi.fn(async () => png().buffer)
    await errorFrom(prepareLocalReference({ ...file(), size, arrayBuffer: read }), 'invalid-file', 'not-sent'); expect(read).not.toHaveBeenCalled()
  })
  it.each(['', 'image/gif', 'image/svg+xml', 'image/avif', 'text/plain'])('requires an allowed file MIME %s before reading', async type => {
    const read = vi.fn(async () => png().buffer)
    await errorFrom(prepareLocalReference({ ...file(), type, arrayBuffer: read }), 'unsupported-type', 'not-sent'); expect(read).not.toHaveBeenCalled()
  })
  it('rejects read failures, mismatched MIME/length and absent crypto without retaining messages', async () => {
    for (const bad of [{ ...file(), arrayBuffer: async () => { throw Error('PRIVATE') } }, { ...file(), size: 1 }, { ...file(), arrayBuffer: async () => 'PRIVATE' as never }]) {
      expect(String(await errorFrom(prepareLocalReference(bad), 'invalid-file', 'not-sent'))).not.toContain('PRIVATE')
    }
    await errorFrom(prepareLocalReference(file(png(), 'image/jpeg')), 'unsupported-type', 'not-sent')
    vi.stubGlobal('crypto', {}); await errorFrom(prepareLocalReference(file()), 'hash-unavailable', 'not-sent')
  })
  it.each([async () => { throw Error('PRIVATE') }, async () => ({ width: 3, height: 2 }), async () => ({ width: 0, height: 1 })])('rejects failed and contradictory pixel decodes %#', async decode => {
    expect(String(await errorFrom(prepareLocalReference(file(), { decode }), 'decode-failed', 'not-sent'))).not.toContain('PRIVATE')
  })
  it.each([[0, 2], [4097, 1], [4096, 4096], [4001, 4000]])('rejects dimensions %sx%s from bytes before decoder', async (width, height) => {
    const decode = vi.fn(async () => ({ width, height }))
    await errorFrom(prepareLocalReference(file(png(width, height)), { decode }), 'invalid-dimensions', 'not-sent'); expect(decode).not.toHaveBeenCalled()
  })
  it('accepts inclusive dimension/pixel ceilings structurally, without claiming pixel decode', () => {
    expect(inspectReferenceBytes(png(4096, 1)).width).toBe(4096); expect(inspectReferenceBytes(png(4000, 4000)).height).toBe(4000)
  })
  it.each(['acTL', 'fcTL', 'fdAT'])('rejects APNG chunk %s', type => { expect(() => inspectReferenceBytes(png(2, 3, chunk(type)))).toThrow(expect.objectContaining({ code: 'animated-image' })) })
  it('rejects GIF, corrupted CRC/truncation/trailing data and excessive chunk counts', () => {
    expect(() => inspectReferenceBytes(ascii('GIF89a'))).toThrow(expect.objectContaining({ code: 'animated-image' }))
    const corrupted = png(); corrupted[29] ^= 1
    for (const bad of [corrupted, png().slice(0, -1), concat(png(), new Uint8Array([0])), new Uint8Array(AI_REFERENCE_UPLOAD_LIMITS.maxFileBytes + 1), png(2, 3, concat(...Array.from({ length: AI_REFERENCE_UPLOAD_LIMITS.maxContainerChunks }, () => chunk('teXt'))))]) {
      expect(() => inspectReferenceBytes(bad)).toThrow(AiReferenceUploadError)
    }
  })
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('reads JPEG EXIF orientation %s in both endian forms', async orientation => {
    const expected = orientation >= 5 ? { width: 3, height: 2 } : { width: 2, height: 3 }
    for (const little of [true, false]) {
      expect(inspectReferenceBytes(jpeg(orientation, 2, 3, little))).toMatchObject({ ...expected, extension: 'jpg', mimeType: 'image/jpeg' })
      expect((await prepareLocalReference(file(jpeg(orientation, 2, 3, little), 'image/jpeg'), { decode: async () => expected })).pixelDecoded).toBe(true)
    }
  })
  it('rejects malformed JPEG markers, truncated scans, EXIF offsets, invalid orientation and huge sizes', () => {
    const offset = jpeg(); offset[16] = 255
    for (const bad of [jpeg(9), offset, jpeg().slice(0, -2), concat(jpeg(), ascii('junk')), jpeg(1, 4097, 1)]) expect(() => inspectReferenceBytes(bad)).toThrow(AiReferenceUploadError)
  })
  it('applies PNG eXIf orientation and WebP EXIF orientation without trusting filename metadata', () => {
    expect(inspectReferenceBytes(png(2, 3, chunk('eXIf', exif(6))))).toMatchObject({ width: 3, height: 2 })
    expect(inspectReferenceBytes(webp())).toMatchObject({ width: 2, height: 3, mimeType: 'image/webp' })
    expect(inspectReferenceBytes(riff(webpChunk('VP8L', webp().slice(20, 25)), webpChunk('EXIF', exif(6))))).toMatchObject({ width: 3, height: 2 })
  })
  it('accepts bounded lossy WebP dimensions and PNG EXIF following the image stream', () => {
    const lossy = new Uint8Array([0x10, 0, 0, 0x9d, 1, 0x2a, 2, 0, 3, 0])
    expect(inspectReferenceBytes(riff(webpChunk('VP8 ', lossy)))).toMatchObject({ width: 2, height: 3, mimeType: 'image/webp' })
    expect(inspectReferenceBytes(concat(signature, header(), chunk('IDAT', compressed), chunk('eXIf', exif(6)), chunk('IEND')))).toMatchObject({ width: 3, height: 2 })
  })
  it('rejects animated WebP flags and chunks, bad RIFF bounds, duplicate images and canvas mismatch', () => {
    const extended = new Uint8Array(10); extended[0] = 2
    for (const bad of [riff(webpChunk('VP8X', extended)), riff(webpChunk('ANIM', new Uint8Array())), riff(webpChunk('ANMF', new Uint8Array()))]) {
      expect(() => inspectReferenceBytes(bad)).toThrow(expect.objectContaining({ code: 'animated-image' }))
    }
    const badLength = webp(); badLength[4] = 1; extended[0] = 0
    for (const bad of [badLength, webp().slice(0, -1), riff(webpChunk('VP8L', webp().slice(20, 25)), webpChunk('VP8L', webp().slice(20, 25))), riff(webpChunk('VP8X', extended), webpChunk('VP8L', webp().slice(20, 25)))]) expect(() => inspectReferenceBytes(bad)).toThrow(AiReferenceUploadError)
  })
})

describe('strict fixed-path approved request and original SHA receipt binding', () => {
  it('constructs passively and sends only the v148 payload using same-origin cookies', async () => {
    const fetch = fixture(), provider = createAiReferenceUploadProvider({ fetch })
    await expect(provider.waitForIdle()).resolves.toBeUndefined()
    expect(fetch).not.toHaveBeenCalled(); expect(Object.isFrozen(provider)).toBe(true); expect(Object.keys(provider).sort()).toEqual(['label', 'uploadReference', 'waitForIdle'])
    expect(await provider.uploadReference(id, input())).toEqual(receipt()); expect(fetch).toHaveBeenCalledOnce()
    const [path, init] = fetch.mock.calls[0]!
    expect(path).toBe(`/api/icons/${id}/reference-upload`)
    expect(init).toMatchObject({ method: 'POST', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', cache: 'no-store', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } })
    expect(JSON.parse(init.body as string)).toEqual(input()); expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(init.headers).get('authorization')).toBeNull(); expect(new Headers(init.headers).get('cookie')).toBeNull()
  })
  it('requires injected fetch, never reads global fetch and bounds configurable timeouts', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    expect(() => createAiReferenceUploadProvider(undefined as never)).toThrow(TypeError); expect(() => createAiReferenceUploadProvider({} as never)).toThrow(TypeError)
    createAiReferenceUploadProvider({ fetch: fixture() }); expect(fetch).not.toHaveBeenCalled()
    for (const timeoutMs of [0, -1, NaN, Infinity, 20_001]) expect(() => createAiReferenceUploadProvider({ fetch: fixture(), timeoutMs })).toThrow(RangeError)
  })
  it.each(['', '../secret', 'A'.repeat(16), 'a'.repeat(15), 'a'.repeat(17), 'https://PRIVATE', null, 5])('rejects unsafe project id %# before transport', async project => {
    const fetch = fixture(); await errorFrom(createAiReferenceUploadProvider({ fetch }).uploadReference(project as string, input()), 'invalid-input', 'not-sent'); expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects approval coercion, inherited/symbol/unknown fields, URL data and noncanonical base64', async () => {
    const fetch = fixture(), provider = createAiReferenceUploadProvider({ fetch })
    for (const value of [null, {}, [], { ...input(), approved: false }, { ...input(), approved: 'true' }, { ...input(), extra: 'PRIVATE' }, { ...input(), [Symbol('x')]: true }, Object.create(input()),
      { ...input(), base64: 'data:image/png;base64,' + input().base64 }, { ...input(), base64: 'AB==' }, { ...input(), base64: 'AAAA\n' }, { ...input(), base64: 'A'.repeat(AI_REFERENCE_UPLOAD_LIMITS.maxBase64Length + 4) }]) {
      await errorFrom(provider.uploadReference(id, value as AiReferenceUploadInput), 'invalid-input', 'not-sent')
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  it('snapshots the base64 input before an async hash and ignores later caller mutation', async () => {
    const fetch = fixture(), value = input(), pending = createAiReferenceUploadProvider({ fetch }).uploadReference(id, value)
    value.base64 = 'PRIVATE'; value.approved = false as true
    await pending; expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual(input())
  })
  it.each([jpeg(), webp(), png(2, 3, chunk('eXIf', exif(6)))])('validates original extension and oriented dimensions of additional container %#', async bytes => {
    expect(await createAiReferenceUploadProvider({ fetch: fixture(receipt(bytes)) }).uploadReference(id, input(bytes))).toEqual(receipt(bytes))
  })
  it('exports strict input and receipt validators for store fake-provider boundaries', () => {
    expect(validateAiReferenceUploadInput(input(), id)).toMatchObject({ input: input(), metadata: { mimeType: 'image/png' } })
    expect(decodeAiReferenceUploadReceipt(receipt(), { sha256: digest(png()), mimeType: 'image/png', width: 2, height: 3 })).toEqual(receipt())
  })
  it.each([
    (v: any) => { v.schemaVersion = 'other' }, (v: any) => { v.sha256 = 'A'.repeat(64) }, (v: any) => { v.sha256 = 'c'.repeat(64) },
    (v: any) => { v.relativePath = `art/reference/${v.sha256}.png` }, (v: any) => { v.relativePath = 'art/reference/companion/../PRIVATE.png' },
    (v: any) => { v.relativePath += '?secret=PRIVATE' }, (v: any) => { v.originalSha256 = 'a'.repeat(64); v.originalRelativePath = `art/reference/companion/original/${v.originalSha256}.png` },
    (v: any) => { v.originalRelativePath = v.relativePath }, (v: any) => { v.originalRelativePath = v.originalRelativePath.replace('.png', '.jpg') },
    (v: any) => { v.mimeType = 'image/jpeg' }, (v: any) => { v.width = 0 }, (v: any) => { v.width = 1.5 }, (v: any) => { v.height = 4097 },
    (v: any) => { v.width = 4001; v.height = 4000 }, (v: any) => { v.width = 3; v.height = 2 }, (v: any) => { delete v.originalSha256 },
    (v: any) => { v.unexpected = 'PRIVATE' },
  ])('rejects unknown or mismatched success %# without retaining private contents', async mutate => {
    const value = receipt(); mutate(value)
    const error = await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(value) }).uploadReference(id, input()), 'invalid-shape', 'unknown')
    expect(`${error}${JSON.stringify(error)}`).not.toContain('PRIVATE'); expect(error).not.toHaveProperty('cause')
  })
  it.each([201, 202, 206])('accepts only HTTP200, not %s', async status => { await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(json(receipt(), { status })) }).uploadReference(id, input()), 'invalid-shape', 'unknown') })
})

describe('only source-proven prewrite rejection, never unsafe retries', () => {
  it.each([[401, 'unauthorized'], [403, 'forbidden']] as const)('treats authentication %s as rejection and discards body', async (status, code) => {
    const response = json({ secret: 'PRIVATE' }, { status }), cancel = vi.spyOn(response.body!, 'cancel')
    const error = await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(response) }).uploadReference(id, input()), code, 'rejected')
    expect(error.status).toBe(status); expect(cancel).toHaveBeenCalledOnce(); expect(String(error)).not.toContain('PRIVATE')
  })
  it.each([['INVALID_INPUT', 400], ['PROJECT_NOT_FOUND', 404], ['ICON_ADAPTER_DISABLED', 503], ['ICON_CONFIG_INVALID', 503], ['IMAGE_INVALID', 400], ['IMAGE_ANIMATED', 400],
    ['IMAGE_DIMENSIONS_INVALID', 400], ['IMAGE_TYPE_UNSUPPORTED', 400], ['IMAGE_PROCESSING_UNAVAILABLE', 503], ['IMAGE_RESULT_INVALID', 502], ['IMAGE_OUTPUT_LIMIT', 400], ['IMAGE_OUTPUT_LIMIT', 409]] as const)('maps prewrite %s/%s to rejection', async (code, status) => {
    const error = await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(failure(code, status)) }).uploadReference(id, input()), 'rejected', 'rejected')
    expect(JSON.stringify(error)).not.toContain(code)
  })
  it.each(['IMAGE_PATH_UNSAFE', 'OVERWRITE_FORBIDDEN', 'IMAGE_WRITE_UNCONFIRMED', 'WRITE_UNCONFIRMED', 'IMAGE_INPUT_LIMIT', 'ICON_OUTCOME_UNCONFIRMED', 'PRIVATE_FUTURE_CODE'])('keeps possibly postwrite code %s unknown', async code => {
    const fetch = fixture(failure(code, code === 'IMAGE_INPUT_LIMIT' ? 400 : 409)), error = await errorFrom(createAiReferenceUploadProvider({ fetch }).uploadReference(id, input()), 'unconfirmed', 'unknown')
    expect(`${error}${JSON.stringify(error)}`).not.toContain(code); expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([{ code: 'IMAGE_INVALID' }, { code: 'IMAGE_INVALID', error: 'PRIVATE', retryable: false }, { code: 'IMAGE_INVALID', error: 'IMAGE_INVALID', retryable: true }, { code: 'IMAGE_INVALID', error: 'IMAGE_INVALID', retryable: false, debug: 'PRIVATE' }])('rejects incomplete/extra/contradictory error envelope %#', async value => {
    await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(json(value, { status: 400 })) }).uploadReference(id, input()), 'unconfirmed', 'unknown')
  })
  it('does not trust error names with unexpected status or success status', async () => {
    await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(failure('IMAGE_INVALID', 500)) }).uploadReference(id, input()), 'unconfirmed', 'unknown')
    await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(failure('IMAGE_INVALID', 200)) }).uploadReference(id, input()), 'invalid-shape', 'unknown')
  })
  it('sanitizes sync and async transport faults after dispatch', async () => {
    for (const fetch of [vi.fn<AiReferenceUploadFetch>(() => { throw Error('PRIVATE') }), vi.fn<AiReferenceUploadFetch>(async () => { throw Error('PRIVATE') })]) {
      const error = await errorFrom(createAiReferenceUploadProvider({ fetch }).uploadReference(id, input()), 'network-error', 'unknown')
      expect(`${error}${JSON.stringify(error)}`).not.toContain('PRIVATE'); expect(error).not.toHaveProperty('cause'); expect(fetch).toHaveBeenCalledOnce()
    }
  })
})

describe('bounded untrusted response reads', () => {
  it.each(['redirected', 'opaque', 'opaqueredirect'])('rejects %s responses even with HTTP403', async kind => {
    const response = failure('IMAGE_INVALID', 403); Object.defineProperty(response, kind === 'redirected' ? kind : 'type', { value: kind === 'redirected' ? true : kind })
    await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(response) }).uploadReference(id, input()), 'invalid-shape', 'unknown')
  })
  it.each(['text/html', 'text/plain', '', 'application/javascript'])('rejects content type %s', async type => {
    await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(new Response(JSON.stringify(receipt()), { headers: { 'Content-Type': type } })) }).uploadReference(id, input()), 'invalid-shape', 'unknown')
  })
  it('rejects invalid UTF8, malformed JSON, no body, wrapped receipts and top-level arrays', async () => {
    for (const response of [new Response('PRIVATE'), new Response(new Uint8Array([255, 254])), new Response(null), json({ data: receipt() }), json([receipt()])]) {
      response.headers.set('Content-Type', 'application/json')
      expect(String(await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(response) }).uploadReference(id, input()), 'invalid-shape', 'unknown'))).not.toContain('PRIVATE')
    }
  })
  it('reads split UTF8 and JSON under byte and chunk budgets', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(receipt())), stream = new ReadableStream<Uint8Array>({ start(c) { for (let n = 0; n < bytes.length; n += 3) c.enqueue(bytes.slice(n, n + 3)); c.close() } })
    expect(await createAiReferenceUploadProvider({ fetch: fixture(new Response(stream, { headers: { 'Content-Type': 'application/json' } })) }).uploadReference(id, input())).toEqual(receipt())
  })
  it.each(['announced', 'single', 'cumulative', 'chunks'])('bounds %s response and cancels remaining bytes', async mode => {
    const cancel = vi.fn(), response = new Response(new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(mode === 'single' ? AI_REFERENCE_UPLOAD_LIMITS.maxResponseBytes + 1 : mode === 'cumulative' ? 4097 : 0)) }, cancel }),
      { headers: { 'Content-Type': 'application/json', 'Content-Length': mode === 'announced' ? String(AI_REFERENCE_UPLOAD_LIMITS.maxResponseBytes + 1) : '2' } })
    await errorFrom(createAiReferenceUploadProvider({ fetch: fixture(response) }).uploadReference(id, input()), 'response-too-large', 'unknown'); expect(cancel).toHaveBeenCalledOnce()
  })
})

describe('single-flight cancellation fences and bounded waits', () => {
  it('never sends pre-aborted or synchronously aborted calls', async () => {
    const fetch = fixture(), provider = createAiReferenceUploadProvider({ fetch }), first = new AbortController(), second = new AbortController(); first.abort()
    await errorFrom(provider.uploadReference(id, input(), first.signal), 'aborted', 'not-sent')
    const pending = provider.uploadReference(id, input(), second.signal); second.abort(); await errorFrom(pending, 'aborted', 'not-sent'); expect(fetch).not.toHaveBeenCalled()
    expect(await provider.uploadReference(id, input())).toEqual(receipt())
  })
  it('blocks concurrent attempts during hashing without duplicate dispatch', async () => {
    let finish!: () => void; const hash = crypto.subtle.digest.bind(crypto.subtle)
    vi.stubGlobal('crypto', { subtle: { digest: async (...args: Parameters<SubtleCrypto['digest']>) => { await new Promise<void>(resolve => { finish = resolve }); return hash(...args) } } })
    const fetch = fixture(), provider = createAiReferenceUploadProvider({ fetch }), pending = provider.uploadReference(id, input())
    await errorFrom(provider.uploadReference(id, input()), 'busy', 'not-sent'); expect(fetch).not.toHaveBeenCalled(); finish(); await pending; expect(fetch).toHaveBeenCalledOnce()
  })
  it('retains lease after cancellation until ignored-abort fetch and late body cancellation settle', async () => {
    let finish!: (response: Response) => void, finishCancel!: () => void
    const fetch = vi.fn<AiReferenceUploadFetch>().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockImplementation(async () => json(receipt()))
    const provider = createAiReferenceUploadProvider({ fetch }), controller = new AbortController(), pending = errorFrom(provider.uploadReference(id, input(), controller.signal), 'aborted', 'unknown')
    const idle = vi.fn(); void provider.waitForIdle().then(idle)
    await flush(); expect(fetch).toHaveBeenCalledOnce(); controller.abort(); await pending
    expect(idle).not.toHaveBeenCalled()
    await errorFrom(provider.uploadReference(id, input()), 'busy', 'not-sent')
    const cancel = vi.fn(() => new Promise<void>(resolve => { finishCancel = resolve }))
    finish(new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } })); await flush()
    expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled(); await errorFrom(provider.uploadReference(id, input()), 'busy', 'not-sent')
    finishCancel(); await flush(); expect(idle).toHaveBeenCalledOnce(); await expect(provider.waitForIdle()).resolves.toBeUndefined(); expect(await provider.uploadReference(id, input())).toEqual(receipt()); expect(fetch).toHaveBeenCalledTimes(2)
  })
  it('bounds the default fetch wait and does not unlock an unsettled transport or retry', async () => {
    vi.useFakeTimers(); const fetch = vi.fn<AiReferenceUploadFetch>(() => new Promise(() => undefined)), provider = createAiReferenceUploadProvider({ fetch })
    const pending = errorFrom(provider.uploadReference(id, input()), 'timeout', 'unknown')
    await vi.advanceTimersByTimeAsync(AI_REFERENCE_UPLOAD_LIMITS.defaultTimeoutMs); await pending
    await errorFrom(provider.uploadReference(id, input()), 'busy', 'not-sent'); await vi.advanceTimersByTimeAsync(60_000)
    expect(fetch).toHaveBeenCalledOnce(); expect(fetch.mock.calls[0]![1].signal!.aborted).toBe(true)
  })
  it('cancels a stalled body but remains busy until underlying cancellation settles', async () => {
    vi.useFakeTimers(); let finish!: () => void
    const cancel = vi.fn(() => new Promise<void>(resolve => { finish = resolve })), response = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'application/json' } })
    const fetch = vi.fn<AiReferenceUploadFetch>().mockResolvedValueOnce(response).mockImplementation(async () => json(receipt())), provider = createAiReferenceUploadProvider({ fetch, timeoutMs: 20 })
    const pending = errorFrom(provider.uploadReference(id, input()), 'timeout', 'unknown'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(20); await pending
    expect(idle).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce(); await errorFrom(provider.uploadReference(id, input()), 'busy', 'not-sent')
    finish(); await flush(); expect(idle).toHaveBeenCalledOnce(); expect(await provider.uploadReference(id, input())).toEqual(receipt())
  })
  it('retains its idle barrier if a custom reader ignores cancellation and its read never settles', async () => {
    vi.useFakeTimers()
    const read = vi.fn(() => new Promise(() => undefined)), cancel = vi.fn(async () => undefined), releaseLock = vi.fn()
    const response = json(receipt()); Object.defineProperty(response, 'body', { value: { getReader: () => ({ read, cancel, releaseLock }) } })
    const fetch = fixture(response), provider = createAiReferenceUploadProvider({ fetch, timeoutMs: 20 })
    const pending = errorFrom(provider.uploadReference(id, input()), 'timeout', 'unknown'), idle = vi.fn(); void provider.waitForIdle().then(idle)
    await vi.advanceTimersByTimeAsync(20); await pending
    expect(read).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledOnce(); expect(idle).not.toHaveBeenCalled()
    await errorFrom(provider.uploadReference(id, input()), 'busy', 'not-sent'); expect(fetch).toHaveBeenCalledOnce()
  })
  it('bounds stalled hash preparation as not-sent and has no network side effect', async () => {
    vi.useFakeTimers(); vi.stubGlobal('crypto', { subtle: { digest: () => new Promise(() => undefined) } })
    const fetch = fixture(), pending = errorFrom(createAiReferenceUploadProvider({ fetch, timeoutMs: 20 }).uploadReference(id, input()), 'timeout', 'not-sent')
    await vi.advanceTimersByTimeAsync(20); await pending; expect(fetch).not.toHaveBeenCalled()
  })
  it('releases after settled network failure, only a new explicit call sends again', async () => {
    const fetch = vi.fn<AiReferenceUploadFetch>().mockRejectedValueOnce(Error('PRIVATE')).mockImplementation(async () => json(receipt())), provider = createAiReferenceUploadProvider({ fetch })
    await errorFrom(provider.uploadReference(id, input()), 'network-error', 'unknown'); expect(fetch).toHaveBeenCalledOnce()
    expect(await provider.uploadReference(id, input())).toEqual(receipt()); expect(fetch).toHaveBeenCalledTimes(2)
  })
})
