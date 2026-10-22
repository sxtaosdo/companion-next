<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useToolPresetsReadStore } from '../stores/tool-presets-read'
import { useToolPresetDraftsStore } from '../stores/tool-preset-drafts'
import { useToolPresetsWriteStore } from '../stores/tool-presets-write'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { companionBrowserProvider } from '../companion-browser-integration'
import { toolPresetReadProvider } from '../tool-presets-read-integration'
import { toolPresetWriteProvider } from '../tool-presets-write-integration'
const read = useToolPresetsReadStore(), drafts = useToolPresetDraftsStore(), write = useToolPresetsWriteStore(), projects = useCompanionBrowserStore()
const confirmed = ref(false), resetConfirmed = ref(false), recovered = ref(false), rename = ref('')
function sync() {
  write.syncContext({ reader: read.provider === toolPresetReadProvider.value ? read.provider : null, writer: toolPresetWriteProvider.value,
    projectId: read.projectId, registeredProjects: projects.connected && projects.provider && projects.provider === companionBrowserProvider.value ? projects.projects.map(project => ({ ...project })) : [],
    registrationProvider: projects.connected ? projects.provider : null, expectedRegistrationProvider: companionBrowserProvider.value, registrationRevision: projects.projectSnapshotRevision,
    tools: read.tools, presets: read.presets, selectedPresetId: read.selectedPresetId, previewPresetId: read.previewPresetId,
    toolsReady: read.toolsRead, presetsReady: read.presetsRead, loading: read.toolsLoading || read.presetsLoading || projects.projectLoading, draftRevision: drafts.revision })
}
watch([() => read.provider, toolPresetReadProvider, toolPresetWriteProvider, () => read.projectId, () => read.tools, () => read.presets, () => read.selectedPresetId, () => read.previewPresetId, () => read.toolsRead, () => read.presetsRead, () => read.toolsLoading, () => read.presetsLoading, () => projects.connected, () => projects.provider, companionBrowserProvider, () => projects.projectLoading, () => projects.projectSnapshotRevision, () => projects.projects, () => drafts.revision], sync, { deep: true, immediate: true, flush: 'sync' })
watch(rename, () => write.dismiss(), { flush: 'sync' })
watch(() => write.plan, () => { confirmed.value = false; resetConfirmed.value = false }, { flush: 'sync' })
watch(() => write.observation, () => { recovered.value = false }, { flush: 'sync' })
const ready = computed(() => Boolean(toolPresetWriteProvider.value && read.provider && read.provider === toolPresetReadProvider.value && read.toolsRead && read.presetsRead && !read.toolsLoading && !read.presetsLoading && !write.locked && !write.needsRefresh))
const canAssign = computed(() => projects.connected && !!projects.provider && projects.provider === companionBrowserProvider.value && !projects.projectLoading && projects.projects.some(project => project.id === read.projectId && !!project.path))
const preview = computed(() => read.preview)
const review = computed(() => write.plan)
const reviewPresets = computed(() => { const operation = review.value?.operation; return operation ? operation.kind === 'import' ? operation.presets : [operation.preset] : [] })
const resetDeletion = computed(() => review.value?.operation.kind === 'delete' && review.value.operation.resetLinkedProjects === true)
const before = computed(() => { const op = review.value?.operation; return op?.kind === 'update' ? op.before : op?.kind === 'assign' ? op.previous : op?.kind === 'create' ? op.source : null })
async function submit() { const plan = write.plan; if (!plan || !confirmed.value || resetDeletion.value && !resetConfirmed.value) return; const approval = confirmed.value; confirmed.value = false; resetConfirmed.value = false; await write.confirm(plan, approval) }
let refreshRevision = 0
watch([() => read.projectId, () => read.provider, toolPresetReadProvider], () => { refreshRevision++ }, { flush: 'sync' })
async function refresh() { const reader = toolPresetReadProvider.value; if (!reader || write.sending || write.readingBack) return; const pending = read.loadTools(reader), version = refreshRevision; await pending; if (version === refreshRevision && read.provider === reader && toolPresetReadProvider.value === reader) await read.loadPresets() }
onBeforeUnmount(() => { refreshRevision++; write.leave() })
</script>
<template>
  <section class="tool-preset-write-panel" aria-label="工具预设正式保存" data-testid="tool-preset-write-panel">
    <h3>保存工具预设与工程范围</h3>
    <p>使用上方现有克隆、编辑和 JSON 导入准备内容，再在这里确认写入宿主。导出继续使用原入口。保存预设不会自动分配工程；工程分配须单独确认具体工程和范围。</p>
    <el-alert type="warning" :closable="false" title="原宿主没有版本哈希或原子并发校验" description="读取和确认都是快照。同一宿主的其他页面、客户端或服务可能在确认后修改预设，写入可能覆盖并行变化；请先停止并行编辑。此页单飞无法锁住其他页面。工程登记也可能并行改变，原 API 仅接收 projectId，不能原子锁定路径；请停止并行登记修改。工具范围不会提升 Creator 权限，已连接 MCP 客户端需重连后生效。"/>
    <p>来源：{{ read.provider?.label || '未读取宿主' }}。当前工程：{{ projects.projects.find(project => project.id === read.projectId)?.name || '未选择工程' }}（{{ read.projectId || '无工程' }}）。预览目标：{{ preview?.name || '未选择预设' }}（{{ preview?.id || '无 ID' }}）。</p>
    <p>当前页面草稿：{{ drafts.active?.preset.name || '尚无草稿，请先在上方打开本地编辑器' }}。草稿留在内存；只有下列确认后的请求才会写入宿主。</p>
    <div class="write-actions">
      <el-button :disabled="!ready || !drafts.active || !preview" @click="drafts.active && write.prepareCreate(drafts.active.preset)">将当前草稿创建为正式预设</el-button>
      <el-button :disabled="!ready || !drafts.active || !preview || preview.builtIn" @click="drafts.active && write.prepareUpdate(drafts.active.preset)">用当前草稿保存到预览自定义预设</el-button>
      <el-button :disabled="!ready || !drafts.drafts.length" @click="write.prepareImport(drafts.drafts.map(item => item.preset))">将全部页面草稿导入宿主</el-button>
    </div>
    <p class="form-help">创建由宿主生成新 ID；正式导入保留 JSON ID。重名、ID 冲突、未知工具、core/full 保护、最多 20 个自定义预设和 1 MiB 上限均会检查，未通过不会发送。保存已有预设会影响所有选择该预设的工程，当前接口不提供完整关联工程列表。</p>
    <div class="write-actions"><el-input v-model="rename" maxlength="40" aria-label="正式预设新名称" placeholder="预览自定义预设的新名称" :disabled="write.locked"/><el-button :disabled="!ready || !preview || preview.builtIn || !rename.trim()" @click="write.prepareRename(rename)">改名并确认</el-button><el-button :disabled="!ready || !canAssign || !preview" @click="write.prepareAssign()">为当前工程确认分配预览范围</el-button><el-button type="danger" :disabled="!ready || !preview || preview.builtIn" @click="write.prepareDelete()">确认删除预览自定义预设</el-button><el-button type="danger" plain :disabled="!ready || !preview || preview.builtIn" @click="write.prepareDelete(true)">删除并将关联工程回退全部工具</el-button></div>
    <p>普通删除在预设被使用时由宿主拒绝。另一个删除入口会使所有关联工程回退 full（全部工具），可能扩大工具可见范围；必须另行核对和确认。原接口无法原子锁定关联工程列表，确认期间新增的关联也可能受影响。</p>
    <el-alert v-if="write.error" type="error" :closable="false" :title="write.error"/>
    <p v-if="write.notice" role="status">{{ write.notice }}</p>
    <p v-if="write.inUseProjectIds.length">宿主返回的关联工程 ID：{{ write.inUseProjectIds.join('、') }}。可逐个重新分配后刷新并准备普通删除；如需全部回退 full，请刷新后另行准备对应删除，不会自动重试。</p>
    <div v-if="review" class="write-review" role="region" aria-label="本次工具预设持久化确认">
      <h4>{{ review.title }}</h4>
      <p>固定来源：{{ review.sourceLabel }}。读取工程：{{ review.projectName || '无工程' }}（{{ review.projectId || '无工程 ID' }}）。路径：{{ review.projectPath || '不适用' }}。登记来源：{{ review.registrationLabel }}。</p>
      <p v-if="review.draftSource">待保存页面草稿来源：{{ review.draftSource.name }} · {{ review.draftSource.id }} · {{ review.draftSource.updatedAt }}。目标预设 ID 以下方确认项为准。</p>
      <p v-if="before">{{ review.operation.kind === 'create' ? '当前预览参考' : '变更前' }}：{{ before.name }} · {{ before.id }} · 基础 {{ before.baseProfile }} · 更新时间 {{ before.updatedAt }}。显式启用：[{{ before.enabled.join('、') }}]；显式禁用：[{{ before.disabled.join('、') }}]。</p>
      <p v-if="review.operation.kind === 'assign'">持久分配目标工程：{{ review.projectName }}（{{ review.operation.projectId }}）；路径：{{ review.projectPath }}。从 {{ review.operation.previous.name }}（{{ review.operation.previous.id }}）改为 {{ review.operation.preset.name }}（{{ review.operation.preset.id }}）。不会自动重连客户端或修改 Creator 权限。</p>
      <p v-if="review.operation.kind === 'update'">将覆盖以下目标 ID 的名称、基础范围和覆盖项。所有使用此预设的工程可能受影响，无法列出完整关联关系。</p>
      <p v-if="review.operation.kind === 'create'">宿主将生成新 ID；下列 ID 只是页面草稿来源，不会作为创建 ID 发送。创建后不会自动分配工程。</p>
      <p v-if="review.operation.kind === 'import'">将新增整批 {{ reviewPresets.length }} 项，保留这些 ID；原接口只返回首项回执，需要回读核对整批。</p>
      <article v-for="preset in reviewPresets" :key="preset.id"><strong>{{ preset.name }}</strong><p>ID：{{ preset.id }}；基础范围：{{ preset.baseProfile }}；更新时间：{{ preset.updatedAt }}；内置：{{ preset.builtIn ? '是' : '否' }}。</p><p>显式启用：[{{ preset.enabled.join('、') }}]；显式禁用：[{{ preset.disabled.join('、') }}]。</p></article>
      <p v-if="before">有效工具变化：新增 {{ review.added.length }} 项 [{{ review.added.join('、') }}]；移除 {{ review.removed.length }} 项 [{{ review.removed.join('、') }}]。</p>
      <p v-if="review.operation.kind === 'delete' && !resetDeletion">确认删除此自定义预设。若当前有任何工程使用它，删除将被拒绝。不会默认同意关联工程回退全部工具。</p>
      <template v-if="resetDeletion"><p>将删除上方指定预设，并使所有关联工程回退 full（全部工具）；可能扩大工具可见范围。不是只影响当前工程，当前接口不能提供或锁定完整关联清单，也不能保证与此前409返回的清单一致。原接口没有撤销；不会修改 Creator 权限或自动重连客户端。</p><el-checkbox v-model="resetConfirmed" aria-label="确认关联工程回退全部工具">我确认删除此预设，并允许所有关联工程（含确认期间新增关联）回退 full</el-checkbox></template>
      <el-checkbox v-model="confirmed" aria-label="确认本次工具预设持久化">我已核对上述固定来源、目标与全部内容，了解同宿主并发覆盖风险，确认仅执行这一次操作</el-checkbox>
      <div class="write-actions"><el-button @click="write.dismiss()">取消本次确认</el-button><el-button type="primary" :disabled="!confirmed || (resetDeletion && !resetConfirmed) || write.locked" @click="submit">确认并写入宿主一次</el-button></div>
    </div>
    <div class="write-actions"><el-button v-if="write.sending" @click="write.cancelWait()">停止等待（不保证撤销）</el-button><el-button :disabled="write.sending || write.readingBack || !toolPresetReadProvider" @click="refresh">显式刷新目录和预设</el-button><el-button :disabled="!write.attempt || write.sending || write.readingBack" :loading="write.readingBack" @click="write.readBack()">回读核对上次操作</el-button></div>
    <p v-if="write.needsRefresh">下次写入前须重新读取工具目录和预设。回读核对不会将 UNKNOWN 自动改成成功。</p>
    <div v-if="write.observation" class="write-observation"><p>本次核对的原来源：{{ write.observation.sourceLabel }}；登记来源：{{ write.observation.registrationLabel }}。</p><p>上次操作工程：{{ write.observation.projectName || '无工程名称' }}（{{ write.observation.projectId || '无工程' }}）；冻结路径：{{ write.observation.projectPath || '不适用' }}。{{ write.observation.message }}</p><p>当前回读选择：{{ write.observation.snapshot.selectedPresetId }}；预设：{{ write.observation.snapshot.presets.map(preset => `${preset.name}（${preset.id}）`).join('、') }}。</p></div>
    <div v-if="write.status === 'unknown' && write.observation"><el-checkbox v-model="recovered" aria-label="确认已人工核查未知预设操作">我已自行核查原宿主并处理未知操作，理解回读一致也不证明本次成功；允许刷新后另行准备新操作</el-checkbox><el-button :disabled="!recovered || write.sending || write.readingBack" @click="write.acknowledgeUnknown(recovered); recovered = false">结束未知结果核查</el-button></div>
  </section>
</template>
<style scoped>
.tool-preset-write-panel{margin:18px 0;padding:16px;border:1px solid #dde5ee;border-radius:10px}.tool-preset-write-panel p{line-height:1.65;overflow-wrap:anywhere}.write-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.write-actions .el-input{max-width:320px}.write-review,.write-observation{margin:14px 0;padding:14px;border:1px solid #c8d8e8;border-radius:8px;background:#f5f8fc}.write-review article{padding:10px 0;border-top:1px solid #dce5ef}.write-review .el-checkbox,.tool-preset-write-panel>.el-checkbox{height:auto;white-space:normal}.write-review :deep(.el-checkbox__label){white-space:normal;line-height:1.6}
</style>
