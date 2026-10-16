import { decodeAiResourceConfig, isAiProjectId, isAiReferencePath } from './ai-resource-read'
import type { AiResourceConfig } from './ai-resource-read'

/** Original icon-resource-config.ts ResourceSnapshot. This is a server claim,
 * not a browser revalidation of the on-disk capsule or current project config. */
export type AiJobResourceSnapshot = { state: 'unavailable' } | {
  state: 'sealed'; version: number; hash: string; presetId: string; config: AiResourceConfig
  referenceSnapshots?: Array<{ relativePath: string; sha256: string }>
}
const sha = /^[a-f0-9]{64}$/
const invalid = () => new Error('Invalid sealed resource snapshot')
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
export function decodeAiJobResourceSnapshot(value: unknown, projectId: string): AiJobResourceSnapshot {
  const raw = record(value)
  if (!isAiProjectId(projectId)) throw invalid()
  if (raw.state === 'unavailable') return { state: 'unavailable' }
  if (raw.state !== 'sealed' || !Number.isSafeInteger(raw.version) || (raw.version as number) < 1
    || typeof raw.hash !== 'string' || !sha.test(raw.hash) || typeof raw.presetId !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(raw.presetId)) throw invalid()
  const config = decodeAiResourceConfig(raw.config, projectId)
  if (config.version !== raw.version || (config.schemaVersion === 'project-resource-config-v2'
    ? raw.presetId !== 'default' : !config.iconPresets.some(preset => preset.id === raw.presetId))) throw invalid()
  let referenceSnapshots: Array<{ relativePath: string; sha256: string }> | undefined
  if (raw.referenceSnapshots !== undefined) {
    if (!Array.isArray(raw.referenceSnapshots) || raw.referenceSnapshots.length > 4) throw invalid()
    referenceSnapshots = raw.referenceSnapshots.map(value => {
      const ref = record(value)
      if (!isAiReferencePath(ref.relativePath) || typeof ref.sha256 !== 'string' || !sha.test(ref.sha256)) throw invalid()
      return { relativePath: ref.relativePath, sha256: ref.sha256 }
    })
    if (referenceSnapshots.length !== config.style.references.length
      || referenceSnapshots.some((ref, index) => ref.relativePath !== config.style.references[index])) throw invalid()
  }
  // v2 references must have evidence in the sealed snapshot, not current files.
  if (config.schemaVersion === 'project-resource-config-v2' && config.style.references.length && !referenceSnapshots) throw invalid()
  return { state: 'sealed', version: raw.version as number, hash: raw.hash, presetId: raw.presetId, config,
    ...(referenceSnapshots ? { referenceSnapshots } : {}) }
}
