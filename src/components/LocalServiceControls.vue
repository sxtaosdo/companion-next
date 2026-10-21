<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import InfoTip from './InfoTip.vue'
import OperationFeedback from './OperationFeedback.vue'
import { Loading, CircleCheck, InfoFilled, Warning } from '@element-plus/icons-vue'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { useRoute } from 'vue-router'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { localServiceOperationsProvider } from '../local-service-operations-integration'
import { LOCAL_SERVICE_START_GAPS, localServiceLabel } from '../domain/local-service-operations'
import type { LocalService, LocalServiceAction } from '../domain/local-service-operations'
import { useLocalServiceOperationsStore } from '../stores/local-service-operations'
import { useWorkspaceStore } from '../stores/workspace'
const props = defineProps<{ modelsOnly?: boolean; knowledgeOnly?: boolean }>()
const knowledge = useKnowledgeReadStore()
const store = useLocalServiceOperationsStore(), workspace = useWorkspaceStore(), route = useRoute(), confirmed = ref(false), active = ref(true)
const services = computed<LocalService[]>(() => props.modelsOnly ? ['model'] : props.knowledgeOnly ? ['knowledge'] : ['knowledge', 'model'])
const scope = computed(() => JSON.stringify({ route: props.knowledgeOnly ? 'knowledge-manage' : route.fullPath, tab: props.modelsOnly === true, knowledgeOnly: props.knowledgeOnly === true, mode: workspace.mode, project: workspace.selectedProjectId }))
const readFailed=ref(false)
watch(()=>store.reading,reading=>{readFailed.value=reading?false:!!store.error},{flush:'sync'})
let boundScope: string | undefined
let entryGeneration = 0, stopPendingProbe: (() => void) | undefined
function modelEntryProbe() {
  const generation = ++entryGeneration; stopPendingProbe?.(); stopPendingProbe = undefined
  if (!active.value || !props.modelsOnly || !localServiceOperationsProvider.value || !knowledgeReadProvider.value) return
  const read = () => { if (active.value && generation === entryGeneration && props.modelsOnly) void store.refresh() }
  if (store.reading) stopPendingProbe = watch(() => store.reading, reading => {
    if (reading) return
    stopPendingProbe?.(); stopPendingProbe = undefined; read()
  }, { flush: 'post' })
  else read()
}
function sync(){
  if(!active.value)return
  readFailed.value=false
  store.syncContext({ provider: localServiceOperationsProvider.value, readProvider: knowledgeReadProvider.value, scopeKey: scope.value, service: props.modelsOnly ? 'model' : props.knowledgeOnly ? 'knowledge' : undefined })
  boundScope=scope.value;modelEntryProbe()
}
watch([localServiceOperationsProvider, knowledgeReadProvider, scope],sync,{immediate:true,flush:'sync'})
onActivated(()=>{if(!active.value){active.value=true;sync()}})
onDeactivated(()=>{active.value=false;entryGeneration++;stopPendingProbe?.();stopPendingProbe=undefined;confirmed.value=false;store.suspend(boundScope)})
watch(() => store.revision, () => { confirmed.value = false }, { flush: 'sync' })
const receipt = computed(() => store.records.filter(record => services.value.includes(record.service)).at(-1) ?? null)
const warnings = computed(() => (store.states?.warnings ?? []).filter(message => props.knowledgeOnly ? !message.startsWith('模型') : props.modelsOnly ? !message.startsWith('知识库') : true))
const canOpenKnowledge = computed(() => active.value && !props.modelsOnly && !!localServiceOperationsProvider.value && store.canRead && store.states?.knowledge?.running === true && store.states.knowledge.frameable === false)
const canEmbedKnowledge = computed(() => active.value && !props.modelsOnly && !(route.path === '/knowledge' && route.query.tab === 'models') && !!localServiceOperationsProvider.value && store.canRead && !store.blockedUnknown && store.states?.knowledge?.running === true && store.states.knowledge.frameable === true)
const canEmbedModel = computed(() => active.value && props.modelsOnly && !!localServiceOperationsProvider.value && store.canRead && !store.prepared && !store.blockedUnknown && store.states?.model?.running === true)
function currentRecord(service:LocalService) { return store.records.filter(record=>record.service===service&&!record.detached).at(-1) }
function serviceReading(service:LocalService) { return props.knowledgeOnly && service==='knowledge' ? knowledge.statusLoading : store.reading }
function serviceState(service:LocalService) { return props.knowledgeOnly && service==='knowledge' ? knowledge.provider===knowledgeReadProvider.value ? knowledge.services?.knowledge : undefined : store.states?.[service] }
function serviceFailed(service:LocalService) { return props.knowledgeOnly && service==='knowledge' ? !!knowledge.serviceError || !!knowledge.services?.warnings.some(w=>w.startsWith('知识服务状态未取到')) : readFailed.value }
function stateLabel(service:LocalService) { return serviceReading(service)?'检查中':serviceFailed(service)?'读取失败':serviceState(service)?.running===true?'服务可达':serviceState(service)?.running===false?'服务不可达':'未检查' }
function stateTone(service:LocalService) { return serviceReading(service)?'info':serviceFailed(service)?'danger':serviceState(service)?.running===true?'success':serviceState(service)?.running===false?'warning':'info' }
async function refreshStates() {
 if(props.knowledgeOnly && knowledgeReadProvider.value) await Promise.all([store.refresh(),knowledge.provider===knowledgeReadProvider.value?knowledge.refreshStatus():knowledge.connect(knowledgeReadProvider.value)])
 else await store.refresh()
}
function prepare(service: LocalService, action: LocalServiceAction = 'stop') { confirmed.value = false; store.prepare(service, action) }
async function operateModel(action: LocalServiceAction) {
  const prepared = store.prepare('model', action)
  if (prepared && await store.execute(prepared, true) && props.modelsOnly) await store.refresh()
}
async function execute() { const prepared = store.prepared; const succeeded = prepared && confirmed.value ? await store.execute(prepared, confirmed.value) : false; confirmed.value = false; if (succeeded && active.value && props.knowledgeOnly && prepared?.service === 'knowledge') await refreshStates(); else if (succeeded && props.modelsOnly && prepared?.service === 'model') await store.refresh() }
onBeforeUnmount(() => { entryGeneration++; stopPendingProbe?.(); stopPendingProbe = undefined; store.leave(boundScope) })
</script>
<template>
  <section class="section-card local-service-controls" aria-label="本机服务控制">
    <div class="service-heading"><div class="service-title"><h3>{{ props.modelsOnly ? '模型服务' : '本机服务控制' }}</h3><InfoTip v-if="props.modelsOnly" label="模型服务说明" text="启动后显示原本机启动器，各模型和 ComfyUI 的操作仍在原面板完成。启动器可达不代表模型已就绪。关闭启动器不等于终止已运行的模型；切换 GPU 服务前请核对当前任务。"/></div><el-button :disabled="!store.canRead" :loading="store.reading" @click="refreshStates">读取当前服务状态</el-button></div>
    <p v-if="!localServiceOperationsProvider">当前构建未接入服务启停能力；只有正常 Companion 工作区提供此操作。</p>
    <p v-if="!props.modelsOnly">{{ props.knowledgeOnly ? '按需读取知识服务状态；不会自动启停。' : '此处状态由你显式读取，只探测知识库服务与模型启动器，不执行知识 CLI、同步或模型调用。进入页面不会自动读取或启停。' }}</p>
    <div class="service-grid">
      <article v-for="service in services" :key="service" class="service-card">
        <h4 v-if="!props.modelsOnly">{{ localServiceLabel(service) }}</h4>
        <div class="service-observed-state"><el-tag :type="stateTone(service)" role="status" :aria-busy="serviceReading(service)"><el-icon :class="{'service-state-spin':serviceReading(service)}" aria-hidden="true"><Loading v-if="serviceReading(service)"/><Warning v-else-if="serviceFailed(service)||serviceState(service)?.running===false"/><CircleCheck v-else-if="serviceState(service)?.running"/><InfoFilled v-else/></el-icon>{{ stateLabel(service) }}</el-tag><OperationFeedback v-if="currentRecord(service)" :phase="currentRecord(service)!.status" :action="currentRecord(service)!.action" :message="currentRecord(service)!.message"/></div>
        <small v-if="props.knowledgeOnly && !store.states?.knowledge">启停前请读取当前服务状态。</small>
        <p v-if="service==='model' && !props.modelsOnly">{{ LOCAL_SERVICE_START_GAPS.model }}</p>
        <p v-if="service==='model' && !props.modelsOnly">这里只表示启动器是否可达，不代表模型已加载、Comfy 已连接或 GPU 已就绪。关闭启动器不等于终止已运行的模型。</p>
        <p v-else-if="service==='knowledge'">关闭可能中断所有客户端；原后台没有页面归属记录，不能保证只关闭本页启动的实例。</p>
        <p v-if="service==='knowledge' && canOpenKnowledge">知识库服务已启动，但这个页面不能嵌进来。请在新页签打开。</p>
        <a v-if="service==='knowledge' && canOpenKnowledge" class="service-external el-button el-button--primary" href="http://127.0.0.1:8081/" target="_blank" rel="noopener noreferrer">打开知识后台</a>
        <template v-if="props.modelsOnly"><el-button v-if="store.states?.model?.running===false" type="primary" :loading="currentRecord('model')?.status==='sending'&&currentRecord('model')?.action==='start'" :disabled="!store.canPrepare('model','start')" @click="operateModel('start')">启动服务</el-button><el-button v-else type="warning" :loading="currentRecord('model')?.status==='sending'&&currentRecord('model')?.action==='stop'" :disabled="!store.canPrepare('model','stop')" @click="operateModel('stop')">关闭服务</el-button></template>
        <template v-else><el-button v-if="store.states?.[service]?.running===false" type="primary" :disabled="!store.canPrepare(service,'start')" @click="prepare(service,'start')">核对启动{{ localServiceLabel(service) }}</el-button>
        <el-button v-else type="warning" :disabled="!store.canPrepare(service)" @click="prepare(service)">核对关闭{{ localServiceLabel(service) }}</el-button></template>
      </article>
    </div>
    <p v-if="warnings.length" role="alert">{{ warnings.join('；') }}</p>
    <el-alert v-if="store.error" type="warning" :closable="false" :title="store.error"/>
    <p v-if="store.transportPending" role="status">底层服务请求尚未结束，其他启停请求已阻止。停止等待或离开页面不会撤销后台操作。</p>
    <el-button v-if="store.busy" @click="store.cancel">{{ receipt?.action==='start'?'停止等待启动回执':'停止等待关闭回执' }}</el-button>
    <iframe v-if="canEmbedModel" class="model-service-frame" src="http://127.0.0.1:8090/" title="本地 AI 服务启动器" referrerpolicy="no-referrer"></iframe>
    <iframe v-if="canEmbedKnowledge" class="knowledge-service-frame" src="http://127.0.0.1:8081/" title="本机知识库" referrerpolicy="no-referrer"></iframe>
    <section v-if="store.prepared && !props.modelsOnly" class="service-confirm" :aria-label="`本次服务${store.prepared.action==='start'?'启动':'关闭'}确认`">
      <h4>尚未发送：{{ store.prepared.action==='start'?'启动':'关闭' }}{{ localServiceLabel(store.prepared.service) }}</h4>
      <p>来源：{{ store.prepared.providerLabel }}</p><p>{{ store.prepared.impact }}</p>
      <el-checkbox v-model="confirmed" :aria-label="`确认本次服务${store.prepared.action==='start'?'启动':'关闭'}`">{{ store.prepared.action==='start'?`我确认沿用原${localServiceLabel(store.prepared.service)}启动流程，了解上述进程、文件和环境影响`:'我确认这一次服务级关闭，并了解对所有客户端的影响' }}</el-checkbox>
      <el-button type="warning" :loading="store.busy" :disabled="!confirmed || store.transportPending" @click="execute">{{ store.prepared.action==='start'?'确认并启动这一次':'确认并关闭这一次' }}</el-button>
    </section>
    <div v-if="receipt" class="service-receipt" aria-live="polite">
      <strong>{{ localServiceLabel(receipt.service) }} · <OperationFeedback :phase="receipt.status" :action="receipt.action" :message="receipt.message"/></strong><span v-if="receipt.detached"> · 原页面 / 来源回执</span><p>{{ receipt.message }}</p>
    </div>
    <small v-if="!props.modelsOnly">{{ props.knowledgeOnly ? '状态与回执仅保留在当前应用；知识服务按原条件内嵌显示或在新页签打开。' : '状态与回执仅保留在当前应用内存；模型页沿用原固定8090启动器，知识页按原内嵌条件显示8081。页面不会自动启停或重试；各模型操作仍由原面板处理。' }}</small>
  </section>
</template>
<style scoped>
.service-observed-state{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:12px 0}.service-observed-state .el-icon{vertical-align:-2px;margin-right:5px}.service-state-spin{animation:service-state-spin 1s linear infinite}@keyframes service-state-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.service-state-spin{animation:none}}.knowledge-service-frame,.model-service-frame{display:block;width:100%;height:min(820px,calc(100vh - 220px));min-height:480px;border:1px solid var(--el-border-color);border-radius:8px;background:#fff;margin:12px 0}.local-service-controls{margin:16px 0}.local-service-controls p{line-height:1.7;overflow-wrap:anywhere}.service-title{display:flex;align-items:center;gap:6px}.service-title h3{margin:0}.service-heading{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.service-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:12px}.service-card{border:1px solid #e2e7ef;border-radius:8px;padding:14px;margin:12px 0}.service-card h4{margin:0}.service-receipt{margin:14px 0}.service-confirm{padding:16px;border:1px solid #eac88e;background:#fff9ef;border-radius:8px;margin:16px 0}.service-confirm .el-button{display:block;margin-top:12px}.local-service-controls :deep(.el-checkbox){height:auto;align-items:flex-start;max-width:100%}.local-service-controls :deep(.el-checkbox__label){white-space:normal;line-height:1.6}
</style>
