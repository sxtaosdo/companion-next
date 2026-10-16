import { shallowRef } from 'vue'
import type { KnowledgeReadProvider } from './domain/knowledge-read'
/** Registered only by the explicit Companion build. No network request on registration. */
export const knowledgeReadProvider = shallowRef<KnowledgeReadProvider | null>(null)
export function registerKnowledgeReadProvider(provider: KnowledgeReadProvider) { knowledgeReadProvider.value = provider }
