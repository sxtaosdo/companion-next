import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { orderedProjects, recentProjects } from '../src/domain/recent-projects'
import { useOverviewRecentProjects } from '../src/composables/use-overview-recent-projects'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { companionBrowserProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import type { CompanionBrowserProvider, DashboardProject } from '../src/domain/companion-browser'
const projects = Array.from({length:6},(_,i) => ({ id: `p${i}`, name: `工程${i}`, path: `D:/project/${i}` }))
const observed = (index: number, time?: number): DashboardProject => ({ path: `d:\\project\\${index}`, name: `工程${index}`, exists: true, source: 'dashboard', ...(time === undefined ? {} : {lastOpenedAt:time}) })
describe('actual recent order', () => {
 it.each([0,2,3,4,6])('caps %s actual projects without placeholders', n => expect(recentProjects(projects.slice(0,n),[])).toHaveLength(Math.min(n,4)))
 it('uses only actual profile timestamps with stable missing/tied ordering and Windows path matching', () => {
   const values=recentProjects(projects,[observed(2,30),observed(0,10),observed(1,30),observed(4),{...observed(5),lastOpenedAt:NaN}])
   expect(values.map(x=>x.project.id)).toEqual(['p1','p2','p0','p3'])
   expect(values.map(x=>x.lastOpenedAt)).toEqual([30,30,10,undefined])
 })
 it('never adds a discovered-only project or mutates registration order', () => {
   expect(recentProjects(projects,[{...observed(9),lastOpenedAt:999}]).map(x=>x.project.id)).toEqual(['p0','p1','p2','p3'])
   expect(projects[0]!.id).toBe('p0')
 })
})
let wrapper: VueWrapper | undefined, state: ReturnType<typeof useOverviewRecentProjects>
const Harness=defineComponent({setup(){ state=useOverviewRecentProjects(); return()=>h('div') }})
function api():CompanionBrowserProvider {return {label:'原来源', runtimeProbesEnabled:true, dashboardDiscoveryEnabled:false, loadDashboardProjects:vi.fn(async()=>[observed(1,20)]),loadProjects:vi.fn(),loadCounts:vi.fn(),loadLogs:vi.fn(),loadCalls:vi.fn()}}
beforeEach(()=>{setActivePinia(createPinia());vi.stubGlobal('fetch',vi.fn())})
afterEach(()=>{wrapper?.unmount();wrapper=undefined;companionBrowserProvider.value=null;companionProjectEntryProvider.value=null;vi.unstubAllGlobals()})
async function enter(source=api()) {registerCompanionBrowserProvider(source,undefined,{projectEntry:'read'});const directory=useCompanionBrowserStore();directory.provider=source;directory.connected=true;wrapper=mount(Harness);await flushPromises();return {source,directory}}
describe('bounded overview recent read',()=>{
 it('reads the existing Dashboard method once despite project polling and does not write or poll',async()=>{
   const {source,directory}=await enter();expect(source.loadDashboardProjects).toHaveBeenCalledTimes(1)
   directory.projectSnapshotRevision++;directory.projectSnapshotRevision++;await flushPromises()
   expect(source.loadDashboardProjects).toHaveBeenCalledTimes(1);expect(state.data.value[0]!.lastOpenedAt).toBe(20);expect(fetch).not.toHaveBeenCalled()
 })
 it.each(['paused','hidden','lane','passive'] as const)('does not read while %s',async kind=>{
   const source=api(),directory=useCompanionBrowserStore()
   if(kind==='paused') directory.livePreferred=false
   if(kind==='hidden') directory.liveVisible=false
   if(kind==='lane') useProjectOperationLaneStore().acquire('test')
   if(kind==='passive') Object.assign(source,{runtimeProbesEnabled:false})
   await enter(source);expect(source.loadDashboardProjects).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
 })
 it('reports unavailable recent data without manufacturing timestamps',async()=>{
   const source=api();source.loadDashboardProjects=vi.fn(async()=>{throw Error('failed')});await enter(source)
   expect(state.data.value).toEqual([]);expect(state.error.value).toContain('按稳定顺序')
 })
 it('replenishes a cancelled pending read once when visible and rejects its late reply',async()=>{
   let finish!:(value:DashboardProject[])=>void
   const source=api();source.loadDashboardProjects=vi.fn(()=>new Promise<DashboardProject[]>(resolve=>finish=resolve))
   const {directory}=await enter(source), first=finish
   directory.liveVisible=false;await flushPromises()
   source.loadDashboardProjects=vi.fn(async()=>[observed(2,55)])
   directory.liveVisible=true;await flushPromises()
   expect(source.loadDashboardProjects).toHaveBeenCalledTimes(1)
   first([observed(1,999)]);await flushPromises()
   expect(state.data.value[0]!.lastOpenedAt).toBe(55)
 })
 it.each(['lane','disconnect','source'] as const)('rejects a pending result after %s changes',async kind=>{
   let finish!:(value:DashboardProject[])=>void
   const source=api();source.loadDashboardProjects=vi.fn(()=>new Promise<DashboardProject[]>(resolve=>finish=resolve))
   const {directory}=await enter(source)
   if(kind==='lane') useProjectOperationLaneStore().acquire('test')
   if(kind==='disconnect') directory.disconnect()
   if(kind==='source') {const next=api();registerCompanionBrowserProvider(next,undefined,{projectEntry:'read'});directory.provider=next}
   finish([observed(1,999)]);await flushPromises()
   expect(state.data.value.some(item=>item.lastOpenedAt===999)).toBe(false)
 })
 it('aborts on departure and discards an uncooperative late response',async()=>{
   let finish!:(value:DashboardProject[])=>void
   const source=api();source.loadDashboardProjects=vi.fn(()=>new Promise<DashboardProject[]>(resolve=>finish=resolve));await enter(source)
   const signal=vi.mocked(source.loadDashboardProjects!).mock.calls[0]![0]!
   wrapper!.unmount();wrapper=undefined;expect(signal.aborted).toBe(true)
   finish([observed(1,99)]);await flushPromises();expect(state.data.value).toEqual([])
 })
})


describe('stable order across route visits', () => {
 it('orders all projects by real timestamps, with deterministic ties independent of API array order', () => {
   const profile = [observed(2,30), observed(1,30), observed(0,10)]
   const ids = (values: typeof projects) => orderedProjects(values, profile).map(item => item.project.id)
   expect(ids(projects)).toEqual(['p1','p2','p0','p3','p4','p5'])
   expect(ids([...projects].reverse())).toEqual(ids(projects))
 })
 it('restores same-source order immediately before the page-entry read resolves, then accepts real last-opened changes', async () => {
   const { source } = await enter()
   const first = recentProjects(projects, state.data.value).map(item => item.project.id)
   wrapper!.unmount(); wrapper = undefined
   let finish!: (items: DashboardProject[]) => void
   source.loadDashboardProjects = vi.fn(() => new Promise<DashboardProject[]>(resolve => finish = resolve))
   wrapper = mount(Harness)
   expect(recentProjects(projects, state.data.value).map(item => item.project.id)).toEqual(first)
   await flushPromises()
   finish([observed(4,40), observed(1,20)])
   await flushPromises()
   expect(recentProjects(projects, state.data.value).map(item => item.project.id)).toEqual(['p4','p1','p0','p2'])
 })
 it('retains prior ordering after a failed return read without inventing a new timestamp', async () => {
   const { source } = await enter()
   const previous = state.data.value
   wrapper!.unmount(); wrapper = undefined
   source.loadDashboardProjects = vi.fn(async () => { throw Error('failed') })
   wrapper = mount(Harness); await flushPromises()
   expect(state.data.value).toEqual(previous)
   expect(state.error.value).not.toBe('')
 })
 it.each(['source','session'] as const)('does not retain observations across a %s replacement while absent', async kind => {
   const { source, directory } = await enter()
   wrapper!.unmount(); wrapper = undefined
   const next = kind === 'source' ? api() : source
   if (kind === 'session') directory.disconnect()
   registerCompanionBrowserProvider(next, undefined, { projectEntry: 'read' })
   directory.provider = next; directory.connected = true
   next.loadDashboardProjects = vi.fn(() => new Promise<DashboardProject[]>(() => {}))
   wrapper = mount(Harness)
   expect(state.data.value).toEqual([])
 })
})


it('keeps retained recent order after actual equivalent project polling with changed runtime status', async () => {
 const directory = useCompanionBrowserStore(), source = api()
 directory.projects = projects.map(project => ({ ...project }))
 await enter(source)
 const previous = recentProjects(directory.projects, state.data.value).map(item => item.project.id)
 const identity = directory.projects
 source.loadProjects = vi.fn(async () => ({ projects: projects.map(project => ({ ...project })), statuses: [{ projectId: 'p0', state: 'ready' as const, capabilityProfile: 'unknown' as const }], dashboard: [], warnings: [] }))
 await directory.refreshProjects(true)
 expect(directory.projects).toBe(identity)
 wrapper!.unmount(); wrapper = undefined
 source.loadDashboardProjects = vi.fn(() => new Promise<DashboardProject[]>(() => {}))
 wrapper = mount(Harness)
 expect(recentProjects(directory.projects, state.data.value).map(item => item.project.id)).toEqual(previous)
})
