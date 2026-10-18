import { ref, shallowRef } from 'vue'
export interface AgentHandoffProvider { writeText(text:string):Promise<void>; open(url:string):void }
/** Registered by the normal workspace only. Construction never reads clipboard or opens apps. */
export const agentHandoffProvider=shallowRef<AgentHandoffProvider|null>(null)
export const agentHandoffBusy=ref(false)
