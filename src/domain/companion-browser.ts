/** v148 Companion read contracts. No lifecycle, filesystem, credential or mutation methods. */
export const RUNTIME_STATES = ['stopped', 'launching', 'bridge-wait', 'ready', 'stopping', 'crashed', 'incompatible', 'error'] as const
export type RuntimeState = typeof RUNTIME_STATES[number] | 'unknown'
export type CapabilityProfile = 'read-only' | 'authoring' | 'full-control' | 'unknown'
export interface ManagedProject { id: string; name: string; path: string; requiredCreatorVersion?: string }
export interface ManagedStatus {
  projectId: string
  state: RuntimeState
  creatorVersion?: string
  capabilityProfile: CapabilityProfile
  launchSource?: 'dashboard'
  dashboardVersion?: string
  dashboardProgress?: string
  instanceId?: string
  pid?: number
  sessionId?: string
  /** Display-only error text with common credential patterns redacted by the adapter. */
  lastError?: string
}
export interface DashboardProject {
  path: string
  name: string
  version?: string
  /** Backend preserves the Dashboard profile's numeric timestamp; no invented observation time. */
  lastOpenedAt?: number
  source: 'dashboard' | 'creator-editor' | 'unknown'
  exists: boolean
  progress?: string
  state?: string
  running?: boolean
  pid?: number
}
export const LOG_SOURCES = ['launcher', 'creator', 'bridge', 'compile', 'preview', 'scene-console', 'preview-console'] as const
export type LogSource = typeof LOG_SOURCES[number] | 'unknown'
export const LOG_LEVELS = ['debug', 'info', 'warning', 'error'] as const
export type LogLevel = typeof LOG_LEVELS[number] | 'unknown'
export interface DebugEvent {
  id: string
  projectId: string
  instanceId?: string
  sessionId?: string
  source: LogSource
  level: LogLevel
  time: string
  message: string
  operationId?: string
}
export type LogRecord = DebugEvent
export interface LogFilter {
  projectIds?: readonly string[]
  sources?: readonly LogSource[]
  levels?: readonly LogLevel[]
  search?: string
  limit?: number
}
export type CallStatus = 'running' | 'success' | 'failed'
export interface CallRecord {
  id: string
  sequence: number
  projectId: string
  operation: string
  operationNameZh: string
  source: 'mcp' | 'cli' | 'web'
  startedAt: string
  status: CallStatus
  durationMs?: number
  inputSummary: string
  resultSummary?: string
  errorSummary?: string
}
export interface CallLatest { id: string; operationNameZh: string; startedAt: string; status: CallStatus; durationMs?: number }
export interface CallCounts { sessionId: string; counts: Record<string, number>; latest: Record<string, CallLatest> }
export interface CallPage { sessionId: string; total: number; retained: number; records: CallRecord[]; nextBefore?: number }
export interface ProjectRead {
  projects: ManagedProject[]
  /** May be empty after a failed status read; warnings must remain visible and missing per-project status is unknown. */
  statuses: ManagedStatus[]
  dashboard: DashboardProject[]
  /** An empty Dashboard result is not evidence of zero projects when a warning reports its read failed. */
  warnings: string[]
}
export interface CompanionBrowserProvider {
  readonly label: string
  /** False means only stored registration is read; no Bridge / Dashboard probes. */
  readonly runtimeProbesEnabled?: boolean
  readonly dashboardDiscoveryEnabled?: boolean
  /** Registration is mandatory. Status and Dashboard failures are partial reads with explicit warnings. */
  loadProjects(signal?: AbortSignal): Promise<ProjectRead>
  loadLogs(filter: LogFilter, signal?: AbortSignal): Promise<LogRecord[]>
  loadCounts(signal?: AbortSignal): Promise<CallCounts>
  loadCalls(projectId: string, options: { failed: boolean; before?: number }, signal?: AbortSignal): Promise<CallPage>
}
export function runtimeStateLabel(state: RuntimeState): string {
  return ({ stopped: '已停止', launching: '正在启动', 'bridge-wait': '等待 Bridge', ready: '已就绪', stopping: '正在停止', crashed: '异常退出', incompatible: '不兼容', error: '错误', unknown: '未知' } satisfies Record<RuntimeState, string>)[state] ?? '未知'
}
/** Adapted from the verified v148 web/src/call-history.ts mergeCalls; session resets belong to the store. */
export function mergeCalls(current: readonly CallRecord[], incoming: readonly CallRecord[]): CallRecord[] {
  const records = new Map(current.map((record) => [record.id, record]))
  for (const record of incoming) {
    const previous = records.get(record.id)
    if (previous && previous.status !== 'running' && record.status === 'running') continue
    records.set(record.id, record)
  }
  return [...records.values()].sort((a, b) => b.sequence - a.sequence).slice(0, 1000)
}
/** v148 log-store query semantics: OR within each facet, AND across facets, literal case-insensitive text. */
export function filterLogs(records: readonly LogRecord[], filter: LogFilter): LogRecord[] {
  const search = filter.search?.toLowerCase()
  const filtered = records.filter((record) =>
    (!filter.projectIds?.length || filter.projectIds.includes(record.projectId))
    && (!filter.sources?.length || filter.sources.includes(record.source))
    && (!filter.levels?.length || filter.levels.includes(record.level))
    && (!search || record.message.toLowerCase().includes(search)))
  const limit = filter.limit === undefined ? 1000 : Math.max(0, Math.min(1000, Math.floor(filter.limit)))
  return limit > 0 ? filtered.slice(-limit) : []
}
