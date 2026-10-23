<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { safeCompanionReturnTo } from './domain/companion-session-recovery'
import type { LocationQueryValue, RouteLocationNormalizedLoaded } from 'vue-router'
import { ArrowDown, ArrowLeft, Refresh, Close, Menu } from '@element-plus/icons-vue'
import { useWorkspaceStore } from './stores/workspace'
import { liveProvider } from './integration'
import { companionBrowserProvider } from './companion-browser-integration'
import { useRegisteredProjectStore } from './stores/registered-project'
import { allowsLegacyWorkspace } from './domain/project-workspace'
import { frontendIdentity, frontendBuildIdentity } from './domain/product-information'
import InfoTip from './components/InfoTip.vue'
import CompanionSessionRecovery from './components/CompanionSessionRecovery.vue'
import {useProductVersionStore} from './stores/product-version'
import {productVersionReadProvider} from './product-version-integration'
import CompanionUserMenu from './components/CompanionUserMenu.vue'
import ShellBreadcrumb from './components/ShellBreadcrumb.vue'
import ShellRouteTabs from './components/ShellRouteTabs.vue'
import ArtWorkspaceView from './views/ArtWorkspaceView.vue'
import { knowledgeNavigation, knowledgePageFor } from './domain/knowledge-navigation'
const backendVersionInformation=useProductVersionStore()
watch(productVersionReadProvider,()=>{void backendVersionInformation.read()},{immediate:true})
const store = useWorkspaceStore()
const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const loggingOut = ref(false)
async function logoutBrowserSession() {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    const response = await window.fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000) })
    const data: unknown = await response.json()
    if (!response.ok || !data || typeof data !== 'object' || (data as { loggedOut?: unknown }).loggedOut !== true) throw new Error('Logout was not confirmed')
    const target = safeCompanionReturnTo(`/next/index.html${window.location.search}${window.location.hash}`) ?? '/next/index.html#/overview'
    window.location.assign('/login?returnTo=' + encodeURIComponent(target))
  } catch { ElMessage.error('\u9000\u51fa\u767b\u5f55\u672a\u5b8c\u6210\uff0c\u8bf7\u91cd\u8bd5\u3002') }
  finally { loggingOut.value = false }
}

// Keep the iframe in the document: moving it through a deactivated route cache can reload its browsing context.
const artWorkspaceVisited=ref(route.path==='/art-resources')
watch(()=>route.path,path=>{if(path==='/art-resources')artWorkspaceVisited.value=true},{flush:'sync'})
const registered = useRegisteredProjectStore()
const legacyWorkspace = computed(() => allowsLegacyWorkspace(import.meta.env.MODE, Boolean(companionBrowserProvider.value)))
const usesLegacySnapshot = computed(() => legacyWorkspace.value && store.mode !== 'disconnected')
const showRegisteredContext = computed(() => !usesLegacySnapshot.value && ['/overview'].includes(route.path))
const compactOverview = computed(() => route.path === '/overview' && !usesLegacySnapshot.value)
const showRegisteredChrome = computed(() => showRegisteredContext.value && !compactOverview.value)
const showProjectContext = computed(() => !showRegisteredContext.value && legacyWorkspace.value && route.path !== '/image-assets' && !route.meta.workspaceIndependent)
watch(legacyWorkspace, allowed => { if (!allowed && store.mode !== 'disconnected') store.disconnect() }, { immediate: true, flush: 'sync' })
// Remember explicit route intent across unrelated pages, including invalid or
// empty IDs. This only builds links; actual project access still requires the
// registered store's source/path-bound project and never trusts this query.
const registeredRouteIntent = ref<LocationQueryValue | LocationQueryValue[] | undefined>()
watch(() => route.fullPath, () => {
  if (['/overview', '/art-resources', '/resources', '/ai-icons', '/image-assets'].includes(route.path)) registeredRouteIntent.value = route.query.project
}, { immediate: true, flush: 'sync' })
function projectLink(path: string) {
  if (!['/overview', '/art-resources', '/resources', '/ai-icons', '/image-assets'].includes(path)) return path
  const intent = registered.project?.id ?? (registered.requestedId || registeredRouteIntent.value)
  return intent !== undefined ? { path, query: { project: intent } } : path
}
function selectRegisteredProject(id: string) {
  registered.restoreRouteProject(id)
  void router.push({ path: route.path, query: { ...route.query, project: id } })
}
// Group only navigation; each art page keeps its existing route and business flow.
const nav = [
  { path: '/overview', label: '看板' },
  { path: '/projects', label: '工程' },
  { path: '/knowledge', label: '知识库' },
  { path: '/knowledge?tab=models', label: '模型服务' },
]
const knowledgeExpanded = ref(false)
const knowledgeActive = computed(() => Boolean(knowledgePageFor(route)))
const knowledgeCached = computed(() => route.path === '/knowledge' || route.path.startsWith('/knowledge/'))
const knowledgeCacheKey = computed(() => route.path + (route.query.tab === 'models' ? '?tab=models' : ''))
watch(() => route.fullPath, () => {
  if (knowledgeActive.value) knowledgeExpanded.value = true
}, { immediate: true })
function isNavActive(path: string) {
  if (path === '/knowledge?tab=models') return route.path === '/knowledge' && route.query.tab === 'models'
  if (knowledgeNavigation.some(item => item.path === path)) return knowledgePageFor(route) === knowledgeNavigation.find(item => item.path === path)?.page
  return route.path === path
}
function titleFor(target: Pick<RouteLocationNormalizedLoaded, 'path' | 'query' | 'meta'>) {
  const knowledgePage = knowledgePageFor(target)
  if (knowledgePage) return knowledgeNavigation.find(item => item.page === knowledgePage)!.label
  return target.path === '/projects' ? '工程' : target.path === '/ai-icons' ? 'AI 图标' : target.path === '/knowledge' && target.query.tab === 'models' ? '模型服务' : String(target.meta.title ?? '页面')
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
  '/knowledge': '选择知识库，检索关键词并阅读文档、原文和分块。',
  '/knowledge/qa': '对当前知识库提问，或使用已有 Agent 进行问答。',
  '/knowledge/manage': '管理知识连接、服务和同步来源，查看执行回执。',
  '/overview': '查看所有已登记工程，点击进入所选工程概览。',
  '/resources': '查看所选工程的已保存规范与资源读取状态。',
  '/image-assets': '导入候选图片、审阅并保存。保存结果以服务回执为准。',
  '/services': '查看服务连接状态和最近读取结果。',
}
const pageInfo = computed(() => route.path === '/knowledge' && route.query.tab === 'models' ? '查看模型服务状态和已有服务操作。' : pageDescriptions[route.path] ?? String(route.meta.description ?? ''))
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
      <nav class="nav-list" aria-label="主导航">
        <template v-for="item in nav" :key="item.path">
          <div v-if="item.path === '/knowledge'" class="knowledge-nav-group">
            <button class="nav-item knowledge-nav-toggle" type="button" :aria-expanded="knowledgeExpanded" aria-controls="knowledge-navigation" @click="knowledgeExpanded = !knowledgeExpanded"><span>知识库</span><el-icon aria-hidden="true" :class="{ 'is-expanded': knowledgeExpanded }"><ArrowDown/></el-icon></button>
            <div v-show="knowledgeExpanded" id="knowledge-navigation" class="knowledge-nav-children">
              <RouterLink v-for="child in knowledgeNavigation" :key="child.path" :to="child.path" class="nav-item knowledge-nav-child" :class="{ 'is-active': isNavActive(child.path) }" active-class="" :aria-current="isNavActive(child.path) ? 'page' : undefined" @click="menuOpen = false">{{ child.label }}</RouterLink>
            </div>
          </div>
          <RouterLink v-else :to="projectLink(item.path)" class="nav-item" :class="{ 'is-active': isNavActive(item.path) }" active-class="" :aria-current="isNavActive(item.path) ? 'page' : undefined" @click="menuOpen = false"><span>{{ item.label }}</span></RouterLink>
          <RouterLink v-if="item.path === '/projects'" :to="projectLink('/art-resources')" class="nav-item" :class="{'is-active':route.path==='/art-resources'}" :aria-current="route.path==='/art-resources'?'page':undefined" @click="menuOpen=false">美术资源</RouterLink>
        </template>
      </nav>

      <div class="sidebar-footer"><div>前端 v{{ frontendIdentity.version }}</div><div v-if="frontendBuildIdentity!=='unavailable'" class="frontend-build" title="源码构建标识，与产品版本分别记录">构建 {{ frontendBuildIdentity }}</div><div class="backend-version" :title="backendVersionInformation.detail">后端 {{ backendVersionInformation.label }}</div></div>
    </aside>
    <div class="main-shell">
      <header class="topbar">
        <div class="topbar-left"><el-button class="mobile-menu" :icon="Menu" text aria-label="打开导航" @click="menuOpen = !menuOpen"/><button v-if="route.path === '/projects' || compactOverview" class="page-back compact-page-back" type="button" :aria-label="returnLabel" :title="returnDisabled && !returning ? '已在工程页面' : returnLabel" :disabled="returnDisabled" @click="returnWithinApp"><el-icon aria-hidden="true"><ArrowLeft/></el-icon></button><ShellBreadcrumb/><InfoTip v-if="(route.path === '/projects' || compactOverview) && pageInfo" :label="`${pageTitle}说明`" :text="pageInfo"/></div>
        <div class="topbar-right"><CompanionUserMenu v-if="companionBrowserProvider" :busy="loggingOut" @logout="logoutBrowserSession"/><RouterLink to="/changelog" class="frontend-version" aria-label="查看前端版本与更新记录">前端 v{{ frontendIdentity.version }}</RouterLink><RouterLink to="/help" class="utility-link" @click="menuOpen = false">帮助</RouterLink><RouterLink to="/about" class="utility-link" @click="menuOpen = false">关于</RouterLink><el-tag v-if="showRegisteredChrome" :type="registered.currentSource ? 'success' : 'info'" round>{{ registered.currentSource ? '真实工程' : '未连接' }}</el-tag><el-tag v-else-if="showProjectContext && store.mode === 'disconnected'" type="info" effect="plain" round>未连接</el-tag><el-tag v-else-if="showProjectContext && store.isDemo" class="demo-tag" effect="light" round>示例模式</el-tag><el-tag v-else-if="showProjectContext" :type="store.connection === 'connected' ? 'success' : 'warning'" round>{{ store.sourceLabel }}</el-tag></div>
      </header>
      <ShellRouteTabs/>
      <main class="main-content" :class="{ 'projects-main': route.path === '/projects' || compactOverview }">
        <div v-if="route.path !== '/projects' && !compactOverview" class="page-heading"><div class="page-title"><button class="page-back" type="button" :aria-label="returnLabel" :title="returnDisabled && !returning ? '已在工程页面' : returnLabel" :disabled="returnDisabled" @click="returnWithinApp"><el-icon aria-hidden="true"><ArrowLeft/></el-icon></button><h1>{{ pageTitle }}</h1><InfoTip v-if="pageInfo" :label="`${pageTitle}说明`" :text="pageInfo" /></div><div v-if="showRegisteredContext" class="page-heading-actions"><el-button v-if="legacyWorkspace" @click="store.openDemo">查看示例工作台</el-button><el-select v-if="registered.projects.length" :model-value="registered.project?.id ?? ''" class="project-select" aria-label="当前登记工程" placeholder="请选择工程" @update:model-value="selectRegisteredProject"><el-option v-for="project in registered.projects" :key="project.id" :label="project.name" :value="project.id"/></el-select><el-button v-if="companionBrowserProvider" :loading="registered.directory.projectLoading && !registered.directory.backgroundProjectRead" :disabled="registered.directory.projectLoading" @click="registered.directory.connect(companionBrowserProvider)">{{ registered.currentSource ? '重新连接工程' : '连接工程服务' }}</el-button><el-button v-if="registered.directory.provider" :icon="Refresh" text aria-label="刷新登记工程" :disabled="registered.directory.projectLoading" @click="registered.directory.refreshProjects()"/><el-button v-if="registered.directory.provider" :icon="Close" text aria-label="断开工程服务" @click="registered.directory.disconnect()"/></div><div v-else-if="showProjectContext" class="page-heading-actions"><el-select v-if="store.snapshot.projects.length" :model-value="store.selectedProjectId" class="project-select" aria-label="当前项目" @update:model-value="store.selectProject"><el-option v-for="project in store.snapshot.projects" :key="project.id" :label="project.name" :value="project.id"/></el-select><el-dropdown trigger="click"><el-button>数据源<el-icon class="button-trail"><ArrowDown/></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item @click="store.openDemo">查看示例资料</el-dropdown-item><el-dropdown-item v-if="liveProvider" @click="store.connect(liveProvider)">连接只读数据源</el-dropdown-item><el-dropdown-item :disabled="store.mode === 'disconnected'" divided @click="store.disconnect">断开并清空视图</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></div>
        <div v-if="showProjectContext && store.mode !== 'disconnected'" class="source-banner" :class="{ 'source-live': !store.isDemo }" role="status"><span class="source-dot"></span><div><strong>{{ store.isDemo ? '正在浏览示例资料' : store.sourceLabel }}</strong><span>{{ store.isDemo ? '演示数据 · 无真实服务连接' : `${store.snapshot.source.label} · ${dateLabel}` }}</span></div><InfoTip v-if="store.isDemo" label="示例数据说明" text="项目、资源与状态均为演示。未探测真实服务，未执行任何工程写入。"/><el-button :icon="Refresh" text aria-label="刷新数据源" :loading="store.loading" @click="store.refresh"/><el-button :icon="Close" text aria-label="断开数据源" @click="store.disconnect"/></div>
        <el-alert v-if="showProjectContext && store.error" type="error" show-icon :closable="false" title="读取失败，未显示任何缓存或示例数据" :description="store.error" class="connection-error"/>
        <div v-if="showRegisteredChrome && registered.currentSource" class="registered-source-note" role="status">{{ registered.currentSource.label }}<span v-if="registered.directory.observedAt"> · 读取于 {{ registered.directory.observedAt }}</span><InfoTip label="登记与状态读取说明" :text="registered.currentSource.runtimeProbesEnabled === false ? '当前仅读取工程登记，运行状态未探测。' : '运行状态来自原 Bridge 查询；可能更新后台状态和诊断日志，不启动 Creator。资源库存与验收记录没有包含在工程登记中。'"/></div>
        <el-alert v-if="showRegisteredChrome && !companionBrowserProvider" type="info" :closable="false" title="当前宿主未接入 Companion 工程读取接口" description="请通过原 Companion 同源工程服务打开。没有加载示例工程。"/>
        <el-alert v-if="showRegisteredChrome && registered.directory.projectError" type="error" :closable="false" title="工程读取失败" :description="registered.directory.projectError"/>
        <div v-if="showRegisteredChrome && registered.directory.warnings.length" class="registered-read-warnings"><InfoTip label="工程读取限制" :text="registered.directory.warnings.join('；')"/><span>部分状态或发现信息未读取</span></div>
        <KeepAlive>
          <ArtWorkspaceView v-if="artWorkspaceVisited" v-show="route.path==='/art-resources'"/>
        </KeepAlive>
        <RouterView v-slot="{ Component }">
          <KeepAlive :max="4">
            <component :is="Component" v-if="knowledgeCached" :key="knowledgeCacheKey" />
          </KeepAlive>
          <component :is="Component" v-if="!knowledgeCached && route.path!=='/art-resources'" />
        </RouterView>
      </main>
    </div>
    <CompanionSessionRecovery/>
  </div>
</template>
<style scoped>
.sidebar { overflow-y: auto; }
.sidebar-footer { display:grid; grid-template-columns:minmax(0,1fr); align-items:start; gap:5px; line-height:1.5; }
.sidebar-footer > div { min-width:0; width:100%; white-space:normal; overflow-wrap:anywhere; }
.nav-list { margin-top: 24px; }
.nav-list { gap: 3px; }
.nav-item { padding: 10px 14px; }
.art-nav-toggle, .knowledge-nav-toggle { width: 100%; border: 0; background: transparent; color: inherit; font: inherit; font-size: 13px; text-align: left; cursor: pointer; justify-content: space-between; }
.art-nav-toggle .el-icon, .knowledge-nav-toggle .el-icon { transform: rotate(-90deg); transition: transform .15s; }
.art-nav-toggle .el-icon.is-expanded, .knowledge-nav-toggle .el-icon.is-expanded { transform: rotate(0); }
.art-nav-children, .knowledge-nav-children { display: grid; gap: 3px; margin-top: 3px; }
.art-nav-child, .knowledge-nav-child { padding-left: 30px; }
.art-nav-toggle:focus-visible, .knowledge-nav-toggle:focus-visible { outline: 2px solid #cfc3ff; outline-offset: 2px; }
.supplementary-nav .is-active { color: #fff; font-weight: 600; }
.registered-source-note,.registered-read-warnings { display:flex; align-items:center; flex-wrap:wrap; gap:6px; color:var(--text-secondary,#637187); font-size:12px; margin-bottom:16px; overflow-wrap:anywhere; }
.projects-main { padding-top: 18px; }
.compact-page-back { flex-basis: 28px; width: 28px; height: 28px; }
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
