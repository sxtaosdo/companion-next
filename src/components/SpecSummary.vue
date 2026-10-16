<script setup lang="ts">
import { EditPen } from '@element-plus/icons-vue'
import { useWorkspaceStore } from '../stores/workspace'
const store = useWorkspaceStore()
defineEmits<{ edit: [] }>()
</script>
<template>
  <section class="spec-summary panel">
    <div><span class="field-label">项目规范 · {{ store.localDraft ? '本地草稿' : '只读摘要' }}</span><strong>{{ store.spec?.version ?? '尚未建立规范' }}</strong></div>
    <div><span class="field-label">设计画布</span><strong>{{ store.spec ? `${store.spec.width} × ${store.spec.height}` : '待确认' }}<small v-if="store.spec">px</small></strong></div>
    <div><span class="field-label">风格样板</span><strong class="style-value">{{ store.spec?.styleKeywords || store.spec?.styleName || '待确认' }}</strong></div>
    <div><span class="field-label">样板批准</span><strong class="approval-pending">{{ store.localDraft ? '草稿未批准' : store.project?.styleApproval === 'approved' ? (store.isDemo ? '已批准 · 示例' : '已批准') : store.project?.styleApproval === 'pending' ? '待人工确认' : '尚无证据' }}</strong></div>
    <el-button :icon="EditPen" :disabled="!store.project" @click="$emit('edit')">{{ store.spec ? '编辑本地草稿' : '新建本地草稿' }}</el-button>
  </section>
</template>
