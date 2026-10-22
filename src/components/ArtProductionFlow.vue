<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import ArtStatusBar from './ArtStatusBar.vue'
import AiResourceReadView from '../views/AiResourceReadView.vue'
import AiTaskCreationPanel from './AiTaskCreationPanel.vue'
import AiJobsReadPanel from './AiJobsReadPanel.vue'
import AssetInventorySummary from './AssetInventorySummary.vue'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { useAiResourceReadStore } from '../stores/ai-resource-read'
import { useProjectArtSpecStore } from '../stores/project-art-spec'
import { useAiResourceEditorStore } from '../stores/ai-resource-editor'
import { aiTaskCreationProvider } from '../ai-task-creation-integration'
import type { AiTaskCreatedEvent } from '../stores/ai-task-creation'
import { artProductionStage, canChooseArtStage } from '../domain/art-production-flow'
const props=withDefaults(defineProps<{ game?:boolean; embedded?:boolean; category?:'icon'|'ui'|'ip'; active?:boolean }>(),{embedded:false,category:'icon',active:true})
const emit=defineEmits<{ 'stage-change':[value:{step:number;reached:number}] }>()
const selection=useRegisteredProjectStore(), resource=useAiResourceReadStore(), art=useProjectArtSpecStore(), editor=useAiResourceEditorStore()
const step=ref(0), reached=ref(0), jobsVisited=ref(false)
const planning=reactive({name:'',purpose:'',prompt:''})
const projectStates=new WeakMap<object,Map<string,{step:number;reached:number;jobsVisited:boolean;planning:typeof planning}>>()
let previousContext:{source:object;key:string}|null=null
const categoryLabel=computed(()=>props.category==='ui'?'游戏 UI':props.category==='ip'?'人物 / IP':'图标')
const jobsPanel=ref<InstanceType<typeof AiJobsReadPanel>|null>(null)
const labels=['项目规范','资源规划','生成素材','视觉审阅','导入绑定','运行验收']
const configDirty=computed(()=>art.dirty || (!!editor.project && editor.project.id===selection.project?.id && editor.project.path===selection.project?.path && (editor.dirty||editor.busy||!!editor.pendingFence)))
const specReady=computed(()=>!!selection.project && !configDirty.value && !art.pending && !art.blocked && (
  (art.context?.projectId===selection.project.id && art.context.projectPath===selection.project.path && art.context.source===selection.currentSource && !!art.base && !!art.hash && !art.errors.length && !['unknown','reading','error'].includes(art.phase)) ||
  (resource.project?.id===selection.project.id && resource.project.path===selection.project.path && resource.resource?.state==='valid' && !resource.resource.migrationRequired && !resource.loading && !resource.error)))
const taskStage=computed(()=>artProductionStage(jobsPanel.value?.workflowSnapshot??null))
watch(()=>[selection.project?.id,selection.project?.path,selection.currentSource] as const,()=>{
 if(previousContext){let cached=projectStates.get(previousContext.source);if(!cached){cached=new Map();projectStates.set(previousContext.source,cached)}cached.set(previousContext.key,{step:step.value,reached:reached.value,jobsVisited:jobsVisited.value,planning:{...planning}})}
 const source=selection.currentSource,key=JSON.stringify([selection.project?.id,selection.project?.path])
 const cached=source?projectStates.get(source)?.get(key):undefined
 // Inputs survive project changes. Task evidence never does: resume requires a fresh history read.
 jobsVisited.value=props.category==='icon' && !!cached?.jobsVisited
 step.value=cached ? (jobsVisited.value && cached.step>=2 ? 2 : Math.min(cached.step,props.category==='icon'?1:2)) : 0
 reached.value=cached ? (jobsVisited.value ? 2 : Math.min(cached.reached,props.category==='icon'?1:2)) : 0
 Object.assign(planning,cached?.planning??{name:'',purpose:'',prompt:''})
 previousContext=source&&selection.project?{source,key}:null
},{immediate:true,flush:'sync'})
watch([step,reached],()=>emit('stage-change',{step:step.value,reached:reached.value}),{immediate:true,flush:'sync'})
watch(taskStage,value=>{if(jobsVisited.value && value!==null){reached.value=Math.max(reached.value,value);if(step.value>=2)step.value=value}},{flush:'post'})
function chooseStep(index:number){if(!canChooseArtStage(index,reached.value))return false;step.value=index;return true}
defineExpose({chooseStep,step,reached})
function plan(){if(!specReady.value)return;reached.value=Math.max(reached.value,1);step.value=1}
function resume(){if(props.category!=='icon')return;jobsVisited.value=true;reached.value=Math.max(reached.value,2);step.value=2}
async function created(input:AiTaskCreatedEvent){
 const current=()=>selection.project?.id===input.project.id && selection.project.path===input.project.path && selection.currentSource===input.source
 if(props.category!=='icon'||!current())return
 jobsVisited.value=true;reached.value=Math.max(reached.value,2);step.value=2
 await nextTick()
 if(current())await jobsPanel.value?.readCreatedTask(input)
}
function checkCategorySupport(){if(!specReady.value || !planning.name.trim() || !planning.purpose.trim() || !planning.prompt.trim())return;step.value=2;reached.value=Math.max(reached.value,2)}
</script>
<template>
 <section class="art-production-flow" data-testid="art-production-flow">
  <ArtStatusBar v-if="!props.embedded" :show-creator="step>=4" :show-model="step>=2&&step<=3" :jobs="jobsPanel?.readStatusSnapshot??null"/>
  <template v-if="selection.project">
   <nav v-if="!props.embedded && step>0" class="completed-production" aria-label="已到达的资源步骤">
    <button v-for="(_,index) in labels.slice(0,step)" :key="index" @click="chooseStep(index)">{{ labels[index] }} <span>返回修改</span></button>
   </nav>
   <header v-if="!props.embedded" class="production-heading"><h2>{{ labels[step] }}</h2><span>{{ step+1 }}</span></header>
   <p v-if="step===0 && jobsVisited" class="form-help">原任务和素材保留。修改规范仅影响后续新任务，原任务仍使用封存规范。</p>
   <div v-show="step===0">
    <AiResourceReadView v-if="!props.embedded" embedded/>
    <div class="production-buttons"><el-button type="primary" :disabled="!specReady" @click="plan">使用已保存规范</el-button><el-button v-if="props.category==='icon'" @click="resume">继续已有任务</el-button></div>
   </div>
   <div v-show="step===1">
    <p v-if="!specReady" role="status">规范已变化或尚未保存。输入保留，请返回项目规范核对。</p>
    <AssetInventorySummary v-if="props.game && props.active && step===1" :project="selection.project" :source="selection.currentSource"/>
    <AiTaskCreationPanel v-if="props.category==='icon' && aiTaskCreationProvider" compact :active="props.active&&step===1&&specReady" :project="selection.project" :source="selection.currentSource" :config-dirty="configDirty" @created="created"/>
    <p v-else-if="props.category==='icon'">当前后台未提供资源任务创建接口。</p>
    <form v-else class="category-planning" @submit.prevent="checkCategorySupport">
     <label>{{ categoryLabel }}名称<el-input v-model="planning.name" :disabled="!props.active" maxlength="60"/></label>
     <label>用途<el-input v-model="planning.purpose" :disabled="!props.active" maxlength="400"/></label>
     <label>画面要求<el-input v-model="planning.prompt" :disabled="!props.active" type="textarea" :rows="3" maxlength="4096"/></label>
     <el-button native-type="submit" type="primary" :disabled="!props.active||!specReady||!planning.name.trim()||!planning.purpose.trim()||!planning.prompt.trim()">检查生成支持</el-button>
    </form>
   </div>
   <p v-if="props.category!=='icon' && step===2" role="status">当前生成服务尚不支持{{ categoryLabel }}。规划已保留，没有提交图标任务。</p>
   <AiJobsReadPanel v-if="props.category==='icon' && jobsVisited" v-show="step>=2" ref="jobsPanel" compact progressive :active="props.active&&step>=2" :project="selection.project" :source="selection.currentSource" :workflow-step="step+1"/>
  </template>
  <p v-else>请选择已登记工程。</p>
 </section>
</template>
<style scoped>
.category-planning{display:grid;gap:12px;max-width:760px}.category-planning label{display:grid;gap:7px}.art-production-flow{display:grid;gap:16px}.completed-production{display:flex;gap:8px;flex-wrap:wrap}.completed-production button{border:1px solid var(--el-border-color);border-radius:6px;background:var(--el-bg-color);padding:7px 11px;color:var(--el-text-color-primary);cursor:pointer}.completed-production span{font-size:12px;color:var(--el-text-color-secondary);margin-left:8px}.production-heading{display:flex;align-items:center;gap:10px}.production-heading h2{margin:0;font-size:20px}.production-heading>span{background:var(--el-fill-color-light);border-radius:50%;padding:4px 9px;color:var(--el-text-color-secondary)}.production-buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
</style>
