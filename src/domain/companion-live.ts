import type { CallRecord } from './companion-browser'

/** v148 sends current call updates; it provides no event IDs, replay or heartbeat guarantee. */
export interface CompanionCallUpdate { sessionId: string; total: number; record: CallRecord }
export type CompanionEventCode = 'invalid-frame' | 'frame-too-large' | 'connection-error'
const failureText: Record<CompanionEventCode, string> = {
  'invalid-frame': '实时事件不符合已核实的 v148 契约，连接已关闭。',
  'frame-too-large': '实时事件超出安全预算，连接已关闭。',
  'connection-error': '实时事件连接未能建立或已中断。',
}
/** Only a fixed code/message is exposed; never include event data, URLs or transport causes. */
export class CompanionEventError extends Error {
  constructor(readonly code: CompanionEventCode) {
    super(failureText[code])
    this.name = 'CompanionEventError'
  }
}
export interface CompanionEventHandlers {
  onOpen(): void
  /** A validated log event is only a refresh hint; its raw payload is never exposed. */
  onLog(): void
  onCall(update: CompanionCallUpdate): void
  onError(error: CompanionEventError): void
}
export interface CompanionEventProvider {
  readonly label: string
  /** Explicit subscription only. The caller owns retries, reconciliation and visibility policy. */
  subscribe(handlers: CompanionEventHandlers, signal?: AbortSignal): () => void
}
