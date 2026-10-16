import { shallowRef } from 'vue'
import type { LocalServiceOperationsProvider } from './domain/local-service-operations'
/** Normal workspace only. Registration is passive, not session authentication or approval. */
export const localServiceOperationsProvider = shallowRef<LocalServiceOperationsProvider | null>(null)
export function registerLocalServiceOperationsProvider(provider: LocalServiceOperationsProvider) { localServiceOperationsProvider.value = provider }
export function isCompanionLocalServiceHost(mode: string, location: { protocol: string; hostname: string }): boolean {
  return mode === 'companion-workspace' && location.protocol === 'http:' && location.hostname === '127.0.0.1'
}
