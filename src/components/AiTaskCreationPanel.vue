<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { aiTaskCreationProvider } from '../ai-task-creation-integration'
import { aiResourceReadProvider } from '../ai-resource-read-integration'
import { aiJobsReadProvider } from '../ai-jobs-read-integration'
import type { AiTaskCreationProvider } from '../domain/ai-task-creation'
import { aiTaskPromptSuffix } from '../domain/ai-task-creation'
import type { AiResourceReadProvider } from '../domain/ai-resource-read'
import type { AiJobsReadProvider } from '../domain/ai-jobs-read'
import { AI_JOB_STATE_LABELS } from '../domain/ai-jobs-read'
import { AI_WRITE_FENCE_KEY } from '../domain/ai-write-coordination'
import { createAiTaskCreationState } from '../stores/ai-task-creation'
import type { AiTaskProject, AiTaskCreatedEvent } from '../stores/ai-task-creation'
const props = withDefaults(defineProps<{ project: AiTaskProject | null; source: object | null; resourceReader?: AiResourceReadProvider | null; jobsReader?: AiJobsReadProvider | null; provider?: AiTaskCreationProvider | null; configDirty?: boolean; active?: boolean; compact?: boolean }>(), { active: true })
const emit = defineEmits<{ created: [value: AiTaskCreatedEvent] }>()
const store = reactive(createAiTaskCreationState())
const resourceReader = computed(() => props.resourceReader === undefined ? aiResourceReadProvider.value : props.resourceReader)
const jobsReader = computed(() => props.jobsReader === undefined ? aiJobsReadProvider.value : props.jobsReader)
const provider = computed(() => props.provider === undefined ? aiTaskCreationProvider.value : props.provider)
watch(() => [props.project?.id, props.project?.name, props.project?.path, props.source, resourceReader.value, jobsReader.value, provider.value, props.configDirty], () => store.setContext(props.project, props.source, resourceReader.value, jobsReader.value, provider.value, props.configDirty ?? false), { immediate: true, flush: 'sync' })
watch(() => props.active, value => store.setActive(value !== false), { immediate: true, flush: 'sync' })
const compiledPromptLength = computed(() => store.config ? store.brief.prompt.trim().length + aiTaskPromptSuffix(store.config).length : 0)
const lockedForm = computed(() => !store.active || store.busy || !!store.retainedRunId || store.phase === 'unknown')
async function submit() { const result = await store.submit(); if (result) emit('created', result) }
async function recover() { const result = await store.recoverOriginal(); if (result) emit('created', result) }
function storageChanged(event: StorageEvent) { if (event.key === AI_WRITE_FENCE_KEY || event.key === null) store.storageChanged() }
globalThis.addEventListener?.('storage', storageChanged)
onBeforeUnmount(() => { globalThis.removeEventListener?.('storage', storageChanged); store.leave() })
</script>
<template>
  <section class="section-card ai-task-creation" data-testid="ai-task-creation-panel">
    <div class="section-heading"><div><h3>描述一张图标</h3><p>沿用原后台的单图流程：核对已保存资源配置、填写用途与画面，再检查目标并排队或采用可信 PNG。</p></div></div>
    <p v-if="!provider || !resourceReader || !jobsReader" class="form-help">当前构建未接入任务创建；需要原 Companion 同源会话与已配置的任务后端。</p>
    <p v-if="!store.project">请先选择已登记工程。</p>
    <details v-else class="task-details" :open="!props.compact"><summary>工程信息</summary><p>工程 {{ store.project.name }} · {{ store.project.id }}<br>{{ store.project.path }}</p></details>
    <p v-if="provider && resourceReader && jobsReader && !store.drainAvailable">读取接口未提供请求清理确认，当前只允许读取，已阻止创建任务。</p>
    <p v-if="configDirty">当前工程资源配置有未保存修改，请先完成或取消配置编辑。</p>
    <div class="task-buttons"><el-button type="primary" plain :disabled="!store.active || !provider || !resourceReader || !jobsReader || !source || !store.project || store.busy || !!configDirty" :loading="store.phase === 'reading'" @click="store.readContext()">读取生成所需配置</el-button></div>
    <details class="task-details" :open="!props.compact"><summary>读取与生成说明</summary>    <p class="form-help">读取会使用原后台 Python、文件与 Git；不会自动运行模型。只有已保存的有效 v2 配置可用于新任务，草稿不算已保存。</p></details>
    <el-alert v-if="store.error" type="error" :closable="false" :title="store.error"/>
    <p v-if="store.pending || store.storageBlocked">存在尚未确认的 AI 写操作，或无法可靠保存跨标签页保护记录；新任务已阻止。</p>
    <template v-if="store.config && store.history">
      <p>默认成品 {{ store.config.iconSize.width }} × {{ store.config.iconSize.height }}；母图固定 1024 × 1024 透明 PNG，每张一个候选、一次提交。</p>
      <form @submit.prevent="store.prepare()" class="task-form">
        <label>资源名称<el-input aria-label="资源名称" :model-value="store.brief.name" maxlength="60" :disabled="lockedForm" placeholder="coin-pouch" @update:model-value="(value: unknown) => store.edit('name', String(value))"/></label>
        <label>用途<el-input aria-label="图标用途" :model-value="store.brief.purpose" maxlength="400" :disabled="lockedForm" placeholder="例如奖励、道具、按钮" @update:model-value="(value: unknown) => store.edit('purpose', String(value))"/></label>
        <label>画面<el-input aria-label="图标画面" type="textarea" :rows="3" :model-value="store.brief.prompt" maxlength="4096" :disabled="lockedForm" placeholder="主体、细节与要表达的含义" @update:model-value="(value: unknown) => store.edit('prompt', String(value))"/></label>
        <p>加入已保存风格与留白要求后：{{ compiledPromptLength }} / 4096 字符。超过上限不能提交。</p>
        <details><summary>高级配置</summary><label>图标标识<el-input aria-label="图标标识" :model-value="store.brief.assetId" maxlength="60" :disabled="lockedForm" @update:model-value="(value: unknown) => store.edit('assetId', String(value))"/></label><label>工程目标路径（配置派生）<el-input aria-label="工程目标路径" :model-value="store.targetPath" readonly/></label><label>资源配置风格（只读）<el-input aria-label="资源配置风格" type="textarea" :model-value="store.config.style.description" readonly/></label><p>配置版本 {{ store.resource?.version }} · SHA-256 {{ store.resource?.hash }}</p><p>本次 jobs 读取的工程 HEAD {{ store.history.sourceRevision }}（后台提交时仍会复核）</p></details>
        <label v-if="store.history.mode === 'offline_import_only' || store.history.adoptionSources?.length">现有 PNG 来源<el-select aria-label="现有 PNG 来源" :model-value="store.brief.sourceId" :disabled="lockedForm" @update:model-value="(value: unknown) => store.edit('sourceId', String(value))"><el-option v-if="store.history.mode !== 'offline_import_only'" value="" label="生成新候选（先排队）"/><el-option v-for="sourceItem in store.history.adoptionSources ?? []" :key="sourceItem.sourceId" :value="sourceItem.sourceId" :label="sourceItem.sourceId"/></el-select></label>
        <p v-if="store.history.mode === 'offline_import_only'">当前后端只允许采用可信目录已有 PNG，不能排队生成。</p>
        <el-button native-type="submit" type="primary" :disabled="!store.canPrepare">继续到准备图标</el-button>
      </form>
      <section v-if="store.prepared" class="task-confirm" aria-label="确认单图任务">
        <h4>准备图标</h4><p>原任务 ID {{ store.prepared.input.request.runId }}</p><p>{{ store.prepared.input.request.assets[0].assetId }} → {{ store.prepared.input.request.assets[0].relativePath }}</p>
        <p v-if="store.prepared.operation === 'adopt'">采用 {{ store.prepared.input.sourceId }} 的可信 PNG，绑定当前工程、用途与目标；不生成新图，也不导入 Creator。</p>
        <p v-else>本次会封存当前资源配置与参考证据并持久入队；排队不等于 GPU 生成。实际运行需原任务另行批准。</p>
        <p>目标已存在时一律阻止，包含 REUSABLE。参考图仅封存记录，不作为模型图像输入。风格由服务端覆盖并附加到画面要求。</p>
        <el-checkbox aria-label="批准本次单图任务" :model-value="store.confirmed" :disabled="!store.active || store.busy || !!store.retainedRunId" @update:model-value="(value: unknown) => store.confirm(value === true)">我确认当前工程、HEAD、配置版本与 SHA、目标、用途和画面，批准本次单图{{ store.prepared.operation === 'adopt' ? '采用' : '排队' }}</el-checkbox>
        <el-button type="primary" :disabled="!store.canSubmit" :loading="store.busy" @click="submit()">{{ store.prepared.operation === 'adopt' ? '核验并采用现有 PNG' : '检查并排队' }}</el-button>
      </section>
    </template>
    <p v-for="pendingId in store.pendingRunIds" :key="pendingId">受保护的原任务 ID：{{ pendingId }}</p>
    <p v-if="store.pending && !store.retainedRunId">本页仅有持久保护标识，没有原输入的完整核对证据，不能据任务 ID 猜测或解除保护。请在原任务历史核对，不要重新提交。</p>
    <el-button v-if="store.retainedRunId && store.phase !== 'accepted'" :disabled="!store.canRecover" @click="recover()">回读原任务核对结果</el-button>
    <p v-if="store.retainedRunId">保留原任务 ID：{{ store.retainedRunId }}</p>
    <p v-if="store.phase === 'unknown'">请到原任务历史明确刷新这个 ID；这里不会自动重试、重建任务或清除未知结果保护记录。</p>
    <section v-if="store.snapshot" aria-live="polite"><h4>原任务回读已核对</h4><p v-if="store.recovered">这是当前对原任务的核对，不代表先前丢失响应的请求在当时已经成功；没有重发创建请求。</p><p>{{ store.snapshot.jobId }} · {{ AI_JOB_STATE_LABELS[store.snapshot.state] }} · r{{ store.snapshot.revision }}</p><p>任务身份、源提交、目标及封存配置与本次请求一致。当前状态不代表场景绑定、Preview、Build 或生产验收通过。</p><el-button :disabled="!store.active || store.busy || store.pending" @click="store.newBrief()">继续填写另一张图标</el-button></section>
  </section>
</template>
<style scoped>
.ai-task-creation,.task-form,.task-confirm{display:grid;gap:12px}.ai-task-creation p{margin:3px 0;line-height:1.65;overflow-wrap:anywhere}.task-form label,.task-form details{display:grid;gap:8px}.task-form details[open]{padding:10px;border:1px solid var(--border-color,#e1e7ef);border-radius:8px}.task-form summary{cursor:pointer}.task-buttons{display:flex;gap:8px;flex-wrap:wrap}.task-confirm{border-top:1px solid var(--border-color,#e1e7ef);padding-top:12px}.task-confirm .el-checkbox{height:auto;white-space:normal;align-items:flex-start}.task-confirm :deep(.el-checkbox__label){white-space:normal;line-height:1.6}.task-confirm h4{margin:0}
</style>

<style scoped>.task-details{font-size:12px;color:var(--el-text-color-secondary)}.task-details summary{cursor:pointer}.task-form>p{font-size:12px;color:var(--el-text-color-secondary)}.task-form :deep(.el-input),.task-form :deep(.el-textarea){max-width:760px}.task-form>button{justify-self:start}.task-buttons{align-items:center}</style>
