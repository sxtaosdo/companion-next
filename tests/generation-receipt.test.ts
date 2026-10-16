import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSpec } from '../src/domain/spec'
import { addRequirement, cancelPlannedBatch, createResourcePlan, planBatch, selectGenerationSource } from '../src/domain/resource-planning'
import type { ResourcePlan } from '../src/domain/resource-planning'
import { createGenerationHandoff } from '../src/domain/generation-handoff'
import { parseResourcePlan } from '../src/domain/resource-plan-import'
import { contextMatchesPlan, createReceiptContext, exportGenerationReceipts, inspectGenerationFile, GENERATION_RECEIPT_JSON_LIMIT_BYTES, MAX_GENERATION_FILE_BYTES, MAX_GENERATION_RECEIPTS } from '../src/domain/generation-receipt'
import type { GenerationReceipt, GenerationReceiptContext } from '../src/domain/generation-receipt'

// Test-only Node built-ins, without installing @types/node into this browser app.
const cryptoModule: string = 'node:crypto', zlibModule: string = 'node:zlib'
type TestHash = { update(bytes: Uint8Array): TestHash; digest(encoding: 'hex'): string }
const { createHash, webcrypto } = await import(cryptoModule) as { createHash(algorithm: string): TestHash; webcrypto: Crypto }
const { deflateSync } = await import(zlibModule) as { deflateSync(bytes: Uint8Array): Uint8Array }
const subtle = webcrypto.subtle as unknown as SubtleCrypto
const options = { subtle }
const project = { id: 'p1', name: '测试项目', styleApproval: 'unknown' as const, protectedAssets: null }
function plan(): ResourcePlan {
  const spec = { ...createDefaultSpec(), styleName: '手绘风格' }
  let p = createResourcePlan(project, spec, 'live', 'local-draft')
  p = addRequirement(p, { name: '母图', category: '图标', purpose: '货币', page: '商店', priority: 'normal', defaultSize: { width: 16, height: 16 }, transparent: true, ownerProtected: false, acceptanceNotes: '' })
  return selectGenerationSource(planBatch(p, '一批', [p.requirements[0].id]), 'codex-native')
}
const context = (p = plan()) => createReceiptContext(p, p.requirements[0].id)
function concat(...parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((total, value) => total + value.length, 0))
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.length }
  return bytes
}
function chunk(name: string, data = new Uint8Array()): Uint8Array {
  const bytes = new Uint8Array(data.length + 12)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, data.length)
  bytes.set([...name].map((letter) => letter.charCodeAt(0)), 4)
  bytes.set(data, 8)
  let crc = 0xffffffff
  for (const byte of bytes.subarray(4, bytes.length - 4)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0)
  return bytes
}
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
function header(width = 16, height = 16, colorType = 6, depth = 8, interlace = 0): Uint8Array {
  const data = new Uint8Array(13), view = new DataView(data.buffer)
  view.setUint32(0, width); view.setUint32(4, height)
  data[8] = depth; data[9] = colorType; data[12] = interlace
  return chunk('IHDR', data)
}
const imageData = (value = 0) => new Uint8Array(deflateSync(new Uint8Array((16 * 4 + 1) * 16).fill(value)))
function png(width = 16, height = 16, colorType = 6): Uint8Array {
  return concat(signature, header(width, height, colorType), chunk('IDAT', imageData()), chunk('IEND'))
}
const inspect = (bytes = png(), name = '母图.png', p = plan()) => inspectGenerationFile(context(p), { name, bytes }, options)
afterEach(() => vi.unstubAllGlobals())

describe('frozen receipt context', () => {
  it('requires selected source, an existing batch and a non-Owner requirement', () => {
    const p = plan()
    expect(() => context(selectGenerationSource(p, 'unselected'))).toThrow('来源')
    expect(() => context(cancelPlannedBatch(p, p.batches[0].id))).toThrow('编入批次')
    expect(() => createReceiptContext(p, 'missing')).toThrow('不存在')
    const protectedPlan = addRequirement(p, { name: 'Owner', category: '图标', purpose: '保留', page: '商店', priority: 'normal', defaultSize: { width: 16, height: 16 }, transparent: true, ownerProtected: true, acceptanceNotes: '' })
    expect(() => createReceiptContext(protectedPlan, protectedPlan.requirements[1].id)).toThrow('Owner')
  })
  it('retains full detached spec, requirement, batch, scope and source snapshots', () => {
    const p = plan(), c = context(p)
    expect(c).toMatchObject({ planId: p.id, planCreatedAt: p.createdAt, scope: p.scope, binding: p.binding, requirement: p.requirements[0], batch: p.batches[0], generationSource: 'codex-native' })
    expect(c.binding).not.toBe(p.binding)
    expect(Object.isFrozen(c.binding.snapshot)).toBe(true)
    expect(Object.isFrozen(c.requirement.acceptance[0])).toBe(true)
    expect(Object.isFrozen(c.batch.requirementIds)).toBe(true)
    expect(() => { (c.requirement.defaultSize as any).width = 32 }).toThrow()
    p.binding.snapshot.fontFamily = '修改后'
    expect(c.binding.snapshot.fontFamily).not.toBe('修改后')
    expect(() => JSON.stringify(c)).not.toThrow()
  })
  it.each([
    (p: ResourcePlan) => { p.id = 'other' },
    (p: ResourcePlan) => { p.scope.mode = 'demo' },
    (p: ResourcePlan) => { p.scope.projectName = '另一个项目名称' },
    (p: ResourcePlan) => { p.generationSource = 'comfyui' },
    (p: ResourcePlan) => { p.binding.snapshot.pivot = '不同 pivot' },
    (p: ResourcePlan) => { p.binding.source = 'read-only' },
    (p: ResourcePlan) => { p.requirements[0].defaultSize.width = 32 },
    (p: ResourcePlan) => { p.requirements[0].transparent = false },
    (p: ResourcePlan) => { p.requirements[0].acceptanceNotes = '需要新检查' },
    (p: ResourcePlan) => { p.requirements[0].ownerProtected = true },
    (p: ResourcePlan) => { p.batches[0].id = 'new-batch' },
    (p: ResourcePlan) => { p.batches[0].name = '新批次' },
    (p: ResourcePlan) => { p.batches = [] },
  ])('detects relevant semantic changes even when other stable IDs remain', (change) => {
    const p = plan(), c = context(p)
    expect(contextMatchesPlan(c, p)).toBe(true)
    change(p)
    expect(contextMatchesPlan(c, p)).toBe(false)
  })
  it('compares semantically regardless of object key order and ignores unrelated additions', () => {
    const p = plan(), c = context(p)
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reorder(child)])) : value
    expect(contextMatchesPlan(c, reorder(p) as ResourcePlan)).toBe(true)
    const added = addRequirement(p, { name: '其它未编批项', category: '按钮', purpose: '菜单', page: '主菜单', priority: 'normal', defaultSize: { width: 16, height: 16 }, transparent: false, ownerProtected: false, acceptanceNotes: '' })
    expect(contextMatchesPlan(c, added)).toBe(true)
    expect(contextMatchesPlan(c, undefined)).toBe(false)
  })
  it('rejects external claims, unknown fields and positive execution counters', () => {
    for (const mutate of [(p: any) => { p.outputReceipt = { status: 'passed' } }, (p: any) => { p.execution.generatedAssets = 1 }, (p: any) => { p.requirements[0].generated = true }]) {
      const p = plan(); mutate(p); expect(() => context(p)).toThrow()
    }
  })
  it('does not accept serialized context or an outbound empty handoff as live measurement evidence', async () => {
    const p = plan(), c = context(p), clone = JSON.parse(JSON.stringify(c)) as GenerationReceiptContext
    expect(contextMatchesPlan(clone, p)).toBe(false)
    await expect(inspectGenerationFile(clone, { name: 'a.png', bytes: png() }, options)).rejects.toThrow('外部 JSON')
    await expect(inspectGenerationFile(c, { name: 'a.png', bytes: createGenerationHandoff(p) as any }, options)).rejects.toThrow('实际文件')
    await expect(inspectGenerationFile(c, { name: 'a.png', bytes: new TextEncoder().encode(JSON.stringify(createGenerationHandoff(p))) }, options)).rejects.toThrow('PNG')
  })
})

describe('byte-derived PNG receipts', () => {
  it('hashes actual bytes and leaves all unobserved evidence unresolved', async () => {
    const p = plan(), before = JSON.stringify(p), bytes = png()
    const r = await inspect(bytes, '母图.png', p)
    expect(r.file).toMatchObject({ name: '母图.png', byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), width: 16, height: 16, format: 'png', pngColorType: 6, bitDepth: 8, alphaDeclared: true, hasTransparencyChunk: false })
    expect(r).toMatchObject({ artifact: 'master', status: 'needs-review', sourceDeclaration: 'user-declared', sourceVerification: 'not-verified', checks: { pngStructure: 'checked', dimensions: 'matched', fullDecode: 'not-checked', pixelTransparency: 'not-checked', visualReview: 'not-checked', ownerApproval: 'not-checked' }, savedToProject: false, imported: false, bound: false, runtime: 'not-checked' })
    expect(r.id).toBeTruthy(); expect(new Date(r.measuredAt).toISOString()).toBe(r.measuredAt)
    expect(JSON.stringify(p)).toBe(before)
    expect(Object.values(p.execution).every((value) => value === 0)).toBe(true)
    expect(Object.isFrozen(r.file)).toBe(true)
    expect(() => { (r as any).imported = true }).toThrow()
    expect(JSON.stringify(r)).not.toContain('"bytes"')
  })
  it('keeps a size mismatch as needs-review rather than dropping or approving it', async () => {
    const r = await inspect(png(32, 16))
    expect(r.file.width).toBe(32)
    expect(r.checks.dimensions).toBe('mismatch')
    expect(r.status).toBe('needs-review')
    expect(JSON.parse(exportGenerationReceipts([r])).receipts[0].file.width).toBe(32)
  })
  it('accepts small actual files as mismatched rather than pretending the planned size', async () => {
    const r = await inspect(png(1, 1))
    expect(r.file).toMatchObject({ width: 1, height: 1 })
    expect(r.checks.dimensions).toBe('mismatch')
  })
  it('records the original source after plan switching without relabeling old evidence', async () => {
    const p = plan(), r = await inspect(png(), 'x.png', p)
    const switched = selectGenerationSource(p, 'comfyui')
    expect(contextMatchesPlan(r.context, switched)).toBe(false)
    expect(r.context.generationSource).toBe('codex-native')
    expect(JSON.parse(exportGenerationReceipts([r])).receipts[0].context.generationSource).toBe('codex-native')
  })
  it('defaults to browser crypto without a provider call', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const bytes = png()
    const r = await inspectGenerationFile(context(), { name: 'x.png', bytes })
    expect(r.file.sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
  })
  it('copies bytes before asynchronous hashing', async () => {
    const bytes = png(), expected = createHash('sha256').update(bytes).digest('hex')
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const pending = inspectGenerationFile(context(), { name: 'x.png', bytes }, { subtle: { digest: async (...args) => { await gate; return subtle.digest(...args) } } })
    bytes.fill(0); release()
    expect((await pending).file.sha256).toBe(expected)
  })
  it.each(['../x.png', '/x.png', 'C:\\x.png', 'C:x.png', 'a/b.png', 'a\\b.png', 'x\n.png', '\u202ex.png', '', '  ', ' x.png', 'x.png ', '.', '..', 'x'.repeat(181)])('rejects paths, controls or unbounded file name %j', async (name) => {
    await expect(inspect(png(), name)).rejects.toThrow('文件名')
  })
  it('rejects missing bytes, empty data and files over 16 MiB', async () => {
    await expect(inspect(new Uint8Array())).rejects.toThrow('非空')
    await expect(inspect(new Uint8Array(MAX_GENERATION_FILE_BYTES + 1))).rejects.toThrow('16 MiB')
    await expect(inspectGenerationFile(context(), { name: 'x.png', bytes: [] as any }, options)).rejects.toThrow('Uint8Array')
  })
  it.each([[0, 16], [16, 0], [8193, 16], [16, 8193], [0xffffffff, 0xffffffff]])('rejects unsafe declared dimensions %i × %i', async (width, height) => {
    await expect(inspect(png(width, height))).rejects.toThrow('实际尺寸')
  })
  it('does not confuse alpha declaration, tRNS metadata and pixel transparency quality', async () => {
    const opaque = await inspect(png(16, 16, 2))
    expect(opaque.file.alphaDeclared).toBe(false)
    const indexed = concat(signature, header(16, 16, 3), chunk('PLTE', new Uint8Array([0, 0, 0])), chunk('tRNS', new Uint8Array([0])), chunk('IDAT', imageData()), chunk('IEND'))
    const r = await inspect(indexed)
    expect(r.file).toMatchObject({ pngColorType: 3, alphaDeclared: false, hasTransparencyChunk: true })
    expect(r.checks.pixelTransparency).toBe('not-checked')
    expect(r.status).toBe('needs-review')
  })
  it('does not label a CRC-valid compressed payload as decoded pixel evidence', async () => {
    // Plausible framing and zlib header only; the deliberately invalid stream
    // demonstrates the documented scope of this metadata-only inspection.
    const bytes = concat(signature, header(), chunk('IDAT', new Uint8Array([120, 156, 255, 255, 255, 255])), chunk('IEND'))
    const r = await inspect(bytes)
    expect(r.checks.fullDecode).toBe('not-checked')
    expect(r.checks.pixelTransparency).toBe('not-checked')
    expect(r.status).toBe('needs-review')
  })
  it('fails closed if hashing is unavailable, rejects or returns the wrong size', async () => {
    const c = context(), file = { name: 'x.png', bytes: png() }
    vi.stubGlobal('crypto', { randomUUID: () => 'unused' })
    await expect(inspectGenerationFile(c, file)).rejects.toThrow('SHA-256')
    await expect(inspectGenerationFile(c, file, { subtle: { digest: async () => { throw new Error('digest failed') } } })).rejects.toThrow('digest failed')
    await expect(inspectGenerationFile(c, file, { subtle: { digest: async () => new ArrayBuffer(0) } })).rejects.toThrow('SHA-256')
  })
})

describe('bounded PNG structure validation', () => {
  it('rejects magic-only, truncated, wrong-signature and CRC-corrupt files', async () => {
    const corrupted = png(); corrupted[corrupted.length - 1] ^= 1
    const wrong = png(); wrong[0] = 0
    for (const value of [signature, png().subarray(0, 32), png().subarray(0, png().length - 1), corrupted, wrong]) await expect(inspect(value)).rejects.toThrow('PNG')
  })
  it.each([
    () => concat(signature, chunk('IDAT', imageData()), header(), chunk('IEND')),
    () => concat(signature, header(), header(), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(), chunk('IEND')),
    () => concat(signature, header(), chunk('IDAT'), chunk('IEND')),
    () => concat(signature, header(), chunk('IDAT', imageData())),
    () => concat(png(), new Uint8Array([0])),
    () => concat(signature, header(), chunk('IDAT', imageData()), chunk('IEND', new Uint8Array([1]))),
    () => concat(signature, header(), chunk('IDAT', imageData()), chunk('tEXt'), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(), chunk('ABCD'), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(), chunk('abca'), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(), chunk('acTL', new Uint8Array(8)), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(), chunk('IDAT', new Uint8Array([0, 0, 0, 0, 0, 0])), chunk('IEND')),
    () => concat(signature, header(16, 16, 3), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(), chunk('PLTE', new Uint8Array([1])), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(), chunk('tRNS', new Uint8Array([1])), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(16, 16, 0, 8), chunk('PLTE', new Uint8Array(3)), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(16, 16, 6, 4), chunk('IDAT', imageData()), chunk('IEND')),
    () => concat(signature, header(16, 16, 6, 8, 2), chunk('IDAT', imageData()), chunk('IEND')),
  ])('rejects invalid chunk structure, flags or unsupported animation', async (make) => {
    await expect(inspect(make())).rejects.toThrow('PNG')
  })
  it('checks every chunk CRC and bounds declared lengths before reading', async () => {
    const value = png(); value[40] ^= 1
    await expect(inspect(value)).rejects.toThrow('CRC')
    const length = png(); new DataView(length.buffer).setUint32(8, 0xffffffff)
    await expect(inspect(length)).rejects.toThrow('长度')
  })
  it('accepts split contiguous IDAT without mistaking empty chunks for a complete image', async () => {
    const data = imageData()
    const bytes = concat(signature, header(), chunk('IDAT'), chunk('IDAT', data.subarray(0, 1)), chunk('IDAT', data.subarray(1)), chunk('IEND'))
    expect((await inspect(bytes)).checks.pngStructure).toBe('checked')
  })
  it('caps chunk counts to bound parser work', async () => {
    const bytes = concat(signature, header(), ...Array.from({ length: 8192 }, () => chunk('tEXt')), chunk('IDAT', imageData()), chunk('IEND'))
    await expect(inspect(bytes)).rejects.toThrow('块数量')
  })
})

describe('audit export does not turn metadata into execution evidence', () => {
  it('exports only locally measured immutable receipts with the complete scope and disclaimer', async () => {
    const r = await inspect(), text = exportGenerationReceipts([r]), output = JSON.parse(text)
    expect(output.kind).toBe('companion-generation-receipts')
    expect(output.receipts).toEqual([r])
    expect(output.disclaimer).toContain('未保存到项目')
    expect(output.disclaimer).toContain('完整解码')
    expect(new TextEncoder().encode(text).byteLength).toBeLessThanOrEqual(GENERATION_RECEIPT_JSON_LIMIT_BYTES)
    expect(() => parseResourcePlan(text)).toThrow()
  })
  it('rejects zero results, too many receipts, duplicates, clones and fabricated passed claims', async () => {
    const r = await inspect()
    expect(() => exportGenerationReceipts([])).toThrow('空输出')
    expect(() => exportGenerationReceipts(Array(MAX_GENERATION_RECEIPTS + 1).fill(r))).toThrow('1–32')
    expect(() => exportGenerationReceipts([r, r])).toThrow('重复')
    expect(() => exportGenerationReceipts([JSON.parse(JSON.stringify(r)) as GenerationReceipt])).toThrow('外部 JSON')
    expect(() => exportGenerationReceipts([{ ...r, status: 'passed', imported: true } as any])).toThrow('原始回执')
    expect(() => exportGenerationReceipts([createGenerationHandoff(plan()).outputReceipt as any])).toThrow('实测')
  })
  it('rejects duplicate bytes for a semantically identical context despite new IDs or names', async () => {
    const p = plan(), a = await inspect(png(), 'a.png', p), b = await inspect(png(), 'b.png', p)
    expect(a.id).not.toBe(b.id)
    expect(() => exportGenerationReceipts([a, b])).toThrow('重复')
  })
  it('allows identical bytes in distinct declared source contexts without merging provenance', async () => {
    const p = plan(), a = await inspect(png(), 'a.png', p), b = await inspect(png(), 'a.png', selectGenerationSource(p, 'comfyui'))
    expect(JSON.parse(exportGenerationReceipts([a, b])).receipts).toHaveLength(2)
    expect(a.context.generationSource).toBe('codex-native')
    expect(b.context.generationSource).toBe('comfyui')
  })
  it('enforces the 512 KiB serialized UTF-8 budget without altering valid receipts', async () => {
    const p = plan()
    Object.assign(p.binding.snapshot, { version: '规'.repeat(60), styleName: '风'.repeat(100), styleKeywords: '样'.repeat(500), spacing: '距'.repeat(100), fontFamily: '字'.repeat(160), buttonStates: '态'.repeat(200), overlayPolicy: '层'.repeat(500), pivot: '锚'.repeat(100), bundle: '组'.repeat(160), panelPolicy: '板'.repeat(160) })
    p.binding.specVersion = p.binding.snapshot.version; p.binding.styleReference = p.binding.snapshot.styleName
    p.requirements = []; p.batches = []
    let filled = p
    for (let index = 0; index < 32; index++) filled = addRequirement(filled, { name: `${index}`, category: '图标', purpose: '用'.repeat(200), page: '页'.repeat(160), priority: 'normal', defaultSize: { width: 16, height: 16 }, transparent: true, ownerProtected: false, acceptanceNotes: '验'.repeat(500) })
    filled = planBatch(filled, '批'.repeat(100), filled.requirements.map((item) => item.id))
    const records: GenerationReceipt[] = []
    for (const requirement of filled.requirements) records.push(await inspectGenerationFile(createReceiptContext(filled, requirement.id), { name: 'x.png', bytes: png() }, options))
    const before = JSON.stringify(records)
    expect(() => exportGenerationReceipts(records)).toThrow('512 KiB')
    expect(JSON.stringify(records)).toBe(before)
    expect(() => exportGenerationReceipts(records.slice(0, 1))).not.toThrow()
  })
})
