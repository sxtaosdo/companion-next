import { computed, ref, shallowRef, toRaw, watch } from 'vue'
import { defineStore } from 'pinia'
import type { CompanionBrowserProvider, ManagedProject } from '../domain/companion-browser'
import { PROJECT_SETUP_LIMITS, ProjectSetupError, buildSetupCompletionPrompt, SETUP_STAGES, sameSetupOptions, validateProjectPath, validateSetupOperationId, validateSetupProjectId } from '../domain/project-setup'
import type { ProjectSetupProvider, SetupSnapshot, EffectiveSetupOptions } from '../domain/project-setup'
import { projectSetupProvider } from '../project-setup-integration'
import { useCompanionBrowserStore } from './companion-browser'
import { useProjectOperationLaneStore } from './project-operation-lane'
import type { ProjectOperationLease } from './project-operation-lane'

export interface SetupConsents {
  installBridge: boolean
  startCreator: boolean
  configureCodex: boolean
  acknowledgeReuse: boolean
  acknowledgeToolScope: boolean
}
export interface PreparedRegistration {
  readonly path: string
  readonly sourceLabel: string
  readonly observedAt: string
  readonly snapshotRevision: number
}
export interface PreparedSetup {
  readonly project: Readonly<ManagedProject>
  readonly sourceLabel: string
  readonly consents: Readonly<SetupConsents>
  readonly effectiveOptions?: EffectiveSetupOptions
  readonly observedAt: string
  readonly snapshotRevision: number
}
export interface RegistrationReceipt {
  readonly phase: 'sending' | 'acknowledged' | 'unknown' | 'rejected' | 'not-dispatched'
  readonly requestedPath: string
  readonly project?: Readonly<ManagedProject>
  readonly message: string
}
export interface SetupReceipt {
  readonly phase: 'submitting' | 'tracking' | 'paused' | 'complete' | 'failed' | 'unknown' | 'rejected' | 'not-dispatched'
  readonly project: Readonly<ManagedProject>
  readonly effectiveOptions?: EffectiveSetupOptions
  readonly reused?: boolean
  readonly operationId?: string
  readonly snapshot?: Readonly<SetupSnapshot>
  readonly message: string
}
interface Binding {
  generation: number
  reader: CompanionBrowserProvider
  writer: ProjectSetupProvider
  readLabel: string
  writeLabel: string
  observedAt: string
  revision: number
  projectsKey: string
  projectKey?: string
}
interface RegistrationOperation {
  binding: Binding
  preview: PreparedRegistration
  lease: ProjectOperationLease
  controller: AbortController
  awaiting: boolean
  dispatched: boolean
  cancelled: boolean
}
interface SetupOperation {
  binding: Binding
  preview: PreparedSetup
  lease: ProjectOperationLease
  controller?: AbortController
  epoch: number
  dispatched: boolean
  reused?: boolean
  accepted: boolean
  detached: boolean
  terminal: boolean
  releasable: boolean
  busy: boolean
  cleanupFailed: boolean
  operationId?: string
  startedWaitingAt: number
}
interface RegistrationBarrier {
  path: string
  reader: CompanionBrowserProvider
  readGeneration: number
  revision: number
}
interface ReadStart { reader: CompanionBrowserProvider; generation: number; readGeneration: number }
const contextMessage = '工程、来源或连接已变化，原确认已失效；请按当前真实工程重新确认。'
const cleanupMessage = '无法确认传输已结束，工程操作仍被锁定；不会发送新请求。'
const unknownRegistration = '登记结果未知，后台可能已写入。必须先重新读取原来源的工程登记，再明确确认；不会自动重发。'
const unknownSetup = '接入结果未知，后台可能已开始执行，但没有可核实的任务标识；不会重发或解锁其他工程写操作。请到原宿主核对。'
const acceptedMessage = '后台已接受接入任务，尚未完成。可能复用既有任务，不能证明本次请求选项已采用。'
const pausedMessage = '已停止等待，后台任务可能仍在执行；未取消或回滚。可在原工程与来源下明确恢复只读查询。'
const completedMessage = '后台返回任务完成；不能据此保证本次请求选项已采用、Creator 已就绪或 Codex 已写入。请另行读取真实状态。'
const failedMessage = '后台返回任务失败，可能已留下登记、Bridge 文件、Creator 或 Codex 配置等部分改动；没有整体回滚。'
const cancelled = Symbol('cancelled')
const consentKeys = ['installBridge', 'startCreator', 'configureCodex', 'acknowledgeReuse', 'acknowledgeToolScope'] as const

export const useProjectSetupStore = defineStore('project-setup', () => {
  const browser = useCompanionBrowserStore(), lane = useProjectOperationLaneStore()
  const preparedRegistration = shallowRef<PreparedRegistration | null>(null), preparedSetup = shallowRef<PreparedSetup | null>(null)
  const registrationReceipt = shallowRef<RegistrationReceipt | null>(null), setupReceipt = shallowRef<SetupReceipt | null>(null)
  const pending = ref(false), tracking = ref(false), error = ref(''), visible = ref(true)
  const registrationApprovals = new WeakMap<PreparedRegistration, Binding>(), setupApprovals = new WeakMap<PreparedSetup, Binding>()
  const barriers: RegistrationBarrier[] = []
  const generation = ref(0), transportBusy = ref(false)
  const completionBinding = shallowRef<Binding | null>(null)
  let registration: RegistrationOperation | null = null, setup: SetupOperation | null = null
  let readGeneration = browser.projectLoading ? 1 : 0, activeRead: ReadStart | null = null
  let pollTimer: ReturnType<typeof setTimeout> | undefined, deadlineTimer: ReturnType<typeof setTimeout> | undefined

  function reader() { return browser.provider ? toRaw(browser.provider) : null }
  function writer() { return projectSetupProvider.value ? toRaw(projectSetupProvider.value) : null }
  function clearPrepared() {
    if (preparedRegistration.value) registrationApprovals.delete(preparedRegistration.value)
    if (preparedSetup.value) setupApprovals.delete(preparedSetup.value)
    preparedRegistration.value = null; preparedSetup.value = null
  }
  function project(id: string) {
    const matches = browser.projects.filter(item => item.id === id)
    return matches.length === 1 ? matches[0] : undefined
  }
  function sameContext(binding: Binding, target?: Readonly<ManagedProject>) {
    return binding.generation === generation.value && browser.connected && reader() === binding.reader && writer() === binding.writer
      && binding.reader.label === binding.readLabel && binding.writer.label === binding.writeLabel
      && (!target || (!!project(target.id) && projectKey(project(target.id)!) === binding.projectKey))
  }
  function samePreview(binding: Binding, target?: Readonly<ManagedProject>) {
    return sameContext(binding, target) && !browser.projectLoading && binding.revision === browser.projectSnapshotRevision
      && binding.observedAt === browser.observedAt && binding.projectsKey === projectsKey(browser.projects)
  }
  function blockingReason() {
    if (!visible.value) return '请返回接入页面后重新确认。'
    if (transportBusy.value || lane.locked) return cleanupMessage
    if (!browser.connected || !reader()) return '请先连接并读取原来源的已登记工程。'
    const active = writer()
    if (!active || typeof active.register !== 'function' || typeof active.start !== 'function' || typeof active.status !== 'function'
      || typeof active.waitForIdle !== 'function') return '当前来源未提供接入写入能力。'
    if (browser.projectLoading || !browser.observedAt || browser.projectSnapshotRevision < 1) return '请等待真实工程读取完成，再重新确认。'
    return ''
  }
  /** Automatic page-entry reads cannot stand in for an explicit uncertainty check. */
  function blocksAutomaticProjectRead(readProvider: CompanionBrowserProvider): boolean {
    return pending.value || transportBusy.value || tracking.value || preparedRegistration.value !== null || preparedSetup.value !== null
      || (setup !== null && setup.binding.reader === toRaw(readProvider))
      || barriers.some(barrier => barrier.reader === toRaw(readProvider))
  }
  function makeBinding(target?: Readonly<ManagedProject>): Binding {
    const read = reader()!, write = writer()!
    return { generation: generation.value, reader: read, writer: write, readLabel: read.label, writeLabel: write.label,
      observedAt: browser.observedAt, revision: browser.projectSnapshotRevision, projectsKey: projectsKey(browser.projects),
      ...(target ? { projectKey: projectKey(target) } : {}) }
  }
  function sourceLabel(binding: Binding) { return `${binding.readLabel} / ${binding.writeLabel}` }
  function prepareRegistration(path: string): PreparedRegistration | null {
    clearPrepared()
    const reason = blockingReason()
    if (reason) { error.value = reason; return null }
    try { validateProjectPath(path) } catch { error.value = '请输入有效的绝对工程路径，未发送请求。'; return null }
    if (barriers.some(barrier => barrier.path === path)) { error.value = unknownRegistration; return null }
    const binding = makeBinding(), preview = freeze({ path, sourceLabel: sourceLabel(binding), observedAt: binding.observedAt, snapshotRevision: binding.revision })
    registrationApprovals.set(preview, binding); preparedRegistration.value = preview; error.value = ''
    return preview
  }
  function prepareSetup(projectId: string, consents: SetupConsents): PreparedSetup | null {
    clearPrepared()
    const reason = blockingReason()
    if (reason) { error.value = reason; return null }
    const strict=typeof writer()?.startStrict==='function'
    if (!consents || (strict ? consents.installBridge!==true||consents.acknowledgeReuse!==true||consents.acknowledgeToolScope!==true||typeof consents.startCreator!=='boolean'||typeof consents.configureCodex!=='boolean' : consentKeys.some(key => consents[key] !== true))) {
      error.value = strict ? '必须明确同意 Bridge 安装、任务复用与工具范围限制，并选择是否启动 Creator 和配置 Codex，才能准备安装。' : '必须逐项明确同意 Bridge、Creator、Codex，以及任务复用与工具范围限制，才能准备完整接入。'; return null
    }
    let target: Readonly<ManagedProject>
    try {
      validateSetupProjectId(projectId)
      const current = project(projectId)
      if (!current) throw new ProjectSetupError('invalid-input', 'not-dispatched')
      target = validProject(current)
    } catch { error.value = '请选择当前真实读取的已登记工程；不能直接按未登记路径接入。'; return null }
    if (barriers.some(barrier => barrier.path === target.path)) { error.value = unknownRegistration; return null }
    const binding = makeBinding(target), preview = freeze({ project: target, sourceLabel: sourceLabel(binding),
      consents: Object.fromEntries(consentKeys.map(key => [key, consents[key]])) as unknown as SetupConsents,
      ...(strict?{effectiveOptions:{startCreator:consents.startCreator,configureCodex:consents.configureCodex}}:{}),
      observedAt: binding.observedAt, snapshotRevision: binding.revision })
    setupApprovals.set(preview, binding); preparedSetup.value = preview; error.value = ''
    return preview
  }
  function registrationResult(op: RegistrationOperation, phase: RegistrationReceipt['phase'], message: string, result?: Readonly<ManagedProject>) {
    if (phase === 'unknown') {
      // Capture before publishing: a synchronous receipt observer may start the required new read.
      barriers.push({ path: op.preview.path, reader: op.binding.reader, readGeneration, revision: browser.projectSnapshotRevision })
    }
    error.value = phase === 'acknowledged' ? '' : message
    registrationReceipt.value = freeze({ phase, requestedPath: op.preview.path, ...(result ? { project: result } : {}), message })
  }
  async function sendRegistration(preview: PreparedRegistration | null, confirmed: boolean): Promise<boolean> {
    if (confirmed !== true || !preview || preview !== preparedRegistration.value) return false
    const binding = registrationApprovals.get(preview)
    if (!binding || !samePreview(binding) || blockingReason() || barriers.some(barrier => barrier.path === preview.path)) {
      clearPrepared(); error.value = contextMessage; return false
    }
    // The approval is opaque and one-use, consumed before observers/provider code run.
    clearPrepared()
    const lease = lane.acquire('登记工程')
    if (!lease) { error.value = cleanupMessage; return false }
    const op: RegistrationOperation = { binding, preview, lease, controller: new AbortController(), awaiting: true, dispatched: false, cancelled: false }
    registration = op; transportBusy.value = true; pending.value = true; error.value = ''
    registrationReceipt.value = freeze({ phase: 'sending', requestedPath: preview.path, message: '正在等待登记回执；尚未核实登记结果。' })
    let acknowledged = false
    try {
      if (!sameContext(binding) || !visible.value || op.cancelled) throw new ProjectSetupError('aborted', 'not-dispatched')
      const result = await abortable(op.controller, () => { op.dispatched = true; return binding.writer.register(preview.path, op.controller.signal) })
      if (result !== cancelled && !op.cancelled && sameContext(binding)) {
        const actual = validProject(result)
        op.awaiting = false; pending.value = false
        registrationResult(op, 'acknowledged', '后台已返回登记记录。请核对实际路径，刷新真实工程后，再单独确认完整接入。', actual)
        acknowledged = true
      } else if (!op.cancelled) cancelRegistration(op)
    } catch (cause) {
      if (!op.cancelled) {
        op.awaiting = false; pending.value = false
        const failure = safeFailure(cause)
        registrationResult(op, failure.outcome, failure.outcome === 'unknown' ? unknownRegistration : failure.message)
      }
    } finally {
      op.awaiting = false; pending.value = false
      try {
        await binding.writer.waitForIdle()
        if (registration === op) {
          // Clear our state before releasing: synchronous lane observers can start a new operation.
          registration = null; transportBusy.value = false; lane.release(op.lease)
        }
      } catch { error.value = cleanupMessage }
    }
    return acknowledged
  }
  function setupResult(op: SetupOperation, phase: SetupReceipt['phase'], message: string, snapshot?: Readonly<SetupSnapshot>) {
    completionBinding.value = phase === 'complete' ? op.binding : null
    error.value = phase === 'tracking' || phase === 'complete' ? '' : message
    setupReceipt.value = freeze({ phase, project: op.preview.project, ...(op.preview.effectiveOptions?{effectiveOptions:op.preview.effectiveOptions}:{}),...(op.reused===undefined?{}:{reused:op.reused}), ...(op.operationId ? { operationId: op.operationId } : {}),
      ...(snapshot ? { snapshot } : setupReceipt.value?.snapshot ? { snapshot: setupReceipt.value.snapshot } : {}), message })
  }
  function clearTimers() { clearTimeout(pollTimer); clearTimeout(deadlineTimer); pollTimer = deadlineTimer = undefined }
  function pollCurrent(op: SetupOperation, epoch: number) {
    return setup === op && op.epoch === epoch && !op.detached && !op.terminal && visible.value && tracking.value && sameContext(op.binding, op.preview.project)
  }
  function pause(op: SetupOperation, message = pausedMessage) {
    if (setup !== op || op.terminal) return
    op.epoch++; clearTimers()
    // Abort only this call before publishing resumability to synchronous observers.
    const controller = op.controller; controller?.abort()
    if (op.operationId) setupResult(op, 'paused', message)
    else {
      op.releasable = !op.dispatched
      setupResult(op, op.dispatched ? 'unknown' : 'not-dispatched', op.dispatched ? unknownSetup : '请求尚未发出，已停止等待。')
    }
    pending.value = false; tracking.value = false
  }
  function beginBudget(op: SetupOperation) {
    clearTimers(); op.startedWaitingAt = Date.now()
    deadlineTimer = setTimeout(() => {
      if (setup === op && !op.terminal && tracking.value) pause(op, '等待已达 15 分钟，已暂停查询；后台未被取消，工程写操作仍锁定。可明确恢复只读查询。')
    }, PROJECT_SETUP_LIMITS.maxPollMs)
  }
  function verifySetupContext(op: SetupOperation) {
    if (setup === op && !op.terminal && !op.releasable && !sameContext(op.binding, op.preview.project)) {
      op.detached = true
      pause(op, '原工程、来源或连接已变化，已停止原任务查询；后台可能仍在执行，写操作继续锁定，不能在新来源恢复。')
      return false
    }
    return true
  }
  function schedulePoll(op: SetupOperation, epoch: number) {
    if (!verifySetupContext(op)) return
    if (!pollCurrent(op, epoch) || op.busy || op.cleanupFailed) return
    pollTimer = setTimeout(() => { pollTimer = undefined; void poll(op, epoch) }, PROJECT_SETUP_LIMITS.pollMs)
  }
  async function settleSetup(op: SetupOperation): Promise<boolean> {
    try {
      await op.binding.writer.waitForIdle()
      op.busy = false
      if (setup === op) transportBusy.value = false
      // A known terminal or an explicitly undispatched/rejected POST can release.
      // Pausing, a GET error, or unknown POST never proves the backend stopped.
      if (setup === op && (op.terminal || op.releasable)) { setup = null; lane.release(op.lease) }
      return true
    } catch {
      op.cleanupFailed = true; tracking.value = false; clearTimers()
      if (!op.terminal && !op.releasable && op.operationId) setupResult(op, 'paused', cleanupMessage)
      error.value = cleanupMessage
      return false
    }
  }
  async function sendSetup(preview: PreparedSetup | null, confirmed: boolean): Promise<boolean> {
    if (confirmed !== true || !preview || preview !== preparedSetup.value) return false
    const binding = setupApprovals.get(preview)
    if (!binding || !samePreview(binding, preview.project) || blockingReason()) {
      clearPrepared(); error.value = contextMessage; return false
    }
    clearPrepared()
    const lease = lane.acquire('完整接入工程')
    if (!lease) { error.value = cleanupMessage; return false }
    const op: SetupOperation = { binding, preview, lease, epoch: 0, dispatched: false, accepted: false, detached: false,
      terminal: false, releasable: false, busy: true, cleanupFailed: false, startedWaitingAt: 0, controller: new AbortController() }
    setup = op; pending.value = true; transportBusy.value = true; tracking.value = false; error.value = ''
    setupReceipt.value = freeze({ phase: 'submitting', project: preview.project, message: '正在提交完整接入请求；尚未核实后台是否接受。' })
    const epoch = op.epoch, controller = op.controller!
    let accepted = false
    try {
      if (!sameContext(binding, preview.project) || !visible.value || controller.signal.aborted) throw new ProjectSetupError('aborted', 'not-dispatched')
      const result = await abortable(controller, () => { op.dispatched = true; return preview.effectiveOptions ? binding.writer.startStrict!(preview.project.id,preview.effectiveOptions,controller.signal) : binding.writer.start(preview.project.id, controller.signal) })
      if (result === cancelled || op.epoch !== epoch || op.detached || !sameContext(binding, preview.project)) {
        if (op.epoch === epoch) pause(op)
      } else {
        if (!result || typeof result !== 'object') throw new ProjectSetupError('invalid-shape')
        const id = validOperationId(result.operationId)
        if(preview.effectiveOptions){
          const actual=result as {optionsContractVersion?:unknown;effectiveOptions?:unknown;reused?:unknown}
          if(actual.optionsContractVersion!==1||typeof actual.reused!=='boolean'||!sameSetupOptions(actual.effectiveOptions,preview.effectiveOptions))throw new ProjectSetupError('invalid-shape')
          op.reused=actual.reused
        }
        op.operationId = id; op.accepted = true; accepted = true; tracking.value = true; pending.value = false
        if (pollCurrent(op, epoch)) { beginBudget(op); setupResult(op, 'tracking', acceptedMessage) }
      }
    } catch (cause) {
      if (op.epoch === epoch && !op.detached) {
        const failure = safeFailure(cause)
        op.releasable = failure.outcome === 'not-dispatched' || failure.outcome === 'rejected'
        tracking.value = false
        setupResult(op, failure.outcome, failure.outcome === 'unknown' ? unknownSetup : failure.message)
      }
    } finally {
      pending.value = false; op.controller = undefined
      if (await settleSetup(op)) schedulePoll(op, epoch)
    }
    return accepted
  }
  async function poll(op: SetupOperation, epoch: number) {
    if (!verifySetupContext(op)) return
    if (!pollCurrent(op, epoch) || !op.operationId || op.busy || op.cleanupFailed) return
    if (Date.now() - op.startedWaitingAt >= PROJECT_SETUP_LIMITS.maxPollMs) { pause(op, '等待已达 15 分钟，已暂停查询；后台未被取消。'); return }
    op.busy = true; transportBusy.value = true
    const controller = new AbortController(); op.controller = controller
    try {
      const result = await abortable(controller, () => op.binding.writer.status(op.operationId!, controller.signal))
      if (result === cancelled || !verifySetupContext(op) || !pollCurrent(op, epoch)) return
      const snapshot = validSnapshot(result, op.operationId, op.preview.project, op.preview.effectiveOptions)
      if (snapshot.stage === 'complete' || snapshot.stage === 'failed') {
        op.terminal = true; tracking.value = false; clearTimers()
        setupResult(op, snapshot.stage, snapshot.stage === 'complete' ? (op.preview.effectiveOptions ? `后台报告所选安装步骤完成：Bridge 已处理；Creator ${op.preview.effectiveOptions.startCreator?'已选择启动及验证':'未选择，未由本任务启动'}；Codex ${op.preview.effectiveOptions.configureCodex?'已选择配置':'未选择，未由本任务配置'}。请另行读取当前运行状态。` : completedMessage) : failedMessage, snapshot)
      } else setupResult(op, 'tracking', acceptedMessage, snapshot)
    } catch (cause) {
      if(pollCurrent(op,epoch)&&cause instanceof ProjectSetupError&&cause.code==='options-mismatch'){
        pause(op,cause.message);setupResult(op,'unknown',cause.message);return
      }
      if (pollCurrent(op, epoch)) pause(op, '任务状态查询未能核实，已暂停自动查询；后台可能继续执行。可明确恢复同一任务的只读查询，不会重发接入。')
    } finally {
      if (op.controller === controller) op.controller = undefined
      if (await settleSetup(op)) schedulePoll(op, epoch)
    }
  }
  const canResume = computed(() => {
    const op = setup
    // Read reactive epoch/transport flags as well as the internal operation.
    void generation.value; void transportBusy.value; void tracking.value; void visible.value; void setupReceipt.value
    return !!op && !!op.operationId && !op.terminal && !op.detached && !op.cleanupFailed && !op.busy && !transportBusy.value
      && !tracking.value && visible.value && sameContext(op.binding, op.preview.project)
  })
  async function resume(): Promise<boolean> {
    const op = setup
    // canResume may be cached when a shallow provider changes in place.
    if (!op || !verifySetupContext(op) || !canResume.value) return false
    const epoch = ++op.epoch; tracking.value = true
    if (!verifySetupContext(op) || !pollCurrent(op, epoch)) return false
    error.value = ''; beginBudget(op)
    setupResult(op, 'tracking', '已恢复同一任务的只读查询；未重新提交接入，后台是否采用请求选项仍需核对。')
    await poll(op, epoch)
    return true
  }
  function cancelRegistration(op: RegistrationOperation) {
    if (registration !== op || !op.awaiting || op.cancelled) return
    op.cancelled = true; op.awaiting = false; pending.value = false
    registrationResult(op, op.dispatched ? 'unknown' : 'not-dispatched', op.dispatched ? unknownRegistration : '请求尚未发出，已停止等待。')
    op.controller.abort()
  }
  function stopWaiting() {
    clearPrepared()
    if (registration) cancelRegistration(registration)
    if (setup && !setup.terminal && !setup.releasable) pause(setup)
  }
  function leave() { visible.value = false; stopWaiting() }
  function setVisible(next: boolean) { visible.value = next === true; if (!visible.value) stopWaiting() }
  const completedSetup = computed(() => {
    const receipt=setupReceipt.value,binding=completionBinding.value
    if(!receipt||receipt.phase!=='complete'||receipt.snapshot?.stage!=='complete'||receipt.snapshot.failureReported===true||!binding||!sameContext(binding,receipt.project))return null
    return freeze({project:receipt.project})
  })
  const completedUsage=computed(()=>{
    const completed=completedSetup.value,receipt=setupReceipt.value
    if(!completed||receipt?.effectiveOptions?.configureCodex===false)return null
    const prompt=buildSetupCompletionPrompt(receipt?.snapshot?.mcpName)
    return prompt?freeze({project:completed.project,prompt}):null
  })
  function contextChanged() {
    if(completionBinding.value&&(!setupReceipt.value||!sameContext(completionBinding.value,setupReceipt.value.project)))completionBinding.value=null
    const hadPreview = !!preparedRegistration.value || !!preparedSetup.value
    clearPrepared()
    if (hadPreview) error.value = contextMessage
    if (registration && !sameContext(registration.binding)) cancelRegistration(registration)
    if (setup) verifySetupContext(setup)
  }
  watch(() => [browser.provider, projectSetupProvider.value, browser.connected] as const,
    ([read, write, connected], [oldRead, oldWrite, wasConnected]) => {
      if (read !== oldRead || write !== oldWrite || (!connected && wasConnected)) {
        generation.value++; activeRead = null; contextChanged()
      }
    }, { flush: 'sync' })
  watch(() => [browser.projects, browser.statuses, browser.projectLoading, browser.projectSnapshotRevision, browser.observedAt,
    browser.provider?.label, projectSetupProvider.value?.label], contextChanged, { deep: true, flush: 'sync' })
  watch(() => browser.projectLoading, (loading, previous) => {
    if (loading && !previous) {
      readGeneration++
      const read = reader()
      activeRead = read ? { reader: read, generation: generation.value, readGeneration } : null
    } else if (!loading) activeRead = null
  }, { flush: 'sync' })
  watch(() => browser.projectSnapshotRevision, revision => {
    const read = activeRead
    if (!read || !browser.connected || read.reader !== reader() || read.generation !== generation.value) return
    for (let index = barriers.length - 1; index >= 0; index--) {
      const barrier = barriers[index]!
      if (barrier.reader === read.reader && read.readGeneration > barrier.readGeneration && revision > barrier.revision) barriers.splice(index, 1)
    }
  }, { flush: 'sync' })
  return { preparedRegistration: computed(() => preparedRegistration.value), preparedSetup: computed(() => preparedSetup.value),
    completedSetup, completedUsage, registrationReceipt: computed(() => registrationReceipt.value), setupReceipt: computed(() => setupReceipt.value),
    pending: computed(() => pending.value), tracking: computed(() => tracking.value), error: computed(() => error.value), canResume,
    prepareRegistration, sendRegistration, prepareSetup, sendSetup, resume, stopWaiting, clearPrepared, leave, setVisible, blocksAutomaticProjectRead }
})

function freeze<T extends object>(value: T): Readonly<T> {
  for (const item of Object.values(value)) if (item && typeof item === 'object' && !Object.isFrozen(item)) freeze(item)
  return Object.freeze(value)
}
function projectKey(project: Readonly<ManagedProject>) { return JSON.stringify([project.id, project.name, project.path, project.requiredCreatorVersion ?? null]) }
function projectsKey(projects: readonly ManagedProject[]) { return JSON.stringify(projects.map(projectKey)) }
function invalid(): never { throw new ProjectSetupError('invalid-shape', 'unknown') }
function safeFailure(cause: unknown): ProjectSetupError {
  return cause instanceof ProjectSetupError ? cause : new ProjectSetupError('network-error', 'unknown')
}
function text(value: unknown, max = 4096): value is string { return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value) }
function validOperationId(value: unknown) { try { return validateSetupOperationId(value) } catch { return invalid() } }
function validProject(value: unknown): Readonly<ManagedProject> {
  if (!value || typeof value !== 'object') return invalid()
  const project = value as ManagedProject
  try { validateSetupProjectId(project.id); validateProjectPath(project.path) } catch { return invalid() }
  if (!text(project.name, 512) || (project.requiredCreatorVersion !== undefined && !text(project.requiredCreatorVersion, 128))) return invalid()
  return freeze({ id: project.id, name: project.name, path: project.path,
    ...(project.requiredCreatorVersion === undefined ? {} : { requiredCreatorVersion: project.requiredCreatorVersion }) })
}
function validSnapshot(value: unknown, id: string, project: Readonly<ManagedProject>, expected?:EffectiveSetupOptions): Readonly<SetupSnapshot> {
  if (!value || typeof value !== 'object') return invalid()
  const snapshot = value as SetupSnapshot
  if (validOperationId(snapshot.id) !== id || snapshot.projectPath !== project.path
    || (snapshot.projectId !== undefined && snapshot.projectId !== project.id)
    || !SETUP_STAGES.includes(snapshot.stage) || !text(snapshot.startedAt, 128) || !text(snapshot.updatedAt, 128)
    || !Number.isFinite(Date.parse(snapshot.startedAt)) || !Number.isFinite(Date.parse(snapshot.updatedAt))) return invalid()
  const result: SetupSnapshot = { id, projectPath: project.path, stage: snapshot.stage, startedAt: snapshot.startedAt, updatedAt: snapshot.updatedAt }
  if(expected){
    if(snapshot.optionsContractVersion!==1||!sameSetupOptions(snapshot.effectiveOptions,expected))throw new ProjectSetupError('options-mismatch')
    if((!expected.configureCodex&&snapshot.mcpName!==undefined)||(!expected.startCreator&&snapshot.runtime!==undefined))throw new ProjectSetupError('options-mismatch')
    result.optionsContractVersion=1;result.effectiveOptions={...expected}
  }
  if (snapshot.projectId !== undefined) result.projectId = snapshot.projectId
  if (snapshot.projectName !== undefined) { if (!text(snapshot.projectName, 512)) return invalid(); result.projectName = snapshot.projectName }
  if (snapshot.bridge !== undefined) {
    const bridge = snapshot.bridge
    if (!bridge || !['installed', 'updated', 'current'].includes(bridge.status) || !text(bridge.version, 128) || !text(bridge.targetPath)) return invalid()
    result.bridge = { status: bridge.status, version: bridge.version, targetPath: bridge.targetPath }
  }
  if (snapshot.runtime !== undefined) {
    const runtime = snapshot.runtime
    if (!runtime || runtime.projectId !== project.id || !['stopped', 'launching', 'bridge-wait', 'ready', 'stopping', 'crashed', 'incompatible', 'error'].includes(runtime.state)
      || (runtime.creatorVersion !== undefined && !text(runtime.creatorVersion, 128))) return invalid()
    result.runtime = { projectId: runtime.projectId, state: runtime.state, ...(runtime.creatorVersion === undefined ? {} : { creatorVersion: runtime.creatorVersion }) }
  }
  if (snapshot.mcpName !== undefined) { if (!text(snapshot.mcpName, 256)) return invalid(); result.mcpName = snapshot.mcpName }
  if (snapshot.failureReported !== undefined) { if (typeof snapshot.failureReported !== 'boolean') return invalid(); result.failureReported = snapshot.failureReported }
  if (snapshot.errorCode !== undefined) { if (!text(snapshot.errorCode, 128)) return invalid(); result.errorCode = snapshot.errorCode }
  return freeze(result)
}
async function abortable<T>(controller: AbortController, action: () => Promise<T>): Promise<T | typeof cancelled> {
  if (controller.signal.aborted) return cancelled
  let onAbort!: () => void
  const cancellation = new Promise<typeof cancelled>(resolve => { onAbort = () => resolve(cancelled); controller.signal.addEventListener('abort', onAbort, { once: true }) })
  try { return await Promise.race([action(), cancellation]) }
  finally { controller.signal.removeEventListener('abort', onAbort) }
}
