import type {WorkflowBusinessType,WorkflowDeliveryMode,WorkflowOperationRecord,WorkflowOperationProvider} from './workflow-operation'
export interface GoalPayload {title:string;description:string;projectId:string;businessType:WorkflowBusinessType;deliveryMode?:WorkflowDeliveryMode;operationId:string}
type Phase='submitting'|'unknown'|'settled'|'rejected'
export interface GoalDraftReceipt {schemaVersion:1;operationId:string;payload:GoalPayload;requestDigest:string;phase:Phase;workflowId?:string}
type StoragePort=Pick<Storage,'getItem'|'setItem'>
const activeKey='companion.workflow-create.active.v1',prefix='companion.workflow-create.receipt.v1.',indexKey='companion.workflow-create.index.v1'
const types=['game','mcp','other']
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v)
export async function goalPayloadDigest(payload:GoalPayload){const bytes=new TextEncoder().encode(JSON.stringify([payload.operationId,payload.businessType,payload.projectId,payload.title,payload.description,...(payload.deliveryMode===undefined?[]:[payload.deliveryMode])]));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')}
/** Separate durable create receipts; never reads/writes execution pending or lane keys. */
export class GoalDraftController {
 receipt:GoalDraftReceipt|null=null
 private raw:string|null=null
 private inFlight:Promise<WorkflowOperationRecord>|null=null
 constructor(private storage:StoragePort|null,private digest=goalPayloadDigest){
  if(!storage)return
  const op=storage.getItem(activeKey);if(!op)return
  if(!uuid(op))throw Error('创建草稿标识不可读；原记录保留。')
  this.raw=storage.getItem(prefix+op);if(!this.raw)throw Error('创建回执缺失；不能重发原请求。')
  const r=JSON.parse(this.raw) as GoalDraftReceipt
  if(r.schemaVersion!==1||r.operationId!==op||r.payload?.operationId!==op||!types.includes(r.payload.businessType)||(r.payload.deliveryMode!==undefined&&!['sample','source-patch'].includes(r.payload.deliveryMode))||!r.payload.projectId||typeof r.payload.title!=='string'||typeof r.payload.description!=='string'||!/^[a-f0-9]{64}$/.test(r.requestDigest)||!['submitting','unknown','settled','rejected'].includes(r.phase))throw Error('创建回执不可读；原记录保留。')
  this.receipt={...r,phase:r.phase==='submitting'?'unknown':r.phase}
 }
 private async persist(next:GoalDraftReceipt){
  const locks=typeof navigator==='undefined'?undefined:navigator.locks
  if(locks)return locks.request('companion.workflow-create.receipts.v1',()=>this.persistNow(next))
  if(typeof window!=='undefined'&&this.storage===window.localStorage)throw Error('当前浏览器无法安全协调跨标签草稿，未重复提交。')
  this.persistNow(next)
 }
 private persistNow(next:GoalDraftReceipt){
  if(!this.storage)throw Error('无法可靠保存创建请求，未提交。')
  const key=prefix+next.operationId
  if(this.storage.getItem(key)!==(this.receipt?.operationId===next.operationId?this.raw:null))throw Error('创建回执已变化，保留原请求，不重复提交。')
  const raw=JSON.stringify(next);this.storage.setItem(key,raw)
  if(this.storage.getItem(key)!==raw)throw Error('创建回执写入未确认，未重复提交。')
  this.storage.setItem(activeKey,next.operationId)
  if(this.storage.getItem(activeKey)!==next.operationId)throw Error('创建请求索引未确认，未重复提交。')
  const rawIndex=this.storage.getItem(indexKey);let ids=rawIndex?JSON.parse(rawIndex) as string[]:[]
  if(!Array.isArray(ids)||ids.some(id=>!uuid(id))||ids.length>50)throw Error('创建回执索引不可读，原记录保留。')
  if(['submitting','unknown'].includes(next.phase)){if(!ids.includes(next.operationId)){if(ids.length===50)throw Error('未确认创建回执已达上限，请先核对原记录。');ids.push(next.operationId)}}else ids=ids.filter(id=>id!==next.operationId)
  const index=JSON.stringify(ids);this.storage.setItem(indexKey,index)
  if(this.storage.getItem(indexKey)!==index)throw Error('创建回执索引写入未确认。')
  this.raw=raw;this.receipt=next
 }
 unresolved(){
  const raw=this.storage?.getItem(indexKey);if(!raw)return []
  const ids=JSON.parse(raw) as string[];if(!Array.isArray(ids)||ids.length>50||ids.some(id=>!uuid(id)))throw Error('创建回执索引不可读。')
  return ids.flatMap(id=>{const value=this.storage!.getItem(prefix+id);if(!value)throw Error('创建回执索引不完整。');const r=JSON.parse(value) as GoalDraftReceipt;if(r.operationId!==id||r.payload?.operationId!==id)throw Error('创建回执身份不匹配。');return ['unknown','submitting'].includes(r.phase)?[r]:[]})
 }
 selectReceipt(operationId:string){
  if(this.inFlight||!this.storage||!uuid(operationId))throw Error('不能切换当前提交。')
  const raw=this.storage.getItem(prefix+operationId);if(!raw)throw Error('原创建回执不存在。')
  const r=JSON.parse(raw) as GoalDraftReceipt;if(r.operationId!==operationId||r.payload?.operationId!==operationId)throw Error('原创建回执不匹配。')
  this.raw=raw;this.receipt={...r,phase:r.phase==='submitting'?'unknown':r.phase};return this.receipt
 }
 submit(payload:GoalPayload,provider:WorkflowOperationProvider):Promise<WorkflowOperationRecord>{
  if(this.inFlight)return this.inFlight
  if(this.receipt?.operationId===payload.operationId)return Promise.reject(Error('原创建请求已保留，请先查询原回执；不重新提交。'))
  const work=async()=>{
   if(!uuid(payload.operationId)||!types.includes(payload.businessType)||!payload.deliveryMode||!['sample','source-patch'].includes(payload.deliveryMode)||!payload.projectId||!payload.title.trim()||payload.title.length>160||payload.description.length>8000)throw Error('创建目标输入无效。')
   const frozen=Object.freeze({...payload}),requestDigest=await this.digest(frozen)
   await this.persist({schemaVersion:1,operationId:payload.operationId,payload:{...frozen},requestDigest,phase:'submitting'})
   try{
    const record=await provider.createGoal(frozen)
    this.validate(record,frozen)
    if(record.state!=='draft'||record.plan!==null||record.review!==null||record.activeRunId!==null||record.runs.length)throw Error('创建结果不是独立草稿，保留原请求待核对。')
    await this.persist({...this.receipt!,phase:'settled',workflowId:record.id});return record
   }catch(error){
    const rejected=error instanceof Error&&'outcome' in error&&(error as {outcome?:string}).outcome==='rejected'
    await this.persist({...this.receipt!,phase:rejected?'rejected':'unknown'});throw error
   }
  }
  this.inFlight=work().finally(()=>{this.inFlight=null});return this.inFlight
 }
 private validate(record:WorkflowOperationRecord,p:GoalPayload){if(!record?.id||record.projectId!==p.projectId||record.businessType!==p.businessType||(p.deliveryMode!==undefined&&record.deliveryMode!==p.deliveryMode))throw Error('创建回执身份不匹配，保留原请求。')}
 async reconcile(provider:WorkflowOperationProvider){
  const r=this.receipt;if(!r||this.inFlight)throw Error('没有可查询的原创建请求。')
  if(await this.digest(r.payload)!==r.requestDigest)throw Error('原创建请求摘要不匹配，不能重发。')
  const op=await provider.getOperation(r.operationId,r.workflowId)
  if(op.operationId!==r.operationId||op.state!=='settled'||!op.record||op.workflowId!==op.record.id||r.workflowId&&op.workflowId!==r.workflowId)throw Error('原创建结果尚未确认；不重发。')
  this.validate(op.record,r.payload);await this.persist({...r,phase:'settled',workflowId:op.record.id});return op.record
 }
}
