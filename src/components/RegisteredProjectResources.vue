<script setup lang="ts">
import { computed, ref } from 'vue'
import ArtStatusBar from './ArtStatusBar.vue'
import AssetInventorySummary from './AssetInventorySummary.vue'
import { useRoute, useRouter } from 'vue-router'
import { useRegisteredProjectStore } from '../stores/registered-project'
import AiResourceReadView from '../views/AiResourceReadView.vue'
import AiJobsReadPanel from './AiJobsReadPanel.vue'
import AiTaskCreationPanel from './AiTaskCreationPanel.vue'
import { aiTaskCreationProvider } from '../ai-task-creation-integration'
import { useAiResourceEditorStore } from '../stores/ai-resource-editor'
import type { AiJobSnapshot, AiJobsReadProvider } from '../domain/ai-jobs-read'
import type { AiJobsProject } from '../stores/ai-jobs-read'
const selection = useRegisteredProjectStore()
const route = useRoute(), router = useRouter()
const jobsPanel = ref<InstanceType<typeof AiJobsReadPanel> | null>(null), editor = useAiResourceEditorStore()
const configDirty = computed(() => !!editor.project && editor.project.id === selection.project?.id && editor.project.path === selection.project?.path
  && (editor.dirty || editor.busy || !!editor.pendingFence))
const steps = ['项目规范', '资源规划', '生成素材', '视觉审阅', '导入绑定', '运行验收']
const step = computed(() => { const value = Number(route.query.step); return Number.isInteger(value) && value >= 1 && value <= 6 ? value - 1 : 2 })
const emptyTitles = ['尚未读取工程规范', '真实资源清单尚未读取', '生成任务与候选素材尚未读取', '尚无可核验的候选图与审阅记录', '尚无真实导入、UUID 或绑定记录', '尚无 Creator / Bridge 运行验收证据']
async function created(input: { snapshot: AiJobSnapshot; project: AiJobsProject; source: object; jobsReader: AiJobsReadProvider }) {
  const current = () => selection.project?.id === input.project.id && selection.project.path === input.project.path && selection.project.name === input.project.name && selection.currentSource === input.source
  if (!current()) return
  await jobsPanel.value?.readCreatedTask(input)
  if (current() && step.value === 1) chooseStep(2)
}
function chooseStep(index: number) { void router.replace({ path: '/resources', query: { ...route.query, step: index + 1 } }) }
</script>
<template>
  <section class="registered-resources">
    <template v-if="selection.project">
      <ArtStatusBar :jobs="jobsPanel?.readStatusSnapshot ?? null"><RouterLink :to="{ path: '/overview', query: { project: selection.project.id } }">返回看板</RouterLink></ArtStatusBar>
      <nav class="resource-steps panel" aria-label="资源生产步骤"><button v-for="(title,index) in steps" :key="title" :class="{ active: step === index }" :aria-current="step === index ? 'step' : undefined" @click="chooseStep(index)"><span>{{ index + 1 }}</span><strong>{{ title }}</strong><i v-if="index < steps.length - 1"></i></button></nav>
      <section v-if="step === 0" class="panel saved-project-spec" data-testid="saved-project-spec">
        <AiResourceReadView embedded/>
      </section>
      <AssetInventorySummary v-if="step === 1" :project="selection.project" :source="selection.currentSource"/>
      <AiTaskCreationPanel v-if="aiTaskCreationProvider" v-show="step === 1" :active="step === 1" :project="selection.project" :source="selection.currentSource" :config-dirty="configDirty" @created="created"/>
      <section v-else-if="step === 1" class="panel real-resource-empty" data-testid="real-resource-empty"><el-empty :description="emptyTitles[step]" :image-size="90"/><p>当前构建未启用原单图任务准备；上方库存汇总独立读取，是否可用以该次接口回执为准。</p><p class="form-help">Owner 资产保持保护；没有用草稿或示例代替真实资源。</p></section>
      <AiJobsReadPanel ref="jobsPanel" v-show="step >= 2" :project="selection.project" :source="selection.currentSource" :workflow-step="step + 1"/>
    </template>
    <template v-else><ArtStatusBar/><section class="panel real-resource-empty"><el-empty :description="selection.directory.projectLoading ? '正在读取登记工程' : selection.requestedId ? '所选工程不可用，请重新选择' : '请先选择已登记工程'" :image-size="90"/><RouterLink to="/overview">前往看板</RouterLink></section></template>
  </section>
</template>
<style scoped>
.registered-resources{display:grid;gap:18px}.real-resource-identity{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:22px}.real-resource-identity h2{margin:6px 0}.real-resource-identity p,.real-resource-identity small{overflow-wrap:anywhere;color:var(--text-secondary,#637187)}.real-resource-identity a{flex-shrink:0}.saved-project-spec{padding:24px}.saved-project-spec li{overflow-wrap:anywhere}.real-resource-empty{padding:24px;text-align:center}.real-resource-empty p{line-height:1.7;color:var(--text-secondary,#637187)}@media(max-width:600px){.real-resource-identity{align-items:start;flex-direction:column}}
</style>
