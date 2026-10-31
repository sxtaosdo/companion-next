<script setup lang="ts">
import {computed,ref} from 'vue'
import type {WorkflowConversation} from './workflow-operation'
const props=defineProps<{workflowId:string;conversation?:WorkflowConversation;knownThreadId?:string|null;workflowState:string;requestId?:string|null;phase?:'planning'|'execution'}>()
const threadId=computed(()=>props.conversation?.threadId??props.knownThreadId??null)
const copied=ref(''),copyError=ref('')
async function copy(label:string,value:string|null|undefined){copied.value='';copyError.value='';if(!value)return;try{await navigator.clipboard.writeText(value);copied.value=label+' 已复制'}catch{copyError.value='复制失败，请选中下方 ID 手动复制'}}
</script>
<template>
 <section class="conversation-identity" aria-label="Codex 对话标识">
  <h4>Codex 对话标识</h4>
  <p>任务 {{ workflowId }} · {{ (conversation?.phase??phase)==='planning'?'规划':(conversation?.phase??phase)==='execution'?'执行':'阶段未知' }} · 工作流 {{ workflowState }}</p>
  <p>最后已证执行状态：{{ conversation?.lastKnownState??'unknown' }} · {{ conversation?.observedAt??'观察时间未知' }}</p>
  <p>Goal ID：<code>{{ workflowId }}</code> <button type="button" @click="copy('Goal ID',workflowId)">复制 Goal ID</button></p>
  <p>Request ID：<code data-testid="cli-request-id">{{ conversation?.requestId??requestId??'未知' }}</code> <button type="button" :disabled="!(conversation?.requestId??requestId)" @click="copy('Request ID',conversation?.requestId??requestId)">复制 Request ID</button></p>
  <p>Thread ID：<code data-testid="cli-thread-id">{{ threadId??'未知' }}</code> <button type="button" :disabled="!threadId" @click="copy('Thread ID',threadId)">复制 Thread ID</button></p>
  <p>Turn ID：<code data-testid="cli-turn-id">{{ conversation?.turnId??'未知' }}</code> <button type="button" :disabled="!conversation?.turnId" @click="copy('Turn ID',conversation?.turnId)">复制 Turn ID</button></p>
  <p role="status">{{ copied }}</p><p v-if="copyError" role="alert">{{ copyError }}</p>
  <p>客户端发现及打开入口尚未验证。这里显示保存的执行记录，不代表客户端当前有活动对话。</p>
 </section>
</template>
<style scoped>.conversation-identity code{user-select:all;overflow-wrap:anywhere}.conversation-identity p{line-height:1.6}</style>
