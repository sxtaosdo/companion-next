<!-- Layout/close actions adapted from Cool-admin Vue 8.x process.vue (MIT).
     See src/login/COOL-ADMIN-LICENSE.txt. No upstream token, permissions, EPS or refresh-cache system is imported. -->
<script setup lang="ts">
import { ref,watch } from 'vue'
import { useRoute,useRouter } from 'vue-router'
import { Close,ArrowDown } from '@element-plus/icons-vue'
import { visitShellTab } from '../domain/shell-navigation'
import type { ShellTab } from '../domain/shell-navigation'
const route=useRoute(),router=useRouter(),tabs=ref<ShellTab[]>([]),pending=ref(false)
watch(()=>route.fullPath,()=>{if(route.path!=='/'&&route.matched.length)tabs.value=visitShellTab(tabs.value,route)},{immediate:true})
async function navigate(to:string){if(pending.value||to===route.fullPath)return;pending.value=true;try{await router.push(to)}finally{pending.value=false}}
async function close(key:string){
 if(pending.value)return
 const index=tabs.value.findIndex(tab=>tab.key===key);if(index<0)return
 if(key===route.fullPath){const destination=tabs.value[index-1]??tabs.value[index+1];await navigate(destination?.to??'/overview');if(route.fullPath===key)return}
 tabs.value=tabs.value.filter(tab=>tab.key!==key)
}
function action(command:string){if(command==='others')tabs.value=tabs.value.filter(tab=>tab.key===route.fullPath);else if(command==='all'){void clearAll()}}
async function clearAll(){if(pending.value)return;await navigate('/overview');tabs.value=visitShellTab([],route)}
</script>
<template><div class="shell-route-tabs" aria-label="已打开页面"><div class="route-tab-list" role="tablist" aria-label="路由标签"><div v-for="tab in tabs" :key="tab.key" class="route-tab" :class="{'is-active':tab.key===route.fullPath}"><button type="button" role="tab" :aria-selected="tab.key===route.fullPath" :disabled="pending" @click="navigate(tab.to)">{{tab.title}}</button><button type="button" class="close-tab" :aria-label="`关闭标签：${tab.title}`" :disabled="pending" @click="close(tab.key)"><el-icon><Close/></el-icon></button></div></div><el-dropdown trigger="click" @command="action"><el-button text :disabled="pending" aria-label="路由标签操作"><el-icon><ArrowDown/></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="others">关闭其他标签</el-dropdown-item><el-dropdown-item command="all">关闭全部标签</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></template>
<style scoped>.shell-route-tabs{display:flex;align-items:center;gap:8px;padding:6px 20px;border-bottom:1px solid var(--el-border-color-light);background:var(--el-bg-color);min-width:0}.route-tab-list{display:flex;gap:6px;overflow:auto;flex:1}.route-tab{display:flex;align-items:center;flex-shrink:0;border:1px solid var(--el-border-color-light);border-radius:4px}.route-tab button{border:0;background:transparent;color:var(--el-text-color-regular);font:inherit;font-size:12px;padding:7px 9px;cursor:pointer;white-space:nowrap}.route-tab .close-tab{display:flex;padding:7px}.route-tab.is-active{border-color:var(--el-color-primary-light-5);background:var(--el-color-primary-light-9)}.route-tab.is-active button{color:var(--el-color-primary)}.route-tab button:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:-2px}</style>
