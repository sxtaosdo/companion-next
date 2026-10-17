import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { decodeAiJobSnapshot, verifyAiJobPreview } from '../domain/ai-jobs-read'
import type { AiJobPreview, AiJobSnapshot, AiJobsReadProvider } from '../domain/ai-jobs-read'
import { isAiProjectId } from '../domain/ai-resource-read'
import { AiJobActionError, aiJobActionAllowed, aiJobActionCanonical, aiJobActionIdentityMatches, aiVariantDestination, validateAiJobActionResult, validateAiJobActionSubmission } from '../domain/ai-job-actions'
import type { AiJobAction, AiJobActionSubmission, AiJobActionsProvider, AiJobVariantReceipt } from '../domain/ai-job-actions'
import { AiWriteCoordinationError, aiWriteCoordinator, getAiWriteFenceStorage, hasPendingAiWrites, putAiWriteFence, readAiWriteFences, removeAiWriteFence } from '../domain/ai-write-coordination'
import type { AiWriteCoordinator, AiWriteFence, AiWriteFenceStorage } from '../domain/ai-write-coordination'
import { useProjectOperationLaneStore } from './project-operation-lane'
import type { AiJobsProject } from './ai-jobs-read'

export interface AiJobActionReadback { snapshot: AiJobSnapshot; project: AiJobsProject; source: object; reader: AiJobsReadProvider }
interface Binding { project: AiJobsProject; source: object; reader: AiJobsReadProvider; provider: AiJobActionsProvider | null; job: AiJobSnapshot; offlineOnly: boolean | undefined }
export interface AiJobActionConfirmation { operation: AiJobAction; project: AiJobsProject; submission: AiJobActionSubmission; needsUpscale: boolean }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
const projectMatches = (a: AiJobsProject, b: AiJobsProject) => aiJobActionCanonical(a) === aiJobActionCanonical(b)
const unknown = '本次操作结果未知，可能已经执行。保护记录会保留；只核对同一个原任务，不重复提交。'
const dispatch = '原后台已接受派发；返回的是执行前快照，不代表生成或导入完成。'
const pendingMessage = '此工程有尚未核对的写操作。请刷新原任务；未知尺寸导出不能靠任务状态解除，需在原工程核对。'
const contextChanged = '工程、来源、任务版本或提供者已变化，本次确认已撤销。'
function validProject(project: AiJobsProject): boolean { return isAiProjectId(project.id) && typeof project.name === 'string' && project.name.length <= 512 && typeof project.path === 'string'
  && project.path.length > 0 && project.path.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(project.name + project.path) }
/** State is per mounted panel; persistent unknown fences and the cross-tab lock are shared. */
export function createAiJobActionsState(options: { storage?: AiWriteFenceStorage; coordinator?: AiWriteCoordinator } = {}) {
  const lane = useProjectOperationLaneStore(), coordinator = options.coordinator ?? aiWriteCoordinator
  const binding = shallowRef<Binding | null>(null), confirmation = shallowRef<AiJobActionConfirmation | null>(null)
  const confirmed = ref(false), upscaleConfirmed = ref(false), selectedIds = ref<string[]>([]), previewed = shallowRef<Record<string, string>>({})
  const busy = ref(false), refreshing = ref(false), phase = ref('idle'), message = ref(''), storageBlocked = ref(false), hasPending = ref(false)
  const readback = shallowRef<AiJobActionReadback | null>(null), variantReceipt = shallowRef<AiJobVariantReceipt | null>(null)
  const observed = shallowRef<AiJobSnapshot | null>(null), readDrainBlocked = ref(false)
  const drainAvailable = computed(() => !!binding.value && typeof binding.value.reader.waitForIdle === 'function' && typeof binding.value.provider?.waitForIdle === 'function')
  let epoch = 0, previewEpoch = 0, scopeEpoch = 0, dispatchStarted = false, controller: AbortController | undefined, refreshController: AbortController | undefined
  let approvalBinding: Binding | null = null, storage = options.storage
  const getStorage = () => storage ??= getAiWriteFenceStorage()
  const job = computed(() => binding.value?.job ?? null)
  const generationEnabled = computed(() => !!binding.value && binding.value.offlineOnly !== true
    && (binding.value.offlineOnly === false || binding.value.job.mode === 'generation') && binding.value.job.mode !== 'offline_import_only')
  const canExecute = computed(() => !!binding.value?.provider && !!confirmation.value && approvalBinding === binding.value && confirmed.value
    && drainAvailable.value && !readDrainBlocked.value && (!confirmation.value.needsUpscale || upscaleConfirmed.value) && !busy.value && !refreshing.value && !lane.locked && !storageBlocked.value && !hasPending.value)
  function clearApproval() { confirmation.value = null; approvalBinding = null; confirmed.value = false; upscaleConfirmed.value = false }
  function storageFailure() { storageBlocked.value = true; clearApproval(); message.value = new AiWriteCoordinationError().message }
  function updatePending() {
    try { hasPending.value = binding.value ? hasPendingAiWrites(getStorage(), binding.value.project.id) : false; storageBlocked.value = false }
    catch { hasPending.value = true; storageFailure() }
  }
  function setContext(project: AiJobsProject | null, source: object | null, snapshot: AiJobSnapshot | null, reader: AiJobsReadProvider | null, provider: AiJobActionsProvider | null, offlineOnly?: boolean) {
    let next: Binding | null = null
    try {
      if (project && source && typeof source === 'object' && snapshot && reader && validProject(project)) {
        next = { project: freeze({ ...project }), source, reader, provider, job: freeze(decodeAiJobSnapshot(snapshot, project.id, snapshot.jobId)), offlineOnly }
      }
    } catch { /* Invalid current context cannot authorize a write. */ }
    const previous = binding.value
    if (previous && next && projectMatches(previous.project, next.project) && previous.source === next.source && previous.reader === next.reader && previous.provider === next.provider
      && previous.offlineOnly === next.offlineOnly && aiJobActionCanonical(previous.job) === aiJobActionCanonical(next.job)) { updatePending(); return }
    epoch++; previewEpoch++; clearApproval(); selectedIds.value = []; previewed.value = {}; observed.value = null; variantReceipt.value = null; readback.value = null
    refreshController?.abort(); refreshController = undefined; refreshing.value = false
    binding.value = next; readDrainBlocked.value = false; updatePending()
    if (!busy.value) { phase.value = next ? 'idle' : 'invalidated'; if (!storageBlocked.value) message.value = previous ? contextChanged : '' }
    // Never abort or release an in-flight write because the page or its context changed.
  }
  function leave() { setContext(null, null, null, null, null) }
  async function recordPreview(preview: AiJobPreview | null, shown: boolean) {
    const target = binding.value, token = epoch, generation = previewEpoch
    if (!target || !preview || !shown) return false
    const candidate = target.job.candidates.find(c => c.candidateId === preview.candidateId)
    if (!candidate) return false
    try {
      const verified = await verifyAiJobPreview(preview, candidate)
      if (binding.value !== target || epoch !== token || previewEpoch !== generation) return false
      previewed.value = { ...previewed.value, [candidate.candidateId]: verified.sha256 }; return true
    } catch {
      if (binding.value === target) { const next = { ...previewed.value }; delete next[candidate.candidateId]; previewed.value = next; selectedIds.value = selectedIds.value.filter(id => id !== candidate.candidateId); clearApproval() }
      return false
    }
  }
  function setSelectedIds(ids: string[]) {
    clearApproval()
    const target = binding.value
    if (!target || busy.value || !Array.isArray(ids) || ids.length > 1 || new Set(ids).size !== ids.length) return
    if (ids.some(id => !target.job.candidates.some(candidate => candidate.candidateId === id && previewed.value[id] === candidate.fileSha256))) return
    selectedIds.value = [...ids]
  }
  function allowed(operation: AiJobAction): boolean {
    const target = binding.value
    return !!target?.provider && drainAvailable.value && !readDrainBlocked.value && (!observed.value || aiJobActionCanonical(observed.value) === aiJobActionCanonical(target.job)) && (operation !== 'import' || target.job.selectedIds.length === 1) && aiJobActionAllowed(operation, target.job, !generationEnabled.value)
      && (operation !== 'import-variant' || variantMatchesCurrentJob())
      && !busy.value && !refreshing.value && !lane.locked && !storageBlocked.value && !hasPending.value
  }
  function variantMatchesCurrentJob(): boolean {
    const receipt = variantReceipt.value, current = binding.value?.job
    return !!receipt && !!current && /^[a-f0-9]{64}$/.test(receipt.receiptSha256 ?? '') && receipt.jobId === current.jobId && receipt.revision === current.revision
      && current.selectedIds.length === 1 && current.selectedIds[0] === receipt.candidateId
      && current.candidates.some(candidate => candidate.candidateId === receipt.candidateId && candidate.fileSha256 === receipt.sourceSha256)
  }
  function prepare(operation: AiJobAction, variantSize?: { width: number; height: number }): boolean {
    clearApproval(); updatePending()
    const target = binding.value
    if (!target || !allowed(operation)) { if (hasPending.value && !storageBlocked.value) message.value = pendingMessage; return false }
    const base = { jobId: target.job.jobId, revision: target.job.revision }
    let input: AiJobActionSubmission['input'] = base, needsUpscale = false
    if (operation === 'run-next') input = { ...base, gpuUseApproved: true }
    if (operation === 'import') input = { ...base, approved: true }
    if (operation === 'select') {
      if (selectedIds.value.length !== 1 || selectedIds.value.some(id => !target.job.candidates.some(c => c.candidateId === id && previewed.value[id] === c.fileSha256))) return false
      input = { ...base, selectedIds: [...selectedIds.value], approved: true }
    }
    if (operation === 'export-variant') {
      const sealed = target.job.resourceSnapshot
      if (sealed?.state !== 'sealed' || sealed.config.schemaVersion !== 'project-resource-config-v2' || target.job.selectedIds.length !== 1) return false
      const { width, height } = variantSize ?? sealed.config.iconSize
      needsUpscale = width > 1024 && height > 1024
      input = { ...base, candidateId: target.job.selectedIds[0]!, width, height, allowUpscale: needsUpscale, expectedTargetSha256: null, approved: true }
    }
    if (operation === 'import-variant') {
      const receipt = variantReceipt.value
      if (!receipt || !variantMatchesCurrentJob()) return false
      try {
        input = { ...base, candidateId: receipt.candidateId, width: receipt.width, height: receipt.height, destinationUrl: aiVariantDestination(target.job, receipt),
          expectedVariantSha256: receipt.sha256, expectedReceiptSha256: receipt.receiptSha256!, approved: true }
      } catch { message.value = new AiJobActionError('invalid-input', 'not-sent').message; return false }
    }
    try {
      const submission = validateAiJobActionSubmission(target.project.id, { operation, input, snapshot: target.job, approved: true })
      confirmation.value = freeze({ operation, project: clone(target.project), submission, needsUpscale }); approvalBinding = target; phase.value = 'confirming'; message.value = ''; return true
    } catch { message.value = new AiJobActionError('invalid-input', 'not-sent').message; return false }
  }
  function setConfirmed(value: boolean) { confirmed.value = value === true && !!confirmation.value && approvalBinding === binding.value }
  function setUpscaleConfirmed(value: boolean) { upscaleConfirmed.value = value === true && !!confirmation.value?.needsUpscale && approvalBinding === binding.value }
  function cancelConfirmation() { clearApproval(); if (!busy.value) phase.value = 'idle' }
  /** A stage can revoke an un-dispatched action without discarding the original job or releasing I/O protection. */
  function revokePendingScope() {
    scopeEpoch++; clearApproval()
    if (busy.value && !dispatchStarted) controller?.abort()
    if (!busy.value) phase.value = 'idle'
  }
  function cancelWait() { controller?.abort(); clearApproval(); if (busy.value) { phase.value = 'unknown'; message.value = unknown } }
  function reconcileLocked(target: Binding, snapshot: AiJobSnapshot) {
    if (binding.value !== target) return
    for (const fence of readAiWriteFences(getStorage())) {
      if (['enqueue', 'adopt', 'export-variant'].includes(fence.operation) || fence.projectId !== snapshot.projectId || fence.jobId !== snapshot.jobId
        || fence.requestHash !== snapshot.requestHash || fence.sourceRevision !== snapshot.sourceRevision || snapshot.revision <= fence.revision) continue
      // Revision advancement alone cannot prove an unresolved import finished or did not write.
      if (fence.operation === 'import' && !(snapshot.state === 'imported_pending_verification' && snapshot.import?.state === 'imported_pending_verification' && snapshot.import.effectApplied === true && snapshot.import.leaseState === 'RELEASED')) continue
      if (fence.operation === 'import-variant') {
        const imported = snapshot.variantImport, artifact = imported?.artifact
        if (!fence.variant || !imported || imported.active || imported.state !== 'imported_pending_verification' || imported.effectApplied !== true || imported.leaseState !== 'RELEASED' || !artifact
          || artifact.candidateId !== fence.variant.candidateId || artifact.width !== fence.variant.width || artifact.height !== fence.variant.height
          || artifact.fileSha256 !== fence.variant.fileSha256 || artifact.receiptSha256 !== fence.variant.receiptSha256 || artifact.destinationUrl !== fence.variant.destinationUrl) continue
      }
      if (fence.operation === 'select' && snapshot.state !== 'selected') continue
      if (['run-next', 'resume'].includes(fence.operation) && ['queued', 'waiting_service', 'import_unknown'].includes(snapshot.state)) continue
      removeAiWriteFence(getStorage(), fence.key)
    }
  }
  async function reconcile(target: Binding, snapshot: AiJobSnapshot, underWriteLock: boolean) {
    if (busy.value && !underWriteLock) return
    try {
      if (underWriteLock) reconcileLocked(target, snapshot)
      else {
        const locked = await coordinator.run(async () => { if (!busy.value) reconcileLocked(target, snapshot) })
        if (!locked.acquired && binding.value === target) message.value = '另一个标签页仍持有写操作锁，保护记录保留。'
      }
      updatePending()
    } catch { storageFailure() }
  }
  async function refreshStatusInternal(underWriteLock = false): Promise<boolean> {
    const target = binding.value, token = epoch
    if (!target || refreshing.value || busy.value && !underWriteLock) return false
    clearApproval()
    const signal = new AbortController(); refreshController = signal; refreshing.value = true
    let snapshot: AiJobSnapshot | null = null, drainFailed = false
    try {
      try {
        const result = await target.reader.readStatus(target.project.id, target.job.jobId, signal.signal)
        if (binding.value === target && epoch === token) {
          const checked = freeze(decodeAiJobSnapshot(result, target.project.id, target.job.jobId)), previous = observed.value ?? target.job
          if (!aiJobActionIdentityMatches(checked, target.job) || checked.revision < previous.revision) throw new AiJobActionError('invalid-shape', 'unknown')
          snapshot = checked
        }
      } catch {
        if (binding.value === target && epoch === token) message.value = '未能核对同一个原任务的新状态；操作保护保留，没有推断完成或重试。'
      } finally {
        if (target.reader.waitForIdle) {
          try { await target.reader.waitForIdle() }
          catch {
            drainFailed = true
            if (binding.value === target) { readDrainBlocked.value = true; message.value = '状态读取清理未确认，原操作保护继续保留。' }
            // An automatic post-write read owns the same cross-tab/lane lease. Rejection is not drainage.
            // Never clear an original fence or release those locks on an unconfirmed read cleanup.
            if (underWriteLock) await new Promise<never>(() => undefined)
          }
        } else if (underWriteLock) await new Promise<never>(() => undefined)
      }
      if (!snapshot || drainFailed || binding.value !== target || epoch !== token) return false
      readDrainBlocked.value = false; observed.value = snapshot
      await reconcile(target, snapshot, underWriteLock)
      if (binding.value !== target || epoch !== token) return false
      // This payload is pinned to the read's original identity, and emitted only after tracked I/O drainage.
      readback.value = { snapshot, project: target.project, source: target.source, reader: target.reader }
      return true
    } finally { if (epoch === token) { refreshing.value = false; refreshController = undefined } }
  }
  function refreshStatus(): Promise<boolean> { return refreshStatusInternal() }
  async function execute(): Promise<boolean> {
    if (!canExecute.value || !binding.value || !confirmation.value) return false
    const target = binding.value, approved = confirmation.value, provider = target.provider!, token = epoch, approvedScope = scopeEpoch
    const lease = lane.acquire('原图标任务明确批准操作')
    if (!lease) { clearApproval(); return false }
    dispatchStarted = false; busy.value = true; phase.value = 'sending'; message.value = ''; clearApproval()
    let sent = false, success = false, shouldRefresh = false, clearFenceAfterDrain = false
    const abort = new AbortController(); controller = abort
    const base = approved.submission, variant = ['export-variant', 'import-variant'].includes(base.operation) ? base.input as { candidateId: string; width: number; height: number } : null
    const fence: AiWriteFence = { key: `${target.project.id}/${target.job.jobId}/${base.operation}/${target.job.revision}${variant ? `/${variant.candidateId}/${variant.width}x${variant.height}` : ''}`,
      projectId: target.project.id, jobId: target.job.jobId, operation: base.operation, revision: target.job.revision, requestHash: target.job.requestHash, sourceRevision: target.job.sourceRevision }
    if (base.operation === 'import-variant' && 'expectedVariantSha256' in base.input) fence.variant = { candidateId: base.input.candidateId, width: base.input.width, height: base.input.height,
      fileSha256: base.input.expectedVariantSha256, receiptSha256: base.input.expectedReceiptSha256, destinationUrl: base.input.destinationUrl }
    const current = () => binding.value === target && epoch === token
    try {
      const locked = await coordinator.run(async () => {
        if (!current() || abort.signal.aborted || approvedScope !== scopeEpoch) return false
        try {
          if (!target.reader.waitForIdle) throw new Error('missing-drain')
          await target.reader.waitForIdle()
        } catch {
          if (current()) { readDrainBlocked.value = true; phase.value = 'not-sent'; message.value = '未发送；原任务读取清理未确认，写操作锁保留。' }
          // A rejected drain does not prove the underlying read ended. Retain both shared locks
          // even if this panel changes context or unmounts; no new write was sent, so no job fence is invented.
          await new Promise<never>(() => undefined)
        }
        if (!current() || abort.signal.aborted || approvedScope !== scopeEpoch) return false
        if (hasPendingAiWrites(getStorage(), target.project.id)) { hasPending.value = true; message.value = pendingMessage; return false }
        putAiWriteFence(getStorage(), fence); hasPending.value = true
        try {
          if (!current() || abort.signal.aborted || approvedScope !== scopeEpoch) { removeAiWriteFence(getStorage(), fence.key); return false }
          sent = true; dispatchStarted = true
          const result = validateAiJobActionResult(await provider.execute(target.project.id, base, abort.signal), target.project.id, base)
          if (result.kind === 'variant') {
            clearFenceAfterDrain = true
            if (current()) { variantReceipt.value = freeze(result.receipt); phase.value = 'variant'; message.value = '已核对本次尺寸 PNG 回执；这是 CPU 派生文件，未导入 Creator，也未完成运行验收。' }
          } else {
            if (result.kind === 'selection') clearFenceAfterDrain = true
            if (current()) { phase.value = result.kind === 'dispatch' ? 'accepted' : 'selection'; message.value = result.kind === 'dispatch' ? dispatch : '原任务已保存候选选择；仍需 Owner 审阅并单独批准导入。' }
          }
          shouldRefresh = true; success = true; return true
        } catch (cause) {
          const failure = cause instanceof AiJobActionError ? cause : cause instanceof AiWriteCoordinationError ? null : new AiJobActionError('network-error', 'unknown')
          if (failure && ['not-sent', 'rejected', 'conflict'].includes(failure.outcome)) removeAiWriteFence(getStorage(), fence.key)
          if (current()) {
            if (!failure) storageFailure()
            else { phase.value = failure.outcome; message.value = failure.outcome === 'unknown' ? unknown : new AiJobActionError(failure.code, failure.outcome).message }
          }
          shouldRefresh = sent; return false
        } finally {
          // Do not release either cross-tab lock or Pinia lane while fetch/read/cancel cleanup remains unresolved.
          try { await provider.waitForIdle() } catch {
            if (current()) { phase.value = 'unknown'; message.value = '请求清理是否结束尚未确认，写操作锁继续保留。' }
            await new Promise<never>(() => undefined)
          }
          // The same lock/lane spans post-dispatch status I/O and its late-body cleanup too.
          if (shouldRefresh && current()) await refreshStatusInternal(true)
          else {
            try { if (!target.reader.waitForIdle) throw new Error('missing-drain'); await target.reader.waitForIdle() }
            catch { await new Promise<never>(() => undefined) }
          }
          if (clearFenceAfterDrain) removeAiWriteFence(getStorage(), fence.key)
        }
      })
      if (!locked.acquired && current()) { phase.value = 'not-sent'; message.value = '另一个标签页正在执行 AI 写操作；本次未发送。' }
    } catch (cause) {
      if (current()) { if (cause instanceof AiWriteCoordinationError) storageFailure(); else { phase.value = sent ? 'unknown' : 'not-sent'; message.value = sent ? unknown : '无法取得原任务写操作保护，本次未发送。' } }
    } finally { busy.value = false; dispatchStarted = false; controller = undefined; lane.release(lease); updatePending() }
    return success
  }
  return { job, confirmation, confirmed, upscaleConfirmed, selectedIds, previewed, busy, refreshing, phase, message, storageBlocked, hasPending, observed, readback, variantReceipt,
    generationEnabled, drainAvailable, readDrainBlocked, canExecute, setContext, leave, recordPreview, setSelectedIds, allowed, prepare, setConfirmed, setUpscaleConfirmed, cancelConfirmation, revokePendingScope, cancelWait, refreshStatus, execute }
}
export const useAiJobActionsStore = defineStore('ai-job-actions', () => createAiJobActionsState())
