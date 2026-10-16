import { computed, ref, shallowRef, toRaw, triggerRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { isKnowledgeRequestId } from '../domain/knowledge-read'
import { KnowledgeConversationError, decodeKnowledgeConversationReply, normalizeKnowledgeConversationRequest } from '../domain/knowledge-conversation'
import type { KnowledgeConversationProvider, KnowledgeConversationReply, KnowledgeConversationRequest } from '../domain/knowledge-conversation'

export type KnowledgeConversationPhase = 'idle' | 'prepared' | 'sending' | 'succeeded' | 'not-dispatched' | 'rejected' | 'unknown' | 'invalidated'
export type KnowledgeConversationTurnStatus = 'sending' | 'succeeded' | 'not-dispatched' | 'rejected' | 'unknown'
export interface KnowledgeConversationContext {
  provider: KnowledgeConversationProvider | null
  readIdentity: object | null
  /** Must be the explicit or already-read default KB. Never resolved during dispatch. */
  kbId: string
  /** Local isolation only. This value is never sent to the provider. */
  scopeKey: string
  ready: boolean
}
export interface PreparedKnowledgeConversation {
  readonly query: string
  readonly kbId: string
  readonly sessionId: string | null
  readonly providerLabel: string
  readonly scopeKey: string
  readonly revision: number
}
export interface KnowledgeConversationTurn {
  readonly id: number
  readonly generation: number
  readonly query: string
  readonly kbId: string
  readonly scopeKey: string
  readonly providerLabel: string
  readonly requestSessionId: string | null
  readonly sessionId: string | null
  readonly status: KnowledgeConversationTurnStatus
  readonly answer: string | null
  readonly references: ReadonlyArray<Readonly<KnowledgeConversationReply['references'][number]>>
  readonly detached: boolean
  readonly error: string
  readonly errorCode: string | null
}
export const KNOWLEDGE_CONVERSATION_STORE_LIMITS = Object.freeze({ maxTurns: 20, maxBytes: 2 * 1024 * 1024, maxTurnBytes: 256 * 1024, maxScopeLength: 16_384 })
const unknownMessage = '本次会话结果未知，问题可能已经发送；原会话与发送记录已保留。请先核对原会话，不能自动重发或继续该会话。'
const capacityMessage = '本地会话记录已达到容量限制。请明确清除已完成记录后再提问；结果未知的记录不会被清除。'
const contextMessage = '知识库、读取来源或本地隔离范围已变化；旧记录已脱离当前会话，不能继续采用旧会话标识。'
const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
interface Binding extends KnowledgeConversationContext { providerLabel: string }
interface Approval { binding: Binding; generation: number; revision: number; queryRevision: number; request: KnowledgeConversationRequest }
interface Operation { id: number; generation: number; binding: Binding; controller: AbortController; cancelled: boolean; settled: boolean }
function sameContext(a: Binding | null, b: Binding): boolean {
  return !!a && a.provider === b.provider && a.readIdentity === b.readIdentity && a.kbId === b.kbId
    && a.scopeKey === b.scopeKey && a.providerLabel === b.providerLabel
}
function validContext(value: Binding | null): value is Binding & { provider: KnowledgeConversationProvider } {
  return !!value?.provider && typeof value.provider.chat === 'function' && typeof value.provider.waitForIdle === 'function'
    && !!value.readIdentity && typeof value.readIdentity === 'object' && value.ready === true && isKnowledgeRequestId(value.kbId)
    && typeof value.scopeKey === 'string' && value.scopeKey.length > 0 && value.scopeKey.length <= KNOWLEDGE_CONVERSATION_STORE_LIMITS.maxScopeLength
    && typeof value.providerLabel === 'string' && value.providerLabel.length <= 512
}

/** In-memory only. A preview is an opaque one-use identity, never authorization by itself. */
export const useKnowledgeConversationStore = defineStore('knowledge-conversation', () => {
  const query = ref(''), phase = ref<KnowledgeConversationPhase>('idle'), error = ref('')
  const session = ref<string | null>(null), pending = ref(false), blocked = ref(false), revision = ref(0)
  const records = shallowRef<readonly KnowledgeConversationTurn[]>(Object.freeze([]))
  const preview = shallowRef<PreparedKnowledgeConversation | null>(null)
  const binding = shallowRef<Binding | null>(null)
  const approvals = new WeakMap<PreparedKnowledgeConversation, Approval>()
  let generation = 0, nextId = 1, queryRevision = 0, operation: Operation | null = null
  const retainedBytes = computed(() => byteLength(records.value))
  const capacityAvailable = computed(() => records.value.length < KNOWLEDGE_CONVERSATION_STORE_LIMITS.maxTurns
    && retainedBytes.value + KNOWLEDGE_CONVERSATION_STORE_LIMITS.maxTurnBytes <= KNOWLEDGE_CONVERSATION_STORE_LIMITS.maxBytes)
  const busy = computed(() => phase.value === 'sending')
  const canPrepare = computed(() => validContext(binding.value) && !pending.value && !blocked.value && capacityAvailable.value && query.value.trim().length > 0)
  const completedCount = computed(() => records.value.filter(record => !['sending', 'unknown'].includes(record.status)).length)
  function revoke() {
    if (preview.value) approvals.delete(preview.value)
    preview.value = null; revision.value++
  }
  watch(query, () => {
    queryRevision++; revoke()
    if (phase.value === 'prepared') phase.value = 'idle'
  }, { flush: 'sync' })
  function replaceRecord(id: number, changes: Partial<KnowledgeConversationTurn>) {
    records.value = Object.freeze(records.value.map(record => record.id === id ? freeze({ ...record, ...changes }) : record))
  }
  function isCurrent(op: Operation) { return binding.value === op.binding && generation === op.generation }
  function markUnknown(op: Operation) {
    replaceRecord(op.id, { status: 'unknown', error: unknownMessage, errorCode: 'aborted' })
    if (isCurrent(op)) { blocked.value = true; phase.value = 'unknown'; error.value = unknownMessage }
  }
  function cancel(): boolean {
    if (!operation || operation.cancelled || operation.settled) return false
    operation.cancelled = true; markUnknown(operation); revoke(); operation.controller.abort(); return true
  }
  function detachCurrent() {
    cancel()
    records.value = Object.freeze(records.value.map(record => record.generation === generation && !record.detached ? freeze({ ...record, detached: true }) : record))
    generation++; session.value = null; revoke()
  }
  function syncContext(context: KnowledgeConversationContext) {
    const next: Binding = {
      provider: context.provider ? toRaw(context.provider) : null,
      readIdentity: context.readIdentity ? toRaw(context.readIdentity) : null,
      kbId: typeof context.kbId === 'string' ? context.kbId.trim() : '',
      scopeKey: context.scopeKey, ready: context.ready === true,
      providerLabel: context.provider?.label ?? '',
    }
    if (sameContext(binding.value, next)) {
      // A status read suspends new sends but is not a new conversation. Keep
      // the object identity held by an in-flight operation and its UNKNOWN fence.
      if (binding.value!.ready !== next.ready) {
        binding.value!.ready = next.ready
        triggerRef(binding)
        revoke()
        if (phase.value === 'prepared') phase.value = next.ready ? 'idle' : 'invalidated'
      }
      return
    }
    const hadContext = binding.value !== null
    detachCurrent(); binding.value = next
    phase.value = validContext(next) ? (blocked.value ? 'unknown' : 'idle') : 'invalidated'
    error.value = hadContext ? contextMessage : ''
  }
  function prepareSend(): PreparedKnowledgeConversation | null {
    revoke()
    if (pending.value || blocked.value) return null
    if (!capacityAvailable.value) { error.value = capacityMessage; return null }
    const current = binding.value
    if (!validContext(current)) { phase.value = 'invalidated'; error.value = '请先读取并明确当前知识库和来源，再准备发送。'; return null }
    try {
      const request = freeze(normalizeKnowledgeConversationRequest({ query: query.value, kbId: current.kbId, ...(session.value ? { sessionId: session.value } : {}) }))
      const prepared = freeze({ query: request.query, kbId: current.kbId, sessionId: request.sessionId ?? null, providerLabel: current.providerLabel, scopeKey: current.scopeKey, revision: revision.value })
      approvals.set(prepared, { binding: current, generation, revision: revision.value, queryRevision, request })
      preview.value = prepared; phase.value = 'prepared'; error.value = ''; return prepared
    } catch { phase.value = 'not-dispatched'; error.value = '问题或知识库标识不符合要求，请修改后重新确认；没有发送请求。'; return null }
  }
  async function send(prepared: PreparedKnowledgeConversation | null, confirmed: boolean): Promise<boolean> {
    if (confirmed !== true || !prepared || prepared !== preview.value || pending.value || blocked.value || !capacityAvailable.value) return false
    const approval = approvals.get(prepared), current = binding.value
    if (!approval || !validContext(current) || approval.binding !== current || approval.generation !== generation
      || approval.revision !== revision.value || approval.queryRevision !== queryRevision) return false
    // Consume the identity synchronously before invoking any provider code.
    revoke()
    const op: Operation = { id: nextId++, generation, binding: current, controller: new AbortController(), cancelled: false, settled: false }
    operation = op; pending.value = true; phase.value = 'sending'; error.value = ''
    const record: KnowledgeConversationTurn = freeze({
      id: op.id, generation, query: approval.request.query, kbId: prepared.kbId, scopeKey: prepared.scopeKey, providerLabel: prepared.providerLabel,
      requestSessionId: approval.request.sessionId ?? null, sessionId: null,
      status: 'sending', answer: null, references: [], detached: false, error: '', errorCode: null,
    })
    records.value = Object.freeze([...records.value, record])
    let succeeded = false
    const cancelled = Symbol('cancelled')
    let onAbort: (() => void) | undefined
    const cancellation = new Promise<typeof cancelled>(resolve => {
      onAbort = () => resolve(cancelled); op.controller.signal.addEventListener('abort', onAbort, { once: true })
    })
    try {
      const result = await Promise.race([current.provider.chat(approval.request, op.controller.signal), cancellation])
      if (result === cancelled || op.cancelled) { markUnknown(op) }
      else {
        const reply = freeze(decodeKnowledgeConversationReply(result))
        const complete = freeze({ ...record, status: 'succeeded' as const, sessionId: reply.sessionId, answer: reply.answer, references: reply.references })
        if (byteLength(complete) > KNOWLEDGE_CONVERSATION_STORE_LIMITS.maxTurnBytes) throw new KnowledgeConversationError('response-too-large', 'unknown')
        replaceRecord(op.id, { status: complete.status, sessionId: complete.sessionId, answer: complete.answer, references: complete.references, error: '', errorCode: null })
        succeeded = true
        if (isCurrent(op)) {
          session.value = reply.sessionId; phase.value = 'succeeded'; error.value = ''
          // Edits made while sending, including A → B → A, are the user's next draft.
          if (queryRevision === approval.queryRevision) query.value = ''
        }
      }
    } catch (cause) {
      const failure = cause instanceof KnowledgeConversationError ? new KnowledgeConversationError(cause.code, cause.outcome, cause.backendCode)
        : new KnowledgeConversationError('network-error', 'unknown')
      const outcome = op.cancelled ? 'unknown' : failure.outcome
      const message = outcome === 'unknown' ? unknownMessage : outcome === 'rejected'
        ? '本次提问被明确拒绝，原会话和发送记录已保留。请核对原因，并明确开始新会话后再提问。'
        : '本次问题未发送。请检查输入与连接，重新准备并逐次确认后再发送。'
      replaceRecord(op.id, { status: outcome, error: message, errorCode: failure.code })
      if (isCurrent(op)) { phase.value = outcome; error.value = message; blocked.value = outcome !== 'not-dispatched' }
    } finally {
      op.settled = true
      if (onAbort) op.controller.signal.removeEventListener('abort', onAbort)
      // UI cancellation is not proof the fetch/body/cancellation work has settled.
      // Provider changes and new local generations cannot release this global lease.
      try {
        await current.provider.waitForIdle()
        if (operation === op) { operation = null; pending.value = false }
      } catch {
        if (isCurrent(op)) {
          error.value = '无法确认传输已完全结束，已阻止后续发送；已有答复、发送记录和会话保持原样。'
          blocked.value = true
        }
        // Fail closed permanently: settlement has not been established.
      }
    }
    return succeeded
  }
  function newConversation(confirmed: boolean): boolean {
    if (confirmed !== true) return false
    detachCurrent(); blocked.value = false; phase.value = validContext(binding.value) ? 'idle' : 'invalidated'; error.value = ''; return true
  }
  /** Explicit local deletion only. Unknown and in-flight records are never eligible. */
  function clearCompleted(confirmed: boolean): boolean {
    if (confirmed !== true || pending.value) return false
    records.value = Object.freeze(records.value.filter(record => ['sending', 'unknown'].includes(record.status)))
    revoke(); if (phase.value === 'prepared') phase.value = 'idle'
    if (error.value === capacityMessage) error.value = ''
    return true
  }
  function leave() {
    detachCurrent(); binding.value = null; phase.value = 'invalidated'; error.value = contextMessage
  }
  return {
    query, phase: computed(() => phase.value), status: computed(() => phase.value), error: computed(() => error.value), busy,
    transportPending: computed(() => pending.value), activeSessionId: computed(() => session.value),
    turns: computed(() => records.value), prepared: computed(() => preview.value), revision: computed(() => revision.value),
    requiresNewConversation: computed(() => blocked.value), canPrepare, retainedBytes, completedCount,
    syncContext, prepareSend, send, cancel, newConversation, clearCompleted, leave,
  }
})
