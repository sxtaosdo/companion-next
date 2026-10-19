<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { runtimeStateLabel } from '../domain/companion-browser'
import type { ManagedStatus } from '../domain/companion-browser'
const props = defineProps<{ status?: ManagedStatus; passive?: boolean; stopAcknowledged?: boolean }>()
// Original app.ts:1364 uses two independent conditions. Progress is not
// contingent on launchSource, and a version alone does not imply takeover.
const expectedStop = computed(() => !props.passive && props.stopAcknowledged && props.status?.state === 'error')
const detail = computed(() => props.passive ? '' : [
  expectedStop.value ? '后台已返回停止回执，Bridge 当前不可达；进程退出仍需核对。' : '',
  props.status?.launchSource === 'dashboard' ? `Dashboard ${props.status.dashboardVersion || '已接管'}` : '',
  props.status?.dashboardProgress ? `Dashboard 状态 ${props.status.dashboardProgress}` : '',
].filter(Boolean).join('\n'))
const visible = ref(false), focused = ref(false), id = `project-status-${useId()}`
watch(() => props.status?.projectId, () => { visible.value = false; focused.value = false })
watch(detail, value => { if (!value) visible.value = false })
function escape(event: KeyboardEvent) { if (visible.value) { visible.value = false; event.preventDefault(); event.stopPropagation() } }
</script>
<template>
  <el-tooltip :visible="visible && !!detail" :disabled="!detail" placement="top" :show-after="0" :hide-after="0" popper-class="project-status-tooltip">
    <template #content><span :id="id">{{ detail }}</span></template>
    <span class="project-status-trigger" :tabindex="detail ? 0 : undefined" :aria-describedby="visible && detail ? id : undefined" @mouseenter="visible=!!detail" @mouseleave="!focused&&(visible=false)" @focus="focused=true;visible=!!detail" @blur="focused=false;visible=false" @keydown.esc="escape">
      <el-tag size="small" :type="status?.state === 'ready' ? 'success' : 'info'">{{ passive ? '运行状态未探测' : expectedStop ? '已请求停止' : runtimeStateLabel(status?.state ?? 'unknown') }}</el-tag>
    </span>
  </el-tooltip>
</template>
<style scoped>.project-status-trigger{display:inline-flex}.project-status-trigger:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px;border-radius:4px}</style>
<style>.project-status-tooltip{max-width:min(360px,calc(100vw - 32px));white-space:pre-line;overflow-wrap:anywhere;line-height:1.6}</style>
