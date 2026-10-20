<script setup lang="ts">
import KnowledgeAgentPanel from '../components/KnowledgeAgentPanel.vue'
import { knowledgeAgentPending } from '../knowledge-agent-integration'
import KnowledgeSyncPanel from '../components/KnowledgeSyncPanel.vue'
import { knowledgeSyncPending } from '../knowledge-sync-integration'
import KnowledgeConversationPanel from '../components/KnowledgeConversationPanel.vue'
import LocalServiceControls from '../components/LocalServiceControls.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import InfoTip from '../components/InfoTip.vue'
import { useRoute } from 'vue-router'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import { useKnowledgeReadStore } from '../stores/knowledge-read'
import { isKnowledgeRequestId } from '../domain/knowledge-read'
const store=useKnowledgeReadStore(),route=useRoute()
const modelsOnly=computed(()=>route.query.tab==='models')
const passiveReadBuild=import.meta.env.MODE==='companion-readonly'
const blocked=computed(()=>!store.provider||store.loading||store.statusLoading||knowledgeSyncPending.value||knowledgeAgentPending.value)
const status= computed(()=>store.status)
const authLabel={missing:'未配置',configured:'已配置，尚未验证',verified:'后端已验证',denied:'认证被拒绝'}
const actionLabel={search:'关键词检索',bases:'知识库列表',base:'知识库详情',documents:'文档列表',document:'文档详情',original:'原文预览',chunks:'切片列表',agents:'Agent 列表'}
watch(knowledgeReadProvider,next=>{if(store.provider&&store.provider!==next)store.disconnect()},{immediate:true,flush:'sync'})
watch(()=>route.query.tab,()=>{store.invalidate();store.cancelReads()})
onBeforeUnmount(()=>{store.invalidate();store.cancelReads()})
const selectedBase = ref<{ id: string; name: string } | null>(null)
const selectedBaseLabel = computed(() => selectedBase.value?.id === store.kbId ? selectedBase.value.name : store.kbId ? '已选择知识库' : '默认知识库')
const knowledgeWarnings = computed(() => (store.services?.warnings ?? []).filter(item => !item.startsWith('模型启动器')))
const serviceReadFailed = computed(() => !!store.serviceError || (!store.services?.knowledge && knowledgeWarnings.value.length > 0))
const serviceLabel = computed(() => store.statusLoading ? '检查中' : serviceReadFailed.value ? '读取失败' : !store.services?.knowledge ? '未检查' : store.services.knowledge.running ? '服务可达' : '探测未达')
const retrievalLabel = computed(() => !status.value ? '检索未检查' : status.value.retrieval.auth === 'missing' ? '认证未配置' : status.value.retrieval.auth === 'denied' ? '认证被拒绝' : status.value.retrieval.auth === 'verified' && status.value.retrieval.keyword === 'verified' ? '检索已验证' : '检索待验证')
const faultHint = computed(() => store.statusError ? '状态读取失败，请刷新状态重试。' : serviceReadFailed.value ? '知识服务状态读取失败，请刷新状态重试。' : status.value?.retrieval.auth === 'missing' ? '尚未配置知识访问，请查看连接详情。' : status.value?.retrieval.auth === 'denied' ? '知识访问被拒绝，请核对已有接入配置。' : status.value && (!status.value.cli.available || !status.value.cli.compatible) ? '知识读取工具不可用，请查看连接详情。' : store.services?.knowledge?.running === false ? '知识服务探测未达，请在连接详情中核对或启动。' : '')
function selectBase(id:string,name?:string){if(isKnowledgeRequestId(id)){selectedBase.value={id,name:name||id};store.kbId=id;store.documentId=''}}
function selectDocument(id:string){if(isKnowledgeRequestId(id))store.documentId=id}
</script>
<template>
  <section class="knowledge-read-workspace">
    <LocalServiceControls v-if="modelsOnly" models-only/>
    <template v-else>
      <section class="section-card knowledge-connect">
        <div class="knowledge-title"><h2>知识库</h2><el-tag :type="store.statusLoading ? 'info' : serviceReadFailed ? 'warning' : store.services?.knowledge?.running ? 'success' : 'info'" size="small">{{ serviceLabel }}</el-tag><el-tag :type="retrievalLabel === '检索已验证' ? 'success' : retrievalLabel === '认证被拒绝' ? 'danger' : 'info'" size="small">{{ retrievalLabel }}</el-tag><InfoTip label="知识库状态说明" text="服务连通、认证与检索验证分别显示。未检查或超时不表示服务离线；状态来自最近一次显式读取。"/></div>
        <div class="knowledge-actions"><el-button :disabled="!knowledgeReadProvider || store.statusLoading || store.loading || knowledgeSyncPending || knowledgeAgentPending" :loading="store.statusLoading" @click="knowledgeReadProvider && store.connect(knowledgeReadProvider)">{{ store.provider?'重新连接':'连接知识服务' }}</el-button><el-button v-if="store.provider" :disabled="store.loading || store.statusLoading || knowledgeSyncPending || knowledgeAgentPending" @click="store.refreshStatus">刷新状态</el-button><el-button v-if="store.provider" @click="store.disconnect">断开并清空</el-button></div>
        <p v-if="faultHint" class="knowledge-fault" role="alert">{{ faultHint }}</p>
        <p v-else-if="!knowledgeReadProvider" class="knowledge-fault">当前宿主未接入知识服务，请查看连接详情。</p>
      </section>
      <section class="section-card knowledge-controls"><div class="knowledge-title"><h3>知识库与文档</h3><span class="knowledge-current">当前：{{ selectedBaseLabel }}</span><InfoTip label="知识查询说明" text="先连接知识服务，再读取知识库列表或搜索。查询只在点击时执行；修改条件会清除旧结果，输入与结果保留在本页内存。"/></div>
        <div class="knowledge-actions"><el-button :disabled="blocked" @click="store.run('bases')">读取知识库列表</el-button></div>
        <div class="knowledge-fields"><label>关键词<el-input v-model="store.query" maxlength="512" aria-label="检索关键词" placeholder="搜索当前知识库"/></label><el-button type="primary" :disabled="blocked || !store.query.trim()" @click="store.run('search')">检索知识库</el-button></div>
        <div class="knowledge-fields"><label>文档标题<el-input v-model="store.documentKeyword" maxlength="512" aria-label="文档筛选" placeholder="可留空"/></label><el-button :disabled="blocked" @click="store.run('documents')">读取文档列表</el-button></div>
        <details class="knowledge-read-options"><summary>按 ID 查看与读取选项</summary>
          <div class="knowledge-fields"><label>知识库 ID（可留空使用原默认值）<el-input v-model="store.kbId" maxlength="80" aria-label="知识库 ID" clearable/></label><el-button :disabled="blocked || !isKnowledgeRequestId(store.kbId.trim())" @click="store.run('base')">查看知识库详情</el-button></div>
          <div class="knowledge-fields"><label class="knowledge-limit">搜索返回上限<el-input-number v-model="store.searchLimit" :min="1" :max="1000" :precision="0" aria-label="检索返回上限"/></label><label class="knowledge-limit">文档上限<el-input-number v-model="store.documentLimit" :min="1" :max="100" :precision="0" aria-label="文档返回上限"/></label></div>
          <div class="knowledge-fields"><label>文档 ID<el-input v-model="store.documentId" maxlength="80" aria-label="文档 ID" clearable/></label><label class="knowledge-limit">切片上限<el-input-number v-model="store.chunkLimit" :min="1" :max="1000" :precision="0" aria-label="切片返回上限"/></label></div>
          <div class="knowledge-actions"><el-button :disabled="blocked || !isKnowledgeRequestId(store.documentId.trim())" @click="store.run('document')">查看文档详情</el-button><el-button :disabled="blocked || !isKnowledgeRequestId(store.documentId.trim())" @click="store.run('chunks')">读取文档切片</el-button><el-button :disabled="blocked || !isKnowledgeRequestId(store.documentId.trim())" @click="store.run('original')">读取原文预览</el-button><el-button :disabled="blocked" @click="store.run('agents')">读取 Agent 列表</el-button></div>
          <p>原文预览最多返回 1 MiB，不保存到用户目录。Agent 列表不执行问答。关键词不得以 - 开头或包含控制字符。</p>
        </details>
      </section>
      <section class="section-card knowledge-results" aria-live="polite"><h3>{{ store.action ? actionLabel[store.action] : '查询结果' }}</h3>
        <p v-if="store.loading">正在读取，可离开页面取消本次请求…</p><template v-else-if="store.error"><el-alert type="error" :closable="false" :title="store.error"/><p class="knowledge-read-next">请核对连接后重试本次读取。</p></template><p v-else-if="store.invalidated">条件或页面已变更，旧结果已清空。请重新查询。</p><p v-else-if="!store.result">点击“读取知识库列表”，或输入关键词搜索。</p>
        <template v-else-if="store.result.kind==='search'"><p>本次返回 {{ store.result.data.count }} 条结果</p><article v-for="(item,index) in store.result.data.results" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.title || item.id }}</h4><pre>{{ item.content }}</pre><details><summary>来源详情</summary><small>ID：{{ item.id }} · 文档：{{ item.knowledgeId || '未返回' }}</small><p v-if="item.source">来源：{{ item.source.channel }} {{ item.source.repoId }} {{ item.source.path }} {{ item.source.commit }}</p></details><el-button v-if="isKnowledgeRequestId(item.knowledgeId)" size="small" @click="selectDocument(item.knowledgeId!)">选用此文档 ID</el-button></article></template>
        <template v-else-if="store.result.kind==='bases'"><p>本次返回 {{ store.result.data.items.length }} 个知识库</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.name || item.id }}</h4><p>{{ item.description }}</p><small>文档 {{ item.knowledge_count ?? '未返回' }} · 切片 {{ item.chunk_count ?? '未返回' }}</small><details><summary>知识库详情</summary><small>ID：{{ item.id }}</small></details><el-button :disabled="!isKnowledgeRequestId(item.id)" size="small" @click="selectBase(item.id,item.name)">选用此知识库</el-button></article></template>
        <template v-else-if="store.result.kind==='documents'"><p>本次返回 {{ store.result.data.items.length }} 个文档{{ store.result.data.truncated?' · 仍有未返回文档（此页无分页）':'' }}</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.title || item.file_name || item.id }}</h4><p>{{ item.id }} · 解析状态 {{ item.parse_status ?? '未返回' }}</p><el-button :disabled="!isKnowledgeRequestId(item.id)" size="small" @click="selectDocument(item.id)">选用此文档</el-button></article></template>
        <template v-else-if="store.result.kind==='agents'"><p>本次返回 {{ store.result.data.items.length }} 个 Agent</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.name || item.id }}</h4><p>{{ item.description }}</p><small>{{ item.id }} · 仅列出，不执行或发起问答</small></article></template>
        <template v-else-if="store.result.kind==='chunks'"><p>本次返回 {{ store.result.data.items.length }} 个切片{{ store.result.data.truncated?' · 仍有未返回内容':'' }}</p><article v-for="(item,index) in store.result.data.items" :key="`${index}:${item.id}`" class="knowledge-result"><h4>{{ item.id }} · {{ item.chunk_index ?? '序号未返回' }}</h4><pre>{{ item.content }}</pre></article></template>
        <template v-else-if="store.result.kind==='original'"><p>{{ store.result.data.fileName }} · {{ store.result.data.bytes }} 字节{{ store.result.data.truncated?' · 内容已截断':'' }}</p><el-alert v-if="store.result.data.isBase64" type="info" :closable="false" title="二进制原文，仅显示读取元信息；不执行、解码或保存文件。"/><pre v-else>{{ store.result.data.content }}</pre></template>
        <dl v-else><template v-for="(value,key) in store.result.data.item" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></template></dl>
      </section>
      <details class="section-card knowledge-technical"><summary>连接与技术详情</summary>
        <el-alert v-if="!knowledgeReadProvider" type="info" :closable="false" :title="passiveReadBuild ? '此只读预览未启用状态探测' : '当前宿主未接入原 Companion 知识接口'" :description="passiveReadBuild ? '原知识状态会执行 CLI / 同步状态查询；此构建暂不注册知识连接。没有判断原服务离线。' : '请通过原 Companion 同源工作区打开；不会跨域连接或自动启动后台。'"/>
        <article class="section-card"><h3>CLI 与检索</h3><dl><dt>CLI</dt><dd>{{ status ? (status.cli.available ? (status.cli.compatible ? '可用且兼容' : '不兼容') : '不可用') : '未读取' }}<span v-if="status?.cli.version"> · {{ status.cli.version }}</span></dd><dt>认证</dt><dd>{{ status ? authLabel[status.retrieval.auth] : '未读取' }}</dd><dt>关键词验证</dt><dd>{{ status ? (status.retrieval.keyword==='verified'?'后端已有检索验证':'尚未验证') : '未读取' }}</dd><dt>默认知识库</dt><dd>{{ status?.retrieval.kbId || '未读取' }}</dd></dl><p v-if="status?.cli.error" role="alert">{{ status.cli.error.message }}</p><p v-if="store.statusError" role="alert">{{ store.statusError }}</p><small>状态来自上次显式读取；服务可达不等于认证或检索通过。</small></article>
        <p v-if="store.serviceError || knowledgeWarnings.length" role="alert">{{ store.serviceError ? '知识服务状态未读取，请刷新状态。' : knowledgeWarnings.join('；') }}</p>
        <LocalServiceControls knowledge-only/>
      </details>
      <KnowledgeConversationPanel/>
      <KnowledgeAgentPanel/>
      <KnowledgeSyncPanel/>
    </template>
  </section>
</template>

<style scoped>
.knowledge-connect{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;padding:14px}.knowledge-title{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.knowledge-title h2,.knowledge-title h3{margin:0}.knowledge-connect>.knowledge-actions{margin-left:auto}.knowledge-fault{flex-basis:100%;font-size:12px;color:var(--el-color-warning-dark-2);margin:0}.knowledge-current{color:var(--el-text-color-secondary);font-size:12px}.knowledge-controls>.knowledge-actions{margin:12px 0}.knowledge-read-options{margin-top:12px;font-size:12px}.knowledge-read-options summary,.knowledge-technical>summary,.knowledge-result summary{cursor:pointer;color:var(--el-text-color-secondary)}.knowledge-read-options p,.knowledge-technical p{font-size:12px;line-height:1.7}.knowledge-technical{margin:16px 0}.knowledge-technical>article{margin-top:12px}.knowledge-result details{font-size:12px;margin:6px 0}.knowledge-technical dl{font-size:12px}.knowledge-fields>label{flex:1;min-width:180px}.knowledge-fields{align-items:flex-end}.knowledge-fields .knowledge-limit{flex:0 1 140px}
</style>
