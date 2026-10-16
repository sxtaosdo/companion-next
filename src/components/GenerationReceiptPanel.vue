<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useWorkspaceStore } from '../stores/workspace'
import { useResourcePlanningStore } from '../stores/resource-planning'
import { useGenerationReceiptsStore } from '../stores/generation-receipts'
import { contextMatchesPlan } from '../domain/generation-receipt'
import { planMatchesSpec } from '../domain/resource-planning'
import { generationCapability } from '../domain/generation-source'
const workspace = useWorkspaceStore()
const planning = useResourcePlanningStore()
const recovery = useGenerationReceiptsStore()
const route = useRoute()
const mode = computed(() => workspace.mode === 'live' ? 'live' : 'demo')
const plan = computed(() => workspace.project ? planning.get(mode.value, workspace.project.id) : undefined)
const records = computed(() => workspace.project ? recovery.list(mode.value, workspace.project.id) : [])
const eligible = computed(() => {
  const assigned = new Set(plan.value?.batches.flatMap((b) => b.requirementIds))
  return plan.value?.requirements.filter((r) => assigned.has(r.id) && !r.ownerProtected) ?? []
})
const current = computed(() => !!plan.value && planMatchesSpec(plan.value, workspace.spec))
const requirementId = ref('')
const fileInput = ref<HTMLInputElement>()
const error = ref('')
const notice = ref('')
const preview = ref('')
const previewOpen = ref(false)
const canReceive = computed(() => current.value && plan.value?.generationSource !== 'unselected' && eligible.value.some((r) => r.id === requirementId.value) && !recovery.pending)
watch(() => [workspace.mode, workspace.selectedProjectId, workspace.spec, plan.value, route?.fullPath], () => {
  recovery.cancelPending(); requirementId.value = ''; error.value = ''; notice.value = ''; preview.value = ''; previewOpen.value = false
  if (fileInput.value) fileInput.value.value = ''
}, { flush: 'sync', deep: true })
onBeforeUnmount(() => recovery.cancelPending())
async function readFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  error.value = ''; notice.value = ''
  if (!file || !canReceive.value || !plan.value) return
  const initial = plan.value
  const selected = requirementId.value
  try {
    const received = await recovery.receive(initial, selected, file, () => current.value ? plan.value : undefined)
    if (received && plan.value === initial) notice.value = '已登记本地文件元数据；原图仍由你保管，尚未完成像素 QA 或视觉批准。'
  } catch (cause) { if (plan.value === initial) error.value = cause instanceof Error ? cause.message : '文件未登记' }
}
function showExport() {
  try {
    if (!workspace.project || !records.value.length) return
    preview.value = recovery.exportFor(mode.value, workspace.project.id); previewOpen.value = true; error.value = ''
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '清单未导出' }
}
function download() {
  if (!preview.value) return
  try {
    const url = URL.createObjectURL(new Blob([preview.value], { type: 'application/json;charset=utf-8' }))
    try { const link = document.createElement('a'); link.href = url; link.download = 'companion-local-generation-receipts.json'; link.click() }
    finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
  } catch { error.value = '浏览器未完成下载，可复制预览 JSON；原记录保持不变' }
}
</script>
<template>
  <section class="panel generation-receipt-panel" data-testid="generation-receipt-panel">
    <div class="planner-toolbar"><div><h3>回收生成结果 · 本地文件</h3><p>选择外部生成的 PNG 母图，绑定本计划需求。只在浏览器读取，不上传或写入项目。</p></div><el-tag type="info">人工回收 · 待审阅</el-tag></div>
    <p class="form-help">文件来源是你的声明，不是 ComfyUI / Codex 服务证明。读取字节、SHA-256 与 PNG 结构元数据；未解码像素，不判定透明质量、视觉批准或生成成功。</p>
    <el-alert v-if="workspace.isDemo" title="当前绑定示例项目；所选文件的测量仍来自文件本身，但不会变成真实项目产物" type="warning" :closable="false"/>
    <p v-if="!plan" class="form-help">先在资源规划建立草稿、编批并选择来源。</p>
    <p v-else-if="!current" class="form-help">当前规范与冻结计划不一致，文件登记暂停；已有记录保留原始绑定。</p>
    <div class="receipt-inputs">
      <label>对应母图需求<select v-model="requirementId" :disabled="!current || recovery.pending" aria-label="回收对应需求"><option value="">选择已编批、非 Owner 需求</option><option v-for="r in eligible" :key="r.id" :value="r.id">{{ r.name }} · {{ r.defaultSize.width }} × {{ r.defaultSize.height }}</option></select></label>
      <label>选择本地 PNG<input ref="fileInput" type="file" accept=".png,image/png" :disabled="!canReceive" aria-label="回收本地 PNG" @change="readFile"/></label>
      <el-button v-if="recovery.pending" @click="recovery.cancelPending">取消读取</el-button>
    </div>
    <p class="form-help">每次一张，最大 16 MiB / 8192 × 8192；默认单尺寸。尺寸不符仍留作待核记录，不自动缩放或生成派生图。每项目最多 32 份记录。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false"/>
    <el-alert v-if="notice" :title="notice" type="info" :closable="false"/>
    <div v-if="records.length" class="planner-table-wrapper"><table class="planner-table"><thead><tr><th>文件 / 需求</th><th>实测信息</th><th>来源 / 绑定</th><th>待完成</th></tr></thead><tbody>
      <tr v-for="(r,index) in records" :key="`${index}-${r.file.sha256}`"><td><strong>{{ r.file.name }}</strong><small>{{ r.context.requirement.name }}</small><small class="receipt-hash">SHA-256 {{ r.file.sha256 }}</small></td><td>{{ r.file.width }} × {{ r.file.height }} · {{ r.file.byteLength }} B<small>{{ r.checks.dimensions === 'matched' ? '尺寸匹配；不代表 QA 通过' : '尺寸不符，待处理' }}</small></td><td>{{ generationCapability(r.context.generationSource).label }}<small>来源自报 · 规范 {{ r.context.binding.specVersion }}</small><small>{{ current && contextMatchesPlan(r.context, plan) ? '匹配当前冻结需求' : '历史绑定，未重标来源或规范' }}</small></td><td><small>像素解码 / alpha / 视觉 / Owner 批准</small><small>项目保存 / 导入 / 绑定 / 运行</small><el-tag type="info" size="small">均未完成</el-tag></td></tr>
    </tbody></table></div>
    <div class="planner-import-actions"><el-button :disabled="!records.length || recovery.pending" @click="showExport">导出本地回收清单</el-button><span>已人工登记 {{ records.length }} · 本页提交 0 · 本页写项目 0</span></div>
    <p class="form-help">记录只存在本页内存，切换来源不会改写旧记录；刷新前导出清单并自行保留原图。清单不含图片，不能作为已验收结果导入；重新核验须重新选择原图。</p>
    <el-dialog v-model="previewOpen" title="本地回收清单 · 未批准 / 未写项目" width="820px" class="planning-dialog receipt-dialog">
      <el-alert title="实测文件元数据与冻结需求的交接清单，不是生成服务回执或项目配置" type="info" :closable="false"/>
      <el-input :model-value="preview" type="textarea" :rows="16" readonly aria-label="本地回收清单 JSON"/>
      <template #footer><el-button @click="previewOpen = false">关闭</el-button><el-button type="primary" @click="download">下载回收清单 JSON</el-button></template>
    </el-dialog>
  </section>
</template>
