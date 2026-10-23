import { resourceView } from './fixtures/ai-resource-read'
// @ts-ignore Node test runtime provides webcrypto; no browser dependency or Node types required.
import { webcrypto } from 'node:crypto'
import { artBindingHash, pendingArtWrite } from '../src/domain/project-art-pending'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectArtSpecStore } from '../src/stores/project-art-spec'
import { ProjectArtSpecWriteError, type ProjectArtSpecContext, type ProjectArtSpecProvider, type ProjectArtSpecReceipt } from '../src/project-art-spec-integration'
import type { ProjectArtSpec } from '../src/domain/project-art-spec'
const source = {}, context: ProjectArtSpecContext = { projectId: '1234567890abcdef', projectPath: '/test/project', source }
const config = (): ProjectArtSpec => ({ schemaVersion: 'project-art-spec-v1', projectId: context.projectId, version: 1, project: { name: 'Project', content: 'Test project', engine: 'cocos-creator', designResolution: { width: 750, height: 1334 } }, inheritance: { mode: 'none', reason: 'Independent project' }, overrides: { width: 96, height: 96, transparent: true, destination: 'assets/art' }, categories: {} })
function receipt(next: ProjectArtSpec | null = config(), hash: string | null = 'a'.repeat(64)): ProjectArtSpecReceipt { return { projectId: context.projectId, projectPath: context.projectPath, config: next, hash, authorities: [] } }
function provider(): ProjectArtSpecProvider { return { label: 'test host', endpoint: 'http://127.0.0.1:32181', status: vi.fn(async () => { throw Error('unavailable') }), read: vi.fn(async () => receipt()), save: vi.fn(async (binding, input) => ({ ...receipt({ ...input.config, version: 2 }, 'b'.repeat(64)), operation: { operationId: input.operationId, bindingHash: await artBindingHash(binding.projectId, binding.projectPath, input), state: 'completed' as const } })) } }
async function setup() { const store = useProjectArtSpecStore(), host = provider(); store.bind(context, host); await store.read(); store.draft!.project.content = 'Changed content'; store.touch(); store.confirmed = true; return { store, host } }
beforeEach(() => { vi.stubGlobal('crypto',webcrypto); const data=new Map<string,string>();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value)},removeItem:(key:string)=>{data.delete(key)},clear:()=>data.clear()}}); setActivePinia(createPinia()) })
describe('project art editor real-provider boundary', () => {
  it('preselects reviewed style only for a new draft and preserves a saved independent spec',async()=>{
    const store=useProjectArtSpecStore(),host=provider(),pin={path:'P0001/art/master-style-reference.md',revision:'a'.repeat(40)};
    const authorities=[{source:pin,status:'Accepted' as const,kind:'art-style' as const,projectIds:[context.projectId],allowedUsages:['project-art' as const],categories:['icon' as const],locked:{palette:'青绿/橙/白'},defaults:{},requiresImageReference:true}];
    host.read=vi.fn(async()=>({...receipt(null,null),authorities}));store.bind(context,host);await store.read();store.startDraft('Project');
    expect(store.draft!.inheritance).toEqual({mode:'style',usage:'project-art',sources:[pin]});expect(store.draft!.overrides).not.toHaveProperty('palette');
    store.bind({...context,source:{}},host);host.read=vi.fn(async()=>({...receipt(),authorities}));await store.read();
    expect(store.base!.inheritance).toEqual(config().inheritance);expect(store.draft!.inheritance).toEqual(config().inheritance);
  })
  it('never accepts a completed save or recovered receipt with a removed explicit usage',async()=>{
    const {store,host}=await setup(),pin={path:'P0001/ip/canon_interface.md',revision:'a'.repeat(40)}
    store.authorities=[{source:pin,status:'Accepted',kind:'canon-interface',projectIds:[context.projectId],allowedUsages:['runtime'],categories:['icon'],locked:{},defaults:{},requiresImageReference:false}]
    store.draft!.inheritance={mode:'canon',usage:'runtime',sources:[pin]};store.confirmed=true
    let bad!:ProjectArtSpecReceipt
    host.save=vi.fn(async(binding,input)=>{
      const config={...input.config,version:2};if(config.inheritance.mode==='canon')config.inheritance={mode:'canon',sources:config.inheritance.sources}
      bad={...receipt(config,'b'.repeat(64)),authorities:store.authorities,operation:{operationId:input.operationId,bindingHash:await artBindingHash(binding.projectId,binding.projectPath,input),state:'completed'}};return bad
    })
    await store.save();expect(store.phase).toBe('unknown');expect(store.blocked).toBe(true);const frozen=pendingArtWrite(context,host)!
    host.status=vi.fn(async()=>({schemaVersion:'project-art-write-v1' as const,projectId:context.projectId,projectPath:context.projectPath,operationId:frozen.input.operationId,bindingHash:frozen.bindingHash,state:'completed' as const,receipt:bad}))
    await store.recover();expect(store.phase).toBe('unknown');expect(store.blocked).toBe(true);expect(host.save).toHaveBeenCalledOnce()
  })

  it('protects an existing explicit Canon usage while allowing an old unresolved usage to be explicitly completed',async()=>{
    const {store,host}=await setup();const pin={path:'P0001/ip/canteen-transport-interface.md',revision:'a'.repeat(40)}
    store.authorities=[{source:pin,status:'Accepted',kind:'canon-interface',projectIds:[context.projectId],categories:['icon'],allowedUsages:['runtime','shared-concept'],locked:{},defaults:{},requiresImageReference:false}]
    store.base!.inheritance={mode:'canon',usage:'shared-concept',sources:[pin]};store.draft!.inheritance={mode:'canon',usage:'runtime',sources:[pin]}
    expect(store.errors).toEqual(['INHERITANCE_CHANGE_REQUIRES_REVIEW']);await store.save();expect(host.save).not.toHaveBeenCalled()
    delete store.base!.inheritance.usage;delete store.draft!.inheritance.usage;expect(store.errors.join()).toContain('SOURCE_USAGE_OUT_OF_SCOPE')
    store.draft!.inheritance.usage='shared-concept';expect(store.errors).toEqual([])
    host.save=vi.fn(async(binding,input)=>({...receipt({...input.config,version:2},'b'.repeat(64)),authorities:store.authorities,operation:{operationId:input.operationId,bindingHash:await artBindingHash(binding.projectId,binding.projectPath,input),state:'completed' as const}}))
    store.confirmed=true;await store.save();expect(store.phase).toBe('saved')
    const input=vi.mocked(host.save).mock.calls[0]![1];expect(input.config.inheritance).toMatchObject({usage:'shared-concept'})
  })

  it('explicitly migrates the observed legacy version/hash and recovers a lost original receipt without replay', async () => {
    const store = useProjectArtSpecStore(), host = provider(), legacy = { ...resourceView(context.projectId).config!, version: 7 }
    host.read = vi.fn(async () => ({ ...receipt(), config: legacy }))
    store.bind(context, host); await store.read(); store.startDraft('Project'); store.draft = config()
    store.confirmed = false; await store.save(); expect(host.save).not.toHaveBeenCalled()
    let completed!: ProjectArtSpecReceipt
    host.save = vi.fn(async (binding,input) => {
      expect(input).toMatchObject({ migrateLegacy:true, expectedHash:'a'.repeat(64), approved:true })
      completed={...receipt({...input.config,version:8},'b'.repeat(64)),operation:{operationId:input.operationId,bindingHash:await artBindingHash(binding.projectId,binding.projectPath,input),state:'completed'}}
      throw Error('lost after durable migration')
    })
    store.confirmed=true; await store.save();expect(store.phase).toBe('unknown')
    const frozen=pendingArtWrite(context,host)!;expect(frozen.baseVersion).toBe(7);expect(frozen.input.migrateLegacy).toBe(true)
    host.status=vi.fn(async()=>({schemaVersion:'project-art-write-v1' as const,projectId:context.projectId,projectPath:context.projectPath,operationId:frozen.input.operationId,bindingHash:frozen.bindingHash,state:'completed' as const,receipt:completed}))
    setActivePinia(createPinia());const restored=useProjectArtSpecStore();restored.bind({...context,source:{}},host);await restored.read()
    expect(restored.phase).toBe('saved');expect(restored.base?.version).toBe(8);expect(restored.legacyVersion).toBeNull();expect(host.save).toHaveBeenCalledOnce();expect(host.status).toHaveBeenCalledOnce()
  })

  it('never saves a local candidate without provider or confirmed file read', async () => {
    const store = useProjectArtSpecStore(); store.bind(context, null); store.startDraft('Project'); store.draft = config(); store.confirmed = true
    expect(store.canSave).toBe(false); await store.save(); expect(store.phase).not.toBe('saved')
  })
  it('saves only after explicit approval and checks hash, version, and returned content', async () => {
    const { store, host } = await setup(); store.confirmed = false; await store.save(); expect(host.save).not.toHaveBeenCalled()
    store.confirmed = true; await store.save(); expect(host.save).toHaveBeenCalledOnce(); expect(host.save).toHaveBeenCalledWith(context, expect.objectContaining({ expectedHash: 'a'.repeat(64), approved: true }), expect.any(AbortSignal))
    expect(store.phase).toBe('saved'); expect(store.base?.version).toBe(2); expect(store.confirmed).toBe(false)
  })
  it('allows new save only after explicit missing receipt, not a read error', async () => {
    const store = useProjectArtSpecStore(), host = provider(); host.read = vi.fn(async () => receipt(null, null)); store.bind(context, host); await store.read(); store.startDraft('Project'); store.draft = config(); store.confirmed = true
    expect(store.canSave).toBe(true)
    host.read = vi.fn(async () => { throw Error('private diagnostics') }); await store.read(); expect(host.read).not.toHaveBeenCalled(); expect(store.draft).not.toBeNull()
    // Refresh preserves an unsaved draft. A clean read failure must still invalidate the save baseline.
    store.draft = null; await store.read(); expect(store.message).not.toContain('private'); expect(store.phase).toBe('error'); store.confirmed = true; expect(store.canSave).toBe(false)
  })
  it('keeps unknown fence after readback and prevents a repeated write', async () => {
    const { store, host } = await setup(); host.save = vi.fn(async () => { throw Error('private token') }); await store.save()
    expect(store.phase).toBe('unknown'); expect(store.blocked).toBe(true); expect(store.message).not.toContain('private')
    await store.read(); store.confirmed = true; expect(store.blocked).toBe(true); await store.save(); expect(host.save).toHaveBeenCalledOnce()
  })
  it.each(['not-sent'] as const)('does not label explicit %s as saved', async outcome => {
    const { store, host } = await setup(); host.save = vi.fn(async () => { throw new ProjectArtSpecWriteError(outcome) }); await store.save()
    expect(store.phase).toBe('error'); expect(store.blocked).toBe(false); expect(store.confirmed).toBe(false)
  })
  it('rejects a response for another project and preserves unknown', async () => {
    const { store, host } = await setup(); host.save = vi.fn(async () => ({ ...receipt(), projectPath: '/other' })); await store.save(); expect(store.phase).toBe('unknown'); expect(store.blocked).toBe(true)
  })
  it('does not accept a late success after project/source/provider changes', async () => {
    const { store, host } = await setup(); let finish!: (value: ProjectArtSpecReceipt) => void
    host.save = vi.fn(() => new Promise<ProjectArtSpecReceipt>(resolve => { finish = resolve })); const writing = store.save()
    await vi.waitFor(()=>expect(host.save).toHaveBeenCalledOnce()); store.bind({ ...context, source: {} }, host); finish(receipt({ ...config(), project: { ...config().project, content: 'Changed content' }, version: 2 }, 'b'.repeat(64))); await writing
    expect(store.phase).not.toBe('saved'); store.bind(context, host); expect(store.blocked).toBe(true); expect(store.phase).toBe('unknown')
  })
  it('does not clear unknown on unmount or leak a draft into another project', async () => {
    const { store, host } = await setup(); host.save = vi.fn(async () => { throw new ProjectArtSpecWriteError('unknown') }); await store.save(); store.leave()
    store.bind({ ...context, projectId: 'ffffffffffffffff', projectPath: '/other' }, host); expect(store.draft).toBeNull(); store.bind(context, host); expect(store.blocked).toBe(true)
  })
  it('cannot remove existing fixed Canon sources to escape locks', async () => {
    const { store } = await setup(); const pin = { path: 'P0001/ip/canteen-transport-interface.md', revision: 'a'.repeat(40) }
    store.base!.inheritance = { mode: 'canon', usage: 'runtime', sources: [pin] }; expect(store.errors).toEqual(['INHERITANCE_CHANGE_REQUIRES_REVIEW']); expect(store.canSave).toBe(false)
  })
  it('preserves UNKNOWN across source recreation, new provider and a fresh Pinia; only polls the original status', async () => {
    const {store,host}=await setup();host.save=vi.fn(async()=>{throw Error('lost response')});await store.save()
    const frozen=pendingArtWrite(context,host)!;expect(frozen).not.toBeNull()
    store.bind({...context,source:{}},host);expect(store.blocked).toBe(true)
    setActivePinia(createPinia());const restored=useProjectArtSpecStore(), reconnected=provider()
    reconnected.status=vi.fn(async()=>({schemaVersion:'project-art-write-v1' as const,projectId:context.projectId,projectPath:context.projectPath,operationId:frozen.input.operationId,bindingHash:frozen.bindingHash,state:'pending' as const}))
    restored.bind({...context,source:{}},reconnected);expect(restored.blocked).toBe(true);await restored.read();expect(reconnected.read).not.toHaveBeenCalled();expect(reconnected.save).not.toHaveBeenCalled();expect(reconnected.status).toHaveBeenCalledOnce();expect(restored.blocked).toBe(true)
    reconnected.status=vi.fn(async()=>({schemaVersion:'project-art-write-v1' as const,projectId:context.projectId,projectPath:context.projectPath,operationId:frozen.input.operationId,bindingHash:frozen.bindingHash,state:'completed' as const,receipt:{...receipt({...frozen.input.config,version:2},'b'.repeat(64)),operation:{operationId:frozen.input.operationId,bindingHash:frozen.bindingHash,state:'completed' as const}}}))
    await restored.recover();expect(restored.phase).toBe('saved');expect(restored.blocked).toBe(false);expect(reconnected.save).not.toHaveBeenCalled()
  })
  it('foreign operation status and missing status never clear the fence', async()=>{
    const {store,host}=await setup();host.save=vi.fn(async()=>{throw Error()});await store.save();const frozen=pendingArtWrite(context,host)!
    host.status=vi.fn(async()=>({schemaVersion:'project-art-write-v1' as const,projectId:context.projectId,projectPath:context.projectPath,operationId:frozen.input.operationId,bindingHash:'f'.repeat(64),state:'rejected' as const}))
    await store.recover();expect(store.blocked).toBe(true);expect(store.phase).toBe('unknown')
    host.status=vi.fn(async()=>{throw Error('404')});await store.recover();expect(store.blocked).toBe(true);expect(host.save).toHaveBeenCalledOnce()
  })
  it('does not dispatch if the browser cannot durably freeze the operation',async()=>{
    const {store,host}=await setup();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{throw Error('quota')},removeItem:()=>{}}})
    await store.save();expect(host.save).not.toHaveBeenCalled();expect(store.phase).toBe('error')
  })
  it('does not permit locks to be overridden through direct draft mutation', async () => {
    const { store } = await setup(); const pin = { path: 'P0001/ip/canteen-transport-interface.md', revision: 'a'.repeat(40) }
    store.authorities = [{ source: pin, status: 'Accepted', kind: 'canon-interface', allowedUsages: ['runtime'], projectIds: [context.projectId], categories: ['icon'], locked: { materials: 'locked' }, defaults: {}, requiresImageReference: true }]
    store.draft!.inheritance = { mode: 'canon', usage: 'runtime', sources: [pin] }; store.draft!.overrides.materials = 'unapproved'
    expect(store.errors.join()).toContain('LOCKED_OVERRIDE'); expect(store.canSave).toBe(false)
  })
})


describe('optional explanation exact write and recovery binding',()=>{
 it.each([undefined,'','Existing explanation'])('saves, reads and recovers explanation %s without canonical drift',async(reason)=>{
  const {store,host}=await setup();store.draft!.inheritance={mode:'none',...(reason===undefined?{}:{reason})};store.touch();store.confirmed=true;expect(store.errors).toEqual([]);await store.save();expect(store.phase).toBe('saved');const saved=structuredClone(JSON.parse(JSON.stringify(store.base!))) as ProjectArtSpec;expect(saved.inheritance).toEqual({mode:'none',...(reason===undefined?{}:{reason})});host.read=vi.fn(async()=>receipt(saved,'b'.repeat(64)));await store.read();expect(store.base!.inheritance).toEqual(saved.inheritance);
  store.draft!.project.content='Second local edit';store.touch();store.confirmed=true;let completed!:ProjectArtSpecReceipt;host.save=vi.fn(async(binding,input)=>{completed={...receipt({...input.config,version:3},'c'.repeat(64)),operation:{operationId:input.operationId,bindingHash:await artBindingHash(binding.projectId,binding.projectPath,input),state:'completed'}};throw new ProjectArtSpecWriteError('unknown')});await store.save();expect(store.phase).toBe('unknown');const frozen=pendingArtWrite(context,host)!;host.status=vi.fn(async()=>({schemaVersion:'project-art-write-v1' as const,projectId:context.projectId,projectPath:context.projectPath,operationId:frozen.input.operationId,bindingHash:frozen.bindingHash,state:'completed' as const,receipt:completed}));await store.recover();expect(store.phase).toBe('saved');expect(store.base!.inheritance).toEqual(saved.inheritance);expect(host.save).toHaveBeenCalledOnce();
 })
})

describe('new art output policy and compatible project drafts', () => {
  it('starts only missing new files with real safe directories and transparent policy, without asset sizes or categories',async()=>{
    const store=useProjectArtSpecStore(),host=provider();host.read=vi.fn(async()=>receipt(null,null));host.save=vi.fn(async(binding,input)=>({...receipt({...input.config,version:1},'b'.repeat(64)),operation:{operationId:input.operationId,bindingHash:await artBindingHash(binding.projectId,binding.projectPath,input),state:'completed' as const}}));store.bind(context,host);await store.read();store.startDraft('New project')
    expect(store.draft).toMatchObject({imageOutput:'transparent-png',overrides:{destination:'assets/art',exportDirectory:'art/final',transparent:true},categories:{}})
    expect(store.draft!.overrides).not.toHaveProperty('width');expect(store.draft!.overrides).not.toHaveProperty('height');expect(store.draft!.project).not.toHaveProperty('visualMode')
    store.draft!.project.content='Independent project';store.draft!.project.visualMode='3d';store.draft!.project.designResolution={width:750,height:1334};store.touch();store.confirmed=true
    expect(store.errors).toEqual([]);await store.save();expect(store.phase).toBe('saved');expect(store.base!.project.visualMode).toBe('3d');expect(store.base!.imageOutput).toBe('transparent-png')
    host.read=vi.fn(async()=>receipt(store.base));await store.read();expect(store.draft!.imageOutput).toBe('transparent-png')
  })
  it('retains old opaque legacy values and never silently upgrades their image policy',async()=>{
    const store=useProjectArtSpecStore(),host=provider(),legacy={...resourceView(context.projectId).config!,background:{format:'png' as const,transparent:false,color:'#123456'}}
    host.read=vi.fn(async()=>({...receipt(),config:legacy}));store.bind(context,host);await store.read();store.startDraft('Existing legacy')
    expect(store.draft).not.toHaveProperty('imageOutput');expect(store.draft!.overrides).toMatchObject({transparent:false,backgroundColor:'#123456',destination:legacy.destination.directory,exportDirectory:'art/final/icons'})
    expect(store.draft!.project).not.toHaveProperty('visualMode')
  })
  it('keeps new metadata through ambiguous save recovery and project-isolated drafts',async()=>{
    const {store,host}=await setup();store.draft!.project.visualMode='2d';store.draft!.imageOutput='transparent-png';store.touch();store.confirmed=true
    let completed!:ProjectArtSpecReceipt;host.save=vi.fn(async(binding,input)=>{completed={...receipt({...input.config,version:2},'b'.repeat(64)),operation:{operationId:input.operationId,bindingHash:await artBindingHash(binding.projectId,binding.projectPath,input),state:'completed'}};throw new ProjectArtSpecWriteError('unknown')})
    await store.save();expect(store.phase).toBe('unknown');const frozen=pendingArtWrite(context,host)!
    host.status=vi.fn(async()=>({schemaVersion:'project-art-write-v1' as const,projectId:context.projectId,projectPath:context.projectPath,operationId:frozen.input.operationId,bindingHash:frozen.bindingHash,state:'completed' as const,receipt:completed}));await store.recover()
    expect(store.phase).toBe('saved');expect(store.base).toMatchObject({imageOutput:'transparent-png',project:{visualMode:'2d'}})
    store.draft!.project.content='Retained';store.touch();store.bind({...context,projectId:'ffffffffffffffff',projectPath:'/different'},host);expect(store.draft).toBeNull();store.bind(context,host);store.restoreRetained();expect(store.draft).toMatchObject({imageOutput:'transparent-png',project:{visualMode:'2d',content:'Retained'}})
    expect(host.save).toHaveBeenCalledOnce()
  })
  it('blocks opaque changes under the new policy before writing',async()=>{
    const {store,host}=await setup();store.draft!.imageOutput='transparent-png';store.setValue('icon','transparent',false);store.confirmed=true
    expect(store.errors.join(' ')).toContain('IMAGE_OUTPUT_POLICY_CONFLICT');await store.save();expect(host.save).not.toHaveBeenCalled()
  })
})

describe('trusted inheritance resolution freshness',()=>{
  it('does not infer applicability on old hosts and clears metadata on project change/read failure',async()=>{
    const {store,host}=await setup();expect(store.inheritanceResolution).toBeNull()
    store.draft=null;host.read=vi.fn(async()=>({...receipt(),inheritanceResolution:{state:'not-applicable' as const,code:'EXPLICIT_NOT_APPLICABLE' as const,sources:[]}}));await store.read();expect(store.inheritanceResolution?.state).toBe('not-applicable')
    host.read=vi.fn(async()=>{throw Error('offline')});await store.read();expect(store.inheritanceResolution).toBeNull()
    store.bind({...context,projectPath:'/other'},host);expect(store.inheritanceResolution).toBeNull()
  })
  it('uses the saved receipt rather than stale prior applicability',async()=>{
    const {store,host}=await setup();host.save=vi.fn(async(binding,input)=>({...receipt({...input.config,version:2},'b'.repeat(64)),inheritanceResolution:{state:'available' as const,code:'REVIEWED_SOURCES_AVAILABLE' as const,sources:[{path:'P0001/art/source.md',revision:'a'.repeat(40)}]},operation:{operationId:input.operationId,bindingHash:await artBindingHash(binding.projectId,binding.projectPath,input),state:'completed' as const}}))
    await store.save();expect(store.phase).toBe('saved');expect(store.inheritanceResolution?.state).toBe('available')
  })
})
