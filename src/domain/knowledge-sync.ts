import { KNOWLEDGE_SCHEMA, KNOWLEDGE_POLICY_REASONS } from './knowledge-read'
import type { KnowledgeChannel, KnowledgePolicyReason, KnowledgeSource, KnowledgeStatus } from './knowledge-read'
export type KnowledgeSyncOperation = 'dry-run' | 'run'
export interface KnowledgeSyncRequest { sourceId: string; channel: KnowledgeChannel }
export type KnowledgeSyncPlan = { [key: string]: string | number | boolean | KnowledgeSyncPlan | KnowledgeSyncPlan[] }
export interface KnowledgeSyncReply { plan: KnowledgeSyncPlan }
export type KnowledgeSyncOutcome = 'not-dispatched' | 'rejected' | 'unknown'
export type KnowledgeSyncCode = 'aborted' | 'busy' | 'invalid-input' | 'invalid-shape' | 'response-too-large' | 'network-error' | 'timeout' | 'forbidden' | 'rejected' | 'unconfirmed'
export type KnowledgeSyncBackendCode = 'POLICY_DENIED' | 'WRITER_DISABLED' | 'SOURCE_NOT_APPROVED' | 'AUTH_DENIED' | 'AUTH_MISSING' | 'BUSY' | 'SCHEMA_INVALID' | 'SYNC_OUTCOME_UNKNOWN' | 'UPSTREAM_UNAVAILABLE' | 'TIMEOUT' | 'CANCELLED' | 'OUTPUT_LIMIT'
const failures: Record<KnowledgeSyncCode,string> = {aborted:'已停止等待；已发送的同步是否入队仍未确认。',busy:'上一笔同步请求尚未结束，请等待。','invalid-input':'同步来源或通道不符合原接口合同。','invalid-shape':'同步回执格式或来源不匹配，不能当作成功。','response-too-large':'同步回执超过读取上限。','network-error':'同步连接中断，结果未确认。',timeout:'同步等待超时，结果未确认。',forbidden:'Companion 会话已拒绝本次请求。',rejected:'服务明确拒绝本次同步请求。',unconfirmed:'同步结果未确认；请刷新状态核对任务与 SHA，不自动重发。'}
export const syncPolicyText: Record<KnowledgePolicyReason,string> = {no_source:'同步未开放：尚无已登记来源。',not_approved:'该来源尚未批准，不能运行写入。',writer_disabled:'同步 writer 当前关闭。',credential_missing:'服务端同步写入凭据未就绪；本页不接收或修改凭据。',network_disabled:'该来源网络策略未开放。',retention_review:'该来源保留策略待审核。',delete_limit:'本批删除数量超过策略限制。',scope_changed:'来源范围已变化，需重新审核。',prior_batch:'先前批次尚未完成，请核对任务状态。',checkpoint_mismatch:'来源检查点不匹配，请核对任务和 SHA。'}
export class KnowledgeSyncError extends Error {
  constructor(readonly code:KnowledgeSyncCode,readonly outcome:KnowledgeSyncOutcome,readonly backendCode?:KnowledgeSyncBackendCode,readonly status?:number,readonly reason?:KnowledgePolicyReason){super(reason?syncPolicyText[reason]:outcome==='not-dispatched'&&code==='aborted'?'已取消，未发送同步请求。':failures[code]);this.name='KnowledgeSyncError'}
}
export const KNOWLEDGE_SYNC_LIMITS=Object.freeze({maxResponseBytes:2*1024*1024,maxResponseChunks:4096,maxTimeoutMs:75_000,defaultTimeoutMs:75_000})
export interface KnowledgeSyncProvider {readonly label:string;sync(operation:KnowledgeSyncOperation,input:KnowledgeSyncRequest,signal?:AbortSignal):Promise<KnowledgeSyncReply>;waitForIdle():Promise<void>}
export function normalizeKnowledgeSyncRequest(value:unknown):KnowledgeSyncRequest {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new KnowledgeSyncError('invalid-input','not-dispatched')
  const descriptors=Object.getOwnPropertyDescriptors(value)
  if(Reflect.ownKeys(value).some(k=>typeof k!=='string'||!['sourceId','channel'].includes(k))||Object.values(descriptors).some(d=>!('value'in d)))throw new KnowledgeSyncError('invalid-input','not-dispatched')
  const sourceId=descriptors.sourceId?.value,channel=descriptors.channel?.value
  if(typeof sourceId!=='string'||! /^[a-zA-Z0-9_.-]{1,100}$/.test(sourceId)||(channel!=='local'&&channel!=='official'))throw new KnowledgeSyncError('invalid-input','not-dispatched')
  return {sourceId,channel}
}
/** Mirrors old updateControls: retrieval CLI/auth is independent of sync. */
export function canKnowledgeSync(status:KnowledgeStatus|null,source:KnowledgeSource|undefined,write:boolean):boolean {
  const current=source&&status?.sync.sources.find(s=>s.id===source.id&&s.channel===source.channel)
  return Boolean(status?.sync.available&&current&&(!write||(status.sync.writerEnabled&&current.approved===true&&current.enabled===true&&current.writerReady===true)))
}
const object=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
const invalid=()=>new KnowledgeSyncError('invalid-shape','unknown')
/** Same bounded provenance/counters as original backend projector; omit unknown content/config. */
function plan(value:unknown,depth=0):KnowledgeSyncPlan {
  if(!object(value))throw invalid()
  if(depth>4)return {}
  const out:KnowledgeSyncPlan={}
  for(const key of ['sourceId','source_id','repoId','repo_id'])if(value[key]!==undefined){if(typeof value[key]!=='string'||! /^[a-zA-Z0-9_.-]{1,100}$/.test(value[key]))throw invalid();out[key]=value[key]}
  for(const key of ['commit','commit_sha','targetSha','completedSha','targetSHA','completedSHA','blobSha','blob_sha','source_commit','baseline_commit'])if(value[key]!==undefined){if(typeof value[key]!=='string'||! /^[a-f0-9]{40,64}$/i.test(value[key]))throw invalid();out[key]=value[key]}
  for(const key of ['pending','added','updated','removed','excluded','unchanged','total','count'])if(value[key]!==undefined){if(!Number.isSafeInteger(value[key])||(value[key] as number)<0)throw invalid();out[key]=value[key] as number}
  const choices:Record<string,readonly unknown[]>={channel:['local','official'],queuedOnly:[true,false],writePerformed:[true,false],jobState:['queued','pending','running','blocked','done','unknown','cancelled'],status:['pending','complete','completed','blocked','dry-run','unchanged'],action:['add','create','update','remove','delete','exclude','unchanged']}
  for(const [key,allowed]of Object.entries(choices))if(value[key]!==undefined){if(!allowed.includes(value[key]))throw invalid();out[key]=value[key] as string|boolean}
  for(const key of ['jobId','persistedJobId'])if(value[key]!==undefined){if(typeof value[key]!=='string'||! /^[a-zA-Z0-9_.:-]{1,128}$/.test(value[key]))throw invalid();out[key]=value[key]}
  if(value.path!==undefined){if(typeof value.path!=='string'||value.path.length>512||/^(?:[a-z]:|[\\/])/i.test(value.path)||/^[a-z][a-z0-9+.-]*:/i.test(value.path)||/[?#@]/.test(value.path)||value.path.split(/[\\/]/).includes('..')||/[\u0000-\u001f\u007f]/u.test(value.path))throw invalid();out.path=value.path}
  for(const key of ['summary','counts','manifest','changes'])if(value[key]!==undefined)out[key]=plan(value[key],depth+1)
  for(const key of ['files','documents','items','actions','exclusions'])if(value[key]!==undefined){if(!Array.isArray(value[key])||value[key].length>100)throw invalid();out[key]=value[key].map(v=>plan(v,depth+1))}
  return out
}
export function decodeKnowledgeSyncReply(value:unknown,operation:KnowledgeSyncOperation,input:KnowledgeSyncRequest):KnowledgeSyncReply {
  if(!object(value)||value.schemaVersion!==KNOWLEDGE_SCHEMA)throw invalid()
  const projected=plan(value.plan)
  // Dry-run can legitimately return only a summary, as in original formatKnowledgePlan.
  if(projected.sourceId!==undefined&&projected.sourceId!==input.sourceId||projected.channel!==undefined&&projected.channel!==input.channel)throw invalid()
  if(operation==='run'&&(projected.sourceId!==input.sourceId||projected.channel!==input.channel||typeof projected.jobId!=='string'||typeof projected.targetSHA!=='string'||typeof projected.jobState!=='string'||projected.queuedOnly!==true||projected.writePerformed!==false))throw invalid()
  return {plan:projected}
}
export function knowledgeSyncReason(value:unknown):KnowledgePolicyReason|undefined{return typeof value==='string'&&(KNOWLEDGE_POLICY_REASONS as readonly string[]).includes(value)?value as KnowledgePolicyReason:undefined}
export function formatKnowledgeSyncPlan(value:KnowledgeSyncPlan):string{const text=JSON.stringify(value,null,2);return text==='{}'?'同步计划已返回，但无可展示摘要。':text.length>12_000?text.slice(0,12_000)+'\n…（摘要已截断）':text}
