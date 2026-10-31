import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import AiJobActionsPanel from '../src/components/AiJobActionsPanel.vue'
import AiJobsReadPanel from '../src/components/AiJobsReadPanel.vue'
import { createAiJobActionsProvider } from '../src/adapters/ai-job-actions'
import { AiJobActionError, aiVariantDestination, decodeAiJobActionResponse, validateAiJobActionSubmission } from '../src/domain/ai-job-actions'
import type { AiJobActionSubmission, AiJobActionsProvider, AiJobVariantReceipt } from '../src/domain/ai-job-actions'
import type { AiJobSnapshot, AiJobsReadProvider } from '../src/domain/ai-jobs-read'
import { createAiJobActionsState } from '../src/stores/ai-job-actions'
import { readAiWriteFences } from '../src/domain/ai-write-coordination'

const project = { id: '0123456789abcdef', name: 'Current project', path: '/fixture/current' }, source = {}, candidateId = 'CANDIDATE-pouch-1'
function job(): AiJobSnapshot {
  return { projectId: project.id, jobId: 'STUDIO-RUN-variant-ui-0123abcd', revision: 3, state: 'selected', sourceRevision: 'a'.repeat(40), requestHash: 'b'.repeat(64),
    mode: 'offline_import_only', origin: 'adopted', profile: 'fixed', budget: { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, createdAt: '2026-10-17T07:28:12Z',
    assets: [{ assetId: 'pouch', relativePath: 'assets/art/pouch.png' }], candidates: [{ candidateId, assetId: 'pouch', fileSha256: 'c'.repeat(64), width: 1024, height: 1024, hasAlpha: true }], selectedIds: [candidateId],
    import: null, workerResident: false, productionVerified: false,
    resourceSnapshot: { state: 'sealed', version: 1, hash: 'd'.repeat(64), presetId: 'default', config: { schemaVersion: 'project-resource-config-v2', projectId: project.id, version: 1,
      designResolution: { width: 750, height: 1334 }, orientation: 'portrait', iconSize: { width: 96, height: 96 }, style: { description: 'Pouch', references: [] },
      background: { format: 'png', transparent: true, color: '#ffffff' }, composition: { centered: true, paddingPercent: 10 }, destination: { directory: 'assets/art', exportDirectory: 'art/final/icons', naming: 'kebab-case' } } } }
}
function receipt(): AiJobVariantReceipt { return { jobId: job().jobId, revision: 3, candidateId, relativePath: `art/final/icons/pouch-96x96-${'c'.repeat(12)}.png`, sha256: 'e'.repeat(64), sourceSha256: 'c'.repeat(64), width: 96, height: 96, created: true, upscaled: false, qualityLimit: null, receiptSha256: 'f'.repeat(64) } }
function submission(): AiJobActionSubmission { return { operation: 'import-variant', snapshot: job(), approved: true, input: { jobId: job().jobId, revision: 3, candidateId, width: 96, height: 96,
  destinationUrl: aiVariantDestination(job(), receipt()), expectedVariantSha256: receipt().sha256, expectedReceiptSha256: receipt().receiptSha256!, approved: true } } }
function imported(): AiJobSnapshot { return { ...job(), revision: 6, variantImport: { operationId: `icon-import-${'1'.repeat(32)}`, state: 'imported_pending_verification', active: false, effectApplied: true, leaseState: 'RELEASED', errorCode: null, tools: [],
  artifact: { kind: 'variant', candidateId, width: 96, height: 96, fileSha256: receipt().sha256, receiptSha256: receipt().receiptSha256!, destinationUrl: aiVariantDestination(job(), receipt()) } } } }
function reader(): AiJobsReadProvider { return { label: 'reader', waitForIdle: vi.fn(async () => undefined), readJobs: vi.fn(), previewCandidate: vi.fn(), readStatus: vi.fn(async () => job()) } }
function writer(): AiJobActionsProvider { return { label: 'writer', waitForIdle: vi.fn(async () => undefined), execute: vi.fn(async (_id, s) => s.operation === 'export-variant' ? { kind: 'variant' as const, receipt: receipt() } : { kind: 'dispatch' as const, dispatchAccepted: true as const, artifact: 'variant' as const, job: s.snapshot }) } }
function storage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } } }
function setup() { const saved = storage(), read = reader(), write = writer(), store = reactive(createAiJobActionsState({ storage: saved, coordinator: { run: async work => ({ acquired: true, value: await work() }) } })); store.setContext(project, source, job(), read, write, true); return { store, saved, read, write } }
async function exportOnce(s: ReturnType<typeof setup>) { expect(s.store.prepare('export-variant')).toBe(true); s.store.setConfirmed(true); expect(await s.store.execute()).toBe(true); expect(s.store.variantReceipt?.receiptSha256).toBe('f'.repeat(64)) }
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } })
function ack() { return { schemaVersion: 'companion-icons-v1', artifact: 'variant', dispatchAccepted: true, workerResident: false, job: job() } }
beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('original size variant wire binding', () => {
  it('preserves the export receipt SHA and rejects malformed receipt identity', () => {
    const s: AiJobActionSubmission = { operation: 'export-variant', snapshot: job(), approved: true, input: { jobId: job().jobId, revision: 3, candidateId, width: 96, height: 96, allowUpscale: false, expectedTargetSha256: null, approved: true } }
    expect(decodeAiJobActionResponse({ schemaVersion: 'companion-icons-v1', ...receipt() }, project.id, s)).toEqual({ kind: 'variant', receipt: receipt() })
    expect(() => decodeAiJobActionResponse({ schemaVersion: 'companion-icons-v1', ...receipt(), receiptSha256: 'bad' }, project.id, s)).toThrow()
  })
  it('uses only import-variant with the current project, actual variant and receipt hashes', async () => {
    const fetch = vi.fn(async () => json(ack())), provider = createAiJobActionsProvider({ fetch }), s = submission()
    expect(await provider.execute(project.id, s)).toMatchObject({ kind: 'dispatch', artifact: 'variant', job: { productionVerified: false } })
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/icons/${project.id}/import-variant`, expect.objectContaining({ body: JSON.stringify(s.input), credentials: 'same-origin', redirect: 'error' }))
    expect(s.input).toMatchObject({ width: 96, height: 96, expectedVariantSha256: 'e'.repeat(64) })
    expect(() => decodeAiJobActionResponse({ ...ack(), artifact: 'mother' }, project.id, s)).toThrow()
  })
  it('retains only a validated original operation ID from the accepted import response', () => {
    const operationId = `icon-import-${'1'.repeat(32)}`
    expect(decodeAiJobActionResponse({ ...ack(), operationId }, project.id, submission())).toMatchObject({ kind:'dispatch', operationId })
    expect(() => decodeAiJobActionResponse({ ...ack(), operationId:'untrusted' }, project.id, submission())).toThrow()
  })
  it('rejects wrong project, mother/foreign destination, missing receipt and extra paths before transport', async () => {
    const fetch = vi.fn(), provider = createAiJobActionsProvider({ fetch }), s = submission()
    await expect(provider.execute('fedcba9876543210', s)).rejects.toMatchObject({ outcome: 'not-sent' })
    for (const change of [{ destinationUrl: 'db://assets/art/pouch.png' }, { destinationUrl: 'db://assets/../owner.png' }, { expectedReceiptSha256: undefined }, { sourcePath: '/owner.png' }, { revision: 4 }, { width: 1024 }]) {
      expect(() => validateAiJobActionSubmission(project.id, { ...s, input: { ...s.input, ...change } })).toThrow()
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not retry rejection, network loss or unknown response', async () => {
    for (const perform of [async () => json({ code: 'STALE_JOB', error: 'STALE_JOB', retryable: false }, 409), async () => { throw Error('lost') }, async () => json({})]) {
      const fetch = vi.fn(perform)
      await expect(createAiJobActionsProvider({ fetch }).execute(project.id, submission())).rejects.toBeInstanceOf(AiJobActionError)
      expect(fetch).toHaveBeenCalledTimes(1)
    }
  })
  it('recognizes only the exact pre-dispatch review rejection for variant import', async () => {
    const code='ART_REVIEW_SOURCE_UNCONFIRMED', body={code,error:code,retryable:false}
    const provider=createAiJobActionsProvider({fetch:vi.fn(async()=>json(body,409))})
    await expect(provider.execute(project.id,submission())).rejects.toMatchObject({outcome:'rejected',code:'art-review-unconfirmed'})
    const exported:AiJobActionSubmission={operation:'export-variant',snapshot:job(),approved:true,input:{jobId:job().jobId,revision:3,candidateId,width:96,height:96,allowUpscale:false,expectedTargetSha256:null,approved:true}}
    await expect(provider.execute(project.id,exported)).rejects.toMatchObject({outcome:'unknown'})
    for(const [payload,status] of [[{...body,error:'OTHER'},409],[{...body,retryable:true},409],[{...body,code:'OTHER',error:'OTHER'},409],[body,500]] as const){const p=createAiJobActionsProvider({fetch:vi.fn(async()=>json(payload,status))});await expect(p.execute(project.id,submission())).rejects.toMatchObject({outcome:'unknown'})}
  })
})

describe('size import protection and readback', () => {
  it('releases only the exactly rejected import fence and explains the required visual review',async()=>{
    const s=setup();await exportOnce(s);const code='ART_REVIEW_SOURCE_UNCONFIRMED',provider=createAiJobActionsProvider({fetch:vi.fn(async()=>json({code,error:code,retryable:false},409))});s.write.execute=provider.execute
    s.store.prepare('import-variant');s.store.setConfirmed(true);expect(await s.store.execute()).toBe(false)
    expect(readAiWriteFences(s.saved)).toEqual([]);expect(s.store.message).toContain('视觉审阅');expect(s.write.execute).toBe(provider.execute)
  })
  it('persists the accepted original operation ID inside the existing fence', async () => {
    const s = setup(); await exportOnce(s); const operationId = `icon-import-${'1'.repeat(32)}`
    s.write.execute = vi.fn(async () => ({ kind:'dispatch' as const, artifact:'variant' as const, dispatchAccepted:true as const, operationId, job:job() }))
    expect(s.store.prepare('import-variant')).toBe(true); s.store.setConfirmed(true); await s.store.execute()
    expect(readAiWriteFences(s.saved)[0]?.operationId).toBe(operationId); expect(s.write.execute).toHaveBeenCalledTimes(1)
  })
  it('requires a real export receipt and freezes its size, target and distinct hashes', async () => {
    const s = setup(); expect(s.store.allowed('import-variant')).toBe(false); await exportOnce(s)
    expect(s.store.prepare('import-variant')).toBe(true); expect(s.store.confirmation?.submission.input).toEqual(submission().input)
    s.store.setConfirmed(true); expect(s.store.canExecute).toBe(true)
    s.store.setContext({ ...project, id: 'fedcba9876543210' }, source, job(), s.read, s.write, true)
    expect(s.store.canExecute).toBe(false); expect(await s.store.execute()).toBe(false)
  })
  it('does not import an old export response without receipt SHA', async () => {
    const s = setup(), old = receipt(); delete old.receiptSha256
    s.write.execute = vi.fn<AiJobActionsProvider['execute']>(async () => ({ kind: 'variant', receipt: old }))
    s.store.prepare('export-variant'); s.store.setConfirmed(true); await s.store.execute()
    expect(s.store.allowed('import-variant')).toBe(false)
  })
  it('blocks a second click until transport actually drains and keeps exact persistent variant identity', async () => {
    const s = setup(); await exportOnce(s)
    let resolve!: (v: Awaited<ReturnType<AiJobActionsProvider['execute']>>) => void
    s.write.execute = vi.fn<AiJobActionsProvider['execute']>(() => new Promise(r => { resolve = r }))
    s.store.prepare('import-variant'); s.store.setConfirmed(true); const pending = s.store.execute(); await flushPromises()
    expect(s.store.busy).toBe(true); expect(await s.store.execute()).toBe(false); expect(s.store.prepare('import-variant')).toBe(false)
    expect(readAiWriteFences(s.saved)[0]?.variant).toMatchObject({ width: 96, fileSha256: receipt().sha256, receiptSha256: receipt().receiptSha256 })
    resolve({ kind: 'dispatch', artifact: 'variant', dispatchAccepted: true, job: job() }); await pending
    expect(s.write.execute).toHaveBeenCalledTimes(1); expect(s.store.hasPending).toBe(true)
  })
  it('keeps UNKNOWN across a remount and refuses unrelated/mother success as resolution', async () => {
    const s = setup(); await exportOnce(s); s.write.execute = vi.fn(async () => { throw new AiJobActionError('timeout', 'unknown') })
    s.store.prepare('import-variant'); s.store.setConfirmed(true); await s.store.execute(); expect(s.store.hasPending).toBe(true)
    const wrong = imported(); wrong.variantImport!.artifact!.fileSha256 = '9'.repeat(64)
    s.read.readStatus = vi.fn(async () => wrong); await s.store.refreshStatus(); expect(readAiWriteFences(s.saved)).toHaveLength(1)
    s.store.leave(); const second = setup(); second.store.setContext(project, source, job(), s.read, s.write, true)
    expect(s.write.execute).toHaveBeenCalledTimes(1)
    const remounted = reactive(createAiJobActionsState({ storage: s.saved })); remounted.setContext(project, source, job(), s.read, s.write, true)
    expect(remounted.hasPending).toBe(true); expect(remounted.prepare('import-variant')).toBe(false)
  })
  it('clears only the matching completed variant after read drainage, retaining separate mother state', async () => {
    const s = setup(); await exportOnce(s); s.read.readStatus = vi.fn(async () => imported())
    s.store.prepare('import-variant'); s.store.setConfirmed(true); await s.store.execute()
    expect(readAiWriteFences(s.saved)).toEqual([]); expect(s.store.readback?.snapshot).toMatchObject({ state: 'selected', import: null, variantImport: { effectApplied: true, leaseState: 'RELEASED' }, productionVerified: false })
  })
})

describe('size receipt button UI', () => {
  it.each([true, false])('requires artifact identity before presenting confirmed import: %s', async hasArtifact => {
    const snapshot = imported(); if (!hasArtifact) delete snapshot.variantImport!.artifact
    const read = reader(); read.readStatus = vi.fn(async () => snapshot)
    read.readJobs = vi.fn<AiJobsReadProvider['readJobs']>(async () => ({ schemaVersion: 'companion-icons-v1', projectId: project.id, sourceRevision: snapshot.sourceRevision, jobs: [snapshot], profile: { id: 'fixed', ...snapshot.budget }, schedulerEnabled: false, workerResident: false }))
    const wrapper = mount(AiJobsReadPanel, { props: { project, source, provider: read }, global: { plugins: [createPinia(), ElementPlus] } })
    try {
      await wrapper.findAll('button').find(b => b.text() === '读取 / 刷新任务历史')!.trigger('click'); await flushPromises()
      wrapper.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', snapshot.jobId); await flushPromises()
      await wrapper.findAll('button').find(b => b.text() === '刷新所选原任务状态')!.trigger('click'); await flushPromises()
      expect(wrapper.text().includes('尺寸变体文件已导入当前工程，租约已释放')).toBe(hasArtifact)
      if (!hasArtifact) expect(wrapper.text()).toContain('尺寸变体导入尚未确认完成')
    } finally { wrapper.unmount() }
  })
  it('shows current project and actual size identity, and disables repeat confirmation while sending', async () => {
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: object, run: (lock: object) => Promise<unknown>) => run({}) } })
    const read = reader(), write = writer(), wrapper = mount(AiJobActionsPanel, { props: { project, source, job: job(), reader: read, provider: write, offlineOnly: true, allowedOperations: ['export-variant', 'import-variant'] }, global: { plugins: [createPinia(), ElementPlus] } })
    const button = (name: string) => wrapper.findAll('button').find(b => b.text() === name)!
    try {
      await button('导出默认尺寸 PNG').trigger('click'); await wrapper.get('[data-testid="ai-job-action-confirmation"] input[type="checkbox"]').setValue(true)
      await button('确认并导出尺寸 PNG').trigger('click'); await flushPromises()
      expect(wrapper.get('[data-testid="variant-export-receipt"]').text()).toContain(receipt().receiptSha256)
      await button('导入当前工程').trigger('click'); const confirm = wrapper.get('[data-testid="ai-job-action-confirmation"]')
      expect(confirm.text()).toContain(project.id); expect(confirm.text()).toContain(project.path); expect(confirm.get('[data-testid="variant-import-binding"]').text()).toContain('96 × 96')
      expect(confirm.text()).toContain(receipt().sha256); expect(confirm.text()).toContain(receipt().receiptSha256)
      let resolve!: (v: Awaited<ReturnType<AiJobActionsProvider['execute']>>) => void; write.execute = vi.fn<AiJobActionsProvider['execute']>(() => new Promise(r => { resolve = r }))
      await confirm.get('input[type="checkbox"]').setValue(true); await button('确认并导入当前工程').trigger('click'); await flushPromises()
      expect(button('导入当前工程').attributes('disabled')).toBeDefined(); resolve({ kind: 'dispatch', artifact: 'variant', dispatchAccepted: true, job: job() }); await flushPromises()
      expect(write.execute).toHaveBeenCalledTimes(1)
    } finally { wrapper.unmount() }
  })
})
