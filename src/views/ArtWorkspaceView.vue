<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArtStatusBar from '../components/ArtStatusBar.vue'
import ArtProductionFlow from '../components/ArtProductionFlow.vue'
import AiResourceReadView from './AiResourceReadView.vue'
import ImageAssetsView from './ImageAssetsView.vue'
import { useAiResourceReadStore } from '../stores/ai-resource-read'
import { useRegisteredProjectPage } from '../composables/use-registered-project-page'
const route=useRoute(),router=useRouter(),selection=useRegisteredProjectPage()
const resourceReads=useAiResourceReadStore()
const specificationEditor=ref<InstanceType<typeof AiResourceReadView>|null>(null)
async function openSpecification(){flows[kind.value]?.chooseStep(0);await nextTick();specificationEditor.value?.openEditor()}
onBeforeUnmount(()=>resourceReads.disconnect())
const types=['icon','ui','ip'] as const
type Kind=typeof types[number]
const labels:Record<Kind,string>={icon:'图标',ui:'UI',ip:'人物图片'}
const stages=['项目规范','资源规划','生成素材','视觉审阅','导入绑定','运行验收']
const kind=computed<Kind>(()=>types.includes(route.query.type as Kind)?route.query.type as Kind:'icon')
const snapshots=ref<Record<Kind,{step:number;reached:number}>>({icon:{step:0,reached:0},ui:{step:0,reached:0},ip:{step:0,reached:0}})
const flows:Partial<Record<Kind,{chooseStep:(step:number)=>void}>>={}
const current=computed(()=>snapshots.value[kind.value])
const referenceService=ref<{label:string;text:string;tone:'info'|'success'|'warning';busy:boolean}|null>(null)
const referenceVisited=ref(route.query.references==='1'),referencesOpen=ref(route.query.references==='1')
watch(()=>route.query.references,value=>{if(value==='1'){referenceVisited.value=true;referencesOpen.value=true}},{immediate:true})
function selectType(value:Kind){void router.replace({path:'/art-resources',query:{...route.query,type:value}})}
function record(value:Kind,snapshot:{step:number;reached:number}){snapshots.value[value]=snapshot}
function setFlow(value:Kind,instance:unknown){if(instance)flows[value]=instance as {chooseStep:(step:number)=>void}}
function references(){referenceVisited.value=true;referencesOpen.value=!referencesOpen.value}
function keyTab(event:KeyboardEvent){
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
 event.preventDefault();const index=types.indexOf(kind.value),target=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3
 selectType(types[target]!);void nextTick(()=>document.getElementById('art-type-'+types[target])?.focus())
}
</script>
<template>
 <section class="art-workspace" data-testid="art-workspace">
  <ArtStatusBar @open-specification="openSpecification" :service="referencesOpen?referenceService:null" :show-creator="current.step>=4" :show-model="current.step===2||current.step===3"><el-button @click="references" :aria-expanded="referencesOpen" aria-controls="art-references">参考素材</el-button></ArtStatusBar>
  <nav class="resource-steps panel" aria-label="资源生产步骤">
   <button v-for="(title,index) in stages" :key="title" type="button" :class="{active:current.step===index,completed:index<current.step}" :aria-current="current.step===index?'step':undefined" :disabled="index>current.reached||!selection.project" @click="flows[kind]?.chooseStep(index)"><span>{{ index+1 }}</span><strong>{{ title }}</strong><i v-if="index<5"/></button>
  </nav>
  <nav class="art-task-tabs" role="tablist" aria-label="资源任务类型" @keydown="keyTab">
   <button v-for="value in types" :id="'art-type-'+value" :key="value" role="tab" type="button" :aria-selected="kind===value" :tabindex="kind===value?0:-1" :aria-controls="'art-flow-'+value" @click="selectType(value)">{{ labels[value] }}</button>
  </nav>
  <section v-if="referenceVisited" v-show="referencesOpen" id="art-references" class="reference-tools" aria-label="参考素材工具"><div class="section-heading"><h2>参考素材</h2><el-button @click="referencesOpen=false">收起</el-button></div><AiResourceReadView embedded shared-header reference-tools/><ImageAssetsView embedded :active="referencesOpen&&route.path==='/art-resources'" @status-change="referenceService=$event"/></section>
  <section class="art-current-stage" :aria-label="stages[current.step]" data-testid="art-current-stage">
   <header class="section-heading"><h2>{{ stages[current.step] }}</h2><span>{{ labels[kind] }}</span></header>
   <div v-show="current.step===0"><AiResourceReadView ref="specificationEditor" embedded shared-header/></div>
   <div v-for="value in types" :id="'art-flow-'+value" :key="value" v-show="kind===value" role="tabpanel" :aria-labelledby="'art-type-'+value"><ArtProductionFlow :ref="instance=>setFlow(value,instance)" embedded :category="value" :active="kind===value&&route.path==='/art-resources'" @stage-change="record(value,$event)"/></div>
  </section>
 </section>
</template>
<style scoped>
.art-workspace{display:grid;gap:16px}.art-task-tabs{display:flex;gap:6px;border-bottom:1px solid var(--el-border-color);padding-bottom:8px}.art-task-tabs button{font:inherit;font-size:14px;padding:9px 20px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--el-text-color-regular);cursor:pointer}.art-task-tabs button[aria-selected=true]{background:var(--el-color-primary-light-9);color:var(--el-color-primary);border-color:var(--el-color-primary-light-7);font-weight:600}.art-task-tabs button:focus-visible,.resource-steps button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}.resource-steps button:disabled{cursor:default;opacity:.55}.art-current-stage{display:grid;gap:12px}.reference-tools{border:1px solid var(--el-border-color);padding:14px;border-radius:8px}.art-current-stage h2{margin:0}
</style>
