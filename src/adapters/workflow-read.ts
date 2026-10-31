import { decodeWorkflowRead, WorkflowReadError } from '../domain/workflow-read'
import type { WorkflowReadProvider } from '../domain/workflow-read'
export type WorkflowReadFetch=(input:string,init:RequestInit)=>Promise<Response>
export function createWorkflowReadProvider(options:{fetch:WorkflowReadFetch;timeoutMs?:number}):WorkflowReadProvider {
 const timeoutMs=options.timeoutMs??10_000
 if(typeof options.fetch!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>10_000)throw new TypeError('Invalid workflow read provider')
 return {async read(projectId,signal){
  if(projectId!==undefined&&!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(projectId))throw new WorkflowReadError('invalid-query')
  if(signal?.aborted)throw new WorkflowReadError('aborted')
  const controller=new AbortController();let timedOut=false
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true})
  let rejectAbort:(error:WorkflowReadError)=>void=()=>{}
  const stopped=new Promise<never>((_,reject)=>{rejectAbort=reject})
  const onAbort=()=>rejectAbort(new WorkflowReadError(timedOut?'timeout':'aborted'))
  controller.signal.addEventListener('abort',onAbort,{once:true})
  const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeoutMs)
  try{return await Promise.race([stopped,(async()=>{
   const response=await options.fetch(`/api/workflow/read${projectId?`?project=${encodeURIComponent(projectId)}`:''}`,{method:'GET',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal})
   if(controller.signal.aborted){void response.body?.cancel().catch(()=>{});throw new WorkflowReadError(timedOut?'timeout':'aborted')}
   if(response.status!==200){void response.body?.cancel().catch(()=>{});throw new WorkflowReadError(response.status===401?'unauthorized':response.status===403?'forbidden':'http-error')}
   if(response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??'')||!response.body||Number(response.headers.get('content-length'))>1_048_576){void response.body?.cancel().catch(()=>{});throw new WorkflowReadError('invalid-shape')}
   const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let body='',bytes=0,chunks=0,complete=false
   try{while(true){const next=await Promise.race([reader.read(),stopped]);if(next.done)break;bytes+=next.value.byteLength;if(bytes>1_048_576||++chunks>2048)throw new WorkflowReadError('invalid-shape');body+=decoder.decode(next.value,{stream:true})}body+=decoder.decode();complete=true;return decodeWorkflowRead(JSON.parse(body))}
   catch(error){if(error instanceof WorkflowReadError)throw error;throw new WorkflowReadError('invalid-shape')}
   finally{if(!complete)void reader.cancel().catch(()=>{});try{reader.releaseLock()}catch{/* Pending non-cooperative reader. */}}
  })()])}catch(error){if(error instanceof WorkflowReadError)throw error;throw new WorkflowReadError('network-error')}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',onAbort)}
 }}
}
