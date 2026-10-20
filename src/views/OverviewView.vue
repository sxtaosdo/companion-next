<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Files, Picture, Lock, Connection } from '@element-plus/icons-vue'
import { useWorkspaceStore } from '../stores/workspace'
import RegisteredProjectOverview from '../components/RegisteredProjectOverview.vue'
import { useOverviewProjectLive } from '../composables/use-overview-project-live'
import { useRegisteredProjectPage } from '../composables/use-registered-project-page'
import { allowsLegacyWorkspace } from '../domain/project-workspace'
import { companionBrowserProvider } from '../companion-browser-integration'
import EmptyState from '../components/EmptyState.vue'
import SpecSummary from '../components/SpecSummary.vue'
import SpecDialog from '../components/SpecDialog.vue'
const store = useWorkspaceStore()
useRegisteredProjectPage()
useOverviewProjectLive()
const legacyWorkspace = computed(() => allowsLegacyWorkspace(import.meta.env.MODE, Boolean(companionBrowserProvider.value)) && store.mode !== 'disconnected')
const editOpen = ref(false)
const counts = computed(() => [{ title: '清单资源', value: store.resourceInventoryKnown ? store.resources.length : '—', unit: '项', hint: store.resourceInventoryKnown ? '当前项目已登记' : '真实资源清单尚未读取', icon: Files, color: 'purple' }, { title: '待视觉审阅', value: store.resourceInventoryKnown ? store.resources.filter((r) => r.state === 'candidate').length : '—', unit: '项', hint: '技术检查不代替人工批准', icon: Picture, color: 'blue' }, { title: 'Owner 保护', value: store.project?.protectedAssets ?? '—', unit: '项', hint: '保留已有资产与手工修改', icon: Lock, color: 'amber' }, { title: '运行验收', value: store.resourceInventoryKnown ? store.resources.filter((r) => r.runtime === 'passed').length : '—', unit: '项', hint: '仅计算真实运行证据', icon: Connection, color: 'teal' }])
const steps = ['建立项目规范', '梳理资源清单', '生成候选素材', '人工视觉审阅', '导入并绑定', '运行验收留证']
</script>
<template>
  <RegisteredProjectOverview v-if="!legacyWorkspace"/>
  <EmptyState v-else-if="!store.project"/>
  <template v-else>
    <section class="overview-hero panel"><div><span class="section-kicker">CURRENT PROJECT <span v-if="store.isDemo">/ 示例</span></span><h2>{{ store.project.name }}</h2><p>{{ store.project.subtitle || '项目详情由只读数据源提供' }}</p><RouterLink to="/resources" class="hero-link">进入资源工作台<el-icon><ArrowRight/></el-icon></RouterLink></div><div class="hero-art" aria-hidden="true"><div class="hero-grid"></div><div class="hero-tile tile-back"></div><div class="hero-tile tile-front"><svg viewBox="0 0 90 90"><path d="m45 11 25 15 6 31-31 23-30-23 6-31z" fill="#9188ce" stroke="#d7d3ef" stroke-width="1.5"/><path d="m45 11 1 31 24-16M21 26l25 16 30 15M15 57l31-15-1 38" fill="none" stroke="#e3defb"/></svg></div><span class="hero-art-label">ONE PROJECT. ONE SOURCE.</span></div></section>
    <div class="metrics-grid"><section v-for="item in counts" :key="item.title" class="metric-card panel"><div class="metric-title">{{ item.title }}<span class="metric-icon" :class="item.color"><el-icon><component :is="item.icon"/></el-icon></span></div><div class="metric-value">{{ item.value }}<span>{{ item.unit }}</span><el-tag v-if="store.isDemo" size="small" type="info">示例</el-tag></div><p>{{ item.hint }}</p></section></div>
    <div class="section-heading"><h2>项目规范</h2><span>统一入口 · 每个项目独立配置</span></div><SpecSummary @edit="editOpen = true"/>
    <div class="overview-bottom"><section class="panel workflow-panel"><div class="section-heading"><h2>资源生产路径</h2><el-tag type="info" size="small">六步闭环</el-tag></div><div class="workflow-grid"><RouterLink v-for="(step,index) in steps" :key="step" :to="{ path: '/resources', query: { step: index + 1 } }"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ step }}</strong><el-icon><ArrowRight/></el-icon></RouterLink></div><p class="subtle-note">每一步独立留证。导入成功，不等于绑定完成或运行通过。</p></section><section class="panel scope-panel"><span class="section-kicker">PILOT BOUNDARY</span><h2>先做清楚，再接真实工程</h2><ul><li>项目 / 服务状态只读展示</li><li>规范新建与编辑共用弹窗</li><li>默认每资源一个尺寸</li><li>生成、批准、导入与运行暂未接通</li></ul><RouterLink to="/history">查看版本与范围<el-icon><ArrowRight/></el-icon></RouterLink></section></div>
    <SpecDialog v-model="editOpen"/>
  </template>
</template>
