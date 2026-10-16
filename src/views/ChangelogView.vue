<script setup lang="ts">
import { frontendChanges, frontendIdentity, legacyReference } from '../domain/product-information'
import { CHANGELOG, formatChangelogTime } from '../domain/legacy-v148-changelog'
</script>
<template>
  <section class="panel information-intro"><h2>更新记录</h2><p>当前 {{ frontendIdentity.name }} v{{ frontendIdentity.version }}。独立前端与旧 Companion 的发布历史分别保留；都不代表当前 daemon 实时版本。</p><RouterLink to="/about" class="information-link">查看软件与版本信息 →</RouterLink></section>
  <h2 class="history-section-title">Companion Next 前端</h2>
  <section v-for="entry in frontendChanges" :key="entry.version" class="panel information-card changelog-entry"><div class="section-heading"><h3>v{{ entry.version }} · {{ entry.title }}</h3><span>{{ entry.date }}</span></div><ul><li v-for="change in entry.changes" :key="change">{{ change }}</li></ul></section>
  <section class="panel information-card"><h2>原 Companion 发布日志 · v{{ legacyReference.inspectedVersion }}</h2><p>以下来自已核 v148 原始日志全文，沿用北京时间日历日合并规则，保留当天最新版本与时间。时间文本按浏览器时区显示。原历史里的“已部署 / 本地候选”描述不表示新版已完成相同能力。</p></section>
  <details v-for="(entry, index) in CHANGELOG" :key="entry.version" :open="index === 0" class="panel information-card legacy-changelog"><summary><strong>v{{ entry.version }}</strong><time :datetime="entry.updatedAt">{{ formatChangelogTime(entry.updatedAt) }}</time></summary><ul><li v-for="(change, number) in entry.changes" :key="number">{{ change }}</li></ul></details>
</template>
