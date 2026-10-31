import { validLastOpenedAt } from './recent-projects'
export type WorkflowTaskState = 'running' | 'queued' | 'blocked' | 'paused' | 'marked-complete' | 'unverified';
export type WorkflowEvidenceState = 'observed' | 'passed' | 'failed' | 'denied' | 'unverified' | 'expired';
export interface WorkflowProject { id:string; name:string; lastOpenedAt?:number; businessTypes?:Array<'game'|'mcp'|'other'> }
export interface WorkflowSource { id:string; label:string; kind:'gsd'|'openspec'|'delivery-record'|'codex-role'|'kb-entry'|'knowledge-service'|'call-evidence'; state:'available'|'not-configured'|'unavailable'|'unmatched'; projectId?:string; checkedAt:string; version?:string; digest?:string; reason?:string }
export interface WorkflowGoal { id:string; title:string; summary?:string; projectId?:string; sourceId:string; nextDelivery?:string; milestones:Array<{id:string;title:string;state:WorkflowTaskState;taskIds:string[];evidenceIds:string[]}> }
export interface WorkflowTask { id:string; title:string; projectId?:string; goalId?:string; milestoneId?:string; state:WorkflowTaskState; sourceId:string; reason?:string; evidenceIds:string[]; checked?:boolean; observedAt?:string }
export interface WorkflowEvidence { id:string; label:string; kind:'task-mark'|'test'|'uat'|'kb-read'|'preset-config'|'preset-read'|'agent-execution'|'adoption'|'source'; state:WorkflowEvidenceState; sourceId:string; projectId?:string; taskId?:string; phase?:string; at?:string; version?:string; digest?:string; summary?:string; reason?:string; facts:Array<{label:string;value:string}> }
export interface WorkflowReadSnapshot { schemaVersion:'workflow-read-v1'; readOnly:true; observedAt:string; projects:WorkflowProject[]; sources:WorkflowSource[]; goals:WorkflowGoal[]; tasks:WorkflowTask[]; evidence:WorkflowEvidence[] }
export interface WorkflowReadProvider { read(projectId?:string, signal?:AbortSignal):Promise<WorkflowReadSnapshot> }
export const workflowTaskLabels:Record<WorkflowTaskState,string> = { running:'运行中', queued:'排队', blocked:'阻塞', paused:'已暂停', 'marked-complete':'已勾选 · 待验收', unverified:'未知 · 待核对' }
export const workflowEvidenceLabels:Record<WorkflowEvidenceState,string> = { observed:'已观察', passed:'通过', failed:'失败', denied:'拒绝', unverified:'未验证', expired:'证据过期' }
export const workflowKindLabels:Record<WorkflowEvidence['kind'],string> = { 'task-mark':'任务勾选',test:'自动测试',uat:'UAT','kb-read':'知识库读取','preset-config':'预设配置','preset-read':'预设读取','agent-execution':'实际角色调用',adoption:'采纳结果',source:'来源' }
export function workflowTone(state:string):'primary'|'success'|'danger'|'warning'|'info' {
 return state==='running'?'primary':state==='passed'?'success':['failed','denied','blocked'].includes(state)?'danger':['unverified','expired','unmatched','unavailable'].includes(state)?'warning':'info'
}
/** A task mark or configured role is never proof of execution. */
export function displayedTaskState(task:WorkflowTask,snapshot:WorkflowReadSnapshot):WorkflowTaskState {
 return task.state==='running'&&!snapshot.evidence.some(item=>task.evidenceIds.includes(item.id)&&item.taskId===task.id&&item.kind==='agent-execution'&&item.state==='observed'&&item.phase==='running')?'unverified':task.state
}
export class WorkflowReadError extends Error {
 constructor(readonly code:'unauthorized'|'forbidden'|'http-error'|'network-error'|'invalid-shape'|'invalid-query'|'timeout'|'aborted') {
  super({unauthorized:'登录已失效，请重新登录后读取。',forbidden:'无权读取工作流，请核对当前权限。','http-error':'工作流接口读取失败。','network-error':'无法连接工作流读取接口。','invalid-shape':'工作流响应不符合只读契约。','invalid-query':'工程筛选无效。',timeout:'工作流读取超时。',aborted:'工作流读取已取消。'}[code]);this.name=code==='aborted'?'AbortError':'WorkflowReadError'
 }
}
const taskStates=Object.keys(workflowTaskLabels), evidenceStates=Object.keys(workflowEvidenceLabels)
type Row=Record<string,unknown>
const invalid=()=>{throw new WorkflowReadError('invalid-shape')}
function row(v:unknown):Row {return v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Row:invalid()}
function str(v:unknown,max=2048):string {return typeof v==='string'&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(v)?v:invalid()}
function id(v:unknown):string {const s=str(v,256);return s.length>0?s:invalid()}
function optional(v:unknown):string|undefined {return v===undefined?undefined:str(v)}
function time(v:unknown):string {const s=str(v,64);return Number.isFinite(Date.parse(s))?s:invalid()}
function list<T>(v:unknown,decode:(v:unknown)=>T):T[] {return Array.isArray(v)&&v.length<=5000?v.map(decode):invalid()}
function one<T extends string>(v:unknown,allowed:readonly T[]):T {return typeof v==='string'&&allowed.includes(v as T)?v as T:invalid()}
function opt(r:Row,key:string){return r[key]===undefined?{}:{[key]:optional(r[key])}}
function unique<T extends {id:string}>(items:T[]):T[]{return new Set(items.map(item=>item.id)).size===items.length?items:invalid()}
/** Project only declared display fields; never retain an unvalidated server object. */
export function decodeWorkflowRead(value:unknown):WorkflowReadSnapshot {
 const r=row(value);if(r.schemaVersion!=='workflow-read-v1'||r.readOnly!==true)invalid()
 const projects=unique(list(r.projects,v=>{const p=row(v);if(p.lastOpenedAt!==undefined&&!validLastOpenedAt(p.lastOpenedAt))invalid();if(p.businessTypes!==undefined&&(!Array.isArray(p.businessTypes)||p.businessTypes.some(t=>!['game','mcp','other'].includes(String(t)))))invalid();return {id:id(p.id),name:str(p.name),...(p.businessTypes===undefined?{}:{businessTypes:p.businessTypes as Array<'game'|'mcp'|'other'>}),...(p.lastOpenedAt===undefined?{}:{lastOpenedAt:p.lastOpenedAt as number})}}))
 const sources=unique(list(r.sources,v=>{const s=row(v);return {id:id(s.id),label:str(s.label),kind:one(s.kind,['gsd','openspec','delivery-record','codex-role','kb-entry','knowledge-service','call-evidence'] as const),state:one(s.state,['available','not-configured','unavailable','unmatched'] as const),checkedAt:time(s.checkedAt),...opt(s,'projectId'),...opt(s,'version'),...opt(s,'digest'),...opt(s,'reason')}}))
 const goals=unique(list(r.goals,v=>{const g=row(v);return {id:id(g.id),title:str(g.title),sourceId:id(g.sourceId),...opt(g,'projectId'),...opt(g,'summary'),...opt(g,'nextDelivery'),milestones:unique(list(g.milestones,v=>{const m=row(v);return {id:id(m.id),title:str(m.title),state:one(m.state,taskStates as WorkflowTaskState[]),taskIds:list(m.taskIds,id),evidenceIds:list(m.evidenceIds,id)}}))}}))
 const tasks=unique(list(r.tasks,v=>{const t=row(v);if(t.checked!==undefined&&typeof t.checked!=='boolean')invalid();return {id:id(t.id),title:str(t.title),sourceId:id(t.sourceId),state:one(t.state,taskStates as WorkflowTaskState[]),evidenceIds:list(t.evidenceIds,id),...opt(t,'projectId'),...opt(t,'goalId'),...opt(t,'milestoneId'),...opt(t,'reason'),...(t.checked===undefined?{}:{checked:t.checked as boolean}),...(t.observedAt===undefined?{}:{observedAt:time(t.observedAt)})}}))
 const evidence=unique(list(r.evidence,v=>{const e=row(v);return {id:id(e.id),label:str(e.label),kind:one(e.kind,Object.keys(workflowKindLabels) as WorkflowEvidence['kind'][]),state:one(e.state,evidenceStates as WorkflowEvidenceState[]),sourceId:id(e.sourceId),...opt(e,'projectId'),...opt(e,'taskId'),...opt(e,'phase'),...(e.at===undefined?{}:{at:time(e.at)}),...opt(e,'version'),...opt(e,'digest'),...opt(e,'summary'),...opt(e,'reason'),facts:list(e.facts,v=>{const f=row(v);return {label:str(f.label),value:str(f.value)}})}}))
 return {schemaVersion:'workflow-read-v1',readOnly:true,observedAt:time(r.observedAt),projects,sources,goals,tasks,evidence}
}
// GET /api/workflow/read?project=<registered project id> ; no project means cross-project overview.
// HTTP request strictly reads, never launches workflows. No caller-supplied paths/shells/evidence filenames.
// Task checkbox completion != execution/test/UAT. Running requires actual execution evidence; otherwise unverified.
// Agent configs, KB entries, service builtin agents are distinct sources. No prompt/KB正文/secret fields in response.
