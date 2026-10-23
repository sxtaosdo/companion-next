import { safeCompanionReturnTo } from '../domain/companion-session-recovery'
export class LoginFailure extends Error {
  constructor(public readonly code: string) { super(code) }
}
export interface LoginConfig { available: boolean; configured: boolean; captchaRequired?: boolean }
export interface Captcha { captchaId: string; image: string }
export interface LoginForm { username: string; password: string; captchaId?: string; verifyCode?: string }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
async function request(fetcher: typeof fetch, path: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try { response = await fetcher(path, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', ...init }) } catch { throw new LoginFailure('AUTH_PROVIDER_UNAVAILABLE') }
  let data: unknown
  try { data = await response.json() } catch { throw new LoginFailure('AUTH_INVALID_RESPONSE') }
  if (!response.ok) {
    const code = object(data) && typeof data.code === 'string' ? data.code : ''
    if (response.status === 429 && code === 'AUTH_RATE_LIMITED') throw new LoginFailure(code)
    if (response.status === 401 && code === 'AUTH_INVALID_CREDENTIALS') throw new LoginFailure(code)
    if (response.status === 401 && code === 'UI_SESSION_REQUIRED') throw new LoginFailure('UI_SESSION_REQUIRED')
    if (response.status === 403 && code === 'AUTH_ACCOUNT_NOT_ALLOWED') throw new LoginFailure(code)
    if (response.status === 503 && ['AUTH_PROVIDER_UNAVAILABLE', 'AUTH_NOT_CONFIGURED'].includes(code)) throw new LoginFailure(code)
    throw new LoginFailure(response.status === 403 ? 'AUTH_ACCESS_DENIED' : 'AUTH_INVALID_RESPONSE')
  }
  return data
}
export async function readLoginConfig(fetcher: typeof fetch): Promise<LoginConfig> {
  const data = await request(fetcher, '/api/auth/config')
  if (!object(data) || typeof data.available !== 'boolean' || typeof data.configured !== 'boolean') throw new LoginFailure('AUTH_INVALID_RESPONSE')
  return { available: data.available, configured: data.configured, ...(data.captchaRequired === false ? { captchaRequired: false } : {}) }
}
export async function readCaptcha(fetcher: typeof fetch): Promise<Captcha> {
  const data = await request(fetcher, '/api/auth/captcha')
  if (!object(data) || typeof data.captchaId !== 'string' || !data.captchaId || data.captchaId.length > 512 || typeof data.image !== 'string' || data.image.length > 2 * 1024 * 1024
    || !/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(data.image)) throw new LoginFailure('AUTH_INVALID_RESPONSE')
  return { captchaId: data.captchaId, image: data.image }
}
export async function submitLogin(fetcher: typeof fetch, form: LoginForm): Promise<void> {
  const data = await request(fetcher, '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.username, password: form.password, ...(form.captchaId !== undefined || form.verifyCode !== undefined ? { captchaId: form.captchaId, verifyCode: form.verifyCode } : {}) }) })
  // Only the Companion HttpOnly Cookie is accepted. Never consume a JWT or provider token.
  if (!object(data) || Object.keys(data).length !== 1 || data.authenticated !== true) throw new LoginFailure('AUTH_INVALID_RESPONSE')
}
export async function verifyLoginSession(fetcher: typeof fetch): Promise<void> {
  const data = await request(fetcher, '/api/ui/session')
  if (!object(data) || data.authenticated !== true) throw new LoginFailure('UI_SESSION_REQUIRED')
}
export function loginDestination(search: string, inheritedHash = ''): string {
  const fallback = '/next/index.html#/overview'
  const target = safeCompanionReturnTo(new URLSearchParams(search).get('returnTo'))
  if (!target) return fallback
  if (target.includes('#') || !inheritedHash) return target
  // HTTP redirects cannot receive a fragment; browsers may carry it to /login.
  // Validate the combined destination again, never carry credentials in the fragment.
  if (!inheritedHash.startsWith('#/') || inheritedHash.startsWith('#//')) return fallback
  return safeCompanionReturnTo(target + inheritedHash) ?? fallback
}
export function finishLogin(search: string, origin: string, embeddedParent: Pick<Window, 'postMessage'> | null, navigate: (target: string) => void, inheritedHash = ''): void {
  if (new URLSearchParams(search).get('embedded') === '1' && embeddedParent) embeddedParent.postMessage({ type: 'companion:session-restored' }, origin)
  else navigate(loginDestination(search, inheritedHash))
}
export function loginError(error: unknown): string {
  const code = error instanceof LoginFailure ? error.code : 'AUTH_PROVIDER_UNAVAILABLE'
  return ({ AUTH_RATE_LIMITED: '登录尝试过多，请稍后重试。', AUTH_INVALID_CREDENTIALS: '用户名或密码不正确，请重新输入。', AUTH_ACCOUNT_NOT_ALLOWED: '此账号不允许登录开发者后台。', AUTH_NOT_CONFIGURED: '尚未配置允许登录的账号，当前拒绝登录。', AUTH_PROVIDER_UNAVAILABLE: '认证服务暂不可用，请稍后重试。', AUTH_ACCESS_DENIED: '访问被拒绝，请检查登录权限。', UI_SESSION_REQUIRED: '当前浏览器会话未建立，请重新登录。', AUTH_INVALID_RESPONSE: '登录响应无效，请稍后重试。' } as Record<string, string>)[code] ?? '登录失败，请稍后重试。'
}
