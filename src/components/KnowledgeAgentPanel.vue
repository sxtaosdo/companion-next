<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { useKnowledgeAgentStore } from '../stores/knowledge-agent'
import { useKnowledgeConversationStore } from '../stores/knowledge-conversation'
import { useWorkspaceStore } from '../stores/workspace'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { knowledgeAgentPending, knowledgeAgentProvider } from '../knowledge-agent-integration'
import { knowledgeSyncPending } from '../knowledge-sync-integration'
import { companionBrowserProvider } from '../companion-browser-integration'
import { isKnowledgeRequestId } from '../domain/knowledge-read'
import type { KnowledgeAgent as AgentListItem } from '../domain/knowledge-read'
const props=withDefaults(defineProps<{active?:boolean}>(),{active:true}),pageActive=ref(true)
const enabled=computed(()=>props.active&&pageActive.value)
const read=useKnowledgeReadStore(),agent=useKnowledgeAgentStore(),chat=useKnowledgeConversationStore(),workspace=useWorkspaceStore(),browser=useCompanionBrowserStore(),registered=useRegisteredProjectStore()
const agents=shallowRef<AgentListItem[]>([]),selected=ref(''),catalogError=ref(''),catalogLoaded=ref(false)
const connected=computed(()=>Boolean(read.provider&&read.provider===knowledgeReadProvider.value))
const accessReady=computed(()=>Boolean(connected.value&&read.status?.cli.available&&read.status.cli.compatible&&['configured','verified'].includes(read.status.retrieval.auth)))
const blocked=computed(()=>!enabled.value||read.loading||read.statusLoading||read.agentCatalogLoading||knowledgeAgentPending.value||knowledgeSyncPending.value||chat.transportPending)
const lastReadDefault=ref('')
watch(()=>read.provider,()=>{lastReadDefault.value=''},{flush:'sync'})
watch(()=>read.status,status=>{if(status&&isKnowledgeRequestId(status.retrieval.kbId))lastReadDefault.value=status.retrieval.kbId},{immediate:true,flush:'sync'})
const selectedKnowledgeBase=computed(()=>read.kbId.trim()||read.status?.retrieval.kbId||lastReadDefault.value)
const scopeKey=computed(()=>JSON.stringify({knowledgeBase:selectedKnowledgeBase.value,workspace:{mode:workspace.mode,id:workspace.selectedProjectId,name:workspace.project?.name??''},companion:{connected:browser.connected,project:browser.projects.find(p=>p.id===browser.callProjectId)??null},registered:{requestedId:registered.requestedId,project:registered.project,invalidated:registered.invalidated}}))
let catalogRevision=0,leaving=false
function clearCatalog(){catalogRevision++;agents.value=[];selected.value='';catalogError.value='';catalogLoaded.value=false}
watch([()=>read.provider,knowledgeReadProvider],clearCatalog,{immediate:true,flush:'sync'})
function applyCatalog(items:AgentListItem[]){agents.value=items.filter(item=>isKnowledgeRequestId(item.id));if(!agents.value.some(item=>item.id===selected.value))selected.value=agents.value[0]?.id??'';catalogLoaded.value=true;catalogError.value=''}
// The existing read-only Agent list action can populate the original selector too.
watch(()=>read.result,value=>{if(connected.value&&value?.kind==='agents')applyCatalog(value.data.items)},{immediate:true,flush:'sync'})
watch(()=>read.agentCatalog,value=>{if(connected.value&&value)applyCatalog(value)},{immediate:true,flush:'sync'})
function sync(){agent.syncContext({provider:knowledgeAgentProvider.value,readIdentity:connected.value?read.provider:null,agentId:selected.value,scopeKey:scopeKey.value,ready:Boolean(enabled.value&&accessReady.value&&!read.statusLoading&&!read.agentCatalogLoading&&agents.value.some(item=>item.id===selected.value))})}
watch([knowledgeAgentProvider,knowledgeReadProvider,()=>read.provider,()=>read.status,()=>read.statusLoading,()=>read.agentCatalogLoading,selected,agents,scopeKey],sync,{immediate:true,flush:'sync'})
watch(companionBrowserProvider,()=>{agent.leave();sync()},{flush:'sync'})
async function refresh(){
  if(blocked.value||!accessReady.value)return
  const p=read.provider,revision=++catalogRevision
  knowledgeAgentPending.value=true;catalogError.value=''
  try{
    await read.loadAgentCatalog()
    if(leaving||revision!==catalogRevision||p!==read.provider)return
    if(read.agentCatalog)applyCatalog(read.agentCatalog)
    else{agents.value=[];selected.value='';catalogLoaded.value=false;catalogError.value=read.agentCatalogError||'Agent 列表未读取，不能使用旧选项。'}
  }finally{knowledgeAgentPending.value=false}
}
async function send(){if(blocked.value||!accessReady.value)return;const prepared=agent.prepareSend();if(prepared)await agent.send(prepared,true)}
function reset(){agent.newConversation(true)}
watch(enabled,value=>{if(!value)agent.suspend();sync()},{flush:'sync'})
onActivated(()=>{pageActive.value=true;sync()})
onDeactivated(()=>{pageActive.value=false;agent.suspend();sync()})
onBeforeUnmount(()=>{leaving=true;catalogRevision++;agent.leave()})
const last=computed(()=>{const value=agent.turns.at(-1);return value&&(!value.detached||value.status==='unknown')?value:null})
const statusLabels={sending:'发送中',succeeded:'已收到回答','not-dispatched':'未发出',rejected:'服务已拒绝',unknown:'结果未确认'} as const
const answerJson=computed(()=>last.value?.status==='succeeded'?JSON.stringify({schemaVersion:'companion-knowledge-v1',agentId:last.value.agentId,sessionId:last.value.sessionId,answer:last.value.answer,references:last.value.references},null,2):'')
</script>
<template>
  <section class="section-card knowledge-agent" aria-label="Agent 对话">
    <h3>Agent 问答</h3>
    <p class="form-help">使用所选 Agent 配置的知识范围与模型；服务端可能保留会话。</p>
    <p v-if="!knowledgeAgentProvider">当前构建未开放 Agent 发送；查询仍可用。</p>
    <label for="knowledge-agent-select">Agent</label>
    <div class="knowledge-agent-row"><select id="knowledge-agent-select" v-model="selected" :disabled="blocked || !connected || !agents.length"><option v-if="!agents.length" value="">{{ catalogLoaded?'暂无自定义 Agent':'请读取 Agent 列表' }}</option><option v-for="item in agents" :key="item.id" :value="item.id">{{ item.name || item.id }}</option></select><el-button :disabled="blocked || !accessReady" :loading="read.agentCatalogLoading" @click="refresh">刷新 Agent</el-button></div>
    <p v-if="catalogError" role="alert">{{ catalogError }}</p><p v-if="!accessReady" class="form-help">请先连接知识服务并读取状态。</p>
    <form aria-label="向所选 Agent 提问" @submit.prevent="send"><label for="knowledge-agent-query">问题</label><div class="knowledge-agent-row"><input id="knowledge-agent-query" v-model="agent.query" type="text" maxlength="512" autocomplete="off" placeholder="输入问题"><el-button native-type="submit" type="primary" :disabled="blocked || !agent.canPrepare || !accessReady" :loading="agent.busy">提问</el-button><el-button :disabled="blocked" @click="reset">新对话</el-button><el-button v-if="agent.busy" @click="agent.cancel">停止等待</el-button></div></form>
    <p v-if="agent.busy" role="status">正在等待 Agent 回答…</p><p v-else-if="agent.transportPending || knowledgeAgentPending" role="status">请求尚未结束，请稍候。</p>
    <p v-if="agent.error" role="alert">{{ agent.error }}</p><p v-if="agent.requiresNewConversation">本次结果未确认或已被拒绝，不会自动重试。请先核对已有记录，再开始新对话。</p>
    <section v-if="last" class="knowledge-agent-result" aria-live="polite"><div class="knowledge-agent-result-heading"><h4>{{ last.detached?'原 Agent 记录':'回答与引用' }}</h4><el-tag size="small" :type="last.status==='succeeded'?'success':last.status==='rejected'?'danger':last.status==='unknown'?'warning':'info'">{{ statusLabels[last.status] }}</el-tag></div><h5>问题</h5><pre>{{ last.query }}</pre><template v-if="last.status==='succeeded'"><h5>回答</h5><pre v-if="last.answer">{{ last.answer }}</pre><p v-else>服务返回了空回答；收到回执不代表问题已解决。</p><h5>引用</h5><ul v-if="last.references.length"><li v-for="(reference,index) in last.references" :key="index">知识库：{{ reference.kbId ?? '未返回' }} · 切片：{{ reference.chunkId ?? '未返回' }}</li></ul><p v-else>服务未返回引用。</p></template><p v-if="last.error" role="alert">{{ last.error }}</p><p v-if="last.errorCode==='chat-unavailable'">对话暂不可用；原接口没有区分权限、模型配置或上游原因，不能据此判断只读查询不可用。</p><details class="knowledge-agent-details"><summary>会话与原始回执</summary><p>Agent {{ last.agentId }} · 请求会话 {{ last.requestSessionId || '首次提问' }} · 状态 {{ last.status }}</p><pre v-if="answerJson">{{ answerJson }}</pre></details></section>
    <details class="knowledge-agent-details"><summary>会话与使用说明</summary><p>当前 Agent：{{ selected || '未选择' }} · 当前会话：<code>{{ agent.activeSessionId || '新对话' }}</code></p><p>“新对话”只清除本地绑定，不请求删除服务端会话。切换 Agent、来源或本地工程上下文时，不会复用旧会话。原接口没有会话列表 / 历史切换 / 流式输出 / 后台取消能力。</p><p>CLI 可用且兼容、检索认证已配置或已验证后才可提问；这些状态不代表模型已就绪。停止等待不保证服务端停止处理。</p></details>
  </section>
</template>
<style scoped>
.knowledge-agent{margin:16px 0;overflow-wrap:anywhere}.knowledge-agent p{line-height:1.7}.knowledge-agent-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0 14px}.knowledge-agent input,.knowledge-agent select{padding:9px;border:1px solid #dcdfe6;border-radius:4px;max-width:100%;color:inherit;background:white}.knowledge-agent input{flex:1;min-width:180px}.knowledge-agent pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f7fb;padding:12px;border-radius:6px;max-height:480px;overflow:auto}.knowledge-agent-result{margin-top:14px}.knowledge-agent code{overflow-wrap:anywhere}
</style>

<style scoped>.knowledge-agent-details{margin:14px 0;color:var(--el-text-color-secondary);font-size:12px}.knowledge-agent-details summary{cursor:pointer}.knowledge-agent-result-heading{display:flex;gap:12px;align-items:center;justify-content:space-between}.knowledge-agent-result h5{margin:12px 0 6px}</style>
