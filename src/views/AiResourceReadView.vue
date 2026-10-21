<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { useRegisteredProjectPage } from '../composables/use-registered-project-page'
import { useAiResourceEditorStore } from '../stores/ai-resource-editor'
import { useAiResourceReadStore } from '../stores/ai-resource-read'
import { aiResourceReadProvider } from '../ai-resource-read-integration'
import ArtStatusBar from '../components/ArtStatusBar.vue'
import AiResourceConfigDialog from '../components/AiResourceConfigDialog.vue'
import AiTaskCreationPanel from '../components/AiTaskCreationPanel.vue'
import { aiTaskCreationProvider } from '../ai-task-creation-integration'
import AiJobsReadPanel from '../components/AiJobsReadPanel.vue'
import { aiResourceSaveProvider } from '../ai-resource-save-integration'
import { isAiProjectId, isAiReferencePath } from '../domain/ai-resource-read'
const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })
// The resource workflow already owns entry reads. Its embedded first step must
// not mount a second registration lifecycle or choose a different project.
const selection = useRegisteredProjectStore()
if (!props.embedded) useRegisteredProjectPage()
const directory = selection.directory, store = useAiResourceReadStore(), editor = useAiResourceEditorStore()
const route = useRoute(), router = useRouter()
const projects = computed(() => selection.projects.filter(project => isAiProjectId(project.id)))
const selectedId = computed({
  get: () => selection.project?.id ?? '',
  set: (value: string) => {
    selection.restoreRouteProject(value)
    const query = { ...route.query, project: value || undefined }
    void router.push({ path: route.path, query })
  },
})
const jobsPanel = ref<InstanceType<typeof AiJobsReadPanel> | null>(null)
const configDirty = computed(() => !!editor.project && editor.project.id === selection.project?.id && editor.project.path === selection.project?.path
  && (editor.dirty || editor.busy || !!editor.pendingFence))
const editorDialog = ref<InstanceType<typeof AiResourceConfigDialog> | null>(null)
const editorContext = computed(() => store.project && selection.project && selection.currentSource
  && store.project.id === selection.project.id && store.project.path === selection.project.path
  ? { project: store.project, source: selection.currentSource } : null)
const resourcesLink = computed(() => ({ path: '/resources', query: { ...(selection.project ? { project: selection.project.id } : {}), step: 1 } }))
const aiIconsLink = computed(() => ({ path: '/ai-icons', query: selection.project ? { project: selection.project.id } : {} }))
const saved = computed(() => store.resource?.config)
const draft = computed(() => store.resource?.draft)
const size = (value: { width: number; height: number }) => value.width > 0 && value.height > 0 ? `${value.width} × ${value.height}` : '待填写'
const orientation = { portrait: '竖屏', landscape: '横屏', square: '方形' }
const stateLabels = { valid: '已保存 · 配置有效', missing: '工程尚无资源配置', invalid: '已保存配置不可直接使用' }
watch([() => selection.project, () => selection.currentSource], () => {
  store.setContext(selection.project, selection.currentSource)
}, { immediate: true, flush: 'sync' })
watch(aiResourceReadProvider, next => { if (store.provider && store.provider !== next) store.invalidateProvider() }, { flush: 'sync' })
function refreshAfterSave() {
  // A late completion from A must never refresh or present a save as B's.
  if (editor.phase === 'saved' && editor.contextValid && editorContext.value && aiResourceReadProvider.value
    && editor.project?.id === store.project?.id && editor.project?.path === store.project?.path) void store.readConfig(aiResourceReadProvider.value)
}
onBeforeUnmount(() => store.disconnect())
</script>
<template>
  <section class="ai-resource-read">
    <ArtStatusBar v-if="!props.embedded" :jobs="jobsPanel?.readStatusSnapshot ?? null"><div class="ai-read-actions ai-status-read-actions"><el-button aria-label="读取工程规范" type="primary" :disabled="!store.project || !aiResourceReadProvider || store.loading" :loading="store.loading" @click="aiResourceReadProvider && store.readConfig(aiResourceReadProvider)">读取 / 刷新工程规范</el-button><el-button v-if="store.loading || store.previewLoading" @click="store.clearReads">取消读取</el-button><el-button v-if="store.resource" @click="store.clearReads">清空读取结果</el-button></div></ArtStatusBar>
    <el-alert v-if="!props.embedded && store.error" class="ai-config-error" type="error" :closable="false" :title="store.error"/>
    <div v-if="!props.embedded" class="ai-icon-project-picker"><label v-if="!props.embedded">已读取登记工程<el-select v-model="selectedId" aria-label="AI 规范目标工程" placeholder="请选择工程" clearable><el-option v-for="project in projects" :key="project.id" :value="project.id" :label="`${project.name} · ${project.id}`"/></el-select></label><RouterLink :to="resourcesLink">游戏资源与规范</RouterLink></div>
    <AiTaskCreationPanel compact v-if="!props.embedded && aiTaskCreationProvider" :project="selection.project" :source="selection.currentSource" :config-dirty="configDirty" @created="payload => jobsPanel?.readCreatedTask(payload)"/>
    <AiJobsReadPanel compact v-if="!props.embedded" ref="jobsPanel" :project="selection.project" :source="selection.currentSource"/>
    <details class="ai-icon-config section-card" :open="props.embedded"><summary>工程规范与参考图</summary>
    <section class="section-card">
      <div class="section-heading"><div><h2>{{ props.embedded ? '工程已保存规范' : '工程资源规范' }}</h2><p>核对当前登记工程的已保存配置与参考图。新建、迁移和编辑共用同一配置弹窗。</p></div><RouterLink v-if="props.embedded" :to="aiIconsLink">打开 AI 图标</RouterLink><RouterLink v-else :to="resourcesLink">返回游戏资源 · 项目规范</RouterLink></div>
      <el-alert v-if="!aiResourceReadProvider" type="info" :closable="false" title="当前宿主未接入原 Companion AI 读取接口" description="请通过原 Companion 同源工程服务打开；读取能力以当前实际连接为准。"/>
      <p v-if="!directory.connected"><RouterLink to="/projects">先到工程页读取真实登记</RouterLink>，再选择目标工程。工程登记以实际读取结果为准，不加载示例。</p>
      <div v-if="props.embedded" class="ai-read-actions"><el-button aria-label="读取工程规范" type="primary" :disabled="!store.project || !aiResourceReadProvider || store.loading" :loading="store.loading" @click="aiResourceReadProvider && store.readConfig(aiResourceReadProvider)">读取 / 刷新工程规范</el-button><el-button v-if="store.loading || store.previewLoading" @click="store.clearReads">取消读取</el-button><el-button v-if="store.resource" @click="store.clearReads">清空读取结果</el-button></div>
      <p v-if="selection.requestedId && !selection.project" class="form-help">所选工程不可用，请重新选择已登记工程；未把其他工程作为替代。</p>
      <p v-if="selection.project && !isAiProjectId(selection.project.id)" class="form-help">当前登记 ID 不符合已核验的规范读取合同，未发起查询。</p>
      <dl v-if="store.project" class="ai-read-identity"><dt>工程</dt><dd>{{ store.project.name }}</dd><dt>完整 ID</dt><dd>{{ store.project.id }}</dd><dt>工程路径</dt><dd>{{ store.project.path }}</dd></dl>
      <el-button v-if="editor.draft && !editor.isOpen" @click="editorDialog?.showRetained()">查看保留的编辑草稿</el-button><p v-if="editor.draft && !editor.isOpen">保留内容仍绑定原工程。查看不会恢复写入权限；请先核对原工程或明确放弃草稿。</p>
      <p class="form-help">读取与保存分别执行；编辑后须核对差异并逐次确认。不会启动模型、GPU 或 Creator。{{ aiResourceReadProvider?.referencePreviewEnabled === false ? '此只读预览未启用参考图处理，不调用后台 Python；已保存参考路径仍可查看。' : '参考预览由原后台启动本地 Python，用 CPU 归一化并返回内存 PNG。' }}</p>
    </section>
    <el-alert v-if="props.embedded && store.error" type="error" :closable="false" :title="store.error"/>
    <section v-if="store.resource" class="section-card" aria-live="polite">
      <div class="section-heading"><h2>{{ stateLabels[store.resource.state] }}</h2><el-tag :type="store.resource.state === 'valid' ? 'success' : 'warning'">{{ store.resource.migrationRequired ? '旧 v1 · 需要显式迁移' : '原文件读取结果' }}</el-tag></div>
      <dl class="ai-read-identity"><dt>配置文件</dt><dd>{{ store.resource.relativePath }}</dd><dt>已保存版本</dt><dd>{{ store.resource.version ?? '无已验证版本' }}</dd><dt>文件 SHA-256</dt><dd>{{ store.resource.hash ?? '尚无文件' }}</dd><dt>本次读取时间</dt><dd>{{ store.observedAt }}</dd></dl>
      <el-alert v-if="store.resource.migrationRequired" type="warning" :closable="false" title="旧多尺寸配置只读保留，尚未迁移成默认单尺寸"/>
      <el-button :disabled="store.loading || !store.project" @click="editorDialog?.open()">{{ store.resource.state === 'missing' ? '新建配置' : store.resource.migrationRequired ? '迁移旧版配置' : '编辑配置' }}{{ aiResourceSaveProvider ? ' · 核对后保存' : ' · 仅预览' }}</el-button><p>已保存摘要不会因编辑而变化；表单与保存回执在同一弹窗核对。</p>
      <ul v-if="store.resource.issues.length" aria-label="配置校验问题"><li v-for="(issue,index) in store.resource.issues" :key="index">{{ issue.field }} · {{ issue.code }}</li></ul>
      <template v-if="saved">
        <h3>已保存内容</h3><div class="ai-read-grid"><div><span>设计画布</span><strong>{{ size(saved.designResolution) }} · {{ orientation[saved.orientation] }}</strong></div><div v-if="saved.schemaVersion === 'project-resource-config-v2'"><span>默认单图成品</span><strong>{{ size(saved.iconSize) }}</strong></div><div><span>母图 / 格式</span><strong>1024 × 1024 · PNG</strong></div><div><span>背景</span><strong>{{ saved.background.transparent ? '透明' : saved.schemaVersion === 'project-resource-config-v2' ? saved.background.color : '未返回' }}</strong></div><div><span>构图</span><strong>居中 · 留白 {{ saved.composition.paddingPercent }}%</strong></div><div><span>Creator 目录</span><strong>{{ saved.destination.directory }}</strong></div><div v-if="saved.schemaVersion === 'project-resource-config-v2'"><span>本地尺寸导出目录</span><strong>{{ saved.destination.exportDirectory }}</strong></div></div>
        <p class="ai-read-style">{{ saved.style.description }}</p>
        <ul v-if="saved.schemaVersion === 'project-resource-config-v1'" aria-label="旧尺寸预设"><li v-for="preset in saved.iconPresets" :key="preset.id">{{ preset.label }} · {{ preset.id }} · {{ size(preset.displaySize) }}</li></ul>
        <h3>已保存参考图</h3><p>这里只预览该次已保存配置列出的相对路径。上传请进入配置弹窗单独确认；上传成功后仍需另行保存配置。预览不是原任务封存证据，参考不作为模型图像输入。</p>
        <p v-if="!store.references.length">此配置没有参考图。</p><ul class="ai-reference-list"><li v-for="path in store.references" :key="path"><span>{{ path }}</span><el-button :disabled="aiResourceReadProvider?.referencePreviewEnabled === false || store.loading || store.previewLoading || !isAiReferencePath(path)" @click="store.readPreview(path)">预览此参考</el-button><small v-if="!isAiReferencePath(path)">旧参考路径不符合当前安全预览规则，保留记录但不可读取。</small></li></ul>
      </template>
      <p v-else>没有可展示的已保存配置内容；后台建议草稿未保存，不会把后台建议值当成已写入规范。</p>
      <details v-if="draft" class="ai-read-draft"><summary>后台建议草稿（未保存，不用于生成）</summary><p>默认或按工程设置修正的建议，仅供核对。创建与编辑共用同一弹窗；当前内容不会自动保存。</p><dl class="ai-read-identity"><dt>设计画布</dt><dd>{{ size(draft.designResolution) }}</dd><dt>建议单图尺寸</dt><dd>{{ size(draft.iconSize) }}</dd><dt>风格</dt><dd>{{ draft.style.description || '待填写' }}</dd><dt>导入 / 导出目录</dt><dd>{{ draft.destination.directory }} / {{ draft.destination.exportDirectory }}</dd></dl></details>
      <h3>工程检测与能力边界</h3><p>检测画布：{{ store.resource.detected.designResolution ? size(store.resource.detected.designResolution) : '未检测到' }} · 来源：{{ store.resource.detected.designSource ?? '未返回' }}</p><p>可见资源目录：{{ store.resource.detected.resourceDirectories.join('、') || '未检测到' }}</p><p>Owner 资产保持保护，禁止覆盖已有资产；配置保存使用原文件 hash 防止覆盖并发修改。参考上传与配置保存分别确认，上传不等于配置已保存。配置有效不等于生成、视觉批准或运行验收通过。</p>
    </section>
    <section v-if="store.previewPath" class="section-card" aria-live="polite"><div class="section-heading"><h3>参考预览 · {{ store.previewPath }}</h3><el-button @click="store.clearPreview">关闭预览</el-button></div><p v-if="store.previewLoading">正在读取本地参考图…</p><el-alert v-if="store.previewError" type="error" :closable="false" :title="store.previewError"/><template v-if="store.preview"><img class="ai-reference-preview" :src="`data:image/png;base64,${store.preview.base64}`" alt="工程已保存参考的当前预览" @error="store.previewDisplayFailed"/><p>{{ store.preview.width }} × {{ store.preview.height }} · PNG · SHA-256 {{ store.preview.sha256 }}</p></template></section>
    <p v-if="!store.resource && !store.loading && !store.error" class="ai-read-empty">尚未读取工程规范。没有用本地草稿或示例替代真实配置。</p>
    <section v-if="!props.embedded" class="section-card"><h3>资源生产六步</h3><p>配置新建、v1 迁移、v2 编辑和参考上传使用当前工程服务，每次写入独立确认。下方可读取原任务、状态和候选。正常工作区按原一图流程准备任务、批准执行、审阅选择和导入；尺寸导出与Creator运行验收分别核对。保存结果未知时须回读核对，不能直接重发。</p><RouterLink :to="resourcesLink">查看当前工程的资源步骤</RouterLink></section>
    </details>
    <AiResourceConfigDialog ref="editorDialog" :context="editorContext" :resource="store.resource" :reader="aiResourceReadProvider" :writer="aiResourceSaveProvider" @saved="refreshAfterSave"/>
  </section>
</template>
<style scoped>
.ai-resource-read{display:grid;gap:18px}.ai-read-actions{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-top:18px}.ai-read-actions label{display:grid;gap:7px;min-width:270px;max-width:100%}.ai-read-identity{display:grid;grid-template-columns:140px minmax(0,1fr);gap:8px;margin:20px 0}.ai-read-identity dt,.ai-read-grid span{color:var(--text-secondary,#637187)}.ai-read-identity dd{margin:0;overflow-wrap:anywhere}.ai-read-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px;margin:20px 0}.ai-read-grid div{display:grid;gap:8px;overflow-wrap:anywhere}.ai-read-style{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:var(--background,#f7f9fc);border-radius:10px}.ai-reference-list{padding:0;list-style:none;display:grid;gap:10px}.ai-reference-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;overflow-wrap:anywhere}.ai-reference-preview{display:block;max-width:100%;max-height:480px;object-fit:contain;border:1px solid #dfe5ed}.ai-read-draft{padding:16px;border:1px solid #e6eaf0;border-radius:10px}.ai-read-draft summary{cursor:pointer}.ai-read-empty{padding:20px;color:#637187}.section-card p{line-height:1.7;overflow-wrap:anywhere}@media(max-width:600px){.ai-read-identity{grid-template-columns:1fr}.ai-read-identity dd{margin-bottom:6px}.ai-reference-list li{align-items:start;flex-direction:column}.ai-read-actions label{min-width:0;width:100%}}
</style>

<style scoped>.ai-icon-project-picker{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap}.ai-icon-project-picker label{display:grid;gap:7px;min-width:270px;max-width:100%}.ai-icon-project-picker a{font-size:13px}.ai-icon-config>summary{cursor:pointer;font-weight:600}.ai-icon-config>summary+section{margin-top:14px}.ai-icon-config>.section-card{border:0;padding:12px 0;box-shadow:none}.ai-icon-config .section-heading p{font-size:12px;color:var(--el-text-color-secondary)}@media(max-width:600px){.ai-icon-project-picker label{min-width:0;width:100%}}</style>

<style scoped>.ai-status-read-actions{margin-top:0;gap:6px}.ai-status-read-actions :deep(.el-button){margin-left:0}</style>
