import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { cropIdentity, decodeCropReply, isCropHash, ReferenceCropNotSent } from '../domain/ai-reference-crop'
import type { CropRequest,ReferenceCrop,ReferenceCropProvider } from '../domain/ai-reference-crop'
export interface CropContext {projectId:string;projectPath:string;source:object;hash:string|null;provider:ReferenceCropProvider}
interface Fence {projectId:string;projectPath:string;hash:string|null;cropId:string}
const storageKey='companion-next-reference-crop-fences-v1'
/** No image bytes/credentials persisted. Unconfirmed requests survive navigation and can only be queried. */
export const useReferenceCropStore=defineStore('reference-crop',()=>{
 const context=shallowRef<CropContext|null>(null),pending=ref(false),notice=ref(''),receipt=shallowRef<ReferenceCrop|null>(null),fences=ref<Fence[]>([]),storageHealthy=ref(true)
 let serial=0,controller:AbortController|undefined
 try{const stored=sessionStorage.getItem(storageKey);if(stored){if(stored.length>512000)throw Error();const parsed=JSON.parse(stored);if(!Array.isArray(parsed)||parsed.length>100||parsed.some(v=>!v||!/^[a-f0-9]{16}$/.test(v.projectId)||typeof v.projectPath!=='string'||v.projectPath.length>4096||v.hash!==null&&!isCropHash(v.hash)||!isCropHash(v.cropId)))throw Error();fences.value=parsed}}
 catch{storageHealthy.value=false;notice.value='原请求记录无法读取，禁止保存。'}
 const same=(a:CropContext|null,b:CropContext|null)=>a===b||!!a&&!!b&&a.projectId===b.projectId&&a.projectPath===b.projectPath&&a.source===b.source&&a.hash===b.hash&&a.provider===b.provider
 const matching=computed(()=>fences.value.filter(f=>context.value&&f.projectId===context.value.projectId&&f.projectPath===context.value.projectPath&&f.hash===context.value.hash))
 const blocked=computed(()=>pending.value||!context.value||!storageHealthy.value||fences.value.some(f=>f.projectId===context.value?.projectId&&f.projectPath===context.value?.projectPath))
 function persist(){try{sessionStorage.setItem(storageKey,JSON.stringify(fences.value));return true}catch{storageHealthy.value=false;notice.value='无法保存原请求标识，已阻止新的写入。';return false}}
 function cancel(){const needsQuery=pending.value||matching.value.length>0;serial++;controller?.abort();controller=undefined;pending.value=false;receipt.value=null;notice.value=!storageHealthy.value?'原请求记录不可用，已阻止保存。':needsQuery?'已停止等待；原请求仍需查询，不代表取消保存。':''}
 function bind(next:CropContext|null){if(!same(context.value,next)){cancel();context.value=next;notice.value=storageHealthy.value?'':'原请求记录不可用，已阻止保存。'}}
 async function run(c:CropContext,id:string,input?:CropRequest){
  const version=++serial;controller=new AbortController();pending.value=true;notice.value='';receipt.value=null
  const current=()=>version===serial&&same(context.value,c)
  try{const raw=await(input?c.provider.save(c.projectId,input,controller.signal):c.provider.query(c.projectId,id,controller.signal));const reply=await decodeCropReply(raw,c.projectId,id,input);if(!current())return
   if(reply.state!=='available'){notice.value='原裁剪结果仍待核对，未重发保存。';return}
   fences.value=fences.value.filter(f=>!(f.projectId===c.projectId&&f.projectPath===c.projectPath&&f.cropId===id));if(!persist())return
   receipt.value=reply.crop;notice.value='全图、主体、原文件及回执已保存；参考图尚未参与模型生成。'
  }catch(error){if(input&&error instanceof ReferenceCropNotSent){fences.value=fences.value.filter(f=>!(f.projectId===c.projectId&&f.projectPath===c.projectPath&&f.cropId===id));persist();if(current())notice.value=error.message}else if(current())notice.value='裁剪结果未知，请仅查询原裁剪，不要重新保存。'}
  finally{if(current()){pending.value=false;controller=undefined}}
 }
 async function save(input:CropRequest,id:string){const c=context.value;if(blocked.value||!c)return;const version=serial;try{if(await cropIdentity(input)!==id)throw Error()}catch{notice.value='裁剪标识无效，未发送。';return}if(version!==serial||blocked.value||!same(context.value,c))return
  if(fences.value.length>=100){storageHealthy.value=false;notice.value='待核对原请求过多，已阻止新保存。';return}
  fences.value.push({projectId:c.projectId,projectPath:c.projectPath,hash:c.hash,cropId:id});if(!persist())return;await run(c,id,input)
 }
 async function query(id:string){const c=context.value;if(!c||pending.value||!storageHealthy.value||!matching.value.some(f=>f.cropId===id))return;await run(c,id)}
 return {context,pending,notice,receipt,matching,blocked,storageHealthy,bind,cancel,save,query}
})
