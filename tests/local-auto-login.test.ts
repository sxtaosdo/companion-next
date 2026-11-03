import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizeLocalSession, readLoginConfig, verifyLoginSession } from '../src/login/auth'
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
afterEach(() => vi.useRealTimers())
describe('explicit local browser authorization', () => {
  it('reads the server mode, shares one authorization and verifies the real Cookie', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ available: true, configured: true, captchaRequired: false, authMode: 'local-auto' }))
      .mockResolvedValueOnce(json({ authenticated: true })).mockResolvedValueOnce(json({ authenticated: true }))
    expect((await readLoginConfig(fetcher)).authMode).toBe('local-auto')
    await Promise.all([authorizeLocalSession(fetcher), authorizeLocalSession(fetcher)])
    await verifyLoginSession(fetcher)
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['/api/auth/config', '/api/auth/local-session', '/api/ui/session'])
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'POST', credentials: 'same-origin', body: '{}' })
  })
  it('ends a stalled request at five seconds even if fetch ignores cancellation', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(() => {}))
    const pending = readLoginConfig(fetcher)
    const assertion = expect(pending).rejects.toHaveProperty('code', 'AUTH_TIMEOUT')
    await vi.advanceTimersByTimeAsync(5000)
    await assertion
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
  })
  it('rejects an unknown mode and never upgrades an unavailable account config', async () => {
    await expect(readLoginConfig(vi.fn().mockResolvedValue(json({ available: true, configured: true, authMode: 'anything' })))).rejects.toHaveProperty('code', 'AUTH_INVALID_RESPONSE')
    const fetcher = vi.fn().mockResolvedValue(json({ available: false, configured: true, authMode: 'account' }))
    expect((await readLoginConfig(fetcher)).authMode).toBe('account')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
