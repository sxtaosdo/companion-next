<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { legacyReference, migrationFeatures } from '../domain/product-information'
const route = useRoute()
const isNotMigrated = (status: string) => status === '尚未迁入'
watch(() => route.query.feature, async (value, _previous, onCleanup) => {
  let stale = false; onCleanup(() => { stale = true })
  const feature = migrationFeatures.find((item) => item.id === value)
  if (!feature) return
  await nextTick(); if (stale) return
  const target = document.getElementById(`feature-${feature.id}`)
  target?.focus({ preventScroll: true }); target?.scrollIntoView?.({ block: 'nearest' })
}, { immediate: true })
</script>
<template>
  <section class="panel information-intro"><h2>旧功能保留对照</h2><p>目标是保留旧功能，只改变布局与交互。下面的缺口是待完成工作，不表示允许删掉旧功能。</p><el-alert title="当前新版不是旧 Companion 的完整替换" type="warning" :closable="false" :description="`原 UI 与完整后端参考为 v${legacyReference.inspectedVersion}；${legacyReference.currentTarget} 已核指定接口。功能接线与真实操作验收分别列出，不以页面或目录保存代替完整业务完成。`"/></section>
  <div class="migration-feature-grid"><article v-for="feature in migrationFeatures" :id="`feature-${feature.id}`" :key="feature.id" tabindex="-1" class="panel information-card" :class="{ 'feature-focused': route.query.feature === feature.id }"><div class="section-heading"><h3>{{ feature.title }}</h3><el-tag :type="isNotMigrated(feature.status) ? 'warning' : 'info'">{{ feature.status }}</el-tag></div><p>{{ feature.detail }}</p><RouterLink :to="feature.destination" class="information-link">{{ isNotMigrated(feature.status) ? '查看说明与保留要求' : '查看当前入口' }} →</RouterLink></article></div>
  <section class="panel information-card"><h3>完成判定</h3><p>取得当前菜单、帮助和协议清单 → 每项映射原入口 / 新入口 / 数据与写入合同 → 保留原交互与权限 → 测试失败、中断和恢复 → 在真实旧版环境逐项对照验收。未通过前不删除或替换原 Windows Companion。</p><p>涉及真实配置、服务启动、文件写入与引擎执行的功能，必须沿用已核原合同，不能靠新增一个按钮判作已迁移。</p></section>
</template>
