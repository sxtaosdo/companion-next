<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import KnowledgeStatusBar from '../components/KnowledgeStatusBar.vue'
import KnowledgeConversationPanel from '../components/KnowledgeConversationPanel.vue'
import KnowledgeAgentPanel from '../components/KnowledgeAgentPanel.vue'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { useKnowledgeConversationStore } from '../stores/knowledge-conversation'
import { useKnowledgePageLifecycle } from '../composables/use-knowledge-page'
import { knowledgeAgentPending } from '../knowledge-agent-integration'
import { knowledgeSyncPending } from '../knowledge-sync-integration'
const route=useRoute(),store=useKnowledgeReadStore(),chat=useKnowledgeConversationStore()
useKnowledgePageLifecycle()
const mode=ref<'kb'|'agent'>('kb')
watch(()=>[route.path,route.query.mode] as const,([path,value])=>{if(path==='/knowledge/qa')mode.value=value==='agent'?'agent':'kb'},{immediate:true,flush:'sync'})
const blocked=computed(()=>!store.provider||store.loading||store.statusLoading||store.agentCatalogLoading||knowledgeAgentPending.value||knowledgeSyncPending.value||chat.transportPending)
</script>
<template>
  <section class="knowledge-question-workspace">
    <KnowledgeStatusBar/>
    <nav class="knowledge-question-modes" aria-label="问答方式"><RouterLink :to="{path:'/knowledge/qa',query:{...route.query,mode:'kb'}}" :class="{active:mode==='kb'}" :aria-current="mode==='kb'?'page':undefined">知识库问答</RouterLink><RouterLink :to="{path:'/knowledge/qa',query:{...route.query,mode:'agent'}}" :class="{active:mode==='agent'}" :aria-current="mode==='agent'?'page':undefined">Agent 问答</RouterLink></nav>
    <p v-if="mode==='agent'&&chat.transportPending" role="status">知识库问答仍在等待回执，请切回知识库问答核对。</p>
    <p v-if="mode==='kb'&&knowledgeAgentPending" role="status">Agent 请求仍在处理中，请切回 Agent 问答核对。</p>
    <KnowledgeConversationPanel v-show="mode==='kb'" :active="mode==='kb'"/>
    <KnowledgeAgentPanel v-show="mode==='agent'" :active="mode==='agent'"/>
    <details v-show="mode==='agent'" class="section-card knowledge-agent-catalog"><summary>Agent 列表详情</summary><el-button :disabled="blocked" :loading="store.agentCatalogLoading" @click="store.loadAgentCatalog()">读取 Agent 列表</el-button><p v-if="store.agentCatalogError" role="alert">{{ store.agentCatalogError }}</p><p v-else-if="store.agentCatalog===null">尚未读取 Agent 列表。</p><p v-else-if="!store.agentCatalog.length">本次没有返回 Agent。</p><article v-for="(item,index) in store.agentCatalog??[]" :key="`${index}:${item.id}`"><h3>{{ item.name||item.id }}</h3><p>{{ item.description }}</p><small>ID：{{ item.id }}</small></article></details>
  </section>
</template>
<style scoped>
.knowledge-question-modes{display:flex;gap:8px;margin:14px 0}.knowledge-question-modes a{padding:7px 14px;border:1px solid var(--el-border-color);border-radius:6px;font-size:13px}.knowledge-question-modes a.active{color:var(--el-color-primary);border-color:var(--el-color-primary);background:var(--el-color-primary-light-9)}.knowledge-agent-catalog summary{cursor:pointer;margin-bottom:12px}.knowledge-agent-catalog article{padding:12px 0;border-top:1px solid var(--el-border-color-lighter)}.knowledge-agent-catalog small{color:var(--el-text-color-secondary)}
</style>
