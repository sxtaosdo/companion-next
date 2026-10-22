import { describe, expect, it, vi } from 'vitest'
import { finishLogin, loginDestination, loginError, readCaptcha, readLoginConfig, submitLogin, verifyLoginSession } from '../src/login/auth'
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const png = 'data:image/png;base64,aGVsbG8='
const form = { username: 'fixture-user', password: 'fixture-password', captchaId: 'fixture-captcha', verifyCode: '1234' }
describe('same-origin Cookie login contract', () => {
  it('reads capability and captcha only from existing same-origin endpoints', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ available: true, configured: true })).mockResolvedValueOnce(response({ captchaId: 'one', image: png }))
    expect(await readLoginConfig(fetcher)).toEqual({ available: true, configured: true }); expect(await readCaptcha(fetcher)).toEqual({ captchaId: 'one', image: png })
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/auth/config', '/api/auth/captcha'])
    for (const call of fetcher.mock.calls) expect(call[1]).toMatchObject({ credentials: 'same-origin', cache: 'no-store', redirect: 'error' })
  })
  it('sends exactly one login request with only the approved four fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ authenticated: true }))
    await submitLogin(fetcher, form)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]![0]).toBe('/api/auth/login')
    const init = fetcher.mock.calls[0]![1]; expect(init.method).toBe('POST'); expect(JSON.parse(init.body)).toEqual(form)
  })
  it.each([[401, 'AUTH_INVALID_CREDENTIALS'], [403, 'AUTH_ACCOUNT_NOT_ALLOWED'], [503, 'AUTH_PROVIDER_UNAVAILABLE'], [503, 'AUTH_NOT_CONFIGURED']])('preserves login rejection %s %s without replay', async (status, code) => {
    const fetcher = vi.fn().mockResolvedValue(response({ code }, status as number))
    await expect(submitLogin(fetcher, form)).rejects.toHaveProperty('code', code); expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('never accepts a token or JWT response as a browser session', async () => {
    for (const data of [{ token: 'fixture-only' }, { authenticated: true, access_token: 'fixture-only' }, { authenticated: false }]) await expect(submitLogin(vi.fn().mockResolvedValue(response(data)), form)).rejects.toHaveProperty('code', 'AUTH_INVALID_RESPONSE')
  })
  it.each(['javascript:alert(1)', 'data:text/html;base64,WA==', '<svg/>', 'https://example.test/captcha'])('rejects unsafe captcha images %s', async image => {
    await expect(readCaptcha(vi.fn().mockResolvedValue(response({ captchaId: 'one', image })))).rejects.toHaveProperty('code', 'AUTH_INVALID_RESPONSE')
  })
  it('requires the current browser Cookie session after accepted credentials', async () => {
    await expect(verifyLoginSession(vi.fn().mockResolvedValue(response({ code: 'UI_SESSION_REQUIRED' }, 401)))).rejects.toHaveProperty('code', 'UI_SESSION_REQUIRED')
    await expect(verifyLoginSession(vi.fn().mockResolvedValue(response({ authenticated: true })))).resolves.toBeUndefined()
  })
  it('does not expose provider messages in displayed errors', () => expect(loginError(new Error('password or token must never be shown'))).not.toContain('password'))
})
describe('safe login completion', () => {
  it('preserves internal query/hash route and refuses malicious targets', () => {
    expect(loginDestination('?returnTo=' + encodeURIComponent('/next/index.html?x=one#/art-resources?project=abc'))).toBe('/next/index.html?x=one#/art-resources?project=abc')
    for (const bad of ['//evil.test', 'https://evil.test', '/next/index.html?access_token=fixture', '/next/index.html#/x?password=fixture', '/next/index.html%0a']) expect(loginDestination('?returnTo=' + encodeURIComponent(bad))).toBe('/next/index.html#/overview')
  })
  it('inherits a browser-carried internal fragment only when a validated destination has none', () => {
    expect(loginDestination('?returnTo=%2Fnext%2Findex.html%3Fmode%3Dedit', '#/art-resources?project=abc')).toBe('/next/index.html?mode=edit#/art-resources?project=abc')
    expect(loginDestination('?returnTo=%2Fnext%2Findex.html%23%2Fprojects', '#/ignored')).toBe('/next/index.html#/projects')
    expect(loginDestination('?returnTo=https%3A%2F%2Fevil.test', '#/projects')).toBe('/next/index.html#/overview')
    for (const hash of ['#https://evil.test', '#//evil.test', '#/projects?token=fixture', '#/projects?access_token=fixture', '#/projects?refresh_token=fixture', '#/projects?password=fixture', '#/projects%0a', '#/projects%5c', '#/x' + 'x'.repeat(2048)]) expect(loginDestination('?returnTo=%2Fnext%2Findex.html', hash)).toBe('/next/index.html#/overview')
  })
  it('passes the inherited fragment through verified standalone completion', () => {
    const navigate = vi.fn()
    finishLogin('?returnTo=%2Fnext%2Findex.html', 'http://127.0.0.1:32180', null, navigate, '#/projects?project=abc')
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/next/index.html#/projects?project=abc')
  })
  it('posts the existing single-field message only to same-origin parent in embedded mode', () => {
    const parent = { postMessage: vi.fn() }, navigate = vi.fn()
    finishLogin('?embedded=1', 'http://127.0.0.1:32180', parent, navigate)
    expect(parent.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'companion:session-restored' }, 'http://127.0.0.1:32180'); expect(navigate).not.toHaveBeenCalled()
    finishLogin('?returnTo=%2Fnext%2Findex.html%23%2Fprojects', 'http://127.0.0.1:32180', null, navigate)
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/next/index.html#/projects')
  })
})
