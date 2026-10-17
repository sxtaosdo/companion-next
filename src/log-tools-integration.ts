import { shallowRef } from 'vue'
import type { LogToolsProvider } from './domain/log-tools'
export const logToolsProvider=shallowRef<LogToolsProvider|null>(null)
export function registerLogToolsProvider(provider:LogToolsProvider){logToolsProvider.value=provider}
