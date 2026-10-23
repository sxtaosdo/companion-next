import { ref, shallowRef, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { artCanonical } from '../domain/project-art-pending'
import { copyWorkbench, validateWorkbenchDocument, readPendingWorkbenchWrite, persistPendingWorkbenchWrite, clearPendingWorkbenchWrite, workbenchPendingBindingHash, type PendingWorkbenchWrite, type WorkbenchPendingStorage, readWorkbenchTaskLedger, persistWorkbenchTaskLedger, type WorkbenchTaskEntry, type WorkbenchTaskReceipt, type WorkbenchDocument, type WorkbenchReceipt } from '../domain/art-workbench'
import { WorkbenchRequestError, type WorkbenchContext, type WorkbenchProvider } from '../adapters/art-workbench'
interface SaveAttempt { provider:WorkbenchProvider;operationId:string;document:WorkbenchDocument;version:number;receipt?:WorkbenchReceipt;persisted?:PendingWorkbenchWrite }
export const useArtWorkbenchStore=defineStore('art-workbench',()=>{
 const context=shallowRef<WorkbenchContext|null>(null),provider=shallowRef<WorkbenchProvider|null>(null),draft=ref<WorkbenchDocument|null>(null),base=ref<WorkbenchDocument|null>(null),hash=ref<string|null|undefined>(undefined),phase=ref<'unread'|'reading'|'ready'|'saving'|'error'|'unknown'>('unread'),error=ref(''),capabilities=ref<WorkbenchReceipt['capabilities']|null>(null)
 const taskResults=ref<WorkbenchTaskEntry[]>([]),taskBusy=ref(false),taskError=ref(''),taskStorageBlocked=ref(false)
 const taskPending=computed(()=>taskStorageBlocked.value||taskResults.value.some(row=>row.state==='unknown'||row.state==='submitting'))
 const dirty=computed(()=>artCanonical(draft.value)!==artCanonical(base.value)),busy=computed(()=>phase.value==='reading'||phase.value==='saving'||taskBusy.value)
 let epoch=0,controller:AbortController|null=null,pendingStorage:WorkbenchPendingStorage|undefined
 const storage=()=>pendingStorage??globalThis.localStorage
 function setPendingStorage(value:WorkbenchPendingStorage){if(context.value||busy.value)throw Error('请在绑定前设置隔离存储');pendingStorage=value}
 function releaseAttempt(target:WorkbenchContext,attempt:SaveAttempt){if(attempt.persisted)clearPendingWorkbenchWrite(storage(),attempt.persisted);attempts.get(target.source)?.delete(key(target))}
 const attempts=new WeakMap<object,Map<string,SaveAttempt>>(),retained=new WeakMap<object,Map<string,WorkbenchDocument>>()
 const key=(target:WorkbenchContext)=>JSON.stringify([target.projectId,target.projectPath])
 function map<T>(collection:WeakMap<object,Map<string,T>>,source:object){let value=collection.get(source);if(!value){value=new Map();collection.set(source,value)}return value}
 function retain(){const target=context.value;if(target&&draft.value&&dirty.value)map(retained,target.source).set(key(target),copyWorkbench(draft.value))}
 function bind(next:WorkbenchContext|null,nextProvider:WorkbenchProvider|null){
  if(context.value?.projectId===next?.projectId&&context.value?.projectPath===next?.projectPath&&context.value?.source===next?.source&&provider.value===nextProvider)return
  retain();epoch++;controller?.abort();context.value=next;provider.value=nextProvider;draft.value=null;base.value=null;hash.value=undefined;phase.value='unread';error.value='';capabilities.value=null;taskResults.value=[];taskBusy.value=false;taskError.value='';taskStorageBlocked.value=false
  if(next&&nextProvider?.endpoint){try{const ledger=readWorkbenchTaskLedger(storage(),nextProvider.endpoint,next.projectId,next.projectPath);if(ledger)taskResults.value=ledger.entries.map(row=>({...row,state:row.state==='submitting'?'unknown':row.state}))}catch{taskStorageBlocked.value=true;taskError.value='准备任务恢复记录无法读取，已停止新建与保存。'}}
  if(next&&nextProvider?.endpoint){try{const record=readPendingWorkbenchWrite(storage(),nextProvider.endpoint,next.projectId,next.projectPath);if(record){map(attempts,next.source).set(key(next),{provider:nextProvider,operationId:record.input.operationId,document:copyWorkbench(record.input.document),version:record.baseVersion+1,persisted:record});base.value=copyWorkbench(record.base);hash.value=record.input.expectedHash;draft.value=copyWorkbench(record.draft);phase.value='unknown';error.value='已恢复此工程未核对的保存及原输入，请核对原操作结果；不会重发。'}}catch{phase.value='unknown';error.value='保存恢复记录无法安全读取，已停止新保存，请保留原记录后核对。'}}
 }
 watch(draft,()=>{const target=context.value;if(!target||!draft.value)return;const pending=attempts.get(target.source)?.get(key(target));if(!pending?.persisted||artCanonical(pending.persisted.draft)===artCanonical(draft.value))return;try{const next={...pending.persisted,draft:copyWorkbench(draft.value)};persistPendingWorkbenchWrite(storage(),next);pending.persisted=next}catch{phase.value='unknown';error.value='最新输入无法可靠写入保存恢复记录，已停止新保存；请保留当前页面输入。'}},{deep:true,flush:'sync'})
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
    if(pending.persisted&&await workbenchPendingBindingHash(pending.persisted)!==pending.persisted.bindingHash)throw Error('保存恢复记录的绑定校验失败，原输入保留。');if(token!==epoch)return
    if(pending.provider!==reader)throw Error('保存来源已变化，原输入保留，需核对原操作。')
    if(!pending.receipt&&reader.status){const operation=await reader.status(target,pending.operationId,controller.signal);if(token!==epoch)return;if(operation.state==='rejected'){releaseAttempt(target,pending);if(!draft.value)draft.value=copyWorkbench(cached??pending.document);phase.value='ready';error.value='服务器已明确拒绝本次保存，原输入保留；请核对后明确重新保存。';return}if(operation.state==='completed'&&operation.receipt){verifySaved(operation.receipt,target,pending);pending.receipt=operation.receipt}}
    const value=await reader.read(target,controller.signal);if(token!==epoch)return
    if(!pending.receipt)throw Error('尚未取得本次操作的完成回执，原输入保留，请稍后核对。')
    verifySaved(pending.receipt,target,pending);verifyReadback(value,pending.receipt,target)
    if(!draft.value)draft.value=copyWorkbench(cached??pending.document)
    releaseAttempt(target,pending);apply(value,artCanonical(draft.value)!==artCanonical(pending.document));retained.get(target.source)?.delete(key(target));return
   }
   const value=await reader.read(target,controller.signal);if(token!==epoch)return
   apply(value,dirty.value)
   if(cached){draft.value=copyWorkbench(cached);error.value='已恢复该工程未保存草稿，请核对后保存。'}
  }catch(e){if(token===epoch){if(pending){draft.value=draft.value??input??copyWorkbench(cached??pending.document);phase.value='unknown'}else phase.value='error';error.value=e instanceof Error?e.message:'工作台读取失败'}}
 }
 function initialize(norm:{hash:string;version:number}){const target=context.value;if(!target||phase.value!=='ready'||hash.value!==null||draft.value)return;draft.value={schemaVersion:'art-workbench-v1',projectId:target.projectId,projectPath:target.projectPath,version:1,norm:copyWorkbench(norm),projectReferences:[],specs:[],needs:[]}}
 async function save(){
  const target=context.value,writer=provider.value;if(!target||!writer||!draft.value||hash.value===undefined||busy.value||taskPending.value||phase.value==='unknown'||attempts.get(target.source)?.has(key(target)))return
  try{validateWorkbenchDocument(draft.value,target.projectId,target.projectPath)}catch(e){error.value=(e as Error).message;return}
  const document=copyWorkbench(draft.value),expectedHash=hash.value,operationId='art-save-'+crypto.randomUUID().replaceAll('-',''),token=++epoch,attempt:SaveAttempt={provider:writer,operationId,document,version:(base.value?.version??0)+1}
  controller=new AbortController();phase.value='saving';error.value=''
  try{if(writer.endpoint){
   if(readPendingWorkbenchWrite(storage(),writer.endpoint,target.projectId,target.projectPath))throw Error('此工程已有未核对的保存，未发送新请求。')
   const record:PendingWorkbenchWrite={schemaVersion:'art-workbench-pending-v1',endpoint:writer.endpoint,projectId:target.projectId,projectPath:target.projectPath,input:{operationId,expectedHash,approved:true,document},baseVersion:base.value?.version??0,base:copyWorkbench(base.value),draft:copyWorkbench(document),bindingHash:'0'.repeat(64)}
   record.bindingHash=await workbenchPendingBindingHash(record);if(token!==epoch)return;record.draft=copyWorkbench(draft.value??document);persistPendingWorkbenchWrite(storage(),record);attempt.persisted=record
  }}catch(e){if(token===epoch){phase.value='unknown';error.value='无法可靠建立保存恢复记录，未发送请求。'+(e instanceof Error?e.message:'')}return}
  map(attempts,target.source).set(key(target),attempt);map(retained,target.source).set(key(target),copyWorkbench(document))
  try{
   const saved=await writer.save(target,{document,expectedHash,operationId,approved:true},controller.signal);verifySaved(saved,target,attempt);attempt.receipt=saved;if(token!==epoch)return
   const receipt=await writer.read(target,controller.signal);if(token!==epoch)return;verifyReadback(receipt,saved,target)
   releaseAttempt(target,attempt);apply(receipt,artCanonical(draft.value)!==artCanonical(document));retained.get(target.source)?.delete(key(target))
  }catch(e){if(e instanceof WorkbenchRequestError&&e.outcome==='rejected'&&!attempt.receipt){try{releaseAttempt(target,attempt)}catch{if(token===epoch){phase.value='unknown';error.value='服务器已拒绝，但保存恢复记录未能清除；保留原输入，请核对。'}return}if(token===epoch){phase.value='ready';error.value=e.message}return}if(token===epoch){phase.value='unknown';error.value='保存结果需核对，未自动重发。'+(e instanceof Error?e.message:'')}}
 }

 function persistTasks(target:WorkbenchContext,writer:WorkbenchProvider,rows:WorkbenchTaskEntry[]){if(!writer.endpoint)throw Error('缺少受信任的工作台来源，未提交准备任务。');persistWorkbenchTaskLedger(storage(),{schemaVersion:'art-workbench-tasks-v1',endpoint:writer.endpoint,projectId:target.projectId,projectPath:target.projectPath,entries:copyWorkbench(rows)})}
 const canPrepareTasks=computed(()=>!!provider.value?.createTask&&!!provider.value?.endpoint&&!!capabilities.value?.preparedTasks&&!!base.value&&!!hash.value&&!dirty.value&&!busy.value&&!taskPending.value&&phase.value==='ready')
 function acceptTask(result:WorkbenchTaskReceipt,target:WorkbenchContext,entry:WorkbenchTaskEntry){
  if(result.projectId!==target.projectId||result.projectPath!==target.projectPath||result.operationId!==entry.operationId||(result.needId!==null&&result.needId!==entry.needId))throw Error('准备任务回执身份不匹配。')
  if(result.state==='created'||result.state==='already-linked'){
   const before=entry.before,receipt=result.workbench,jobId=result.jobId
   if(!before||!receipt?.document||!receipt.hash||!jobId||result.runId!==jobId)throw Error('准备任务或关联回执未确认。')
   validateWorkbenchDocument(receipt.document,target.projectId,target.projectPath)
   const expected=copyWorkbench(before),need=expected.needs.find(row=>row.id===entry.needId);if(!need)throw Error('原需求快照不存在。')
   if(!need.jobId){need.jobId=jobId;need.version++;expected.version++}else if(need.jobId!==jobId)throw Error('准备任务关联发生变化。')
   if(artCanonical(receipt.document)!==artCanonical(expected))throw Error('准备任务关联回执与原需求快照不匹配，保留原操作。')
   if(base.value&&hash.value!==entry.expectedHash&&artCanonical(base.value)!==artCanonical(receipt.document))throw Error('当前工作台已变化，保留原操作并等待核对。')
   entry.state=result.state;entry.jobId=jobId;entry.runId=result.runId;entry.snapshotHash=result.snapshotHash;entry.code=result.code
   apply(receipt,dirty.value)
  }else{entry.state=result.state;entry.runId=result.runId;entry.snapshotHash=result.snapshotHash;entry.code=result.code}
 }
 async function dispatchTaskRows(rows:WorkbenchTaskEntry[],pendingRows:WorkbenchTaskEntry[]){
  const target=context.value,writer=provider.value;if(!target||!writer?.createTask||!canPrepareTasks.value)return
  const token=epoch;taskBusy.value=true;taskError.value=''
  try{
   for(const entry of pendingRows){
    if(token!==epoch||context.value!==target||provider.value!==writer||dirty.value||phase.value!=='ready')break
    const need=base.value?.needs.find(row=>row.id===entry.needId)
    if(!need||need.jobId||need.spec.category!=='icon'||!base.value?.specs.some(spec=>artCanonical(spec)===artCanonical(need.spec))){entry.state='rejected';entry.code=need?.spec.category!=='icon'?'ART_WORKBENCH_CATEGORY_UNSUPPORTED':'ART_WORKBENCH_SPEC_STALE';persistTasks(target,writer,rows);continue}
    entry.before=copyWorkbench(base.value!);entry.expectedHash=hash.value!;entry.state='submitting'
    try{
     persistTasks(target,writer,rows)
     const result=await writer.createTask(target,{operationId:entry.operationId,expectedHash:entry.expectedHash,needId:entry.needId,preparedOnly:true,referenceMode:'evidence-only',approved:true},new AbortController().signal)
     if(token!==epoch||context.value!==target||provider.value!==writer){entry.state='unknown';persistTasks(target,writer,rows);break}
     acceptTask(result,target,entry);persistTasks(target,writer,rows)
     if(result.state==='unknown')break
    }catch(error){entry.state='unknown';entry.code='ART_WORKBENCH_TASK_OUTCOME_UNCONFIRMED';persistTasks(target,writer,rows);if(token===epoch)taskError.value='准备任务结果需核对，后续项未提交；保留原操作，不重发。'+(error instanceof Error?error.message:'');break}
   }
  }catch(error){if(token===epoch){taskStorageBlocked.value=true;taskError.value='准备任务恢复记录无法可靠保存，已停止后续请求。'+(error instanceof Error?error.message:'')}}
  finally{if(token===epoch)taskBusy.value=false}
 }
 async function createPreparedTasks(needIds:string[],approved=false){
  if(!approved||!canPrepareTasks.value)return
  const ids=[...new Set(needIds)];if(!ids.length||ids.length>100||taskResults.value.length+ids.length>100){taskError.value='请选择有效需求，恢复记录最多保留 100 项。';return}
  const additions:WorkbenchTaskEntry[]=ids.map(id=>({needId:id,name:base.value?.needs.find(need=>need.id===id)?.name??id,operationId:'art-save-'+crypto.randomUUID().replaceAll('-',''),state:'not-started'}))
  taskResults.value.push(...additions);const rows=taskResults.value
  try{persistTasks(context.value!,provider.value!,rows)}catch{taskStorageBlocked.value=true;taskError.value='恢复记录未能写入，未发送准备任务请求。';return}
  await dispatchTaskRows(rows,rows.slice(-additions.length))
 }
 async function continuePreparedTasks(approved=false){if(approved&&canPrepareTasks.value)await dispatchTaskRows(taskResults.value,taskResults.value.filter(row=>row.state==='not-started'))}
 async function inspectPreparedTask(operationId:string,reconcile=false,approved=false){
  const target=context.value,writer=provider.value,entry=taskResults.value.find(row=>row.operationId===operationId)
  if(!target||!writer||!entry||entry.state!=='unknown'||busy.value||reconcile&&!approved||!writer.taskStatus||reconcile&&!writer.reconcileTask)return
  const token=epoch;taskBusy.value=true;taskError.value=''
  try{const result=await (reconcile?writer.reconcileTask!(target,operationId,new AbortController().signal):writer.taskStatus(target,operationId,new AbortController().signal));if(token!==epoch||context.value!==target||writer!==provider.value)return;acceptTask(result,target,entry);persistTasks(target,writer,taskResults.value);if(entry.state==='unknown')taskError.value=result.observation?'已查到原任务，需求关联尚未完成；请明确核对并完成原关联。':'原操作结果仍未知，未重发。'}catch(error){if(token===epoch)taskError.value='原操作核对失败，未创建新任务。'+(error instanceof Error?error.message:'')}
  finally{if(token===epoch)taskBusy.value=false}
 }

 function leave(){bind(null,null)}
 return {context,provider,draft,base,hash,phase,error,capabilities,dirty,busy,bind,read,initialize,save,leave,setPendingStorage,taskResults,taskBusy,taskPending,taskError,canPrepareTasks,createPreparedTasks,continuePreparedTasks,inspectPreparedTask}
})
