/**
 * Pure options preparation for the supplied v148 classes. This module does not
 * import or construct the reference runtime, read configuration, generate credentials,
 * or listen. The actual typed runtime binder is still an integration blocker.
 * This is NOT a closed read-only HTTP server: the original router is unchanged.
 */
export const V148_HOST_SOURCE = Object.freeze({
  head: 'f6dcac804fb9ad806e8094594c7820a71cfab7b8',
  archiveSha256: '5abcc93f02ddfd2baf22aebcc77e2843716fbf551282f80d76b66c459f174901',
})
type ReadMethod = (...args: never[]) => unknown
export interface OriginalHostOptions {
  port: 0
  webRoot: string
  actions: Record<string, ReadMethod>
  logs: Record<string, ReadMethod>
  toolPresets: Record<string, ReadMethod>
  knowledge?: Record<string, ReadMethod>
  aiLauncher: Record<string, ReadMethod>
  knowledgeService: Record<string, ReadMethod>
  observeInFlight(): Promise<{ counts: Record<string, number>; unknown: string[] }>
}
/** Fault factories from the supplied runtime, not credentials or configuration. */
export interface OriginalHostFaults {
  denied(): Error
  unavailable(): Error
  knowledgeDenied(): Error
}
export interface ApprovedHostReads {
  projects?: { listProjects(): Promise<unknown>; listDashboardProjects(): Promise<unknown>; listStatuses(): Promise<unknown> }
  logs?: { query(filter?: unknown): unknown }
  /** Existing approved object only. Never accept a key/token or build this from environment here. */
  knowledge?: {
    status(signal?: AbortSignal): Promise<unknown>
    search(input: unknown, signal?: AbortSignal): Promise<unknown>
    listKnowledgeBases(input: unknown, signal?: AbortSignal): Promise<unknown>
    viewKnowledgeBase(input: unknown, signal?: AbortSignal): Promise<unknown>
    listDocuments(input: unknown, signal?: AbortSignal): Promise<unknown>
    viewDocument(input: unknown, signal?: AbortSignal): Promise<unknown>
    downloadDocument(input: unknown, signal?: AbortSignal): Promise<unknown>
    listChunks(input: unknown, signal?: AbortSignal): Promise<unknown>
    listAgents(input: unknown, signal?: AbortSignal): Promise<unknown>
  }
  aiLauncher?: { status(): Promise<unknown> }
  knowledgeService?: { status(): Promise<unknown> }
}
const blockedActions = ['pickDirectory','scaffoldProject','addProject','removeProject','projectStatus','start','focus','stop','restart','openFolder','setupProject','setupStatus','registerMcp','doctor','bridgeCall','managementCall','stopDaemon'] as const
const blockedPresets = ['list','get','selectedForProject','create','update','delete','import','export','selectForProject','sessionForProject'] as const
const knowledgeReads = ['status','search','listKnowledgeBases','viewKnowledgeBase','listDocuments','viewDocument','downloadDocument','listChunks','listAgents'] as const
function requireMethod(value: unknown, label: string): asserts value is ReadMethod { if(typeof value!=='function') throw new TypeError(`Missing approved runtime method: ${label}`) }
function bound<T extends object>(object:T,key:keyof T): ReadMethod { const fn=object[key];requireMethod(fn,String(key));return fn.bind(object) }
function denyMap(keys: readonly string[], deny: ReadMethod): Record<string,ReadMethod> { return Object.fromEntries(keys.map(key=>[key,deny])) }
export function prepareCompanionReadHostOptions(runtime:OriginalHostFaults, input:{webRoot:string;reads:ApprovedHostReads}) {
  for(const key of ['denied','unavailable','knowledgeDenied'] as const) requireMethod(runtime[key],key)
  if(!input||typeof input.webRoot!=='string'||!input.webRoot.trim()||/[\u0000\r\n]/.test(input.webRoot)||!(/^(?:\/(?!\/)|[A-Za-z]:[\\/])/.test(input.webRoot))) throw new TypeError('An explicit absolute local webRoot is required.')
  if(!input.reads||typeof input.reads!=='object')throw new TypeError('Explicit approved reads are required.')
  // Capture approved method properties. Their existing receiver/closure state remains owned by the caller.
  const makeDenied=runtime.denied.bind(runtime), makeUnavailable=runtime.unavailable.bind(runtime), makeKnowledgeDenied=runtime.knowledgeDenied.bind(runtime)
  const deny=()=>{throw makeDenied()}, unavailable=()=>{throw makeUnavailable()}, knowledgeDeny=()=>{throw makeKnowledgeDenied()}
  const reads=input.reads
  const actions=denyMap(blockedActions,deny)
  for(const key of ['listProjects','listDashboardProjects','listStatuses'] as const)actions[key]=reads.projects?bound(reads.projects,key):unavailable
  const logs=Object.freeze({query:reads.logs?bound(reads.logs,'query'):unavailable,clear:deny,on:deny,off:deny,addListener:deny,removeListener:deny})
  let knowledge:Record<string,ReadMethod>|undefined
  if(reads.knowledge){
    const approved=reads.knowledge
    knowledge=Object.freeze({...Object.fromEntries(knowledgeReads.map(key=>[key,bound(approved,key)])),sync:knowledgeDeny,chat:knowledgeDeny,askAgent:knowledgeDeny})
  }
  const options:OriginalHostOptions=Object.freeze({
    port:0,webRoot:input.webRoot,actions:Object.freeze(actions),logs,toolPresets:Object.freeze(denyMap(blockedPresets,deny)),
    ...(knowledge?{knowledge}:{}),
    aiLauncher:Object.freeze({status:reads.aiLauncher?bound(reads.aiLauncher,'status'):unavailable,start:deny,stop:deny}),
    knowledgeService:Object.freeze({status:reads.knowledgeService?bound(reads.knowledgeService,'status'):unavailable,start:deny,stop:deny}),
    // No evidence about an existing Creator/daemon is inferred from this isolated host.
    observeInFlight:async()=>({counts:{},unknown:['EXISTING_DAEMON_AND_NATIVE_WORK_NOT_OBSERVED']}),
  })
  const capabilities=Object.freeze({projects:!!reads.projects,logs:!!reads.logs,knowledge:!!reads.knowledge,modelStatus:!!reads.aiLauncher,knowledgeServiceStatus:!!reads.knowledgeService,oldDaemonCalls:false,oldDaemonLogs:false,closedReadOnlyRouter:false})
  // Deliberately no constructor or start handle: the original SSE route sends headers
  // before logs.on, so these deny facades MUST NOT be passed into a listening runtime.
  return Object.freeze({status:'unvalidated-options-only' as const,capabilities,options})
}
