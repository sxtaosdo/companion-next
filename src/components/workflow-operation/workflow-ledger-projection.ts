import {activeRun,displayedState,operationLabels,workflowOperationLabel} from './workflow-operation'
import type {WorkflowOperationRecord,WorkflowOperationState} from './workflow-operation'

/** A read observation only: never an execution provider or planning checkbox state. */
export interface WorkflowLedgerObservation {
 records:WorkflowOperationRecord[]
 staleIds:string[]
 readState:'unread'|'loading'|'ready'|'stale'
 observedAt:string|null
 error:string|null
}
export interface WorkflowLedgerRow {
 id:string
 workflowId:string
 projectId:string|null
 title:string
 state:WorkflowOperationState
 label:string
 stale:boolean
 executionId:string|null
 technicalSampleAccepted:boolean
 goal:WorkflowOperationRecord['goal']
 plan:WorkflowOperationRecord['plan']
 logRefs:string[]
 evidenceRefs:string[]
}
export interface WorkflowLedgerProjection {
 rows:WorkflowLedgerRow[]
 counts:Record<WorkflowOperationState,number>
 staleCount:number
 readState:WorkflowLedgerObservation['readState']
 observedAt:string|null
 error:string|null
}
export function emptyWorkflowLedgerObservation():WorkflowLedgerObservation {
 return {records:[],staleIds:[],readState:'unread',observedAt:null,error:null}
}
/** Stable namespace prevents a managed workflow ID colliding with source-planning IDs. */
export function workflowLedgerRowId(id:string):string{return `execution:${encodeURIComponent(id)}`}
export function projectWorkflowLedger(observation:WorkflowLedgerObservation,projectId?:string):WorkflowLedgerProjection {
 const counts=Object.fromEntries(Object.keys(operationLabels).map(state=>[state,0])) as Record<WorkflowOperationState,number>
 const staleIds=new Set(observation.staleIds)
 const rows=observation.records.filter(item=>!item.management?.trashedAt&&(!projectId||item.projectId===projectId)).map(item=>{
  const run=activeRun(item),state=displayedState(item),stale=staleIds.has(item.id)||observation.readState==='unread'||observation.readState==='loading'||(observation.readState==='stale'&&staleIds.size===0)
  // Historical states remain inspectable, but stale observations never inflate live-state totals.
  if(!stale)counts[state]++
  return {id:workflowLedgerRowId(item.id),workflowId:item.id,projectId:item.projectId??null,title:item.presentation?.title||item.id,state,label:workflowOperationLabel(item),stale,executionId:run?.executionId??null,technicalSampleAccepted:state==='accepted'&&run?.acceptance?.scope==='technical-sample',goal:{...item.goal},plan:item.plan?{...item.plan}:null,logRefs:[...(run?.logRefs??[])],evidenceRefs:[...(run?.evidenceRefs??[])]}
 })
 return {rows,counts,staleCount:rows.filter(row=>row.stale).length,readState:observation.readState,observedAt:observation.observedAt,error:observation.error}
}
