import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { isAiProjectId } from '../domain/ai-resource-read'
import type { AiResourceReadProvider } from '../domain/ai-resource-read'
import type { AiResourceSaveProvider } from '../domain/ai-resource-save'
import { AI_REFERENCE_UPLOAD_LIMITS, AiReferenceUploadError, decodeAiReferenceUploadReceipt, isPreparedLocalReference, prepareLocalReference } from '../domain/ai-reference-upload'
import type { AiReferenceDecode, AiReferenceUploadProvider, AiReferenceUploadReceipt, LocalReferenceFile, PreparedLocalReference } from '../domain/ai-reference-upload'
import { useAiResourceEditorStore } from './ai-resource-editor'
import type { AiEditorContext, AiEditorFenceStorage, AiEditorProject } from './ai-resource-editor'

export type AiReferenceUploadPhase = 'idle' | 'preparing' | 'ready' | 'uploading' | 'attached' | 'received' | 'not-sent' | 'rejected' | 'unknown' | 'invalidated'
export interface AiReferencePendingFence {
  project: AiEditorProject
  originalSha256: string
  mimeType: PreparedLocalReference['mimeType']
  width: number
  height: number
  receipt: AiReferenceUploadReceipt | null
}
export const AI_REFERENCE_UPLOAD_FENCE_KEY = 'companion.ai-reference-upload.pending.v1'
const maxFences = 32, maxFenceBytes = 262_144, sha = /^[a-f0-9]{64}$/
const storageMessage = '无法可靠读取或保存本会话的参考图上传记录，已阻止上传。已有回执和草稿仍会保留。'
const unknownMessage = '上传结果未知，原始文件或去元数据 PNG 可能已经写入。请在原项目本机核对；不能清除保护或重复上传同一文件。'
const receivedMessage = '参考图文件已上传，但配置规范尚未保存。请核对回执路径，附入原项目草稿后另行确认保存。'
const contextMessage = '项目、来源或编辑器状态已变化，上传确认已撤销；不会把迟到结果附入其它草稿。'
const canonical = (value: unknown): string => JSON.stringify(value)
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Reflect.ownKeys(value).length === keys.length
    && Reflect.ownKeys(value).every(key => typeof key === 'string' && keys.includes(key)) && keys.every(key => Object.hasOwn(value, key))
}
function validProject(value: unknown): value is AiEditorProject {
  if (!exact(value, ['id', 'name', 'path'])) return false
  return isAiProjectId(value.id) && typeof value.name === 'string' && value.name.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value.name)
    && typeof value.path === 'string' && value.path.length > 0 && value.path.length <= 4096 && !/[\u0000-\u001f\u007f]/.test(value.path)
}
const projectKey = (project: AiEditorProject): string => canonical([project.id, project.name, project.path])
const fenceKey = (projectId: string, originalSha256: string): string => `${projectId}:${originalSha256}`
function readFences(storage: AiEditorFenceStorage): AiReferencePendingFence[] {
  const text = storage.getItem(AI_REFERENCE_UPLOAD_FENCE_KEY)
  if (text === null) return []
  if (text.length > maxFenceBytes || new TextEncoder().encode(text).byteLength > maxFenceBytes) throw Error('storage')
  const value: unknown = JSON.parse(text)
  if (!Array.isArray(value) || value.length > maxFences) throw Error('storage')
  const keys = new Set<string>()
  return value.map(raw => {
    if (!exact(raw, ['project', 'originalSha256', 'mimeType', 'width', 'height', 'receipt']) || !validProject(raw.project)
      || typeof raw.originalSha256 !== 'string' || !sha.test(raw.originalSha256)
      || !['image/png', 'image/jpeg', 'image/webp'].includes(raw.mimeType as string)
      || !Number.isSafeInteger(raw.width) || !Number.isSafeInteger(raw.height) || (raw.width as number) < 1 || (raw.height as number) < 1
      || (raw.width as number) > AI_REFERENCE_UPLOAD_LIMITS.maxDimension || (raw.height as number) > AI_REFERENCE_UPLOAD_LIMITS.maxDimension || (raw.width as number) * (raw.height as number) > AI_REFERENCE_UPLOAD_LIMITS.maxPixels) throw Error('storage')
    const key = fenceKey(raw.project.id, raw.originalSha256)
    if (keys.has(key)) throw Error('storage')
    keys.add(key)
    const original = { sha256: raw.originalSha256, mimeType: raw.mimeType as PreparedLocalReference['mimeType'], width: raw.width as number, height: raw.height as number }
    const receipt = raw.receipt === null ? null : decodeAiReferenceUploadReceipt(raw.receipt, original)
    return { project: { ...raw.project }, originalSha256: original.sha256, mimeType: original.mimeType, width: original.width, height: original.height, receipt }
  })
}
interface Binding {
  project: AiEditorProject
  source: object
  reader: AiResourceReadProvider | null
  saveWriter: AiResourceSaveProvider | null
  uploadProvider: AiReferenceUploadProvider | null
}
function sameBinding(a: Binding | null, context: AiEditorContext | null, reader: AiResourceReadProvider | null, writer: AiResourceSaveProvider | null, upload: AiReferenceUploadProvider | null): boolean {
  return !!a && !!context && validProject(context.project) && projectKey(a.project) === projectKey(context.project)
    && a.source === context.source && a.reader === reader && a.saveWriter === writer && a.uploadProvider === upload
}

/** Local previews never confer upload authority. Original bytes are sent only after per-file, per-form approval. */
export const useAiReferenceUploadStore = defineStore('ai-reference-upload', () => {
  const editor = useAiResourceEditorStore()
  const selected = shallowRef<PreparedLocalReference | null>(null), fileName = ref(''), phase = ref<AiReferenceUploadPhase>('idle'), error = ref('')
  const confirmed = ref(false), contextValid = ref(false), storageBlocked = ref(false), inFlight = ref(false)
  const receipt = shallowRef<AiReferenceUploadReceipt | null>(null), receiptProject = shallowRef<AiEditorProject | null>(null), receiptAttached = ref(false)
  const pendingFence = shallowRef<AiReferencePendingFence | null>(null)
  const binding = shallowRef<Binding | null>(null)
  let storage: AiEditorFenceStorage | null | undefined, selectionEpoch = 0, contextEpoch = 0
  let approval: { selected: PreparedLocalReference; binding: Binding; draft: string } | null = null
  let receiptBinding: Binding | null = null
  const knownReceipts = new Map<string, { receipt: AiReferenceUploadReceipt; project: AiEditorProject; binding: Binding }>()
  const busy = computed(() => phase.value === 'preparing' || inFlight.value)
  const project = computed(() => binding.value?.project ?? null)
  function clearApproval() { confirmed.value = false; approval = null }
  function currentContext(value: Binding): AiEditorContext { return { project: value.project, source: value.source } }
  function editorMatches(value = binding.value): boolean { return !!value && editor.matchesReferenceContext(currentContext(value), value.reader, value.saveWriter) }
  function mayBegin(value = binding.value): boolean {
    return !!value && !!value.uploadProvider && !!value.reader && !!value.saveWriter && contextValid.value
      && editor.canBeginReferenceUpload(currentContext(value), value.reader, value.saveWriter)
  }
  const canUpload = computed(() => !!selected.value && isPreparedLocalReference(selected.value) && selected.value.pixelDecoded === true
    && !!binding.value && mayBegin() && !busy.value && !storageBlocked.value && !pendingFence.value
    && (!receipt.value || receiptAttached.value) && confirmed.value && approval?.selected === selected.value
    && approval?.binding === binding.value && approval?.draft === canonical(editor.draft))
  const canAttachReceipt = computed(() => !!receipt.value && !!receiptProject.value && !receiptAttached.value && !busy.value
    && receiptBinding !== null && binding.value === receiptBinding && mayBegin() && !!editor.draft
    && !editor.draft.style.references.includes(receipt.value.relativePath))
  const recoveryMessage = computed(() => receipt.value && !receiptAttached.value
    ? `已保留项目「${receiptProject.value?.name ?? ''}」的上传回执。请回到原项目 ${receiptProject.value?.path ?? ''}，核对 ${receipt.value.relativePath}，明确附入草稿后再确认保存。重载后请在原项目手动核对并填写此路径，不要重复上传。`
    : pendingFence.value && !pendingFence.value.receipt ? unknownMessage : '')
  watch(() => editor.draft, () => {
    clearApproval()
    // An explicit manual reference edit is also a recovery route after reload; never performs that edit itself.
    const wasAttached = receiptAttached.value
    if (receipt.value && receiptProject.value) receiptAttached.value = !!editor.project && projectKey(editor.project) === projectKey(receiptProject.value)
      && !!editor.draft?.style.references.includes(receipt.value.relativePath)
    if (wasAttached && !receiptAttached.value && !storageBlocked.value && ['attached', 'invalidated'].includes(phase.value)) {
      phase.value = 'received'; error.value = receivedMessage
    }
  }, { deep: true, flush: 'sync' })
  watch(() => editor.isOpen, open => { if (!open) leave() }, { flush: 'sync' })
  function getStorage(): AiEditorFenceStorage {
    if (storage === undefined) { try { storage = globalThis.sessionStorage } catch { storage = null } }
    if (!storage) throw Error('storage')
    return storage
  }
  function storageFailure() { storageBlocked.value = true; error.value = storageMessage; clearApproval() }
  function readLedger(): AiReferencePendingFence[] | null {
    try { const entries = readFences(getStorage()); storageBlocked.value = false; return entries }
    catch { storageFailure(); return null }
  }
  function writeLedger(next: AiReferencePendingFence | null, key: string): boolean {
    try {
      const active = getStorage(), entries = readFences(active).filter(item => fenceKey(item.project.id, item.originalSha256) !== key)
      if (next) entries.push(next)
      if (entries.length > maxFences) throw Error('storage')
      const text = JSON.stringify(entries)
      if (new TextEncoder().encode(text).byteLength > maxFenceBytes) throw Error('storage')
      active.setItem(AI_REFERENCE_UPLOAD_FENCE_KEY, text)
      if (active.getItem(AI_REFERENCE_UPLOAD_FENCE_KEY) !== text) throw Error('storage')
      // Parse and verify the persisted representation as well as the byte-for-byte readback.
      readFences(active)
      storageBlocked.value = false
      return true
    } catch { storageFailure(); return false }
  }
  /** Test injection before use only. No user-visible fence-reset operation exists. */
  function setFenceStorage(next: AiEditorFenceStorage | null): boolean {
    if (binding.value || selected.value || inFlight.value || pendingFence.value || receipt.value) return false
    storage = next; return true
  }
  function showReceipt(record: AiReferencePendingFence) {
    if (!record.receipt) return
    const known = knownReceipts.get(fenceKey(record.project.id, record.originalSha256))
    receipt.value = freeze(clone(record.receipt)); receiptProject.value = freeze(clone(record.project)); receiptBinding = known?.binding ?? null
    receiptAttached.value = (!!editor.project && projectKey(editor.project) === projectKey(record.project) && !!editor.draft?.style.references.includes(record.receipt.relativePath))
  }
  function bind(context: AiEditorContext | null, reader: AiResourceReadProvider | null, saveWriter: AiResourceSaveProvider | null, uploadProvider: AiReferenceUploadProvider | null): boolean {
    if (!context || !validProject(context.project) || !context.source || typeof context.source !== 'object'
      || !editor.matchesReferenceContext(context, reader, saveWriter)) { syncContext(context, reader, saveWriter, uploadProvider); return false }
    if (sameBinding(binding.value, context, reader, saveWriter, uploadProvider)) { contextValid.value = true; return true }
    selectionEpoch++; contextEpoch++; clearApproval(); selected.value = null; fileName.value = ''; pendingFence.value = null
    binding.value = { project: freeze({ ...context.project }), source: context.source, reader, saveWriter, uploadProvider }; contextValid.value = true
    if (!inFlight.value) { phase.value = 'idle'; error.value = '' }
    // Preserve original receipt identity if the exact original context is reopened.
    if (receiptBinding && sameBinding(receiptBinding, context, reader, saveWriter, uploadProvider)) binding.value = receiptBinding
    const entries = readLedger()
    if (entries && (!receipt.value || receiptAttached.value)) {
      const recoverable = entries.find(item => item.receipt && projectKey(item.project) === projectKey(context.project)
        && !editor.draft?.style.references.includes(item.receipt.relativePath))
      if (recoverable) { showReceipt(recoverable); phase.value = 'received'; error.value = receivedMessage }
    }
    return true
  }
  function syncContext(context: AiEditorContext | null, reader: AiResourceReadProvider | null, saveWriter: AiResourceSaveProvider | null, uploadProvider: AiReferenceUploadProvider | null) {
    if (sameBinding(binding.value, context, reader, saveWriter, uploadProvider) && editorMatches()) return
    contextEpoch++; selectionEpoch++; clearApproval(); contextValid.value = false
    if (!inFlight.value) phase.value = 'invalidated'
    error.value = contextMessage
  }
  function clearSelection(): boolean {
    selectionEpoch++; clearApproval(); selected.value = null; fileName.value = ''; pendingFence.value = null
    if (!inFlight.value) { phase.value = contextValid.value ? 'idle' : 'invalidated'; error.value = storageBlocked.value ? storageMessage : '' }
    return true
  }
  async function selectFile(file: LocalReferenceFile, options: { decode?: AiReferenceDecode } = {}): Promise<boolean> {
    if (inFlight.value) return false
    clearSelection(); const identity = selectionEpoch, bound = binding.value
    if (!bound || !contextValid.value || !editorMatches(bound)) return false
    phase.value = 'preparing'
    try {
      const prepared = await prepareLocalReference(file, options)
      if (identity !== selectionEpoch || binding.value !== bound || !contextValid.value || !editorMatches(bound)) return false
      if (!isPreparedLocalReference(prepared) || prepared.pixelDecoded !== true) throw new AiReferenceUploadError('decode-failed', 'not-sent')
      selected.value = prepared; fileName.value = typeof file.name === 'string' ? file.name.slice(0,512) : '本地参考图'
      const entries = readLedger()
      if (!entries) { phase.value = 'not-sent'; return true }
      const recorded = entries.find(item => item.project.id === bound.project.id && item.originalSha256 === prepared.sha256) ?? null
      const known = knownReceipts.get(fenceKey(bound.project.id, prepared.sha256))
      // A failed durable receipt update cannot erase the strictly validated success retained in memory.
      pendingFence.value = freeze(recorded && known ? { ...recorded, receipt: known.receipt } : recorded)
      if (pendingFence.value?.receipt) {
        // Never silently replace another successful, unattached receipt in the recovery view.
        if (!receipt.value || receiptAttached.value || receipt.value.originalSha256 === prepared.sha256) showReceipt(pendingFence.value)
        phase.value = 'received'; error.value = '本会话已有该文件的成功上传回执，不会重复上传。请使用已保留路径并另行确认保存配置。'
      } else if (pendingFence.value) { phase.value = 'unknown'; error.value = unknownMessage }
      else { phase.value = 'ready'; error.value = '' }
      return true
    } catch (cause) {
      if (identity !== selectionEpoch) return false
      phase.value = 'not-sent'; error.value = cause instanceof AiReferenceUploadError ? new AiReferenceUploadError(cause.code, 'not-sent').message : '无法安全读取或解码本地图片，未发送请求。'; clearApproval(); return false
    }
  }
  function setConfirmed(value: boolean) {
    clearApproval()
    if (value !== true || !selected.value || !isPreparedLocalReference(selected.value) || selected.value.pixelDecoded !== true || !binding.value
      || !mayBegin() || busy.value || storageBlocked.value || pendingFence.value || receipt.value && !receiptAttached.value) return
    approval = { selected: selected.value, binding: binding.value, draft: canonical(editor.draft) }; confirmed.value = true
  }
  async function upload(context: AiEditorContext, reader: AiResourceReadProvider, saveWriter: AiResourceSaveProvider, uploadProvider: AiReferenceUploadProvider): Promise<boolean> {
    if (!sameBinding(binding.value, context, reader, saveWriter, uploadProvider)) { syncContext(context, reader, saveWriter, uploadProvider); return false }
    if (!canUpload.value || !selected.value || !binding.value) return false
    const bound = binding.value, prepared = selected.value, identity = contextEpoch
    const key = fenceKey(bound.project.id, prepared.sha256), entries = readLedger()
    if (!entries) return false
    const existing = entries.find(item => fenceKey(item.project.id, item.originalSha256) === key)
    if (existing) { pendingFence.value = freeze(existing); phase.value = existing.receipt ? 'received' : 'unknown'; error.value = existing.receipt ? receivedMessage : unknownMessage; clearApproval(); return false }
    const ticket = editor.beginReferenceUpload(context, reader, saveWriter)
    if (!ticket) { clearApproval(); return false }
    const fence: AiReferencePendingFence = freeze({ project: { ...bound.project }, originalSha256: prepared.sha256, mimeType: prepared.mimeType, width: prepared.width, height: prepared.height, receipt: null })
    if (!writeLedger(fence, key)) { editor.finishReferenceUpload(ticket); phase.value = 'not-sent'; return false }
    pendingFence.value = fence; inFlight.value = true; phase.value = 'uploading'; error.value = ''; clearApproval()
    try {
      // Do not abort on UI leave: keep the lease and preserve the eventual receipt until transport settlement.
      const response = await uploadProvider.uploadReference(bound.project.id, { base64: prepared.base64, approved: true })
      const checked = freeze(decodeAiReferenceUploadReceipt(response, prepared))
      const complete = freeze({ ...fence, receipt: checked })
      const persisted = writeLedger(complete, key)
      pendingFence.value = complete; receipt.value = checked; receiptProject.value = bound.project; receiptBinding = bound; receiptAttached.value = false
      const attached = identity === contextEpoch && binding.value === bound && contextValid.value && editorMatches(bound) && editor.appendUploadedReference(ticket, checked.relativePath)
      receiptAttached.value = attached
      knownReceipts.set(key, { receipt: checked, project: bound.project, binding: bound })
      phase.value = attached ? 'attached' : 'received'; error.value = persisted ? (attached ? '参考图已附入当前配置草稿；尚未保存配置，请重新核对并明确确认保存。' : receivedMessage) : storageMessage
      return true
    } catch (cause) {
      const failure = cause instanceof AiReferenceUploadError ? new AiReferenceUploadError(cause.code, cause.outcome) : new AiReferenceUploadError('network-error', 'unknown')
      if (failure.outcome === 'not-sent' || failure.outcome === 'rejected') {
        if (writeLedger(null, key)) { pendingFence.value = null; phase.value = failure.outcome; error.value = failure.message }
        else { pendingFence.value = fence; phase.value = 'unknown' }
      } else { pendingFence.value = fence; phase.value = 'unknown'; error.value = unknownMessage }
      return false
    } finally {
      clearApproval()
      try {
        // The public timeout result can precede real fetch/read/cancellation settlement. Hold both locks until that boundary.
        await uploadProvider.waitForIdle()
        inFlight.value = false; editor.finishReferenceUpload(ticket)
      } catch {
        storageBlocked.value = true; error.value = '无法确认上传底层操作已经结束；已保留上传与配置保存锁。回执及待核对记录仍保留，请在原项目本机核对。'
      }
    }
  }
  function appendRetainedReceipt(confirm: boolean): boolean {
    if (confirm !== true || !canAttachReceipt.value || !binding.value || !receipt.value || !binding.value.reader || !binding.value.saveWriter) return false
    const bound = binding.value, ticket = editor.beginReferenceUpload(currentContext(bound), bound.reader!, bound.saveWriter!)
    if (!ticket) return false
    try {
      if (!editor.appendUploadedReference(ticket, receipt.value.relativePath)) return false
      receiptAttached.value = true
      phase.value = 'attached'; error.value = '参考图已明确附入当前配置草稿；配置仍需另行确认保存。'; return true
    } finally { editor.finishReferenceUpload(ticket); clearApproval() }
  }
  function leave() { contextEpoch++; selectionEpoch++; contextValid.value = false; clearApproval(); if (!inFlight.value) phase.value = 'invalidated' }
  return { selected, fileName, phase, error, confirmed, contextValid, storageBlocked, busy, project, pendingFence,
    receipt, receiptProject, receiptAttached, canUpload, canAttachReceipt, recoveryMessage,
    setFenceStorage, bind, syncContext, selectFile, clearSelection, setConfirmed, upload, appendRetainedReceipt, leave }
})
