<script setup lang="ts">
import { computed } from 'vue'
import { Refresh, Close, ArrowRight } from '@element-plus/icons-vue'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { companionBrowserProvider } from '../companion-browser-integration'
import { useWorkspaceStore } from '../stores/workspace'
import { allowsLegacyWorkspace } from '../domain/project-workspace'
import { runtimeStateLabel, type ManagedProject } from '../domain/companion-browser'
import ProjectStatusTag from './ProjectStatusTag.vue'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { recentProjects } from '../domain/recent-projects'
import { useOverviewRecentProjects } from '../composables/use-overview-recent-projects'
const selection = useRegisteredProjectStore(), directory = selection.directory, workspace = useWorkspaceStore()
const recent = useOverviewRecentProjects(), operations = useCreatorOperationsStore()
const retainedSource = computed(() => !!directory.observedAt && !!directory.provider && directory.provider === companionBrowserProvider.value)
const evidenceStale = computed(() => retainedSource.value && (!directory.connected || !!directory.projectError))
// Selection remains fail-closed; this is display-only retained evidence. Keep its
// established order when a failed read clears the optional recent-time reader.
const cards = computed<ReturnType<typeof recentProjects>>(previous => !retainedSource.value ? []
  : evidenceStale.value && previous?.length ? previous : recentProjects(directory.projects, recent.data.value))
const legacyWorkspace = computed(() => allowsLegacyWorkspace(import.meta.env.MODE, Boolean(companionBrowserProvider.value)))
function activeOperation(project: ManagedProject) { return [...operations.receipts].reverse().find(record => record.project.id === project.id && operations.isReceiptCurrent(record.id) && (record.phase === 'sending' || record.snapshotRevision === directory.projectSnapshotRevision)) }
function projectStatus(project: ManagedProject) { return directory.statuses.find(item => item.projectId === project.id) }
function bridge(project: ManagedProject) {
  if (evidenceStale.value) return { label: '状态过期 · 待核对', detail: '保留上次工程信息，当前连接和运行状态尚未核对', version: undefined, error: '' }
  const runtime = projectStatus(project)
  if (directory.provider?.runtimeProbesEnabled === false) return { label: '未检查', detail: '运行状态未探测', version: undefined, error: '' }
  const warning = directory.warnings.find(item => item.startsWith('运行状态未取得有效数据：['))
  const code = warning?.split('[')[1]?.split(']')[0]
  const label = warning ? ['unauthorized','forbidden'].includes(code ?? '') ? '鉴权失败' : code === 'timeout' ? '超时' : '异常' : runtime ? runtimeStateLabel(runtime.state) : directory.projectLoading && !directory.observedAt ? '检查中' : '未知'
  return { label, detail: warning ? '本次运行状态未核验' : '', version: runtime?.creatorVersion, error: runtime?.lastError || '' }
}
function selectProject(event: MouseEvent, id: string) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  selection.restoreRouteProject(id)
}
function summary(text: string) { return text.length > 110 ? text.slice(0,110) + '…' : text }
</script>
<template>
  <section class="registered-overview" aria-label="工程看板">
    <header class="overview-card-header"><h1>看板</h1><span>{{ retainedSource ? `${directory.projects.length} 个工程${evidenceStale?'（待核对）':''}` : '工程数量未读取' }}</span><RouterLink to="/projects" class="all-projects">全部工程</RouterLink>
      <div class="overview-connect-actions"><el-button v-if="companionBrowserProvider" size="small" :loading="directory.projectLoading && !directory.backgroundProjectRead" :disabled="directory.projectLoading" @click="directory.connect(companionBrowserProvider)">{{ selection.currentSource ? '重新连接工程' : '连接工程服务' }}</el-button><el-button v-if="directory.provider" size="small" :icon="Refresh" text aria-label="刷新登记工程" :disabled="directory.projectLoading" @click="directory.refreshProjects()"/><el-button v-if="directory.provider" size="small" :icon="Close" text aria-label="断开工程服务" @click="directory.disconnect()"/></div>
    </header>
    <div class="overview-live"><span>工程更新：<time v-if="directory.observedAt" :datetime="directory.observedAt">{{ directory.observedAt }}</time><span v-else>未检查</span></span><button type="button" class="realtime-toggle" :disabled="!directory.livePreferred && !recent.canRealtime.value" @click="recent.toggleRealtime">{{ directory.livePreferred ? '暂停工程实时' : '恢复工程实时' }}</button><el-button v-if="legacyWorkspace" size="small" @click="workspace.openDemo">查看示例工作台</el-button></div>
    <p v-if="directory.projectError" class="overview-problem" role="status">工程读取失败：{{ directory.projectError }}</p>
    <p v-if="recent.error.value" class="recent-note">{{ recent.error.value }}</p>
    <div v-if="cards.length" class="overview-project-grid">
      <article v-for="item in cards" :key="item.project.id" class="registered-project-card panel" :data-project-id="item.project.id">
        <RouterLink :to="{ path: '/projects', query: { project: item.project.id } }" class="project-title" :aria-label="`查看工程 ${item.project.name}`" :title="`查看工程 ${item.project.name}`" @click.capture="selectProject($event, item.project.id)"><h2>{{ item.project.name }}</h2><el-tooltip content="查看工程" placement="top"><el-icon class="project-open-icon" aria-hidden="true"><ArrowRight/></el-icon></el-tooltip></RouterLink>
        <p class="project-path">{{ item.project.path }}</p>
        <RouterLink class="project-bridge" @click.capture="selectProject($event, item.project.id)" :to="{ path: '/projects', query: { project: item.project.id } }"><strong>Creator Bridge</strong><ProjectStatusTag v-if="!evidenceStale && (activeOperation(item.project) || (projectStatus(item.project) && !bridge(item.project).detail))" :status="projectStatus(item.project)" :operation="activeOperation(item.project)" :stop-acknowledged="operations.isExpectedStopDisconnect(item.project.id)" :passive="directory.provider?.runtimeProbesEnabled === false"/><el-tag v-else size="small" :type="bridge(item.project).detail ? 'warning' : 'info'">{{ bridge(item.project).label }}</el-tag><span v-if="bridge(item.project).version">Creator {{ bridge(item.project).version }}</span><span v-else>版本未返回</span></RouterLink>
        <p v-if="item.project.requiredCreatorVersion" class="project-note">要求 Creator {{ item.project.requiredCreatorVersion }}</p>
        <p v-if="bridge(item.project).detail" class="project-note">{{ bridge(item.project).detail }}</p>
        <p v-if="bridge(item.project).error" class="overview-problem" :title="bridge(item.project).error">{{ summary(bridge(item.project).error) }}</p>
        <nav class="project-destinations" aria-label="工程资源"><RouterLink :to="{ path: '/resources', query: { project: item.project.id } }" class="hero-link">游戏资源</RouterLink><RouterLink :to="{ path: '/resources', query: { project: item.project.id, step: 1 } }">工程规范</RouterLink></nav>
      </article>
    </div>
    <p v-else class="selection-unavailable" role="status">{{ directory.projectLoading ? '正在读取登记工程…' : !companionBrowserProvider ? '当前宿主未接入 Companion 工程读取接口' : !selection.currentSource ? '连接工程服务后读取真实工程' : '尚无已登记工程' }}</p>
  </section>
</template>
<style scoped>
.overview-card-header,.overview-connect-actions,.overview-live,.project-title,.project-bridge,.project-destinations{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px}.overview-card-header h1{font-size:18px;margin:0}.overview-card-header>span,.overview-live,.recent-note,.project-note{font-size:12px;color:var(--el-text-color-secondary)}.overview-connect-actions{margin-left:auto;gap:5px}.overview-connect-actions :deep(.el-button+.el-button){margin-left:0}.overview-live{margin:10px 0 14px;justify-content:space-between}.all-projects,.overview-live a{font-size:12px}.realtime-toggle{border:0;background:none;color:var(--el-color-primary);font-size:12px;cursor:pointer}.realtime-toggle:disabled{color:var(--el-text-color-disabled);cursor:default}.overview-project-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.registered-project-card{position:relative;padding:14px 16px;min-width:0}.project-title{justify-content:space-between;text-decoration:none;color:var(--el-text-color-primary)}.project-title::after{content:"";position:absolute;inset:0;border-radius:inherit}.project-bridge,.project-destinations{position:relative;z-index:1}.project-title h2{margin:0;font-size:15px}.project-open-icon{font-size:18px;color:var(--el-color-primary);flex-shrink:0}.project-path{font-size:12px;color:var(--el-text-color-secondary);overflow-wrap:anywhere;margin:8px 0 12px}.project-bridge{color:var(--el-text-color-regular);font-size:12px;text-decoration:none}.project-bridge:hover,.project-title:hover{color:var(--el-color-primary)}.overview-problem{font-size:12px;color:#a63f44;overflow-wrap:anywhere;margin:8px 0}.project-note,.recent-note{margin:7px 0}.project-destinations{font-size:12px;margin-top:12px}.project-destinations .hero-link{font-size:12px;margin:0}.selection-unavailable{font-size:13px;color:var(--el-text-color-secondary);padding:16px 0}a:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}@media(max-width:640px){.overview-project-grid{grid-template-columns:1fr}.overview-connect-actions{margin-left:0;flex-basis:100%}.overview-live{align-items:flex-start}}
</style>
