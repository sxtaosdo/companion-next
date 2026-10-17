import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { isAiProjectId } from '../domain/ai-resource-read'
import { AiJobsReadError, decodeAiJobsView, decodeAiJobSnapshot, isAiCandidateId, verifyAiJobPreview, verifyAiPngPreview } from '../domain/ai-jobs-read'
import type { AiJobsReadProvider, AiJobsView, AiJobSnapshot, AiJobPreview, AiVariantPreview } from '../domain/ai-jobs-read'
export interface AiJobsProject { id: string; name: string; path: string }
export interface AiJobActionReadback {
  snapshot: AiJobSnapshot; project: AiJobsProject; source: object; reader: AiJobsReadProvider
}
/** Each mounted panel may own a state instance, so one page leaving cannot cancel another mounted panel. */
export function createAiJobsReadState() {
  const provider = shallowRef<AiJobsReadProvider | null>(null), project = shallowRef<AiJobsProject | null>(null)
  const history = shallowRef<AiJobsView | null>(null), selectedJobId = ref(''), status = shallowRef<AiJobSnapshot | null>(null)
  const preview = shallowRef<AiJobPreview | null>(null), previewCandidateId = ref('')
  const previewShown = ref(false)
  const variantPreview = shallowRef<AiVariantPreview | null>(null), variantPreviewLoading = ref(false), variantPreviewError = ref('')
  const loading = ref(false), statusLoading = ref(false), previewLoading = ref(false), error = ref(''), statusError = ref(''), previewError = ref('')
  const observedAt = ref(''), statusObservedAt = ref('')
  const busy = computed(() => loading.value || statusLoading.value || previewLoading.value || variantPreviewLoading.value)
  let source: object | null = null, epoch = 0, detailEpoch = 0, previewEpoch = 0
  let variantEpoch = 0, variantController: AbortController | undefined
  const latest = new Map<string, { snapshot: AiJobSnapshot; observedAt: string }>()
  let jobsController: AbortController | undefined, statusController: AbortController | undefined, previewController: AbortController | undefined
  function clearPreview() { previewEpoch++; previewController?.abort(); previewController = undefined; preview.value = null; previewCandidateId.value = ''; previewShown.value = false; previewLoading.value = false; previewError.value = '' }
  function clearVariantPreview() { variantEpoch++; variantController?.abort(); variantController = undefined; variantPreview.value = null; variantPreviewLoading.value = false; variantPreviewError.value = '' }
  function clearStatus() { detailEpoch++; statusController?.abort(); statusController = undefined; status.value = null; statusLoading.value = false; statusError.value = ''; statusObservedAt.value = ''; clearPreview(); clearVariantPreview() }
  function clearReads() { epoch++; jobsController?.abort(); jobsController = undefined; history.value = null; latest.clear(); selectedJobId.value = ''; loading.value = false; error.value = ''; observedAt.value = ''; clearStatus() }
  function setContext(next: AiJobsProject | null, nextSource: object | null) {
    const safe = next && nextSource && isAiProjectId(next.id) ? { id: next.id, name: next.name, path: next.path } : null
    if (source !== nextSource || JSON.stringify(project.value) !== JSON.stringify(safe)) { clearReads(); project.value = safe; source = nextSource }
  }
  function invalidateProvider() { clearReads(); provider.value = null }
  function disconnect() { invalidateProvider(); project.value = null; source = null }
  const message = (cause: unknown) => cause instanceof AiJobsReadError ? new AiJobsReadError(cause.code, cause.endpoint, cause.status, cause.backendCode).message : '任务读取未完成，未显示内部诊断。'
  async function readJobs(next: AiJobsReadProvider) {
    if (!project.value || !source || busy.value) return
    if (provider.value !== next) { clearReads(); provider.value = next }
    clearReads()
    const token = epoch, target = project.value, registered = source, controller = new AbortController()
    jobsController = controller; loading.value = true
    const current = () => token === epoch && project.value === target && source === registered && provider.value === next
    try {
      const value = await next.readJobs(target.id, controller.signal)
      if (current()) { history.value = decodeAiJobsView(value, target.id); observedAt.value = new Date().toISOString() }
    } catch (cause) { if (current()) error.value = message(cause) }
    finally { if (current()) { loading.value = false; jobsController = undefined } }
  }
  /** Local selection never starts a status, candidate, model or import request. */
  function selectJob(jobId: string) {
    if (loading.value || !history.value?.jobs.some(job => job.jobId === jobId)) return
    clearStatus(); selectedJobId.value = jobId
    status.value = latest.get(jobId)?.snapshot ?? history.value.jobs.find(job => job.jobId === jobId) ?? null; statusObservedAt.value = latest.get(jobId)?.observedAt ?? observedAt.value
  }
  async function readStatus() {
    const active = provider.value, target = project.value, list = history.value, id = selectedJobId.value
    const previous = latest.get(id)?.snapshot ?? status.value ?? list?.jobs.find(job => job.jobId === id)
    if (!active || !target || !source || !list || !previous || busy.value || !list.jobs.some(job => job.jobId === id)) return
    clearStatus()
    const token = epoch, detailToken = detailEpoch, registered = source, controller = new AbortController()
    statusController = controller; statusLoading.value = true
    const current = () => token === epoch && detailToken === detailEpoch && source === registered && project.value === target && provider.value === active && selectedJobId.value === id
    try {
      const value = await active.readStatus(target.id, id, controller.signal)
      if (!current()) return
      const checked = decodeAiJobSnapshot(value, target.id, id)
      if (checked.revision < previous.revision || checked.requestHash !== previous.requestHash || checked.sourceRevision !== previous.sourceRevision) throw new AiJobsReadError('invalid-shape', 'status')
      status.value = checked; statusObservedAt.value = new Date().toISOString(); latest.set(id, { snapshot: checked, observedAt: statusObservedAt.value })
    } catch (cause) { if (current()) statusError.value = message(cause) }
    finally { if (current()) { statusLoading.value = false; statusController = undefined } }
  }
  async function readPreview(candidateId: string) {
    const active = provider.value, target = project.value, snapshot = status.value
    const candidate = snapshot?.candidates.find(candidate => candidate.candidateId === candidateId)
    if (!active || !target || !source || !snapshot || !candidate || !isAiCandidateId(candidateId) || snapshot.historyOnly || busy.value) return
    clearPreview(); clearVariantPreview()
    const token = epoch, detailToken = detailEpoch, previewToken = previewEpoch, registered = source, controller = new AbortController()
    previewController = controller; previewLoading.value = true; previewCandidateId.value = candidateId
    const current = () => token === epoch && detailToken === detailEpoch && previewToken === previewEpoch && source === registered && project.value === target && provider.value === active && status.value === snapshot
    try {
      const value = await active.previewCandidate(target.id, snapshot.jobId, { ...candidate }, controller.signal)
      if (!current()) return
      const checked = await verifyAiJobPreview(value, candidate)
      if (current()) preview.value = checked
    } catch (cause) { if (current()) previewError.value = message(cause) }
    finally { if (current()) { previewLoading.value = false; previewController = undefined } }
  }
  function previewDisplayed(candidateId: string, sha256: string) {
    if (preview.value?.candidateId === candidateId && preview.value.sha256 === sha256
      && status.value?.candidates.some(candidate => candidate.candidateId === candidateId && candidate.fileSha256 === sha256)) previewShown.value = true
  }
  function previewDisplayFailed() { preview.value = null; previewShown.value = false; previewError.value = '浏览器未能显示此 PNG；没有放宽页面安全策略。' }
  async function readVariantPreview() {
    const active = provider.value, target = project.value, snapshot = status.value
    if (!active?.previewVariant || !target || !source || !snapshot?.variantImport?.artifact || busy.value) return
    clearPreview(); clearVariantPreview()
    const token = epoch, detailToken = detailEpoch, viewToken = variantEpoch, registered = source, controller = new AbortController()
    variantController = controller; variantPreviewLoading.value = true
    const current = () => token === epoch && detailToken === detailEpoch && viewToken === variantEpoch && source === registered && project.value === target && provider.value === active && status.value === snapshot
    try {
      const value = await active.previewVariant(target.id, decodeAiJobSnapshot(snapshot, target.id), controller.signal)
      if (!current()) return
      const expected = snapshot.variantImport, artifact = expected?.artifact
      if (!expected || !artifact) throw new AiJobsReadError('invalid-shape', 'variant-preview')
      if (value.operationId !== expected.operationId || value.receiptSha256 !== artifact.receiptSha256) throw new AiJobsReadError('invalid-shape', 'variant-preview')
      const checked = await verifyAiPngPreview(value, { candidateId: artifact.candidateId, fileSha256: artifact.fileSha256, width: artifact.width, height: artifact.height }, 'variant-preview')
      if (current()) variantPreview.value = { ...checked, operationId: expected.operationId, receiptSha256: artifact.receiptSha256 }
    } catch (cause) { if (current()) variantPreviewError.value = message(cause) }
    finally { if (current()) { variantPreviewLoading.value = false; variantController = undefined } }
  }
  function variantPreviewDisplayFailed() { variantPreview.value = null; variantPreviewError.value = '浏览器未能显示此变体 PNG；没有放宽页面安全策略。' }
  /** Accept only a real same-task status read, never an action's pre-dispatch acknowledgement. */
  function acceptActionReadback(input: AiJobActionReadback): boolean {
    const target = project.value, id = selectedJobId.value
    if (!target || !source || source !== input.source || provider.value !== input.reader
      || target.id !== input.project.id || target.path !== input.project.path || target.name !== input.project.name
      || id !== input.snapshot.jobId || busy.value) return false
    const previous = latest.get(id)?.snapshot ?? status.value ?? history.value?.jobs.find(job => job.jobId === id)
    if (!previous) return false
    try {
      const checked = decodeAiJobSnapshot(input.snapshot, target.id, id)
      if (checked.revision < previous.revision || checked.requestHash !== previous.requestHash || checked.sourceRevision !== previous.sourceRevision) return false
      clearStatus(); status.value = checked; statusObservedAt.value = new Date().toISOString()
      latest.set(id, { snapshot: checked, observedAt: statusObservedAt.value }); return true
    } catch { return false }
  }
  return { provider, project, history, selectedJobId, status, preview, previewCandidateId, previewShown, loading, statusLoading, previewLoading, busy,
    error, statusError, previewError, observedAt, statusObservedAt, setContext, invalidateProvider, disconnect, clearReads, clearPreview, readJobs, selectJob, readStatus, readPreview, previewDisplayed, previewDisplayFailed, acceptActionReadback,
    variantPreview, variantPreviewLoading, variantPreviewError, readVariantPreview, clearVariantPreview, variantPreviewDisplayFailed }
}
export const useAiJobsReadStore = defineStore('ai-jobs-read', createAiJobsReadState)
