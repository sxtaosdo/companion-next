import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { logToolsProvider } from '../log-tools-integration'
import { useCompanionBrowserStore } from './companion-browser'
import { useProjectOperationLaneStore } from './project-operation-lane'
import { LogToolError, normalizeLogTool } from '../domain/log-tools'
import type { LogToolRequest, LogToolsProvider } from '../domain/log-tools'
import type { CompanionBrowserProvider } from '../domain/companion-browser'
interface Prepared { request:LogToolRequest; source:CompanionBrowserProvider; api:LogToolsProvider; fingerprint:string }
export const useLogToolsStore=defineStore('log-tools',()=>{
 const browser=useCompanionBrowserStore(),lane=useProjectOperationLaneStore()
 const prepared=shallowRef<Prepared|null>(null),busy=ref(false),message=ref(''),unknownClear=ref(false)
 const diagnostic=shallowRef<{projectId:string;text:string}|null>(null)
 let version=0,controller:AbortController|undefined,active:LogToolRequest|undefined
 const fingerprint=()=>JSON.stringify(browser.projects.map(p=>[p.id,p.name,p.path]))
 const available=computed(()=>browser.connected&&!!browser.provider&&!!logToolsProvider.value&&!lane.locked&&!busy.value)
 function invalidate(){version++;prepared.value=null;diagnostic.value=null;message.value='';if(controller){if(active?.action==='clear')unknownClear.value=true;controller.abort()}}
 watch(()=>[browser.provider,browser.connected,fingerprint(),logToolsProvider.value],invalidate,{flush:'sync'})
 function prepare(input:LogToolRequest){
  prepared.value=null;message.value=''
  if(!available.value||(input.action==='clear'&&unknownClear.value))return false
  let request;try{request=normalizeLogTool(input)}catch{return false}
  const ids=request.action==='clear'?request.projectIds:[request.projectId]
  if(ids.some(id=>!browser.projects.some(p=>p.id===id)))return false
  prepared.value={request,source:browser.provider!,api:logToolsProvider.value!,fingerprint:fingerprint()};return true
 }
 function cancelConfirmation(){prepared.value=null}
 async function send(){
  const target=prepared.value
  if(!target||!available.value||target.source!==browser.provider||target.api!==logToolsProvider.value||target.fingerprint!==fingerprint())return false
  const lease=lane.acquire('日志工具');if(!lease)return false
  prepared.value=null;busy.value=true;diagnostic.value=null;message.value='等待原后台回执…';active=target.request
  const identity=++version,abort=new AbortController();controller=abort
  const current=()=>version===identity&&browser.provider===target.source&&browser.connected&&logToolsProvider.value===target.api
  let success=false
  try{
   const reply=await target.api.run(target.request,abort.signal)
   if(!current())return false
   if(reply.action!==target.request.action)throw new LogToolError('invalid-shape')
   if(reply.action==='clear'){if(!Number.isSafeInteger(reply.cleared)||reply.cleared<0)throw new LogToolError('invalid-shape');message.value=`原后台已清除 ${reply.cleared} 条内存日志；磁盘日志保留。`}
   else {if(target.request.action!=='diagnostic'||reply.projectId!==target.request.projectId)throw new LogToolError('invalid-shape');diagnostic.value={projectId:reply.projectId,text:reply.text};message.value='已读取诊断；仅保存在本页，可保存到本机。'}
   success=true
  }catch(error){
   const unknown=!(error instanceof LogToolError)||error.outcome==='unknown'
   if(target.request.action==='clear'&&unknown)unknownClear.value=true
   if(current())message.value=error instanceof LogToolError?error.message:'日志操作结果未知，请核对原后台，不自动重发。'
  }finally{
   if(controller===abort)controller=undefined
   await target.api.waitForIdle();lane.release(lease);busy.value=false;active=undefined
  }
  return success
 }
 return {prepared,busy,message,unknownClear,diagnostic,available,prepare,cancelConfirmation,send,invalidate}
})
