<script setup lang="ts">
import { computed,onBeforeUnmount,ref,watch } from 'vue'
import { CLIENT_TARGETS,CLIENT_LABELS,type ClientTarget } from '../domain/project-connections'
import { useProjectConnectionsStore } from '../stores/project-connections'
import ConnectionConfirmation from './ConnectionConfirmation.vue'
const props=defineProps<{projectId:string;wizard?:boolean}>(),emit=defineEmits<{skip:[]}>(),store=useProjectConnectionsStore(),owner=Symbol('agent-registration')
const selected=ref<ClientTarget[]>([...CLIENT_TARGETS]),all=computed(()=>selected.value.length===CLIENT_TARGETS.length),partial=computed(()=>selected.value.length>0&&!all.value)
watch(()=>[props.projectId,JSON.stringify(selected.value)],()=>store.cancel(owner),{flush:'sync'})
onBeforeUnmount(()=>store.cancel(owner))
function selectAll(value:unknown){selected.value=value===true?[...CLIENT_TARGETS]:[]}
</script>
<template>
 <section data-testid="agent-registration-panel"><template v-if="wizard"><h4>选择 Agent</h4><p>现有完整接入已明确包含 Codex。本步注册所选客户端；跳过只跳过本步，不撤销先前配置。严格不配置 Codex 仍等待原接口合同修复。</p><el-checkbox :model-value="all" :indeterminate="partial" :disabled="store.busy" @update:model-value="selectAll">全选</el-checkbox><el-checkbox-group v-model="selected" :disabled="store.busy"><el-checkbox v-for="target in CLIENT_TARGETS" :key="target" :value="target">{{ CLIENT_LABELS[target] }}</el-checkbox></el-checkbox-group><el-button :disabled="!store.available||!selected.length" @click="store.prepareClients(owner,projectId,selected)">接入所选 Agent</el-button><el-button :disabled="store.busy" @click="store.cancel(owner);emit('skip')">跳过 Agent 接入</el-button></template><template v-else><p>选择要写入 MCP 配置的客户端；下一步核对完整工程和目标。</p><el-button v-for="target in CLIENT_TARGETS" :key="target" :disabled="!store.available" @click="store.prepareClients(owner,projectId,[target])">{{ CLIENT_LABELS[target] }}</el-button></template><ConnectionConfirmation :owner="owner"/></section>
</template>
