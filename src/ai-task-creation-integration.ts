import { shallowRef } from 'vue'
import type { AiTaskCreationProvider } from './domain/ai-task-creation'
/** Registration is inert. Only an explicit frozen-form approval may invoke the existing write endpoints. */
export const aiTaskCreationProvider = shallowRef<AiTaskCreationProvider | null>(null)
export function registerAiTaskCreationProvider(provider: AiTaskCreationProvider) { aiTaskCreationProvider.value = provider }
