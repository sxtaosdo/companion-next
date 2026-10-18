import { shallowRef } from 'vue'
import type { PreviewActionsProvider } from './domain/preview-actions'
export const previewActionsProvider=shallowRef<PreviewActionsProvider|null>(null)
export function registerPreviewActionsProvider(provider:PreviewActionsProvider){previewActionsProvider.value=provider}
