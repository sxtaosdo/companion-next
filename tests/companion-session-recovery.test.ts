import { afterEach, describe, expect, it, vi } from 'vitest'
import { COMPANION_SESSION_REQUIRED_EVENT, installCompanionSessionRecovery, isSessionRestoredMessage, safeCompanionReturnTo } from '../src/domain/companion-session-recovery'
import { loginDestination } from '../src/login/auth'
const origin = 'http://127.0.0.1:32180'
const settle = () => new Promise(resolve => setTimeout(resolve, 15))
const disposals: Array<() => void> = []
afterEach(() => { disposals.splice(0).forEach(dispose => dispose()) })
function setup(response: Response) {
  const fetch = vi.fn(async () => response)
  const target = { fetch: fetch as typeof window.fetch, location: { origin, search: '?context=test', hash: '#/art-resources?project=one' }, dispatchEvent: vi.fn((_event: Event) => true) }
  disposals.push(installCompanionSessionRecovery(target))
  return { target, fetch }
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
describe('session-required transport guidance', () => {
  it('returns the original response and never replays a rejected POST or alters its input', async () => {
    const response = json(401, { code: 'UI_SESSION_REQUIRED' }), { target, fetch } = setup(response)
    const init = { method: 'POST', body: 'original-draft' }
    expect(await target.fetch('/api/projects/install', init)).toBe(response)
    expect(await response.json()).toEqual({ code: 'UI_SESSION_REQUIRED' })
    await settle()
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/projects/install', init)
    expect(target.dispatchEvent).toHaveBeenCalledTimes(1)
    const event = target.dispatchEvent.mock.calls[0]![0] as CustomEvent
    expect(event.type).toBe(COMPANION_SESSION_REQUIRED_EVENT)
    expect(event.detail).toEqual({ returnTo: '/next/index.html?context=test#/art-resources?project=one' })
  })
  it.each([
    [403, { code: 'UI_SESSION_REQUIRED' }, '/api/projects'],
    [403, { code: 'FORBIDDEN' }, '/api/projects'],
    [401, { code: 'AUTH_MISSING' }, '/api/knowledge/chat'],
    [401, { error: { code: 'UI_SESSION_REQUIRED' } }, '/api/projects'],
    [401, { code: 'UI_SESSION_REQUIRED' }, 'http://example.test/api/projects'],
    [401, { code: 'UI_SESSION_REQUIRED' }, 'http://127.0.0.1:32181/api/projects'],
    [401, { code: 'UI_SESSION_REQUIRED' }, '/v1/projects'],
  ])('does not reinterpret foreign endpoints, generic permissions or unrelated authentication (%s %s %s)', async (status, body, url) => {
    const { target, fetch } = setup(json(status as number, body))
    await target.fetch(url as string); await settle()
    expect(target.dispatchEvent).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('does not notify a different route after a delayed old response', async () => {
    const { target } = setup(json(401, { code: 'UI_SESSION_REQUIRED' }))
    await target.fetch('/api/projects'); target.location.hash = '#/help'; await settle()
    expect(target.dispatchEvent).not.toHaveBeenCalled()
  })
  it('ignores a response from a replaced provider', async () => {
    let source = {}
    const target = { fetch: vi.fn(async () => json(401, { code: 'UI_SESSION_REQUIRED' })) as typeof window.fetch, location: { origin, search: '', hash: '#/projects' }, dispatchEvent: vi.fn((_event: Event) => true) }
    disposals.push(installCompanionSessionRecovery(target, () => source))
    await target.fetch('/api/projects'); source = {}; await settle()
    expect(target.dispatchEvent).not.toHaveBeenCalled()
  })
  it('fails closed on malformed and oversized error bodies', async () => {
    for (const body of ['bad json', JSON.stringify({ code: 'UI_SESSION_REQUIRED', extra: 'x'.repeat(3000) })]) {
      const { target } = setup(new Response(body, { status: 401, headers: { 'content-type': 'application/json' } }))
      await target.fetch('/api/projects'); await settle(); expect(target.dispatchEvent).not.toHaveBeenCalled()
    }
  })
  it('installs once before providers bind fetch and safely restores its own wrapper', () => {
    const { target, fetch } = setup(json(200, {})), first = target.fetch
    const dispose = installCompanionSessionRecovery(target)
    expect(target.fetch).toBe(first); dispose(); expect(target.fetch).toBe(fetch)
  })
})
describe('safe return and trusted iframe messages', () => {
  const versionedPath = `/game-meta-${'a1'.repeat(32)}/index.html`
  it('preserves versioned Game Meta paths and safely merges the inherited route', () => {
    expect(safeCompanionReturnTo(`${versionedPath}?mode=edit#/projects?project=abc`)).toBe(`${versionedPath}?mode=edit#/projects?project=abc`)
    const search = `?returnTo=${encodeURIComponent(`${versionedPath}?mode=edit`)}`
    expect(loginDestination(search, '#/projects?project=abc')).toBe(`${versionedPath}?mode=edit#/projects?project=abc`)
    expect(loginDestination(search, '#/projects?token=secret')).toBe('/next/index.html#/overview')
    expect(loginDestination(search, '#//evil.test')).toBe('/next/index.html#/overview')
  })
  it.each([
    `/game-meta-${'a'.repeat(63)}/index.html`, `/game-meta-${'a'.repeat(65)}/index.html`,
    `/game-meta-${'A'.repeat(64)}/index.html`, `/game-meta-${'g'.repeat(64)}/index.html`,
    `/game-meta-%61${'a'.repeat(63)}/index.html`, `/x/../game-meta-${'a'.repeat(64)}/index.html`,
    `/game-meta-${'a'.repeat(64)}/%69ndex.html`, `/game-meta-${'a'.repeat(64)}/index.html/`,
    `//evil.test${versionedPath}`, `${versionedPath}?access_token=secret`,
    `${versionedPath}#/projects?refresh_token=secret`, `${versionedPath}#https://evil.test`,
    `${versionedPath}#//evil.test`, `${versionedPath}#/%2fevil.test`, `${versionedPath}?bad=%`,
  ])('rejects unsafe versioned return path %s', value => expect(safeCompanionReturnTo(value)).toBeNull())
  it.each(['/next/index.html?mode=edit#/art-resources?project=abc', '/game-meta/index.html', '/game-meta/index.html?mode=edit#/projects?project=abc'])('preserves internal page, query and route: %s', value => expect(safeCompanionReturnTo(value)).toBe(value))
  it.each(['/game-meta/', '/game-meta/index.html/', '/game-meta/../game-meta/index.html', '/game-meta/%2e%2e/game-meta/index.html', '/game-meta/%69ndex.html', '//evil.test/game-meta/index.html', '/game-meta/index.html?token=secret', '/game-meta/index.html?%61ccess_token=secret', '/game-meta/index.html#/projects?refresh_token=secret', '/game-meta/index.html#https://evil.test', '/game-meta/index.html?bad=%'])('rejects unsafe Game Meta return path %s', value => expect(safeCompanionReturnTo(value)).toBeNull())
  it.each(['/', '/next/'])('normalizes %s to Next', value => expect(safeCompanionReturnTo(value)).toBe('/next/index.html'))
  it.each(['https://evil.test', '//evil.test/next/index.html', '/%2f/evil.test', '/next/index.html\\evil', '/next/index.html%0a', '/login', '/next/index.html?token=secret', '/next/index.html?access_token=secret', '/next/index.html#/projects?refresh_token=secret', '/next/index.html#/projects?token=secret', '/next/index.html#https://evil.test', '/next/../login', '/next/index.html?bad=%', null])('rejects unsafe return path %s', value => expect(safeCompanionReturnTo(value)).toBeNull())
  it('requires exact message schema, origin and iframe source', () => {
    const frame = {} as Window, other = {} as Window
    const event = { origin, source: frame, data: { type: 'companion:session-restored' } }
    expect(isSessionRestoredMessage(event, origin, frame)).toBe(true)
    for (const delta of [{ origin: 'https://evil.test' }, { source: other }, { data: { type: 'companion:session-restored', authenticated: true } }, { data: { type: 'other' } }]) expect(isSessionRestoredMessage({ ...event, ...delta }, origin, frame)).toBe(false)
    expect(isSessionRestoredMessage(event, origin, null)).toBe(false)
  })
})
