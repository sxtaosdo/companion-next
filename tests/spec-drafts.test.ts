import { describe, expect, it, beforeEach } from 'vitest'
import { createDefaultSpec, validateSpec } from '../src/domain/spec'
import { draftKey, readDraft, writeDraft } from '../src/domain/drafts'
const valid = () => ({ ...createDefaultSpec(), styleName: '测试母版' })
beforeEach(() => localStorage.clear())
describe('project specification validation', () => {
  it('requires an explicit style name', () => expect(validateSpec(createDefaultSpec())).toContain('请填写风格样板名称'))
  it('accepts a single-master specification', () => expect(validateSpec(valid())).toEqual([]))
  it.each([0, -1, 8193, NaN, Infinity, 900.5])('rejects invalid canvas width %s', (width) => expect(validateSpec({ ...valid(), width }).length).toBeGreaterThan(0))
  it('rejects overlapping safe area', () => expect(validateSpec({ ...valid(), safeHorizontal: 500 })).toContain('安全边距必须小于画布尺寸的一半'))
  it('rejects empty draft versions', () => expect(validateSpec({ ...valid(), version: ' ' })).toContain('请填写草稿版本'))
  it('rejects non-single-master policy at runtime', () => expect(validateSpec({ ...valid(), sizePolicy: 'multi' as 'single-master' }).length).toBeGreaterThan(0))
})
describe('browser-only drafts', () => {
  it('stores and reads a project-scoped draft', () => {
    const draft = writeDraft(localStorage, 'demo', '1060', valid())
    expect(readDraft(localStorage, 'demo', '1060')).toEqual(draft)
    expect(draft.savedAt).toMatch(/^\d{4}-/)
  })
  it('isolates projects and mode', () => {
    writeDraft(localStorage, 'demo', '1060', valid())
    expect(readDraft(localStorage, 'demo', '4060')).toBeNull()
    expect(readDraft(localStorage, 'live', '1060')).toBeNull()
  })
  it('does not mutate the input spec after storage', () => {
    const spec = valid(); const draft = writeDraft(localStorage, 'demo', '1060', spec)
    spec.width = 1200
    expect(draft.spec.width).toBe(941)
  })
  it('ignores malformed and wrong-project stored data', () => {
    localStorage.setItem(draftKey('demo', '1060'), '{broken')
    expect(readDraft(localStorage, 'demo', '1060')).toBeNull()
    localStorage.setItem(draftKey('demo', '1060'), JSON.stringify({ schemaVersion: 1, projectId: '4060', mode: 'demo', spec: valid() }))
    expect(readDraft(localStorage, 'demo', '1060')).toBeNull()
  })
  it('does not silently accept storage write failure', () => {
    expect(() => writeDraft({ getItem() { return null }, setItem() { throw new Error('QuotaExceeded') } }, 'demo', '1060', valid())).toThrow('QuotaExceeded')
  })
  it('gracefully handles blocked read storage', () => {
    expect(readDraft({ getItem() { throw new Error('SecurityError') } }, 'demo', '1060')).toBeNull()
  })
  it('does not save invalid drafts', () => {
    expect(() => writeDraft(localStorage, 'demo', '1060', { ...valid(), width: 0 })).toThrow()
    expect(localStorage.length).toBe(0)
  })
})

describe('full stored schema and conflict protection', () => {
  it.each(['schemaVersion', 'width', 'spacing', 'styleName', 'styleKeywords', 'fontFamily', 'buttonStates', 'overlayPolicy', 'pivot', 'bundle', 'panelPolicy', 'sizePolicy'])('rejects missing %s', (key) => {
    const spec = { ...valid() } as Record<string, unknown>; delete spec[key]
    expect(validateSpec(spec).length).toBeGreaterThan(0)
  })
  it.each(['spacing', 'styleName', 'styleKeywords', 'fontFamily', 'buttonStates', 'overlayPolicy', 'pivot', 'bundle', 'panelPolicy'])('rejects non-text %s', (key) => {
    expect(validateSpec({ ...valid(), [key]: { unexpected: true } }).length).toBeGreaterThan(0)
  })
  it('rejects wrong schema, extra fields and oversized strings', () => {
    expect(validateSpec({ ...valid(), schemaVersion: 2 })).toContain('不支持的规范 schemaVersion')
    expect(validateSpec({ ...valid(), injected: true })).toContain('规范包含未知字段')
    expect(validateSpec({ ...valid(), styleKeywords: 'x'.repeat(501) }).length).toBeGreaterThan(0)
    expect(validateSpec({ ...valid(), fontFamily: '\u0000bad' }).length).toBeGreaterThan(0)
  })
  it('does not overwrite a draft changed since editing began', () => {
    const first = writeDraft(localStorage, 'demo', '1060', valid())
    const second = writeDraft(localStorage, 'demo', '1060', { ...valid(), width: 1080 }, first.revision)
    expect(() => writeDraft(localStorage, 'demo', '1060', { ...valid(), width: 1440 }, first.revision)).toThrow('本地草稿已被其他页面更新或删除')
    expect(readDraft(localStorage, 'demo', '1060')).toEqual(second)
  })
  it('detects concurrent first creation and external deletion', () => {
    const first = writeDraft(localStorage, 'demo', '1060', valid())
    expect(() => writeDraft(localStorage, 'demo', '1060', valid(), null)).toThrow('本地草稿已被其他页面更新或删除')
    localStorage.removeItem(draftKey('demo', '1060'))
    expect(() => writeDraft(localStorage, 'demo', '1060', valid(), first.revision)).toThrow('本地草稿已被其他页面更新或删除')
  })
  it('preserves malformed existing storage instead of silently replacing it', () => {
    const key = draftKey('demo', '1060'); localStorage.setItem(key, '{keep-existing')
    expect(() => writeDraft(localStorage, 'demo', '1060', valid())).toThrow('已有本地草稿格式无效')
    expect(localStorage.getItem(key)).toBe('{keep-existing')
  })
  it('rejects malformed savedAt, revision, nested schema and oversized raw storage', () => {
    const draft = writeDraft(localStorage, 'demo', '1060', valid()); const key = draftKey('demo', '1060')
    for (const bad of [{ ...draft, savedAt: 'bad' }, { ...draft, revision: null }, { ...draft, spec: { ...draft.spec, schemaVersion: 999 } }, { ...draft, spec: { ...draft.spec, pivot: [] } }]) {
      localStorage.setItem(key, JSON.stringify(bad)); expect(readDraft(localStorage, 'demo', '1060')).toBeNull()
    }
    localStorage.setItem(key, ' '.repeat(16_385)); expect(readDraft(localStorage, 'demo', '1060')).toBeNull()
  })
})
