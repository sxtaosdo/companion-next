import { shallowRef } from 'vue'
import type { ArtAuthority, ProjectArtSpec } from './domain/project-art-spec'
export interface ProjectArtSpecContext { projectId: string; projectPath: string; source: object }
export interface ProjectArtSaveInput { operationId: string; config: ProjectArtSpec; expectedHash: string | null; approved: true; migrateLegacy?: true }
export interface ProjectArtOperation { schemaVersion: 'project-art-write-v1'; projectId: string; projectPath: string; operationId: string; bindingHash: string; state: 'pending' | 'completed' | 'rejected'; receipt?: ProjectArtSpecReceipt }
export interface ProjectArtSpecReceipt { projectId: string; projectPath: string; config: unknown | null; hash: string | null; authorities: readonly ArtAuthority[]; generationCapabilities?: { imageReferenceInput: false; categories: readonly ['icon'] }; operation?: { operationId: string; bindingHash: string; state: 'completed' } }
export interface ProjectArtSpecProvider {
  readonly label: string
  readonly endpoint: string
  waitForIdle?(): Promise<void>
  read(context: ProjectArtSpecContext, signal: AbortSignal): Promise<ProjectArtSpecReceipt>
  status(context: ProjectArtSpecContext, operationId: string, signal: AbortSignal): Promise<ProjectArtOperation>
  save(context: ProjectArtSpecContext, input: ProjectArtSaveInput, signal: AbortSignal): Promise<ProjectArtSpecReceipt>
}
/** No transport is registered until the host implements the new single-file contract. */
export const projectArtSpecProvider = shallowRef<ProjectArtSpecProvider | null>(null)
export function registerProjectArtSpecProvider(provider: ProjectArtSpecProvider | null) { projectArtSpecProvider.value = provider }
export class ProjectArtSpecWriteError extends Error {
  constructor(readonly outcome: 'not-sent' | 'rejected' | 'conflict' | 'unknown') { super('Project art configuration write not confirmed') }
}
