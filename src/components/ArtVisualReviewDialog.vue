<script setup lang="ts">
withDefaults(defineProps<{open:boolean;title:string;locked?:boolean}>(),{locked:false})
const emit=defineEmits<{'update:open':[value:boolean]}>()
</script>
<template><el-dialog align-center :model-value="open" :title="title" width="min(1120px, calc(100vw - 28px))" class="art-visual-review-dialog" :close-on-click-modal="false" :close-on-press-escape="!locked" :show-close="!locked" @update:model-value="!locked&&emit('update:open',$event)"><section data-testid="art-visual-review-dialog" aria-label="独立视觉审阅工作区"><slot/></section></el-dialog></template>

<style scoped>
/* Declaration bodies below are reused from the approved prototype. */
.art-visual-review-dialog{--primary:#7058df;--line:#e2e7f0;--muted:#718098;--el-dialog-padding-primary:0;padding:0;overflow:auto}
.art-visual-review-dialog{border:1px solid var(--line);border-radius:10px;color:#283650;width:min(700px,calc(100vw - 28px));max-height:calc(100dvh - 44px);padding:0;box-shadow:0 18px 60px #16213930}
.art-visual-review-dialog :deep(.el-dialog__header){padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px}
.art-visual-review-dialog :deep(.el-dialog__body){padding:18px 20px;overflow:auto}
@media (max-width:700px) {.art-visual-review-dialog :deep(.el-dialog__header){padding:12px 14px}
}
@media (max-width:700px) {.art-visual-review-dialog :deep(.el-dialog__body){padding:14px}
}
.art-visual-review-dialog{width:var(--el-dialog-width,min(700px,calc(100vw - 28px)))}.art-visual-review-dialog :deep(.el-dialog__header){margin-right:0}.art-visual-review-dialog :deep(.el-dialog__title){font-size:16px;font-weight:600}.art-visual-review-dialog :deep(.el-dialog__headerbtn){position:static;display:grid;place-items:center;width:auto;height:auto;font-size:20px;padding:0 4px;color:#8b97ac}
</style>
