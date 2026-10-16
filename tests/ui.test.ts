import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import App from '../src/App.vue'
import { routes } from '../src/router'
import { useWorkspaceStore } from '../src/stores/workspace'
let wrapper: VueWrapper | undefined
beforeEach(() => { localStorage.clear(); Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_key: string, callback: () => unknown) => callback() } }) })
afterEach(() => { wrapper?.unmount(); wrapper = undefined; document.body.innerHTML = ''; Reflect.deleteProperty(navigator, 'locks') })
async function setup(path = '/resources') {
  const pinia = createPinia()
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia, router, ElementPlus] } })
  await flushPromises()
  return { wrapper, router, store: useWorkspaceStore(pinia) }
}
function button(text: string) {
  const candidate = wrapper!.findAll('button').find((b) => b.text().includes(text))
  if (!candidate) throw new Error(`Button missing: ${text}`)
  return candidate
}
describe('mounted UI boundaries (jsdom, not browser rendering)', () => {
  it('opens disconnected with no fixtures and an explicit demo action', async () => {
    await setup()
    expect(wrapper!.text()).toContain('请先选择已登记工程')
    expect(wrapper!.text()).not.toContain('灵魂石图标')
    await button('查看示例工作台').trigger('click'); await flushPromises()
    expect(wrapper!.text()).toContain('正在浏览示例资料')
    expect(wrapper!.findAll('.resource-row')).toHaveLength(5)
  })
  it('keeps generating disabled and protects Owner items', async () => {
    const { store } = await setup(); await store.openDemo(); await flushPromises()
    expect(button('生成所选').attributes('disabled')).toBeDefined()
    expect(wrapper!.findAll('.resource-row').find((row) => row.text().includes('主按钮底图'))!.find('input[type="checkbox"]').attributes('disabled')).toBeDefined()
  })
  it('filters visible resources by category and search', async () => {
    const { store } = await setup(); await store.openDemo(); await flushPromises()
    await wrapper!.find('input[aria-label="搜索资源"]').setValue('金币')
    expect(wrapper!.findAll('.resource-row')).toHaveLength(1)
    expect(wrapper!.find('.resource-row').text()).toContain('金币图标')
    await wrapper!.find('input[aria-label="搜索资源"]').setValue('')
    const category = wrapper!.findAll('.resource-tabs button').find((b) => b.text() === '面板')!
    await category.trigger('click')
    expect(wrapper!.findAll('.resource-row')).toHaveLength(1)
    expect(wrapper!.find('.resource-row').text()).toContain('奖励弹窗底板')
  })
  it('navigates all six stages without fabricating passed steps', async () => {
    const { store } = await setup(); await store.openDemo(); await flushPromises()
    for (let index = 0; index < 6; index++) {
      await wrapper!.findAll('.resource-steps button')[index]!.trigger('click'); await flushPromises()
      expect(wrapper!.findAll('.resource-steps button.active')).toHaveLength(1)
      expect(wrapper!.find('.resource-steps button.active').attributes('aria-current')).toBe('step')
    }
    expect(wrapper!.text()).toContain('当前没有 Creator / Bridge 实机运行证据')
    expect(button('运行并验收').attributes('disabled')).toBeDefined()
  })
  it('opens the shared modal and saves only a browser draft', async () => {
    const { store } = await setup(); await store.openDemo(); await flushPromises()
    await button('编辑本地草稿').trigger('click'); await flushPromises()
    const body = new DOMWrapper(document.body)
    expect(body.find('.spec-dialog').text()).toContain('编辑项目规范草稿')
    expect(body.findAll('[role="tab"]')).toHaveLength(4)
    await body.find('input[aria-label="画布宽度"]').setValue('1080')
    await body.find('input[aria-label="画布宽度"]').trigger('blur')
    const save = body.findAll('button').find((b) => b.text() === '保存本地草稿')!
    await save.trigger('click'); await flushPromises()
    expect(store.localDraft?.spec.width).toBe(1080)
    expect(store.project?.spec?.width).toBe(941)
    expect(wrapper!.find('.spec-summary').text()).toContain('草稿未批准')
  })
  it('renders failure without demo fallback', async () => {
    const { store } = await setup()
    await store.connect({ mode: 'live', label: 'test', loadSnapshot: async () => { throw new Error('401 需要会话') } }); await flushPromises()
    expect(wrapper!.text()).toContain('读取失败，未显示任何缓存或示例数据')
    expect(wrapper!.text()).toContain('401 需要会话')
    expect(wrapper!.findAll('.resource-row')).toHaveLength(0)
  })
  it('distinguishes an empty live source from never having read one', async () => {
    const { store } = await setup()
    await store.connect({ mode: 'live', label: 'empty', loadSnapshot: async () => ({ projects: [], resources: [], services: [], source: { label: 'empty', limitations: [] } }) }); await flushPromises()
    expect(wrapper!.text()).toContain('只读数据源中暂无可展示项目')
    expect(wrapper!.text()).not.toContain('当前没有读取任何真实项目或服务')
  })
  it('shows unverified service states in demo and discloses revision boundaries', async () => {
    const { store, router } = await setup('/services'); await store.openDemo(); await flushPromises()
    expect(wrapper!.findAll('.service-card')).toHaveLength(3)
    expect(wrapper!.findAll('.service-card .el-tag').every((tag) => tag.text().includes('未验证'))).toBe(true)
    await router.push('/history'); await flushPromises()
    expect(wrapper!.text()).toContain('旧 UI v0.3.148 · v150 后端')
    expect(wrapper!.text()).toContain('参考版本不是当前后台的实时版本')
  })
})

describe('review regression cases', () => {
  it('does not label fallback services as real responses after a live failure', async () => {
    const { store } = await setup('/services')
    await store.connect({ mode: 'live', label: 'test', loadSnapshot: async () => { throw new Error('401') } }); await flushPromises()
    expect(wrapper!.findAll('.service-card')).toHaveLength(3)
    expect(wrapper!.findAll('.service-bottom').every((row) => row.text().includes('未取得有效响应'))).toBe(true)
    expect(wrapper!.text()).not.toContain('只读服务响应')
  })
  it('renders unknown resource metrics instead of fabricated zeros for an unread live inventory', async () => {
    const { store } = await setup('/overview')
    await store.connect({ mode: 'live', label: 'test', loadSnapshot: async () => ({ projects: [{ id: 'live-a', name: '真实只读工程', styleApproval: 'unknown', protectedAssets: null }], resources: [], services: [], source: { label: 'test', limitations: [] } }) }); await flushPromises()
    expect(wrapper!.findAll('.metric-value').every((metric) => metric.text().includes('—'))).toBe(true)
    expect(wrapper!.text()).toContain('真实资源清单尚未读取')
  })
  it('offers explicit reload when the draft changes while the editor is open', async () => {
    const { store } = await setup(); await store.openDemo(); await flushPromises()
    await button('编辑本地草稿').trigger('click'); await flushPromises()
    const body = new DOMWrapper(document.body)
    await body.find('input[aria-label="画布宽度"]').setValue('1440')
    await body.find('input[aria-label="画布宽度"]').trigger('blur')
    // Another edit commits while this modal retains its opening revision.
    await store.saveLocalSpec({ ...store.spec!, width: 1080 })
    await body.findAll('button').find((b) => b.text() === '保存本地草稿')!.trigger('click'); await flushPromises()
    expect(body.text()).toContain('此次编辑未保存，也未覆盖新版本')
    expect(store.localDraft?.spec.width).toBe(1080)
    await body.findAll('button').find((b) => b.text() === '放弃本次编辑并重新载入')!.trigger('click'); await flushPromises()
    expect((body.find('input[aria-label="画布宽度"]').element as HTMLInputElement).value).toBe('1080')
  })
})

 it('disables persistent save while retaining the form if Web Locks are unavailable', async () => {
   Reflect.deleteProperty(navigator, 'locks')
   const { store } = await setup(); await store.openDemo(); await flushPromises()
   await button('编辑本地草稿').trigger('click'); await flushPromises()
   const body = new DOMWrapper(document.body)
   expect(body.text()).toContain('持久保存已禁用，表单内容仍保留供复制')
   expect(body.findAll('button').find((b) => b.text() === '保存本地草稿')!.attributes('disabled')).toBeDefined()
   await body.find('input[aria-label="画布宽度"]').setValue('1080')
   expect((body.find('input[aria-label="画布宽度"]').element as HTMLInputElement).value).toBe('1080')
   expect(store.localDraft).toBeNull(); expect(localStorage.length).toBe(0)
 })

it('opens image asset review independently without a project or fixture', async () => {
 const {router,store}=await setup('/image-assets')
 expect(wrapper!.find('[data-testid="image-assets-page"]').exists()).toBe(true)
 expect(store.mode).toBe('disconnected')
 expect(wrapper!.text()).toContain('尚未导入候选图片')
 expect(wrapper!.text()).toContain('审阅服务未连接')
 expect(wrapper!.findAll('img')).toHaveLength(0)
 await router.push('/overview'); await flushPromises(); expect(wrapper!.find('[data-testid="image-assets-page"]').exists()).toBe(false)
})
