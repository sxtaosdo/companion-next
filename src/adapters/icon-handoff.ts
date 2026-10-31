import { createIconSceneBindingProvider, type SceneBindingPath } from './icon-scene-binding'
import { IconHandoffError, validateIconHandoffInput, decodeIconHandoffResponse, type IconHandoffProvider } from '../domain/icon-handoff'
export type IconHandoffFetch=(path:`/api/icons/${string}/handoff`|SceneBindingPath,init:RequestInit)=>Promise<Response>
/** Existing authenticated same-origin route. The packet route only reads original task/artifact evidence. */
export function createIconHandoffProvider(options:{fetch:IconHandoffFetch;timeoutMs?:number}):IconHandoffProvider {
 if(typeof options?.fetch!=='function')throw Error('Explicit handoff transport required')
 const timeout=options.timeoutMs??20_000;if(!Number.isFinite(timeout)||timeout<1||timeout>20_000)throw Error('Invalid handoff timeout')
 let busy=false,idle=Promise.resolve()
 return {sceneBinding:createIconSceneBindingProvider({fetch:options.fetch,origin:'http://127.0.0.1:32180',timeoutMs:timeout}),label:'原图标任务交接包',waitForIdle:()=>idle,async prepare(projectId,input,snapshot,signal){
  if(busy)throw new IconHandoffError('busy','not-sent');if(signal?.aborted)throw new IconHandoffError('aborted','not-sent')
  const checked=validateIconHandoffInput(projectId,input,snapshot),body=JSON.stringify(checked);if(new TextEncoder().encode(body).byteLength>4096)throw new IconHandoffError('invalid-input','not-sent')
  busy=true;let finish!:()=>void;idle=new Promise(resolve=>{finish=resolve});let active=0,processing=false,invoked=false,timedOut=false
  const release=()=>{if(processing&&active===0){busy=false;finish()}},track=<T>(p:Promise<T>)=>{active++;void p.then(()=>{active--;release()},()=>{active--;release()});return p}
  const controller=new AbortController(),cancel=()=>controller.abort(),failure=()=>new IconHandoffError(timedOut?'timeout':'aborted',invoked?'unknown':'not-sent')
  const wait=<T>(p:Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{const abort=()=>{controller.signal.removeEventListener('abort',abort);reject(failure())};controller.signal.addEventListener('abort',abort,{once:true});void p.then(v=>{controller.signal.removeEventListener('abort',abort);resolve(v)},e=>{controller.signal.removeEventListener('abort',abort);reject(e)});if(controller.signal.aborted)abort()})
  signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(()=>{timedOut=true;controller.abort()},timeout)
  try {
   const response=await wait(track(Promise.resolve().then(()=>{if(controller.signal.aborted)throw failure();invoked=true;return options.fetch(`/api/icons/${projectId}/handoff`,{method:'POST',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json'},body,signal:controller.signal})}).then(r=>{if(controller.signal.aborted&&r.body)void track(r.body.cancel()).catch(()=>undefined);return r})))
   const discard=()=>{if(response.body)void track(response.body.cancel()).catch(()=>undefined)}
   if(response.redirected||response.type==='opaque'||response.type==='opaqueredirect'){discard();throw new IconHandoffError('invalid-shape')}
   if(response.status===401||response.status===403){discard();throw new IconHandoffError(response.status===401?'unauthorized':'forbidden')}
   if(response.status!==200){discard();throw new IconHandoffError('unconfirmed')}
   if(!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type')??'')){discard();throw new IconHandoffError('invalid-shape')}
   const declared=response.headers.get('content-length');if(declared&&/^\d+$/.test(declared)&&Number(declared)>32768){discard();throw new IconHandoffError('too-large')}
   if(!response.body)throw new IconHandoffError('invalid-shape')
   const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let bytes=0,chunks=0,text='',complete=false
   try{for(;;){const next=await wait(track(reader.read()));if(next.done)break;bytes+=next.value.byteLength;if(bytes>32768||++chunks>4096)throw new IconHandoffError('too-large');text+=decoder.decode(next.value,{stream:true})}text+=decoder.decode();complete=true}
   finally{if(!complete)void track(reader.cancel()).catch(()=>undefined);try{reader.releaseLock()}catch{/* idle remains tracked */}}
   if(controller.signal.aborted)throw failure();return decodeIconHandoffResponse(JSON.parse(text),projectId,checked,snapshot)
  }catch(e){if(controller.signal.aborted)throw failure();if(e instanceof IconHandoffError)throw e;throw new IconHandoffError('unconfirmed',invoked?'unknown':'not-sent')}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);processing=true;release()}
 }}
}
