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
  <section class="panel information-intro"><h2>旧功能保留对照</h2><p>目标是保留旧功能，只改变布局与交互。Vue 页面迁移与继承的宿主业务状态分别核对；页面接线不代表业务通过，外部服务未重跑也不自动表示页面未迁移。</p><el-alert title="当前新版不是旧 Companion 的完整替换" type="warning" :closable="false" :description="`原 UI 与完整后端参考为 v${legacyReference.inspectedVersion}；${legacyReference.currentTarget} 已核指定接口。页面、交互和接口合同迁移与真实业务验收分别列出，不以页面或目录保存代替完整业务完成。`"/></section>
  <div class="migration-feature-grid"><article v-for="feature in migrationFeatures" :id="`feature-${feature.id}`" :key="feature.id" tabindex="-1" class="panel information-card" :class="{ 'feature-focused': route.query.feature === feature.id }"><div class="section-heading"><h3>{{ feature.title }}</h3><el-tag :type="isNotMigrated(feature.status) ? 'warning' : 'info'">{{ feature.status }}</el-tag></div><p>{{ feature.detail }}</p><RouterLink :to="feature.destination" class="information-link">{{ isNotMigrated(feature.status) ? '查看说明与保留要求' : '查看当前入口' }} →</RouterLink></article></div>
  <section class="panel information-card migration-verification-boundaries"><h3>前端迁移判定</h3><p>对照原入口与新入口、按钮、导航、参数、返回状态和错误反馈；确认取消、重复点击、中断和返回后的状态。分页、安装组合和失败回执可以用隔离数据验证前端合同，并注明证据范围，不能只靠新增一个按钮判作已迁移。</p><h3>宿主与真实集成状态</h3><p>前端合同通过不代表宿主、外部客户端或模型服务全部可用。Vue 迁移不要求启动 Cursor、发送真实 Agent 对话或重复运行模型才能通过；这些独立能力的真实证据与技术问题另行记录。真实配置、服务启动、文件写入与引擎执行继续沿用原合同和用户限制。未取得替换所需证据前不删除或替换原 Windows Companion。</p></section>
</template>
