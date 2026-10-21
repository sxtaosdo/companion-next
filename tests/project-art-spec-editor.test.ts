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
    host.read = vi.fn(async () => { throw Error('private diagnostics') }); await store.read(); expect(store.message).not.toContain('private'); expect(store.phase).toBe('error'); store.confirmed = true; expect(store.canSave).toBe(false)
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
    store.base!.inheritance = { mode: 'canon', sources: [pin] }; expect(store.errors).toEqual(['INHERITANCE_CHANGE_REQUIRES_REVIEW']); expect(store.canSave).toBe(false)
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
    store.authorities = [{ source: pin, status: 'Accepted', kind: 'canon-interface', projectIds: [context.projectId], categories: ['icon'], locked: { materials: 'locked' }, defaults: {}, requiresImageReference: true }]
    store.draft!.inheritance = { mode: 'canon', sources: [pin] }; store.draft!.overrides.materials = 'unapproved'
    expect(store.errors.join()).toContain('LOCKED_OVERRIDE'); expect(store.canSave).toBe(false)
  })
})
