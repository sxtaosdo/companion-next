import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import { aiJobActionsProvider } from '../src/ai-job-actions-integration'
import type { AiJobActionsProvider } from '../src/domain/ai-job-actions'
import type { AiJobsProject } from '../src/stores/ai-jobs-read'
import * as jobsDomain from '../src/domain/ai-jobs-read'
import AiJobsReadPanel from '../src/components/AiJobsReadPanel.vue'
import { aiJobsReadProvider } from '../src/ai-jobs-read-integration'
import type { AiJobSnapshot, AiJobsView, AiJobsReadProvider } from '../src/domain/ai-jobs-read'
const id = '0123456789abcdef', jobId = 'STUDIO-RUN-icon-demo-0123abcd', candidateId = 'CANDIDATE-gem-1', project = { id, name: '工程 A', path: '/fixture/A' }, source = {}
function job(): AiJobSnapshot { return { projectId: id, jobId, revision: 1, state: 'import_unknown', sourceRevision: 'a'.repeat(40), requestHash: 'b'.repeat(64), profile: 'local-icon-v1', budget: { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, createdAt: '2026-10-15T13:00:00Z', assets: [{ assetId: 'gem', relativePath: 'assets/icons/gem.png' }], candidates: [{ candidateId, assetId: 'gem', fileSha256: 'c'.repeat(64), width: 1024, height: 1024, hasAlpha: true }], selectedIds: [candidateId], import: { operationId: `icon-import-${'a'.repeat(32)}`, state: 'STARTED', effectApplied: 'UNKNOWN', leaseState: 'RELEASED', errorCode: null, tools: [] }, workerResident: false, productionVerified: false } }
function jobs(): AiJobsView { return { schemaVersion: 'companion-icons-v1', projectId: id, sourceRevision: 'a'.repeat(40), jobs: [job()], profile: { id: 'local-icon-v1', ...job().budget }, schedulerEnabled: false, workerResident: false } }
const provider = (): AiJobsReadProvider => ({ label: 'fake', readJobs: vi.fn(async () => jobs()), readStatus: vi.fn(async () => job()), previewCandidate: vi.fn(async () => { throw Error('SECRET') }) })
let wrapper: VueWrapper | undefined
const button = (label: string) => wrapper!.findAll('button').find(button => button.text().includes(label))!
function setup(p: AiJobsReadProvider | null = provider()) { wrapper = mount(AiJobsReadPanel, { props: { project, source, provider: p }, global: { plugins: [createPinia(), ElementPlus], stubs: { AiJobActionsPanel: { name: 'AiJobActionsPanel', props: ['previewShown', 'allowedOperations', 'preview', 'job'], template: '<div data-testid="actions-handoff" />' } } } }); return p }
async function select() { await button('读取 / 刷新任务').trigger('click'); await flushPromises(); wrapper!.getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', jobId); await flushPromises() }
afterEach(() => { wrapper?.unmount(); wrapper = undefined; aiJobsReadProvider.value = null; aiJobActionsProvider.value = null; vi.restoreAllMocks() })
describe('existing AI task read panel', () => {
  it('is passive on mount and registration/project changes', async () => { const p = provider(); setup(p); expect(p.readJobs).not.toHaveBeenCalled(); expect(wrapper!.text()).toContain(id); expect(wrapper!.text()).toContain(project.path); await wrapper!.setProps({ project: { ...project, path: '/new' } }); expect(p.readJobs).not.toHaveBeenCalled(); expect(p.readStatus).not.toHaveBeenCalled(); expect(p.previewCandidate).not.toHaveBeenCalled() })
  it('disables unavailable or unregistered reads and supplies no empty action buttons', async () => { setup(null); expect(button('读取 / 刷新任务').attributes('disabled')).toBeDefined(); expect(wrapper!.text()).toContain('当前构建未接入'); await wrapper!.setProps({ provider: provider(), source: null }); expect(button('读取 / 刷新任务').attributes('disabled')).toBeDefined(); expect(wrapper!.find('img').exists()).toBe(false) })
  it('preserves UNKNOWN and independent lease/effect evidence without write controls', async () => { const p = provider(); setup(p); await select(); expect(p.readStatus).not.toHaveBeenCalled(); expect(p.previewCandidate).not.toHaveBeenCalled(); expect(wrapper!.text()).toContain('导入可能已经写入'); expect(wrapper!.text()).toContain('UNKNOWN'); expect(wrapper!.text()).toContain('RELEASED'); expect(wrapper!.text()).toContain('原任务已保存此选择'); expect(wrapper!.findAll('button').some(button => /生成候选|恢复执行|确认导入|批准选择/.test(button.text()))).toBe(false); expect(wrapper!.find('img').exists()).toBe(false) })
  it('requests status and candidate only after their individual buttons are clicked', async () => { const p = provider(); setup(p); await select(); await button('刷新所选原任务').trigger('click'); await flushPromises(); expect(p.readStatus).toHaveBeenCalledExactlyOnceWith(id, jobId, expect.any(AbortSignal)); await button('预览此候选').trigger('click'); await flushPromises(); expect(p.previewCandidate).toHaveBeenCalledWith(id, jobId, expect.objectContaining({ candidateId, fileSha256: 'c'.repeat(64) }), expect.any(AbortSignal)); expect(wrapper!.text()).not.toContain('SECRET'); expect(wrapper!.find('img').exists()).toBe(false) })
  it('shows empty history only after a successful original empty result', async () => { const p = provider(); p.readJobs = vi.fn(async () => ({ ...jobs(), jobs: [] })); setup(p); expect(wrapper!.text()).toContain('尚未读取任务历史'); expect(wrapper!.text()).not.toContain('原后台本次返回空任务历史'); await button('读取 / 刷新任务').trigger('click'); await flushPromises(); expect(wrapper!.text()).toContain('原后台本次返回空任务历史') })
  it('does not promote imported-pending-verification to production completion', async () => { const p = provider(); p.readJobs = vi.fn(async () => ({ ...jobs(), jobs: [{ ...job(), state: 'imported_pending_verification' as const }] })); setup(p); await select(); expect(wrapper!.text()).toContain('这不等于场景绑定、Preview、Build 或生产验收完成'); expect(wrapper!.text()).toContain('productionVerified：false') })
  it('aborts on unmount, without accepting a late history into a new panel', async () => { const p = provider(); let finish!: (value: AiJobsView) => void, signal: AbortSignal | undefined; p.readJobs = vi.fn((_id, next) => { signal = next; return new Promise<AiJobsView>(resolve => { finish = resolve }) }); setup(p); await button('读取 / 刷新任务').trigger('click'); await flushPromises(); wrapper!.unmount(); wrapper = undefined; expect(signal?.aborted).toBe(true); setup(provider()); finish(jobs()); await flushPromises(); expect(wrapper!.text()).toContain('尚未读取任务历史') })
  it('clears results if the registered provider is replaced', async () => { const p = provider(); aiJobsReadProvider.value = p; wrapper = mount(AiJobsReadPanel, { props: { project, source }, global: { plugins: [createPinia(), ElementPlus], stubs: { AiJobActionsPanel: { name: 'AiJobActionsPanel', props: ['previewShown', 'allowedOperations', 'preview', 'job'], template: '<div data-testid="actions-handoff" />' } } } }); await select(); aiJobsReadProvider.value = provider(); await flushPromises(); expect(wrapper.text()).toContain('尚未读取任务历史'); expect(wrapper.text()).not.toContain('导入可能已经写入') })
 it('exposes only source-bound observed status without extra reads and keeps previews outside diagnostics',async()=>{const p=provider();setup(p);await wrapper!.setProps({compact:true});type Panel={readStatusSnapshot:{projectId:string;projectPath:string;source:object;loading:boolean;error:string;hasRead:boolean;state:string|null}};const panel=wrapper!.vm as unknown as Panel;expect(panel.readStatusSnapshot).toMatchObject({projectId:id,projectPath:project.path,source,hasRead:false,state:null});expect(p.readJobs).not.toHaveBeenCalled();await select();expect(panel.readStatusSnapshot).toMatchObject({source,hasRead:true,state:'import_unknown'});expect(p.readJobs).toHaveBeenCalledTimes(1);expect(p.readStatus).not.toHaveBeenCalled();const preview=button('预览此候选').element;expect(preview.closest('details')).toBeNull();expect(wrapper!.findAll('details').every(d=>d.attributes('open')===undefined)).toBe(true);await wrapper!.setProps({source:{}});expect(panel.readStatusSnapshot.hasRead).toBe(false)})

})


describe('verified read-to-action DOM handoff', () => {
  const writer = (): AiJobActionsProvider => ({ label: 'fake writer', execute: vi.fn(), waitForIdle: async () => {} })
  it('requires this exact image load event before handing visual-review readiness to actions', async () => {
    const p = provider(), preview = { candidateId, sha256: 'c'.repeat(64), width: 1024 as const, height: 1024 as const, mimeType: 'image/png' as const, base64: 'offline-fixture' }
    // Decoder correctness is tested separately with actual PNG/CRC/SHA fixtures; this test isolates DOM readiness.
    vi.spyOn(jobsDomain, 'verifyAiJobPreview').mockResolvedValue(preview)
    p.previewCandidate = vi.fn(async () => preview); aiJobActionsProvider.value = writer(); setup(p); await select()
    await button('预览此候选').trigger('click'); await flushPromises()
    const actions = () => wrapper!.getComponent({ name: 'AiJobActionsPanel' })
    expect(actions().props('previewShown')).toBe(false)
    const image = wrapper!.get('img'); expect(image.attributes('data-candidate')).toBe(candidateId)
    await image.trigger('load'); expect(actions().props('previewShown')).toBe(true)
    await button('关闭候选预览').trigger('click'); await button('预览此候选').trigger('click'); await flushPromises()
    const current = wrapper!.get('img'); expect(current.element).not.toBe(image.element)
    await image.trigger('load'); await image.trigger('error'); expect(actions().props('previewShown')).toBe(false); expect(wrapper!.find('img').exists()).toBe(true)
    await current.trigger('load'); expect(actions().props('previewShown')).toBe(true)
    await current.trigger('error'); expect(actions().props('previewShown')).toBe(false); expect(wrapper!.find('img').exists()).toBe(false)
  })
  it('restricts original operations to their existing resource stage and does not write while switching', async () => {
    const p = provider(), w = writer(); aiJobActionsProvider.value = w; setup(p); await select()
    for (const [step, operations] of [[3, ['run-next','resume']], [4, ['select']], [5, ['import','export-variant','import-variant']], [6, []]] as const) {
      await wrapper!.setProps({ workflowStep: step })
      expect(wrapper!.getComponent({ name: 'AiJobActionsPanel' }).props('allowedOperations')).toEqual(operations)
    }
    expect(w.execute).not.toHaveBeenCalled(); expect(p.readJobs).toHaveBeenCalledTimes(1)
  })
  it('only follows a created task with the exact current project, source and reader', async () => {
    const p = provider(); setup(p)
    const exposed = wrapper!.vm as unknown as { readCreatedTask: (input: { snapshot: AiJobSnapshot; project: AiJobsProject; source: object; jobsReader: AiJobsReadProvider }) => Promise<void> }
    const input = { snapshot: job(), project, source: (wrapper!.props() as { source: object }).source, jobsReader: (wrapper!.props() as { provider: AiJobsReadProvider }).provider }
    await exposed.readCreatedTask({ ...input, source: {} }); await exposed.readCreatedTask({ ...input, project: { ...project, path: '/another' } }); await exposed.readCreatedTask({ ...input, jobsReader: provider() })
    expect(p.readJobs).not.toHaveBeenCalled(); await exposed.readCreatedTask(input); await flushPromises()
    expect(p.readJobs).toHaveBeenCalledTimes(1); expect(wrapper!.text()).toContain(jobId)
  })
  it('does not apply a late creation follow-up after source changes', async () => {
    const p = provider(); let finish!: (value: AiJobsView) => void
    p.readJobs = vi.fn(() => new Promise<AiJobsView>(resolve => { finish = resolve })); setup(p)
    const exposed = wrapper!.vm as unknown as { readCreatedTask: (input: { snapshot: AiJobSnapshot; project: AiJobsProject; source: object; jobsReader: AiJobsReadProvider }) => Promise<void> }
    const pending = exposed.readCreatedTask({ snapshot: job(), project, source: (wrapper!.props() as { source: object }).source, jobsReader: (wrapper!.props() as { provider: AiJobsReadProvider }).provider }); await flushPromises()
    await wrapper!.setProps({ source: {} }); finish(jobs()); await pending; await flushPromises()
    expect(wrapper!.text()).toContain('尚未读取任务历史'); expect(wrapper!.text()).not.toContain(jobId)
  })
  it('shows original Owner acceptance only at its narrow scope without a runtime-pass claim', async () => {
    const p = provider(), value = job(); value.state = 'imported_pending_verification'; value.import = { ...value.import!, state: 'imported_pending_verification', effectApplied: true, leaseState: 'RELEASED' }
    value.productAcceptance = { state: 'owner_manual_passed', recordedAt: '2026-10-15T13:00:00Z', ownerReportedAt: '2026-10-15T13:01:00Z', receiptSha256: 'd'.repeat(64), operationId: 'icon-import-original', sourceMessageId: `Sentinel_${'a'.repeat(32)}`, scope: 'import_and_runtime_visibility', automationState: 'unknown' }
    p.readJobs = vi.fn(async () => ({ ...jobs(), jobs: [value] })); setup(p); await select()
    expect(wrapper!.get('[data-testid="job-product-acceptance"]').text()).toContain('Owner 已手工确认：导入与运行可见')
    expect(wrapper!.text()).toContain('自动化状态仍为 UNKNOWN'); expect(wrapper!.text()).toContain('productionVerified：false')
  })
})
