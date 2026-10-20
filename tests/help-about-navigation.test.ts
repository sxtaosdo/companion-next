import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter, createWebHashHistory } from 'vue-router'
import type { RouterHistory } from 'vue-router'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import App from '../src/App.vue'
import { routes } from '../src/router'
import { frontendIdentity, helpTopics, legacyReference, migrationFeatures } from '../src/domain/product-information'
import legacyHelp from '../src/domain/legacy-v148-help.json'
import { CHANGELOG } from '../src/domain/legacy-v148-changelog'
import packageInfo from '../package.json'
import lock from '../package-lock.json'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { companionBrowserProvider } from '../src/companion-browser-integration'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import { useWorkspaceStore } from '../src/stores/workspace'
import { useResourcePlanningStore } from '../src/stores/resource-planning'
import { useImageReviewStore } from '../src/stores/image-review'
import { imageReviewProvider, registerImageReviewProvider } from '../src/image-review-integration'
import type { ImageReviewProvider } from '../src/domain/image-review'
let wrapper: VueWrapper | undefined
let activeHistory: RouterHistory | undefined
async function setup(path = '/help', history: RouterHistory = createMemoryHistory()) {
  activeHistory = history
  const pinia = createPinia(); const router = createRouter({ history, routes })
  await router.push(path); await router.isReady()
  wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia, router, ElementPlus] } }); await flushPromises()
  return { router, directory: useCompanionBrowserStore(pinia), workspace: useWorkspaceStore(pinia), planning: useResourcePlanningStore(pinia), review: useImageReviewStore(pinia) }
}
async function setupBrowser(path: string) {
  window.history.replaceState(null, '', '/')
  return setup(path, createWebHashHistory())
}
function button(label: string) { const found = wrapper!.findAll('button').find((item) => item.text().includes(label)); if (!found) throw new Error(label); return found }
afterEach(() => { wrapper?.unmount(); wrapper = undefined; activeHistory?.destroy(); activeHistory = undefined; window.history.replaceState(null, '', '/'); imageReviewProvider.value = null; companionBrowserProvider.value = null; document.body.innerHTML = ''; localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); Reflect.deleteProperty(navigator, 'clipboard') })
describe('help, about and visible frontend identity', () => {
  it('uses one frontend version in package, lock, header, sidebar and about without implying a daemon version', async () => {
    await setup('/about')
    expect(frontendIdentity.version).toBe(packageInfo.version); expect(frontendIdentity.version).toBe('1.3.173'); expect(frontendIdentity.hostBase).toBe('0.3.150'); expect(frontendIdentity.nextRevision).toBe(23); const [,minor,patch]=packageInfo.companionVersion.hostBase.split('.').map(Number); expect(frontendIdentity.version).toBe(`1.${minor}.${patch + packageInfo.companionVersion.nextRevision}`); expect(lock.version).toBe(packageInfo.version); expect(lock.packages[''].version).toBe(packageInfo.version)
    expect(wrapper!.find('.frontend-version').text()).toBe(`Next v${packageInfo.version}`)
    expect(wrapper!.find('.sidebar-footer').text()).toContain(`前端 v${packageInfo.version}`)
    expect(wrapper!.text()).toContain('未读取，不以本前端版本代替')
    expect(wrapper!.find('.frontend-version').attributes('href')).toBe('/changelog')
  })
  it.each(['/help', '/about', '/changelog', '/migration'])('opens %s without a project, demo fallback or service request', async (path) => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const { workspace } = await setup(path)
    expect(workspace.mode).toBe('disconnected'); expect(workspace.snapshot.projects).toEqual([])
    expect(wrapper!.find('.project-select').exists()).toBe(false); expect(wrapper!.find('.source-banner').exists()).toBe(false)
    expect(wrapper!.find('.topbar a[href="/help"]').exists()).toBe(true); expect(wrapper!.find('.topbar a[href="/about"]').exists()).toBe(true)
    expect(fetch).not.toHaveBeenCalled(); expect(wrapper!.findAll('iframe')).toHaveLength(0)
    for (const image of wrapper!.findAll('img')) expect(image.attributes('src')).toMatch(/^\/(?:src|assets)\//)
  })
  it('keeps every existing route and adds utilities instead of redirecting them over older views', async () => {
    const { router } = await setup()
    for (const path of ['/overview', '/resources', '/image-assets', '/services', '/history', '/help', '/about', '/changelog', '/migration']) expect(router.resolve(path).matched.at(-1)?.path).toBe(path)
  })
  it('supports help deep links, every known old category, navigation and back without executing commands', async () => {
    const { router } = await setup('/help?topic=mcp')
    expect(wrapper!.find('.help-article h2').text()).toBe('MCP 接入')
    expect(helpTopics.filter((topic) => topic.group !== '新版使用')).toHaveLength(13)
    for (const title of ['运行时', 'Cocos Bridge', '知识库', '模型服务']) expect(wrapper!.find('.help-topic-nav').text()).toContain(title)
    await button('CLI 接入').trigger('click'); await flushPromises(); expect(router.currentRoute.value.query.topic).toBe('cli')
    router.back(); await vi.waitFor(() => expect(router.currentRoute.value.query.topic).toBe('mcp')); await flushPromises()
    expect(wrapper!.find('.help-article h2').text()).toBe('MCP 接入')
    await router.push('/help?topic=not-a-command'); await flushPromises(); expect(wrapper!.find('.help-article h2').text()).toBe('开始与数据真实性')
  })
  it('returns a direct deep link safely to projects without following an unobserved browser entry or writing data', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    window.history.replaceState({ position: 40, back: '/resources?stage=draft', current: '/help?topic=mcp', forward: null }, '', '/#/help?topic=mcp')
    const { router } = await setup('/help?topic=mcp', createWebHashHistory())
    const back = vi.spyOn(router, 'back')
    const control = wrapper!.find('.page-back')
    expect(control.attributes('type')).toBe('button'); expect(control.attributes('aria-label')).toBe('返回工程'); expect(control.attributes('title')).toBe('返回工程')
    expect(wrapper!.find('.help-article h2').text()).toBe('MCP 接入')
    ;(control.element as HTMLButtonElement).focus(); expect(document.activeElement).toBe(control.element)
    ;(control.element as HTMLButtonElement).click(); await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/projects'); expect(back).not.toHaveBeenCalled()
    expect(wrapper!.find('.page-back').attributes('disabled')).toBeDefined()
    expect(wrapper!.find('.page-back').attributes('title')).toBe('已在工程页面')
    expect(fetch).not.toHaveBeenCalled(); expect(storageWrite).not.toHaveBeenCalled()
  })
  it('uses the page return control for exact internal query/hash routes and prevents repeated clicks from skipping pages', async () => {
    const { router } = await setupBrowser('/knowledge?tab=models&filter=local#status')
    await router.push('/help?topic=models'); await router.push('/about'); await flushPromises()
    expect(wrapper!.find('.page-back').attributes('aria-label')).toBe('返回帮助')
    const back = vi.spyOn(router, 'back')
    await wrapper!.find('button[aria-label="打开导航"]').trigger('click')
    const control = wrapper!.find('.page-back')
    await control.trigger('click'); await control.trigger('click')
    expect(back).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/help?topic=models')); await flushPromises()
    expect(wrapper!.find('.sidebar').classes()).not.toContain('is-open')
    expect(wrapper!.find('.page-back').attributes('aria-label')).toBe('返回模型服务')
    await wrapper!.find('.page-back').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/knowledge?tab=models&filter=local#status')); await flushPromises()
    expect(wrapper!.find('.page-heading h1').text()).toBe('模型服务')
    expect(wrapper!.find('.page-back').attributes('aria-label')).toBe('返回工程')
  })
  it('keeps return history aligned through native back/forward, query replacement and a new branch', async () => {
    const { router } = await setupBrowser('/projects?tab=logs&project=alpha')
    await router.push('/help?topic=mcp'); await router.replace('/help?topic=cli'); await router.push('/about'); await flushPromises()
    router.back(); await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/help?topic=cli')); await flushPromises()
    expect(wrapper!.find('.page-back').attributes('aria-label')).toBe('返回工程')
    router.forward(); await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/about')); await flushPromises()
    expect(wrapper!.find('.page-back').attributes('aria-label')).toBe('返回帮助')
    await wrapper!.find('.page-back').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/help?topic=cli')); await flushPromises()
    await router.push('/changelog'); await flushPromises()
    await wrapper!.find('.page-back').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/help?topic=cli')); await flushPromises()
    await wrapper!.find('.page-back').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/projects?tab=logs&project=alpha')); await flushPromises()
    const back = vi.spyOn(router, 'back')
    await wrapper!.find('.page-back').trigger('click'); await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/projects'); expect(back).not.toHaveBeenCalled()
  })
  it('returns to the replaced internal route after going forward instead of trusting stale back text', async () => {
    const { router } = await setupBrowser('/knowledge?tab=models')
    await router.push('/help?topic=mcp'); await flushPromises()
    router.back(); await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/knowledge?tab=models'))
    await router.replace('/knowledge?tab=knowledge&query=retained'); await flushPromises()
    router.forward(); await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/help?topic=mcp')); await flushPromises()
    expect(router.options.history.state.back).toBe('/knowledge?tab=models')
    expect(wrapper!.find('.page-back').attributes('aria-label')).toBe('返回知识库')
    await wrapper!.find('.page-back').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/knowledge?tab=knowledge&query=retained'))
  })
  it('does not trust an unobserved browser history position or external back URL when returning', async () => {
    const { router } = await setupBrowser('/resources?stage=plan')
    await router.push('/help'); await flushPromises()
    expect(wrapper!.find('.page-back').attributes('aria-label')).toBe('返回游戏资源')
    // An embedder-created history entry was not observed as a route transition.
    router.options.history.push('/help', { back: 'https://example.org/outside' })
    const back = vi.spyOn(router, 'back')
    await wrapper!.find('.page-back').trigger('click'); await flushPromises()
    expect(back).not.toHaveBeenCalled(); expect(router.currentRoute.value.fullPath).toBe('/projects')
  })
  it('unlocks the return control after a canceled navigation without corrupting its next destination', async () => {
    const { router } = await setupBrowser('/projects')
    await router.push('/help?topic=mcp'); await router.push('/about'); await flushPromises()
    let block = true
    const removeGuard = router.beforeEach((to) => to.path === '/help' && block ? false : undefined)
    await wrapper!.find('.page-back').trigger('click')
    await vi.waitFor(() => {
      expect(router.options.history.state.current).toBe('/about')
      expect(wrapper!.find('.page-back').attributes('disabled')).toBeUndefined()
    })
    expect(router.currentRoute.value.fullPath).toBe('/about')
    expect(wrapper!.find('.page-back').attributes('aria-label')).toBe('返回帮助')
    block = false
    await wrapper!.find('.page-back').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/help?topic=mcp')); await flushPromises()
    expect(wrapper!.find('.page-back').attributes('disabled')).toBeUndefined()
    removeGuard()
  })
  it('preserves the active in-memory project and plan when returning from utilities', async () => {
    const { router, workspace, planning } = await setupBrowser('/resources?stage=plan')
    await workspace.openDemo(); planning.begin(workspace.project!, workspace.spec!, 'demo', 'read-only')
    planning.selectSource('demo', workspace.project!.id, 'codex-native')
    const project = workspace.selectedProjectId; const plan = JSON.stringify(planning.get('demo', project))
    await router.push('/help?topic=resources'); await flushPromises()
    await wrapper!.find('.page-back').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/resources?stage=plan')); await flushPromises()
    expect(workspace.selectedProjectId).toBe(project); expect(JSON.stringify(planning.get('demo', project))).toBe(plan)
    expect(wrapper!.find('.source-banner').text()).toContain('正在浏览示例资料')
  })
  it('preserves project choice, in-memory plan and Picker manifest when opening and closing utilities', async () => {
    const { router, workspace, planning, review } = await setup('/resources')
    await workspace.openDemo(); planning.begin(workspace.project!, workspace.spec!, 'demo', 'read-only')
    planning.selectSource('demo', workspace.project!.id, 'codex-native')
    review.stage(JSON.stringify({ schema_version: 1, images: [{ image_url: 'https://example.org/a.png', source_page: 'https://example.org/' }] }))
    const project = workspace.selectedProjectId; const plan = JSON.stringify(planning.get('demo', project)); const manifest = JSON.stringify(review.manifest)
    for (const path of ['/help?topic=resources', '/about', '/changelog', '/migration', '/resources']) { await router.push(path); await flushPromises() }
    expect(workspace.selectedProjectId).toBe(project); expect(JSON.stringify(planning.get('demo', project))).toBe(plan); expect(JSON.stringify(review.manifest)).toBe(manifest)
    expect(wrapper!.find('.source-banner').text()).toContain('正在浏览示例资料')
  })
  it('closes the mobile menu when using help and keeps version outside the hidden sidebar', async () => {
    await setup('/overview'); await wrapper!.find('button[aria-label="打开导航"]').trigger('click')
    expect(wrapper!.find('.sidebar').classes()).toContain('is-open')
    await wrapper!.find('.topbar a[href="/help"]').trigger('click'); await flushPromises()
    expect(wrapper!.find('.sidebar').classes()).not.toContain('is-open')
    expect(wrapper!.find('.topbar .frontend-version').exists()).toBe(true)
    expect(wrapper!.find('.sidebar .frontend-version').exists()).toBe(false)
  })
  it('keeps unparsed Picker text through help and never reuses a download confirmation on return', async () => {
    const { router, review } = await setup('/image-assets')
    const text = JSON.stringify({ schema_version: 1, images: [{ image_url: 'https://example.org/a.png', source_page: 'https://example.org/' }] })
    await wrapper!.find('textarea[aria-label="Picker 候选 JSON"]').setValue(text)
    await router.push('/help?topic=picker'); await flushPromises(); await router.push('/image-assets'); await flushPromises()
    expect((wrapper!.find('textarea[aria-label="Picker 候选 JSON"]').element as HTMLTextAreaElement).value).toBe(text)
    expect(review.manifest).toBeNull()
    await button('解析候选清单').trigger('click'); await flushPromises()
    const confirmation = wrapper!.findAll('label.el-checkbox').find((item) => item.text().includes('确认由本机'))!
    await confirmation.find('input').setValue(true)
    await router.push('/about'); await flushPromises(); await router.push('/image-assets'); await flushPromises()
    expect(review.manifest?.images).toHaveLength(1)
    expect((wrapper!.find('textarea[aria-label="Picker 候选 JSON"]').element as HTMLTextAreaElement).value).toBe(text)
    expect((wrapper!.findAll('label.el-checkbox').find((item) => item.text().includes('确认由本机'))!.find('input').element as HTMLInputElement).checked).toBe(false)
    expect(button('导入并下载').attributes('disabled')).toBeDefined()
  })
  it('preserves parsed A separately from unparsed B across utilities and keeps submission blocked', async () => {
    const { router, review } = await setup('/image-assets')
    const a = JSON.stringify({ schema_version: 1, images: [{ image_url: 'https://example.org/a.png', source_page: 'https://example.org/' }] })
    const b = a.replace('/a.png', '/b.png')
    await wrapper!.find('textarea[aria-label="Picker 候选 JSON"]').setValue(a); await button('解析候选清单').trigger('click'); await flushPromises()
    await wrapper!.find('textarea[aria-label="Picker 候选 JSON"]').setValue(b)
    await router.push('/help'); await flushPromises(); await router.push('/image-assets'); await flushPromises()
    expect(review.importDraftText).toBe(b); expect(review.parsedDraftText).toBe(a); expect(review.manifest?.images[0]?.image_url).toBe('https://example.org/a.png')
    expect((wrapper!.find('textarea[aria-label="Picker 候选 JSON"]').element as HTMLTextAreaElement).value).toBe(b)
    expect(wrapper!.findAll('label.el-checkbox').find((item) => item.text().includes('确认由本机'))!.find('input').attributes('disabled')).toBeDefined()
    expect(button('导入并下载').attributes('disabled')).toBeDefined()
  })
  it('does not unlock an active Picker write or clear an uncertain outcome through help navigation', async () => {
    let reject!: (reason: Error) => void
    const provider: ImageReviewProvider = { label: 'offline navigation test', saveSelectionGuard: 'verified', loadState: async () => ({ taskId: null, busy: false, items: [] }), importCandidates: vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail })), loadPreview: vi.fn(), saveSelected: vi.fn() }
    registerImageReviewProvider(provider)
    const { router, review } = await setup('/image-assets'); await review.connect(provider)
    review.stage(JSON.stringify({ schema_version: 1, images: [{ image_url: 'https://example.org/a.png', source_page: 'https://example.org/' }] }))
    const pending = review.submitImport(true)
    await router.push('/help'); await flushPromises(); expect(review.mutation).toBe('import')
    await expect(review.submitImport(true)).rejects.toThrow('未就绪')
    await router.push('/image-assets'); await flushPromises(); expect(review.mutation).toBe('import')
    reject(new Error('lost reply')); await pending; await flushPromises()
    expect(review.uncertain).toBe(true); expect(review.canSave).toBe(false); expect(provider.importCandidates).toHaveBeenCalledTimes(1)
    await router.push('/about'); await router.push('/image-assets'); await flushPromises()
    expect(review.uncertain).toBe(true); expect(button('导入并下载').attributes('disabled')).toBeDefined()
  })
  it('copies only explicit diagnostic identity with a manual fallback and no transmission', async () => {
    const writeText = vi.fn(async (_text: string) => {}); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); await setup('/about')
    await button('复制版本信息').trigger('click'); await flushPromises()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`Companion Next ${packageInfo.version}`))
    expect(writeText.mock.calls[0]?.[0]).not.toMatch(/127\.0\.0\.1|X-Review-Token|Bearer|\/workspace\//)
    expect(fetch).not.toHaveBeenCalled()
    writeText.mockRejectedValueOnce(new Error('denied')); await button('复制版本信息').trigger('click'); await flushPromises()
    expect(wrapper!.text()).toContain('手动选择下方版本文本')
    expect(wrapper!.find('textarea[aria-label="版本信息文本"]').attributes('readonly')).toBeDefined()
  })

  it('uses real host evidence for history/about and copies only recognized numeric Creator versions', async () => {
    const writeText=vi.fn(async (_text:string)=>{});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}})
    const {directory,router}=await setup('/about')
    const source:CompanionBrowserProvider={label:'actual host',loadProjects:vi.fn(),loadLogs:vi.fn(),loadCounts:vi.fn(),loadCalls:vi.fn()}
    companionBrowserProvider.value=source;directory.provider=source;directory.connected=true;directory.observedAt='2026-10-15T12:00:00.000Z'
    directory.projects=[{id:'a',name:'Private project',path:'C:/private/project'}]
    directory.statuses=[{projectId:'a',state:'ready',capabilityProfile:'full-control',creatorVersion:'3.8.8 token=fixture-secret'},{projectId:'b',state:'ready',capabilityProfile:'full-control',creatorVersion:'C:/private/version'},{projectId:'c',state:'ready',capabilityProfile:'full-control',creatorVersion:'3.8.8'}]
    await flushPromises();await button('复制版本信息').trigger('click');await flushPromises()
    const copied=writeText.mock.calls[0]![0];expect(copied).toContain('已取得真实读取结果');expect(copied).toContain('Creator 已返回版本：3.8.8');expect(copied).not.toMatch(/fixture-secret|C:\/|Private project/)
    await router.push('/history');await flushPromises();expect(wrapper!.text()).toContain('1 个登记工程');expect(wrapper!.text()).not.toContain('独立试点');expect(wrapper!.text()).not.toContain('仅本地草稿')
    companionBrowserProvider.value={...source,label:'replacement'};await flushPromises();expect(wrapper!.text()).toContain('未取得有效响应');expect(wrapper!.text()).not.toContain('1 个登记工程')
  })
  it('retains feedback and exact local v148 assets without automatic external requests', async () => {
    const writeText = vi.fn(async (_text: string) => {}); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await setup('/about'); await button('复制反馈地址').trigger('click'); await flushPromises()
    expect(writeText).toHaveBeenCalledWith('332725585@qq.com'); expect(wrapper!.text()).toContain('未发送邮件')
    expect(wrapper!.findAll('img')).toHaveLength(2); expect(wrapper!.text()).toContain('v148 原始图片，字节未修改')
    expect(wrapper!.find('a[href="mailto:332725585@qq.com"]').exists()).toBe(true)
    expect(wrapper!.find('a[href="https://gitee.com/sxtao_admin/cocos-mcp"]').attributes('rel')).toBe('noopener noreferrer')
  })

  it('uses the approved overview-first order and preserves other navigation groups, destinations and brand-about access', async () => {
    await setup('/overview')
    const navigation = wrapper!.find('nav[aria-label="主导航"]')
    expect(navigation.findAll('a').map((a) => a.attributes('href'))).toEqual(['/overview', '/projects', '/resources', '/image-assets', '/services', '/history', '/migration'])
    const old = wrapper!.find('nav[aria-label="旧版功能入口"]')
    expect(old.findAll('a').map((a) => a.text())).toEqual(['AI 图标', '工程', '知识库', '模型服务'])
    expect(old.findAll('a').map((a) => a.attributes('href'))).toEqual(['/ai-icons', '/projects', '/knowledge', '/knowledge?tab=models'])
    expect(wrapper!.find('.sidebar-utility').findAll('a').map((a) => a.attributes('href'))).toEqual(['/help', '/about', '/changelog'])
    expect(wrapper!.find('.sidebar-footer').findAll('a')).toHaveLength(0)
    await wrapper!.find('.brand').trigger('click'); await flushPromises()
    expect(wrapper!.find('.legacy-about').exists()).toBe(true)
  })
  it('keeps the shell compact and page help keyboard-accessible without migration captions', async () => {
    await setup('/projects')
    expect(wrapper!.find('.page-heading h1').text()).toBe('工程')
    expect(wrapper!.find('.page-heading p').exists()).toBe(false)
    expect(wrapper!.find('.page-heading .eyebrow').exists()).toBe(false)
    expect(wrapper!.find('.page-footer').exists()).toBe(false)
    expect(wrapper!.find('.sidebar-note').exists()).toBe(false)
    expect(wrapper!.find('.sidebar').text()).not.toMatch(/迁移进度|独立开发试点|全功能迁移/)
    expect(wrapper!.find('.topbar').text()).not.toMatch(/正常工程模式|只读模式 \/ 迁移中/)
    const help = wrapper!.find('.page-title button[aria-label="工程说明"]')
    expect(help.attributes('type')).toBe('button')
    ;(help.element as HTMLButtonElement).focus()
    expect(document.activeElement).toBe(help.element)
  })
  it('keeps unconnected, demo and failed live-source states explicit in the compact shell', async () => {
    const { workspace } = await setup('/overview')
    expect(wrapper!.find('.topbar').text()).toContain('未连接')
    expect(wrapper!.find('.source-banner').exists()).toBe(false)
    await workspace.openDemo(); await flushPromises()
    expect(wrapper!.find('.topbar').text()).toContain('示例模式')
    expect(wrapper!.find('.source-banner').text()).toContain('演示数据 · 无真实服务连接')
    await workspace.connect({ mode: 'live', label: 'unavailable', loadSnapshot: async () => { throw new Error('服务连接失败') } }); await flushPromises()
    expect(wrapper!.find('.topbar').text()).toContain('真实连接未就绪')
    expect(wrapper!.find('.connection-error').text()).toContain('服务连接失败')
    expect(wrapper!.find('.connection-error').text()).toContain('读取失败，未显示任何缓存或示例数据')
    expect(wrapper!.find('.source-banner').text()).not.toContain('示例资料')
    expect(wrapper!.find('.topbar .el-tag--success').exists()).toBe(false)
  })
  it('renders complete original help text, copies unchanged code and retains wrap/expand controls', async () => {
    const writeText = vi.fn(async (_text: string) => {}); Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await setup('/help?topic=mcp')
    const blocks = legacyHelp.mcp.filter((block) => block.kind === 'code')
    expect(wrapper!.findAll('.help-code-block pre').map((pre) => pre.text())).toEqual(blocks.map((block) => block.text))
    await wrapper!.findAll('.help-code-toolbar button').find((b) => b.text() === '复制原文')!.trigger('click'); await flushPromises()
    expect(writeText).toHaveBeenCalledWith(blocks[0]!.text)
    await wrapper!.findAll('.help-code-toolbar button').find((b) => b.text() === '自动换行')!.trigger('click')
    expect(wrapper!.find('.help-code-block pre').classes()).toContain('no-wrap')
    expect(wrapper!.findAll('.help-code-block')[0]!.text()).toContain('不换行')
    expect(wrapper!.findAll('.help-code-block')[1]!.find('pre').classes()).not.toContain('no-wrap')
    expect(wrapper!.findAll('.help-code-block')[1]!.text()).toContain('自动换行')
    await button('展开全文').trigger('click'); expect(wrapper!.findAll('pre.code-collapsed')).toHaveLength(0)
    expect(wrapper!.text()).toContain('原文已复制；未执行命令或发送到服务。')
  })
  it('shows all legacy changelog groups separately from the real frontend version', async () => {
    await setup('/changelog')
    expect(wrapper!.findAll('.legacy-changelog')).toHaveLength(CHANGELOG.length)
    expect(wrapper!.find('.legacy-changelog summary').text()).toContain('0.3.148')
    expect(wrapper!.text()).toContain('北京时间日历日')
    expect(wrapper!.text()).toContain('已在本机完成独立启动与HTTP核验')
    expect(wrapper!.text()).toContain('历史UNKNOWN仍保留，完整恢复另行验收')
    expect(wrapper!.text()).not.toContain('未接入或部署，不代表P1060已恢复')
    for (const entry of CHANGELOG) for (const change of entry.changes) expect(wrapper!.text()).toContain(change)
  })
  it('keeps original AI icons and the separate keyword-search validation boundary visible', async () => {
    await setup('/migration?feature=ai-icons')
    expect(migrationFeatures.find((f) => f.id === 'ai-icons')?.status).toBe('原任务流程已接 · 部分实机已验')
    expect(wrapper!.find('#feature-ai-icons').text()).toContain('并非裁剪')
    expect(wrapper!.find('#feature-image-search').text()).toContain('browser_import')
    expect(wrapper!.find('#feature-image-search').text()).toContain('同源预览 / 选择 / 保存已验')
    expect(wrapper!.find('#feature-image-search').text()).toContain('用户原图片库未切换')
    expect(wrapper!.find('#feature-image-search').text()).toContain('未开放搜索')
    expect(wrapper!.find('#feature-resource-flow').text()).toContain('真实733项曾')
    expect(wrapper!.text()).not.toContain('同宿主保存仍待准确合同')
    expect(wrapper!.text()).not.toContain('正在只读核对')
  })
  it('separates Vue contract coverage from unverified host integration instead of equating a button with business completion', async () => {
    await setup('/migration?feature=knowledge')
    expect(wrapper!.text()).toContain('不是旧 Companion 的完整替换'); expect(wrapper!.text()).toContain(legacyReference.currentTarget)
    expect(migrationFeatures.find(item=>item.id==='logs')?.status).toBe('日志工具条已接 · 限定专项已验')
    expect(migrationFeatures.find(item=>item.id==='logs')?.detail).toContain('生产 DELETE 未执行；长时断线完整性与事件回放仍未验收')
    expect(migrationFeatures.find(item=>item.id==='help')?.detail).toContain('未发送任务，不保证任意客户端状态或业务执行')
    expect(migrationFeatures.find(item=>item.id==='calls')?.status).toBe('Vue分页/详情契约已验 · 自然分页另列')
    expect(migrationFeatures.find((entry) => entry.id === 'knowledge')?.status).toBe('查询 / 问答 / 同步源码已接')
    expect(migrationFeatures.find((entry) => entry.id === 'models')?.status).toBe('原启停 / 管理面板已接')
    expect(migrationFeatures.find(entry=>entry.id==='cli')?.status).toBe('原文复制与编辑器交接已接')
    expect(migrationFeatures.find(entry=>entry.id==='tools')?.status).toBe('预设读写源码已接')
    expect(migrationFeatures.find(item=>item.id==='mcp')?.status).toBe('Vue安装/登记契约已接 · 宿主集成另列')
    expect(migrationFeatures.find(item=>item.id==='mcp')?.detail).toContain('configureCodex=true的01/11及真实客户端持久配置属于尚未补齐的宿主集成证据')
    expect(migrationFeatures.find(item=>item.id==='mcp')?.detail).toContain('Agent 多选 / 全选 / 跳过')
    expect(wrapper!.find('#feature-knowledge').classes()).toContain('feature-focused')
    expect(document.activeElement?.id).toBe('feature-knowledge')
    expect(wrapper!.text()).toContain('已补入口'); expect(wrapper!.text()).not.toContain('迁移全部完成')
  })
})

describe('implemented feature help navigation',()=>{
 it.each(['projects','mcp','profiler'])('opens existing project controls from %s help without sending a business request',async topic=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const {router}=await setup(`/help?topic=${topic}`)
  const link=wrapper!.find('.help-article > a.information-link');expect(link.attributes('href')).toBe('/projects');await link.trigger('click');await flushPromises();expect(router.currentRoute.value.path).toBe('/projects');expect(fetch).not.toHaveBeenCalled()
 })
})
