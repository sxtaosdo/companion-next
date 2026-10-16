import type { ImageReviewSnapshot, ReviewImage } from '../domain/image-review'
import type { ReviewCooldown, ReviewSourceId, ReviewSourceReport, ReviewTaskHistory, ReviewTaskMetadata } from '../domain/image-review-workflow'
const ID = /^[a-f0-9]{32}$/
const SOURCES = ['openverse', 'commons', 'browser_import']
const ITEM_STATES = ['waiting', 'downloading', 'ready', 'failed', 'duplicate', 'trash']
const TASK_STATES = ['searching', 'downloading', 'done', 'stopped', 'failed', 'interrupted']
const REPORT_STATES = ['pending', 'searching', 'searched', 'downloading', 'done', 'failed', 'limited', 'blocked', 'stopped', 'interrupted']
function object(input: unknown): Record<string, unknown> { if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('审阅服务响应不是有效对象'); return input as Record<string, unknown> }
function list(input: unknown, max: number): unknown[] { if (!Array.isArray(input) || input.length > max) throw new Error('审阅列表超出合同上限'); return input }
function text(input: unknown, max = 1000): string { if (input === undefined || input === null) return ''; if (typeof input !== 'string' || input.length > max) throw new Error('审阅文本字段无效或过长'); return input }
function id(input: unknown): string { if (typeof input !== 'string' || !ID.test(input)) throw new Error('审阅任务或候选 ID 无效'); return input }
function number(input: unknown, max = Number.MAX_VALUE): number { if (typeof input !== 'number' || !Number.isFinite(input) || input < 0 || input > max) throw new Error('审阅数值字段无效'); return input }
function count(input: unknown, max = 30): number | null { if (input === undefined || input === null) return null; const value = number(input, max); if (!Number.isInteger(value)) throw new Error('审阅计数字段无效'); return value }
function dimension(input: unknown): number | null { const value = count(input, 200000); if (value === 0) throw new Error('审阅图片尺寸无效'); return value }
function boolean(input: unknown): boolean { if (input === undefined || input === null) return false; if (typeof input !== 'boolean') throw new Error('审阅布尔字段无效'); return input }
function mode(input: unknown): 'search' | 'browser_import' { if (input !== 'search' && input !== 'browser_import') throw new Error('审阅任务模式无效'); return input }
function source(input: unknown): ReviewSourceId { if (typeof input !== 'string' || !SOURCES.includes(input)) throw new Error('审阅来源无效'); return input as ReviewSourceId }
function sourceIds(input: unknown): ReviewSourceId[] { const values = list(input ?? [], 3).map(source); if (new Set(values).size !== values.length) throw new Error('审阅来源重复'); return values }
function cooldown(input: unknown): ReviewCooldown {
 const entry = object(input); const key = text(entry.key, 320)
 if (!/^(?:source:(?:openverse|commons)|host:[^\s/\\?#@]+)$/.test(key)) throw new Error('审阅冷却作用域无效')
 const observedAt = entry.observed_at === undefined ? undefined : number(entry.observed_at)
 const nextAllowedAt = number(entry.next_allowed_at)
 if (observedAt !== undefined && observedAt > nextAllowedAt) throw new Error('审阅冷却时间无效')
 if (entry.http_status !== undefined && entry.http_status !== null && entry.http_status !== 429) throw new Error('审阅冷却 HTTP 状态无效')
 return { key, nextAllowedAt, observedAt, manualHold: boolean(entry.manual_hold), retryAfter: text(entry.retry_after_raw, 200), httpStatus: entry.http_status as number | null | undefined }
}
function report(input: unknown): ReviewSourceReport {
 const row = object(input)
 if (!REPORT_STATES.includes(row.status as string)) throw new Error('逐来源状态无效')
 return { sourceId: source(row.source_id), label: text(row.label, 200), status: row.status as string, error: text(row.error), reasons: list(row.reasons ?? [], 30).map(value => text(value, 1000)), requested: count(row.requested), returned: count(row.returned), accepted: count(row.accepted), skipped: count(row.skipped), duplicateUrls: count(row.duplicate_urls), downloaded: count(row.downloaded), downloadFailed: count(row.download_failed), duplicateContents: count(row.duplicate_contents), nextAllowedAt: row.next_allowed_at == null ? 0 : number(row.next_allowed_at), manualHold: boolean(row.manual_hold) }
}
function taskMetadata(row: Record<string, unknown>): ReviewTaskMetadata {
 if (!TASK_STATES.includes(row.status as string)) throw new Error('审阅任务状态无效')
 const reports = list(row.source_reports ?? [], 3).map(report)
 if (new Set(reports.map(row => row.sourceId)).size !== reports.length) throw new Error('逐来源报告重复')
 return { mode: mode(row.mode), status: row.status as string, query: text(row.query, 400), limit: count(row.limit), createdAt: text(row.created_at, 100), provider: text(row.provider, 300), error: text(row.error), sourceIds: sourceIds(row.source_ids), reports }
}
function history(input: unknown): ReviewTaskHistory { const row = object(input); return { id: id(row.id), query: text(row.query, 400), createdAt: text(row.created_at, 100), provider: text(row.provider, 300), mode: mode(row.mode), sourceIds: sourceIds(row.source_ids) } }
export function normalizeImageReviewState(input: unknown): ImageReviewSnapshot {
 const root = object(input)
 if (typeof root.busy !== 'boolean') throw new Error('审阅忙碌状态缺失')
 const historyItems = list(root.tasks ?? [], 100).map(history)
 const cooldowns = list(root.cooldowns ?? [], 128).map(cooldown)
 const sources = list(root.sources ?? [], 2).map(value => { const row = object(value); const key = source(row.id); if (key === 'browser_import') throw new Error('关键词来源无效'); return { id: key, label: text(row.label, 200), description: text(row.description, 1000) } })
 if (new Set(historyItems.map(row => row.id)).size !== historyItems.length || new Set(cooldowns.map(row => row.key)).size !== cooldowns.length || new Set(sources.map(row => row.id)).size !== sources.length) throw new Error('服务投影包含重复标识')
 const common = { busy: root.busy, sources, history: historyItems, cooldowns, ...(root.cache === undefined ? {} : {cache: text(root.cache,4096)}) }
 if (root.task === null) return { taskId: null, items: [], task: null, ...common }
 const task = object(root.task); const taskId = id(task.id); const metadata = taskMetadata(task)
 const selected = list(task.selected, 30).map(id)
 if (new Set(selected).size !== selected.length) throw new Error('服务选择列表重复')
 const items = list(task.items, 30).map((value): ReviewImage => {
  const row = object(value); const itemId = id(row.id)
  if (!ITEM_STATES.includes(row.status as string) || typeof row.title !== 'string') throw new Error('审阅候选状态或名称无效')
  const contentType = row.content_type == null ? null : text(row.content_type, 100)
  const width = dimension(row.width), height = dimension(row.height)
  if (['ready', 'trash'].includes(row.status as string) && (!width || !height || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType as string))) throw new Error('已下载图片缺少受支持的像素 / 格式证据')
  return { id: itemId, status: row.status as string, selected: selected.includes(itemId), title: text(row.title), width, height, contentType, imageUrl: text(row.image_url, 4096), sourcePage: text(row.source_page, 4096), sourceWebsite: text(row.source_website, 320), creator: text(row.creator, 400), license: text(row.license, 200), licenseVersion: text(row.license_version, 200), licenseUrl: text(row.license_url, 4096), sourceLabel: text(row.provider || row.source, 200), candidateKind: text(row.candidate_kind, 100), discoveryMethod: text(row.discovery_method, 200), error: text(row.export_error || row.error), bytes: count(row.bytes, 10 * 1024 * 1024), cooldownKey: text(row.cooldown_key, 320), nextAllowedAt: row.next_allowed_at == null ? 0 : number(row.next_allowed_at), manualHold: boolean(row.manual_hold) }
 })
 if (new Set(items.map(row => row.id)).size !== items.length || selected.some(value => !items.some(row => row.id === value && row.status === 'ready'))) throw new Error('服务任务包含重复候选或无效选择')
 return { ...common, taskId, task: metadata, items }
}
