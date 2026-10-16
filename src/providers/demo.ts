import type { ReadOnlyCompanionProvider, WorkspaceSnapshot, ResourceItem } from '../domain/contracts'
import { createDefaultSpec } from '../domain/spec'
const resources: ResourceItem[] = [
  { id: 'soul-stone', name: '灵魂石图标', category: '图标', purpose: '商店 / 货币入口', width: 256, height: 256, state: 'planned', illustration: 'gem', note: '统一视觉占比；主体居中，动态文字不烘焙。' },
  { id: 'gold-coin', name: '金币图标', category: '图标', purpose: '通用货币 / 顶栏', width: 128, height: 128, state: 'approved', illustration: 'coin', note: '示例批准记录；不代表任何实际资产已通过。' },
  { id: 'rare-weapon', name: '稀有武器图标', category: '图标', purpose: '背包 / 装备列表', width: 256, height: 256, state: 'rework', illustration: 'sword', note: '轮廓过细，小尺寸难辨；增加主体厚度，保留边缘高光。' },
  { id: 'primary-button', name: '主按钮底图', category: '按钮', purpose: '公共组件 / 五态按钮', width: 320, height: 112, state: 'owner-protected', illustration: 'button', note: 'Owner 资产保护，禁止自动覆盖。' },
  { id: 'reward-panel', name: '奖励弹窗底板', category: '面板', purpose: '奖励结算 / Modal', width: 720, height: 880, state: 'candidate', illustration: 'panel', note: '九切片边界待人工确认。' },
].map((r) => ({ ...r, projectId: 'demo-1060', format: '透明 PNG', specVersion: 'art-ui v1.3', ownerProtected: r.state === 'owner-protected', technical: 'not-checked', visual: 'not-checked', imported: 'not-checked', bound: 'not-checked', runtime: 'not-checked' })) as ResourceItem[]
export function createDemoSnapshot(): WorkspaceSnapshot {
  return {
    resourceCoverage: 'complete',
    projects: [
      { id: 'demo-1060', name: 'P1060 · 暗黑', subtitle: '暗黑文字挂机 · 示例项目', styleApproval: 'pending', protectedAssets: 1, spec: { ...createDefaultSpec(), version: 'art-ui v1.3', styleName: '暗黑母版', styleKeywords: '暗黑 / 金属 / 冷光' } },
      { id: 'demo-4060', name: 'P4060 · 蚂蚁', subtitle: '蚂蚁题材卡通 · 示例项目', styleApproval: 'unknown', protectedAssets: null, spec: { ...createDefaultSpec(), version: 'art-ui v0.1', width: 750, height: 1334, styleName: '卡通母版', styleKeywords: '自然 / 轻快 / 清晰轮廓' } },
    ],
    resources,
    services: [
      { id: 'companion', name: 'Companion', role: '项目与规范', state: 'unknown', detail: '示例模式未探测服务' },
      { id: 'comfyui', name: 'ComfyUI', role: '本地素材生成', state: 'unknown', detail: '未连接真实生成环境' },
      { id: 'cocos', name: 'Cocos Creator', role: '导入、绑定与运行', state: 'unknown', detail: '未执行引擎连接或运行验收' },
    ],
    source: { label: '内置示例资料', limitations: ['全部项目、资源、状态及插画均为示例。', '未读取 Windows、ComfyUI 或 Cocos；无生成、导入、绑定或运行证据。', '已核历史参考为 v133，当前旧版完整功能待核，不代表迁移完成。'] },
  }
}
export const demoProvider: ReadOnlyCompanionProvider = {
  mode: 'demo', label: '内置示例资料',
  async loadSnapshot(signal) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    return createDemoSnapshot()
  },
}
