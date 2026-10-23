<!-- Layout adapted from Cool-admin Vue 8.x topbar.vue (MIT); see src/login/COOL-ADMIN-LICENSE.txt.
     Authentication remains Companion's existing server-side Cookie session. -->
<script setup lang="ts">
import { onMounted,onBeforeUnmount,ref } from 'vue'
import { User,ArrowDown } from '@element-plus/icons-vue'
import { COMPANION_SESSION_REQUIRED_EVENT } from '../domain/companion-session-recovery'
defineProps<{busy?:boolean}>()
const emit=defineEmits<{logout:[]}>()
const label=ref('正在读取身份'),error=ref(false)
let revision=0,controller:AbortController|undefined
async function readIdentity(){
 const current=++revision;controller?.abort();controller=new AbortController()
 try{
  const response=await fetch('/api/ui/session',{credentials:'same-origin',signal:controller.signal})
  const value:unknown=await response.json()
  if(current!==revision)return
  if(!response.ok||!value||typeof value!=='object'||(value as {authenticated?:unknown}).authenticated!==true)throw new Error('unverified')
  const session=(value as {session?:{kind?:unknown;username?:unknown}}).session
  label.value=session?.kind==='account'&&typeof session.username==='string'&&session.username.trim()&&session.username.length<=128?session.username:session?.kind==='local'?'本机授权':'已登录（身份未提供）'
  error.value=false
 }catch{if(current===revision){label.value='身份待核对';error.value=true}}
}
function expired(){++revision;controller?.abort();label.value='登录已过期';error.value=true}
function command(value:string){if(value==='logout')emit('logout');else if(value==='retry')void readIdentity()}
onMounted(()=>{void readIdentity();window.addEventListener(COMPANION_SESSION_REQUIRED_EVENT,expired);window.addEventListener('companion:identity-refresh',readIdentity)})
onBeforeUnmount(()=>{++revision;controller?.abort();window.removeEventListener(COMPANION_SESSION_REQUIRED_EVENT,expired);window.removeEventListener('companion:identity-refresh',readIdentity)})
</script>
<template><el-dropdown trigger="click" @command="command"><el-button text class="companion-user" :loading="busy" :aria-label="`用户菜单：${label}`"><el-icon><User/></el-icon><span class="identity-label">{{label}}</span><el-icon><ArrowDown/></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-if="error" command="retry">重新读取身份</el-dropdown-item><el-dropdown-item command="logout" :disabled="busy">退出登录</el-dropdown-item></el-dropdown-menu></template></el-dropdown></template>
<style scoped>.companion-user{gap:6px;max-width:220px}.identity-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px}@media(max-width:600px){.identity-label{max-width:90px}}</style>
