import { LOG_LEVELS, LOG_SOURCES } from '../domain/companion-browser'
import { CompanionEventError } from '../domain/companion-live'
import type { CompanionCallUpdate, CompanionEventCode, CompanionEventHandlers, CompanionEventProvider } from '../domain/companion-live'
import { COMPANION_READ_LIMITS, decodeCalls } from './companion-browser'

export type CompanionEventType = 'open' | 'message' | 'call' | 'error'
export interface CompanionEventSource {
  addEventListener(type: CompanionEventType, listener: EventListener): void
  removeEventListener(type: CompanionEventType, listener: EventListener): void
  close(): void
}
export type CompanionEventSourceFactory = (path: '/api/events') => CompanionEventSource
export const COMPANION_EVENT_LIMITS = Object.freeze({ maxFrameBytes: 65_536 })
const invalid = () => new CompanionEventError('invalid-frame')
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw invalid()
  return value
}
function identifier(value: unknown): void {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw invalid()
}
function validateLog(value: unknown): void {
  const item = object(value)
  identifier(item.id)
  identifier(item.projectId)
  if (!(LOG_SOURCES as readonly unknown[]).includes(item.source) || !(LOG_LEVELS as readonly unknown[]).includes(item.level)) throw invalid()
  const timestamp = text(item.time, 64)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw invalid()
  text(item.message, 8192, true)
  for (const key of ['instanceId', 'sessionId', 'operationId'] as const) if (item[key] !== undefined) text(item[key], 256, true)
}
function decodeCall(value: unknown): CompanionCallUpdate {
  const item = object(value)
  const raw = object(item.record)
  if (typeof raw.projectId !== 'string') throw invalid()
  // Reuse exactly the HTTP projection, bounds, safe identifiers and summary redaction.
  const page = decodeCalls({ sessionId: item.sessionId, total: item.total, retained: 1, records: [raw] }, raw.projectId, { failed: false })
  const record = page.records[0]!
  // begin() emits the newest running record; finish() can only emit retained records.
  if (page.total - record.sequence >= COMPANION_READ_LIMITS.maxRetainedCalls) throw invalid()
  if (record.status === 'running') {
    if (record.sequence !== page.total || record.durationMs !== undefined || record.resultSummary !== undefined || record.errorSummary !== undefined) throw invalid()
  } else {
    if (record.durationMs === undefined || record.resultSummary === undefined || (record.status === 'failed' ? record.errorSummary === undefined : record.errorSummary !== undefined)) throw invalid()
  }
  return { sessionId: page.sessionId, total: page.total, record }
}
function frame(event: Event, allowEmpty: boolean): { empty: true } | { empty: false; value: unknown } {
  const data: unknown = (event as MessageEvent<unknown>).data
  if (typeof data !== 'string') throw invalid()
  if (data.length > COMPANION_EVENT_LIMITS.maxFrameBytes || new TextEncoder().encode(data).byteLength > COMPANION_EVENT_LIMITS.maxFrameBytes) throw new CompanionEventError('frame-too-large')
  if (allowEmpty && !data.trim()) return { empty: true }
  try { return { empty: false, value: JSON.parse(data) as unknown } } catch { throw invalid() }
}

/** Passive fixed same-origin v148 SSE adapter. No URL, token, replay or automatic retry options. */
export function createCompanionEventProvider(options: { createEventSource: CompanionEventSourceFactory }): CompanionEventProvider {
  if (typeof options?.createEventSource !== 'function') throw new TypeError('实时事件适配器需要显式注入 EventSource 工厂。')
  const createEventSource = options.createEventSource
  return Object.freeze({
    label: 'Companion 同源实时事件（v148 契约）',
    subscribe(handlers: CompanionEventHandlers, signal?: AbortSignal): () => void {
      if (signal?.aborted) return () => undefined
      let active = true
      let source: CompanionEventSource | undefined
      let sourceClosed = false
      const attached: [CompanionEventType, EventListener][] = []
      const stop = () => {
        active = false
        signal?.removeEventListener('abort', stop)
        for (const [type, listener] of attached.splice(0)) {
          try { source?.removeEventListener(type, listener) } catch { /* Continue closing without exposing transport errors. */ }
        }
        if (source && !sourceClosed) {
          sourceClosed = true
          try { source.close() } catch { /* A throwing injected transport cannot retain an active callback. */ }
        }
      }
      const fail = (code: CompanionEventCode) => {
        if (!active) return
        stop()
        handlers.onError(new CompanionEventError(code))
      }
      const onMessage: EventListener = (event) => {
        if (!active) return
        try {
          const decoded = frame(event, true)
          if (decoded.empty) return
          validateLog(decoded.value)
        } catch (error) {
          fail(error instanceof CompanionEventError ? error.code : 'invalid-frame')
          return
        }
        if (active) handlers.onLog()
      }
      const onCall: EventListener = (event) => {
        if (!active) return
        let update: CompanionCallUpdate
        try {
          const decoded = frame(event, false)
          if (decoded.empty) throw invalid()
          update = decodeCall(decoded.value)
        } catch (error) {
          fail(error instanceof CompanionEventError ? error.code : 'invalid-frame')
          return
        }
        if (active) handlers.onCall(update)
      }
      const listeners: [CompanionEventType, EventListener][] = [
        ['open', () => { if (active) handlers.onOpen() }],
        ['message', onMessage], ['call', onCall], ['error', () => fail('connection-error')],
      ]
      signal?.addEventListener('abort', stop, { once: true })
      try {
        source = createEventSource('/api/events')
        // An injected factory may synchronously abort before returning its transport.
        if (!active || signal?.aborted) { stop(); return stop }
        for (const [type, listener] of listeners) {
          if (!active) break
          attached.push([type, listener])
          source.addEventListener(type, listener)
        }
      } catch { fail('connection-error') }
      return stop
    },
  })
}
