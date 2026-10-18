<script setup lang="ts">
import { onBeforeUnmount,ref,watch } from 'vue'
import { agentHandoffBusy,agentHandoffProvider } from '../agent-handoff-integration'
import { agentHandoffUrl,type HandoffAgent } from '../domain/agent-handoff'
const props=defineProps<{text:string;contextKey:string;disabled?:boolean}>()
const notice=ref('');let generation=0,alive=true
watch(()=>[props.text,props.contextKey,props.disabled,agentHandoffProvider.value],()=>{generation++;notice.value=''}, {flush:'sync'})
onBeforeUnmount(()=>{alive=false;generation++})
async function send(agent:HandoffAgent){
 const provider=agentHandoffProvider.value;if(!provider||agentHandoffBusy.value||props.disabled||!props.text.trim())return
 const text=props.text,key=props.contextKey,epoch=generation,name=agent==='cursor'?'Cursor':'Codex'
 const current=()=>alive&&!props.disabled&&generation===epoch&&props.text===text&&props.contextKey===key&&agentHandoffProvider.value===provider
 agentHandoffBusy.value=true;notice.value=''
 try{
  try{await provider.writeText(text)}catch{if(current())notice.value='复制失败，请允许浏览器访问剪贴板后重试；尚未打开 Agent。';return}
  if(!current())return
  try{const {url,clipboardOnly}=agentHandoffUrl(agent,text);provider.open(url);if(current())notice.value=clipboardOnly?`完整文本已复制。已尝试打开 ${name}，请粘贴后确认使用。`:`已尝试打开 ${name}，请确认使用；若未打开，请手动打开应用并粘贴。`}
  catch{if(current())notice.value=`完整文本已复制，未能打开 ${name}，请手动打开应用并粘贴。`}
 }finally{agentHandoffBusy.value=false}
}
</script>
<template>
 <template v-if="agentHandoffProvider"><button v-for="agent in (['cursor','codex'] as const)" :key="agent" type="button" :disabled="disabled||agentHandoffBusy||!text.trim()" title="仅传递完整文本到本机应用，请自行确认使用" @click="send(agent)">发送到 {{ agent==='cursor'?'Cursor':'Codex' }}</button><span v-if="notice" class="agent-handoff-notice" role="status">{{ notice }}</span></template>
</template>
<style scoped>.agent-handoff-notice{flex-basis:100%;font-size:12px;overflow-wrap:anywhere}</style>
