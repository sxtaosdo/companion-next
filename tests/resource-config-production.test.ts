import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import ArtWorkspaceView from '../src/views/ArtWorkspaceView.vue'
import ArtProductionFlow from '../src/components/ArtProductionFlow.vue'
import AiTaskCreationPanel from '../src/components/AiTaskCreationPanel.vue'
import AiJobsReadPanel from '../src/components/AiJobsReadPanel.vue'
import { aiTaskCreationProvider } from '../src/ai-task-creation-integration'
import { aiJobActionsProvider } from '../src/ai-job-actions-integration'
import AiResourceConfigDialog from '../src/components/AiResourceConfigDialog.vue'
import { companionBrowserProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { aiJobsReadProvider } from '../src/ai-jobs-read-integration'
import type { AiJobsReadProvider, AiJobsView } from '../src/domain/ai-jobs-read'
import { aiResourceReadProvider } from '../src/ai-resource-read-integration'
import { aiResourceSaveProvider } from '../src/ai-resource-save-integration'
import { aiReferenceUploadProvider } from '../src/ai-reference-upload-integration'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useRegisteredProjectStore } from '../src/stores/registered-project'
import { useAiResourceReadStore } from '../src/stores/ai-resource-read'
import { useAiResourceEditorStore } from '../src/stores/ai-resource-editor'
import { useAiReferenceUploadStore } from '../src/stores/ai-reference-upload'
import { AiResourceSaveError, type AiResourceSaveInput, type AiResourceSaveProvider } from '../src/domain/ai-resource-save'
import { sha256ReferenceBytes, type AiReferenceUploadProvider, type AiReferenceUploadReceipt } from '../src/domain/ai-reference-upload'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import type { AiReferencePreview, AiResourceReadProvider, AiResourceView } from '../src/domain/ai-resource-read'
import { resourceView, referencePreview } from './fixtures/ai-resource-read'
import { pngBytes, testCrypto } from './fixtures/generation-png'

const id = '0123456789abcdef', other = 'fedcba9876543210'
const projects = [{ id, name: '正式工程 A', path: '/fixture/A' }, { id: other, name: '正式工程 B', path: '/fixture/B' }]
let wrapper: VueWrapper | undefined
let history: ReturnType<typeof createMemoryHistory> | undefined
const button = (label: string) => {
  const found = wrapper!.findAll('button').find(value => value.text().includes(label))
  if (!found) throw Error(`Missing button: ${label}`)
  return found
}
function saveReceipt(projectId: string, input: AiResourceSaveInput) {
  const value = resourceView(projectId)
  value.version = 2; value.hash = 'b'.repeat(64)
  value.config = { ...input.config, version: 2 }; value.draft = structuredClone(value.config)
  return value
}
function missingView(projectId = id) {
  const value = resourceView(projectId)
  value.state = 'missing'; value.config = null; value.version = null; value.hash = null
  value.draft.iconSize = { width: 0, height: 0 }; value.draft.style = { description: '', references: [] }; value.draft.destination.exportDirectory = 'art/final/companion'
  return value
}
function legacyView(projectId = id) {
  const value = resourceView(projectId), config = value.config!
  if (config.schemaVersion !== 'project-resource-config-v2') throw Error('fixture')
  value.config = { schemaVersion: 'project-resource-config-v1', version: 1, designResolution: config.designResolution, orientation: config.orientation,
    iconPresets: [{ id: 'legacy-small', label: '旧小尺寸', displaySize: { width: 128, height: 128 }, outputPixels: { width: 1024, height: 1024 } }],
    style: config.style, background: { format: 'png', transparent: true }, composition: config.composition, destination: { directory: config.destination.directory, naming: 'kebab-case' } }
  value.migrationRequired = true; value.draft.iconSize = { width: 128, height: 128 }; value.draft.destination.exportDirectory = 'art/final/companion'
  return value
}
async function setup(path = `/resources?project=${id}&step=1`, options: { value?: AiResourceView; reader?: AiResourceReadProvider; writer?: AiResourceSaveProvider | null; automatic?: boolean; connected?: boolean } = {}) {
  const pinia = createPinia(), directory = useCompanionBrowserStore(pinia)
  const source: CompanionBrowserProvider = { label: '离线登记', runtimeProbesEnabled: true, loadProjects: vi.fn(async () => ({ projects: structuredClone(projects), statuses: [], dashboard: [], warnings: [] })), loadCounts: vi.fn(), loadLogs: vi.fn(), loadCalls: vi.fn() }
  registerCompanionBrowserProvider(source, undefined, options.automatic ? { projectEntry: 'read' } : {})
  if (options.connected !== false) await directory.connect(source)
  const reader: AiResourceReadProvider = options.reader ?? { label: '离线原规范读取', readConfig: vi.fn(async projectId => structuredClone(options.value ?? resourceView(projectId))), previewReference: vi.fn(async () => ({ ...referencePreview })) }
  const writer: AiResourceSaveProvider | null = options.writer === undefined ? { label: '离线原规范保存', saveConfig: vi.fn(async (projectId, input) => saveReceipt(projectId, input)) } : options.writer
  aiResourceReadProvider.value = reader; aiResourceSaveProvider.value = writer
  const editor = useAiResourceEditorStore(pinia), upload = useAiReferenceUploadStore(pinia), memory = new Map<string, string>()
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value) } }
  editor.setFenceStorage(storage); upload.setFenceStorage(storage)
  const router = createRouter({ history: history = createMemoryHistory(), routes: [
    { path: '/art-resources', component: ArtWorkspaceView },
    { path: '/resources', redirect: to=>({path:'/art-resources',query:{...to.query,type:'icon'}}) },
    { path: '/ai-icons', redirect: to=>({path:'/art-resources',query:{...to.query,type:'icon'}}) },
    { path: '/overview', component: { template: '<p>overview</p>' } }, { path: '/projects', component: { template: '<p>projects</p>' } },
  ] })
  await router.push(path); await router.isReady()
  wrapper = mount({ template: '<RouterView/>' }, { global: { plugins: [pinia, router, ElementPlus] } })
  await flushPromises()
  return { router, directory, source, reader, writer, editor, upload, memory, selection: useRegisteredProjectStore(pinia), read: useAiResourceReadStore(pinia) }
}
async function readAndOpen(label = '编辑配置') {
  await button('读取 / 刷新工程规范').trigger('click'); await flushPromises()
  await button(label).trigger('click'); await flushPromises()
}
async function editAndApprove(text = '正式新风格') {
  await wrapper!.get('textarea[aria-label="规范风格描述"]').setValue(text)
  await wrapper!.get('[aria-label="确认本次工程配置保存"] input').setValue(true); await flushPromises()
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubGlobal('crypto', testCrypto); vi.stubGlobal('fetch', vi.fn()); vi.stubEnv('MODE', 'companion-workspace') })
afterEach(() => {
  wrapper?.unmount(); wrapper = undefined; history?.destroy(); history = undefined
  aiTaskCreationProvider.value = null; aiJobActionsProvider.value = null; aiJobsReadProvider.value = null; aiResourceReadProvider.value = null; aiResourceSaveProvider.value = null; aiReferenceUploadProvider.value = null
  companionProjectEntryProvider.value = null; companionBrowserProvider.value = null
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); sessionStorage.clear(); document.body.innerHTML = ''
})

describe('registered production resource configuration', () => {
  it.each([
    ['missing', '新建配置', 'create', missingView],
    ['legacy', '迁移旧版配置', 'migrate', legacyView],
    ['current', '编辑配置', 'edit', resourceView],
  ] as const)('opens the shared form for %s without treating the draft as saved', async (_kind, label, mode, make) => {
    const value = make(), { reader, writer, editor, read } = await setup(undefined, { value })
    expect(reader.readConfig).not.toHaveBeenCalled(); expect(wrapper!.findComponent(AiResourceConfigDialog).exists()).toBe(true)
    await readAndOpen(label)
    expect(editor.mode).toBe(mode); expect(editor.project).toEqual(projects[0]); expect(editor.confirmed).toBe(false)
    expect(button('确认保存到工程').attributes('disabled')).toBeDefined(); expect(writer!.saveConfig).not.toHaveBeenCalled()
    expect(read.resource?.config).toEqual(value.config); expect(wrapper!.text()).toContain('Owner 资产保持保护')
    if (mode === 'create') expect(read.resource?.config).toBeNull()
    if (mode === 'migrate') expect(wrapper!.text()).toContain('旧小尺寸')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('saves only after per-action approval with frozen identity/hash, then refreshes the saved summary', async () => {
    let current = resourceView()
    const reader: AiResourceReadProvider = { label: 'fixture', readConfig: vi.fn(async () => structuredClone(current)), previewReference: vi.fn() }
    const writer: AiResourceSaveProvider = { label: 'fixture', saveConfig: vi.fn(async (projectId, input) => { current = saveReceipt(projectId, input); return structuredClone(current) }) }
    const { editor, read } = await setup(undefined, { reader, writer }); await readAndOpen()
    await wrapper!.get('textarea[aria-label="规范风格描述"]').setValue('正式新风格')
    expect(read.resource?.config?.style.description).toBe('明亮卡通'); expect(button('确认保存到工程').attributes('disabled')).toBeDefined()
    await editAndApprove(); await button('确认保存到工程').trigger('click')
    await vi.waitFor(() => expect(editor.phase).toBe('saved')); await flushPromises()
    expect(writer.saveConfig).toHaveBeenCalledWith(id, expect.objectContaining({ expectedHash: 'a'.repeat(64), approved: true, config: expect.objectContaining({ projectId: id }) }), expect.any(AbortSignal))
    expect(writer.saveConfig).toHaveBeenCalledTimes(1); expect(reader.readConfig).toHaveBeenCalledTimes(2)
    expect(read.resource?.config?.style.description).toBe('正式新风格'); expect(editor.confirmed).toBe(false)
    expect(wrapper!.text()).toContain('保存回执已核验'); expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves UNKNOWN protection across leaving and reopening the production page', async () => {
    const writer: AiResourceSaveProvider = { label: 'fixture unknown', saveConfig: vi.fn(async () => { throw new AiResourceSaveError('timeout', 'unknown') }) }
    const { editor, router } = await setup(undefined, { writer }); await readAndOpen(); await editAndApprove(); await button('确认保存到工程').trigger('click')
    await vi.waitFor(() => expect(editor.phase).toBe('unknown')); expect(editor.pendingFence).not.toBeNull()
    await router.push('/overview');await flushPromises();expect(editor.pendingFence).not.toBeNull();expect(writer.saveConfig).toHaveBeenCalledTimes(1)
    await router.push(`/ai-icons?project=${id}`); await flushPromises()
    await button('查看保留的编辑草稿').trigger('click'); await flushPromises()
    expect(button('确认保存到工程').attributes('disabled')).toBeDefined(); expect(editor.pendingFence).not.toBeNull()
    expect(writer.saveConfig).toHaveBeenCalledTimes(1); expect(wrapper!.text()).toContain('保存结果未知')
  })

  it('requires a new confirmation after changing any field and supports explicit dirty-form cancellation', async () => {
    const { editor, writer } = await setup(); await readAndOpen(); await editAndApprove()
    await wrapper!.get('textarea[aria-label="规范风格描述"]').setValue('再次变更')
    expect(editor.confirmed).toBe(false); await button('取消 / 返回').trigger('click'); await flushPromises()
    expect(editor.isOpen).toBe(true); await button('确认关闭').trigger('click'); await flushPromises()
    expect(editor.isOpen).toBe(false); expect(writer!.saveConfig).not.toHaveBeenCalled()
  })

  it('keeps preview-only behavior when a save provider is absent', async () => {
    const { editor } = await setup(undefined, { writer: null }); await readAndOpen()
    expect(wrapper!.text()).toContain('仅编辑预览'); expect(editor.contextValid).toBe(true)
    await editAndApprove(); expect(button('确认保存到工程').attributes('disabled')).toBeDefined(); expect(fetch).not.toHaveBeenCalled()
  })

  it('normalizes legacy deep links into the same workspace and preserves project choice through back/forward', async () => {
    const { router, selection, reader } = await setup(`/resources?project=${other}&step=1`)
    expect(router.currentRoute.value.path).toBe('/art-resources');expect(router.currentRoute.value.query.type).toBe('icon');expect(selection.project?.id).toBe(other)
    expect(wrapper!.getComponent({ name: 'ElSelect' }).props('modelValue')).toBe(other)
    await wrapper!.getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', id); await flushPromises()
    expect(router.currentRoute.value.query.project).toBe(id);expect(selection.project?.id).toBe(id)
    router.back();await vi.waitFor(()=>expect(router.currentRoute.value.query.project).toBe(other));await flushPromises();expect(selection.project?.id).toBe(other)
    router.forward();await vi.waitFor(()=>expect(router.currentRoute.value.query.project).toBe(id));await flushPromises();expect(selection.project?.id).toBe(id)
    await router.push(`/ai-icons?project=${other}`);await flushPromises();expect(router.currentRoute.value.path).toBe('/art-resources');expect(selection.project?.id).toBe(other)
    expect(reader.readConfig).not.toHaveBeenCalled()
  })

  it.each(['config', 'preview'] as const)('discards late %s reads from A after selecting B', async kind => {
    let finishConfig!: (value: AiResourceView) => void, finishPreview!: (value: AiReferencePreview) => void, signal: AbortSignal | undefined
    const reader: AiResourceReadProvider = { label: 'fixture late', readConfig: vi.fn(async () => resourceView()), previewReference: vi.fn<AiResourceReadProvider['previewReference']>((_id, _path, current) => { signal = current; return new Promise<AiReferencePreview>(resolve => { finishPreview = resolve }) }) }
    if (kind === 'config') reader.readConfig = vi.fn<AiResourceReadProvider['readConfig']>((_id, current) => { signal = current; return new Promise<AiResourceView>(resolve => { finishConfig = resolve }) })
    const { router, read } = await setup(undefined, { reader })
    await button('读取 / 刷新工程规范').trigger('click'); await flushPromises()
    if (kind === 'preview') { await button('预览此参考').trigger('click'); await flushPromises() }
    await router.push(`/resources?project=${other}&step=1`); await flushPromises(); expect(signal?.aborted).toBe(true)
    if (kind === 'config') finishConfig(resourceView()); else finishPreview({ ...referencePreview })
    await flushPromises(); expect(read.resource).toBeNull(); expect(read.preview).toBeNull(); expect(read.project?.id).toBe(other)
    expect(wrapper!.text()).not.toContain('明亮卡通'); expect(wrapper!.find('img').exists()).toBe(false)
  })

  it('does not present A’s late save as B’s receipt or issue a B read', async () => {
    let finish!: (value: AiResourceView) => void, sent!: AiResourceSaveInput, signal: AbortSignal | undefined
    const writer: AiResourceSaveProvider = { label: 'fixture late save', saveConfig: vi.fn<AiResourceSaveProvider['saveConfig']>((_id, input, current) => { sent = input; signal = current; return new Promise<AiResourceView>(resolve => { finish = resolve }) }) }
    const { router, editor, reader, read } = await setup(undefined, { writer }); await readAndOpen(); await editAndApprove(); await button('确认保存到工程').trigger('click')
    await vi.waitFor(() => expect(writer.saveConfig).toHaveBeenCalledTimes(1))
    await router.push(`/resources?project=${other}&step=1`); await flushPromises(); expect(signal?.aborted).toBe(true)
    finish(saveReceipt(id, sent)); await flushPromises()
    expect(editor.phase).toBe('unknown'); expect(editor.project?.id).toBe(id); expect(editor.contextValid).toBe(false)
    expect(read.project?.id).toBe(other); expect(read.resource).toBeNull(); expect(reader.readConfig).toHaveBeenCalledTimes(1)
    expect(button('确认保存到工程').attributes('disabled')).toBeDefined(); expect(wrapper!.text()).not.toContain('保存回执已核验')
  })

  it('invalidates replaced registrations and requires explicit reselection before using the new path', async () => {
    const { directory, selection, read, reader } = await setup(`/ai-icons?project=${id}`)
    await button('读取 / 刷新工程规范').trigger('click'); await flushPromises()
    directory.projects = projects.map(value => ({ ...value, path: `${value.path}-changed` })); await flushPromises()
    expect(selection.project).toBeNull(); expect(read.resource).toBeNull(); expect(button('读取 / 刷新工程规范').attributes('disabled')).toBeDefined()
    await wrapper!.getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', id); await flushPromises()
    expect(selection.project?.path).toBe('/fixture/A-changed'); expect(reader.readConfig).toHaveBeenCalledTimes(1)
  })

  it('deduplicates registration entry across aliases of the same workspace and never auto-reads config', async () => {
    const { source, reader, router } = await setup(undefined, { automatic: true, connected: false })
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(reader.readConfig).not.toHaveBeenCalled()
    await router.push(`/ai-icons?project=${id}`); await flushPromises()
    expect(source.loadProjects).toHaveBeenCalledTimes(1); expect(reader.readConfig).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps future stages disabled and ignores route step requests without issuing resource actions', async () => {
    const { reader, writer, router }=await setup()
    for(const step of [2,3,4,5,6]){
      await router.push(`/resources?project=${id}&step=${step}`);await flushPromises()
      const stages=wrapper!.findAll('nav[aria-label="资源生产步骤"] button')
      expect(stages).toHaveLength(6);expect(stages.slice(1).every(value=>value.attributes('disabled')!==undefined)).toBe(true)
      expect(wrapper!.get('[data-testid="art-current-stage"]').attributes('aria-label')).toBe('项目规范')
      expect(wrapper!.findComponent(AiJobsReadPanel).exists()).toBe(false)
    }
    expect(reader.readConfig).not.toHaveBeenCalled();expect(reader.previewReference).not.toHaveBeenCalled();expect(writer!.saveConfig).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
  })

  it('binds explicit task recovery to its real project and rejects a late history after project change', async () => {
    let finish!:(value:AiJobsView)=>void, signal:AbortSignal|undefined
    const jobs:AiJobsReadProvider={label:'fake task reader',readJobs:vi.fn((_id,current)=>{signal=current;return new Promise<AiJobsView>(resolve=>{finish=resolve})}),readStatus:vi.fn(),previewCandidate:vi.fn()}
    aiJobsReadProvider.value=jobs
    const {router}=await setup(`/resources?project=${id}&step=3`)
    expect(jobs.readJobs).not.toHaveBeenCalled();await button('继续已有任务').trigger('click');await flushPromises();await button('读取 / 刷新任务历史').trigger('click');await flushPromises()
    expect(jobs.readJobs).toHaveBeenCalledWith(id,expect.any(AbortSignal))
    await router.push(`/resources?project=${other}&step=4`);await flushPromises();expect(signal?.aborted).toBe(true)
    finish({schemaVersion:'companion-icons-v1',projectId:id,sourceRevision:'a'.repeat(40),jobs:[],profile:{id:'fake',maxAssets:2,candidatesPerAsset:1,submissionAttempts:1},schedulerEnabled:false,workerResident:false});await flushPromises()
    expect(wrapper!.findComponent(AiJobsReadPanel).exists()).toBe(false);expect(wrapper!.text()).not.toContain('原后台本次返回空任务历史')
    await button('继续已有任务').trigger('click');await flushPromises();expect(wrapper!.get('[data-testid="ai-jobs-read-panel"]').text()).toContain(other)
    expect(wrapper!.text()).toContain('尚未读取任务历史');expect(jobs.readJobs).toHaveBeenCalledTimes(1);expect(jobs.readStatus).not.toHaveBeenCalled();expect(jobs.previewCandidate).not.toHaveBeenCalled()
  })

  it('keeps separately confirmed reference uploads in the draft until configuration is saved', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 16, height: 16, close: vi.fn() })))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D)
    const normalized = 'c'.repeat(64)
    const uploader: AiReferenceUploadProvider = { label: 'fixture upload', waitForIdle: async () => {}, uploadReference: vi.fn<AiReferenceUploadProvider['uploadReference']>(async (_id, input): Promise<AiReferenceUploadReceipt> => {
      const sha = await sha256ReferenceBytes(Uint8Array.from(atob(input.base64), value => value.charCodeAt(0)))
      return { schemaVersion: 'companion-icons-v1', relativePath: `art/reference/companion/${normalized}.png`, sha256: normalized, width: 16, height: 16, mimeType: 'image/png', originalRelativePath: `art/reference/companion/original/${sha}.png`, originalSha256: sha }
    }) }
    aiReferenceUploadProvider.value = uploader
    const { editor, upload, writer, read } = await setup(); await readAndOpen()
    const bytes = pngBytes(16), file = new File([bytes], 'reference.png', { type: 'image/png' })
    Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.slice().buffer })
    const input = wrapper!.get('input[type="file"]'); Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change'); await vi.waitFor(() => expect(wrapper!.find('canvas').exists()).toBe(true)); await flushPromises()
    expect(button('确认上传本张参考图').attributes('disabled')).toBeDefined()
    await wrapper!.get('[aria-label="确认本次参考图上传"] input').setValue(true); await button('确认上传本张参考图').trigger('click')
    await vi.waitFor(() => expect(upload.receipt).not.toBeNull())
    expect(uploader.uploadReference).toHaveBeenCalledTimes(1); expect(writer!.saveConfig).not.toHaveBeenCalled()
    expect(editor.draft?.style.references).toContain(`art/reference/companion/${normalized}.png`)
    expect(read.resource?.config?.style.references).toEqual(['art/reference/a.png']); expect(editor.confirmed).toBe(false)
    expect(wrapper!.text()).toContain('项目配置尚未因此保存'); expect(fetch).not.toHaveBeenCalled()
  })
})


describe('original task six-step composition', () => {
  it('keeps one task panel across reached stages, blocks future jumps, and revokes inactive creation approval', async () => {
    const jobs:AiJobsReadProvider={label:'fake original jobs',waitForIdle:async()=>{},readJobs:vi.fn(async()=>({schemaVersion:'companion-icons-v1',projectId:id,sourceRevision:'a'.repeat(40),jobs:[],profile:{id:'local-icon-v1',maxAssets:2,candidatesPerAsset:1,submissionAttempts:1},workerResident:false,schedulerEnabled:false} as AiJobsView)),readStatus:vi.fn(),previewCandidate:vi.fn()}
    aiJobsReadProvider.value=jobs;aiTaskCreationProvider.value={label:'fake creation',inspect:vi.fn(),execute:vi.fn(),waitForIdle:async()=>{}}
    await setup(`/resources?project=${id}&step=3`);await button('继续已有任务').trigger('click');await flushPromises()
    const panel=wrapper!.getComponent(AiJobsReadPanel).element
    await button('读取 / 刷新任务历史').trigger('click');await flushPromises()
    const flow=wrapper!.findAllComponents(ArtProductionFlow)[0]!.vm as unknown as {chooseStep:(step:number)=>boolean}
    for(const future of [3,4,5])expect(flow.chooseStep(future)).toBe(false)
    expect(flow.chooseStep(0)).toBe(true);await flushPromises();expect(wrapper!.getComponent(AiTaskCreationPanel).props('active')).toBe(false)
    expect(flow.chooseStep(2)).toBe(true);await flushPromises();expect(wrapper!.getComponent(AiJobsReadPanel).element).toBe(panel)
    expect(wrapper!.getComponent(AiJobsReadPanel).text()).toContain('原后台本次返回空任务历史');expect(jobs.readJobs).toHaveBeenCalledTimes(1);expect(aiTaskCreationProvider.value.execute).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
  })
})
