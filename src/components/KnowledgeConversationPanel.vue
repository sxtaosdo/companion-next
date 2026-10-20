<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { useKnowledgeConversationStore } from '../stores/knowledge-conversation'
import { useWorkspaceStore } from '../stores/workspace'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { knowledgeAgentPending } from '../knowledge-agent-integration'
import { knowledgeSyncPending } from '../knowledge-sync-integration'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { knowledgeConversationProvider } from '../knowledge-conversation-integration'
import { companionBrowserProvider } from '../companion-browser-integration'
import { isKnowledgeRequestId } from '../domain/knowledge-read'
const props=withDefaults(defineProps<{active?:boolean}>(),{active:true}),pageActive=ref(true)
const enabled=computed(()=>props.active&&pageActive.value)
const read=useKnowledgeReadStore(),chat=useKnowledgeConversationStore(),workspace=useWorkspaceStore(),browser=useCompanionBrowserStore(),registered=useRegisteredProjectStore()
const confirmed=ref(false),resetConfirmed=ref(false),clearConfirmed=ref(false)
const lastReadDefault=ref('')
watch(()=>read.provider,()=>{lastReadDefault.value=''}, {flush:'sync'})
watch(()=>read.status, status=>{if(status&&isKnowledgeRequestId(status.retrieval.kbId))lastReadDefault.value=status.retrieval.kbId}, {immediate:true,flush:'sync'})
const kbId=computed(()=>read.kbId.trim() || read.status?.retrieval.kbId || lastReadDefault.value)
// Local isolation only. The v148 wire contract has no Cocos project field.
const scopeKey=computed(()=>JSON.stringify({workspace:{mode:workspace.mode,id:workspace.selectedProjectId,name:workspace.project?.name??''},companion:{connected:browser.connected,project:browser.projects.find(p=>p.id===browser.callProjectId)??null},registered:{requestedId:registered.requestedId,project:registered.project,invalidated:registered.invalidated}}))
function sync(){chat.syncContext({provider:knowledgeConversationProvider.value,readIdentity:read.provider===knowledgeReadProvider.value?read.provider:null,kbId:kbId.value,scopeKey:scopeKey.value,ready:Boolean(enabled.value&&read.provider&&read.provider===knowledgeReadProvider.value&&!read.statusLoading&&(read.kbId.trim()||read.status)&&isKnowledgeRequestId(kbId.value))})}
watch([knowledgeConversationProvider,knowledgeReadProvider,()=>read.provider,kbId,()=>read.statusLoading,()=>read.status,()=>read.kbId,scopeKey],sync,{immediate:true,flush:'sync'})
watch(companionBrowserProvider,()=>{chat.leave();sync()},{flush:'sync'})
watch(()=>chat.revision,()=>{confirmed.value=false;resetConfirmed.value=false;clearConfirmed.value=false},{flush:'sync'})
const statusLabels={sending:'发送中，尚无回执',succeeded:'已收到回答', 'not-dispatched':'未发出',rejected:'服务明确拒绝',unknown:'结果未确认'} as const
function prepare(){confirmed.value=false;chat.prepareSend()}
async function send(){const prepared=chat.prepared;if(!prepared||!confirmed.value)return;await chat.send(prepared,confirmed.value);confirmed.value=false}
function reset(){chat.newConversation(resetConfirmed.value);resetConfirmed.value=false}
function clear(){chat.clearCompleted(clearConfirmed.value);clearConfirmed.value=false}
watch(enabled,value=>{if(!value)chat.suspend();sync()},{flush:'sync'})
onActivated(()=>{pageActive.value=true;sync()})
onDeactivated(()=>{pageActive.value=false;chat.suspend();sync()})
onBeforeUnmount(()=>chat.leave())
</script>
<template>
  <section class="section-card knowledge-conversation" aria-label="知识库问答">
    <div class="conversation-heading"><h3>知识库问答</h3><el-tag :type="knowledgeConversationProvider?'warning':'info'">{{ knowledgeConversationProvider?'每次确认发送':'当前构建不具备发送能力' }}</el-tag></div>
    <el-alert type="warning" :closable="false" title="发送会使用原服务配置的模型，可能保存服务端会话" description="仅在你逐次确认问题、知识库和会话后发送。取消只是停止等待 / 请求中止，不证明模型未收到；不会自动重发。"/>
    <p v-if="!knowledgeConversationProvider">请从正常 Companion 工作区打开问答。只读、图片审阅与配置编辑构建均不会注册发送；查询功能继续可用。</p>
    <p>目标知识库：<strong>{{ kbId || '未知，请输入知识库 ID 或显式读取默认知识库' }}</strong><span v-if="!read.kbId.trim() && kbId">（已读默认值，发送时仍冻结为此 ID）</span></p>
    <p>当前服务会话：<code>{{ chat.activeSessionId || '尚无，新提问不会携带旧会话' }}</code></p>
    <p class="form-help">原问答接口不关联 Cocos 工程；页面工程、知识库或来源变化会撤销本地确认并隔离旧记录，不会把工程资料自动附入问题。回答、问题和会话仅留此页面内存，刷新会丢失；开始新会话不删除服务端历史。</p>
    <label class="conversation-input">问题（1–512 字符，规范化后不得以 - 开头或包含换行 / 控制字符）<el-input v-model="chat.query" type="textarea" :rows="3" maxlength="512" aria-label="知识库问题" placeholder="先核对目标知识库，再准备本次发送"/></label>
    <div class="conversation-actions"><el-button type="primary" :disabled="!chat.canPrepare" @click="prepare">核对本次问题与会话</el-button><el-button v-if="chat.busy" @click="chat.cancel">停止等待并请求中止</el-button></div>
    <p v-if="chat.transportPending" role="status">底层请求尚未结束，当前所有新发送仍被阻止；切换来源或开始新会话不能跳过此保护。</p>
    <el-alert v-if="chat.error" type="warning" :closable="false" :title="chat.error"/>
    <p v-if="chat.requiresNewConversation">当前会话存在拒绝或未确认结果，不再继续发送或自动重试。先核对下方记录；如决定开始新的本地会话，须另行确认，原记录仍保留。新会话不会撤销上一问答，重复相同问题可能再次调用模型。</p>
    <section v-if="chat.prepared" class="conversation-confirm" aria-label="本次发送确认">
      <h4>尚未发送：核对冻结内容</h4><p>来源 {{ chat.prepared.providerLabel }} · 知识库 {{ chat.prepared.kbId }}</p><p>会话 {{ chat.prepared.sessionId || '新会话' }}</p><pre>{{ chat.prepared.query }}</pre>
      <el-checkbox v-model="confirmed" aria-label="确认本次知识库发送">我确认向此知识库的已配置模型发送以上问题，了解服务端可能保存会话</el-checkbox>
      <el-button type="warning" :disabled="!confirmed || chat.busy || chat.transportPending || knowledgeSyncPending || knowledgeAgentPending" @click="send">确认并发送这一次</el-button>
    </section>
    <div class="conversation-reset"><el-checkbox v-model="resetConfirmed" aria-label="确认开始新知识会话">结束当前本地会话绑定，保留旧记录；不删除服务端历史</el-checkbox><el-button :disabled="!resetConfirmed || chat.transportPending" @click="reset">开始新会话</el-button></div>
    <section class="conversation-history" aria-live="polite"><h4>本页发送记录（{{ chat.turns.length }} / 20）</h4><p v-if="!chat.turns.length">尚无发送记录，不显示示例回答。</p>
      <article v-for="turn in chat.turns" :key="turn.id" class="conversation-turn">
        <div class="conversation-heading"><strong>{{ statusLabels[turn.status] }}</strong><el-tag v-if="turn.detached" type="info">原上下文记录 · 不用于当前续问</el-tag></div>
        <p>来源 {{ turn.providerLabel }} · 知识库 {{ turn.kbId }} · 本地会话代次 {{ turn.generation }}</p>
        <p>请求会话：<code>{{ turn.requestSessionId || '当时未携带会话' }}</code></p><p>返回会话：<code>{{ turn.sessionId || '未收到可核验会话' }}</code></p>
        <h5>已确认的问题</h5><pre>{{ turn.query }}</pre>
        <template v-if="turn.status==='succeeded'"><h5>服务回答</h5><pre v-if="turn.answer">{{ turn.answer }}</pre><p v-else>服务返回了空回答；收到回执不代表问题已解决。</p><h5>服务返回的引用（仅文本）</h5><ul v-if="turn.references.length"><li v-for="(reference,index) in turn.references" :key="index">知识库：{{ reference.kbId ?? '未返回' }} · 切片：{{ reference.chunkId ?? '未返回' }}</li></ul><p v-else>本次未返回引用。</p></template>
        <p v-if="turn.error" role="alert">{{ turn.error }}</p><p v-if="turn.errorCode">结果类别：{{ turn.errorCode }}<span v-if="turn.errorCode==='chat-unavailable'">。原接口未区分对话认证 / 模型配置或上游原因，不能据此判断检索权限。</span></p><p v-if="turn.status==='unknown'">没有确认本次发送是否在服务端产生回答或新会话。保留旧会话信息，不自动重试、不当作发送已撤销。</p>
      </article>
    </section>
    <div v-if="chat.turns.length" class="conversation-reset"><el-checkbox v-model="clearConfirmed" aria-label="确认清理本地已完成记录">只清理本页已收到回答 / 明确拒绝 / 未发出的记录；未确认记录保留，服务端历史不变</el-checkbox><el-button :disabled="!clearConfirmed || chat.transportPending" @click="clear">清理本地已完成记录</el-button></div>
  </section>
</template>
<style scoped>
.knowledge-conversation{margin:16px 0}.knowledge-conversation p{line-height:1.7;overflow-wrap:anywhere}.conversation-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.conversation-heading h3{margin:0 0 12px}.conversation-input{display:block;margin:16px 0;line-height:1.8}.conversation-actions,.conversation-reset{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:14px 0}.conversation-confirm{padding:16px;border:1px solid #eac88e;background:#fff9ef;border-radius:8px;margin:16px 0}.conversation-confirm .el-button{display:block;margin-top:12px}.conversation-turn{border:1px solid #e2e7ef;border-radius:8px;padding:16px;margin:12px 0}.conversation-turn h5{font-size:14px;margin:14px 0 6px}.knowledge-conversation pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#f3f7fb;padding:12px;border-radius:6px;line-height:1.6;font-family:inherit}.knowledge-conversation code{overflow-wrap:anywhere}.knowledge-conversation :deep(.el-checkbox){height:auto;align-items:flex-start;max-width:100%}.knowledge-conversation :deep(.el-checkbox__label){white-space:normal;line-height:1.6}@media(max-width:640px){.conversation-reset{align-items:stretch;flex-direction:column}.conversation-confirm{padding:12px}}
</style>
