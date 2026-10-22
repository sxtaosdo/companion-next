<script setup lang="ts">
import { computed } from 'vue'
import { Loading, CircleCheck, CircleClose, Warning, InfoFilled } from '@element-plus/icons-vue'
import { operationFeedback } from '../domain/project-operation-feedback'
const props=defineProps<{ phase:string; action:string; message?:string }>()
const feedback=computed(()=>operationFeedback(props.phase,props.action))
const icon=computed(()=>feedback.value.spinning?Loading:feedback.value.tone==='success'?CircleCheck:feedback.value.tone==='danger'?CircleClose:feedback.value.tone==='warning'?Warning:InfoFilled)
</script>
<template><el-tag class="companion-status-tag operation-feedback" :type="feedback.tone" role="status" aria-live="polite" :aria-busy="feedback.spinning" :title="message"><el-icon class="companion-status-icon" :class="{'operation-feedback-spin':feedback.spinning}" aria-hidden="true"><component :is="icon"/></el-icon>{{ feedback.label }}</el-tag></template>
<style scoped>.operation-feedback-spin{animation:operation-spin 1s linear infinite}@keyframes operation-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.operation-feedback-spin{animation:none}}</style>
