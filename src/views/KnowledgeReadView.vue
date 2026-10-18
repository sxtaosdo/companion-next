<script setup lang="ts">
import KnowledgeSyncPanel from '../components/KnowledgeSyncPanel.vue'
import { knowledgeSyncPending } from '../knowledge-sync-integration'
import KnowledgeConversationPanel from '../components/KnowledgeConversationPanel.vue'
import LocalServiceControls from '../components/LocalServiceControls.vue'
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { isKnowledgeRequestId } from '../domain/knowledge-read'
const store=useKnowledgeReadStore(),route=useRoute()
const modelsOnly=computed(()=>route.query.tab==='models')
const passiveReadBuild=import.meta.env.MODE==='companion-readonly'
const blocked=computed(()=>!store.provider||store.loading||store.statusLoading||knowledgeSyncPending.value)
const status= computed(()=>store.status)
const authLabel={missing:'未配置',configured:'已配置，尚未验证',verified:'后端已验证',denied:'认证被拒绝'}
const actionLabel={search:'关键词检索',bases:'知识库列表',base:'知识库详情',documents:'文档列表',document:'文档详情',original:'原文预览',chunks:'切片列表',agents:'Agent 列表'}
watch(knowledgeReadProvider,next=>{if(store.provider&&store.provider!==next)store.disconnect()},{immediate:true,flush:'sync'})
watch(()=>route.query.tab,()=>{store.invalidate();store.cancelReads()})
onBeforeUnmount(()=>{store.invalidate();store.cancelReads()})
function selectBase(id:string){if(isKnowledgeRequestId(id)){store.kbId=id;store.documentId=''}}
function selectDocument(id:string){if(isKnowledgeRequestId(id))store.documentId=id}
</script>
<template>
  <section class="knowledge-read-workspace">
    <div class="section-card knowledge-connect">
      <div><h2>{{ modelsOnly?'模型服务状态':'知识库 · 查询与原文' }}</h2><p>原 Companion 同源读取。下方查询不自动执行；问答有独立发送确认；同步须在下方选择来源并单独操作，不自动执行或启动服务。</p></div>
      <div class="knowledge-actions"><el-button :disabled="!knowledgeReadProvider || store.statusLoading || store.loading || knowledgeSyncPending" :loading="store.statusLoading" @click="knowledgeReadProvider && store.connect(knowledgeReadProvider)">{{ store.provider?'重新连接':'连接知识服务' }}</el-button><el-button v-if="store.provider" :disabled="store.loading || store.statusLoading || knowledgeSyncPending" @click="store.refreshStatus">刷新状态</el-button><el-button v-if="store.provider" @click="store.disconnect">断开并清空</el-button></div>
    </div>
    <el-alert v-if="!knowledgeReadProvider" type="info" :closable="false" :title="passiveReadBuild ? '此只读预览未启用状态探测' : '当前宿主未接入原 Companion 知识接口'" :description="passiveReadBuild ? '原知识状态会执行 CLI / 同步状态查询；此构建暂不注册知识与模型连接。功能源码保留在其他专用构建，没有判断原服务离线。' : '需要 Companion 专用构建及原服务同源托管。图片审阅服务的认证不能用于此页；不会跨域连接或自动启动后台。'"/>
    <div class="knowledge-status-grid">
      <article class="section-card"><h3>CLI 与检索</h3><dl><dt>CLI</dt><dd>{{ status ? (status.cli.available ? (status.cli.compatible ? '可用且兼容' : '不兼容') : '不可用') : '未读取' }}<span v-if="status?.cli.version"> · {{ status.cli.version }}</span></dd><dt>认证</dt><dd>{{ status ? authLabel[status.retrieval.auth] : '未读取' }}</dd><dt>关键词验证</dt><dd>{{ status ? (status.retrieval.keyword==='verified'?'后端已有检索验证':'尚未验证') : '未读取' }}</dd><dt>默认知识库</dt><dd>{{ status?.retrieval.kbId || '未读取' }}</dd></dl><p v-if="status?.cli.error" role="alert">{{ status.cli.error.message }}</p><p v-if="store.statusError" role="alert">{{ store.statusError }}</p><small>状态来自上次显式读取；服务可达不等于认证或检索通过。</small></article>
      <article class="section-card"><h3>知识服务</h3><p class="knowledge-state">{{ store.services?.knowledge ? (store.services.knowledge.running?'服务可达':'服务当前不可达') : '未读取 / 未知' }}</p><p>此卡保留连接时读取的状态。下方服务控制独立读取、逐次确认启停；知识库状态明确允许内嵌时显示原管理页，模型管理尚未接入。</p></article>
      <article class="section-card"><h3>模型启动器</h3><p class="knowledge-state">{{ store.services?.model ? (store.services.model.running?'启动器可达':'启动器当前不可达') : '未读取 / 未知' }}</p><p>此卡显示连接时读取的启动器可达性；不代表模型已加载、Comfy 已连接或 GPU 已就绪。</p></article>
    </div>
    <el-alert v-if="store.serviceError || store.services?.warnings.length" type="warning" :closable="false" :title="store.serviceError || store.services?.warnings.join('；') || ''"/>
    <LocalServiceControls :models-only="modelsOnly"/>
    <p v-if="modelsOnly" class="knowledge-note">现有关闭能力只针对模型启动器；各模型的启动、停止和管理页面尚未接入。</p>
    <template v-else>
      <KnowledgeConversationPanel/>
      <section class="section-card knowledge-controls"><h3>只读查询</h3><p>查询会交给原配置的知识服务处理；输入与结果仅保留在本页内存。改变条件会清除旧结果，需手动重新查询。</p>
        <div class="knowledge-actions"><el-button :disabled="blocked" @click="store.run('bases')">读取知识库列表</el-button><el-button :disabled="blocked" @click="store.run('agents')">读取 Agent 列表</el-button></div>
        <div class="knowledge-fields"><label>知识库 ID（可留空使用原默认值）<el-input v-model="store.kbId" maxlength="80" aria-label="知识库 ID" clearable/></label><el-button :disabled="blocked || !isKnowledgeRequestId(store.kbId.trim())" @click="store.run('base')">查看知识库详情</el-button></div>
        <div class="knowledge-fields"><label>关键词<el-input v-model="store.query" maxlength="512" aria-label="检索关键词" placeholder="不得以 - 开头或包含控制字符"/></label><label class="knowledge-limit">返回上限<el-input-number v-model="store.searchLimit" :min="1" :max="1000" :precision="0" aria-label="检索返回上限"/></label><el-button type="primary" :disabled="blocked || !store.query.trim()" @click="store.run('search')">检索知识库</el-button></div>
        <div class="knowledge-fields"><label>文档标题筛选（可留空）<el-input v-model="store.documentKeyword" maxlength="512" aria-label="文档筛选"/></label><label class="knowledge-limit">文档上限<el-input-number v-model="store.documentLimit" :min="1" :max="100" :precision="0" aria-label="文档返回上限"/></label><el-button :disabled="blocked" @click="store.run('documents')">读取文档列表</el-button></div>
        <div class="knowledge-fields"><label>文档 ID<el-input v-model="store.documentId" maxlength="80" aria-label="文档 ID" clearable/></label><label class="knowledge-limit">切片上限<el-input-number v-model="store.chunkLimit" :min="1" :max="1000" :precision="0" aria-label="切片返回上限"/></label></div>
        <div class="knowledge-actions"><el-button :disabled="blocked || !isKnowledgeRequestId(store.documentId.trim())" @click="store.run('document')">查看文档详情</el-button><el-button :disabled="blocked || !isKnowledgeRequestId(store.documentId.trim())" @click="store.run('chunks')">读取文档切片</el-button><el-button :disabled="blocked || !isKnowledgeRequestId(store.documentId.trim())" @click="store.run('original')">读取原文预览</el-button></div>
        <small>原文预览会由原服务创建并清理临时文件；最多返回 1 MiB 内容，不保存到用户目录。Agent 列表不执行 Agent。</small>
      </section>
      <section class="section-card knowledge-results" aria-live="polite"><h3>{{ store.action ? actionLabel[store.action] : '查询结果' }}</h3>
        <p v-if="store.loading">正在读取，可离开页面取消本次请求…</p><el-alert v-else-if="store.error" type="error" :closable="false" :title="store.error"/><p v-else-if="store.invalidated">条件或页面已变更，旧结果已清空。请重新查询。</p><p v-else-if="!store.result">尚未查询，不显示示例或推测结果。</p>
        <template v-else-if="store.result.kind==='search'"><p>本次返回 {{ store.result.data.count }} 条结果</p><article v-for="(item,index) in store.result.data.results" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.title || item.id }}</h4><pre>{{ item.content }}</pre><small>ID：{{ item.id }} · 文档：{{ item.knowledgeId || '未返回' }}</small><p v-if="item.source">来源：{{ item.source.channel }} {{ item.source.repoId }} {{ item.source.path }} {{ item.source.commit }}</p><el-button v-if="isKnowledgeRequestId(item.knowledgeId)" size="small" @click="selectDocument(item.knowledgeId!)">选用此文档 ID</el-button></article></template>
        <template v-else-if="store.result.kind==='bases'"><p>本次返回 {{ store.result.data.items.length }} 个知识库</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.name || item.id }}</h4><p>{{ item.description }}</p><small>{{ item.id }} · 文档 {{ item.knowledge_count ?? '未返回' }} · 切片 {{ item.chunk_count ?? '未返回' }}</small><el-button :disabled="!isKnowledgeRequestId(item.id)" size="small" @click="selectBase(item.id)">选用此知识库</el-button></article></template>
        <template v-else-if="store.result.kind==='documents'"><p>本次返回 {{ store.result.data.items.length }} 个文档{{ store.result.data.truncated?' · 仍有未返回文档（此页无分页）':'' }}</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.title || item.file_name || item.id }}</h4><p>{{ item.id }} · 解析状态 {{ item.parse_status ?? '未返回' }}</p><el-button :disabled="!isKnowledgeRequestId(item.id)" size="small" @click="selectDocument(item.id)">选用此文档</el-button></article></template>
        <template v-else-if="store.result.kind==='agents'"><p>本次返回 {{ store.result.data.items.length }} 个 Agent</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.name || item.id }}</h4><p>{{ item.description }}</p><small>{{ item.id }} · 仅列出，不执行或发起问答</small></article></template>
        <template v-else-if="store.result.kind==='chunks'"><p>本次返回 {{ store.result.data.items.length }} 个切片{{ store.result.data.truncated?' · 仍有未返回内容':'' }}</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.id }} · {{ item.chunk_index ?? '序号未返回' }}</h4><pre>{{ item.content }}</pre></article></template>
        <template v-else-if="store.result.kind==='original'"><p>{{ store.result.data.fileName }} · {{ store.result.data.bytes }} 字节{{ store.result.data.truncated?' · 内容已截断':'' }}</p><el-alert v-if="store.result.data.isBase64" type="info" :closable="false" title="二进制原文，仅显示读取元信息；不执行、解码或保存文件。"/><pre v-else>{{ store.result.data.content }}</pre></template>
        <dl v-else><template v-for="(value,key) in store.result.data.item" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></template></dl>
      </section>
      <KnowledgeSyncPanel/>
    </template>
  </section>
</template>
