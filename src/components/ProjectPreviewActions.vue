<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { usePreviewActionsStore } from '../stores/preview-actions'
import { previewActionsProvider } from '../preview-actions-integration'
import { P1060_PERFORMANCE_SCENARIO, previewActionLabel } from '../domain/preview-actions'
import type { PreviewAction } from '../domain/preview-actions'
const props=defineProps<{projectId:string}>(),store=usePreviewActionsStore()
const actions:PreviewAction[]=['start','probe','status','reload','profiler']
const result=computed(()=>store.results[props.projectId])
onBeforeUnmount(()=>{if(store.activeId===props.projectId)store.invalidate()})
</script>
<template>
 <section v-if="previewActionsProvider" class="project-preview-actions" data-testid="project-preview-actions">
  <div class="preview-toolbar"><template v-for="action in actions" :key="action"><el-button size="small" :title="action==='profiler'?(projectId===P1060_PERFORMANCE_SCENARIO.projectId?'独立测试存档：自然进入战斗，预热 3 秒并采集 15 秒；不修改用户存档':'Profiler 采集取证'):undefined" :disabled="!store.canRun(projectId)" @click="store.run(projectId,action)">{{ action==='probe'?'探针':action==='profiler'?(projectId===P1060_PERFORMANCE_SCENARIO.projectId?'战斗取证':'取证'):previewActionLabel(action) }}</el-button><slot v-if="action==='start'" name="creator-actions"/></template><span role="status">Profiler {{ result?.profilerPhase?({capturing:'采集中',ok:'采集成功',fail:'采集失败'})[result.profilerPhase]:'待命' }}</span></div>
  <p v-if="store.isUnknown(projectId)" role="status">上次操作结果未知，请重新连接工程服务核对后再操作。</p>
  <p v-if="result?.message" role="status">{{ result.message }}</p>
  <section v-for="kind in (['preview','profiler'] as const)" v-show="result?.[kind]" :key="kind" class="preview-result-panel"><div>{{ kind==='preview'?'Preview 结果':'Profiler 结果' }} <el-button size="small" @click="store.hide(projectId,kind)">隐藏</el-button></div><pre>{{ result?.[kind] }}</pre></section>
 </section>
</template>
<style scoped>
.preview-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:8px 0}.preview-toolbar .el-button{margin-left:0}.project-preview-actions p{margin:6px 0;font-size:12px}.preview-result-panel pre{max-height:320px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;background:var(--el-fill-color-light);padding:10px;border-radius:6px}.preview-result-panel>div{display:flex;justify-content:space-between;align-items:center}
</style>
