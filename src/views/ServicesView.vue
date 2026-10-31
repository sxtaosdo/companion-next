<script setup lang="ts">
import { sortProjectsByRecentOpen } from '../domain/recent-projects'
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, watch } from 'vue'
import ProjectStatusTag from '../components/ProjectStatusTag.vue'
import { Loading, CircleCheck, CircleClose, Link, Minus, QuestionFilled, Warning, Connection, Refresh, Lock } from '@element-plus/icons-vue'
import InfoTip from '../components/InfoTip.vue'
import { useWorkspaceStore } from '../stores/workspace'
import { useServiceStatusStore } from '../stores/service-status'
import { companionBrowserProvider, companionProjectEntryProvider } from '../companion-browser-integration'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { allowsLegacyWorkspace } from '../domain/project-workspace'
const store = useWorkspaceStore()
const status = useServiceStatusStore()
const legacy = computed(() => allowsLegacyWorkspace(import.meta.env.MODE, !!companionBrowserProvider.value) && !knowledgeReadProvider.value)
let active = false, attempted = false, disposed = false, entryGeneration = 0
function cancel() { entryGeneration++; status.cancelReads() }
function entryRead() {
  const source = companionBrowserProvider.value
  if (!active || disposed || attempted || document.visibilityState === 'hidden' || legacy.value || !source
    || companionProjectEntryProvider.value !== source || source.runtimeProbesEnabled === false || status.passive) return
  attempted = true
  if (!status.blockedReason) void status.refresh()
}
function enter() { if (!active && !disposed) { active = true; attempted = false; entryRead() } }
function leave() { active = false; cancel() }
watch([companionBrowserProvider, knowledgeReadProvider, companionProjectEntryProvider, legacy], ([project, knowledge, _entry, isLegacy]) => {
  cancel(); attempted = false
  status.bind(isLegacy ? null : project, isLegacy ? null : knowledge, { passive: import.meta.env.MODE === 'companion-readonly' })
  const generation = entryGeneration
  void nextTick(() => { if (generation === entryGeneration) entryRead() })
}, { immediate: true, flush: 'sync' })
function visibilityChanged() { if (document.visibilityState === 'hidden') { attempted = true; cancel() } }
onMounted(() => { document.addEventListener('visibilitychange', visibilityChanged); enter() })
onActivated(enter)
onDeactivated(leave)
onBeforeUnmount(() => { disposed = true; leave(); document.removeEventListener('visibilitychange', visibilityChanged) })
const fallback = [ { id: 'companion', name: 'Companion', role: '项目与规范', state: 'unknown', detail: '未配置只读数据源' }, { id: 'comfyui', name: 'ComfyUI', role: '本地素材生成', state: 'unknown', detail: '尚未读取生成服务状态' }, { id: 'cocos', name: 'Cocos Creator', role: '导入、绑定与运行', state: 'unknown', detail: '尚未读取引擎或 Bridge 状态' } ]
const services = computed(() => store.snapshot.services.length ? store.snapshot.services : fallback)
function label(state: string) { return ({ unknown: '未验证', available: '可用', unavailable: '不可用', degraded: '部分可用' })[state] ?? '未验证' }
function tagType(state: string): 'info' | 'success' | 'danger' | 'warning' { return ({ available: 'success', unavailable: 'danger', degraded: 'warning' })[state] as 'success' | 'danger' | 'warning' || 'info' }
const projectRows = computed(() => {
  const runtimes = new Map(status.projects?.statuses.map(item => [item.projectId, item]))
  return sortProjectsByRecentOpen(status.projects?.projects ?? []).map(project => ({ project, runtime: runtimes.get(project.id) }))
})
const missingStates = computed(() => projectRows.value.some(row => !row.runtime || row.runtime.state === 'unknown'))
const projectWarnings = computed(() => status.projects?.warnings ?? [])
const serviceWarnings = computed(() => status.services?.warnings ?? [])
const hasErrors = computed(() => !!status.projectError || !!status.serviceError || serviceWarnings.value.length > 0 || (!status.passive && missingStates.value) || projectWarnings.value.some(item => item.includes('未取得有效数据')))
const projectSource = computed(() => status.projectProvider?.label ?? '未接入工程读取来源')
const serviceSource = computed(() => status.knowledgeProvider?.label ?? '未接入服务读取来源')
const sourceInfo = computed(() => status.passive
  ? '仅读取工程登记，不请求 Bridge、Dashboard 或知识与模型探测。刷新不改变工程操作回执。'
  : '使用原 Companion 读取接口。Bridge 查询可能更新后台状态与诊断日志。这里只展示结果；工程操作结果未知时，仍需回工程页核对。知识服务读取不执行 CLI 或检索。')
const readLabel = computed(() => hasErrors.value ? '重试读取' : status.projectObservedAt || status.serviceObservedAt ? '刷新状态' : '读取服务状态')
type StatusTone='primary'|'info'|'success'|'warning'|'danger'
interface DisplayState { label:string; tone:StatusTone; busy?:boolean; disconnected?:boolean }
const apiState=computed<DisplayState>(()=>status.projectLoading?{label:'读取中',tone:'primary',busy:true}:status.projectError?{label:'读取失败',tone:'danger'}:status.projects?{label:'API 已响应',tone:'success'}:{label:'未读取',tone:'info'})
function serviceState(key:'knowledge'|'model'):DisplayState {
 if(status.serviceLoading)return {label:'读取中',tone:'primary',busy:true}
 const warning=serviceWarnings.value.some(text=>key==='model'?text.startsWith('模型'):text.startsWith('知识'))
 if(status.serviceError||warning)return {label:'读取失败',tone:'danger'}
 const running=status.services?.[key]?.running
 if(running===true)return {label:key==='model'?'启动器可达':'服务可达',tone:'success'}
 if(running===false)return {label:'未连接',tone:'info',disconnected:true}
 return status.services?{label:'状态未知 · 待核对',tone:'warning'}:{label:'未读取',tone:'info'}
}
function stateIcon(value:DisplayState){return value.busy?Loading:value.disconnected?Link:value.tone==='success'?CircleCheck:value.tone==='danger'?CircleClose:value.tone==='warning'?QuestionFilled:Minus}
function legacyIcon(state:string){return state==='available'?CircleCheck:state==='unavailable'?CircleClose:state==='degraded'?Warning:QuestionFilled}
</script>
<template>
  <template v-if="legacy">
    <section class="panel connection-panel"><div class="connection-icon"><el-icon :size="28"><Connection/></el-icon></div><div><span class="section-kicker">CONNECTION OVERVIEW</span><h2>{{ store.sourceLabel }}</h2><p>{{ store.snapshot.source.label }} · {{ store.snapshot.source.observedAt ? `读取于 ${store.snapshot.source.observedAt}` : '尚无真实读取时间' }}</p></div><el-button :icon="Refresh" :disabled="store.mode === 'disconnected'" :loading="store.loading" @click="store.refresh">重新读取</el-button></section>
    <div class="service-grid"><section v-for="service in services" :key="service.id" class="service-card panel"><div class="service-top"><span class="service-symbol">{{ service.name[0] }}</span><el-tag class="companion-status-tag" :type="tagType(service.state)" size="small" role="status"><el-icon class="companion-status-icon" aria-hidden="true"><component :is="legacyIcon(service.state)"/></el-icon>{{ label(service.state) }}{{ store.isDemo ? ' · 示例' : '' }}</el-tag></div><h2>{{ service.name }}</h2><p class="service-role">{{ service.role }}</p><div class="service-detail">{{ service.detail }}</div><div class="service-bottom"><span>状态来源</span><strong>{{ store.isDemo ? '示例占位，未探测' : store.mode === 'disconnected' ? '未连接' : store.connection !== 'connected' || !store.snapshot.services.length ? '未取得有效响应' : '只读服务响应' }}</strong></div></section></div>
    <section class="panel boundary-panel"><div class="section-heading"><h2><el-icon><Lock/></el-icon> 连接边界</h2><el-tag type="info">READ ONLY</el-tag></div><div class="boundary-grid"><div><strong>不主动访问 Windows</strong><p>这里运行在独立工作区。没有访问用户本机、ComfyUI 或 Creator。</p></div><div><strong>项目接口只读</strong><p>项目数据接口只提供读取方法。图片素材页使用独立审阅合同；工程生成、导入及绑定仍未接通。</p></div><div><strong>失败不回退成示例</strong><p>真实读取失败会清空视图并说明原因。示例资料只能由你显式选择。</p></div></div><ul class="limitation-list"><li v-for="item in store.snapshot.source.limitations" :key="item">{{ item }}</li></ul></section>
  </template>
  <div v-else class="real-services" data-testid="real-service-status" :aria-busy="status.loading">
    <section class="panel service-status-toolbar">
      <div><strong>{{ status.passive ? '被动只读状态' : '服务连接' }}</strong><InfoTip label="服务状态读取说明" :text="sourceInfo"/><p>{{ status.hasSource ? '各项状态以最近一次有效响应为准' : '当前宿主未接入状态读取来源' }}</p></div>
      <el-button :icon="Refresh" :disabled="!status.hasSource || status.loading || !!status.blockedReason" :loading="status.loading" @click="status.refresh">{{ readLabel }}</el-button>
    </section>
    <p v-if="status.blockedReason" class="service-read-notice" role="status">{{ status.blockedReason }}</p>
    <div class="service-grid real-service-grid">
      <section class="service-card panel" data-service="companion">
        <div class="service-top"><h2>Companion</h2><el-tag class="companion-status-tag" :type="apiState.tone" size="small" role="status" :aria-busy="!!apiState.busy"><el-icon class="companion-status-icon" :class="{'is-loading':apiState.busy}" aria-hidden="true"><component :is="stateIcon(apiState)"/></el-icon>{{ apiState.label }}</el-tag></div>
        <p class="service-role">{{ status.projectLoading ? '正在读取工程接口…' : status.projects ? '工程登记接口已返回有效响应' : status.projectError || '尚无有效工程响应' }}</p>
        <div v-if="status.projectError" class="service-warning" role="alert">读取失败，运行情况未知</div>
        <div class="service-evidence"><span>{{ projectSource }}</span><span>GET /api/projects</span><time v-if="status.projectObservedAt" :datetime="status.projectObservedAt">读取于 {{ status.projectObservedAt }}</time><span v-else>尚无有效读取时间</span></div>
        <InfoTip label="Companion 响应范围" text="API 已响应仅证明本次工程登记读取成功，不代表所有后台服务健康，也不代表 Creator 或 ComfyUI 已就绪。"/>
      </section>
      <section class="service-card panel" data-service="comfyui">
        <div class="service-top"><h2>ComfyUI</h2><el-tag class="companion-status-tag" type="warning" size="small" role="status"><el-icon class="companion-status-icon" aria-hidden="true"><QuestionFilled/></el-icon>状态未知 · 待核对</el-tag></div>
        <p class="service-role">当前 Companion 未提供 Comfy 健康详情</p>
        <div class="service-evidence"><span>原同源接口只提供启动器可达性</span><span>尚无有效读取时间</span></div>
        <InfoTip label="ComfyUI 状态说明" text="原启动器页面有 Comfy 详情，但 Companion 当前未转发该数据；这里不会跨源读取。启动器可达不能证明 ComfyUI 或生成链路已就绪。"/>
      </section>
      <section class="service-card panel" data-service="knowledge">
        <div class="service-top"><h2>知识服务</h2><el-tag class="companion-status-tag" :type="serviceState('knowledge').tone" size="small" role="status" :aria-busy="!!serviceState('knowledge').busy"><el-icon class="companion-status-icon" :class="{'is-loading':serviceState('knowledge').busy}" aria-hidden="true"><component :is="stateIcon(serviceState('knowledge'))"/></el-icon>{{ serviceState('knowledge').label }}</el-tag></div>
        <p class="service-role">{{ status.passive ? '被动模式未探测' : status.serviceLoading ? '正在读取服务状态…' : status.services?.knowledge ? `页面嵌入：${status.services.knowledge.frameable ? '允许' : '不允许'}` : '尚无有效服务响应' }}</p>
        <div class="service-evidence"><span>{{ status.passive ? '未请求知识服务' : serviceSource }}</span><span v-if="!status.passive">GET /api/knowledge-service/status</span><time v-if="status.services?.knowledge && status.serviceObservedAt" :datetime="status.serviceObservedAt">读取于 {{ status.serviceObservedAt }}</time><span v-else>尚无有效读取时间</span></div>
        <InfoTip label="知识服务状态说明" text="这里只展示服务 running 与 frameable，不执行知识 CLI 或检索验证；服务可达不代表认证和检索已通过。"/>
      </section>
      <section class="service-card panel" data-service="model">
        <div class="service-top"><h2>模型启动器</h2><el-tag class="companion-status-tag" :type="serviceState('model').tone" size="small" role="status" :aria-busy="!!serviceState('model').busy"><el-icon class="companion-status-icon" :class="{'is-loading':serviceState('model').busy}" aria-hidden="true"><component :is="stateIcon(serviceState('model'))"/></el-icon>{{ serviceState('model').label }}</el-tag></div>
        <p class="service-role">{{ status.passive ? '被动模式未探测' : status.serviceLoading ? '正在读取服务状态…' : '各模型就绪情况未验证' }}</p>
        <div class="service-evidence"><span>{{ status.passive ? '未请求模型启动器' : serviceSource }}</span><span v-if="!status.passive">GET /api/model-service/status</span><time v-if="status.services?.model && status.serviceObservedAt" :datetime="status.serviceObservedAt">读取于 {{ status.serviceObservedAt }}</time><span v-else>尚无有效读取时间</span></div>
        <InfoTip label="模型启动器状态说明" text="running 仅表示模型启动器可达，不能证明某个模型、ComfyUI 或生成任务可用。"/>
      </section>
    </div>
    <div v-if="status.serviceError || serviceWarnings.length" class="service-read-notice" role="alert"><span>{{ status.serviceError || '部分服务状态读取失败，缺少响应的服务显示为未知' }}</span><InfoTip v-if="serviceWarnings.length" label="服务读取错误详情" :text="serviceWarnings.join('；')"/></div>
    <section class="panel creator-status-panel" data-service="creator">
      <div class="section-heading"><div class="service-title"><h2>Cocos Creator / Bridge</h2><InfoTip label="Creator 状态说明" text="逐项显示已登记工程及原始运行状态。缺少状态、版本或 Bridge 能力不会推断为离线或已停止；未登记的发现工程不会计入。"/></div><span>{{ status.projects ? `${status.projects.projects.length} 个已登记工程` : '工程数量未读取' }}</span></div>
      <div class="service-evidence creator-evidence"><span>{{ projectSource }}</span><span>{{ status.passive ? '仅读取登记，运行状态未探测' : 'GET /api/projects · GET /api/status' }}</span><time v-if="status.projectObservedAt" :datetime="status.projectObservedAt">读取于 {{ status.projectObservedAt }}</time></div>
      <div v-if="projectWarnings.length || missingStates" class="service-read-notice"><span>{{ status.passive ? '运行状态未探测' : '部分状态或发现信息未读取' }}</span><InfoTip label="工程状态读取详情" :text="projectWarnings.length ? projectWarnings.join('；') : '部分登记工程没有返回状态，显示为未知。'"/></div>
      <p v-if="!status.projects" class="service-empty">{{ status.projectLoading ? '正在读取已登记工程…' : status.projectError || '尚未读取已登记工程' }}</p>
      <p v-else-if="!projectRows.length" class="service-empty">暂无已登记工程</p>
      <article v-for="row in projectRows" :key="row.project.id" class="creator-status-row" :data-project-id="row.project.id">
        <div class="creator-row-title"><div><h3>{{ row.project.name }}</h3><p>{{ row.project.path }}</p></div><ProjectStatusTag :status="row.runtime" :passive="status.passive"/></div>
        <dl><div><dt>当前 Creator</dt><dd>{{ row.runtime?.creatorVersion ?? '未读取' }}</dd></div><div><dt>工程要求版本</dt><dd>{{ row.project.requiredCreatorVersion ?? '未记录' }}</dd></div><div><dt>Bridge 能力</dt><dd>{{ row.runtime?.capabilityProfile ?? 'unknown' }}</dd></div><div><dt>运行会话</dt><dd>{{ row.runtime?.sessionId ?? '未返回' }}</dd></div></dl>
        <p v-if="row.runtime?.lastError" class="service-warning">{{ row.runtime.lastError }}</p>
      </article>
    </section>
  </div>
</template>
<style scoped>
.service-status-toolbar{padding:18px 20px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:16px}.service-status-toolbar p{margin-top:5px;font-size:12px;color:var(--el-text-color-secondary)}.real-service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.real-service-grid .service-card{min-width:0;padding:20px}.real-service-grid .service-top{gap:12px}.real-service-grid h2{font-size:17px;margin:0}.real-service-grid .service-role{font-size:12px;line-height:1.6;min-height:20px}.service-evidence{display:grid;gap:5px;margin-top:16px;font-size:11px;color:var(--el-text-color-secondary);overflow-wrap:anywhere;line-height:1.6}.service-warning{margin-top:10px;font-size:12px;color:var(--el-color-danger);overflow-wrap:anywhere}.service-read-notice{display:flex;align-items:center;gap:6px;margin-top:12px;font-size:12px;color:var(--el-color-warning-dark-2);line-height:1.6}.creator-status-panel{margin-top:18px;padding:20px}.creator-status-panel .section-heading{margin:0;gap:12px}.service-title{display:flex;align-items:center;gap:4px}.service-title h2{font-size:17px}.creator-evidence{margin-top:10px}.service-empty{padding:24px 0;font-size:13px;color:var(--el-text-color-secondary)}.creator-status-row{padding:18px 0;border-top:1px solid var(--el-border-color-lighter);margin-top:16px;min-width:0}.creator-row-title{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.creator-row-title h3{font-size:14px}.creator-row-title p{font-size:11px;color:var(--el-text-color-secondary);margin-top:5px;overflow-wrap:anywhere}.creator-status-row dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:16px 0 0;font-size:12px}.creator-status-row dt{color:var(--el-text-color-secondary);margin-bottom:5px}.creator-status-row dd{margin:0;overflow-wrap:anywhere}.creator-row-title .el-tag{flex-shrink:0}.real-service-grid .inline-info-tip{margin-top:8px}@media(max-width:760px){.real-service-grid{grid-template-columns:1fr}.service-status-toolbar{align-items:flex-start;flex-wrap:wrap;padding:16px}.creator-status-panel{padding:16px}.creator-status-row dl{grid-template-columns:repeat(2,minmax(0,1fr))}.creator-row-title{flex-wrap:wrap}.creator-status-panel .section-heading{align-items:flex-start}.service-title h2{font-size:15px}}
</style>
