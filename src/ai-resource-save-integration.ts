import { shallowRef } from 'vue'
import type { AiResourceSaveProvider } from './domain/ai-resource-save'
/** Registered by normal workspace or the explicit editor. Readonly / Picker cannot save. */
export const aiResourceSaveProvider = shallowRef<AiResourceSaveProvider | null>(null)
export function registerAiResourceSaveProvider(provider: AiResourceSaveProvider) { aiResourceSaveProvider.value = provider }
export function isCompanionConfigEditHost(mode: string, location: { protocol: string; hostname: string }): boolean {
  return mode === 'companion-config-editor' && location.protocol === 'http:' && location.hostname === '127.0.0.1'
}
