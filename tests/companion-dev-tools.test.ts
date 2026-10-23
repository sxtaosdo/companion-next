import { afterEach, describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import CompanionDevTools from '../src/components/CompanionDevTools.vue'
const cleanups: Array<() => void> = []
afterEach(() => { cleanups.forEach(fn => fn()); cleanups.length = 0; document.body.innerHTML = '' })
async function setup() {
  const router = createRouter({ history:createMemoryHistory(), routes:[{path:'/:pathMatch(.*)*',component:{template:'<div />'}}] })
  await router.push('/resources?project=test-project')
  await router.isReady()
  const wrapper = mount(CompanionDevTools,{attachTo:document.body,global:{plugins:[router]}})
  cleanups.push(() => wrapper.unmount())
  return {router,wrapper, trigger:() => document.querySelector<HTMLButtonElement>('.companion-dev-tools__toggle')!}
}
describe('Companion floating documentation tools', () => {
  it('exposes the approved floating entry without a dev-build prerequisite', async () => {
    const {trigger} = await setup()
    expect(trigger().getAttribute('aria-label')).toBe('打开开发工具')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[role=dialog]')).toBeNull()
    trigger().click(); await flushPromises()
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(document.querySelector('[role=dialog]')?.getAttribute('aria-label')).toBe('开发工具：文档')
  })
  it('keeps only actual documentation destinations, with no upstream sensitive tools', async () => {
    const {trigger} = await setup(); trigger().click(); await flushPromises()
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.companion-dev-tools a')]
    expect(links.map(x => x.getAttribute('href'))).toEqual(['/help?project=test-project','https://cn.vuejs.org/','https://router.vuejs.org/zh/','https://pinia.vuejs.org/','https://vite.dev/','https://element-plus.org/zh-CN/component/overview.html'])
    expect(document.querySelectorAll('.companion-dev-tools__menu button')).toHaveLength(1)
    for (const link of links.slice(1)) { expect(link.rel).toBe('noopener noreferrer'); expect(link.target).toBe('_blank') }
    expect(document.querySelector('[role=dialog]')?.textContent).not.toMatch(/Eps|代理请求|字典|账号/)
  })
  it('focuses help on open and restores the trigger on Escape', async () => {
    const {trigger} = await setup(); trigger().focus(); trigger().click(); await flushPromises()
    expect(document.activeElement?.textContent).toBe('Companion 帮助')
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})); await flushPromises()
    expect(document.querySelector('[role=dialog]')).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })
  it('routes help inside the application, retaining the selected project and closing the panel', async () => {
    const {router,trigger} = await setup(); trigger().click(); await flushPromises()
    document.querySelector<HTMLAnchorElement>('.companion-dev-tools a')!.click(); await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/help?project=test-project')
    expect(document.querySelector('[role=dialog]')).toBeNull()
  })
  it('closes on route changes and removes keyboard handling when unmounted', async () => {
    const {router,wrapper,trigger} = await setup(); trigger().click(); await flushPromises()
    await router.push('/projects?project=other'); await flushPromises()
    expect(document.querySelector('[role=dialog]')).toBeNull()
    wrapper.unmount(); cleanups.length = 0
    expect(() => document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))).not.toThrow()
  })
})
