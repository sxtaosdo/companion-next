<script setup lang="ts">
import { computed } from 'vue'
import { DocumentChecked, Clock } from '@element-plus/icons-vue'
import { frontendIdentity, legacyReference } from '../domain/product-information'
import { companionBrowserProvider } from '../companion-browser-integration'
import { aiResourceSaveProvider } from '../ai-resource-save-integration'
import { aiReferenceUploadProvider } from '../ai-reference-upload-integration'
import { knowledgeConversationProvider } from '../knowledge-conversation-integration'
import { imageReviewProvider } from '../image-review-integration'
import { useCompanionBrowserStore } from '../stores/companion-browser'
const directory = useCompanionBrowserStore()
const connected = computed(() => directory.connected && directory.provider === companionBrowserProvider.value)
</script>
<template>
  <section class="panel history-intro"><h2>版本与连接记录</h2><p>页面版本与服务状态分别显示，连接以当前来源的实际读取结果为准。</p></section>
  <div class="history-grid">
    <section class="panel timeline-panel"><h2>版本信息</h2>
      <div class="timeline-entry"><span class="timeline-icon"><el-icon><DocumentChecked/></el-icon></span><div><span class="field-label">当前页面</span><h3>Companion Next · v{{ frontendIdentity.version }}</h3><p>{{ frontendIdentity.releaseDate }}</p><RouterLink to="/changelog">查看更新记录</RouterLink></div></div>
      <div class="timeline-entry"><span class="timeline-icon muted"><el-icon><Clock/></el-icon></span><div><span class="field-label">兼容参考</span><h3>旧 UI v{{ legacyReference.inspectedVersion }} · {{ legacyReference.currentTarget }}</h3><p>参考版本不是当前后台的实时版本。</p><RouterLink to="/migration">查看逐项功能支持范围</RouterLink></div></div>
    </section>
    <section class="panel current-scope"><h2>当前宿主能力</h2>
      <div class="scope-row"><span>工程接口</span><el-tag :type="connected ? 'success' : 'info'" effect="plain">{{ connected ? '已取得真实响应' : '未取得有效响应' }}</el-tag></div>
      <p v-if="connected">读取于 {{ directory.observedAt }} · {{ directory.projects.length }} 个登记工程</p><p v-else-if="directory.projectError" role="alert">{{ directory.projectError }}</p>
      <div class="scope-row"><span>配置保存</span><el-tag :type="aiResourceSaveProvider ? 'warning' : 'info'" effect="plain">{{ aiResourceSaveProvider ? '可逐次确认保存' : '此宿主未提供' }}</el-tag></div>
      <div class="scope-row"><span>参考图上传</span><el-tag :type="aiReferenceUploadProvider ? 'warning' : 'info'" effect="plain">{{ aiReferenceUploadProvider ? '可单独确认上传' : '此宿主未提供' }}</el-tag></div>
      <div class="scope-row"><span>知识库问答</span><el-tag :type="knowledgeConversationProvider ? 'warning' : 'info'" effect="plain">{{ knowledgeConversationProvider ? '可逐次确认发送' : '此宿主未提供' }}</el-tag></div>
      <div class="scope-row"><span>独立图片审阅</span><el-tag type="info" effect="plain">{{ imageReviewProvider ? '已接入适配器，需读取服务' : '此宿主未提供' }}</el-tag></div>
      <p class="subtle-note">接口已接入不代表服务已成功执行；保存、生成、批准和导入均以各自回执为准。</p><RouterLink to="/services">查看真实服务状态</RouterLink>
    </section>
  </div>
</template>
