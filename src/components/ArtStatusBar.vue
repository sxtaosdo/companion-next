<script setup lang="ts">
import { computed, inject, toRaw } from 'vue'
import { routerKey } from 'vue-router'
import { Refresh } from '@element-plus/icons-vue'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { CircleCheck, CircleClose, Loading, Minus, Warning } from '@element-plus/icons-vue'
import InfoTip from './InfoTip.vue'
import ProjectStatusTag from './ProjectStatusTag.vue'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { useArtSpecificationContext } from '../composables/useArtSpecificationContext'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { companionBrowserProvider } from '../companion-browser-integration'
import { AI_JOB_STATE_LABELS, type AiJobState } from '../domain/ai-jobs-read'
const props=withDefaults(defineProps<{projectPicker?:boolean;showCreator?:boolean;showModel?:boolean;service?:{label:string;text:string;tone:'primary'|'info'|'success'|'warning'|'danger';busy?:boolean}|null;jobs?:{projectId:string;projectPath:string;source:object|null;loading:boolean;error:string;observedAt:string;hasRead:boolean;state:AiJobState|null;historyOnly?:boolean}|null}>(),{projectPicker:true,showCreator:false,showModel:false,service:null})
const emit=defineEmits<{ 'open-specification': [] }>()
const router=inject(routerKey,null),knowledge=useKnowledgeReadStore()
// Routed pages own selection through their query watcher; selecting twice cancels the first read.
function selectProject(id:string){if(router)void router.push({path:router.currentRoute.value.path,query:{...router.currentRoute.value.query,project:id}});else selection.restoreRouteProject(id)}
function refreshProjects(){if(directory.provider)void directory.refreshProjects();else if(companionBrowserProvider.value)void directory.connect(companionBrowserProvider.value)}
const model=computed<State>(()=>knowledge.provider!==knowledgeReadProvider.value||!knowledge.provider?{text:'未读取',tone:'info'}:knowledge.statusLoading?{text:'读取中',tone:'primary',busy:true}:knowledge.serviceError?{text:'读取失败',tone:'danger'}:knowledge.services?.model?.running===true?{text:'已连接',tone:'success'}:knowledge.services?.model?.running===false?{text:'未连接',tone:'info'}:knowledge.services?{text:'未知，待核对',tone:'warning'}:{text:'未读取',tone:'info'})
const selection=useRegisteredProjectStore(), directory=selection.directory, operations=useCreatorOperationsStore()
const {art,specification,specificationSource,specificationActionLabel,busy:specBusy,canRefresh,refresh:refreshSpecification}=useArtSpecificationContext()
function openSpecification(){if(specificationActionLabel.value)emit('open-specification')}

type Tone='primary'|'info'|'success'|'warning'|'danger'
interface State { text:string; tone:Tone; busy?:boolean; detail?:string }
const registration=computed<State>(()=>directory.projectLoading?{text:'登记读取中',tone:'primary',busy:true}:directory.projectError?{text:'登记读取失败',tone:'danger',detail:directory.projectError}:selection.currentSource?{text:'登记已读取',tone:'success'}:!companionBrowserProvider.value?{text:'登记接口未接入',tone:'info'}:{text:'登记未连接',tone:'info'})
const task=computed<State|null>(()=>{
 const jobs=props.jobs
 if(!jobs||!selection.project||toRaw(jobs.source)!==selection.currentSource||jobs.projectId!==selection.project.id||jobs.projectPath!==selection.project.path)return null
 if(jobs.loading)return {text:'任务读取中',tone:'primary',busy:true}
 if(jobs.error)return {text:'任务读取失败',tone:'danger',detail:jobs.error}
 if(!jobs.hasRead)return {text:'任务未读取',tone:'info'}
 if(!jobs.state)return {text:'任务列表已读取',tone:'success'}
 if(jobs.historyOnly)return {text:'历史任务 · '+AI_JOB_STATE_LABELS[jobs.state]+' · 只读，待核对',tone:jobs.state==='failed'?'danger':'warning',busy:false,detail:'原回执明确绑定旧工程版本，仅可查看；不能作为当前执行或验收证明。'}
 const tone:Tone=jobs.state==='running'?'primary':jobs.state==='failed'?'danger':['selected','reusable'].includes(jobs.state)?'success':['unknown','import_unknown','blocked','awaiting_selection','imported_pending_verification','waiting_service'].includes(jobs.state)?'warning':'info'
 const text=AI_JOB_STATE_LABELS[jobs.state]+(['unknown','import_unknown'].includes(jobs.state)?' · 待核对':'')
 return {text,tone,busy:jobs.state==='running',detail:jobs.observedAt?`任务状态读取于 ${jobs.observedAt}`:undefined}
})
const operation=computed(()=>selection.project?[...operations.receipts].reverse().find(item=>item.project.id===selection.project!.id&&operations.isReceiptCurrent(item.id)&&(item.phase==='sending'||item.snapshotRevision===directory.projectSnapshotRevision)):undefined)
const identity=computed(()=>selection.project?`${selection.project.name}；${selection.project.path}；${selection.project.id}`:selection.requestedId?'所选工程不可用，请重新选择':'请选择已登记工程')
function icon(state:State){return state.busy?Loading:state.tone==='success'?CircleCheck:state.tone==='danger'?CircleClose:state.tone==='warning'?Warning:Minus}
</script>
<template>
 <section class="art-status-bar" aria-label="资源工作区状态" data-testid="art-status-bar">
  <div class="art-current-project"><span>当前工程</span><el-select v-if="projectPicker && selection.projects.length" :model-value="selection.project?.id ?? ''" aria-label="当前登记工程" placeholder="请选择工程" :disabled="directory.projectLoading" @update:model-value="selectProject"><el-option v-for="project in selection.projects" :key="project.id" :value="project.id" :label="project.name"/></el-select><strong v-else :title="identity">{{ selection.project?.name || (selection.requestedId?'所选工程不可用':'未选择') }}</strong><span v-if="projectPicker && selection.projects.length && selection.requestedId && !selection.project && !directory.projectLoading" role="status">所选工程不可用</span><InfoTip v-if="selection.project" label="当前工程详情" :text="identity"/></div>
  <div class="art-status-items" role="status" aria-live="polite">
   <el-tag class="companion-status-tag" size="small" :type="registration.tone" data-status="registration"><el-icon class="companion-status-icon" aria-hidden="true" :class="{'is-loading':registration.busy}"><component :is="icon(registration)"/></el-icon>{{ registration.text }}</el-tag>
   <span v-if="showCreator && selection.project" class="art-creator-state"><span>Creator</span><ProjectStatusTag :status="selection.status" :operation="operation" :passive="selection.currentSource?.runtimeProbesEnabled===false" :stop-acknowledged="operations.isExpectedStopDisconnect(selection.project.id)"/></span>
   <el-tag class="companion-status-tag" size="small" :type="specification.tone" data-status="specification" :data-spec-state="specification.kind" :title="specification.detail"><el-icon class="companion-status-icon" aria-hidden="true" :class="{'is-loading':specification.busy}"><component :is="icon(specification)"/></el-icon>{{ specification.text }}</el-tag>
   <small v-if="specificationSource" class="art-spec-source" :title="specificationSource.title">{{ specificationSource.text }}</small>
   <el-button v-if="specificationActionLabel" size="small" :type="specification.kind==='missing'?'primary':undefined" data-testid="open-art-specification" @click="openSpecification">{{ specificationActionLabel }}</el-button>
   <el-tag class="companion-status-tag" v-if="task" size="small" :type="task.tone" data-status="task"><el-icon class="companion-status-icon" aria-hidden="true" :class="{'is-loading':task.busy}"><component :is="icon(task)"/></el-icon>{{ task.text }}</el-tag>
   <el-tag class="companion-status-tag" v-if="showModel" size="small" :type="model.tone" data-status="model" title="仅表示模型启动器的已有观测，不代表生成模型已就绪"><el-icon class="companion-status-icon" aria-hidden="true" :class="{'is-loading':model.busy}"><component :is="icon(model)"/></el-icon>模型启动器 · {{ model.text }}</el-tag>
   <el-tag class="companion-status-tag" v-if="service" size="small" :type="service.busy?'primary':service.tone" data-status="service"><el-icon class="companion-status-icon" aria-hidden="true" :class="{'is-loading':service.busy}"><component :is="icon(service)"/></el-icon>{{ service.label }} · {{ service.text }}</el-tag>
   <el-button v-if="projectPicker && companionBrowserProvider" :icon="Refresh" text aria-label="刷新登记工程" :loading="directory.projectLoading" @click="refreshProjects"/>
   <el-button aria-label="读取工程规范" size="small" :loading="specBusy" :disabled="!canRefresh" :title="art.dirty ? '请先保存当前规范草稿；刷新不会丢弃未保存输入' : undefined" @click="refreshSpecification">读取 / 刷新工程规范</el-button>
   <InfoTip v-if="registration.detail||specification.detail||task?.detail" label="资源状态详情" :text="[registration.detail,specification.detail,task?.detail].filter(Boolean).join('；')"/>
  </div>
  <div v-if="$slots.default" class="art-status-actions"><slot/></div>
 </section>
</template>
<style scoped>
.art-status-bar{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;padding:12px 14px;background:#fff;border:1px solid #e2e7f0;border-radius:10px;min-width:0}.art-current-project,.art-status-items,.art-creator-state{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.art-current-project{min-width:0}.art-current-project>span,.art-creator-state>span{font-size:12px;color:var(--el-text-color-secondary)}.art-current-project :deep(.el-select){width:200px}.art-current-project strong{font-size:13px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.art-spec-source{font-size:12px;color:var(--el-text-color-secondary)}.art-status-actions{margin-left:auto;font-size:12px}@media(max-width:600px){.art-current-project{flex-basis:100%}.art-current-project :deep(.el-select){width:200px}.art-current-project strong{max-width:calc(100vw - 150px)}}
</style>
