import { afterEach, describe, expect, it, vi } from 'vitest'
import { clonePresetDraft, parsePresetDraftImport, serializePresetDrafts, TOOL_PRESET_DRAFT_LIMITS, ToolPresetDraftError, validateDraftCollection } from '../src/domain/tool-preset-drafts'
import type { ToolPresetDraftCode } from '../src/domain/tool-preset-drafts'
import type { ToolCatalogEntry, ToolPreset, ToolPresetExport } from '../src/domain/tool-presets-read'

const stamp = '2026-10-13T08:00:00.000Z'
const core: ToolPreset = { id: 'core', name: '核心工具', baseProfile: 'core', enabled: [], disabled: [], builtIn: true, updatedAt: '1970-01-01T00:00:00.000Z' }
const full: ToolPreset = { ...core, id: 'full', name: '全部工具', baseProfile: 'full' }
const custom: ToolPreset = { id: 'preset-one', name: '场景阅读', baseProfile: 'core', enabled: ['asset_write'], disabled: ['scene_get_tree'], builtIn: false, updatedAt: stamp }
const tool = (name: string, profile: 'core' | 'full' = 'full'): ToolCatalogEntry => ({ name, displayNameZh: '工具', description: 'Current tool directory entry', profile, scope: 'scene', access: 'read' })
const catalog: ToolCatalogEntry[] = [tool('scene_get_tree', 'core'), tool('asset_write'), tool('editor_set_selection'), tool('asset_read')]
const batch = (presets: ToolPreset[] = [custom]): ToolPresetExport => ({ schemaVersion: 1, presets })
const parse = (value: unknown) => parsePresetDraftImport(JSON.stringify(value))
const many = (count: number, prefix = 'custom'): ToolPreset[] => Array.from({ length: count }, (_, index) => ({ ...custom, id: `${prefix}-${index}`, name: `${prefix} ${index}` }))
function expectCode(action: () => unknown, code: ToolPresetDraftCode): ToolPresetDraftError {
  try { action() } catch (error) {
    expect(error).toBeInstanceOf(ToolPresetDraftError)
    expect(error).toMatchObject({ code, name: 'ToolPresetDraftError' })
    return error as ToolPresetDraftError
  }
  throw new Error(`Expected ${code}`)
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('strict, portable v148 page draft imports', () => {
  it('restores the complete seven-field schema and normalizes like the approved v148 source', () => {
    const input = batch([{ ...custom, name: '  场景阅读  ', enabled: ['editor_set_selection', 'asset_write', 'asset_read'] }])
    const result = parse(input)
    expect(result).toEqual(batch([{ ...custom, enabled: ['asset_read', 'asset_write', 'editor_set_selection'] }]))
    expect(Object.keys(result.presets[0]!).sort()).toEqual(['baseProfile', 'builtIn', 'disabled', 'enabled', 'id', 'name', 'updatedAt'])
    expect(input.presets[0]!.name).toBe('  场景阅读  ')
    expect(input.presets[0]!.enabled[0]).toBe('editor_set_selection')
  })
  it('accepts the original 1 through 20 batch format rather than reducing it to one item', () => {
    expect(parse(batch(many(1))).presets).toHaveLength(1)
    expect(parse(batch(many(20))).presets).toHaveLength(20)
    expectCode(() => parse(batch([])), 'invalid-shape')
    expectCode(() => parse(batch(many(21))), 'too-many-presets')
  })
  it.each([
    { ...batch(), projectSelections: { project: 'preset-one' } },
    { ...batch(), token: 'PRIVATE_INPUT_SECRET' },
    batch([{ ...custom, permissions: 'PRIVATE_INPUT_SECRET' } as ToolPreset]),
    batch([{ ...custom, sourcePresetId: 'preset-one' } as ToolPreset]),
  ])('rejects unknown fields instead of silently projecting them away: %#', (value) => {
    const error = expectCode(() => parse(value), 'unknown-field')
    expect(error.message).not.toContain('PRIVATE_INPUT_SECRET')
    expect(error).not.toHaveProperty('cause')
  })
  it('rejects prototype and constructor fields parsed from JSON', () => {
    expectCode(() => parsePresetDraftImport('{"schemaVersion":1,"presets":[],"__proto__":{"hidden":true}}'), 'unknown-field')
    expectCode(() => parse({ ...batch(), constructor: {} }), 'unknown-field')
    expect(({} as { hidden?: boolean }).hidden).toBeUndefined()
  })
  it.each([null, [], {}, { schemaVersion: 1 }, { presets: [custom] }, { schemaVersion: 1, presets: {} }])('rejects incomplete envelopes: %#', (value) => {
    expectCode(() => parse(value), 'invalid-shape')
  })
  it.each([0, 2, '1', null])('rejects unsupported schema versions: %#', (schemaVersion) => {
    expectCode(() => parse({ schemaVersion, presets: [custom] }), 'unsupported-schema')
  })
  it.each(['id', 'name', 'baseProfile', 'enabled', 'disabled', 'builtIn', 'updatedAt'])('requires the original preset field %s', (key) => {
    const preset = { ...custom } as Record<string, unknown>
    delete preset[key]
    expectCode(() => parse({ schemaVersion: 1, presets: [preset] }), 'invalid-shape')
  })
  it.each(['core', 'full'])('rejects reserved built-in ID %s even when builtIn says false', (id) => {
    expectCode(() => parse(batch([{ ...custom, id }])), 'reserved-id')
  })
  it.each(['Core', 'full', ' FULL ', 'cOrE'])('rejects the reserved English name %s case-insensitively', (name) => {
    expectCode(() => parse(batch([{ ...custom, name }])), 'reserved-name')
  })
  it.each(['核心工具', '全部工具'])('permits custom Chinese built-in labels as the original schema does: %s', (name) => {
    expect(validateDraftCollection(batch([{ ...custom, name }]), catalog, [core, full]).presets[0]!.name).toBe(name)
  })
  it.each(['', ' ', 'x'.repeat(41), 'hidden\nname', 'hidden\u202ename'])('rejects invalid names: %#', (name) => {
    expectCode(() => parse(batch([{ ...custom, name }])), 'invalid-name')
  })
  it.each(['', 'name.with.dot', 'path/tool', 'https://example.com', 'x'.repeat(81), 1])('bounds custom IDs: %#', (id) => {
    expectCode(() => parse(batch([{ ...custom, id } as ToolPreset])), 'invalid-id')
  })
  it.each([
    { builtIn: true }, { builtIn: 'false' }, { baseProfile: 'unknown' },
    { updatedAt: '2026-02-29T08:00:00.000Z' }, { updatedAt: '2026-10-13T08:00:00+00:00' },
    { updatedAt: '2026-10-13T24:00:00Z' }, { updatedAt: 'not a date' },
  ])('reuses bounded real-calendar UTC/profile/custom rules: %#', (patch) => {
    expectCode(() => parse(batch([{ ...custom, ...patch } as ToolPreset])), 'invalid-shape')
  })
  it('keeps valid UTC timestamps instead of inventing an import timestamp', () => {
    for (const updatedAt of ['2024-02-29T08:00:00Z', '2026-10-13T08:00Z', stamp]) {
      expect(parse(batch([{ ...custom, updatedAt }])).presets[0]!.updatedAt).toBe(updatedAt)
    }
  })
  it.each([null, 'asset_write', [null], [1], [''], ['x'.repeat(129)], ['unsafe\nname'], ['path/tool']])('bounds the tool-name lists: %#', (enabled) => {
    expectCode(() => parse(batch([{ ...custom, enabled } as ToolPreset])), 'invalid-tools')
  })
  it('rejects tool-list oversize, duplicate and cross-list overrides with distinct codes', () => {
    expectCode(() => parse(batch([{ ...custom, enabled: Array.from({ length: 513 }, (_, index) => `t_${index}`) }])), 'invalid-tools')
    expectCode(() => parse(batch([{ ...custom, enabled: ['asset_write', 'asset_write'] }])), 'duplicate-tool')
    expectCode(() => parse(batch([{ ...custom, disabled: ['scene_get_tree', 'scene_get_tree'] }])), 'duplicate-tool')
    expectCode(() => parse(batch([{ ...custom, disabled: ['asset_write'] }])), 'overlapping-tools')
  })
  it('distinguishes same-batch duplicate identity and folded normalized names', () => {
    expectCode(() => parse(batch([custom, { ...custom, name: '另一项' }])), 'duplicate-id')
    expectCode(() => parse(batch([{ ...custom, name: 'Example' }, { ...custom, id: 'second', name: ' example ' }])), 'duplicate-name')
  })
  it('retains every structurally valid unknown reference until directory validation', () => {
    const value = parse(batch([custom, { ...custom, id: 'future', name: '未来工具', enabled: ['future_tool'] }]))
    expect(value.presets).toHaveLength(2)
    expect(value.presets[1]!.enabled).toEqual(['future_tool'])
    expectCode(() => validateDraftCollection(value, undefined), 'unknown-catalog')
    expectCode(() => validateDraftCollection(value, catalog), 'unknown-tools')
    expect(value.presets[1]!.enabled).toEqual(['future_tool'])
  })
  it('cannot execute accessors or toJSON from injected objects', () => {
    const getName = vi.fn(() => 'secret'), toJSON = vi.fn(() => batch())
    const withAccessor = Object.defineProperty({ ...custom }, 'name', { get: getName })
    expectCode(() => validateDraftCollection(batch([withAccessor]), catalog), 'invalid-shape')
    expectCode(() => validateDraftCollection({ ...batch(), toJSON }, catalog), 'unknown-field')
    expect(getName).not.toHaveBeenCalled(); expect(toJSON).not.toHaveBeenCalled()
  })
})

describe('local import and export resource budgets', () => {
  it.each(['', '{', 'undefined', '{"schemaVersion":1,}', 'null null'])('returns a closed parse error: %#', (text) => {
    expectCode(() => parsePresetDraftImport(text), 'invalid-json')
  })
  it('enforces UTF-8 bytes, including at the exact input boundary', () => {
    const text = JSON.stringify(batch())
    const padding = TOOL_PRESET_DRAFT_LIMITS.maxBytes - new TextEncoder().encode(text).byteLength
    expect(parsePresetDraftImport(text + ' '.repeat(padding))).toEqual(batch())
    expectCode(() => parsePresetDraftImport(text + ' '.repeat(padding + 1)), 'input-too-large')
    const unicode = `"${'界'.repeat(350_000)}"`
    expect(unicode.length).toBeLessThan(TOOL_PRESET_DRAFT_LIMITS.maxBytes)
    expectCode(() => parsePresetDraftImport(unicode), 'input-too-large')
  })
  it('checks depth before JSON.parse but does not count quoted brackets or escaped quotes', () => {
    expectCode(() => parsePresetDraftImport('['.repeat(9) + '0' + ']'.repeat(9)), 'too-deep')
    const name = '[{[\"{\\ quote }]}]'
    expect(parse(batch([{ ...custom, name }])).presets[0]!.name).toBe(name)
  })
  it('rejects pretty-normalized outputs over 1 MiB even when compact inputs fit', () => {
    const names = Array.from({ length: 390 }, (_, index) => `t${String(index).padStart(3, '0')}${'x'.repeat(124)}`)
    const value = batch(many(20).map((preset) => ({ ...preset, enabled: names, disabled: [] })))
    const compact = JSON.stringify(value)
    expect(new TextEncoder().encode(compact).byteLength).toBeLessThan(TOOL_PRESET_DRAFT_LIMITS.maxBytes)
    expect(new TextEncoder().encode(JSON.stringify(value, null, 2)).byteLength).toBeGreaterThan(TOOL_PRESET_DRAFT_LIMITS.maxBytes)
    expectCode(() => parsePresetDraftImport(compact), 'output-too-large')
    expectCode(() => serializePresetDrafts(value, names.map((name) => tool(name))), 'output-too-large')
  })
  it('validates sparse direct-caller collections and arrays instead of silently dropping slots', () => {
    expectCode(() => validateDraftCollection({ schemaVersion: 1, presets: Array(1) }, catalog), 'invalid-shape')
    expectCode(() => validateDraftCollection(batch([{ ...custom, enabled: Array(1) }]), catalog), 'invalid-tools')
  })
})

describe('bounded catalog, conflict and final export validation', () => {
  it.each([undefined, [], [{ name: 'asset_write' }], [catalog[0], catalog[0]], Array.from({ length: 513 }, (_, i) => tool(`t${i}`))].map((tools) => ({ tools })))('fails closed on unavailable or invalid catalogs: %#', ({ tools }) => {
    expectCode(() => validateDraftCollection(batch(), tools as ToolCatalogEntry[]), 'unknown-catalog')
  })
  it('checks unknown enabled and disabled tools and never treats directory metadata as permission', () => {
    for (const field of ['enabled', 'disabled']) {
      expectCode(() => serializePresetDrafts(batch([{ ...custom, [field]: ['not_in_directory'] }]), catalog), 'unknown-tools')
    }
    const result = validateDraftCollection(batch(), catalog.map((entry) => ({ ...entry, access: 'write' })))
    expect(result).toEqual(batch())
    expect(result).not.toHaveProperty('permissions')
    expect(result.presets[0]).not.toHaveProperty('access')
  })
  it('checks the current custom snapshot against the directory as the original validateStore does', () => {
    const existing = { ...custom, id: 'old-custom', name: '旧预设', enabled: ['retired_tool'] }
    expectCode(() => serializePresetDrafts(batch(), catalog, [core, full, existing]), 'unknown-tools')
    expectCode(() => serializePresetDrafts(batch(), catalog, [{ ...existing, enabled: [], disabled: ['retired_tool'] }]), 'unknown-tools')
  })
  it('distinguishes current custom ID/name conflicts from batch duplicates', () => {
    expectCode(() => validateDraftCollection(batch(), catalog, [core, full, custom]), 'existing-id-conflict')
    expectCode(() => validateDraftCollection(batch([{ ...custom, id: 'other' }]), catalog, [custom]), 'existing-name-conflict')
    expectCode(() => validateDraftCollection(batch([{ ...custom, id: 'other', name: 'EXAMPLE' }]), catalog, [{ ...custom, name: 'Example' }]), 'existing-name-conflict')
  })
  it('applies the total 20-custom cap without counting the two built-ins', () => {
    expect(validateDraftCollection(batch(), catalog, [core, full, ...many(19)]).presets).toHaveLength(1)
    expect(validateDraftCollection(batch(many(20)), catalog, [core, full]).presets).toHaveLength(20)
    expectCode(() => validateDraftCollection(batch(), catalog, [core, full, ...many(20)]), 'too-many-presets')
    expectCode(() => validateDraftCollection(batch(many(2, 'draft')), catalog, many(19)), 'too-many-presets')
  })
  it.each([[custom, custom], [{ ...custom, builtIn: true }], many(21), [core, { ...core, name: 'invalid' }]].map((existing) => ({ existing })))('rejects corrupted current preset snapshots: %#', ({ existing }) => {
    expectCode(() => validateDraftCollection(batch(many(1, 'draft')), catalog, existing), 'invalid-existing-presets')
  })
  it('normalizes, validates and detaches a complete batch again at export time', () => {
    const value = batch([{ ...custom, name: ' 场景阅读 ', enabled: ['editor_set_selection', 'asset_write'] }, ...many(2)])
    const output = serializePresetDrafts(value, catalog, [core, full])
    expect(output.endsWith('\n')).toBe(true)
    expect(parsePresetDraftImport(output)).toEqual(batch([{ ...custom, enabled: ['asset_write', 'editor_set_selection'] }, ...many(2)]))
    const checked = validateDraftCollection(value, catalog)
    checked.presets[0]!.enabled.push('unrelated')
    expect(value.presets[0]!.enabled).toEqual(['editor_set_selection', 'asset_write'])
    expect(value.presets[0]!.name).toBe(' 场景阅读 ')
    value.presets[1]!.name = '场景阅读'
    expectCode(() => serializePresetDrafts(value, catalog), 'duplicate-name')
  })
})

describe('detached page-local clones', () => {
  it.each([core, full, custom])('creates a new custom identity for %s with explicit identity/time injection', (source) => {
    const original = JSON.stringify(source)
    const draft = clonePresetDraft(source, [core, full, custom], { id: 'preset-copy', now: stamp })
    expect(draft).toEqual({ ...source, id: 'preset-copy', name: `${source.name} copy`, builtIn: false, updatedAt: stamp })
    expect(draft).not.toBe(source)
    expect(draft.enabled).not.toBe(source.enabled)
    expect(draft.disabled).not.toBe(source.disabled)
    draft.enabled.push('local_only'); draft.disabled.length = 0
    expect(JSON.stringify(source)).toBe(original)
  })
  it('clones an exportable custom draft with surrounding spaces and normalizes the copy name', () => {
    const source = { ...custom, name: '  场景阅读  ' }
    expect(serializePresetDrafts(batch([source]), catalog)).toContain('场景阅读')
    const draft = clonePresetDraft(source, [core, full, source], { id: 'trimmed-copy', now: stamp })
    expect(draft.name).toBe('场景阅读 copy')
    expect(draft.id).toBe('trimmed-copy')
    expect(draft.builtIn).toBe(false)
    expect(draft.enabled).not.toBe(source.enabled)
    expect(source.name).toBe('  场景阅读  ')
    expectCode(() => clonePresetDraft({ ...source, name: '\t场景阅读 ' }, [], { id: 'copy', now: stamp }), 'invalid-name')
    expectCode(() => clonePresetDraft({ ...source, name: ` ${'名'.repeat(39)} ` }, [], { id: 'copy', now: stamp }), 'invalid-name')
    expectCode(() => clonePresetDraft({ ...source, extra: true } as ToolPreset, [], { id: 'copy', now: stamp }), 'unknown-field')
    expectCode(() => clonePresetDraft({ ...core, name: ' 核心工具 ' }, [], { id: 'copy', now: stamp }), 'invalid-shape')
  })
  it('creates native random custom IDs without dependencies or external I/O', () => {
    const draft = clonePresetDraft(core)
    expect(draft.id).toMatch(/^preset-[A-Za-z0-9-]+$/)
    expect(draft.id).not.toBe(core.id)
    expect(draft.builtIn).toBe(false)
    expect(Number.isFinite(Date.parse(draft.updatedAt))).toBe(true)
  })
  it('cannot reuse source identity, reserved IDs, or known current/local custom IDs', () => {
    expectCode(() => clonePresetDraft(custom, [], { id: custom.id, now: stamp }), 'existing-id-conflict')
    expectCode(() => clonePresetDraft(core, [], { id: 'core', now: stamp }), 'reserved-id')
    expectCode(() => clonePresetDraft(core, [], { id: 'full', now: stamp }), 'reserved-id')
    expectCode(() => clonePresetDraft(core, [custom], { id: custom.id, now: stamp }), 'existing-id-conflict')
  })
  it('avoids folded copy-name collisions and honors the 40-character limit', () => {
    const source = { ...custom, name: '名'.repeat(40) }
    const firstName = `${'名'.repeat(35)} copy`
    const secondName = `${'名'.repeat(33)} copy 2`
    const existing = [source, { ...custom, id: 'copy-one', name: firstName }, { ...custom, id: 'copy-two', name: secondName.toUpperCase() }]
    const result = clonePresetDraft(source, existing, { id: 'new-copy', now: stamp })
    expect(result.name).toBe(`${'名'.repeat(33)} copy 3`)
    expect(result.name.length).toBe(40)
  })
  it('does not split a Unicode surrogate pair while truncating a copy name', () => {
    const source = { ...custom, name: '😀'.repeat(20) }
    const result = clonePresetDraft(source, [], { id: 'new-copy', now: stamp })
    expect(result.name).toBe(`${'😀'.repeat(17)} copy`)
    expect(result.name.length).toBeLessThanOrEqual(40)
  })
  it('normalizes explicit names and rejects source-name reuse or known custom names', () => {
    expect(clonePresetDraft(core, [core, full], { id: 'copy', now: stamp, name: ' 全部工具 ' }).name).toBe('全部工具')
    expectCode(() => clonePresetDraft(custom, [], { id: 'copy', now: stamp, name: custom.name }), 'existing-name-conflict')
    expectCode(() => clonePresetDraft(core, [custom], { id: 'copy', now: stamp, name: custom.name }), 'existing-name-conflict')
    expectCode(() => clonePresetDraft(core, [], { id: 'copy', now: stamp, name: 'Full' }), 'reserved-name')
  })
  it('allows page-local cloning while final export still blocks a full remote collection', () => {
    const existing = [core, full, ...many(20)]
    const result = clonePresetDraft(core, existing, { id: 'copy', now: stamp })
    expect(result.builtIn).toBe(false)
    expectCode(() => serializePresetDrafts(batch([result]), catalog, existing), 'too-many-presets')
    expect(clonePresetDraft(core, [...existing, ...many(19, 'local')], { id: 'copy', now: stamp }).id).toBe('copy')
  })
  it('repairs conflicting imports despite duplicate occupied IDs or temporarily invalid sibling names', () => {
    const imported = { ...custom }
    const occupied = [core, full, custom, imported, { ...custom, id: 'editing', name: '' }, { ...custom, id: 'renaming', name: '場'.repeat(80) }]
    const copied = clonePresetDraft(imported, occupied, { id: 'repair-copy', now: stamp })
    expect(copied.id).toBe('repair-copy')
    expect(copied.name).toBe(`${custom.name} copy`)
    expectCode(() => clonePresetDraft(imported, occupied, { id: 'editing', now: stamp }), 'existing-id-conflict')
    expectCode(() => clonePresetDraft(core, Array(43).fill(custom), { id: 'copy', now: stamp }), 'invalid-existing-presets')
  })
  it('fails closed when native identity generation is unavailable or fails', () => {
    vi.stubGlobal('crypto', undefined)
    expectCode(() => clonePresetDraft(core), 'identity-unavailable')
    vi.stubGlobal('crypto', { randomUUID: () => { throw new Error('PRIVATE_RUNTIME_ERROR') } })
    const error = expectCode(() => clonePresetDraft(core), 'identity-unavailable')
    expect(error.message).not.toContain('PRIVATE_RUNTIME_ERROR')
  })
  it('keeps all operations offline and does not persist, apply, assign or mutate original values', () => {
    const fetch = vi.fn(), storage = vi.spyOn(Storage.prototype, 'setItem')
    vi.stubGlobal('fetch', fetch)
    const original = Object.freeze({ ...custom, enabled: Object.freeze([...custom.enabled]), disabled: Object.freeze([...custom.disabled]) }) as unknown as ToolPreset
    const result = clonePresetDraft(original, [core, full, original], { id: 'copy', now: stamp })
    const restored = parsePresetDraftImport(serializePresetDrafts(batch([result]), catalog, [core, full, original]))
    expect(restored.presets[0]).toEqual(result)
    expect(fetch).not.toHaveBeenCalled(); expect(storage).not.toHaveBeenCalled()
    expect(original.id).toBe('preset-one')
  })
})
