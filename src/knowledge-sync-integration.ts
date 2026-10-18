import { ref, shallowRef } from 'vue'
import type { KnowledgeSyncProvider } from './domain/knowledge-sync'
/** Normal Companion workspace only. Registration does not dispatch or grant source permission. */
export const knowledgeSyncProvider=shallowRef<KnowledgeSyncProvider|null>(null)
export function registerKnowledgeSyncProvider(provider:KnowledgeSyncProvider){knowledgeSyncProvider.value=provider}

/** Local transport lease, not remote job activity. */
export const knowledgeSyncPending=ref(false)

// Session-memory UNKNOWN barriers survive component unmount; no persisted permission/credential state.
const unknownByProvider=new WeakMap<KnowledgeSyncProvider,Set<string>>()
const unknownRevision=ref(0)
export function hasUnknownKnowledgeSync(provider:KnowledgeSyncProvider|null,sourceKey:string){void unknownRevision.value;return Boolean(provider&&unknownByProvider.get(provider)?.has(sourceKey))}
export function markUnknownKnowledgeSync(provider:KnowledgeSyncProvider,sourceKey:string){const values=unknownByProvider.get(provider)??new Set<string>();values.add(sourceKey);unknownByProvider.set(provider,values);unknownRevision.value++}
