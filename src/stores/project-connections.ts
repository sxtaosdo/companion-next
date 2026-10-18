import { computed,ref,shallowRef,toRaw,watch } from 'vue'
import { defineStore } from 'pinia'
import { useCompanionBrowserStore } from './companion-browser'
import { useProjectSetupStore } from './project-setup'
import { useProjectOperationLaneStore } from './project-operation-lane'
import { companionBrowserProvider } from '../companion-browser-integration'
import { projectConnectionsProvider } from '../project-connections-integration'
import { normalizeConnectionRequest,ProjectConnectionError,type ConnectionRequest,type ClientTarget,CLIENT_TARGETS } from '../domain/project-connections'
import type { ToolPreset } from '../domain/tool-presets-read'
type Prepared={readonly owner:symbol;readonly project:{readonly id:string;readonly name:string;readonly path:string};readonly requests:readonly ConnectionRequest[];readonly source:object;readonly api:object;readonly identity:string}
export const useProjectConnectionsStore=defineStore('project-connections',()=>{
 const browser=useCompanionBrowserStore(),setup=useProjectSetupStore(),lane=useProjectOperationLaneStore()
 const prepared=shallowRef<Prepared|null>(null),busy=ref(false),activeOwner=shallowRef<symbol|null>(null),receipts=shallowRef<{owner:symbol;text:string}[]>([]),message=shallowRef<{owner:symbol;text:string}|null>(null)
 const blocked=shallowRef<string[]>([]);let active:{owner:symbol;controller:AbortController;request:ConnectionRequest|null;awaiting:boolean;cancelled:boolean}|null=null
 const project=(id:string)=>{const matches=browser.projects.filter(p=>p.id===id);return matches.length===1?matches[0]:undefined}
 const identity=(id:string)=>{const p=project(id);return p?JSON.stringify([p.id,p.name,p.path]):''}
 const available=computed(()=>browser.connected&&!!browser.provider&&toRaw(browser.provider)===toRaw(companionBrowserProvider.value)&&!!projectConnectionsProvider.value&&!browser.projectLoading&&!lane.locked&&!busy.value)
 const key=(request:ConnectionRequest)=>JSON.stringify([request.projectId,request.kind,request.kind==='client'?request.target:request.setupOperationId])
 function block(request:ConnectionRequest){const k=key(request);if(!blocked.value.includes(k))blocked.value=[...blocked.value,k]}
 function scopeCurrent(request:ConnectionRequest){return request.kind==='client'||(setup.completedSetup?.project.id===request.projectId&&setup.setupReceipt?.phase==='complete'&&setup.setupReceipt.operationId===request.setupOperationId)}
 function prepare(owner:symbol,projectId:string,requests:ConnectionRequest[]){
  if(!available.value)return false
  prepared.value=null;message.value=null;receipts.value=[]
  try{
   const p=project(projectId);if(!p||!p.name||!p.path||!requests.length||requests.length>5)throw Error()
   const normalized=requests.map(normalizeConnectionRequest)
   if(normalized.some(r=>r.projectId!==projectId||!scopeCurrent(r)||blocked.value.includes(key(r)))||new Set(normalized.map(key)).size!==normalized.length)throw Error()
   const frozen=normalized.map(r=>{if(r.kind==='setup-scope'){Object.freeze(r.preset.enabled);Object.freeze(r.preset.disabled);Object.freeze(r.preset)}return Object.freeze(r)})
   prepared.value=Object.freeze({owner,project:Object.freeze({...p}),requests:Object.freeze(frozen),source:toRaw(browser.provider!),api:projectConnectionsProvider.value!,identity:identity(projectId)});return true
  }catch{message.value={owner,text:'当前工程、完成任务或所选配置未核实；也可能已有结果未知的同项操作。本次未准备写入。'};return false}
 }
 function prepareClients(owner:symbol,id:string,targets:ClientTarget[]){if(!Array.isArray(targets)||targets.some(t=>!CLIENT_TARGETS.includes(t)))return false;return prepare(owner,id,targets.map(target=>({kind:'client',projectId:id,target})))}
 function prepareScope(owner:symbol,id:string,operationId:string,preset:ToolPreset){return prepare(owner,id,[{kind:'setup-scope',projectId:id,setupOperationId:operationId,preset}])}
 function cancel(owner:symbol){
  if(prepared.value?.owner===owner)prepared.value=null
  if(active?.owner===owner){active.cancelled=true;if(active.awaiting&&active.request)block(active.request);active.controller.abort()}
 }
 function current(p:Prepared){return browser.connected&&toRaw(browser.provider)===p.source&&toRaw(companionBrowserProvider.value)===p.source&&projectConnectionsProvider.value===p.api&&identity(p.project.id)===p.identity&&p.requests.every(scopeCurrent)}
 watch(()=>[browser.provider,browser.connected,companionBrowserProvider.value,projectConnectionsProvider.value,JSON.stringify(browser.projects.map(p=>[p.id,p.name,p.path])),setup.completedSetup,setup.setupReceipt?.operationId],()=>{
  if(prepared.value&&!current(prepared.value))prepared.value=null
  if(active&&activePrepared&&!current(activePrepared))cancel(active.owner)
 },{flush:'sync'})
 let activePrepared:Prepared|null=null
 async function send(owner:symbol,confirmed:boolean){
  const p=prepared.value;if(!confirmed||!p||p.owner!==owner||!available.value||!current(p))return false
  prepared.value=null;const lease=lane.acquire('注册客户端 / 向导工具范围');if(!lease)return false
  const api=projectConnectionsProvider.value!,op={owner,controller:new AbortController(),request:null as ConnectionRequest|null,awaiting:false,cancelled:false};active=op;activePrepared=p;busy.value=true;activeOwner.value=owner
  let all=true
  try{
   for(const request of p.requests){
    if(op.cancelled||!current(p)){all=false;break}
    op.request=request;op.awaiting=true
    try{
     const reply=await api.run(request,op.controller.signal)
     if(reply.key!==JSON.stringify(request)||typeof reply.text!=='string')throw new ProjectConnectionError('invalid-shape')
     op.awaiting=false
     if(op.cancelled||!current(p)){block(request);all=false;break}
     receipts.value=[...receipts.value,{owner,text:reply.text}]
    }catch(error){
     all=false;const unknown=!(error instanceof ProjectConnectionError)||error.outcome==='unknown';if(unknown)block(request)
     if(!op.cancelled&&current(p))message.value={owner,text:unknown?'该项结果未知，后续客户端未发送；请核对原配置，本页不重发此项。':'原接口未完成该项；后续客户端未发送。请核对已显示的先前回执。'}
     break
    }finally{op.awaiting=false}
   }
   if(all&&current(p))message.value={owner,text:'已取得本批回执；客户端是否已刷新工具列表仍需在对应应用核对。'}
  }finally{
   try{await api.waitForIdle();lane.release(lease);busy.value=false;activeOwner.value=null;active=null;activePrepared=null}catch{if(op.request)block(op.request);message.value={owner,text:'传输尚未确认结束，保留互斥。'}}
  }
  return all&&!op.cancelled&&current(p)
 }
 return {prepared,busy,activeOwner,available,receipts,message,prepareClients,prepareScope,send,cancel}
})
