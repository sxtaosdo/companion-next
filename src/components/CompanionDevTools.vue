<!--
Adapted from Cool-admin Vue 8.x dev-tools/components/index.vue and doc.vue:
https://github.com/cool-team-official/cool-admin-vue/tree/8.x/src/plugins/dev-tools/components
MIT copyright 2025 厦门闪酷科技有限公司; license retained in src/login/COOL-ADMIN-LICENSE.txt.
Only the documentation panel is connected. No upstream account/token, proxy, EPS or dictionary integration.
-->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowDown, Reading, Document } from '@element-plus/icons-vue'
const route = useRoute()
const visible = ref(false)
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const helpLocation = computed(() => ({ path: '/help', query: typeof route.query.project === 'string' ? { project: route.query.project } : {} }))
const documents = [
  { name: 'Vue', href: 'https://cn.vuejs.org/' },
  { name: 'Vue Router', href: 'https://router.vuejs.org/zh/' },
  { name: 'Pinia', href: 'https://pinia.vuejs.org/' },
  { name: 'Vite', href: 'https://vite.dev/' },
  { name: 'Element Plus', href: 'https://element-plus.org/zh-CN/component/overview.html' },
]
async function toggle() {
  if (visible.value) { close(); return }
  visible.value = true
  await nextTick()
  panel.value?.querySelector<HTMLElement>('a')?.focus()
}
function close(restoreFocus = true) {
  visible.value = false
  if (restoreFocus) trigger.value?.focus()
}
function onKeydown(event: KeyboardEvent) {
  if (visible.value && event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    close()
  }
}
watch(() => route.fullPath, () => close(false))
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <section v-if="visible" id="companion-dev-tools-panel" ref="panel" class="companion-dev-tools" role="dialog" aria-label="开发工具：文档" aria-modal="false">
      <div class="companion-dev-tools__content">
        <h2>文档</h2>
        <div class="companion-dev-tools__documents">
          <RouterLink :to="helpLocation" class="companion-dev-tools__document" @click="close(false)"><Document aria-hidden="true" /><span>Companion 帮助</span></RouterLink>
          <a v-for="item in documents" :key="item.href" :href="item.href" target="_blank" rel="noopener noreferrer" class="companion-dev-tools__document"><Reading aria-hidden="true" /><span>{{ item.name }}</span></a>
        </div>
      </div>
      <nav class="companion-dev-tools__menu" aria-label="开发工具分类">
        <span class="companion-dev-tools__brand" aria-hidden="true">C</span>
        <button type="button" class="companion-dev-tools__menu-item is-active" aria-label="文档" aria-current="page" title="文档"><Reading aria-hidden="true" /></button>
      </nav>
    </section>
    <button ref="trigger" type="button" class="companion-dev-tools__toggle" :class="{ 'is-open': visible }" :aria-expanded="visible" aria-controls="companion-dev-tools-panel" :aria-label="visible ? '关闭开发工具' : '打开开发工具'" :title="visible ? '关闭开发工具' : '开发工具'" @click="toggle"><ArrowDown aria-hidden="true" /></button>
  </Teleport>
</template>

<style scoped>
/* Preserve the upstream floating panel, right-hand menu and documentation tiles. */
.companion-dev-tools { position:fixed; bottom:62px; right:20px; width:600px; max-width:calc(100vw - 40px); height:360px; max-height:calc(100dvh - 100px); display:flex; z-index:1900; color:var(--el-text-color-primary); background:var(--el-bg-color); border:1px solid var(--el-border-color-light); border-radius:12px; box-shadow:var(--el-box-shadow-light); overflow:hidden; }
.companion-dev-tools__content { flex:1; min-width:0; padding:14px; overflow:auto; }
.companion-dev-tools__content h2 { font-size:14px; line-height:20px; margin:0 0 12px; }
.companion-dev-tools__documents { display:flex; flex-wrap:wrap; gap:6px; }
.companion-dev-tools__document { display:inline-flex; flex-direction:column; align-items:center; justify-content:center; box-sizing:border-box; min-height:78px; padding:10px 18px; border-radius:8px; background:var(--el-fill-color-light); color:var(--el-text-color-primary); text-decoration:none; font-size:12px; gap:5px; }
.companion-dev-tools__document:hover { background:var(--el-fill-color-dark); }
.companion-dev-tools__document svg { width:28px; height:28px; color:var(--el-color-primary); }
.companion-dev-tools__menu { flex:0 0 50px; box-sizing:border-box; border-left:1px solid var(--el-border-color-extra-light); padding:8px; }
.companion-dev-tools__brand,.companion-dev-tools__menu-item { display:flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:8px; }
.companion-dev-tools__brand { background:#2c3142; color:#fff; font-weight:700; margin-bottom:8px; }
.companion-dev-tools__menu-item { padding:7px; border:0; background:var(--el-fill-color-light); color:var(--el-color-primary); cursor:pointer; }
.companion-dev-tools__menu-item svg { width:20px; height:20px; }
.companion-dev-tools__toggle { position:fixed; right:20px; bottom:max(20px,env(safe-area-inset-bottom)); z-index:1901; width:32px; height:32px; border:0; border-radius:20px; display:flex; align-items:center; justify-content:center; background:#2c3142; color:#fff; cursor:pointer; padding:8px; }
.companion-dev-tools__toggle svg { width:16px; height:16px; transform:rotate(135deg); }
.companion-dev-tools__toggle.is-open svg { transform:rotate(-45deg); }
.companion-dev-tools a:focus-visible,.companion-dev-tools button:focus-visible,.companion-dev-tools__toggle:focus-visible { outline:2px solid var(--el-color-primary); outline-offset:2px; }
@media (max-width:600px) { .companion-dev-tools { right:10px; max-width:calc(100vw - 20px); height:320px; } .companion-dev-tools__document { padding:10px 12px; } }
</style>
