<script setup lang="ts">
import { computed } from 'vue'
import { Loading, CircleCheck, Warning, Minus } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import InfoTip from './InfoTip.vue'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { useKnowledgeConversationStore } from '../stores/knowledge-conversation'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { knowledgeAgentPending } from '../knowledge-agent-integration'
import { knowledgeSyncPending } from '../knowledge-sync-integration'
const store=useKnowledgeReadStore(),chat=useKnowledgeConversationStore(),route=useRoute()
const status=computed(()=>store.status)
const knowledgeWarnings=computed(()=>(store.services?.warnings??[]).filter(item=>!item.startsWith('模型启动器')))
const serviceReadFailed=computed(()=>!!store.serviceError||(!store.services?.knowledge&&knowledgeWarnings.value.length>0))
const serviceLabel=computed(()=>store.statusLoading?'检查中':serviceReadFailed.value?'读取失败':!store.services?.knowledge?'未检查':store.services.knowledge.running?'服务可达':'服务不可达')
const retrievalLabel=computed(()=>store.statusLoading?'检查中':store.statusError?'读取失败':!status.value?'检索未检查':status.value.retrieval.auth==='missing'?'认证未配置':status.value.retrieval.auth==='denied'?'认证被拒绝':status.value.retrieval.auth==='verified'&&status.value.retrieval.keyword==='verified'?'检索已验证':'检索待验证')
const blocked=computed(()=>store.statusLoading||store.loading||knowledgeSyncPending.value||knowledgeAgentPending.value||chat.transportPending)
const faultHint=computed(()=>store.statusError?'状态读取失败，请刷新状态重试。':serviceReadFailed.value?'知识服务状态读取失败，请刷新状态重试。':status.value?.retrieval.auth==='missing'?'尚未配置知识访问，请核对已有接入配置。':status.value?.retrieval.auth==='denied'?'知识访问被拒绝，请核对已有接入配置。':status.value&&(!status.value.cli.available||!status.value.cli.compatible)?'知识读取工具不可用，请核对连接。':store.services?.knowledge?.running===false?'知识服务不可达，请核对连接。':'')
</script>
<template>
  <section class="section-card knowledge-connect" aria-label="知识库连接状态">
    <div class="knowledge-title"><strong>知识服务</strong><el-tag :type="store.statusLoading?'info':serviceReadFailed?'danger':store.services?.knowledge?.running?'success':store.services?.knowledge?'warning':'info'" size="small"><el-icon :class="{'is-loading':store.statusLoading}"><component :is="store.statusLoading?Loading:serviceReadFailed?Warning:store.services?.knowledge?.running?CircleCheck:store.services?.knowledge?Warning:Minus"/></el-icon>{{ serviceLabel }}</el-tag><el-tag :type="retrievalLabel==='检索已验证'?'success':(retrievalLabel==='认证被拒绝'||store.statusError)?'danger':'info'" size="small">{{ retrievalLabel }}</el-tag><span class="knowledge-current">当前：{{ store.selectedBaseLabel }}</span><InfoTip label="知识库状态说明" text="服务连通、认证与检索验证分别显示。未检查或超时不表示离线；只在明确点击后读取。"/></div>
    <div class="knowledge-actions"><el-button :disabled="!knowledgeReadProvider||blocked" :loading="store.statusLoading" @click="knowledgeReadProvider&&store.connect(knowledgeReadProvider)">{{ store.provider?'重新连接':'连接知识服务' }}</el-button><el-button v-if="store.provider" :disabled="blocked" @click="store.refreshStatus">刷新状态</el-button><el-button v-if="store.provider" :disabled="blocked" @click="store.disconnect">断开并清空</el-button></div>
    <p v-if="faultHint||!knowledgeReadProvider" class="knowledge-fault" role="alert">{{ faultHint||'当前宿主未接入知识服务。' }} <RouterLink v-if="route.path!=='/knowledge/manage'" to="/knowledge/manage">查看连接与同步</RouterLink></p>
  </section>
</template>
<style scoped>
.knowledge-connect.section-card{box-sizing:border-box;background:#fff;border:1px solid #e2e7f0;border-radius:10px;box-shadow:0 2px 2px #1c304603;padding:14px;margin:0 0 18px}.knowledge-connect :deep(.el-tag__content){display:inline-flex;align-items:center;gap:4px}.knowledge-connect{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;padding:14px}.knowledge-title{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.knowledge-current{color:var(--el-text-color-secondary);font-size:12px}.knowledge-connect>.knowledge-actions{margin-left:auto}.knowledge-fault{flex-basis:100%;font-size:12px;color:var(--el-color-warning-dark-2);margin:0}.knowledge-fault a{color:var(--el-color-primary)}
</style>
