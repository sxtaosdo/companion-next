<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CircleCheck, Loading, Refresh, TopRight, Warning } from '@element-plus/icons-vue'
import { PUBLIC_IMAGE_COLLECTOR_URL, PUBLIC_IMAGE_COLLECTOR_READY_TIMEOUT_MS, isPublicImageCollectorReady } from '../domain/public-image-collector'
const frame=ref<HTMLIFrameElement|null>(null),generation=ref(0),state=ref<'loading'|'ready'|'unconfirmed'>('loading')
const label=computed(()=>state.value==='ready'?'已就绪':state.value==='loading'?'加载中':'未确认就绪')
let timer:ReturnType<typeof setTimeout>|undefined,disposed=false
function clearTimer(){if(timer!==undefined)clearTimeout(timer);timer=undefined}
function waitForReady(){clearTimer();timer=setTimeout(()=>{timer=undefined;if(!disposed&&state.value!=='ready')state.value='unconfirmed'},PUBLIC_IMAGE_COLLECTOR_READY_TIMEOUT_MS)}
function receive(event:MessageEvent){if(isPublicImageCollectorReady(event,frame.value?.contentWindow??null)){state.value='ready';clearTimer()}}
function frameFailed(event:Event){if(event.target===frame.value){clearTimer();state.value='unconfirmed'}}
async function retry(){state.value='loading';generation.value++;clearTimer();await nextTick();if(!disposed)waitForReady()}
onMounted(()=>{window.addEventListener('message',receive);waitForReady()})
onBeforeUnmount(()=>{disposed=true;clearTimer();window.removeEventListener('message',receive)})
</script>
<template>
 <section class="collector-workspace" data-testid="public-image-collector">
  <header class="collector-toolbar"><div class="collector-status" role="status" aria-live="polite"><strong>素材采集器</strong><el-tag size="small" :type="state==='ready'?'success':state==='loading'?'info':'warning'" :aria-busy="state==='loading'"><el-icon :class="{'is-loading':state==='loading'}"><component :is="state==='ready'?CircleCheck:state==='loading'?Loading:Warning"/></el-icon>{{ label }}</el-tag></div><div class="collector-actions"><el-button size="small" :icon="Refresh" :disabled="state==='loading'" @click="retry">重试加载</el-button><a class="el-button el-button--small" :href="PUBLIC_IMAGE_COLLECTOR_URL" target="_blank" rel="noopener noreferrer"><el-icon aria-hidden="true"><TopRight/></el-icon><span>独立窗口</span></a></div></header>
  <div class="collector-stage" :aria-busy="state==='loading'">
   <iframe :key="generation" ref="frame" v-show="state==='ready'" class="collector-frame" :src="PUBLIC_IMAGE_COLLECTOR_URL" title="独立素材采集器" referrerpolicy="no-referrer" @error="frameFailed"/>
   <div v-if="state!=='ready'" class="collector-placeholder" role="status"><el-icon :class="{'is-loading':state==='loading'}" :size="28"><component :is="state==='loading'?Loading:Warning"/></el-icon><strong>{{ state==='loading'?'正在等待采集器就绪':'尚未收到采集器就绪确认' }}</strong><p v-if="state==='unconfirmed'">请在 public-image-review 目录运行 <code>npm run start:companion</code>，再重试加载；也可在独立窗口检查。</p></div>
  </div>
 </section>
</template>
<style scoped>
.collector-workspace{min-width:0}.collector-toolbar,.collector-status,.collector-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.collector-toolbar{justify-content:space-between;padding:12px 14px;border:1px solid #e2e7f0;border-radius:10px;background:#fff;margin-bottom:12px}.collector-status strong{font-size:13px}.collector-status :deep(.el-tag__content){display:inline-flex;align-items:center;gap:4px}.collector-actions :deep(.el-button+.el-button){margin-left:0}.collector-actions a{text-decoration:none}.collector-actions a .el-icon{margin-right:4px}.collector-stage{position:relative;min-height:480px;background:#fff;border:1px solid var(--el-border-color);border-radius:8px;overflow:hidden}.collector-frame{display:block;width:100%;height:max(560px,calc(100vh - 240px));border:0;background:#fff}.collector-placeholder{min-height:480px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;color:var(--el-text-color-secondary);box-sizing:border-box}.collector-placeholder strong{font-size:14px;color:var(--el-text-color-regular)}.collector-placeholder p{font-size:13px;line-height:1.6;margin:0}@media(max-width:640px){.collector-toolbar{align-items:flex-start}.collector-actions{width:100%}.collector-frame{height:max(500px,calc(100dvh - 220px))}}
</style>
