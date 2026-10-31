import { toRaw } from 'vue'
import { decodeArtOutputReviewSnapshot, type ArtOutputReviewProvider, type ArtOutputReviewSnapshot } from '../adapters/art-output-review'
import type { WorkbenchContext } from '../adapters/art-workbench'
import { artVisualReviewState } from './art-visual-review'
import { artNeedCandidate, artNeedPresentation, ART_NEED_FILTERS, type ArtNeedReadPhase, type ArtNeedStatus } from './art-needs-presentation'
import { ArtOutputReviewRecovery, type ArtOutputPendingStorage } from '../stores/art-output-review-pending'
import type { WorkbenchNeed, WorkbenchTaskEntry } from './art-workbench'
import type { AiJobSnapshot } from './ai-jobs-read'

export type ArtNeedVisualStatus = ArtNeedStatus | 'accepted' | 'rework'
export interface ArtNeedVisualObservation {
  readonly context: WorkbenchContext
  readonly needId: string
  readonly jobId: string | null
  readonly phase: 'unread' | 'reading' | 'ready' | 'unknown' | 'error'
  readonly snapshot: ArtOutputReviewSnapshot | null
}
export const ART_NEED_VISUAL_FILTERS: readonly {value:ArtNeedVisualStatus;label:string}[] = Object.freeze([
  ...ART_NEED_FILTERS,
  {value:'accepted',label:'已通过（视觉）'},
  {value:'rework',label:'退回待修改'},
])

/** The displayed candidate is the only version whose decision may label a row.
 * Never use the last accepted version from another job, source or candidate. */
export function artNeedVisualPresentation(need:WorkbenchNeed,job:AiJobSnapshot|undefined,phase:ArtNeedReadPhase,preparation:WorkbenchTaskEntry|undefined,observation:ArtNeedVisualObservation|undefined,context:WorkbenchContext|null,workbenchHash:string|null|undefined,normHash:string|undefined):{key:ArtNeedVisualStatus;label:string;tone:'primary'|'info'|'success'|'warning'|'danger';busy:boolean} {
  const original=artNeedPresentation(need,job,phase,preparation)
  if(phase!=='ready'||!job||job.historyOnly||!['awaiting_selection','reusable','selected','imported_pending_verification'].includes(job.state))return original
  if(!context||!observation||toRaw(observation.context)!==toRaw(context)||observation.needId!==need.id||observation.jobId!==need.jobId)return original
  if(observation.phase==='unknown'||observation.phase==='error')return {key:'unknown',label:'视觉审阅结果待核对',tone:'warning',busy:false}
  if(observation.phase==='reading')return {key:'unverified',label:'正在读取视觉审阅…',tone:'primary',busy:true}
  if(observation.phase!=='ready'||!observation.snapshot)return original
  try {
    const value=decodeArtOutputReviewSnapshot(observation.snapshot,{projectId:context.projectId,projectPath:context.projectPath,resourceDomainId:context.resourceDomainId??null,needId:need.id})
    if(!value.history||!value.reviews||!workbenchHash||!normHash||value.snapshot.workbenchHash!==workbenchHash||value.snapshot.currentJobId!==job.jobId||value.snapshot.currentSourceRevision!==job.sourceRevision)return original
    const candidate=artNeedCandidate(need,job)
    const version=candidate&&value.history.versions.find(row=>row.jobId===job.jobId&&row.candidateId===candidate.candidateId&&row.fileSha256===candidate.fileSha256&&row.width===candidate.width&&row.height===candidate.height&&row.requestHash===job.requestHash&&row.sourceRevision===job.sourceRevision&&row.binding.normHash===normHash&&row.binding.needVersion===need.version&&row.binding.specId===need.specId&&row.binding.specVersion===need.specVersion)
    if(!version)return original
    const decision=artVisualReviewState(value.reviews,value.history,version.versionId)
    if(!decision.latest||decision.latest.command.observedJobRevision>job.revision)return original
    if(decision.state==='accepted')return {key:'accepted',label:'已通过（视觉）',tone:'success',busy:false}
    if(decision.state==='rework')return {key:'rework',label:'退回待修改',tone:'warning',busy:false}
    return original
  }catch{return {key:'unknown',label:'视觉审阅身份待核对',tone:'warning',busy:false}}
}

/** Explicit read only. Recovery records are inspected, never cleared or replayed. */
export async function readArtNeedVisualObservation(provider:ArtOutputReviewProvider,context:WorkbenchContext,need:WorkbenchNeed,options:{signal?:AbortSignal;storage:ArtOutputPendingStorage|null}):Promise<ArtNeedVisualObservation> {
  const result=(phase:ArtNeedVisualObservation['phase'],snapshot:ArtOutputReviewSnapshot|null=null):ArtNeedVisualObservation=>({context,needId:need.id,jobId:need.jobId??null,phase,snapshot})
  try {
    const expected={projectId:context.projectId,projectPath:context.projectPath,resourceDomainId:context.resourceDomainId??null,needId:need.id}
    if(!options.storage)return result('unknown')
    const recovery=new ArtOutputReviewRecovery(provider.endpoint,expected,options.storage)
    if(recovery.load())return result('unknown')
    let value:ArtOutputReviewSnapshot
    try{value=decodeArtOutputReviewSnapshot(await provider.read(context,need.id,options.signal),expected)}
    finally{await provider.waitForIdle()}
    if(options.signal?.aborted||recovery.load())return result('unknown')
    return result('ready',value)
  }catch{return result('error')}
}
