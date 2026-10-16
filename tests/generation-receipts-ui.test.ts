import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import GenerationReceiptPanel from '../src/components/GenerationReceiptPanel.vue'
import { useWorkspaceStore } from '../src/stores/workspace'
import { useResourcePlanningStore } from '../src/stores/resource-planning'
import { useGenerationReceiptsStore } from '../src/stores/generation-receipts'
import { localFile, pngBytes, testCrypto } from './fixtures/generation-png'
let wrapper: VueWrapper | undefined
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; localStorage.clear(); vi.unstubAllGlobals() })
async function setup() {
  vi.stubGlobal('crypto', testCrypto)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/resources', component: { template: '<div/>' } }] })
  await router.push('/resources?step=3'); await router.isReady()
  const pinia = createPinia(); const workspace = useWorkspaceStore(pinia); await workspace.openDemo()
  const planning = useResourcePlanningStore(pinia); const recovery = useGenerationReceiptsStore(pinia)
  planning.begin(workspace.project!, workspace.spec!, 'demo', 'read-only')
  planning.add('demo', workspace.project!.id, { name: '金币母图', category: '图标', purpose: '货币', page: '商店', priority: 'normal', defaultSize: { width: 16, height: 16 }, transparent: true, ownerProtected: false, acceptanceNotes: '' })
  planning.add('demo', workspace.project!.id, { name: 'Owner 资产', category: '图标', purpose: '保护', page: '商店', priority: 'normal', defaultSize: { width: 16, height: 16 }, transparent: true, ownerProtected: true, acceptanceNotes: '' })
  const id = planning.get('demo', workspace.project!.id)!.requirements[0]!.id
  planning.batch('demo', workspace.project!.id, '首批', [id]); planning.selectSource('demo', workspace.project!.id, 'codex-native')
  wrapper = mount(GenerationReceiptPanel, { attachTo: document.body, global: { plugins: [pinia, ElementPlus, router] } }); await flushPromises()
  return { workspace, planning, recovery, id, router }
}
async function pick(file = localFile()) {
  const input = wrapper!.find('input[type=file]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change'); await flushPromises()
}
function button(text: string) { const b = new DOMWrapper(document.body).findAll('button').find((b) => b.text().includes(text)); if (!b) throw new Error(text); return b }
describe('manual PNG recovery UI', () => {
  it('requires an eligible explicit requirement and never offers protected assets', async () => {
    const { id } = await setup()
    expect(wrapper!.find('input[type=file]').attributes('disabled')).toBeDefined()
    expect(wrapper!.find('select').text()).not.toContain('Owner 资产')
    await wrapper!.find('select').setValue(id)
    expect(wrapper!.find('input[type=file]').attributes('disabled')).toBeUndefined()
    expect(wrapper!.text()).toContain('当前绑定示例项目')
  })
  it('registers real metadata, exports a pending checklist, and never loads an image URL', async () => {
    const { id, recovery } = await setup(); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await wrapper!.find('select').setValue(id); await pick()
    // WebCrypto runs outside the DOM microtask queue.
    await vi.waitFor(() => expect(recovery.receipts).toHaveLength(1))
    await flushPromises()
    expect(wrapper!.text()).toContain('result.png'); expect(wrapper!.text()).toContain('尺寸匹配；不代表 QA 通过')
    expect(wrapper!.findAll('img')).toHaveLength(0); expect(fetch).not.toHaveBeenCalled()
    await button('导出本地回收清单').trigger('click'); await flushPromises()
    const text = (new DOMWrapper(document.body).find('textarea[aria-label="本地回收清单 JSON"]').element as HTMLTextAreaElement).value
    expect(text).toContain('needs-review'); expect(text).toContain('not-verified'); expect(text).not.toContain('data:image')
    expect(localStorage.length).toBe(0)
  })
  it('keeps old records under their original source and marks stale context', async () => {
    const { id, recovery, planning, workspace } = await setup()
    await wrapper!.find('select').setValue(id); await pick(); await vi.waitFor(() => expect(recovery.receipts).toHaveLength(1))
    planning.selectSource('demo', workspace.project!.id, 'comfyui'); await flushPromises()
    expect(wrapper!.text()).toContain('历史绑定'); expect(wrapper!.text()).toContain('Codex 原生')
    expect(recovery.receipts[0]?.context.generationSource).toBe('codex-native')
  })
  it('discards a delayed file after source A→B→A, and clears old selection', async () => {
    const { id, recovery, planning, workspace } = await setup(); let resolve!: (b: ArrayBuffer) => void
    await wrapper!.find('select').setValue(id)
    await pick({ ...localFile(), arrayBuffer: () => new Promise((res) => { resolve = res }) })
    planning.selectSource('demo', workspace.project!.id, 'comfyui'); planning.selectSource('demo', workspace.project!.id, 'codex-native')
    resolve(pngBytes().slice().buffer); await flushPromises()
    expect(recovery.receipts).toHaveLength(0); expect(recovery.pending).toBe(false)
    expect((wrapper!.find('select').element as HTMLSelectElement).value).toBe('')
  })
  it('cancels work when the panel unmounts and does not record a late result', async () => {
    const { id, recovery } = await setup(); let resolve!: (b: ArrayBuffer) => void
    await wrapper!.find('select').setValue(id); await pick({ ...localFile(), arrayBuffer: () => new Promise((res) => { resolve = res }) })
    wrapper!.unmount(); wrapper = undefined; resolve(pngBytes().slice().buffer); await flushPromises()
    expect(recovery.receipts).toHaveLength(0)
  })
  it('invalidates a read on route-only navigation while the panel remains mounted', async () => {
    const { id, recovery, router } = await setup(); let resolve!: (b: ArrayBuffer) => void
    await wrapper!.find('select').setValue(id); await pick({ ...localFile(), arrayBuffer: () => new Promise((res) => { resolve = res }) })
    await router.push('/resources?step=3&view=x'); await router.push('/resources?step=3')
    resolve(pngBytes().slice().buffer); await flushPromises()
    expect(wrapper!.exists()).toBe(true); expect(recovery.receipts).toHaveLength(0)
  })
  it('refuses intake after specification changes and keeps prior receipts', async () => {
    const { id, recovery, workspace } = await setup()
    await wrapper!.find('select').setValue(id); await pick(); await vi.waitFor(() => expect(recovery.receipts).toHaveLength(1))
    workspace.localDraft = { schemaVersion: 1, projectId: workspace.project!.id, mode: 'demo', revision: 'changed', savedAt: new Date().toISOString(), spec: { ...workspace.spec!, width: 1080 } }
    await flushPromises(); expect(wrapper!.text()).toContain('文件登记暂停'); expect(wrapper!.find('input[type=file]').attributes('disabled')).toBeDefined()
    expect(recovery.receipts).toHaveLength(1)
  })
  it('project switch hides other project receipts and cancels delayed reading', async () => {
    const { id, recovery, workspace } = await setup(); let resolve!: (b: ArrayBuffer) => void
    const first = workspace.selectedProjectId
    await wrapper!.find('select').setValue(id); await pick({ ...localFile(), arrayBuffer: () => new Promise((res) => { resolve = res }) })
    workspace.selectedProjectId = 'demo-4060'; workspace.selectedProjectId = first
    resolve(pngBytes().slice().buffer); await flushPromises(); expect(recovery.receipts).toHaveLength(0)
  })
})
