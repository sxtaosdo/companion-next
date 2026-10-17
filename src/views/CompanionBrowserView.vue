<script setup lang="ts">
import LogTools from '../components/LogTools.vue'
import InfoTip from '../components/InfoTip.vue'
import ProjectStatusTag from '../components/ProjectStatusTag.vue'
import { useCompanionProjectEntry } from '../composables/use-companion-project-entry'
import { ElMessage } from 'element-plus'
import { Refresh,SwitchButton,VideoPlay,Position,FolderOpened,Delete,DocumentCopy,Connection,ArrowRight,ArrowDown } from '@element-plus/icons-vue'
import ProjectSetupWizard from '../components/ProjectSetupWizard.vue'
import { projectSetupProvider } from '../project-setup-integration'
import type { CreatorAction } from '../domain/creator-operations'
import CreatorOperationDialog from '../components/CreatorOperationDialog.vue'
import { creatorOperationsProvider } from '../creator-operations-integration'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import CliUseDialog from '../components/CliUseDialog.vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { companionBrowserProvider, companionEventProvider } from '../companion-browser-integration'
import { projectDisplayPathKey, projectDisplayRank } from '../domain/companion-project-display'
import { LOG_SOURCES, LOG_LEVELS, runtimeStateLabel } from '../domain/companion-browser'
const store=useCompanionBrowserStore(),route=useRoute(),router=useRouter(),operations=useCreatorOperationsStore()
const creatorDialog=ref<InstanceType<typeof CreatorOperationDialog>|null>(null)
const setupDialog=ref<InstanceType<typeof ProjectSetupWizard>|null>(null),setupDialogOpen=ref(false)
watch(()=>operations.dialogOpen||setupDialogOpen.value,open=>store.pauseProjectPolling(open),{flush:'sync',immediate:true})
function openSetup(id:string){operations.closeDialog();setupDialog.value?.openForProject(id)}
function openCreator(id:string,action:CreatorAction){setupDialog.value?.close();creatorDialog.value?.open(id,action)}
let mounted=true
async function directCreator(id:string,action:'start'|'focus'){
 const previousId=operations.receipt?.id,source=store.provider
 const sending=operations.direct(id,action),receiptId=operations.receipt?.id
 const acknowledged=await sending
 if(!mounted||store.provider!==source)return
 if(acknowledged&&receiptId!==undefined&&operations.isReceiptCurrent(receiptId)){
  ElMessage.success(action==='start'?'已收到启动回执，正在核对状态。':'已收到打开 Creator 回执。')
  await operations.refreshStatus(receiptId)
 }else if(receiptId===previousId&&operations.error)ElMessage.warning('操作未发出，请核对连接与工程状态。')
}
const noticeKeys=new Set<string>(),toastRecords=new Set(operations.receipts.map(record=>`${record.id}:${record.phase}`))
const informational=(text:string)=>text.startsWith('Dashboard 发现未启用')||text.startsWith('运行状态未探测')
const criticalWarnings=computed(()=>store.warnings.filter(w=>!informational(w)))
const warningTitle=(text:string)=>text.startsWith('运行状态未取得')?'运行状态读取失败，请刷新重试。':text.startsWith('Dashboard 工程列表未取得')?'Dashboard 工程读取失败。':text.startsWith('部分登记工程')?'部分工程状态未知。':text.startsWith('部分运行状态')?'存在未登记的运行状态。':text
watch(()=>[store.provider,store.connected],()=>{noticeKeys.clear()},{flush:'sync'})
watch(()=>store.warnings,warnings=>{if(!store.connected)return;for(const text of warnings){if(informational(text)&&!noticeKeys.has(text)){noticeKeys.add(text);ElMessage.info(text.startsWith('Dashboard')?'未启用 Dashboard 发现；状态来自 Bridge 查询。':'只读模式：未探测运行状态。')}}},{deep:true})
watch(()=>operations.receipts,records=>{for(const record of records){const key=`${record.id}:${record.phase}`;if(record.phase==='sending'||toastRecords.has(key))continue;toastRecords.add(key);if(!mounted||record.detached||!operations.isReceiptCurrent(record.id)||(record.phase==='acknowledged'&&['start','focus'].includes(record.action)))continue;const message=record.phase==='acknowledged'?'已收到操作回执。':record.phase==='unknown'?'操作结果未知，请刷新状态后核对。':record.phase==='reported-failure'?'后台报告操作失败，请核对状态与日志。':'操作未完成，请核对状态与日志。';ElMessage({message,type:record.phase==='acknowledged'?'success':'warning',duration:5000})}},{deep:true})
function activeRecord(id:string){return [...operations.receipts].reverse().find(record=>record.project.id===id&&operations.isReceiptCurrent(record.id))}
function directLoading(id:string){const record=activeRecord(id);return !!record&&['start','focus'].includes(record.action)&&(record.phase==='sending'||(operations.transportPending&&record.id===operations.receipt?.id))}
function needsAttention(id:string){const record=activeRecord(id);return !!record&&['unknown','reported-failure','rejected'].includes(record.phase)}
function directAction(id:string){return state(id)?.state==='ready'?'focus' as const:'start' as const}

const tab=computed(()=>['logs','calls'].includes(String(route.query.tab))?String(route.query.tab):'projects')
const cliOpen=ref(false),cliProjectId=ref('')
const cliProject=computed(()=>store.connected?store.projects.find(project=>project.id===cliProjectId.value)??null:null)
let cliOpenGeneration=0
async function openCli(id:string){const target=store.projects.find(project=>project.id===id);if(!store.connected||!target)return;const generation=++cliOpenGeneration,source=store.provider,key=JSON.stringify([target.id,target.name,target.path]);copyNotice.value='';cliOpen.value=false;cliProjectId.value=id;await nextTick();const current=cliProject.value;if(generation===cliOpenGeneration&&source===store.provider&&store.connected&&current&&JSON.stringify([current.id,current.name,current.path])===key)cliOpen.value=true}
const query=ref(''),filter=ref('all'),expanded=ref<Record<string,boolean>>({}),copyNotice=ref('')
const queryInput=ref<{focus:()=>void}|null>(null),logPane=ref<HTMLElement|null>(null)
const showLatest=ref(false)
function nearLogBottom(node:HTMLElement){return node.scrollHeight-node.scrollTop-node.clientHeight<=24}
function updateLatest(){const node=logPane.value;showLatest.value=!!node&&store.logs.length>0&&node.scrollHeight>node.clientHeight+1&&!nearLogBottom(node)}
function scrollLatest(){const node=logPane.value;if(!node)return;node.scrollTop=node.scrollHeight;updateLatest()}
let logResizeObserver:ResizeObserver|undefined
watch(logPane,node=>{logResizeObserver?.disconnect();if(node&&typeof ResizeObserver!=='undefined'){logResizeObserver=new ResizeObserver(updateLatest);logResizeObserver.observe(node)}updateLatest()},{flush:'post'})
watch(()=>store.logs,async()=>{const node=logPane.value,stick=!!node&&node.scrollHeight>node.clientHeight+1&&nearLogBottom(node);await nextTick();if(!mounted)return;if(stick&&node===logPane.value)scrollLatest();else updateLatest()},{deep:true,flush:'pre'})
window.addEventListener('resize',updateLatest)
const passiveRead=computed(()=>(store.provider ?? companionBrowserProvider.value)?.runtimeProbesEnabled===false)
const dashboardRead=computed(()=>!passiveRead.value&&(store.dashboardRead||(store.provider ?? companionBrowserProvider.value)?.dashboardDiscoveryEnabled!==false))
const state=(id:string)=>store.statuses.find(status=>status.projectId===id)
const matching=computed(()=>store.projects.filter(project=>{
 const status=state(project.id)?.state??'unknown',starting=['launching','bridge-wait'].includes(status)
 if(filter.value==='running'&&status!=='ready'&&!starting)return false
 if(filter.value==='stopped'&&status!=='stopped')return false
 return [project.id,project.name,project.path,status,runtimeStateLabel(status)].join('\n').toLowerCase().includes(query.value.trim().toLowerCase())
}).sort((left,right)=>{const a=projectDisplayRank(state(left.id)?.state,dashboardFor(left.path)?.lastOpenedAt),b=projectDisplayRank(state(right.id)?.state,dashboardFor(right.path)?.lastOpenedAt);return b[0]-a[0]||b[1]-a[1]}))
function isExpanded(id:string){if(id in expanded.value)return expanded.value[id];try{const value=sessionStorage.getItem(`project-card-expanded:${id}`);if(value==='1'||value==='0')return value==='1'}catch{/* denied preference storage does not prevent reads */}return state(id)?.state!=='stopped'}
function toggle(id:string){const value=!isExpanded(id);expanded.value={...expanded.value,[id]:value};try{sessionStorage.setItem(`project-card-expanded:${id}`,value?'1':'0')}catch{/* noncritical preference only */}}
function dashboardFor(path:string){return store.dashboard.find(item=>projectDisplayPathKey(item.path)===projectDisplayPathKey(path))}
function displayDate(value:string|number|undefined){if(value===undefined)return '未记录';const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString():'时间未知'}
async function copy(text:string){try{await navigator.clipboard.writeText(text);ElMessage.success('已复制')}catch{ElMessage.warning('复制未完成，请手动选择复制。')}}
function showCalls(id:string){store.setCallContext(id,false);void router.push({path:'/projects',query:{tab:'calls'}});void store.loadCalls()}
function callProject(value:string){store.setCallContext(value,store.failedOnly);void store.loadCalls()}
function callFilter(value:boolean){store.setCallContext(store.callProjectId,value);void store.loadCalls()}
function shortcuts(event:KeyboardEvent){const node=event.target as HTMLElement|null;if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!node?.closest('input,textarea,select,[contenteditable="true"]')&&tab.value==='projects'){event.preventDefault();queryInput.value?.focus()}}
function visibility(){store.setLiveVisibility(document.visibilityState==='visible')}
visibility();document.addEventListener('visibilitychange',visibility)
const liveLabel=computed(()=>({off:'实时更新未启用',connecting:'事件流连接中',open:'事件流已连接',retrying:'事件流冷却重连中',suspended:'页面隐藏，实时读取已暂停',failed:'事件流已停止，工程轮询仍独立运行'})[store.liveState])
document.addEventListener('keydown',shortcuts)
watch(passiveRead,passive=>{if(passive)filter.value='all'},{flush:'sync',immediate:true})
watch(companionBrowserProvider,next=>{if(store.provider&&store.provider!==next)store.disconnect()},{flush:'sync',immediate:true})
watch(companionEventProvider,()=>{store.stopLive()},{flush:'sync'})
useCompanionProjectEntry(store, () => tab.value === 'projects')
onBeforeUnmount(()=>{mounted=false;logResizeObserver?.disconnect();window.removeEventListener('resize',updateLatest);store.cancelReads();store.pauseProjectPolling(false);document.removeEventListener('keydown',shortcuts);document.removeEventListener('visibilitychange',visibility)})
</script>
<template>
 <section class="companion-browser-page" data-testid="companion-browser-page">
  <div class="panel companion-connect compact-connect">
   <div class="planner-import-actions"><el-button v-if="companionBrowserProvider" type="primary" :icon="Connection" :loading="store.projectLoading&&!store.backgroundProjectRead" :disabled="store.projectLoading" @click="store.connect(companionBrowserProvider!)">{{ creatorOperationsProvider ? '连接工程服务' : '连接 Companion 只读会话' }}</el-button><el-button :icon="Refresh" :disabled="!store.provider" :title="creatorOperationsProvider?'刷新真实状态':'刷新工程快照'" :aria-label="creatorOperationsProvider?'刷新真实状态':'刷新工程快照'" @click="store.refreshProjects()"/><el-button :icon="SwitchButton" :disabled="!store.provider" title="断开并清空" aria-label="断开并清空" @click="store.disconnect()"/><el-tag :type="store.connected?'success':'info'">{{ store.connected?'已连接':'未连接' }}</el-tag><InfoTip label="工程连接说明" :text="passiveRead?'只读模式：仅读取工程登记，不探测 Bridge 或 Dashboard，缺少状态不会视为已停止。':`读取 Bridge 状态可能更新后台状态和诊断日志。${dashboardRead?'包含 Dashboard 发现。':'未启用 Dashboard 发现，最近打开时间未读取。'}${store.provider?`来源：${store.provider.label}。`:''}${store.observedAt?`读取时间：${displayDate(store.observedAt)}`:''}`"/><ProjectSetupWizard v-if="projectSetupProvider" ref="setupDialog" @dialog-visibility="setupDialogOpen=$event"/></div>
   <div class="planner-import-actions"><el-button :disabled="!store.connected||!companionEventProvider" :type="store.liveEnabled?'primary':'default'" @click="store.liveEnabled?store.stopLive():store.startLive(companionEventProvider!)">{{ store.liveEnabled?'停止实时更新':'启用实时更新' }}</el-button><span role="status" data-testid="live-state" class="compact-live-state">{{ liveLabel }}</span><InfoTip label="实时更新说明" text="可见页约每3秒更新工程，隐藏或离页暂停。日志与调用通过事件流更新；没有回放或心跳，不保证无遗漏。确认弹窗期间暂停工程自动刷新。"/></div>
  </div>
  <CreatorOperationDialog v-if="creatorOperationsProvider" ref="creatorDialog"/>
  <CliUseDialog v-model="cliOpen" :project="cliProject" :source="store.provider" @warning="ElMessage.warning($event)"/>
  <div v-if="operations.transportPending&&!operations.pending&&operations.error" class="compact-warning" role="status">请求尚未结束，暂不能重复操作。<InfoTip label="请求清理详情" :text="operations.error"/></div>
  <el-alert v-if="store.projectError" title="工程读取失败" :description="store.projectError" type="error" :closable="false"/>
  <el-alert v-if="store.liveError" title="实时更新受限" :description="store.liveError" type="warning" :closable="false"/>
  <div v-for="warning in criticalWarnings" :key="warning" class="compact-warning" role="status"><span>{{ warningTitle(warning) }}</span><InfoTip label="读取问题详情" :text="warning"/></div>
  <nav class="companion-tabs" aria-label="工程与记录功能"><RouterLink to="/projects" :class="{active:tab==='projects'}">工程列表</RouterLink><RouterLink to="/projects?tab=logs" :class="{active:tab==='logs'}">日志查询</RouterLink><RouterLink to="/projects?tab=calls" :class="{active:tab==='calls'}">调用记录</RouterLink></nav>
  <section v-if="tab==='projects'" class="panel">
   <div class="section-heading"><div class="section-title-inline"><h2>工程</h2><InfoTip label="工程操作说明" text="点击启动或打开 Creator 直接调用原启动/聚焦接口，不安装 Bridge、不配置 Codex。停止、重启、移除和安装接入需另行确认。结果未知时先核对状态与日志，不自动重发。"/></div><span>{{ store.connected?`${matching.length} / ${store.projects.length} 个登记工程`:'工程数量未读取' }}</span></div>
   <div class="companion-filters"><el-input ref="queryInput" v-model="query" placeholder="名称、路径、ID、状态；按 / 聚焦" aria-label="搜索登记工程"/><el-select v-model="filter" aria-label="工程状态筛选"><el-option label="全部" value="all"/><el-option label="运行 / 启动中" value="running" :disabled="passiveRead"/><el-option label="已停止" value="stopped" :disabled="passiveRead"/></el-select><el-button :loading="store.countsLoading" :disabled="!store.connected" @click="store.refreshCounts()">刷新调用统计</el-button></div>
   <el-alert v-if="store.countsError" :title="store.countsError" type="warning" :closable="false"/>
   <article v-for="project in matching" :key="project.id" class="companion-project-card"><div class="companion-project-header">
    <el-button class="project-expand" text :icon="isExpanded(project.id)?ArrowDown:ArrowRight" :title="isExpanded(project.id)?'收起':'展开'" :aria-label="isExpanded(project.id)?'收起':'展开'" :aria-expanded="isExpanded(project.id)" :aria-controls="`project-detail-${project.id}`" @click="toggle(project.id)"/>
    <h3 :title="project.name">{{ project.name }}</h3><ProjectStatusTag :status="state(project.id)" :passive="passiveRead"/><code class="project-header-id" :title="project.id">{{ project.id }}</code>
    <div v-if="creatorOperationsProvider" class="planner-import-actions creator-main-actions">
     <el-button type="primary" :icon="state(project.id)?.state==='ready'?Position:VideoPlay" :loading="directLoading(project.id)" :disabled="!operations.canPrepare(project.id,directAction(project.id))" @click="directCreator(project.id,directAction(project.id))">{{ state(project.id)?.state==='ready'?'打开 Creator':'启动 Creator' }}</el-button>
     <el-button :icon="Position" :disabled="!operations.canPrepare(project.id,'focus')" title="聚焦 Creator" aria-label="聚焦 Creator" @click="directCreator(project.id,'focus')"/>
     <el-button :icon="SwitchButton" :disabled="!operations.canPrepare(project.id,'stop')" title="停止 Creator" aria-label="停止 Creator" @click="openCreator(project.id,'stop')"/>
     <el-button :icon="Refresh" :disabled="!operations.canPrepare(project.id,'restart')" title="重启 Creator" aria-label="重启 Creator" @click="openCreator(project.id,'restart')"/>
     <span class="operation-availability"><InfoTip v-if="!store.backgroundProjectRead&&operations.blockingReason(project.id,directAction(project.id))" label="工程操作暂不可用" :text="operations.blockingReason(project.id,directAction(project.id))"/></span>
     <span v-if="needsAttention(project.id)" class="compact-operation-warning" role="status">需核对状态与日志 <InfoTip label="操作结果详情" :text="activeRecord(project.id)?.message??''"/></span>
    </div></div>
    <div v-if="isExpanded(project.id)" :id="`project-detail-${project.id}`" class="companion-project-body"><p class="companion-project-path">{{ project.path }}</p><div class="planner-import-actions"><el-button v-if="projectSetupProvider" size="small" :disabled="!operations.canPrepare(project.id,'open-folder')" @click="openSetup(project.id)">安装 / 更新接入</el-button><el-button v-if="creatorOperationsProvider" :icon="FolderOpened" size="small" :disabled="!operations.canPrepare(project.id,'open-folder')" @click="openCreator(project.id,'open-folder')">打开目录</el-button><el-button v-if="creatorOperationsProvider" :icon="Delete" size="small" type="danger" plain :disabled="!operations.canPrepare(project.id,'remove-registration')" @click="openCreator(project.id,'remove-registration')">移除登记</el-button><el-button :icon="DocumentCopy" size="small" @click="copy(project.path)">复制路径</el-button><el-button size="small" @click="copy(project.id)">复制工程 ID</el-button><el-button size="small" @click="openCli(project.id)">使用 CLI</el-button><el-button size="small" @click="showCalls(project.id)">查看调用记录</el-button></div>
     <dl class="companion-project-details"><div><dt>当前 Creator</dt><dd>{{ state(project.id)?.creatorVersion || '未读取' }}</dd></div><div><dt>工程要求版本</dt><dd>{{ project.requiredCreatorVersion || '未记录' }}</dd></div><div><dt>Creator 权限</dt><dd>{{ state(project.id)?.capabilityProfile || 'unknown' }}<InfoTip label="Creator 权限说明" text="这是 Bridge 返回的能力状态，不代表当前工程的工具预设范围。"/></dd></div><div><dt>最近打开</dt><dd>{{ !dashboardRead ? '未读取' : displayDate(dashboardFor(project.path)?.lastOpenedAt) }}</dd></div><div><dt>调用总数</dt><dd>{{ store.counts?.counts[project.id]??'未记录' }}<InfoTip label="调用统计说明" text="本服务会话内的调用次数，服务重启后重新计数。没有记录不推断为零。"/></dd></div><div><dt>原始状态</dt><dd>{{ state(project.id)?.state??'unknown' }}</dd></div></dl>
     <p v-if="state(project.id)?.lastError" class="form-help">状态说明：{{ state(project.id)?.lastError }}</p><p v-if="store.counts?.latest[project.id]" class="form-help">最近调用：{{ store.counts.latest[project.id]?.operationNameZh }} · {{ store.counts.latest[project.id]?.status }} · {{ displayDate(store.counts.latest[project.id]?.startedAt) }}</p>
    </div>
   </article><el-empty v-if="!matching.length" :description="store.connected?'当前筛选没有登记工程':'连接后显示工程'"/>

  </section>
  <section v-if="tab==='logs'" class="panel"><div class="section-heading"><h2>日志查询</h2><span>{{ store.logsRead?`${store.logs.length} 条返回记录`:'日志未读取' }}</span></div>
   <div class="companion-log-toolbar"><el-select v-model="store.logFilter.projectIds" multiple collapse-tags aria-label="日志工程筛选" placeholder="全部工程（不选）"><el-option v-for="project in store.projects" :key="project.id" :value="project.id" :label="project.name"/></el-select><el-select v-model="store.logFilter.sources" multiple collapse-tags aria-label="日志来源筛选" placeholder="全部来源（不选）"><el-option v-for="source in LOG_SOURCES" :key="source" :value="source" :label="source"/></el-select><el-select v-model="store.logFilter.levels" multiple collapse-tags aria-label="日志级别筛选" placeholder="全部级别（不选）"><el-option v-for="level in LOG_LEVELS" :key="level" :value="level" :label="level"/></el-select><el-input v-model="store.logFilter.search" :maxlength="512" aria-label="日志消息关键字" placeholder="消息关键字"/><el-button :disabled="!store.connected" :loading="store.logsLoading" @click="store.refreshLogs(true)">查询 / 刷新日志</el-button><el-button :disabled="!store.liveEnabled" @click="store.pauseLogs(!store.logsPaused)">{{ store.logsPaused?'恢复实时日志':'暂停实时日志' }}</el-button><span v-if="store.logsPaused" class="compact-live-state">实时日志已暂停</span><InfoTip label="日志范围说明" text="最多最新200条，按旧到新排列，无历史分页。暂停只影响实时日志，手动查询、工程和调用仍可读取。"/><LogTools @cleared="store.refreshLogs(true)"/></div><el-alert v-if="store.logsError" :title="store.logsError" type="error" :closable="false"/>
   <div class="companion-log-wrap"><div ref="logPane" class="companion-log-pane" tabindex="0" aria-label="原日志文本" @scroll="updateLatest"><article v-for="log in store.logs" :key="log.id"><small>{{ displayDate(log.time) }} · {{ log.level }} · {{ log.source }} · {{ log.projectId }}</small><pre>{{ log.message }}</pre></article></div><button v-if="showLatest" class="companion-scroll-latest" type="button" title="滚动到最新日志" aria-label="滚动到最新日志" @click="scrollLatest">↓ 最新</button></div><el-empty v-if="!store.logs.length" :description="store.logsRead?'本次条件返回空日志':'尚未查询或筛选已变，请重新读取'"/>
  </section>
  <section v-if="tab==='calls'" class="panel"><div class="section-heading"><h2>已有调用记录</h2><InfoTip label="调用记录说明" text="仅查询已有记录，不执行或重放工具调用。"/></div><div class="companion-filters"><el-select :model-value="store.callProjectId" aria-label="调用记录工程" placeholder="选择工程" @change="callProject"><el-option v-for="project in store.projects" :key="project.id" :value="project.id" :label="project.name"/></el-select><el-select :model-value="store.failedOnly" aria-label="调用记录筛选" @change="callFilter"><el-option label="全部调用" :value="false"/><el-option label="仅失败" :value="true"/></el-select><el-button :loading="store.callLoading" :disabled="!store.connected||!store.callProjectId" @click="store.loadCalls()">读取 / 刷新调用</el-button></div>
   <p class="compact-call-summary">累计 {{ store.total??'未读取' }} 次 · 保留 {{ store.retained??'未读取' }} 条 <InfoTip label="调用分页说明" :text="`每页最多50条，详情最多保留1000条；服务重启清零。总数不等于当前失败筛选数量。${store.sessionId?`会话：${store.sessionId}`:''}`"/></p><el-alert v-if="store.callError" :title="store.callError" type="error" :closable="false"/>
   <details v-for="record in store.records" :key="record.id" class="companion-call-record"><summary><strong>{{ record.operationNameZh }}</strong> · {{ record.source }} · {{ record.status }} · {{ record.durationMs===undefined?'耗时未结束':`${record.durationMs} ms` }} · {{ displayDate(record.startedAt) }}<code>{{ record.operation }}</code></summary><h4>参数摘要</h4><pre>{{ record.inputSummary }}</pre><template v-if="record.resultSummary"><h4>结果摘要</h4><pre>{{ record.resultSummary }}</pre></template><template v-if="record.errorSummary"><h4>错误摘要</h4><pre>{{ record.errorSummary }}</pre></template></details>
   <el-empty v-if="!store.records.length" :description="store.callRead?'本次查询没有匹配调用':'尚未读取当前工程与筛选的调用记录'"/><el-button v-if="store.nextBefore!==undefined" :disabled="store.callLoading" @click="store.loadCalls(true)">加载更多（50 条）</el-button>
  </section>
 </section>
</template>

<style scoped>
.compact-connect{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}.compact-connect>.planner-import-actions{margin:0;align-items:center}.compact-live-state{font-size:12px;color:var(--text-secondary)}.compact-warning,.compact-operation-warning{display:flex;align-items:center;gap:6px;color:var(--el-color-warning);font-size:13px}.compact-warning{padding:8px 12px;background:var(--el-color-warning-light-9);border-radius:8px}.compact-call-summary{font-size:13px;color:var(--text-secondary)}
.section-title-inline{display:inline-flex;align-items:center;gap:6px;min-width:0}.section-title-inline h2{margin:0}.operation-availability{display:inline-flex;width:20px;min-height:20px;align-items:center;flex:none}
.companion-project-card{padding:10px 12px;margin-top:8px;border-radius:8px}.companion-project-header{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}.companion-project-header h3{font-size:14px;margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:40%}.project-header-id{font-size:11px;color:var(--el-text-color-secondary);overflow-wrap:anywhere}.project-expand{width:28px;height:28px;padding:4px;flex:none}.creator-main-actions{margin:0 0 0 auto;gap:6px;align-items:center}.creator-main-actions .el-button{margin-left:0}.companion-project-path{font-size:12px;margin:8px 0}.companion-project-body>.planner-import-actions{margin:8px 0;gap:6px}.companion-project-details{display:flex;flex-wrap:wrap;gap:6px 20px;font-size:12px;margin:8px 0 0}.companion-project-details>div{display:flex;align-items:center;gap:6px;min-width:0}.companion-project-details dt{color:var(--el-text-color-secondary)}.companion-project-details dd{display:flex;align-items:center;gap:3px}.companion-project-details :deep(.inline-info-tip){padding:0 3px}.companion-project-body>.form-help{margin:6px 0 0;font-size:12px}
.companion-log-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:12px 0}.companion-log-toolbar>.el-select{flex:1 1 120px;min-width:100px}.companion-log-toolbar>.el-input{flex:1.3 1 150px;min-width:120px}.companion-log-toolbar>.el-button{margin-left:0}.companion-log-wrap{position:relative}.companion-scroll-latest{position:absolute;right:14px;bottom:12px;z-index:1;padding:6px 10px;border:1px solid #2f5bd8;border-radius:999px;background:#2f5bd8;color:#fff;box-shadow:0 3px 8px #223c6726;font-size:12px;line-height:1.2;cursor:pointer}.companion-scroll-latest:focus-visible{outline:2px solid #1d356d;outline-offset:3px}
@media(max-width:680px){.compact-connect{padding:12px}.compact-live-state{display:none}.companion-project-header h3{max-width:calc(100% - 120px)}.creator-main-actions{margin-left:0;flex-basis:100%}.companion-project-details{gap:6px 12px}.companion-log-toolbar>.el-select,.companion-log-toolbar>.el-input{flex-basis:calc(50% - 6px)}}
</style>
