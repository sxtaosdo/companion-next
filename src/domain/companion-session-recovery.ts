/** Browser guidance only: never grants a session or retries a request. */
export const COMPANION_SESSION_REQUIRED_EVENT = 'companion:session-required'
export const COMPANION_SESSION_RESTORED_MESSAGE = 'companion:session-restored'
export interface SessionRequiredDetail { returnTo: string }

export function safeCompanionReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || !value.startsWith('/') || value.startsWith('//') || /[\u0000-\u0020\u007f]/.test(value)) return null
  let decoded: string
  try { decoded = decodeURIComponent(value) } catch { return null }
  if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith('//')) return null
  try {
    const url = new URL(value, 'http://127.0.0.1')
    if (url.origin !== 'http://127.0.0.1' || !['/', '/next/', '/next/index.html'].includes(url.pathname)) return null
    if (url.hash && !url.hash.startsWith('#/')) return null
    // Authorization codes and credentials must never be copied into a return URL.
    const sensitive = (params: URLSearchParams) => [...params.keys()].some(key => /^(?:code|token|access_token|refresh_token|password|secret|authorization)$/i.test(key))
    if (sensitive(url.searchParams) || sensitive(new URLSearchParams(url.hash.split('?').slice(1).join('?')))) return null
    return `${['/', '/next/'].includes(url.pathname) ? '/next/index.html' : url.pathname}${url.search}${url.hash}`
  } catch { return null }
}

export function isSessionRestoredMessage(event: Pick<MessageEvent, 'origin' | 'source' | 'data'>, origin: string, frame: Window | null): boolean {
  if (!frame || event.origin !== origin || event.source !== frame) return false
  const data: unknown = event.data
  return !!data && typeof data === 'object' && !Array.isArray(data)
    && Object.keys(data).length === 1 && (data as { type?: unknown }).type === COMPANION_SESSION_RESTORED_MESSAGE
}

interface RecoveryTarget {
  fetch: typeof fetch
  location: Pick<Location, 'origin' | 'search' | 'hash'>
  dispatchEvent: (event: Event) => boolean
}
const installed = new WeakMap<object, () => void>()

async function sessionRequired(response: Response): Promise<boolean> {
  if (response.status !== 401 || !/application\/json/i.test(response.headers.get('content-type') ?? '')) return false
  const clone = response.clone()
  const reader = clone.body?.getReader()
  if (!reader) return false
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 2048) { void reader.cancel(); return false }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return !!body && typeof body === 'object' && !Array.isArray(body)
      && (body as { code?: unknown }).code === 'UI_SESSION_REQUIRED'
  } catch { return false } finally { reader.releaseLock() }
}

/** Install before providers bind fetch. Read the clone asynchronously, returning the untouched response. */
export function installCompanionSessionRecovery(target: RecoveryTarget, currentSource: () => unknown = () => undefined): () => void {
  const previous = installed.get(target)
  if (previous) return previous
  const original = target.fetch
  const currentReturn = () => safeCompanionReturnTo(`/next/index.html${target.location.search}${target.location.hash}`)
  const wrapped: typeof fetch = async (input, init) => {
    const returnTo = currentReturn()
    const source = currentSource()
    let candidate = false
    try {
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const url = new URL(raw, target.location.origin)
      candidate = url.origin === target.location.origin && url.pathname.startsWith('/api/')
    } catch { /* The original fetch retains responsibility for invalid inputs. */ }
    const response = await original.call(target, input, init)
    if (response.url) {
      try { const url = new URL(response.url); candidate = candidate && url.origin === target.location.origin && url.pathname.startsWith('/api/') } catch { candidate = false }
    }
    if (candidate && returnTo && response.status === 401) {
      void sessionRequired(response).then(required => {
        if (required && currentReturn() === returnTo && currentSource() === source) target.dispatchEvent(new CustomEvent<SessionRequiredDetail>(COMPANION_SESSION_REQUIRED_EVENT, { detail: { returnTo } }))
      }).catch(() => undefined)
    }
    return response
  }
  target.fetch = wrapped
  const dispose = () => {
    if (target.fetch === wrapped) target.fetch = original
    installed.delete(target)
  }
  installed.set(target, dispose)
  return dispose
}
