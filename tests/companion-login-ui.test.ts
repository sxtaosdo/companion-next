import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import CompanionLogin from '../src/login/CompanionLogin.vue'
import * as auth from '../src/login/auth'
const wrappers: Array<ReturnType<typeof mount>> = []
const png = 'data:image/png;base64,aGVsbG8='
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks() })
async function page(options: { configured?: boolean; available?: boolean; loginStatus?: number; loginCode?: string; session?: boolean; captchaFails?: boolean } = {}) {
  let captcha = 0
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/config') return response({ available: options.available ?? true, configured: options.configured ?? true })
    if (url === '/api/auth/captcha') return options.captchaFails ? response({ code: 'AUTH_PROVIDER_UNAVAILABLE' }, 503) : response({ captchaId: 'captcha-' + ++captcha, image: png })
    if (url === '/api/auth/login') return options.loginStatus ? response({ code: options.loginCode }, options.loginStatus) : response({ authenticated: true })
    if (url === '/api/ui/session') return options.session === false ? response({ code: 'UI_SESSION_REQUIRED' }, 401) : response({ authenticated: true })
    throw new Error('Unexpected test request')
  })
  vi.stubGlobal('fetch', fetcher)
  const complete = vi.spyOn(auth, 'finishLogin').mockImplementation(() => undefined)
  const wrapper = mount(CompanionLogin, { global: { plugins: [ElementPlus] } }); wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, fetcher, complete }
}
const fill = async (wrapper: ReturnType<typeof mount>) => {
  await wrapper.get<HTMLInputElement>('input[aria-label="用户名"]').setValue('fixture-user')
  await wrapper.get<HTMLInputElement>('input[aria-label="密码"]').setValue('fixture-password')
  await wrapper.get<HTMLInputElement>('input[aria-label="验证码"]').setValue('1234')
}
describe('reused login form with Companion session adapter', () => {
  it('defaults to rejection when no allowed account is configured', async () => {
    const { wrapper, fetcher } = await page({ configured: false })
    expect(wrapper.text()).toContain('尚未配置允许登录的账号'); expect(wrapper.find('form').exists()).toBe(false)
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/auth/config'])
  })
  it('shows provider outage separately without offering a working login', async () => {
    const { wrapper } = await page({ available: false })
    expect(wrapper.text()).toContain('认证服务暂不可用'); expect(wrapper.find('form').exists()).toBe(false)
  })
  it('validates mandatory fields and clears verification text when refreshing captcha', async () => {
    const { wrapper, fetcher } = await page()
    await wrapper.get('form').trigger('submit'); expect(wrapper.text()).toContain('用户名不能为空')
    await fill(wrapper); await wrapper.get('button[aria-label="刷新图片验证码"]').trigger('click'); await flushPromises()
    expect(wrapper.get<HTMLInputElement>('input[aria-label="验证码"]').element.value).toBe('')
    expect(fetcher.mock.calls.filter(call => call[0] === '/api/auth/login')).toHaveLength(0)
  })
  it('verifies the Cookie before completing and never stores any password or token', async () => {
    const localWrite = vi.spyOn(Storage.prototype, 'setItem')
    const { wrapper, fetcher, complete } = await page()
    await fill(wrapper); await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/auth/config', '/api/auth/captcha', '/api/auth/login', '/api/ui/session'])
    expect(complete).toHaveBeenCalledTimes(1); expect(localWrite).not.toHaveBeenCalled()
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
  })
  it('handles expired/unset Cookie without claiming success or replaying POST', async () => {
    const { wrapper, fetcher, complete } = await page({ session: false })
    await fill(wrapper); await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(complete).not.toHaveBeenCalled(); expect(wrapper.text()).toContain('当前浏览器会话未建立')
    expect(wrapper.get<HTMLInputElement>('input[aria-label="密码"]').element.value).toBe('')
    expect(fetcher.mock.calls.filter(call => call[0] === '/api/auth/login')).toHaveLength(1)
  })
  it.each([[401, 'AUTH_INVALID_CREDENTIALS', '用户名、密码或验证码不正确'], [403, 'AUTH_ACCOUNT_NOT_ALLOWED', '此账号不允许登录'], [503, 'AUTH_NOT_CONFIGURED', '尚未配置允许登录的账号']])('shows exact rejection and clears password for %s', async (status, code, text) => {
    const { wrapper, fetcher, complete } = await page({ loginStatus: status as number, loginCode: code })
    await fill(wrapper); await wrapper.get('form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).toContain(text); expect(complete).not.toHaveBeenCalled()
    if (wrapper.find('input[aria-label="密码"]').exists()) expect(wrapper.get<HTMLInputElement>('input[aria-label="密码"]').element.value).toBe('')
    expect(fetcher.mock.calls.filter(call => call[0] === '/api/auth/login')).toHaveLength(1)
  })
  it('gives an explicit captcha retry and does not start login when captcha read fails', async () => {
    const { wrapper, fetcher } = await page({ captchaFails: true })
    expect(wrapper.text()).toContain('认证服务暂不可用')
    await wrapper.get('form').trigger('submit'); expect(fetcher.mock.calls.filter(call => call[0] === '/api/auth/login')).toHaveLength(0)
  })
})
