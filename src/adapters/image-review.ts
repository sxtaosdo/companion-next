import type { ImageReviewProvider } from '../domain/image-review'
import { ImageReviewRejection } from '../domain/image-review'
import { parsePickerImport, PICKER_IMPORT_MAX_BYTES } from '../domain/picker-import'
import { validateImageSearch } from '../domain/image-review-workflow'
import { normalizeImageReviewState } from './image-review-state'
export { normalizeImageReviewState } from './image-review-state'
export type ReviewFetch = (input: string, init: RequestInit) => Promise<Response>
const ID = /^[a-f0-9]{32}$/
function record(input:unknown):Record<string,unknown>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('审阅服务响应不是有效对象');return input as Record<string,unknown>}
function list(input:unknown):unknown[]{if(!Array.isArray(input)||input.length>30)throw new Error('审阅服务候选数量无效');return input}
function identifier(input:unknown):string{if(typeof input!=='string'||!ID.test(input))throw new Error('审阅任务或候选 ID 无效');return input}
async function bytes(response:Response,limit:number):Promise<Uint8Array>{
 const length=response.headers.get('content-length')
 if(length&&Number(length)>limit){await response.body?.cancel();throw new Error('审阅响应超过读取预算')}
 if(!response.body)throw new Error('审阅服务返回空响应')
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0
 try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>limit){await reader.cancel();throw new Error('审阅响应超过读取预算')}chunks.push(next.value)}}finally{reader.releaseLock()}
 const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.byteLength}return out
}
/** Host-only composition: getProcessToken must read the existing SAME-ORIGIN process bootstrap.
 * Never copy a Windows token into dot, accept a token input field, persist it, or pass a remote base URL.
 * Construction and registration make no request. Saving remains closed until the service provides
 * an atomic expected-task / selected-IDs guard; the existing /api/export {} alone cannot promise it.
 */
export function createSameOriginImageReviewProvider(options:{fetch:ReviewFetch;getProcessToken:()=>string|Promise<string>;guardedExport?:boolean}):ImageReviewProvider{
 if(typeof options.fetch!=='function'||typeof options.getProcessToken!=='function')throw new Error('审阅适配器需要可信同源会话注入')
 let guardVerified=false
 let workflowVerified=false
 let selectionVerified=false
 async function token(){const value=await options.getProcessToken();if(typeof value!=='string'||value.length<16||value.length>256||!/^[a-zA-Z0-9_-]+$/.test(value))throw new Error('本进程审阅会话尚未建立');return value}
 async function json(path:'/api/state'|'/api/import'|'/api/companion/capabilities'|'/api/companion/export'|'/api/companion/search'|'/api/companion/task'|'/api/companion/retry'|'/api/companion/stop'|'/api/companion/recycle'|'/api/companion/restore'|'/api/companion/select',body?:unknown,signal?:AbortSignal){
  const contents=body===undefined?undefined:JSON.stringify(body)
  if(contents&&new TextEncoder().encode(contents).byteLength>(path==='/api/import'?PICKER_IMPORT_MAX_BYTES:8192))throw new Error('审阅请求超过合同上限')
  if(signal?.aborted)throw new DOMException('请求已取消','AbortError')
  const sessionToken=await token()
  if(signal?.aborted)throw new DOMException('请求已取消','AbortError')
  const response=await options.fetch(path,{method:body===undefined?'GET':'POST',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'X-Review-Token':sessionToken,...(body===undefined?{}:{'Content-Type':'application/json'})},body:contents,signal})
  if(!response.ok){await response.body?.cancel();if(response.status===403||(path.startsWith('/api/companion/')&&[400,409].includes(response.status)))throw new ImageReviewRejection(response.status as 400|403|409);throw new Error(`审阅接口返回 HTTP ${response.status}；没有确认任务或文件保存`)}
  if(!response.headers.get('content-type')?.toLowerCase().includes('application/json')){await response.body?.cancel();throw new Error('审阅接口未返回 JSON')}
  let result:unknown;try{result=JSON.parse(new TextDecoder().decode(await bytes(response,1024*1024)))}catch{throw new Error('审阅接口 JSON 无效或超过读取预算')}return result
 }
 async function control(path:'/api/companion/search'|'/api/companion/task'|'/api/companion/retry'|'/api/companion/stop'|'/api/companion/recycle'|'/api/companion/restore'|'/api/companion/select',body:{expected_task_id:string|null;[key:string]:unknown}){
  if(!workflowVerified)throw new Error('本机桥接尚未核实任务绑定操作，未发送请求')
  if(body.expected_task_id!==null)identifier(body.expected_task_id)
  if(body.expected_task_id===null&&!['/api/companion/search','/api/companion/task'].includes(path))throw new Error('当前任务尚未确定')
  const response=record(await json(path,body));if(response.ok!==true)throw new Error('服务未确认受理；操作结果未知')
 }
 return {
  label:'图片素材本进程同源审阅接口',get saveSelectionGuard(){return guardVerified?'verified':'unverified'},get workflowGuard(){return workflowVerified?'verified':'unverified'},get selectionGuard(){return selectionVerified?'verified':'unverified'},
  async loadState(signal){
   guardVerified=false;workflowVerified=false;selectionVerified=false
   let workflowCapability=false;let selectionCapability=false
   if(options.guardedExport){const capability=record(await json('/api/companion/capabilities',undefined,signal));if(capability.schema_version!==1||capability.guarded_export!==true)throw new Error('本机桥接尚未声明受保护保存合同');workflowCapability=capability.guarded_review_actions===true;selectionCapability=capability.guarded_selection===true}
   const state=normalizeImageReviewState(await json('/api/state',undefined,signal));guardVerified=options.guardedExport===true;workflowVerified=workflowCapability;selectionVerified=selectionCapability;return state
  },
  async persistSelection(expectedTaskId,selectedIds){if(!selectionVerified)throw new Error('本机桥接尚未核实选择持久化保护，未发送请求');if(!Array.isArray(selectedIds)||selectedIds.length>30||new Set(selectedIds).size!==selectedIds.length)throw new Error('保留选择列表无效');selectedIds.forEach(identifier);await control('/api/companion/select',{expected_task_id:expectedTaskId,selected_ids:[...selectedIds]})},
  async searchImages(expectedTaskId,input){const checked=validateImageSearch(input);await control('/api/companion/search',{expected_task_id:expectedTaskId,query:checked.query,limit:checked.limit,source_ids:checked.sourceIds})},
  async switchTask(expectedTaskId,taskId){identifier(taskId);await control('/api/companion/task',{expected_task_id:expectedTaskId,id:taskId})},
  async retryImage(expectedTaskId,id){identifier(id);await control('/api/companion/retry',{expected_task_id:expectedTaskId,id})},
  async requestStop(expectedTaskId){await control('/api/companion/stop',{expected_task_id:expectedTaskId})},
  async recycleUnselected(expectedTaskId,selectedIds){if(!Array.isArray(selectedIds)||selectedIds.length>30||new Set(selectedIds).size!==selectedIds.length)throw new Error('回收保留列表无效');selectedIds.forEach(identifier);await control('/api/companion/recycle',{expected_task_id:expectedTaskId,selected_ids:[...selectedIds]})},
  async restoreImages(expectedTaskId){await control('/api/companion/restore',{expected_task_id:expectedTaskId})},
  async importCandidates(manifest,signal){const result=record(await json('/api/import',parsePickerImport(JSON.stringify(manifest)),signal));if(result.ok!==true)throw new Error('服务未确认下载入队')},
  async loadPreview(id,variant,signal){
   identifier(id);if(!['thumb','full'].includes(variant))throw new Error('预览类型无效')
   if(signal?.aborted)throw new DOMException('预览已取消','AbortError')
   const sessionToken=await token()
   if(signal?.aborted)throw new DOMException('预览已取消','AbortError')
   return {kind:'same-origin-image',path:`/image/${encodeURIComponent(sessionToken)}/${id}/${variant}`}
  },
  async saveSelected(expected){
   if(!guardVerified)throw new Error('现有 export 接口尚未核实任务 / 选择原子保护，目录保存未启用')
   identifier(expected.taskId);if(!expected.ids.length||expected.ids.length>30||new Set(expected.ids).size!==expected.ids.length)throw new Error('保存选择无效');expected.ids.forEach(identifier)
   const raw=record(await json('/api/companion/export',{expected_task_id:expected.taskId,selected_ids:expected.ids}))
   if(typeof raw.cancelled!=='boolean'||(raw.directory!==undefined&&(typeof raw.directory!=='string'||raw.directory.length>4096)))throw new Error('保存响应格式无效')
   const results=list(raw.results).map(value=>{const row=record(value);const id=identifier(row.id);if(typeof row.ok!=='boolean'||(row.filename!==undefined&&typeof row.filename!=='string')||(row.error!==undefined&&typeof row.error!=='string'))throw new Error('保存项目回执格式无效');return {id,ok:row.ok,filename:row.filename as string|undefined,error:row.error as string|undefined}})
   return {cancelled:raw.cancelled,directory:raw.directory as string|undefined,results}
  },
 }
}

/** Used only by the trusted local /companion/ host. Reads bootstrap HTML inertly, never its script. */
export function createHostedImageReviewProvider(fetch: ReviewFetch):ImageReviewProvider {
 let session:Promise<string>|null=null
 async function bootstrap(){
  const response=await fetch('/',{method:'GET',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store'})
  if(!response.ok||!response.headers.get('content-type')?.toLowerCase().includes('text/html')){await response.body?.cancel();throw new Error('本进程审阅首页未就绪')}
  const html=new TextDecoder().decode(await bytes(response,1024*1024))
  const matches=[...html.matchAll(/<body\b[^>]*\bdata-token=["']([A-Za-z0-9_-]{16,256})["']/gi)]
  if(matches.length!==1)throw new Error('未取得唯一的同源进程会话')
  return matches[0]![1]!
 }
 const provider=createSameOriginImageReviewProvider({fetch,guardedExport:true,getProcessToken:()=>{
  if(!session){const current=bootstrap();session=current;void current.catch(()=>{if(session===current)session=null})}
  return session
 }})
 return Object.assign(provider,{resetSession(){session=null}})
}
