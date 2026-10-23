import { defineStore } from 'pinia'
import { CompanionBrowserError } from '../adapters/companion-browser'
import { ref, shallowRef, watch } from 'vue'
import type { CompanionBrowserProvider, ManagedProject, ManagedStatus, DashboardProject, LogRecord, LogFilter, CallCounts, CallRecord, CallLatest } from '../domain/companion-browser'
import { CompanionEventError, type CompanionCallUpdate, type CompanionEventProvider } from '../domain/companion-live'
import { mergeCalls } from '../domain/companion-browser'
export const useCompanionBrowserStore=defineStore('companion-browser',()=>{
 const provider=shallowRef<CompanionBrowserProvider|null>(null),connected=ref(false)
 const projects=shallowRef<ManagedProject[]>([]),statuses=shallowRef<ManagedStatus[]>([]),dashboard=shallowRef<DashboardProject[]>([]),warnings=ref<string[]>([])
 const dashboardLoading=ref(false),dashboardError=ref(''),dashboardRead=ref(false),dashboardObservedAt=ref('')
 const projectLoading=ref(false),backgroundProjectRead=ref(false),projectError=ref(''),observedAt=ref(''),projectSnapshotRevision=ref(0)
 const logs=shallowRef<LogRecord[]>([]),logsLoading=ref(false),logsError=ref(''),logsRead=ref(false)
 const logFilter=ref<LogFilter>({projectIds:[],sources:[],levels:[],search:'',limit:200})
 const counts=shallowRef<CallCounts|null>(null),countsLoading=ref(false),countsError=ref('')
 const callProjectId=ref(''),failedOnly=ref(false),records=shallowRef<CallRecord[]>([]),callLoading=ref(false),callError=ref(''),callRead=ref(false)
 const total=ref<number|null>(null),retained=ref<number|null>(null),nextBefore=ref<number|undefined>(),sessionId=ref('')
 // Default normal-workspace intent; transport remains gated by the page and providers.
 const livePreferred=ref(true)
 const liveEnabled=ref(false),liveVisible=ref(true),livePageActive=ref(true),logsPaused=ref(false),projectPollingPaused=ref(false),liveRetries=ref(0)
 const liveState=ref<'off'|'connecting'|'open'|'retrying'|'suspended'|'failed'>('off'),liveError=ref('')
 let epoch=0,sessionEpoch=0,callEventVersion=0,liveEpoch=0,streamEpoch=0
 let eventProvider:CompanionEventProvider|null=null,boundReadProvider:CompanionBrowserProvider|null=null,eventAbort:AbortController|undefined,unsubscribe:(()=>void)|undefined
 let pollTimer:ReturnType<typeof setTimeout>|undefined,retryTimer:ReturnType<typeof setTimeout>|undefined,logTimer:ReturnType<typeof setTimeout>|undefined,openTimer:ReturnType<typeof setTimeout>|undefined
 let logDirty=false,eventStopped=false,networkRecovering=false,networkRecoveryAttempts=0
 const versions={projects:0,logs:0,counts:0,calls:0,dashboard:0},controllers:Partial<Record<keyof typeof versions,AbortController>>={}
 function cancel(key:keyof typeof versions){versions[key]++;controllers[key]?.abort();delete controllers[key]}
 function resetCalls(){records.value=[];total.value=null;retained.value=null;nextBefore.value=undefined;callRead.value=false}
 function cancelQueries(){for(const key of Object.keys(versions) as Array<keyof typeof versions>)cancel(key);projectLoading.value=false;backgroundProjectRead.value=false;logsLoading.value=false;countsLoading.value=false;callLoading.value=false;dashboardLoading.value=false}
 function cancelReads(){stopLiveTransport()}
 /** Navigation suspends transport without changing the explicit realtime choice. */
 function suspendReads(){setLivePageActive(false);cancelQueries()}
 function reconcileLiveProvider(next:CompanionEventProvider|null){if(liveEnabled.value&&next!==eventProvider)stopLiveTransport()}
 function clearData(){connected.value=false;projects.value=[];statuses.value=[];dashboard.value=[];dashboardRead.value=false;dashboardError.value='';dashboardObservedAt.value='';warnings.value=[];observedAt.value='';logs.value=[];logsRead.value=false;counts.value=null;sessionId.value='';sessionEpoch++;callProjectId.value='';resetCalls()}
 function disconnect(){epoch++;cancelReads();provider.value=null;clearData();projectPollingPaused.value=false;projectError.value='';logsError.value='';countsError.value='';callError.value=''}
 async function connect(next:CompanionBrowserProvider){disconnect();const identity=epoch;provider.value=next;const pending=refreshProjects(),projectVersion=versions.projects;await pending;if(identity===epoch&&versions.projects===projectVersion&&provider.value===next&&connected.value)await refreshCounts()}
 /** A bounded page-entry read, separate from manual reconnect and live polling.
  * Cancellation owns only the versions started here, never a later manual read. */
 async function readProjectEntry(next:CompanionBrowserProvider,signal:AbortSignal){
  if(signal.aborted||projectLoading.value||countsLoading.value)return
  if(provider.value!==next){disconnect();if(signal.aborted)return;provider.value=next}
  const identity=epoch
  let projectVersion:number|undefined,countVersion:number|undefined
  const current=()=>!signal.aborted&&identity===epoch&&provider.value===next
  function abort(){
   if(identity!==epoch||provider.value!==next)return
   if(projectVersion!==undefined&&versions.projects===projectVersion){cancel('projects');projectLoading.value=false;backgroundProjectRead.value=false}
   if(countVersion!==undefined&&versions.counts===countVersion){cancel('counts');countsLoading.value=false}
  }
  signal.addEventListener('abort',abort,{once:true})
  try{
   const pending=refreshProjects(true);projectVersion=versions.projects
   if(signal.aborted)abort()
   await pending
   if(!current()||versions.projects!==projectVersion||!connected.value||countsLoading.value)return
   const countsPending=refreshCounts();countVersion=versions.counts
   if(signal.aborted)abort()
   await countsPending
  }finally{signal.removeEventListener('abort',abort)}
 }
 function begin(key:keyof typeof versions){cancel(key);const controller=new AbortController();controllers[key]=controller;const version=versions[key],identity=epoch;return {signal:controller.signal,current:()=>identity===epoch&&versions[key]===version}}
 function message(cause:unknown){return cause instanceof Error?cause.message:'真实读取未完成'}
 function acceptSession(id:string,source:'counts'|'calls'|'event'){
  if(sessionId.value===id)return
  const previous=sessionId.value
  sessionId.value=id;sessionEpoch++;counts.value=null;resetCalls()
  if(previous&&source!=='event'&&liveEnabled.value){
   closeStream();clearTimeout(retryTimer)
   if(liveCurrent(liveEpoch)&&!eventStopped){const identity=liveEpoch;retryTimer=setTimeout(()=>{retryTimer=undefined;openLiveStream(identity)},0)}
  }
  if(source!=='calls'){cancel('calls');callLoading.value=false}
  if(source!=='counts'){cancel('counts');countsLoading.value=false}
 }
 async function refreshProjects(background=false){
  const active=provider.value;if(!active||projectLoading.value)return
  const read=begin('projects');backgroundProjectRead.value=background&&connected.value;projectLoading.value=true;if(!observedAt.value)projectError.value=''
  try{const result=await active.loadProjects(read.signal);if(!read.current())return
   // Retain identical snapshots so live reads do not rebuild unchanged cards or filters.
   if(JSON.stringify(projects.value)!==JSON.stringify(result.projects))projects.value=result.projects
   if(JSON.stringify(statuses.value)!==JSON.stringify(result.statuses))statuses.value=result.statuses
   // Normal workspace keeps explicit Dashboard observations across Bridge polling.
   if(active.dashboardDiscoveryEnabled!==false&&JSON.stringify(dashboard.value)!==JSON.stringify(result.dashboard))dashboard.value=result.dashboard
   if(JSON.stringify(warnings.value)!==JSON.stringify(result.warnings))warnings.value=result.warnings
   projectError.value='';connected.value=true;observedAt.value=new Date().toISOString()
   projectSnapshotRevision.value++
   if(networkRecovering){networkRecovering=false;networkRecoveryAttempts=0;scheduleProjectPoll(liveEpoch);if(eventStopped)liveState.value='failed';else openLiveStream(liveEpoch)}
   if(callProjectId.value&&!projects.value.some(project=>project.id===callProjectId.value)){cancel('calls');callLoading.value=false;callProjectId.value='';resetCalls()}
  }catch(cause){
   if(!read.current())return
   const transient=cause instanceof CompanionBrowserError&&(cause.code==='network-error'||cause.code==='timeout')
   const recoverable=background&&transient&&liveEnabled.value&&liveVisible.value&&livePageActive.value&&active===boundReadProvider
   if(recoverable&&networkRecoveryAttempts<3){
    networkRecoveryAttempts++;clearLiveWork();connected.value=false;networkRecovering=true;liveState.value='retrying';liveError.value=message(cause);projectError.value=message(cause);scheduleNetworkRecovery(liveEpoch)
   }else{
    const exhausted=recoverable&&networkRecoveryAttempts>=3
    epoch++;cancelReads();connected.value=false;projectError.value=message(cause)
    if(exhausted){liveState.value='failed';liveError.value=message(cause)}
   }
  }finally{if(read.current()){projectLoading.value=false;backgroundProjectRead.value=false}}
 }
 function cancelDashboardRead(){cancel('dashboard');dashboardLoading.value=false}
 async function refreshDashboard(){
  const active=provider.value
  if(!connected.value||!active?.loadDashboardProjects||dashboardLoading.value)return
  const read=begin('dashboard');dashboardLoading.value=true;dashboardError.value='';dashboardRead.value=false;dashboard.value=[];dashboardObservedAt.value=''
  try{const result=await active.loadDashboardProjects(read.signal);if(!read.current()||active!==provider.value)return
   dashboard.value=result;dashboardRead.value=true;dashboardObservedAt.value=new Date().toISOString()
  }catch(cause){if(read.current())dashboardError.value=message(cause)}finally{if(read.current())dashboardLoading.value=false}
 }
 async function refreshLogs(preserveSnapshot=false){
  const active=provider.value;if(!active||!connected.value)return
  const read=begin('logs');logsLoading.value=true;logsError.value='';if(!preserveSnapshot){logsRead.value=false;logs.value=[]}
  const filter=JSON.parse(JSON.stringify(logFilter.value)) as LogFilter
  try{const result=await active.loadLogs(filter,read.signal);if(read.current()){logs.value=result;logsRead.value=true}}
  catch(cause){if(read.current()){logsError.value=message(cause);logsRead.value=false;logs.value=[]}}finally{if(read.current())logsLoading.value=false}
 }
 async function refreshCounts(){
  const active=provider.value;if(!active||!connected.value)return
  const read=begin('counts');countsLoading.value=true;countsError.value='';const generation=sessionEpoch,eventVersion=callEventVersion
  try{const result=await active.loadCounts(read.signal);if(!read.current()||generation!==sessionEpoch)return;acceptSession(result.sessionId,'counts');counts.value=eventVersion===callEventVersion?result:mergeLiveCounts(result)}
  catch(cause){if(read.current()){counts.value=null;countsError.value=message(cause)}}finally{if(read.current())countsLoading.value=false}
 }
 function setCallContext(projectId:string,failed:boolean){cancel('calls');callLoading.value=false;callProjectId.value=projects.value.some(project=>project.id===projectId)?projectId:'';failedOnly.value=failed;resetCalls();callError.value=''}
 async function loadCalls(append=false){
  const active=provider.value,id=callProjectId.value;if(!active||!connected.value||!id)return
  if(append&&(callLoading.value||nextBefore.value===undefined))return
  const before=append?nextBefore.value:undefined,failed=failedOnly.value
  const read=begin('calls'),generation=sessionEpoch,eventVersion=callEventVersion;callLoading.value=true;callError.value=''
  if(!append)resetCalls()
  try{const page=await active.loadCalls(id,{failed,...(before===undefined?{}:{before})},read.signal)
   if(!read.current()||generation!==sessionEpoch||id!==callProjectId.value||failed!==failedOnly.value)return
   const changed=sessionId.value!==page.sessionId;acceptSession(page.sessionId,'calls')
   // A page fetched with an old-session cursor is not a complete first page.
   if(changed&&append){callError.value='服务会话已变化，请重新读取首批调用；未混入旧游标结果';return}
   records.value=mergeCalls(append||eventVersion!==callEventVersion?records.value:[],page.records);total.value=Math.max(page.total,counts.value?.counts[id]??0,total.value??0);retained.value=total.value>page.total?null:page.retained;nextBefore.value=page.nextBefore;callRead.value=true
  }catch(cause){if(read.current())callError.value=message(cause)}finally{if(read.current())callLoading.value=false}
 }
 function terminalLatest(previous:CallLatest|undefined,incoming:CallLatest){return previous?.id===incoming.id&&previous.status!=='running'&&incoming.status==='running'?previous:incoming}
 function mergeLiveCounts(incoming:CallCounts):CallCounts{
  const current=counts.value;if(!current||current.sessionId!==incoming.sessionId)return incoming
  const merged:CallCounts={sessionId:incoming.sessionId,counts:Object.assign(Object.create(null),incoming.counts),latest:Object.assign(Object.create(null),incoming.latest)}
  for(const [id,value] of Object.entries(current.counts))if(value>=(incoming.counts[id]??-1)){
   merged.counts[id]=value;const previous=current.latest[id],next=incoming.latest[id]
   if(previous)merged.latest[id]=next&&value===incoming.counts[id]&&previous.id===next.id?terminalLatest(previous,next):previous
   else if(value>(incoming.counts[id]??-1))delete merged.latest[id]
  }
  return merged
 }
 function acceptLiveCall(update:CompanionCallUpdate){
  callEventVersion++;acceptSession(update.sessionId,'event')
  const record=update.record,id=record.projectId
  if(!projects.value.some(project=>project.id===id))return
  const current=counts.value,previousTotal=current?.counts[id]??0
  const latest:CallCounts['latest']=Object.assign(Object.create(null),current?.latest)
  // total can advance while an older record finishes: only sequence===total proves latest.
  if(update.total>previousTotal)delete latest[id]
  if(record.sequence>=Math.max(previousTotal,update.total)||latest[id]?.id===record.id){
   const {id:recordId,operationNameZh,startedAt,status,durationMs}=record
   latest[id]=terminalLatest(current?.latest[id],{id:recordId,operationNameZh,startedAt,status,...(durationMs===undefined?{}:{durationMs})})
  }
  counts.value={sessionId:update.sessionId,counts:Object.assign(Object.create(null),current?.counts,{[id]:Math.max(previousTotal,update.total)}),latest}
  if(callProjectId.value===id){
   if(total.value!==null&&update.total>total.value)retained.value=null
   total.value=Math.max(total.value??0,update.total)
   if(!failedOnly.value||record.status==='failed')records.value=mergeCalls(records.value,[record])
  }
 }
 function liveCurrent(identity:number){return liveEnabled.value&&liveVisible.value&&livePageActive.value&&connected.value&&identity===liveEpoch&&provider.value===boundReadProvider}
 function closeStream(){streamEpoch++;clearTimeout(openTimer);openTimer=undefined;eventAbort?.abort();eventAbort=undefined;unsubscribe?.();unsubscribe=undefined}
 function clearLiveWork(){liveEpoch++;closeStream();clearTimeout(pollTimer);clearTimeout(retryTimer);clearTimeout(logTimer);pollTimer=retryTimer=logTimer=undefined;logDirty=false;cancelQueries()}
 function stopLiveTransport(){clearLiveWork();networkRecovering=false;networkRecoveryAttempts=0;liveEnabled.value=false;liveState.value='off';liveError.value='';liveRetries.value=0;eventStopped=false;eventProvider=null;boundReadProvider=null}
 /** Only an explicit user stop changes intent; teardown and reconnect do not. */
 function stopLive(){livePreferred.value=false;stopLiveTransport()}
 function ensureLive(next:CompanionEventProvider){
  if(!livePreferred.value||!connected.value||!provider.value)return
  if(liveEnabled.value&&eventProvider===next&&boundReadProvider===provider.value)return
  beginLive(next)
 }
 function scheduleProjectPoll(identity:number,delay=3000){
  clearTimeout(pollTimer);pollTimer=undefined
  if(projectPollingPaused.value||!liveCurrent(identity))return
  pollTimer=setTimeout(async()=>{
   pollTimer=undefined;if(projectPollingPaused.value||!liveCurrent(identity))return
   if(!projectLoading.value)await refreshProjects(true)
   if(!projectPollingPaused.value&&liveCurrent(identity))scheduleProjectPoll(identity)
  },delay)
 }
 /** Hold only scheduled project polls while a frozen confirmation is being read.
  * Manual/in-flight reads, event streams, logs and counts remain independent. */
 function pauseProjectPolling(paused:boolean){
  if(projectPollingPaused.value===paused)return
  projectPollingPaused.value=paused;clearTimeout(pollTimer);pollTimer=undefined
  if(!paused){if(networkRecovering)scheduleNetworkRecovery(liveEpoch);else if(liveCurrent(liveEpoch))scheduleProjectPoll(liveEpoch)}
 }
 function queueLiveLogs(identity:number){
  if(!liveCurrent(identity)||logsPaused.value)return
  logDirty=true;if(logTimer!==undefined)return
  logTimer=setTimeout(async()=>{
   logTimer=undefined;if(!liveCurrent(identity)||logsPaused.value)return
   if(logsLoading.value){queueLiveLogs(identity);return}
   logDirty=false;await refreshLogs(true)
   if(logDirty&&liveCurrent(identity)&&!logsPaused.value)queueLiveLogs(identity)
  },400)
 }
 function pauseLogs(paused:boolean){logsPaused.value=paused;if(paused){clearTimeout(logTimer);logTimer=undefined;logDirty=false;cancel('logs');logsLoading.value=false}else if(liveEnabled.value)queueLiveLogs(liveEpoch)}
 function openLiveStream(identity:number){
  if(!liveCurrent(identity)||!eventProvider||eventStopped)return
  closeStream();const attempt=streamEpoch,controller=new AbortController();eventAbort=controller;liveState.value='connecting'
  const current=()=>liveCurrent(identity)&&attempt===streamEpoch&&!controller.signal.aborted
  let opened=false
  function failStream(error?:CompanionEventError){
   if(!current())return
   closeStream();liveError.value=error?.message??'事件流连接超时；未证明实时数据连续。'
   if((error&&error.code!=='connection-error')||liveRetries.value>=3){eventStopped=true;liveState.value='failed';return}
   const wait=1000*2**liveRetries.value;liveRetries.value++;liveState.value='retrying'
   retryTimer=setTimeout(()=>{retryTimer=undefined;if(liveCurrent(identity))openLiveStream(identity)},wait)
  }
  openTimer=setTimeout(()=>failStream(),8000)
  try{const stop=eventProvider.subscribe({
   onOpen(){if(!current()||opened)return;opened=true;clearTimeout(openTimer);openTimer=undefined;liveState.value='open';liveError.value=''
    void (async()=>{await refreshCounts();if(current()&&callProjectId.value)await loadCalls()})();queueLiveLogs(identity)
   },
   onLog(){if(current())queueLiveLogs(identity)},
   onCall(update){if(current())acceptLiveCall(update)},
   onError(error){failStream(error)},
  },controller.signal)
  if(current())unsubscribe=stop;else stop()
  }catch{failStream(new CompanionEventError('connection-error'))}
 }
 /** Retain only an explicitly enabled same-source read intent, never stale readiness. */
 function scheduleNetworkRecovery(identity:number,delay=3000){
  clearTimeout(pollTimer);pollTimer=undefined
  if(projectPollingPaused.value||!networkRecovering||!liveEnabled.value||!liveVisible.value||!livePageActive.value||identity!==liveEpoch||provider.value!==boundReadProvider)return
  pollTimer=setTimeout(()=>{pollTimer=undefined;if(!projectPollingPaused.value&&networkRecovering&&liveEnabled.value&&liveVisible.value&&livePageActive.value&&identity===liveEpoch&&provider.value===boundReadProvider)void refreshProjects(true)},delay)
 }
 function resumeLive(){const identity=liveEpoch;if(networkRecovering){liveState.value='retrying';scheduleNetworkRecovery(identity,0);return}scheduleProjectPoll(identity,0);if(eventStopped)liveState.value='failed';else openLiveStream(identity)}
 function startLive(next:CompanionEventProvider){livePreferred.value=true;beginLive(next)}
 function beginLive(next:CompanionEventProvider){
  if(!connected.value||!provider.value)return
  stopLiveTransport();eventProvider=next;boundReadProvider=provider.value;liveEnabled.value=true
  if(liveVisible.value&&livePageActive.value)resumeLive();else liveState.value='suspended'
 }
 function setLivePageActive(active:boolean){if(livePageActive.value===active)return;livePageActive.value=active;if(!liveEnabled.value)return;clearLiveWork();if(active&&liveVisible.value)resumeLive();else liveState.value='suspended'}
 function setLiveVisibility(visible:boolean){if(liveVisible.value===visible)return;liveVisible.value=visible;if(!liveEnabled.value)return;clearLiveWork();if(visible&&livePageActive.value)resumeLive();else liveState.value='suspended'}
 watch(provider,next=>{if(liveEnabled.value&&next!==boundReadProvider)stopLiveTransport()},{flush:'sync'})
 watch(logFilter,()=>{cancel('logs');logsLoading.value=false;logsRead.value=false;logs.value=[];logsError.value='';if(liveEnabled.value)queueLiveLogs(liveEpoch)},{deep:true,flush:'sync'})
 return {provider,connected,projects,statuses,dashboard,dashboardLoading,dashboardError,dashboardRead,dashboardObservedAt,refreshDashboard,cancelDashboardRead,warnings,projectLoading,backgroundProjectRead,projectError,observedAt,projectSnapshotRevision,logs,logsLoading,logsError,logsRead,logFilter,counts,countsLoading,countsError,callProjectId,failedOnly,records,callLoading,callError,callRead,total,retained,nextBefore,sessionId,livePreferred,liveEnabled,liveVisible,livePageActive,liveState,liveError,liveRetries,logsPaused,projectPollingPaused,startLive,stopLive,ensureLive,setLiveVisibility,setLivePageActive,pauseLogs,pauseProjectPolling,readProjectEntry,connect,disconnect,cancelReads,suspendReads,reconcileLiveProvider,refreshProjects,refreshLogs,refreshCounts,setCallContext,loadCalls}
})
