<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { CircleCheck, CircleClose, Loading, Minus, Warning } from '@element-plus/icons-vue'
import AiJobActionsPanel from './AiJobActionsPanel.vue'
import type { AiJobAction } from '../domain/ai-job-actions'
import { aiJobActionsProvider } from '../ai-job-actions-integration'
import { aiJobsReadProvider } from '../ai-jobs-read-integration'
import { AI_JOB_STATE_LABELS, isAiCandidateId } from '../domain/ai-jobs-read'
import type { AiJobsReadProvider } from '../domain/ai-jobs-read'
import { createAiJobsReadState } from '../stores/ai-jobs-read'
import type { AiJobActionReadback, AiJobsProject } from '../stores/ai-jobs-read'
const props = withDefaults(defineProps<{ project: AiJobsProject | null; source: object | null; provider?: AiJobsReadProvider | null; workflowStep?: number; compact?: boolean; progressive?: boolean; active?:boolean }>(),{active:true})
const store = reactive(createAiJobsReadState())
const previewImage = ref<HTMLImageElement | null>(null)
const reader = computed(() => props.provider === undefined ? aiJobsReadProvider.value : props.provider)
watch(() => [props.project?.id, props.project?.name, props.project?.path, props.source], () => store.setContext(props.project, props.source), { immediate: true, flush: 'sync' })
watch(reader, next => { if (store.provider && store.provider !== next) store.invalidateProvider() }, { flush: 'sync' })
function previewLoaded(event: Event) {
  const image = event.currentTarget as HTMLImageElement
  if (previewImage.value === image) store.previewDisplayed(image.dataset.candidate ?? '', image.dataset.sha ?? '')
}
function previewFailed(event: Event) {
  if (previewImage.value === event.currentTarget) store.previewDisplayFailed()
}
async function readCreatedTask(input: { snapshot: import('../domain/ai-jobs-read').AiJobSnapshot; project: AiJobsProject; source: object; jobsReader: AiJobsReadProvider }) {
  const current = () => props.source === input.source && reader.value === input.jobsReader && props.project?.id === input.project.id && props.project.path === input.project.path && props.project.name === input.project.name
  if (!current() || store.busy) return
  await store.readJobs(input.jobsReader)
  if (current() && store.history?.jobs.some(job => job.jobId === input.snapshot.jobId)) store.selectJob(input.snapshot.jobId)
}
const readStatusSnapshot=computed(()=>({projectId:store.project?.id??'',projectPath:store.project?.path??'',source:props.source,loading:store.busy,error:store.error||store.statusError||'',observedAt:store.statusObservedAt||store.observedAt||'',hasRead:!!store.history,state:store.status?.state??null,historyOnly:!!store.status?.historyOnly}))
const workflowSnapshot=computed(()=>store.status ? {state:store.status.state,candidates:store.status.candidates.length,selected:store.status.selectedIds.length,hasImport:[store.status.import,store.status.variantImport].some(receipt=>receipt?.state==='imported_pending_verification'&&receipt.effectApplied===true&&receipt.leaseState==='RELEASED')}:null)
defineExpose({ readCreatedTask, readStatusSnapshot, workflowSnapshot })
const actionsByStep: Record<number, readonly AiJobAction[]> = { 1: [], 2: [], 3: ['run-next', 'resume'], 4: ['select'], 5: ['import', 'export-variant', 'import-variant'], 6: [] }
const allowedOperations = computed(() => props.active===false ? [] : props.workflowStep === undefined ? undefined : actionsByStep[props.workflowStep] ?? [])
const uncertain = computed(() => store.status && ['unknown', 'import_unknown'].includes(store.status.state))
// Presentation of existing read/task evidence only; never starts work or invents expiry.
const taskStatus = computed<{ text:string; tone:'primary'|'success'|'warning'|'danger'|'info'; busy:boolean; detail?:string }>(() => {
  if (!reader.value || !store.project) return { text:'未连接', tone:'info', busy:false }
  if (store.loading || store.statusLoading || store.previewLoading || store.variantPreviewLoading) return { text:store.loading?'任务读取中':store.statusLoading?'状态读取中':store.previewLoading?'候选读取中':'变体读取中', tone:'primary', busy:true }
  if (store.error || store.statusError) return { text:'读取失败', tone:'danger', busy:false, detail:store.error || store.statusError }
  if (store.previewError || store.variantPreviewError) return { text:store.previewError?'候选读取失败':'变体读取失败', tone:'danger', busy:false, detail:store.previewError || store.variantPreviewError }
  if (!store.history) return { text:'未读取', tone:'info', busy:false }
  if (!store.status) return { text:'任务列表已读取', tone:'success', busy:false }
  const state=store.status.state, historical=!!store.status.historyOnly
  const tone=state==='failed'?'danger':historical?'warning':state==='running'?'primary':['selected','reusable'].includes(state)?'success':['queued'].includes(state)?'info':'warning'
  return { text:(historical?'历史任务 · ':'')+AI_JOB_STATE_LABELS[state]+(['unknown','import_unknown'].includes(state)?' · 待核对':''), tone, busy:state==='running'&&!historical, detail:historical?'原回执明确绑定旧工程版本，仅可查看；不代表当前工程验收通过。':undefined }
})
const taskStatusIcon = computed(() => taskStatus.value.busy?Loading:taskStatus.value.tone==='danger'?CircleClose:taskStatus.value.tone==='success'?CircleCheck:taskStatus.value.tone==='warning'?Warning:Minus)

onBeforeUnmount(() => store.disconnect())
</script>
<template>
  <section class="section-card ai-jobs-read" data-testid="ai-jobs-read-panel">
    <div class="section-heading"><div class="job-status-heading"><h3>{{ props.progressive ? (workflowStep === 4 ? '预览并选用' : workflowStep === 5 ? '输出与导入' : workflowStep === 6 ? '核对导入结果' : '任务进度') : '原图标任务与候选' }}</h3><el-tag class="companion-status-tag" :type="taskStatus.tone" :title="taskStatus.detail" data-testid="job-status-tag"><el-icon class="companion-status-icon" :class="{'is-loading':taskStatus.busy}" aria-hidden="true"><component :is="taskStatusIcon"/></el-icon>{{ taskStatus.text }}</el-tag></div></div>
    <p v-if="!reader" class="form-help">当前构建未接入原任务读取；需原 Companion 同源会话与已配置的任务后端。</p>
    <p v-if="!store.project" class="form-help">请先选择已读取登记的工程。</p>
    <details v-else class="job-secondary" :open="!props.compact && !props.progressive"><summary>工程信息</summary><dl class="job-identity"><dt>工程</dt><dd>{{ store.project.name }} · {{ store.project.id }}</dd><dt>工程路径</dt><dd>{{ store.project.path }}</dd></dl></details>
    <div class="job-actions"><el-button :disabled="props.active===false || !reader || !store.project || store.busy" :loading="store.loading" @click="reader && store.readJobs(reader)">读取 / 刷新任务历史</el-button><el-button v-if="store.busy" @click="store.clearReads()">取消本页读取</el-button></div>
    <details v-if="!props.progressive" class="job-secondary"><summary>读取说明</summary>    <p class="form-help">这些读取会由原后台执行 Python、读取文件与 Git，并可能用 Pillow 检查候选。取消页面读取不能证明后台进程已结束。{{ aiJobActionsProvider ? '任务操作在下方逐次确认，接收回执不等于执行完成。' : '这里只读取原任务，不生成、不批准选择、不导入。' }}</p></details>
    <el-alert v-if="store.error" type="error" :closable="false" :title="store.error"/>
    <template v-if="store.history">
      <p>已读取 {{ store.history.jobs.length }} 个任务</p><p v-if="!props.progressive">本次列表工程 HEAD：{{ store.history.sourceRevision }}。任务自身的源版本单独显示，不能据状态查询断言它仍匹配当前工程 HEAD。</p>
      <p v-if="!store.history.jobs.length">原后台本次返回空任务历史。</p>
      <label v-else class="job-picker">选择已有任务（仅切换本地查看）<el-select :model-value="store.selectedJobId" aria-label="原图标任务" placeholder="选择一个已读取任务" :disabled="store.loading" @update:model-value="store.selectJob"><el-option v-for="job in store.history.jobs" :key="job.jobId" :value="job.jobId" :label="`${job.jobId} · ${AI_JOB_STATE_LABELS[job.state]} · r${job.revision}`"/></el-select></label>
      <div v-if="store.selectedJobId" class="job-actions"><el-button :disabled="props.active===false || store.busy" :loading="store.statusLoading" @click="store.readStatus()">刷新所选原任务状态</el-button></div>
    </template>
    <p v-else-if="!store.loading && !store.error">尚未读取任务历史。</p>
    <el-alert v-if="store.statusError" type="error" :closable="false" :title="store.statusError"/>
    <article v-if="store.status" aria-live="polite" class="job-detail">
      <h4>{{ AI_JOB_STATE_LABELS[store.status.state] }} · {{ store.status.state }}</h4>
      <el-alert v-if="store.status.historyOnly" type="warning" :closable="false" title="历史任务 · 只读" :description="`任务保留原工程版本；当前 HEAD ${store.status.historyOnly.currentSourceRevision}。不重放任务，不从旧选择发起写入。`"/>
      <details class="job-secondary" :open="!props.compact && !props.progressive"><summary>任务诊断</summary>      <dl class="job-identity"><dt>任务 ID</dt><dd>{{ store.status.jobId }}</dd><dt>任务版本</dt><dd>{{ store.status.revision }}</dd><dt>状态读取时间</dt><dd>{{ store.statusObservedAt }}</dd><dt>创建时间（原值）</dt><dd>{{ store.status.createdAt }}</dd><dt>任务源版本</dt><dd>{{ store.status.sourceRevision }}</dd><dt>请求 SHA-256</dt><dd>{{ store.status.requestHash }}</dd><dt>运行模式 / 来源</dt><dd>{{ store.status.mode ?? '原协议未返回' }} / {{ store.status.origin ?? '原协议未返回' }}</dd></dl></details>
      <el-alert v-if="uncertain" type="warning" :closable="false" :title="store.status.state === 'import_unknown' ? '导入可能已经写入；结果尚未确认。' : '生成是否完成尚未确认。'" :description="aiJobActionsProvider ? '保留原任务查询；生成 UNKNOWN 只能按原协议明确恢复，导入 UNKNOWN 不重试导入。' : '这里只能明确刷新原任务状态；不会新建、重新生成、恢复执行或重试导入。'"/>
      <p v-if="store.status.state === 'imported_pending_verification'">原任务已进入导入后待验证状态；这不等于场景绑定、Preview、Build 或生产验收完成。</p>
      <p v-if="store.status.state === 'running'">原任务仍显示执行中。HTTP 返回或派发接受不代表任务完成。</p>
      <p v-if="store.status.errorCode">原任务错误码：{{ store.status.errorCode }}</p>
      <details v-if="!props.progressive || workflowStep === 6" class="job-secondary"><summary>验收与导入记录</summary>
      <p>原协议 productionVerified：false；这不表示独立人工验收通过。</p><details v-if="store.status.resourceSnapshot"><summary>任务封存规范</summary><template v-if="store.status.resourceSnapshot.state === 'sealed'"><p>版本 {{ store.status.resourceSnapshot.version }} · SHA-256 {{ store.status.resourceSnapshot.hash }}</p><p>{{ 'kind' in store.status.resourceSnapshot ? store.status.resourceSnapshot.config.project.content : store.status.resourceSnapshot.config.style.description }}</p><p>此处为原后台已绑定此任务的封存证据，不替代当前配置或运行验收。</p></template><p v-else>原后台无法确认此任务的封存规范。</p></details>
      <section v-if="store.status.productAcceptance" class="job-acceptance" data-testid="job-product-acceptance">
        <h4>{{ store.status.productAcceptance.state === 'blocked' ? '关联工程验收：阻塞' : store.status.productAcceptance.state === 'owner_manual_passed' ? 'Owner 已手工确认：导入与运行可见' : '关联工程验收：证据未确认' }}</h4>
        <template v-if="store.status.productAcceptance.state === 'blocked'"><p>Scene：部分保存 · Compile：通过 · Preview：未执行 · Build：未执行</p><p>750 × 1334 实际设计尺寸未验证；UI 事务结果未知，需核对原操作。</p></template>
        <p v-else-if="store.status.productAcceptance.state === 'owner_manual_passed'">确认范围仅为原回执关联的导入与运行可见。自动化状态仍为 UNKNOWN，不等于自动化终态或生产验收。</p>
        <details v-if="store.status.productAcceptance.state !== 'unavailable'"><summary>验收回执</summary><dl class="job-identity"><dt>原操作</dt><dd>{{ store.status.productAcceptance.operationId }}</dd><dt>回执 SHA-256</dt><dd>{{ store.status.productAcceptance.receiptSha256 }}</dd><dt>记录时间</dt><dd>{{ store.status.productAcceptance.recordedAt }}</dd><template v-if="store.status.productAcceptance.state === 'owner_manual_passed'"><dt>Owner 确认时间</dt><dd>{{ store.status.productAcceptance.ownerReportedAt }}</dd><dt>来源消息</dt><dd>{{ store.status.productAcceptance.sourceMessageId }}</dd></template></dl></details>
      </section>
      <p v-else>此任务未附关联工程验收证据；不能把导入状态当作运行验收。</p>
      <details v-if="store.status.import"><summary>原导入回执</summary><dl class="job-identity"><dt>操作 ID</dt><dd>{{ store.status.import.operationId }}</dd><dt>导入状态</dt><dd>{{ store.status.import.state }}</dd><dt>写入效果</dt><dd>{{ String(store.status.import.effectApplied) }}</dd><dt>租约状态</dt><dd>{{ store.status.import.leaseState }}</dd><dt>原错误码</dt><dd>{{ store.status.import.errorCode ?? '无返回错误码' }}</dd></dl><p>写入效果与租约状态相互独立；租约未知不表示资产未导入。</p><ul><li v-for="(tool, index) in store.status.import.tools" :key="index">{{ tool.tool }} · {{ tool.operationId }} · {{ tool.status }}</li></ul></details>
      <h4>原任务目标</h4><ul><li v-for="asset in store.status.assets" :key="asset.assetId">{{ asset.assetId }} · {{ asset.relativePath }}</li></ul>
      <section v-if="store.status.variantImport" class="job-variant-import" data-testid="job-variant-import">
        <h4>变体导入回执摘要</h4>
        <p v-if="store.status.variantImport.artifact && store.status.variantImport.state === 'imported_pending_verification' && store.status.variantImport.effectApplied === true && store.status.variantImport.leaseState === 'RELEASED' && !store.status.variantImport.active" role="status">尺寸变体文件已导入当前工程，租约已释放。场景与运行验收尚未据此确认。</p>
        <p v-else role="status">尺寸变体导入尚未确认完成；只刷新同一原任务，不重复导入。</p>
        <p>母图任务状态与变体导入状态分别保留。此任务已有变体导入记录，页面写操作已暂停；请核对同一原操作。</p>
        <dl class="job-identity"><dt>原操作</dt><dd>{{ store.status.variantImport.operationId }}</dd><dt>变体状态</dt><dd>{{ store.status.variantImport.state }}</dd><dt>写入效果</dt><dd>{{ String(store.status.variantImport.effectApplied) }}</dd><dt>租约</dt><dd>{{ store.status.variantImport.leaseState }}</dd><dt>活动中</dt><dd>{{ String(store.status.variantImport.active) }}</dd><dt>错误码</dt><dd>{{ store.status.variantImport.errorCode ?? '无返回错误码' }}</dd></dl>
        <dl v-if="store.status.variantImport.artifact" class="job-identity"><dt>目标</dt><dd>{{ store.status.variantImport.artifact.destinationUrl }}</dd><dt>变体尺寸</dt><dd>{{ store.status.variantImport.artifact.width }} × {{ store.status.variantImport.artifact.height }}</dd><dt>文件 SHA-256</dt><dd>{{ store.status.variantImport.artifact.fileSha256 }}</dd><dt>收据 SHA-256</dt><dd>{{ store.status.variantImport.artifact.receiptSha256 }}</dd><dt>原候选</dt><dd>{{ store.status.variantImport.artifact.candidateId }}</dd></dl>
        <p>变体预览按原操作与文件/收据 SHA 校验，只读已保存文件。摘要和图像不代表当前资产回读、场景、Preview、Build 或生产验收通过。</p>
        <el-button :disabled="store.busy || !reader?.previewVariant || !store.status.variantImport.artifact" :loading="store.variantPreviewLoading" @click="store.readVariantPreview()">预览此变体</el-button>
        <p v-if="!reader?.previewVariant">当前构建未接入变体图像读取。</p>
        <el-alert v-if="store.variantPreviewError" type="error" :closable="false" :title="store.variantPreviewError"/>
        <div v-if="store.variantPreview" class="job-preview" data-testid="variant-png-preview"><img :src="`data:image/png;base64,${store.variantPreview.base64}`" alt="已核对文件与收据 SHA 的变体预览" @error="store.variantPreviewDisplayFailed()"/><p>{{ store.variantPreview.width }} × {{ store.variantPreview.height }} · SHA-256 {{ store.variantPreview.sha256 }}</p><el-button @click="store.clearVariantPreview()">关闭变体预览</el-button></div>
        <ul><li v-for="(tool, index) in store.status.variantImport.tools" :key="index">{{ tool.tool }} · {{ tool.operationId }} · {{ tool.status }}</li></ul>
      </section>
      </details>
      <template v-if="!props.progressive || workflowStep === 4"><h4>已记录候选</h4><p v-if="!store.status.candidates.length">这个任务快照没有返回候选。</p><ul class="job-candidates"><li v-for="candidate in store.status.candidates" :key="candidate.candidateId"><div><strong>{{ candidate.candidateId }}</strong><p>资产 {{ candidate.assetId }} · {{ candidate.width }} × {{ candidate.height }} · PNG / Alpha</p><p>SHA-256 {{ candidate.fileSha256 }}</p><p>{{ store.status.selectedIds.includes(candidate.candidateId) ? '原任务已保存此选择' : '原任务未选择此候选' }}</p></div><el-button :disabled="props.active===false || store.busy || !!store.status.historyOnly || !isAiCandidateId(candidate.candidateId)" @click="store.readPreview(candidate.candidateId)">预览此候选</el-button><small v-if="!isAiCandidateId(candidate.candidateId)">原候选 ID 不符合已部署预览请求约束，保留记录但不发请求。</small></li></ul>
      </template>
    </article>
    <section v-if="store.previewCandidateId" v-show="!props.progressive || workflowStep === 4" aria-live="polite" class="job-preview"><div class="section-heading"><h4>候选预览 · {{ store.previewCandidateId }}</h4><el-button @click="store.clearPreview()">关闭候选预览</el-button></div><p v-if="store.previewLoading">正在核对候选字节与原任务 SHA-256…</p><el-alert v-if="store.previewError" type="error" :closable="false" :title="store.previewError"/><template v-if="store.preview"><img ref="previewImage" :key="`${store.preview.candidateId}/${store.preview.sha256}`" :data-candidate="store.preview.candidateId" :data-sha="store.preview.sha256" :src="`data:image/png;base64,${store.preview.base64}`" alt="已核对任务候选的预览" @load="previewLoaded" @error="previewFailed"/><p>{{ store.preview.width }} × {{ store.preview.height }} · SHA-256 {{ store.preview.sha256 }}</p><p>像素可显示和文件一致不等于风格、用途、透明效果或生产验收通过。</p></template></section>
    <AiJobActionsPanel v-if="aiJobActionsProvider && store.status" :project="store.project" :source="props.source" :job="store.status" :preview="store.preview" :preview-shown="store.previewShown" :reader="store.provider" :provider="aiJobActionsProvider" :allowed-operations="allowedOperations" :offline-only="store.history?.mode === 'offline_import_only' ? true : store.history?.mode === 'generation' ? false : undefined" @readback="(input: AiJobActionReadback) => store.acceptActionReadback(input)"/>
  </section>
</template>
<style scoped>
.job-status-heading{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.ai-jobs-read{display:grid;gap:14px}.ai-jobs-read p{line-height:1.65;overflow-wrap:anywhere;margin:5px 0}.job-identity{display:grid;grid-template-columns:145px minmax(0,1fr);gap:8px;margin:0}.job-identity dt{color:var(--text-secondary,#637187)}.job-identity dd{margin:0;overflow-wrap:anywhere}.job-actions{display:flex;flex-wrap:wrap;gap:10px}.job-picker{display:grid;gap:8px}.job-detail{display:grid;gap:12px}.job-detail h4{margin:8px 0}.job-candidates{list-style:none;padding:0;display:grid;gap:12px}.job-candidates li{border:1px solid var(--border-color,#e3e8ef);padding:12px;border-radius:8px;display:flex;gap:12px;flex-wrap:wrap;align-items:center}.job-candidates li>div{flex:1;min-width:180px;overflow-wrap:anywhere}.job-preview img{display:block;max-width:100%;max-height:480px;object-fit:contain;border:1px solid #dfe5ed;background:repeating-conic-gradient(#f1f3f6 0% 25%,#fff 0% 50%) 0/20px 20px}.job-preview h4{overflow-wrap:anywhere}@media(max-width:600px){.job-identity{grid-template-columns:1fr}.job-identity dd{margin-bottom:6px}}
</style>

<style scoped>.job-secondary{font-size:12px;color:var(--el-text-color-secondary)}.job-secondary>summary{cursor:pointer;margin-bottom:8px}.job-detail>h4{color:var(--el-text-color-primary)}.job-actions :deep(.el-button:first-child){font-weight:600}</style>
