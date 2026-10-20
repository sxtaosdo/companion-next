<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Refresh, Close } from '@element-plus/icons-vue'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { companionBrowserProvider } from '../companion-browser-integration'
import OverviewServiceSummary from './OverviewServiceSummary.vue'
import { useWorkspaceStore } from '../stores/workspace'
import { allowsLegacyWorkspace } from '../domain/project-workspace'
const selection = useRegisteredProjectStore(), route = useRoute(), router = useRouter()
const directory = selection.directory, workspace = useWorkspaceStore()
const legacyWorkspace = computed(() => allowsLegacyWorkspace(import.meta.env.MODE, Boolean(companionBrowserProvider.value)))
const projectProblem = computed(() => directory.projectError ? `工程读取失败：${directory.projectError}` : selection.project && selection.status?.lastError ? selection.status.lastError : '')
const shortProblem = computed(() => projectProblem.value.length > 140 ? `${projectProblem.value.slice(0, 140)}…` : projectProblem.value)
function selectId(id: string) {
  if (!selection.projects.some(project => project.id === id)) return
  selection.restoreRouteProject(id)
  void router.push({ path: '/overview', query: { ...route.query, project: id } })
}
function selectProject(event: MouseEvent, id: string, navigate: (event?: MouseEvent) => unknown) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  selection.restoreRouteProject(id)
  void navigate(event)
}
</script>
<template>
  <section class="registered-overview panel" data-testid="overview-status-card" aria-label="看板">
    <header class="overview-card-header">
      <h1>看板</h1>
      <el-select v-if="selection.projects.length" :model-value="selection.project?.id ?? ''" class="overview-project-select" aria-label="当前登记工程" placeholder="请选择工程" @update:model-value="selectId"><el-option v-for="project in selection.projects" :key="project.id" :label="project.name" :value="project.id"/></el-select>
      <span class="overview-project-count">{{ selection.currentSource ? `${selection.projects.length} 个工程` : '工程数量未读取' }}</span>
      <div class="overview-connect-actions"><el-button v-if="companionBrowserProvider" size="small" :loading="directory.projectLoading && !directory.backgroundProjectRead" :disabled="directory.projectLoading" @click="directory.connect(companionBrowserProvider)">{{ selection.currentSource ? '重新连接工程' : '连接工程服务' }}</el-button><el-button v-if="directory.provider" size="small" :icon="Refresh" text aria-label="刷新登记工程" :disabled="directory.projectLoading" @click="directory.refreshProjects()"/><el-button v-if="directory.provider" size="small" :icon="Close" text aria-label="断开工程服务" @click="directory.disconnect()"/></div>
    </header>
    <section v-if="selection.project" class="registered-project-detail" data-testid="registered-project-overview">
      <div class="selected-project-line"><h2>{{ selection.project.name }}</h2><div class="project-destinations"><RouterLink :to="{ path: '/resources', query: { project: selection.project.id } }" class="hero-link">进入游戏资源<el-icon><ArrowRight/></el-icon></RouterLink><RouterLink :to="{ path: '/resources', query: { project: selection.project.id, step: 1 } }">查看工程规范</RouterLink></div></div>
      <p class="selected-project-path">{{ selection.project.path }}</p>
    </section>
    <p v-else class="selection-unavailable" role="status">{{ directory.projectLoading ? '正在读取登记工程…' : !companionBrowserProvider ? '当前宿主未接入 Companion 工程读取接口' : !selection.currentSource ? '连接工程服务后选择真实工程' : !selection.projects.length ? '尚无已登记工程' : '所选工程尚未读取、已被移除或登记来源已改变，请重新选择工程。' }}</p>
    <p v-if="shortProblem" class="overview-problem" role="status">{{ shortProblem }}</p>
    <OverviewServiceSummary embedded/>
    <details class="overview-project-details">
      <summary>工程详情与登记列表</summary>
      <el-button v-if="legacyWorkspace" size="small" @click="workspace.openDemo">查看示例工作台</el-button>
      <dl v-if="selection.project"><dt>工程 ID</dt><dd>{{ selection.project.id }}</dd><dt>要求 Creator 版本</dt><dd>{{ selection.project.requiredCreatorVersion || '未返回' }}</dd></dl>
      <p>工程来源：{{ selection.currentSource?.label || '未连接' }}。{{ selection.currentSource?.runtimeProbesEnabled === false ? '运行状态未探测。' : '状态来自原 Bridge 查询；不启动 Creator。' }}</p>
      <p v-if="projectProblem && projectProblem !== shortProblem">{{ projectProblem }}</p>
      <ul v-if="directory.warnings.length" class="overview-warnings"><li v-for="warning in directory.warnings" :key="warning">{{ warning }}</li></ul>
      <nav v-if="selection.projects.length" class="registered-project-links" aria-label="已登记工程"><RouterLink v-for="project in selection.projects" :key="project.id" :to="{ path: '/overview', query: { project: project.id } }" custom v-slot="{ href, navigate }"><a :href="href" class="registered-project-card" :class="{ selected: selection.project?.id === project.id }" :aria-current="selection.project?.id === project.id ? 'true' : undefined" :data-project-id="project.id" @click="selectProject($event, project.id, navigate)">{{ project.name }}</a></RouterLink></nav>
    </details>
  </section>
</template>
<style scoped>
.registered-overview{padding:14px 16px}.overview-card-header,.selected-project-line,.overview-connect-actions,.project-destinations{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px}.overview-card-header h1{font-size:17px;line-height:1.4;margin:0}.overview-project-select{width:230px;max-width:100%}.overview-project-count{font-size:12px;color:var(--el-text-color-secondary)}.overview-connect-actions{margin-left:auto;gap:5px}.overview-connect-actions :deep(.el-button+.el-button){margin-left:0}.registered-project-detail{margin-top:12px}.selected-project-line h2{font-size:15px;line-height:1.5;margin:0}.creator-version{font-size:12px;color:var(--el-text-color-secondary)}.project-destinations{margin-left:auto;font-size:12px;gap:8px 16px}.project-destinations .hero-link{font-size:12px;margin:0}.selected-project-path{margin-top:6px;font-size:12px;overflow-wrap:anywhere;color:var(--el-text-color-secondary)}.selection-unavailable,.overview-problem{margin:10px 0 0;font-size:12px;line-height:1.5;overflow-wrap:anywhere}.selection-unavailable{color:var(--el-text-color-secondary)}.overview-problem{color:#a63f44}.overview-project-details{margin-top:10px;font-size:12px;color:var(--el-text-color-secondary);line-height:1.6}.overview-project-details summary{cursor:pointer}.overview-project-details dl{display:flex;flex-wrap:wrap;gap:5px 12px;margin:8px 0}.overview-project-details dd{margin:0;overflow-wrap:anywhere}.overview-project-details p{margin:6px 0;overflow-wrap:anywhere}.overview-warnings{padding-left:18px}.registered-project-links{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px}.registered-project-card{color:var(--el-text-color-regular);text-decoration:underline;text-underline-offset:2px}.registered-project-card.selected{font-weight:600;color:var(--el-color-primary)}.registered-project-card:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}
@media(max-width:640px){.overview-card-header{align-items:flex-start}.overview-card-header h1{flex-basis:100%}.overview-project-select{flex:1;min-width:0}.overview-connect-actions{margin-left:0;flex-basis:100%}.project-destinations{margin-left:0;flex-basis:100%}.overview-project-details dl{display:grid;grid-template-columns:auto minmax(0,1fr)}}
</style>
