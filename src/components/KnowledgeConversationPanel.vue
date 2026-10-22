<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { useKnowledgeConversationStore } from '../stores/knowledge-conversation'
import { useWorkspaceStore } from '../stores/workspace'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { knowledgeConversationProvider } from '../knowledge-conversation-integration'
import { companionBrowserProvider } from '../companion-browser-integration'
import { Loading, CircleCheck, CircleClose, Minus, QuestionFilled } from '@element-plus/icons-vue'
import { isKnowledgeRequestId } from '../domain/knowledge-read'
const props=withDefaults(defineProps<{active?:boolean}>(),{active:true}),pageActive=ref(true)
const enabled=computed(()=>props.active&&pageActive.value)
const read=useKnowledgeReadStore(),chat=useKnowledgeConversationStore(),workspace=useWorkspaceStore(),browser=useCompanionBrowserStore(),registered=useRegisteredProjectStore()
const resetConfirmed=ref(false),clearConfirmed=ref(false)
const lastReadDefault=ref('')
watch(()=>read.provider,()=>{lastReadDefault.value=''}, {flush:'sync'})
watch(()=>read.status, status=>{if(status&&isKnowledgeRequestId(status.retrieval.kbId))lastReadDefault.value=status.retrieval.kbId}, {immediate:true,flush:'sync'})
const kbId=computed(()=>read.kbId.trim() || read.status?.retrieval.kbId || lastReadDefault.value)
// Local isolation only. The v148 wire contract has no Cocos project field.
const scopeKey=computed(()=>JSON.stringify({workspace:{mode:workspace.mode,id:workspace.selectedProjectId,name:workspace.project?.name??''},companion:{connected:browser.connected,project:browser.projects.find(p=>p.id===browser.callProjectId)??null},registered:{requestedId:registered.requestedId,project:registered.project,invalidated:registered.invalidated}}))
function sync(){chat.syncContext({provider:knowledgeConversationProvider.value,readIdentity:read.provider===knowledgeReadProvider.value?read.provider:null,kbId:kbId.value,scopeKey:scopeKey.value,ready:Boolean(enabled.value&&read.provider&&read.provider===knowledgeReadProvider.value&&!read.statusLoading&&(read.kbId.trim()||read.status)&&isKnowledgeRequestId(kbId.value))})}
watch([knowledgeConversationProvider,knowledgeReadProvider,()=>read.provider,kbId,()=>read.statusLoading,()=>read.status,()=>read.kbId,scopeKey],sync,{immediate:true,flush:'sync'})
watch(companionBrowserProvider,()=>{chat.leave();sync()},{flush:'sync'})
watch(()=>chat.revision,()=>{resetConfirmed.value=false;clearConfirmed.value=false},{flush:'sync'})
const statusLabels={sending:'发送中，尚无回执',succeeded:'已收到回答', 'not-dispatched':'未发出',rejected:'服务明确拒绝',unknown:'结果未确认'} as const
function statusTone(status:string):'primary'|'info'|'success'|'warning'|'danger'{return status==='sending'?'primary':status==='succeeded'?'success':status==='rejected'?'danger':status==='unknown'?'warning':'info'}
function statusIcon(status:string){return status==='sending'?Loading:status==='succeeded'?CircleCheck:status==='rejected'?CircleClose:status==='unknown'?QuestionFilled:Minus}
async function send(){const prepared=chat.prepareSend();if(prepared)await chat.send(prepared,true)}
function reset(){chat.newConversation(resetConfirmed.value);resetConfirmed.value=false}
function clear(){chat.clearCompleted(clearConfirmed.value);clearConfirmed.value=false}
watch(enabled,value=>{if(!value)chat.suspend();sync()},{flush:'sync'})
onActivated(()=>{pageActive.value=true;sync()})
onDeactivated(()=>{pageActive.value=false;chat.suspend();sync()})
onBeforeUnmount(()=>chat.leave())
</script>
<template>
  <section class="section-card knowledge-conversation" aria-label="知识库问答">
    <div class="conversation-heading"><h3>知识库问答</h3><el-tag v-if="!knowledgeConversationProvider" type="info">当前构建不具备发送能力</el-tag></div>
    <p class="conversation-target">知识库：<strong>{{ kbId ? read.selectedBaseLabel : '尚未选择' }}</strong><span v-if="kbId" class="conversation-kb-id">{{ kbId }}</span><RouterLink v-if="!kbId" to="/knowledge">选择知识库</RouterLink></p>
    <p class="form-help">发送将使用知识服务配置的模型，服务端可能保留会话。</p>
    <p v-if="!knowledgeConversationProvider">当前构建未开放问答发送；查询仍可使用。</p>
    <label class="conversation-input">问题<el-input v-model="chat.query" type="textarea" :rows="3" maxlength="512" aria-label="知识库问题" placeholder="输入要向当前知识库提出的问题"/></label>
    <div class="conversation-actions"><el-button type="primary" :disabled="!chat.canPrepare" :loading="chat.busy" aria-label="发送知识库问题" @click="send">发送</el-button><el-button v-if="chat.busy" @click="chat.cancel">停止等待 / 本地中止</el-button><el-button v-if="chat.activeSessionId && !chat.requiresNewConversation" :disabled="chat.transportPending" @click="chat.newConversation(true)">新对话</el-button></div>
    <p v-if="chat.transportPending" role="status">{{ chat.busy ? '正在等待回答…' : '请求尚未结束，请稍候。' }}</p>
    <el-alert v-if="chat.error" :type="chat.requiresNewConversation && chat.turns.at(-1)?.status==='unknown' ? 'warning' : 'error'" :closable="false" :title="chat.error"/>
    <p v-if="chat.requiresNewConversation">本次结果未确认或已被拒绝，不会自动重试。请先核对已有记录，再开始新对话。</p>
    <section class="conversation-history" aria-live="polite"><h4>回答与引用</h4><p v-if="!chat.turns.length" class="conversation-empty">输入问题后点击发送，回答会显示在这里。</p>
      <article v-for="turn in chat.turns" :key="turn.id" class="conversation-turn">
        <div class="conversation-heading"><el-tag class="companion-status-tag" size="small" :type="statusTone(turn.status)" role="status" :aria-busy="turn.status==='sending'"><el-icon class="companion-status-icon" :class="{'is-loading':turn.status==='sending'}" aria-hidden="true"><component :is="statusIcon(turn.status)"/></el-icon>{{ statusLabels[turn.status] }}</el-tag><el-tag v-if="turn.detached" type="info">原上下文记录</el-tag></div>
        <h5>问题</h5><pre>{{ turn.query }}</pre>
        <template v-if="turn.status==='succeeded'"><h5>回答</h5><pre v-if="turn.answer">{{ turn.answer }}</pre><p v-else>服务返回了空回答；收到回执不代表问题已解决。</p><h5>引用</h5><ul v-if="turn.references.length"><li v-for="(reference,index) in turn.references" :key="index">知识库：{{ reference.kbId ?? '未返回' }} · 切片：{{ reference.chunkId ?? '未返回' }}</li></ul><p v-else>服务未返回引用。</p></template>
        <p v-if="turn.error" role="alert">{{ turn.error }}</p><p v-if="turn.status==='unknown'">尚未确认服务端是否已生成回答，不会自动重试。</p>
        <details class="conversation-details"><summary>会话与诊断</summary><p>来源 {{ turn.providerLabel }} · 知识库 {{ turn.kbId }} · 本地会话代数 {{ turn.generation }}</p><p>请求会话：<code>{{ turn.requestSessionId || '首次提问' }}</code></p><p>返回会话：<code>{{ turn.sessionId || '未收到可靠会话' }}</code></p><p v-if="turn.errorCode">错误码：{{ turn.errorCode }}<span v-if="turn.errorCode==='chat-unavailable'">；原接口未区分对话鉴权 / 模型禁用或其他原因，不能据此判断检索权限。</span></p></details>
      </article>
    </section>
    <details class="conversation-details"><summary>会话管理与说明</summary>
      <p>当前服务会话：<code>{{ chat.activeSessionId || '新对话' }}</code> · 本页记录 {{ chat.turns.length }} / 20</p>
      <p>取消只会停止等待 / 本地中止，不证明模型未收到请求；不会自动重放。原问答接口不接收 Cocos 工程；页面工程、知识库或来源变化会撤销尚未发送的请求，不会自动重发问题。回答和引用仅保留在当前页面内存，刷新会丢失。</p>
      <p>问题上限 512 字符，规范化后不得以 - 开头，不含换行 / 控制字符。</p>
      <div class="conversation-reset"><el-checkbox v-model="resetConfirmed" aria-label="确认开始新知识会话">清除当前本地会话绑定，保留旧记录；不删除服务端历史</el-checkbox><el-button :disabled="!resetConfirmed || chat.transportPending" @click="reset">开始新会话</el-button></div>
      <div v-if="chat.turns.length" class="conversation-reset"><el-checkbox v-model="clearConfirmed" aria-label="确认清除本地已完成记录">只清除本页已完成记录；未知记录及服务端历史保留</el-checkbox><el-button :disabled="!clearConfirmed || chat.transportPending" @click="clear">清除本地已完成记录</el-button></div>
    </details>
  </section>
</template>
<style scoped>
.knowledge-conversation{margin:16px 0}.knowledge-conversation p{line-height:1.7;overflow-wrap:anywhere}.conversation-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.conversation-heading h3{margin:0 0 12px}.conversation-input{display:block;margin:16px 0;line-height:1.8}.conversation-actions,.conversation-reset{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:14px 0}.conversation-confirm{padding:16px;border:1px solid #eac88e;background:#fff9ef;border-radius:8px;margin:16px 0}.conversation-confirm .el-button{display:block;margin-top:12px}.conversation-turn{border:1px solid #e2e7ef;border-radius:8px;padding:16px;margin:12px 0}.conversation-turn h5{font-size:14px;margin:14px 0 6px}.knowledge-conversation pre{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;background:#f3f7fb;padding:12px;border-radius:6px;line-height:1.6;font-family:inherit}.knowledge-conversation code{overflow-wrap:anywhere}.knowledge-conversation :deep(.el-checkbox){height:auto;align-items:flex-start;max-width:100%}.knowledge-conversation :deep(.el-checkbox__label){white-space:normal;line-height:1.6}@media(max-width:640px){.conversation-reset{align-items:stretch;flex-direction:column}.conversation-confirm{padding:12px}}
</style>

<style scoped>.conversation-target{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.conversation-kb-id{color:var(--el-text-color-secondary);font-size:12px}.conversation-details{margin:14px 0;color:var(--el-text-color-secondary);font-size:12px}.conversation-details summary{cursor:pointer}.conversation-empty{color:var(--el-text-color-secondary)}</style>
