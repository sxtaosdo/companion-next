<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue'
import ArtStatusBar from '../components/ArtStatusBar.vue'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { companionBrowserProvider } from '../companion-browser-integration'
import { useRoute } from 'vue-router'
import PublicImageCollectorFrame from '../components/PublicImageCollectorFrame.vue'
import CompanionImageReviewPanel from '../components/CompanionImageReviewPanel.vue'
const route=useRoute(), tab=ref<'collector'|'review'>('collector'), reviewVisited=ref(false), id=useId()
const selection=useRegisteredProjectStore(),collectorState=ref<'loading'|'ready'|'unconfirmed'>('loading')
watch(()=>route.fullPath,()=>{if(route.path==='/image-assets')selection.restoreRouteProject(route.query.project)},{immediate:true,flush:'sync'})
watch(companionBrowserProvider,source=>{if(selection.directory.provider&&selection.directory.provider!==source)selection.directory.disconnect()},{flush:'sync'})
const collectorStatus=computed(()=>tab.value==='collector'?{label:'采集器',text:collectorState.value==='ready'?'已就绪':collectorState.value==='loading'?'加载中':'未确认就绪',tone:collectorState.value==='ready'?'success' as const:collectorState.value==='loading'?'info' as const:'warning' as const,busy:collectorState.value==='loading'}:null)
const active=computed(()=>route.path==='/image-assets')
watch(tab,value=>{if(value==='review')reviewVisited.value=true},{flush:'sync'})
function keyTab(event:KeyboardEvent){
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
 event.preventDefault();tab.value=event.key==='Home'?'collector':event.key==='End'?'review':tab.value==='collector'?'review':'collector'
 void nextTick(()=>document.getElementById(`${id}-${tab.value}-tab`)?.focus())
}
</script>
<template>
 <section class="image-assets-host" data-testid="image-assets-page">
  <ArtStatusBar :service="collectorStatus" :show-creator="false"/>
  <nav class="image-assets-tabs" role="tablist" aria-label="图片素材工具" @keydown="keyTab">
   <button :id="`${id}-collector-tab`" type="button" role="tab" :aria-selected="tab==='collector'" :aria-controls="`${id}-collector-panel`" :tabindex="tab==='collector'?0:-1" @click="tab='collector'">素材采集器</button>
   <button :id="`${id}-review-tab`" data-testid="review-tab" type="button" role="tab" :aria-selected="tab==='review'" :aria-controls="`${id}-review-panel`" :tabindex="tab==='review'?0:-1" @click="tab='review'">后台审阅</button>
  </nav>
  <div :id="`${id}-collector-panel`" v-show="tab==='collector'" role="tabpanel" :aria-labelledby="`${id}-collector-tab`"><PublicImageCollectorFrame compact @status-change="collectorState=$event"/></div>
  <div :id="`${id}-review-panel`" v-show="tab==='review'" role="tabpanel" :aria-labelledby="`${id}-review-tab`"><CompanionImageReviewPanel v-if="reviewVisited" :active="active&&tab==='review'"/></div>
 </section>
</template>
<style scoped>
.image-assets-host{display:grid;gap:12px}.image-assets-tabs{display:flex;gap:6px;border-bottom:1px solid var(--el-border-color);padding-bottom:8px}.image-assets-tabs button{padding:8px 14px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--el-text-color-regular);font:inherit;font-size:13px;cursor:pointer}.image-assets-tabs button[aria-selected=true]{color:var(--el-color-primary);background:var(--el-color-primary-light-9);border-color:var(--el-color-primary-light-7)}.image-assets-tabs button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
</style>
