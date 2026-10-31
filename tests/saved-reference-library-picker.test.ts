// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import SavedReferenceLibraryPicker from '../src/components/SavedReferenceLibraryPicker.vue'
import type { AiReferencePreview, AiResourceReadProvider } from '../src/domain/ai-resource-read'
import type { SavedReferenceLibraryEntry, SavedReferenceLibraryIdentity, SavedReferenceLibrarySelection } from '../src/adapters/saved-reference-library'
import type { WorkbenchReference, WorkbenchReferenceScope } from '../src/domain/art-workbench'
import { deferred, image, library, reader, reference, target, testCrypto } from './fixtures/saved-reference-library'

let wrapper: ReturnType<typeof mount> | undefined, png: AiReferencePreview
beforeEach(async () => { png = await image(); vi.stubGlobal('crypto', testCrypto) })
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals() })
type Props = { identity: SavedReferenceLibraryIdentity | null; entries: readonly SavedReferenceLibraryEntry[]; target: WorkbenchReferenceScope | null; existingReferences: readonly WorkbenchReference[]; reader: AiResourceReadProvider | null; disabled: boolean; active: boolean; maxReferences: number }
function render(overrides: Partial<Props> = {}) {
  const saved = library([reference(png.sha256)]), api = reader(png)
  wrapper = mount(SavedReferenceLibraryPicker, { props: { identity: saved.identity, entries: saved.entries, target: target(), existingReferences: [], reader: api, disabled: false, active: true, maxReferences: 4, ...overrides } })
  return { saved, api }
}
async function clickPreview(index = 0) { await wrapper!.findAll('[data-testid="saved-library-preview"]')[index]!.trigger('click'); await flushPromises() }
async function readyPreview(index = 0) { await clickPreview(index); await vi.waitFor(() => expect(wrapper!.find('[data-testid="saved-library-image"]').exists()).toBe(true)) }
async function loaded(width = 16, height = 16) { const element = wrapper!.get('[data-testid="saved-library-image"]'); Object.defineProperties(element.element, { naturalWidth: { configurable: true, value: width }, naturalHeight: { configurable: true, value: height } }); await element.trigger('load') }

describe('passive saved-reference library picker', () => {
  it('shows only the supplied saved list and makes no list/config/preview request on mount or search', async () => {
    const { api } = render(); expect(wrapper!.findAll('[data-testid="saved-library-entry"]')).toHaveLength(1)
    await wrapper!.get('[data-testid="saved-library-query"]').setValue('no-match')
    expect(wrapper!.findAll('[data-testid="saved-library-entry"]')).toHaveLength(0); expect(wrapper!.text()).toContain('没有匹配的已保存引用')
    expect(api.previewReference).not.toHaveBeenCalled(); expect(api.readConfig).not.toHaveBeenCalled(); expect(wrapper!.emitted('select')).toBeUndefined()
  })
  it('distinguishes empty saved data from missing identity or reader without fixtures/fallbacks', () => {
    const empty = library([]); render({ identity: empty.identity, entries: empty.entries, reader: null })
    expect(wrapper!.find('[data-testid="saved-library-empty"]').exists()).toBe(true); expect(wrapper!.text()).toContain('预览未接通'); expect(wrapper!.find('img').exists()).toBe(false)
    wrapper!.unmount(); render({ identity: null, entries: [] }); expect(wrapper!.text()).toContain('尚无已核对的保存账本'); expect(wrapper!.findAll('[data-testid="saved-library-entry"]')).toHaveLength(0)
  })
  it('requires pinned byte verification and actual image load before emitting the original reference', async () => {
    const { api, saved } = render(); await readyPreview()
    expect(api.previewReference).toHaveBeenCalledWith(saved.identity!.projectId, saved.entries[0]!.reference.relativePath, expect.any(AbortSignal))
    expect(wrapper!.get('[data-testid="saved-library-image"]').attributes('src')).toBe('data:image/png;base64,' + png.base64)
    expect(wrapper!.get('[data-testid="saved-library-select"]').attributes('disabled')).toBeDefined()
    await loaded(); await wrapper!.get('[data-testid="saved-library-select"]').trigger('click')
    const event = wrapper!.emitted('select')![0]![0] as SavedReferenceLibrarySelection
    expect(event.reference).toEqual(saved.entries[0]!.reference); expect(event.identity.source).toBe(saved.identity!.source); expect(event.identity.workbenchHash).toBe(saved.identity!.workbenchHash)
    expect(event.target).toEqual(target()); expect(event.preview).toMatchObject({ sha256: png.sha256, displayed: true })
    expect((wrapper!.props() as Props).existingReferences).toEqual([]); expect(wrapper!.text()).toContain('尚未确认草稿关联，未保存')
    await wrapper!.get('[data-testid="saved-library-select"]').trigger('click'); expect(wrapper!.emitted('select')).toHaveLength(1)
    expect(api.readConfig).not.toHaveBeenCalled()
  })
  it('never swaps a differing normalized PNG digest into the saved original-file hash', async () => {
    const original = { ...reference('f'.repeat(64)), relativePath: 'art/reference/original-photo.jpg' }, saved = library([original]), api = reader(png)
    render({ identity: saved.identity, entries: saved.entries, reader: api }); await clickPreview()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('规范化预览摘要与已保存原文件摘要不同'))
    expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.get('[data-testid="saved-library-select"]').attributes('disabled')).toBeDefined()
    expect((wrapper!.props() as Props).entries[0]!.reference).toEqual(original)
    expect(wrapper!.text()).toContain(original.sha256); expect(wrapper!.emitted('select')).toBeUndefined()
  })
  it('does not trust matching hash metadata when the preview bytes themselves fail verification', async () => {
    const original = reference('f'.repeat(64)), saved = library([original]), api = reader({ ...png, sha256: original.sha256 })
    render({ identity: saved.identity, entries: saved.entries, reader: api }); await clickPreview()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('预览未完成字节校验'))
    expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.emitted('select')).toBeUndefined()
    expect(saved.entries[0]!.reference.sha256).toBe(original.sha256)
  })
  it('withdraws readiness after render errors or wrong natural dimensions', async () => {
    render(); await readyPreview(); await loaded(); await wrapper!.get('[data-testid="saved-library-image"]').trigger('error')
    expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.get('[data-testid="saved-library-select"]').attributes('disabled')).toBeDefined()
    await readyPreview(); await loaded(32, 16); expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.emitted('select')).toBeUndefined()
  })
  it('keeps common and gameplay lists separate and never infers ownership from file paths', async () => {
    const shared = library([reference(png.sha256)], 'shared'), api = reader(png)
    render({ identity: shared.identity, entries: shared.entries, target: target('ant'), reader: api })
    expect(wrapper!.text()).toContain('不能跨域关联'); expect(wrapper!.findAll('[data-testid="saved-library-preview"]')[0]!.attributes('disabled')).toBeDefined()
    await clickPreview(); expect(api.previewReference).not.toHaveBeenCalled()
    await wrapper!.setProps({ target: target('shared') }); await readyPreview(); await loaded()
    await wrapper!.setProps({ target: target('cook') }); expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.emitted('select')).toBeUndefined()
  })
  it('ignores a late preview after the source identity changes even when serialized metadata is identical', async () => {
    const saved = library([reference(png.sha256)]), api = reader(png), late = deferred<AiReferencePreview>()
    const bytes = Uint8Array.from(png.sha256.match(/../g)!.map(value => parseInt(value, 16))).buffer
    vi.stubGlobal('crypto', { subtle: { digest: vi.fn(async () => bytes) } })
    api.previewReference.mockImplementationOnce(() => late.promise)
    render({ identity: saved.identity, entries: saved.entries, reader: api }); await clickPreview()
    await wrapper!.setProps({ identity: { ...saved.identity!, source: {} } }); late.resolve(png); await flushPromises()
    expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.emitted('select')).toBeUndefined()
  })
  it('invalidates a displayed selection on base hash, target or list-identity changes', async () => {
    const { saved } = render(); await readyPreview(); await loaded()
    await wrapper!.setProps({ identity: { ...saved.identity!, workbenchHash: 'b'.repeat(64) } }); expect(wrapper!.find('img').exists()).toBe(false)
    await readyPreview(); await loaded(); await wrapper!.setProps({ target: target(undefined, 'spec', 'new-target') }); expect(wrapper!.find('img').exists()).toBe(false)
    await readyPreview(); await loaded(); await wrapper!.setProps({ entries: [{ reference: reference(png.sha256), origins: ['refreshed list origin'] }] })
    expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.emitted('select')).toBeUndefined()
  })
  it.each(['disabled', 'inactive', 'full'] as const)('invalidates selection when the target becomes %s', async state => {
    render(); await readyPreview(); await loaded()
    await wrapper!.setProps(state === 'disabled' ? { disabled: true } : state === 'inactive' ? { active: false } : { existingReferences: ['b', 'c', 'd', 'e'].map(letter => reference(letter.repeat(64))) })
    expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.find('[data-testid="saved-library-select"]').exists()).toBe(false); expect(wrapper!.emitted('select')).toBeUndefined()
  })
  it('prevents duplicate SHA selection, preserves conflicting path/hash entries and obeys four slots', async () => {
    const saved = library([reference(png.sha256), reference('f'.repeat(64), 'Conflicting claim')]), api = reader(png)
    render({ identity: saved.identity, entries: saved.entries, reader: api, existingReferences: [{ ...reference(png.sha256), relativePath: 'assets/duplicate-bytes.png' }] })
    expect(wrapper!.findAll('[data-testid="saved-library-entry"]')).toHaveLength(2); expect(wrapper!.text()).toContain('同路径有不同保存摘要')
    expect(wrapper!.findAll('[data-testid="saved-library-preview"]')[0]!.attributes('disabled')).toBeDefined(); await clickPreview(0); expect(api.previewReference).not.toHaveBeenCalled()
  })
  it('shows a parent-confirmed draft association without claiming persistence or uploading', async () => {
    render(); await readyPreview(); await loaded(); await wrapper!.get('[data-testid="saved-library-select"]').trigger('click')
    const event = wrapper!.emitted('select')![0]![0] as SavedReferenceLibrarySelection
    await wrapper!.setProps({ existingReferences: [event.reference] })
    expect(wrapper!.text()).toContain('当前草稿参考：1 / 4'); expect(wrapper!.text()).toContain('已在当前草稿关联相同摘要')
    expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.emitted('select')).toHaveLength(1)
  })
  it('stays disabled by default and does not expose raw provider failures', async () => {
    const saved = library([reference(png.sha256)]), api = reader(png)
    wrapper = mount(SavedReferenceLibraryPicker, { props: { identity: saved.identity, entries: saved.entries, target: target(), existingReferences: [], reader: api } })
    await clickPreview(); expect(api.previewReference).not.toHaveBeenCalled()
    api.previewReference.mockRejectedValueOnce(Error('PRIVATE DIAGNOSTIC')); await wrapper.setProps({ disabled: false }); await clickPreview()
    await vi.waitFor(() => expect(wrapper!.text()).toContain('预览未完成字节校验')); expect(wrapper!.text()).not.toContain('PRIVATE DIAGNOSTIC')
  })
})
