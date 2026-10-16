<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useResourcePlanningStore } from '../stores/resource-planning'
import { useGenerationReceiptsStore } from '../stores/generation-receipts'
import { generationCapability } from '../domain/generation-source'
import type { GenerationSource } from '../domain/generation-source'
import { exportGenerationHandoff } from '../domain/generation-handoff'
const workspace = useWorkspaceStore()
const planning = useResourcePlanningStore()
const recovery = useGenerationReceiptsStore()
const mode = computed(() => workspace.mode === 'live' ? 'live' : 'demo')
const plan = computed(() => workspace.project ? planning.get(mode.value, workspace.project.id) : undefined)
const receivedCount = computed(() => workspace.project ? recovery.list(mode.value, workspace.project.id).length : 0)
const capability = computed(() => generationCapability(plan.value?.generationSource ?? 'unselected'))
const error = ref('')
const preview = ref('')
const previewOpen = ref(false)
const filename = ref('')
watch(() => [workspace.mode, workspace.selectedProjectId, workspace.spec, plan.value], () => { previewOpen.value = false; preview.value = ''; error.value = '' })
function select(source: GenerationSource) {
  try { if (!workspace.project || workspace.mode === 'disconnected') return; planning.selectSource(mode.value, workspace.project.id, source); error.value = '' }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '来源尚未改变' }
}
function showHandoff() {
  try { if (!plan.value) return; preview.value = exportGenerationHandoff(plan.value, workspace.spec); filename.value = `companion-generation-handoff-${plan.value.id}.json`; previewOpen.value = true; error.value = '' }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '交接草稿未生成' }
}
function download() {
  if (!preview.value) return
  try {
    const url = URL.createObjectURL(new Blob([preview.value], { type: 'application/json;charset=utf-8' }))
    try { const link = document.createElement('a'); link.href = url; link.download = filename.value; link.click() }
    finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
  } catch { error.value = '浏览器未能下载交接草稿；可复制预览文本，现有计划未改变' }
}
</script>
<template>
  <section class="panel generation-source-panel" data-testid="generation-source-panel">
    <div class="planner-toolbar"><div><h3>生成来源</h3><p>共用规范与资源清单，切换来源保留配置、尺寸和 Owner 保护。</p></div><el-tag type="info">网页自动提交尚未接通</el-tag></div>
    <p v-if="!plan" class="form-help">先在「资源规划」建立内存草稿，再选择来源；没有默认提交或默认付费来源。</p>
    <el-radio-group :model-value="plan?.generationSource ?? 'unselected'" :disabled="!plan" aria-label="生成来源" @update:model-value="select($event as GenerationSource)">
      <el-radio-button value="unselected">尚未选择</el-radio-button><el-radio-button value="comfyui">本地 ComfyUI</el-radio-button><el-radio-button value="codex-native">Codex 原生</el-radio-button>
    </el-radio-group>
    <h4>{{ capability.status }}</h4><p>{{ capability.detail }}</p><p class="form-help">{{ capability.dataBoundary }}</p>
    <p class="form-help">参考选择 / 裁切 → 母图 → 技术核验与视觉审阅 → 批准后同图派生 → 保存 / 导入 / 绑定 / 运行。外部结果可在第 3 步人工选取文件登记元数据，批准与工程交付仍需独立证据。</p>
    <div class="planner-import-actions"><el-button :disabled="!plan || plan.generationSource === 'unselected'" @click="showHandoff">预览统一交接 JSON</el-button><el-button disabled>提交生成（未接通）</el-button><span>实际提交 0 · 人工文件登记 {{ receivedCount }} · 已写项目 0</span></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <el-dialog v-model="previewOpen" title="生成交接 JSON · 未提交 / 空回执" width="820px" class="planning-dialog">
      <el-alert title="这是交接草稿，不是产物回执或项目配置" type="info" :closable="false" description="输出文件列表为空，验收均未检查。此格式用于人工交接，不能作为计划恢复文件导入，也不启动外部服务。"/>
      <el-input :model-value="preview" type="textarea" :rows="16" readonly aria-label="生成交接 JSON"/>
      <template #footer><el-button @click="previewOpen = false">关闭</el-button><el-button type="primary" @click="download">下载交接草稿 JSON</el-button></template>
    </el-dialog>
  </section>
</template>
