import { shallowRef } from 'vue'
import type { AiResourceReadProvider } from './domain/ai-resource-read'
/** Passive registration for the Companion host only; never shares Picker authentication. */
export const aiResourceReadProvider = shallowRef<AiResourceReadProvider | null>(null)
export function registerAiResourceReadProvider(provider: AiResourceReadProvider) { aiResourceReadProvider.value = provider }
