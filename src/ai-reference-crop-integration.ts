import { shallowRef } from 'vue'
import type { ReferenceCropProvider } from './domain/ai-reference-crop'
export const referenceCropProvider=shallowRef<ReferenceCropProvider|null>(null)
export function registerReferenceCropProvider(provider:ReferenceCropProvider){referenceCropProvider.value=provider}
