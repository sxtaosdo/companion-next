// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { acceptSavedReferenceLibrarySelection, normalizeSavedLibraryEntries, projectSavedReferenceLibrary, savedReferenceLibraryKey } from '../src/adapters/saved-reference-library'
import type { WorkbenchSpec } from '../src/domain/art-workbench'
import { clone, context, library, projectId, receipt, reference, selection, target } from './fixtures/saved-reference-library'

function accept(overrides: Partial<Parameters<typeof acceptSavedReferenceLibrarySelection>[0]> = {}) { const current = library(); return acceptSavedReferenceLibrarySelection({ selection: selection(), identity: current.identity, entries: current.entries, target: target(), existingReferences: [], disabled: false, ...overrides }) }
describe('saved workbench library projection and selection contract', () => {
  it('uses only the saved receipt and keeps originals independent of later caller edits', () => {
    const saved = receipt(), value = projectSavedReferenceLibrary(saved, context())
    expect(value.entries[0]!.reference).toEqual(saved.document!.projectReferences[0]); expect(value.identity!.source).toBe(context().source)
    saved.document!.projectReferences[0]!.sha256 = 'f'.repeat(64)
    expect(value.entries[0]!.reference.sha256).toBe('a'.repeat(64)); expect(Object.isFrozen(value.entries[0]!.reference)).toBe(true)
  })
  it('deduplicates path/hash pairs while retaining every saved project/spec/need origin', () => {
    const saved = receipt(), ref = reference(), spec: WorkbenchSpec = { id: 'icon', name: 'Spec fixture', category: 'icon', version: 1, sizePolicy: 'fixed', width: 128, height: 128, destination: 'assets/art', exportDirectory: 'art/final', imageOutput: 'transparent-png', style: '', references: [ref] }
    saved.document!.specs = [spec]; saved.document!.needs = [{ id: 'need', name: 'Need fixture', version: 1, content: 'Synthetic fixture', specId: spec.id, specVersion: 1, spec: clone(spec), references: [ref] }]
    const value = projectSavedReferenceLibrary(saved, context())
    expect(value.entries).toHaveLength(1); expect(value.entries[0]!.origins).toHaveLength(4)
    expect(value.entries[0]!.origins.join('|')).toContain('规格快照')
  })
  it('does not merge conflicting saved hashes for one path or replace them with a current guess', () => {
    const value = library([reference('a'.repeat(64)), reference('b'.repeat(64), 'Other saved claim')])
    expect(value.entries).toHaveLength(2); expect(value.entries.map(entry => entry.reference.sha256)).toEqual(['a'.repeat(64), 'b'.repeat(64)])
  })
  it('distinguishes a saved empty list from missing or malformed saved authority', () => {
    const empty = projectSavedReferenceLibrary(receipt([]), context()); expect(empty.identity).not.toBeNull(); expect(empty.entries).toEqual([])
    expect(projectSavedReferenceLibrary({ ...receipt(), hash: null, document: null }, context())).toEqual({ identity: null, entries: [] })
    expect(() => projectSavedReferenceLibrary({ ...receipt(), hash: null }, context())).toThrow()
    expect(() => projectSavedReferenceLibrary({ ...receipt(), document: null }, context())).toThrow()
  })
  it('does not accept config-only paths, pending intentions or unsafe references as a saved library', () => {
    expect(() => projectSavedReferenceLibrary({ projectId, config: { style: { references: ['art/reference/guess.png'] } } } as never, context())).toThrow()
    expect(() => normalizeSavedLibraryEntries([{ reference: { ...reference(), relativePath: '../private.png' }, origins: ['project'] }])).toThrow()
    expect(() => normalizeSavedLibraryEntries([{ reference: { ...reference(), relativePath: 'https://example.test/image.png' }, origins: ['project'] }])).toThrow()
  })
  it('returns the original pinned metadata as a local draft request, without mutating any input', () => {
    const event = selection(), before = clone(event.reference)
    expect(accept({ selection: event })).toEqual(reference()); expect(event.reference).toEqual(before)
    expect(accept()).not.toHaveProperty('base64'); expect(accept()).not.toHaveProperty('modelInput')
  })
  it.each(['projectId', 'projectPath', 'resourceDomainId', 'workbenchHash'] as const)('rejects a changed saved identity field %s', key => {
    const current = library(), changed = key === 'projectId' ? 'f'.repeat(16) : key === 'projectPath' ? 'D:/other' : key === 'resourceDomainId' ? 'cook' : 'f'.repeat(64)
    expect(() => accept({ identity: { ...current.identity!, [key]: changed } })).toThrow('SAVED_LIBRARY_SELECTION_STALE')
  })
  it('compares source objects by identity, never by JSON shape or guessed token values', () => {
    const current = library(); expect(() => accept({ identity: { ...current.identity!, source: {} } })).toThrow('SAVED_LIBRARY_SELECTION_STALE')
    const source = { secretMarker: 'DO_NOT_SERIALIZE' }, key = savedReferenceLibraryKey({ ...current.identity!, source }, current.entries)
    expect(key).not.toContain('DO_NOT_SERIALIZE')
  })
  it('requires the same current target and prevents shared/ant/cook cross-association', () => {
    for (const owner of ['shared', 'ant', 'cook']) {
      const current = library([reference()], owner), event = selection([reference()], owner)
      expect(accept({ selection: event, identity: current.identity, entries: current.entries, target: target(owner) })).toEqual(reference())
      for (const other of ['shared', 'ant', 'cook'].filter(value => value !== owner)) expect(() => accept({ selection: event, identity: current.identity, entries: current.entries, target: target(other) })).toThrow('SAVED_LIBRARY_SCOPE_MISMATCH')
    }
    expect(() => accept({ target: target(undefined, 'spec', 'other-target') })).toThrow('SAVED_LIBRARY_SCOPE_MISMATCH')
  })
  it('does not infer a shared owner from path spelling', () => {
    const ref = { ...reference(), relativePath: 'art/reference/shared/example.png' }, current = library([ref], 'ant'), event = selection([ref], 'ant')
    expect(() => accept({ selection: event, identity: current.identity, entries: current.entries, target: target('shared') })).toThrow('SAVED_LIBRARY_SCOPE_MISMATCH')
  })
  it('rejects current-list drift or a renamed/forged event even when preview hashes match', () => {
    expect(() => accept({ entries: [{ reference: reference(), origins: ['changed saved source label'] }] })).toThrow('SAVED_LIBRARY_SELECTION_STALE')
    expect(() => accept({ selection: { ...selection(), reference: { ...reference(), name: 'Forged name' } } })).toThrow('SAVED_LIBRARY_SELECTION_STALE')
  })
  it('does not substitute the normalized preview SHA for the original saved SHA', () => {
    const event = selection()
    expect(() => accept({ selection: { ...event, preview: { ...event.preview, sha256: 'f'.repeat(64) } } })).toThrow('SAVED_LIBRARY_PREVIEW_UNCONFIRMED')
    expect(() => accept({ selection: { ...event, reference: { ...event.reference, sha256: 'f'.repeat(64) }, preview: { ...event.preview, sha256: 'f'.repeat(64) } } })).toThrow('SAVED_LIBRARY_SELECTION_STALE')
    expect(event.reference.sha256).toBe('a'.repeat(64))
  })
  it('fails closed on missing display acknowledgement, disabled targets, full or duplicate drafts', () => {
    const event = selection()
    expect(() => accept({ selection: { ...event, preview: { ...event.preview, displayed: false as never } } })).toThrow('SAVED_LIBRARY_PREVIEW_UNCONFIRMED')
    expect(() => accept({ disabled: true })).toThrow('SAVED_LIBRARY_SELECTION_DISABLED')
    expect(() => accept({ disabled: undefined as never })).toThrow('SAVED_LIBRARY_SELECTION_DISABLED')
    expect(() => accept({ maxReferences: 5 })).toThrow('SAVED_LIBRARY_SELECTION_DISABLED')
    expect(() => accept({ existingReferences: [reference()] })).toThrow('SAVED_LIBRARY_DUPLICATE')
    expect(() => accept({ existingReferences: ['b', 'c', 'd', 'e'].map(letter => reference(letter.repeat(64))) })).toThrow('SAVED_LIBRARY_TARGET_FULL')
  })
})
