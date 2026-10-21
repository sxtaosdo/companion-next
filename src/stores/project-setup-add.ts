import { computed, ref, shallowRef, toRaw, watch } from 'vue'
import { defineStore } from 'pinia'
import { useCompanionBrowserStore } from './companion-browser'
import { useProjectOperationLaneStore } from './project-operation-lane'
import { projectSetupProvider } from '../project-setup-integration'
import { toolPresetReadProvider } from '../tool-presets-read-integration'
import { projectConnectionsProvider } from '../project-connections-integration'
import { decodeToolPresetRead, type ToolPresetRead } from '../domain/tool-presets-read'
import { sameSetupOptions, validateProjectPath, validateSetupOperationId, validateSetupProjectId, ProjectSetupError, PROJECT_SETUP_LIMITS, type SetupSnapshot } from '../domain/project-setup'
import { projectDisplayPathKey } from '../domain/companion-project-display'
import type { ManagedProject } from '../domain/companion-browser'
const options=Object.freeze({startCreator:true,configureCodex:false})
/** Legacy add flow only. No registration POST; setup owns registration/Bridge/Dashboard. */
export const useProjectSetupAddStore=defineStore('project-setup-add',()=>{
 const browser=useCompanionBrowserStore(),lane=useProjectOperationLaneStore()
 const target=ref(''),presets=shallowRef<ToolPresetRead|null>(null),presetId=ref(''),presetExplicit=ref(false),project=shallowRef<ManagedProject|null>(null)
 const phase=ref<'idle'|'reading'|'prepared'|'submitting'|'tracking'|'paused'|'complete'|'failed'|'unknown'|'error'>('idle'),error=ref(''),operationId=ref(''),snapshot=shallowRef<SetupSnapshot|null>(null)
 let readEpoch=0,readAbort:AbortController|undefined,timer:ReturnType<typeof setTimeout>|undefined
 type Operation={readLabel:string;writeLabel:string;scopeLabel:string|undefined;path:string;source:object;reader:typeof browser.provider;api:NonNullable<typeof projectSetupProvider.value>;scope:typeof projectConnectionsProvider.value;lease:NonNullable<ReturnType<typeof lane.acquire>>;preset:NonNullable<ToolPresetRead['presets'][number]>;persistScope:boolean;scopeDispatched?:boolean;controller?:AbortController;busy:boolean;terminal:boolean;dispatched:boolean;started:number}
 let active:Operation|null=null
 const busy=computed(()=>['reading','submitting','tracking'].includes(phase.value))
 const canStart=computed(()=>phase.value==='prepared'&&!lane.locked&&browser.connected&&!!projectSetupProvider.value?.startPathStrict&&!!presets.value?.presets.some(p=>p.id===presetId.value)&&((!!project.value&&!presetExplicit.value)||!!projectConnectionsProvider.value))
 const canResume=computed(()=>!!active&&!!operationId.value&&!active.busy&&!active.terminal&&['paused','unknown'].includes(phase.value)&&current(active))
 function current(op:Operation){return browser.connected&&toRaw(browser.provider)===op.reader&&projectSetupProvider.value===op.api&&projectConnectionsProvider.value===op.scope&&browser.provider?.label===op.readLabel&&op.api.label===op.writeLabel&&op.scope?.label===op.scopeLabel}
 function clearRead(){readEpoch++;readAbort?.abort();if(!active){phase.value='idle';target.value='';presets.value=null;presetId.value='';project.value=null;operationId.value='';snapshot.value=null;error.value=''}}
 async function prepare(path:string){
  if(active||lane.locked||!browser.connected||!browser.provider)return false
  clearRead();let checked:string;try{checked=validateProjectPath(path)}catch{error.value='invalid-path';return false}
  const api=toolPresetReadProvider.value,reader=toRaw(browser.provider),writer=projectSetupProvider.value,epoch=readEpoch
  if(!api||!writer?.startPathStrict){error.value='add-unavailable';return false}
  target.value=checked;phase.value='reading';readAbort=new AbortController();const signal=readAbort.signal
  const found=browser.projects.find(p=>projectDisplayPathKey(p.path)===projectDisplayPathKey(checked))
  try{const reply=decodeToolPresetRead(await api.loadPresets(found?.id,signal));if(epoch!==readEpoch||signal.aborted||toRaw(browser.provider)!==reader||writer!==projectSetupProvider.value||api!==toolPresetReadProvider.value||!browser.connected)return false
   const selected=found?reply.selectedPresetId:'full';if(!reply.presets.some(p=>p.id===selected))throw Error()
   presets.value=reply;presetId.value=selected;presetExplicit.value=false;project.value=found??null;phase.value='prepared';return true
  }catch{if(epoch===readEpoch){phase.value='error';error.value='scope-read-failed'}return false}
 }
 function selectPreset(id:string){if(active||!presets.value?.presets.some(p=>p.id===id))return;presetId.value=id;presetExplicit.value=true}
 async function release(op:Operation){try{await op.api.waitForIdle();if(op.scopeDispatched)await op.scope?.waitForIdle();op.busy=false;if(op.terminal&&active===op){lane.release(op.lease);active=null}return true}catch{phase.value='unknown';error.value='transport-unsettled';return false}}
 function schedule(op:Operation){clearTimeout(timer);if(active===op&&!op.terminal&&phase.value==='tracking')timer=setTimeout(()=>void poll(),PROJECT_SETUP_LIMITS.pollMs)}
 async function start(){
  if(!canStart.value)return false
  const api=projectSetupProvider.value!,reader=toRaw(browser.provider)!,choice=presets.value!.presets.find(p=>p.id===presetId.value)!
  const lease=lane.acquire('Add project through Dashboard');if(!lease)return false
  const op:Operation={readLabel:reader.label,writeLabel:api.label,scopeLabel:projectConnectionsProvider.value?.label,path:target.value,source:reader,reader,api,scope:projectConnectionsProvider.value,lease,preset:JSON.parse(JSON.stringify(choice)),persistScope:!project.value||presetExplicit.value,busy:true,terminal:false,dispatched:false,started:Date.now()};active=op
  phase.value='submitting';error.value='';operationId.value='';snapshot.value=null;op.controller=new AbortController()
  try{op.dispatched=true;const result=await api.startPathStrict!(op.path,options,op.controller.signal)
   if(!current(op)||op.controller.signal.aborted)throw Error()
   validateSetupOperationId(result.operationId);if(result.optionsContractVersion!==1||typeof result.reused!=='boolean'||!sameSetupOptions(result.effectiveOptions,options))throw Error()
   operationId.value=result.operationId;phase.value='tracking';return true
  }catch(cause){if(cause instanceof ProjectSetupError&&['not-dispatched','rejected'].includes(cause.outcome)){op.terminal=true;phase.value='error';error.value=cause.code}else{phase.value='unknown';error.value='setup-unknown'}return false}
  finally{op.controller=undefined;if(await release(op))schedule(op)}
 }
 function checkSnapshot(value:SetupSnapshot,op:Operation){
  if(value.id!==operationId.value||projectDisplayPathKey(validateProjectPath(value.projectPath))!==projectDisplayPathKey(op.path)||!sameSetupOptions(value.effectiveOptions,options)||value.optionsContractVersion!==1)throw Error()
  if(value.projectId)validateSetupProjectId(value.projectId)
  if(project.value&&value.projectId&&project.value.id!==value.projectId)throw Error()
  if(value.runtime&&value.projectId!==value.runtime.projectId)throw Error()
  return value
 }
 async function poll(){
  const op=active;if(!op||!operationId.value||op.busy||op.terminal||!current(op))return false
  if(Date.now()-op.started>=PROJECT_SETUP_LIMITS.maxPollMs){phase.value='paused';error.value='poll-budget';return false}
  op.busy=true;op.controller=new AbortController();phase.value='tracking'
  try{const result=checkSnapshot(await op.api.status(operationId.value,op.controller.signal),op);if(op.controller.signal.aborted||!current(op))throw Error();snapshot.value=result
   if(result.stage==='failed'){op.terminal=true;phase.value='failed';error.value='setup-failed';return false}
   if(result.stage!=='complete')return true
   // Read actual registration after completion, never invent an id from a path or receipt.
   await browser.refreshProjects();if(!current(op)||op.controller.signal.aborted)throw Error()
   const found=browser.projects.find(p=>p.id===result.projectId&&projectDisplayPathKey(p.path)===projectDisplayPathKey(op.path))
   if(!found||result.failureReported===true)throw Error()
   if(op.persistScope){if(!op.scope||op.scopeDispatched)throw Error();op.scopeDispatched=true;await op.scope.run({kind:'setup-scope',projectId:found.id,setupOperationId:operationId.value,preset:op.preset},op.controller.signal);await op.scope.waitForIdle();if(!current(op)||op.controller.signal.aborted)throw Error()}
   project.value=found;op.terminal=true;phase.value='complete';return true
  }catch{phase.value='paused';error.value='status-or-scope-unconfirmed';return false}
  finally{op.controller=undefined;if(await release(op))schedule(op)}
 }
 function pause(){clearTimeout(timer);if(active&&!active.terminal){active.controller?.abort();phase.value=operationId.value?'paused':'unknown';error.value='waiting-stopped'}else clearRead()}
 async function resume(){if(!canResume.value)return false;active!.started=Date.now();return poll()}
 watch(()=>[browser.provider,browser.connected,projectSetupProvider.value,projectConnectionsProvider.value,browser.provider?.label,projectSetupProvider.value?.label,projectConnectionsProvider.value?.label,toolPresetReadProvider.value,toolPresetReadProvider.value?.label,JSON.stringify(browser.projects.map(p=>[p.id,p.name,p.path]))],()=>{if(!active){clearRead();return}readEpoch++;readAbort?.abort();if(active&&!current(active)){pause();phase.value='unknown';error.value='source-changed'}},{flush:'sync'})
 return {target,presets,presetId,presetExplicit,project,phase,error,operationId,snapshot,busy,canStart,canResume,prepare,selectPreset,start,resume,pause,clearRead}
})
