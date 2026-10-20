<script setup lang="ts">
import { computed } from 'vue'
import { useOverviewServiceStatus } from '../composables/use-overview-service-status'
const status = useOverviewServiceStatus()
const { directory, services, loading, observedAt, evidenceSource, error, stale, blockedReason, approved, connected, canRefresh, paused, refresh, togglePaused } = status
const apiCurrent = computed(() => connected.value && !!directory.observedAt && !directory.projectError)
const rows = computed(() => [
  { name: 'Companion', label: apiCurrent.value ? 'API 已响应' : '未知', good: apiCurrent.value && !blockedReason.value },
  ...(['knowledge', 'model'] as const).map(key => {
    const value = services.value?.[key]
    return { name: key === 'knowledge' ? '知识服务' : '模型启动器', label: error.value || !value ? '未知' : `${value.running ? '可达' : '未达'}${stale.value ? ' · 待核对' : ''}`, good: !error.value && !!value?.running && !stale.value }
  }),
])
const issues = computed(() => [
  ...(!approved.value ? ['当前模式或来源未允许自动服务探测。'] : !connected.value ? ['尚无当前来源的有效工程连接。'] : []),
  ...(directory.projectError ? ['Companion 最近一次工程读取失败，当前状态未知。'] : []),
  ...(blockedReason.value ? [blockedReason.value] : []),
  ...(error.value ? [error.value] : []),
  ...(services.value?.warnings ?? []),
  ...(!services.value?.knowledge ? ['知识服务状态尚未取得有效响应。'] : !services.value.knowledge.running ? ['知识服务本次探测未达。'] : []),
  ...(!services.value?.model ? ['模型启动器状态尚未取得有效响应。'] : !services.value.model.running ? ['模型启动器本次探测未达。'] : []),
  ...(stale.value ? ['显示的是最近读取记录，当前状态待核对。'] : []),
])
</script>
<template>
  <section id="service-status" data-testid="overview-service-summary" class="overview-service-summary panel" aria-label="服务摘要" :aria-busy="loading">
    <div class="summary-line">
      <strong>服务</strong>
      <span v-for="row in rows" :key="row.name" class="summary-state"><span class="state-dot" :class="{ good: row.good }" aria-hidden="true"></span>{{ row.name }}：{{ row.label }}</span>
      <span class="summary-actions"><button type="button" :disabled="!canRefresh || loading" @click="refresh">{{ loading ? '正在更新…' : '刷新服务状态' }}</button><button type="button" :disabled="!directory.livePreferred" @click="togglePaused">{{ paused ? '恢复服务更新' : '暂停服务更新' }}</button><RouterLink to="/knowledge?tab=models">模型服务管理</RouterLink></span>
    </div>
    <div class="summary-times"><span>工程读取：<time v-if="directory.observedAt" :datetime="directory.observedAt">{{ directory.observedAt }}</time><span v-else>尚无有效时间</span></span><span>服务读取：<time v-if="observedAt" :datetime="observedAt">{{ observedAt }}</time><span v-else>尚无有效时间</span></span><span v-if="!directory.livePreferred">工程实时更新已暂停，服务自动更新随之暂停</span><span v-else-if="paused">服务自动更新已暂停</span></div>
    <details class="summary-details"><summary>{{ issues.length ? `异常与未核验信息（${issues.length}）` : '状态说明' }}</summary><ul v-if="issues.length"><li v-for="(issue,index) in issues" :key="index">{{ issue }}</li></ul><p>状态仅表示最近一次接口响应。模型启动器可达不代表模型已加载、ComfyUI 或生成任务就绪。</p><p>ComfyUI：未知；原 Companion 没有提供可核验的健康详情接口。</p><p>工程来源：{{ directory.provider?.label || '未连接' }}；服务读取来源：{{ evidenceSource || '尚无读取' }}。自动更新约每15秒一次，完成后再安排下一次；刷新不执行启停。</p></details>
  </section>
</template>
<style scoped>
.overview-service-summary{padding:12px 14px;font-size:12px;margin-bottom:12px}.summary-line,.summary-state,.summary-actions,.summary-times{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px}.summary-line>strong{font-size:13px}.summary-state{gap:5px}.state-dot{width:6px;height:6px;border-radius:50%;background:#9199a5}.state-dot.good{background:#37a06a}.summary-actions{margin-left:auto;gap:12px}.summary-actions button{padding:0;border:0;background:none;color:var(--el-color-primary);font-size:12px}.summary-actions button:disabled{color:#8a94a3}.summary-times{margin-top:7px;font-size:11px;color:var(--el-text-color-secondary);overflow-wrap:anywhere}.summary-details{margin-top:7px;color:var(--el-text-color-secondary);line-height:1.6}.summary-details summary{cursor:pointer}.summary-details ul{padding-left:18px;margin:6px 0}.summary-details p{margin:4px 0}.summary-actions a{color:var(--el-color-primary)}
</style>
