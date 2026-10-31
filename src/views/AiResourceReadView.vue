<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { useRegisteredProjectStore } from '../stores/registered-project'
import { useRegisteredProjectPage } from '../composables/use-registered-project-page'
import { useAiResourceEditorStore } from '../stores/ai-resource-editor'
import { useAiResourceReadStore } from '../stores/ai-resource-read'
import { aiResourceReadProvider } from '../ai-resource-read-integration'
import ArtProductionFlow from '../components/ArtProductionFlow.vue'
import { useProjectArtSpecStore } from '../stores/project-art-spec'
import ProjectArtSpecPanel from '../components/ProjectArtSpecPanel.vue'
import AiResourceConfigDialog from '../components/AiResourceConfigDialog.vue'
import { aiResourceSaveProvider } from '../ai-resource-save-integration'
import { isAiReferencePath } from '../domain/ai-resource-read'
import AiReferenceCropPanel from '../components/AiReferenceCropPanel.vue'
import { referenceCropProvider } from '../ai-reference-crop-integration'
const cropContext = computed(() => props.referenceTools && selection.project && selection.currentSource && referenceCropProvider.value && store.resource && store.provider === aiResourceReadProvider.value && store.project?.id === selection.project.id && store.project.path === selection.project.path && store.resource.projectId === selection.project.id && !store.loading && !store.error ? { projectId: selection.project.id, projectPath: selection.project.path, source: selection.currentSource, hash: store.resource.hash, provider: referenceCropProvider.value } : null)
const props = withDefaults(defineProps<{ embedded?: boolean; sharedHeader?: boolean; readOnly?:boolean; referenceTools?: boolean }>(), { embedded: false, referenceTools: false })
// The resource workflow already owns entry reads. Its embedded first step must
// not mount a second registration lifecycle or choose a different project.
const selection = useRegisteredProjectStore()
if (!props.embedded) useRegisteredProjectPage()
const store = useAiResourceReadStore(), editor = useAiResourceEditorStore()
const artSpec = useProjectArtSpecStore()
const specPanel = ref<InstanceType<typeof ProjectArtSpecPanel> | null>(null)
function readLegacy() { if (props.referenceTools && aiResourceReadProvider.value) void store.readConfig(aiResourceReadProvider.value) }
function previewReference(path: string) { if (props.referenceTools && aiResourceReadProvider.value?.referencePreviewEnabled !== false && isAiReferencePath(path)) void store.readPreview(path) }
defineExpose({ openEditor: () => specPanel.value?.openEditor() })
const editorDialog = ref<InstanceType<typeof AiResourceConfigDialog> | null>(null)
const editorContext = computed(() => store.project && selection.project && selection.currentSource
  && store.project.id === selection.project.id && store.project.path === selection.project.path
  ? { project: store.project, source: selection.currentSource } : null)
const saved = computed(() => store.resource?.config)
watch([() => selection.project, () => selection.currentSource], () => {
  store.setContext(selection.project, selection.currentSource)
}, { immediate: true, flush: 'sync' })
watch(aiResourceReadProvider, next => { if (store.provider && store.provider !== next) store.invalidateProvider() }, { flush: 'sync' })
function refreshAfterSave() {
  const context = editorContext.value, reader = aiResourceReadProvider.value, artContext = artSpec.context, artWriter = artSpec.provider
  if (editor.phase !== 'saved' || !editor.contextValid || !context || !reader || editor.project?.id !== context.project.id || editor.project.path !== context.project.path) return
  const current = () => editorContext.value?.project.id === context.project.id && editorContext.value.project.path === context.project.path && editorContext.value.source === context.source && aiResourceReadProvider.value === reader && store.provider === reader && store.project?.id === context.project.id && store.project.path === context.project.path
  void store.readConfig(reader).then(() => {
    // A cancelled/late read from A cannot start a new specification read for B.
    if (current() && !store.error && store.resource?.projectId === context.project.id && artContext && artSpec.context === artContext && artSpec.provider === artWriter && artContext.projectId === context.project.id && artContext.projectPath === context.project.path && artContext.source === context.source) void artSpec.read()
  })
}
// The persistent workspace owns its context; standalone legacy views still cancel on disposal.
onBeforeUnmount(() => { if (!props.sharedHeader) store.disconnect() })
</script>
<template>
  <section class="ai-resource-read">
    <details v-if="props.referenceTools" class="art-reference-tools" data-testid="art-reference-tools">
      <summary>已保存参考图与旧版兼容</summary>
      <p v-if="!selection.project" role="status">请先选择已登记工程。</p>
      <p v-else class="reference-project">{{ selection.project.name }} · {{ selection.project.id }}<br>{{ selection.project.path }}</p>
      <div class="ai-read-actions"><el-button aria-label="读取已保存参考图列表" :disabled="!store.project || !aiResourceReadProvider || store.loading" :loading="store.loading" @click="readLegacy">读取 / 刷新参考图</el-button><el-button v-if="store.loading || store.previewLoading" @click="store.clearReads">取消读取</el-button></div>
      <p v-if="store.loading" role="status">正在读取已保存参考图列表…</p>
      <p v-if="store.error" class="ai-config-error" role="alert">{{ store.error }}</p>
      <p v-if="!store.resource && !store.loading && !store.error" class="ai-read-empty">尚未读取已保存参考图；不会自动读取。</p>
      <template v-if="store.resource">
        <p v-if="store.resource.state === 'missing'" role="status">未发现旧版配置。建议草稿未保存，不作为已保存参考图。</p>
        <template v-else>
          <p v-if="store.resource.migrationRequired" role="status">旧 v1 · 需要显式迁移。原配置与尺寸记录保留。</p>
          <p v-else-if="store.resource.state === 'invalid'" role="status">已保存配置需要核对；原文件保持不变。</p>
          <p v-else>已保存参考图 · v{{ store.resource.version }}</p>
          <ul v-if="store.resource.issues.length" aria-label="配置校验问题"><li v-for="(issue,index) in store.resource.issues" :key="index">{{ issue.field }} · {{ issue.code }}</li></ul>
          <template v-if="saved?.schemaVersion === 'project-resource-config-v1'"><p v-for="preset in saved.iconPresets" :key="preset.id">{{ preset.label }} · {{ preset.displaySize.width }} × {{ preset.displaySize.height }}</p></template>
          <el-button v-if="store.resource.migrationRequired" :disabled="store.loading || !editorContext" @click="editorDialog?.open()">转换旧版图标配置</el-button>
          <p v-if="!store.references.length">此配置没有已保存参考图。</p>
          <ul v-else class="ai-reference-list"><li v-for="path in store.references" :key="path"><span>{{ path }}</span><el-button :disabled="aiResourceReadProvider?.referencePreviewEnabled === false || store.loading || store.previewLoading || !isAiReferencePath(path)" @click="previewReference(path)">预览此参考</el-button><small v-if="!isAiReferencePath(path)">旧参考路径不符合当前安全预览规则，保留记录但不可读取。</small></li></ul>
          <p v-if="aiResourceReadProvider?.referencePreviewEnabled === false" class="reference-note">当前未启用参考预览，不调用后台 Python。</p>
        </template>
      </template>
      <section v-if="store.previewPath" class="reference-preview" aria-live="polite"><div class="ai-read-actions"><strong>参考图预览</strong><el-button @click="store.clearPreview">关闭预览</el-button></div><p v-if="store.previewLoading" role="status">正在核对图片…</p><p v-if="store.previewError" role="alert">{{ store.previewError }}</p><template v-if="store.preview"><img class="ai-reference-preview" :src="`data:image/png;base64,${store.preview.base64}`" alt="已核对 SHA 的工程参考图" @error="store.previewDisplayFailed"/><p class="reference-note">{{ store.preview.width }} × {{ store.preview.height }} · SHA-256 {{ store.preview.sha256 }}</p></template></section>
      <AiReferenceCropPanel :context="cropContext"/>
    </details>
    <ArtProductionFlow v-else-if="!props.embedded"/>
    <template v-else>
      <ProjectArtSpecPanel :read-only="props.readOnly" ref="specPanel" :shared-header="props.sharedHeader" :project="selection.project" :source="selection.currentSource" :legacy="saved?.schemaVersion === 'project-resource-config-v2' ? saved : null"/>
    </template>
    <AiResourceConfigDialog ref="editorDialog" :context="editorContext" :resource="store.resource" :reader="aiResourceReadProvider" :writer="aiResourceSaveProvider" @saved="refreshAfterSave"/>
  </section>
</template>
<style scoped>
.ai-resource-read{display:grid;gap:18px}.ai-read-actions{display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-top:18px}.ai-read-actions label{display:grid;gap:7px;min-width:270px;max-width:100%}.ai-read-identity{display:grid;grid-template-columns:140px minmax(0,1fr);gap:8px;margin:20px 0}.ai-read-identity dt,.ai-read-grid span{color:var(--text-secondary,#637187)}.ai-read-identity dd{margin:0;overflow-wrap:anywhere}.ai-read-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px;margin:20px 0}.ai-read-grid div{display:grid;gap:8px;overflow-wrap:anywhere}.ai-read-style{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:var(--background,#f7f9fc);border-radius:10px}.ai-reference-list{padding:0;list-style:none;display:grid;gap:10px}.ai-reference-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;overflow-wrap:anywhere}.ai-reference-preview{display:block;max-width:100%;max-height:480px;object-fit:contain;border:1px solid #dfe5ed}.ai-read-draft{padding:16px;border:1px solid #e6eaf0;border-radius:10px}.ai-read-draft summary{cursor:pointer}.ai-read-empty{padding:20px;color:#637187}.section-card p{line-height:1.7;overflow-wrap:anywhere}@media(max-width:600px){.ai-read-identity{grid-template-columns:1fr}.ai-read-identity dd{margin-bottom:6px}.ai-reference-list li{align-items:start;flex-direction:column}.ai-read-actions label{min-width:0;width:100%}}
</style>

<style scoped>.ai-icon-project-picker{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap}.ai-icon-project-picker label{display:grid;gap:7px;min-width:270px;max-width:100%}.ai-icon-project-picker a{font-size:13px}.ai-icon-config>summary{cursor:pointer;font-weight:600}.ai-icon-config>summary+section{margin-top:14px}.ai-icon-config>.section-card{border:0;padding:12px 0;box-shadow:none}.ai-icon-config .section-heading p{font-size:12px;color:var(--el-text-color-secondary)}@media(max-width:600px){.ai-icon-project-picker label{min-width:0;width:100%}}</style>

<style scoped>.ai-status-read-actions{margin-top:0;gap:6px}.ai-status-read-actions :deep(.el-button){margin-left:0}</style>

<style scoped>.art-reference-tools>summary{cursor:pointer;font-weight:600}.art-reference-tools>summary+*{margin-top:12px}.reference-project,.reference-note{font-size:12px;color:var(--el-text-color-secondary);overflow-wrap:anywhere}.reference-preview{display:grid;gap:8px;margin-top:14px}.art-reference-tools .ai-read-empty{padding:10px 0}.reference-preview p{margin:0}</style>
