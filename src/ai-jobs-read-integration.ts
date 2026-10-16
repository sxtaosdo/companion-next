import { shallowRef } from 'vue'
import type { AiJobsReadProvider } from './domain/ai-jobs-read'
/** Registration is passive; UI actions alone may invoke the original Python-backed reads. */
export const aiJobsReadProvider = shallowRef<AiJobsReadProvider | null>(null)
export function registerAiJobsReadProvider(provider: AiJobsReadProvider) { aiJobsReadProvider.value = provider }
