import { shallowRef } from 'vue'
import type { ImageReviewProvider } from './domain/image-review'
/** Explicit trusted same-process host integration only. main.ts deliberately registers nothing. */
export const imageReviewProvider = shallowRef<ImageReviewProvider | null>(null)
export function registerImageReviewProvider(provider: ImageReviewProvider): void {
  if (!provider || typeof provider.loadState !== 'function' || typeof provider.importCandidates !== 'function' || typeof provider.loadPreview !== 'function' || typeof provider.saveSelected !== 'function' || !['verified','unverified'].includes(provider.saveSelectionGuard)) throw new Error('审阅服务适配器合同无效')
  imageReviewProvider.value = provider
}
