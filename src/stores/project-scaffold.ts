import { ref,shallowRef,toRaw,watch } from 'vue'
import { defineStore } from 'pinia'
import { ProjectSetupError,validateProjectPath,validateProjectScaffoldInput } from '../domain/project-setup'
import type { ProjectScaffoldInput,ProjectScaffoldResult,ProjectSetupProvider } from '../domain/project-setup'
import type { CompanionBrowserProvider } from '../domain/companion-browser'
import { projectSetupProvider } from '../project-setup-integration'
import { useCompanionBrowserStore } from './companion-browser'
import { useProjectOperationLaneStore } from './project-operation-lane'

export interface PreparedScaffold {readonly input:Readonly<ProjectScaffoldInput>;readonly sourceLabel:string}
export interface ScaffoldReceipt {readonly phase:'sending'|'acknowledged'|'unknown'|'rejected'|'not-dispatched';readonly input:Readonly<ProjectScaffoldInput>;readonly sourceLabel:string;readonly result?:Readonly<ProjectScaffoldResult>;readonly message:string}
interface Binding {reader:CompanionBrowserProvider;writer:ProjectSetupProvider;readLabel:string;writeLabel:string;dispatch:NonNullable<ProjectSetupProvider['scaffold']>}

/** Same-session scaffold exclusion only; an unknown filesystem outcome has no reset/replay API. */
export const useProjectScaffoldStore=defineStore('project-scaffold',()=>{
 const projects=useCompanionBrowserStore(),lane=useProjectOperationLaneStore()
 const prepared=shallowRef<PreparedScaffold|null>(null),receipt=shallowRef<ScaffoldReceipt|null>(null),pending=ref(false),error=ref('')
 const approvals=new WeakMap<PreparedScaffold,Binding>()
 function clearPrepared(){if(prepared.value)approvals.delete(prepared.value);prepared.value=null}
 function current(binding:Binding){return projects.connected&&toRaw(projects.provider)===binding.reader&&toRaw(projectSetupProvider.value)===binding.writer&&binding.reader.label===binding.readLabel&&binding.writer.label===binding.writeLabel&&binding.writer.scaffold===binding.dispatch}
 function prepare(input:ProjectScaffoldInput):PreparedScaffold|null {
  clearPrepared()
  const reader=projects.provider?toRaw(projects.provider):null,writer=projectSetupProvider.value?toRaw(projectSetupProvider.value):null
  if(lane.locked||pending.value){error.value='工程操作仍在等待或结果未知，未准备新请求。';return null}
  if(!projects.connected||!reader||!writer?.scaffold){error.value='当前连接未提供原创建/初始化接口。';return null}
  let spec:ProjectScaffoldInput
  try{spec=validateProjectScaffoldInput(input)}catch{error.value='请核对绝对目录、工程名称和 Creator 3.8.8；未发送请求。';return null}
  const binding:Binding={reader,writer,readLabel:reader.label,writeLabel:writer.label,dispatch:writer.scaffold}
  const preview=Object.freeze({input:Object.freeze(spec),sourceLabel:`${reader.label} / ${writer.label}`})
  approvals.set(preview,binding);prepared.value=preview;error.value='';return preview
 }
 async function send(preview:PreparedScaffold|null,confirmed:boolean):Promise<Readonly<ProjectScaffoldResult>|null>{
  if(confirmed!==true||!preview||preview!==prepared.value)return null
  const binding=approvals.get(preview)
  if(!binding||!current(binding)||lane.locked||pending.value){clearPrepared();error.value='来源或连接已变化，请重新核对原请求。';return null}
  clearPrepared()
  const lease=lane.acquire(preview.input.mode==='create'?'创建工程目录':'初始化空目录');if(!lease)return null
  pending.value=true;error.value=''
  receipt.value=Object.freeze({phase:'sending',input:preview.input,sourceLabel:preview.sourceLabel,message:'原目录请求已发送；关闭页面不会取消后台文件写入。'})
  let terminal=false,result:Readonly<ProjectScaffoldResult>|null=null
  try{
   const raw=await binding.dispatch.call(binding.writer,preview.input)
   if(!raw||raw.creatorVersion!=='3.8.8'||Object.keys(raw).sort().join(',')!=='creatorVersion,path')throw new ProjectSetupError('invalid-shape')
   let path:string
   try{path=validateProjectPath(raw.path)}catch{throw new ProjectSetupError('invalid-shape')}
   result=Object.freeze({path,creatorVersion:'3.8.8'})
   terminal=true;receipt.value=Object.freeze({phase:'acknowledged',input:preview.input,sourceLabel:preview.sourceLabel,result,message:'原后台确认已生成最小工程；尚未登记、安装或启动。'})
  }catch(caught){
   const safe=caught instanceof ProjectSetupError?new ProjectSetupError(caught.code,caught.outcome):new ProjectSetupError('network-error')
   terminal=safe.outcome==='rejected'||safe.outcome==='not-dispatched'
   const phase=terminal?safe.outcome:'unknown'
   const message=terminal?`${safe.message} 未自动重试。`:'创建/初始化结果未知，后台可能已写入。请核对原目标目录；没有查询或取消回执前，不会解锁其他工程写操作或重发。'
   receipt.value=Object.freeze({phase:phase as ScaffoldReceipt['phase'],input:preview.input,sourceLabel:preview.sourceLabel,message});error.value=message
  }finally{
   let cleaned=false
   try{await binding.writer.waitForIdle();cleaned=true}catch{error.value='无法确认原目录请求已结束，工程操作仍锁定；请核对原宿主。'}
   pending.value=false
   if(cleaned&&terminal)lane.release(lease)
  }
  return result
 }
 watch(()=>[projects.provider,projectSetupProvider.value,projects.connected],clearPrepared,{flush:'sync'})
 return {prepared,receipt,pending,error,prepare,send,clearPrepared}
})
