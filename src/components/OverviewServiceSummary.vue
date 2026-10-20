<script setup lang="ts">
import { computed } from 'vue'
import { useOverviewServiceStatus } from '../composables/use-overview-service-status'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { runtimeStateLabel } from '../domain/companion-browser'
const props = withDefaults(defineProps<{ embedded?: boolean }>(), { embedded: false })
const status = useOverviewServiceStatus(), selection = useRegisteredProjectStore()
const { directory, services, loading, observedAt, evidenceSource, error, errorCode, stale, blockedReason, approved, connected, canRefresh, paused, refresh, togglePaused } = status
function failureLabel(code: string) {
  return code === 'unauthorized' || code === 'forbidden' ? '鉴权失败' : code === 'timeout' ? '超时' : '异常'
}
const apiLabel = computed(() => {
  if (directory.projectError) return /（40[13]）/.test(directory.projectError) ? '鉴权失败' : directory.projectError.includes('只读查询超时') ? '超时' : '异常'
  if (directory.projectLoading && !directory.observedAt) return '检查中'
  return connected.value ? '已连接' : directory.provider ? '未检查' : '未连接'
})
function serviceRow(key: 'knowledge' | 'model') {
  const value = services.value?.[key], prefix = key === 'knowledge' ? '知识库服务状态未知：[' : '模型启动器状态未知：['
  const warning = services.value?.warnings.find(item => item.startsWith(prefix))
  const code = warning ? warning.slice(prefix.length).split(']')[0] ?? '' : errorCode.value
  const failed = !!warning || !!error.value || (!!services.value && !value)
  const label = failed ? failureLabel(code) : loading.value && !value ? '检查中' : !value ? '未检查' : value.running ? '已连接' : '未连接'
  return { name: key === 'knowledge' ? '知识库' : '模型启动器', label, to: key === 'knowledge' ? '/knowledge' : '/knowledge?tab=models',
    detail: failed ? '本次读取未核验' : value?.running ? key === 'model' ? '仅启动器可达' : '服务可达' : '',
    good: !!value?.running && !failed && !stale.value, attention: failed, pending: stale.value && !failed && !!value }
}
const bridgeRow = computed(() => {
  const runtime = selection.status, state = runtime?.state, passive = directory.provider?.runtimeProbesEnabled === false
  const prefix = '运行状态未取得有效数据：['
  const warning = directory.warnings.find(item => item.startsWith(prefix))
  const failed = !passive && !!warning
  const code = warning?.slice(prefix.length).split(']')[0] ?? ''
  const label = passive ? '未检查' : failed ? failureLabel(code) : directory.projectLoading && !runtime ? '检查中' : !selection.project || !runtime ? '未检查' : state === 'unknown' ? '未知' : state === 'ready' ? '已连接' : state === 'stopped' ? '未连接' : ['launching','bridge-wait','stopping'].includes(state ?? '') ? '连接中' : '异常'
  return { name: 'Creator Bridge', label, to: '/projects', detail: passive ? '运行状态未探测' : failed ? '本次读取未核验' : runtime ? `${runtimeStateLabel(runtime.state)}${runtime.creatorVersion ? ` · Creator ${runtime.creatorVersion}` : ''}` : '', good: label === '已连接', attention: ['异常','鉴权失败','超时'].includes(label), pending: false }
})
const rows = computed(() => [
  { name: 'Companion', label: apiLabel.value, to: '/projects', detail: connected.value ? '工程 API 已响应' : '', good: apiLabel.value === '已连接' && !blockedReason.value, attention: ['异常','鉴权失败','超时'].includes(apiLabel.value), pending: false },
  { name: '工程', label: selection.project ? '已选择' : directory.projectLoading ? '检查中' : selection.currentSource ? selection.projects.length ? '未选择' : '无登记' : '未检查', to: '/projects', detail: '', good: !!selection.project, attention: false, pending: false },
  bridgeRow.value, serviceRow('knowledge'), serviceRow('model'),
])
const issues = computed(() => [
  ...(!approved.value ? ['当前模式或来源未允许自动服务探测。'] : !connected.value ? ['尚无当前来源的有效工程连接。'] : []),
  ...(directory.projectError ? ['Companion 最近一次工程读取失败，当前状态未知。'] : []),
  ...(blockedReason.value ? [blockedReason.value] : []), ...(error.value ? [error.value] : []), ...(services.value?.warnings ?? []),
  ...(!services.value?.knowledge ? ['知识服务状态尚未取得有效响应。'] : !services.value.knowledge.running ? ['知识服务本次探测未达。'] : []),
  ...(!services.value?.model ? ['模型启动器状态尚未取得有效响应。'] : !services.value.model.running ? ['模型启动器本次探测未达。'] : []),
  ...(stale.value ? ['显示的是最近读取记录，当前状态待核对。'] : []),
])
const shortIssue = computed(() => blockedReason.value || (error.value ? '服务状态读取未完成核验，请查看详情。' : services.value?.warnings.length ? '部分服务状态未核验，请查看详情。' : ''))
</script>
<template>
  <section id="service-status" data-testid="overview-service-summary" class="overview-service-summary" :class="{ panel: !props.embedded, embedded: props.embedded }" aria-label="服务摘要" :aria-busy="loading">
    <div class="summary-states"><RouterLink v-for="row in rows" :key="row.name" :to="row.to" class="summary-state" :data-service="row.name" :aria-label="`${row.name}：${row.label}，打开管理页`"><span class="state-dot" :class="{ good: row.good, attention: row.attention }" aria-hidden="true"></span><strong>{{ row.name }}</strong><span>{{ row.label }}{{ row.pending ? ' · 待核对' : '' }}</span><small v-if="row.detail">{{ row.detail }}</small></RouterLink></div>
    <div class="summary-controls"><span class="summary-actions"><button type="button" :disabled="!canRefresh || loading" @click="refresh">{{ loading ? '正在更新…' : '刷新服务状态' }}</button><button type="button" :disabled="!directory.livePreferred" @click="togglePaused">{{ paused ? '恢复服务更新' : '暂停服务更新' }}</button></span><span class="summary-times"><span>工程读取：<time v-if="directory.observedAt" :datetime="directory.observedAt">{{ directory.observedAt }}</time><span v-else>未检查</span></span><span>服务读取：<time v-if="observedAt" :datetime="observedAt">{{ observedAt }}</time><span v-else>未检查</span></span></span></div>
    <p v-if="shortIssue" class="summary-alert" role="status">{{ shortIssue }}</p>
    <p v-if="!directory.livePreferred || paused" class="summary-paused" role="status">{{ !directory.livePreferred ? '工程实时更新已暂停，服务自动更新随之暂停' : '服务自动更新已暂停' }}</p>
    <details class="summary-details"><summary>{{ issues.length ? `异常与未核验信息（${issues.length}）` : '状态说明' }}</summary><ul v-if="issues.length"><li v-for="(issue,index) in issues" :key="index">{{ issue }}</li></ul><p>状态仅表示最近一次接口响应。模型启动器可达不代表模型已加载、ComfyUI 或生成任务就绪。</p><p>ComfyUI：未知；原 Companion 没有提供可核验的健康详情接口。</p><p>工程来源：{{ directory.provider?.label || '未连接' }}；服务读取来源：{{ evidenceSource || '尚无读取' }}。自动更新约每15秒一次，完成后再安排下一次；刷新不执行启停。</p></details>
  </section>
</template>
<style scoped>
.overview-service-summary{padding:12px 14px;font-size:12px;margin-bottom:12px}.overview-service-summary.embedded{padding:12px 0 0;margin:12px 0 0;border-top:1px solid var(--el-border-color-light)}.summary-states{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.summary-state{display:grid;grid-template-columns:7px minmax(0,1fr);gap:4px 7px;align-content:start;color:var(--el-text-color-regular);padding:6px 8px;border-radius:5px;text-decoration:none}.summary-state:hover{background:var(--el-fill-color-light)}.summary-state:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}.summary-state strong{font-size:12px}.summary-state>span:not(.state-dot),.summary-state small{grid-column:2;overflow-wrap:anywhere}.summary-state small{font-size:11px;color:var(--el-text-color-secondary)}.state-dot{width:6px;height:6px;margin-top:5px;border-radius:50%;background:#9199a5}.state-dot.good{background:#37a06a}.state-dot.attention{background:#c34e55}.summary-controls,.summary-actions,.summary-times{display:flex;align-items:center;flex-wrap:wrap;gap:6px 14px}.summary-controls{margin-top:8px;justify-content:space-between}.summary-actions button{padding:0;border:0;background:none;color:var(--el-color-primary);font-size:12px}.summary-actions button:disabled{color:#8a94a3}.summary-times{font-size:11px;color:var(--el-text-color-secondary);overflow-wrap:anywhere}.summary-alert,.summary-paused{margin:7px 0 0;font-size:12px;overflow-wrap:anywhere}.summary-alert{color:#98652a}.summary-paused{color:var(--el-text-color-secondary)}.summary-details{margin-top:7px;color:var(--el-text-color-secondary);line-height:1.6}.summary-details summary{cursor:pointer}.summary-details ul{padding-left:18px;margin:6px 0}.summary-details p{margin:4px 0}
@media(max-width:760px){.summary-states{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:420px){.summary-states{grid-template-columns:1fr}.summary-state{grid-template-columns:7px auto minmax(0,1fr)}.summary-state>span:not(.state-dot){grid-column:3}.summary-state small{grid-column:2 / -1}.summary-times>span{max-width:100%}}
</style>
