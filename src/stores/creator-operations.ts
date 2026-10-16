import { computed, ref, shallowRef, toRaw, watch } from 'vue'
import { defineStore } from 'pinia'
import type { CompanionBrowserProvider, ManagedProject, ManagedStatus } from '../domain/companion-browser'
import { CreatorOperationError, creatorActionLabel, normalizeCreatorOperation } from '../domain/creator-operations'
import type { CreatorAction, CreatorOperationReply, CreatorOperationsProvider } from '../domain/creator-operations'
import { creatorOperationsProvider } from '../creator-operations-integration'
import { useCompanionBrowserStore } from './companion-browser'
import { useProjectOperationLaneStore } from './project-operation-lane'
import type { ProjectOperationLease } from './project-operation-lane'

export interface CreatorOperationSource {
  readonly readIdentity: number
  readonly operationIdentity: number
  readonly readLabel: string
  readonly operationLabel: string
}
export interface PreparedCreatorOperation {
  readonly action: CreatorAction
  readonly project: Readonly<ManagedProject>
  /** null means no real per-project status was read. It never means stopped. */
  readonly runtime: Readonly<ManagedStatus> | null
  readonly source: Readonly<CreatorOperationSource>
  readonly observedAt: string
  readonly snapshotRevision: number
}
export type CreatorReceiptPhase = 'sending' | 'acknowledged' | 'not-dispatched' | 'rejected' | 'unknown' | 'reported-failure'
export interface CreatorOperationReceipt extends PreparedCreatorOperation {
  readonly id: number
  readonly phase: CreatorReceiptPhase
  readonly message: string
  readonly reply: Readonly<CreatorOperationReply> | null
  readonly errorCode: string | null
  readonly detached: boolean
}
export interface RegistrationReadback {
  readonly projectId: string
  readonly observedAt: string
  readonly presence: 'present' | 'absent' | 'changed'
}
export type CreatorOperationPhase = 'idle' | 'prepared' | 'invalidated' | CreatorReceiptPhase
export type DirectCreatorAction = 'start' | 'focus'
interface Binding {
  sourceGeneration: number
  operationGeneration: number
  snapshotGeneration: number
  readProvider: CompanionBrowserProvider
  operationProvider: CreatorOperationsProvider
  readLabel: string
  operationLabel: string
  projectKey: string
  runtimeKey: string
  observedAt: string
  snapshotRevision: number
}
interface Approval { binding: Binding; request: { projectId: string; action: CreatorAction } }
interface Operation {
  id: number
  readonly lease: ProjectOperationLease
  binding: Binding
  prepared: PreparedCreatorOperation
  controller: AbortController
  awaiting: boolean
  cancelled: boolean
  detached: boolean
}
interface ReadBarrier {
  kind: 'runtime' | 'registration'
  sourceGeneration: number
  readProvider: CompanionBrowserProvider
  projectKey: string
  projectId: string
  snapshotRevision: number
  readGeneration: number
}
interface ProjectReadStart { readProvider: CompanionBrowserProvider; sourceGeneration: number; readGeneration: number }
interface ProjectObservation extends ProjectReadStart {
  snapshotRevision: number
  observedAt: string
  projects: ReadonlyMap<string, string>
}
const registrationAction = (action: CreatorAction) => action === 'open-folder' || action === 'remove-registration'
const unknownMessage = '结果未知：后台可能已执行。请先刷新原工程的真实状态和日志，再明确确认新操作；不会自动重发。'
const contextMessage = '工程、来源或连接已变化，原确认已失效；请按当前真实快照重新确认。'
const cleanupMessage = '无法确认传输已经结束，已阻止后续工程操作；状态和日志仍可读取。'
const startStates = new Set(['stopped', 'crashed', 'incompatible', 'error'])
const stopStates = new Set(['ready', 'crashed', 'incompatible', 'error'])
const restartStates = new Set(['ready', 'stopped', 'crashed', 'incompatible', 'error'])
const acknowledgements: Record<CreatorAction, string> = {
  start: '后台已返回启动请求回执；回执状态不等于最终就绪，请刷新真实状态核对。',
  focus: '后台已确认收到聚焦请求；未因此启动工程，也未证明窗口已到前台。',
  stop: '后台已返回 stopped 回执；这不证明操作系统进程已退出，请刷新真实状态和日志核对。',
  restart: '后台已返回重启请求回执；这不等于最终就绪，也不证明操作系统进程退出已获确认，请刷新真实状态和日志核对。',
  'open-folder': '后台已确认收到打开原工程目录的请求；这不证明文件管理器窗口已打开，也不改变工程登记或运行状态。',
  'remove-registration': '后台回执 removed=true，报告已移除登记并清理工程工具绑定。此操作不删除工程文件，也不停止 Creator。请重读登记核对；稍后重新登记时默认 full 可能扩大工具范围。',
}
function resultMessage(action: CreatorAction, outcome: 'unknown' | 'reported-failure'): string {
  if (!registrationAction(action)) return outcome === 'unknown' ? unknownMessage
    : '后台报告操作失败，可能已有部分影响。请先刷新原工程的真实状态和日志，再明确确认新操作。'
  const result = outcome === 'unknown' ? '结果未知：后台可能已执行。' : '后台报告操作失败，可能已有部分影响。'
  return result + (action === 'remove-registration'
    ? '原操作会先清理路由缓存，再改写登记，仅 removed=true 时清理工程工具绑定；两份文件写入并非原子操作，失败可能已有部分影响。请先重读原来源的登记核对；不会自动重发或撤销，也不删除工程文件或停止 Creator。'
    : '请先重读原来源的工程登记，再明确确认新操作；重读不证明目录窗口已打开，不会自动重发。')
}
function acknowledgement(reply: CreatorOperationReply): string {
  if (reply.action === 'remove-registration' && !reply.removed) return '后台回执 removed=false，本次未移除登记条目；该分支不清理工程工具绑定，不能证明此前登记或绑定操作没有影响。此操作不删除工程文件，也不停止 Creator。请重读登记核对。'
  return acknowledgements[reply.action]
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function projectCopy(project: ManagedProject): ManagedProject {
  return { id: project.id, name: project.name, path: project.path,
    ...(project.requiredCreatorVersion === undefined ? {} : { requiredCreatorVersion: project.requiredCreatorVersion }) }
}
function runtimeCopy(status: ManagedStatus | undefined): ManagedStatus | null { return status ? { ...status } : null }
const projectKey = (project: ManagedProject) => JSON.stringify(projectCopy(project))
const runtimeKey = (status: ManagedStatus | undefined) => JSON.stringify(runtimeCopy(status))

/** In-memory receipts only. The browser store remains the sole project/status authority. */
export const useCreatorOperationsStore = defineStore('creator-operations', () => {
  const browser = useCompanionBrowserStore()
  const lane = useProjectOperationLaneStore()
  const prepared = shallowRef<PreparedCreatorOperation | null>(null)
  const records = shallowRef<readonly CreatorOperationReceipt[]>(Object.freeze([]))
  const dialogOpen = ref(false), error = ref(''), pending = ref(false), transportPending = ref(false), settlementFailed = ref(false)
  const phase = ref<CreatorOperationPhase>('idle'), visibleReceiptId = ref<number | null>(null)
  const approvals = new WeakMap<PreparedCreatorOperation, Approval>()
  const receiptBindings = new Map<number, Binding>()
  const sourceIds = new WeakMap<object, number>()
  let nextSourceId = 1, nextReceiptId = 1, operation: Operation | null = null
  let dispatching = false, operationGeneration = 0, snapshotGeneration = 0
  let readGeneration = browser.projectLoading ? 1 : 0
  const barriers = shallowRef<readonly ReadBarrier[]>([])
  // A receipt records the result boundary before publishing it to synchronous observers.
  const removalResults = new Map<number, ReadBarrier>()
  const sourceGeneration = ref(0)
  let activeProjectRead: ProjectReadStart | null = null
  const projectObservation = shallowRef<ProjectObservation | null>(null)
  const receipt = computed(() => records.value.find(record => record.id === visibleReceiptId.value) ?? null)
  const lastReceipt = computed(() => records.value.at(-1) ?? null)
  const registrationReadback = computed<RegistrationReadback | null>(() => {
    const record = lastReceipt.value, observation = projectObservation.value
    const boundary = record?.action === 'remove-registration' ? removalResults.get(record.id) : undefined
    if (!record || !boundary || !observation || !qualifiesRegistrationRead(boundary, observation, true)) return null
    const observedKey = observation.projects.get(record.project.id)
    return freeze({ projectId: record.project.id, observedAt: observation.observedAt,
      presence: observedKey === undefined ? 'absent' : observedKey === boundary.projectKey ? 'present' : 'changed' })
  })
  const canRefreshRegistration = computed(() => {
    const record = lastReceipt.value
    const boundary = record?.action === 'remove-registration' ? removalResults.get(record.id) : undefined
    return !!boundary && browser.connected && !browser.projectLoading && boundary.readProvider === activeReadProvider()
      && boundary.sourceGeneration === sourceGeneration.value
  })
  const display = computed(() => ({ phase: phase.value, message: error.value || receipt.value?.message ||
    (phase.value === 'prepared' ? '请核对冻结的工程、来源和状态，并明确确认本次操作。' : '') }))
  function identity(value: object) {
    let id = sourceIds.get(value)
    if (id === undefined) { id = nextSourceId++; sourceIds.set(value, id) }
    return id
  }
  function revoke() {
    if (prepared.value) approvals.delete(prepared.value)
    prepared.value = null
  }
  function currentProject(id: string) { return browser.projects.find(project => project.id === id) }
  function currentRuntime(id: string) { return browser.statuses.find(status => status.projectId === id) }
  function activeReadProvider() { return browser.provider ? toRaw(browser.provider) : null }
  function activeOperationProvider() { return creatorOperationsProvider.value ? toRaw(creatorOperationsProvider.value) : null }
  function hasBarrier(project: ManagedProject) {
    return barriers.value.some(barrier => barrier.readProvider === activeReadProvider() && barrier.projectKey === projectKey(project))
  }
  function blockingReason(projectId: string, action: CreatorAction): string {
    if (dispatching) return '上一次工程请求正在确认发送，请等待完成后重试。'
    if (transportPending.value) return settlementFailed.value ? cleanupMessage : '上一次工程请求仍在等待或清理，请等待传输结束。'
    if (lane.locked) return `工程操作“${lane.description}”仍在等待或清理，请等待完成后重新确认。`
    if (!['start', 'focus', 'stop', 'restart', 'open-folder', 'remove-registration'].includes(action)) return '操作类型无效，未发送请求。'
    if (!browser.connected || !activeReadProvider()) return '请先连接并读取已登记工程。'
    const provider = activeOperationProvider()
    if (!provider || typeof provider.run !== 'function' || typeof provider.waitForIdle !== 'function') return '当前来源未提供工程操作能力。'
    if (browser.projectLoading) return '正在读取真实工程快照，请读取完成后重新确认。'
    const project = currentProject(projectId)
    if (!project) return '该目标不在当前已登记工程中，请先刷新工程。'
    try { normalizeCreatorOperation({ projectId, action }) } catch { return '已登记工程标识无效，未发送请求。' }
    if (!project.name || !project.path || !browser.observedAt || browser.projectSnapshotRevision < 1) return '工程身份或真实读取快照不完整，请先刷新工程。'
    if (hasBarrier(project)) return '上次操作结果需要核对，请先重新读取原来源的工程登记与真实状态，再明确确认新操作。'
    if (action === 'start' || action === 'stop' || action === 'restart') {
      const status = currentRuntime(projectId)
      if (!status || status.state === 'unknown') return '尚未读到该工程的真实运行状态，请先刷新；不能把未知视为已停止。'
      if (action === 'start') {
        if (status.state === 'ready') return '该工程已就绪，请使用聚焦现有 Creator。'
        if (!startStates.has(status.state)) return '该工程正在启动、等待 Bridge 或停止，暂不能再次启动。'
      } else if (action === 'stop') {
        if (status.state === 'stopped') return '当前状态为 stopped；旧回执不能证明操作系统进程已退出。请先刷新真实状态，再决定后续操作。'
        if (!stopStates.has(status.state)) return '该工程正在启动、等待 Bridge 或停止，请先刷新真实状态，暂不能停止。'
      } else if (!restartStates.has(status.state)) return '该工程正在启动、等待 Bridge 或停止，请先刷新真实状态，暂不能重启。'
      // These are UI eligibility checks, not proof of safe termination. The backend
      // owns Bridge/unsaved-content checks and may use Bridge without a known PID.
    }
    return ''
  }
  /** Entry/visibility reads must not stand in for the user's post-error check.
   * Keep the boundary private; callers receive only a read-only eligibility result. */
  function blocksAutomaticProjectRead(readProvider: CompanionBrowserProvider): boolean {
    return pending.value || transportPending.value || dispatching || dialogOpen.value || prepared.value !== null
      || barriers.value.some(barrier => barrier.readProvider === toRaw(readProvider))
  }
  function canPrepare(projectId: string, action: CreatorAction) { return blockingReason(projectId, action) === '' }
  function makeBinding(project: ManagedProject): Binding | null {
    const readProvider = activeReadProvider(), operationProvider = activeOperationProvider()
    if (!readProvider || !operationProvider) return null
    return { sourceGeneration: sourceGeneration.value, operationGeneration, snapshotGeneration,
      readProvider, operationProvider, readLabel: readProvider.label, operationLabel: operationProvider.label,
      projectKey: projectKey(project), runtimeKey: runtimeKey(currentRuntime(project.id)), observedAt: browser.observedAt,
      snapshotRevision: browser.projectSnapshotRevision }
  }
  function bindingIsCurrent(binding: Binding, projectId: string, snapshot: boolean) {
    const project = currentProject(projectId)
    return browser.connected && binding.sourceGeneration === sourceGeneration.value && binding.operationGeneration === operationGeneration
      && binding.readProvider === activeReadProvider() && binding.operationProvider === activeOperationProvider()
      && binding.readLabel === binding.readProvider.label && binding.operationLabel === binding.operationProvider.label
      && !!project && binding.projectKey === projectKey(project)
      && (!snapshot || (binding.snapshotGeneration === snapshotGeneration && !browser.projectLoading && binding.runtimeKey === runtimeKey(currentRuntime(projectId))
        && binding.observedAt === browser.observedAt && binding.snapshotRevision === browser.projectSnapshotRevision))
  }
  function replaceReceipt(id: number, changes: Partial<CreatorOperationReceipt>) {
    records.value = Object.freeze(records.value.map(record => record.id === id ? freeze({ ...record, ...changes }) : record))
  }
  function resultBoundary(op: Operation): ReadBarrier {
    return { kind: registrationAction(op.prepared.action) ? 'registration' : 'runtime', sourceGeneration: op.binding.sourceGeneration,
      readProvider: op.binding.readProvider, projectKey: op.binding.projectKey,
      projectId: op.prepared.project.id, snapshotRevision: browser.projectSnapshotRevision, readGeneration }
  }
  function requireNewRead(barrier: ReadBarrier) {
    barriers.value = [...barriers.value.filter(item => item.readProvider !== barrier.readProvider || item.projectKey !== barrier.projectKey), barrier]
  }
  function qualifiesRegistrationRead(boundary: ReadBarrier, observation: ProjectObservation, originalSession = false): boolean {
    return browser.connected && boundary.readProvider === activeReadProvider()
      && observation.readProvider === boundary.readProvider && observation.sourceGeneration === sourceGeneration.value
      && (!originalSession || boundary.sourceGeneration === sourceGeneration.value)
      && observation.snapshotRevision > boundary.snapshotRevision && observation.readGeneration > boundary.readGeneration
  }
  function updateResult(op: Operation, resultPhase: CreatorReceiptPhase, message: string, errorCode: string | null, reply: CreatorOperationReply | null = null) {
    const boundary = resultBoundary(op)
    if (op.prepared.action === 'remove-registration') removalResults.set(op.id, boundary)
    if (resultPhase === 'unknown' || resultPhase === 'reported-failure') requireNewRead(boundary)
    replaceReceipt(op.id, { phase: resultPhase, message, errorCode, reply, detached: op.detached })
    if (visibleReceiptId.value === op.id) { phase.value = resultPhase; error.value = resultPhase === 'acknowledged' ? '' : message }
  }
  function cancelWaiting(): boolean {
    const op = operation
    if (!op || !op.awaiting || op.cancelled) return false
    op.cancelled = true; op.awaiting = false; pending.value = false
    revoke(); updateResult(op, 'unknown', resultMessage(op.prepared.action, 'unknown'), 'aborted'); op.controller.abort()
    return true
  }
  function detachOperation() {
    if (!operation) return
    operation.detached = true
    replaceReceipt(operation.id, { detached: true })
    cancelWaiting()
  }
  function invalidateContext() {
    snapshotGeneration++
    const hadDraft = !!prepared.value
    if (hadDraft) { revoke(); phase.value = 'invalidated'; error.value = contextMessage }
    const op = operation
    if (op && !bindingIsCurrent(op.binding, op.prepared.project.id, false)) {
      detachOperation(); visibleReceiptId.value = null; dialogOpen.value = false
      phase.value = 'invalidated'; error.value = contextMessage
    }
  }
  // A draft is invalidated even by an identical fresh snapshot or A -> B -> A.
  // A sent operation tolerates normal runtime observations, but never identity changes.
  watch(() => [browser.provider, creatorOperationsProvider.value, browser.connected, browser.projects,
    browser.statuses, browser.observedAt, browser.projectLoading, browser.projectSnapshotRevision], invalidateContext,
  { deep: true, flush: 'sync' })
  // Reader switches (including A -> B -> A) and disconnects invalidate both
  // completed evidence and any read already in flight. Old removal receipts cannot
  // re-associate with a reconnected session, even when the reader object is reused.
  watch(() => [browser.provider, browser.connected] as const, ([provider, connected], [previousProvider, wasConnected]) => {
    if (provider !== previousProvider || (!connected && wasConnected)) {
      sourceGeneration.value++; activeProjectRead = null; projectObservation.value = null
    }
  }, { flush: 'sync' })
  watch(() => creatorOperationsProvider.value, () => { operationGeneration++ }, { flush: 'sync' })
  watch(() => browser.projectLoading, (loading, previous) => {
    if (loading && !previous) {
      readGeneration++
      const readProvider = activeReadProvider()
      activeProjectRead = readProvider ? { readProvider, sourceGeneration: sourceGeneration.value, readGeneration } : null
    } else if (!loading) activeProjectRead = null
  }, { flush: 'sync' })
  watch(() => browser.projectSnapshotRevision, revision => {
    const started = activeProjectRead
    if (started && browser.connected && started.readProvider === activeReadProvider() && started.sourceGeneration === sourceGeneration.value) {
      projectObservation.value = { ...started, snapshotRevision: revision, observedAt: browser.observedAt,
        projects: new Map(browser.projects.map(project => [project.id, projectKey(project)])) }
    }
    // A read already in flight when uncertainty began cannot clear its barrier.
    barriers.value = barriers.value.filter(barrier => {
      if (barrier.kind === 'registration') return !projectObservation.value || !qualifiesRegistrationRead(barrier, projectObservation.value)
      const project = currentProject(barrier.projectId), status = currentRuntime(barrier.projectId)
      return barrier.readProvider !== activeReadProvider() || !browser.connected || !project || projectKey(project) !== barrier.projectKey
        || !status || status.state === 'unknown' || revision <= barrier.snapshotRevision || readGeneration <= barrier.readGeneration
    })
  }, { flush: 'sync' })
  function createApproval(projectId: string, action: CreatorAction): PreparedCreatorOperation {
    const project = currentProject(projectId)!, binding = makeBinding(project)!
    const request = freeze(normalizeCreatorOperation({ projectId, action }))
    const preview = freeze({ action, project: projectCopy(project), runtime: runtimeCopy(currentRuntime(projectId)),
      source: { readIdentity: identity(binding.readProvider), operationIdentity: identity(binding.operationProvider),
        readLabel: binding.readLabel, operationLabel: binding.operationLabel }, observedAt: binding.observedAt,
      snapshotRevision: binding.snapshotRevision })
    approvals.set(preview, { binding, request })
    return preview
  }
  function prepare(projectId: string, action: CreatorAction): PreparedCreatorOperation | null {
    revoke()
    const reason = blockingReason(projectId, action)
    if (reason) { error.value = reason; if (!pending.value) phase.value = 'invalidated'; return null }
    const preview = createApproval(projectId, action)
    prepared.value = preview; visibleReceiptId.value = null
    dialogOpen.value = true; phase.value = 'prepared'; error.value = ''
    return preview
  }
  async function send(preview: PreparedCreatorOperation | null, confirmed: boolean): Promise<boolean> {
    if (confirmed !== true || !preview || preview !== prepared.value) return false
    return dispatch(preview, false)
  }
  /** The explicit start/focus click is its one-use approval. No modal state is published. */
  async function direct(projectId: string, action: DirectCreatorAction): Promise<boolean> {
    // Keep this runtime allowlist: TypeScript callers and UI controls are not a security boundary.
    if (action !== 'start' && action !== 'focus') {
      error.value = '直接操作仅支持启动或聚焦；其他操作需要单独确认。'; return false
    }
    const reason = blockingReason(projectId, action)
    if (reason) { error.value = reason; if (!pending.value) phase.value = 'invalidated'; return false }
    const preview = createApproval(projectId, action), binding = approvals.get(preview)!.binding
    const sending = dispatch(preview, true)
    const record = lastReceipt.value, receiptId = record && receiptBindings.get(record.id) === binding ? record.id : null
    const acknowledged = await sending
    // A late result or a context change during cleanup must not produce a success toast/read.
    return acknowledged && !settlementFailed.value && receiptId !== null && currentAcknowledgedStatus(receiptId)
  }
  async function dispatch(preview: PreparedCreatorOperation, directClick: boolean): Promise<boolean> {
    if (transportPending.value || dispatching) return false
    const approval = approvals.get(preview)
    if (!approval || !bindingIsCurrent(approval.binding, preview.project.id, true)) {
      revoke(); phase.value = 'invalidated'; error.value = contextMessage; return false
    }
    const reason = blockingReason(preview.project.id, preview.action)
    if (reason) { revoke(); phase.value = 'invalidated'; error.value = reason; return false }
    // Consume one-use approval before lane observers or provider code can re-enter.
    approvals.delete(preview)
    dispatching = true
    revoke()
    if (directClick) dialogOpen.value = false
    const lease = lane.acquire(creatorActionLabel(preview.action))
    if (!lease) {
      dispatching = false
      phase.value = 'invalidated'; error.value = blockingReason(preview.project.id, preview.action); return false
    }
    // Revocation, dialog and lane observers can synchronously change the source or snapshot.
    if (!bindingIsCurrent(approval.binding, preview.project.id, true)) {
      lane.release(lease); dispatching = false
      phase.value = 'invalidated'; error.value = contextMessage; return false
    }
    const op: Operation = { id: nextReceiptId++, lease, binding: approval.binding, prepared: preview,
      controller: new AbortController(), awaiting: true, cancelled: false, detached: false }
    operation = op; pending.value = true; transportPending.value = true; error.value = ''; phase.value = 'sending'
    dispatching = false
    receiptBindings.set(op.id, op.binding)
    const record = freeze({ ...preview, id: op.id, phase: 'sending' as const,
      message: '请求已发出，正在等待后台回执；尚未核实真实状态。', reply: null, errorCode: null, detached: false })
    records.value = Object.freeze([...records.value, record]); visibleReceiptId.value = op.id
    let acknowledged = false
    const cancelled = Symbol('cancelled')
    let onAbort: (() => void) | undefined
    const cancellation = new Promise<typeof cancelled>(resolve => {
      onAbort = () => resolve(cancelled); op.controller.signal.addEventListener('abort', onAbort, { once: true })
    })
    try {
      // Publishing pending/receipt state must never dispatch after a synchronous cancellation.
      if (op.cancelled || !bindingIsCurrent(op.binding, preview.project.id, true)) {
        if (!op.cancelled) detachOperation()
        updateResult(op, 'unknown', resultMessage(preview.action, 'unknown'), 'aborted')
        return false
      }
      const result = await Promise.race([op.binding.operationProvider.run(approval.request, op.controller.signal), cancellation])
      if (!op.cancelled && result !== cancelled) {
        if (!bindingIsCurrent(op.binding, preview.project.id, false)) { detachOperation() }
        else {
          const reply = validatedReply(result, preview)
          op.awaiting = false; pending.value = false
          updateResult(op, 'acknowledged', acknowledgement(reply), null, reply)
          acknowledged = true
        }
      }
    } catch (cause) {
      if (!bindingIsCurrent(op.binding, preview.project.id, false)) invalidateContext()
      if (!op.cancelled) {
        op.awaiting = false; pending.value = false
        const failure = cause instanceof CreatorOperationError ? cause : new CreatorOperationError('network-error', 'unknown')
        let message = failure.outcome === 'unknown' || failure.outcome === 'reported-failure'
          ? resultMessage(preview.action, failure.outcome) : failure.message
        if (failure.reportedReason === 'unsaved-content') {
          message = `后台错误提到未保存内容，前端未核实。请先到 Creator 检查/保存后重新读取真实状态。${message}`
        } else if (preview.action === 'restart' && failure.backendCode === 'DASHBOARD_OPEN_WITHOUT_BRIDGE') {
          message = `后台报告工程已在 Dashboard 打开，但 Bridge 不可用；可能无法检查未保存内容而拒绝继续，也可能已打开后未接入。不能据此判断重启尚未发生。${message}`
        }
        updateResult(op, failure.outcome, message, failure.code)
      }
    } finally {
      op.awaiting = false; pending.value = false
      if (onAbort) op.controller.signal.removeEventListener('abort', onAbort)
      try {
        await op.binding.operationProvider.waitForIdle()
        if (operation === op && lane.release(op.lease)) { operation = null; transportPending.value = false }
      } catch {
        // An acknowledged receipt stays acknowledged; settlement failure is a separate blocker.
        settlementFailed.value = true; error.value = cleanupMessage
        // Keep the global store lease fail-closed across dialog/provider/context changes.
      }
    }
    return acknowledged
  }
  /** Completed receipts keep their exact source session even after transport cleanup. */
  function isReceiptCurrent(receiptId: number): boolean {
    const record = records.value.find(item => item.id === receiptId), binding = receiptBindings.get(receiptId)
    return !!record && !record.detached && !!binding && bindingIsCurrent(binding, record.project.id, false)
  }
  function currentAcknowledgedStatus(receiptId: number): boolean {
    const record = lastReceipt.value
    return !!record && record.id === receiptId && (record.action === 'start' || record.action === 'focus')
      && record.phase === 'acknowledged' && isReceiptCurrent(receiptId)
  }
  /** Read only the acknowledged operation's still-current source; never reconnect or resend. */
  async function refreshStatus(receiptId: number): Promise<boolean> {
    if (!currentAcknowledgedStatus(receiptId) || browser.projectLoading) return false
    const priorRevision = browser.projectSnapshotRevision, expectedGeneration = readGeneration + 1
    await browser.refreshProjects()
    return currentAcknowledgedStatus(receiptId) && !!projectObservation.value
      && projectObservation.value.snapshotRevision > priorRevision && projectObservation.value.readGeneration === expectedGeneration
  }
  async function refreshRegistration(): Promise<boolean> {
    if (!canRefreshRegistration.value) return false
    const record = lastReceipt.value!, boundary = removalResults.get(record.id)!
    const priorRevision = browser.projectSnapshotRevision, expectedGeneration = readGeneration + 1
    // refreshProjects captures its current provider synchronously. Never reconnect
    // or switch providers to satisfy a readback, and never issue another write.
    await browser.refreshProjects()
    return lastReceipt.value?.id === record.id && !!projectObservation.value
      && projectObservation.value.snapshotRevision > priorRevision && projectObservation.value.readGeneration === expectedGeneration
      && qualifiesRegistrationRead(boundary, projectObservation.value, true)
  }
  function closeDialog() {
    revoke(); cancelWaiting(); dialogOpen.value = false; visibleReceiptId.value = null
    if (!transportPending.value) { phase.value = 'idle'; error.value = '' }
  }
  function leave() {
    revoke(); detachOperation(); dialogOpen.value = false; visibleReceiptId.value = null
    if (!transportPending.value) { phase.value = 'idle'; error.value = '' }
  }
  return {
    prepared: computed(() => prepared.value), receipt, lastReceipt, registrationReadback, canRefreshRegistration, refreshRegistration, receipts: computed(() => records.value),
    pending: computed(() => pending.value), transportPending: computed(() => transportPending.value),
    dialogOpen: computed(() => dialogOpen.value), error: computed(() => error.value), display,
    prepare, send, direct, refreshStatus, isReceiptCurrent, cancelWaiting, closeDialog, leave, blocksAutomaticProjectRead, canPrepare, blockingReason,
  }
})

function validatedReply(value: CreatorOperationReply, preview: PreparedCreatorOperation): CreatorOperationReply {
  if (!value || typeof value !== 'object' || value.action !== preview.action) throw new CreatorOperationError('invalid-shape', 'unknown')
  if (value.action === 'focus') {
    if (value.acknowledged !== true) throw new CreatorOperationError('invalid-shape', 'unknown')
    return freeze({ action: 'focus', acknowledged: true })
  }
  if (value.action === 'open-folder') {
    if (value.acknowledged !== true || typeof value.path !== 'string' || value.path !== preview.project.path) {
      throw new CreatorOperationError('invalid-shape', 'unknown')
    }
    return freeze({ action: 'open-folder', acknowledged: true, path: value.path })
  }
  if (value.action === 'remove-registration') {
    if (typeof value.removed !== 'boolean') throw new CreatorOperationError('invalid-shape', 'unknown')
    return freeze({ action: 'remove-registration', removed: value.removed })
  }
  const runtime = value.runtime
  if (!runtime || runtime.projectId !== preview.project.id || typeof runtime.state !== 'string'
    || !['stopped', 'launching', 'bridge-wait', 'ready', 'stopping', 'crashed', 'incompatible', 'error', 'unknown'].includes(runtime.state)
    || (value.action === 'stop' && runtime.state !== 'stopped')
    || !['read-only', 'authoring', 'full-control', 'unknown'].includes(runtime.capabilityProfile)) {
    throw new CreatorOperationError('invalid-shape', 'unknown')
  }
  return freeze({ action: value.action, runtime: { ...runtime } })
}
