import { ref, shallowRef, computed } from 'vue'
import { defineStore } from 'pinia'
import { artCanonical } from '../domain/project-art-pending'
import { copyWorkbench, validateWorkbenchDocument, type WorkbenchDocument, type WorkbenchReceipt } from '../domain/art-workbench'
import { WorkbenchRequestError, type WorkbenchContext, type WorkbenchProvider } from '../adapters/art-workbench'
interface SaveAttempt { provider:WorkbenchProvider;operationId:string;document:WorkbenchDocument;version:number;receipt?:WorkbenchReceipt }
export const useArtWorkbenchStore=defineStore('art-workbench',()=>{
 const context=shallowRef<WorkbenchContext|null>(null),provider=shallowRef<WorkbenchProvider|null>(null),draft=ref<WorkbenchDocument|null>(null),base=ref<WorkbenchDocument|null>(null),hash=ref<string|null|undefined>(undefined),phase=ref<'unread'|'reading'|'ready'|'saving'|'error'|'unknown'>('unread'),error=ref(''),capabilities=ref<WorkbenchReceipt['capabilities']|null>(null)
 const dirty=computed(()=>artCanonical(draft.value)!==artCanonical(base.value)),busy=computed(()=>phase.value==='reading'||phase.value==='saving')
 let epoch=0,controller:AbortController|null=null
 const attempts=new WeakMap<object,Map<string,SaveAttempt>>(),retained=new WeakMap<object,Map<string,WorkbenchDocument>>()
 const key=(target:WorkbenchContext)=>JSON.stringify([target.projectId,target.projectPath])
 function map<T>(collection:WeakMap<object,Map<string,T>>,source:object){let value=collection.get(source);if(!value){value=new Map();collection.set(source,value)}return value}
 function retain(){const target=context.value;if(target&&draft.value&&dirty.value)map(retained,target.source).set(key(target),copyWorkbench(draft.value))}
 function bind(next:WorkbenchContext|null,nextProvider:WorkbenchProvider|null){
  if(context.value?.projectId===next?.projectId&&context.value?.projectPath===next?.projectPath&&context.value?.source===next?.source&&provider.value===nextProvider)return
  retain();epoch++;controller?.abort();context.value=next;provider.value=nextProvider;draft.value=null;base.value=null;hash.value=undefined;phase.value='unread';error.value='';capabilities.value=null
 }
 function apply(receipt:WorkbenchReceipt,keepDraft=false){const input=keepDraft?copyWorkbench(draft.value):null;base.value=copyWorkbench(receipt.document);draft.value=keepDraft?input:copyWorkbench(receipt.document);hash.value=receipt.hash;capabilities.value=receipt.capabilities;phase.value='ready'}
 function verifySaved(receipt:WorkbenchReceipt,target:WorkbenchContext,attempt:SaveAttempt){
  if(receipt.projectId!==target.projectId||receipt.projectPath!==target.projectPath||!receipt.hash||!/^[a-f0-9]{64}$/.test(receipt.hash)||!receipt.document||receipt.operation?.operationId!==attempt.operationId||receipt.operation.state!=='completed'||!/^[a-f0-9]{64}$/.test(receipt.operation.bindingHash))throw Error('保存回执未能证实本次操作身份。')
  validateWorkbenchDocument(receipt.document,target.projectId,target.projectPath)
  if(artCanonical(receipt.document)!==artCanonical({...attempt.document,version:attempt.version}))throw Error('保存回执与本次输入不匹配。')
 }
 function verifyReadback(receipt:WorkbenchReceipt,saved:WorkbenchReceipt,target:WorkbenchContext){
  if(receipt.projectId!==target.projectId||receipt.projectPath!==target.projectPath||receipt.hash!==saved.hash||artCanonical(receipt.document)!==artCanonical(saved.document))throw Error('服务器文档已变化，尚不能确认本次保存的回读结果；保留原输入。')
 }
 async function read(recheck=false){
  const target=context.value,reader=provider.value;if(!target||!reader||busy.value||dirty.value&&!recheck)return
  const token=++epoch;controller=new AbortController();phase.value='reading';error.value=''
  const pending=attempts.get(target.source)?.get(key(target)),input=copyWorkbench(draft.value),cached=retained.get(target.source)?.get(key(target))
  try{
   if(pending){
    if(pending.provider!==reader)throw Error('保存来源已变化，原输入保留，需核对原操作。')
    if(!pending.receipt&&reader.status){const operation=await reader.status(target,pending.operationId,controller.signal);if(token!==epoch)return;if(operation.state==='rejected'){attempts.get(target.source)?.delete(key(target));if(!draft.value)draft.value=copyWorkbench(cached??pending.document);phase.value='ready';error.value='服务器已明确拒绝本次保存，原输入保留；请核对后明确重新保存。';return}if(operation.state==='completed'&&operation.receipt){verifySaved(operation.receipt,target,pending);pending.receipt=operation.receipt}}
    const value=await reader.read(target,controller.signal);if(token!==epoch)return
    if(!pending.receipt)throw Error('尚未取得本次操作的完成回执，原输入保留，请稍后核对。')
    verifySaved(pending.receipt,target,pending);verifyReadback(value,pending.receipt,target)
    if(!draft.value)draft.value=copyWorkbench(cached??pending.document)
    apply(value,artCanonical(draft.value)!==artCanonical(pending.document));attempts.get(target.source)?.delete(key(target));retained.get(target.source)?.delete(key(target));return
   }
   const value=await reader.read(target,controller.signal);if(token!==epoch)return
   apply(value,dirty.value)
   if(cached){draft.value=copyWorkbench(cached);error.value='已恢复该工程未保存草稿，请核对后保存。'}
  }catch(e){if(token===epoch){if(pending){draft.value=draft.value??input??copyWorkbench(cached??pending.document);phase.value='unknown'}else phase.value='error';error.value=e instanceof Error?e.message:'工作台读取失败'}}
 }
 function initialize(norm:{hash:string;version:number}){const target=context.value;if(!target||phase.value!=='ready'||hash.value!==null||draft.value)return;draft.value={schemaVersion:'art-workbench-v1',projectId:target.projectId,projectPath:target.projectPath,version:1,norm:copyWorkbench(norm),projectReferences:[],specs:[],needs:[]}}
 async function save(){
  const target=context.value,writer=provider.value;if(!target||!writer||!draft.value||hash.value===undefined||busy.value||phase.value==='unknown'||attempts.get(target.source)?.has(key(target)))return
  try{validateWorkbenchDocument(draft.value,target.projectId,target.projectPath)}catch(e){error.value=(e as Error).message;return}
  const document=copyWorkbench(draft.value),expectedHash=hash.value,operationId='art-save-'+crypto.randomUUID().replaceAll('-',''),token=++epoch,attempt:SaveAttempt={provider:writer,operationId,document,version:(base.value?.version??0)+1}
  map(attempts,target.source).set(key(target),attempt);map(retained,target.source).set(key(target),copyWorkbench(document));controller=new AbortController();phase.value='saving';error.value=''
  try{
   const saved=await writer.save(target,{document,expectedHash,operationId,approved:true},controller.signal);verifySaved(saved,target,attempt);attempt.receipt=saved;if(token!==epoch)return
   const receipt=await writer.read(target,controller.signal);if(token!==epoch)return;verifyReadback(receipt,saved,target)
   apply(receipt,artCanonical(draft.value)!==artCanonical(document));attempts.get(target.source)?.delete(key(target));retained.get(target.source)?.delete(key(target))
  }catch(e){if(e instanceof WorkbenchRequestError&&e.outcome==='rejected'&&!attempt.receipt){attempts.get(target.source)?.delete(key(target));if(token===epoch){phase.value='ready';error.value=e.message}return}if(token===epoch){phase.value='unknown';error.value='保存结果需核对，未自动重发。'+(e instanceof Error?e.message:'')}}
 }
 function leave(){bind(null,null)}
 return {context,provider,draft,base,hash,phase,error,capabilities,dirty,busy,bind,read,initialize,save,leave}
})
