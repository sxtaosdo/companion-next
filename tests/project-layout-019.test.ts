import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import browserViewSource from '../src/views/CompanionBrowserView.vue?raw'
import ProjectSetupWizard from '../src/components/ProjectSetupWizard.vue'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useProjectSetupStore } from '../src/stores/project-setup'
import { companionBrowserProvider, companionEventProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { creatorOperationsProvider, registerCreatorOperationsProvider } from '../src/creator-operations-integration'
import { projectSetupProvider, registerProjectSetupProvider } from '../src/project-setup-integration'
import type { CompanionBrowserProvider, LogRecord, ManagedStatus, ProjectRead } from '../src/domain/companion-browser'
import type { CreatorOperationsProvider } from '../src/domain/creator-operations'
import type { ProjectSetupProvider } from '../src/domain/project-setup'
import type { CompanionEventHandlers, CompanionEventProvider } from '../src/domain/companion-live'

// These are DOM, accessibility, and synthetic scroll tests, not browser layout or live-service evidence.
const readyId = '0123456789abcdef', stoppedId = '1123456789abcdef'
const unknownId = '2123456789abcdef', missingId = '3123456789abcdef'
const stoppedPreference = `project-card-expanded:${stoppedId}`
let wrapper: VueWrapper | undefined

function snapshot(): ProjectRead {
  return {
    projects: [
      { id: stoppedId, name: '已停止工程', path: 'D:\\Fixture\\Stopped', requiredCreatorVersion: '3.8.7' },
      { id: readyId, name: '就绪工程', path: 'D:\\Fixture\\Ready', requiredCreatorVersion: '3.8.8' },
      { id: unknownId, name: '未知工程', path: 'D:\\Fixture\\Unknown' },
      { id: missingId, name: '缺少状态工程', path: 'D:\\Fixture\\Missing' },
    ],
    statuses: [
      { projectId: readyId, state: 'ready', creatorVersion: '3.8.8', capabilityProfile: 'read-only' },
      { projectId: stoppedId, state: 'stopped', capabilityProfile: 'unknown' },
      { projectId: unknownId, state: 'unknown', capabilityProfile: 'unknown' },
    ],
    dashboard: [{ path: 'D:\\Fixture\\Unknown', name: '未知工程', source: 'dashboard', exists: true, running: true }], warnings: [],
  }
}
function log(index = 1): LogRecord {
  return { id: `log-${index}`, projectId: readyId, source: 'creator', level: 'info', time: '2026-10-15T04:00:00.000Z', message: `offline fixture line ${index}` }
}
async function setup(path = '/projects') {
  let data = snapshot()
  const reader: CompanionBrowserProvider = {
    label: 'OFFLINE layout fixture', runtimeProbesEnabled: true, dashboardDiscoveryEnabled: false,
    loadProjects: vi.fn(async () => data),
    loadCounts: vi.fn(async () => ({ sessionId: 'layout-session', counts: {}, latest: {} })),
    loadLogs: vi.fn(async () => [log()]),
    loadCalls: vi.fn(async () => ({ sessionId: 'layout-session', total: 0, retained: 0, records: [] })),
  }
  const actions: CreatorOperationsProvider = {
    label: 'OFFLINE action fixture',
    run: vi.fn<CreatorOperationsProvider['run']>(async () => ({ action: 'focus', acknowledged: true })),
    waitForIdle: vi.fn(async () => {}),
  }
  const setupApi: ProjectSetupProvider = {
    label: 'OFFLINE setup fixture',
    register: vi.fn(async () => ({ ...data.projects[0]! })),
    start: vi.fn(async () => ({ operationId: '12345678-1234-4234-8234-123456789abc' })),
    status: vi.fn(async () => ({ id: '12345678-1234-4234-8234-123456789abc', projectPath: data.projects[0]!.path, stage: 'registering' as const, startedAt: '2026-10-15T04:00:00.000Z', updatedAt: '2026-10-15T04:00:00.000Z' })),
    waitForIdle: vi.fn(async () => {}),
  }
  registerCompanionBrowserProvider(reader)
  registerCreatorOperationsProvider(actions)
  registerProjectSetupProvider(setupApi)
  const pinia = createPinia()
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/projects', component: CompanionBrowserView }] })
  await router.push(path)
  await router.isReady()
  const mountView = () => mount(CompanionBrowserView, { attachTo: document.body, global: { plugins: [pinia, router, ElementPlus] } })
  wrapper = mountView()
  await flushPromises()
  const store = useCompanionBrowserStore(pinia)
  await store.connect(reader)
  await flushPromises()
  return {
    reader, actions, setupApi, store, router, setupStore: useProjectSetupStore(pinia),
    setStatus(projectId: string, state: ManagedStatus['state']) {
      data = { ...data, statuses: data.statuses.map(status => status.projectId === projectId ? { ...status, state } : status) }
    },
    async remount() { wrapper!.unmount(); wrapper = mountView(); await flushPromises() },
  }
}
function card(id: string) {
  const result = wrapper!.findAll('.companion-project-card').find(candidate => candidate.findAll('code').some(code => code.text() === id))
  if (!result) throw new Error(`Missing project card ${id}`)
  return result
}
function button(label: string, root: Pick<DOMWrapper<Element>, 'findAll'> = wrapper!) {
  const result = root.findAll('button').find(candidate => candidate.text() === label || candidate.attributes('aria-label') === label)
  if (!result) throw new Error(`Missing button ${label}`)
  return result
}
function toggle(id: string) { return card(id).get('button[aria-expanded][aria-controls]') }
function latest() { return wrapper!.findAll('button').find(candidate => candidate.text().replace(/\s+/g, ' ') === '↓ 最新') }
function expectLatest(hidden: boolean) { expect(latest()?.isVisible() ?? false).toBe(!hidden) }
function scrollMetrics(pane: HTMLElement, height = 1000, client = 200, top = 0) {
  const metrics = { height, client, top }
  Object.defineProperties(pane, {
    scrollHeight: { configurable: true, get: () => metrics.height },
    clientHeight: { configurable: true, get: () => metrics.client },
    scrollTop: { configurable: true, get: () => metrics.top, set: value => { metrics.top = Math.max(0, Math.min(Number(value), metrics.height - metrics.client)) } },
    scrollTo: { configurable: true, value: vi.fn((options: ScrollToOptions) => { pane.scrollTop = options.top ?? 0; pane.dispatchEvent(new Event('scroll')) }) },
  })
  return metrics
}
afterEach(() => {
  wrapper?.unmount(); wrapper = undefined
  ElMessage.closeAll()
  projectSetupProvider.value = null; creatorOperationsProvider.value = null
  companionBrowserProvider.value = null; companionEventProvider.value = null
  vi.restoreAllMocks(); vi.useRealTimers(); sessionStorage.clear(); document.body.innerHTML = ''; document.documentElement.scrollTop = 0
})

describe('019 compact project card structure and safe controls', () => {
  it('keeps name, state, full identity, main action, and icon toggle in one header', async () => {
    const { actions, setupApi } = await setup()
    const stopped = card(stoppedId), header = stopped.get('.companion-project-header')
    expect(header.element.parentElement).toBe(stopped.element)
    for (const text of ['已停止工程', '已停止', stoppedId, '启动 Creator']) expect(header.text()).toContain(text)
    const expand = toggle(stoppedId)
    expect(header.element.contains(expand.element)).toBe(true)
    expect(expand.element.tagName).toBe('BUTTON')
    expect(expand.text()).toBe('')
    expect(expand.find('svg').exists()).toBe(true)
    expect(expand.attributes('aria-label')).toMatch(/展开/)
    expect(expand.attributes('aria-expanded')).toBe('false')
    expect(actions.run).not.toHaveBeenCalled()
    expect(setupApi.register).not.toHaveBeenCalled(); expect(setupApi.start).not.toHaveBeenCalled()
  })

  it('retains exact project data and all secondary actions in expanded compact details', async () => {
    const { reader, actions, setupApi } = await setup()
    await toggle(stoppedId).trigger('click'); await flushPromises()
    const stopped = card(stoppedId), expand = toggle(stoppedId)
    expect(expand.attributes('aria-expanded')).toBe('true')
    expect(expand.attributes('aria-label')).toMatch(/收起/)
    const details = document.getElementById(expand.attributes('aria-controls')!)
    expect(details).not.toBeNull(); expect(stopped.element.contains(details)).toBe(true)
    for (const label of ['聚焦 Creator', '停止 Creator', '重启 Creator', '安装 / 更新接入', '打开目录', '移除登记', '复制路径', '复制工程 ID', '使用 CLI', '查看调用记录']) {
      expect(button(label, stopped).exists()).toBe(true)
    }
    for (const text of ['D:\\Fixture\\Stopped', '当前 Creator', '未读取', '工程要求版本', '3.8.7', 'Creator 权限', 'unknown', '最近打开', '调用总数', '未记录', '原始状态', 'stopped']) expect(stopped.text()).toContain(text)
    expect(stopped.findAll('.companion-project-details dt')).toHaveLength(6)
    expect(reader.loadLogs).not.toHaveBeenCalled(); expect(reader.loadCalls).not.toHaveBeenCalled()
    expect(actions.run).not.toHaveBeenCalled(); expect(setupApi.start).not.toHaveBeenCalled()
  })

  it('keeps missing and unknown runtime distinct from stopped or ready and blocks direct start', async () => {
    const { actions } = await setup()
    expect(card(readyId).get('.companion-project-header').text()).toContain('已就绪')
    expect(button('打开 Creator', card(readyId)).attributes('disabled')).toBeUndefined()
    expect(button('启动 Creator', card(stoppedId)).attributes('disabled')).toBeUndefined()
    for (const id of [unknownId, missingId]) {
      const unknown = card(id), header = unknown.get('.companion-project-header')
      expect(header.text()).toContain('未知')
      expect(header.text()).not.toContain('已停止'); expect(header.text()).not.toContain('已就绪')
      expect(unknown.text()).toContain('调用总数'); expect(unknown.text()).toContain('未记录')
      expect(button('启动 Creator', unknown).attributes('disabled')).toBeDefined()
      await button('启动 Creator', unknown).trigger('click')
    }
    expect(actions.run).not.toHaveBeenCalled()
  })

  it('preserves explicit collapse for ready and stopped projects across remount and status changes', async () => {
    sessionStorage.setItem(`project-card-expanded:${readyId}`, '0')
    const { remount, reader, store, setStatus, actions, setupApi } = await setup()
    expect(toggle(readyId).attributes('aria-expanded')).toBe('false')
    expect(card(readyId).find('.companion-project-body').exists()).toBe(false)
    expect(toggle(readyId).attributes('disabled')).toBeUndefined()
    expect(button('打开 Creator', card(readyId)).attributes('disabled')).toBeUndefined()
    expect(toggle(stoppedId).attributes('aria-expanded')).toBe('false')
    await toggle(stoppedId).trigger('click'); await flushPromises()
    expect(sessionStorage.getItem(stoppedPreference)).toBe('1')
    await remount()
    expect(toggle(stoppedId).attributes('aria-expanded')).toBe('true')
    expect(toggle(readyId).attributes('aria-expanded')).toBe('false')
    await toggle(stoppedId).trigger('click'); await flushPromises()
    expect(sessionStorage.getItem(stoppedPreference)).toBe('0')
    setStatus(stoppedId, 'ready'); await store.refreshProjects(); await flushPromises()
    expect(card(stoppedId).find('.companion-project-body').exists()).toBe(false)
    expect(button('打开 Creator', card(stoppedId)).attributes('disabled')).toBeUndefined()
    await remount()
    expect(toggle(stoppedId).attributes('aria-expanded')).toBe('false')
    expect(reader.loadProjects).toHaveBeenCalledTimes(2)
    expect(actions.run).not.toHaveBeenCalled()
    expect(setupApi.register).not.toHaveBeenCalled(); expect(setupApi.start).not.toHaveBeenCalled()
  })

  it('defaults ready to expanded but lets repeated user toggles change only presentation', async () => {
    const { reader, actions, setupApi, store } = await setup()
    expect(toggle(readyId).attributes('aria-expanded')).toBe('true')
    const before = JSON.stringify(store.statuses)
    for (const expanded of ['false', 'true', 'false', 'true']) {
      await toggle(readyId).trigger('click'); await flushPromises()
      expect(toggle(readyId).attributes('aria-expanded')).toBe(expanded)
      expect(card(readyId).find('.companion-project-body').exists()).toBe(expanded === 'true')
      expect(card(readyId).get('.companion-project-header').text()).toContain('已就绪')
    }
    expect(JSON.stringify(store.statuses)).toBe(before)
    expect(reader.loadProjects).toHaveBeenCalledTimes(1)
    expect(actions.run).not.toHaveBeenCalled()
    expect(setupApi.register).not.toHaveBeenCalled(); expect(setupApi.start).not.toHaveBeenCalled()
  })

  it('keeps ready collapse usable when session storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked preference') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked preference') })
    const { store, actions } = await setup()
    await toggle(readyId).trigger('click'); await flushPromises()
    await store.refreshProjects(); await flushPromises()
    expect(toggle(readyId).attributes('aria-expanded')).toBe('false')
    expect(actions.run).not.toHaveBeenCalled()
  })

  it('nests registration in the connection toolbar and preserves the setup instance across tabs', async () => {
    const { router, setupStore, setupApi, reader } = await setup()
    const panel = wrapper!.get('[data-testid="project-setup-panel"]')
    expect(panel.element.closest('.companion-connect')).not.toBeNull()
    expect(panel.element.parentElement?.classList.contains('planner-import-actions')).toBe(true)
    const setupInstance = wrapper!.getComponent(ProjectSetupWizard).vm.$.uid
    const leave = vi.spyOn(setupStore, 'leave')
    await button('添加已有工程').trigger('click'); await flushPromises()
    const body = new DOMWrapper(document.body)
    await body.get('input[aria-label="已有工程绝对路径"]').setValue('D:\\Unsaved\\Input')
    for (const tab of ['logs', 'calls', 'projects']) {
      await router.push(tab === 'projects' ? '/projects' : `/projects?tab=${tab}`); await flushPromises()
      expect(wrapper!.getComponent(ProjectSetupWizard).vm.$.uid).toBe(setupInstance)
      expect(wrapper!.get('[data-testid="project-setup-panel"]').element).toBe(panel.element)
      expect((body.get('input[aria-label="已有工程绝对路径"]').element as HTMLInputElement).value).toBe('D:\\Unsaved\\Input')
    }
    expect(leave).not.toHaveBeenCalled()
    expect(setupApi.register).not.toHaveBeenCalled(); expect(setupApi.start).not.toHaveBeenCalled(); expect(setupApi.status).not.toHaveBeenCalled()
    expect(reader.loadLogs).not.toHaveBeenCalled(); expect(reader.loadCalls).not.toHaveBeenCalled()
  })
})

describe('019 compact log toolbar and local latest navigation', () => {
  it('puts all log filters, refresh, pause, and explanation in the same toolbar', async () => {
    const { reader } = await setup('/projects?tab=logs')
    const toolbar = wrapper!.get('.companion-log-toolbar')
    for (const label of ['日志工程筛选', '日志来源筛选', '日志级别筛选', '日志消息关键字']) expect(toolbar.find(`[aria-label="${label}"]`).exists()).toBe(true)
    for (const label of ['查询 / 刷新日志', '暂停实时日志', '日志范围说明']) expect(button(label, toolbar).exists()).toBe(true)
    expect(toolbar.findAll('button').some(item => item.text() === '滚到最新')).toBe(false)
    expectLatest(true)
    expect(reader.loadLogs).not.toHaveBeenCalled()
    await button('查询 / 刷新日志', toolbar).trigger('click'); await flushPromises()
    expect(reader.loadLogs).toHaveBeenCalledTimes(1)
    expect(wrapper!.get('.companion-log-pane').text()).toContain('offline fixture line 1')
  })

  it('shows latest only with overflow and more than 24px left below the viewport', async () => {
    await setup('/projects?tab=logs')
    await button('查询 / 刷新日志').trigger('click'); await flushPromises()
    const pane = wrapper!.get('.companion-log-pane'), metrics = scrollMetrics(pane.element as HTMLElement)
    await pane.trigger('scroll'); await flushPromises(); expectLatest(false)
    metrics.top = 775
    await pane.trigger('scroll'); await flushPromises(); expectLatest(false)
    metrics.top = 776
    await pane.trigger('scroll'); await flushPromises(); expectLatest(true)
    metrics.top = 800
    await pane.trigger('scroll'); await flushPromises(); expectLatest(true)
    metrics.height = 200; metrics.top = 0
    await pane.trigger('scroll'); await flushPromises(); expectLatest(true)
  })

  it.each([false, true])('provides keyboard-focusable latest navigation without reads or action replay, with paused=%s', async paused => {
    const { reader, store, actions, setupApi } = await setup('/projects?tab=logs')
    await button('查询 / 刷新日志').trigger('click'); await flushPromises()
    const pane = wrapper!.get('.companion-log-pane'), metrics = scrollMetrics(pane.element as HTMLElement)
    await pane.trigger('scroll'); await flushPromises()
    const jump = latest()!
    expect(jump).toBeDefined(); expect(jump.element.tagName).toBe('BUTTON')
    expect(jump.attributes('aria-label')).toMatch(/最新/)
    expect(jump.attributes('tabindex')).not.toBe('-1')
    expect(pane.element.parentElement?.contains(jump.element)).toBe(true)
    expect(wrapper!.get('.companion-log-toolbar').element.contains(jump.element)).toBe(false)
    ;(jump.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(jump.element)
    store.pauseLogs(paused)
    const pause = vi.spyOn(store, 'pauseLogs')
    const calls = [reader.loadProjects, reader.loadCounts, reader.loadLogs, reader.loadCalls].map(method => vi.mocked(method).mock.calls.length)
    await jump.trigger('click'); await flushPromises()
    expect(metrics.top).toBe(metrics.height - metrics.client)
    expectLatest(true)
    expect([reader.loadProjects, reader.loadCounts, reader.loadLogs, reader.loadCalls].map(method => vi.mocked(method).mock.calls.length)).toEqual(calls)
    expect(pause).not.toHaveBeenCalled(); expect(store.logsPaused).toBe(paused)
    expect(actions.run).not.toHaveBeenCalled(); expect(setupApi.register).not.toHaveBeenCalled(); expect(setupApi.start).not.toHaveBeenCalled()
  })

  it.each([[776, true], [775, false]] as const)('keeps original log-update sticking only near the old bottom, top=%s', async (top, sticks) => {
    const { store, reader } = await setup('/projects?tab=logs')
    await button('查询 / 刷新日志').trigger('click'); await flushPromises()
    const pane = wrapper!.get('.companion-log-pane'), metrics = scrollMetrics(pane.element as HTMLElement, 1000, 200, top)
    await pane.trigger('scroll'); await flushPromises()
    store.logs = [...store.logs, log(2)]
    // Vue's pre-render watcher sees the old dimensions; new layout is measured after its nextTick.
    queueMicrotask(() => { metrics.height = 1200 })
    await flushPromises()
    expect(metrics.top).toBe(sticks ? 1000 : top)
    expectLatest(sticks)
    expect(reader.loadLogs).toHaveBeenCalledTimes(1)
  })

  it('rechecks after rendered log changes and resize, and does not keep a stale button on tab return', async () => {
    const { store, router, reader } = await setup('/projects?tab=logs')
    await button('查询 / 刷新日志').trigger('click'); await flushPromises()
    const pane = wrapper!.get('.companion-log-pane'), metrics = scrollMetrics(pane.element as HTMLElement, 200, 200)
    await pane.trigger('scroll'); await flushPromises(); expectLatest(true)
    metrics.height = 1000
    store.logs = [...store.logs, log(2)]
    await flushPromises(); expectLatest(false)
    metrics.client = 1000
    window.dispatchEvent(new Event('resize')); await flushPromises(); expectLatest(true)
    metrics.client = 200
    window.dispatchEvent(new Event('resize')); await flushPromises(); expectLatest(false)
    await router.push('/projects?tab=calls'); await flushPromises(); expectLatest(true)
    await router.push('/projects?tab=logs'); await flushPromises(); expectLatest(true)
    expect(reader.loadLogs).toHaveBeenCalledTimes(1)
    expect(reader.loadCalls).not.toHaveBeenCalled()
  })
})

async function selectOption(label: string, option: string) {
  const input = wrapper!.get(`input[aria-label="${label}"]`)
  await input.trigger('click'); await flushPromises()
  const list = document.getElementById(input.attributes('aria-controls')!)
  if (!list) throw new Error(`Missing options for ${label}`)
  const target = new DOMWrapper(list).findAll('.el-select-dropdown__item').find(item => item.text() === option)
  if (!target) throw new Error(`Missing ${option} option for ${label}`)
  await target.trigger('click'); await flushPromises()
  await input.trigger('keydown', { key: 'Escape', code: 'Escape' }); await flushPromises()
}
async function enableFakeLive() {
  let handlers!: CompanionEventHandlers
  const close = vi.fn()
  const subscribe = vi.fn<CompanionEventProvider['subscribe']>(received => { handlers = received; return close })
  companionEventProvider.value = { label: 'OFFLINE live callbacks', subscribe }
  await flushPromises()
  await button('启用实时更新').trigger('click')
  handlers.onOpen(); await flushPromises()
  return { handlers, subscribe, close }
}

describe('019 reported title spacing and continuous live refresh regressions', () => {
  it('keeps the project title and explanation in the same compact inline-flex group', async () => {
    await setup()
    const heading = wrapper!.findAll('h2').find(item => item.text() === '工程')!
    const group = heading.element.parentElement!
    expect(group).not.toBe(group.closest('.section-heading'))
    expect(group.contains(button('工程操作说明').element)).toBe(true)
    expect(group.querySelectorAll('h2')).toHaveLength(1)
    expect(group.querySelectorAll('button')).toHaveLength(1)
    // CSS declaration evidence complements the DOM grouping; jsdom does not measure visual spacing.
    expect([...group.classList].some(name => new RegExp(`\\.${name}\\s*\\{[^}]*display\\s*:\\s*inline-flex(?:;|\\})`).test(browserViewSource))).toBe(true)
  })

  it('keeps cards, expansion, input, filters, scroll and route stable across slow serial live polls', async () => {
    vi.useFakeTimers()
    const { store, reader, router, actions, setupApi } = await setup()
    await toggle(stoppedId).trigger('click'); await flushPromises()
    const input = wrapper!.get('input[aria-label="搜索登记工程"]')
    await input.setValue('工程')
    await selectOption('工程状态筛选', '已停止')
    const statusInput = wrapper!.get('input[aria-label="工程状态筛选"]')
    const element = input.element as HTMLInputElement
    element.focus(); element.setSelectionRange(1, 2)
    const originalCard = card(stoppedId).element, originalBody = card(stoppedId).get('.companion-project-body').element
    const availability = card(stoppedId).get('.operation-availability').element
    const page = wrapper!.element
    document.documentElement.scrollTop = 240
    const push = vi.spyOn(router, 'push'), replace = vi.spyOn(router, 'replace')
    const requests: Array<{ finish: () => void; signal: AbortSignal | undefined }> = []
    let active = 0, maximumActive = 0
    vi.mocked(reader.loadProjects).mockImplementation(signal => new Promise(resolve => {
      active++; maximumActive = Math.max(active, maximumActive)
      const next = snapshot()
      if (requests.length > 0) next.statuses[0]!.creatorVersion = '3.8.9'
      requests.push({ signal, finish: () => { active--; resolve(next) } })
    }))
    const { subscribe, close } = await enableFakeLive()
    function unchanged() {
      expect(wrapper!.element).toBe(page)
      expect(card(stoppedId).element).toBe(originalCard)
      expect(card(stoppedId).get('.companion-project-body').element).toBe(originalBody)
      expect(card(stoppedId).get('.operation-availability').element).toBe(availability)
      expect(toggle(stoppedId).attributes('aria-expanded')).toBe('true')
      expect(sessionStorage.getItem(stoppedPreference)).toBe('1')
      expect(wrapper!.get('input[aria-label="搜索登记工程"]').element).toBe(element)
      expect(element.value).toBe('工程'); expect(document.activeElement).toBe(element)
      expect(element.selectionStart).toBe(1); expect(element.selectionEnd).toBe(2)
      expect(wrapper!.get('input[aria-label="工程状态筛选"]').element).toBe(statusInput.element)
      expect(statusInput.element.closest('.el-select')?.textContent).toContain('已停止')
      expect(wrapper!.findAll('.companion-project-card')).toHaveLength(1)
      expect(document.documentElement.scrollTop).toBe(240)
      expect(router.currentRoute.value.fullPath).toBe('/projects')
      expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
    }
    for (let round = 0; round < 3; round++) {
      await vi.advanceTimersByTimeAsync(round === 0 ? 0 : 3000); await flushPromises()
      expect(requests).toHaveLength(round + 1); expect(active).toBe(1)
      expect(store.projectLoading).toBe(true)
      expect(button('连接工程服务').classes()).not.toContain('is-loading')
      expect(button('连接工程服务').attributes('disabled')).toBeDefined()
      expect(button('启动 Creator', card(stoppedId)).attributes('disabled')).toBeDefined()
      expect(card(stoppedId).find('button[aria-label="工程操作暂不可用"]').exists()).toBe(false)
      unchanged()
      await button('刷新真实状态').trigger('click')
      await vi.advanceTimersByTimeAsync(9000); await flushPromises()
      expect(requests).toHaveLength(round + 1); expect(active).toBe(1)
      expect(requests[round]!.signal?.aborted).toBe(false)
      unchanged()
      requests[round]!.finish(); await flushPromises()
      expect(store.projectLoading).toBe(false); unchanged()
      expect(store.statuses.find(status => status.projectId === readyId)?.creatorVersion).toBe(round === 0 ? '3.8.8' : '3.8.9')
      expect(button('启动 Creator', card(stoppedId)).attributes('disabled')).toBeUndefined()
    }
    expect(maximumActive).toBe(1)
    expect(reader.loadProjects).toHaveBeenCalledTimes(4)
    expect(reader.loadCounts).toHaveBeenCalledTimes(2)
    expect(subscribe).toHaveBeenCalledTimes(1)
    expect(actions.run).not.toHaveBeenCalled(); expect(setupApi.register).not.toHaveBeenCalled(); expect(setupApi.start).not.toHaveBeenCalled()
    await button('停止实时更新').trigger('click')
    await vi.advanceTimersByTimeAsync(9000)
    expect(reader.loadProjects).toHaveBeenCalledTimes(4); expect(close).toHaveBeenCalledTimes(1)
    await button('刷新真实状态').trigger('click'); await flushPromises()
    expect(store.projectLoading).toBe(true)
    expect(button('连接工程服务').classes()).toContain('is-loading')
    expect(reader.loadProjects).toHaveBeenCalledTimes(5)
    requests[3]!.finish(); await flushPromises()
  })

  it('preserves log DOM, selected filters, typed search and away-from-bottom scroll through repeated live reads', async () => {
    vi.useFakeTimers()
    const { store, reader, router, actions, setupApi } = await setup('/projects?tab=logs')
    await selectOption('日志工程筛选', '就绪工程')
    await selectOption('日志来源筛选', 'creator')
    await selectOption('日志级别筛选', 'info')
    const input = wrapper!.get('input[aria-label="日志消息关键字"]')
    await input.setValue('offline')
    await button('查询 / 刷新日志').trigger('click'); await flushPromises()
    const pane = wrapper!.get('.companion-log-pane'), originalLog = pane.get('article').element
    const metrics = scrollMetrics(pane.element as HTMLElement, 1000, 200, 260)
    await pane.trigger('scroll'); await flushPromises()
    ;(input.element as HTMLInputElement).focus()
    const push = vi.spyOn(router, 'push'), replace = vi.spyOn(router, 'replace')
    const filters = JSON.parse(JSON.stringify(store.logFilter))
    const finish: Array<() => void> = []
    let active = 0, maximumActive = 0, sequence = 1
    vi.mocked(reader.loadLogs).mockImplementation(() => new Promise(resolve => {
      active++; maximumActive = Math.max(active, maximumActive)
      finish.push(() => { active--; resolve(Array.from({ length: ++sequence }, (_, index) => log(index + 1))) })
    }))
    const { handlers, subscribe } = await enableFakeLive()
    for (let round = 0; round < 3; round++) {
      for (let hint = 0; hint < 30; hint++) handlers.onLog()
      await vi.advanceTimersByTimeAsync(400); await flushPromises()
      expect(finish).toHaveLength(round + 1); expect(active).toBe(1)
      expect(store.logsLoading).toBe(true)
      expect(wrapper!.get('.companion-log-pane').element).toBe(pane.element)
      expect(pane.get('article').element).toBe(originalLog)
      expect(pane.text()).toContain('offline fixture line 1')
      if (round < 2) for (let hint = 0; hint < 30; hint++) handlers.onLog()
      await vi.advanceTimersByTimeAsync(900); await flushPromises()
      expect(finish).toHaveLength(round + 1)
      finish[round]!(); await flushPromises()
      expect(store.logsLoading).toBe(false)
      expect(wrapper!.get('.companion-log-pane').element).toBe(pane.element)
      expect(pane.get('article').element).toBe(originalLog)
      expect(metrics.top).toBe(260); expectLatest(false)
      expect(wrapper!.get('input[aria-label="日志消息关键字"]').element).toBe(input.element)
      expect((input.element as HTMLInputElement).value).toBe('offline')
      expect(document.activeElement).toBe(input.element)
      expect(store.logFilter).toEqual(filters)
      expect(router.currentRoute.value.fullPath).toBe('/projects?tab=logs')
      expect(push).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
    }
    expect(maximumActive).toBe(1); expect(reader.loadLogs).toHaveBeenCalledTimes(4)
    expect(subscribe).toHaveBeenCalledTimes(1); expect(reader.loadCalls).not.toHaveBeenCalled()
    expect(actions.run).not.toHaveBeenCalled(); expect(setupApi.register).not.toHaveBeenCalled(); expect(setupApi.start).not.toHaveBeenCalled()
  })
})

// Owner-approved 020 change: running no longer forces expanded details.
describe('020 running card collapse under live refresh', () => {
  it('preserves collapse through serial polls, state transitions, tab return and remount without lifecycle calls', async () => {
    vi.useFakeTimers()
    const { reader, actions, setupApi, setStatus, router, remount } = await setup()
    await toggle(readyId).trigger('click'); await flushPromises()
    const original = card(readyId).element
    await enableFakeLive()
    for (const state of ['ready', 'launching', 'ready'] as const) {
      setStatus(readyId, state)
      await vi.advanceTimersByTimeAsync(3000); await flushPromises()
      expect(card(readyId).element).toBe(original)
      expect(toggle(readyId).attributes('aria-expanded')).toBe('false')
      expect(card(readyId).find('.companion-project-body').exists()).toBe(false)
    }
    await router.push('/projects?tab=logs'); await flushPromises()
    await router.push('/projects'); await flushPromises()
    expect(toggle(readyId).attributes('aria-expanded')).toBe('false')
    await remount()
    expect(toggle(readyId).attributes('aria-expanded')).toBe('false')
    expect(vi.mocked(reader.loadProjects).mock.calls.length).toBeGreaterThanOrEqual(4)
    expect(actions.run).not.toHaveBeenCalled()
    expect(setupApi.register).not.toHaveBeenCalled(); expect(setupApi.start).not.toHaveBeenCalled()
  })
})
