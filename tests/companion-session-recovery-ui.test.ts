import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus, { ElMessage } from 'element-plus'
import CompanionSessionRecovery from '../src/components/CompanionSessionRecovery.vue'
import { companionBrowserProvider } from '../src/companion-browser-integration'
import { COMPANION_SESSION_REQUIRED_EVENT } from '../src/domain/companion-session-recovery'
const wrappers: Array<ReturnType<typeof mount>> = []
afterEach(() => { wrappers.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = ''; companionBrowserProvider.value = null; vi.restoreAllMocks() })
async function page() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div/>' } }] })
  await router.push('/art-resources?project=one'); await router.isReady()
  const host = defineComponent({ components: { CompanionSessionRecovery }, template: '<main><textarea aria-label="draft">unsent draft</textarea><CompanionSessionRecovery/></main>' })
  const wrapper = mount(host, { attachTo: document.body, global: { plugins: [router, ElementPlus] } }); wrappers.push(wrapper)
  return { router, wrapper }
}
async function request() { window.dispatchEvent(new CustomEvent(COMPANION_SESSION_REQUIRED_EVENT, { detail: { returnTo: `/next/index.html${window.location.search}${window.location.hash}` } })); await nextTick(); await flushPromises() }
describe('in-place authorization recovery', () => {
  it('preserves the same mounted draft, rejects forged messages and closes only for its own authenticated guide', async () => {
    const { wrapper } = await page(), success = vi.spyOn(ElMessage, 'success')
    const draft = wrapper.get('textarea').element
    await wrapper.get('textarea').setValue('edited unsent content')
    await request()
    const frame = document.querySelector('iframe')!
    expect(frame).not.toBeNull(); expect(frame.src).toContain('/login?embedded=1&returnTo=')
    window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, source: window, data: { type: 'companion:session-restored' } })); await nextTick()
    expect(success).not.toHaveBeenCalled()
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.test', source: frame.contentWindow, data: { type: 'companion:session-restored' } })); await nextTick()
    expect(success).not.toHaveBeenCalled()
    window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, source: frame.contentWindow, data: { type: 'companion:session-restored' } })); await nextTick()
    expect(success).toHaveBeenCalledTimes(1)
    expect(wrapper.get('textarea').element).toBe(draft)
    expect((draft as HTMLTextAreaElement).value).toBe('edited unsent content')
  })
  it('invalidates the prompt on a route or provider change without discarding the page input', async () => {
    const { wrapper, router } = await page(), success = vi.spyOn(ElMessage, 'success')
    await request(); const oldFrame = document.querySelector('iframe')!
    await router.push('/help'); await nextTick()
    window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, source: oldFrame.contentWindow, data: { type: 'companion:session-restored' } })); await nextTick()
    expect(success).not.toHaveBeenCalled(); expect(wrapper.get('textarea').element.value).toBe('unsent draft')
    await request()
    companionBrowserProvider.value = {} as NonNullable<typeof companionBrowserProvider.value>; await nextTick()
    expect(wrapper.findComponent(CompanionSessionRecovery).findComponent({ name: 'ElDialog' }).props('modelValue')).toBe(false)
  })
  it('shows iframe failure locally and only retries on explicit click', async () => {
    await page(); await request()
    const frame = document.querySelector('iframe')!; frame.dispatchEvent(new Event('error')); await nextTick()
    expect(document.querySelector('iframe')).toBeNull()
    const retry = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('重新加载引导'))!
    retry.click(); await nextTick(); expect(document.querySelector('iframe')).not.toBeNull()
  })
})
