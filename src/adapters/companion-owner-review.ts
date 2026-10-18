import type { ImageReviewProvider } from '../domain/image-review'
import { ImageReviewRejection } from '../domain/image-review'
import { normalizeImageReviewState } from './image-review-state'
import type { ReviewFetch } from './image-review'
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/.test(v)
/** Existing Companion cookie only; no process token, URL/base input, download or bootstrap. */
export function createCompanionOwnerReviewProvider(fetch:ReviewFetch):ImageReviewProvider{
 let verified=false
 async function json(operation:'state'|'capabilities'|'select'|'export',body?:unknown,signal?:AbortSignal):Promise<Record<string,unknown>>{
  const response=await fetch(`/api/owner-review/${operation}`,{method:body===undefined?'GET':'POST',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal})
  if(!response.ok){await response.body?.cancel();if([400,403,409].includes(response.status))throw new ImageReviewRejection(response.status as 400|403|409);throw Error('Owner 图片接口不可用或结果未确认；不自动重发。')}
  if(response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??'')||!response.body)throw Error('Owner 图片回执格式无效')
  const length=response.headers.get('content-length');if(length&&Number(length)>2*1024*1024){await response.body.cancel();throw Error('Owner 回执超出读取预算')}
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0,count=0
  try{for(;;){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>2*1024*1024||++count>4096){await reader.cancel();throw Error('Owner 回执超出读取预算')}chunks.push(next.value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw Error('Owner 图片回执格式无效')}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Owner 图片回执格式无效');return value as Record<string,unknown>
 }
 function selected(taskId:string,ids:string[],save=false){if(!verified||!id(taskId)||!Array.isArray(ids)||ids.length>30||save&&ids.length<1||new Set(ids).size!==ids.length||!ids.every(id))throw Error('Owner 任务或选择未通过保护校验');return {expected_task_id:taskId,selected_ids:[...ids]}}
 return {label:'Companion 同源 Owner 图片预览与保存',candidateImportEnabled:false,get saveSelectionGuard(){return verified?'verified':'unverified'},get selectionGuard(){return verified?'verified':'unverified'},workflowGuard:'unverified',
  async loadState(signal){verified=false;const caps=await json('capabilities',undefined,signal);if(caps.schema_version!==1||caps.guarded_export!==true||caps.guarded_selection!==true||caps.guarded_review_actions!==false)throw Error('Owner 窄宿主能力未核实');const state=normalizeImageReviewState(await json('state',undefined,signal));verified=true;return state},
  async persistSelection(taskId,ids){await json('select',selected(taskId,ids))},
  async importCandidates(){throw Error('此宿主仅开放现有图片预览、选择和保存，未开放导入或下载。')},
  async loadPreview(imageId,variant,signal){if(signal?.aborted)throw new DOMException('已取消','AbortError');if(!verified||!id(imageId)||!['thumb','full'].includes(variant))throw Error('Owner 预览身份未核实');return {kind:'same-origin-image',path:`/owner-review/image/${imageId}/${variant}`}},
  async saveSelected(expected){const raw=await json('export',selected(expected.taskId,expected.ids,true));if(typeof raw.cancelled!=='boolean'||!Array.isArray(raw.results)||raw.results.length>30||raw.directory!==undefined&&(typeof raw.directory!=='string'||raw.directory.length>4096))throw Error('Owner 保存结果未确认');const rows=raw.results.map(value=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Owner 保存结果未确认');const row=value as Record<string,unknown>;if(!id(row.id)||typeof row.ok!=='boolean'||row.filename!==undefined&&typeof row.filename!=='string'||row.error!==undefined&&typeof row.error!=='string')throw Error('Owner 保存结果未确认');return {id:row.id,ok:row.ok,...(typeof row.filename==='string'?{filename:row.filename}:{}),...(typeof row.error==='string'?{error:row.error}:{})}});return {cancelled:raw.cancelled,results:rows,...(typeof raw.directory==='string'?{directory:raw.directory}:{})}},
 }
}
