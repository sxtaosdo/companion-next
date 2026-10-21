<script setup lang="ts">
import { computed,onBeforeUnmount } from 'vue'
import { useProjectConnectionsStore } from '../stores/project-connections'
import { CLIENT_LABELS } from '../domain/project-connections'
const props=defineProps<{owner:symbol;receiptOnly?:boolean}>(),emit=defineEmits<{sent:[success:boolean]}>(),store=useProjectConnectionsStore()
let alive=true;onBeforeUnmount(()=>{alive=false})
async function confirm(){const done=await store.send(props.owner,true);if(alive)emit('sent',done)}
const pending=computed(()=>store.prepared?.owner===props.owner?store.prepared:null)
</script>
<template>
 <section v-if="pending&&!receiptOnly" class="connection-confirm" data-testid="connection-confirmation"><strong>{{ pending.project.name }} · {{ pending.project.id }}</strong><p>{{ pending.project.path }}</p><p v-for="(request,index) in pending.requests" :key="index">{{ request.kind==='client'?`注册到 ${CLIENT_LABELS[request.target]}`:`工具范围改为 ${request.preset.name}（${request.preset.id}）` }}</p><p>此操作会写入所列本地配置。原接口处理冲突，不保证失败回滚；本页不自动重试，关闭不代表后台取消。</p><el-button :disabled="!store.available" type="warning" @click="confirm">确认写入所列配置</el-button><el-button @click="store.cancel(owner)">取消</el-button></section>
 <p v-if="store.message?.owner===owner" role="status">{{ store.message.text }}</p><pre v-for="(receipt,index) in store.receipts.filter(r=>r.owner===owner)" :key="index" class="connection-receipt">{{ receipt.text }}</pre>
</template>
<style scoped>.connection-confirm{border:1px solid var(--border-color);padding:10px;border-radius:8px}.connection-confirm p{overflow-wrap:anywhere}.connection-receipt{white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto;font-size:12px}</style>
