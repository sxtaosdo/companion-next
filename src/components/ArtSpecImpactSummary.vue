<script setup lang="ts">
import { computed } from 'vue'
import { artSpecImpact, type ArtImpactNeed } from '../domain/art-prototype-presentation'
const props = defineProps<{ specId: string | null; version?: number; needs: readonly ArtImpactNeed[] }>()
const impact = computed(() => artSpecImpact(props.specId, props.needs))
</script>
<template><aside class="spec-impact" data-testid="art-spec-impact"><template v-if="specId"><strong>保存规格新版本的影响</strong><p>当前规格<span v-if="version"> v{{ version }}</span>关联 {{ impact.total }} 项需求，其中 {{ impact.unbound }} 项尚未绑定任务，须显式核对后采用新规格。</p><p>{{ impact.bound }} 项已绑定任务保留原规格快照，不自动重做或覆盖图片。</p></template><p v-else>新规格保存后供后续需求引用；现有规格与任务保持原值。</p></aside></template>
<style scoped>.spec-impact{padding:12px;border:1px solid var(--el-border-color);border-radius:6px;background:var(--el-fill-color-light);line-height:1.7}.spec-impact p{margin:5px 0;overflow-wrap:anywhere}</style>
