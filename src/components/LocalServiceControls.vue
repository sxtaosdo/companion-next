<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { localServiceOperationsProvider } from '../local-service-operations-integration'
import { LOCAL_SERVICE_START_GAPS, localServiceLabel } from '../domain/local-service-operations'
import type { LocalService, LocalServiceAction } from '../domain/local-service-operations'
import { useLocalServiceOperationsStore } from '../stores/local-service-operations'
import { useWorkspaceStore } from '../stores/workspace'
const props = defineProps<{ modelsOnly?: boolean }>()
const store = useLocalServiceOperationsStore(), workspace = useWorkspaceStore(), route = useRoute(), confirmed = ref(false)
const services = computed<LocalService[]>(() => props.modelsOnly ? ['model'] : ['knowledge', 'model'])
const scope = computed(() => JSON.stringify({ route: route.fullPath, tab: props.modelsOnly === true, mode: workspace.mode, project: workspace.selectedProjectId }))
watch([localServiceOperationsProvider, knowledgeReadProvider, scope], () => store.syncContext({ provider: localServiceOperationsProvider.value, readProvider: knowledgeReadProvider.value, scopeKey: scope.value }), { immediate: true, flush: 'sync' })
watch(() => store.revision, () => { confirmed.value = false }, { flush: 'sync' })
const receipt = computed(() => store.records.at(-1) ?? null)
const receiptLabel = computed(() => { const action = receipt.value?.action === 'start' ? '启动' : '关闭'; return { sending: `等待${action}回执`, acknowledged: `已收到${action}回执`, 'not-dispatched': '未发出', rejected: '明确拒绝', 'reported-failure': `后台报告未${action}`, unknown: '结果未知' } })
function prepare(service: LocalService, action: LocalServiceAction = 'stop') { confirmed.value = false; store.prepare(service, action) }
async function execute() { const prepared = store.prepared; if (prepared && confirmed.value) await store.execute(prepared, confirmed.value); confirmed.value = false }
onBeforeUnmount(() => store.leave())
</script>
<template>
  <section class="section-card local-service-controls" aria-label="本机服务控制">
    <div class="service-heading"><h3>本机服务控制</h3><el-button :disabled="!store.canRead" :loading="store.reading" @click="store.refresh">读取当前服务状态</el-button></div>
    <p v-if="!localServiceOperationsProvider">当前构建未接入服务启停能力；只有正常 Companion 工作区提供此操作。</p>
    <p>此处状态由你显式读取，只探测知识库服务与模型启动器，不执行知识 CLI、同步或模型调用。进入页面不会自动读取或启停。</p>
    <div class="service-grid">
      <article v-for="service in services" :key="service" class="service-card">
        <h4>{{ localServiceLabel(service) }}</h4>
        <p>{{ store.states?.[service] ? (store.states[service]!.running ? '本次读取：服务可达' : '本次读取：服务不可达') : '当前状态未读取 / 未知' }}</p>
        <p v-if="service==='model'">{{ LOCAL_SERVICE_START_GAPS.model }}</p>
        <p v-if="service==='model'">这里只表示启动器是否可达，不代表模型已加载、Comfy 已连接或 GPU 已就绪。关闭启动器不等于终止已运行的模型。</p>
        <p v-else>关闭可能中断所有客户端；原后台没有页面归属记录，不能保证只关闭本页启动的实例。</p>
        <el-button v-if="service==='knowledge' && store.states?.knowledge?.running===false" type="primary" :disabled="!store.canPrepare(service,'start')" @click="prepare(service,'start')">核对启动知识库服务</el-button>
        <el-button v-else type="warning" :disabled="!store.canPrepare(service)" @click="prepare(service)">核对关闭{{ localServiceLabel(service) }}</el-button>
      </article>
    </div>
    <p v-if="store.states?.warnings.length" role="alert">{{ store.states.warnings.join('；') }}</p>
    <el-alert v-if="store.error" type="warning" :closable="false" :title="store.error"/>
    <p v-if="store.transportPending" role="status">底层服务请求尚未结束，其他启停请求已阻止。停止等待或离开页面不会撤销后台操作。</p>
    <el-button v-if="store.busy" @click="store.cancel">{{ receipt?.action==='start'?'停止等待启动回执':'停止等待关闭回执' }}</el-button>
    <section v-if="store.prepared" class="service-confirm" :aria-label="`本次服务${store.prepared.action==='start'?'启动':'关闭'}确认`">
      <h4>尚未发送：{{ store.prepared.action==='start'?'启动':'关闭' }}{{ localServiceLabel(store.prepared.service) }}</h4>
      <p>来源：{{ store.prepared.providerLabel }}</p><p>{{ store.prepared.impact }}</p>
      <el-checkbox v-model="confirmed" :aria-label="`确认本次服务${store.prepared.action==='start'?'启动':'关闭'}`">{{ store.prepared.action==='start'?'我确认沿用原知识库启动流程，了解上述进程、文件和环境影响':'我确认这一次服务级关闭，并了解对所有客户端的影响' }}</el-checkbox>
      <el-button type="warning" :disabled="!confirmed || store.transportPending" @click="execute">{{ store.prepared.action==='start'?'确认并启动这一次':'确认并关闭这一次' }}</el-button>
    </section>
    <div v-if="receipt" class="service-receipt" aria-live="polite">
      <strong>{{ localServiceLabel(receipt.service) }} · {{ receiptLabel[receipt.status] }}</strong><span v-if="receipt.detached"> · 原页面 / 来源回执</span><p>{{ receipt.message }}</p>
    </div>
    <small>状态与回执仅保留在当前应用内存；不会嵌入后台管理页、打开外部地址或自动重试。</small>
  </section>
</template>
<style scoped>
.local-service-controls{margin:16px 0}.local-service-controls p{line-height:1.7;overflow-wrap:anywhere}.service-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.service-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}.service-card{border:1px solid #e2e7ef;border-radius:8px;padding:14px;margin:12px 0}.service-card h4{margin:0}.service-receipt{margin:14px 0}.service-confirm{padding:16px;border:1px solid #eac88e;background:#fff9ef;border-radius:8px;margin:16px 0}.service-confirm .el-button{display:block;margin-top:12px}.local-service-controls :deep(.el-checkbox){height:auto;align-items:flex-start;max-width:100%}.local-service-controls :deep(.el-checkbox__label){white-space:normal;line-height:1.6}
</style>
