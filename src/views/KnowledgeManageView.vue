<script setup lang="ts">
import { computed } from 'vue'
import KnowledgeStatusBar from '../components/KnowledgeStatusBar.vue'
import KnowledgeSyncPanel from '../components/KnowledgeSyncPanel.vue'
import LocalServiceControls from '../components/LocalServiceControls.vue'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { useKnowledgePageLifecycle } from '../composables/use-knowledge-page'
const store=useKnowledgeReadStore()
useKnowledgePageLifecycle()
const status=computed(()=>store.status)
const passiveReadBuild=import.meta.env.MODE==='companion-readonly'
const authLabel={missing:'未配置',configured:'已配置，尚未验证',verified:'后端已验证',denied:'认证被拒绝'}
const knowledgeWarnings=computed(()=>(store.services?.warnings??[]).filter(item=>!item.startsWith('模型启动器')))
const serviceLabel=computed(()=>store.statusLoading?'检查中':store.serviceError||(!store.services?.knowledge&&knowledgeWarnings.value.length)?'读取失败':store.services?.knowledge?(store.services.knowledge.running?'服务可达':'探测未达'):'未检查')
</script>
<template>
  <section class="knowledge-manage-workspace">
    <KnowledgeStatusBar/>
    <section class="section-card knowledge-access-summary"><h2>连接与认证</h2><dl><dt>知识服务</dt><dd>{{ serviceLabel }}</dd><dt>访问认证</dt><dd>{{ status ? authLabel[status.retrieval.auth] : '未检查' }}</dd></dl></section>
    <LocalServiceControls knowledge-only/>
    <details class="section-card knowledge-technical"><summary>连接与技术详情</summary>
      <el-alert v-if="!knowledgeReadProvider" type="info" :closable="false" :title="passiveReadBuild ? '此只读预览未启用状态探测' : '当前宿主未接入原 Companion 知识接口'" :description="passiveReadBuild ? '原知识状态会执行 CLI / 同步状态查询；此构建暂不注册知识连接。没有判断原服务离线。' : '请通过原 Companion 同源工作区打开；不会跨域连接或自动启动后台。'"/>
        <article class="section-card"><h3>CLI 与检索</h3><dl><dt>CLI</dt><dd>{{ status ? (status.cli.available ? (status.cli.compatible ? '可用且兼容' : '不兼容') : '不可用') : '未读取' }}<span v-if="status?.cli.version"> · {{ status.cli.version }}</span></dd><dt>认证</dt><dd>{{ status ? authLabel[status.retrieval.auth] : '未读取' }}</dd><dt>关键词验证</dt><dd>{{ status ? (status.retrieval.keyword==='verified'?'后端已有检索验证':'尚未验证') : '未读取' }}</dd><dt>默认知识库</dt><dd>{{ status?.retrieval.kbId || '未读取' }}</dd></dl><p v-if="status?.cli.error" role="alert">{{ status.cli.error.message }}</p><p v-if="store.statusError" role="alert">{{ store.statusError }}</p><small>状态来自上次显式读取；服务可达不等于认证或检索通过。</small></article>
        <p v-if="store.serviceError || knowledgeWarnings.length" role="alert">{{ store.serviceError ? '知识服务状态未读取，请刷新状态。' : knowledgeWarnings.join('；') }}</p>
    </details>
    <KnowledgeSyncPanel/>
  </section>
</template>
<style scoped>
.knowledge-access-summary{padding:14px}.knowledge-access-summary h2{font-size:16px;margin:0 0 10px}.knowledge-access-summary dl{display:flex;flex-wrap:wrap;gap:6px 12px;margin:0;font-size:12px}.knowledge-access-summary dt{color:var(--el-text-color-secondary)}.knowledge-access-summary dd{margin:0 12px 0 0}.knowledge-technical{margin:16px 0}.knowledge-technical summary{cursor:pointer}.knowledge-technical article{margin-top:12px}.knowledge-technical p,.knowledge-technical dl,.knowledge-technical small{font-size:12px;line-height:1.7}
</style>
