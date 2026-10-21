import { decodeAiResourceConfigV2, isAiReferencePath, type AiResourceConfigV2 } from './ai-resource-read'

/** Configuration only. Loading/accepting authority sources and persisting files belong to the host. */
export const ART_CATEGORIES = ['ip', 'equipment', 'skill', 'ui', 'icon'] as const
export type ArtCategory = typeof ART_CATEGORIES[number]
const textFields = ['renderingLanguage', 'proportions', 'realism', 'materials', 'lighting', 'palette', 'subject', 'identity', 'allowedChanges', 'purpose', 'view', 'state', 'textSafeArea', 'destination'] as const
const numberFields = ['width', 'height', 'paddingPercent'] as const
export type ArtValues = Partial<Record<typeof textFields[number], string> & Record<typeof numberFields[number], number> & { transparent: boolean }>
export interface ArtSourcePin { path: string; revision: string }
export interface ArtAuthority {
  source: ArtSourcePin
  status: 'Accepted'
  kind: 'canon-interface' | 'art-style'
  projectIds: readonly string[]
  categories: readonly ArtCategory[]
  locked: ArtValues
  defaults: ArtValues
  requiresImageReference: boolean
}
export interface ProjectArtSpec {
  schemaVersion: 'project-art-spec-v1'
  projectId: string
  version: number
  project: { name: string; content: string; engine: 'cocos-creator'; designResolution: { width: number; height: number } }
  inheritance: { mode: 'none'; reason: string } | { mode: 'canon'; sources: ArtSourcePin[] }
  overrides: ArtValues
  categories: Partial<Record<ArtCategory, ArtValues>>
}
export type ParsedArtSpec = { kind: 'project'; spec: ProjectArtSpec } | { kind: 'legacy-v2'; config: AiResourceConfigV2; referencesAsModelInput: false }
export class ArtSpecError extends Error {
  constructor(readonly code: string, readonly field: string) { super(`${code}: ${field}`) }
}
function fail(code: string, field: string): never { throw new ArtSpecError(code, field) }
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('INVALID_CONFIG', field)
  return value as Record<string, unknown>
}
function keys(value: Record<string, unknown>, allowed: readonly string[], field: string) {
  if (Object.keys(value).some(key => !allowed.includes(key))) fail('UNKNOWN_FIELD', field)
}
function text(value: unknown, field: string, max = 1500): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max || /[\u0000-\u0008]/.test(value)) fail('INVALID_CONFIG', field)
  return value
}
function integer(value: unknown, field: string, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) fail('INVALID_CONFIG', field)
  return value
}
function source(value: unknown): ArtSourcePin {
  const raw = object(value, 'source'); keys(raw, ['path', 'revision'], 'source')
  const path = text(raw.path, 'source.path', 240)
  if (!path.startsWith('P0001/') || path.includes('\\') || /[\u0000-\u001f:<>\"|?*]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..') || !path.endsWith('.md')) fail('INVALID_SOURCE', path)
  if (typeof raw.revision !== 'string' || !/^[a-f0-9]{40}$/.test(raw.revision)) fail('UNPINNED_SOURCE', path)
  return { path, revision: raw.revision }
}
function values(value: unknown, field: string): ArtValues {
  const raw = object(value, field); keys(raw, [...textFields, ...numberFields, 'transparent'], field)
  const out: Record<string, string | number | boolean> = {}
  for (const [key, item] of Object.entries(raw)) {
    if ((textFields as readonly string[]).includes(key)) {
      const checked = text(item, `${field}.${key}`)
      if (key === 'destination' && (!/^assets(?:\/[A-Za-z0-9_-]+)*$/.test(checked))) fail('INVALID_CONFIG', `${field}.${key}`)
      out[key] = checked
    } else if (key === 'transparent') {
      if (typeof item !== 'boolean') fail('INVALID_CONFIG', `${field}.${key}`)
      out[key] = item
    } else if (key === 'paddingPercent') {
      if (typeof item !== 'number' || !Number.isFinite(item) || item < 0 || item > 40) fail('INVALID_CONFIG', `${field}.${key}`)
      out[key] = item
    } else out[key] = integer(item, `${field}.${key}`, 4096)
  }
  return out as ArtValues
}
export function parseProjectArtSpec(value: unknown, expectedProjectId: string): ParsedArtSpec {
  if (!/^[a-f0-9]{16}$/.test(expectedProjectId)) fail('PROJECT_MISMATCH', 'projectId')
  const raw = object(value, 'config')
  if (raw.projectId !== expectedProjectId) fail('PROJECT_MISMATCH', 'projectId')
  if (raw.schemaVersion === 'project-resource-config-v2') return { kind: 'legacy-v2', config: decodeAiResourceConfigV2(raw, expectedProjectId), referencesAsModelInput: false }
  keys(raw, ['schemaVersion', 'projectId', 'version', 'project', 'inheritance', 'overrides', 'categories'], 'config')
  if (raw.schemaVersion !== 'project-art-spec-v1') fail('UNSUPPORTED_SCHEMA', 'schemaVersion')
  if (raw.projectId !== expectedProjectId) fail('PROJECT_MISMATCH', 'projectId')
  const project = object(raw.project, 'project'); keys(project, ['name', 'content', 'engine', 'designResolution'], 'project')
  if (project.engine !== 'cocos-creator') fail('UNSUPPORTED_ENGINE', 'project.engine')
  const design = object(project.designResolution, 'project.designResolution'); keys(design, ['width', 'height'], 'project.designResolution')
  const inheritance = object(raw.inheritance, 'inheritance')
  let inherited: ProjectArtSpec['inheritance']
  if (inheritance.mode === 'none') {
    keys(inheritance, ['mode', 'reason'], 'inheritance'); inherited = { mode: 'none', reason: text(inheritance.reason, 'inheritance.reason') }
  } else if (inheritance.mode === 'canon') {
    keys(inheritance, ['mode', 'sources'], 'inheritance')
    if (!Array.isArray(inheritance.sources) || !inheritance.sources.length || inheritance.sources.length > 8) fail('INVALID_SOURCE', 'inheritance.sources')
    const sources = inheritance.sources.map(source)
    if (new Set(sources.map(item => item.path)).size !== sources.length) fail('DUPLICATE_SOURCE', 'inheritance.sources')
    inherited = { mode: 'canon', sources }
  } else fail('EXPLICIT_INHERITANCE_REQUIRED', 'inheritance.mode')
  const categories = object(raw.categories, 'categories'); keys(categories, ART_CATEGORIES, 'categories')
  const checked: ProjectArtSpec['categories'] = {}
  for (const category of ART_CATEGORIES) if (Object.hasOwn(categories, category)) checked[category] = values(categories[category], `categories.${category}`)
  return { kind: 'project', spec: {
    schemaVersion: 'project-art-spec-v1', projectId: expectedProjectId, version: integer(raw.version, 'version', Number.MAX_SAFE_INTEGER),
    project: { name: text(project.name, 'project.name', 128), content: text(project.content, 'project.content'), engine: 'cocos-creator', designResolution: { width: integer(design.width, 'design.width', 8192), height: integer(design.height, 'design.height', 8192) } },
    inheritance: inherited, overrides: values(raw.overrides, 'overrides'), categories: checked,
  } }
}
export interface ArtAssetInput { assetId: string; category: ArtCategory; prompt: string; overrides: ArtValues; references: string[] }
const required: Record<ArtCategory, readonly (keyof ArtValues)[]> = {
  ip: ['subject', 'identity', 'allowedChanges', 'view'], equipment: ['subject', 'purpose'], skill: ['subject', 'purpose', 'state'], ui: ['subject', 'state', 'textSafeArea'], icon: ['subject', 'purpose'],
}
/** Authorities are supplied by a trusted source loader, never accepted from project JSON. No IO or generation occurs. */
export function resolveArtGenerationInput(spec: ProjectArtSpec, asset: ArtAssetInput, authorities: readonly ArtAuthority[], capabilities: { imageReferenceInput: boolean; categories: readonly ArtCategory[] }) {
  const parsed = parseProjectArtSpec(spec, spec.projectId)
  if (parsed.kind !== 'project') fail('UNSUPPORTED_SCHEMA', 'spec')
  const checked = parsed.spec
  if (!ART_CATEGORIES.includes(asset.category)) fail('INVALID_CATEGORY', 'category')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.assetId) || asset.assetId.length > 80) fail('INVALID_CONFIG', 'assetId')
  const prompt = text(asset.prompt, 'prompt')
  if (!Array.isArray(asset.references) || asset.references.length > 4 || new Set(asset.references).size !== asset.references.length || asset.references.some(item => !isAiReferencePath(item))) fail('INVALID_CONFIG', 'references')
  const defaults: ArtValues = {}, locked: ArtValues = {}, provenance: Record<string, string> = {}
  let requiresImageReference = asset.references.length > 0
  let hasInterface = checked.inheritance.mode === 'none'
  if (checked.inheritance.mode === 'canon') for (const pin of checked.inheritance.sources) {
    const matches = authorities.filter(item => item.source.path === pin.path && item.source.revision === pin.revision)
    if (matches.length !== 1) fail('SOURCE_UNAVAILABLE', pin.path)
    const authority = matches[0]!
    source(authority.source)
    if (!['canon-interface', 'art-style'].includes(authority.kind)) fail('INVALID_SOURCE', pin.path)
    if (authority.status !== 'Accepted') fail('SOURCE_NOT_ACCEPTED', pin.path)
    if (!authority.projectIds.includes(checked.projectId)) fail('SOURCE_OUT_OF_SCOPE', pin.path)
    if (!authority.categories.includes(asset.category)) continue
    hasInterface ||= authority.kind === 'canon-interface'
    if (typeof authority.requiresImageReference !== 'boolean') fail('INVALID_SOURCE', pin.path)
    requiresImageReference ||= authority.requiresImageReference
    for (const [target, fields, code] of [[defaults, values(authority.defaults, 'authority.defaults'), 'DEFAULT_CONFLICT'], [locked, values(authority.locked, 'authority.locked'), 'AUTHORITY_CONFLICT']] as const) {
      for (const [key, item] of Object.entries(fields)) {
        if (Object.hasOwn(target, key) && target[key as keyof ArtValues] !== item) fail(code, key)
        Object.assign(target, { [key]: item })
        if (target === locked || !Object.hasOwn(locked, key)) provenance[key] = pin.path + '@' + pin.revision
      }
    }
  }
  if (!hasInterface) fail('CANON_INTERFACE_REQUIRED', 'inheritance.sources')
  const resolved: ArtValues = { ...defaults, ...locked }
  for (const [layerName, layer] of [['project', checked.overrides], ['category', checked.categories[asset.category] ?? {}], ['asset', values(asset.overrides, 'asset.overrides')]] as const) {
    for (const [key, item] of Object.entries(layer)) {
      if (Object.hasOwn(locked, key) && locked[key as keyof ArtValues] !== item) fail('LOCKED_OVERRIDE', key)
      Object.assign(resolved, { [key]: item })
      if (!Object.hasOwn(locked, key)) provenance[key] = layerName
    }
  }
  for (const key of [...required[asset.category], 'width', 'height', 'transparent', 'destination'] as const) if (resolved[key] === undefined) fail('REQUIRED_FIELD', key)
  if (resolved.width! * resolved.height! > 16_000_000) fail('INVALID_CONFIG', 'dimensions')
  const blockers: string[] = []
  if (!capabilities.categories.includes(asset.category)) blockers.push('GENERATION_CATEGORY_UNSUPPORTED')
  if (requiresImageReference && !asset.references.length) blockers.push('REQUIRED_REFERENCE_MISSING')
  if (requiresImageReference && !capabilities.imageReferenceInput) blockers.push('IMAGE_REFERENCE_INPUT_UNSUPPORTED')
  return { projectId: checked.projectId, assetId: asset.assetId, category: asset.category, prompt, values: resolved, sources: checked.inheritance.mode === 'canon' ? checked.inheritance.sources.map(item => ({ ...item })) : [],
    lockedFields: Object.keys(locked), provenance, references: [...asset.references], requiresImageReference, readyForGeneration: blockers.length === 0, blockers,
    // Parsing does not attest source bytes, semantic prompt compliance, viewed references, or model support.
    persistence: 'not-performed' as const, visualCompliance: 'unverified' as const }
}

/** Validate stored difference layers without pretending an incomplete asset is ready for generation. */
export function validateProjectArtBindings(spec: ProjectArtSpec, authorities: readonly ArtAuthority[]): void {
  const parsed = parseProjectArtSpec(spec, spec.projectId)
  if (parsed.kind !== 'project' || parsed.spec.inheritance.mode === 'none') return
  const selected = parsed.spec.inheritance.sources.map(pin => {
    const matches = authorities.filter(item => item.source.path === pin.path && item.source.revision === pin.revision)
    if (matches.length !== 1) fail('SOURCE_UNAVAILABLE', pin.path)
    const authority = matches[0]!
    if (authority.status !== 'Accepted') fail('SOURCE_NOT_ACCEPTED', pin.path)
    if (!authority.projectIds.includes(spec.projectId) || !authority.categories.length || authority.categories.some(category => !ART_CATEGORIES.includes(category))) fail('SOURCE_OUT_OF_SCOPE', pin.path)
    if (!['canon-interface', 'art-style'].includes(authority.kind)) fail('INVALID_SOURCE', pin.path)
    values(authority.locked, 'authority.locked'); values(authority.defaults, 'authority.defaults')
    return authority
  })
  if (!selected.some(item => item.kind === 'canon-interface')) fail('CANON_INTERFACE_REQUIRED', 'inheritance.sources')
  for (const category of ART_CATEGORIES) {
    const locked: ArtValues = {}, defaults: ArtValues = {}
    for (const authority of selected.filter(item => item.categories.includes(category))) {
      for (const [target, fields, code] of [[locked, authority.locked, 'AUTHORITY_CONFLICT'], [defaults, authority.defaults, 'DEFAULT_CONFLICT']] as const) for (const [key, value] of Object.entries(fields)) {
        if (Object.hasOwn(target, key) && target[key as keyof ArtValues] !== value) fail(code, key)
        Object.assign(target, { [key]: value })
      }
    }
    for (const layer of [spec.overrides, spec.categories[category] ?? {}]) for (const [key, value] of Object.entries(layer)) {
      if (Object.hasOwn(locked, key) && locked[key as keyof ArtValues] !== value) fail('LOCKED_OVERRIDE', key)
    }
  }
}
