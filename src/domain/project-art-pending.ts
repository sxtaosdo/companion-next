import {resourceDomainSuffix} from './art-resource-domains'
import { ref } from 'vue'
import { parseProjectArtSpec } from './project-art-spec'
import type { ProjectArtSaveInput, ProjectArtSpecContext, ProjectArtSpecProvider } from '../project-art-spec-integration'
export const artPendingRevision = ref(0)
export function artCanonical(value: unknown): string { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(artCanonical).join(',') + ']'; return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + artCanonical((value as Record<string, unknown>)[key])).join(',') + '}' }
export function artPath(path: string) { return path.replace(/\\/g, '/').replace(/\/$/, '') }
export function artEndpoint(provider: ProjectArtSpecProvider) { const url = new URL(provider.endpoint); if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw Error('invalid endpoint'); return url.origin }
export interface PendingArtWrite { schemaVersion: 'art-browser-pending-v1'; endpoint: string; projectId: string; projectPath: string; resourceDomainId?:string; input: ProjectArtSaveInput; bindingHash: string; baseVersion: number }
function key(context: ProjectArtSpecContext, provider: ProjectArtSpecProvider) { return 'project-art-pending-v1:' + encodeURIComponent(artEndpoint(provider)) + ':' + context.projectId + ':' + encodeURIComponent(artPath(context.projectPath))+resourceDomainSuffix(context.resourceDomainId) }
function storage() { return window.localStorage }
export function pendingArtWrite(context: ProjectArtSpecContext, provider: ProjectArtSpecProvider): PendingArtWrite | null {
  const text = storage().getItem(key(context, provider)); if (!text) return null
  if (text.length > 512 * 1024) throw Error('invalid pending record')
  const record = JSON.parse(text) as PendingArtWrite
  if (record.schemaVersion !== 'art-browser-pending-v1' || record.endpoint !== artEndpoint(provider) || record.projectId !== context.projectId || record.resourceDomainId!==context.resourceDomainId || artPath(record.projectPath) !== artPath(context.projectPath) || !/^art-save-[a-f0-9]{32}$/.test(record.input.operationId) || !/^[a-f0-9]{64}$/.test(record.bindingHash) || !Number.isSafeInteger(record.baseVersion) || record.baseVersion < 0 || record.input.approved !== true || record.input.migrateLegacy !== undefined && record.input.migrateLegacy !== true || record.input.expectedHash !== null && !/^[a-f0-9]{64}$/.test(record.input.expectedHash)) throw Error('invalid pending record')
  if(record.input.config.resourceDomainId!==context.resourceDomainId||record.input.resourceDomainId!==context.resourceDomainId)throw Error('资源域保存恢复不匹配');if (parseProjectArtSpec(record.input.config, context.projectId).kind !== 'project') throw Error('invalid pending config')
  return record
}
export async function artBindingHash(projectId: string, projectPath: string, input: ProjectArtSaveInput) {
  const bytes = new TextEncoder().encode(artCanonical({ projectId, projectPath, input }))
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
}
export async function freezeArtWrite(context: ProjectArtSpecContext, provider: ProjectArtSpecProvider, config: ProjectArtSaveInput['config'], expectedHash: string | null, baseVersion: number, migrateLegacy = false): Promise<PendingArtWrite> {
  if (pendingArtWrite(context, provider)) throw Error('existing pending write')
  const input: ProjectArtSaveInput = { operationId: 'art-save-' + crypto.randomUUID().replaceAll('-', ''), config: JSON.parse(JSON.stringify(config)), expectedHash, approved: true, ...(context.resourceDomainId?{resourceDomainId:context.resourceDomainId,expectedProjectSettingsHash:config.projectSettingsHash}:{}), ...(migrateLegacy ? { migrateLegacy: true as const } : {}) }
  const bindingHash = await artBindingHash(context.projectId, context.projectPath, input)
  if (pendingArtWrite(context, provider)) throw Error('concurrent pending write')
  const record: PendingArtWrite = { schemaVersion: 'art-browser-pending-v1', endpoint: artEndpoint(provider), projectId: context.projectId, projectPath: context.projectPath,...(context.resourceDomainId?{resourceDomainId:context.resourceDomainId}:{}), input, bindingHash, baseVersion }
  const serialized = JSON.stringify(record); storage().setItem(key(context, provider), serialized)
  if (storage().getItem(key(context, provider)) !== serialized) throw Error('pending persistence unconfirmed')
  artPendingRevision.value++; return record
}
export function clearPendingArtWrite(context: ProjectArtSpecContext, provider: ProjectArtSpecProvider, expected: PendingArtWrite) {
  const current = pendingArtWrite(context, provider)
  if (!current || current.input.operationId !== expected.input.operationId || current.bindingHash !== expected.bindingHash) throw Error('pending record changed')
  storage().removeItem(key(context, provider)); if (storage().getItem(key(context, provider)) !== null) throw Error('pending removal unconfirmed')
  artPendingRevision.value++
}
