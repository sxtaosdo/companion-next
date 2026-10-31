/** Read-only boundary. This contract has deliberately no mutation methods. */
export type DataMode = 'disconnected' | 'demo' | 'live'
export type ConnectionState = 'disconnected' | 'loading' | 'connected' | 'error'
export type ServiceState = 'unknown' | 'available' | 'unavailable' | 'degraded'
export type ResourceCategory = '图标' | '按钮' | '面板' | '角色' | '背景' | '特效' | '字体'
export type ResourceState = 'planned' | 'candidate' | 'approved' | 'rework' | 'owner-protected'
export type EvidenceState = 'not-checked' | 'passed' | 'failed'
export interface ProjectSpec {
  schemaVersion: 1
  version: string
  width: number
  height: number
  safeHorizontal: number
  safeVertical: number
  spacing: string
  styleName: string
  styleKeywords: string
  fontFamily: string
  bodySize: number
  headingSize: number
  buttonHeight: number
  buttonStates: string
  overlayPolicy: string
  pivot: string
  bundle: string
  panelPolicy: string
  sizePolicy: 'single-master'
}
export interface Project {
  lastOpenedAt?: number
  id: string
  name: string
  subtitle?: string
  engineVersion?: string
  spec?: ProjectSpec
  styleApproval: 'unknown' | 'pending' | 'approved'
  protectedAssets: number | null
}
export interface ResourceItem {
  id: string
  projectId: string
  name: string
  category: ResourceCategory
  purpose: string
  width: number
  height: number
  format: string
  state: ResourceState
  ownerProtected: boolean
  illustration: 'gem' | 'coin' | 'sword' | 'button' | 'panel' | 'none'
  specVersion?: string
  technical: EvidenceState
  visual: EvidenceState
  imported: EvidenceState
  bound: EvidenceState
  runtime: EvidenceState
  note?: string
}
export interface ServiceStatus {
  id: string
  name: string
  role: string
  state: ServiceState
  detail: string
  version?: string
  checkedAt?: string
}
export interface SourceInfo {
  label: string
  /** Must be supplied by an actual read; never substitute a fixture timestamp. */
  observedAt?: string
  /** Optional confirmed source revision, never inferred from UI build version. */
  revision?: string
  limitations: string[]
}
export interface WorkspaceSnapshot {
  /** Missing means unknown. Empty resources never implies a complete inventory. */
  resourceCoverage?: 'not-read' | 'partial' | 'complete'
  projects: Project[]
  resources: ResourceItem[]
  services: ServiceStatus[]
  source: SourceInfo
}
export interface ReadOnlyCompanionProvider {
  readonly mode: 'demo' | 'live'
  readonly label: string
  loadSnapshot(signal?: AbortSignal): Promise<WorkspaceSnapshot>
}
export interface LocalSpecDraft {
  schemaVersion: 1
  projectId: string
  mode: 'demo' | 'live'
  savedAt: string
  revision: string
  spec: ProjectSpec
}
export const emptySnapshot = (): WorkspaceSnapshot => ({
  projects: [], resources: [], services: [],
  source: { label: '未连接数据源', limitations: ['尚未读取任何真实项目或服务状态。'] },
})
