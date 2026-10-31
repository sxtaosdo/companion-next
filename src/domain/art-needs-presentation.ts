import { AI_JOB_STATE_LABELS, type AiJobSnapshot, type AiJobState } from './ai-jobs-read'
import type { WorkbenchNeed, WorkbenchTaskEntry } from './art-workbench'

export type ArtNeedReadPhase = 'unread'|'reading'|'ready'|'error'
export type ArtNeedStatus = AiJobState|'not-created'|'unconfigured'|'unverified'|'expired'
type Tone = 'primary'|'info'|'success'|'warning'|'danger'
export const ART_NEED_FILTERS: Array<{value:ArtNeedStatus;label:string}> = [
 {value:'unconfigured',label:'未配置规格'},{value:'not-created',label:'未创建任务'},{value:'unverified',label:'任务未读取'},
 {value:'unknown',label:AI_JOB_STATE_LABELS.unknown},{value:'failed',label:AI_JOB_STATE_LABELS.failed},
 {value:'queued',label:AI_JOB_STATE_LABELS.queued},{value:'waiting_service',label:AI_JOB_STATE_LABELS.waiting_service},
 {value:'running',label:AI_JOB_STATE_LABELS.running},{value:'awaiting_selection',label:AI_JOB_STATE_LABELS.awaiting_selection},
 {value:'reusable',label:AI_JOB_STATE_LABELS.reusable},{value:'selected',label:AI_JOB_STATE_LABELS.selected},
 {value:'import_unknown',label:AI_JOB_STATE_LABELS.import_unknown},{value:'imported_pending_verification',label:AI_JOB_STATE_LABELS.imported_pending_verification},
 {value:'blocked',label:AI_JOB_STATE_LABELS.blocked},{value:'expired',label:'历史 / 上次观察，待核对'},
]
export function artNeedPresentation(need:WorkbenchNeed,job:AiJobSnapshot|undefined,phase:ArtNeedReadPhase,preparation?:WorkbenchTaskEntry):{key:ArtNeedStatus;label:string;tone:Tone;busy:boolean} {
 const state=(key:ArtNeedStatus,label:string,tone:Tone='info',busy=false)=>({key,label,tone,busy})
 if(!need.specId||!need.spec?.id)return state('unconfigured','未配置规格','warning')
 if(!need.jobId){
  if(preparation?.state==='unknown'||preparation?.state==='submitting')return state('unknown','准备任务结果待核对','warning')
  if(preparation?.state==='rejected')return state('failed','准备任务创建被拒绝','danger')
  return state('not-created','未创建任务')
 }
 if(phase==='reading')return state('unverified','正在读取任务…','primary',true)
 if(phase==='error')return state('expired',job?`上次观察：${AI_JOB_STATE_LABELS[job.state]} · 当前待核对`:'任务读取失败 · 当前待核对','warning')
 if(phase!=='ready')return state('unverified','任务尚未读取')
 if(!job||job.jobId!==need.jobId||!job.assets.some(asset=>asset.assetId===need.id))return state('unknown','任务未在当前需求回读中找到','warning')
 if(job.historyOnly)return state('expired',`历史任务：${AI_JOB_STATE_LABELS[job.state]} · 只读待核对`,'warning')
 const tone:Tone=job.state==='failed'?'danger':['unknown','import_unknown','blocked'].includes(job.state)?'warning':['running','queued','waiting_service'].includes(job.state)?'primary':'info'
 return state(job.state,AI_JOB_STATE_LABELS[job.state],tone)
}
/** A different asset in the same two-asset job must never become this need's picture. */
export function artNeedCandidate(need:WorkbenchNeed,job:AiJobSnapshot|undefined){
 if(!job||job.jobId!==need.jobId||job.historyOnly||!job.assets.some(asset=>asset.assetId===need.id))return undefined
 const candidates=job.candidates.filter(candidate=>candidate.assetId===need.id)
 return candidates.find(candidate=>job.selectedIds.includes(candidate.candidateId))??candidates[0]
}
/** Reachable viewing steps, never an acceptance or completion assertion. */
export function artTaskViewingStep(snapshot:{state:AiJobState;candidates:number;selected:number;hasImport:boolean}|null|undefined):number {
 if(!snapshot||['queued','waiting_service','running','unknown','failed','blocked','import_unknown'].includes(snapshot.state))return 2
 if(snapshot.hasImport)return 5
 if(snapshot.selected>0)return 4
 return snapshot.candidates>0?3:2
}
