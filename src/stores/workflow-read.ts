import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { decodeWorkflowRead, WorkflowReadError } from '../domain/workflow-read'
import type { WorkflowReadProvider, WorkflowReadSnapshot } from '../domain/workflow-read'
export const useWorkflowReadStore=defineStore('workflow-read',()=>{
 const snapshot=shallowRef<WorkflowReadSnapshot|null>(null),busy=ref(false),error=ref(''),read=ref(false)
 let generation=0,controller:AbortController|undefined
 // Observation age is not expiry evidence. Failed refresh marks the retained snapshot for review.
 const stale=computed(()=>!!snapshot.value&&!!error.value)
 function cancel(){generation++;controller?.abort();controller=undefined;busy.value=false}
 async function refresh(provider:WorkflowReadProvider){
  if(busy.value)return
  const version=++generation;controller=new AbortController();const signal=controller.signal;busy.value=true
  try{const next=decodeWorkflowRead(await provider.read(undefined,signal));if(version!==generation)return;snapshot.value=next;error.value='';read.value=true}
  catch(cause){if(version===generation){error.value=cause instanceof WorkflowReadError?cause.message:'工作流读取失败，请重试。';read.value=true}}
  finally{if(version===generation){busy.value=false;controller=undefined}}
 }
 function clear(){cancel();snapshot.value=null;error.value='';read.value=false}
 return {snapshot,busy,error,read,stale,refresh,cancel,clear}
})
