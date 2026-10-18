<script setup lang="ts">
import { computed,onBeforeUnmount,ref,shallowRef,watch } from 'vue'
import { toolPresetReadProvider } from '../tool-presets-read-integration'
import { companionBrowserProvider } from '../companion-browser-integration'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useProjectConnectionsStore } from '../stores/project-connections'
import { decodeToolPresetRead,type ToolPresetRead } from '../domain/tool-presets-read'
import ConnectionConfirmation from './ConnectionConfirmation.vue'
const props=defineProps<{projectId:string;setupOperationId:string}>(),browser=useCompanionBrowserStore(),store=useProjectConnectionsStore(),owner=Symbol('setup-tool-scope')
const snapshot=shallowRef<ToolPresetRead|null>(null),selected=ref(''),loading=ref(false),error=ref('');let epoch=0,abort:AbortController|undefined
const key=()=>JSON.stringify([props.projectId,props.setupOperationId,browser.projects.find(p=>p.id===props.projectId)])
async function load(){
 const version=++epoch,api=toolPresetReadProvider.value,source=browser.provider,binding=key();abort?.abort();abort=new AbortController();snapshot.value=null;selected.value='';error.value='';store.cancel(owner)
 if(!api||!browser.connected||source!==companionBrowserProvider.value||!browser.projects.some(p=>p.id===props.projectId)){loading.value=false;return}
 loading.value=true;const current=()=>version===epoch&&api===toolPresetReadProvider.value&&source===browser.provider&&browser.connected&&binding===key()
 try{const reply=decodeToolPresetRead(await api.loadPresets(props.projectId,abort.signal));if(current()){snapshot.value=reply;selected.value=reply.selectedPresetId}}catch{if(current())error.value='工具范围读取失败，请显式刷新；未准备任何写入。'}finally{if(current())loading.value=false}
}
watch(()=>[key(),browser.provider,browser.connected,toolPresetReadProvider.value],()=>{void load()},{immediate:true,flush:'sync'})
watch(selected,()=>store.cancel(owner),{flush:'sync'})
const choice=computed(()=>snapshot.value?.presets.find(p=>p.id===selected.value))
function prepare(){if(choice.value)store.prepareScope(owner,props.projectId,props.setupOperationId,choice.value)}
onBeforeUnmount(()=>{epoch++;abort?.abort();store.cancel(owner)})
</script>
<template><section data-testid="setup-tool-scope"><h4>工具范围</h4><p>读取当前工程范围，仅在明确选择并确认后写入；不会自动重置为 full。</p><el-select v-model="selected" aria-label="向导工具范围" :disabled="loading||store.busy"><el-option v-for="preset in snapshot?.presets??[]" :key="preset.id" :value="preset.id" :label="`${preset.name}（${preset.id}）`"/></el-select><el-button :disabled="loading||store.busy" @click="load">刷新工具范围</el-button><el-button :disabled="!store.available||loading||!choice||selected===snapshot?.selectedPresetId" @click="prepare">核对向导工具范围</el-button><p v-if="error" role="status">{{ error }}</p><p v-if="choice">{{ choice.name }} · {{ choice.baseProfile }} · 启用 {{ choice.enabled.length }} / 停用 {{ choice.disabled.length }}</p><ConnectionConfirmation :owner="owner" @sent="$event&&load()"/></section></template>
