import { shallowRef } from 'vue'
import type { ToolPresetWriteProvider } from './domain/tool-presets-write'
/** Only the normal same-origin workspace registers the passive writer; registration sends nothing. */
export const toolPresetWriteProvider = shallowRef<ToolPresetWriteProvider | null>(null)
export function registerToolPresetWriteProvider(provider: ToolPresetWriteProvider) { toolPresetWriteProvider.value = provider }
