import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGenerationReceiptsStore } from '../src/stores/generation-receipts'
import { addRequirement, createResourcePlan, planBatch, selectGenerationSource } from '../src/domain/resource-planning'
import { createDefaultSpec } from '../src/domain/spec'
import { localFile, pngBytes, testCrypto } from './fixtures/generation-png'
function plan() {
  let p = createResourcePlan({ id: 'p1', name: '项目', styleApproval: 'unknown', protectedAssets: null }, { ...createDefaultSpec(), styleName: '测试风格' }, 'live', 'local-draft')
  p = addRequirement(p, { name: '图标', category: '图标', purpose: '道具', page: '商店', priority: 'normal', defaultSize: { width: 16, height: 16 }, transparent: true, ownerProtected: false, acceptanceNotes: '' })
  return selectGenerationSource(planBatch(p, '第一批', [p.requirements[0]!.id]), 'codex-native')
}
beforeEach(() => { setActivePinia(createPinia()); vi.stubGlobal('crypto', testCrypto) })
afterEach(() => vi.unstubAllGlobals())
describe('local generation file receipts', () => {
  it('measures a file without changing the plan, sending network traffic or storing bytes', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const store = useGenerationReceiptsStore(); const p = plan(); const before = JSON.stringify(p)
    const receipt = await store.receive(p, p.requirements[0]!.id, localFile(), () => p)
    expect(receipt?.file).toMatchObject({ name: 'result.png', width: 16, height: 16, sha256: expect.stringMatching(/^[a-f0-9]{64}$/) })
    expect(store.receipts).toHaveLength(1); expect(store.pending).toBe(false)
    expect(store.exportFor('live', 'p1')).toContain('needs-review')
    expect(JSON.stringify(p)).toBe(before); expect(fetch).not.toHaveBeenCalled()
    expect(Object.keys(receipt!.file)).not.toContain('bytes')
  })
  it('does not duplicate the same context and bytes', async () => {
    const store = useGenerationReceiptsStore(); const p = plan(); const id = p.requirements[0]!.id
    await store.receive(p, id, localFile(), () => p)
    await expect(store.receive(p, id, localFile(), () => p)).rejects.toThrow('未重复')
    expect(store.receipts).toHaveLength(1)
  })
  it('retains old source identity while allowing a new explicit source context', async () => {
    const store = useGenerationReceiptsStore(); const p = plan(); const next = selectGenerationSource(p, 'comfyui')
    await store.receive(p, p.requirements[0]!.id, localFile(), () => p)
    await store.receive(next, next.requirements[0]!.id, localFile(), () => next)
    expect(store.receipts.map((r) => r.context.generationSource)).toEqual(['codex-native', 'comfyui'])
    expect(store.list('demo', 'p1')).toHaveLength(0); expect(store.list('live', 'other')).toHaveLength(0)
  })
  it('rejects a late file after context changes without committing anything', async () => {
    const store = useGenerationReceiptsStore(); const p = plan()
    await expect(store.receive(p, p.requirements[0]!.id, localFile(), () => selectGenerationSource(p, 'comfyui'))).rejects.toThrow('已经变化')
    expect(store.receipts).toHaveLength(0)
  })
  it('cancels A→B→A and a late read failure without affecting a newer operation', async () => {
    const store = useGenerationReceiptsStore(); const p = plan()
    let reject!: (e: Error) => void
    const old = store.receive(p, p.requirements[0]!.id, { ...localFile(), arrayBuffer: () => new Promise((_res, rej) => { reject = rej }) }, () => p)
    expect(store.pending).toBe(true); store.cancelPending()
    await store.receive(p, p.requirements[0]!.id, localFile(), () => p)
    reject(new Error('late')); await old
    expect(store.receipts).toHaveLength(1); expect(store.pending).toBe(false)
  })
  it('blocks concurrent reads and enforces the file limit before reading', async () => {
    const store = useGenerationReceiptsStore(); const p = plan(); const reader = vi.fn()
    await expect(store.receive(p, p.requirements[0]!.id, { name: 'large.png', size: 16 * 1024 * 1024 + 1, arrayBuffer: reader }, () => p)).rejects.toThrow('16 MiB')
    expect(reader).not.toHaveBeenCalled()
    let resolve!: (b: ArrayBuffer) => void
    const pending = store.receive(p, p.requirements[0]!.id, { ...localFile(), arrayBuffer: () => new Promise((res) => { resolve = res }) }, () => p)
    await expect(store.receive(p, p.requirements[0]!.id, localFile(), () => p)).rejects.toThrow('正在读取')
    store.cancelPending(); resolve(pngBytes().slice().buffer); await pending; expect(store.receipts).toHaveLength(0)
  })
  it('rejects a changed file length without storing a receipt', async () => {
    const store = useGenerationReceiptsStore(); const p = plan()
    await expect(store.receive(p, p.requirements[0]!.id, { ...localFile(), size: 2 }, () => p)).rejects.toThrow('长度发生变化')
    expect(store.receipts).toHaveLength(0)
  })
  it('records an actual size mismatch without promoting it to generation or QA success', async () => {
    const store = useGenerationReceiptsStore(); const p = plan()
    const receipt = await store.receive(p, p.requirements[0]!.id, localFile(pngBytes(32, 16)), () => p)
    expect(receipt?.checks.dimensions).toBe('mismatch'); expect(receipt?.status).toBe('needs-review')
    expect(receipt?.checks.visualReview).toBe('not-checked'); expect(receipt?.savedToProject).toBe(false)
  })
})
