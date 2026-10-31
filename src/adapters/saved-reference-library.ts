import type { WorkbenchContext } from './art-workbench'
import { validResourceDomainId } from '../domain/art-resource-domains'
import { validateWorkbenchDocument, type WorkbenchReceipt, type WorkbenchReference, type WorkbenchReferenceScope } from '../domain/art-workbench'

/** Client projection of an already saved workbench receipt. No HTTP, directory
 * scan, config-path fallback, pending-upload recovery or file-identity claim. */
export interface SavedReferenceLibraryEntry {
  readonly reference: Readonly<WorkbenchReference>
  readonly origins: readonly string[]
}
export interface SavedReferenceLibraryIdentity {
  readonly projectId: string
  readonly projectPath: string
  readonly resourceDomainId?: string
  readonly workbenchHash: string
  /** UI identity only. Do not serialize it or treat it as server authority. */
  readonly source: object
}
export interface SavedReferenceLibrary {
  readonly identity: SavedReferenceLibraryIdentity | null
  readonly entries: readonly SavedReferenceLibraryEntry[]
}
export interface SavedReferenceLibrarySelection {
  readonly schemaVersion: 'saved-reference-library-selection-v1'
  readonly identity: SavedReferenceLibraryIdentity
  readonly listKey: string
  readonly target: Readonly<WorkbenchReferenceScope>
  /** Original metadata from the saved list, never populated from a preview. */
  readonly reference: Readonly<WorkbenchReference>
  /** A client display acknowledgement, not proof of current original-file bytes. */
  readonly preview: { readonly sha256: string; readonly width: number; readonly height: number; readonly displayed: true }
}
export class SavedReferenceLibraryError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'SavedReferenceLibraryError' }
}
const fail = (code = 'SAVED_LIBRARY_INVALID'): never => { throw new SavedReferenceLibraryError(code) }
const sha = /^[a-f0-9]{64}$/, entityId = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  return value as Record<string, unknown>
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return fail()
  return value
}
function domain(value: unknown): string | undefined { if (value === undefined) return undefined; if (!validResourceDomainId(value)) return fail(); return value }
function project(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{16}$/.test(value)) return fail(); return value }
export function copySavedLibraryReference(value: unknown): Readonly<WorkbenchReference> {
  const row = record(value)
  if (Object.keys(row).length !== 3 || typeof row.relativePath !== 'string' || !/^(?:art\/reference|assets)\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp)$/i.test(row.relativePath) || row.relativePath.split('/').some(part => !part || part === '.' || part === '..') || typeof row.sha256 !== 'string' || !sha.test(row.sha256)) return fail()
  return Object.freeze({ name: text(row.name, 240), relativePath: row.relativePath, sha256: row.sha256 })
}
export function copySavedLibraryIdentity(value: unknown): SavedReferenceLibraryIdentity {
  const row = record(value), resourceDomainId = domain(row.resourceDomainId)
  if (!row.source || typeof row.source !== 'object' || typeof row.workbenchHash !== 'string' || !sha.test(row.workbenchHash)) return fail()
  return Object.freeze({ projectId: project(row.projectId), projectPath: text(row.projectPath, 4096), ...(resourceDomainId === undefined ? {} : { resourceDomainId }), workbenchHash: row.workbenchHash, source: row.source })
}
export function savedLibraryEntryKey(reference: WorkbenchReference): string {
  const row = copySavedLibraryReference(reference)
  return JSON.stringify([row.relativePath, row.sha256])
}
export function normalizeSavedLibraryEntries(entries: readonly SavedReferenceLibraryEntry[]): readonly SavedReferenceLibraryEntry[] {
  if (!Array.isArray(entries)) return fail()
  const unique = new Map<string, { reference: Readonly<WorkbenchReference>; origins: string[] }>()
  for (const value of entries) {
    const row = record(value), reference = copySavedLibraryReference(row.reference)
    if (!Array.isArray(row.origins) || !row.origins.length) return fail()
    const origins = row.origins.map(origin => text(origin, 512)), key = savedLibraryEntryKey(reference)
    let entry = unique.get(key)
    if (!entry) { entry = { reference, origins: [] }; unique.set(key, entry) }
    for (const origin of origins) if (!entry.origins.includes(origin)) entry.origins.push(origin)
  }
  return Object.freeze([...unique.values()].map(entry => Object.freeze({ reference: entry.reference, origins: Object.freeze(entry.origins) })))
}
/** Called by Manager using store.base plus the successful receipt hash; never
 * call it with store.draft. The helper itself cannot confer persistence/auth. */
export function projectSavedReferenceLibrary(savedReceipt: WorkbenchReceipt, context: WorkbenchContext): SavedReferenceLibrary {
  if (!context.source || typeof context.source !== 'object' || savedReceipt.projectId !== context.projectId || savedReceipt.projectPath !== context.projectPath || savedReceipt.resourceDomainId !== context.resourceDomainId) return fail('SAVED_LIBRARY_SCOPE_MISMATCH')
  if (savedReceipt.document === null) {
    if (savedReceipt.hash !== null) return fail()
    return Object.freeze({ identity: null, entries: Object.freeze([]) })
  }
  if (!savedReceipt.document || typeof savedReceipt.hash !== 'string' || !sha.test(savedReceipt.hash)) return fail()
  validateWorkbenchDocument(savedReceipt.document, context.projectId, context.projectPath, context.resourceDomainId)
  if (context.resourceDomainId !== undefined && (savedReceipt.binding !== null || savedReceipt.document.projectSettingsHash !== savedReceipt.projectSettingsHash)) return fail('SAVED_LIBRARY_SCOPE_MISMATCH')
  const doc = savedReceipt.document, entries: SavedReferenceLibraryEntry[] = []
  const add = (references: readonly WorkbenchReference[], origin: string) => { for (const reference of references) entries.push({ reference, origins: [origin] }) }
  add(doc.projectReferences, '项目参考')
  for (const spec of doc.specs) add(spec.references, '规格 ' + spec.id + ' · v' + spec.version)
  for (const need of doc.needs) { add(need.references, '需求 ' + need.id + ' · v' + need.version); add(need.spec.references, '需求 ' + need.id + ' 的规格快照 ' + need.specId + ' · v' + need.specVersion) }
  return Object.freeze({ identity: copySavedLibraryIdentity({ projectId: context.projectId, projectPath: context.projectPath, resourceDomainId: context.resourceDomainId, workbenchHash: savedReceipt.hash, source: context.source }), entries: normalizeSavedLibraryEntries(entries) })
}
export function savedReferenceLibraryKey(identity: SavedReferenceLibraryIdentity, entries: readonly SavedReferenceLibraryEntry[]): string {
  const current = copySavedLibraryIdentity(identity), rows = normalizeSavedLibraryEntries(entries)
  // Explicitly excludes the UI source object and its possible internal fields.
  return JSON.stringify([current.projectId, current.projectPath, current.resourceDomainId ?? null, current.workbenchHash, rows.map(row => [row.reference.name, row.reference.relativePath, row.reference.sha256, row.origins])])
}
export function sameSavedLibraryIdentity(left: SavedReferenceLibraryIdentity, right: SavedReferenceLibraryIdentity): boolean {
  const a = copySavedLibraryIdentity(left), b = copySavedLibraryIdentity(right)
  return a.projectId === b.projectId && a.projectPath === b.projectPath && a.resourceDomainId === b.resourceDomainId && a.workbenchHash === b.workbenchHash && a.source === b.source
}
export function copySavedLibraryTarget(value: unknown): Readonly<WorkbenchReferenceScope> {
  const row = record(value), resourceDomainId = domain(row.resourceDomainId), projectId = project(row.projectId)
  if (!['project', 'spec', 'need'].includes(row.scope as string) || typeof row.targetId !== 'string' || !entityId.test(row.targetId) || row.scope === 'project' && row.targetId !== projectId) return fail('SAVED_LIBRARY_TARGET_INVALID')
  return Object.freeze({ projectId, projectPath: text(row.projectPath, 4096), ...(resourceDomainId === undefined ? {} : { resourceDomainId }), scope: row.scope as WorkbenchReferenceScope['scope'], targetId: row.targetId })
}
export function savedLibraryTargetMatches(identity: SavedReferenceLibraryIdentity, target: WorkbenchReferenceScope): boolean {
  const a = copySavedLibraryIdentity(identity), b = copySavedLibraryTarget(target)
  return a.projectId === b.projectId && a.projectPath === b.projectPath && a.resourceDomainId === b.resourceDomainId
}
/** Pure final gate for Manager immediately before a local draft attachment.
 * Manager must derive disabled from current read-only/linked/pending/UNKNOWN
 * and target locks. This never saves, uploads or changes model conditioning. */
export function acceptSavedReferenceLibrarySelection(input: {
  selection: SavedReferenceLibrarySelection; identity: SavedReferenceLibraryIdentity | null; entries: readonly SavedReferenceLibraryEntry[]
  target: WorkbenchReferenceScope | null; existingReferences: readonly WorkbenchReference[]; disabled: boolean; maxReferences?: number
}): Readonly<WorkbenchReference> {
  if (input.disabled !== false || !input.identity || !input.target || (input.maxReferences ?? 4) !== 4) return fail('SAVED_LIBRARY_SELECTION_DISABLED')
  const current = copySavedLibraryIdentity(input.identity), selected = input.selection, target = copySavedLibraryTarget(input.target)
  if (selected.schemaVersion !== 'saved-reference-library-selection-v1' || !sameSavedLibraryIdentity(selected.identity, current) || selected.listKey !== savedReferenceLibraryKey(current, input.entries)) return fail('SAVED_LIBRARY_SELECTION_STALE')
  if (!savedLibraryTargetMatches(current, target) || JSON.stringify(copySavedLibraryTarget(selected.target)) !== JSON.stringify(target)) return fail('SAVED_LIBRARY_SCOPE_MISMATCH')
  if (!Array.isArray(input.existingReferences)) return fail()
  const existing = input.existingReferences.map(copySavedLibraryReference), reference = copySavedLibraryReference(selected.reference)
  if (existing.length >= 4) return fail('SAVED_LIBRARY_TARGET_FULL')
  if (existing.some(row => row.sha256 === reference.sha256)) return fail('SAVED_LIBRARY_DUPLICATE')
  const entry = normalizeSavedLibraryEntries(input.entries).find(row => savedLibraryEntryKey(row.reference) === savedLibraryEntryKey(reference))
  if (!entry || JSON.stringify(entry.reference) !== JSON.stringify(reference)) return fail('SAVED_LIBRARY_SELECTION_STALE')
  const preview = selected.preview
  if (!preview || preview.displayed !== true || preview.sha256 !== reference.sha256 || !Number.isInteger(preview.width) || !Number.isInteger(preview.height) || preview.width < 1 || preview.height < 1 || preview.width > 4096 || preview.height > 4096 || preview.width * preview.height > 16_000_000) return fail('SAVED_LIBRARY_PREVIEW_UNCONFIRMED')
  return reference
}
