<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { companionBrowserProvider } from '../companion-browser-integration'
import { COMPANION_SESSION_REQUIRED_EVENT, isSessionRestoredMessage, safeCompanionReturnTo } from '../domain/companion-session-recovery'
const route = useRoute()
const open = ref(false)
const returnTo = ref('')
const frame = ref<HTMLIFrameElement | null>(null)
const frameRevision = ref(0)
const frameError = ref(false)
let source = companionBrowserProvider.value
let routeIdentity = ''
function close() { open.value = false }
function requestAuthorization(event: Event) {
  const detail: unknown = (event as CustomEvent).detail
  const target = detail && typeof detail === 'object' ? safeCompanionReturnTo((detail as { returnTo?: unknown }).returnTo) : null
  const current = safeCompanionReturnTo(`/next/index.html${window.location.search}${window.location.hash}`)
  if (!target || target !== current || open.value) return
  source = companionBrowserProvider.value
  routeIdentity = route.fullPath
  returnTo.value = target
  frameError.value = false
  open.value = true
}
function restored(event: MessageEvent) {
  if (!open.value || source !== companionBrowserProvider.value || routeIdentity !== route.fullPath
    || !isSessionRestoredMessage(event, window.location.origin, frame.value?.contentWindow ?? null)) return
  close()
  ElMessage.success('会话已恢复，请手动重试刚才的操作。')
}
function guideLoaded() {
  // Browser error documents can fire load rather than error. Never mistake them for a usable guide.
  try {
    const location = frame.value?.contentWindow?.location
    if (!location || location.origin !== window.location.origin || location.pathname !== '/login') frameError.value = true
  } catch { frameError.value = true }
}
function retryFrame() { frameError.value = false; frameRevision.value++ }
watch([() => route.fullPath, companionBrowserProvider], close, { flush: 'sync' })
onMounted(() => {
  window.addEventListener(COMPANION_SESSION_REQUIRED_EVENT, requestAuthorization)
  window.addEventListener('message', restored)
})
onBeforeUnmount(() => {
  window.removeEventListener(COMPANION_SESSION_REQUIRED_EVENT, requestAuthorization)
  window.removeEventListener('message', restored)
})
</script>
<template>
  <el-dialog v-model="open" title="需要重新登录" width="min(640px, calc(100vw - 32px))" :close-on-click-modal="false" destroy-on-close>
    <p class="session-recovery-note">当前页面和输入已保留。请在下方使用账号、密码和图片验证码登录；刚才的操作不会自动重发。</p>
    <p v-if="frameError" role="alert">登录页加载失败，请重试加载。</p>
    <iframe v-if="open && !frameError" :key="frameRevision" ref="frame" class="session-recovery-frame" :src="`/login?embedded=1&returnTo=${encodeURIComponent(returnTo)}`" title="Companion 账号登录" @load="guideLoaded" @error="frameError = true"/>
    <template #footer>
      <el-button @click="retryFrame">重新加载登录页</el-button>
      <el-button @click="close">暂不登录</el-button>
    </template>
  </el-dialog>
</template>
<style scoped>
.session-recovery-note { margin: 0 0 12px; line-height: 1.7; color: var(--text-secondary, #637187); }
.session-recovery-frame { display: block; width: 100%; height: min(560px, 65vh); border: 1px solid #dfe4ed; border-radius: 6px; background: #fff; }
</style>
