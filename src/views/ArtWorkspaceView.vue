<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, provide, ref, watch } from 'vue'
import { ART_OVERVIEW_NAVIGATION } from '../domain/art-prototype-presentation'
import { useRoute, useRouter } from 'vue-router'
import {useArtResourceDomainsStore} from '../stores/art-resource-domains'
import {useProjectArtSpecStore,useResourceDomainArtSpecStore} from '../stores/project-art-spec'
import {createProjectArtSpecProvider} from '../adapters/project-art-spec'
import ProjectArtSpecPanel from '../components/ProjectArtSpecPanel.vue'
import ArtStatusBar from '../components/ArtStatusBar.vue'
import type {ArtSpecificationState} from '../composables/useArtSpecificationContext'
import ArtWorkbenchManager from '../components/ArtWorkbenchManager.vue'
import AiResourceReadView from './AiResourceReadView.vue'
import ImageAssetsView from './ImageAssetsView.vue'
import { useAiResourceReadStore } from '../stores/ai-resource-read'
import { useRegisteredProjectPage } from '../composables/use-registered-project-page'
const route=useRoute(),router=useRouter(),selection=useRegisteredProjectPage(),resourceReads=useAiResourceReadStore()
const domains=useArtResourceDomainsStore(),projectSpec=useProjectArtSpecStore(),domainSpec=useResourceDomainArtSpecStore()
const domainSpecification=computed<ArtSpecificationState|null>(()=>{
 if(!domains.selected)return null
 const context=domainSpec.context,project=selection.project
 if(!project||!selection.currentSource||context?.projectId!==project.id||context.projectPath!==project.path||context.source!==selection.currentSource||context.resourceDomainId!==domains.selected)return {kind:'unread',text:'当前域规范未读取',tone:'info'}
 if(domainSpec.blocked||domainSpec.phase==='unknown')return {kind:'unknown',text:'当前域规范待核对',tone:'warning',detail:domainSpec.message}
 if(domainSpec.phase==='saving')return {kind:'saving',text:'当前域规范保存中',tone:'primary',busy:true}
 if(domainSpec.pending||domainSpec.phase==='reading')return {kind:'reading',text:'当前域规范读取中',tone:'primary',busy:true}
 if(domainSpec.phase==='error')return {kind:'error',text:'当前域规范读取失败',tone:'danger',detail:domainSpec.message}
 if(domainSpec.base&&domainSpec.base.projectId===project.id&&domainSpec.base.resourceDomainId===domains.selected&&typeof domainSpec.hash==='string'&&/^[a-f0-9]{64}$/.test(domainSpec.hash))return {kind:'configured',text:'当前域规范已配置',tone:'success',detail:domainSpec.dirty?'已保存的域规范可读取；当前有未保存草稿。':'此状态仅表示当前资源域的已保存规范。'}
 if(domainSpec.hash===null)return {kind:'missing',text:'当前域规范未配置',tone:'warning'}
 return {kind:'unread',text:'当前域规范未读取',tone:'info'}
})
const domainNorm=ref<InstanceType<typeof ProjectArtSpecPanel>|null>(null)
const domainWriter=globalThis.location.hostname==='127.0.0.1'?createProjectArtSpecProvider((...args)=>fetch(...args),globalThis.location.origin):null
watch([()=>selection.project,()=>selection.currentSource],()=>{domains.bind(selection.project&&selection.currentSource?{projectId:selection.project.id,projectPath:selection.project.path,source:selection.currentSource}:null);if(selection.project)void domains.read()},{immediate:true,flush:'sync'})
function selectDomain(id:string|undefined){domains.select(id);current.value={step:view.value==='norm'?0:view.value==='specs'?1:2,reached:2}}
function chooseDomain(event:Event){const value=(event.target as HTMLSelectElement).value;domains.select(value||undefined);current.value={step:view.value==='norm'?0:view.value==='specs'?1:2,reached:2}}
const specificationEditor=ref<InstanceType<typeof AiResourceReadView>|null>(null),manager=ref<InstanceType<typeof ArtWorkbenchManager>|null>(null)
const views=['norm','specs','needs'] as const
type View=typeof views[number]
const view=computed<View>(()=>{if(views.includes(route.query.manage as View))return route.query.manage as View;const current=domains.selected?domainSpec:projectSpec,context=current.context,project=selection.project;const sameContext=!!project&&!!selection.currentSource&&context?.projectId===project.id&&context.projectPath===project.path&&context.source===selection.currentSource&&(context.resourceDomainId??undefined)===(domains.selected??undefined);return sameContext&&current.base&&!current.dirty&&!current.blocked?'needs':'norm'})
const titles={norm:'项目规范',specs:'资源规格',needs:'素材需求'}
const current=ref({step:0,reached:2})
function selectView(value:View){current.value={step:value==='norm'?0:value==='specs'?1:2,reached:2};void router.replace({path:'/art-resources',query:{...route.query,manage:value}})}
async function openSpecification(){selectView('norm');if(domains.legacyReadOnly)return;await nextTick();domains.selected?domainNorm.value?.openEditor():specificationEditor.value?.openEditor()}
watch(view,value=>current.value={step:value==='norm'?0:value==='specs'?1:2,reached:2},{immediate:true})
const referenceService=ref<{label:string;text:string;tone:'info'|'success'|'warning';busy:boolean}|null>(null)
const referenceVisited=ref(route.query.references==='1'),referencesOpen=ref(route.query.references==='1')
watch(()=>route.query.references,value=>{if(value==='1'){referenceVisited.value=true;referencesOpen.value=true}},{immediate:true})
function references(){referenceVisited.value=true;referencesOpen.value=!referencesOpen.value}
function openReferences(){referenceVisited.value=true;referencesOpen.value=true}
provide(ART_OVERVIEW_NAVIGATION, {
  openSpecs: () => selectView('specs'),
  openReferences: () => manager.value?.openProjectReferences(),
  references: () => manager.value?.overviewProjectReferences ?? [],
  canReferences: () => manager.value?.canOpenProjectReferences ?? false,
  busy: () => manager.value?.projectReferenceBusy ?? false,
})
function keyTab(event:KeyboardEvent){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const index=views.indexOf(view.value),target=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;selectView(views[target]!);void nextTick(()=>document.getElementById('art-manage-'+views[target])?.focus())}
onBeforeUnmount(()=>resourceReads.disconnect())
</script>
<template>
 <section class="art-workspace" data-testid="art-workspace">
  <ArtStatusBar :domain-specification="domainSpecification" :specification-read-only="domains.legacyReadOnly||!!domains.selected" @open-specification="openSpecification" :service="referencesOpen?referenceService:null" :show-creator="current.step>=4" :show-model="current.step===2||current.step===3"><el-button @click="references" :aria-expanded="referencesOpen" aria-controls="art-references">参考素材</el-button></ArtStatusBar>
  <div class="art-domain-bar"><label>资源域<select :value="domains.selected??''" :disabled="domains.phase!=='ready'" @change="chooseDomain"><option value="">{{ domains.catalog?.legacy.readOnly?'原工程记录 · 未分配（只读）':'工程公共规范' }}</option><option v-for="domain in domains.catalog?.domains??[]" :key="domain.id" :value="domain.id">{{ domain.name }} · {{ domain.configured?'已配置':'未配置' }}</option></select></label><el-button :disabled="!selection.project||domains.phase==='reading'" @click="domains.read()">读取 / 刷新资源域</el-button><span v-if="domains.phase==='reading'" role="status">正在读取资源域…</span><span v-if="domains.error" role="alert">{{ domains.error }}；未改动原记录。</span><details v-if="domains.selectedDescriptor"><summary>资源域独立目录绑定</summary><span>独立目录绑定未配置；图标规格中的导入、导出目录分别核对。不会自动迁移原工程数据。</span></details></div>
  <p v-if="selection.project&&domains.phase==='ready'&&!domains.selected&&(domains.catalog?.domains.filter(d=>d.configured).length??0)>1" role="status">请选择资源域，查看对应素材需求。</p><p v-if="selection.project&&domains.phase==='ready'&&!domains.selected&&!domains.catalog?.legacy.hasConfig&&!domains.catalog?.domains.some(d=>d.configured)" role="status">当前工程尚未配置美术规范，请先配置项目规范和资源域。</p>
  <nav class="art-task-tabs" role="tablist" aria-label="美术工作台管理视图" @keydown="keyTab"><button v-for="value in views" :id="'art-manage-'+value" :key="value" role="tab" type="button" :aria-selected="view===value" :tabindex="view===value?0:-1" aria-controls="art-management" @click="selectView(value)">{{ titles[value] }}</button></nav>
  <section v-if="referenceVisited" v-show="referencesOpen" id="art-references" class="reference-tools" aria-label="参考素材工具"><div class="section-heading"><h2>参考素材采集</h2><el-button @click="referencesOpen=false">收起</el-button></div><AiResourceReadView embedded shared-header reference-tools/><ImageAssetsView embedded :active="referencesOpen&&route.path==='/art-resources'" @status-change="referenceService=$event"/></section>
  <section id="art-management" role="tabpanel" :aria-labelledby="'art-manage-'+view" class="art-current-stage" data-testid="art-current-stage"><header class="section-heading"><h2>{{ titles[view] }}</h2></header><div v-show="view==='norm'"><ProjectArtSpecPanel v-if="domains.selected" :key="domains.selected" ref="domainNorm" :project="selection.project" :source="selection.currentSource" :provider="domainWriter" :resource-domain-id="domains.selected" :read-only="domains.phase!=='ready'"/><AiResourceReadView v-else ref="specificationEditor" embedded shared-header :read-only="domains.legacyReadOnly"/></div><ArtWorkbenchManager v-show="view!=='norm'" ref="manager" :view="view==='specs'?'specs':'needs'" :resource-domain-id="domains.selected" :read-only="domains.legacyReadOnly" :shared-available="domains.catalog?.domains.some(domain=>domain.id==='shared')??false" @open-domain="selectDomain" @open-management="selectView" @open-references="openReferences" @stage-change="view!=='norm'&&(current=$event)"/></section>
 </section>
</template>
<style scoped>
.art-domain-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.art-domain-bar label{display:flex;align-items:center;gap:8px}.art-domain-bar select{font:inherit;max-width:100%;padding:6px;background:var(--el-bg-color);color:var(--el-text-color-primary);border:1px solid var(--el-border-color);border-radius:4px}.art-workspace{display:grid;gap:16px}.art-task-tabs{display:flex;gap:6px;border-bottom:1px solid var(--el-border-color);padding-bottom:8px}.art-task-tabs button{font:inherit;font-size:14px;padding:9px 20px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--el-text-color-regular);cursor:pointer}.art-task-tabs button[aria-selected=true]{background:var(--el-color-primary-light-9);color:var(--el-color-primary);border-color:var(--el-color-primary-light-7);font-weight:600}.art-task-tabs button:focus-visible,.resource-steps button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}.resource-steps button:disabled{cursor:default;opacity:.55}.art-current-stage{display:grid;gap:12px}.reference-tools{border:1px solid var(--el-border-color);padding:14px;border-radius:8px}.art-current-stage h2{margin:0}

/* Declaration bodies below are reused from the approved prototype. */
.art-workspace{--primary:#7058df;--line:#e2e7f0;--muted:#718098}
.art-task-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:18px}
.art-task-tabs button{border:0;border-bottom:2px solid transparent;border-radius:0;background:transparent;padding:10px 18px;color:#718098}
.art-task-tabs button[aria-selected=true]{color:var(--primary);border-bottom-color:var(--primary);font-weight:600}
.art-task-tabs{padding-bottom:0;margin-bottom:2px}
@media (max-width:700px) {.art-task-tabs button{padding:10px 12px}
}
</style>
