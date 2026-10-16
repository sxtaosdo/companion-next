import type { ImageSearchRequest, ReviewCooldown, ReviewSource, ReviewTaskHistory, ReviewTaskMetadata } from './image-review-workflow'
import type { PickerImport } from './picker-import'
/** Normalized UI contract. The host adapter must validate its actual service response. */
export interface ReviewImage {
  id: string
  status: string
  selected: boolean
  width: number | null
  height: number | null
  contentType: string | null
  title: string
  imageUrl?: string
  sourcePage?: string
  sourceWebsite?: string
  creator?: string
  license?: string
  licenseVersion?: string
  licenseUrl?: string
  sourceLabel?: string
  candidateKind?: string
  discoveryMethod?: string
  error?: string
  bytes?: number | null
  cooldownKey?: string
  nextAllowedAt?: number
  manualHold?: boolean
}
export interface ImageReviewSnapshot {
  taskId: string | null
  busy: boolean
  cache?: string
  items: ReviewImage[]
  task?: ReviewTaskMetadata | null
  sources?: ReviewSource[]
  history?: ReviewTaskHistory[]
  cooldowns?: ReviewCooldown[]
}
export interface ImageSaveReceipt {
  cancelled: boolean
  directory?: string
  results: Array<{ id: string; filename?: string; ok: boolean; error?: string }>
}
/** No arbitrary URL/path input, token storage, remote image fetch or permanent deletion. */
export interface ImageReviewProvider {
  readonly label: string
  /** Only a host with atomic expected-task/selection protection may enable directory saving. */
  readonly saveSelectionGuard: 'verified' | 'unverified'
  readonly workflowGuard?: 'verified' | 'unverified'
  readonly selectionGuard?: 'verified' | 'unverified'
  persistSelection?(expectedTaskId: string, selectedIds: string[]): Promise<void>
  searchImages?(expectedTaskId: string | null, input: ImageSearchRequest): Promise<void>
  switchTask?(expectedTaskId: string | null, taskId: string): Promise<void>
  retryImage?(expectedTaskId: string, id: string): Promise<void>
  requestStop?(expectedTaskId: string): Promise<void>
  recycleUnselected?(expectedTaskId: string, selectedIds: string[]): Promise<void>
  restoreImages?(expectedTaskId: string): Promise<void>
  resetSession?(): void
  loadState(signal?: AbortSignal): Promise<ImageReviewSnapshot>
  importCandidates(manifest: PickerImport, signal?: AbortSignal): Promise<void>
  loadPreview(id: string, variant: 'thumb' | 'full', signal?: AbortSignal): Promise<{ kind: 'same-origin-image'; path: string }>
  saveSelected(expected: { taskId: string; ids: string[] }): Promise<ImageSaveReceipt>
}

/** Server-confirmed rejection before mutation side effects, unlike network loss or HTTP 500. */
export class ImageReviewRejection extends Error {
  constructor(readonly status: 400 | 403 | 409) { super(`审阅服务拒绝请求（HTTP ${status}），本次请求在副作用前被拒绝`); this.name='ImageReviewRejection' }
}
