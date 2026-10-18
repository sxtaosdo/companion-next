import { isKnowledgeRequestId, KNOWLEDGE_SCHEMA } from './knowledge-read'

export interface KnowledgeAgentRequest { query: string; agentId: string; sessionId?: string }
/** Display-only text. References never grant navigation, lookup, file access or action authority. */
export interface KnowledgeAgentReference { kbId?: string; chunkId?: string }
export interface KnowledgeAgentReply {
  schemaVersion: typeof KNOWLEDGE_SCHEMA
  agentId: string
  answer: string
  sessionId: string
  references: KnowledgeAgentReference[]
}
export interface KnowledgeAgentProvider {
  readonly label: string
  ask(input: KnowledgeAgentRequest, signal?: AbortSignal): Promise<KnowledgeAgentReply>
  /** Passive barrier: rejection/cancellation of chat does not imply underlying transport termination. */
  waitForIdle(): Promise<void>
}
export type KnowledgeAgentOutcome = 'not-dispatched' | 'rejected' | 'unknown'
export type KnowledgeAgentCode = 'invalid-input' | 'busy' | 'aborted' | 'timeout' | 'unauthorized' | 'forbidden'
  | 'chat-unavailable' | 'rejected' | 'unconfirmed' | 'invalid-shape' | 'response-too-large' | 'network-error'
export type KnowledgeAgentBackendCode = 'CLI_UNAVAILABLE' | 'CLI_INCOMPATIBLE' | 'AUTH_MISSING' | 'AUTH_DENIED'
  | 'CHAT_UNAVAILABLE' | 'UPSTREAM_UNAVAILABLE' | 'TIMEOUT' | 'CANCELLED' | 'SCHEMA_INVALID' | 'OUTPUT_LIMIT' | 'BUSY'

const failureText: Record<KnowledgeAgentCode, string> = {
  'invalid-input': 'Agent 问答参数无效，未发送请求。',
  busy: '上一次Agent 问答的传输尚未结束，未发送新请求。',
  aborted: '已停止等待Agent 问答；服务端结果未知，请勿直接重发。',
  timeout: 'Agent 问答等待超时；服务端结果未知，请勿直接重发。',
  unauthorized: '知识库对话身份尚未配置，本次问答被拒绝。',
  forbidden: 'Companion 会话或同源校验未通过，本次问答被拒绝。',
  'chat-unavailable': '对话暂不可用，原接口未区分认证、模型配置或上游原因；不据此判定检索权限。本次问答结果未知，不自动重发。',
  rejected: 'Companion 已明确拒绝本次Agent 问答。',
  unconfirmed: 'Agent 问答结果未确认，请勿直接重发。',
  'invalid-shape': 'Agent 问答响应不符合已核实契约，结果未知，请勿直接重发。',
  'response-too-large': 'Agent 问答响应超过安全读取预算，结果未知，请勿直接重发。',
  'network-error': 'Agent 问答连接未正常完成，结果未知，请勿直接重发。',
}
/** Only closed local metadata is retained; never diagnostics, query text, raw bodies, URLs or causes. */
export class KnowledgeAgentError extends Error {
  constructor(readonly code: KnowledgeAgentCode, readonly outcome: KnowledgeAgentOutcome,
    readonly backendCode?: KnowledgeAgentBackendCode, readonly status?: number) {
    super(outcome === 'not-dispatched' && (code === 'aborted' || code === 'timeout')
      ? 'Agent 问答已取消或超时，未发送请求。' : failureText[code])
    this.name = 'KnowledgeAgentError'
  }
}
export const KNOWLEDGE_AGENT_LIMITS = Object.freeze({
  maxQueryLength: 512, maxRequestBytes: 4096, maxResponseBytes: 2 * 1024 * 1024, maxResponseChunks: 4096,
  maxAnswerLength: 12_000, maxReferences: 20, maxReferenceLength: 80,
  maxConcurrentRequests: 1, defaultTimeoutMs: 75_000, maxTimeoutMs: 75_000,
})
const invalidInput = () => new KnowledgeAgentError('invalid-input', 'not-dispatched')
const invalidReply = () => new KnowledgeAgentError('invalid-shape', 'unknown')
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidReply()
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) throw invalidReply()
  return value as Record<string, unknown>
}
/** Accessor properties are not part of the JSON contract and are never evaluated. */
function own(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor) return undefined
  if (!('value' in descriptor)) throw invalidReply()
  return descriptor.value
}
/** Strict original chat input, copied before the first asynchronous boundary. */
export function normalizeKnowledgeAgentRequest(value: unknown): KnowledgeAgentRequest {
  try {
    const raw = record(value)
    if (Reflect.ownKeys(raw).some(key => typeof key !== 'string' || !['query', 'agentId', 'sessionId'].includes(key))) throw invalidInput()
    const query = own(raw, 'query')
    if (typeof query !== 'string') throw invalidInput()
    const normalized = query.trim()
    if (!normalized || normalized.length > KNOWLEDGE_AGENT_LIMITS.maxQueryLength
      || normalized.startsWith('-') || /[\u0000-\u001f\u007f]/u.test(normalized)) throw invalidInput()
    const result: KnowledgeAgentRequest = { query: normalized, agentId: '' }
    for (const key of ['agentId', 'sessionId'] as const) {
      const id = own(raw, key)
      if (id === undefined) continue
      if (!isKnowledgeRequestId(id)) throw invalidInput()
      result[key] = id
    }
    if (!isKnowledgeRequestId(result.agentId)) throw invalidInput()
    if (new TextEncoder().encode(JSON.stringify(result)).byteLength > KNOWLEDGE_AGENT_LIMITS.maxRequestBytes) throw invalidInput()
    return result
  } catch { throw invalidInput() }
}
/** v148 bounds and whitelist projection. HTML/URLs remain ordinary inert text, including empty references. */
export function decodeKnowledgeAgentReply(value: unknown, expectedAgentId?: string): KnowledgeAgentReply {
  try {
    const raw = record(value), agentId = own(raw, 'agentId'), answer = own(raw, 'answer'), sessionId = own(raw, 'sessionId'), references = own(raw, 'references')
    if (!isKnowledgeRequestId(agentId) || (expectedAgentId !== undefined && agentId !== expectedAgentId) || own(raw, 'schemaVersion') !== KNOWLEDGE_SCHEMA || typeof answer !== 'string'
      || answer.length > KNOWLEDGE_AGENT_LIMITS.maxAnswerLength || !isKnowledgeRequestId(sessionId)
      || !Array.isArray(references) || references.length > KNOWLEDGE_AGENT_LIMITS.maxReferences) throw invalidReply()
    const projected: KnowledgeAgentReference[] = []
    for (let index = 0; index < references.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(references, String(index))
      if (!descriptor || !('value' in descriptor)) throw invalidReply()
      const ref = record(descriptor.value), result: KnowledgeAgentReference = {}
      for (const key of ['kbId', 'chunkId'] as const) {
        const text = own(ref, key)
        if (text === undefined) continue
        if (typeof text !== 'string' || text.length > KNOWLEDGE_AGENT_LIMITS.maxReferenceLength) throw invalidReply()
        result[key] = text
      }
      projected.push(result)
    }
    return { schemaVersion: KNOWLEDGE_SCHEMA, agentId, answer, sessionId, references: projected }
  } catch { throw invalidReply() }
}
