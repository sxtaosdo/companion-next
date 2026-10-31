<script setup lang="ts">
import { computed } from 'vue'
import { ART_APPROVED_TASK_STAGES, currentArtTaskStep } from '../domain/art-prototype-presentation'
const props = withDefaults(defineProps<{ open: boolean; title: string; step: number; reached: number; locked?: boolean; navigationReady?: boolean; wide?: boolean }>(), { locked: false, navigationReady: true, wide: false })
const emit = defineEmits<{ 'update:open': [value: boolean]; step: [index: number] }>()
const current = computed(() => currentArtTaskStep(props.step, props.reached))
function choose(index: number) { if (!props.locked && current.value && index <= props.reached) emit('step', index) }
</script>
<template><el-dialog align-center :model-value="open" :title="title" :width="wide?'min(1120px, calc(100vw - 28px))':'min(700px, calc(100vw - 28px))'" class="art-task-detail" :close-on-click-modal="false" :close-on-press-escape="!locked" :show-close="!locked" @update:model-value="!locked && emit('update:open', $event)"><section data-testid="art-task-detail"><nav v-if="navigationReady" class="task-process" aria-label="当前任务六步流程"><button v-for="(stage,index) in ART_APPROVED_TASK_STAGES" :key="stage" type="button" :aria-current="step === index ? 'step' : undefined" :disabled="locked || !current || index > reached" @click="choose(index)"><span>{{ index + 1 }}</span>{{ stage }}</button></nav><section v-if="current" class="task-current" :aria-label="current"><h3 v-if="navigationReady">{{ current }}</h3><slot :step="step" /></section><p v-else role="status">任务步骤尚未核对，不展开未来操作。</p></section></el-dialog></template>
<style scoped>.task-process{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:16px}.task-process button{display:flex;align-items:center;gap:8px;border:0;background:var(--el-fill-color-light,#f3f5fa);border-radius:5px;padding:6px 8px;font:inherit;font-size:12px;color:var(--el-text-color-secondary)}.task-process span{display:grid;place-items:center;width:auto;height:auto;background:transparent}.task-process [aria-current=step]{background:var(--el-color-primary-light-9);color:var(--el-color-primary);font-weight:600}.task-process button:disabled{opacity:.5;cursor:not-allowed}.task-current{min-width:0}.task-current h3{margin:0 0 14px}.task-process button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
/* Declaration bodies below are reused from the approved prototype. */
.art-task-detail{--primary:#7058df;--line:#e2e7f0;--muted:#718098;--el-dialog-padding-primary:0;padding:0;overflow:auto}
.art-task-detail{border:1px solid var(--line);border-radius:10px;color:#283650;width:min(700px,calc(100vw - 28px));max-height:calc(100dvh - 44px);padding:0;box-shadow:0 18px 60px #16213930}
.art-task-detail :deep(.el-dialog__header){padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}
.art-task-detail :deep(.el-dialog__body){padding:18px 20px;overflow:auto}
@media (max-width:700px) {.art-task-detail :deep(.el-dialog__header){padding:12px 14px}
}
@media (max-width:700px) {.art-task-detail :deep(.el-dialog__body){padding:14px}
}
.art-task-detail{width:var(--el-dialog-width,min(700px,calc(100vw - 28px)))}.art-task-detail :deep(.el-dialog__header){margin-right:0}.art-task-detail :deep(.el-dialog__title){font-size:16px;font-weight:600}.art-task-detail :deep(.el-dialog__headerbtn){position:static;display:grid;place-items:center;width:auto;height:auto;font-size:20px;padding:0 4px;color:#8b97ac}
.task-current{padding:20px;background:#fafbfe;border:1px solid var(--line);border-radius:7px;line-height:1.8}
.task-current h3{margin:10px 0}
.task-process button{padding:6px 8px;background:#f3f5fa;border-radius:5px;font-size:12px;color:#8793a9}
.task-process [aria-current=step]{background:#f0ecfc;color:var(--primary);font-weight:600}
</style>
