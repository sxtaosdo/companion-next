import { shallowRef } from 'vue'
import type { IconHandoffProvider } from './domain/icon-handoff'
/** No automatic request, ambient fetch, Agent dispatch or Creator operation. */
export const iconHandoffProvider=shallowRef<IconHandoffProvider|null>(null)
export function registerIconHandoffProvider(provider:IconHandoffProvider|null){iconHandoffProvider.value=provider}
