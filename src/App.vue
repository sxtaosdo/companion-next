<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { DataBoard, Box, Picture, Connection, Clock, ArrowDown, ArrowLeft, Refresh, Close, Menu, List } from '@element-plus/icons-vue'
import { useWorkspaceStore } from './stores/workspace'
import { liveProvider } from './integration'
import { companionBrowserProvider } from './companion-browser-integration'
import { useRegisteredProjectStore } from './stores/registered-project'
import { allowsLegacyWorkspace } from './domain/project-workspace'
import { frontendIdentity } from './domain/product-information'
import InfoTip from './components/InfoTip.vue'
const store = useWorkspaceStore()
const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const registered = useRegisteredProjectStore()
const legacyWorkspace = computed(() => allowsLegacyWorkspace(import.meta.env.MODE, Boolean(companionBrowserProvider.value)))
const usesLegacySnapshot = computed(() => legacyWorkspace.value && store.mode !== 'disconnected')
const showRegisteredContext = computed(() => !usesLegacySnapshot.value && ['/overview', '/resources'].includes(route.path))
const showProjectContext = computed(() => !showRegisteredContext.value && legacyWorkspace.value && route.path !== '/image-assets' && !route.meta.workspaceIndependent)
watch(legacyWorkspace, allowed => { if (!allowed && store.mode !== 'disconnected') store.disconnect() }, { immediate: true, flush: 'sync' })
function projectLink(path: string) { return ['/resources','/ai-icons'].includes(path) && registered.project ? { path, query: { project: registered.project.id } } : path }
function selectRegisteredProject(id: string) {
  registered.restoreRouteProject(id)
  void router.push({ path: route.path, query: { ...route.query, project: id } })
}
const nav = [{ path: '/overview', label: '项目概览', icon: DataBoard }, {path:'/projects',label:'工程 / 日志',icon:List}, { path: '/resources', label: '游戏资源', icon: Box }, { path: '/image-assets', label: '图片素材', icon: Picture }, { path: '/services', label: '服务状态', icon: Connection }, { path: '/history', label: '版本与边界', icon: Clock }, { path: '/migration', label: '旧功能保留', icon: List }]
const legacyNav = [{ label: 'AI 图标', feature: 'ai-icons' }, { label: '工程', feature: 'projects' }, { label: '知识库', feature: 'knowledge' }, { label: '模型服务', feature: 'models' }]
function titleFor(target: Pick<RouteLocationNormalizedLoaded, 'path' | 'query' | 'meta'>) {
  return target.path === '/projects' ? '工程' : target.path === '/ai-icons' ? 'AI 图标' : target.path === '/knowledge' ? (target.query.tab === 'models' ? '模型服务' : '知识库') : String(target.meta.title ?? '页面')
}
const pageTitle = computed(() => titleFor(route))
// Only entries observed by this mounted app can authorize a browser-history return.
// A deep link/reload must never follow a previous tab entry out of Companion.
const visitedRoutes = new Map<number, string>()
const returnRoute = ref<string>()
const returning = ref(false)
function knownPreviousRoute() {
  const { position, current } = router.options.history.state
  if (typeof position !== 'number' || !Number.isSafeInteger(position) || current !== route.fullPath || visitedRoutes.get(position) !== current) return
  // History's `back` text can be stale after replacing an earlier entry then
  // going forward. Use only the adjacent route actually observed in this app.
  return visitedRoutes.get(position - 1)
}
function recordRoute(fullPath: string) {
  const { position, current } = router.options.history.state
  if (typeof position === 'number' && Number.isSafeInteger(position) && current === fullPath) visitedRoutes.set(position, fullPath)
  returnRoute.value = knownPreviousRoute()
}
recordRoute(route.fullPath)
const removeNavigationHook = router.afterEach((to, _from, failure) => {
  returning.value = false
  menuOpen.value = false
  if (!failure) recordRoute(to.fullPath)
})
const removeErrorHook = router.onError(() => { returning.value = false })
onBeforeUnmount(() => { removeNavigationHook(); removeErrorHook() })
const returnLabel = computed(() => returnRoute.value ? `返回${titleFor(router.resolve(returnRoute.value))}` : '返回工程')
const returnDisabled = computed(() => returning.value || (!returnRoute.value && route.fullPath === '/projects'))
function returnWithinApp() {
  if (returnDisabled.value) return
  menuOpen.value = false
  returning.value = true
  if (knownPreviousRoute()) router.back()
  else void router.replace('/projects').catch(() => undefined).finally(() => { returning.value = false })
}
const pageDescriptions: Record<string, string> = {
  '/projects': '查看工程、日志、调用记录和工具。工程操作的结果以服务回执为准。',
  '/ai-icons': '管理工程规范和参考图片。保存、生成和导入分别确认。',
  '/knowledge': '查询知识库、发起问答和查看模型状态。连接状态以实际读取结果为准。',
  '/overview': '查看所有已登记工程，点击进入所选工程概览。',
  '/resources': '查看所选工程的已保存规范与资源读取状态。',
  '/image-assets': '导入候选图片、审阅并保存。保存结果以服务回执为准。',
  '/services': '查看服务连接状态和最近读取结果。',
}
const pageInfo = computed(() => pageDescriptions[route.path] ?? String(route.meta.description ?? ''))
const dateLabel = computed(() => {
  const observed = store.snapshot.source.observedAt
  if (!observed) return '尚无真实读取记录'
  const date = new Date(observed)
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'medium' }).format(date) : '读取时间格式未验证'
})
</script>
<template>
  <div class="app-shell">
    <button v-if="menuOpen" class="sidebar-scrim" aria-label="关闭导航" @click="menuOpen = false"></button>
    <aside class="sidebar" :class="{ 'is-open': menuOpen }">
      <RouterLink to="/about" class="brand" aria-label="关于 Companion" @click="menuOpen = false"><span class="brand-mark">C</span><span>Companion</span></RouterLink>
      <div class="workspace-label">项目工作区 <span>01</span></div>
      <nav class="nav-list" aria-label="主导航"><RouterLink v-for="item in nav" :key="item.path" :to="projectLink(item.path)" class="nav-item" active-class="is-active" @click="menuOpen = false"><el-icon :size="19"><component :is="item.icon" /></el-icon><span>{{ item.label }}</span><i v-if="item.path === '/resources'" class="nav-dot"></i></RouterLink></nav>
      <nav class="legacy-nav" aria-label="旧版功能入口"><h2>原有功能</h2><RouterLink v-for="item in legacyNav" :key="item.feature" :to="item.feature==='projects'?'/projects':item.feature==='knowledge'?'/knowledge':item.feature==='models'?'/knowledge?tab=models':item.feature==='ai-icons'?projectLink('/ai-icons'):`/migration?feature=${item.feature}`" @click="menuOpen = false">{{ item.label }}</RouterLink></nav>
      <div class="sidebar-utility"><RouterLink to="/help" @click="menuOpen = false">帮助</RouterLink><RouterLink to="/about" @click="menuOpen = false">关于</RouterLink><RouterLink to="/changelog" @click="menuOpen = false">更新记录</RouterLink></div>
      <div class="sidebar-footer">前端 v{{ frontendIdentity.version }}</div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="topbar-left"><el-button class="mobile-menu" :icon="Menu" text aria-label="打开导航" @click="menuOpen = !menuOpen"/><div class="breadcrumb"><strong>{{ pageTitle }}</strong></div></div>
        <div class="topbar-right"><RouterLink to="/changelog" class="frontend-version" aria-label="查看前端版本与更新记录">Next v{{ frontendIdentity.version }}</RouterLink><RouterLink to="/help" class="utility-link" @click="menuOpen = false">帮助</RouterLink><RouterLink to="/about" class="utility-link" @click="menuOpen = false">关于</RouterLink><el-tag v-if="showRegisteredContext" :type="registered.currentSource ? 'success' : 'info'" round>{{ registered.currentSource ? '真实工程' : '未连接' }}</el-tag><el-tag v-else-if="showProjectContext && store.mode === 'disconnected'" type="info" effect="plain" round>未连接</el-tag><el-tag v-else-if="showProjectContext && store.isDemo" class="demo-tag" effect="light" round>示例模式</el-tag><el-tag v-else-if="showProjectContext" :type="store.connection === 'connected' ? 'success' : 'warning'" round>{{ store.sourceLabel }}</el-tag></div>
      </header>
      <main class="main-content">
        <div class="page-heading"><div class="page-title"><button class="page-back" type="button" :aria-label="returnLabel" :title="returnDisabled && !returning ? '已在工程页面' : returnLabel" :disabled="returnDisabled" @click="returnWithinApp"><el-icon aria-hidden="true"><ArrowLeft/></el-icon></button><h1>{{ pageTitle }}</h1><InfoTip v-if="pageInfo" :label="`${pageTitle}说明`" :text="pageInfo" /></div><div v-if="showRegisteredContext" class="page-heading-actions"><el-button v-if="legacyWorkspace" @click="store.openDemo">查看示例工作台</el-button><el-select v-if="registered.projects.length" :model-value="registered.project?.id ?? ''" class="project-select" aria-label="当前登记工程" placeholder="请选择工程" @update:model-value="selectRegisteredProject"><el-option v-for="project in registered.projects" :key="project.id" :label="project.name" :value="project.id"/></el-select><el-button v-if="companionBrowserProvider" :loading="registered.directory.projectLoading && !registered.directory.backgroundProjectRead" :disabled="registered.directory.projectLoading" @click="registered.directory.connect(companionBrowserProvider)">{{ registered.currentSource ? '重新连接工程' : '连接工程服务' }}</el-button><el-button v-if="registered.directory.provider" :icon="Refresh" text aria-label="刷新登记工程" :disabled="registered.directory.projectLoading" @click="registered.directory.refreshProjects()"/><el-button v-if="registered.directory.provider" :icon="Close" text aria-label="断开工程服务" @click="registered.directory.disconnect()"/></div><div v-else-if="showProjectContext" class="page-heading-actions"><el-select v-if="store.snapshot.projects.length" :model-value="store.selectedProjectId" class="project-select" aria-label="当前项目" @update:model-value="store.selectProject"><el-option v-for="project in store.snapshot.projects" :key="project.id" :label="project.name" :value="project.id"/></el-select><el-dropdown trigger="click"><el-button>数据源<el-icon class="button-trail"><ArrowDown/></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item @click="store.openDemo">查看示例资料</el-dropdown-item><el-dropdown-item v-if="liveProvider" @click="store.connect(liveProvider)">连接只读数据源</el-dropdown-item><el-dropdown-item :disabled="store.mode === 'disconnected'" divided @click="store.disconnect">断开并清空视图</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></div>
        <div v-if="showProjectContext && store.mode !== 'disconnected'" class="source-banner" :class="{ 'source-live': !store.isDemo }" role="status"><span class="source-dot"></span><div><strong>{{ store.isDemo ? '正在浏览示例资料' : store.sourceLabel }}</strong><span>{{ store.isDemo ? '演示数据 · 无真实服务连接' : `${store.snapshot.source.label} · ${dateLabel}` }}</span></div><InfoTip v-if="store.isDemo" label="示例数据说明" text="项目、资源与状态均为演示。未探测真实服务，未执行任何工程写入。"/><el-button :icon="Refresh" text aria-label="刷新数据源" :loading="store.loading" @click="store.refresh"/><el-button :icon="Close" text aria-label="断开数据源" @click="store.disconnect"/></div>
        <el-alert v-if="showProjectContext && store.error" type="error" show-icon :closable="false" title="读取失败，未显示任何缓存或示例数据" :description="store.error" class="connection-error"/>
        <div v-if="showRegisteredContext && registered.currentSource" class="registered-source-note" role="status">{{ registered.currentSource.label }}<span v-if="registered.directory.observedAt"> · 读取于 {{ registered.directory.observedAt }}</span><InfoTip label="登记与状态读取说明" :text="registered.currentSource.runtimeProbesEnabled === false ? '当前仅读取工程登记，运行状态未探测。' : '运行状态来自原 Bridge 查询；可能更新后台状态和诊断日志，不启动 Creator。资源库存与验收记录没有包含在工程登记中。'"/></div>
        <el-alert v-if="showRegisteredContext && !companionBrowserProvider" type="info" :closable="false" title="当前宿主未接入 Companion 工程读取接口" description="请通过原 Companion 同源工程服务打开。没有加载示例工程。"/>
        <el-alert v-if="showRegisteredContext && registered.directory.projectError" type="error" :closable="false" title="工程读取失败" :description="registered.directory.projectError"/>
        <div v-if="showRegisteredContext && registered.directory.warnings.length" class="registered-read-warnings"><InfoTip label="工程读取限制" :text="registered.directory.warnings.join('；')"/><span>部分状态或发现信息未读取</span></div>
        <RouterView />
      </main>
    </div>
  </div>
</template>
<style scoped>
.sidebar { overflow-y: auto; }
.registered-source-note,.registered-read-warnings { display:flex; align-items:center; flex-wrap:wrap; gap:6px; color:var(--text-secondary,#637187); font-size:12px; margin-bottom:16px; overflow-wrap:anywhere; }
.page-heading { margin-bottom: 18px; }
.page-title { display: flex; align-items: center; gap: 9px; }
.page-back { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 36px; width: 36px; height: 36px; padding: 0; border: 1px solid #dfe4ed; border-radius: 7px; background: #fff; color: #51607a; font-size: 17px; }
.page-back:hover:not(:disabled) { background: #f0ebfd; color: #7660bf; border-color: #d9cff3; }
.page-back:disabled { opacity: .45; }
.page-heading h1 { font-size: 23px; }
@media (max-width: 760px) {
  .topbar-right { gap: 9px; }
  .page-heading h1 { font-size: 21px; }
  .page-back { flex-basis: 44px; width: 44px; height: 44px; }
  .page-heading-actions { gap: 8px; }
}
</style>
