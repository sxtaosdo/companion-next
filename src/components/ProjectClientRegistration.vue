<script setup lang="ts">
import { onBeforeUnmount,ref,watch } from 'vue'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useProjectConnectionsStore } from '../stores/project-connections'
import { projectConnectionsProvider } from '../project-connections-integration'
import AgentRegistrationPanel from './AgentRegistrationPanel.vue'
const props=defineProps<{projectId:string}>(),emit=defineEmits<{visibility:[open:boolean]}>(),open=ref(false),browser=useCompanionBrowserStore(),connections=useProjectConnectionsStore()
watch(open,value=>emit('visibility',value),{flush:'sync'})
watch(()=>[browser.provider,browser.connected,projectConnectionsProvider.value,JSON.stringify(browser.projects.find(p=>p.id===props.projectId))],()=>{open.value=false},{flush:'sync'})
onBeforeUnmount(()=>{if(open.value)emit('visibility',false)})
</script>
<template><template v-if="projectConnectionsProvider"><el-button size="small" :disabled="!connections.available" @click="open=true">注册 MCP</el-button><el-dialog v-model="open" title="注册 MCP" width="640px" :close-on-click-modal="false"><AgentRegistrationPanel v-if="open" :project-id="projectId"/></el-dialog></template></template>
