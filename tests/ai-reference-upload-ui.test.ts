import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import AiResourceConfigDialog from '../src/components/AiResourceConfigDialog.vue'
import { useAiResourceEditorStore, type AiEditorContext } from '../src/stores/ai-resource-editor'
import { useAiReferenceUploadStore } from '../src/stores/ai-reference-upload'
import { AiReferenceUploadError, sha256ReferenceBytes, type AiReferenceUploadProvider, type AiReferenceUploadReceipt } from '../src/domain/ai-reference-upload'
import type { AiResourceReadProvider } from '../src/domain/ai-resource-read'
import type { AiResourceSaveProvider } from '../src/domain/ai-resource-save'
import { aiReferenceUploadProvider, registerAiReferenceUploadProvider } from '../src/ai-reference-upload-integration'
import { isCompanionConfigEditHost } from '../src/ai-resource-save-integration'
import { resourceView } from './fixtures/ai-resource-read'
import { pngBytes, testCrypto } from './fixtures/generation-png'
let wrapper: VueWrapper | undefined
const id = '0123456789abcdef', context: AiEditorContext = { project: { id, name: '参考素材工程', path: '/fixture/reference-game' }, source: {} }
const norm = 'b'.repeat(64), drawImage = vi.fn(), closeBitmap = vi.fn()
const button = (text: string) => wrapper!.findAll('button').find(value => value.text().includes(text))!
const panel = () => wrapper!.get('[aria-label="原工程参考图上传"]')
function localImage(width = 16) {
  const bytes = pngBytes(width), file = new File([bytes], `reference-${width}.png`, { type: 'image/png' })
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.slice().buffer })
  return file
}
async function receipt(base64: string): Promise<AiReferenceUploadReceipt> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0)), sha = await sha256ReferenceBytes(bytes)
  return { schemaVersion: 'companion-icons-v1', relativePath: `art/reference/companion/${norm}.png`, sha256: norm, width: 16, height: 16, mimeType: 'image/png', originalRelativePath: `art/reference/companion/original/${sha}.png`, originalSha256: sha }
}
async function setup(options: { readonly?: boolean; provider?: AiReferenceUploadProvider } = {}) {
  const pinia = createPinia(), editor = useAiResourceEditorStore(pinia), upload = useAiReferenceUploadStore(pinia)
  const reader: AiResourceReadProvider = { label: 'fake read', readConfig: vi.fn(async () => resourceView()), previewReference: vi.fn(async () => { throw Error('unused') }) }
  const writer: AiResourceSaveProvider = { label: 'fake save', saveConfig: vi.fn(async () => { throw Error('not expected') }) }
  const provider: AiReferenceUploadProvider = options.provider ?? { label: 'fake upload', waitForIdle: async () => {}, uploadReference: vi.fn(async (_id, input) => receipt(input.base64)) }
  const memory = new Map<string, string>(), storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value) } }
  editor.setFenceStorage(storage); upload.setFenceStorage(storage)
  if (!options.readonly) registerAiReferenceUploadProvider(provider)
  wrapper = mount(AiResourceConfigDialog, { props: { context, resource: resourceView(), reader, writer: options.readonly ? null : writer }, global: { plugins: [pinia, ElementPlus] } })
  ;(wrapper.vm as unknown as { open(): void }).open(); await flushPromises()
  return { editor, upload, reader, writer, provider, memory }
}
async function choose(file = localImage(), wait = true) {
  const input = panel().get('input[type="file"]'); Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change'); await flushPromises()
  if (wait) { await vi.waitFor(() => expect(useAiReferenceUploadStore().phase).not.toBe('preparing')); await flushPromises() }
}
async function approve() { await panel().get('[aria-label="确认本次参考图上传"] input').setValue(true); await flushPromises() }
beforeEach(() => {
  vi.stubGlobal('crypto', testCrypto); vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 16, height: 16, close: closeBitmap })))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage }) as unknown as CanvasRenderingContext2D)
  aiReferenceUploadProvider.value = null; drawImage.mockClear(); closeBitmap.mockClear()
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; aiReferenceUploadProvider.value = null; vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear() })
describe('reference upload uses local canvas and original separate approvals', () => {
  it('previews locally in a readonly build with no remote image URL or request and discloses retained original metadata', async () => {
    const { upload, reader } = await setup({ readonly: true }); await choose()
    expect(drawImage).toHaveBeenCalledOnce(); expect(closeBitmap).toHaveBeenCalledOnce(); expect(panel().find('canvas').exists()).toBe(true)
    expect(panel().findAll('img')).toHaveLength(0); expect(panel().text()).toContain('EXIF'); expect(panel().text()).toContain('不会清除保留原图中的信息')
    expect(button('确认上传本张参考图').attributes('disabled')).toBeDefined(); expect(upload.confirmed).toBe(false)
    expect(reader.readConfig).not.toHaveBeenCalled(); expect(globalThis.fetch).not.toHaveBeenCalled()
  })
  it('requires separate confirmation and adds a valid receipt only to the existing configuration draft', async () => {
    const { editor, upload, provider, writer, memory } = await setup(); await choose()
    expect(button('确认上传本张参考图').attributes('disabled')).toBeDefined(); await approve(); expect(upload.confirmed).toBe(true)
    await button('确认上传本张参考图').trigger('click'); await vi.waitFor(() => expect(upload.receipt).not.toBeNull())
    expect(provider.uploadReference).toHaveBeenCalledOnce(); expect(editor.draft!.style.references).toContain(`art/reference/companion/${norm}.png`)
    expect(editor.base!.config!.style.references).toEqual(['art/reference/a.png']); expect(editor.confirmed).toBe(false)
    expect(writer.saveConfig).not.toHaveBeenCalled(); expect(panel().text()).toContain('项目配置尚未因此保存')
    expect([...memory.values()].join('')).not.toContain('iVBOR'); expect(globalThis.fetch).not.toHaveBeenCalled()
  })
  it('removing an uploaded reference updates its actual membership and requires explicit reattachment', async () => {
    const { editor, upload } = await setup(); await choose(); await approve(); await button('确认上传本张参考图').trigger('click')
    await vi.waitFor(() => expect(upload.receiptAttached && !upload.busy).toBe(true))
    await wrapper!.get('textarea[aria-label="规范参考路径"]').setValue('art/reference/a.png'); await flushPromises()
    expect(upload.receiptAttached).toBe(false); expect(panel().text()).not.toContain('参考路径已加入本弹窗草稿')
    expect(button('只加入配置草稿').attributes('disabled')).toBeDefined()
    await panel().get('[aria-label="确认将回执引用加入草稿"] input').setValue(true); await button('只加入配置草稿').trigger('click')
    expect(editor.draft!.style.references).toContain(`art/reference/companion/${norm}.png`); expect(editor.confirmed).toBe(false)
  })
  it('discarding and reopening the form preserves the receipt without claiming its path is still in the new draft', async () => {
    const { editor, upload, provider } = await setup(); await choose(); await approve(); await button('确认上传本张参考图').trigger('click')
    await vi.waitFor(() => expect(upload.receiptAttached && !upload.busy).toBe(true)); editor.close(true); await flushPromises()
    ;(wrapper!.vm as unknown as { open(): void }).open(); await flushPromises()
    expect(editor.draft!.style.references).toEqual(['art/reference/a.png']); expect(upload.receipt).not.toBeNull(); expect(upload.receiptAttached).toBe(false)
    expect(panel().text()).not.toContain('参考路径已加入本弹窗草稿'); expect(button('只加入配置草稿').attributes('disabled')).toBeDefined(); expect(provider.uploadReference).toHaveBeenCalledOnce()
  })
  it('changing the selected file or any draft field withdraws upload approval', async () => {
    const { editor, upload } = await setup(); await choose(); await approve(); editor.draft!.style.description = '更新风格'; expect(upload.confirmed).toBe(false)
    await approve(); await choose(); expect(upload.confirmed).toBe(false); expect(button('确认上传本张参考图').attributes('disabled')).toBeDefined()
  })
  it('a failed bitmap decode removes the prior preview and leaves no uploadable selection', async () => {
    const { upload, provider } = await setup(); await choose(); await approve()
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error('private decoder detail')); await choose()
    expect(upload.selected).toBeNull(); expect(panel().find('canvas').exists()).toBe(false); expect(upload.confirmed).toBe(false)
    expect(button('确认上传本张参考图').attributes('disabled')).toBeDefined(); expect(provider.uploadReference).not.toHaveBeenCalled(); expect(wrapper!.text()).not.toContain('private decoder detail')
  })
  it('requires actual canvas capability before the UI permits uploading', async () => {
    const { upload, provider } = await setup(); vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null); await choose()
    expect(upload.selected).toBeNull(); expect(panel().text()).toContain('Canvas 预览'); expect(provider.uploadReference).not.toHaveBeenCalled(); expect(closeBitmap).toHaveBeenCalledOnce()
  })
  it('does not fall back to external or data URLs when bitmap support is missing', async () => {
    const { upload } = await setup(); vi.stubGlobal('createImageBitmap', undefined); await choose()
    expect(upload.selected).toBeNull(); expect(panel().findAll('img')).toHaveLength(0); expect(globalThis.fetch).not.toHaveBeenCalled(); expect(panel().text()).toContain('禁止上传')
  })
  it('closing during decode rejects its late preview and closes the bitmap', async () => {
    const { editor, upload, provider } = await setup(); let resolve!: (value: ImageBitmap) => void
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise<ImageBitmap>(done => { resolve = done })))
    await choose(localImage(), false); editor.close(true); await flushPromises(); resolve({ width: 16, height: 16, close: closeBitmap } as ImageBitmap); await flushPromises()
    expect(closeBitmap).toHaveBeenCalledOnce(); expect(upload.selected).toBeNull(); expect(upload.confirmed).toBe(false); expect(provider.uploadReference).not.toHaveBeenCalled()
  })
  it('withdraws authority when upload provider is removed after a local preview', async () => {
    const { upload, provider } = await setup(); await choose(); await approve(); aiReferenceUploadProvider.value = null; await flushPromises()
    expect(upload.confirmed).toBe(false); expect(button('确认上传本张参考图').attributes('disabled')).toBeDefined(); expect(provider.uploadReference).not.toHaveBeenCalled()
  })
  it('keeps an unknown receipt fenced and cannot resend the same original after reselecting it', async () => {
    const provider: AiReferenceUploadProvider = { label: 'fake unknown', waitForIdle: async () => {}, uploadReference: vi.fn(async () => { throw new AiReferenceUploadError('timeout', 'unknown') }) }
    const { upload } = await setup({ provider }); await choose(); await approve(); await button('确认上传本张参考图').trigger('click')
    await vi.waitFor(() => expect(upload.phase).toBe('unknown')); expect(panel().text()).toContain('可能已经写入')
    await vi.waitFor(() => expect(upload.busy).toBe(false)); await choose(); await approve(); expect(button('确认上传本张参考图').attributes('disabled')).toBeDefined(); expect(provider.uploadReference).toHaveBeenCalledOnce()
  })
  it('blocks configuration saving while an upload is unresolved', async () => {
    let resolve!: (value: AiReferenceUploadReceipt) => void, input = ''
    const provider: AiReferenceUploadProvider = { label: 'fake pending', waitForIdle: async () => {}, uploadReference: vi.fn((_id, value) => { input = value.base64; return new Promise<AiReferenceUploadReceipt>(done => { resolve = done }) }) }
    const { editor, upload, writer } = await setup({ provider }); await choose(); await approve(); await button('确认上传本张参考图').trigger('click')
    await vi.waitFor(() => expect(provider.uploadReference).toHaveBeenCalledOnce()); expect(button('确认保存到工程').attributes('disabled')).toBeDefined()
    editor.setConfirmed(true); expect(editor.canSave).toBe(false); expect(writer.saveConfig).not.toHaveBeenCalled()
    resolve(await receipt(input)); await vi.waitFor(() => expect(upload.busy).toBe(false))
  })
  it('refuses a fifth reference without uploading or silently dropping an existing path', async () => {
    const { editor, upload, provider } = await setup(); editor.draft!.style.references = ['a','b','c','d'].map(s => `art/reference/${s}.png`); await choose(); await approve()
    expect(upload.canUpload).toBe(false); expect(button('确认上传本张参考图').attributes('disabled')).toBeDefined(); expect(editor.draft!.style.references).toHaveLength(4); expect(provider.uploadReference).not.toHaveBeenCalled()
  })
  it('clearing a local selection never uploads or clears an already persisted operation record', async () => {
    const { upload, provider } = await setup(); await choose(); await approve(); await button('清除本地选择').trigger('click')
    expect(upload.selected).toBeNull(); expect(upload.confirmed).toBe(false); expect(panel().find('canvas').exists()).toBe(false); expect(provider.uploadReference).not.toHaveBeenCalled()
  })
})
describe('upload registration retains the separate edit-build boundary', () => {
  it.each(['production', 'companion-readonly', 'development', 'test'])('does not allow edit capability on %s', mode => expect(isCompanionConfigEditHost(mode, { protocol: 'http:', hostname: '127.0.0.1' })).toBe(false))
  it('registration is passive and does not send a request or approve a selected image', () => { const provider: AiReferenceUploadProvider = { label: 'fake', waitForIdle: async () => {}, uploadReference: vi.fn() }; registerAiReferenceUploadProvider(provider); expect(provider.uploadReference).not.toHaveBeenCalled() })
})
