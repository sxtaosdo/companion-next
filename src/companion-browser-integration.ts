import { shallowRef } from 'vue'
import type { CompanionBrowserProvider } from './domain/companion-browser'
import type { CompanionEventProvider } from './domain/companion-live'
/** Cookie-authenticated Companion host only. Registration never makes a request. */
export const companionBrowserProvider=shallowRef<CompanionBrowserProvider|null>(null)
export const companionEventProvider=shallowRef<CompanionEventProvider|null>(null)
/** Only the normal workspace composition root opts into project-page entry reads.
 * Binding the policy to a reader prevents a replacement from inheriting it. */
export const companionProjectEntryProvider=shallowRef<CompanionBrowserProvider|null>(null)
export function registerCompanionBrowserProvider(provider:CompanionBrowserProvider,events?:CompanionEventProvider,options:{projectEntry?:'read'}={}){
 companionProjectEntryProvider.value=null
 companionEventProvider.value=events??null;companionBrowserProvider.value=provider
 if(options.projectEntry==='read'&&provider.runtimeProbesEnabled!==false)companionProjectEntryProvider.value=provider
}
/** Build identity is explicit; a Picker URL never implies Companion authentication. */
export function isCompanionReadHost(mode:string,location:{protocol:string;hostname:string}):boolean{return mode==='companion-readonly'&&location.protocol==='http:'&&location.hostname==='127.0.0.1'}
