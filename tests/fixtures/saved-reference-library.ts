import { vi } from 'vitest'
import type { WorkbenchContext } from '../../src/adapters/art-workbench'
import type { WorkbenchDocument, WorkbenchReceipt, WorkbenchReference, WorkbenchReferenceScope } from '../../src/domain/art-workbench'
import type { AiReferencePreview, AiResourceReadProvider } from '../../src/domain/ai-resource-read'
import { projectSavedReferenceLibrary, savedReferenceLibraryKey, type SavedReferenceLibrarySelection } from '../../src/adapters/saved-reference-library'
import { pngBytes, testCrypto } from './generation-png'

// Synthetic saved metadata and existing in-memory test PNG bytes only.
export const source = {}
export const projectId = '1234567890abcdef', projectPath = 'D:/saved-library-fixture'
export function context(resourceDomainId?: string): WorkbenchContext { return { projectId, projectPath, source, ...(resourceDomainId === undefined ? {} : { resourceDomainId }) } }
export function reference(sha256 = 'a'.repeat(64), name = 'Saved fixture'): WorkbenchReference { return { name, relativePath: 'art/reference/library-fixture.png', sha256 } }
export function document(references = [reference()], resourceDomainId?: string): WorkbenchDocument { return { schemaVersion: 'art-workbench-v1', projectId, projectPath, ...(resourceDomainId === undefined ? {} : { resourceDomainId, projectSettingsHash: '1'.repeat(64) }), version: 3, norm: { hash: '2'.repeat(64), version: 1 }, projectReferences: references, specs: [], needs: [] } }
export function receipt(references = [reference()], resourceDomainId?: string): WorkbenchReceipt { return { projectId, projectPath, ...(resourceDomainId === undefined ? {} : { resourceDomainId, projectSettingsHash: '1'.repeat(64), binding: null }), hash: '3'.repeat(64), document: document(references, resourceDomainId), capabilities: { generation: false, imageConditioning: false, referenceUpload: false, existingJobLink: false } } }
export function library(references = [reference()], resourceDomainId?: string) { return projectSavedReferenceLibrary(receipt(references, resourceDomainId), context(resourceDomainId)) }
export function target(resourceDomainId?: string, scope: WorkbenchReferenceScope['scope'] = 'project', targetId = scope === 'project' ? projectId : 'target-fixture'): WorkbenchReferenceScope { return { projectId, projectPath, ...(resourceDomainId === undefined ? {} : { resourceDomainId }), scope, targetId } }
export function selection(references = [reference()], resourceDomainId?: string): SavedReferenceLibrarySelection {
  const value = library(references, resourceDomainId), selected = value.entries[0]!.reference
  return { schemaVersion: 'saved-reference-library-selection-v1', identity: value.identity!, listKey: savedReferenceLibraryKey(value.identity!, value.entries), target: target(resourceDomainId), reference: selected, preview: { sha256: selected.sha256, width: 16, height: 16, displayed: true } }
}
export async function image(): Promise<AiReferencePreview> {
  const bytes = pngBytes(), digest = await testCrypto.subtle.digest('SHA-256', bytes)
  return { mimeType: 'image/png', base64: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')), width: 16, height: 16, sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('') }
}
export function reader(value: AiReferencePreview) {
  return { label: 'Isolated saved-library fixture', referencePreviewEnabled: true, readConfig: vi.fn<AiResourceReadProvider['readConfig']>(async () => { throw Error('Config paths are not library identity') }), previewReference: vi.fn<AiResourceReadProvider['previewReference']>(async () => value) }
}
export function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
export function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(finish => { resolve = finish }); return { promise, resolve } }
export { testCrypto }
