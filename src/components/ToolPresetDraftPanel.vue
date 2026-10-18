<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useToolPresetsReadStore } from '../stores/tool-presets-read'
import { useToolPresetDraftsStore } from '../stores/tool-preset-drafts'
import { toolPresetReadProvider } from '../tool-presets-read-integration'
import { effectiveToolNames } from '../domain/tool-presets-read'
import type { ToolProfile } from '../domain/tool-presets-read'
const read = useToolPresetsReadStore(), drafts = useToolPresetDraftsStore()
const opened = ref(false), query = ref(''), importText = ref(''), importPending = ref(false), importError = ref(''), replaceConfirmed = ref(false), restoreConfirmed = ref(false), downloadNotice = ref('')
let importEpoch = 0
function syncSource() {
  drafts.syncContext({ provider: read.provider === toolPresetReadProvider.value ? read.provider : null, projectId: read.projectId,
    tools: read.tools, presets: read.presets, toolsReady: read.toolsRead, presetsReady: read.presetsRead, loading: read.toolsLoading || read.presetsLoading })
}
watch([() => read.provider, () => read.projectId, () => read.tools, () => read.presets, () => read.toolsRead, () => read.presetsRead, () => read.toolsLoading, () => read.presetsLoading, toolPresetReadProvider], syncSource, { deep: true, immediate: true, flush: 'sync' })
watch([() => drafts.revision, () => drafts.contextRevision], () => { replaceConfirmed.value = false; restoreConfirmed.value = false; downloadNotice.value = ''; importEpoch++; importPending.value = false }, { flush: 'sync' })
const active = computed(() => drafts.active)
const visibleTools = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return read.toolsRead ? read.tools.filter(tool => [tool.name, tool.displayNameZh, tool.scope].join('\n').toLocaleLowerCase().includes(search)) : []
})
const collapsedScopes = ref<Record<string, boolean>>(Object.create(null))
const effectiveNames = computed(() => {
  if (!active.value || !read.toolsRead || read.toolsLoading || read.presetsLoading || !read.provider || read.provider !== toolPresetReadProvider.value) return null
  try {
    const known = new Set(read.tools.map(tool => tool.name)), preset = active.value.preset
    // Count only known catalog members; retain unknown overrides in the actual draft.
    return effectiveToolNames({ ...preset, enabled: preset.enabled.filter(name => known.has(name)), disabled: preset.disabled.filter(name => known.has(name)) }, read.tools)
  } catch { return null }
})
const toolGroups = computed(() => [...new Set(visibleTools.value.map(tool => tool.scope))].sort().map(scope => {
  const all = read.tools.filter(tool => tool.scope === scope)
  return { scope, tools: visibleTools.value.filter(tool => tool.scope === scope), total: all.length,
    selected: effectiveNames.value ? all.filter(tool => effectiveNames.value!.has(tool.name)).length : null }
}))
const unknownOverrides = computed(() => active.value ? [...active.value.preset.enabled, ...active.value.preset.disabled].filter(name => !read.toolsRead || !read.tools.some(tool => tool.name === name)) : [])
function mode(name: string) { const preset = active.value?.preset; return preset?.enabled.includes(name) ? 'enabled' : preset?.disabled.includes(name) ? 'disabled' : 'default' }
function open() { opened.value = true; syncSource() }
function close() { opened.value = false; importEpoch++; importPending.value = false; replaceConfirmed.value = false; restoreConfirmed.value = false; drafts.clearImport(); drafts.invalidateContext(); downloadNotice.value = '' }
function textChanged(value: string) { importEpoch++; importPending.value = false; importError.value = ''; replaceConfirmed.value = false; drafts.clearImport(); importText.value = value }
async function readFile(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]; input.value = ''
  textChanged(''); if (!file) return
  if (file.size < 1 || file.size > 1_048_576) { importError.value = '请选择不超过 1 MiB 的预设 JSON；没有替换当前页面草稿。'; return }
  const identity = importEpoch; importPending.value = true
  try { const text = await file.text(); if (identity !== importEpoch || !opened.value) return; importText.value = text }
  catch { if (identity === importEpoch) importError.value = '文件读取失败，原页面草稿与备份未改变；未复用上一次候选。' }
  finally { if (identity === importEpoch) importPending.value = false }
}
function parseImport() { if (importPending.value || !importText.value) return; replaceConfirmed.value = false; drafts.prepareImport(importText.value) }
function applyImport() { if (importPending.value || !drafts.preparedImport) return; drafts.applyImport(drafts.preparedImport, replaceConfirmed.value); replaceConfirmed.value = false }
async function download() {
  downloadNotice.value = ''
  const prepared = drafts.prepareExport(); if (!prepared) return
  await nextTick(); if (!opened.value || !drafts.isPreparedCurrent(prepared)) return
  let url: string | undefined
  try {
    url = URL.createObjectURL(new Blob([prepared.json], { type: 'application/json;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = prepared.filename
    if (!opened.value || !drafts.isPreparedCurrent(prepared)) return
    anchor.click()
    if (drafts.isPreparedCurrent(prepared)) downloadNotice.value = '已请求浏览器下载本地预设草稿 JSON，请检查下载结果。没有写回宿主、分配工程或改变 MCP 权限。'
  } catch { downloadNotice.value = '浏览器下载未完成，页面草稿仍保留；没有写入宿主。' }
  finally { if (url) URL.revokeObjectURL(url) }
}
onBeforeUnmount(close)
</script>
<template>
  <section class="preset-draft-entry" aria-label="工具预设页面草稿">
    <h3>预设本地编辑与 JSON 交换</h3>
    <p>可克隆已读取的方案、编辑页面副本、导入和导出原兼容 JSON。不会调用宿主创建 / 保存 / 导入 / 删除 / 分配接口，也不会改变当前工程工具范围。</p>
    <el-button @click="open">打开本地预设草稿（{{ drafts.drafts.length }}）</el-button>
    <p v-if="drafts.drafts.length">本次页面内存中有 {{ drafts.drafts.length }} 份草稿。离开帮助页仍保留；刷新或关闭浏览器会丢失，请先导出，之后用 JSON 恢复。</p>
    <el-dialog :model-value="opened" title="本地工具预设草稿 · 未写回宿主" width="min(1000px, 96vw)" :close-on-click-modal="false" :close-on-press-escape="false" :before-close="(done:()=>void)=>{close();done()}" class="tool-preset-draft-dialog">
      <el-alert type="info" :closable="false" title="所有编辑仅在页面内存" description="离页保留、刷新丢失；导出后才可从 JSON 恢复。导入此处只替换页面草稿，不写入原宿主。工具目录的 read/write 标签不是权限保证。"/>
      <p>来源读取上下文：{{ read.projectId || '无工程，默认范围' }}。服务当前选择仍为 {{ read.selectedPresetId || '未读取' }}，此弹窗不分配方案。</p>
      <div class="draft-actions"><el-button :disabled="!read.presetsRead || !read.preview || drafts.drafts.length>=20" @click="read.preview && drafts.cloneFrom(read.preview.id)">克隆当前预览为本地副本</el-button><el-button :disabled="!read.toolsRead || !read.presetsRead || read.toolsLoading || read.presetsLoading" @click="drafts.acceptCurrentContext()">核对并使用当前读取快照</el-button></div>
      <p class="form-help">克隆和另建副本使用新自定义 ID，不修改原 core/full 或已有自定义预设。目录/方案刷新、来源或上下文改变后，导出前须重新核对。</p>
      <p role="status" class="draft-validation">{{ drafts.validation.message }}{{ drafts.contextAccepted ? '（当前快照已明确核对）' : '（尚未接受当前快照）' }}</p>
      <el-alert v-if="drafts.error" type="warning" :closable="false" :title="drafts.error"/>
      <div v-if="drafts.drafts.length" class="draft-workspace">
        <nav aria-label="页面预设草稿列表"><el-button v-for="item in drafts.drafts" :key="item.preset.id" :type="drafts.activeId===item.preset.id?'primary':'default'" @click="drafts.selectActive(item.preset.id)">{{ item.preset.name || '未命名草稿' }}</el-button></nav>
        <section v-if="active" class="draft-fields">
          <p>本地 ID：{{ active.preset.id }} · {{ active.preset.updatedAt }}</p>
          <p class="form-help">来源：{{ active.source.kind }} / {{ active.source.presetName }} / {{ active.source.kind==='import' ? 'JSON 未包含原工程信息' : (active.source.projectId || '无工程上下文') }}。来源信息不是权限、服务保存回执或实时选择。</p>
          <el-form @submit.prevent label-position="top"><el-form-item label="副本名称（1–40字符）"><el-input :model-value="active.preset.name" maxlength="40" aria-label="本地预设名称" @update:model-value="(value:string)=>drafts.edit(active!.preset.id,{name:value})"/></el-form-item><el-form-item label="默认工具范围"><el-select :model-value="active.preset.baseProfile" aria-label="本地预设基础范围" @change="(value:ToolProfile)=>drafts.edit(active!.preset.id,{baseProfile:value})"><el-option label="core 基础" value="core"/><el-option label="full 基础" value="full"/></el-select></el-form-item></el-form>
          <div class="draft-actions"><el-button @click="drafts.replaceAsNewCopy(active.preset.id)">将此草稿另建为新 ID 副本</el-button><el-button type="warning" @click="drafts.remove(active.preset.id)">移除此页面草稿（可恢复）</el-button></div>
          <p class="form-help">若导入文件与已读宿主方案 ID/名称冲突，可明确另建副本再命名；不会偷偷改动导入文件身份或覆盖宿主方案。</p>
          <section v-if="unknownOverrides.length" class="draft-unknown"><h4>当前目录无法核验的覆盖项</h4><p>保留原记录，不默认启用或丢弃。可重新读取完整目录，或明确从本地副本移除此覆盖项。</p><div v-for="name in unknownOverrides" :key="name"><code>{{ name }}</code><el-button @click="drafts.setToolMode(active!.preset.id,name,'default')">移除此覆盖项</el-button></div></section>
          <el-input v-model="query" aria-label="搜索本地预设工具" placeholder="只筛选显示，不改变覆盖项" maxlength="256"/>
          <div class="draft-tool-list"><section v-for="group in toolGroups" :key="group.scope" class="draft-tool-category"><div class="draft-category-heading"><button type="button" :aria-expanded="!collapsedScopes[group.scope]" @click="collapsedScopes[group.scope]=!collapsedScopes[group.scope]">{{ group.scope }} · {{ group.selected ?? '?' }}/{{ group.total }}</button><el-checkbox :model-value="group.selected===group.total" :indeterminate="group.selected!==null&&group.selected>0&&group.selected<group.total" :disabled="group.selected===null" :aria-label="`选择 ${group.scope} 全部工具`" @change="(value:unknown)=>drafts.setScopeSelection(active!.preset.id,group.scope,value===true)">整类全选 / 取消</el-checkbox></div><div v-show="!collapsedScopes[group.scope]"><div v-for="tool in group.tools" :key="tool.name" class="draft-tool"><div><strong>{{ tool.displayNameZh }}</strong><code>{{ tool.name }}</code><small>{{ tool.scope }} / {{ tool.profile }} / {{ tool.access }}（旧目录标签）</small></div><el-select :model-value="mode(tool.name)" :aria-label="`本地覆盖 ${tool.name}`" @change="(value:'default'|'enabled'|'disabled')=>drafts.setToolMode(active!.preset.id,tool.name,value)"><el-option label="跟随基础范围" value="default"/><el-option label="显式启用" value="enabled"/><el-option label="显式禁用" value="disabled"/></el-select></div></div></section></div>
          <p class="form-help">搜索只筛选显示；类别选择作用于完整类别，仅改变当前自定义内存副本，不自动保存或分配。</p>
          <p v-if="!read.toolsRead">工具目录未读，不能把此草稿的成员关系当作已核验；名称/基础范围仍可在本地编辑。</p>
        </section>
      </div>
      <p v-else>尚无本地草稿。可克隆已读取方案，或导入之前导出的 JSON。</p>
      <section v-if="drafts.backupAvailable" class="draft-backup"><p>保留一次替换/移除前的页面备份；恢复只交换内存集合，不影响宿主。</p><el-checkbox v-model="restoreConfirmed" aria-label="确认恢复预设草稿备份">允许用备份替换当前页面草稿</el-checkbox><el-button :disabled="!restoreConfirmed" @click="drafts.restoreBackup(restoreConfirmed);restoreConfirmed=false">恢复上次页面备份</el-button></section>
      <section class="draft-import"><h4>导入到页面草稿（非宿主导入）</h4><input type="file" accept="application/json,.json" aria-label="导入预设JSON文件" @change="readFile"/><el-input :model-value="importText" type="textarea" :rows="5" maxlength="1048576" aria-label="预设草稿JSON" @update:model-value="textChanged"/><p v-if="importPending">正在读取所选文件，旧候选与替换确认已失效…</p><p v-if="importError" role="alert">{{ importError }}</p><el-button :disabled="importPending || !importText" @click="parseImport">严格解析导入候选</el-button><template v-if="drafts.preparedImport"><p>候选包含 {{ drafts.preparedImport.presets.length }} 份自定义预设；此时还未改变页面草稿。</p><ul><li v-for="preset in drafts.preparedImport.presets" :key="preset.id">{{ preset.name }} · {{ preset.id }} · {{ preset.baseProfile }}</li></ul><el-checkbox v-if="drafts.preparedImport.requiresReplacement" v-model="replaceConfirmed" aria-label="确认替换页面预设草稿">允许替换当前页面草稿，并保留一次旧草稿备份</el-checkbox><el-button :disabled="importPending || (drafts.preparedImport.requiresReplacement && !replaceConfirmed)" @click="applyImport">只恢复到页面草稿</el-button></template></section>
      <p v-if="downloadNotice" role="status">{{ downloadNotice }}</p>
      <template #footer><el-button @click="close">关闭并保留页面草稿</el-button><el-button type="primary" :disabled="!drafts.drafts.length || drafts.validation.status!=='valid' || !drafts.contextAccepted" @click="download">导出全部本地草稿 JSON</el-button></template>
    </el-dialog>
  </section>
</template>
<style scoped>
.preset-draft-entry{border:1px solid #dde5ee;border-radius:10px;padding:16px;margin:18px 0}.preset-draft-entry p{line-height:1.65;overflow-wrap:anywhere}.draft-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.draft-workspace{display:grid;grid-template-columns:180px minmax(0,1fr);gap:20px;margin:18px 0}.draft-workspace nav{display:flex;flex-direction:column;gap:8px}.draft-workspace nav .el-button{margin:0;white-space:normal;min-height:36px;height:auto}.draft-fields{min-width:0}.draft-category-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px;background:#f3f7fb}.draft-category-heading>button{border:0;background:none;font:inherit;text-align:left;cursor:pointer}.draft-tool-list{max-height:360px;overflow:auto;margin-top:12px;border:1px solid #e2e7ef}.draft-tool{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border-bottom:1px solid #e2e7ef}.draft-tool>div{display:grid;gap:4px;min-width:0}.draft-tool code,.draft-tool small{overflow-wrap:anywhere}.draft-tool .el-select{width:180px;flex-shrink:0}.draft-unknown,.draft-backup,.draft-import{padding:14px;border:1px solid #e2e7ef;border-radius:8px;margin-top:16px}.draft-unknown>div{display:flex;justify-content:space-between;gap:10px}.draft-import input{max-width:100%;margin-bottom:10px}.draft-validation{padding:10px;background:#f3f7fb}@media(max-width:650px){.draft-workspace{grid-template-columns:1fr}.draft-workspace nav{flex-direction:row;flex-wrap:wrap}.draft-tool{align-items:stretch;flex-direction:column}.draft-tool .el-select{width:100%}}
</style>
