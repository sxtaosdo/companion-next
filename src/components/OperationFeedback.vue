<script setup lang="ts">
import { computed } from 'vue'
import { Loading, CircleCheck, CircleClose, Warning, InfoFilled } from '@element-plus/icons-vue'
import { operationFeedback } from '../domain/project-operation-feedback'
const props=defineProps<{ phase:string; action:string; message?:string }>()
const feedback=computed(()=>operationFeedback(props.phase,props.action))
const icon=computed(()=>feedback.value.spinning?Loading:feedback.value.tone==='success'?CircleCheck:feedback.value.tone==='danger'?CircleClose:feedback.value.tone==='warning'?Warning:InfoFilled)
</script>
<template><span class="operation-feedback" :class="`operation-feedback--${feedback.tone}`" role="status" aria-live="polite" :aria-busy="feedback.spinning" :title="message"><el-icon :class="{'operation-feedback-spin':feedback.spinning}" aria-hidden="true"><component :is="icon"/></el-icon><strong>{{ feedback.label }}</strong></span></template>
<style scoped>
.operation-feedback{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border-radius:5px;font-size:12px;line-height:1.4;background:var(--el-color-info-light-9);color:var(--el-color-info-dark-2)}.operation-feedback--warning{background:var(--el-color-warning-light-9);color:var(--el-color-warning-dark-2)}.operation-feedback--danger{background:var(--el-color-danger-light-9);color:var(--el-color-danger-dark-2)}.operation-feedback--success{background:var(--el-color-success-light-9);color:var(--el-color-success-dark-2)}.operation-feedback-spin{animation:operation-spin 1s linear infinite}@keyframes operation-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.operation-feedback-spin{animation:none}}
</style>
