import { shallowRef } from 'vue'
import type { AiReferenceUploadProvider } from './domain/ai-reference-upload'
/** Explicit edit-capable host only. Registration does not send bytes or grant an approval. */
export const aiReferenceUploadProvider = shallowRef<AiReferenceUploadProvider | null>(null)
export function registerAiReferenceUploadProvider(provider: AiReferenceUploadProvider) { aiReferenceUploadProvider.value = provider }
