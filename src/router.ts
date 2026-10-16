import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import AiResourceReadView from './views/AiResourceReadView.vue'
import KnowledgeReadView from './views/KnowledgeReadView.vue'
import CompanionBrowserView from './views/CompanionBrowserView.vue'
import OverviewView from './views/OverviewView.vue'
import ResourcesView from './views/ResourcesView.vue'
import ServicesView from './views/ServicesView.vue'
import HistoryView from './views/HistoryView.vue'
import ImageAssetsView from './views/ImageAssetsView.vue'
import HelpView from './views/HelpView.vue'
import AboutView from './views/AboutView.vue'
import ChangelogView from './views/ChangelogView.vue'
import MigrationView from './views/MigrationView.vue'
export const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/overview' },
  { path: '/projects', component: CompanionBrowserView, meta: { title: '工程、日志与调用', description: '读取原 Companion 真实记录；管理写操作继续逐项迁移。', workspaceIndependent: true } },
  { path: '/ai-icons', component: AiResourceReadView, meta: { title: 'AI 图标', description: '工程规范、单图任务、候选审阅与导入交付。', workspaceIndependent: true } },
  { path: '/knowledge', component: KnowledgeReadView, meta: { title: '知识库与模型状态', description: '显式查询原服务，保留检索与状态的实际证据。', workspaceIndependent: true } },
  { path: '/overview', component: OverviewView, meta: { title: '项目概览', description: '从规范开始，让每次交付都有据可循。' } },
  { path: '/resources', component: ResourcesView, meta: { title: '游戏资源', description: '一个入口，按步骤做好每一份资源。' } },
  { path: '/image-assets', component: ImageAssetsView, meta: { title: '图片素材', description: '导入候选，在页内审阅并核对真实保存结果。' } },
  { path: '/services', component: ServicesView, meta: { title: '服务状态', description: '明确连接边界，保留真实读取证据。' } },
  { path: '/history', component: HistoryView, meta: { title: '版本与边界', description: '让已知基线、当前能力和待验证事项保持清晰。' } },
  { path: '/help', component: HelpView, meta: { title: '帮助', description: '找到用法、原有功能和当前实际边界。', workspaceIndependent: true } },
  { path: '/about', component: AboutView, meta: { title: '关于', description: '区分前端、旧版参考与真实服务版本。', workspaceIndependent: true } },
  { path: '/changelog', component: ChangelogView, meta: { title: '更新记录', description: '本前端改动与旧版发布记录分别留证。', workspaceIndependent: true } },
  { path: '/migration', component: MigrationView, meta: { title: '旧功能保留', description: '保留旧能力，逐项核对迁移完成情况。', workspaceIndependent: true } },
  { path: '/:pathMatch(.*)*', redirect: '/overview' },
]
export const router = createRouter({ history: createWebHashHistory(), routes })
