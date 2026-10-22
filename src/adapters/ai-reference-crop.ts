import { isAiProjectId } from '../domain/ai-resource-read'
import { isCropHash, validateCropInput, ReferenceCropNotSent } from '../domain/ai-reference-crop'
import type { ReferenceCropProvider } from '../domain/ai-reference-crop'
/** Fixed existing same-origin routes. Abort stops waiting, never proves rollback. No retry/replay. */
export function createReferenceCropProvider(fetcher:typeof fetch,timeoutMs=20000):ReferenceCropProvider {
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>20000)throw Error('Invalid timeout')
 let busy=false
 async function request(id:string,operation:'reference-crop'|'reference-crop-status',body:unknown,signal?:AbortSignal):Promise<unknown>{
  if(!isAiProjectId(id)||signal?.aborted)throw new ReferenceCropNotSent()
  if(busy)throw new ReferenceCropNotSent()
  busy=true
  const controller=new AbortController();let settled=false,done=false
  const release=()=>{if(settled&&done)busy=false},abort=()=>controller.abort()
  signal?.addEventListener('abort',abort,{once:true})
  let rejectAbort!:(error:Error)=>void
  const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject})
  const stop=()=>{controller.abort();rejectAbort(Error('等待已停止，结果待核对，请查询原裁剪。'))}
  controller.signal.addEventListener('abort',()=>rejectAbort(Error('等待已停止，结果待核对，请查询原裁剪。')),{once:true})
  const timer=setTimeout(stop,timeoutMs)
  const pending=Promise.resolve().then(()=>{if(controller.signal.aborted)throw new ReferenceCropNotSent();return fetcher(`/api/icons/${id}/${operation}`,{method:'POST',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),signal:controller.signal})})
  void pending.then(response=>{settled=true;if(controller.signal.aborted)void response.body?.cancel().catch(()=>{});release()},()=>{settled=true;release()})
  try{
   const response=await Promise.race([pending,aborted])
   if(response.redirected||response.type==='opaque'||response.status!==200||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')??'')){void response.body?.cancel().catch(()=>{});throw Error(response.status===401?'会话失效，请重新登录后查询原裁剪。':response.status===403?'请求被拒绝，请核对权限；不要重复保存。':'裁剪结果未确认，请查询原请求。')}
   const reader=response.body?.getReader();if(!reader)throw Error('裁剪回执未确认。')
   let text='',size=0,chunks=0,complete=false;const decoder=new TextDecoder('utf-8',{fatal:true})
   try{while(true){const part=await Promise.race([reader.read(),aborted]);if(part.done)break;size+=part.value.byteLength;if(size>32768||++chunks>1024)throw Error('裁剪回执超限。');text+=decoder.decode(part.value,{stream:true})}text+=decoder.decode();complete=true;return JSON.parse(text) as unknown}
   finally{if(!complete)void reader.cancel().catch(()=>{});reader.releaseLock()}
  }catch{throw Error('裁剪结果未确认，请仅查询原请求。')}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);done=true;release()}
 }
 return Object.freeze({label:'Companion 原参考图裁剪接口',async save(id,input,signal){let checked;try{checked=await validateCropInput(id,input)}catch{throw new ReferenceCropNotSent()}return request(id,'reference-crop',checked,signal)},query(id,cropId,signal){if(!isCropHash(cropId))return Promise.reject(Error('原裁剪标识无效，未查询。'));return request(id,'reference-crop-status',{cropId},signal)}} satisfies ReferenceCropProvider)
}
