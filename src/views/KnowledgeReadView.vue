<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import InfoTip from '../components/InfoTip.vue'
import KnowledgeStatusBar from '../components/KnowledgeStatusBar.vue'
import LocalServiceControls from '../components/LocalServiceControls.vue'
import { knowledgeAgentPending } from '../knowledge-agent-integration'
import { knowledgeSyncPending } from '../knowledge-sync-integration'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { useKnowledgePageLifecycle } from '../composables/use-knowledge-page'
import { isKnowledgeRequestId } from '../domain/knowledge-read'
const store=useKnowledgeReadStore(),route=useRoute()
useKnowledgePageLifecycle()
const modelsOnly=computed(()=>route.path==='/knowledge'&&route.query.tab==='models')
const blocked=computed(()=>!store.provider||store.loading||store.statusLoading||knowledgeSyncPending.value||knowledgeAgentPending.value)
const actionLabel={search:'关键词检索',bases:'知识库列表',base:'知识库详情',documents:'文档列表',document:'文档详情',original:'原文预览',chunks:'切片列表',agents:'Agent 列表'}
function selectBase(id:string,name?:string){store.selectKnowledgeBase(id,name)}
function selectDocument(id:string){if(isKnowledgeRequestId(id))store.documentId=id}
</script>
<template>
  <section class="knowledge-read-workspace">
    <LocalServiceControls v-if="modelsOnly" models-only/>
    <template v-else>
      <KnowledgeStatusBar/>
      <section class="section-card knowledge-controls"><div class="knowledge-title"><h3>知识库与文档</h3><span class="knowledge-current">当前：{{ store.selectedBaseLabel }}</span><InfoTip label="知识查询说明" text="先连接知识服务，再读取知识库列表或搜索。查询只在点击时执行；修改条件会清除旧结果，输入与结果保留在本页内存。"/></div>
        <div class="knowledge-actions"><el-button :disabled="blocked" @click="store.run('bases')">读取知识库列表</el-button></div>
        <div class="knowledge-fields"><label>关键词<el-input v-model="store.query" maxlength="512" aria-label="检索关键词" placeholder="搜索当前知识库"/></label><el-button type="primary" :disabled="blocked || !store.query.trim()" @click="store.run('search')">检索知识库</el-button></div>
        <div class="knowledge-fields"><label>文档标题<el-input v-model="store.documentKeyword" maxlength="512" aria-label="文档筛选" placeholder="可留空"/></label><el-button :disabled="blocked" @click="store.run('documents')">读取文档列表</el-button></div>
        <details class="knowledge-read-options"><summary>按 ID 查看与读取选项</summary>
          <div class="knowledge-fields"><label>知识库 ID（可留空使用原默认值）<el-input v-model="store.kbId" maxlength="80" aria-label="知识库 ID" clearable/></label><el-button :disabled="blocked || !isKnowledgeRequestId(store.kbId.trim())" @click="store.run('base')">查看知识库详情</el-button></div>
          <div class="knowledge-fields"><label class="knowledge-limit">搜索返回上限<el-input-number v-model="store.searchLimit" :min="1" :max="1000" :precision="0" aria-label="检索返回上限"/></label><label class="knowledge-limit">文档上限<el-input-number v-model="store.documentLimit" :min="1" :max="100" :precision="0" aria-label="文档返回上限"/></label></div>
          <div class="knowledge-fields"><label>文档 ID<el-input v-model="store.documentId" maxlength="80" aria-label="文档 ID" clearable/></label><label class="knowledge-limit">切片上限<el-input-number v-model="store.chunkLimit" :min="1" :max="1000" :precision="0" aria-label="切片返回上限"/></label></div>
          <div class="knowledge-actions"><el-button :disabled="blocked || !isKnowledgeRequestId(store.documentId.trim())" @click="store.run('document')">查看文档详情</el-button><el-button :disabled="blocked || !isKnowledgeRequestId(store.documentId.trim())" @click="store.run('chunks')">读取文档切片</el-button><el-button :disabled="blocked || !isKnowledgeRequestId(store.documentId.trim())" @click="store.run('original')">读取原文预览</el-button></div>
          <p>原文预览最多返回 1 MiB，不保存到用户目录。关键词不得以 - 开头或包含控制字符。</p>
        </details>
      </section>
      <section class="section-card knowledge-results" aria-live="polite"><h3>{{ store.action ? actionLabel[store.action] : '查询结果' }}</h3>
        <p v-if="store.loading">正在读取，可离开页面取消本次请求…</p><template v-else-if="store.error"><el-alert type="error" :closable="false" :title="store.error"/><p class="knowledge-read-next">请核对连接后重试本次读取。</p></template><p v-else-if="store.invalidated">条件或页面已变更，旧结果已清空。请重新查询。</p><p v-else-if="!store.result">点击“读取知识库列表”，或输入关键词搜索。</p>
        <template v-else-if="store.result.kind==='search'"><p>本次返回 {{ store.result.data.count }} 条结果</p><article v-for="(item,index) in store.result.data.results" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.title || item.id }}</h4><pre>{{ item.content }}</pre><details><summary>来源详情</summary><small>ID：{{ item.id }} · 文档：{{ item.knowledgeId || '未返回' }}</small><p v-if="item.source">来源：{{ item.source.channel }} {{ item.source.repoId }} {{ item.source.path }} {{ item.source.commit }}</p></details><el-button v-if="isKnowledgeRequestId(item.knowledgeId)" size="small" @click="selectDocument(item.knowledgeId!)">选用此文档 ID</el-button></article></template>
        <template v-else-if="store.result.kind==='bases'"><p>本次返回 {{ store.result.data.items.length }} 个知识库</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.name || item.id }}</h4><p>{{ item.description }}</p><small>文档 {{ item.knowledge_count ?? '未返回' }} · 切片 {{ item.chunk_count ?? '未返回' }}</small><details><summary>知识库详情</summary><small>ID：{{ item.id }}</small></details><el-button :disabled="!isKnowledgeRequestId(item.id)" size="small" @click="selectBase(item.id,item.name)">选用此知识库</el-button></article></template>
        <template v-else-if="store.result.kind==='documents'"><p>本次返回 {{ store.result.data.items.length }} 个文档{{ store.result.data.truncated?' · 仍有未返回文档（此页无分页）':'' }}</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.title || item.file_name || item.id }}</h4><p>{{ item.id }} · 解析状态 {{ item.parse_status ?? '未返回' }}</p><el-button :disabled="!isKnowledgeRequestId(item.id)" size="small" @click="selectDocument(item.id)">选用此文档</el-button></article></template>
        <template v-else-if="store.result.kind==='chunks'"><p>本次返回 {{ store.result.data.items.length }} 个切片{{ store.result.data.truncated?' · 仍有未返回内容':'' }}</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.id }} · {{ item.chunk_index ?? '序号未返回' }}</h4><pre>{{ item.content }}</pre></article></template>
        <template v-else-if="store.result.kind==='original'"><p>{{ store.result.data.fileName }} · {{ store.result.data.bytes }} 字节{{ store.result.data.truncated?' · 内容已截断':'' }}</p><el-alert v-if="store.result.data.isBase64" type="info" :closable="false" title="二进制原文，仅显示读取元信息；不执行、解码或保存文件。"/><pre v-else>{{ store.result.data.content }}</pre></template>
        <dl v-else-if="store.result.kind==='base'||store.result.kind==='document'"><template v-for="(value,key) in store.result.data.item" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></template></dl>
      </section>
    </template>
  </section>
</template>
<style scoped>
.knowledge-connect{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;padding:14px}.knowledge-title{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.knowledge-title h2,.knowledge-title h3{margin:0}.knowledge-connect>.knowledge-actions{margin-left:auto}.knowledge-fault{flex-basis:100%;font-size:12px;color:var(--el-color-warning-dark-2);margin:0}.knowledge-current{color:var(--el-text-color-secondary);font-size:12px}.knowledge-controls>.knowledge-actions{margin:12px 0}.knowledge-read-options{margin-top:12px;font-size:12px}.knowledge-read-options summary,.knowledge-technical>summary,.knowledge-result summary{cursor:pointer;color:var(--el-text-color-secondary)}.knowledge-read-options p,.knowledge-technical p{font-size:12px;line-height:1.7}.knowledge-technical{margin:16px 0}.knowledge-technical>article{margin-top:12px}.knowledge-result details{font-size:12px;margin:6px 0}.knowledge-technical dl{font-size:12px}.knowledge-fields>label{flex:1;min-width:180px}.knowledge-fields{align-items:flex-end}.knowledge-fields .knowledge-limit{flex:0 1 140px}
</style>
