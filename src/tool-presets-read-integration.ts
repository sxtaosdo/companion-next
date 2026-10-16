import { shallowRef } from 'vue'
import type { ToolPresetReadProvider } from './domain/tool-presets-read'
/** Only the explicit Companion same-origin build registers this passive reader. */
export const toolPresetReadProvider = shallowRef<ToolPresetReadProvider | null>(null)
export function registerToolPresetReadProvider(provider: ToolPresetReadProvider) { toolPresetReadProvider.value = provider }
