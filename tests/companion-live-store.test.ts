import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import type { CompanionBrowserProvider, ProjectRead, CallCounts, CallPage, CallRecord } from '../src/domain/companion-browser'
import { CompanionEventError, type CompanionEventHandlers, type CompanionEventProvider } from '../src/domain/companion-live'
const project:ProjectRead={projects:[{id:'p1',name:'测试工程',path:'/fixture'},{id:'p2',name:'另一工程',path:'/fixture2'}],statuses:[],dashboard:[],warnings:[]}
const record=(sequence=2,status:CallRecord['status']='running'):CallRecord=>({id:`r${sequence}`,sequence,projectId:'p1',operation:'read',operationNameZh:'读取',source:'web',startedAt:'2026-10-13T00:00:00Z',status,inputSummary:'{}',...(status==='running'?{}:{durationMs:2,resultSummary:'done'})})
const counts=(n=1):CallCounts=>({sessionId:'s1',counts:{p1:n},latest:{p1:{id:`r${n}`,operationNameZh:'读取',startedAt:'2026-10-13T00:00:00Z',status:'running'}}})
const page=(n=1):CallPage=>({sessionId:'s1',total:n,retained:n,records:[record(n)]})
function fixture():CompanionBrowserProvider{return {label:'OFFLINE',loadProjects:vi.fn(async()=>structuredClone(project)),loadCounts:vi.fn(async()=>counts()),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>page())}}
function stream(){const channels:Array<{handlers:CompanionEventHandlers;signal:AbortSignal|undefined;close:ReturnType<typeof vi.fn>}> = [];const provider:CompanionEventProvider={label:'OFFLINE EVENTS',subscribe:vi.fn((handlers,signal)=>{const close=vi.fn();channels.push({handlers,signal,close});return close})};return {provider,channels,latest:()=>channels.at(-1)!.handlers}}
function defer<T>(){let resolve!:(v:T)=>void;let reject!:(v:unknown)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j});return {resolve,reject,promise}}
async function setup(){const p=fixture(),e=stream(),s=useCompanionBrowserStore();await s.connect(p);return {p,e,s}}
async function settle(){await flushPromises()}
beforeEach(()=>{setActivePinia(createPinia());vi.useFakeTimers()})
afterEach(()=>{useCompanionBrowserStore().disconnect();vi.useRealTimers()})
describe('visible Companion polling and bounded SSE lifecycle',()=>{
 it('suspends page reads idempotently, preserves intent and resumes one stream and poll',async()=>{const {p,e,s}=await setup();s.startLive(e.provider);e.latest().onOpen();await settle();await vi.advanceTimersByTimeAsync(0);const reads=vi.mocked(p.loadProjects).mock.calls.length;s.suspendReads();s.suspendReads();expect(s.liveEnabled).toBe(true);expect(s.liveState).toBe('suspended');expect(e.channels[0]!.close).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);await vi.advanceTimersByTimeAsync(20000);expect(p.loadProjects).toHaveBeenCalledTimes(reads);s.reconcileLiveProvider(e.provider);s.setLiveVisibility(true);s.setLivePageActive(true);s.setLivePageActive(true);expect(e.channels).toHaveLength(2);await vi.advanceTimersByTimeAsync(0);expect(p.loadProjects).toHaveBeenCalledTimes(reads+1);s.stopLive();expect(vi.getTimerCount()).toBe(0)})
 it('keeps explicit stop while away and rejects a replaced event provider before return',async()=>{const {p,e,s}=await setup();s.startLive(e.provider);s.suspendReads();s.stopLive();s.setLiveVisibility(true);s.setLivePageActive(true);expect(s.liveEnabled).toBe(false);expect(e.channels).toHaveLength(1);expect(vi.getTimerCount()).toBe(0);s.startLive(e.provider);s.suspendReads();s.reconcileLiveProvider(stream().provider);s.setLiveVisibility(true);s.setLivePageActive(true);expect(s.liveEnabled).toBe(false);expect(e.channels).toHaveLength(2);expect(p.loadProjects).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0)})
 it('does not reset exhausted event failures during navigation suspension',async()=>{const {e,s}=await setup();s.startLive(e.provider);e.latest().onError(new CompanionEventError('invalid-frame'));s.suspendReads();s.reconcileLiveProvider(e.provider);s.setLiveVisibility(true);s.setLivePageActive(true);expect(s.liveState).toBe('failed');expect(e.channels).toHaveLength(1);s.stopLive();expect(vi.getTimerCount()).toBe(0)})

 it('does not subscribe until both read connection and explicit realtime action',async()=>{const e=stream(),s=useCompanionBrowserStore();s.startLive(e.provider);expect(e.channels).toHaveLength(0);const p=fixture();await s.connect(p);await vi.advanceTimersByTimeAsync(20000);expect(e.channels).toHaveLength(0);expect(p.loadProjects).toHaveBeenCalledTimes(1);s.startLive(e.provider);expect(e.channels).toHaveLength(1)})
 it('polls serially with a full interval after completion and coalesces manual refresh while busy',async()=>{const {p,e,s}=await setup(),pending=defer<ProjectRead>();p.loadProjects=vi.fn().mockImplementationOnce(()=>pending.promise).mockResolvedValue(project);s.startLive(e.provider);await vi.advanceTimersByTimeAsync(0);await s.refreshProjects();await vi.advanceTimersByTimeAsync(7000);expect(p.loadProjects).toHaveBeenCalledTimes(1);pending.resolve(project);await settle();await vi.advanceTimersByTimeAsync(2999);expect(p.loadProjects).toHaveBeenCalledTimes(1);await vi.advanceTimersByTimeAsync(1);expect(p.loadProjects).toHaveBeenCalledTimes(2)})
 it('closes and cancels on hide, rejects late events and resumes with a new snapshot',async()=>{const {p,e,s}=await setup();s.startLive(e.provider);const old=e.channels[0]!;old.handlers.onOpen();await settle();s.setLiveVisibility(false);expect(old.signal?.aborted).toBe(true);expect(old.close).toHaveBeenCalledTimes(1);const before=vi.mocked(p.loadProjects).mock.calls.length;old.handlers.onCall({sessionId:'stale',total:2,record:record()});await vi.advanceTimersByTimeAsync(20000);expect(p.loadProjects).toHaveBeenCalledTimes(before);expect(s.sessionId).toBe('s1');expect(s.liveState).toBe('suspended');s.setLiveVisibility(true);expect(e.channels).toHaveLength(2);await vi.advanceTimersByTimeAsync(0);expect(p.loadProjects).toHaveBeenCalledTimes(before+1)})
 it('can enable while hidden without starting either transport',async()=>{const {p,e,s}=await setup();s.setLiveVisibility(false);s.startLive(e.provider);await vi.advanceTimersByTimeAsync(10000);expect(e.channels).toHaveLength(0);expect(p.loadProjects).toHaveBeenCalledTimes(1);s.setLiveVisibility(true);expect(e.channels).toHaveLength(1)})
 it.each(['stop','disconnect','leave','replace'] as const)('invalidates callbacks and timers on %s',async action=>{const {p,e,s}=await setup();s.startLive(e.provider);const old=e.channels[0]!;if(action==='stop')s.stopLive();if(action==='disconnect')s.disconnect();if(action==='leave')s.cancelReads();if(action==='replace')s.provider=fixture();old.handlers.onOpen();old.handlers.onCall({sessionId:'old',total:2,record:record()});await vi.advanceTimersByTimeAsync(20000);expect(e.channels).toHaveLength(1);expect(p.loadProjects).toHaveBeenCalledTimes(1);expect(s.liveEnabled).toBe(false);expect(s.sessionId).not.toBe('old');expect(old.signal?.aborted).toBe(true)})
 it('failure of required project read closes realtime and clears stale state',async()=>{const {p,e,s}=await setup();p.loadProjects=vi.fn(async()=>{throw new Error('project read failed')});s.startLive(e.provider);await vi.advanceTimersByTimeAsync(0);expect(s.connected).toBe(false);expect(s.liveEnabled).toBe(false);expect(s.projects).toEqual([]);expect(e.channels[0]!.signal?.aborted).toBe(true)})
 it('reconciles counts and selected first page on open, ignoring repeated open callbacks',async()=>{const {p,e,s}=await setup();s.setCallContext('p1',false);s.startLive(e.provider);e.latest().onOpen();e.latest().onOpen();await settle();expect(p.loadCounts).toHaveBeenCalledTimes(2);expect(p.loadCalls).toHaveBeenCalledTimes(1);expect(p.loadCalls).toHaveBeenLastCalledWith('p1',{failed:false},expect.any(AbortSignal));await vi.advanceTimersByTimeAsync(400);expect(p.loadLogs).toHaveBeenCalledTimes(1)})
 it('does not start follow-on calls after closing during open reconciliation',async()=>{const {p,e,s}=await setup(),pending=defer<CallCounts>();p.loadCounts=vi.fn(()=>pending.promise);s.setCallContext('p1',false);s.startLive(e.provider);e.latest().onOpen();s.stopLive();pending.resolve(counts());await settle();expect(p.loadCalls).not.toHaveBeenCalled()})
 it('backs off 1/2/4 seconds then stops after three retries while project polling remains independent',async()=>{const {p,e,s}=await setup();s.startLive(e.provider);for(const delay of [1000,2000,4000]){e.latest().onOpen();e.latest().onError(new CompanionEventError('connection-error'));expect(s.liveState).toBe('retrying');const n=e.channels.length;await vi.advanceTimersByTimeAsync(delay-1);expect(e.channels).toHaveLength(n);await vi.advanceTimersByTimeAsync(1);expect(e.channels).toHaveLength(n+1)}e.latest().onError(new CompanionEventError('connection-error'));expect(s.liveState).toBe('failed');await vi.advanceTimersByTimeAsync(12000);expect(e.channels).toHaveLength(4);expect(p.loadProjects).toHaveBeenCalled();expect(s.connected).toBe(true);s.setLiveVisibility(false);s.setLiveVisibility(true);expect(e.channels).toHaveLength(4);s.startLive(e.provider);expect(e.channels).toHaveLength(5);expect(s.liveRetries).toBe(0)})
 it.each(['invalid-frame','frame-too-large'] as const)('does not retry protocol failure %s',async code=>{const {e,s}=await setup();s.startLive(e.provider);e.latest().onError(new CompanionEventError(code));await vi.advanceTimersByTimeAsync(30000);expect(e.channels).toHaveLength(1);expect(s.liveState).toBe('failed')})
 it('has an opening deadline and safely handles synchronous subscriber exceptions',async()=>{const {e,s}=await setup();s.startLive(e.provider);await vi.advanceTimersByTimeAsync(8000);expect(s.liveState).toBe('retrying');expect(e.channels[0]!.signal?.aborted).toBe(true);s.startLive({label:'broken',subscribe(){throw new Error('private detail')}});expect(s.liveState).toBe('retrying');expect(s.liveError).not.toContain('private detail')})
 it('handles synchronous failure callbacks before subscribe returns',async()=>{const {s}=await setup(),close=vi.fn();s.startLive({label:'sync',subscribe(h){h.onError(new CompanionEventError('invalid-frame'));return close}});expect(close).toHaveBeenCalledTimes(1);expect(s.liveState).toBe('failed')})
 it('coalesces bursts of log hints and serializes hints arriving during pending read',async()=>{const {p,e,s}=await setup(),pending=defer<[]>();p.loadLogs=vi.fn().mockImplementationOnce(()=>pending.promise).mockResolvedValue([]);s.startLive(e.provider);for(let i=0;i<100;i++)e.latest().onLog();await vi.advanceTimersByTimeAsync(400);expect(p.loadLogs).toHaveBeenCalledTimes(1);for(let i=0;i<100;i++)e.latest().onLog();await vi.advanceTimersByTimeAsync(1200);expect(p.loadLogs).toHaveBeenCalledTimes(1);pending.resolve([]);await settle();await vi.advanceTimersByTimeAsync(400);expect(p.loadLogs).toHaveBeenCalledTimes(2)})
 it('pause only stops live logs; resume catches up once and manual read remains allowed',async()=>{const {p,e,s}=await setup();s.startLive(e.provider);e.latest().onOpen();await settle();s.pauseLogs(true);e.latest().onLog();e.latest().onCall({sessionId:'s1',total:2,record:record()});await vi.advanceTimersByTimeAsync(3500);expect(p.loadLogs).not.toHaveBeenCalled();expect(p.loadProjects).toHaveBeenCalledTimes(3);expect(s.counts?.counts.p1).toBe(2);await s.refreshLogs();expect(p.loadLogs).toHaveBeenCalledTimes(1);s.pauseLogs(false);await vi.advanceTimersByTimeAsync(400);expect(p.loadLogs).toHaveBeenCalledTimes(2)})
 it('filter changes cancel old logs then refresh only the current filters',async()=>{const {p,e,s}=await setup(),pending=defer<[]>();p.loadLogs=vi.fn().mockImplementationOnce(()=>pending.promise).mockResolvedValue([]);s.startLive(e.provider);e.latest().onLog();await vi.advanceTimersByTimeAsync(400);s.logFilter.search='updated';expect(vi.mocked(p.loadLogs).mock.calls[0]?.[1]?.aborted).toBe(true);pending.resolve([]);await settle();expect(s.logsRead).toBe(false);await vi.advanceTimersByTimeAsync(400);expect(p.loadLogs).toHaveBeenLastCalledWith(expect.objectContaining({search:'updated'}),expect.any(AbortSignal))})
})
describe('live call / snapshot reconciliation',()=>{
 it('updates total and terminal detail without lowering either after late running snapshots',async()=>{const {p,e,s}=await setup(),pendingCounts=defer<CallCounts>(),pendingCalls=defer<CallPage>();s.setCallContext('p1',false);s.startLive(e.provider);p.loadCounts=()=>pendingCounts.promise;p.loadCalls=()=>pendingCalls.promise;const c=s.refreshCounts(),r=s.loadCalls();e.latest().onCall({sessionId:'s1',total:2,record:record(2,'success')});pendingCounts.resolve(counts(2));pendingCalls.resolve(page(2));await Promise.all([c,r]);expect(s.counts?.latest.p1?.status).toBe('success');expect(s.records[0]?.status).toBe('success');expect(s.total).toBe(2)})
 it('never lowers live total after a concurrent counts failure and stale call snapshot',async()=>{const {p,e,s}=await setup(),pendingCounts=defer<CallCounts>(),pendingCalls=defer<CallPage>();s.setCallContext('p1',false);s.startLive(e.provider);p.loadCounts=()=>pendingCounts.promise;p.loadCalls=()=>pendingCalls.promise;const c=s.refreshCounts(),r=s.loadCalls();e.latest().onCall({sessionId:'s1',total:2,record:record()});pendingCounts.reject(new Error('counts unavailable'));await c;expect(s.counts).toBeNull();pendingCalls.resolve(page(1));await r;expect(s.records[0]?.sequence).toBe(2);expect(s.total).toBe(2);expect(s.retained).toBeNull()})
 it.each([4,5])('keeps latest unknown when old completion %s reveals a missing newer begin',async sequence=>{const {e,s}=await setup();s.counts=counts(5);s.startLive(e.provider);e.latest().onCall({sessionId:'s1',total:6,record:record(sequence,'success')});expect(s.counts?.counts.p1).toBe(6);expect(s.counts?.latest.p1).toBeUndefined()})
 it('does not restore an old HTTP latest when a newer live total has no known latest',async()=>{const {p,e,s}=await setup(),pending=defer<CallCounts>();s.startLive(e.provider);p.loadCounts=()=>pending.promise;const read=s.refreshCounts();e.latest().onCall({sessionId:'s1',total:5,record:record(2,'success')});pending.resolve(counts(3));await read;expect(s.counts?.counts.p1).toBe(5);expect(s.counts?.latest.p1).toBeUndefined()})
 it('does not let an older terminal record replace a known latest',async()=>{const {e,s}=await setup();s.counts=counts(5);s.startLive(e.provider);e.latest().onCall({sessionId:'s1',total:5,record:record(3,'failed')});expect(s.counts?.latest.p1?.id).toBe('r5')})
 it('clears counts, details and cursor on event session change; ignores pending old snapshots',async()=>{const {p,e,s}=await setup(),pending=defer<CallPage>();s.setCallContext('p1',false);await s.loadCalls();s.nextBefore=1;s.startLive(e.provider);p.loadCalls=()=>pending.promise;const read=s.loadCalls(true);e.latest().onCall({sessionId:'s2',total:1,record:{...record(1),id:'new'}});pending.resolve(page(9));await read;expect(s.sessionId).toBe('s2');expect(s.records.map(r=>r.id)).toEqual(['new']);expect(s.nextBefore).toBeUndefined();expect(s.counts?.counts.p1).toBe(1)})
 it('invalidates old stream immediately when HTTP first confirms a new session',async()=>{const {p,e,s}=await setup();s.startLive(e.provider);const old=e.channels[0]!;p.loadCounts=async()=>({...counts(0),sessionId:'s2'});await s.refreshCounts();expect(old.signal?.aborted).toBe(true);old.handlers.onCall({sessionId:'s1',total:8,record:record(8)});expect(s.sessionId).toBe('s2');expect(s.counts?.counts.p1).toBe(0);await vi.advanceTimersByTimeAsync(0);expect(e.channels).toHaveLength(2)})
 it('failed-only skips running/success yet accepts failed terminal and never invents retained count',async()=>{const {e,s}=await setup();s.setCallContext('p1',true);s.startLive(e.provider);e.latest().onCall({sessionId:'s1',total:2,record:record()});expect(s.records).toEqual([]);e.latest().onCall({sessionId:'s1',total:2,record:record(2,'success')});expect(s.records).toEqual([]);e.latest().onCall({sessionId:'s1',total:3,record:record(3,'failed')});expect(s.records.map(r=>r.id)).toEqual(['r3']);expect(s.retained).toBeNull()})
 it('does not accumulate unknown-project maps and caps retained detail at 1000',async()=>{const {e,s}=await setup();s.setCallContext('p1',false);s.startLive(e.provider);e.latest().onCall({sessionId:'s1',total:2,record:{...record(),projectId:'unknown'}});expect(s.counts?.counts.unknown).toBeUndefined();for(let i=1;i<=1100;i++)e.latest().onCall({sessionId:'s1',total:i,record:record(i)});expect(s.records).toHaveLength(1000);expect(s.records[0]?.sequence).toBe(1100)})
})


describe('cross-project navigation during paused reconnect',()=>{
 it('discards old log reads and stream callbacks, then reconciles only current project after return',async()=>{
  const {p,e,s}=await setup(),oldLogs=defer<[]>();
  p.loadLogs=vi.fn().mockImplementationOnce(()=>oldLogs.promise).mockResolvedValue([]);
  s.logFilter.projectIds=['p1'];s.setCallContext('p1',false);s.startLive(e.provider);
  const old=e.channels[0]!;old.handlers.onOpen();await settle();
  await vi.advanceTimersByTimeAsync(400);
  const oldLogSignal=vi.mocked(p.loadLogs).mock.calls[0]![1]!;
  s.pauseLogs(true);s.suspendReads();
  expect(oldLogSignal.aborted).toBe(true);
  s.logFilter.projectIds=['p2'];s.setCallContext('p2',false);
  oldLogs.resolve([]);old.handlers.onCall({sessionId:'obsolete',total:9,record:record(9,'success')});old.handlers.onLog();
  await settle();await vi.advanceTimersByTimeAsync(600_000);
  expect(s.logsRead).toBe(false);expect(s.records).toEqual([]);expect(s.sessionId).toBe('s1');
  expect(e.channels).toHaveLength(1);expect(p.loadLogs).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
  p.loadCounts=vi.fn(async()=>({sessionId:'s2',counts:{p1:1,p2:1},latest:{}}));
  const currentRecord={...record(1,'success'),id:'p2-new',projectId:'p2'};
  p.loadCalls=vi.fn(async()=>({sessionId:'s2',total:1,retained:1,records:[currentRecord]}));
  s.setLivePageActive(true);e.latest().onOpen();await settle();
  // A new daemon session in the HTTP snapshot retires this stream before detail reads.
  expect(e.channels[1]!.signal?.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(0);e.latest().onOpen();await settle();
  expect(p.loadCalls).toHaveBeenLastCalledWith('p2',{failed:false},expect.any(AbortSignal));
  expect(s.records.map(r=>r.id)).toEqual(['p2-new']);expect(s.logsPaused).toBe(true);
  old.handlers.onCall({sessionId:'obsolete',total:20,record:record(20)});old.handlers.onOpen();
  const current=e.latest();
  for(let i=0;i<100;i++){
   current.onCall({sessionId:'s2',total:1,record:currentRecord});
   current.onCall({sessionId:'s2',total:2,record:record(2,'success')});
   current.onLog();
  }
  expect(s.records.map(r=>r.id)).toEqual(['p2-new']);expect(s.total).toBe(1);expect(s.sessionId).toBe('s2');
  expect(s.counts?.counts.p1).toBe(2);expect(s.counts?.counts.p2).toBe(1);
  expect(p.loadLogs).toHaveBeenCalledTimes(1);
  s.pauseLogs(false);await vi.advanceTimersByTimeAsync(400);
  expect(p.loadLogs).toHaveBeenCalledTimes(2);
  expect(p.loadLogs).toHaveBeenLastCalledWith(expect.objectContaining({projectIds:['p2']}),expect.any(AbortSignal));
  s.stopLive();expect(vi.getTimerCount()).toBe(0);
 })
})


describe('legacy default realtime with session-only user choices',()=>{
 it('starts once when a connected normal page requests its default, without implicit read-store subscriptions',async()=>{
  const e=stream(),s=useCompanionBrowserStore();s.ensureLive(e.provider);
  expect(s.livePreferred).toBe(true);expect(e.channels).toHaveLength(0);
  const p=fixture();await s.connect(p);expect(e.channels).toHaveLength(0);
  s.ensureLive(e.provider);s.ensureLive(e.provider);
  expect(s.liveEnabled).toBe(true);expect(e.channels).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(0);expect(p.loadProjects).toHaveBeenCalledTimes(2);
 })
 it('preserves explicit realtime stop across route return and manual reconnect until explicit resume',async()=>{
  const {p,e,s}=await setup();s.ensureLive(e.provider);s.stopLive();
  s.suspendReads();s.setLivePageActive(true);s.ensureLive(e.provider);
  expect(s.livePreferred).toBe(false);expect(e.channels).toHaveLength(1);
  await s.connect(p);s.ensureLive(e.provider);
  expect(s.liveEnabled).toBe(false);expect(e.channels).toHaveLength(1);
  s.startLive(e.provider);expect(s.livePreferred).toBe(true);expect(e.channels).toHaveLength(2);
 })
 it('retains log-only pause through reconnect, while project polling and call events continue',async()=>{
  const {p,e,s}=await setup();s.ensureLive(e.provider);s.pauseLogs(true);
  s.suspendReads();s.setLivePageActive(true);s.ensureLive(e.provider);
  await s.connect(p);s.ensureLive(e.provider);e.latest().onOpen();await settle();
  e.latest().onLog();e.latest().onCall({sessionId:'s1',total:2,record:record()});
  await vi.advanceTimersByTimeAsync(3500);
  expect(s.logsPaused).toBe(true);expect(s.liveEnabled).toBe(true);
  expect(p.loadLogs).not.toHaveBeenCalled();expect(p.loadProjects).toHaveBeenCalledTimes(4);
  expect(s.counts?.counts.p1).toBe(2);
  s.pauseLogs(false);await vi.advanceTimersByTimeAsync(400);
  expect(p.loadLogs).toHaveBeenCalledTimes(1);
 })
 it('keeps defaults and choices independent of unavailable browser storage',async()=>{
  const local=vi.spyOn(window,'localStorage','get').mockImplementation(()=>{throw new Error('denied')});
  const session=vi.spyOn(window,'sessionStorage','get').mockImplementation(()=>{throw new Error('denied')});
  const {p,e,s}=await setup();s.ensureLive(e.provider);s.pauseLogs(true);s.stopLive();
  await s.connect(p);s.ensureLive(e.provider);
  expect(s.liveEnabled).toBe(false);expect(s.logsPaused).toBe(true);
  expect(local).not.toHaveBeenCalled();expect(session).not.toHaveBeenCalled();
  s.startLive(e.provider);expect(s.liveEnabled).toBe(true);
 })
})
