<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Loading, CircleCheck, CircleClose, Warning, InfoFilled } from '@element-plus/icons-vue'
import { operationFeedback } from '../domain/project-operation-feedback'
import { runtimeStateLabel } from '../domain/companion-browser'
import { projectStateTone } from '../domain/companion-project-display'
import type { ManagedStatus } from '../domain/companion-browser'
const props = defineProps<{ status?: ManagedStatus; passive?: boolean; stopAcknowledged?: boolean; operation?: { action:string; phase:string } }>()
// Original app.ts:1364 uses two independent conditions. Progress is not
// contingent on launchSource, and a version alone does not imply takeover.
const expectedStop = computed(() => !props.passive && props.stopAcknowledged && props.status?.state === 'error')
const detail = computed(() => props.passive ? '' : [
  expectedStop.value ? '后台已返回停止回执，Bridge 当前不可达；进程退出仍需核对。' : '',
  props.status?.launchSource === 'dashboard' ? `Dashboard ${props.status.dashboardVersion || '已接管'}` : '',
  props.status?.dashboardProgress ? `Dashboard 状态 ${props.status.dashboardProgress}` : '',
].filter(Boolean).join('\n'))
const operationState=computed(()=>!props.passive && props.operation && ['sending','unknown','rejected','reported-failure','not-dispatched'].includes(props.operation.phase) ? operationFeedback(props.operation.phase,props.operation.action) : null)
const spinning=computed(()=>operationState.value?.spinning ?? (!props.passive && ['launching','bridge-wait','stopping'].includes(props.status?.state ?? '')))
const tone=computed(()=>operationState.value?.tone ?? projectStateTone(props.status,props.passive,expectedStop.value))
const statusIcon=computed(()=>spinning.value?Loading:tone.value==='success'?CircleCheck:tone.value==='danger'?CircleClose:tone.value==='warning'?Warning:InfoFilled)
const visible = ref(false), focused = ref(false), id = `project-status-${useId()}`
watch(() => props.status?.projectId, () => { visible.value = false; focused.value = false })
watch(detail, value => { if (!value) visible.value = false })
function escape(event: KeyboardEvent) { if (visible.value) { visible.value = false; event.preventDefault(); event.stopPropagation() } }
</script>
<template>
  <el-tooltip :visible="visible && !!detail" :disabled="!detail" placement="top" :show-after="0" :hide-after="0" popper-class="project-status-tooltip">
    <template #content><span :id="id">{{ detail }}</span></template>
    <span class="project-status-trigger" :tabindex="detail ? 0 : undefined" :aria-describedby="visible && detail ? id : undefined" @mouseenter="visible=!!detail" @mouseleave="!focused&&(visible=false)" @focus="focused=true;visible=!!detail" @blur="focused=false;visible=false" @keydown.esc="escape">
      <el-tag size="small" :type="tone" role="status" :aria-busy="spinning"><el-icon class="status-icon" :class="{'status-spin':spinning}" aria-hidden="true"><component :is="statusIcon"/></el-icon>{{ operationState?.label ?? (passive ? '运行状态未探测' : expectedStop ? '已请求停止' : runtimeStateLabel(status?.state ?? 'unknown')) }}</el-tag>
    </span>
  </el-tooltip>
</template>
<style scoped>.project-status-trigger{display:inline-flex}.status-icon{vertical-align:-2px;margin-right:4px}.status-spin{animation:project-status-spin 1s linear infinite}@keyframes project-status-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.status-spin{animation:none}}.project-status-trigger:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px;border-radius:4px}</style>
<style>.project-status-tooltip{max-width:min(360px,calc(100vw - 32px));white-space:pre-line;overflow-wrap:anywhere;line-height:1.6}</style>
