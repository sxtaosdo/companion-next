<script setup lang="ts">
import {antToolbarScope,ANT_TOOLBAR_SPEC,ANT_TOOLBAR_DESTINATION,ANT_TOOLBAR_EXPORT,ANT_TOOLBAR_REFERENCES} from '../domain/ant-toolbar-scope'

import { computed, nextTick, onBeforeUnmount, ref, shallowRef, toRaw, watch } from 'vue'
import { ART_CATEGORIES, type ArtCategory } from '../domain/project-art-spec'
import { copyWorkbench, workbenchConditioningIssue, workbenchConditioningReferences, type WorkbenchReferenceMode, needOutputSize, needsReview, validateWorkbenchSpec, validWorkbenchSize, workbenchLabels, readWorkbenchReferenceUploads, rememberWorkbenchReferenceUpload, releaseRejectedWorkbenchReferenceUpload, workbenchReferenceScopeKey, legacyWorkbenchUploadUnknown, type WorkbenchNeed, type WorkbenchSpec, type WorkbenchReference, type WorkbenchReferenceScope, type WorkbenchReferenceUpload } from '../domain/art-workbench'
import { prepareLocalReference, decodeAiReferenceUploadReceipt, AiReferenceUploadError, type PreparedLocalReference } from '../domain/ai-reference-upload'
import { aiReferenceUploadProvider } from '../ai-reference-upload-integration'
import { aiResourceReadProvider } from '../ai-resource-read-integration'
import SavedReferenceLibraryPicker from './SavedReferenceLibraryPicker.vue'
import InfoTip from './InfoTip.vue'
import { acceptSavedReferenceLibrarySelection, copySavedLibraryIdentity, normalizeSavedLibraryEntries, type SavedReferenceLibraryEntry, type SavedReferenceLibrarySelection } from '../adapters/saved-reference-library'
import { validateWorkbenchDocument } from '../domain/art-workbench'
import { readAiReferenceUploadFences } from '../stores/ai-reference-upload'
import { useArtWorkbenchStore } from '../stores/art-workbench'
import { useProjectArtSpecStore,useResourceDomainArtSpecStore } from '../stores/project-art-spec'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { createWorkbenchProvider } from '../adapters/art-workbench'
import { aiJobsReadProvider } from '../ai-jobs-read-integration'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import type { AiJobSnapshot } from '../domain/ai-jobs-read'
import { artNeedCandidate, artTaskViewingStep, type ArtNeedReadPhase } from '../domain/art-needs-presentation'
import { ART_NEED_VISUAL_FILTERS, artNeedVisualPresentation, readArtNeedVisualObservation, type ArtNeedVisualStatus, type ArtNeedVisualObservation } from '../domain/art-need-visual-status'
import { CircleClose, Loading, Warning, InfoFilled } from '@element-plus/icons-vue'
import AiJobsReadPanel from './AiJobsReadPanel.vue'
import ArtOutputReviewPanel from './ArtOutputReviewPanel.vue'
import { createArtOutputReviewProvider } from '../adapters/art-output-review'
import ArtSpecImpactSummary from './ArtSpecImpactSummary.vue'
import ArtTaskDetailDialog from './ArtTaskDetailDialog.vue'
import ArtVisualReviewDialog from './ArtVisualReviewDialog.vue'
import ArtBatchProductionConfirm from './ArtBatchProductionConfirm.vue'
import { artSpecImpact, type ArtBatchDisplayItem, type ArtOverviewReference } from '../domain/art-prototype-presentation'
const sharedReceipt=shallowRef<import('../domain/art-workbench').WorkbenchReceipt|null>(null),sharedReading=ref(false),sharedError=ref('');let sharedEpoch=0
async function readShared(){const target=store.context;if(!canReadShared.value||!target?.resourceDomainId||target.resourceDomainId==='shared')return;const token=++sharedEpoch;sharedReading.value=true;sharedError.value='';try{const receipt=await transport.read({...target,resourceDomainId:'shared',readOnly:true},new AbortController().signal);if(token===sharedEpoch&&store.context===target)sharedReceipt.value=receipt}catch{if(token===sharedEpoch)sharedError.value='公共资源读取失败，未修改当前资源域。'}finally{if(token===sharedEpoch)sharedReading.value=false}}
const taskStep=ref(2),visualReviewOpen=ref(false),directReview=ref(false)
function closeVisualReview(){visualReviewOpen.value=false;if(directReview.value)closeJob()}
// Element Plus emits false after a programmatic leave as well as a user close.
// Hiding the task for visual review must retain that task and its read context.
function taskDialogOpenChanged(open:boolean){if(!open&&!visualReviewOpen.value)closeJob()}
const requestedTaskStep=ref<number|null>(null)
const taskSnapshot=computed(()=>jobsPanel.value?.workflowSnapshot)
const taskReached=computed(()=>artTaskViewingStep(taskSnapshot.value))
const taskNavigationReady=computed(()=>!!activeNeed.value?.jobId||!!jobsPanel.value?.readStatusSnapshot?.state)
function chooseStep(index:number){if(!taskNavigationReady.value||index>taskReached.value)return;if(index<2){closeJob();emit('open-management',index===0?'norm':'specs');return}requestedTaskStep.value=null;taskStep.value=index;if(index===3)visualReviewOpen.value=true;emit('stage-change',{step:index,reached:taskReached.value})}
const taskActive=computed(()=>!!activeNeed.value||browsingJobs.value)
const props=defineProps<{view:'specs'|'needs';resourceDomainId?:string;readOnly?:boolean;sharedAvailable?:boolean}>()
const emit=defineEmits<{'open-domain':[id:string];'open-management':[view:'norm'|'specs'];'open-references':[];'stage-change':[value:{step:number;reached:number}]}>()
const selection=useRegisteredProjectStore(),projectNormStore=useProjectArtSpecStore(),store=useArtWorkbenchStore()
const canReadShared=computed(()=>props.sharedAvailable===true&&store.sharedAccess?.ownerScope==='shared'&&store.sharedAccess.resourceDomainId==='shared')
const normStore=computed(()=>props.resourceDomainId?useResourceDomainArtSpecStore():projectNormStore)
const transport=createWorkbenchProvider((...args)=>fetch(...args),globalThis.location.hostname==='127.0.0.1'?globalThis.location.origin:undefined)
const artReviewProvider=createArtOutputReviewProvider({fetch:(path,init)=>fetch(path,init)}),artReviewJob=shallowRef<AiJobSnapshot|null>(null)
const artReviewCurrentJob=computed(()=>{
  const observed=jobsPanel.value?.readStatusSnapshot,opened=artReviewJob.value,current=observed?.snapshot
  if(!opened||!current||!observed?.hasRead||observed.loading||observed.error||observed.historyOnly
    ||observed.projectId!==selection.project?.id||observed.projectPath!==selection.project?.path||observed.source!==selection.currentSource
    ||current.projectId!==observed.projectId||current.jobId!==activeNeed.value?.jobId||current.jobId!==opened.jobId
    ||current.requestHash!==opened.requestHash||current.sourceRevision!==opened.sourceRevision||current.revision<opened.revision
    ||current.state!==observed.state)return null
  return current
})
watch([()=>selection.project,()=>selection.currentSource,()=>props.resourceDomainId,()=>props.readOnly],()=>{store.bind(selection.project&&selection.currentSource?{projectId:selection.project.id,projectPath:selection.project.path,source:selection.currentSource,...(props.resourceDomainId?{resourceDomainId:props.resourceDomainId}:{}),readOnly:props.readOnly}:null,selection.currentSource?transport:null)},{immediate:true,flush:'sync'})
watch(()=>store.context,target=>{if(!target)return;void nextTick(()=>{if(store.context===target&&store.phase==='unread'&&!store.dirty&&!store.busy)void store.read()})},{immediate:true,flush:'sync'})
onBeforeUnmount(()=>{sharedEpoch++;store.leave()})
watch(()=>store.context,()=>{sharedEpoch++;sharedReceipt.value=null;sharedReading.value=false;sharedError.value=''},{flush:'sync'})
const configuredAntDomain=computed(()=>antToolbarScope(selection.project?.id??'',props.resourceDomainId))
// Reading a previously bound, scoped task must not depend on whether new tasks can currently be prepared.
const canReadPreparedAntTasks=computed(()=>configuredAntDomain.value)
const canReadNeedJobs=computed(()=>!!store.capabilities?.existingJobLink||canReadPreparedAntTasks.value)
const norm=computed(()=>normStore.value.base&&normStore.value.hash&&normStore.value.context?.projectId===selection.project?.id&&normStore.value.context?.projectPath===selection.project?.path&&normStore.value.context?.source===selection.currentSource&&normStore.value.context?.resourceDomainId===props.resourceDomainId&&['editing','saved'].includes(normStore.value.phase)&&!normStore.value.dirty&&!normStore.value.pending&&!normStore.value.blocked&&normStore.value.base.projectId===selection.project?.id?{hash:normStore.value.hash,version:normStore.value.base.version,...(props.resourceDomainId?{projectSettingsHash:normStore.value.base.projectSettingsHash}:{})}:null)
const editable=computed(()=>!!store.draft&&!props.readOnly&&!store.busy&&!store.taskPending&&store.phase==='ready')
const knowledge=useKnowledgeReadStore()
const modelReadiness=computed(()=>knowledge.provider!==knowledgeReadProvider.value||!knowledge.provider?'未读取':knowledge.statusLoading?'读取中':knowledge.serviceError?'读取失败':knowledge.services?.model?.running===true?'启动器可达，图像模型待核对':knowledge.services?.model?.running===false?'启动器未连接，图像模型待核对':'未读取')
const directoryReadiness=computed(()=>{const icon=store.base?.specs.filter(spec=>spec.category==='icon')??[];return !icon.length?'请先配置图标规格':icon.every(spec=>!!spec.destination&&!!spec.exportDirectory)?'已配置，提交时复核':'尚未配置'})
const specificationReadiness=computed(()=>norm.value?'已读取并保存':normStore.value.pending?'读取中':normStore.value.blocked?'结果待核对':normStore.value.phase==='error'?'读取失败':'尚未配置或未读取')
function taskBlockReason(code?:string){
 if(code==='ICON_ADAPTER_DISABLED')return '图标准备服务未启用或配置不完整，请核对后台配置。'
 if(code==='ART_WORKBENCH_TASK_HISTORY_BLOCKED')return '已有进行中或状态未知的任务，请先核对任务状态。'
 return ''
}
function needTaskBlockReason(id:string){const entry=latestTaskResults.value.find(row=>row.needId===id),need=store.draft?.needs.find(row=>row.id===id);if(need?.jobId&&entry?.state==='rejected')return '';const reason=taskBlockReason(entry?.code);return reason&&entry?.state==='unknown'?reason+' 本次结果仍待核对，不会自动重发。':reason}
function nextNeedAction(need:WorkbenchNeed){const key=demandStatus(need).key;if(!need.jobId)return need.spec.category==='icon'?'创建准备任务':'暂不支持此类型';if(key==='unknown'||key==='unverified'||key==='expired'||key==='import_unknown')return '核对原任务';if(key==='awaiting_selection'||key==='reusable')return '审阅候选';if(key==='selected')return '核对导入';if(key==='imported_pending_verification')return '完成运行验收';if(key==='accepted')return '查看验收';if(key==='failed'||key==='blocked'||key==='rework')return '查看原因';return '查看任务进度'}
function canOpenNeed(need:WorkbenchNeed){return need.jobId?!!aiJobsReadProvider.value&&(!props.resourceDomainId||!!store.capabilities?.existingJobLink||canReadPreparedAntTasks.value&&antToolbarScope(selection.project?.id??'',props.resourceDomainId,need.id)):need.spec.category==='icon'&&!!store.draft&&!!norm.value&&store.canPrepareTasks&&!needsReview(store.draft,need,norm.value)}
function openNeed(need:WorkbenchNeed){if(!canOpenNeed(need))return;if(need.jobId)void openJob(need);else openPrepared([need.id])}
const query=ref(''),filter=ref<ArtCategory|''>(''),message=ref('')
const statusFilter=ref<ArtNeedVisualStatus|''>(''),demandJobs=ref<AiJobSnapshot[]>([]),demandReadPhase=ref<ArtNeedReadPhase>('unread'),demandObservedAt=ref('')
const demandPreviews=ref<Record<string,{key:string;src:string}>>({}),demandPreviewErrors=ref<Record<string,string>>({}),demandPreviewBusy=ref('')
let demandEpoch=0;let demandReadController:AbortController|null=null,demandPreviewController:AbortController|null=null
const demandJobMap=computed(()=>new Map(demandJobs.value.map(job=>[job.jobId,job])))
const demandVisual=shallowRef<Record<string,ArtNeedVisualObservation>>({})
function acceptVisualObservation(value:ArtNeedVisualObservation){const need=store.draft?.needs.find(row=>row.id===value.needId);if(toRaw(value.context)!==toRaw(store.context)||!need||need.jobId!==value.jobId)return;demandVisual.value={...demandVisual.value,[need.id]:value}}
function demandStatus(need:WorkbenchNeed){return artNeedVisualPresentation(need,need.jobId?demandJobMap.value.get(need.jobId):undefined,demandReadPhase.value,latestTaskResults.value.find(row=>row.needId===need.id),demandVisual.value[need.id],store.context,store.hash,store.draft?.norm.hash)}
function demandCandidate(need:WorkbenchNeed){return demandReadPhase.value==='ready'?artNeedCandidate(need,need.jobId?demandJobMap.value.get(need.jobId):undefined):undefined}
function invalidateDemandReads(){demandEpoch++;demandReadController?.abort();demandPreviewController?.abort();demandReadController=null;demandPreviewController=null;demandJobs.value=[];demandReadPhase.value='unread';demandObservedAt.value='';demandPreviews.value={};demandPreviewErrors.value={};demandPreviewBusy.value='';demandVisual.value={}}
watch([()=>store.context,aiJobsReadProvider],invalidateDemandReads,{flush:'sync'})
onBeforeUnmount(invalidateDemandReads)
watch([()=>store.context,()=>store.phase,()=>store.base?.version,canReadNeedJobs,aiJobsReadProvider],()=>{if(store.context&&store.phase==='ready'&&store.base?.needs.length&&canReadNeedJobs.value&&aiJobsReadProvider.value&&demandReadPhase.value==='unread')void refreshDemandJobs()},{flush:'post'})
async function refreshDemandJobs(){
 const target=selection.project,source=selection.currentSource,context=store.context,reader=aiJobsReadProvider.value
 if(!target||!source||!context||!reader||!canReadNeedJobs.value||demandReadPhase.value==='reading')return
 const token=++demandEpoch;demandReadController?.abort();demandPreviewController?.abort();demandReadController=new AbortController();demandPreviews.value={};demandPreviewErrors.value={};demandPreviewBusy.value='';demandReadPhase.value='reading'
 try{const result=await reader.readJobs(target.id,demandReadController.signal);if(token!==demandEpoch||store.context!==context||selection.project?.id!==target.id||selection.project.path!==target.path||selection.currentSource!==source||reader!==aiJobsReadProvider.value)return;if(result.projectId!==target.id||result.jobs.some(job=>job.projectId!==target.id))throw Error('任务工程不一致');demandJobs.value=result.jobs;demandReadPhase.value='ready';demandObservedAt.value=new Date().toISOString();demandVisual.value={}
   for(const need of store.base?.needs??[]){if(token!==demandEpoch||store.context!==context)break;const job=need.jobId?result.jobs.find(row=>row.jobId===need.jobId):undefined;if(!job||job.historyOnly||!['awaiting_selection','reusable','selected','imported_pending_verification'].includes(job.state))continue;let storage:Storage|null=null;try{storage=globalThis.sessionStorage}catch{};const observation=await readArtNeedVisualObservation(artReviewProvider,context,need,{signal:demandReadController.signal,storage});if(token===demandEpoch&&store.context===context&&selection.currentSource===source&&reader===aiJobsReadProvider.value)acceptVisualObservation(observation)}
   for(const need of (store.base?.needs??[]).filter(row=>!!demandCandidate(row)).slice(0,20)){if(token!==demandEpoch||store.context!==context)break;await previewDemand(need)}
  }
 catch{if(token===demandEpoch)demandReadPhase.value='error'}
}
async function previewDemand(need:WorkbenchNeed){
 const target=selection.project,source=selection.currentSource,context=store.context,reader=aiJobsReadProvider.value,job=need.jobId?demandJobMap.value.get(need.jobId):undefined,candidate=demandCandidate(need)
 if(!target||!source||!context||!reader||!job||!candidate||demandPreviewBusy.value)return
 const token=demandEpoch,key=[job.jobId,job.revision,candidate.candidateId,candidate.fileSha256].join(':');demandPreviewController=new AbortController();demandPreviewBusy.value=need.id;delete demandPreviewErrors.value[need.id]
 try{const preview=await reader.previewCandidate(target.id,job.jobId,candidate,demandPreviewController.signal);if(token!==demandEpoch||store.context!==context||selection.project?.id!==target.id||selection.project.path!==target.path||selection.currentSource!==source||reader!==aiJobsReadProvider.value||demandCandidate(need)?.fileSha256!==candidate.fileSha256)return;if(preview.sha256!==candidate.fileSha256||preview.candidateId!==candidate.candidateId||preview.width!==candidate.width||preview.height!==candidate.height||preview.mimeType!=='image/png')throw Error('候选不一致');demandPreviews.value={...demandPreviews.value,[need.id]:{key,src:'data:image/png;base64,'+preview.base64}}}
 catch{if(token===demandEpoch)demandPreviewErrors.value={...demandPreviewErrors.value,[need.id]:'预览读取失败 · 待核对'}}finally{if(token===demandEpoch)demandPreviewBusy.value=''}
}
function demandPreviewFailed(id:string){delete demandPreviews.value[id];demandPreviewErrors.value={...demandPreviewErrors.value,[id]:'预览无法显示 · 待核对'}}
const specs=computed(()=>store.draft?.specs.filter(s=>(!filter.value||s.category===filter.value)&&(!query.value||s.name.includes(query.value)||s.id.includes(query.value)))??[])
const needs=computed(()=>store.draft?.needs.filter(n=>(!filter.value||n.spec.category===filter.value)&&(!query.value||n.name.includes(query.value)||n.id.includes(query.value))&&(!statusFilter.value||demandStatus(n).key===statusFilter.value))??[])
const specEditor=ref<WorkbenchSpec|null>(null),needEditor=ref<WorkbenchNeed|null>(null),originalId=ref<string|null>(null),needCategory=ref<ArtCategory>('icon')
const selectedSpecs=computed(()=>store.draft?.specs.filter(s=>s.category===needCategory.value)??[])
const referencesOpen=ref(false),referenceScope=ref(''),referenceLevel=ref<'project'|'spec'|'asset'>('project')
const shownReferences=computed(()=>referenceLevel.value==='project'?store.draft?.projectReferences??[]:referenceLevel.value==='spec'?specEditor.value?.references??[]:needEditor.value?.references??[])
const referenceNames={project:'项目风格参考：约束整体画风，不覆盖单项内容。',spec:'规格范例：说明构图和形态，不改变项目画风。',asset:'单素材内容参考：说明主体细节，不覆盖固定尺寸。'}
function references(scope:keyof typeof referenceNames){referenceLevel.value=scope;referenceScope.value=referenceNames[scope];referencesOpen.value=true;clearReferenceSelection();loadReferenceRecords()}
function newSpec(spec?:WorkbenchSpec){originalId.value=spec?.id??null;specEditor.value=spec?copyWorkbench(spec):{id:configuredAntDomain.value?ANT_TOOLBAR_SPEC:'',name:'',category:'icon',version:1,sizePolicy:'fixed',width:configuredAntDomain.value?160:128,height:configuredAntDomain.value?160:128,destination:configuredAntDomain.value?ANT_TOOLBAR_DESTINATION:props.resourceDomainId?null:'assets/art/icons',exportDirectory:configuredAntDomain.value?ANT_TOOLBAR_EXPORT:props.resourceDomainId?null:'art/final/icons',imageOutput:'transparent-png',style:'',references:[]};message.value=''}
function saveSpec(){if(!editable.value||!specEditor.value||!store.draft)return;try{const spec=copyWorkbench(specEditor.value);if(spec.category!=='ui')spec.sizePolicy='fixed';validateWorkbenchSpec(spec);const index=store.draft.specs.findIndex(s=>s.id===originalId.value);if(store.draft.specs.some((s,i)=>s.id===spec.id&&i!==index))throw Error('规格标识已存在');if(index>=0){if(JSON.stringify(spec)===JSON.stringify(store.draft.specs[index])){specEditor.value=null;return}spec.version=(store.base?.specs.find(s=>s.id===spec.id)?.version??0)+1;store.draft.specs[index]=spec}else store.draft.specs.push(spec);specEditor.value=null}catch(e){message.value=(e as Error).message}}
function newNeed(need?:WorkbenchNeed){originalId.value=need?.id??null;needCategory.value=need?.spec.category??'icon';needEditor.value=need?copyWorkbench(need):{id:'',name:'',version:1,content:'',specId:'',specVersion:0,spec:{} as WorkbenchSpec,references:[]};message.value=''}
function chooseSpec(id:string){const spec=store.draft?.specs.find(s=>s.id===id);if(!needEditor.value||!spec)return;needEditor.value.spec=copyWorkbench(spec);needEditor.value.specId=spec.id;needEditor.value.specVersion=spec.version;if(spec.sizePolicy==='per-asset')needEditor.value.size={width:spec.width,height:spec.height};else delete needEditor.value.size}
function saveNeed(){if(!editable.value||!store.draft||!needEditor.value)return;const need=copyWorkbench(needEditor.value);if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(need.id)||!need.name.trim()||!need.content.trim()||!need.specId){message.value='请填写标识、名称、规格和内容要求。';return}if(need.spec.sizePolicy==='per-asset'&&(!need.size||!validWorkbenchSize(need.size.width,need.size.height))){message.value='请填写有效的单项尺寸。';return}const index=store.draft.needs.findIndex(n=>n.id===originalId.value);if(store.draft.needs.some((n,i)=>n.id===need.id&&i!==index)){message.value='需求标识已存在';return}if(index>=0){if(store.draft.needs[index]!.jobId){message.value='已绑定任务的需求不可编辑。';return}if(JSON.stringify(need)===JSON.stringify(store.draft.needs[index])){needEditor.value=null;return}need.version=(store.base?.needs.find(n=>n.id===need.id)?.version??0)+1;store.draft.needs[index]=need}else store.draft.needs.push(need);needEditor.value=null}
function reviewNeed(need:WorkbenchNeed){if(!editable.value||need.jobId||!store.draft)return;const spec=store.draft.specs.find(s=>s.id===need.specId);if(spec){need.version=(store.base?.needs.find(n=>n.id===need.id)?.version??0)+1;need.spec=copyWorkbench(spec);need.specVersion=spec.version;if(spec.sizePolicy==='per-asset')need.size??={width:spec.width,height:spec.height};else delete need.size}}
const browsingJobs=ref(false)
function browseJobs(){if(!store.capabilities?.existingJobLink)return;requestedTaskStep.value=null;browsingJobs.value=true;activeNeed.value=null;taskStep.value=2;emit('stage-change',{step:2,reached:2})}
const binding=ref<WorkbenchNeed|null>(null),jobs=ref<AiJobSnapshot[]>([]),jobsBusy=ref(false),jobId=ref(''),activeNeed=ref<WorkbenchNeed|null>(null),jobsPanel=ref<InstanceType<typeof AiJobsReadPanel>|null>(null)
watch(taskSnapshot,value=>{if(!value){taskStep.value=2;emit('stage-change',{step:2,reached:2});return}const reached=artTaskViewingStep(value);taskStep.value=requestedTaskStep.value!==null&&requestedTaskStep.value<=reached?requestedTaskStep.value:reached;if(requestedTaskStep.value!==null&&requestedTaskStep.value<=reached)requestedTaskStep.value=null;emit('stage-change',{step:taskStep.value,reached:taskReached.value})},{deep:true})
type Editors={spec:WorkbenchSpec|null;need:WorkbenchNeed|null;original:string|null;category:ArtCategory;query:string;filter:ArtCategory|'';statusFilter:ArtNeedVisualStatus|''}
const editorDrafts=new WeakMap<object,Map<string,Editors>>()
function editorKey(value:NonNullable<typeof store.context>){return JSON.stringify([value.projectId,value.projectPath,value.resourceDomainId??null])}
let jobsEpoch=0
watch(()=>store.context,(next,previous)=>{if(previous){let entries=editorDrafts.get(previous.source);if(!entries){entries=new Map();editorDrafts.set(previous.source,entries)}entries.set(editorKey(previous),{spec:copyWorkbench(specEditor.value),need:copyWorkbench(needEditor.value),original:originalId.value,category:needCategory.value,query:query.value,filter:filter.value,statusFilter:statusFilter.value})}jobsEpoch++;visualReviewOpen.value=false;directReview.value=false;requestedTaskStep.value=null;binding.value=null;jobs.value=[];jobsBusy.value=false;activeNeed.value=null;artReviewJob.value=null;browsingJobs.value=false;specEditor.value=null;needEditor.value=null;message.value='';query.value='';filter.value='';statusFilter.value='';const saved=next&&editorDrafts.get(next.source)?.get(editorKey(next));if(saved){specEditor.value=copyWorkbench(saved.spec);needEditor.value=copyWorkbench(saved.need);originalId.value=saved.original;needCategory.value=saved.category;query.value=saved.query;filter.value=saved.filter;statusFilter.value=saved.statusFilter}emit('stage-change',{step:props.view==='specs'?1:2,reached:2})},{flush:'sync'})
async function openBinding(need:WorkbenchNeed){if(!store.capabilities?.existingJobLink)return;binding.value=need;jobId.value=need.jobId??'';jobs.value=[];const target=selection.project,source=selection.currentSource,reader=aiJobsReadProvider.value;if(!target||!source||!reader)return;const token=++jobsEpoch;jobsBusy.value=true;try{const result=await reader.readJobs(target.id);if(token===jobsEpoch&&selection.project?.id===target.id&&selection.project.path===target.path&&selection.currentSource===source&&reader===aiJobsReadProvider.value)jobs.value=result.jobs}catch{if(token===jobsEpoch)message.value='现有任务读取失败，请关闭后重试。'}finally{if(token===jobsEpoch)jobsBusy.value=false}}
async function bindJob(){if(!store.capabilities?.existingJobLink||!editable.value||!binding.value||!jobs.value.some(j=>j.jobId===jobId.value)||!store.draft)return;const need=store.draft.needs.find(n=>n.id===binding.value!.id);if(!need||need.jobId)return;need.jobId=jobId.value;need.version=(store.base?.needs.find(n=>n.id===need.id)?.version??0)+1;await store.save();if(store.phase==='ready'&&!store.dirty)binding.value=null}
async function openJob(need:WorkbenchNeed,requestedStep:number|null=null){visualReviewOpen.value=false;directReview.value=requestedStep===3;requestedTaskStep.value=requestedStep;if(props.resourceDomainId&&!store.capabilities?.existingJobLink&&!(canReadPreparedAntTasks.value&&antToolbarScope(selection.project?.id??'',props.resourceDomainId,need.id)))return;const target=selection.project,source=selection.currentSource,context=store.context,reader=aiJobsReadProvider.value;if(!target||!source||!context||!reader||!need.jobId)return;const token=++jobsEpoch;artReviewJob.value=null;browsingJobs.value=false;taskStep.value=2;activeNeed.value=need;emit('stage-change',{step:2,reached:2});await nextTick();try{const result=await reader.readJobs(target.id);const snapshot=result.jobs.find(j=>j.jobId===need.jobId);if(token===jobsEpoch&&store.context===context&&selection.project?.id===target.id&&selection.project.path===target.path&&selection.currentSource===source&&reader===aiJobsReadProvider.value&&snapshot){if(result.projectId!==target.id||snapshot.projectId!==target.id||!snapshot.assets.some(asset=>asset.assetId===need.id)){closeJob();message.value='原任务与当前需求不匹配，请核对关联；未发起操作。';return}artReviewJob.value=snapshot;if(['queued','waiting_service','running','unknown','failed'].includes(snapshot.state)){taskStep.value=2;emit('stage-change',{step:2,reached:2})}await jobsPanel.value?.readCreatedTask({snapshot,project:target,source,jobsReader:reader});if(token===jobsEpoch&&directReview.value&&taskReached.value>=3)visualReviewOpen.value=true}else if(token===jobsEpoch)message.value='该任务尚未在当前工程回读中找到。'}catch{if(token===jobsEpoch)message.value='绑定任务读取失败，请重试。'}}
function closeJob(){visualReviewOpen.value=false;directReview.value=false;requestedTaskStep.value=null;activeNeed.value=null;artReviewJob.value=null;browsingJobs.value=false;emit('stage-change',{step:2,reached:2})}


const selectedNeeds=ref(new Set<string>()),preparedConfirm=ref(false),preparedIds=ref<string[]>([]),preparedApproved=ref(false),preparedMode=ref<'new'|'continue'>('new'),preparedReferenceMode=ref<WorkbenchReferenceMode>('evidence-only')
const preparedNeeds=computed(()=>preparedIds.value.map(id=>({id,need:store.base?.needs.find(need=>need.id===id)})))
const latestTaskResults=computed(()=>{const rows=new Map<string,typeof store.taskResults[number]>();for(const entry of store.taskResults)rows.set(entry.needId,entry);return [...rows.values()]})
const retryableIds=computed(()=>latestTaskResults.value.filter(entry=>entry.state==='rejected').map(entry=>entry.needId))
function selectNeed(id:string,checked:boolean){const next=new Set(selectedNeeds.value);if(checked)next.add(id);else next.delete(id);selectedNeeds.value=next}
function openPrepared(ids:string[],mode:'new'|'continue'='new'){preparedIds.value=[...new Set(ids)];preparedMode.value=mode;preparedReferenceMode.value=configuredAntDomain.value?'image-conditioning':'evidence-only';preparedApproved.value=false;preparedConfirm.value=true}
async function submitPrepared(){if(!preparedApproved.value||preparedNeeds.value.some(row=>!row.need))return;preparedConfirm.value=false;if(preparedMode.value==='continue')await store.continuePreparedTasks(true);else await store.createPreparedTasks(preparedIds.value,true,preparedReferenceMode.value);selectedNeeds.value=new Set()}
const conditioningIssue=computed(()=>{if(!store.base||!preparedIds.value.length)return 'ART_QWEN_REFERENCE_REQUIRED';for(const id of preparedIds.value){const need=store.base.needs.find(row=>row.id===id);if(!need)return 'ART_QWEN_REFERENCE_REQUIRED';const issue=workbenchConditioningIssue(store.base,need,store.capabilities);if(issue)return issue}return null})
const conditioningMessage=computed(()=>({'ART_QWEN_PROJECT_UNSUPPORTED':'仅授权测试工程可用参考图条件模式。','ART_QWEN_CAPABILITY_UNAVAILABLE':'当前后台尚未提供参考图条件任务能力。','ART_QWEN_REFERENCE_REQUIRED':'每项需求须有已保存的真实参考引用。','ART_QWEN_REFERENCE_LIMIT':'每项需求去重后最多 3 张参考图，不能自动截断。','ART_QWEN_REFERENCE_MEDIA_UNSUPPORTED':'本批仅支持 PNG/JPEG，WebP 不能作为条件输入。'}[conditioningIssue.value??'']??''))
function preparedReferenceCount(id:string){const need=store.base?.needs.find(row=>row.id===id);return need&&store.base?workbenchConditioningReferences(store.base,need).length:0}
const taskStateLabels={'not-started':'未开始','submitting':'创建请求进行中','created':'任务已创建 · 待生成（创建时）','already-linked':'已有关联任务','rejected':'创建被拒绝','unknown':'结果未知 · 待核对'}
watch(()=>store.context,()=>{selectedNeeds.value=new Set();preparedConfirm.value=false;preparedIds.value=[]},{flush:'sync'})

// The existing single-task protocol has no confirmed batch/failed-job retry
// contract. Present the approved confirmation honestly, without dispatching.
const batchConfirm=ref(false),batchMode=ref<'produce'|'retry'>('produce')
const selectedUnboundIds=computed(()=>[...selectedNeeds.value].filter(id=>!store.base?.needs.find(need=>need.id===id)?.jobId))
const batchPlanKey=computed(()=>JSON.stringify([store.context?.projectId,store.context?.projectPath,store.context?.resourceDomainId,store.hash,demandEpoch,batchMode.value,[...selectedNeeds.value]]))
const batchItems=computed<readonly ArtBatchDisplayItem[]>(()=>[...selectedNeeds.value].flatMap(id=>{const need=store.draft?.needs.find(row=>row.id===id);if(!need)return [];const size=needOutputSize(need);return [{id:need.id,name:need.name,specName:need.spec.name,specVersion:need.specVersion,width:size.width,height:size.height,executable:false,reason:batchMode.value==='retry'?'当前原任务协议未提供可追溯的失败重试入口；保留原任务。':'当前只支持逐项明确执行原任务，尚无已核对的批量派发合同。'}]}))
const selectedFailed=computed(()=>[...selectedNeeds.value].some(id=>{const need=store.draft?.needs.find(row=>row.id===id);return need&&demandStatus(need).key==='failed'}))
function canSelectForBatch(need:WorkbenchNeed){if(!editable.value||need.spec.category!=='icon'||store.busy||store.taskPending)return false;if(!need.jobId)return true;return demandReadPhase.value==='ready'&&['queued','waiting_service','failed'].includes(demandStatus(need).key)&&!demandJobMap.value.get(need.jobId)?.historyOnly}
function openBatch(mode:'produce'|'retry'){batchMode.value=mode;batchConfirm.value=true}
watch([()=>store.context,()=>props.view],()=>{batchConfirm.value=false},{flush:'sync'})

// Only file receipts and identity metadata are retained; source bytes stay in this dialog.
const referenceSelected=shallowRef<PreparedLocalReference|null>(null),referenceFileName=ref(''),referenceLocalShown=ref(false),referenceConfirmed=ref(false),referencePreparing=ref(false),referenceUploading=ref(false),referenceError=ref(''),referenceStorageBlocked=ref(false)
const referenceQueue=shallowRef<File[]>([]),referenceQueueIndex=ref(-1),referenceQueueNotice=ref(''),referenceQueueBlocked=ref(false)
const referenceRecords=ref<WorkbenchReferenceUpload[]>([]),referencePreviewBusy=ref(false)
const referenceThumbnails=ref<Record<string,{base64:string;sha256:string;width:number;height:number}>>({}),referenceThumbnailErrors=ref<Record<string,string>>({})
function referenceKey(reference:WorkbenchReference){return JSON.stringify([reference.relativePath,reference.sha256])}
const overviewProjectReferences=computed<readonly ArtOverviewReference[]>(()=>store.base?.projectReferences.map(reference=>({key:referenceKey(reference),name:reference.name,...(referenceThumbnails.value[referenceKey(reference)]?.sha256===reference.sha256?{verifiedPreview:'data:image/png;base64,'+referenceThumbnails.value[referenceKey(reference)]!.base64}:{})}))??[])
const projectReferenceBusy=computed(()=>store.busy)
const canOpenProjectReferences=computed(()=>!!store.context&&!!store.provider&&!store.busy&&!store.taskPending&&store.phase!=='unknown')
async function openProjectReferences(){
 if(!canOpenProjectReferences.value)return
 const target=store.context
 if(store.phase!=='ready')await store.read()
 if(store.context!==target||store.phase!=='ready')return
 if(!store.draft&&store.hash===null&&norm.value&&!props.readOnly)store.initialize(norm.value)
 if(store.draft)references('project')
 else message.value='工作台尚未初始化；请先核对并使用已保存规范初始化。'
}
function clearReferenceThumbnails(){referenceThumbnails.value={};referenceThumbnailErrors.value={}}
function referenceImageFailed(reference:WorkbenchReference){const key=referenceKey(reference);delete referenceThumbnails.value[key];referenceThumbnailErrors.value[key]='参考图显示失败，未验证；可明确重新核对。'}
let referenceEpoch=0,referencePreviewEpoch=0
const referenceTarget=computed(()=>referenceLevel.value==='project'?store.draft:referenceLevel.value==='spec'?specEditor.value:needEditor.value)
const referenceIdentity=computed<WorkbenchReferenceScope|null>(()=>{
 const target=selection.project,id=referenceLevel.value==='project'?target?.id:referenceTarget.value&&'id' in referenceTarget.value?referenceTarget.value.id:''
 return target&&selection.currentSource&&id&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id)?{projectId:target.id,projectPath:target.path,scope:referenceLevel.value==='asset'?'need':referenceLevel.value,targetId:id,...(props.resourceDomainId?{resourceDomainId:props.resourceDomainId}:{})}:null
})
const referenceWritable=computed(()=>editable.value&&!!referenceIdentity.value&&!!referenceTarget.value&&!(referenceLevel.value==='asset'&&needEditor.value?.jobId))
const referenceLocalUrl=computed(()=>referenceSelected.value?'data:'+referenceSelected.value.mimeType+';base64,'+referenceSelected.value.base64:'')
const scopeRecords=computed(()=>referenceIdentity.value?referenceRecords.value.filter(row=>workbenchReferenceScopeKey(row)===workbenchReferenceScopeKey(referenceIdentity.value!)):[])
const referenceCanUpload=computed(()=>referenceWritable.value&&!!aiReferenceUploadProvider.value&&!!store.capabilities?.referenceUpload&&!!referenceSelected.value?.pixelDecoded&&referenceLocalShown.value&&referenceConfirmed.value&&!referencePreparing.value&&!referenceUploading.value&&!referenceStorageBlocked.value&&shownReferences.value.length<4)
const savedReferenceLibrary=computed(()=>{
 const context=store.context,document=store.base,hash=store.hash
 if(!context||!document||store.phase!=='ready'||typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))return {identity:null,entries:[] as readonly SavedReferenceLibraryEntry[]}
 try{
  validateWorkbenchDocument(document,context.projectId,context.projectPath,context.resourceDomainId)
  const entries:SavedReferenceLibraryEntry[]=[]
  const add=(references:readonly WorkbenchReference[],origin:string)=>{for(const reference of references)entries.push({reference,origins:[origin]})}
  add(document.projectReferences,'项目参考')
  for(const spec of document.specs)add(spec.references,'规格 '+spec.id+' · v'+spec.version)
  for(const need of document.needs){add(need.references,'需求 '+need.id+' · v'+need.version);add(need.spec.references,'需求 '+need.id+' 的规格快照 '+need.specId+' · v'+need.specVersion)}
  return {identity:copySavedLibraryIdentity({...context,workbenchHash:hash}),entries:normalizeSavedLibraryEntries(entries)}
 }catch{return {identity:null,entries:[] as readonly SavedReferenceLibraryEntry[]}}
})
function savedReferencePersistentUnknown(){
 const scope=referenceIdentity.value;if(!scope)return true
 try{
  const storage=referenceStorage(),key=workbenchReferenceScopeKey(scope)
  return readWorkbenchReferenceUploads(storage).some(row=>workbenchReferenceScopeKey(row)===key&&row.receipt===null)
    ||readAiReferenceUploadFences(storage).some(row=>row.project.id===scope.projectId&&row.receipt===null)
 }catch{return true}
}
const savedReferenceLibraryDisabled=computed(()=>!referencesOpen.value||!referenceWritable.value||!savedReferenceLibrary.value.identity||store.taskPending||referencePreparing.value||referenceUploading.value||referencePreviewBusy.value||referenceStorageBlocked.value||referenceQueueBlocked.value||scopeRecords.value.some(row=>row.receipt===null)||savedReferencePersistentUnknown()||shownReferences.value.length>=4)
const approvedAntReference=computed<WorkbenchReference|null>(()=>{
 const scope=referenceIdentity.value
 if(referenceLevel.value!=='asset'||!scope||!antToolbarScope(scope.projectId,scope.resourceDomainId,scope.targetId))return null
 const reference=ANT_TOOLBAR_REFERENCES[scope.targetId as keyof typeof ANT_TOOLBAR_REFERENCES]
 return {...reference,name:reference.relativePath.split('/').at(-1)!}
})
const canUseApprovedAntReference=computed(()=>!!approvedAntReference.value&&!savedReferenceLibraryDisabled.value&&shownReferences.value.length===0)
function useApprovedAntReference(){
 if(!canUseApprovedAntReference.value||!approvedAntReference.value||savedReferencePersistentUnknown())return
 shownReferences.value.push({...approvedAntReference.value})
 referenceError.value='已关联该需求的既有原图摘要；保存并回读时由后台复验原文件。尚未提交生成。'
}

function attachSavedReference(selection:SavedReferenceLibrarySelection){
 try{
  const original=acceptSavedReferenceLibrarySelection({selection,identity:savedReferenceLibrary.value.identity,entries:savedReferenceLibrary.value.entries,target:referenceIdentity.value,existingReferences:shownReferences.value,disabled:savedReferenceLibraryDisabled.value||savedReferencePersistentUnknown(),maxReferences:4})
  shownReferences.value.push({...original});referenceError.value='已关联已保存素材到当前草稿，尚需保存并回读；未上传或启动生成。'
 }catch{referenceError.value='素材列表、目标或可编辑状态已变化，请重新核对并预览；未添加引用。'}
}
function referenceStorage(){return globalThis.sessionStorage}
function loadReferenceRecords(){try{referenceRecords.value=readWorkbenchReferenceUploads(referenceStorage());referenceStorageBlocked.value=false}catch{referenceStorageBlocked.value=true;referenceError.value='无法可靠读取上传恢复记录，已停止上传。原有引用保留。'}}
function clearReferenceSelection(keepQueue=false){if(!keepQueue){referenceQueue.value=[];referenceQueueIndex.value=-1;referenceQueueNotice.value='';referenceQueueBlocked.value=false}referenceEpoch++;referenceSelected.value=null;referenceFileName.value='';referenceLocalShown.value=false;referenceConfirmed.value=false;referencePreparing.value=false;referencePreviewEpoch++;referencePreviewBusy.value=false;clearReferenceThumbnails();referenceError.value=''}
watch([()=>store.context,aiReferenceUploadProvider,aiResourceReadProvider],()=>{clearReferenceSelection();referencesOpen.value=false},{flush:'sync'})
watch([referenceTarget,referenceIdentity],()=>clearReferenceSelection(),{flush:'sync'})
watch(referencesOpen,open=>{if(!open)clearReferenceSelection()})
async function chooseReferenceFile(file:File|undefined){
 if(!file||!referenceWritable.value||referenceUploading.value)return
 clearReferenceSelection(true);const token=referenceEpoch,target=referenceTarget.value,identity=referenceIdentity.value&&workbenchReferenceScopeKey(referenceIdentity.value),source=selection.currentSource
 referencePreparing.value=true
 try{
  const selected=await prepareLocalReference(file,{decode:async blob=>{if(typeof createImageBitmap!=='function')throw Error('decode-unavailable');const bitmap=await createImageBitmap(blob);try{return {width:bitmap.width,height:bitmap.height}}finally{bitmap.close()}}})
  if(token!==referenceEpoch||target!==referenceTarget.value||source!==selection.currentSource||!referenceIdentity.value||identity!==workbenchReferenceScopeKey(referenceIdentity.value))return
  referenceSelected.value=selected;referenceFileName.value=(file.name||'参考图').slice(0,240);loadReferenceRecords()
  if(referenceRecords.value.some(row=>row.projectId===referenceIdentity.value!.projectId&&row.projectPath===referenceIdentity.value!.projectPath&&row.originalSha256===selected.sha256&&row.receipt===null)||legacyWorkbenchUploadUnknown(referenceStorage(),referenceIdentity.value.projectId,selected.sha256)){referenceQueueBlocked.value=true;referenceStorageBlocked.value=true;referenceError.value='此文件存在结果未知的上传记录，请先回原工程和原层核对；未重新上传。'}
  const known=referenceRecords.value.find(row=>row.projectId===referenceIdentity.value!.projectId&&row.projectPath===referenceIdentity.value!.projectPath&&row.originalSha256===selected.sha256&&row.receipt)
  if(known?.receipt&&shownReferences.value.some(ref=>ref.sha256===known.receipt!.sha256)){referenceSelected.value=null;referenceError.value='此图片已关联到当前层，未重复上传。'}
 }catch(error){if(token===referenceEpoch){referenceError.value=error instanceof AiReferenceUploadError?error.message:'本地图片解码或上传恢复记录校验失败，未上传。';referenceSelected.value=null}}
 finally{if(token===referenceEpoch)referencePreparing.value=false}
}
async function selectQueuedReference(index:number){
 if(!Number.isInteger(index)||index<0||index>=referenceQueue.value.length||referencePreparing.value||referenceUploading.value||referenceStorageBlocked.value||referenceQueueBlocked.value)return
 referenceQueueIndex.value=index
 await chooseReferenceFile(referenceQueue.value[index])
}
async function selectReferenceFiles(files:File[]){
 if(!files.length||!referenceWritable.value||referencePreparing.value||referenceUploading.value||referenceStorageBlocked.value||referenceQueueBlocked.value)return
 clearReferenceSelection()
 const available=Math.max(0,4-shownReferences.value.length)
 if(!available){referenceQueueNotice.value='当前层已关联 4 张参考图，未加入任何文件。';return}
 referenceQueue.value=files.slice(0,available)
 if(files.length>available)referenceQueueNotice.value=`本层还可关联 ${available} 张；另有 ${files.length-available} 张未加入，请先处理当前队列。`
 await selectQueuedReference(0)
}
function referenceFileChange(event:Event){const input=event.target as HTMLInputElement,files=Array.from(input.files??[]);input.value='';void selectReferenceFiles(files)}
function referenceDrop(event:DragEvent){event.preventDefault();void selectReferenceFiles(Array.from(event.dataTransfer?.files??[]))}
function referencePaste(event:ClipboardEvent){const files=Array.from(event.clipboardData?.items??[]).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter((file):file is File=>file!==null);if(files.length){event.preventDefault();void selectReferenceFiles(files)}}
function scopeMatches(scope:WorkbenchReferenceScope,target:unknown,source:object|null){return referencesOpen.value&&referenceTarget.value===target&&selection.currentSource===source&&!!referenceIdentity.value&&workbenchReferenceScopeKey(referenceIdentity.value)===workbenchReferenceScopeKey(scope)}
function attachReference(record:WorkbenchReferenceUpload){
 if(!referenceWritable.value||!referenceIdentity.value||workbenchReferenceScopeKey(record)!==workbenchReferenceScopeKey(referenceIdentity.value)||!record.receipt)return
 const refs=shownReferences.value;if(refs.length>=4){referenceError.value='每层最多 4 张参考图。';return}if(refs.some(ref=>ref.sha256===record.receipt!.sha256)){referenceError.value='该规范化图片已在本层关联。';return}
 refs.push({name:record.name,relativePath:record.receipt.relativePath,sha256:record.receipt.sha256});referenceError.value='文件已上传，仅关联到本层草稿；还需保存并回读工作台。未作为生成输入。'
}
async function uploadReference(){
 const prepared=referenceSelected.value,scope=referenceIdentity.value,upload=aiReferenceUploadProvider.value,target=referenceTarget.value,source=selection.currentSource,token=referenceEpoch
 if(!referenceCanUpload.value||!prepared||!scope||!upload)return
 referenceConfirmed.value=false;referenceUploading.value=true
 const record:WorkbenchReferenceUpload={...scope,name:referenceFileName.value,originalSha256:prepared.sha256,mimeType:prepared.mimeType,width:prepared.width,height:prepared.height,receipt:null}
 try{
  const previous=readWorkbenchReferenceUploads(referenceStorage()).find(row=>row.projectId===scope.projectId&&row.projectPath===scope.projectPath&&row.originalSha256===prepared.sha256)
  if(previous&&!previous.receipt||legacyWorkbenchUploadUnknown(referenceStorage(),scope.projectId,prepared.sha256))throw Error('此文件已有未知上传，未重新发送。')
  // A known successful file can be explicitly associated with another layer without uploading its bytes again.
  if(previous?.receipt){record.receipt=previous.receipt;rememberWorkbenchReferenceUpload(referenceStorage(),record)}
  else{
   rememberWorkbenchReferenceUpload(referenceStorage(),record)
   const result=await upload.uploadReference(scope.projectId,{base64:prepared.base64,approved:true})
   record.receipt=decodeAiReferenceUploadReceipt(result,{sha256:prepared.sha256,mimeType:prepared.mimeType,width:prepared.width,height:prepared.height})
   rememberWorkbenchReferenceUpload(referenceStorage(),record)
  }
  if(token===referenceEpoch&&scopeMatches(scope,target,source)&&upload===aiReferenceUploadProvider.value){loadReferenceRecords();attachReference(record);referenceSelected.value=null;referenceLocalShown.value=false}
  else if(scopeMatches(scope,target,source)){loadReferenceRecords();referenceError.value='已保留原工程、原层和目标的上传回执；回到原位置后可明确恢复关联。'}
 }catch(error){
  if(error instanceof AiReferenceUploadError&&error.outcome!=='unknown'){
   try{releaseRejectedWorkbenchReferenceUpload(referenceStorage(),record)}catch{referenceStorageBlocked.value=true}
   referenceError.value=error.message+' 未自动重发；原输入保留，可核对后明确重试。'
  }else referenceError.value='上传结果需核对，原工程和原层记录已保留，未自动重发。'+(error instanceof Error?error.message:'')
  if(token===referenceEpoch&&scopeMatches(scope,target,source)){loadReferenceRecords();if(!(error instanceof AiReferenceUploadError&&error.outcome!=='unknown')){referenceQueueBlocked.value=true;referenceStorageBlocked.value=true}}
 }finally{referenceUploading.value=false}
}
function removeReference(index:number){if(referenceWritable.value&&!referenceUploading.value){shownReferences.value.splice(index,1);referenceError.value='仅移除本层草稿关联，磁盘原文件保留；请保存并回读工作台。'}}
async function previewReference(reference:WorkbenchReference){
  const reader=aiResourceReadProvider.value,scope=referenceIdentity.value,source=selection.currentSource,target=referenceTarget.value
  if(!reader||reader.referencePreviewEnabled===false||!scope||referencePreviewBusy.value||!shownReferences.value.includes(reference))return
  const token=++referencePreviewEpoch,key=referenceKey(reference),expectedHash=reference.sha256,expectedPath=reference.relativePath
  delete referenceThumbnailErrors.value[key];referencePreviewBusy.value=true;referenceError.value=''
  try{
   const result=await reader.previewReference(scope.projectId,expectedPath)
   if(token!==referencePreviewEpoch||!scopeMatches(scope,target,source)||reader!==aiResourceReadProvider.value||!shownReferences.value.includes(reference)||referenceKey(reference)!==key)return
   if(result.sha256!==expectedHash)throw Error('参考图内容哈希已变化，未展示。')
   if(result.mimeType!=='image/png'||!result.base64||!Number.isInteger(result.width)||!Number.isInteger(result.height)||result.width<1||result.height<1)throw Error('参考图预览回执无效，未展示。')
   referenceThumbnails.value={...referenceThumbnails.value,[key]:result}
  }catch(error){if(token===referencePreviewEpoch&&scopeMatches(scope,target,source)&&referenceKey(reference)===key){delete referenceThumbnails.value[key];const message=error instanceof Error?error.message:'参考图预览读取失败。';referenceThumbnailErrors.value={...referenceThumbnailErrors.value,[key]:message};referenceError.value=message}}
  finally{if(token===referencePreviewEpoch)referencePreviewBusy.value=false}
 }

defineExpose({chooseStep,taskActive,openProjectReferences,overviewProjectReferences,canOpenProjectReferences,projectReferenceBusy})
</script>
<template>
 <section class="workbench-manager" data-testid="art-workbench-manager">
  <div class="manager-actions"><button v-if="store.draft&&view==='specs'" :disabled="!editable" @click="newSpec()">新建规格</button><button v-if="store.draft&&view==='needs'" :disabled="!editable||!store.draft.specs.length" @click="newNeed()">新建需求</button><button v-if="store.phase==='ready'&&!store.draft" :disabled="!norm" @click="norm&&store.initialize(norm)">使用已保存规范初始化</button><button :disabled="!editable||!store.dirty||!norm||store.taskPending" @click="store.save()">保存修改</button><button v-if="store.phase==='unknown'||store.phase==='error'" :disabled="store.busy" @click="store.read(true)">重新核对服务器结果</button><details class="manager-more"><summary>更多 ⋯</summary><div><button :disabled="!store.context||store.busy||store.dirty" @click="store.read()">读取 / 刷新工作台</button><button v-if="view==='needs'" :disabled="!aiJobsReadProvider||!canReadNeedJobs||demandReadPhase==='reading'" @click="refreshDemandJobs">读取任务及视觉审阅状态</button><button :disabled="!selection.project||!aiJobsReadProvider||!store.capabilities?.existingJobLink" @click="browseJobs">查看现有真实任务</button><button v-if="store.draft" data-testid="workbench-project-references" @click="references('project')">项目参考 · {{ store.draft.projectReferences.length }}</button></div></details><span v-if="store.dirty" role="status">有未保存修改</span></div>
  <section class="art-readiness" aria-label="开始前的准备状态"><strong>开始前的准备状态</strong><span>规范：{{ specificationReadiness }}</span><span>目录：{{ directoryReadiness }}</span><span>模型启动器：{{ modelReadiness }}</span><span>支持类别：{{ store.capabilities?.preparedTasks ? '图标可准备；其他类别暂未接通' : '图标准备入口未就绪' }}</span></section>
  <p v-if="readOnly&&!resourceDomainId" role="status">原工程记录 · 尚未分配资源域，仅供读取；不会自动迁入蚂蚁或厨房。</p><p v-if="resourceDomainId&&!configuredAntDomain" role="status">目录待核对 · 当前资源域的生产操作尚未接通。</p><section v-if="resourceDomainId&&resourceDomainId!=='shared'" class="shared-resources" aria-label="公共资源来源"><div class="manager-actions"><strong>公共资源</strong><button :disabled="sharedReading||!canReadShared" @click="readShared">读取公共资源</button><button :disabled="!sharedAvailable" @click="emit('open-domain','shared')">前往公共管理</button></div><p v-if="!sharedAvailable" role="status">当前后台尚未声明公共资源域，未提供公共操作。</p><p v-else-if="!canReadShared" role="status">请先读取当前工作台，核实公共来源。</p><p v-if="sharedReading" role="status">正在读取公共资源…</p><p v-if="sharedError" role="alert">{{ sharedError }}</p><template v-if="sharedReceipt"><p v-if="!sharedReceipt.document">公共资源尚未配置。</p><ul v-else><li v-for="item in (view==='specs'?sharedReceipt.document.specs:sharedReceipt.document.needs)" :key="item.id">{{ item.name }} · v{{ item.version }} · 来自公共<details><summary>来源详情</summary><code>{{ item.id }} · {{ sharedReceipt.hash }}</code></details></li></ul><small>只读取公共原记录，未复制到当前资源域；跨域选用尚未接通。</small></template></section><p v-if="store.busy" role="status">{{ store.phase==='saving'?'正在保存并回读…':'正在读取工作台…' }}</p><p v-if="store.error" role="alert">{{ store.error }}</p><p v-if="message" role="alert">{{ message }}</p>
  <p v-if="store.taskError&&!store.taskResults.length" role="alert">{{ store.taskError }}</p><p v-if="!norm" role="status">请先在项目规范中读取并保存有效规范。</p><p v-if="store.draft&&norm&&store.draft.norm.hash!==norm.hash" class="review-notice" role="status">项目规范已更新，现有需求需核对；保留原规格快照和已绑定任务。</p>
  <template v-if="store.draft">
   <div class="manager-actions"><label>搜索<input v-model="query" placeholder="名称或标识"></label><label>类别<select v-model="filter"><option value="">全部类别</option><option v-for="category in ART_CATEGORIES" :value="category" :key="category">{{ workbenchLabels[category] }}</option></select></label><label v-if="view==='needs'">任务状态<select v-model="statusFilter" aria-label="筛选需求任务状态"><option value="">全部状态</option><option v-for="option in ART_NEED_VISUAL_FILTERS" :key="option.value" :value="option.value">{{ option.label }}</option></select></label></div>
   
   <div class="table-scroll"><table v-if="view==='specs'" data-testid="art-specification-table"><thead><tr><th>内容类型（原分类）</th><th>规格／用途</th><th>视觉风格</th><th>尺寸策略 / 尺寸</th><th>交付形式</th><th>工程目录／导出目录</th><th>版本</th><th>需求</th><th>操作</th></tr></thead><tbody><tr v-for="spec in specs" :key="spec.id"><td>{{ workbenchLabels[spec.category] }}</td><td>{{ spec.name }}<small>{{ spec.id }}</small></td><td>{{ spec.style||'沿用项目画风' }}<small>{{ normStore.base?.project?.visualMode?.toUpperCase()??'项目表现未读取' }}</small></td><td>{{ spec.sizePolicy==='fixed'?'固定尺寸':'单项尺寸（UI）' }}<small>{{ spec.width }} × {{ spec.height }}</small></td><td>{{ spec.imageOutput==='transparent-png'?'图片 · 透明 PNG':'交付形式待核对' }}</td><td>{{ spec.destination??'尚未配置' }}<small>{{ spec.exportDirectory??'尚未配置' }}</small></td><td>v{{ spec.version }}<small>{{ spec.references.length }} 张参考</small></td><td>{{ artSpecImpact(spec.id,store.draft.needs).total }}</td><td><button :disabled="!editable" @click="newSpec(spec)">编辑</button></td></tr><tr v-if="!specs.length"><td colspan="9">尚无匹配规格，请新建。</td></tr></tbody></table>
   <table v-else><thead><tr><th>选择</th><th>素材</th><th>内容类型（原分类）</th><th>引用规格</th><th>继承尺寸</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="need in needs" :key="need.id"><td><input type="checkbox" :aria-label="'选择需求 '+need.name" :checked="selectedNeeds.has(need.id)" :disabled="!canSelectForBatch(need)" @change="selectNeed(need.id,($event.target as HTMLInputElement).checked)"></td><td class="need-asset"><div class="need-identity"><div class="need-thumbnail"><img v-if="demandPreviews[need.id]" :src="demandPreviews[need.id]!.src" :alt="need.name+' · 已核对候选预览'" @error="demandPreviewFailed(need.id)"><span v-else class="no-preview">{{ demandPreviewErrors[need.id]||'无预览' }}</span></div><div class="need-identity-text"><strong>{{ need.name }}</strong><small>{{ need.id }}</small></div></div><button v-if="demandCandidate(need)" :disabled="!!demandPreviewBusy" @click="previewDemand(need)">{{ demandPreviewBusy===need.id?'读取中…':'预览候选' }}</button><small v-else>{{ !need.jobId?'尚无真实任务':demandReadPhase==='ready'?'没有当前需求可预览的候选':'请先回读任务' }}</small></td><td>{{ workbenchLabels[need.spec.category] }}</td><td>{{ need.spec.name }} · v{{ need.specVersion }}<small v-if="needsReview(store.draft,need,norm)" class="review-notice">需核对上游更新</small></td><td>{{ needOutputSize(need).width }} × {{ needOutputSize(need).height }}</td><td><el-tag class="companion-status-tag" :type="demandStatus(need).tone"><el-icon class="companion-status-icon" :class="{'is-loading':demandStatus(need).busy}" aria-hidden="true"><Loading v-if="demandStatus(need).busy"/><CircleClose v-else-if="demandStatus(need).tone==='danger'"/><Warning v-else-if="demandStatus(need).tone==='warning'"/><InfoFilled v-else/></el-icon>{{ demandStatus(need).label }}</el-tag><small>下一步：{{ nextNeedAction(need) }}</small><small v-if="needTaskBlockReason(need.id)" role="status">{{ needTaskBlockReason(need.id) }}</small><details v-if="need.jobId"><summary>任务信息</summary><code>{{ need.jobId }}</code></details></td><td><button :disabled="!canOpenNeed(need)" @click="openNeed(need)">{{ need.jobId?'处理任务':'开始处理' }}</button><details><summary>更多操作</summary><button :disabled="!editable||!!need.jobId" @click="newNeed(need)">编辑需求</button><button v-if="!need.jobId" :disabled="!editable||store.dirty||!store.capabilities?.existingJobLink||!aiJobsReadProvider" @click="openBinding(need)">绑定现有任务</button><button v-if="!need.jobId&&store.draft.specs.find(s=>s.id===need.specId)?.version!==need.specVersion" :disabled="!editable" @click="reviewNeed(need)">核对并采用新规格</button></details></td></tr><tr v-if="!needs.length"><td colspan="7">尚无匹配需求，请核对规格与筛选条件。</td></tr></tbody></table></div>
   <InfoTip label="工作台说明" :text="view==='specs'?'项目规范 → 规格范例 → 单素材内容参考逐层说明来源。保存规格不会覆盖已有需求快照。':'图标需求可创建准备任务，也可关联现有真实任务；生成由任务面板明确执行。人物、装备、技能、UI 尚不支持此入口；参考图条件模式限授权测试工程并由后台核对。'"/>
  </template>
  <div v-if="view==='needs'&&selectedNeeds.size" class="batch-actions" data-testid="workbench-batch-actions"><strong>已选 {{ selectedNeeds.size }} 项</strong><button @click="selectedNeeds=new Set()">清除选择</button><button :disabled="!selectedFailed" @click="openBatch('retry')">重试明确失败项</button><button @click="openBatch('produce')">批量生产</button><button :disabled="!store.canPrepareTasks||!norm||!selectedUnboundIds.length" @click="openPrepared(selectedUnboundIds)">仅创建准备任务</button></div>
  <ArtBatchProductionConfirm v-model:open="batchConfirm" :plan-key="batchPlanKey" :items="batchItems" :mode="batchMode" :busy="store.busy" :execution-available="false" blocked-reason="真实批量派发及失败重试合同尚未接通；此处不会提交生成。"/>
  <details v-if="store.taskResults.length" class="task-results" aria-label="逐项准备任务结果" :open="store.taskPending||store.taskBusy"><summary>准备任务记录（{{ store.taskResults.length }}条）</summary><header class="manager-actions"><h3>逐项任务结果</h3><button v-if="retryableIds.length" :disabled="!store.canPrepareTasks" @click="openPrepared(retryableIds)">仅重试明确拒绝项</button><button v-if="store.taskResults.some(row=>row.state==='not-started')" :disabled="!store.canPrepareTasks" @click="openPrepared(store.taskResults.filter(row=>row.state==='not-started').map(row=>row.needId),'continue')">继续未开始项</button></header><p v-if="store.taskError" role="alert">{{ store.taskError }}</p><p>这里只展示创建回执；当前生成状态请在真实任务面板查询。准备任务创建成功仅表示已有任务记录，创建时未执行生成或验收。人物、装备、技能、UI 仍不支持此创建入口。</p><div v-for="entry in store.taskResults" :key="entry.operationId" class="task-result"><strong>{{ entry.name }}</strong><small>{{ entry.referenceMode==='image-conditioning'?'Qwen Edit · 参考图条件':'ZImage · 文字生成（参考仅证据）' }}</small><el-tag class="companion-status-tag" :type="entry.state==='rejected'?'danger':entry.state==='unknown'?'warning':'info'">{{ taskStateLabels[entry.state] }}</el-tag><span v-if="taskBlockReason(entry.code)" role="status">{{ taskBlockReason(entry.code) }}<template v-if="entry.state==='unknown'">本次结果仍待核对，不会自动重发。</template></span><details><summary>技术回执</summary><small>{{ entry.jobId||entry.runId||entry.operationId }} {{ entry.code||'' }}</small><small v-if="entry.snapshotHash">封存输入 SHA-256（非图片哈希）：{{ entry.snapshotHash }}</small></details><div v-if="entry.state==='unknown'" class="manager-actions"><button :disabled="store.busy" @click="store.inspectPreparedTask(entry.operationId)">查询原操作</button><button :disabled="store.busy" @click="store.inspectPreparedTask(entry.operationId,true,true)">核对并完成原任务关联</button></div></div></details>
  <ArtTaskDetailDialog :open="preparedConfirm" title="核对准备任务" :step="2" :reached="2" :navigation-ready="false" @update:open="preparedConfirm=$event"><p>本次{{ preparedMode==='continue'?'继续':'创建' }} {{ preparedIds.length }} 项准备任务，逐项提交。遇到结果未知会停止后续项，不重发原请求；不会执行批量 GPU 生成。</p><ul><li v-for="row in preparedNeeds" :key="row.id"><template v-if="row.need"><strong>{{ row.need.name }}</strong><p>内容要求：{{ row.need.content }}</p><p>规格：{{ row.need.spec.name }} v{{ row.need.specVersion }} · {{ needOutputSize(row.need).width }} × {{ needOutputSize(row.need).height }} · 透明 PNG</p><p>导入目录：{{ row.need.spec.destination??'未配置' }}；导出目录：{{ row.need.spec.exportDirectory??'未配置' }}；参考 {{ preparedReferenceCount(row.id) }} 张（去重）</p></template><span v-else>需求未在已保存版本中找到，不能提交。</span></li></ul><template v-if="preparedMode==='new'"><label>准备任务模式<select v-model="preparedReferenceMode" aria-label="准备任务参考模式" :disabled="!store.canPrepareTasks" @change="preparedApproved=false"><option value="evidence-only">ZImage · 文字生成（参考仅证据）</option><option value="image-conditioning" :disabled="!!conditioningIssue">Qwen Edit · 参考图条件</option></select></label><p v-if="conditioningIssue" role="status">{{ conditioningMessage }}</p><p>{{ preparedReferenceMode==='image-conditioning'?'按项目 → 规格快照 → 需求固定顺序封存 1–3 张真实参考图，后台仍须核对规范、文件与模型；创建成功不代表已执行入模或生成。':'已上传参考图只封存为证据，不作为图片条件输入。' }}</p></template><p v-else>继续项沿用各自原记录的参考模式；不更改原 operation，也不重放未知项。</p><p>输入由后台读取已保存需求与规格快照。真实上传不等于已入模。</p><label><input v-model="preparedApproved" type="checkbox">我已核对选中需求，确认只创建准备任务</label><div class="manager-actions"><button @click="preparedConfirm=false">取消</button><button :disabled="!preparedApproved||preparedNeeds.some(row=>!row.need)||!store.canPrepareTasks||preparedMode==='new'&&preparedReferenceMode==='image-conditioning'&&!!conditioningIssue" @click="submitPrepared">确认创建准备任务</button></div></ArtTaskDetailDialog>
  <ArtTaskDetailDialog :open="view==='needs'&&taskActive&&!visualReviewOpen" :title="activeNeed?activeNeed.name+' · 任务详情':'现有真实任务'" :step="taskStep" :wide="false" :reached="taskReached" :navigation-ready="taskNavigationReady" @update:open="taskDialogOpenChanged" @step="chooseStep">
    <section class="linked-task" aria-label="具体任务工作区"><p v-if="store.draft&&activeNeed&&needsReview(store.draft,activeNeed,norm)" role="status" class="review-notice">上游已变化，以下保留原任务结果，请核对原快照。</p><p v-if="activeNeed">已关联真实任务；生成、视觉审阅、导入绑定和运行验收分别核对。</p><p v-if="!taskNavigationReady" role="status">请先读取并选择真实任务；尚未确认任务，不显示生产进度。</p><div class="task-original-operations"><h4>任务进度与操作</h4><AiJobsReadPanel :key="activeNeed?.jobId??'existing'" ref="jobsPanel" compact progressive :project="selection.project" :source="selection.currentSource" :workflow-step="taskNavigationReady?taskStep+1:undefined"/></div><button v-if="activeNeed&&taskReached>=3" type="button" data-testid="task-open-visual-review" @click="directReview=false;visualReviewOpen=true">打开视觉审阅</button></section>
  </ArtTaskDetailDialog>
   <ArtVisualReviewDialog :open="view==='needs'&&taskActive&&visualReviewOpen" :title="'视觉审阅 · '+(activeNeed?.name??'当前任务')" @update:open="!$event&&closeVisualReview()"><ArtOutputReviewPanel v-if="activeNeed" :active="visualReviewOpen" :provider="artReviewProvider" :context="store.context" :need="activeNeed" :job="artReviewCurrentJob" @visual-observation="acceptVisualObservation"/></ArtVisualReviewDialog>
  <el-dialog :model-value="!!specEditor" title="规格" align-center class="art-spec-editor-dialog" width="min(700px, calc(100vw - 28px))" @close="specEditor=null"><form v-if="specEditor" class="editor-grid" @submit.prevent="saveSpec"><label>规格标识<input v-model="specEditor.id" :readonly="!!originalId" required></label><label>规格名称<input v-model="specEditor.name" required></label><label>类别<select v-model="specEditor.category" @change="specEditor.category!=='ui'&&(specEditor.sizePolicy='fixed')"><option v-for="category in ART_CATEGORIES" :key="category" :value="category">{{ workbenchLabels[category] }}</option></select></label><label>尺寸策略<select v-model="specEditor.sizePolicy"><option value="fixed">固定尺寸</option><option value="per-asset" :disabled="specEditor.category!=='ui'">每项尺寸（仅 UI）</option></select></label><p v-if="!originalId" class="wide">初始尺寸 128 × 128 为示例，可修改；请按本项目实际要求确认后保存。</p><label>{{ specEditor.sizePolicy==='fixed'?'固定':'推荐' }}宽<input v-model.number="specEditor.width" type="number" min="1" max="4096" required></label><label>{{ specEditor.sizePolicy==='fixed'?'固定':'推荐' }}高<input v-model.number="specEditor.height" type="number" min="1" max="4096" required></label><p v-if="resourceDomainId&&!configuredAntDomain" class="wide" role="status">Creator 导入目录 / 导出暂存目录：未配置，待确认物理根、Bundle 和运行加载关系。</p><template v-else><label>Creator 资源目录<input v-model="specEditor.destination" required></label><label>导出目录<input v-model="specEditor.exportDirectory" required></label></template><label class="wide">规格画风补充<textarea v-model="specEditor.style" rows="3" :readonly="!!resourceDomainId"/></label><p v-if="resourceDomainId" class="wide">本片保留工程全局锁定；独立画风作用域未确认，不能用此字段覆盖。</p><p>透明 PNG · 规格 v{{ specEditor.version }} · 保存后已有需求需核对，原任务保留。</p><button type="button" @click="references('spec')">规格参考 · {{ specEditor.references.length }}</button><ArtSpecImpactSummary class="wide" :spec-id="originalId" :version="specEditor.version" :needs="store.draft?.needs??[]"/><p v-if="message" role="alert">{{ message }}</p><div class="manager-actions wide"><button type="button" @click="specEditor=null">取消</button><button type="submit" :disabled="!editable">采用到工作台草稿</button></div></form></el-dialog>
  <el-dialog :model-value="!!needEditor" title="素材需求" align-center class="art-need-editor-dialog" width="min(700px, calc(100vw - 28px))" @close="needEditor=null"><form v-if="needEditor" class="editor-grid" @submit.prevent="saveNeed"><label>需求标识<input v-model="needEditor.id" :readonly="!!originalId" required></label><label>需求名称<input v-model="needEditor.name" required></label><label>类别<select v-model="needCategory" :disabled="!!originalId" @change="needEditor.specId=''"><option v-for="category in ART_CATEGORIES" :key="category" :value="category">{{ workbenchLabels[category] }}</option></select></label><label>继承规格<select :value="needEditor.specId" :disabled="!!originalId" required @change="chooseSpec(($event.target as HTMLSelectElement).value)"><option value="">选择规格</option><option v-for="spec in selectedSpecs" :key="spec.id" :value="spec.id">{{ spec.name }} · v{{ spec.version }}</option></select></label><fieldset v-if="needEditor.specId" class="wide"><legend>继承规格 · 只读</legend><p>{{ needEditor.spec.name }} v{{ needEditor.specVersion }} · {{ needEditor.spec.sizePolicy==='fixed'?'固定尺寸，不可修改':'每项尺寸，可使用推荐值或自定尺寸' }}</p><p>{{ needEditor.spec.width }} × {{ needEditor.spec.height }} · 透明 PNG</p><p>{{ needEditor.spec.destination??'导入目录未配置' }} → {{ needEditor.spec.exportDirectory??'导出暂存未配置' }}</p><p>{{ needEditor.spec.style||'沿用项目画风' }}</p></fieldset><template v-if="needEditor.specId&&needEditor.spec.sizePolicy==='per-asset'&&needEditor.size"><label>本项宽<input v-model.number="needEditor.size.width" type="number" min="1" max="4096" required :readonly="!!needEditor.jobId"></label><label>本项高<input v-model.number="needEditor.size.height" type="number" min="1" max="4096" required :readonly="!!needEditor.jobId"></label></template><label class="wide">内容要求<textarea v-model="needEditor.content" rows="4" required maxlength="4096"/></label><button type="button" @click="references('asset')">单素材参考 · {{ needEditor.references.length }}</button><p v-if="needEditor.jobId">已绑定任务的尺寸和规格快照保持原值。内容修改不会改写原任务。</p><p v-if="message" role="alert">{{ message }}</p><div class="manager-actions wide"><button type="button" @click="needEditor=null">取消</button><button type="submit" :disabled="!editable">采用到工作台草稿</button></div></form></el-dialog>
  <el-dialog v-model="referencesOpen" align-center title="参考来源" width="min(1120px, calc(100vw - 28px))" class="art-reference-dialog"><section class="reference-editor" @paste="referencePaste"><p>{{ referenceScope }}</p><section v-if="approvedAntReference" aria-label="批准道具原图"><p>仅关联当前已批准道具的原文件；不上传、不替换原图，保存时复验文件摘要。</p><code>{{ approvedAntReference.relativePath }} · SHA-256 {{ approvedAntReference.sha256 }}</code><button type="button" data-testid="ant-approved-original-reference" :disabled="!canUseApprovedAntReference" @click="useApprovedAntReference">关联本需求原图（保存时复验）</button></section><p>文件上传后只关联本层草稿，还需保存并回读工作台；上传或保存不会自动作为生成输入。参考图条件模式仅授权测试工程显式选择，人物和 UI 仍不支持此创建入口。</p><p v-if="!referenceIdentity" role="status">请先填写当前规格或需求的有效标识，再选择参考图。</p><p v-if="!referenceWritable&&referenceIdentity" role="status">当前工作台或目标不可编辑，已有引用可查看。</p><ul v-if="shownReferences.length" class="reference-grid" aria-label="已关联参考图"><li v-for="(reference,index) in shownReferences" :key="referenceKey(reference)" class="reference-card" data-testid="reference-card"><img v-if="referenceThumbnails[referenceKey(reference)]" class="reference-card-image" data-testid="reference-card-image" :src="'data:image/png;base64,'+referenceThumbnails[referenceKey(reference)]!.base64" :alt="'已核对参考图：'+reference.name" @error="referenceImageFailed(reference)"><p v-else class="reference-placeholder" data-testid="reference-placeholder">{{ referenceThumbnailErrors[referenceKey(reference)]?'无预览 · 未验证':'尚未读取预览' }}</p><strong>{{ reference.name }}</strong><small>{{ reference.relativePath }} · SHA-256 {{ reference.sha256 }}</small><p v-if="referenceThumbnailErrors[referenceKey(reference)]" role="alert">{{ referenceThumbnailErrors[referenceKey(reference)] }}</p><button data-testid="reference-preview-action" :disabled="!aiResourceReadProvider||aiResourceReadProvider.referencePreviewEnabled===false||referencePreviewBusy" @click="previewReference(reference)">预览真实参考</button><button :disabled="!referenceWritable||referenceUploading" @click="removeReference(index)">移除草稿关联</button></li></ul><p v-else>此层尚未关联参考图。</p><div class="reference-drop" @dragover.prevent @drop="referenceDrop" tabindex="0"><label>选择 / 拖入 / 粘贴静态 PNG、JPEG 或 WebP（每张不超过 4 MiB，每层最多 4 张）<input type="file" multiple accept="image/png,image/jpeg,image/webp" :disabled="!referenceWritable||!aiReferenceUploadProvider||!store.capabilities?.referenceUpload||referencePreparing||referenceUploading||referenceStorageBlocked||referenceQueueBlocked" @change="referenceFileChange"></label></div><p v-if="referenceQueueNotice" role="status">{{ referenceQueueNotice }}</p><section v-if="referenceQueue.length" class="reference-selection-queue" data-testid="reference-selection-queue" aria-label="本地待确认图片"><p>本地队列：第 {{ referenceQueueIndex+1 }} / {{ referenceQueue.length }} 张。逐张预览并确认上传；不会自动上传或保存规范。</p><ol><li v-for="(file,index) in referenceQueue" :key="index"><span>{{ file.name||'粘贴图片' }}</span><button :aria-label="'预览队列图片 '+(index+1)" :disabled="referencePreparing||referenceUploading||referenceStorageBlocked||referenceQueueBlocked||!referenceWritable" @click="selectQueuedReference(index)">预览第 {{ index+1 }} 张{{ index===referenceQueueIndex?' · 当前':'' }}</button></li></ol><p v-if="referenceQueueBlocked" role="alert">队列已暂停：原上传结果待核对，未重发，也未继续其他图片。</p></section><p v-if="!aiReferenceUploadProvider||!store.capabilities?.referenceUpload" role="status">当前未接通上传服务，请核对后台配置；不会发送文件。</p><p v-if="referencePreparing" role="status">正在本地解码和校验文件…</p><div v-if="referenceSelected"><img class="reference-preview" :src="referenceLocalUrl" :alt="'本地预览：'+referenceFileName" @load="referenceLocalShown=true" @error="referenceLocalShown=false;referenceError='本地预览显示失败，已禁止上传。'"><p>{{ referenceFileName }} · {{ referenceSelected.width }} × {{ referenceSelected.height }}</p><label><input v-model="referenceConfirmed" type="checkbox" :disabled="!referenceLocalShown||referenceUploading">确认向当前工程上传此文件并关联本层草稿</label><button :disabled="!referenceCanUpload" @click="uploadReference">上传并关联本层草稿</button></div><p v-if="referenceUploading" role="status">正在上传文件，工作台引用尚未保存…</p><p v-if="referenceError" role="alert">{{ referenceError }}</p><p v-if="referencePreviewBusy" role="status">正在核对真实参考图…</p><SavedReferenceLibraryPicker :identity="savedReferenceLibrary.identity" :entries="savedReferenceLibrary.entries" :target="referenceIdentity" :existing-references="shownReferences" :reader="aiResourceReadProvider" :disabled="savedReferenceLibraryDisabled" :active="referencesOpen" @select="attachSavedReference"/><details v-if="scopeRecords.length"><summary>原层上传恢复记录</summary><div v-for="record in scopeRecords" :key="record.originalSha256"><p>{{ record.name }} · {{ record.scope }} / {{ record.targetId }} · 原图 SHA {{ record.originalSha256 }}</p><template v-if="record.receipt"><p>{{ record.receipt.relativePath }}</p><button :disabled="!referenceWritable||referenceUploading||shownReferences.some(ref=>ref.sha256===record.receipt?.sha256)" @click="attachReference(record)">明确恢复到本层草稿</button></template><p v-else>上传结果未知，文件可能已落盘；禁止重传，请核对原工程文件和回执。</p></div></details><button @click="referencesOpen=false;emit('open-references')">前往参考素材采集</button></section></el-dialog>
  <el-dialog :model-value="!!binding" title="绑定现有真实任务" width="700px" @close="binding=null"><p>绑定仅关联已有 jobId；保存时核对规范哈希、类别、素材标识、尺寸和目录等技术参数。生成与导入状态以任务回读为准；参考引用不代表已入模或通过风格验收。</p><p v-if="jobsBusy" role="status">正在回读真实任务…</p><p v-if="message" role="alert">{{ message }}</p><label>任务<select v-model="jobId" :disabled="jobsBusy||!!binding?.jobId"><option value="">选择现有任务</option><option v-for="job in jobs" :key="job.jobId" :value="job.jobId">{{ job.jobId }} · {{ job.state }}{{ job.historyOnly?' · 历史只读':'' }}</option></select></label><p v-if="!jobsBusy&&!jobs.length">当前没有可绑定的已读取任务。</p><button :disabled="jobsBusy||!jobId||store.busy||!!binding?.jobId" @click="bindJob">保存绑定并回读</button></el-dialog>
 </section>
</template>
<style scoped>
.art-readiness{flex-wrap:nowrap!important;overflow-x:auto;white-space:nowrap}
.manager-more{position:relative}.manager-more summary{cursor:pointer;padding:8px 12px;border:1px solid var(--el-border-color);border-radius:6px;list-style:none}.manager-more summary::-webkit-details-marker{display:none}.manager-more>div{position:absolute;right:0;top:100%;z-index:10;display:grid;min-width:220px;padding:6px;background:var(--el-bg-color);border:1px solid var(--el-border-color);border-radius:6px;box-shadow:0 8px 20px #0002}.manager-more>div button{text-align:left}
.task-production-steps{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.task-production-steps button.active{color:var(--el-color-primary);border-color:var(--el-color-primary);font-weight:600}.task-production-steps button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}.need-thumbnail{width:110px;min-width:100px}.need-thumbnail img{display:block;width:64px;height:64px;object-fit:contain;background:repeating-conic-gradient(var(--el-fill-color-light) 0% 25%,var(--el-bg-color) 0% 50%) 0/12px 12px}.no-preview{display:grid;place-items:center;min-height:64px;font-size:12px;color:var(--el-text-color-secondary);border:1px dashed var(--el-border-color);padding:5px}.need-thumbnail button{margin-top:6px}

.art-readiness{display:flex;gap:12px;flex-wrap:wrap;padding:12px;border:1px solid var(--el-border-color);border-radius:8px}.art-readiness span{font-size:13px}.batch-actions,.task-result{display:flex;align-items:center;gap:10px;flex-wrap:wrap;border:1px solid var(--el-border-color);padding:12px;border-radius:6px}.batch-actions{position:sticky;bottom:12px;z-index:2;background:var(--el-fill-color-light)}.task-results{display:block;border:1px solid var(--el-border-color);border-radius:6px;padding:12px}.task-results>summary{cursor:pointer;font-weight:600}.task-results[open]>summary{margin-bottom:12px}.task-result small{overflow-wrap:anywhere}.reference-editor{display:grid;gap:12px}.reference-editor p{overflow-wrap:anywhere}.reference-editor li{display:grid;gap:8px;margin-bottom:12px}.reference-editor small{overflow-wrap:anywhere}.reference-preview{display:block;max-width:100%;max-height:300px;object-fit:contain}.reference-drop{border:1px dashed var(--el-border-color);padding:16px;border-radius:6px}.reference-drop label{display:grid;gap:8px}.workbench-manager{display:grid;gap:16px}.manager-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.manager-actions h3{margin:0}.manager-actions label{display:grid;gap:5px}.workbench-manager button{padding:7px 12px;background:var(--el-bg-color);color:var(--el-text-color-primary);border:1px solid var(--el-border-color);border-radius:5px;cursor:pointer;font:inherit}.workbench-manager button:disabled{opacity:.5;cursor:default}.workbench-manager input,.workbench-manager select,.workbench-manager textarea{font:inherit;color:var(--el-text-color-primary);background:var(--el-bg-color);border:1px solid var(--el-border-color);border-radius:5px;padding:8px;max-width:100%;box-sizing:border-box}.table-scroll{overflow-x:auto}table{width:100%;min-width:980px;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:14px 12px;border-bottom:1px solid var(--el-border-color);vertical-align:top}th{background:var(--el-fill-color-light);white-space:nowrap}td{overflow-wrap:anywhere}td small{display:block;margin-top:7px;color:var(--el-text-color-secondary)}td button{margin:0 5px 5px 0}.review-notice{color:var(--el-color-warning-dark-2)!important}.editor-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.editor-grid label{display:grid;gap:7px}.wide{grid-column:1/-1}.linked-task{border-top:1px solid var(--el-border-color);padding-top:16px}fieldset{border:1px solid var(--el-border-color);border-radius:6px;overflow-wrap:anywhere}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}@media(max-width:650px){.editor-grid{grid-template-columns:1fr}th,td{padding:10px 8px}.manager-actions{align-items:stretch}}
.reference-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px;padding:0;list-style:none}.reference-card{display:flex;flex-direction:column;gap:8px;min-width:0;border:1px solid var(--el-border-color);padding:12px;border-radius:6px}.reference-card small{overflow-wrap:anywhere}.reference-card-image,.reference-placeholder{width:100%;height:140px;object-fit:contain;background:var(--el-fill-color-light)}.reference-placeholder{display:grid;place-items:center;margin:0;color:var(--el-text-color-secondary)}
.reference-selection-queue{display:grid;gap:8px;overflow-wrap:anywhere}.reference-selection-queue ol{display:grid;gap:8px;margin:0;padding-left:24px}.reference-selection-queue li{padding:4px}.reference-selection-queue button{margin-left:8px}

.batch-actions{position:sticky;bottom:14px;background:var(--el-bg-color,#fff);box-shadow:0 4px 28px #27334c1a;border:1px solid var(--el-color-primary-light-7);border-radius:8px;padding:11px 14px;z-index:1}.task-original-operations{margin:10px 0}.task-original-operations>summary{cursor:pointer;color:var(--el-text-color-secondary);margin-bottom:10px}@media(max-width:700px){.batch-actions{align-items:flex-start;flex-direction:column}}

/* Declaration bodies below are reused from the approved prototype. */
.workbench-manager,.reference-editor{--primary:#7058df;--line:#e2e7f0;--muted:#718098}
th,td{padding:11px 10px;border-bottom:1px solid #edf0f5;vertical-align:middle}
th{background:#f8f9fc;color:#718098;font-weight:500;white-space:nowrap}
tbody tr:hover{background:#fcfbff}
.workbench-manager td button{border:0;background:none;color:var(--primary);padding:5px;white-space:nowrap}
.workbench-manager button{cursor:pointer;background:#fff;border:1px solid #dce2ee;color:#56657e;border-radius:6px;padding:8px 12px}
.workbench-manager button:disabled{opacity:.5;cursor:not-allowed}
.workbench-manager input,.workbench-manager select,.workbench-manager textarea{width:100%;padding:9px 10px;border:1px solid #dce2ee;border-radius:6px;background:#fff;color:#283650}
.workbench-manager input[type=checkbox]{width:auto;accent-color:var(--primary)}
.manager-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.manager-actions label>input{width:220px}
.manager-actions select{width:auto}
.need-identity{display:flex;align-items:center;gap:10px}
.need-identity strong,.need-identity small{display:block}
.need-identity small{margin-top:3px}
.need-thumbnail{width:44px;height:44px;display:grid;place-items:center;border-radius:7px;background:repeating-conic-gradient(#f0edf6 0% 25%,#fff 0% 50%) 0/12px 12px;flex-shrink:0}
.need-thumbnail{min-width:44px}.need-thumbnail img{width:44px;height:44px;object-fit:contain}.need-thumbnail .no-preview{width:44px;min-height:44px;padding:0;border:0;font-size:11px}.need-asset{min-width:180px}
.editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.editor-grid label{display:grid;gap:7px;font-size:13px}
.editor-grid .wide{grid-column:1/-1}
@media (max-width:700px) {.editor-grid{grid-template-columns:1fr}
}
@media (max-width:700px) {.editor-grid .wide{grid-column:auto}
}
.reference-drop{border:2px dashed #c9c2df;border-radius:9px;background:#fcfbff;padding:24px;display:grid;justify-items:center;gap:12px;margin:14px 0 22px;text-align:center}
.reference-drop span{font-size:12px;color:var(--muted)}
@media (max-width:700px) {.reference-drop{padding:16px 12px}
}
.reference-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-top:12px}
.reference-card{border:1px solid var(--line);border-radius:7px;padding:10px;display:grid;gap:8px;font-size:12px;overflow-wrap:anywhere}
.reference-card-image {width:100%;height:150px;object-fit:contain;background:#f6f8fc;border-radius:5px;max-width:100%
}
.reference-card button{justify-self:start}
@media (max-width:700px) {.reference-grid{grid-template-columns:1fr}
}
.reference-card.reference-card{display:grid}.reference-card-image,.reference-placeholder{height:150px}.reference-drop label{justify-items:center}.reference-drop input{max-width:100%}
.art-reference-dialog{--primary:#7058df;--line:#e2e7f0;--muted:#718098;--el-dialog-padding-primary:0;padding:0;overflow:auto}
.art-reference-dialog{border:1px solid var(--line);border-radius:10px;color:#283650;width:min(700px,calc(100vw - 28px));max-height:calc(100dvh - 44px);padding:0;box-shadow:0 18px 60px #16213930}
.art-reference-dialog :deep(.el-dialog__header){padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}
.art-reference-dialog :deep(.el-dialog__body){padding:18px 20px;overflow:auto}
@media (max-width:700px) {.art-reference-dialog :deep(.el-dialog__header){padding:12px 14px}
}
@media (max-width:700px) {.art-reference-dialog :deep(.el-dialog__body){padding:14px}
}
.art-reference-dialog{width:var(--el-dialog-width,min(700px,calc(100vw - 28px)))}.art-reference-dialog :deep(.el-dialog__header){margin-right:0}.art-reference-dialog :deep(.el-dialog__title){font-size:16px;font-weight:600}.art-reference-dialog :deep(.el-dialog__headerbtn){position:static;display:grid;place-items:center;width:auto;height:auto;font-size:20px;padding:0 4px;color:#8b97ac}
.art-spec-editor-dialog{--primary:#7058df;--line:#e2e7f0;--muted:#718098;--el-dialog-padding-primary:0;padding:0;overflow:auto}
.art-spec-editor-dialog{border:1px solid var(--line);border-radius:10px;color:#283650;width:min(700px,calc(100vw - 28px));max-height:calc(100dvh - 44px);padding:0;box-shadow:0 18px 60px #16213930}
.art-spec-editor-dialog :deep(.el-dialog__header){padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}
.art-spec-editor-dialog :deep(.el-dialog__body){padding:18px 20px;overflow:auto}
@media (max-width:700px) {.art-spec-editor-dialog :deep(.el-dialog__header){padding:12px 14px}
}
@media (max-width:700px) {.art-spec-editor-dialog :deep(.el-dialog__body){padding:14px}
}
.art-spec-editor-dialog{width:var(--el-dialog-width,min(700px,calc(100vw - 28px)))}.art-spec-editor-dialog :deep(.el-dialog__header){margin-right:0}.art-spec-editor-dialog :deep(.el-dialog__title){font-size:16px;font-weight:600}.art-spec-editor-dialog :deep(.el-dialog__headerbtn){position:static;display:grid;place-items:center;width:auto;height:auto;font-size:20px;padding:0 4px;color:#8b97ac}
.art-need-editor-dialog{--primary:#7058df;--line:#e2e7f0;--muted:#718098;--el-dialog-padding-primary:0;padding:0;overflow:auto}
.art-need-editor-dialog{border:1px solid var(--line);border-radius:10px;color:#283650;width:min(700px,calc(100vw - 28px));max-height:calc(100dvh - 44px);padding:0;box-shadow:0 18px 60px #16213930}
.art-need-editor-dialog :deep(.el-dialog__header){padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}
.art-need-editor-dialog :deep(.el-dialog__body){padding:18px 20px;overflow:auto}
@media (max-width:700px) {.art-need-editor-dialog :deep(.el-dialog__header){padding:12px 14px}
}
@media (max-width:700px) {.art-need-editor-dialog :deep(.el-dialog__body){padding:14px}
}
.art-need-editor-dialog{width:var(--el-dialog-width,min(700px,calc(100vw - 28px)))}.art-need-editor-dialog :deep(.el-dialog__header){margin-right:0}.art-need-editor-dialog :deep(.el-dialog__title){font-size:16px;font-weight:600}.art-need-editor-dialog :deep(.el-dialog__headerbtn){position:static;display:grid;place-items:center;width:auto;height:auto;font-size:20px;padding:0 4px;color:#8b97ac}
</style>
