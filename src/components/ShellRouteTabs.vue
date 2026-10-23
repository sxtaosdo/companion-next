<!-- Layout/close actions adapted from Cool-admin Vue 8.x process.vue (MIT).
     See src/login/COOL-ADMIN-LICENSE.txt. No upstream token, permissions, EPS or refresh-cache system is imported. -->
<script setup lang="ts">
import { computed,ref,watch } from 'vue'
import { useRoute,useRouter } from 'vue-router'
import { Close,ArrowDown } from '@element-plus/icons-vue'
import { shellTabKey,visitShellTab } from '../domain/shell-navigation'
import type { ShellTab } from '../domain/shell-navigation'
const route=useRoute(),router=useRouter(),tabs=ref<ShellTab[]>([]),pending=ref(false)
const activeKey=computed(()=>shellTabKey(route))
watch(()=>route.fullPath,()=>{if(route.path!=='/'&&route.matched.length)tabs.value=visitShellTab(tabs.value,route)},{immediate:true})
async function navigate(to:string){if(pending.value||to===route.fullPath)return;pending.value=true;try{await router.push(to)}finally{pending.value=false}}
async function close(key:string){
 if(pending.value)return
 const index=tabs.value.findIndex(tab=>tab.key===key);if(index<0)return
 if(key===activeKey.value){const destination=tabs.value[index-1]??tabs.value[index+1];await navigate(destination?.to??'/overview');if(activeKey.value===key)return}
 tabs.value=tabs.value.filter(tab=>tab.key!==key)
}
function action(command:string){if(command==='others')tabs.value=tabs.value.filter(tab=>tab.key===activeKey.value);else if(command==='all'){void clearAll()}}
async function clearAll(){if(pending.value)return;await navigate('/overview');tabs.value=visitShellTab([],route)}
</script>
<template><div class="shell-route-tabs" aria-label="已打开页面"><div class="route-tab-list" role="tablist" aria-label="路由标签"><div v-for="tab in tabs" :key="tab.key" class="route-tab" :class="{'is-active':tab.key===activeKey}"><button type="button" role="tab" :aria-selected="tab.key===activeKey" :disabled="pending" @click="navigate(tab.to)">{{tab.title}}</button><button type="button" class="close-tab" :aria-label="`关闭标签：${tab.title}`" :disabled="pending" @click="close(tab.key)"><el-icon><Close/></el-icon></button></div></div><el-dropdown trigger="click" @command="action"><el-button text :disabled="pending" aria-label="路由标签操作"><el-icon><ArrowDown/></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="others">关闭其他标签</el-dropdown-item><el-dropdown-item command="all">关闭全部标签</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></template>
<style scoped>.shell-route-tabs{display:flex;align-items:center;gap:8px;padding:3px 20px;border-bottom:1px solid var(--el-border-color-light);background:var(--el-bg-color);min-width:0}.route-tab-list{display:flex;gap:6px;overflow:auto;flex:1}.route-tab{display:flex;align-items:center;flex-shrink:0;border:1px solid var(--el-border-color-light);border-radius:4px}.route-tab button{border:0;background:transparent;color:var(--el-text-color-regular);font:inherit;font-size:12px;padding:5px 9px;cursor:pointer;white-space:nowrap}.route-tab .close-tab{display:flex;padding:5px}.route-tab.is-active{border-color:var(--el-color-primary-light-5);background:var(--el-color-primary-light-9)}.route-tab.is-active button{color:var(--el-color-primary)}.route-tab button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:-2px}</style>
