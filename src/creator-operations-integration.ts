import { shallowRef } from 'vue'
import type { CreatorOperationsProvider } from './domain/creator-operations'
export const creatorOperationsProvider=shallowRef<CreatorOperationsProvider|null>(null)
export function registerCreatorOperationsProvider(provider:CreatorOperationsProvider){creatorOperationsProvider.value=provider}
/** Build identity is not authentication. Original same-origin session and per-operation UI confirmation remain required. */
export function isCompanionWorkspaceHost(mode:string,location:{protocol:string;hostname:string}):boolean{return mode==='companion-workspace'&&location.protocol==='http:'&&location.hostname==='127.0.0.1'}
