import { ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { KnowledgeReadError } from '../adapters/knowledge-read'
import { isKnowledgeRequestId } from '../domain/knowledge-read'
import type { KnowledgeReadProvider, KnowledgeStatus, KnowledgeServiceStates } from '../domain/knowledge-read'
export type KnowledgeReadAction = 'search' | 'bases' | 'base' | 'documents' | 'document' | 'original' | 'chunks' | 'agents'
type Result<K extends KnowledgeReadAction, M extends keyof KnowledgeReadProvider> = KnowledgeReadProvider[M] extends (...args: never[]) => infer R ? { kind: K; data: Awaited<R> } : never
export type KnowledgeReadResult = Result<'search','search'> | Result<'bases','listKnowledgeBases'> | Result<'base','viewKnowledgeBase'> | Result<'documents','listDocuments'> | Result<'document','viewDocument'> | Result<'original','downloadDocument'> | Result<'chunks','listChunks'> | Result<'agents','listAgents'>
export const useKnowledgeReadStore = defineStore('knowledge-read', () => {
  const provider = shallowRef<KnowledgeReadProvider | null>(null)
  const status = shallowRef<KnowledgeStatus | null>(null)
  const services = shallowRef<KnowledgeServiceStates | null>(null)
  const statusError = ref(''), serviceError = ref(''), error = ref('')
  const statusLoading = ref(false), loading = ref(false), hasAttempted = ref(false)
  const query = ref(''), kbId = ref(''), documentId = ref(''), documentKeyword = ref('')
  const searchLimit = ref(10), documentLimit = ref(20), chunkLimit = ref(50)
  const result = shallowRef<KnowledgeReadResult | null>(null)
  const action = ref<KnowledgeReadAction | null>(null), invalidated = ref(false)
  let epoch = 0, actionVersion = 0, statusVersion = 0
  let actionAbort: AbortController | null = null, statusAbort: AbortController | null = null
  function cancelAction() { actionVersion++; actionAbort?.abort(); actionAbort = null; loading.value = false }
  function invalidate() { cancelAction(); invalidated.value = result.value !== null || hasAttempted.value; result.value = null; error.value = ''; hasAttempted.value = false }
  watch([query,kbId,documentId,documentKeyword,searchLimit,documentLimit,chunkLimit], invalidate, { flush: 'sync' })
  function cancelReads() { cancelAction(); statusVersion++; statusAbort?.abort(); statusAbort=null; statusLoading.value=false }
  function disconnect() { epoch++; cancelReads(); provider.value=null; status.value=null; services.value=null; result.value=null; statusError.value=''; serviceError.value=''; error.value=''; hasAttempted.value=false; action.value=null; invalidated.value=false; query.value=''; kbId.value=''; documentId.value=''; documentKeyword.value='' }
  async function connect(next: KnowledgeReadProvider) { disconnect(); provider.value=next; await refreshStatus() }
  async function refreshStatus() {
    const p=provider.value; if(!p) return
    cancelReads(); const version=++statusVersion, currentEpoch=epoch, controller=new AbortController(); statusAbort=controller
    status.value=null; services.value=null; statusError.value=''; serviceError.value=''; statusLoading.value=true
    const current=()=>provider.value===p&&epoch===currentEpoch&&statusVersion===version&&!controller.signal.aborted
    await Promise.all([
      p.status(controller.signal).then(value=>{if(current())status.value=value},cause=>{if(current())statusError.value=cause instanceof KnowledgeReadError ? cause.message : '知识状态读取失败；CLI、认证与检索验证均未知。'}),
      p.loadServiceStates(controller.signal, 'knowledge').then(value=>{if(current())services.value=value},()=>{if(current())serviceError.value='知识服务状态未读取。'}),
    ])
    if(current()){statusLoading.value=false; statusAbort=null}
  }
  async function run(kind: KnowledgeReadAction) {
    const p=provider.value; if(!p||statusLoading.value||loading.value) return
    cancelAction(); const version=++actionVersion,currentEpoch=epoch,controller=new AbortController(); actionAbort=controller
    const input={query:query.value.trim(),kbId:kbId.value.trim(),id:documentId.value.trim(),keyword:documentKeyword.value.trim(),searchLimit:searchLimit.value,documentLimit:documentLimit.value,chunkLimit:chunkLimit.value}
    result.value=null; error.value=''; invalidated.value=false; hasAttempted.value=true; action.value=kind; loading.value=true
    const current=()=>provider.value===p&&epoch===currentEpoch&&actionVersion===version&&!controller.signal.aborted
    try {
      if((['search','documents'].includes(kind)&&input.kbId&&!isKnowledgeRequestId(input.kbId))||(kind==='base'&&!isKnowledgeRequestId(input.kbId))||(['document','original','chunks'].includes(kind)&&!isKnowledgeRequestId(input.id))) throw new Error('invalid-input')
      let value: KnowledgeReadResult
      switch(kind){
        case 'search': value={kind,data:await p.search({query:input.query,...(input.kbId?{kbId:input.kbId}:{}),limit:input.searchLimit},controller.signal)};break
        case 'bases': value={kind,data:await p.listKnowledgeBases(controller.signal)};break
        case 'base': value={kind,data:await p.viewKnowledgeBase({kbId:input.kbId},controller.signal)};break
        case 'documents': value={kind,data:await p.listDocuments({...(input.kbId?{kbId:input.kbId}:{}),...(input.keyword?{keyword:input.keyword}:{}),limit:input.documentLimit},controller.signal)};break
        case 'document': value={kind,data:await p.viewDocument({id:input.id},controller.signal)};break
        case 'original': value={kind,data:await p.downloadDocument({id:input.id},controller.signal)};break
        case 'chunks': value={kind,data:await p.listChunks({id:input.id,limit:input.chunkLimit},controller.signal)};break
        case 'agents': value={kind,data:await p.listAgents(controller.signal)};break
      }
      if(current())result.value=value
    } catch(cause) { if(current())error.value=cause instanceof KnowledgeReadError ? cause.message : '本次读取失败。请检查输入与服务认证后重试；没有使用旧结果。' }
    finally {if(current()){loading.value=false;actionAbort=null}}
  }
  return {provider,status,services,statusError,serviceError,error,statusLoading,loading,hasAttempted,query,kbId,documentId,documentKeyword,searchLimit,documentLimit,chunkLimit,result,action,invalidated,connect,disconnect,refreshStatus,run,cancelReads,invalidate}
})
