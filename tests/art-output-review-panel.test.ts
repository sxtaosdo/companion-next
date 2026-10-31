// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ArtOutputReviewPanel from '../src/components/ArtOutputReviewPanel.vue'
import { ArtOutputReviewError, type ArtOutputReviewOperation } from '../src/adapters/art-output-review'
import { appendArtOutputVersion } from '../src/domain/art-output-history'
import { committedReview, context, deferred, job, need, observation, provider, scope, snapshot, storage } from './fixtures/art-output-review'

let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => { let id = 0; vi.stubGlobal('crypto', { randomUUID: () => '12345678-1234-4123-8123-' + (++id).toString(16).padStart(12, '0') }) })
afterEach(() => { wrapper?.unmount(); wrapper = undefined; vi.unstubAllGlobals() })
function render(api = provider(), memory: ReturnType<typeof storage> | null = storage()) { wrapper = mount(ArtOutputReviewPanel, { props: { provider: api, context, need: need(), job: job(), storage: memory } }); return { api, memory } }
async function click(id: string) { await wrapper!.get('[data-testid="' + id + '"]').trigger('click'); await flushPromises() }
async function selectAndPreview() { await click('review-read'); await wrapper!.get('[data-testid="review-version"]').setValue(snapshot().history!.versions[0]!.versionId); await click('review-preview-1') }
async function imageLoad(width = 1024) { const image = wrapper!.get('[data-testid="review-preview-image"]'); Object.defineProperties(image.element, { naturalWidth: { configurable: true, value: width }, naturalHeight: { configurable: true, value: 1024 } }); await image.trigger('load') }

describe('explicit real-API review panel (isolated provider fixtures)', () => {
  it('does not connect, preview or choose the newest version on mount', async () => {
    const { api } = render(); expect(api.read).not.toHaveBeenCalled(); expect(api.previewVersion).not.toHaveBeenCalled(); expect(wrapper!.find('img').exists()).toBe(false)
    await click('review-read'); expect((wrapper!.get('[data-testid="review-version"]').element as HTMLSelectElement).value).toBe('')
    expect(api.review).not.toHaveBeenCalled(); expect(api.registerOutput).not.toHaveBeenCalled()
  })
  it('shows an unavailable explicit provider instead of using a fixture/global fallback', () => {
    wrapper = mount(ArtOutputReviewPanel, { props: { context, need: need(), job: job(), provider: null } })
    expect(wrapper.text()).toContain('当前未接通审阅接口'); expect(wrapper.get('[data-testid="review-read"]').attributes('disabled')).toBeDefined()
  })
  it('requires verified provider bytes, a successful exact image load and manual approval before sending', async () => {
    const { api } = render(); await selectAndPreview()
    expect(wrapper!.get('[data-testid="review-confirm"]').attributes('disabled')).toBeDefined(); expect(api.review).not.toHaveBeenCalled()
    await imageLoad(); expect(wrapper!.get('[data-testid="review-accept"]').attributes('disabled')).toBeDefined()
    await wrapper!.get('[data-testid="review-confirm"]').setValue(true); await click('review-accept')
    expect(api.review).toHaveBeenCalledTimes(1)
    const request = api.review.mock.calls[0]![1]
    expect(request.command).toMatchObject({ decision: 'accepted', approved: true, observedJobRevision: 4 })
    expect(request.displayAcknowledgement).toMatchObject({ displayed: true, receiptId: '12345678-1234-4123-8123-123456789abc' })
    expect(wrapper!.get('.version-list').text()).toContain('视觉通过'); expect(wrapper!.text()).toContain('导入和运行验收状态另行核对')
  })
  it('does not show a passed version before its actual committed receipt arrives', async () => {
    const api = provider(), late = deferred<ArtOutputReviewOperation>(); api.review.mockImplementation(() => late.promise); render(api)
    await selectAndPreview(); await imageLoad(); await wrapper!.get('[data-testid="review-confirm"]').setValue(true); await wrapper!.get('[data-testid="review-accept"]').trigger('click'); await flushPromises()
    expect(wrapper!.get('.version-list').text()).toContain('尚未审阅'); expect(wrapper!.find('[data-testid="review-pending"]').exists()).toBe(true)
    late.resolve(committedReview(api.review.mock.calls[0]![1])); await flushPromises(); expect(wrapper!.get('.version-list').text()).toContain('视觉通过')
  })
  it('records a return with an optional blank note and never starts generation', async () => {
    const { api } = render(); await selectAndPreview(); await imageLoad(); await wrapper!.get('[data-testid="review-confirm"]').setValue(true); await click('review-return')
    expect(api.review.mock.calls[0]![1].command).toMatchObject({ decision: 'rework', comment: '' })
    expect(wrapper!.get('.version-list').text()).toContain('退回修改'); expect(api.registerOutput).not.toHaveBeenCalled()
  })
  it('withdraws approval when image display fails or dimensions do not match', async () => {
    const { api } = render(); await selectAndPreview(); await imageLoad(); await wrapper!.get('[data-testid="review-confirm"]').setValue(true)
    await wrapper!.get('[data-testid="review-preview-image"]').trigger('error')
    expect(wrapper!.get('[data-testid="review-accept"]').attributes('disabled')).toBeDefined(); expect(wrapper!.find('img').exists()).toBe(false)
    await click('review-preview-1'); await imageLoad(128); expect(wrapper!.get('[data-testid="review-confirm"]').attributes('disabled')).toBeDefined(); expect(api.review).not.toHaveBeenCalled()
  })
  it('keeps the previous snapshot stale after a failed refresh and prohibits writes', async () => {
    const { api } = render(); await selectAndPreview(); await imageLoad(); api.read.mockRejectedValueOnce(Error('PRIVATE TRANSPORT TEXT')); await click('review-read')
    expect(wrapper!.find('[data-testid="review-stale"]').exists()).toBe(true); expect(wrapper!.get('.version-list').text()).toContain('登记序号 #1')
    expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.get('[data-testid="review-accept"]').attributes('disabled')).toBeDefined(); expect(wrapper!.text()).not.toContain('PRIVATE TRANSPORT TEXT')
  })
  it('retains UNKNOWN across unmount/reopen and never treats not-observed as permission to resend', async () => {
    const api = provider(), memory = storage(); api.review.mockRejectedValueOnce(Error('network outcome unknown')); render(api, memory)
    await selectAndPreview(); await imageLoad(); await wrapper!.get('[data-testid="review-confirm"]').setValue(true); await click('review-accept')
    const originalId = api.review.mock.calls[0]![1].command.operationId; expect(wrapper!.get('[data-testid="review-pending"]').text()).toContain(originalId)
    wrapper!.unmount(); render(api, memory); expect(wrapper!.get('[data-testid="review-pending"]').text()).toContain(originalId)
    await click('review-lookup'); expect(api.lookup.mock.calls[0]![1].operationId).toBe(originalId)
    expect(wrapper!.find('[data-testid="review-pending"]').exists()).toBe(true); expect(api.review).toHaveBeenCalledTimes(1)
    api.lookup.mockRejectedValueOnce(new ArtOutputReviewError('AUTH_REQUIRED', 'rejected')); await click('review-lookup')
    expect(wrapper!.find('[data-testid="review-pending"]').exists()).toBe(true); expect(memory.values.size).toBe(1)
  })
  it('keeps a late committed response at the original need and requires explicit recovery', async () => {
    const api = provider(), memory = storage(), late = deferred<ArtOutputReviewOperation>(); api.review.mockImplementationOnce(() => late.promise); render(api, memory)
    await selectAndPreview(); await imageLoad(); await wrapper!.get('[data-testid="review-confirm"]').setValue(true); await wrapper!.get('[data-testid="review-accept"]').trigger('click'); await flushPromises()
    const sent = api.review.mock.calls[0]![1]
    await wrapper!.setProps({ need: { ...need(), id: 'other-need' } }); late.resolve(committedReview(sent)); await flushPromises()
    expect(wrapper!.find('.version-list').exists()).toBe(false); expect(wrapper!.find('[data-testid="review-pending"]').exists()).toBe(false)
    await wrapper!.setProps({ need: need() }); expect(wrapper!.get('[data-testid="review-pending"]').text()).toContain(sent.command.operationId)
    expect(wrapper!.get('[data-testid="review-pending"]').text()).toContain('晚到回执'); expect(wrapper!.find('.version-list').exists()).toBe(false)
    api.lookup.mockResolvedValueOnce(committedReview(sent)); await click('review-lookup')
    expect(wrapper!.find('[data-testid="review-pending"]').exists()).toBe(false); expect(wrapper!.get('.version-list').text()).toContain('视觉通过')
  })
  it('ignores a late preview after the provider/source boundary changes', async () => {
    const api = provider(), late = deferred<Awaited<ReturnType<typeof api.previewVersion>>>(); api.previewVersion.mockImplementationOnce(() => late.promise); render(api)
    await click('review-read'); await wrapper!.get('[data-testid="review-version"]').setValue(snapshot().history!.versions[0]!.versionId); await wrapper!.get('[data-testid="review-preview-1"]').trigger('click'); await flushPromises()
    const next = provider(); await wrapper!.setProps({ provider: next, context: { ...context, source: {} } }); late.resolve((await provider().previewVersion(context, { needId: scope.needId, versionId: '', sha256: '', history: snapshot().history! })))
    await flushPromises(); expect(wrapper!.find('img').exists()).toBe(false); expect(next.read).not.toHaveBeenCalled()
  })
  it('withdraws a displayed/approved preview when the observed job revision changes', async () => {
    const { api } = render(); await selectAndPreview(); await imageLoad(); await wrapper!.get('[data-testid="review-confirm"]').setValue(true)
    await wrapper!.setProps({ job: { ...job(), revision: 5 } })
    expect(wrapper!.find('img').exists()).toBe(false); expect(wrapper!.get('[data-testid="review-accept"]').attributes('disabled')).toBeDefined(); expect(wrapper!.find('[data-testid="review-stale"]').exists()).toBe(true); expect(api.review).not.toHaveBeenCalled()
  })
  it('requires explicit comparison choices and keeps unsupported historical previews empty', async () => {
    const first = snapshot(), second = observation('7'.repeat(64)), history = appendArtOutputVersion(first.history!, 1, { ...second, job: { ...second.job, jobId: 'STUDIO-RUN-second-b1c2d3e4', sourceRevision: 'b'.repeat(40) } })
    const value = { ...first, history, snapshot: { ...first.snapshot, currentSourceRevision: 'b'.repeat(40) } }, api = provider(value); render(api)
    await click('review-read'); expect(wrapper!.find('[data-testid="review-comparison"]').exists()).toBe(false)
    await wrapper!.get('[data-testid="review-left"]').setValue(history.versions[0]!.versionId); await wrapper!.get('[data-testid="review-right"]').setValue(history.versions[1]!.versionId)
    expect(wrapper!.find('[data-testid="review-comparison"]').exists()).toBe(false); await click('review-compare')
    expect(wrapper!.get('[data-testid="review-comparison"]').text()).toContain('左侧历史来源'); expect(wrapper!.get('[data-testid="review-preview-1"]').attributes('disabled')).toBeDefined()
    expect(wrapper!.find('img').exists()).toBe(false); expect(api.previewVersion).not.toHaveBeenCalled()
    expect(wrapper!.get('.version-list').text().match(/尚未审阅/g)).toHaveLength(2)
  })
  it('can read while local recovery storage is unavailable but sends no writes', async () => {
    const { api } = render(provider(), null); await click('review-read')
    expect(api.read).toHaveBeenCalledTimes(1); expect(wrapper!.text()).toContain('写入已禁用'); expect(wrapper!.get('[data-testid="review-register"]').attributes('disabled')).toBeDefined()
  })
  it('registers only an explicitly selected existing candidate with the register namespace', async () => {
    const value = snapshot('4'.repeat(64), true), { api } = render(provider(value)); await click('review-read')
    expect(api.registerOutput).not.toHaveBeenCalled(); expect(wrapper!.get('[data-testid="review-register"]').attributes('disabled')).toBeDefined()
    await wrapper!.get('[data-testid="review-candidate"]').setValue(observation().candidateId); await click('review-register')
    expect(api.registerOutput.mock.calls[0]![1]).toMatchObject({ expectedHistoryRevision: 0, observedJobRevision: 4, candidateId: observation().candidateId })
    expect(api.registerOutput.mock.calls[0]![1].operationId).toMatch(/^art-save-[a-f0-9]{32}$/); expect(api.review).not.toHaveBeenCalled()
  })
  it('does not invent success for a known pre-dispatch rejection', async () => {
    const { api } = render(); api.review.mockRejectedValueOnce(new ArtOutputReviewError('READ_ONLY', 'rejected')); await selectAndPreview(); await imageLoad(); await wrapper!.get('[data-testid="review-confirm"]').setValue(true); await click('review-accept')
    expect(wrapper!.get('.version-list').text()).toContain('尚未审阅'); expect(wrapper!.find('[data-testid="review-pending"]').exists()).toBe(false); expect(wrapper!.text()).toContain('未记作成功')
  })
})
