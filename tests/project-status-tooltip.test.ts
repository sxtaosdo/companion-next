import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ProjectStatusTag from '../src/components/ProjectStatusTag.vue'
import type { ManagedStatus } from '../src/domain/companion-browser'
let wrapper: VueWrapper | undefined
const base: ManagedStatus = { projectId: 'p1', state: 'ready', capabilityProfile: 'read-only' }
function setup(status?: ManagedStatus, passive = false) {
  wrapper = mount(ProjectStatusTag, { props: { status, passive }, attachTo: document.body, global: { plugins: [ElementPlus] } })
  return wrapper
}
async function reveal(event = 'focus') {
  const trigger = wrapper!.get('.project-status-trigger')
  await trigger.trigger(event); await flushPromises()
  const id = trigger.attributes('aria-describedby')
  return id ? document.getElementById(id) : null
}
afterEach(() => { wrapper?.unmount(); wrapper = undefined; document.body.innerHTML = '' })
describe('original Dashboard status tooltip parity', () => {
  it.each([
    [{ ...base, launchSource: 'dashboard', dashboardVersion: '2.4.0' }, 'Dashboard 2.4.0'],
    [{ ...base, launchSource: 'dashboard' }, 'Dashboard 已接管'],
    [{ ...base, launchSource: 'dashboard', dashboardVersion: '' }, 'Dashboard 已接管'],
    [{ ...base, dashboardProgress: 'waiting-dashboard' }, 'Dashboard 状态 waiting-dashboard'],
    [{ ...base, launchSource: 'dashboard', dashboardVersion: '2.4.0', dashboardProgress: 'opening-dashboard' }, 'Dashboard 2.4.0\nDashboard 状态 opening-dashboard'],
  ] as [ManagedStatus, string][])('preserves independent original conditions: %j', async (status, expected) => {
    setup(status)
    expect(wrapper!.text()).toBe('已就绪')
    expect(wrapper!.text()).not.toContain('Dashboard')
    expect(wrapper!.get('.project-status-trigger').attributes('tabindex')).toBe('0')
    expect((await reveal())?.textContent).toBe(expected)
    expect(wrapper!.findAll('.el-tag')).toHaveLength(1)
  })
  it.each([undefined, base, { ...base, dashboardVersion: '2.4.0' }, { ...base, dashboardProgress: '' }])('does not invent details or focus stops for %j', async status => {
    setup(status)
    expect(wrapper!.get('.project-status-trigger').attributes('tabindex')).toBeUndefined()
    expect(await reveal()).toBeNull()
  })
  it('does not show stale runtime metadata in passive mode', async () => {
    setup({ ...base, launchSource: 'dashboard', dashboardProgress: 'ready' }, true)
    expect(wrapper!.text()).toBe('运行状态未探测'); expect(await reveal()).toBeNull()
  })
  it('renders metadata as escaped text and does not duplicate lastError', async () => {
    setup({ ...base, launchSource: 'dashboard', dashboardVersion: '<img src=x onerror=alert(1)>', dashboardProgress: '<script>bad()</script>', lastError: 'existing detail elsewhere' })
    const content = await reveal('mouseenter')
    expect(content?.textContent).toContain('<img'); expect(content?.textContent).toContain('<script>')
    expect(content?.querySelector('img,script')).toBeNull()
    expect(content?.textContent).not.toContain('existing detail elsewhere')
    expect(wrapper!.text()).not.toContain('Dashboard')
  })
  it('supports focus, mouse leave while focused, Escape, blur and later hover', async () => {
    setup({ ...base, launchSource: 'dashboard' })
    const trigger = wrapper!.get('.project-status-trigger')
    expect(await reveal()).not.toBeNull()
    await trigger.trigger('mouseleave'); expect(trigger.attributes('aria-describedby')).toBeTruthy()
    await trigger.trigger('keydown', { key: 'Escape' }); expect(trigger.attributes('aria-describedby')).toBeUndefined()
    await trigger.trigger('blur'); expect(trigger.attributes('aria-describedby')).toBeUndefined()
    expect(await reveal('mouseenter')).not.toBeNull()
    await trigger.trigger('mouseleave'); expect(trigger.attributes('aria-describedby')).toBeUndefined()
  })
  it('updates details from the same project and clears them on absent status or project replacement', async () => {
    setup({ ...base, launchSource: 'dashboard', dashboardVersion: '1.0.0' })
    await reveal()
    await wrapper!.setProps({ status: { ...base, dashboardProgress: 'manual-dashboard' } })
    expect((await reveal())?.textContent).toBe('Dashboard 状态 manual-dashboard')
    await wrapper!.setProps({ status: { ...base, projectId: 'p2', launchSource: 'dashboard' } })
    expect(wrapper!.get('.project-status-trigger').attributes('aria-describedby')).toBeUndefined()
    expect((await reveal())?.textContent).toBe('Dashboard 已接管')
    await wrapper!.setProps({ status: undefined })
    expect(wrapper!.get('.project-status-trigger').attributes('aria-describedby')).toBeUndefined()
    expect(wrapper!.text()).toBe('未知')
  })
})
