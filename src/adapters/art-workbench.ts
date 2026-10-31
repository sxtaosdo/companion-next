import {antToolbarScope} from '../domain/ant-toolbar-scope'
import { validateWorkbenchDocument, workbenchEndpoint, WORKBENCH_IMAGE_CONDITIONING_PROJECT, type WorkbenchReferenceMode, type WorkbenchDocument, type WorkbenchReceipt, type WorkbenchOperation, type WorkbenchTaskReceipt } from '../domain/art-workbench'
import {checkResourceDomainIdentity,resourceDomainRoute,type ResourceDomainContext} from '../domain/art-resource-domains'
import { isAiJobId } from '../domain/ai-jobs-read'
export class WorkbenchRequestError extends Error { constructor(readonly outcome:'rejected'|'unknown',message:string){super(message)} }
export interface WorkbenchContext extends ResourceDomainContext {readOnly?:boolean; projectId:string;projectPath:string;source:object }
export interface WorkbenchProvider {
 readonly endpoint?:string
 read(context:WorkbenchContext,signal:AbortSignal):Promise<WorkbenchReceipt>
 save(context:WorkbenchContext,input:{operationId:string;expectedHash:string|null;approved:true;document:WorkbenchDocument;resourceDomainId?:string;expectedProjectSettingsHash?:string},signal:AbortSignal):Promise<WorkbenchReceipt>
 status?(context:WorkbenchContext,operationId:string,signal:AbortSignal):Promise<WorkbenchOperation>
 createTask?(context:WorkbenchContext,input:{operationId:string;expectedHash:string;needId:string;preparedOnly:true;referenceMode:WorkbenchReferenceMode;approved:true},signal:AbortSignal):Promise<WorkbenchTaskReceipt>
 taskStatus?(context:WorkbenchContext,operationId:string,signal:AbortSignal):Promise<WorkbenchTaskReceipt>
 reconcileTask?(context:WorkbenchContext,operationId:string,signal:AbortSignal):Promise<WorkbenchTaskReceipt>
}
export function createWorkbenchProvider(fetcher:typeof fetch,origin?:string):WorkbenchProvider {
 function route(context:WorkbenchContext){if(!/^[a-f0-9]{16}$/.test(context.projectId))throw Error('无效工程');return resourceDomainRoute(context.projectId,context.resourceDomainId)+'/workbench'}
 async function request(path:string,signal:AbortSignal,input?:unknown){
  const response=await fetcher(path,{method:input?'POST':'GET',credentials:'same-origin',redirect:'error',headers:input?{'content-type':'application/json'}:{},body:input?JSON.stringify(input):undefined,signal})
  const raw=await response.text();if(raw.length>1024*1024)throw Error('工作台响应超限')
  if(!response.ok){
   let code='';try{const body=JSON.parse(raw);if(typeof body?.code==='string'&&/^[A-Z][A-Z0-9_]{1,79}$/.test(body.code))code=body.code}catch{}
   const rejectedCodes=['ART_INPUT_INVALID','ART_PROJECT_INVALID','ART_PROJECT_NOT_REGISTERED','ART_CONFIG_STALE','ART_CONFIG_BUSY','ART_REFERENCE_INVALID','ART_REFERENCE_STALE','ART_WRITE_REJECTED','ART_WORKBENCH_2D_NORM_REQUIRED','ART_WORKBENCH_NORM_MIGRATION_REQUIRED','ART_WORKBENCH_JOBS_UNAVAILABLE','ART_WORKBENCH_JOB_BINDING_MISMATCH','ART_WORKBENCH_SPEC_BINDING_INVALID','ART_WORKBENCH_DUPLICATE_ID','ART_WORKBENCH_SPEC_REQUIRED','ART_WORKBENCH_VERSION_INVALID','ART_WORKBENCH_SPEC_STALE','ART_WORKBENCH_LINKED_NEED_IMMUTABLE']
   const rejected=rejectedCodes.includes(code)
   throw new WorkbenchRequestError(rejected?'rejected':'unknown','工作台请求'+(rejected?'被拒绝':'结果需核对')+'（'+response.status+(code?' · '+code:'')+'）。原输入保留，未自动重发。')
  }
  return JSON.parse(raw)
 }
 function receipt(value:unknown,context:WorkbenchContext):WorkbenchReceipt{
  const result=value as WorkbenchReceipt
  checkResourceDomainIdentity(result,context);if(context.resourceDomainId&&(!/^[a-f0-9]{64}$/.test(result.projectSettingsHash??'')||result.binding!==null))throw Error('资源域技术或目录回执不匹配')
  if(!result||result.projectId!==context.projectId||result.projectPath!==context.projectPath||!result.capabilities||result.capabilities.generation!==false||result.capabilities.imageConditioning!==false||typeof result.capabilities.referenceUpload!=='boolean'||typeof result.capabilities.existingJobLink!=='boolean')throw Error('工作台回执不匹配')
  if(result.sharedAccess){const s=result.sharedAccess;if(s.ownerScope!=='shared'||s.resourceDomainId!=='shared'||s.normRoute!==resourceDomainRoute(context.projectId,'shared')||s.workbenchRoute!==resourceDomainRoute(context.projectId,'shared')+'/workbench'||[s.normHash,s.workbenchHash].some(hash=>hash!==null&&!/^[a-f0-9]{64}$/.test(hash)))throw Error('公共资源指针不匹配')}
  if(result.document){if(context.resourceDomainId&&result.document.projectSettingsHash!==result.projectSettingsHash)throw Error('工程设置回执不匹配');if(!result.hash||!/^[a-f0-9]{64}$/.test(result.hash))throw Error('工作台哈希无效');validateWorkbenchDocument(result.document,context.projectId,context.projectPath,context.resourceDomainId)}else if(result.hash!==null)throw Error('工作台回执无效')
  if(result.operation&&(!/^art-save-[a-f0-9]{32}$/.test(result.operation.operationId)||!/^[a-f0-9]{64}$/.test(result.operation.bindingHash)||result.operation.state!=='completed'))throw Error('工作台操作回执无效')
  const tasks=result.capabilities.preparedTasks;if(tasks&&(tasks.maxBatch!==1||typeof tasks.imageConditioning!=='boolean'||!Array.isArray(tasks.categories)||tasks.categories.length!==1||tasks.categories[0]!=='icon'))throw Error('准备任务能力回执无效')
  if(tasks?.referenceModes&&(!Array.isArray(tasks.referenceModes)||tasks.referenceModes.length<1||tasks.referenceModes.length>2||new Set(tasks.referenceModes).size!==tasks.referenceModes.length||!tasks.referenceModes.includes('evidence-only')||tasks.referenceModes.some(mode=>!['evidence-only','image-conditioning'].includes(mode))))throw Error('准备任务参考模式无效')
  if(tasks&&(tasks.imageConditioning!==(tasks.referenceModes?.includes('image-conditioning')??false)||tasks.imageConditioning&&context.projectId!==WORKBENCH_IMAGE_CONDITIONING_PROJECT&&!antToolbarScope(context.projectId,context.resourceDomainId)))throw Error('参考条件能力与工程不匹配')
  return result
 }
 function task(value:unknown,context:WorkbenchContext,operationId:string):WorkbenchTaskReceipt{
  const result=value as WorkbenchTaskReceipt
  checkResourceDomainIdentity(result,context)
  if(!result||result.resourceDomainId!==context.resourceDomainId||result.projectId!==context.projectId||result.projectPath!==context.projectPath||result.operationId!==operationId||!['created','already-linked','rejected','unknown'].includes(result.state)||(result.needId!==null&&(typeof result.needId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(result.needId)))||(result.runId!==null&&!isAiJobId(result.runId))||(result.snapshotHash!==null&&!/^[a-f0-9]{64}$/.test(result.snapshotHash))||(result.code!==undefined&&!/^[A-Z][A-Z0-9_]{1,79}$/.test(result.code)))throw Error('准备任务回执无效')
  if(result.state==='created'||result.state==='already-linked'){if(!isAiJobId(result.jobId)||result.jobId!==result.runId||!result.needId||result.state==='created'&&!result.snapshotHash)throw Error('准备任务身份未确认');result.workbench=receipt(result.workbench,context);if(!result.workbench.document?.needs.some(need=>need.id===result.needId&&need.jobId===result.jobId))throw Error('准备任务尚未关联到需求')}
  if(result.observation&&(!isAiJobId(result.observation.jobId)||result.observation.verified!==true||typeof result.observation.state!=='string'||result.observation.state.length>80))throw Error('准备任务观察无效')
  return result
 }
 function taskRoute(context:WorkbenchContext,operationId:string){if(!/^art-save-[a-f0-9]{32}$/.test(operationId))throw Error('无效准备任务操作');return route(context)+'/tasks/operations/'+operationId}
 return {
  ...(origin?{endpoint:workbenchEndpoint(origin)}:{}),
  read:async(context,signal)=>receipt(await request(route(context),signal),context),
  save:async(context,input,signal)=>receipt(await request(route(context),signal,input),context),
  status:async(context,operationId,signal)=>{
   if(!/^art-save-[a-f0-9]{32}$/.test(operationId))throw Error('无效工作台操作')
   const result=await request(route(context)+'/operations/'+operationId,signal) as WorkbenchOperation
   if(!result||result.resourceDomainId!==context.resourceDomainId||result.projectId!==context.projectId||result.projectPath!==context.projectPath||result.operationId!==operationId||!['pending','completed','rejected'].includes(result.state))throw Error('工作台操作状态不匹配')
   if(result.state==='completed')result.receipt=receipt(result.receipt,context)
   return result
  },
  createTask:async(context,input,signal)=>task(await request(route(context)+'/tasks',signal,input),context,input.operationId),
  taskStatus:async(context,operationId,signal)=>task(await request(taskRoute(context,operationId),signal),context,operationId),
  reconcileTask:async(context,operationId,signal)=>task(await request(taskRoute(context,operationId)+'/reconcile',signal,{approved:true}),context,operationId),
 }
}
