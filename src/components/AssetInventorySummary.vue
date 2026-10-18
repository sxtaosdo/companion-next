<script setup lang="ts">
import { ref, shallowRef, watch, onBeforeUnmount } from 'vue'
import { readAssetInventory, type AssetInventorySummary } from '../adapters/asset-inventory'
const props=defineProps<{project:{id:string;path:string};source:object|null}>()
const summary=shallowRef<AssetInventorySummary|null>(null),busy=ref(false),error=ref('')
let generation=0,controller:AbortController|undefined
function reset(){generation++;controller?.abort();controller=undefined;summary.value=null;error.value='';busy.value=false}
watch(()=>[props.project.id,props.project.path,props.source],reset,{flush:'sync'})
onBeforeUnmount(reset)
async function read(){
 if(busy.value||!props.source)return
 const serial=++generation,project=props.project.id;controller=new AbortController();busy.value=true;error.value='';summary.value=null
 try{const value=await readAssetInventory(project,controller.signal);if(serial===generation)summary.value=value}
 catch(cause){if(serial===generation)error.value=cause instanceof Error?cause.message:'INVENTORY_READ_FAILED'}
 finally{if(serial===generation){busy.value=false;controller=undefined}}
}
const title='\u8d44\u6e90\u5e93\u5b58\u6c47\u603b',readLabel='\u8bfb\u53d6\u5e93\u5b58',pending='\u5c1a\u672a\u8bfb\u53d6\u771f\u5b9e AssetDB \u5e93\u5b58',unavailable='\u672a\u80fd\u8bfb\u53d6\u771f\u5b9e\u5e93\u5b58\uff1b\u8bf7\u786e\u8ba4 Creator / Bridge \u5df2\u8fde\u63a5\u3002'
</script>
<template>
 <section class="panel inventory-summary" data-testid="asset-inventory-summary">
  <div class="inventory-heading"><h3>{{ title }}</h3><el-button :loading="busy" :disabled="!source||busy" @click="read">{{ readLabel }}</el-button></div>
  <p v-if="error" role="alert">{{ unavailable }} <small>{{ error }}</small></p><p v-else-if="!summary">{{ pending }}</p>
  <template v-else><p>{{ summary.root }} · {{ summary.generatedAt }}</p><dl><dt>Total</dt><dd>{{ summary.total }}</dd><dt>Imported</dt><dd>{{ summary.imported }}</dd><dt>Unimported</dt><dd>{{ summary.unimported }}</dd><dt>Unknown type</dt><dd>{{ summary.unknownType }}</dd></dl><div class="inventory-groups"><table><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody><tr v-for="row in summary.byType" :key="row.type"><td>{{ row.type }}</td><td>{{ row.count }}</td></tr></tbody></table><table><thead><tr><th>Folder</th><th>Count</th></tr></thead><tbody><tr v-for="row in summary.byTopLevelFolder" :key="row.folder"><td>{{ row.folder }}</td><td>{{ row.count }}</td></tr></tbody></table></div></template>
 </section>
</template>
<style scoped>
.inventory-summary{padding:24px}.inventory-heading,.inventory-groups{display:flex;justify-content:space-between;gap:20px}.inventory-summary dl{display:grid;grid-template-columns:repeat(4,auto 1fr);gap:8px}.inventory-summary dd{margin:0}.inventory-summary p,.inventory-summary small{overflow-wrap:anywhere;color:var(--text-secondary,#637187)}table{text-align:left;width:50%;border-collapse:collapse}td,th{padding:6px;overflow-wrap:anywhere}@media(max-width:600px){.inventory-groups{flex-direction:column}table{width:100%}.inventory-summary dl{grid-template-columns:auto 1fr}}
</style>
