/** Verified v148 knowledge read projections. No lifecycle, setup, chat, sync or writer surface. */
export const KNOWLEDGE_SCHEMA = 'companion-knowledge-v1' as const
export const KNOWLEDGE_POLICY_REASONS = ['no_source', 'not_approved', 'writer_disabled', 'credential_missing', 'network_disabled', 'retention_review', 'delete_limit', 'scope_changed', 'prior_batch', 'checkpoint_mismatch'] as const
export type KnowledgePolicyReason = typeof KNOWLEDGE_POLICY_REASONS[number]
export type KnowledgeChannel = 'local' | 'official'
/** message is locally generated from a closed code, never the backend diagnostic. */
export interface KnowledgeIssue { code: string; message: string; reason?: KnowledgePolicyReason }
export interface KnowledgeSource {
  id: string; label: string; channel: KnowledgeChannel
  targetSha?: string; completedSha?: string
  freshness?: 'unknown' | 'current' | 'stale' | 'blocked' | 'syncing' | 'disabled'
  pending?: number
  jobs?: Array<{ id: string; status: 'queued' | 'pending' | 'running' | 'blocked' | 'done' | 'complete' | 'completed' | 'unknown' | 'cancelled' | 'planned'; sourceCommit?: string }>
  error?: KnowledgeIssue
}
export interface KnowledgeStatus {
  cli: { available: boolean; compatible: boolean; version?: string; error?: KnowledgeIssue }
  /** Backend-reported process-local retrieval evidence, independent of service running. */
  retrieval: { auth: 'missing' | 'configured' | 'verified' | 'denied'; keyword: 'unverified' | 'verified'; kbId: string; endpoint: string }
  /** Registered sources and ledger summary only; never proof that indexing succeeded. */
  sync: { available: boolean; writerEnabled: boolean; schedulerEnabled: boolean; sources: KnowledgeSource[]; error?: KnowledgeIssue }
}
export interface KnowledgeServiceStates {
  /** Missing means unknown / failed to read, never stopped. */
  knowledge?: { running: boolean; frameable: boolean }
  /** This is the launcher's reachability only, not individual model readiness. */
  model?: { running: boolean }
  warnings: string[]
}
export interface KnowledgeResult {
  id: string; title: string; content: string; knowledgeId?: string
  source?: { channel?: KnowledgeChannel; repoId?: string; path?: string; commit?: string; blobSha?: string }
}
export interface KnowledgeSearchResponse { results: KnowledgeResult[]; count: number }
export interface KnowledgeBase {
  id: string; name?: string; description?: string; type?: string
  knowledge_count?: number; chunk_count?: number; is_pinned?: boolean; updated_at?: string
  embedding_model_id?: string
}
export interface KnowledgeDocument {
  id: string; title?: string; file_name?: string; parse_status?: string; file_type?: string
  file_size?: number; updated_at?: string; description?: string
}
export interface KnowledgeChunk { id: string; chunk_index?: number; content?: string; is_enabled?: boolean }
export interface KnowledgeAgent { id: string; name?: string; description?: string; is_builtin?: boolean }
/** In-memory original-content preview, not a browser save. The backend uses and removes a temporary file. */
export interface KnowledgeDocumentDownload {
  docId: string; fileName: string; bytes: number; truncated: boolean; isBase64: boolean; content: string
}
export interface KnowledgeSearchInput { query: string; kbId?: string; limit?: number }
export interface KnowledgeDocumentListInput { kbId?: string; keyword?: string; limit?: number }
export interface KnowledgeChunkListInput { id: string; limit?: number }
export interface KnowledgeReadProvider {
  readonly label: string
  status(signal?: AbortSignal): Promise<KnowledgeStatus>
  loadServiceStates(signal?: AbortSignal): Promise<KnowledgeServiceStates>
  /** Every logical-read POST below must be triggered by the user's explicit action. */
  search(input: KnowledgeSearchInput, signal?: AbortSignal): Promise<KnowledgeSearchResponse>
  listKnowledgeBases(signal?: AbortSignal): Promise<{ items: KnowledgeBase[] }>
  viewKnowledgeBase(input: { kbId: string }, signal?: AbortSignal): Promise<{ item: KnowledgeBase }>
  listDocuments(input: KnowledgeDocumentListInput, signal?: AbortSignal): Promise<{ items: KnowledgeDocument[]; truncated: boolean }>
  viewDocument(input: { id: string }, signal?: AbortSignal): Promise<{ item: KnowledgeDocument }>
  downloadDocument(input: { id: string }, signal?: AbortSignal): Promise<KnowledgeDocumentDownload>
  listChunks(input: KnowledgeChunkListInput, signal?: AbortSignal): Promise<{ items: KnowledgeChunk[]; truncated: boolean }>
  listAgents(signal?: AbortSignal): Promise<{ items: KnowledgeAgent[] }>
}
/** Request identifiers follow the backend safeId schema, independently of display-only IDs. */
export function isKnowledgeRequestId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(value) }
