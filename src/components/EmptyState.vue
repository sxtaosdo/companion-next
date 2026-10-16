<script setup lang="ts">
import { computed } from 'vue'
import { Connection, ArrowRight } from '@element-plus/icons-vue'
import { useWorkspaceStore } from '../stores/workspace'
import { liveProvider } from '../integration'
const store = useWorkspaceStore()
const title = computed(() => store.loading ? '正在读取所选数据源' : store.connection === 'error' ? '读取未完成，等待有效数据' : store.mode === 'live' && store.connection === 'connected' ? '只读数据源中暂无可展示项目' : '工作台已就绪，等待连接项目')
const description = computed(() => store.loading ? '只读查询正在进行，结果就绪后更新。' : store.connection === 'error' ? '没有展示旧数据或自动加载示例。你可以重试，或主动查看示例界面。' : store.mode === 'live' && store.connection === 'connected' ? '请在服务状态页查看来源与读取限制。没有为真实数据源补入示例项目。' : '当前没有读取任何真实项目或服务。你可以先体验完整界面，再接入经过核验的只读数据源。')
</script>
<template>
  <section class="empty-workspace panel">
    <div class="empty-visual"><div class="orbital-ring"></div><div class="empty-icon"><el-icon :size="38"><Connection /></el-icon></div><span class="orbit-dot dot-one"></span><span class="orbit-dot dot-two"></span></div>
    <span class="eyebrow">A CLEAR START</span>
    <h2>{{ title }}</h2>
    <p class="empty-description">{{ description }}</p>
    <div class="empty-actions"><el-button type="primary" size="large" :loading="store.loading" @click="store.openDemo">查看示例工作台<el-icon class="button-trail"><ArrowRight /></el-icon></el-button><el-button v-if="liveProvider" size="large" @click="store.connect(liveProvider)">连接只读数据源</el-button><el-button v-else size="large" disabled>只读数据源未配置</el-button></div>
    <div class="empty-boundary"><span><i class="tiny-dot"></i> 示例资料独立标识</span><span><i class="tiny-dot"></i> 不修改真实工程</span><span><i class="tiny-dot"></i> 配置仅存本地草稿</span></div>
  </section>
</template>
