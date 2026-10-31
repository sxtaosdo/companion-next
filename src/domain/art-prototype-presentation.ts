import type { InjectionKey } from 'vue'
/** Presentation only. The current stores retain all authority and mutation. */
export interface ArtOverviewNavigation {
  openSpecs(): void
  openReferences(): void
  references(): readonly ArtOverviewReference[]
  canReferences(): boolean
  busy?(): boolean
}
export const ART_OVERVIEW_NAVIGATION: InjectionKey<ArtOverviewNavigation> = Symbol('art-overview-navigation')
export const ART_APPROVED_TASK_STAGES = Object.freeze(['项目规范', '资源规划', '生成素材', '视觉审阅', '导入绑定', '运行验收'] as const)
export interface ArtImpactNeed { readonly id: string; readonly specId: string; readonly jobId?: string }
export function artSpecImpact(specId: string | null, needs: readonly ArtImpactNeed[]) {
  const linked = specId ? needs.filter(need => need.specId === specId) : []
  const bound = linked.filter(need => !!need.jobId).length
  return Object.freeze({ total: linked.length, bound, unbound: linked.length - bound })
}
export interface ArtOverviewReference { readonly key: string; readonly name: string; readonly verifiedPreview?: string }
export interface ArtOverviewData {
  readonly projectName: string; readonly version: number; readonly content: string
  readonly visualMode: '2d' | '3d' | undefined; readonly width: number; readonly height: number
  /** Already resolved/displayed by the existing normative store, never inferred by this component. */
  readonly style: string; readonly inheritance: string; readonly sources: readonly { readonly path: string; readonly revision: string }[]
  readonly destination: string | null; readonly exportDirectory: string | null
  readonly transparentPng: boolean | null; readonly references: readonly ArtOverviewReference[]
}
export interface ArtBatchDisplayItem {
  readonly id: string; readonly name: string; readonly specName: string; readonly specVersion: number
  readonly width: number; readonly height: number
  /** Caller derives this from its current provider/store, not a visual status string. */
  readonly executable: boolean; readonly reason?: string
}
export function artBatchDisplayKey(planKey: string, mode: 'produce' | 'retry', items: readonly ArtBatchDisplayItem[]) {
  return JSON.stringify([planKey, mode, items.map(item => [item.id, item.name, item.specName, item.specVersion, item.width, item.height, item.executable, item.reason ?? null])])
}
export function currentArtTaskStep(step: number, reached: number) {
  if (!Number.isSafeInteger(step) || !Number.isSafeInteger(reached) || step < 0 || reached < 0 || step > reached || reached >= ART_APPROVED_TASK_STAGES.length) return null
  return ART_APPROVED_TASK_STAGES[step]
}
