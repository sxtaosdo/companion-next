import { describe, expect, it } from 'vitest'
import { ART_CATEGORIES, ART_CANON_USAGES, validateProjectArtBindings, ArtSpecError, parseProjectArtSpec, resolveArtGenerationInput, type ArtAuthority, type ArtAssetInput, type ProjectArtSpec } from '../src/domain/project-art-spec'
const projectId = '1234567890abcdef'
const pin = { path: 'P0001/ip/canteen-transport-interface.md', revision: 'a'.repeat(40) }
function spec(): ProjectArtSpec { return { schemaVersion: 'project-art-spec-v1', projectId, version: 1,
  project: { name: 'Test project', content: 'Owner project content', engine: 'cocos-creator', designResolution: { width: 750, height: 1334 } },
  inheritance: { mode: 'none', reason: 'No applicable Canon interface confirmed' }, overrides: { width: 96, height: 96, transparent: true, destination: 'assets/art', exportDirectory: 'art/final/icons' }, categories: {} } }
function asset(): ArtAssetInput { return { assetId: 'coin-pouch', category: 'icon', prompt: 'A coin pouch', overrides: { subject: 'coin pouch', purpose: 'inventory icon' }, references: [] } }
function authority(): ArtAuthority { return { source: { ...pin }, status: 'Accepted', kind: 'canon-interface', allowedUsages: ['runtime'], projectIds: [projectId], categories: [...ART_CATEGORIES], locked: { renderingLanguage: 'Owner accepted language' }, defaults: { paddingPercent: 10 }, requiresImageReference: false } }
function inherited() { const config = spec(); config.inheritance = { mode: 'canon', usage: 'runtime', sources: [{ ...pin }] }; return config }
const resolve = (config = spec(), input = asset(), sources: ArtAuthority[] = []) => resolveArtGenerationInput(config, input, sources, { imageReferenceInput: false, categories: ART_CATEGORIES })
function rejects(code: string, run: () => unknown) { try { run(); throw Error('expected rejection') } catch (error) { expect(error).toBeInstanceOf(ArtSpecError); expect((error as ArtSpecError).code).toBe(code) } }
describe('project art specification boundary', () => {
  it('requires explicit safe export output and opaque color without inventing defaults', () => {
    const c=spec(); delete c.overrides.exportDirectory; rejects('REQUIRED_FIELD',()=>resolve(c));
    for(const value of ['assets/icons','art/final/../icons','art/final/con','art/final/a.b','art/final/a/']) { c.overrides.exportDirectory=value; rejects('INVALID_CONFIG',()=>resolve(c)) }
    c.overrides.exportDirectory='art/final/icons'; c.overrides.transparent=false; rejects('REQUIRED_FIELD',()=>resolve(c));
    c.overrides.backgroundColor='#aBc012';expect(resolve(c).values.backgroundColor).toBe('#aBc012');
    c.overrides.backgroundColor='white';rejects('INVALID_CONFIG',()=>resolve(c));
    const next=spec();next.categories.icon={exportDirectory:'art/final/category',backgroundColor:'#123456',transparent:false}; expect(resolve(next).values.exportDirectory).toBe('art/final/category');expect(resolve(next).provenance.backgroundColor).toBe('category');
  })
  it('requires exact trusted dependencies before category filtering without implicitly selecting sources',()=>{
    const config=inherited(), a=authority(), master=authority();master.source={path:'P0001/art/master-style-reference.md',revision:'b'.repeat(40)};master.kind='art-style';master.requiresImageReference=true
    a.requiredSources=[master.source];a.categories=['ip'];const original=JSON.stringify(config)
    rejects('SOURCE_DEPENDENCY_REQUIRED',()=>resolve(config,asset(),[a,master]));rejects('SOURCE_DEPENDENCY_REQUIRED',()=>validateProjectArtBindings(config,[a,master]));expect(JSON.stringify(config)).toBe(original)
    if(config.inheritance.mode==='canon')config.inheritance.sources.push({...master.source,revision:'c'.repeat(40)})
    rejects('SOURCE_DEPENDENCY_REQUIRED',()=>resolve(config,asset(),[a,master]))
    if(config.inheritance.mode==='canon')config.inheritance.sources[1]={...master.source}
    // Dependency is present but an interface for another category cannot authorize icons.
    rejects('CANON_INTERFACE_REQUIRED',()=>resolve(config,asset(),[a,master]))
    a.categories=['icon'];const result=resolve(config,asset(),[a,master]);expect(result.blockers).toContain('REQUIRED_REFERENCE_MISSING');expect(result.blockers).toContain('IMAGE_REFERENCE_INPUT_UNSUPPORTED');expect(result.readyForGeneration).toBe(false)
    expect(resolve().usage).toBeNull()
  })

  it.each(ART_CANON_USAGES)('preserves explicit %s usage through parse and generation freeze', usage => {
    const config=inherited();if(config.inheritance.mode==='canon')config.inheritance.usage=usage
    const a=authority();a.allowedUsages=[usage]
    expect(parseProjectArtSpec(config,projectId)).toEqual({kind:'project',spec:config});expect(()=>validateProjectArtBindings(config,[a])).not.toThrow();expect(resolve(config,asset(),[a]).usage).toBe(usage)
  })
  it('reads old Canon with unresolved usage but never grants default runtime use',()=>{
    const config=inherited();if(config.inheritance.mode==='canon')delete config.inheritance.usage
    const parsed=parseProjectArtSpec(config,projectId);expect(parsed).toEqual({kind:'project',spec:config})
    rejects('SOURCE_USAGE_OUT_OF_SCOPE',()=>validateProjectArtBindings(config,[authority()]));rejects('SOURCE_USAGE_OUT_OF_SCOPE',()=>resolve(config,asset(),[authority()]))
  })
  it('cannot use shared concepts as runtime, even when category and project match',()=>{
    const a=authority();a.allowedUsages=['shared-concept'];a.categories=['ip']
    rejects('SOURCE_USAGE_OUT_OF_SCOPE',()=>validateProjectArtBindings(inherited(),[a]));rejects('SOURCE_USAGE_OUT_OF_SCOPE',()=>resolve(inherited(),asset(),[a]))
    a.allowedUsages=undefined as any;rejects('SOURCE_USAGE_OUT_OF_SCOPE',()=>resolve(inherited(),asset(),[a]))
    const c=inherited();if(c.inheritance.mode==='canon')c.inheritance.usage='unapproved' as any;rejects('SOURCE_USAGE_OUT_OF_SCOPE',()=>parseProjectArtSpec(c,projectId))
  })

  it('round trips project differences without copying inherited content and never mutates inputs', () => {
    const config = inherited(), sources = [authority()], original = JSON.stringify({ config, sources })
    const parsed = parseProjectArtSpec(JSON.parse(JSON.stringify(config)), projectId)
    expect(parsed).toEqual({ kind: 'project', spec: config })
    const result = resolve(config, asset(), sources)
    expect(result.values.renderingLanguage).toBe('Owner accepted language')
    expect(config.overrides.renderingLanguage).toBeUndefined()
    expect(JSON.stringify({ config, sources })).toBe(original)
    expect(result.persistence).toBe('not-performed'); expect(result.visualCompliance).toBe('unverified')
  })
  it('does not impose shared style on an explicitly independent project', () => {
    expect(resolve().values.renderingLanguage).toBeUndefined(); expect(resolve().sources).toEqual([])
  })
  it('applies allowed defaults then project, category, and asset values in order', () => {
    const config = inherited(); config.overrides.paddingPercent = 12; config.categories.icon = { paddingPercent: 15 }
    expect(resolve(config, asset(), [authority()]).values.paddingPercent).toBe(15)
    const input = asset(); input.overrides.paddingPercent = 20
    expect(resolve(config, input, [authority()]).values.paddingPercent).toBe(20)
    expect(resolve(config, input, [authority()]).provenance.paddingPercent).toBe('asset')
  })
  it.each(['project', 'category', 'asset'] as const)('rejects %s overriding an authority lock', layer => {
    const config = inherited(), input = asset()
    if (layer === 'project') config.overrides.renderingLanguage = 'other'
    if (layer === 'category') config.categories.icon = { renderingLanguage: 'other' }
    if (layer === 'asset') input.overrides.renderingLanguage = 'other'
    rejects('LOCKED_OVERRIDE', () => resolve(config, input, [authority()]))
  })
  it('allows identical locked declarations but reports their authority', () => {
    const config = inherited(); config.overrides.renderingLanguage = 'Owner accepted language'
    const output = resolve(config, asset(), [authority()]); expect(output.lockedFields).toContain('renderingLanguage'); expect(output.provenance.renderingLanguage).toBe(pin.path + '@' + pin.revision)
  })
  it('rejects missing or changed pinned source versions', () => {
    rejects('SOURCE_UNAVAILABLE', () => resolve(inherited()))
    const a = authority(); a.source.revision = 'b'.repeat(40)
    rejects('SOURCE_UNAVAILABLE', () => resolve(inherited(), asset(), [a]))
  })
  it('rejects nonaccepted authority and ambiguous duplicate authority', () => {
    const a = authority(); Object.assign(a, { status: 'Review' })
    rejects('SOURCE_NOT_ACCEPTED', () => resolve(inherited(), asset(), [a]))
    rejects('SOURCE_UNAVAILABLE', () => resolve(inherited(), asset(), [authority(), authority()]))
  })
  it.each(['project', 'category'] as const)('rejects authority outside its %s scope', kind => {
    const a = authority(); if (kind === 'project') a.projectIds = ['ffffffffffffffff']; else a.categories = ['ip']
    rejects(kind === 'project' ? 'SOURCE_OUT_OF_SCOPE' : 'CANON_INTERFACE_REQUIRED', () => resolve(inherited(), asset(), [a]))
  })
  it('does not consume a style source without an applicable Canon interface', () => {
    const a = authority(); a.kind = 'art-style'
    rejects('CANON_INTERFACE_REQUIRED', () => resolve(inherited(), asset(), [a]))
  })
  it('rejects incompatible authorities without silent precedence', () => {
    const config = inherited(); const other = authority(); other.source.path = 'P0001/art/master-style-reference.md'; other.kind = 'art-style'; other.locked.renderingLanguage = 'conflicting style'
    if (config.inheritance.mode === 'canon') config.inheritance.sources.push(other.source)
    rejects('AUTHORITY_CONFLICT', () => resolve(config, asset(), [authority(), other]))
  })
  it('keeps locked provenance when a later source also supplies a default', () => {
    const config = inherited(), other = authority(); other.source = { ...pin, path: 'P0001/art/master-style-reference.md' }; other.kind = 'art-style'; other.locked = {}; other.defaults = { renderingLanguage: 'another fallback' }
    if (config.inheritance.mode === 'canon') config.inheritance.sources.push(other.source)
    const output = resolve(config, asset(), [authority(), other]); expect(output.values.renderingLanguage).toBe('Owner accepted language'); expect(output.provenance.renderingLanguage).toBe(pin.path + '@' + pin.revision)
  })
  it('rejects duplicate pins and conflicting defaults', () => {
    const config = inherited(); if (config.inheritance.mode === 'canon') config.inheritance.sources.push({ ...pin })
    rejects('DUPLICATE_SOURCE', () => parseProjectArtSpec(config, projectId))
    const other = authority(); other.source = { ...pin, path: 'P0001/art/master-style-reference.md' }; other.kind = 'art-style'; other.defaults.paddingPercent = 20
    const next = inherited(); if (next.inheritance.mode === 'canon') next.inheritance.sources.push(other.source)
    rejects('DEFAULT_CONFLICT', () => resolve(next, asset(), [authority(), other]))
  })
  it('resolves coexisting category-scoped interfaces without cross-category authorization', () => {
    const config = inherited(), ip = authority(); ip.source={...pin,path:'P0001/ip/canon_interface.md'};ip.categories=['ip'];ip.locked={identity:'accepted identity'}
    const icon=authority();icon.categories=['icon']
    if(config.inheritance.mode==='canon')config.inheritance.sources.push(ip.source)
    expect(resolve(config,asset(),[icon,ip]).values.identity).toBeUndefined()
    const input=asset();input.category='ip';input.overrides={subject:'character',identity:'accepted identity',allowedChanges:'pose',view:'front'}
    expect(resolve(config,input,[icon,ip]).values.identity).toBe('accepted identity')
    input.category='equipment';input.overrides={subject:'tool',purpose:'game'};rejects('CANON_INTERFACE_REQUIRED',()=>resolve(config,input,[icon,ip]))
  })
  it('does not pretend stored reference paths are model image conditioning', () => {
    const a = authority(); a.requiresImageReference = true
    expect(resolve(inherited(), asset(), [a]).blockers).toContain('REQUIRED_REFERENCE_MISSING')
    const input = asset(); input.references = ['art/reference/style.png']
    const result = resolve(inherited(), input, [a]); expect(result.readyForGeneration).toBe(false); expect(result.blockers).toEqual(['IMAGE_REFERENCE_INPUT_UNSUPPORTED'])
    expect(resolveArtGenerationInput(inherited(), input, [a], { imageReferenceInput: true, categories: ART_CATEGORIES }).blockers).toEqual([])
    expect(result.visualCompliance).toBe('unverified')
  })
  it.each(ART_CATEGORIES)('requires category-specific content for %s', category => {
    const input = asset(); input.category = category; input.overrides = {}
    rejects('REQUIRED_FIELD', () => resolve(spec(), input))
    input.overrides = { subject: 'asset', purpose: 'game feedback', identity: 'Owner character ID', allowedChanges: 'pose only', view: 'front', state: 'idle', textSafeArea: 'central empty area' }
    expect(resolve(spec(), input).category).toBe(category)
  })
  it.each([
    ['projectId', (c: ProjectArtSpec) => { c.projectId = 'ffffffffffffffff' }, 'PROJECT_MISMATCH'],
    ['schema', (c: ProjectArtSpec) => { Object.assign(c, { schemaVersion: 'new-version' }) }, 'UNSUPPORTED_SCHEMA'],
    ['unknown field', (c: ProjectArtSpec) => { Object.assign(c, { inheritedCanonCopy: {} }) }, 'UNKNOWN_FIELD'],
    ['unversioned source', (c: ProjectArtSpec) => { c.inheritance = { mode: 'canon', usage: 'runtime', sources: [{ ...pin, revision: 'main' }] } }, 'UNPINNED_SOURCE'],
    ['traversal source', (c: ProjectArtSpec) => { c.inheritance = { mode: 'canon', usage: 'runtime', sources: [{ ...pin, path: 'P0001/../secret.md' }] } }, 'INVALID_SOURCE'],
    ['no explicit scope', (c: ProjectArtSpec) => { Object.assign(c, { inheritance: {} }) }, 'EXPLICIT_INHERITANCE_REQUIRED'],
  ] as const)('rejects %s', (_label, change, code) => { const config = spec(); change(config); rejects(code, () => parseProjectArtSpec(config, projectId)) })
  it('rejects invalid dimensions, unsafe destination, and reference traversal', () => {
    const config = spec(); config.overrides.width = 0; rejects('INVALID_CONFIG', () => resolve(config))
    config.overrides.width = 4096; config.overrides.height = 4096; rejects('INVALID_CONFIG', () => resolve(config))
    config.overrides = { width: 96, height: 96, transparent: true, destination: 'assets/../other' }; rejects('INVALID_CONFIG', () => resolve(config))
    const input = asset(); input.references = ['../secret.png']; rejects('INVALID_CONFIG', () => resolve(spec(), input))
  })
  it('does not claim a category unsupported by the actual generation adapter is ready', () => {
    const input = asset(); input.category = 'equipment'
    const output = resolveArtGenerationInput(spec(), input, [], { imageReferenceInput: false, categories: ['icon'] })
    expect(output.readyForGeneration).toBe(false); expect(output.blockers).toEqual(['GENERATION_CATEGORY_UNSUPPORTED'])
  })
  it('reads existing v2 without migration, authority inheritance, or data loss', () => {
    const v2 = { schemaVersion: 'project-resource-config-v2', projectId, version: 4, designResolution: { width: 750, height: 1334 }, orientation: 'portrait', iconSize: { width: 96, height: 96 }, style: { description: 'existing style', references: ['art/reference/style.png'] }, background: { format: 'png', transparent: true, color: '#ffffff' }, composition: { centered: true, paddingPercent: 10 }, destination: { directory: 'assets/art', exportDirectory: 'art/final/icons', naming: 'kebab-case' } }
    const before = JSON.stringify(v2); const output = parseProjectArtSpec(v2, projectId)
    expect(output).toEqual({ kind: 'legacy-v2', config: v2, referencesAsModelInput: false }); expect(JSON.stringify(v2)).toBe(before)
    rejects('PROJECT_MISMATCH', () => parseProjectArtSpec({ ...v2, projectId: 'ffffffffffffffff' }, projectId))
  })
})


describe('optional independent-project explanation contract',()=>{
 it.each([undefined,'','Explicit existing owner explanation'])('round-trips explanation %s without inventing or normalizing it',reason=>{const c=spec();c.inheritance={mode:'none',...(reason===undefined?{}:{reason})};const parsed=parseProjectArtSpec(JSON.parse(JSON.stringify(c)),projectId);expect(parsed.kind).toBe('project');if(parsed.kind!=='project')throw Error('unexpected legacy');expect(parsed.spec.inheritance).toEqual(c.inheritance);expect(Object.hasOwn(parsed.spec.inheritance,'reason')).toBe(reason!==undefined);expect(resolve(c).readyForGeneration).toBe(true);expect(resolve(c).values).toEqual(resolve(spec()).values)})
 it.each([null,42,false,' ',' leading','trailing ','bad\u0001text'])('does not treat malformed explanation %j as an optional omission',reason=>{const c=spec();Object.assign(c,{inheritance:{mode:'none',reason}});rejects('INVALID_CONFIG',()=>parseProjectArtSpec(c,projectId))})
 it('retains strict Canon use and required generation values without an independent explanation',()=>{const c=spec();c.inheritance={mode:'none'};delete c.overrides.width;rejects('REQUIRED_FIELD',()=>resolve(c));const pinned=inherited();if(pinned.inheritance.mode==='canon')delete pinned.inheritance.usage;rejects('SOURCE_USAGE_OUT_OF_SCOPE',()=>resolve(pinned,asset(),[authority()]))})
})
