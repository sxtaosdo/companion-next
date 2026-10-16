import { shallowRef } from 'vue'
import type { ReadOnlyCompanionProvider } from './domain/contracts'
/** Optional composition root. Register a reviewed read-only provider before mount.
 * Registering does not connect. The user must explicitly click the connect button.
 * No URLs, credentials, network transports or Windows defaults live in this file. */
const registeredProvider = shallowRef<ReadOnlyCompanionProvider | null>(null)
export const liveProvider = registeredProvider
export function registerLiveProvider(provider: ReadOnlyCompanionProvider): void {
  if (provider.mode !== 'live') throw new Error('Only a live read-only provider can be registered here')
  registeredProvider.value = provider
}
