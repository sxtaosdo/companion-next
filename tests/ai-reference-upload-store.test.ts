import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { testCrypto, localFile } from './fixtures/generation-png'
import { resourceView } from './fixtures/ai-resource-read'
import { AI_REFERENCE_UPLOAD_FENCE_KEY, useAiReferenceUploadStore } from '../src/stores/ai-reference-upload'
import { useAiResourceEditorStore } from '../src/stores/ai-resource-editor'
import type { AiEditorContext, AiEditorFenceStorage } from '../src/stores/ai-resource-editor'
import { createAiReferenceUploadProvider } from '../src/adapters/ai-reference-upload'
import { AiReferenceUploadError } from '../src/domain/ai-reference-upload'
import type { AiReferenceUploadProvider, AiReferenceUploadReceipt, LocalReferenceFile } from '../src/domain/ai-reference-upload'
import type { AiResourceReadProvider, AiResourceView } from '../src/domain/ai-resource-read'
import type { AiResourceSaveProvider } from '../src/domain/ai-resource-save'
const id = '0123456789abcdef', other = 'fedcba9876543210'
const context: AiEditorContext = { project: { id, name: '项目 A', path: '/fixture/a' }, source: {} }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail }); return { promise, resolve, reject } }
function storageFixture() {
  const values = new Map<string, string>()
  const storage: AiEditorFenceStorage = { getItem: vi.fn(key => values.get(key) ?? null), setItem: vi.fn((key, value) => { values.set(key, value) }) }
  return { values, storage }
}
function file(): LocalReferenceFile { return { ...localFile(), type: 'image/png' } }
const decode = async () => ({ width: 16, height: 16 })
function receiptFor(sha: string): AiReferenceUploadReceipt {
  return { schemaVersion: 'companion-icons-v1', relativePath: `art/reference/companion/${'b'.repeat(64)}.png`, sha256: 'b'.repeat(64), width: 16, height: 16, mimeType: 'image/png', originalRelativePath: `art/reference/companion/original/${sha}.png`, originalSha256: sha }
}
function setup(previousStorage?: AiEditorFenceStorage, writable = true) {
  const editor = useAiResourceEditorStore(), store = useAiReferenceUploadStore(), { storage, values } = storageFixture()
  const reader: AiResourceReadProvider = { label: 'offline', readConfig: vi.fn(async () => resourceView()), previewReference: vi.fn(async () => { throw Error('unused') }) }
  const writer: AiResourceSaveProvider = { label: 'offline', saveConfig: vi.fn(async () => resourceView()) }
  const provider: AiReferenceUploadProvider = { label: 'offline', waitForIdle: vi.fn(async () => {}), uploadReference: vi.fn(async () => receiptFor(store.selected!.sha256)) }
  editor.setFenceStorage(storageFixture().storage); store.setFenceStorage(previousStorage ?? storage)
  expect(editor.open(context, resourceView(), reader, writable ? writer : null)).toBe(true)
  expect(store.bind(context, reader, writable ? writer : null, writable ? provider : null)).toBe(true)
  return { editor, store, reader, writer, provider, values, storage: previousStorage ?? storage }
}
async function select(store: ReturnType<typeof useAiReferenceUploadStore>) { expect(await store.selectFile(file(), { decode })).toBe(true) }
async function send(state: ReturnType<typeof setup>) { state.store.setConfirmed(true); return state.store.upload(context, state.reader, state.writer, state.provider) }
beforeEach(() => { setActivePinia(createPinia()); vi.stubGlobal('crypto', testCrypto) })
describe('local reference preparation and explicit frozen upload authority', () => {
  it('permits local pixel preview without upload or save providers, but no dispatch', async () => {
    const state = setup(undefined, false); await select(state.store); state.store.setConfirmed(true)
    expect(state.store.selected?.pixelDecoded).toBe(true); expect(state.store.canUpload).toBe(false)
    expect(await state.store.upload(context, state.reader, state.writer, state.provider)).toBe(false); expect(state.provider.uploadReference).not.toHaveBeenCalled()
  })
  it('never dispatches on selection, precheck, or direct mutation of the public confirmation', async () => {
    const state = setup(); await select(state.store)
    expect(state.store.phase).toBe('ready'); expect(state.provider.uploadReference).not.toHaveBeenCalled()
    state.store.confirmed = true; expect(state.store.canUpload).toBe(false)
    expect(await state.store.upload(context, state.reader, state.writer, state.provider)).toBe(false)
    state.store.setConfirmed(true); expect(state.store.canUpload).toBe(true)
  })
  it('rejects structure-only images and any decode failure before transport', async () => {
    const state = setup(); expect(await state.store.selectFile(file())).toBe(false); expect(state.store.selected).toBeNull()
    expect(await state.store.selectFile(file(), { decode: async () => { throw Error('sensitive raw text') } })).toBe(false)
    expect(state.store.error).not.toContain('sensitive'); expect(state.provider.uploadReference).not.toHaveBeenCalled()
  })
  it('revokes approval after any form edit, reselection or cleared canvas selection', async () => {
    const state = setup(); await select(state.store); state.store.setConfirmed(true)
    state.editor.draft!.style.description = 'changed'; expect(state.store.confirmed).toBe(false); expect(state.store.canUpload).toBe(false)
    state.store.setConfirmed(true); await select(state.store); expect(state.store.confirmed).toBe(false)
    state.store.setConfirmed(true); state.store.clearSelection(); expect(state.store.selected).toBeNull(); expect(state.store.canUpload).toBe(false)
  })
  it.each(['id', 'name', 'path', 'source', 'reader', 'writer', 'provider'] as const)('revokes %s identity at dispatch without sending', async kind => {
    const state = setup(); await select(state.store); state.store.setConfirmed(true)
    const next = { project: { ...context.project }, source: context.source }
    if (kind === 'id') next.project.id = other
    if (kind === 'name') next.project.name = 'renamed'
    if (kind === 'path') next.project.path = '/elsewhere'
    if (kind === 'source') next.source = {}
    await state.store.upload(next, kind === 'reader' ? { ...state.reader } : state.reader, kind === 'writer' ? { ...state.writer } : state.writer, kind === 'provider' ? { ...state.provider } : state.provider)
    expect(state.store.confirmed).toBe(false); expect(state.provider.uploadReference).not.toHaveBeenCalled()
  })
  it('does not restore stale approval when the same binding returns', async () => {
    const state = setup(); await select(state.store); state.store.setConfirmed(true); state.store.leave()
    expect(state.store.bind(context, state.reader, state.writer, state.provider)).toBe(true); expect(state.store.confirmed).toBe(false)
  })
  it('ignores a delayed local decode after clear, leave or newer selection', async () => {
    const state = setup(), wait = deferred<{ width: number; height: number }>()
    const first = state.store.selectFile(file(), { decode: () => wait.promise }); await vi.waitFor(() => expect(state.store.phase).toBe('preparing'))
    state.store.clearSelection(); wait.resolve({ width: 16, height: 16 }); expect(await first).toBe(false); expect(state.store.selected).toBeNull()
  })
})
describe('durable upload ledger and conservative terminal outcomes', () => {
  it('writes the fence before invoking transport and appends only to the draft, with save approval revoked', async () => {
    const state = setup(); await select(state.store); state.editor.draft!.style.description = 'changed'; state.editor.setConfirmed(true)
    state.provider.uploadReference = vi.fn(async (_id, input) => {
      expect(input.approved).toBe(true); expect(JSON.parse(state.values.get(AI_REFERENCE_UPLOAD_FENCE_KEY)!)).toHaveLength(1)
      expect(state.editor.canSave).toBe(false); expect(state.editor.referenceUploadActive).toBe(true)
      return receiptFor(state.store.selected!.sha256)
    })
    expect(await send(state)).toBe(true); expect(state.store.phase).toBe('attached'); expect(state.store.receiptAttached).toBe(true)
    expect(state.editor.draft!.style.references).toContain(state.store.receipt!.relativePath)
    expect(state.editor.base!.config!.style.references).not.toContain(state.store.receipt!.relativePath)
    expect(state.editor.confirmed).toBe(false); expect(state.writer.saveConfig).not.toHaveBeenCalled()
    expect(state.editor.referenceUploadActive).toBe(false); expect(JSON.parse(state.values.get(AI_REFERENCE_UPLOAD_FENCE_KEY)!)[0].receipt).toBeTruthy()
    expect(state.values.get(AI_REFERENCE_UPLOAD_FENCE_KEY)).not.toContain(state.store.selected!.base64)
  })
  it('preserves newer non-reference edits while uploading and requires later save approval', async () => {
    const state = setup(), wait = deferred<AiReferenceUploadReceipt>(); await select(state.store)
    state.provider.uploadReference = vi.fn(() => wait.promise); const pending = send(state)
    state.editor.draft!.style.description = 'newer draft'; state.editor.setConfirmed(true)
    expect(state.editor.canSave).toBe(false); expect(state.editor.confirmed).toBe(false)
    wait.resolve(receiptFor(state.store.selected!.sha256)); expect(await pending).toBe(true)
    expect(state.editor.draft!.style.description).toBe('newer draft'); expect(state.store.receiptAttached).toBe(true)
  })
  it('keeps a successful receipt if references changed, then explicitly appends without repeating HTTP', async () => {
    const state = setup(), wait = deferred<AiReferenceUploadReceipt>(); await select(state.store)
    state.provider.uploadReference = vi.fn(() => wait.promise); const pending = send(state)
    state.editor.draft!.style.references.push('art/reference/another.png')
    wait.resolve(receiptFor(state.store.selected!.sha256)); expect(await pending).toBe(true)
    expect(state.store.phase).toBe('received'); expect(state.store.receiptAttached).toBe(false); expect(state.store.canAttachReceipt).toBe(true)
    expect(state.store.appendRetainedReceipt(false)).toBe(false); expect(state.store.appendRetainedReceipt(true)).toBe(true)
    expect(state.provider.uploadReference).toHaveBeenCalledTimes(1); expect(state.writer.saveConfig).not.toHaveBeenCalled()
  })
  it('keeps the lease through close and late response, never attaches into a reopened or different draft', async () => {
    const state = setup(), wait = deferred<AiReferenceUploadReceipt>(); await select(state.store); const hash = state.store.selected!.sha256
    state.provider.uploadReference = vi.fn(() => wait.promise); const pending = send(state)
    expect(state.editor.close()).toBe(false); expect(state.editor.close(true)).toBe(true)
    expect(state.editor.referenceUploadActive).toBe(true); expect(state.editor.open(context, resourceView(), state.reader, state.writer)).toBe(false)
    state.store.clearSelection(); wait.resolve(receiptFor(hash)); expect(await pending).toBe(true)
    expect(state.store.receiptProject).toEqual(context.project); expect(state.store.receiptAttached).toBe(false); expect(state.editor.draft).toBeNull()
    expect(state.editor.referenceUploadActive).toBe(false); expect(state.editor.open(context, resourceView(), state.reader, state.writer)).toBe(true)
    expect(state.store.bind(context, state.reader, state.writer, state.provider)).toBe(true); expect(state.store.canAttachReceipt).toBe(true)
    expect(state.store.appendRetainedReceipt(true)).toBe(true)
  })
  it('does not lose an unattached receipt or allow a replacement upload after clearing selection', async () => {
    const state = setup(), wait = deferred<AiReferenceUploadReceipt>(); await select(state.store)
    state.provider.uploadReference = vi.fn(() => wait.promise); const pending = send(state)
    state.store.leave(); wait.resolve(receiptFor(state.store.selected!.sha256)); await pending
    const previous = state.store.receipt; state.store.bind(context, state.reader, state.writer, state.provider); state.store.clearSelection()
    expect(state.store.receipt).toEqual(previous); expect(state.store.receiptProject).toEqual(context.project); expect(state.store.receiptAttached).toBe(false)
  })
  it.each(['not-sent', 'rejected', 'unknown'] as const)('clears only definitive %s outcomes and never retries automatically', async outcome => {
    const state = setup(); await select(state.store)
    state.provider.uploadReference = vi.fn(async () => { throw new AiReferenceUploadError(outcome === 'not-sent' ? 'busy' : outcome === 'rejected' ? 'forbidden' : 'timeout', outcome) })
    expect(await send(state)).toBe(false); expect(state.store.phase).toBe(outcome)
    expect(JSON.parse(state.values.get(AI_REFERENCE_UPLOAD_FENCE_KEY)!)).toHaveLength(outcome === 'unknown' ? 1 : 0)
    expect(await state.store.upload(context, state.reader, state.writer, state.provider)).toBe(false); expect(state.provider.uploadReference).toHaveBeenCalledTimes(1)
  })
  it.each(['bad-sha', 'bad-path', 'extra-key', 'wrong-dimensions', 'raw-error'] as const)('treats %s as unknown even after a nominal success', async kind => {
    const state = setup(); await select(state.store)
    state.provider.uploadReference = vi.fn(async () => {
      const value = receiptFor(state.store.selected!.sha256)
      if (kind === 'bad-sha') value.originalSha256 = 'e'.repeat(64)
      if (kind === 'bad-path') value.relativePath = '../outside.png'
      if (kind === 'wrong-dimensions') value.width = 1
      if (kind === 'extra-key') return { ...value, secret: 'raw' }
      if (kind === 'raw-error') throw Error('secret response body')
      return value
    })
    expect(await send(state)).toBe(false); expect(state.store.phase).toBe('unknown'); expect(state.store.receipt).toBeNull(); expect(state.store.error).not.toContain('secret')
    expect(state.editor.draft!.style.references).toEqual(['art/reference/a.png'])
  })
  it('restores unknown fences after reload and does not expose a fence-clearing bypass', async () => {
    const first = setup(); await select(first.store); first.provider.uploadReference = vi.fn(async () => { throw new AiReferenceUploadError('timeout', 'unknown') }); await send(first)
    setActivePinia(createPinia()); const next = setup(first.storage); await select(next.store)
    expect(next.store.phase).toBe('unknown'); next.store.clearSelection(); await select(next.store); expect(next.store.phase).toBe('unknown')
    next.store.setConfirmed(true); expect(next.store.canUpload).toBe(false); expect(next.provider.uploadReference).not.toHaveBeenCalled()
  })
  it('restores successful receipt for manual recovery after reload and permanently prevents duplicate upload', async () => {
    const first = setup(); await select(first.store); expect(await send(first)).toBe(true)
    setActivePinia(createPinia()); const next = setup(first.storage)
    expect(next.store.receipt?.originalSha256).toBe(first.store.receipt!.originalSha256); expect(next.store.receiptProject).toEqual(context.project)
    expect(next.store.canAttachReceipt).toBe(false); expect(next.store.recoveryMessage).toContain('手动')
    await select(next.store); next.store.setConfirmed(true); expect(next.store.canUpload).toBe(false)
    next.editor.draft!.style.references.push(next.store.receipt!.relativePath); expect(next.store.receiptAttached).toBe(true)
    expect(next.provider.uploadReference).not.toHaveBeenCalled()
  })
  it.each(['unavailable', 'get-throws', 'set-throws', 'lost-write', 'corrupt', 'duplicate', 'extra-key', 'oversized'] as const)('fails closed for %s storage', async kind => {
    const good = storageFixture()
    let storage: AiEditorFenceStorage | null = good.storage
    if (kind === 'unavailable') storage = null
    if (kind === 'get-throws') storage = { getItem: () => { throw Error('secret') }, setItem: () => {} }
    if (kind === 'set-throws') storage = { getItem: () => null, setItem: () => { throw Error('secret') } }
    if (kind === 'lost-write') storage = { getItem: () => null, setItem: () => {} }
    if (kind === 'corrupt') good.values.set(AI_REFERENCE_UPLOAD_FENCE_KEY, '{')
    if (kind === 'oversized') good.values.set(AI_REFERENCE_UPLOAD_FENCE_KEY, ' '.repeat(262145))
    if (kind === 'duplicate' || kind === 'extra-key') {
      const record = { project: context.project, originalSha256: 'a'.repeat(64), mimeType: 'image/png', width: 16, height: 16, receipt: null }
      good.values.set(AI_REFERENCE_UPLOAD_FENCE_KEY, JSON.stringify(kind === 'duplicate' ? [record, record] : [{ ...record, unsafe: true }]))
    }
    const state = setup(storage ?? undefined)
    if (kind === 'unavailable') { vi.stubGlobal('sessionStorage', undefined); setActivePinia(createPinia()); const isolated = setup({ getItem: () => { throw Error('unavailable') }, setItem: () => {} }); await select(isolated.store); expect(await send(isolated)).toBe(false); expect(isolated.provider.uploadReference).not.toHaveBeenCalled(); return }
    await select(state.store); expect(await send(state)).toBe(false); expect(state.store.storageBlocked).toBe(true); expect(state.provider.uploadReference).not.toHaveBeenCalled(); expect(state.store.error).not.toContain('secret')
  })
  it('does not allow an upload to overlap a configuration save already preparing or running', async () => {
    const state = setup(), wait = deferred<AiResourceView>(); await select(state.store)
    state.editor.draft!.style.description = 'changed'; state.editor.setConfirmed(true); state.writer.saveConfig = vi.fn(() => wait.promise)
    const pending = state.editor.save(context, state.reader, state.writer); expect(await send(state)).toBe(false)
    await vi.waitFor(() => expect(state.writer.saveConfig).toHaveBeenCalledTimes(1)); expect(await send(state)).toBe(false)
    wait.resolve(resourceView()); await pending; expect(state.provider.uploadReference).not.toHaveBeenCalled()
  })
  it('limits references to four and refuses duplicate appending', async () => {
    const state = setup(); state.editor.draft!.style.references = ['art/reference/a.png', 'art/reference/b.png', 'art/reference/c.png', 'art/reference/d.png']
    await select(state.store); expect(await send(state)).toBe(false); expect(state.provider.uploadReference).not.toHaveBeenCalled()
  })
})


describe('transport settlement and receipt recovery regressions', () => {
  it('keeps the editor lease after a real adapter timeout until an abort-ignoring fetch settles', async () => {
    const state = setup(), wait = deferred<Response>()
    const provider = createAiReferenceUploadProvider({ fetch: vi.fn(() => wait.promise), timeoutMs: 10 })
    state.store.bind(context, state.reader, state.writer, provider); await select(state.store); state.store.setConfirmed(true)
    const pending = state.store.upload(context, state.reader, state.writer, provider)
    await vi.waitFor(() => expect(state.store.phase).toBe('unknown'))
    expect(state.store.busy).toBe(true); expect(state.editor.referenceUploadActive).toBe(true)
    state.editor.draft!.style.description = 'waiting'; state.editor.setConfirmed(true)
    await state.editor.save(context, state.reader, state.writer); expect(state.writer.saveConfig).not.toHaveBeenCalled()
    wait.resolve(new Response('{}', { headers: { 'content-type': 'application/json' } }))
    expect(await pending).toBe(false); expect(state.store.busy).toBe(false); expect(state.editor.referenceUploadActive).toBe(false)
    expect(state.store.phase).toBe('unknown'); expect(state.store.pendingFence).not.toBeNull()
  })
  it('fails closed if provider cannot attest actual settlement', async () => {
    const state = setup(); await select(state.store); state.provider.waitForIdle = vi.fn(async () => { throw Error('secret') })
    expect(await send(state)).toBe(true)
    expect(state.store.receipt).not.toBeNull(); expect(state.store.busy).toBe(true); expect(state.editor.referenceUploadActive).toBe(true)
    expect(state.store.storageBlocked).toBe(true); expect(state.store.error).not.toContain('secret'); expect(state.editor.canSave).toBe(false)
  })
  it('recomputes actual membership after deleting an uploaded reference and supports explicit recovery', async () => {
    const state = setup(); await select(state.store); expect(await send(state)).toBe(true)
    const path = state.store.receipt!.relativePath
    state.editor.draft!.style.references = state.editor.draft!.style.references.filter(item => item !== path)
    expect(state.store.receiptAttached).toBe(false); expect(state.store.canAttachReceipt).toBe(true)
    expect(state.store.phase).toBe('received'); expect(state.store.error).not.toContain('参考图已附入当前配置草稿'); expect(state.store.error).toContain('配置规范尚未保存')
    expect(state.store.appendRetainedReceipt(true)).toBe(true); expect(state.provider.uploadReference).toHaveBeenCalledTimes(1)
  })
  it('does not claim attachment after discarding the draft then reopening the original project', async () => {
    const state = setup(); await select(state.store); expect(await send(state)).toBe(true); expect(state.editor.close(true)).toBe(true)
    expect(state.store.receiptAttached).toBe(false); expect(state.editor.open(context, resourceView(), state.reader, state.writer)).toBe(true)
    state.store.bind(context, state.reader, state.writer, state.provider)
    expect(state.store.receiptAttached).toBe(false); expect(state.store.canAttachReceipt).toBe(true)
    expect(state.store.appendRetainedReceipt(true)).toBe(true); expect(state.writer.saveConfig).not.toHaveBeenCalled()
  })
  it('allows reference-first preparation of an incomplete new configuration, while save stays invalid', async () => {
    const state = setup(); expect(state.editor.close(true)).toBe(true)
    const view = resourceView(); view.state = 'missing'; view.config = null; view.hash = null; view.version = null
    view.draft.iconSize = { width: 0, height: 0 }; view.draft.style = { description: '', references: [] }; view.draft.destination.exportDirectory = 'art/final/companion'
    expect(state.editor.open(context, view, state.reader, state.writer)).toBe(true); state.store.bind(context, state.reader, state.writer, state.provider)
    await select(state.store); expect(state.editor.errors.length).toBeGreaterThan(0); expect(await send(state)).toBe(true)
    expect(state.editor.draft!.style.references).toContain(state.store.receipt!.relativePath); state.editor.setConfirmed(true); expect(state.editor.canSave).toBe(false)
  })
})


describe('receipt durability and ledger budgets', () => {
  it('preserves a known successful receipt when recording that success fails, without claiming config persistence', async () => {
    const state = setup(); await select(state.store)
    const originalSet = state.storage.setItem
    state.storage.setItem = vi.fn((key, value) => {
      if (key === AI_REFERENCE_UPLOAD_FENCE_KEY && JSON.parse(value)[0]?.receipt) throw Error('storage full')
      originalSet(key, value)
    })
    expect(await send(state)).toBe(true); expect(state.store.storageBlocked).toBe(true)
    expect(state.store.receipt).not.toBeNull(); expect(state.store.phase).toBe('attached'); expect(state.store.receiptAttached).toBe(true)
    expect(state.writer.saveConfig).not.toHaveBeenCalled(); expect(state.editor.base!.config!.style.references).toEqual(['art/reference/a.png'])
    expect(JSON.parse(state.values.get(AI_REFERENCE_UPLOAD_FENCE_KEY)!)[0].receipt).toBeNull()
    state.store.clearSelection(); await select(state.store)
    expect(state.store.phase).toBe('received'); expect(state.store.receipt).not.toBeNull(); state.store.setConfirmed(true); expect(state.store.canUpload).toBe(false)
  })
  it('refuses a 33rd durable fence without evicting existing unresolved work', async () => {
    const durable = storageFixture()
    const entries = Array.from({ length: 32 }, (_, index) => ({ project: context.project, originalSha256: index.toString(16).padStart(64, '0'), mimeType: 'image/png', width: 16, height: 16, receipt: null }))
    durable.values.set(AI_REFERENCE_UPLOAD_FENCE_KEY, JSON.stringify(entries))
    const state = setup(durable.storage); await select(state.store); expect(await send(state)).toBe(false)
    expect(state.provider.uploadReference).not.toHaveBeenCalled(); expect(state.store.storageBlocked).toBe(true)
    expect(JSON.parse(durable.values.get(AI_REFERENCE_UPLOAD_FENCE_KEY)!)).toHaveLength(32); expect(state.editor.referenceUploadActive).toBe(false)
  })
  it('revokes local selection on malformed immutable draft identity, while an incomplete editable style is permitted', async () => {
    const state = setup(); await select(state.store); state.editor.draft!.version = 4
    state.store.setConfirmed(true); expect(state.store.canUpload).toBe(false)
    expect(await send(state)).toBe(false); expect(state.provider.uploadReference).not.toHaveBeenCalled()
  })
})
