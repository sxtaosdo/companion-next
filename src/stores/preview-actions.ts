import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { previewActionsProvider } from '../preview-actions-integration'
import { companionBrowserProvider } from '../companion-browser-integration'
import { PreviewActionError, normalizePreviewRequest } from '../domain/preview-actions'
import type { PreviewAction } from '../domain/preview-actions'
import { useCompanionBrowserStore } from './companion-browser'
import { useProjectOperationLaneStore } from './project-operation-lane'
interface Result { preview?:string; profiler?:string; profilerPhase?:'capturing'|'ok'|'fail'; message?:string; unknown?:boolean }
export const usePreviewActionsStore=defineStore('preview-actions',()=>{
 const browser=useCompanionBrowserStore(),lane=useProjectOperationLaneStore()
 const results=shallowRef<Record<string,Result>>({}),busy=ref(false),activeId=ref(''),unknownIds=shallowRef<readonly string[]>([])
 let generation=0,controller:AbortController|undefined,awaitingReply=false
 const fingerprint=()=>JSON.stringify(browser.projects.map(project=>[project,browser.statuses.filter(status=>status.projectId===project.id).map(status=>[status.state,status.sessionId,status.instanceId,status.pid])]))
 const available=computed(()=>browser.connected&&!!browser.provider&&browser.provider===companionBrowserProvider.value&&!!previewActionsProvider.value&&!browser.projectLoading&&!lane.locked&&!busy.value)
 function update(id:string,changes:Partial<Result>){results.value={...results.value,[id]:{...results.value[id],...changes}}}
 function block(id:string){if(!unknownIds.value.includes(id))unknownIds.value=[...unknownIds.value,id]}
 function isUnknown(id:string){return unknownIds.value.includes(id)}
 function invalidate(){generation++;if(controller&&awaitingReply)block(activeId.value);controller?.abort();results.value={}}
 watch(()=>[browser.provider,browser.connected,companionBrowserProvider.value,previewActionsProvider.value],()=>{invalidate();unknownIds.value=[]},{flush:'sync'})
 watch(fingerprint,invalidate,{flush:'sync'})
 function canRun(id:string){return available.value&&/^[a-f0-9]{16}$/.test(id)&&browser.projects.some(project=>project.id===id&&!!project.name&&!!project.path)&&browser.statuses.some(status=>status.projectId===id&&status.state==='ready')&&!isUnknown(id)}
 async function run(id:string,action:PreviewAction){
  try{normalizePreviewRequest({projectId:id,action})}catch{return false}
  if(!canRun(id))return false
  const api=previewActionsProvider.value!,source=browser.provider,key=fingerprint(),lease=lane.acquire('Preview / Profiler')
  if(!lease)return false
  const version=++generation,abort=new AbortController();controller=abort;busy.value=true;activeId.value=id;awaitingReply=true
  update(id,{message:'等待原后台回执…',...(action==='profiler'?{profilerPhase:'capturing' as const}: {})})
  const current=()=>version===generation&&browser.connected&&browser.provider===source&&companionBrowserProvider.value===source&&previewActionsProvider.value===api&&key===fingerprint()
  let accepted=false
  try{const reply=await api.run({projectId:id,action},abort.signal);if(!current())return false
   if(reply.action!==action||reply.projectId!==id||typeof reply.text!=='string')throw new PreviewActionError('invalid-shape')
   update(id,action==='profiler'?{profiler:reply.text,profilerPhase:'ok',message:'已收到 Profiler 采集回执；全文见证据文件。'}:{preview:reply.text,message:reply.available===false?'原回执显示 Preview 不可用；请核对结果。':'已收到 Preview 回执；实际运行状态见返回结果。'})
   accepted=true;awaitingReply=false
   await browser.refreshProjects(true)
   if(current())await browser.refreshCounts()
  }catch(error){if(current()){const unknown=!(error instanceof PreviewActionError)||error.outcome==='unknown';if(unknown)block(id);update(id,{unknown,message:(error instanceof PreviewActionError?error.message:'结果未知；请核对原后台。')+(unknown?' 请重新连接工程服务核对后再操作。':''),...(action==='profiler'?{profilerPhase:'fail' as const}: {})})}}
  finally{awaitingReply=false;if(controller===abort)controller=undefined;try{await api.waitForIdle();lane.release(lease);busy.value=false;activeId.value=''}catch{if(current())update(id,{unknown:true,message:'请求清理未完成；保持互斥，请核对原后台。'})}}
  return accepted
 }
 function hide(id:string,kind:'preview'|'profiler'){update(id,{[kind]:undefined})}
 return {results,busy,activeId,canRun,isUnknown,run,hide,invalidate}
})
