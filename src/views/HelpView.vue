<script setup lang="ts">
import AgentHandoffButtons from '../components/AgentHandoffButtons.vue'
import { agentHandoffBusy } from '../agent-handoff-integration'
import ToolPresetsReadPanel from '../components/ToolPresetsReadPanel.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { helpTopics } from '../domain/product-information'
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

  <div class="help-layout-next">
    <nav class="panel help-topic-nav" aria-label="帮助目录"><section v-for="group in groups" :key="group"><h3>{{ group }}</h3><button v-for="topic in helpTopics.filter((item) => item.group === group)" :key="topic.id" :class="{ active: active.id === topic.id }" :aria-current="active.id === topic.id ? 'page' : undefined" @click="choose(topic.id)">{{ topic.title }}</button></section></nav>
    <article class="panel help-article" aria-live="polite"><span class="section-kicker">{{ active.group }}</span><h2>{{ active.title }}</h2><p v-for="paragraph in active.paragraphs" :key="paragraph">{{ paragraph }}</p><RouterLink :to="active.destination" class="information-link">{{ active.action }} →</RouterLink>
      <ToolPresetsReadPanel v-if="active.id === 'tools'" :requested-project-id="route.query.project === undefined ? undefined : typeof route.query.project === 'string' ? route.query.project : 'invalid'"/>
      <section v-if="original.length" class="legacy-help-content"><h3>使用说明与示例</h3><p class="form-help">示例可阅读或复制，不会自动执行。</p><template v-for="(block, index) in original" :key="`${active.id}-${index}`"><h4 v-if="block.kind === 'heading'">{{ block.text }}</h4><div v-else-if="block.kind === 'code'" class="help-code-block"><div class="help-code-toolbar"><button :aria-pressed="isWrapped(index)" @click="wraps[index] = !isWrapped(index)">{{ isWrapped(index) ? '自动换行' : '不换行' }}</button><button v-if="block.text.length > 600" :aria-expanded="!!expanded[index]" @click="expanded[index] = !expanded[index]">{{ expanded[index] ? '收起' : '展开全文' }}</button><button :disabled="copying||agentHandoffBusy" @click="copy(block.text)">复制原文</button><AgentHandoffButtons :text="block.text" :context-key="`${active.id}-${index}`" :disabled="copying"/></div><pre :class="{ 'no-wrap': !isWrapped(index), 'code-collapsed': block.text.length > 600 && !expanded[index] }">{{ block.text }}</pre></div><p v-else :class="{ 'legacy-help-item': block.kind === 'item', 'form-help': block.kind === 'note' }">{{ block.text }}</p></template><p v-if="copyMessage" role="status">{{ copyMessage }}</p></section>
    </article>
  </div>
</template>

<style scoped>
.help-topic-nav section + section { margin-top: 26px; }
.help-topic-nav h3 { margin: 4px 10px 10px; color: #344054; font-size: 14px; font-weight: 700; line-height: 1.5; }
.help-topic-nav button { min-width: 0; padding: 9px 12px 9px 26px; color: #526078; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.help-topic-nav button.active { background: #f0ebf8; color: #5b3c7a; font-weight: 600; box-shadow: inset 3px 0 #71538f; }
.help-topic-nav button:focus-visible { outline: 2px solid #71538f; outline-offset: 2px; }
@media (max-width: 760px) { .help-topic-nav { padding: 16px; } .help-topic-nav section + section { margin-top: 22px; } }
</style>
