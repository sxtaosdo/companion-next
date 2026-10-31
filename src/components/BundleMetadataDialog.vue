<script setup lang="ts">
import {computed, onBeforeUnmount, ref, watch} from 'vue'
import type {BundleMetadataSnapshot as Snapshot,BundleMetadataProvider} from '../adapters/bundle-metadata'
const props=defineProps<{projectId:string;provider:BundleMetadataProvider}>()
const visible=ref(false), busy=ref(false), saving=ref(false), error=ref(''), unknown=ref(false)
const snapshot=ref<Snapshot|null>(null), selected=ref(''), draft=ref<number|undefined>(), acknowledged=ref(false),clock=ref(Date.now())
let generation=0, mounted=true, timer:ReturnType<typeof setInterval>|undefined
watch(()=>[props.projectId,props.provider],()=>{++generation;busy.value=false;saving.value=false;snapshot.value=null;selected.value='';acknowledged.value=false;unknown.value=true},{flush:'sync'})
const row=computed(()=>snapshot.value?.rows.find(item=>item.uuid===selected.value))
const expired=computed(()=>!!snapshot.value&&clock.value-Date.parse(snapshot.value.observedAt)>=120000)
const valid=computed(()=>!!snapshot.value&&!unknown.value&&!error.value&&!expired.value&&Date.parse(snapshot.value.observedAt)<=clock.value+30000)
const canSave=computed(()=>valid.value&&!busy.value&&!!row.value&&acknowledged.value&&Number.isInteger(draft.value)&&draft.value!>=0&&draft.value!<=9&&draft.value!==row.value.priority)
function choose(value:string){selected.value=value;draft.value=row.value?.priority;acknowledged.value=false}
async function read(){
 if(busy.value)return
 const ticket=++generation, projectId=props.projectId, provider=props.provider
 busy.value=true;error.value='';acknowledged.value=false
 try{
  const value=await provider.read(projectId)
  if(!mounted||ticket!==generation||projectId!==props.projectId||provider!==props.provider)return
  if(value.schemaVersion!=='p3000-bundle-metadata-v1'||value.rows.length!==5||!Number.isFinite(Date.parse(value.observedAt)))throw Error('Bundle 读回格式无效')
  clock.value=Date.now();snapshot.value=value;unknown.value=false;choose('')
 }catch(cause){if(mounted&&ticket===generation){error.value=String(cause);unknown.value=true}}
 finally{if(mounted&&ticket===generation)busy.value=false}
}
async function open(){if(props.projectId!=='214a2184be887306')return;visible.value=true;if(!timer)timer=setInterval(()=>clock.value=Date.now(),1000);await read()}
function close(){if(saving.value)return;visible.value=false;++generation;busy.value=false;acknowledged.value=false;clearInterval(timer);timer=undefined}
async function save(){
 const target=row.value, observed=snapshot.value
 // Recheck wall-clock freshness at dispatch; computed values alone are not a clock.
 if(!canSave.value||!target||!observed||Date.now()-Date.parse(observed.observedAt)>=120000)return
 const ticket=++generation, projectId=props.projectId, provider=props.provider
 busy.value=true;saving.value=true;acknowledged.value=false
 try{
  await provider.update(projectId,{url:target.url,uuid:target.uuid,expectedHash:target.hash,priority:draft.value!,approved:true})
  if(!mounted||ticket!==generation||projectId!==props.projectId||provider!==props.provider)return
  // A save acknowledgement does not establish Preview resource ownership.
  snapshot.value=null;selected.value='';unknown.value=true;error.value='配置已读回。请重新读取并从后台预览核对四个 Prefab 的实际归属。'
 }catch(cause){if(mounted&&ticket===generation){unknown.value=true;error.value='保存结果需核对：'+String(cause)}}
 finally{if(mounted&&ticket===generation){busy.value=false;saving.value=false}}
}
onBeforeUnmount(()=>{mounted=false;++generation;clearInterval(timer)})
defineExpose({open})
</script>
<template>
 <el-dialog :model-value="visible" title="P3000 Bundle 配置" width="min(860px,calc(100vw - 32px))" class="bundle-metadata-dialog" body-class="bundle-metadata-body" footer-class="bundle-metadata-footer" style="display:flex;flex-direction:column;max-height:calc(100dvh - 32px);margin:16px auto" :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving" @update:model-value="close">
  <p>仅核对 game 与四个子 Bundle。优先级变化对当前 Preview 的效果尚未验证，请依据归属证据选择调整值。</p>
  <p v-if="snapshot">{{ snapshot.projectPath }} · 读取于 {{ snapshot.observedAt }}</p>
  <el-button :disabled="busy" @click="read">{{ busy?'处理中':'读取配置与引用证据' }}</el-button>
  <p v-if="error" role="alert">{{ error }}</p>
  <p v-if="expired" role="status">配置快照已过期，请重新读取后再保存。</p>
  <p v-else-if="!snapshot" role="status">尚未读取 Creator 配置。</p>
  <template v-if="snapshot">
   <el-table :data="snapshot.rows" row-key="uuid">
    <el-table-column prop="name" label="Bundle"/><el-table-column prop="priority" label="优先级"/>
    <el-table-column label="目录内 Prefab"><template #default="scope">{{ scope.row.prefabs.length }}</template></el-table-column>
   </el-table>
   <p>目录内 Prefab 与 AssetDB 引用是编辑器证据，不等于 Preview Bundle 路径索引。</p>
   <details v-for="item in snapshot.rows" :key="item.uuid"><summary>{{ item.name }} · {{ item.url }}</summary><pre>{{ JSON.stringify(item.prefabs,null,2) }}</pre></details>
   <el-select :model-value="selected" :disabled="busy||!valid" placeholder="选择要调整的 Bundle" @update:model-value="choose"><el-option v-for="item in snapshot.rows" :key="item.uuid" :value="item.uuid" :label="item.name"/></el-select>
  </template>
  <template #footer>
   <div class="bundle-confirmation">
   <template v-if="row">
    <p>{{ row.url }} · 当前 {{ row.priority }}</p>
    <el-input-number v-model="draft" :disabled="busy||!valid" :min="0" :max="9" :step="1" :precision="0" aria-label="目标 Bundle 优先级"/>
    <el-checkbox v-model="acknowledged" :disabled="busy||!valid">确认仅修改此 Bundle 优先级，随后通过后台预览验收。</el-checkbox>
    <el-button :disabled="!canSave" @click="save">保存并读回配置</el-button>
   </template>
  <p v-if="unknown" role="status">当前结果需重新读取核对；不会自动重试写入。</p>
   </div>
  </template>
 </el-dialog>
</template>
<style scoped>pre{max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}details{margin:8px 0}.el-checkbox{display:flex;margin:12px 0}:global(.bundle-metadata-body){min-height:0;overflow:auto}:global(.bundle-metadata-dialog .el-dialog__header),:global(.bundle-metadata-footer){flex-shrink:0}.bundle-confirmation{text-align:left;overflow-wrap:anywhere}.bundle-confirmation p{margin:6px 0}.bundle-confirmation .el-checkbox{height:auto;white-space:normal;align-items:flex-start}.bundle-confirmation :deep(.el-checkbox__label){white-space:normal;overflow-wrap:anywhere}</style>
