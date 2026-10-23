<script setup lang="ts">
import { computed } from 'vue'
import { ElIcon, ElTag } from 'element-plus'
import { CircleCheck, CircleClose, InfoFilled, Link, Loading, Warning } from '@element-plus/icons-vue'
import { useOverviewServiceStatus } from '../composables/use-overview-service-status'
const { directory, services, loading, observedAt, error, errorCode, stale, blockedReason, connected, canRefresh, paused, refresh, togglePaused } = useOverviewServiceStatus()
type Tone = 'success' | 'primary' | 'info' | 'danger' | 'warning'
function status(label: string, tone: Tone, busy = false) {
  return { label, tone, busy, icon: busy ? Loading : tone === 'success' ? CircleCheck : tone === 'danger' ? CircleClose : tone === 'warning' ? Warning : label === '未连接' ? Link : InfoFilled }
}
function failureLabel(code: string) {
  return code === 'unauthorized' || code === 'forbidden' ? '鉴权失败' : code === 'timeout' ? '超时' : '读取异常'
}
function serviceCard(key: 'knowledge' | 'model') {
  const value = services.value?.[key], prefix = key === 'knowledge' ? '知识库服务状态未知：[' : '模型启动器状态未知：['
  const warning = services.value?.warnings.find(item => item.startsWith(prefix))
  const code = warning ? warning.slice(prefix.length).split(']')[0] ?? '' : errorCode.value
  const failed = !!warning || !!error.value || (!!services.value && !value)
  // A retained successful snapshot is evidence, not current readiness during a
  // failed read, pause or operation barrier. Routine background reads retain it.
  const state = loading.value && !observedAt.value ? status('检查中', 'primary', true)
    : failed ? status(failureLabel(code), 'danger')
    : stale.value && value ? status('状态过期 · 待核对', 'warning')
    : !value ? status('未读取', 'info')
    : value.running ? status('已连接', 'success') : status('未连接', 'info')
  return { name: key === 'knowledge' ? '知识库' : '模型启动器', ...state, to: key === 'knowledge' ? '/knowledge' : '/knowledge?tab=models',
    detail: failed ? warning || error.value || '本次未取得有效服务响应，进入管理页核对连接' : blockedReason.value || (value?.running ? key === 'model' ? '仅启动器可达' : '服务可达 · 检索需核对' : !value ? '尚未取得状态' : '本次探测未达'), time: observedAt.value }
}
const cards = computed(() => {
  const apiState = directory.projectLoading && !directory.observedAt ? status('检查中', 'primary', true)
    : directory.projectError ? status(/（40[13]）/.test(directory.projectError) ? '鉴权失败' : directory.projectError.includes('只读查询超时') ? '超时' : '读取异常', 'danger')
    : blockedReason.value || (!connected.value && directory.observedAt) ? status(directory.observedAt ? '状态过期 · 待核对' : '状态未知 · 待核对', 'warning')
    : connected.value ? status('已连接', 'success') : directory.provider ? status('未读取', 'info') : status('未连接', 'info')
  return [
    { name: 'Companion', ...apiState, to: '/projects', detail: directory.projectError || blockedReason.value || (connected.value ? '工程 API 已响应' : '进入工程页连接'), time: directory.observedAt },
    serviceCard('knowledge'), serviceCard('model'),
  ]
})
function timeLabel(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('zh-CN', { hour12: false }) : value }
</script>
<template>
  <section id="service-status" data-testid="overview-service-summary" class="overview-service-summary" aria-label="全局服务" :aria-busy="loading">
    <header class="service-section-heading"><h2>服务</h2><div class="summary-actions"><button type="button" :disabled="!canRefresh || loading" @click="refresh">{{ loading ? '正在更新…' : '刷新服务状态' }}</button><button type="button" :disabled="!directory.livePreferred" @click="togglePaused">{{ paused ? '恢复服务更新' : '暂停服务更新' }}</button></div></header>
    <div class="global-service-grid"><RouterLink v-for="card in cards" :key="card.name" :to="card.to" class="panel global-service-card" :data-service="card.name" :aria-label="`${card.name}：${card.label}，打开管理页`"><div class="service-card-heading"><h3>{{ card.name }}</h3><ElTag class="companion-status-tag" size="small" :type="card.tone" role="status" :aria-busy="card.busy"><ElIcon class="companion-status-icon" :class="{ 'status-spin': card.busy }" aria-hidden="true"><component :is="card.icon" /></ElIcon>{{ card.label }}</ElTag></div><p>{{ card.detail }}</p><footer><span v-if="card.time">更新于 <time :datetime="card.time">{{ timeLabel(card.time) }}</time></span><span v-else>尚未检查</span><span aria-hidden="true">进入 →</span></footer></RouterLink></div>
    <span v-if="!directory.livePreferred || paused" class="service-pause-note" role="status">自动更新已暂停</span>
  </section>
</template>
<style scoped>
.overview-service-summary{margin-top:22px}.service-section-heading,.summary-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px}.service-section-heading{justify-content:space-between;margin-bottom:10px}.service-section-heading h2{font-size:14px;margin:0}.summary-actions button{padding:3px 0;border:0;background:none;color:var(--el-color-primary);font-size:12px}.summary-actions button:disabled{color:var(--el-text-color-placeholder)}.summary-actions button:focus-visible,.global-service-card:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}.global-service-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.global-service-card{display:flex;flex-direction:column;padding:16px;color:var(--el-text-color-regular);text-decoration:none;min-width:0;transition:border-color .15s}.global-service-card:hover{border-color:var(--el-color-primary-light-5)}.service-card-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.service-card-heading h3{font-size:15px;margin:0}.status-spin{animation:service-status-spin 1s linear infinite}@keyframes service-status-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.status-spin{animation:none}}.global-service-card p{font-size:12px;line-height:1.5;overflow-wrap:anywhere;margin:12px 0;color:var(--el-text-color-secondary)}.global-service-card footer{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--el-text-color-secondary);margin-top:auto;overflow-wrap:anywhere}.service-pause-note{display:block;font-size:11px;color:var(--el-text-color-secondary);margin-top:8px}@media(max-width:900px){.global-service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.global-service-grid{grid-template-columns:1fr}}
</style>
