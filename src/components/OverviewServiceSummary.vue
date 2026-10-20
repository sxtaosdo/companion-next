<script setup lang="ts">
import { computed } from 'vue'
import { useOverviewServiceStatus } from '../composables/use-overview-service-status'
const { directory, services, loading, observedAt, error, errorCode, stale, blockedReason, connected, canRefresh, paused, refresh, togglePaused } = useOverviewServiceStatus()
function failureLabel(code: string) {
  return code === 'unauthorized' || code === 'forbidden' ? '鉴权失败' : code === 'timeout' ? '超时' : '读取异常'
}
const apiLabel = computed(() => {
  if (directory.projectError) return /（40[13]）/.test(directory.projectError) ? '鉴权失败' : directory.projectError.includes('只读查询超时') ? '超时' : '读取异常'
  if (directory.projectLoading && !directory.observedAt) return '检查中'
  return connected.value ? '已连接' : directory.provider ? '未检查' : '未连接'
})
function serviceCard(key: 'knowledge' | 'model') {
  const value = services.value?.[key], prefix = key === 'knowledge' ? '知识库服务状态未知：[' : '模型启动器状态未知：['
  const warning = services.value?.warnings.find(item => item.startsWith(prefix))
  const code = warning ? warning.slice(prefix.length).split(']')[0] ?? '' : errorCode.value
  const failed = !!warning || !!error.value || (!!services.value && !value)
  const label = failed ? failureLabel(code) : loading.value && !value ? '检查中' : !value ? '未检查' : value.running ? '已连接' : '未连接'
  return { name: key === 'knowledge' ? '知识库' : '模型启动器', label, to: key === 'knowledge' ? '/knowledge' : '/knowledge?tab=models',
    detail: failed ? '进入管理页核对连接' : value?.running ? key === 'model' ? '仅启动器可达' : '服务可达 · 检索需核对' : !value ? '尚未取得状态' : '本次探测未达',
    good: !!value?.running && !failed && !stale.value, attention: failed, pending: stale.value && !failed && !!value, time: observedAt.value }
}
const cards = computed(() => [
  { name: 'Companion', label: apiLabel.value, to: '/projects', detail: blockedReason.value || (directory.projectError ? '进入工程页核对连接' : connected.value ? '工程 API 已响应' : '进入工程页连接'), good: apiLabel.value === '已连接' && !blockedReason.value, attention: ['读取异常','鉴权失败','超时'].includes(apiLabel.value), pending: false, time: directory.observedAt },
  serviceCard('knowledge'), serviceCard('model'),
])
function timeLabel(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('zh-CN', { hour12: false }) : value }
</script>
<template>
  <section id="service-status" data-testid="overview-service-summary" class="overview-service-summary" aria-label="全局服务" :aria-busy="loading">
    <header class="service-section-heading"><h2>服务</h2><div class="summary-actions"><button type="button" :disabled="!canRefresh || loading" @click="refresh">{{ loading ? '正在更新…' : '刷新服务状态' }}</button><button type="button" :disabled="!directory.livePreferred" @click="togglePaused">{{ paused ? '恢复服务更新' : '暂停服务更新' }}</button></div></header>
    <div class="global-service-grid"><RouterLink v-for="card in cards" :key="card.name" :to="card.to" class="panel global-service-card" :data-service="card.name" :aria-label="`${card.name}：${card.label}，打开管理页`"><div class="service-card-heading"><h3>{{ card.name }}</h3><span class="service-state" :class="{ good: card.good, attention: card.attention }"><span aria-hidden="true">{{ card.good ? '✓' : card.attention ? '!' : '·' }}</span>{{ card.label }}{{ card.pending ? ' · 待核对' : '' }}</span></div><p>{{ card.detail }}</p><footer><span v-if="card.time">更新于 <time :datetime="card.time">{{ timeLabel(card.time) }}</time></span><span v-else>尚未检查</span><span aria-hidden="true">进入 →</span></footer></RouterLink></div>
    <span v-if="!directory.livePreferred || paused" class="service-pause-note" role="status">自动更新已暂停</span>
  </section>
</template>
<style scoped>
.overview-service-summary{margin-top:22px}.service-section-heading,.summary-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px}.service-section-heading{justify-content:space-between;margin-bottom:10px}.service-section-heading h2{font-size:14px;margin:0}.summary-actions button{padding:3px 0;border:0;background:none;color:var(--el-color-primary);font-size:12px}.summary-actions button:disabled{color:var(--el-text-color-placeholder)}.summary-actions button:focus-visible,.global-service-card:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:3px}.global-service-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.global-service-card{display:flex;flex-direction:column;padding:16px;color:var(--el-text-color-regular);text-decoration:none;min-width:0;transition:border-color .15s}.global-service-card:hover{border-color:var(--el-color-primary-light-5)}.service-card-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.service-card-heading h3{font-size:15px;margin:0}.service-state{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--el-text-color-secondary)}.service-state.good{color:#237b51}.service-state.attention{color:#a63f44}.global-service-card p{font-size:12px;line-height:1.5;overflow-wrap:anywhere;margin:12px 0;color:var(--el-text-color-secondary)}.global-service-card footer{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--el-text-color-secondary);margin-top:auto;overflow-wrap:anywhere}.service-pause-note{display:block;font-size:11px;color:var(--el-text-color-secondary);margin-top:8px}@media(max-width:900px){.global-service-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.global-service-grid{grid-template-columns:1fr}}
</style>
