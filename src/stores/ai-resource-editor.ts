import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { AiResourceReadError, decodeAiResourceView, isAiProjectId, isAiReferencePath } from '../domain/ai-resource-read'
import type { AiResourceConfigV2, AiResourceDraft, AiResourceReadProvider, AiResourceView } from '../domain/ai-resource-read'
import { AiResourceSaveError, aiResourceConfigChanges, aiResourceConfigsEqual, validateAiResourceConfigV2 } from '../domain/ai-resource-save'
import type { AiResourceSaveProvider } from '../domain/ai-resource-save'

export interface AiEditorProject { id: string; name: string; path: string }
export interface AiEditorContext { project: AiEditorProject; source: object }
/** Opaque, identity-checked lease; callers cannot manufacture upload authority. */
export type AiReferenceUploadLease = Readonly<{ readonly kind: 'ai-reference-upload' }>
export interface AiEditorFenceStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface AiEditorPendingFence { id: string; expectedHash: string | null; expectedVersion: number; targetCanonicalDigest: string }
export type AiEditorPhase = 'closed' | 'editing' | 'preparing' | 'saving' | 'saved' | 'not-sent' | 'rejected' | 'conflict' | 'unknown' | 'reconciling' | 'observed-matching' | 'conflict-current' | 'invalidated'
export const AI_EDITOR_FENCE_KEY = 'companion.ai-resource-save.pending.v1'
const maxFences = 32, maxFenceBytes = 16_384, sha = /^[a-f0-9]{64}$/
const storageMessage = '无法可靠保存或读取本会话的待核对记录；为避免重复写入，已阻止保存。表单仍可编辑。'
const unknownMessage = '保存结果未知。请明确重新读取核对；停止等待或离开页面不会撤销已发送的请求。'
const contextMessage = '项目、读取来源或保存来源已变化；已保护当前草稿，不能把它保存到另一个上下文。'
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
function editorDraft(view: AiResourceView): AiResourceDraft { return { ...clone(view.draft), version: view.version ?? 1 } }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
async function digest(config: AiResourceConfigV2): Promise<string> {
  const bytes = new TextEncoder().encode(canonical(config))
  const result = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, '0')).join('')
}
function readFences(storage: AiEditorFenceStorage): AiEditorPendingFence[] {
  const text = storage.getItem(AI_EDITOR_FENCE_KEY)
  if (text === null) return []
  if (text.length > maxFenceBytes) throw Error('storage')
  const value: unknown = JSON.parse(text)
  if (!Array.isArray(value) || value.length > maxFences) throw Error('storage')
  const ids = new Set<string>()
  return value.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('storage')
    const keys = Object.keys(raw), item = raw as AiEditorPendingFence
    if (keys.length !== 4 || keys.some(key => !['id', 'expectedHash', 'expectedVersion', 'targetCanonicalDigest'].includes(key))
      || !isAiProjectId(item.id) || ids.has(item.id) || item.expectedHash !== null && (typeof item.expectedHash !== 'string' || !sha.test(item.expectedHash))
      || !Number.isSafeInteger(item.expectedVersion) || item.expectedVersion < 1 || typeof item.targetCanonicalDigest !== 'string' || !sha.test(item.targetCanonicalDigest)) throw Error('storage')
    ids.add(item.id)
    return { id: item.id, expectedHash: item.expectedHash, expectedVersion: item.expectedVersion, targetCanonicalDigest: item.targetCanonicalDigest }
  })
}
function validContext(value: AiEditorContext): boolean {
  return !!value?.source && typeof value.source === 'object' && !!value.project && isAiProjectId(value.project.id)
    && typeof value.project.name === 'string' && typeof value.project.path === 'string' && !!value.project.path
}
function savedProjection(view: AiResourceView): AiResourceConfigV2 | null {
  if (!view.config) return null
  if (view.config.schemaVersion === 'project-resource-config-v2') return clone(view.config)
  const config = view.config
  return { ...clone(view.draft), designResolution: clone(config.designResolution), orientation: config.orientation }
}

/** A form snapshot is bound to the entire project and both provider identities. No implicit saves or retries. */
export const useAiResourceEditorStore = defineStore('ai-resource-editor', () => {
  const isOpen = ref(false), draft = ref<AiResourceDraft | null>(null), base = shallowRef<AiResourceView | null>(null)
  const project = shallowRef<AiEditorProject | null>(null), phase = ref<AiEditorPhase>('closed'), error = ref('')
  const confirmed = ref(false), storageBlocked = ref(false), contextValid = ref(false)
  const observedCurrent = shallowRef<AiResourceView | null>(null), reconciliation = ref<'none' | 'unchanged' | 'observed-matching' | 'conflict-current'>('none')
  const pendingFence = shallowRef<AiEditorPendingFence | null>(null)
  const referenceLease = shallowRef<{ ticket: AiReferenceUploadLease; epoch: number; references: string } | null>(null)
  const referenceUploadActive = computed(() => referenceLease.value !== null)
  let boundSource: object | null = null, reader: AiResourceReadProvider | null = null, writer: AiResourceSaveProvider | null = null
  let storage: AiEditorFenceStorage | null | undefined, epoch = 0, revision = 0, confirmationRevision = -1
  let controller: AbortController | undefined
  // A verified stale rejection is knowledge about this exact in-memory request, never inferred from UI phase or persisted across reload.
  let knownConflict: { fence: string; project: string; source: object; reader: AiResourceReadProvider; writer: AiResourceSaveProvider } | null = null
  function hasKnownConflict(): boolean {
    return !!knownConflict && !!pendingFence.value && knownConflict.fence === canonical(pendingFence.value)
      && knownConflict.project === canonical(project.value) && knownConflict.source === boundSource
      && knownConflict.reader === reader && knownConflict.writer === writer
  }
  const busy = computed(() => ['preparing', 'saving', 'reconciling'].includes(phase.value))
  const mode = computed<'create' | 'migrate' | 'edit'>(() => base.value?.state === 'missing' ? 'create' : base.value?.migrationRequired ? 'migrate' : 'edit')
  const dirty = computed(() => !!draft.value && !!base.value && canonical(draft.value) !== canonical(editorDraft(base.value)))
  const errors = computed(() => {
    const problems: string[] = [], current = base.value, value = draft.value, target = project.value
    if (!current || !value || !target) return ['请先读取当前项目的 AI 配置。']
    if (value.projectId !== target.id || value.schemaVersion !== 'project-resource-config-v2' || value.version !== (current.version ?? 1)) problems.push('项目标识、配置格式及原始版本不可修改。')
    if (current.detected.designResolution && (canonical(value.designResolution) !== canonical(current.detected.designResolution) || value.orientation !== current.draft.orientation)) problems.push('检测到的设计分辨率和方向已锁定，请重新读取项目。')
    try { validateAiResourceConfigV2(value, target.id) } catch { problems.push('请检查图标尺寸、风格描述、参考路径、背景颜色、留白及输出目录；配置尚未通过 v2 校验。') }
    if (current.version !== null && current.version >= Number.MAX_SAFE_INTEGER) problems.push('配置版本超出可安全递增范围。')
    return problems
  })
  const diff = computed(() => {
    if (!draft.value || !base.value) return []
    try {
      if (errors.value.length) return []
      const proposed = validateAiResourceConfigV2(draft.value, project.value!.id)
      const changes = aiResourceConfigChanges(savedProjection(base.value), proposed)
      if (base.value.migrationRequired) {
        const additions = ['iconSize.width', 'iconSize.height', 'background.color', 'destination.exportDirectory'] as const
        const all = aiResourceConfigChanges(null, proposed)
        for (const field of additions) {
          const change = all.find(item => item.field === field)!
          const existing = changes.find(item => item.field === field)
          if (existing) existing.before = '（v2 新增，原配置未保存此字段）'
          else changes.push({ ...change, before: '（v2 新增，原配置未保存此字段）' })
        }
      }
      return changes
    } catch { return [] }
  })
  const blockedPhase = () => ['conflict', 'unknown', 'observed-matching', 'conflict-current', 'invalidated'].includes(phase.value)
  const canSave = computed(() => isOpen.value && contextValid.value && !!writer && !busy.value && !blockedPhase()
    && !referenceUploadActive.value && !pendingFence.value && !storageBlocked.value && errors.value.length === 0 && (mode.value !== 'edit' || base.value?.state !== 'valid' || diff.value.length > 0) && confirmed.value && confirmationRevision === revision)
  watch(draft, () => { revision++; confirmed.value = false; confirmationRevision = -1; if (phase.value === 'saved') phase.value = 'editing'
    if (draft.value?.designResolution && !base.value?.detected.designResolution) { const { width, height } = draft.value.designResolution; const direction = width === height ? 'square' : width < height ? 'portrait' : 'landscape'; if (width > 0 && height > 0 && draft.value.orientation !== direction) draft.value.orientation = direction }
  }, { deep: true, flush: 'sync' })
  function getStorage(): AiEditorFenceStorage {
    if (storage === undefined) { try { storage = globalThis.sessionStorage } catch { storage = null } }
    if (!storage) throw Error('storage')
    return storage
  }
  function storageFailure() { storageBlocked.value = true; error.value = storageMessage }
  function loadFence(id: string): boolean {
    if (pendingFence.value?.id !== id) { pendingFence.value = null; knownConflict = null }
    try { pendingFence.value = freeze(readFences(getStorage()).find(item => item.id === id) ?? null); if (!hasKnownConflict()) knownConflict = null; storageBlocked.value = false; return true }
    catch { storageFailure(); return false }
  }
  function writeFence(next: AiEditorPendingFence | null, id: string): boolean {
    try {
      const active = getStorage(), entries = readFences(active).filter(item => item.id !== id)
      if (next) entries.push(next)
      if (entries.length > maxFences) throw Error('storage')
      const serialized = JSON.stringify(entries)
      active.setItem(AI_EDITOR_FENCE_KEY, serialized)
      if (active.getItem(AI_EDITOR_FENCE_KEY) !== serialized) throw Error('storage')
      pendingFence.value = freeze(next); knownConflict = null; storageBlocked.value = false; return true
    } catch { storageFailure(); return false }
  }
  /** Test injection, before opening a form only. Never accepts config or credentials. */
  function setFenceStorage(next: AiEditorFenceStorage | null) { if (base.value || busy.value || pendingFence.value) return false; storage = next; return true }
  function matches(context: AiEditorContext | null, nextReader?: AiResourceReadProvider | null, nextWriter?: AiResourceSaveProvider | null): boolean {
    return !!context && validContext(context) && context.source === boundSource && canonical(context.project) === canonical(project.value)
      && (nextReader === undefined || nextReader === reader) && (nextWriter === undefined || nextWriter === writer)
  }
  function invalidateContext(context: AiEditorContext | null, nextReader?: AiResourceReadProvider | null, nextWriter?: AiResourceSaveProvider | null) {
    if (!base.value || matches(context, nextReader, nextWriter)) return
    const wasSaving = phase.value === 'saving'
    if (context && (context.source !== boundSource || canonical(context.project) !== canonical(project.value))
      || nextReader !== undefined && nextReader !== reader || nextWriter !== undefined && nextWriter !== writer) knownConflict = null
    epoch++; controller?.abort(); controller = undefined; contextValid.value = false; confirmed.value = false; confirmationRevision = -1
    observedCurrent.value = null; reconciliation.value = 'none'
    phase.value = wasSaving || pendingFence.value ? 'unknown' : 'invalidated'
    error.value = wasSaving || pendingFence.value ? `${contextMessage} ${unknownMessage}` : contextMessage
  }
  function open(context: AiEditorContext, resource: AiResourceView, nextReader: AiResourceReadProvider, nextWriter?: AiResourceSaveProvider | null): boolean {
    if (busy.value || isOpen.value || referenceUploadActive.value) return false
    if (!validContext(context)) { error.value = contextMessage; return false }
    let checked: AiResourceView
    try { checked = decodeAiResourceView(resource, context.project.id) } catch { error.value = '必须从当前项目的有效读取响应打开编辑器。'; return false }
    if (base.value && draft.value && matches(context, nextReader, nextWriter ?? null)) {
      isOpen.value = true; confirmed.value = false; confirmationRevision = -1
      if (pendingFence.value) { contextValid.value = true; phase.value = hasKnownConflict() ? 'conflict' : 'unknown'; error.value = hasKnownConflict() ? new AiResourceSaveError('stale', 'conflict').message : unknownMessage }
      else if (canonical(base.value) === canonical(checked)) { contextValid.value = true; phase.value = 'editing'; error.value = '' }
      else { contextValid.value = true; observedCurrent.value = freeze(checked); reconciliation.value = 'conflict-current'; phase.value = 'conflict-current'; error.value = '重新读取发现当前文件已变化；保留的草稿未被替换。核对并确认替换草稿后才可采用当前配置。' }
      return true
    }
    if (draft.value && (dirty.value || pendingFence.value)) return false
    epoch++; controller?.abort(); controller = undefined
    boundSource = context.source; reader = nextReader; writer = nextWriter ?? null; project.value = Object.freeze({ ...context.project })
    base.value = freeze(checked); draft.value = editorDraft(checked); contextValid.value = true; confirmed.value = false; confirmationRevision = -1
    observedCurrent.value = null; reconciliation.value = 'none'; error.value = ''; isOpen.value = true; phase.value = 'editing'
    if (loadFence(context.project.id) && pendingFence.value) { phase.value = 'unknown'; error.value = unknownMessage }
    return true
  }
  function updateDraft(next: AiResourceDraft | ((value: AiResourceDraft) => void)): boolean {
    if (!draft.value) return false
    if (typeof next === 'function') next(draft.value)
    else draft.value = clone(next)
    return true
  }
  function setConfirmed(value: boolean) {
    confirmed.value = value === true && !!draft.value && contextValid.value && !busy.value && !referenceUploadActive.value && !blockedPhase() && !pendingFence.value && !errors.value.length && !storageBlocked.value
    confirmationRevision = confirmed.value ? revision : -1
  }
  async function save(context: AiEditorContext, nextReader: AiResourceReadProvider, nextWriter: AiResourceSaveProvider): Promise<boolean> {
    if (!matches(context, nextReader, nextWriter)) { invalidateContext(context, nextReader, nextWriter); return false }
    if (!canSave.value || !base.value || !draft.value || !project.value || !writer) return false
    const identity = epoch, editRevision = revision, target = project.value, original = base.value, transport = writer
    const config = validateAiResourceConfigV2(draft.value, target.id), expectedVersion = (original.version ?? 0) + 1
    phase.value = 'preparing'; error.value = ''; knownConflict = null
    let proposedDigest: string
    try { proposedDigest = await digest({ ...config, version: expectedVersion }) }
    catch { if (identity === epoch) { phase.value = 'not-sent'; error.value = '当前浏览器无法校验保存目标摘要，未发送请求。'; confirmed.value = false }; return false }
    if (identity !== epoch || editRevision !== revision || referenceUploadActive.value || !confirmed.value || !matches(context, nextReader, nextWriter)) {
      if (identity === epoch) { phase.value = 'editing'; confirmed.value = false }
      return false
    }
    // A reload fence is durable before transport invocation. Existing pending work is never overwritten.
    if (!loadFence(target.id) || pendingFence.value) {
      if (pendingFence.value) { phase.value = 'unknown'; error.value = unknownMessage } else phase.value = 'not-sent'
      confirmed.value = false; return false
    }
    const fence: AiEditorPendingFence = { id: target.id, expectedHash: original.hash, expectedVersion, targetCanonicalDigest: proposedDigest }
    if (!writeFence(fence, target.id)) { phase.value = 'not-sent'; confirmed.value = false; return false }
    const requestController = new AbortController(); controller = requestController; phase.value = 'saving'; confirmed.value = false; confirmationRevision = -1
    try {
      const response = await transport.saveConfig(target.id, { config, expectedHash: original.hash, approved: true }, requestController.signal)
      if (identity !== epoch) return false
      let checked: AiResourceView
      try {
        checked = decodeAiResourceView(response, target.id)
        if (checked.state !== 'valid' || checked.migrationRequired || checked.hash === null || checked.hash === original.hash
          || checked.version !== expectedVersion || checked.config?.schemaVersion !== 'project-resource-config-v2'
          || !aiResourceConfigsEqual(checked.config, { ...config, version: expectedVersion })
          || canonical(checked.detected.designResolution) !== canonical(original.detected.designResolution)) throw Error('invalid')
      } catch { throw new AiResourceSaveError('invalid-shape', 'unknown') }
      if (!writeFence(null, target.id)) { phase.value = 'unknown'; return false }
      base.value = freeze(checked)
      // A form can remain editable while awaiting the server. Never discard a newer local edit.
      if (revision === editRevision) draft.value = editorDraft(checked)
      else if (draft.value) draft.value.version = checked.version ?? expectedVersion
      phase.value = dirty.value ? 'editing' : 'saved'; error.value = dirty.value ? '已确认提交的配置保存成功；等待期间的较新草稿修改仍未保存。' : '已确认保存成功。'; observedCurrent.value = null; reconciliation.value = 'none'; return true
    } catch (cause) {
      if (identity !== epoch) return false
      const failure = cause instanceof AiResourceSaveError ? new AiResourceSaveError(cause.code, cause.outcome) : new AiResourceSaveError('network-error', 'unknown')
      phase.value = failure.outcome; error.value = failure.message
      if (failure.code === 'stale' && failure.outcome === 'conflict' && pendingFence.value && boundSource && reader && writer) {
        knownConflict = { fence: canonical(pendingFence.value), project: canonical(project.value), source: boundSource, reader, writer }
      }
      if (failure.outcome === 'not-sent' || failure.outcome === 'rejected') {
        if (!writeFence(null, target.id)) phase.value = 'unknown'
      }
      return false
    } finally { if (identity === epoch) controller = undefined }
  }
  async function reconcile(context: AiEditorContext, nextReader: AiResourceReadProvider, nextWriter?: AiResourceSaveProvider | null): Promise<boolean> {
    if (!matches(context, nextReader, nextWriter)) { invalidateContext(context, nextReader, nextWriter); return false }
    if (!contextValid.value || busy.value || !pendingFence.value || !project.value || !reader) return false
    const identity = epoch, target = project.value, fence = pendingFence.value, source = reader, previous = phase.value
    const requestController = new AbortController(); controller = requestController; phase.value = 'reconciling'; confirmed.value = false
    observedCurrent.value = null; reconciliation.value = 'none'; error.value = ''
    try {
      const response = await source.readConfig(target.id, requestController.signal)
      if (identity !== epoch) return false
      const checked = decodeAiResourceView(response, target.id)
      let matching = false
      if (checked.state === 'valid' && checked.config?.schemaVersion === 'project-resource-config-v2' && checked.version === fence.expectedVersion) {
        matching = await digest(validateAiResourceConfigV2(checked.config, target.id)) === fence.targetCanonicalDigest
      }
      if (identity !== epoch) return false
      observedCurrent.value = freeze(checked)
      if (matching) { phase.value = 'observed-matching'; reconciliation.value = 'observed-matching'; error.value = '已读到与目标内容和版本一致的配置；这不证明是本次请求保存。确认替换草稿后才可采用此版本。' }
      else if (checked.hash === fence.expectedHash && !hasKnownConflict()) { phase.value = 'unknown'; reconciliation.value = 'unchanged'; error.value = '当前仍是原始内容；先前请求仍可能完成，不能据此重试或清除保护。' }
      else { phase.value = 'conflict-current'; reconciliation.value = 'conflict-current'; error.value = '已读到另一份当前配置。核对后明确确认替换草稿，才可采用新的保存基线。' }
      return true
    } catch (cause) {
      if (identity === epoch) { phase.value = previous; error.value = cause instanceof AiResourceReadError ? new AiResourceReadError(cause.code).message : '重新读取未完成；待核对保护和当前草稿均已保留。' }
      return false
    } finally { if (identity === epoch) controller = undefined }
  }
  function adoptCurrent(confirmDiscard: boolean): boolean {
    if (confirmDiscard !== true || busy.value || referenceUploadActive.value || !contextValid.value || !observedCurrent.value || !project.value
      || !['observed-matching', 'conflict-current'].includes(reconciliation.value)) return false
    if (!writeFence(null, project.value.id)) return false
    base.value = freeze(clone(observedCurrent.value)); draft.value = editorDraft(observedCurrent.value)
    observedCurrent.value = null; reconciliation.value = 'none'; phase.value = 'editing'; confirmed.value = false; confirmationRevision = -1; error.value = ''
    return true
  }
  function close(confirmDiscard = false): boolean {
    if (!confirmDiscard && (dirty.value || busy.value || referenceUploadActive.value || pendingFence.value)) return false
    epoch++; controller?.abort(); controller = undefined; isOpen.value = false; confirmed.value = false; confirmationRevision = -1
    if (confirmDiscard) { knownConflict = null; draft.value = null; base.value = null; project.value = null; boundSource = null; reader = null; writer = null; contextValid.value = false; observedCurrent.value = null; reconciliation.value = 'none' }
    phase.value = pendingFence.value ? 'unknown' : 'closed'; return true
  }
  /** Read-only binding check, also usable by the local-preview-only panel. */
  function matchesReferenceContext(context: AiEditorContext | null, nextReader: AiResourceReadProvider | null, nextWriter: AiResourceSaveProvider | null): boolean {
    return isOpen.value && contextValid.value && !!base.value && !!draft.value && matches(context, nextReader, nextWriter)
  }
  function validReferenceDraft(): boolean {
    const value = draft.value, current = base.value, target = project.value
    if (!value || !current || !target || value.projectId !== target.id || value.schemaVersion !== 'project-resource-config-v2'
      || value.version !== (current.version ?? 1) || !Array.isArray(value.style?.references)) return false
    const references = value.style.references
    return references.length <= 4 && references.every(isAiReferencePath) && new Set(references).size === references.length
      && (!current.detected.designResolution || canonical(value.designResolution) === canonical(current.detected.designResolution) && value.orientation === current.draft.orientation)
  }
  function canBeginReferenceUpload(context: AiEditorContext | null, nextReader: AiResourceReadProvider | null, nextWriter: AiResourceSaveProvider | null): boolean {
    return !!nextReader && !!nextWriter && matchesReferenceContext(context, nextReader, nextWriter) && !referenceUploadActive.value
      && !busy.value && !blockedPhase() && !pendingFence.value && !storageBlocked.value && validReferenceDraft()
      && !!draft.value && draft.value.style.references.length < 4
  }
  function beginReferenceUpload(context: AiEditorContext, nextReader: AiResourceReadProvider, nextWriter: AiResourceSaveProvider): AiReferenceUploadLease | null {
    if (!canBeginReferenceUpload(context, nextReader, nextWriter)) return null
    const ticket: AiReferenceUploadLease = Object.freeze({ kind: 'ai-reference-upload' })
    referenceLease.value = { ticket, epoch, references: canonical(draft.value!.style.references) }
    confirmed.value = false; confirmationRevision = -1
    return ticket
  }
  function matchesReferenceUpload(ticket: AiReferenceUploadLease): boolean {
    return !!referenceLease.value && referenceLease.value.ticket === ticket && referenceLease.value.epoch === epoch && isOpen.value && contextValid.value
      && !!draft.value && !busy.value && !blockedPhase() && !pendingFence.value && !storageBlocked.value && validReferenceDraft()
      && referenceLease.value.references === canonical(draft.value.style.references)
  }
  /** Mutates only this still-bound form; a receipt never constitutes config-save approval. */
  function appendUploadedReference(ticket: AiReferenceUploadLease, relativePath: string): boolean {
    if (!matchesReferenceUpload(ticket) || !draft.value || !isAiReferencePath(relativePath)
      || draft.value.style.references.length >= 4 || draft.value.style.references.includes(relativePath)) return false
    draft.value.style.references.push(relativePath)
    return true
  }
  /** Closing/invalidation never calls this: the actual transport owner releases only on settlement. */
  function finishReferenceUpload(ticket: AiReferenceUploadLease): boolean {
    if (referenceLease.value?.ticket !== ticket) return false
    referenceLease.value = null
    return true
  }
  /** Displays a protected draft even when a different project is selected; grants no write authority. */
  function showRetained(): boolean { if (!draft.value || !base.value) return false; isOpen.value = true; return true }
  /** Page teardown is an invalidation, never a successful cancellation or a fence reset. */
  function leave() { invalidateContext(null); isOpen.value = false }
  return { isOpen, draft, base, project, phase, error, confirmed, storageBlocked, contextValid, observedCurrent, reconciliation, pendingFence,
    busy, mode, dirty, errors, diff, canSave, referenceUploadActive, matchesReferenceContext, canBeginReferenceUpload, beginReferenceUpload, matchesReferenceUpload, appendUploadedReference, finishReferenceUpload, setFenceStorage, open, updateDraft, setConfirmed, save, reconcile, adoptCurrent,
    invalidateContext, syncContext: invalidateContext, close, leave, showRetained }
})
