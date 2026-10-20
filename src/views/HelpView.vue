<script setup lang="ts">
import AgentHandoffButtons from '../components/AgentHandoffButtons.vue'
import { agentHandoffBusy } from '../agent-handoff-integration'
import ToolPresetsReadPanel from '../components/ToolPresetsReadPanel.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { helpTopics, legacyReference } from '../domain/product-information'
import legacyHelp from '../domain/legacy-v148-help.json'
const route = useRoute()
const router = useRouter()
const groups = [...new Set(helpTopics.map((topic) => topic.group))]
const active = computed(() => helpTopics.find((topic) => topic.id === route.query.topic) ?? helpTopics[0])
const original = computed(() => legacyHelp[active.value.id as keyof typeof legacyHelp] ?? [])
const wraps = ref<Record<number, boolean>>({})
function isWrapped(index: number) { return wraps.value[index] !== false }
const expanded = ref<Record<number, boolean>>({})
const copyMessage = ref(''),copying=ref(false)
let copyEpoch = 0
watch(active, () => { copyEpoch++; copyMessage.value = ''; expanded.value = {}; wraps.value = {} })
function choose(topic: string) {
  const project = route.query.project
  void router.push({ path: '/help', query: { topic, ...(project === undefined ? {} : { project }) } })
}
async function copy(text: string) {
  if(copying.value||agentHandoffBusy.value)return
  copying.value=true;agentHandoffBusy.value=true
  const epoch = ++copyEpoch
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(text)
    if (epoch === copyEpoch) copyMessage.value = '原文已复制；未执行命令或发送到服务。'
  } catch { if (epoch === copyEpoch) copyMessage.value = '浏览器未能复制，请手动选择原文。' }
  finally{copying.value=false;agentHandoffBusy.value=false}
}
</script>
<template>
  <section class="panel information-intro"><h2>帮助中心</h2><p>保留原帮助正文与复制交互，并标清当前入口的实际能力。</p><el-alert :title="`原版静态说明依据已核 v${legacyReference.inspectedVersion}；帮助恢复不等于旧业务已经迁移。`" type="warning" :closable="false"/></section>
  <div class="help-layout-next">
    <nav class="panel help-topic-nav" aria-label="帮助目录"><section v-for="group in groups" :key="group"><h3>{{ group }}</h3><button v-for="topic in helpTopics.filter((item) => item.group === group)" :key="topic.id" :class="{ active: active.id === topic.id }" :aria-current="active.id === topic.id ? 'page' : undefined" @click="choose(topic.id)">{{ topic.title }}</button></section></nav>
    <article class="panel help-article" aria-live="polite"><span class="section-kicker">{{ active.group }}</span><h2>{{ active.title }}</h2><p v-for="paragraph in active.paragraphs" :key="paragraph">{{ paragraph }}</p><RouterLink :to="active.destination" class="information-link">{{ active.action }} →</RouterLink>
      <ToolPresetsReadPanel v-if="active.id === 'tools'" :requested-project-id="route.query.project === undefined ? undefined : typeof route.query.project === 'string' ? route.query.project : 'invalid'"/>
      <section v-if="original.length" class="legacy-help-content"><h3>v148 原帮助正文</h3><p class="form-help">下列步骤描述原 Companion；尚未迁入的动作请从原版操作，不会因复制文本而自动执行。动态工具目录在“工具清单”小节按需读取；正常工作区可在点击后复制完整文本并尝试唤起本机 Cursor / Codex；请在应用内确认使用。</p><template v-for="(block, index) in original" :key="`${active.id}-${index}`"><h4 v-if="block.kind === 'heading'">{{ block.text }}</h4><div v-else-if="block.kind === 'code'" class="help-code-block"><div class="help-code-toolbar"><button :aria-pressed="isWrapped(index)" @click="wraps[index] = !isWrapped(index)">{{ isWrapped(index) ? '自动换行' : '不换行' }}</button><button v-if="block.text.length > 600" :aria-expanded="!!expanded[index]" @click="expanded[index] = !expanded[index]">{{ expanded[index] ? '收起' : '展开全文' }}</button><button :disabled="copying||agentHandoffBusy" @click="copy(block.text)">复制原文</button><AgentHandoffButtons :text="block.text" :context-key="`${active.id}-${index}`" :disabled="copying"/></div><pre :class="{ 'no-wrap': !isWrapped(index), 'code-collapsed': block.text.length > 600 && !expanded[index] }">{{ block.text }}</pre></div><p v-else :class="{ 'legacy-help-item': block.kind === 'item', 'form-help': block.kind === 'note' }">{{ block.text }}</p></template><p v-if="copyMessage" role="status">{{ copyMessage }}</p></section>
      <div class="help-bottom-note">帮助提供说明、复制和导航；工具小节可显式读取并请求浏览器下载预设 JSON。这里不执行命令、注册 Agent 或启动服务。</div></article>
  </div>
</template>
