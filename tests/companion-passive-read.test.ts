import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { createCompanionBrowserProvider, type CompanionFetch } from '../src/adapters/companion-browser'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { CompanionEventError, type CompanionEventHandlers } from '../src/domain/companion-live'

// Original v148 decoder contract, confirmed by the v150 host report: projects is
// a direct array, counts an object. Synthetic values are NOT live host evidence.
const project = { id:'fixture-v150',name:'离线合同工程',path:'D:\\fixture\\game',requiredCreatorVersion:'3.8.8' }
const counts = {sessionId:'fixture-session',counts:{'fixture-v150':0},latest:{}}
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
function fixture(){return vi.fn<CompanionFetch>(async path=>{
 if(path==='/api/projects')return json([project])
 if(path==='/api/calls/counts')return json(counts)
 if(path.startsWith('/api/logs?'))return json([])
 if(path.startsWith('/api/projects/fixture-v150/calls?'))return json({sessionId:'fixture-session',total:0,retained:0,records:[]})
 throw new Error('Forbidden endpoint in passive fixture')
})}
beforeEach(()=>{setActivePinia(createPinia());vi.useFakeTimers()})
afterEach(()=>{useCompanionBrowserStore().disconnect();vi.useRealTimers()})
function assertPassive(fetch:ReturnType<typeof fixture>){
 for(const [path,init] of fetch.mock.calls){
  expect(path).toMatch(/^\/api\/(?:projects(?:\/fixture-v150\/calls\?[^#]*)?|calls\/counts|logs\?[^#]*)$/)
  expect(init).toMatchObject({method:'GET',credentials:'same-origin',mode:'same-origin',redirect:'error'})
  expect(init.body).toBeUndefined();expect(new Headers(init.headers).get('authorization')).toBeNull()
 }
}
describe('passive readonly transport profile',()=>{
 it('constructs without requests; connect only gets registration then counts',async()=>{
  const fetch=fixture(),p=createCompanionBrowserProvider({fetch,runtimeProbes:false}),s=useCompanionBrowserStore()
  expect(fetch).not.toHaveBeenCalled();await s.connect(p)
  expect(fetch.mock.calls.map(([path])=>path)).toEqual(['/api/projects','/api/calls/counts'])
  expect(s.connected).toBe(true);expect(s.projects).toEqual([project]);expect(s.statuses).toEqual([]);expect(s.dashboard).toEqual([])
  expect(s.warnings.join('')).toContain('运行状态未探测');expect(p.runtimeProbesEnabled).toBe(false);assertPassive(fetch)
 })
 it('freezes the policy even if caller mutates construction options',async()=>{
  const fetch=fixture(),options={fetch,runtimeProbes:false},p=createCompanionBrowserProvider(options)
  options.runtimeProbes=true;await p.loadProjects();expect(fetch.mock.calls.map(([path])=>path)).toEqual(['/api/projects'])
 })
 it('manual refresh, log and call reads never probe status or Dashboard',async()=>{
  const fetch=fixture(),s=useCompanionBrowserStore();await s.connect(createCompanionBrowserProvider({fetch,runtimeProbes:false}))
  await s.refreshProjects();await s.refreshLogs();s.setCallContext(project.id,false);await s.loadCalls()
  expect(fetch.mock.calls.map(([path])=>path)).toEqual(['/api/projects','/api/calls/counts','/api/projects','/api/logs?limit=200','/api/projects/fixture-v150/calls?limit=50']);assertPassive(fetch)
 })
 it('visible polling, failed SSE, hide/resume never escalate to probes',async()=>{
  const fetch=fixture(),s=useCompanionBrowserStore();await s.connect(createCompanionBrowserProvider({fetch,runtimeProbes:false}))
  let handlers!:CompanionEventHandlers;const close=vi.fn()
  s.startLive({label:'fake stream',subscribe:h=>{handlers=h;return close}})
  handlers.onOpen();await flushPromises();await vi.advanceTimersByTimeAsync(0)
  handlers.onError(new CompanionEventError('invalid-frame'));await vi.advanceTimersByTimeAsync(3100)
  expect(s.liveState).toBe('failed');const before=fetch.mock.calls.length
  s.setLiveVisibility(false);await vi.advanceTimersByTimeAsync(10000);expect(fetch).toHaveBeenCalledTimes(before)
  s.setLiveVisibility(true);await vi.advanceTimersByTimeAsync(0);expect(fetch.mock.calls.length).toBeGreaterThan(before)
  s.cancelReads();const end=fetch.mock.calls.length;await vi.advanceTimersByTimeAsync(10000);expect(fetch).toHaveBeenCalledTimes(end);assertPassive(fetch)
 })
 it.each([401,403,404,500])('failed registration %s does not trigger probes or counts and clears old state',async status=>{
  const fetch=fixture(),s=useCompanionBrowserStore();await s.connect(createCompanionBrowserProvider({fetch,runtimeProbes:false}))
  fetch.mockImplementation(async()=>json({error:'failed'},status));fetch.mockClear();await s.refreshProjects()
  expect(s.connected).toBe(false);expect(s.projects).toEqual([]);expect(s.counts).toBeNull();expect(fetch.mock.calls.map(([path])=>path)).toEqual(['/api/projects']);assertPassive(fetch)
 })
 it('rejects wrapped projects instead of hiding a schema mismatch',async()=>{
  const fetch=vi.fn<CompanionFetch>(async()=>json({projects:[project]})),p=createCompanionBrowserProvider({fetch,runtimeProbes:false})
  await expect(p.loadProjects()).rejects.toMatchObject({code:'invalid-shape'});expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('accepts actual empty array only as zero registrations, without claiming zero services',async()=>{
  const p=createCompanionBrowserProvider({fetch:async()=>json([]),runtimeProbes:false});const v=await p.loadProjects()
  expect(v.projects).toEqual([]);expect(v.warnings.join('')).toContain('不代表工程已停止')
 })
 it('aborted request invokes no fallback probes',async()=>{
  const fetch=fixture(),a=new AbortController();a.abort();await expect(createCompanionBrowserProvider({fetch,runtimeProbes:false}).loadProjects(a.signal)).rejects.toMatchObject({code:'aborted'});expect(fetch).not.toHaveBeenCalled()
 })
})
