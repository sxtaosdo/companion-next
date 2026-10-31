<script setup lang="ts">
withDefaults(defineProps<{ title: string; comparing?: boolean; canCompare?: boolean }>(), { comparing: false, canCompare: false })
defineEmits<{ 'toggle-compare': [] }>()
</script>
<template><section class="art-review-layout" data-testid="art-review-layout"><header><h3>{{ title }}</h3><button type="button" data-testid="review-compare" :disabled="!canCompare" @click="$emit('toggle-compare')">{{ comparing ? '退出对比' : '版本对比' }}</button></header><div class="review-toolbar"><slot name="toolbar" /></div><div class="review-columns"><section class="review-images" aria-label="审阅图片"><slot name="images" /></section><aside class="review-meta" aria-label="检查摘要"><h3>检查摘要</h3><slot name="summary" /><slot name="decisions" /></aside></div></section></template>
<style scoped>.art-review-layout{display:grid;gap:14px;min-width:0}.art-review-layout header{display:flex;justify-content:space-between;align-items:center;gap:12px}.art-review-layout h3{font-size:16px;margin:0}.review-columns{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:start}.review-images{min-width:0;min-height:370px;background:repeating-conic-gradient(#eceef4 0% 25%,#fff 0% 50%) 0/24px 24px;border:1px solid var(--el-border-color);border-radius:8px;padding:14px}.review-meta{display:grid;gap:14px;min-width:0}.review-toolbar{min-width:0}.review-images :deep(img){display:block;max-width:100%;max-height:560px;object-fit:contain;margin:auto}.art-review-layout button{font:inherit;padding:8px 12px;border:1px solid var(--el-border-color);border-radius:6px;background:var(--el-bg-color);color:var(--el-color-primary)}button:disabled{opacity:.5;cursor:not-allowed}button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}@media(max-width:1000px){.review-columns{grid-template-columns:minmax(0,1fr) 250px}}@media(max-width:700px){.review-columns{grid-template-columns:1fr}.review-images{min-height:260px}}
/* Declaration bodies below are reused from the approved prototype. */
.art-review-layout{--primary:#7058df;--line:#e2e7f0;--muted:#718098}
.review-images{min-height:0;background:none;border:0;padding:0}.review-images :deep(img){width:60%;max-height:300px}
.review-meta{display:grid;gap:14px;align-content:start}
.review-meta :deep(p){font-size:13px;color:#64748b}
</style>
