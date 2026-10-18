import { computed, ref, shallowRef, toRaw } from 'vue'
import { defineStore } from 'pinia'
import type { KnowledgeReadProvider, KnowledgeServiceStates } from '../domain/knowledge-read'
import type { LocalService, LocalServiceAction, LocalServiceOperationOutcome, LocalServiceOperationReply, LocalServiceOperationsProvider } from '../domain/local-service-operations'
import { LOCAL_SERVICE_OPERATION_LIMITS, LocalServiceOperationError, decodeLocalServiceOperationReply, localServiceOperationImpact, normalizeLocalServiceOperation } from '../domain/local-service-operations'

export interface LocalServiceContext {
  provider: LocalServiceOperationsProvider | null
  readProvider: Pick<KnowledgeReadProvider, 'label' | 'loadServiceStates'> | null
  /** Local isolation only; never transmitted or treated as process ownership. */
  scopeKey: string
}
export interface PreparedLocalServiceOperation {
  readonly service: LocalService
  readonly action: LocalServiceAction
  readonly providerLabel: string
  readonly impact: string
  readonly revision: number
}
export interface LocalServiceRecord {
  readonly id: number
  readonly service: LocalService
  readonly action: LocalServiceAction
  readonly providerLabel: string
  readonly status: 'sending' | 'acknowledged' | LocalServiceOperationOutcome
  readonly detached: boolean
  readonly message: string
  readonly reply: LocalServiceOperationReply | null
}
interface Binding extends LocalServiceContext { label: string; readLabel: string }
interface Approval { binding: Binding; generation: number; snapshot: KnowledgeServiceStates }
interface Operation { id: number; service: LocalService; action: LocalServiceAction; binding: Binding; generation: number; controller: AbortController; cancelled: boolean; settled: boolean }
const unknownMessage = '服务操作结果未知，后台操作可能仍在继续；已阻止本页后续启停操作，不自动重试。请到原后台核对，刷新状态不会解除此保护。'
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
function valid(value: Binding | null): value is Binding & { provider: LocalServiceOperationsProvider; readProvider: NonNullable<LocalServiceContext['readProvider']> } {
  return !!value?.provider && typeof value.provider.run === 'function' && typeof value.provider.waitForIdle === 'function'
    && !!value.readProvider && typeof value.readProvider.loadServiceStates === 'function'
    && typeof value.scopeKey === 'string' && value.scopeKey.length > 0 && value.scopeKey.length <= 16_384
}
function projectStates(value: unknown): KnowledgeServiceStates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid-state')
  const raw = value as Record<string, unknown>, result: KnowledgeServiceStates = { warnings: [] }
  for (const service of ['knowledge', 'model'] as const) {
    if (!Object.hasOwn(raw, service)) { result.warnings.push(`${service === 'knowledge' ? '知识库服务' : '模型启动器'}状态未知，不能按已关闭处理。`); continue }
    const state = raw[service]
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw Error('invalid-state')
    const row = state as Record<string, unknown>
    if (!Object.hasOwn(row, 'running') || typeof row.running !== 'boolean') throw Error('invalid-state')
    if (service === 'knowledge') {
      if (!Object.hasOwn(row, 'frameable') || typeof row.frameable !== 'boolean' || (!row.running && row.frameable)) throw Error('invalid-state')
      result.knowledge = { running: row.running, frameable: row.frameable }
    } else result.model = { running: row.running }
  }
  return freeze(result)
}
/** Isolated in-memory lane. Shared service cards cannot change receipts or release UNKNOWN. */
export const useLocalServiceOperationsStore = defineStore('local-service-operations', () => {
  const binding = shallowRef<Binding | null>(null), snapshot = shallowRef<KnowledgeServiceStates | null>(null)
  const preview = shallowRef<PreparedLocalServiceOperation | null>(null), records = shallowRef<readonly LocalServiceRecord[]>(Object.freeze([]))
  const revision = ref(0), reading = ref(false), transportPending = ref(false), unknown = ref(false), error = ref('')
  const approvals = new WeakMap<PreparedLocalServiceOperation, Approval>()
  let generation = 0, nextId = 1, readVersion = 0, readController: AbortController | null = null, operation: Operation | null = null
  const busy = computed(() => transportPending.value && records.value.some(row => row.status === 'sending'))
  const canRead = computed(() => valid(binding.value) && !reading.value && !transportPending.value)
  function revoke() { if (preview.value) approvals.delete(preview.value); preview.value = null; revision.value++ }
  function cancelRead() { readVersion++; readController?.abort(); readController = null }
  function replaceRecord(id: number, changes: Partial<LocalServiceRecord>) { records.value = Object.freeze(records.value.map(row => row.id === id ? freeze({ ...row, ...changes }) : row)) }
  function markUnknown(op: Operation) {
    unknown.value = true; error.value = unknownMessage
    replaceRecord(op.id, { status: 'unknown', message: unknownMessage, reply: null })
  }
  function cancel(): boolean {
    if (!operation || operation.cancelled || operation.settled) return false
    operation.cancelled = true; markUnknown(operation); revoke(); operation.controller.abort(); return true
  }
  function detach() {
    cancel(); cancelRead(); generation++; snapshot.value = null; revoke()
    records.value = Object.freeze(records.value.map(row => row.detached ? row : freeze({ ...row, detached: true })))
  }
  function syncContext(context: LocalServiceContext) {
    const next: Binding = {
      provider: context.provider ? toRaw(context.provider) : null, readProvider: context.readProvider ? toRaw(context.readProvider) : null,
      scopeKey: context.scopeKey, label: context.provider?.label ?? '', readLabel: context.readProvider?.label ?? '',
    }
    const old = binding.value
    if (old && old.provider === next.provider && old.readProvider === next.readProvider && old.scopeKey === next.scopeKey && old.label === next.label && old.readLabel === next.readLabel) return
    detach(); binding.value = next
    if (!unknown.value) error.value = ''
  }
  async function refresh(): Promise<boolean> {
    const current = binding.value
    if (!canRead.value || !valid(current)) return false
    revoke(); snapshot.value = null; if (!unknown.value) error.value = ''
    const version = ++readVersion, epoch = generation, controller = new AbortController()
    readController = controller; reading.value = true
    const isCurrent = () => binding.value === current && epoch === generation && version === readVersion && !controller.signal.aborted
    try {
      // This capability calls exactly the two service status GETs; never .status() / CLI.
      const states = projectStates(await current.readProvider.loadServiceStates(controller.signal))
      if (!isCurrent()) return false
      snapshot.value = states; return true
    } catch {
      if (isCurrent() && !unknown.value) error.value = '服务状态读取失败，当前状态未知；没有执行关闭或启动。'
      return false
    } finally {
      // An abort-unaware read retains its lane until its actual promise settles.
      reading.value = false
      if (readController === controller) readController = null
    }
  }
  function canPrepare(service: LocalService, action: LocalServiceAction = 'stop'): boolean {
    return ['knowledge', 'model'].includes(service) && ['start', 'stop'].includes(action)
      && valid(binding.value) && !reading.value && !transportPending.value && !unknown.value && snapshot.value?.[service]?.running === (action === 'stop')
  }
  function prepare(service: LocalService, action: LocalServiceAction = 'stop'): PreparedLocalServiceOperation | null {
    revoke()
    if (!['knowledge', 'model'].includes(service) || !canPrepare(service, action)) return null
    const current = binding.value!, prepared = freeze({ service, action, providerLabel: current.label, impact: localServiceOperationImpact(service, action), revision: revision.value })
    approvals.set(prepared, { binding: current, generation, snapshot: snapshot.value! }); preview.value = prepared; error.value = ''; return prepared
  }
  async function execute(prepared: PreparedLocalServiceOperation | null, confirmed: boolean): Promise<boolean> {
    if (confirmed !== true || !prepared || prepared !== preview.value || !canPrepare(prepared.service, prepared.action)) return false
    const approval = approvals.get(prepared), current = binding.value
    if (!approval || !valid(current) || approval.binding !== current || approval.generation !== generation || approval.snapshot !== snapshot.value) return false
    revoke(); snapshot.value = null
    const op: Operation = { id: nextId++, service: prepared.service, action: prepared.action, binding: current, generation, controller: new AbortController(), cancelled: false, settled: false }
    operation = op; transportPending.value = true; error.value = ''
    records.value = Object.freeze([...records.value.slice(-(LOCAL_SERVICE_OPERATION_LIMITS.maxRecords - 1)), freeze({ id: op.id, service: op.service, action: op.action, providerLabel: current.label, status: 'sending' as const, detached: false, message: '服务操作已确认，正在等待原后台回执。', reply: null })])
    let succeeded = false, pending: Promise<LocalServiceOperationReply> | undefined, onAbort: (() => void) | undefined
    const cancelled = Symbol('cancelled'), cancellation = new Promise<typeof cancelled>(resolve => { onAbort = () => resolve(cancelled); op.controller.signal.addEventListener('abort', onAbort, { once: true }) })
    try {
      pending = Promise.resolve(current.provider.run(freeze(normalizeLocalServiceOperation({ service: prepared.service, action: prepared.action })), op.controller.signal))
      const reply = await Promise.race([pending, cancellation])
      if (reply === cancelled || op.cancelled || binding.value !== current || generation !== op.generation) markUnknown(op)
      else {
        const decoded = freeze(decodeLocalServiceOperationReply(reply, normalizeLocalServiceOperation({ service: op.service, action: op.action })))
        replaceRecord(op.id, { status: 'acknowledged', reply: decoded, message: op.action === 'start' ? op.service === 'knowledge' ? '原后台回执：知识库服务可达。这不代表登录、检索或索引就绪；请显式重新读取当前状态。' : '原后台回执：模型启动器可达。这不代表模型已加载或 ComfyUI 已就绪。' : '原后台回执：服务当前不可达。这不证明所有相关进程均已结束；请显式重新读取当前状态。' }); succeeded = true
      }
    } catch (cause) {
      if (op.cancelled) markUnknown(op)
      else {
        const failure = cause instanceof LocalServiceOperationError ? new LocalServiceOperationError(cause.code, cause.outcome) : new LocalServiceOperationError('network-error', 'unknown')
        if (failure.outcome === 'unknown') markUnknown(op)
        else { replaceRecord(op.id, { status: failure.outcome, message: failure.message }); if (binding.value === current && generation === op.generation) error.value = failure.message }
      }
    } finally {
      op.settled = true
      if (onAbort) op.controller.signal.removeEventListener('abort', onAbort)
      try {
        // Both the call and provider lease must settle; a late response never rewrites UNKNOWN.
        await Promise.all([pending?.then(() => undefined, () => undefined), current.provider.waitForIdle()])
        if (operation === op) { operation = null; transportPending.value = false }
      } catch { succeeded = false; markUnknown(op) /* Keep the lane closed if actual settlement cannot be established. */ }
    }
    return succeeded
  }
  function leave() { detach(); binding.value = null }
  return {
    states: computed(() => snapshot.value), prepared: computed(() => preview.value), records: computed(() => records.value),
    revision: computed(() => revision.value), reading: computed(() => reading.value), transportPending: computed(() => transportPending.value),
    blockedUnknown: computed(() => unknown.value), error: computed(() => error.value), busy, canRead,
    syncContext, refresh, canPrepare, prepare, execute, cancel, leave,
  }
})
