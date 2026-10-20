<script setup lang="ts">
import { ArrowRight, FolderOpened } from '@element-plus/icons-vue'
import { useRegisteredProjectStore } from '../stores/registered-project'
import ProjectStatusTag from './ProjectStatusTag.vue'
const selection = useRegisteredProjectStore()
function selectProject(event: MouseEvent, id: string, navigate: (event?: MouseEvent) => unknown) {
  if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
  selection.restoreRouteProject(id)
  void navigate(event)
}
</script>
<template>
  <section class="registered-overview">
    <div class="section-heading"><h2>已登记工程</h2><span>{{ selection.currentSource ? `${selection.projects.length} 个工程` : '工程数量未读取' }}</span></div>
    <div class="registered-project-grid">
      <RouterLink v-for="project in selection.projects" :key="project.id" :to="{ path: '/overview', query: { project: project.id } }" custom v-slot="{ href, navigate }"><a :href="href" class="registered-project-card panel" :class="{ selected: selection.project?.id === project.id }" :aria-current="selection.project?.id === project.id ? 'true' : undefined" :data-project-id="project.id" @click="selectProject($event, project.id, navigate)">
        <div class="registered-project-heading"><el-icon><FolderOpened/></el-icon><h3>{{ project.name }}</h3><el-icon class="project-open-arrow"><ArrowRight/></el-icon></div>
        <p>{{ project.path }}</p><span class="registered-project-id">{{ project.id }}</span>
      </a></RouterLink>
    </div>
    <el-empty v-if="!selection.projects.length" :description="selection.directory.projectLoading ? '正在读取登记工程' : selection.currentSource ? '尚无已登记工程' : '连接工程服务后显示已登记工程'" :image-size="90"/>
    <p v-if="selection.requestedId && !selection.project && !selection.directory.projectLoading" class="selection-unavailable" role="status">所选工程尚未读取、已被移除或登记来源已改变，请重新选择工程。</p>
    <section v-if="selection.project" class="panel registered-project-detail" data-testid="registered-project-overview">
      <div class="section-heading"><div><h2>当前工程：{{ selection.project.name }}</h2></div><RouterLink :to="{ path: '/resources', query: { project: selection.project.id } }" class="hero-link">进入游戏资源<el-icon><ArrowRight/></el-icon></RouterLink></div>
      <dl><dt>运行状态</dt><dd><ProjectStatusTag :status="selection.status ?? undefined" :passive="selection.currentSource?.runtimeProbesEnabled === false"/></dd><dt>要求 Creator 版本</dt><dd>{{ selection.project.requiredCreatorVersion || '未返回' }}</dd><dt>当前 Creator 版本</dt><dd>{{ selection.status?.creatorVersion || '未返回' }}</dd></dl>
      <RouterLink :to="{ path: '/resources', query: { project: selection.project.id, step: 1 } }">查看工程规范</RouterLink>
    </section>
  </section>
</template>
<style scoped>
.registered-overview { display: grid; gap: 12px; }
.registered-overview > .section-heading { margin: 0; }
.registered-project-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,300px),1fr)); gap: 10px; }
.registered-project-card { display: block; color: inherit; text-decoration: none; padding: 12px 14px; border: 1px solid var(--border,#e4e8ee); transition: background .15s,border-color .15s; }
.registered-project-card:hover,.registered-project-card.selected { border-color: #8e79ca; background: #faf8ff; }
.registered-project-card:focus-visible { outline: 3px solid #8e79ca; outline-offset: 3px; }
.registered-project-heading { display: flex; align-items: center; gap: 8px; }
.registered-project-heading h3 { margin: 0; font-size: 14px; line-height: 20px; overflow-wrap: anywhere; }
.project-open-arrow { margin-left: auto; flex-shrink: 0; }
.registered-project-card p,.registered-project-id { color: var(--text-secondary,#637187); overflow-wrap: anywhere; font-size: 12px; line-height: 18px; }
.registered-project-card p { margin-top: 5px; }
.registered-project-id { font-size: 11px; }
.registered-project-detail { padding: 14px; }
.registered-project-detail .section-heading { margin: 0; }
.registered-project-detail h2 { font-size: 15px; }
.registered-project-detail .hero-link { margin: 0; }
.registered-project-detail dl { display: flex; flex-wrap: wrap; gap: 6px 12px; margin: 12px 0; font-size: 12px; }
.registered-project-detail dt,.selection-unavailable { color: var(--text-secondary,#637187); }
.registered-project-detail dd { margin: 0 12px 0 0; overflow-wrap: anywhere; }
.registered-project-detail > a { font-size: 12px; }
@media(max-width:600px) { .registered-project-detail dl { display: grid; grid-template-columns: auto minmax(0,1fr); } .registered-project-detail .section-heading { align-items: start; flex-direction: column; gap: 8px; } }
</style>
