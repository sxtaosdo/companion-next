<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArtStatusBar from '../components/ArtStatusBar.vue'
import ArtWorkbenchManager from '../components/ArtWorkbenchManager.vue'
import AiResourceReadView from './AiResourceReadView.vue'
import ImageAssetsView from './ImageAssetsView.vue'
import { useAiResourceReadStore } from '../stores/ai-resource-read'
import { useRegisteredProjectPage } from '../composables/use-registered-project-page'
const route=useRoute(),router=useRouter(),selection=useRegisteredProjectPage(),resourceReads=useAiResourceReadStore()
const specificationEditor=ref<InstanceType<typeof AiResourceReadView>|null>(null),manager=ref<InstanceType<typeof ArtWorkbenchManager>|null>(null)
const views=['norm','specs','needs'] as const
type View=typeof views[number]
const view=computed<View>(()=>views.includes(route.query.manage as View)?route.query.manage as View:'norm')
const titles={norm:'项目规范',specs:'规格管理',needs:'需求管理'}
const stages=['项目规范','资源规划','生成素材','视觉审核','导入库','场景中验证']
const current=ref({step:0,reached:2})
function selectView(value:View){current.value={step:value==='norm'?0:value==='specs'?1:2,reached:2};void router.replace({path:'/art-resources',query:{...route.query,manage:value}})}
async function openSpecification(){selectView('norm');await nextTick();specificationEditor.value?.openEditor()}
function chooseStage(index:number){if(index===2&&manager.value?.taskActive){manager.value.chooseStep(index);return}if(index<3)selectView(views[index]!);else manager.value?.chooseStep(index)}
watch(view,value=>current.value={step:value==='norm'?0:value==='specs'?1:2,reached:2},{immediate:true})
const referenceService=ref<{label:string;text:string;tone:'info'|'success'|'warning';busy:boolean}|null>(null)
const referenceVisited=ref(route.query.references==='1'),referencesOpen=ref(route.query.references==='1')
watch(()=>route.query.references,value=>{if(value==='1'){referenceVisited.value=true;referencesOpen.value=true}},{immediate:true})
function references(){referenceVisited.value=true;referencesOpen.value=!referencesOpen.value}
function openReferences(){referenceVisited.value=true;referencesOpen.value=true}
function keyTab(event:KeyboardEvent){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=views.indexOf(view.value),target=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;selectView(views[target]!);void nextTick(()=>document.getElementById('art-manage-'+views[target])?.focus())}
onBeforeUnmount(()=>resourceReads.disconnect())
</script>
<template>
 <section class="art-workspace" data-testid="art-workspace">
  <ArtStatusBar @open-specification="openSpecification" :service="referencesOpen?referenceService:null" :show-creator="current.step>=4" :show-model="current.step===2||current.step===3"><el-button @click="references" :aria-expanded="referencesOpen" aria-controls="art-references">参考素材</el-button></ArtStatusBar>
  <nav class="resource-steps panel" aria-label="资源制作流程"><button v-for="(title,index) in stages" :key="title" type="button" :class="{active:current.step===index}" :aria-current="current.step===index?'step':undefined" :disabled="index>current.reached||!selection.project" @click="chooseStage(index)"><span>{{ index+1 }}</span><strong>{{ title }}</strong><i v-if="index<5"/></button></nav>
  <nav class="art-task-tabs" role="tablist" aria-label="美术工作台管理视图" @keydown="keyTab"><button v-for="value in views" :id="'art-manage-'+value" :key="value" role="tab" type="button" :aria-selected="view===value" :tabindex="view===value?0:-1" aria-controls="art-management" @click="selectView(value)">{{ titles[value] }}</button></nav>
  <section v-if="referenceVisited" v-show="referencesOpen" id="art-references" class="reference-tools" aria-label="参考素材工具"><div class="section-heading"><h2>参考素材采集</h2><el-button @click="referencesOpen=false">收起</el-button></div><AiResourceReadView embedded shared-header reference-tools/><ImageAssetsView embedded :active="referencesOpen&&route.path==='/art-resources'" @status-change="referenceService=$event"/></section>
  <section id="art-management" role="tabpanel" :aria-labelledby="'art-manage-'+view" class="art-current-stage" data-testid="art-current-stage"><header class="section-heading"><h2>{{ titles[view] }}</h2></header><div v-show="view==='norm'"><AiResourceReadView ref="specificationEditor" embedded shared-header/></div><ArtWorkbenchManager v-show="view!=='norm'" ref="manager" :view="view==='specs'?'specs':'needs'" @open-references="openReferences" @stage-change="view!=='norm'&&(current=$event)"/></section>
 </section>
</template>
<style scoped>
.art-workspace{display:grid;gap:16px}.art-task-tabs{display:flex;gap:6px;border-bottom:1px solid var(--el-border-color);padding-bottom:8px}.art-task-tabs button{font:inherit;font-size:14px;padding:9px 20px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--el-text-color-regular);cursor:pointer}.art-task-tabs button[aria-selected=true]{background:var(--el-color-primary-light-9);color:var(--el-color-primary);border-color:var(--el-color-primary-light-7);font-weight:600}.art-task-tabs button:focus-visible,.resource-steps button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}.resource-steps button:disabled{cursor:default;opacity:.55}.art-current-stage{display:grid;gap:12px}.reference-tools{border:1px solid var(--el-border-color);padding:14px;border-radius:8px}.art-current-stage h2{margin:0}
</style>
