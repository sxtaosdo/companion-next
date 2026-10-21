<script setup lang="ts">
import { computed, toRaw } from 'vue'
import { CircleCheck, Loading, Minus, Warning } from '@element-plus/icons-vue'
import InfoTip from './InfoTip.vue'
import ProjectStatusTag from './ProjectStatusTag.vue'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { useAiResourceReadStore } from '../stores/ai-resource-read'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { companionBrowserProvider } from '../companion-browser-integration'
import { AI_JOB_STATE_LABELS, type AiJobState } from '../domain/ai-jobs-read'
import { aiResourceReadProvider } from '../ai-resource-read-integration'
const props=defineProps<{jobs?:{projectId:string;projectPath:string;source:object|null;loading:boolean;error:string;observedAt:string;hasRead:boolean;state:AiJobState|null}|null}>()
const selection=useRegisteredProjectStore(), directory=selection.directory, resource=useAiResourceReadStore(), operations=useCreatorOperationsStore()
type Tone='info'|'success'|'warning'|'danger'
interface State { text:string; tone:Tone; busy?:boolean; detail?:string }
const registration=computed<State>(()=>directory.projectLoading?{text:'登记读取中',tone:'info',busy:true}:directory.projectError?{text:'登记读取失败',tone:'danger',detail:directory.projectError}:selection.currentSource?{text:'登记已读取',tone:'success'}:!companionBrowserProvider.value?{text:'登记接口未接入',tone:'info'}:{text:'登记未连接',tone:'info'})
const sameProject=computed(()=>!!selection.project&&!!selection.currentSource&&resource.project?.id===selection.project.id&&resource.project.path===selection.project.path&&resource.project.name===selection.project.name&&resource.provider===aiResourceReadProvider.value)
const specification=computed<State>(()=>{
 if(!selection.project)return {text:'未选择工程',tone:'info'}
 if(!aiResourceReadProvider.value)return {text:'规范接口未接入',tone:'info'}
 if(!sameProject.value)return {text:'规范未读取',tone:'info'}
 if(resource.loading)return {text:'规范读取中',tone:'info',busy:true}
 if(resource.error)return {text:'规范读取失败',tone:'danger',detail:resource.error}
 if(!resource.resource)return {text:'规范未读取',tone:'info'}
 if(resource.resource.state==='missing')return {text:'规范未配置',tone:'warning'}
 if(resource.resource.state==='invalid')return {text:'规范待修正',tone:'warning'}
 if(resource.resource.migrationRequired)return {text:'规范待迁移',tone:'warning'}
 return {text:'规范已读取',tone:'success'}
})
const task=computed<State|null>(()=>{
 const jobs=props.jobs
 if(!jobs||!selection.project||toRaw(jobs.source)!==selection.currentSource||jobs.projectId!==selection.project.id||jobs.projectPath!==selection.project.path)return null
 if(jobs.loading)return {text:'任务读取中',tone:'info',busy:true}
 if(jobs.error)return {text:'任务读取失败',tone:'danger',detail:jobs.error}
 if(!jobs.hasRead)return {text:'任务未读取',tone:'info'}
 if(!jobs.state)return {text:'任务列表已读取',tone:'success'}
 const tone:Tone=jobs.state==='failed'?'danger':['unknown','import_unknown','blocked','awaiting_selection','imported_pending_verification'].includes(jobs.state)?'warning':'info'
 return {text:AI_JOB_STATE_LABELS[jobs.state],tone,busy:jobs.state==='running',detail:jobs.observedAt?`任务状态读取于 ${jobs.observedAt}`:undefined}
})
const operation=computed(()=>selection.project?[...operations.receipts].reverse().find(item=>item.project.id===selection.project!.id&&operations.isReceiptCurrent(item.id)&&(item.phase==='sending'||item.snapshotRevision===directory.projectSnapshotRevision)):undefined)
const identity=computed(()=>selection.project?`${selection.project.name}；${selection.project.path}；${selection.project.id}`:selection.requestedId?'所选工程不可用，请重新选择':'请选择已登记工程')
function icon(state:State){return state.busy?Loading:state.tone==='success'?CircleCheck:['warning','danger'].includes(state.tone)?Warning:Minus}
</script>
<template>
 <section class="art-status-bar" aria-label="资源工作区状态" data-testid="art-status-bar">
  <div class="art-current-project"><span>当前工程</span><strong :title="identity">{{ selection.project?.name || (selection.requestedId?'所选工程不可用':'未选择') }}</strong><InfoTip v-if="selection.project" label="当前工程详情" :text="identity"/></div>
  <div class="art-status-items" role="status" aria-live="polite">
   <el-tag size="small" :type="registration.tone" data-status="registration"><el-icon :class="{'is-loading':registration.busy}"><component :is="icon(registration)"/></el-icon>{{ registration.text }}</el-tag>
   <span v-if="selection.project" class="art-creator-state"><span>Creator</span><ProjectStatusTag :status="selection.status" :operation="operation" :passive="selection.currentSource?.runtimeProbesEnabled===false" :stop-acknowledged="operations.isExpectedStopDisconnect(selection.project.id)"/></span>
   <el-tag size="small" :type="specification.tone" data-status="specification"><el-icon :class="{'is-loading':specification.busy}"><component :is="icon(specification)"/></el-icon>{{ specification.text }}</el-tag>
   <el-tag v-if="task" size="small" :type="task.tone" data-status="task"><el-icon :class="{'is-loading':task.busy}"><component :is="icon(task)"/></el-icon>{{ task.text }}</el-tag>
   <InfoTip v-if="registration.detail||specification.detail||task?.detail" label="资源状态详情" :text="[registration.detail,specification.detail,task?.detail].filter(Boolean).join('；')"/>
  </div>
  <div v-if="$slots.default" class="art-status-actions"><slot/></div>
 </section>
</template>
<style scoped>
.art-status-bar{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;padding:12px 14px;background:#fff;border:1px solid #e2e7f0;border-radius:10px;min-width:0}.art-current-project,.art-status-items,.art-creator-state{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.art-current-project{min-width:0}.art-current-project>span,.art-creator-state>span{font-size:12px;color:var(--el-text-color-secondary)}.art-current-project strong{font-size:13px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.art-status-bar :deep(.el-tag__content){display:inline-flex;align-items:center;gap:4px}.art-status-actions{margin-left:auto;font-size:12px}@media(max-width:600px){.art-current-project{flex-basis:100%}.art-current-project strong{max-width:calc(100vw - 150px)}}
</style>
