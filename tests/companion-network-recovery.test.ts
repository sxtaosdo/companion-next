import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { CompanionBrowserError } from '../src/adapters/companion-browser'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import type { CompanionBrowserProvider, ProjectRead } from '../src/domain/companion-browser'
import { CompanionEventError, type CompanionEventHandlers, type CompanionEventProvider } from '../src/domain/companion-live'
const snapshot: ProjectRead = { projects: [{ id:'p1',name:'One',path:'/fixture' }],statuses:[{projectId:'p1',state:'ready',capabilityProfile:'authoring'}],dashboard:[],warnings:[] }
async function setup() {
 const provider: CompanionBrowserProvider = {label:'offline',loadProjects:vi.fn(async()=>structuredClone(snapshot)),loadCounts:vi.fn(async()=>({sessionId:'s1',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'s1',total:0,retained:0,records:[]}))}
 const channels: Array<{handlers:CompanionEventHandlers;signal?:AbortSignal}> = []
 const events: CompanionEventProvider = {label:'offline events',subscribe(handlers,signal){channels.push({handlers,signal});return vi.fn()}}
 const store=useCompanionBrowserStore();await store.connect(provider);store.startLive(events);channels[0]!.handlers.onOpen();await flushPromises();await vi.advanceTimersByTimeAsync(0)
 return {provider,store,events,channels}
}
beforeEach(()=>{setActivePinia(createPinia());vi.useFakeTimers()})
afterEach(()=>{useCompanionBrowserStore().disconnect();vi.useRealTimers()})
it.each(['network-error','timeout'] as const)('recovers a background %s with stale evidence retained and no lost realtime intent',async code=>{
 const {provider,store,channels}=await setup();vi.mocked(provider.loadProjects).mockRejectedValueOnce(new CompanionBrowserError(code,'projects'))
 await vi.advanceTimersByTimeAsync(3000)
 expect(store.liveEnabled).toBe(true);expect(store.connected).toBe(false);expect(store.projects).toEqual(snapshot.projects);expect(store.statuses).toEqual(snapshot.statuses);expect(store.observedAt).not.toBe('');expect(store.projectError).not.toBe('');expect(store.liveState).toBe('retrying');expect(channels[0]!.signal?.aborted).toBe(true)
 const reads=vi.mocked(provider.loadProjects).mock.calls.length;await vi.advanceTimersByTimeAsync(2999);expect(provider.loadProjects).toHaveBeenCalledTimes(reads)
 await vi.advanceTimersByTimeAsync(1);expect(store.connected).toBe(true);expect(store.statuses[0]?.state).toBe('ready');expect(channels).toHaveLength(2);expect(provider.loadProjects).toHaveBeenCalledTimes(reads+1)
 channels[0]!.handlers.onLog();channels[0]!.handlers.onOpen();expect(channels).toHaveLength(2)
})
it('bounds recovery to three serial attempts and requires explicit action after exhaustion',async()=>{
 const {provider,store,channels}=await setup();vi.mocked(provider.loadProjects).mockRejectedValue(new CompanionBrowserError('network-error','projects'));const before=vi.mocked(provider.loadProjects).mock.calls.length
 await vi.advanceTimersByTimeAsync(3000*10);expect(provider.loadProjects).toHaveBeenCalledTimes(before+4);expect(store.connected).toBe(false);expect(store.liveEnabled).toBe(false);expect(store.liveState).toBe('failed');expect(channels).toHaveLength(1);expect(vi.getTimerCount()).toBe(0)
})
it.each(['forbidden','invalid-shape'] as const)('does not recover hard project failure %s',async code=>{
 const {provider,store}=await setup();vi.mocked(provider.loadProjects).mockRejectedValueOnce(new CompanionBrowserError(code,'projects'));await vi.advanceTimersByTimeAsync(3000);expect(store.liveEnabled).toBe(false);expect(store.connected).toBe(false);expect(store.projects).toEqual(snapshot.projects);expect(store.projectError).not.toBe('');expect(vi.getTimerCount()).toBe(0)
})
it.each(['stop','replace'] as const)('cancels pending network recovery on %s',async action=>{
 const {provider,store,channels}=await setup();vi.mocked(provider.loadProjects).mockRejectedValueOnce(new CompanionBrowserError('network-error','projects'));await vi.advanceTimersByTimeAsync(3000);const reads=vi.mocked(provider.loadProjects).mock.calls.length
 if(action==='stop')store.stopLive();else store.provider={...provider,label:'replacement'}
 await vi.advanceTimersByTimeAsync(30_000);expect(provider.loadProjects).toHaveBeenCalledTimes(reads);expect(channels).toHaveLength(1);expect(vi.getTimerCount()).toBe(0)
})
it('suspends network recovery while hidden or away and resumes one finite attempt on return',async()=>{
 const {provider,store,channels}=await setup();vi.mocked(provider.loadProjects).mockRejectedValueOnce(new CompanionBrowserError('network-error','projects'));await vi.advanceTimersByTimeAsync(3000);const reads=vi.mocked(provider.loadProjects).mock.calls.length
 store.setLiveVisibility(false);store.setLivePageActive(false);await vi.advanceTimersByTimeAsync(30_000);expect(provider.loadProjects).toHaveBeenCalledTimes(reads);expect(vi.getTimerCount()).toBe(0)
 store.setLiveVisibility(true);await vi.advanceTimersByTimeAsync(0);expect(provider.loadProjects).toHaveBeenCalledTimes(reads)
 store.setLivePageActive(true);await vi.advanceTimersByTimeAsync(0);expect(provider.loadProjects).toHaveBeenCalledTimes(reads+1);expect(channels).toHaveLength(2)
})
it('keeps recovery reads serial and preserves confirmation polling pause',async()=>{
 const {provider,store}=await setup();vi.mocked(provider.loadProjects).mockRejectedValueOnce(new CompanionBrowserError('network-error','projects'));await vi.advanceTimersByTimeAsync(3000)
 store.pauseProjectPolling(true);const reads=vi.mocked(provider.loadProjects).mock.calls.length;await vi.advanceTimersByTimeAsync(30_000);expect(provider.loadProjects).toHaveBeenCalledTimes(reads)
 let resolve!:(value:ProjectRead)=>void;vi.mocked(provider.loadProjects).mockImplementationOnce(()=>new Promise(done=>{resolve=done}));store.pauseProjectPolling(false);await vi.advanceTimersByTimeAsync(3000);expect(provider.loadProjects).toHaveBeenCalledTimes(reads+1)
 await vi.advanceTimersByTimeAsync(30_000);expect(provider.loadProjects).toHaveBeenCalledTimes(reads+1);resolve(structuredClone(snapshot));await flushPromises();expect(store.connected).toBe(true)
})
it('handles SSE failure before project network failure and rejects a late recovery after explicit stop',async()=>{
 const {provider,store,channels}=await setup();channels[0]!.handlers.onError(new CompanionEventError('connection-error'));vi.mocked(provider.loadProjects).mockRejectedValueOnce(new CompanionBrowserError('network-error','projects'));await vi.advanceTimersByTimeAsync(3000)
 let resolve!:(value:ProjectRead)=>void;vi.mocked(provider.loadProjects).mockImplementationOnce(()=>new Promise(done=>{resolve=done}));await vi.advanceTimersByTimeAsync(3000);store.stopLive();const streams=channels.length;resolve(structuredClone(snapshot));await flushPromises();expect(store.connected).toBe(false);expect(store.statuses).toEqual(snapshot.statuses);expect(store.projectError).not.toBe('');expect(channels).toHaveLength(streams);expect(vi.getTimerCount()).toBe(0)
})
it('does not revive an SSE protocol failure after project network recovery',async()=>{
 const {provider,store,channels}=await setup();channels[0]!.handlers.onError(new CompanionEventError('invalid-frame'));vi.mocked(provider.loadProjects).mockRejectedValueOnce(new CompanionBrowserError('network-error','projects'));await vi.advanceTimersByTimeAsync(3000);await vi.advanceTimersByTimeAsync(3000);expect(store.connected).toBe(true);expect(store.liveState).toBe('failed');expect(channels).toHaveLength(1)
})

