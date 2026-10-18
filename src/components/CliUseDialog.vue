<script setup lang="ts">
import AgentHandoffButtons from './AgentHandoffButtons.vue'
import { agentHandoffBusy } from '../agent-handoff-integration'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ManagedProject, CompanionBrowserProvider } from '../domain/companion-browser'
import { buildProjectCliCopy } from '../domain/cli-use-copy'
const props = defineProps<{ modelValue: boolean; project: ManagedProject | null; source: CompanionBrowserProvider | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; warning: [message: string] }>()
const notice = ref(''), copying = ref(false), wrap = ref({ agent: true, skill: true }), expanded = ref({ agent: false, skill: false })
const context = computed(() => props.project ? JSON.stringify([props.project.id, props.project.name, props.project.path]) : '')
const generated = computed(() => {
  if (!props.project || !props.source) return { texts: null, error: '当前工程登记或连接来源已失效，请重新选择。' }
  try { return { texts: buildProjectCliCopy(props.project), error: '' } }
  catch { return { texts: null, error: '工程标识或路径包含不安全或不明确的文本，未生成可复制命令；请核对登记信息。' } }
})
const blocks = computed(() => generated.value.texts ? [
  { id: 'agent' as const, title: 'Agent 提示词与四条检查命令', text: generated.value.texts.agentPrompt },
  { id: 'skill' as const, title: 'CLI 使用说明 Skill 安装提示词', text: generated.value.texts.skillPrompt },
] : [])
let generation = 0, alive = true
function invalidate() {
  generation++; notice.value = ''; wrap.value = { agent: true, skill: true }; expanded.value = { agent: false, skill: false }
  if (copying.value) emit('warning', '工程或页面已变化；先前发出的剪贴板请求无法撤销，粘贴前请核对目标 ID 与路径。')
}
watch([context, () => props.source], () => { invalidate(); if (props.modelValue) emit('update:modelValue', false) }, { flush: 'sync' })
watch(() => props.modelValue, () => invalidate(), { flush: 'sync' })
onBeforeUnmount(() => { alive = false; invalidate() })
async function copy(kind: 'agent' | 'skill') {
  if (copying.value || agentHandoffBusy.value || !props.modelValue || !props.project || !props.source || !generated.value.texts) return
  // Freeze the exact registered identity at the user click, never a shortened ID or current working directory.
  const identity = generation, key = context.value, source = props.source
  const text = kind === 'agent' ? generated.value.texts.agentPrompt : generated.value.texts.skillPrompt
  const current = () => alive && props.modelValue && identity === generation && key === context.value && source === props.source
  copying.value = true; agentHandoffBusy.value=true; notice.value = ''
  try {
    if (!navigator.clipboard?.writeText || !current()) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(text)
    if (current()) notice.value = '完整文本已复制；未执行 CLI、创建 Skill、注册 MCP 或打开 Agent。'
  } catch { if (current()) notice.value = '浏览器复制未完成；没有执行命令。可手动选择完整文本，粘贴前核对工程。' }
  finally { copying.value = false; agentHandoffBusy.value=false }
}
</script>
<template>
 <el-dialog :model-value="modelValue" title="使用 CLI · 工程绑定文本" width="min(860px, calc(100vw - 32px))" :close-on-click-modal="false" @update:model-value="emit('update:modelValue', $event)">
  <section data-testid="cli-use-dialog">
   <p v-if="project"><strong>{{ project.name }}</strong><br>完整 projectId：<code>{{ project.id }}</code></p><pre v-if="project" class="cli-project-path">{{ project.path }}</pre>
   <el-alert title="本页只展示和复制文本" type="info" :closable="false" description="文本含工程名称、ID 和完整路径。复制不会运行 CLI 或创建文件；Skill 提示词要求的写入仅会在你后续交给 Agent 执行时发生，请先确认目标和权限。"/>
   <p class="form-help">原 v148 弹板实际提供两段文本。检查命令只绑定完整 ID，名称和路径仅供核对。不会读取或混入 Cookie、token、端口及运行配置；复制也不打开外部协议。剪贴板请求发出后无法撤销，切工程后粘贴请再次核对。</p>
   <el-alert v-if="generated.error" :title="generated.error" type="warning" :closable="false"/>
   <section v-for="block in blocks" :key="block.id" class="help-code-block"><h3>{{ block.title }}</h3><div class="help-code-toolbar"><button :aria-pressed="wrap[block.id]" @click="wrap[block.id]=!wrap[block.id]">{{ wrap[block.id]?'自动换行':'不换行' }}</button><button v-if="block.text.split('\n').length>5" :aria-expanded="expanded[block.id]" @click="expanded[block.id]=!expanded[block.id]">{{ expanded[block.id]?'收起':'展开全文' }}</button><button :disabled="copying||agentHandoffBusy" @click="copy(block.id)">{{ copying?'等待剪贴板':'复制完整文本' }}</button><AgentHandoffButtons :text="block.text" :context-key="`${context}:${block.id}`" :disabled="copying||!modelValue||!source"/></div><pre :data-testid="`cli-${block.id}-text`" :class="{ 'cli-no-wrap':!wrap[block.id], 'cli-folded':!expanded[block.id] }">{{ block.text }}</pre></section>
   <p v-if="notice" role="status">{{ notice }}</p>
  </section>
 </el-dialog>
</template>
<style scoped>
.cli-project-path { white-space: pre-wrap; overflow-wrap: anywhere; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.65; }
pre.cli-no-wrap { white-space: pre; overflow-x: auto; overflow-wrap: normal; }
pre.cli-folded { max-height: 8.25em; overflow-y: hidden; }
</style>
