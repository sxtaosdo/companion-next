import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import App from '../src/App.vue'
import { routes } from '../src/router'
import { companionBrowserProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { aiResourceReadProvider } from '../src/ai-resource-read-integration'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useRegisteredProjectStore } from '../src/stores/registered-project'
import { useWorkspaceStore } from '../src/stores/workspace'
import { useAiResourceReadStore } from '../src/stores/ai-resource-read'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import type { CompanionBrowserProvider, ProjectRead } from '../src/domain/companion-browser'
import type { AiResourceReadProvider, AiResourceView } from '../src/domain/ai-resource-read'
import { resourceView } from './fixtures/ai-resource-read'
import { allowsLegacyWorkspace } from '../src/domain/project-workspace'
const id = '0123456789abcdef', other = 'fedcba9876543210'
const projects = [{ id, name: '实际工程甲', path: '/real/project-a', requiredCreatorVersion: '3.8.8' }, { id: other, name: '实际工程乙', path: '/real/project-b' }]
const result = (): ProjectRead => ({ projects: structuredClone(projects), statuses: [{ projectId: id, state: 'ready', capabilityProfile: 'authoring' }], dashboard: [{ path: '/discovered-only', name: '未登记发现工程', exists: true, source: 'dashboard' }], warnings: [] })
const source = (): CompanionBrowserProvider => ({ label: '实际登记只读来源', runtimeProbesEnabled: true, dashboardDiscoveryEnabled: false, loadProjects: vi.fn(async () => result()), loadCounts: vi.fn(async () => ({ sessionId: 's1', counts: {}, latest: {} })), loadLogs: vi.fn(async () => []), loadCalls: vi.fn() })
const configApi = (): AiResourceReadProvider => ({ label: '原配置接口', readConfig: vi.fn(async () => resourceView()), previewReference: vi.fn() })
let wrapper: VueWrapper | undefined
let history: ReturnType<typeof createMemoryHistory> | undefined
async function setup(path = '/overview', options: { source?: CompanionBrowserProvider; connect?: boolean; automatic?: boolean; demo?: boolean; locked?: boolean } = {}) {
  const pinia = createPinia(), api = options.source ?? source()
  registerCompanionBrowserProvider(api, undefined, options.automatic ? { projectEntry: 'read' } : {})
  const directory = useCompanionBrowserStore(pinia), workspace = useWorkspaceStore(pinia), lane = useProjectOperationLaneStore(pinia)
  const lease = options.locked ? lane.acquire('test operation') : null
  if (options.connect !== false) await directory.connect(api)
  if (options.demo) await workspace.openDemo()
  const router = createRouter({ history: history = createMemoryHistory(), routes })
  await router.push(path); await router.isReady()
  wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia, router, ElementPlus] } })
  await flushPromises()
  return { pinia, api, directory, router, workspace, lane, lease, selection: useRegisteredProjectStore(pinia), reader: useAiResourceReadStore(pinia), operations: useCreatorOperationsStore(pinia) }
}
function button(label: string) { const target = wrapper!.findAll('button').find(item => item.text().includes(label)); if (!target) throw Error(label); return target }
beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', vi.fn()) })
afterEach(() => { wrapper?.unmount(); wrapper = undefined; history?.destroy(); history = undefined; companionProjectEntryProvider.value = null; companionBrowserProvider.value = null; aiResourceReadProvider.value = null; document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks() })
describe('registered project overview and resource context', () => {
  it('opens overview by default and places it first, while preserving direct routes', async () => {
    const { router } = await setup('/')
    expect(router.currentRoute.value.path).toBe('/overview')
    expect(wrapper!.findAll('.nav-list .nav-item')[0]!.attributes('href')).toBe(`/overview?project=${id}`)
    for (const path of ['/projects?tab=logs', `/resources?project=${other}&step=6`, '/help?topic=cli']) {
      await router.push(path); await flushPromises(); expect(router.currentRoute.value.fullPath).toBe(path)
    }
  })
  it('selects the first real overview project after the entry read, preserves it on reorder and invalidates removal', async () => {
    let finish!: (value: ProjectRead) => void
    const api = source(); api.loadProjects = vi.fn(() => new Promise<ProjectRead>(resolve => finish = resolve))
    const { selection, directory, router } = await setup('/overview', { source: api, connect: false, automatic: true })
    expect(selection.project).toBeNull()
    finish(result()); await flushPromises()
    expect(selection.project?.id).toBe(id)
    expect(wrapper!.find('[data-testid="registered-project-overview"]').text()).toContain(projects[0]!.name)
    expect(router.currentRoute.value.query.project).toBeUndefined()
    directory.projects = [projects[1]!, projects[0]!]; await flushPromises()
    expect(selection.project?.id).toBe(id)
    directory.projects = [projects[1]!]; await flushPromises()
    expect(selection.project).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('shows each project path and ID once and keeps selected-project resource links without placeholder metrics', async () => {
    const { router } = await setup(`/overview?project=${id}`)
    const overview = wrapper!.get('.registered-overview')
    expect(overview.text().split(projects[0]!.path)).toHaveLength(2)
    expect(overview.text().split(id)).toHaveLength(2)
    expect(overview.text()).not.toContain('CURRENT PROJECT')
    expect(overview.text()).not.toContain('Owner 资产与运行验收')
    expect(overview.text()).not.toContain('资源清单')
    const detail = wrapper!.get('[data-testid="registered-project-overview"]')
    expect(detail.text()).toContain('3.8.8')
    expect(detail.find('a.hero-link').attributes('href')).toBe(`/resources?project=${id}`)
    await detail.find('a.hero-link').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.query.project).toBe(id)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('retains B through AI, engineering, knowledge and models navigation before returning to resources or overview', async () => {
    const { selection, router } = await setup(`/overview?project=${other}`)
    const go = async (path: string) => { await wrapper!.get(`.sidebar a[href^="${path}"]`).trigger('click'); await flushPromises(); expect(selection.project?.id).toBe(other) }
    await go('/ai-icons')
    expect(router.currentRoute.value.query.project).toBe(other)
    await go('/projects')
    await go('/knowledge')
    await wrapper!.get('.sidebar a[href="/knowledge?tab=models"]').trigger('click'); await flushPromises()
    expect(selection.project?.id).toBe(other)
    expect(wrapper!.get('.sidebar a[href^="/resources"]').attributes('href')).toBe(`/resources?project=${other}`)
    await go('/resources')
    expect(router.currentRoute.value.query.project).toBe(other)
    await go('/overview')
    expect(router.currentRoute.value.query.project).toBe(other)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('ignores outgoing page queries but restores exact project intent through browser back and forward', async () => {
    const { selection, router } = await setup(`/overview?project=${other}`)
    await router.push(`/ai-icons?project=${other}`); await flushPromises()
    await router.push('/help?topic=cli'); await flushPromises(); expect(selection.project?.id).toBe(other)
    await router.push('/projects'); await flushPromises(); expect(selection.project?.id).toBe(other)
    router.back(); await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/help')); await flushPromises(); expect(selection.project?.id).toBe(other)
    router.back(); await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/ai-icons')); await flushPromises(); expect(selection.project?.id).toBe(other)
    router.forward(); await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/help')); await flushPromises(); expect(selection.project?.id).toBe(other)
    await router.push(`/resources?project=${id}&step=1`); await flushPromises(); expect(selection.project?.id).toBe(id)
    router.back(); await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/help')); await flushPromises(); expect(selection.project?.id).toBe(id)
    router.back(); await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/ai-icons')); await flushPromises(); expect(selection.project?.id).toBe(other)
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each(['not-registered', '', 'x'.repeat(129)])('preserves explicit invalid overview intent across engineering and help without defaulting: %s', async intent => {
    const { selection, router } = await setup(`/overview?project=${encodeURIComponent(intent)}`)
    expect(selection.project).toBeNull()
    await router.push('/projects'); await flushPromises()
    await router.push('/help'); await flushPromises()
    const target = wrapper!.get('.sidebar a[href^="/overview"]')
    await target.trigger('click'); await flushPromises()
    expect(router.currentRoute.value.query.project).toBe(intent)
    expect(selection.project).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('preserves pending explicit B intent when leaving before registration arrives', async () => {
    let finish!: (value: ProjectRead) => void
    const api = source(); api.loadProjects = vi.fn(() => new Promise<ProjectRead>(resolve => finish = resolve))
    const { selection, router } = await setup(`/overview?project=${other}`, { source: api, connect: false, automatic: true })
    expect(selection.project).toBeNull()
    await router.push('/help'); await flushPromises()
    expect(wrapper!.get('.sidebar a[href^="/overview"]').attributes('href')).toBe(`/overview?project=${other}`)
    finish(result()); await flushPromises()
    await wrapper!.get('.sidebar a[href^="/overview"]').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.query.project).toBe(other)
    finish(result()); await flushPromises()
    expect(selection.project?.id).toBe(other)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('does not substitute a default for an explicit unknown or empty overview project', async () => {
    const { selection, router } = await setup('/overview?project=not-registered')
    expect(selection.project).toBeNull()
    await router.push('/overview?project='); await flushPromises()
    expect(selection.project).toBeNull()
  })
  it.each(['/overview?project', '/overview?project=' + 'x'.repeat(129)])('does not turn malformed explicit overview intent into a default: %s', async path => {
    const { selection } = await setup(path)
    expect(selection.project).toBeNull()
    expect(wrapper!.find('[data-testid="registered-project-overview"]').exists()).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('waits through an empty registration snapshot and binds the first arriving real project only once', async () => {
    const api = source(); api.loadProjects = vi.fn(async () => ({ ...result(), projects: [] }))
    const { selection, directory } = await setup('/overview', { source: api })
    expect(selection.project).toBeNull()
    directory.projects = [projects[1]!, projects[0]!]; await flushPromises()
    expect(selection.project?.id).toBe(other)
    directory.projects = [projects[0]!, projects[1]!]; await flushPromises()
    expect(selection.project?.id).toBe(other)
    directory.projects = [projects[0]!]; await flushPromises()
    directory.projects = [projects[1]!, projects[0]!]; await flushPromises()
    expect(selection.project).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
  it('honors a later explicit choice instead of the pending default when the entry read arrives', async () => {
    let finish!: (value: ProjectRead) => void
    const api = source(); api.loadProjects = vi.fn(() => new Promise<ProjectRead>(resolve => finish = resolve))
    const { selection, router } = await setup('/overview', { source: api, connect: false, automatic: true })
    await router.replace(`/overview?project=${other}`); await flushPromises()
    finish(result()); await flushPromises()
    expect(selection.project?.id).toBe(other)
    expect(router.currentRoute.value.query.project).toBe(other)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('lists every real registration and opens a selected overview without starting Creator or showing discovered/sample projects', async () => {
    const { router, selection, operations } = await setup('/overview', { demo: true })
    const actions: string[] = []; const stop = operations.$onAction(({ name }) => actions.push(name))
    expect(wrapper!.findAll('.registered-project-card')).toHaveLength(2)
    expect(wrapper!.text()).not.toContain('未登记发现工程'); expect(wrapper!.text()).not.toContain('宝石')
    expect(wrapper!.text()).not.toContain('查看示例资料'); expect(wrapper!.find('.metrics-grid').exists()).toBe(false)
    await wrapper!.get(`[data-project-id="${other}"]`).trigger('click'); await flushPromises()
    expect(router.currentRoute.value.query.project).toBe(other); expect(selection.project?.path).toBe('/real/project-b')
    expect(wrapper!.find('[data-testid="registered-project-overview"]').text()).toContain('实际工程乙')
    expect(wrapper!.find('[data-testid="registered-project-overview"]').text()).toContain('未知')
    expect(wrapper!.text()).not.toContain('已停止'); expect(actions).toEqual([]); expect(fetch).not.toHaveBeenCalled(); stop()
  })
  it.each(['ctrlKey', 'metaKey', 'altKey', 'shiftKey', 'non-primary', 'prevented'] as const)('does not change the original tab selection for a %s card click', async kind => {
    const { selection, router } = await setup(`/overview?project=${id}`)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: kind === 'non-primary' ? 2 : 0, ...(kind.endsWith('Key') ? { [kind]: true } : {}) })
    if (kind === 'prevented') event.preventDefault()
    // Suppress jsdom's external navigation after the component's own handler.
    wrapper!.element.addEventListener('click', (value: Event) => value.preventDefault(), { once: true })
    wrapper!.get(`[data-project-id="${other}"]`).element.dispatchEvent(event)
    await flushPromises(); expect(selection.project?.id).toBe(id); expect(router.currentRoute.value.query.project).toBe(id)
  })
  it('changes real projects through the selector, clears prior config, and restores the route through back/forward', async () => {
    const config = configApi(); aiResourceReadProvider.value = config
    const { router, reader, selection } = await setup(`/resources?project=${id}&step=1`)
    await button('读取 / 刷新工程规范').trigger('click'); await flushPromises(); expect(reader.resource).not.toBeNull()
    await wrapper!.getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', other); await flushPromises()
    expect(selection.project?.id).toBe(other); expect(reader.resource).toBeNull(); expect(config.readConfig).toHaveBeenCalledTimes(1)
    router.back(); await vi.waitFor(() => expect(router.currentRoute.value.query.project).toBe(id)); await flushPromises()
    expect(selection.project?.id).toBe(id); expect(reader.resource).toBeNull()
    router.forward(); await vi.waitFor(() => expect(router.currentRoute.value.query.project).toBe(other)); await flushPromises()
    expect(selection.project?.id).toBe(other); expect(reader.resource).toBeNull(); expect(config.readConfig).toHaveBeenCalledTimes(1)
  })
  it('keeps local entry empty until explicitly choosing samples, and removes them when a real reader is registered', async () => {
    const pinia = createPinia(), router = createRouter({ history: history = createMemoryHistory(), routes })
    await router.push('/resources'); await router.isReady()
    wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia, router, ElementPlus] } }); await flushPromises()
    expect(wrapper!.text()).toContain('请先选择已登记工程'); expect(wrapper!.findAll('.resource-row')).toHaveLength(0)
    await button('查看示例工作台').trigger('click'); await flushPromises(); expect(wrapper!.findAll('.resource-row')).toHaveLength(5)
    const api = source(); registerCompanionBrowserProvider(api); await useCompanionBrowserStore(pinia).connect(api); await flushPromises()
    expect(wrapper!.findAll('.resource-row')).toHaveLength(0); expect(useWorkspaceStore(pinia).mode).toBe('disconnected')
    expect(wrapper!.text()).not.toContain('查看示例工作台'); expect(fetch).not.toHaveBeenCalled()
  })
  it('does not offer samples in a dedicated build when the host reader is unavailable', async () => {
    vi.stubEnv('MODE', 'companion-workspace')
    const pinia = createPinia(), router = createRouter({ history: history = createMemoryHistory(), routes })
    await router.push('/overview'); await router.isReady()
    wrapper = mount(App, { global: { plugins: [pinia, router, ElementPlus] } }); await flushPromises()
    expect(wrapper!.text()).toContain('当前宿主未接入 Companion 工程读取接口')
    expect(wrapper!.text()).not.toContain('查看示例'); expect(useWorkspaceStore(pinia).project).toBeUndefined(); expect(fetch).not.toHaveBeenCalled()
  })
  it('preserves selected real identity into resources and across step changes without sample resources or fabricated counts', async () => {
    const { router, workspace } = await setup(`/overview?project=${id}`, { demo: true })
    expect(workspace.mode).toBe('disconnected')
    await wrapper!.get('.supplementary-nav a[href^="/resources"]').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.query.project).toBe(id); expect(wrapper!.find('.real-resource-identity').text()).toContain('/real/project-a')
    expect(wrapper!.findAll('.resource-row')).toHaveLength(0); expect(wrapper!.findAll('img')).toHaveLength(0)
    expect(wrapper!.text()).toContain('尚未读取任务历史')
    for (let index = 0; index < 6; index++) {
      await wrapper!.findAll('.resource-steps button')[index]!.trigger('click'); await flushPromises()
      expect(router.currentRoute.value.query.project).toBe(id); expect(router.currentRoute.value.query.step).toBe(String(index + 1))
      expect(wrapper!.findAll('.resource-steps button.active')).toHaveLength(1)
    }
    expect(fetch).not.toHaveBeenCalled()
  })
  it('restores a real project and step from a direct resource link, never choosing the first project', async () => {
    const { selection, router } = await setup(`/resources?project=${other}&step=4`)
    expect(selection.project?.id).toBe(other)
    expect(wrapper!.find('.resource-steps button.active').text()).toContain('视觉审阅')
    await router.push('/resources?project=not-registered&step=2'); await flushPromises()
    expect(selection.project).toBeNull(); expect(wrapper!.text()).toContain('所选工程不可用')
    expect(wrapper!.find('.real-resource-identity').exists()).toBe(false)
  })
  it('does not create a selection from duplicated or missing query parameters', async () => {
    const { router, selection } = await setup(`/overview?project=${id}&project=${other}`)
    expect(selection.project).toBeNull()
    await router.push('/resources'); await flushPromises(); expect(selection.project).toBeNull()
    expect(wrapper!.text()).toContain('请先选择已登记工程')
  })
  it('restores a pending deep link only after a real entry response and makes no AI/resource/write requests', async () => {
    let finish!: (value: ProjectRead) => void
    const api = source(); api.loadProjects = vi.fn(() => new Promise<ProjectRead>(resolve => finish = resolve))
    const config = configApi(); aiResourceReadProvider.value = config
    const { selection, directory } = await setup(`/resources?project=${other}&step=1`, { source: api, connect: false, automatic: true })
    expect(selection.project).toBeNull(); expect(directory.projectLoading).toBe(true)
    finish(result()); await flushPromises()
    expect(selection.project?.id).toBe(other); expect(api.loadProjects).toHaveBeenCalledTimes(1)
    expect(config.readConfig).not.toHaveBeenCalled(); expect(config.previewReference).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('waits for the real entry snapshot when a new deep-link ID is absent from an older connected cache', async () => {
    let finish!: (value: ProjectRead) => void
    const api = source()
    api.loadProjects = vi.fn<CompanionBrowserProvider['loadProjects']>()
      .mockResolvedValueOnce({ ...result(), projects: [projects[0]!] })
      .mockImplementationOnce(() => new Promise<ProjectRead>(resolve => finish = resolve))
    const { selection } = await setup(`/resources?project=${other}&step=1`, { source: api, automatic: true })
    expect(selection.project).toBeNull(); expect(api.loadProjects).toHaveBeenCalledTimes(2)
    finish(result()); await flushPromises(); expect(selection.project?.id).toBe(other)
    expect(wrapper!.find('.real-resource-identity').text()).toContain('/real/project-b')
  })
  it('uses the existing entry guard and does not retry when a project-operation lane is released', async () => {
    const { api, lane, lease, router } = await setup('/overview', { connect: false, automatic: true, locked: true })
    expect(api.loadProjects).not.toHaveBeenCalled()
    lane.release(lease!); await flushPromises(); expect(api.loadProjects).not.toHaveBeenCalled()
    await router.push('/help'); await router.push('/overview'); await flushPromises()
    expect(api.loadProjects).toHaveBeenCalledTimes(1)
  })
  it('cancels a pending normal entry read on leaving and ignores its late registered-project response', async () => {
    let finish!: (value: ProjectRead) => void, signal: AbortSignal | undefined
    const api = source(); api.loadProjects = vi.fn(current => { signal = current; return new Promise<ProjectRead>(resolve => finish = resolve) })
    const { router, directory } = await setup('/overview', { source: api, connect: false, automatic: true })
    await router.push('/help'); await flushPromises(); expect(signal?.aborted).toBe(true)
    finish(result()); await flushPromises(); expect(directory.projects).toEqual([]); expect(api.loadCounts).not.toHaveBeenCalled()
  })
  it('never retries a failed automatic entry in place', async () => {
    const api = source(); api.loadProjects = vi.fn(async () => { throw Error('只读读取失败') })
    await setup('/overview', { source: api, connect: false, automatic: true })
    await flushPromises(); expect(api.loadProjects).toHaveBeenCalledTimes(1); expect(wrapper!.text()).toContain('工程读取失败')
  })
  it('shows no demo fallback on registration failure or an empty real registration', async () => {
    const api = source(); api.loadProjects = vi.fn(async () => { throw Error('登记读取失败') })
    const { directory } = await setup('/overview', { source: api })
    expect(wrapper!.text()).toContain('工程读取失败'); expect(wrapper!.findAll('.registered-project-card')).toHaveLength(0)
    expect(wrapper!.text()).not.toContain('查看示例工作台')
    api.loadProjects = vi.fn(async () => ({ projects: [], statuses: [], dashboard: [], warnings: [] }))
    await directory.connect(api); await flushPromises()
    expect(wrapper!.text()).toContain('尚无已登记工程'); expect(wrapper!.text()).toContain('0 个工程')
  })
  it('invalidates removed or same-ID path-replaced projects until explicit reselection', async () => {
    const { directory, selection, router } = await setup(`/overview?project=${id}`)
    directory.projects = [{ ...projects[0]!, path: '/another/project' }, projects[1]!]; await flushPromises()
    expect(selection.project).toBeNull(); expect(wrapper!.find('[data-testid="registered-project-overview"]').exists()).toBe(false)
    await wrapper!.get(`[data-project-id="${id}"]`).trigger('click'); await flushPromises()
    expect(router.currentRoute.value.query.project).toBe(id); expect(selection.project?.path).toBe('/another/project')
    directory.projects = [projects[1]!]; await flushPromises(); expect(selection.project).toBeNull()
    expect(wrapper!.findAll('.registered-project-card')).toHaveLength(1)
  })
  it('manual registration refresh retains identical selection but invalidates a changed path without choosing another project', async () => {
    const { api, selection } = await setup(`/overview?project=${id}`)
    await wrapper!.get('button[aria-label="刷新登记工程"]').trigger('click'); await flushPromises()
    expect(selection.project?.id).toBe(id); expect(api.loadProjects).toHaveBeenCalledTimes(2)
    api.loadProjects = vi.fn(async () => ({ ...result(), projects: [{ ...projects[0]!, path: '/replacement' }, projects[1]!] }))
    await wrapper!.get('button[aria-label="刷新登记工程"]').trigger('click'); await flushPromises()
    expect(selection.project).toBeNull(); expect(wrapper!.findAll('.registered-project-card')).toHaveLength(2)
    expect(wrapper!.find('[data-testid="registered-project-overview"]').exists()).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('rejects same-ID source replacement without silently reopening the prior selection', async () => {
    const { directory, selection } = await setup(`/overview?project=${id}`)
    const next = source(); registerCompanionBrowserProvider(next); await directory.connect(next); await flushPromises()
    expect(selection.project).toBeNull()
    await wrapper!.get(`[data-project-id="${id}"]`).trigger('click'); await flushPromises(); expect(selection.project?.id).toBe(id)
  })
  it('keeps dedicated modes closed to sample entry even if their host provider is missing', () => {
    for (const mode of ['companion-workspace', 'companion-readonly', 'companion-config-editor', 'companion-knowledge-chat']) expect(allowsLegacyWorkspace(mode, false)).toBe(false)
    expect(allowsLegacyWorkspace('production', true)).toBe(false); expect(allowsLegacyWorkspace('development', false)).toBe(true)
  })
  it('keeps passive registration manual and preserves unknown runtime', async () => {
    const api = { ...source(), runtimeProbesEnabled: false }
    const { selection } = await setup(`/overview?project=${other}`, { source: api, connect: false, automatic: true })
    expect(api.loadProjects).not.toHaveBeenCalled(); expect(selection.project).toBeNull()
    await button('连接工程服务').trigger('click'); await flushPromises(); expect(selection.project?.id).toBe(other)
    expect(wrapper!.find('[data-testid="registered-project-overview"]').text()).toContain('运行状态未探测')
  })
})
describe('real saved config remains separate from local drafts', () => {
  it('requires explicit config read and displays only saved content, with no preview/generation/write', async () => {
    const api = configApi(); aiResourceReadProvider.value = api
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const { workspace, reader } = await setup(`/resources?project=${id}&step=1`)
    expect(api.readConfig).not.toHaveBeenCalled()
    await button('读取 / 刷新工程规范').trigger('click'); await flushPromises()
    expect(api.readConfig).toHaveBeenCalledWith(id, expect.any(AbortSignal))
    expect(wrapper!.text()).toContain('已保存 · 配置有效'); expect(wrapper!.text()).toContain('明亮卡通'); expect(reader.resource?.config).not.toBeNull()
    expect(workspace.project).toBeUndefined(); expect(workspace.spec).toBeUndefined(); expect(api.previewReference).not.toHaveBeenCalled()
    expect(storageWrite).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  })
  it('does not turn missing config or a suggested draft into saved content', async () => {
    const api = configApi(), value = resourceView()
    value.state = 'missing'; value.config = null; value.version = null; value.hash = null
    value.draft.iconSize = { width: 0, height: 0 }; value.draft.style = { description: '', references: [] }; value.draft.destination.exportDirectory = 'art/final/companion'
    api.readConfig = vi.fn(async () => value); aiResourceReadProvider.value = api
    await setup(`/resources?project=${id}&step=1`)
    await button('读取 / 刷新工程规范').trigger('click'); await flushPromises()
    expect(wrapper!.text()).toContain('工程尚无资源配置'); expect(wrapper!.text()).toContain('后台建议草稿未保存')
    expect(wrapper!.text()).not.toContain('已保存 · 配置有效'); expect(wrapper!.findAll('.resource-row')).toHaveLength(0)
  })
  it.each(['project', 'source', 'path', 'disconnect', 'unmount', 'reader'] as const)('discards an uncooperative late config response after %s changes', async change => {
    const api = configApi(); let finish!: (value: AiResourceView) => void, signal: AbortSignal | undefined
    api.readConfig = vi.fn((_id, current) => { signal = current; return new Promise<AiResourceView>(resolve => finish = resolve) }); aiResourceReadProvider.value = api
    const { directory, reader, router } = await setup(`/resources?project=${id}&step=1`)
    await button('读取 / 刷新工程规范').trigger('click')
    if (change === 'project') await router.replace(`/resources?project=${other}&step=1`)
    if (change === 'source') registerCompanionBrowserProvider(source())
    if (change === 'path') directory.projects = [{ ...projects[0]!, path: '/changed' }, projects[1]!]
    if (change === 'disconnect') directory.disconnect()
    if (change === 'unmount') { wrapper!.unmount(); wrapper = undefined }
    if (change === 'reader') aiResourceReadProvider.value = configApi()
    await flushPromises(); expect(signal?.aborted).toBe(true)
    finish(resourceView()); await flushPromises(); expect(reader.resource).toBeNull(); expect(reader.loading).toBe(false)
    expect(api.readConfig).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled()
  })
})
