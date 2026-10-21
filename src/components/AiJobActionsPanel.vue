<script setup lang="ts">
import { aiResourceSnapshotOutput } from '../domain/ai-resource-snapshot'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { aiJobActionsProvider } from '../ai-job-actions-integration'
import type { AiJobActionsProvider, AiJobAction } from '../domain/ai-job-actions'
import type { AiJobPreview, AiJobSnapshot, AiJobsReadProvider } from '../domain/ai-jobs-read'
import { createAiJobActionsState } from '../stores/ai-job-actions'
import type { AiJobActionReadback } from '../stores/ai-job-actions'
import type { AiJobsProject } from '../stores/ai-jobs-read'
const props = withDefaults(defineProps<{ project: AiJobsProject | null; source: object | null; job: AiJobSnapshot | null; reader: AiJobsReadProvider | null;
  provider?: AiJobActionsProvider | null; preview?: AiJobPreview | null; previewShown?: boolean; offlineOnly?: boolean; allowedOperations?: readonly AiJobAction[] }>(), { offlineOnly: undefined })
const emit = defineEmits<{ readback: [payload: AiJobActionReadback] }>()
const store = reactive(createAiJobActionsState())
const customOpen = ref(false), customWidth = ref(1), customHeight = ref(1)
const operationVisible = (operation: AiJobAction) => props.allowedOperations?.includes(operation) ?? true
watch(() => props.allowedOperations, () => { store.revokePendingScope(); customOpen.value = false }, { deep: true, flush: 'sync' })
const writer = computed(() => props.provider === undefined ? aiJobActionsProvider.value : props.provider)
watch(() => [props.project?.id, props.project?.name, props.project?.path, props.source, props.job, props.reader, writer.value, props.offlineOnly],
  () => { customOpen.value = false; store.setContext(props.project, props.source, props.job, props.reader, writer.value, props.offlineOnly) }, { immediate: true, deep: false, flush: 'sync' })
watch(() => [props.preview, props.previewShown], () => { void store.recordPreview(props.preview ?? null, props.previewShown === true) }, { immediate: true, flush: 'sync' })
watch(() => store.readback, payload => { if (payload) emit('readback', payload) }, { flush: 'sync' })
const labels: Record<AiJobAction, string> = { 'run-next': '执行原任务', resume: '恢复原任务查询', select: '保存候选选择', import: '导入已选母图（1024）', 'export-variant': '导出尺寸 PNG', 'import-variant': '导入当前工程' }
const explanations: Record<AiJobAction, string> = {
  'run-next': '批准此原任务使用当前已运行的本地生成服务与 GPU。只运行当前 queued / waiting_service 任务，不启动模型服务。',
  resume: '只恢复此 unknown / running 原任务的结果查询。不会创建新任务或重新提交生成。',
  select: '我已逐个查看这些 SHA-256 匹配的候选，批准保存本次选择。像素与文件一致不代替 Owner 对内容、风格和用途的审阅。',
  import: '单独批准把此原任务已保存选择的 1024 × 1024 母图导入下列工程新目标。禁止覆盖；未知导入不得重试。',
  'export-variant': '批准从原任务已保存选择的母图导出本次确认的单一尺寸 PNG（默认取封存配置）。CPU 本地缩放，不导入 Creator，不改变场景或任务状态，禁止覆盖。',
  'import-variant': '单独批准将下方尺寸变体导入当前工程的新目标。使用实际导出文件和收据的 SHA-256，不导入 1024 母图、不覆盖已有资源。结果未知时只读取同一原操作，不重复提交。',
}
function choose(candidateId: string, checked: boolean) { store.setSelectedIds(checked ? [candidateId] : store.selectedIds.filter(id => id !== candidateId)) }
function openCustom() {
  const output = aiResourceSnapshotOutput(store.job?.resourceSnapshot,store.job?.candidates.find(c=>c.candidateId===store.job?.selectedIds[0])?.assetId)
  if (!store.allowed('export-variant') || !output) return
  store.cancelConfirmation(); customWidth.value = output.width; customHeight.value = output.height; customOpen.value = true
}
function prepareCustom() { if (store.prepare('export-variant', { width: customWidth.value, height: customHeight.value })) customOpen.value = false }
function checked(event: Event) { return (event.target as HTMLInputElement).checked }
const selectedCandidates = computed(() => {
  const confirm = store.confirmation
  if (!confirm) return []
  const snapshot = confirm.submission.snapshot, input = confirm.submission.input
  const ids = 'selectedIds' in input ? input.selectedIds : 'candidateId' in input ? [input.candidateId] : snapshot.selectedIds
  return snapshot.candidates.filter(candidate => ids.includes(candidate.candidateId))
})
onBeforeUnmount(() => store.leave())
</script>
<template>
  <section class="ai-job-actions" data-testid="ai-job-actions-panel">
    <h4>原任务操作</h4>
    <p v-if="!writer">当前构建未接入原任务写操作。</p>
    <template v-else-if="store.job">
      <p>每项操作单独核对并批准；确认绑定当前工程、来源、原任务版本和候选 SHA-256。跨标签页保护只协调当前站点，后台仍按原版本与状态拒绝冲突。</p>
      <p v-if="!store.drainAvailable || store.readDrainBlocked">读取或写入提供者未能确认底层请求清理结束，写操作保持不可用；仍可读取原任务。</p>
      <p v-if="!store.generationEnabled && ['queued','waiting_service','unknown','running'].includes(store.job.state)">生成模式未明确启用或当前为仅离线导入；执行与恢复入口不可用。</p>
      <div class="job-action-buttons">
        <el-button v-if="operationVisible('run-next') && ['queued','waiting_service'].includes(store.job.state)" :disabled="!store.allowed('run-next')" @click="store.prepare('run-next')">执行原任务</el-button>
        <el-button v-if="operationVisible('resume') && ['unknown','running'].includes(store.job.state)" :disabled="!store.allowed('resume')" @click="store.prepare('resume')">恢复原任务查询</el-button>
      </div>
      <div v-if="operationVisible('select') && ['awaiting_selection','selected'].includes(store.job.state)" class="job-selection">
        <p>先在上方逐个预览并查看候选，再勾选需要保存的一张候选。</p>
        <label v-for="candidate in store.job.candidates" :key="candidate.candidateId">
          <input type="checkbox" :checked="store.selectedIds.includes(candidate.candidateId)" :disabled="store.busy || store.previewed[candidate.candidateId] !== candidate.fileSha256" @change="choose(candidate.candidateId, checked($event))">
          {{ candidate.candidateId }} · {{ store.previewed[candidate.candidateId] === candidate.fileSha256 ? '已显示并校验 SHA-256，可供审阅选择' : '尚未显示通过校验的预览' }}
        </label>
        <el-button :disabled="!store.allowed('select') || !store.selectedIds.length" @click="store.prepare('select')">保存候选选择</el-button>
      </div>
      <div class="job-action-buttons">
        <el-button v-if="operationVisible('import') && store.job.state === 'selected'" :disabled="!store.allowed('import')" @click="store.prepare('import')">导入已选母图（1024）</el-button>
        <template v-if="operationVisible('export-variant') && ['selected','imported_pending_verification'].includes(store.job.state)"><el-button :disabled="!store.allowed('export-variant')" @click="store.prepare('export-variant')">导出默认尺寸 PNG</el-button><el-button :disabled="!store.allowed('export-variant')" @click="openCustom()">导出其他尺寸</el-button></template>
      </div>
      <p v-if="operationVisible('export-variant') && ['selected','imported_pending_verification'].includes(store.job.state) && (!aiResourceSnapshotOutput(store.job.resourceSnapshot,store.job.candidates.find(c=>c.candidateId===store.job?.selectedIds[0])?.assetId) || store.job.selectedIds.length !== 1)">默认尺寸导出需要这个原任务的有效 v2 单尺寸封存配置和唯一已保存候选；缺少证据时保持不可用。</p>
      <p v-if="store.job.state === 'import_unknown'">导入可能已写入，写入效果与租约释放相互独立。这里只能读取原任务，不重试导入。</p>
      <p v-if="store.hasPending">此工程存在待核对操作保护记录。离开页面、切换来源或重载不会清除未知结果。</p>
      <el-button :disabled="store.refreshing || store.busy" :loading="store.refreshing" @click="store.refreshStatus()">刷新原任务并核对保护记录</el-button>
    </template>
    <el-dialog v-model="customOpen" title="导出其他尺寸" width="460px" :close-on-click-modal="false"><p>从同一个原任务已保存选择导出一个尺寸；默认使用封存规格。最多 4096 × 4096，且总面积不超过 1600 万像素。</p><label>宽度 <el-input-number v-model="customWidth" :min="1" :max="4096" :precision="0" /></label><label>高度 <el-input-number v-model="customHeight" :min="1" :max="4096" :precision="0" /></label><p>后续仍需核对冻结范围并批准；上采样需额外接受质量限制。</p><template #footer><el-button @click="customOpen = false">取消</el-button><el-button @click="prepareCustom()">核对此尺寸</el-button></template></el-dialog>
    <section v-if="store.confirmation" class="job-confirmation" aria-label="原任务操作确认" data-testid="ai-job-action-confirmation">
      <h4>确认：{{ labels[store.confirmation.operation] }}</h4>
      <p>{{ explanations[store.confirmation.operation] }}</p>
      <dl><dt>工程</dt><dd>{{ store.confirmation.project.name }} · {{ store.confirmation.project.id }}</dd><dt>工程路径</dt><dd>{{ store.confirmation.project.path }}</dd>
        <dt>原任务</dt><dd>{{ store.confirmation.submission.snapshot.jobId }} · r{{ store.confirmation.submission.snapshot.revision }}</dd>
        <dt>源提交</dt><dd>{{ store.confirmation.submission.snapshot.sourceRevision }}</dd><dt>请求 SHA-256</dt><dd>{{ store.confirmation.submission.snapshot.requestHash }}</dd></dl>
      <ul><li v-for="asset in store.confirmation.submission.snapshot.assets" :key="asset.assetId">{{ asset.assetId }} → {{ asset.relativePath }}</li></ul>
      <ul v-if="selectedCandidates.length"><li v-for="candidate in selectedCandidates" :key="candidate.candidateId">{{ candidate.candidateId }} · SHA-256 {{ candidate.fileSha256 }}</li></ul>
      <p v-if="store.confirmation.operation === 'export-variant' && 'width' in store.confirmation.submission.input">本次尺寸：{{ store.confirmation.submission.input.width }} × {{ store.confirmation.submission.input.height }}。目标 SHA 条件固定为 null，禁止覆盖。</p>
      <dl v-if="store.confirmation.operation === 'import-variant' && 'expectedVariantSha256' in store.confirmation.submission.input" class="variant-import-binding" data-testid="variant-import-binding">
        <dt>变体尺寸</dt><dd>{{ store.confirmation.submission.input.width }} × {{ store.confirmation.submission.input.height }}</dd>
        <dt>导入新目标</dt><dd>{{ store.confirmation.submission.input.destinationUrl }}</dd>
        <dt>变体文件 SHA-256</dt><dd>{{ store.confirmation.submission.input.expectedVariantSha256 }}</dd>
        <dt>导出收据 SHA-256</dt><dd>{{ store.confirmation.submission.input.expectedReceiptSha256 }}</dd>
      </dl>
      <label v-if="store.confirmation.needsUpscale"><input type="checkbox" :checked="store.upscaleConfirmed" @change="store.setUpscaleConfirmed(checked($event))">明确批准放大，接受母图质量限制；放大不会增加新细节</label>
      <label><input type="checkbox" :checked="store.confirmed" @change="store.setConfirmed(checked($event))">我已核对上述冻结范围，并单独批准本次{{ labels[store.confirmation.operation] }}</label>
      <div class="job-action-buttons"><el-button type="primary" :disabled="!store.canExecute" @click="store.execute()">确认并{{ labels[store.confirmation.operation] }}</el-button><el-button @click="store.cancelConfirmation()">取消确认</el-button></div>
    </section>
    <div v-if="store.busy"><p>操作或响应清理仍在进行；保护锁保留。</p><el-button @click="store.cancelWait()">停止等待（不取消后台执行）</el-button></div>
    <p v-if="store.message" role="status" aria-live="polite">{{ store.message }}</p>
    <section v-if="store.variantReceipt" class="variant-receipt" data-testid="variant-export-receipt"><h4>已核对的尺寸 PNG 回执</h4><p>{{ store.variantReceipt.relativePath }}</p><p>{{ store.variantReceipt.width }} × {{ store.variantReceipt.height }} · SHA-256 {{ store.variantReceipt.sha256 }}</p><p>母图 SHA-256 {{ store.variantReceipt.sourceSha256 }}</p><p v-if="store.variantReceipt.receiptSha256">收据 SHA-256 {{ store.variantReceipt.receiptSha256 }}</p><p>{{ store.variantReceipt.created ? '本次创建文件' : '原后台确认相同文件已存在' }}{{ store.variantReceipt.upscaled ? ' · 已批准放大，不能增加新细节' : '' }}。导出未导入 Creator；导入后可在变体回执中预览真实 PNG，场景与运行验收另行核对。</p>
      <el-button v-if="operationVisible('import-variant')" :disabled="!store.allowed('import-variant')" @click="store.prepare('import-variant')">导入当前工程</el-button>
      <p v-if="!store.variantReceipt.receiptSha256">这份旧响应未提供导出收据 SHA-256，不能据此导入。</p>
    </section>
  </section>
</template>
<style scoped>
.ai-job-actions{display:grid;gap:12px;border-top:1px solid var(--border-color,#e3e8ef);padding-top:14px}.ai-job-actions p{margin:4px 0;line-height:1.65;overflow-wrap:anywhere}.ai-job-actions h4{margin:5px 0}.job-action-buttons{display:flex;flex-wrap:wrap;gap:10px}.job-selection,.job-confirmation{display:grid;gap:12px}.job-selection label,.job-confirmation label{display:flex;gap:8px;align-items:flex-start;line-height:1.6}.job-confirmation{padding:14px;border:1px solid var(--border-color,#e3e8ef);border-radius:8px}.job-confirmation dl{display:grid;grid-template-columns:120px minmax(0,1fr);gap:8px;margin:0}.job-confirmation dd{margin:0;overflow-wrap:anywhere}.job-confirmation li,.variant-receipt{overflow-wrap:anywhere}@media(max-width:600px){.job-confirmation dl{grid-template-columns:1fr}}
</style>
