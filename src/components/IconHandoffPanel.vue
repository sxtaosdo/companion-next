<script setup lang="ts">
import IconSceneBindingPanel from './IconSceneBindingPanel.vue'
import AntSlotBindingPanel from './AntSlotBindingPanel.vue'
import { computed, onBeforeUnmount, reactive, watch } from 'vue'
import { CircleCheck, CircleClose, Loading, Minus, Warning } from '@element-plus/icons-vue'
import { iconHandoffProvider } from '../icon-handoff-integration'
import type { IconHandoffProvider } from '../domain/icon-handoff'
import type { AiJobSnapshot, AiJobsReadProvider } from '../domain/ai-jobs-read'
import { createIconHandoffState } from '../stores/icon-handoff'
import type { AiVariantImportVerification } from '../stores/ai-job-actions'
const props=withDefaults(defineProps<{project:{id:string;name:string;path:string}|null;source:object|null;job:AiJobSnapshot|null;reader:AiJobsReadProvider|null;provider?:IconHandoffProvider|null;active?:boolean;ready?:boolean;variantVerification?:AiVariantImportVerification|null}>(),{active:true,ready:false})
const provider=computed(()=>props.provider===undefined?iconHandoffProvider.value:props.provider),store=reactive(createIconHandoffState())
watch(()=>[props.project,props.source,props.job,props.reader,provider.value,props.active,props.ready],()=>store.bind(props.project&&props.source&&props.job&&props.reader&&provider.value?{project:props.project,source:props.source,job:props.job,reader:props.reader,provider:provider.value,active:props.active,ready:props.ready}:null),{immediate:true,flush:'sync',deep:true})
const feedback=computed(()=>store.phase==='reading'?{label:'核对中',tone:'primary' as const,icon:Loading}:store.phase==='ready'?{label:'交接包已核对',tone:'success' as const,icon:CircleCheck}:store.phase==='error'?{label:'读取失败',tone:'danger' as const,icon:CircleClose}:store.phase==='unknown'||store.phase==='stale'?{label:store.phase==='unknown'?'结果未确认':'需重新核对',tone:'warning' as const,icon:Warning}:{label:'尚未准备',tone:'info' as const,icon:Minus})
onBeforeUnmount(store.leave)
</script>
<template>
 <section class="icon-handoff-panel" aria-label="原任务Agent与Cocos交接">
  <el-button v-if="provider" :disabled="!store.eligible || store.busy" @click="store.open">准备 Agent / Cocos 交接</el-button>
  <section v-if="store.opened" class="section-card handoff-details" aria-label="任务交接包">
   <header><h4>Agent / Cocos 交接</h4><el-button :disabled="store.busy" @click="store.close">关闭交接</el-button></header>
   <p>{{ project?.name }} · {{ project?.path }} · {{ job?.jobId }} · r{{ job?.revision }}</p>
   <form @submit.prevent="store.prepare" @input="store.edit" @change="store.edit">
    <label>交接用途<input v-model="store.form.purpose" aria-label="交接用途" maxlength="400" :disabled="store.busy" required></label>
    <label>素材<select v-model="store.form.kind" aria-label="交接素材" :disabled="store.busy"><option value="mother">原任务已选母图（1024）</option><option value="variant" :disabled="!store.output">已导出的尺寸 PNG</option></select></label>
    <div v-if="store.form.kind==='variant'" class="handoff-target"><label>宽度<input v-model.number="store.form.width" aria-label="交接宽度" type="number" min="1" max="4096" required :disabled="store.busy"></label><label>高度<input v-model.number="store.form.height" aria-label="交接高度" type="number" min="1" max="4096" required :disabled="store.busy"></label></div>
    <label>预期导入 URL（可留空）<input v-model="store.form.destinationUrl" aria-label="交接导入URL" placeholder="db://assets/...png" maxlength="260" :disabled="store.busy"></label>
    <label>目标 Scene / Prefab URL（可留空）<input v-model="store.form.documentUrl" aria-label="交接文档URL" placeholder="db://assets/...scene" maxlength="260" :disabled="store.busy"></label>
    <label>目标节点标识（可留空）<input v-model="store.form.nodeKey" aria-label="交接目标节点" maxlength="300" :disabled="store.busy"></label>
    <el-button native-type="submit" :loading="store.busy" :disabled="!store.canPrepare">准备交接包（只读）</el-button>
   </form>
   <el-tag class="companion-status-tag" :type="feedback.tone" role="status"><el-icon class="companion-status-icon" :class="{'is-loading':store.phase==='reading'}"><component :is="feedback.icon"/></el-icon>{{ feedback.label }}</el-tag><p role="status">{{ store.message }}</p><el-button v-if="store.phase==='unknown'" :disabled="store.busy" @click="store.recheck">重新核对原任务（不重发）</el-button>
   <div class="handoff-target"><el-button :disabled="!store.canCopy" @click="store.copyText">复制交接文本</el-button><el-button :disabled="!store.canCopy" @click="store.downloadJson">下载交接 JSON</el-button></div>
   <IconSceneBindingPanel v-if="provider?.sceneBinding && store.packet" :project="project" :packet="store.packet" :job="job" :provider="provider.sceneBinding" :active="active" :ready="ready && store.phase==='ready' && !store.busy && store.eligible"/>
   <AntSlotBindingPanel :project="project" :packet="store.packet" :job="job" :active="active" :variant-verification="variantVerification" :ready="ready && store.phase==='ready' && !store.busy && store.eligible"/>
   <details v-if="store.packet"><summary>已核对的交接 JSON</summary><pre>{{ JSON.stringify(store.packet,null,2) }}</pre></details>
   <p class="form-help">仅准备和复制，未发送给Agent。所有Creator动作必须从本机32180开发者后台UI发起。交接包不授予写入或租约，UNKNOWN不可重放。</p>
  </section>
 </section>
</template>
<style scoped>
.handoff-details,.handoff-details form{display:grid;gap:12px}.handoff-details header,.handoff-target{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.handoff-details header{justify-content:space-between}.handoff-details h4{margin:0}.handoff-details label{display:grid;gap:6px;font-size:13px}.handoff-details input,.handoff-details select{padding:8px;border:1px solid var(--el-border-color);border-radius:4px;font:inherit;width:100%;box-sizing:border-box;background:var(--el-bg-color);color:inherit}.handoff-details pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:400px;overflow:auto}.handoff-details p{overflow-wrap:anywhere}.handoff-details button:focus-visible,.handoff-details input:focus-visible,.handoff-details select:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}
</style>
