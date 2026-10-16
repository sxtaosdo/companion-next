import { shallowRef } from 'vue'
import type { KnowledgeConversationProvider } from './domain/knowledge-conversation'
/** Explicit per-send capability in normal workspace / chat build, never readonly or Picker. */
export const knowledgeConversationProvider = shallowRef<KnowledgeConversationProvider | null>(null)
export function registerKnowledgeConversationProvider(provider: KnowledgeConversationProvider) { knowledgeConversationProvider.value = provider }
/** Transport constraint only, not proof of session authentication or per-message approval. */
export function isCompanionKnowledgeChatHost(mode: string, location: { protocol: string; hostname: string }): boolean {
  return mode === 'companion-knowledge-chat' && location.protocol === 'http:' && location.hostname === '127.0.0.1'
}
