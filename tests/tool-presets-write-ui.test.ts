import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ToolPresetsReadPanel from '../src/components/ToolPresetsReadPanel.vue'
import { useToolPresetsReadStore } from '../src/stores/tool-presets-read'
import { useToolPresetsWriteStore } from '../src/stores/tool-presets-write'
import { useToolPresetDraftsStore } from '../src/stores/tool-preset-drafts'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { registerToolPresetReadProvider, toolPresetReadProvider } from '../src/tool-presets-read-integration'
import { registerToolPresetWriteProvider, toolPresetWriteProvider } from '../src/tool-presets-write-integration'
import { companionBrowserProvider } from '../src/companion-browser-integration'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import type { ToolPreset, ToolPresetReadProvider } from '../src/domain/tool-presets-read'
import { ToolPresetWriteError } from '../src/domain/tool-presets-write'
import type { ToolPresetWriteProvider, ToolPresetWriteReceipt } from '../src/domain/tool-presets-write'
let wrapper: VueWrapper | undefined
const builtins: ToolPreset[] = ['core', 'full'].map(id => ({ id, name: id === 'core' ? '核心工具' : '全部工具', baseProfile: id as 'core' | 'full', enabled: [], disabled: [], builtIn: true, updatedAt: '1970-01-01T00:00:00.000Z' }))
const custom = (id = 'custom', name = '自定义'): ToolPreset => ({ id, name, baseProfile: 'core', enabled: ['scene_save'], disabled: [], builtIn: false, updatedAt: '2026-10-15T00:00:00.000Z' })
async function setup(writes = true) {
  const readProvider: ToolPresetReadProvider = { label: '真实合同测试源', loadTools: vi.fn(async () => [{ name: 'scene_save', displayNameZh: '场景保存', description: 'fixture', profile: 'full' as const, scope: 'scene', access: 'read' as const }]), loadPresets: vi.fn(async () => ({ presets: [...builtins, custom()], selectedPresetId: 'full' })), exportPreset: vi.fn() }
  const writer: ToolPresetWriteProvider = { label: '写入测试源', execute: vi.fn<ToolPresetWriteProvider['execute']>(async input => {
    const operation = input.operation
    if (operation.kind === 'delete') return { kind: 'deleted', projectIds: [] }
    return { kind: 'preset', preset: operation.kind === 'import' ? operation.presets[0]! : operation.kind === 'create' ? { ...operation.preset, id: 'new-server-id' } : operation.preset, batchSize: operation.kind === 'import' ? operation.presets.length : 1 }
  }), waitForIdle: vi.fn(async () => undefined) }
  registerToolPresetReadProvider(readProvider); if (writes) registerToolPresetWriteProvider(writer)
  const projectProvider = { label: '工程登记来源', loadProjects: vi.fn(), loadLogs: vi.fn(), loadCounts: vi.fn(), loadCalls: vi.fn() } satisfies CompanionBrowserProvider
  companionBrowserProvider.value = projectProvider
  const pinia = createPinia(), router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/help', component: ToolPresetsReadPanel }, { path: '/projects', component: { template: '<p>工程</p>' } }] })
  await router.push('/help'); await router.isReady()
  const projects = useCompanionBrowserStore(pinia); projects.provider = projectProvider; projects.connected = true; projects.projects = [{ id: 'p1', name: '工程甲', path: '/original-project' }]
  wrapper = mount(ToolPresetsReadPanel, { global: { plugins: [pinia, router, ElementPlus] } })
  const read = useToolPresetsReadStore(pinia), write = useToolPresetsWriteStore(pinia), drafts = useToolPresetDraftsStore(pinia)
  async function prime() { await read.loadTools(readProvider); read.setProjectContext('p1', ['p1']); await read.loadPresets(); read.selectPreview('custom'); await flushPromises() }
  return { readProvider, writer, read, write, drafts, projects, projectProvider, prime }
}
const button = (text: string) => wrapper!.findAll('button').find(item => item.text().includes(text))!
async function renameReview(name = '已改名') { await wrapper!.get('input[aria-label="正式预设新名称"]').setValue(name); await button('改名并确认').trigger('click'); await flushPromises() }
async function confirm() { await wrapper!.get('.write-review input[type="checkbox"]').setValue(true); await button('确认并写入宿主一次').trigger('click'); await flushPromises() }
afterEach(() => { wrapper?.unmount(); wrapper = undefined; toolPresetReadProvider.value = null; toolPresetWriteProvider.value = null; companionBrowserProvider.value = null; vi.restoreAllMocks() })
describe('tool preset production controls remain in the original help panel', () => {
  it('registration and mount do not fetch or mutate, and read-only composition retains no writer entry', async () => {
    const { readProvider, writer } = await setup(false)
    expect(wrapper!.find('[data-testid="tool-preset-write-panel"]').exists()).toBe(false)
    expect(readProvider.loadTools).not.toHaveBeenCalled(); expect(writer.execute).not.toHaveBeenCalled()
    expect(wrapper!.text()).toContain('没有分配、保存、导入、删除或注册请求')
  })
  it('requires a fresh checkbox for the frozen rename and never sends on opening or false approval', async () => {
    const { writer, prime } = await setup(); await prime(); await renameReview()
    expect(wrapper!.text()).toContain('原宿主没有版本哈希或原子并发校验'); expect(wrapper!.text()).toContain('/original-project')
    expect(button('确认并写入宿主一次').attributes('disabled')).toBeDefined(); expect(writer.execute).not.toHaveBeenCalled()
    await confirm(); expect(writer.execute).toHaveBeenCalledTimes(1); expect(wrapper!.text()).toContain('宿主已返回本次持久化回执')
    expect(button('改名并确认').attributes('disabled')).toBeDefined()
  })
  it('invalidates the pending confirmation when rename text changes', async () => {
    const { writer, prime } = await setup(); await prime(); await renameReview(); await wrapper!.get('.write-review input[type="checkbox"]').setValue(true)
    await wrapper!.get('input[aria-label="正式预设新名称"]').setValue('另外名称')
    expect(wrapper!.find('.write-review').exists()).toBe(false); expect(writer.execute).not.toHaveBeenCalled()
  })
  it.each(['path', 'source', 'registered-source'])('invalidates assignment on a same-id registration %s change and return', async field => {
    const { prime, projects, projectProvider, writer } = await setup(); await prime()
    await button('为当前工程确认分配').trigger('click'); expect(wrapper!.get('.write-review').text()).toContain('持久分配目标工程：工程甲（p1）；路径：/original-project')
    await wrapper!.get('.write-review input[type="checkbox"]').setValue(true)
    if (field === 'path') projects.projects = [{ id: 'p1', name: '工程甲', path: '/different-project' }]
    if (field === 'source') companionBrowserProvider.value = { ...projectProvider }
    if (field === 'registered-source') projects.provider = { ...projectProvider }
    await flushPromises(); expect(wrapper!.find('.write-review').exists()).toBe(false)
    if (field !== 'path') expect(button('为当前工程确认分配').attributes('disabled')).toBeDefined()
    projects.projects = [{ id: 'p1', name: '工程甲', path: '/original-project' }]; projects.provider = projectProvider; companionBrowserProvider.value = projectProvider
    await flushPromises(); expect(wrapper!.find('.write-review').exists()).toBe(false); expect(writer.execute).not.toHaveBeenCalled()
  })
  it('uses the existing local editor/import collection then explicitly persists, with separate assignment', async () => {
    const { prime, drafts, writer, read } = await setup(); await prime()
    const candidates = drafts.prepareImport(JSON.stringify({ schemaVersion: 1, presets: [custom('draft-id', '来自JSON')] }))!; drafts.applyImport(candidates)
    await flushPromises(); await button('将当前草稿创建为正式预设').trigger('click'); expect(writer.execute).not.toHaveBeenCalled()
    expect(wrapper!.get('.write-review').text()).toContain('宿主将生成新 ID'); await confirm()
    expect(writer.execute).toHaveBeenCalledTimes(1); expect(vi.mocked(writer.execute).mock.calls[0]![0].operation.kind).toBe('create'); expect(read.selectedPresetId).toBe('full')
  })
  it('revokes draft-based save confirmation when the existing editor changes', async () => {
    const { prime, drafts, writer } = await setup(); await prime()
    const candidates = drafts.prepareImport(JSON.stringify({ schemaVersion: 1, presets: [custom('draft-id', '来自JSON')] }))!; drafts.applyImport(candidates)
    await flushPromises(); await button('用当前草稿保存到预览').trigger('click'); await wrapper!.get('.write-review input[type="checkbox"]').setValue(true)
    drafts.edit('draft-id', { name: '新编辑' }); await flushPromises(); expect(wrapper!.find('.write-review').exists()).toBe(false); expect(writer.execute).not.toHaveBeenCalled()
  })
  it('discloses deletion fallback risk and never follows a 409 with a forced retry', async () => {
    const { prime, writer } = await setup(); await prime(); writer.execute = vi.fn(async () => { throw new ToolPresetWriteError('in-use', 'rejected', 409, ['p1', 'p2']) })
    await button('确认删除预览').trigger('click'); expect(wrapper!.get('.write-review').text()).toContain('不会默认同意关联工程回退全部工具')
    await confirm(); expect(writer.execute).toHaveBeenCalledTimes(1); expect(wrapper!.text()).toContain('p1、p2'); expect(wrapper!.text()).toContain('可能扩大工具可见范围')
  })
  it('explicit readback cannot turn UNKNOWN into success or send an automatic retry', async () => {
    const { prime, writer, write } = await setup(); await prime(); writer.execute = vi.fn(async () => { throw new ToolPresetWriteError('timeout', 'unknown') })
    await renameReview('自定义'); await confirm(); expect(write.status).toBe('unknown'); expect(wrapper!.text()).toContain('UNKNOWN')
    await button('回读核对上次操作').trigger('click'); await flushPromises()
    expect(write.observation?.matches).toBe(true); expect(write.status).toBe('unknown'); expect(writer.execute).toHaveBeenCalledTimes(1)
    expect(wrapper!.text()).toContain('回读不证明本次请求成功'); expect(button('结束未知结果核查').attributes('disabled')).toBeDefined()
  })
  it('labels late readback with its frozen original source and path after switching to another same-id project', async () => {
    const { prime, writer, write, readProvider, projects, projectProvider } = await setup(); await prime()
    writer.execute = vi.fn(async () => { throw new ToolPresetWriteError('timeout', 'unknown') })
    await renameReview('自定义'); await confirm()
    let finish!: (value: Awaited<ReturnType<ToolPresetReadProvider['loadPresets']>>) => void
    vi.mocked(readProvider.loadPresets).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = write.readBack(); await flushPromises()
    registerToolPresetReadProvider({ ...readProvider, label: '新来源B' })
    projects.projects = [{ id: 'p1', name: '工程乙', path: '/different-project-B' }]
    projects.provider = { ...projectProvider, label: '登记来源B' }; companionBrowserProvider.value = projects.provider
    await flushPromises()
    finish({ presets: [...builtins, custom()], selectedPresetId: 'full' }); await pending; await flushPromises()
    const detail = wrapper!.get('.write-observation').text()
    expect(detail).toContain('本次核对的原来源：真实合同测试源'); expect(detail).toContain('登记来源：工程登记来源')
    expect(detail).toContain('工程甲（p1）'); expect(detail).toContain('/original-project'); expect(detail).not.toContain('/different-project-B'); expect(detail).not.toContain('新来源B')
    expect(write.status).toBe('unknown'); expect(writer.execute).toHaveBeenCalledTimes(1)
  })
  it('leaving while dispatched keeps the attempt unknown even after a late matching receipt', async () => {
    const { prime, writer, write } = await setup(); await prime(); let finish!: (receipt: ToolPresetWriteReceipt) => void
    writer.execute = vi.fn<ToolPresetWriteProvider['execute']>(() => new Promise<ToolPresetWriteReceipt>(resolve => { finish = resolve }))
    await renameReview(); await confirm(); wrapper!.unmount(); wrapper = undefined
    expect(write.status).toBe('unknown'); finish({ kind: 'preset', preset: custom('custom', '已改名'), batchSize: 1 }); await flushPromises()
    expect(write.status).toBe('unknown'); expect(write.receipt).toBeNull(); expect(writer.execute).toHaveBeenCalledTimes(1)
  })
  it('cancels single-preset overwrite without writing and requires a fresh exact-target confirmation', async () => {
    const { prime, drafts, writer, read } = await setup(); await prime()
    const imported = drafts.prepareImport(JSON.stringify({ schemaVersion: 1, presets: [{ ...custom('draft-source', '覆盖后'), enabled: [], disabled: ['scene_save'] }] }))!
    drafts.applyImport(imported); await flushPromises()
    await button('用当前草稿保存到预览').trigger('click'); await flushPromises()
    const review = wrapper!.get('.write-review').text()
    expect(review).toContain('待保存页面草稿来源：覆盖后 · draft-source')
    expect(review).toContain('变更前：自定义 · custom')
    expect(review).toContain('ID：custom；'); expect(review).toContain('显式禁用：[scene_save]')
    await wrapper!.get('.write-review input[type="checkbox"]').setValue(true)
    await button('取消本次确认').trigger('click'); await flushPromises()
    expect(wrapper!.find('.write-review').exists()).toBe(false); expect(writer.execute).not.toHaveBeenCalled()
    await button('用当前草稿保存到预览').trigger('click'); await flushPromises()
    expect(button('确认并写入宿主一次').attributes('disabled')).toBeDefined()
    await confirm()
    expect(writer.execute).toHaveBeenCalledTimes(1)
    expect(vi.mocked(writer.execute).mock.calls[0]![0].operation).toMatchObject({ kind: 'update', before: { id: 'custom', enabled: ['scene_save'] }, preset: { id: 'custom', name: '覆盖后', enabled: [], disabled: ['scene_save'] } })
    expect(read.previewPresetId).toBe('custom'); expect(read.selectedPresetId).toBe('full')
    expect(drafts.active?.preset.id).toBe('draft-source')
  })
  it.each(['update', 'assign', 'import'] as const)('invalidates dispatched %s on project switch without applying its late receipt', async kind => {
    const { prime, drafts, writer, write, read, projects } = await setup(); await prime()
    projects.projects = [...projects.projects, { id: 'p2', name: '工程乙', path: '/second-project' }]
    if (kind !== 'assign') {
      const imported = drafts.prepareImport(JSON.stringify({ schemaVersion: 1, presets: [custom('draft-source', '草稿来源')] }))!
      drafts.applyImport(imported)
    }
    await flushPromises()
    let finish!: (receipt: ToolPresetWriteReceipt) => void
    writer.execute = vi.fn<ToolPresetWriteProvider['execute']>(() => new Promise(resolve => { finish = resolve }))
    await button(kind === 'update' ? '用当前草稿保存到预览' : kind === 'assign' ? '为当前工程确认分配' : '将全部页面草稿导入').trigger('click')
    await flushPromises(); await confirm()
    const operation = vi.mocked(writer.execute).mock.calls[0]![0].operation
    read.setProjectContext('p2', ['p1', 'p2']); await flushPromises()
    expect(write.status).toBe('unknown'); expect(write.attempt?.projectId).toBe('p1')
    expect(vi.mocked(writer.execute).mock.calls[0]![1]?.aborted).toBe(true)
    if (operation.kind === 'delete') throw new Error('Unexpected deletion')
    finish({ kind: 'preset', preset: operation.kind === 'import' ? operation.presets[0]! : operation.preset, batchSize: operation.kind === 'import' ? operation.presets.length : 1 })
    await flushPromises()
    expect(write.receipt).toBeNull(); expect(write.status).toBe('unknown')
    expect(read.projectId).toBe('p2'); expect(read.selectedPresetId).toBe('')
    expect(writer.execute).toHaveBeenCalledTimes(1)
    expect(wrapper!.text()).not.toContain('宿主已返回本次持久化回执')
  })

  it.each(['project-return', 'unmount'] as const)('does not continue an old refresh after %s while tools are pending', async change => {
    const { prime, readProvider, read, projects } = await setup(); await prime()
    const initialReads = vi.mocked(readProvider.loadPresets).mock.calls.length
    let finish!: (value: Awaited<ReturnType<ToolPresetReadProvider['loadTools']>>) => void
    vi.mocked(readProvider.loadTools).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await button('显式刷新目录和预设').trigger('click'); await flushPromises()
    if (change === 'project-return') {
      projects.projects = [...projects.projects, { id: 'p2', name: '工程乙', path: '/second-project' }]
      read.setProjectContext('p2', ['p1', 'p2']); read.setProjectContext('p1', ['p1', 'p2'])
    } else { wrapper!.unmount(); wrapper = undefined }
    finish([{ name: 'scene_save', displayNameZh: '场景保存', description: 'fixture', profile: 'full', scope: 'scene', access: 'read' }])
    await flushPromises()
    expect(readProvider.loadPresets).toHaveBeenCalledTimes(initialReads)
  })

})


describe('linked preset deletion uses a distinct explicit confirmation',()=>{
 it('keeps ordinary deletion available and requires a fresh all-associations acknowledgement for reset deletion',async()=>{
  const {prime,writer}=await setup();await prime();writer.execute=vi.fn<ToolPresetWriteProvider['execute']>(async()=>({kind:'deleted',projectIds:['p1','p2']}))
  expect(button('确认删除预览').attributes('disabled')).toBeUndefined()
  await button('删除并将关联工程回退全部工具').trigger('click');await flushPromises()
  const review=wrapper!.get('.write-review');expect(review.text()).toContain('不是只影响当前工程');expect(review.text()).toContain('确认期间新增关联');expect(writer.execute).not.toHaveBeenCalled()
  await review.get('[aria-label="确认本次工具预设持久化"] input').setValue(true)
  expect(button('确认并写入宿主一次').attributes('disabled')).toBeDefined()
  await review.get('[aria-label="确认关联工程回退全部工具"] input').setValue(true)
  await button('取消本次确认').trigger('click');await button('删除并将关联工程回退全部工具').trigger('click');await flushPromises()
  expect(button('确认并写入宿主一次').attributes('disabled')).toBeDefined()
  const next=wrapper!.get('.write-review');expect((next.get('[aria-label="确认关联工程回退全部工具"] input').element as HTMLInputElement).checked).toBe(false)
  await next.get('[aria-label="确认本次工具预设持久化"] input').setValue(true);await next.get('[aria-label="确认关联工程回退全部工具"] input').setValue(true)
  await button('确认并写入宿主一次').trigger('click');await flushPromises()
  expect(writer.execute).toHaveBeenCalledOnce();expect(vi.mocked(writer.execute).mock.calls[0]![0].operation).toMatchObject({kind:'delete',preset:{id:'custom'},resetLinkedProjects:true})
  expect(wrapper!.text()).toContain('2 个关联工程已回退 full');expect(wrapper!.text()).toContain('p1、p2')
 })
 it('does not bypass UNKNOWN with either deletion button and never turns reset readback into success',async()=>{
  const {prime,writer,write,readProvider}=await setup();await prime();writer.execute=vi.fn(async()=>{throw new ToolPresetWriteError('timeout','unknown')})
  await button('删除并将关联工程回退全部工具').trigger('click');await flushPromises()
  await wrapper!.get('.write-review [aria-label="确认本次工具预设持久化"] input').setValue(true)
  await wrapper!.get('.write-review [aria-label="确认关联工程回退全部工具"] input').setValue(true)
  await button('确认并写入宿主一次').trigger('click');await flushPromises()
  expect(write.status).toBe('unknown');expect(button('确认删除预览').attributes('disabled')).toBeDefined();expect(button('删除并将关联工程回退全部工具').attributes('disabled')).toBeDefined()
  vi.mocked(readProvider.loadPresets).mockResolvedValue({presets:builtins,selectedPresetId:'full'})
  await button('回读核对上次操作').trigger('click');await flushPromises()
  expect(write.observation?.matches).toBe(true);expect(write.status).toBe('unknown');expect(writer.execute).toHaveBeenCalledOnce()
 })
})
