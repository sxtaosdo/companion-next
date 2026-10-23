import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import type { CompanionBrowserProvider, ProjectRead } from '../src/domain/companion-browser'
const id = 'aaaaaaaaaaaaaaaa'
const data = (): ProjectRead => ({ projects: [{ id, name: 'Test', path: '/offline/test' }], statuses: [{ projectId:id, state:'stopped', capabilityProfile:'authoring' }], dashboard:[], warnings:[] })
function deferred<T>() { let resolve!: (v:T)=>void, reject!: (e:unknown)=>void; const promise=new Promise<T>((ok,no)=>{resolve=ok;reject=no});return {promise,resolve,reject} }
async function setup() {
 const reader:CompanionBrowserProvider={label:'mock only',loadProjects:vi.fn(async()=>data()),loadCounts:vi.fn(async()=>({sessionId:'test',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn()}
 const run=vi.fn(async()=>({action:'start' as const,runtime:{projectId:id,state:'launching' as const,capabilityProfile:'authoring' as const}}))
 creatorOperationsProvider.value={label:'mock operation',run,waitForIdle:vi.fn(async()=>{})}
 const store=useCompanionBrowserStore(),ops=useCreatorOperationsStore();await store.connect(reader);return {store,ops,reader,run}
}
beforeEach(()=>setActivePinia(createPinia()))
afterEach(()=>{useCompanionBrowserStore().disconnect();creatorOperationsProvider.value=null})
it('retains list identity and freshness on an unchanged background observation',async()=>{
 const {store,reader}=await setup(),projects=store.projects,statuses=store.statuses,read=deferred<ProjectRead>();reader.loadProjects=()=>read.promise
 const pending=store.refreshProjects(true);expect(store.backgroundProjectRead).toBe(true);expect(store.projects).toBe(projects)
 read.resolve(data());await pending;expect(store.projects).toBe(projects);expect(store.statuses).toBe(statuses);expect(store.projectSnapshotRevision).toBe(2)
})
it('keeps failed evidence visibly stale and blocks writes, then recovers on a successful read',async()=>{
 const {store,ops,reader,run}=await setup(),projects=store.projects,time=store.observedAt;reader.loadProjects=async()=>{throw Error('offline')}
 await store.refreshProjects(true);expect(store.connected).toBe(false);expect(store.projectError).toContain('offline');expect(store.projects).toBe(projects);expect(store.observedAt).toBe(time)
 expect(ops.canPrepare(id,'start')).toBe(false);expect(await ops.direct(id,'start')).toBe(false);expect(run).not.toHaveBeenCalled()
 reader.loadProjects=async()=>data();await store.refreshProjects(true);expect(store.connected).toBe(true);expect(store.projectError).toBe('')
})
it('allows a background-read click but waits for its fresh unchanged result before one dispatch',async()=>{
 const {store,ops,reader,run}=await setup(),read=deferred<ProjectRead>();reader.loadProjects=()=>read.promise
 const reading=store.refreshProjects(true);expect(ops.canPrepare(id,'start')).toBe(true)
 const click=ops.direct(id,'start');expect(run).not.toHaveBeenCalled();expect(await ops.direct(id,'start')).toBe(false)
 read.resolve(data());await reading;expect(await click).toBe(true);expect(run).toHaveBeenCalledTimes(1);expect(ops.lastReceipt?.snapshotRevision).toBe(2)
})
it.each(['failure','changed','leave','disconnect'] as const)('never dispatches a waiting click after %s',async scenario=>{
 const {store,ops,reader,run}=await setup(),read=deferred<ProjectRead>();reader.loadProjects=()=>read.promise
 const reading=store.refreshProjects(true),click=ops.direct(id,'start')
 if(scenario==='leave')ops.leave();if(scenario==='disconnect')store.disconnect()
 if(scenario==='failure')read.reject(Error('offline'));else {const next=data();if(scenario==='changed')next.statuses[0]!.state='ready';read.resolve(next)}
 await reading;expect(await click).toBe(false);expect(run).not.toHaveBeenCalled()
})
it('keeps explicit reads guarded and revokes modal approval on a fresh snapshot',async()=>{
 const {store,ops,reader,run}=await setup(),read=deferred<ProjectRead>();reader.loadProjects=()=>read.promise
 const reading=store.refreshProjects();expect(ops.canPrepare(id,'start')).toBe(false);expect(await ops.direct(id,'start')).toBe(false)
 read.resolve(data());await reading;const next=deferred<ProjectRead>();reader.loadProjects=()=>next.promise;const polling=store.refreshProjects(true);const approval=ops.prepare(id,'open-folder');expect(approval).not.toBeNull();next.resolve(data());await polling;expect(ops.prepared).toBeNull();expect(await ops.send(approval,true)).toBe(false);expect(run).not.toHaveBeenCalled()
})

it.each(['provider','identity','lane'] as const)('blocks a waiting click after %s changes',async change=>{
 const {store,ops,reader,run}=await setup(),read=deferred<ProjectRead>();reader.loadProjects=()=>read.promise
 const reading=store.refreshProjects(true),click=ops.direct(id,'start');const next=data()
 if(change==='provider')creatorOperationsProvider.value={label:'replacement',run,waitForIdle:async()=>{}}
 if(change==='identity')next.projects[0]!.path='/offline/different'
 if(change==='lane')useProjectOperationLaneStore().acquire('other confirmed work')
 read.resolve(next);await reading;expect(await click).toBe(false);expect(run).not.toHaveBeenCalled()
})
