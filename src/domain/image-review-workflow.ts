import { publicAddress } from './picker-import'
/** Bounded projections of the original public-image-review v0.1.0.20 contract. */
export type SearchSourceId = 'openverse' | 'commons'
export type ReviewSourceId = SearchSourceId | 'browser_import'
export interface ImageSearchRequest { query: string; limit: number; sourceIds: SearchSourceId[] }
export interface ReviewSource { id: SearchSourceId; label: string; description: string }
export interface ReviewCooldown { key: string; nextAllowedAt: number; manualHold: boolean; retryAfter: string; observedAt?: number; httpStatus?: number | null }
export interface ReviewSourceReport {
  sourceId: ReviewSourceId; label: string; status: string; error: string; reasons: string[]
  requested: number | null; returned: number | null; accepted: number | null; skipped: number | null
  duplicateUrls: number | null; downloaded: number | null; downloadFailed: number | null; duplicateContents: number | null
  nextAllowedAt: number; manualHold: boolean
}
export interface ReviewTaskMetadata { mode: 'search' | 'browser_import'; status: string; query: string; limit: number | null; createdAt: string; provider: string; error: string; sourceIds: ReviewSourceId[]; reports: ReviewSourceReport[] }
export interface ReviewTaskHistory { id: string; query: string; createdAt: string; provider: string; mode: 'search' | 'browser_import'; sourceIds: ReviewSourceId[] }
export const SEARCH_SOURCES: readonly SearchSourceId[] = ['openverse', 'commons']
export function validateImageSearch(input: ImageSearchRequest): ImageSearchRequest {
  if (!input || typeof input.query !== 'string' || /[\u0000-\u001f]/.test(input.query) || !input.query.trim() || Array.from(input.query.trim()).length > 200) throw new Error('请输入 1–200 字关键词，不含控制字符')
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 30) throw new Error('单次合并上限为 1–30 张')
  if (!Array.isArray(input.sourceIds) || !input.sourceIds.length || input.sourceIds.length > 2 || new Set(input.sourceIds).size !== input.sourceIds.length || input.sourceIds.some(id => !SEARCH_SOURCES.includes(id)) || input.limit < input.sourceIds.length) throw new Error('请选择已接入来源，合并上限不能小于来源数')
  return { query: input.query.trim(), limit: input.limit, sourceIds: [...input.sourceIds] }
}
/** Only explicit user clicks navigate these links; never use metadata as an image src. */
export function safeReviewLink(value: string | undefined): string | null {
  if (!value || value.length > 4096 || /[\u0000-\u001f\u007f]/.test(value)) return null
  try { return new URL(publicAddress(value, '元数据链接')).href } catch { return null }
}
export function reviewCooldownUntil(item: { imageUrl?: string; cooldownKey?: string; nextAllowedAt?: number; manualHold?: boolean }, cooldowns: ReviewCooldown[]): number {
  let hostKey = ''
  try { hostKey = `host:${new URL(item.imageUrl ?? '').hostname.replace(/^\[|\]$/g, '')}` } catch { /* absent legacy metadata does not grant a network request */ }
  const matching = cooldowns.filter(entry => entry.key === hostKey || entry.key === item.cooldownKey)
  return item.manualHold || matching.some(entry => entry.manualHold) ? Infinity : Math.max(item.nextAllowedAt ?? 0, ...matching.map(entry => entry.nextAllowedAt))
}
export function cooldownLabel(until: number, now = Date.now()): string {
  if (!Number.isFinite(until) || !Number.isFinite(new Date(until * 1000).getTime())) return '等待时间超出显示范围；保持停止请求，需人工检查冷却记录'
  return until * 1000 > now ? `下次可试：${new Date(until * 1000).toLocaleString()}；不会自动重试` : '冷却时间已到，可由用户重试；不保证来源恢复'
}
