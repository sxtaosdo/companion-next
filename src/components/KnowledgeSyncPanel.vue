<script setup lang="ts">
import { computed, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { useKnowledgeConversationStore } from '../stores/knowledge-conversation'
import { knowledgeAgentPending } from '../knowledge-agent-integration'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { hasUnknownKnowledgeSync, markUnknownKnowledgeSync, knowledgeSyncPending, knowledgeSyncProvider } from '../knowledge-sync-integration'
import { canKnowledgeSync, formatKnowledgeSyncPlan, KnowledgeSyncError, syncPolicyText } from '../domain/knowledge-sync'
import type { KnowledgeSyncOperation, KnowledgeSyncReply, KnowledgeSyncProvider } from '../domain/knowledge-sync'
import type { KnowledgeSource } from '../domain/knowledge-read'
const read=useKnowledgeReadStore(),chat=useKnowledgeConversationStore()
const selected=ref(''),busy=ref(false),notice=ref(''),failed=ref(false)
const receipt=shallowRef<{sourceId:string;channel:string;operation:KnowledgeSyncOperation;data?:KnowledgeSyncReply;unknown:boolean;detached:boolean}|null>(null)
const key=(source:KnowledgeSource)=>JSON.stringify([source.id,source.channel])
const source=computed(()=>read.status?.sync.sources.find(s=>key(s)===selected.value))
const currentRead=computed(()=>Boolean(read.provider&&read.provider===knowledgeReadProvider.value))
const blocked=computed(()=>!currentRead.value||!knowledgeSyncProvider.value||read.loading||read.statusLoading||busy.value||knowledgeSyncPending.value||knowledgeAgentPending.value||chat.busy||chat.transportPending)
const canDry=computed(()=>!blocked.value&&canKnowledgeSync(read.status,source.value,false))
const canRun=computed(()=>!blocked.value&&canKnowledgeSync(read.status,source.value,true)&&!hasUnknownKnowledgeSync(knowledgeSyncProvider.value,selected.value))
let revision=0,controller:AbortController|undefined,pendingSync:{provider:KnowledgeSyncProvider;sourceKey:string;operation:KnowledgeSyncOperation}|undefined
function invalidate(){revision++;controller?.abort();if(receipt.value)receipt.value={...receipt.value,detached:true};notice.value='';failed.value=false}
watch([()=>read.status,()=>read.provider,knowledgeReadProvider,knowledgeSyncProvider],()=>{
  invalidate()
  if(!read.status?.sync.sources.some(s=>key(s)===selected.value))selected.value=read.status?.sync.sources[0]?key(read.status.sync.sources[0]):''
},{immediate:true,flush:'sync'})
watch(selected,invalidate,{flush:'sync'})
async function execute(operation:KnowledgeSyncOperation){
  const p=knowledgeSyncProvider.value,s=source.value
  if(!p||!s||(operation==='run'?!canRun.value:!canDry.value))return
  const frozen={sourceId:s.id,channel:s.channel},sourceKey=selected.value,version=revision
  const active=new AbortController();controller=active;pendingSync={provider:p,sourceKey,operation};busy.value=true;knowledgeSyncPending.value=true;failed.value=false
  receipt.value={...frozen,operation,unknown:false,detached:false}
  notice.value=operation==='run'?'正在按批准来源同步；等待排队回执。':'正在生成同步演练计划。'
  const current=()=>revision===version&&p===knowledgeSyncProvider.value&&read.provider===knowledgeReadProvider.value&&selected.value===sourceKey
  try{
    const data=await p.sync(operation,frozen,active.signal)
    if(!current())return
    receipt.value={...frozen,operation,data,unknown:false,detached:false}
    notice.value=operation==='run'?'同步任务已持久化排队，尚未证明写入完成。刷新状态核对任务和完成 SHA。':'同步演练完成，尚未写入知识库。'
  }catch(cause){
    const error=cause instanceof KnowledgeSyncError?cause:new KnowledgeSyncError('unconfirmed','unknown')
    const unknown=operation==='run'&&error.outcome==='unknown'
    if(unknown)markUnknownKnowledgeSync(p,sourceKey)
    if(receipt.value?.sourceId===frozen.sourceId&&receipt.value.channel===frozen.channel)receipt.value={...frozen,operation,unknown,detached:!current()}
    if(current()){notice.value=error.message;failed.value=true}
  }finally{
    busy.value=false;if(controller===active){controller=undefined;pendingSync=undefined}
    // Keep all UI controls locked until an abort-unaware fetch/stream actually settles.
    await p.waitForIdle();knowledgeSyncPending.value=false
  }
}
function cancel(){controller?.abort()}
onDeactivated(()=>{
  revision++;controller?.abort()
  const unknown=busy.value&&pendingSync?.operation==='run'
  if(unknown&&pendingSync)markUnknownKnowledgeSync(pendingSync.provider,pendingSync.sourceKey)
  if(busy.value&&receipt.value)receipt.value={...receipt.value,unknown:receipt.value.unknown||unknown,detached:true}
})
onBeforeUnmount(invalidate)
const flag=(v:boolean|undefined)=>v===true?'是':v===false?'否':'未知'
</script>
<template>
  <details class="section-card knowledge-sync" aria-label="知识同步">
    <summary>同步</summary>
    <p>演练只展示计划，不做知识库写入。执行同步默认关闭，须符合当前服务端逐源授权；页面不提供直接改写数据库、批准来源或开启 writer 的入口。</p>
    <p v-if="!knowledgeSyncProvider">当前构建未接入原 Companion 同步操作。</p>
    <p v-if="!read.status">先连接知识查询并读取状态；不自动生成计划或执行同步。</p>
    <template v-else>
      <dl><dt>同步桥接</dt><dd>{{ read.status.sync.available?'可用':'不可用 / 未知' }}</dd><dt>全局写入门禁</dt><dd>{{ read.status.sync.writerEnabled?'允许入队，以逐源状态及服务端本次校验为准':'关闭' }}</dd><dt>定时同步</dt><dd>{{ read.status.sync.schedulerEnabled?'配置已开启，运行进程待核实':'关闭' }}</dd></dl>
      <p v-if="read.status.sync.error" role="alert">{{ read.status.sync.error.reason?syncPolicyText[read.status.sync.error.reason]:read.status.sync.error.message }}</p>
      <p v-if="!read.status.sync.available">来源登记读取不可用 / 未知，不能把空列表当作没有来源。</p><p v-else-if="!read.status.sync.sources.length">尚无已登记的同步来源；这不是检索失败。</p>
      <ul class="knowledge-sources"><li v-for="s in read.status.sync.sources" :key="key(s)"><strong>{{ s.label }} · {{ s.channel==='local'?'本地（local）':'正式（official）' }}</strong><p>{{ s.id }} · 新鲜度 {{ s.freshness || '未知' }} · 待同步 {{ s.pending ?? '未知' }}</p><p>目标 SHA：{{ s.targetSha || '未知' }}<br>完成 SHA：{{ s.completedSha || '未知' }}</p><p>已批准：{{ flag(s.approved) }} · 已启用：{{ flag(s.enabled) }} · 来源 writer 就绪：{{ flag(s.writerReady) }}</p><p v-if="s.error" role="alert">{{ s.error.reason?syncPolicyText[s.error.reason]:s.error.message }}</p><ul v-if="s.jobs?.length"><li v-for="job in s.jobs" :key="job.id">任务 {{ job.id }} · {{ job.status }} · SHA：{{ job.sourceCommit || '未知' }}</li></ul></li></ul>
      <label for="knowledge-sync-source">已登记来源</label>
      <div class="knowledge-sync-actions"><select id="knowledge-sync-source" v-model="selected" :disabled="blocked || !read.status.sync.available || !read.status.sync.sources.length"><option v-if="!read.status.sync.sources.length" value="">暂无可用来源</option><option v-for="s in read.status.sync.sources" :key="key(s)" :value="key(s)">{{ s.label }} · {{ s.channel }}</option></select><el-button :disabled="!canDry" @click="execute('dry-run')">同步演练</el-button><el-button :disabled="!canRun" @click="execute('run')">执行同步</el-button><el-button v-if="busy" @click="cancel">停止等待</el-button></div>
      <p v-if="source">当前来源 {{ source.id }} / {{ source.channel }}。本页展示的是上次状态快照，不是新的写入授权；原服务每次重新校验逐源策略。</p>
      <p v-if="source && !canKnowledgeSync(read.status,source,true)">执行未开放：需要全局 writerEnabled 以及此来源 approved、enabled、writerReady 全部为 true；缺失字段按未知处理。可用时仍可单独演练。</p>
      <p v-if="hasUnknownKnowledgeSync(knowledgeSyncProvider,selected)" role="alert">此来源存在未确认的同步结果，本页不再次执行。请用上方“刷新状态”核对任务、目标与完成 SHA；停止等待不等于撤销已入队任务。</p>
    </template>
    <p v-if="knowledgeSyncPending && !busy" role="status">底层请求尚未结束，暂不接受下一笔操作。</p>
    <p v-if="notice" :role="failed?'alert':'status'" aria-live="polite">{{ notice }}</p>
    <section v-if="receipt" class="knowledge-sync-receipt" aria-live="polite"><h4>{{ receipt.detached?'原来源记录（已离开当前上下文）':'本次同步记录' }}</h4><p>{{ receipt.sourceId }} / {{ receipt.channel }} · {{ receipt.operation==='run'?'执行同步':'同步演练' }}</p><p v-if="receipt.unknown">UNKNOWN：没有确认是否已入队，不自动重试。</p><pre v-if="receipt.data">{{ formatKnowledgeSyncPlan(receipt.data.plan) }}</pre></section>
    <p>进度来自手动刷新后的来源任务、新鲜度、待同步数量及 SHA，没有百分比进度或取消后台任务接口。排队回执不等于索引或文档写入完成。</p>
  </details>
</template>
<style scoped>
.knowledge-sync{margin-top:16px;overflow-wrap:anywhere}.knowledge-sync summary{cursor:pointer;font-weight:600}.knowledge-sync p{line-height:1.7}.knowledge-sync-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:12px 0}.knowledge-sync select{max-width:100%;padding:8px;border:1px solid #dcdfe6;border-radius:4px}.knowledge-sync pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f7fb;padding:12px;border-radius:6px;max-height:480px;overflow:auto}.knowledge-sources>li{margin:12px 0}.knowledge-sync dl{display:grid;grid-template-columns:120px 1fr;gap:6px}.knowledge-sync dd{margin:0}
</style>
