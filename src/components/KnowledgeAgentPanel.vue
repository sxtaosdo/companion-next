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
const answerJson=computed(()=>last.value?.status==='succeeded'?JSON.stringify({schemaVersion:'companion-knowledge-v1',agentId:last.value.agentId,sessionId:last.value.sessionId,answer:last.value.answer,references:last.value.references},null,2):'')
</script>
<template>
  <section class="section-card knowledge-agent" aria-label="Agent 对话">
    <h3>自定义 Agent</h3>
    <p>沿用原 Agent 列表与单个活动会话。提问会调用原服务配置的模型，服务端可能保存会话；模型就绪与对话权限仍由服务端判定，不自动提问。</p>
    <p v-if="!knowledgeAgentProvider">当前构建未接入 Agent 问答，原查询能力仍可用。</p>
    <label for="knowledge-agent-select">自定义 Agent</label>
    <div class="knowledge-agent-row"><select id="knowledge-agent-select" v-model="selected" :disabled="blocked || !connected || !agents.length"><option v-if="!agents.length" value="">{{ catalogLoaded?'暂无自定义 Agent':'先刷新 Agent 列表' }}</option><option v-for="item in agents" :key="item.id" :value="item.id">{{ item.name || item.id }}</option></select><el-button :disabled="blocked || !accessReady" @click="refresh">刷新 Agent</el-button></div>
    <p v-if="catalogError" role="alert">{{ catalogError }}</p><p v-if="!accessReady">先连接并读取原知识状态；CLI 需可用且兼容，检索认证需已配置 / 已验证。这不等于模型已就绪。</p>
    <form aria-label="向所选 Agent 提问" @submit.prevent="send"><label for="knowledge-agent-query">向所选 Agent 提问</label><div class="knowledge-agent-row"><input id="knowledge-agent-query" v-model="agent.query" type="text" maxlength="512" autocomplete="off" placeholder="提问；追问沿用该 Agent 的会话"><el-button native-type="submit" type="primary" :disabled="blocked || !agent.canPrepare || !accessReady">提问</el-button><el-button :disabled="blocked" @click="reset">新对话</el-button><el-button v-if="agent.busy" @click="agent.cancel">停止等待</el-button></div></form>
    <p>当前 Agent：{{ selected || '未选择' }} · 当前会话：<code>{{ agent.activeSessionId || '新对话（首次提问不带旧会话）' }}</code></p>
    <p class="form-help">“新对话”只清除本地绑定，不创建或删除服务端会话。更换 Agent、来源或本地工程上下文时不会复用旧会话。原接口没有会话列表 / 历史切换 / 流式输出 / 后台取消能力。</p>
    <p v-if="agent.busy" role="status">正在等待 Agent 完整答复；原接口返回一次 JSON，不是流式输出。</p><p v-else-if="agent.transportPending || knowledgeAgentPending" role="status">底层请求尚未结束，暂不接受下一笔操作。</p>
    <p v-if="agent.error" role="alert">{{ agent.error }}</p><p v-if="agent.requiresNewConversation">结果未确认或已被拒绝，不自动重发。先核对原会话；明确点“新对话”会解除本地绑定，不会撤回已发送的问题。</p>
    <section v-if="last" class="knowledge-agent-result" aria-live="polite"><h4>{{ last.detached?'原 Agent 的本地消息记录':'本次 Agent 消息' }}</h4><p>{{ last.agentId }} · 请求会话 {{ last.requestSessionId || '首次提问' }} · {{ last.status }}</p><pre>{{ last.query }}</pre><pre v-if="answerJson">{{ answerJson }}</pre><p v-if="last.error" role="alert">{{ last.error }}</p><p v-if="last.errorCode==='chat-unavailable'">对话暂不可用；原接口没有区分权限、模型配置或上游原因，不能据此判断只读查询不可用。</p></section>
  </section>
</template>
<style scoped>
.knowledge-agent{margin:16px 0;overflow-wrap:anywhere}.knowledge-agent p{line-height:1.7}.knowledge-agent-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0 14px}.knowledge-agent input,.knowledge-agent select{padding:9px;border:1px solid #dcdfe6;border-radius:4px;max-width:100%;color:inherit;background:white}.knowledge-agent input{flex:1;min-width:180px}.knowledge-agent pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f7fb;padding:12px;border-radius:6px;max-height:480px;overflow:auto}.knowledge-agent-result{margin-top:14px}.knowledge-agent code{overflow-wrap:anywhere}
</style>
