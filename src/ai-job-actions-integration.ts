import { shallowRef } from 'vue'
import type { AiJobActionsProvider } from './domain/ai-job-actions'
/** Registration alone grants no operation approval and performs no I/O. */
export const aiJobActionsProvider = shallowRef<AiJobActionsProvider | null>(null)
export function registerAiJobActionsProvider(provider: AiJobActionsProvider) { aiJobActionsProvider.value = provider }
