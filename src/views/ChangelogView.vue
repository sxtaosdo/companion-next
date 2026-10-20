<script setup lang="ts">
import { frontendChanges, frontendIdentity } from '../domain/product-information'
import { CHANGELOG_ENTRIES } from '../domain/legacy-v148-changelog'
import { groupProductChangelog } from '../domain/changelog-days'
const days = groupProductChangelog(frontendChanges, CHANGELOG_ENTRIES)
</script>
<template>
  <section class="panel information-intro"><h2>更新记录</h2><p>{{ frontendIdentity.name }} v{{ frontendIdentity.version }} · 按日汇总</p><RouterLink to="/about" class="information-link">软件与版本信息 →</RouterLink></section>
  <details v-for="(day,index) in days" :key="day.key" :data-day="day.date" :open="index === 0" class="panel information-card changelog-entry">
    <summary><strong>{{ day.date }} 更新</strong><span>{{ day.versions.length }} 个关联版本</span></summary>
    <ol class="daily-changes"><li v-for="(change,number) in day.changes" :key="number">{{ change }}</li></ol>
    <details class="changelog-version-trace"><summary>版本与条目对应</summary><ul><li v-for="(origin,number) in day.origins" :key="number"><strong>{{ origin.product }} v{{ origin.version }}</strong><span v-if="origin.title"> · {{ origin.title }}</span> · {{ origin.firstChange <= origin.lastChange ? `第 ${origin.firstChange}–${origin.lastChange} 项` : '无变更内容' }}<time v-if="origin.updatedAt" :datetime="origin.updatedAt"> · 原时间 {{ origin.updatedAt }}</time><span v-else-if="origin.date && origin.date !== day.date"> · 原日期 {{ origin.date }}</span></li></ul></details>
  </details>
</template>
<style scoped>
.daily-changes{padding-left:22px;margin:12px 0;line-height:1.8}.changelog-version-trace{margin-top:12px;font-size:12px;color:var(--el-text-color-secondary)}.changelog-version-trace summary{cursor:pointer}.changelog-version-trace ul{padding-left:18px;line-height:1.8}.changelog-entry>summary{display:flex;align-items:center;flex-wrap:wrap;gap:8px;cursor:pointer}.changelog-entry>summary strong{font-size:17px}.changelog-entry>summary span{font-size:12px;color:var(--el-text-color-secondary)}
</style>
