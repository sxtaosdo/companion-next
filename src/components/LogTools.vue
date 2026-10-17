<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useLogToolsStore } from '../stores/log-tools'
import { logToolsProvider } from '../log-tools-integration'
const browser=useCompanionBrowserStore(),tools=useLogToolsStore()
const emit=defineEmits<{cleared:[]}>()
let mounted=true
const displayed=shallowRef<typeof tools.prepared>(null)
watch(()=>tools.prepared,value=>{if(value)displayed.value=value},{flush:'sync',immediate:true})
const target=computed(()=>browser.logFilter.projectIds?.[0]??browser.projects[0]?.id)
const clearScope=computed(()=>{
 const r=displayed.value?.request
 return r?.action==='clear'&&r.projectIds.length?r.projectIds.map(id=>browser.projects.find(p=>p.id===id)?.name??id).join('、'):'全部工程及后台'
})
const diagnosticName=computed(()=>{const r=displayed.value?.request;return r?.action==='diagnostic'?browser.projects.find(p=>p.id===r.projectId)?.name??r.projectId:''})
function prepareClear(){tools.prepare({action:'clear',projectIds:[...(browser.logFilter.projectIds??[])]})}
function prepareDiagnostic(){if(target.value)tools.prepare({action:'diagnostic',projectId:target.value})}
async function confirm(){const clear=tools.prepared?.request.action==='clear';const done=await tools.send();if(mounted&&done&&clear)emit('cleared')}
function saveDiagnostic(){
 const result=tools.diagnostic;if(!result)return
 const url=URL.createObjectURL(new Blob([result.text+'\n'],{type:'application/json;charset=utf-8'}))
 const anchor=document.createElement('a');anchor.href=url;anchor.download=`companion-diagnostic-${result.projectId}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
watch(()=>JSON.stringify(browser.logFilter),()=>tools.cancelConfirmation(),{flush:'sync'})
onBeforeUnmount(()=>{mounted=false;tools.invalidate()})
</script>
<template>
 <div v-if="logToolsProvider" class="log-tool-buttons">
  <el-button :disabled="!tools.available||tools.unknownClear" @click="prepareClear">清除日志</el-button>
  <el-button :disabled="!tools.available||!target" @click="prepareDiagnostic">导出诊断</el-button>
  <el-dialog :model-value="!!tools.prepared" :title="displayed?.request.action==='clear'?'清除日志':'导出诊断'" width="560px" @update:model-value="!$event&&tools.cancelConfirmation()">
   <template v-if="displayed?.request.action==='clear'"><p>清除范围：{{ clearScope }}</p><p>仅按工程清除内存日志，来源、级别和关键字不会限制清除范围。磁盘 NDJSON 保留；本页没有撤销功能。</p></template>
   <template v-else><p>工程：{{ diagnosticName }}</p><p>读取该工程状态及最多1000条内存日志，可能更新后台状态和诊断记录。结果在本页展示，可另行保存本机。</p><p>沿用旧选择顺序：首个日志工程；未选择时使用首个登记工程。</p></template>
   <template #footer><el-button @click="tools.cancelConfirmation()">取消</el-button><el-button :type="displayed?.request.action==='clear'?'danger':'primary'" :disabled="!tools.available" @click="confirm">{{ displayed?.request.action==='clear'?'确认清除':'读取诊断' }}</el-button></template>
  </el-dialog>
  <div v-if="tools.message||tools.unknownClear" class="log-tool-message" role="status">{{ tools.message }}<span v-if="tools.unknownClear"> 清除结果未知，本次会话不再发送清除；请先核对日志，停止等待不会取消后台操作。</span></div>
  <section v-if="tools.diagnostic" class="log-diagnostic"><div><strong>诊断结果</strong><el-button size="small" @click="saveDiagnostic">保存到本机</el-button></div><p>凭据字段和常见凭据文本已过滤；本机诊断仍可能包含工程路径和业务日志。</p><pre>{{ tools.diagnostic.text }}</pre></section>
 </div>
</template>
<style scoped>
.log-tool-buttons{display:contents}.log-tool-message,.log-diagnostic{flex-basis:100%;min-width:0;overflow-wrap:anywhere}.log-diagnostic>div{display:flex;align-items:center;gap:12px}.log-diagnostic pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto;background:var(--el-fill-color-light);padding:12px;border-radius:8px}.log-diagnostic p{font-size:12px;color:var(--el-text-color-secondary)}
</style>
