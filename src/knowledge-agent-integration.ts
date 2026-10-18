import { ref, shallowRef } from 'vue'
import type { KnowledgeAgentProvider } from './domain/knowledge-agent'
/** Existing ask capability in normal workspace only; no request on registration. */
export const knowledgeAgentProvider=shallowRef<KnowledgeAgentProvider|null>(null)
export function registerKnowledgeAgentProvider(provider:KnowledgeAgentProvider){knowledgeAgentProvider.value=provider}
/** Includes any abort-unaware underlying Agent transport; no remote cancellation claim. */
export const knowledgeAgentPending=ref(false)
