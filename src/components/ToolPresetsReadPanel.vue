<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ToolPresetDraftPanel from './ToolPresetDraftPanel.vue'
import ToolPresetWritePanel from './ToolPresetWritePanel.vue'
import { toolPresetWriteProvider } from '../tool-presets-write-integration'
import { toolPresetReadProvider } from '../tool-presets-read-integration'
import { useToolPresetsReadStore } from '../stores/tool-presets-read'
import { useCompanionBrowserStore } from '../stores/companion-browser'
const store = useToolPresetsReadStore(), projects = useCompanionBrowserStore()
const query = ref(''), profile = ref('all'), collapsed = ref<Record<string, boolean>>(Object.create(null)), downloadNotice = ref('')
const registered = computed(() => projects.connected ? projects.projects : [])
const previewLabel = computed(() => store.preview?.name ?? '尚未读取')
const groups = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  const visible = store.tools.filter(tool => (profile.value === 'all' || tool.profile === profile.value) && [tool.name, tool.displayNameZh, tool.description, tool.scope].join('\n').toLocaleLowerCase().includes(search))
  return [...new Set(visible.map(tool => tool.scope))].sort().map(scope => ({ scope, tools: visible.filter(tool => tool.scope === scope) }))
})
function changeProject(id: string) { store.setProjectContext(id, registered.value.map(project => project.id)) }
watch(registered, list => { if (store.projectId && !list.some(project => project.id === store.projectId)) changeProject('') }, { flush: 'sync', immediate: true })
watch(toolPresetReadProvider, next => { if (store.provider && store.provider !== next) store.disconnect() }, { flush: 'sync', immediate: true })
watch(() => [store.projectId, store.previewPresetId, store.provider], () => { downloadNotice.value = '' }, { flush: 'sync' })
async function download() {
  downloadNotice.value = ''
  const prepared = await store.exportCurrent()
  if (!prepared || !store.isPreparedCurrent(prepared)) return
  let url: string | undefined
  try {
    url = URL.createObjectURL(new Blob([prepared.json], { type: 'application/json;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = prepared.filename; anchor.click()
    downloadNotice.value = '已请求浏览器下载经过校验的预设 JSON；请检查下载结果。没有分配或保存到工程。'
  } catch { downloadNotice.value = '浏览器下载未完成，可重新导出；没有改写工程范围。' }
  finally { if (url) URL.revokeObjectURL(url) }
}
onBeforeUnmount(() => store.cancelReads())
</script>
<template>
 <section class="tool-presets-read-panel" data-testid="tool-presets-read-panel">
  <h3>真实工具目录与预设查看</h3>
  <p v-if="!toolPresetWriteProvider" class="form-help">与宿主交互仅读取目录与范围，可导出单个预设 JSON。选择下拉仅改变本地预览，没有分配、保存、导入、删除或注册请求。工具范围不会提升 Creator 权限，也不证明已连接 MCP 客户端的即时工具集合。目录与预设分别读取，都是当次快照，变更后需刷新。</p>
  <p v-else class="form-help">目录和范围按需读取，选择下拉仅改变预览。克隆、编辑、导入准备后可在下方逐次确认正式保存与工程分配；工具范围不会提升 Creator 权限。目录和预设分别读取，都是当次快照，变更后需刷新。</p>
  <div class="planner-import-actions"><el-button :disabled="!toolPresetReadProvider" :loading="store.toolsLoading" @click="store.loadTools(toolPresetReadProvider!)">读取 / 刷新工具目录</el-button><el-button :disabled="!store.provider" @click="store.disconnect()">断开工具读取</el-button><span>{{ store.toolsRead?`${store.tools.length} 项已读取`:'工具数量未读取' }}</span></div>
  <p v-if="!toolPresetReadProvider" class="form-help">此构建未注册 Companion 工具读取；需原 Cookie 会话同源宿主。图片审阅连接不提供工具权限。</p>
  <el-alert v-if="store.toolsError" :title="store.toolsError" type="error" :closable="false"/>
  <div class="companion-filters"><el-select :model-value="store.projectId" aria-label="工具范围工程" @change="changeProject"><el-option label="无工程：原默认范围" value=""/><el-option v-for="project in registered" :key="project.id" :label="project.name" :value="project.id"/></el-select><el-button :disabled="!store.provider" :loading="store.presetsLoading" @click="store.loadPresets()">读取登记范围</el-button><RouterLink to="/projects">先读取真实工程列表</RouterLink></div>
  <p class="form-help">{{ store.projectId?'查询此工程返回的范围（可能为默认全部）；不证明已显式保存或运行生效。':'无工程上下文返回的是后端默认范围，不是任何工程的登记或运行证据。' }}</p>
  <el-alert v-if="store.presetsError" :title="store.presetsError" type="error" :closable="false"/>
  <div v-if="store.presetsRead" class="tool-preset-preview"><p>服务返回的当前范围：{{ store.presets.find(preset=>preset.id===store.selectedPresetId)?.name }}（ID：{{ store.selectedPresetId }}）。本地预览：{{ previewLabel }}。</p><div class="planner-import-actions"><el-select :model-value="store.previewPresetId" aria-label="只读预览预设" @change="store.selectPreview"><el-option v-for="preset in store.presets" :key="preset.id" :label="`${preset.name}（${preset.builtIn?'内置':'自定义'} / 基于${preset.baseProfile}）`" :value="preset.id"/></el-select><el-button :loading="store.exportLoading" :disabled="!store.preview||!!store.scope.error||store.toolsLoading" @click="download">导出当前预览 JSON</el-button></div><p class="form-help">内置范围导出为新的自定义副本，不会保存到服务器。{{ store.scope.names?`预览启用 ${store.scope.names.size} / ${store.tools.length} 项`:'有效工具范围未核验，需成功读取匹配目录。' }}</p><p v-if="store.preview" class="form-help">预设 ID：{{ store.preview.id }}；更新时间：{{ store.preview.updatedAt }}；显式启用 {{ store.preview.enabled.length }}，显式禁用 {{ store.preview.disabled.length }}。</p></div>
  <el-alert v-if="store.scope.error" :title="store.scope.error" type="warning" :closable="false"/><el-alert v-if="store.exportError" :title="store.exportError" type="error" :closable="false"/><p v-if="downloadNotice" role="status">{{ downloadNotice }}</p>
  <ToolPresetDraftPanel/>
  <ToolPresetWritePanel v-if="toolPresetWriteProvider"/>
  <div class="companion-filters"><el-input v-model="query" aria-label="搜索工具目录" placeholder="名称、中文名、说明或分类" :maxlength="256"/><el-select v-model="profile" aria-label="工具目录 profile 筛选"><el-option label="全部工具目录" value="all"/><el-option label="core 目录标签" value="core"/><el-option label="full 目录标签" value="full"/></el-select></div>
  <p class="form-help">下方 read / write 是原目录按名称生成的标签，不是权限或安全保证。未启用项仍展示；搜索与 profile 筛选是本地显示条件。</p>
  <section v-for="group in groups" :key="group.scope" class="tool-catalog-group"><button class="information-link" :aria-expanded="!collapsed[group.scope]" @click="collapsed[group.scope]=!collapsed[group.scope]">{{ group.scope }} · {{ group.tools.length }} 项{{ collapsed[group.scope]?'（展开）':'（收起）' }}</button><div v-if="!collapsed[group.scope]"><article v-for="tool in group.tools" :key="tool.name" class="companion-project-card"><div class="section-heading"><strong>{{ tool.displayNameZh }}</strong><span>{{ tool.profile }} · {{ tool.access }}（原目录标签） · {{ store.scope.names?(store.scope.names.has(tool.name)?'预览启用':'预览未启用'):'范围未知' }}</span></div><code>{{ tool.name }}</code><p>{{ tool.description }}</p></article></div></section>
  <el-empty v-if="!groups.length" :description="store.toolsRead?'当前显示条件没有工具':'尚未读取工具目录，没有示例工具或默认全开推断'"/>
 </section>
</template>
