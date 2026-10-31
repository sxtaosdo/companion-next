import { checkedSceneTestSpriteInput,verifySceneTestSpriteResult,type SceneTestSpriteResult,ICON_SCENE_BINDING_PROJECT,SceneBindingError,checkedSceneBindingSource,decodeSceneBindingReply,sceneBindingAssetUrl,verifySceneBindingResult,sceneBindingOperationId,sceneBindingEqual,type IconSceneBindingProvider,type SceneBindingAction,type SceneBindingReply,type SceneBindingResult,type SceneBindingScenes,type SceneBindingTree,type SceneBindingResolution } from '../domain/icon-scene-binding'
export type SceneBindingPath=`/api/projects/${string}/scene-binding/${SceneBindingAction}`
export type SceneBindingFetch=(path:SceneBindingPath,init:RequestInit)=>Promise<Response>
export function createIconSceneBindingProvider(options:{fetch:SceneBindingFetch;origin:string;timeoutMs?:number}):IconSceneBindingProvider {
 const endpoint=new URL(options.origin),timeout=options.timeoutMs??30000
 if(endpoint.protocol!=='http:'||endpoint.hostname!=='127.0.0.1'||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash||!Number.isFinite(timeout)||timeout<1||timeout>120000)throw new SceneBindingError('invalid-input')
 let busy=false,idle:Promise<void>=Promise.resolve()
 async function request(projectId:string,action:SceneBindingAction,input:unknown,signal?:AbortSignal):Promise<SceneBindingReply>{
  if(projectId!==ICON_SCENE_BINDING_PROJECT)throw new SceneBindingError('invalid-input')
  if(busy)throw new SceneBindingError('busy');if(signal?.aborted)throw new SceneBindingError('invalid-input')
  const body=JSON.stringify(input);if(new TextEncoder().encode(body).length>16384)throw new SceneBindingError('invalid-input')
  busy=true;let finish!:()=>void;idle=new Promise(resolve=>{finish=resolve})
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,timeout)
  let dispatched=false,active=0,processing=false
  const release=()=>{if(processing&&active===0){busy=false;finish()}},track=<T>(promise:Promise<T>)=>{active++;void promise.then(()=>{active--;release()},()=>{active--;release()});return promise}
  const wait=<T>(promise:Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{const cancel=()=>{controller.signal.removeEventListener('abort',cancel);reject(new SceneBindingError('unknown',dispatched))};controller.signal.addEventListener('abort',cancel,{once:true});void promise.then(value=>{controller.signal.removeEventListener('abort',cancel);resolve(value)},error=>{controller.signal.removeEventListener('abort',cancel);reject(error)});if(controller.signal.aborted)cancel()})
  try{
   const response=await wait(track(Promise.resolve().then(()=>{if(controller.signal.aborted)throw new SceneBindingError('unknown',false);dispatched=true;return options.fetch(`/api/projects/${projectId}/scene-binding/${action}`,{method:'POST',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'content-type':'application/json',Accept:'application/json'},body,signal:controller.signal})}).then(result=>{if(controller.signal.aborted&&result.body)void track(result.body.cancel()).catch(()=>undefined);return result})))
   const discard=()=>{if(response.body)void track(response.body.cancel()).catch(()=>undefined)}
   if(response.redirected||response.type==='opaque'||response.type==='opaqueredirect'){discard();throw new SceneBindingError('invalid-shape',true)}
   if(response.status===401||response.status===403){discard();throw new SceneBindingError('rejected')}
   if(response.status!==200){discard();throw new SceneBindingError('unknown',true)}
   if(!response.body||!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type')??'')){discard();throw new SceneBindingError('invalid-shape',true)}
   const reader=response.body.getReader(),decoder=new TextDecoder('utf-8',{fatal:true});let raw='',bytes=0,chunks=0,complete=false
   try{for(;;){const next=await wait(track(reader.read()));if(next.done)break;bytes+=next.value.byteLength;if(bytes>512*1024||++chunks>4096)throw new SceneBindingError('invalid-shape',true);raw+=decoder.decode(next.value,{stream:true})}raw+=decoder.decode();complete=true}
   finally{if(!complete)void track(reader.cancel()).catch(()=>undefined);try{reader.releaseLock()}catch{/* Outstanding reads keep the provider busy. */}}
   if(controller.signal.aborted)throw new SceneBindingError('unknown',true)
   return decodeSceneBindingReply(JSON.parse(raw),projectId,action)
  }catch(error){if(error instanceof SceneBindingError)throw error;throw new SceneBindingError('unknown',dispatched)}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);processing=true;release()}
 }
 return {label:'已导入图片的场景绑定',endpoint:endpoint.origin,waitForIdle:()=>idle,
   createTestSprite:async(projectId,input,signal)=>{checkedSceneTestSpriteInput(input,true);const result=await request(projectId,'create-test-sprite',input,signal) as SceneTestSpriteResult;verifySceneTestSpriteResult(result,input);return result},
   inspectTestSprite:async(projectId,input,signal)=>{checkedSceneTestSpriteInput(input);const result=await request(projectId,'inspect-test-sprite',input,signal) as SceneTestSpriteResult;verifySceneTestSpriteResult(result,input);return result},
  scenes:async(projectId,source,signal)=>{checkedSceneBindingSource(source);return await request(projectId,'scenes',{source},signal) as SceneBindingScenes},
  openTree:async(projectId,input,signal)=>{const {sceneUrl}=input;checkedSceneBindingSource(input.source);if(!sceneBindingOperationId(input.operationId)||!sceneBindingAssetUrl(sceneUrl,'scene'))throw new SceneBindingError('invalid-input');const result=await request(projectId,'open-tree',input,signal) as SceneBindingTree;if(result.sceneUrl!==sceneUrl)throw new SceneBindingError('invalid-shape',true);return result},
  create:async(projectId,input,signal)=>{checkedSceneBindingSource(input.source);if(!sceneBindingOperationId(input.operationId)||!sceneBindingAssetUrl(input.sceneUrl,'scene')||input.confirmation!=='CREATE_EMPTY_SCENE')throw new SceneBindingError('invalid-input');const result=await request(projectId,'create',input,signal) as SceneBindingTree;if(result.sceneUrl!==input.sceneUrl)throw new SceneBindingError('invalid-shape',true);return result},
  resolve:async(projectId,source,signal)=>{checkedSceneBindingSource(source);const result=await request(projectId,'resolve',{source},signal) as SceneBindingResolution;if(!sceneBindingEqual(result.source.artifact,source.artifact)||result.source.jobId!==source.jobId||result.source.revision!==source.revision||result.source.candidateId!==source.candidateId||result.source.requestHash!==source.requestHash||result.source.assetUrl!==source.assetUrl||result.source.assetSha256!==source.assetSha256)throw new SceneBindingError('invalid-shape',true);return result},
  observeTree:async(projectId,input,signal)=>{checkedSceneBindingSource(input.source);if(!sceneBindingAssetUrl(input.sceneUrl,'scene'))throw new SceneBindingError('invalid-input');const result=await request(projectId,'observe-tree',input,signal) as SceneBindingTree;if(result.sceneUrl!==input.sceneUrl)throw new SceneBindingError('invalid-shape',true);return result},
  bind:async(projectId,input,signal)=>{checkedSceneBindingSource(input.source);if(!sceneBindingOperationId(input.operationId)||!input.spriteFrameUuid||!sceneBindingAssetUrl(input.sceneUrl,'scene')||!sceneBindingAssetUrl(input.spriteFrameUrl)||!input.nodeKey||!input.expectedRevision||input.confirmation!=='BIND_SPRITEFRAME')throw new SceneBindingError('invalid-input');const result=await request(projectId,'bind',input,signal) as SceneBindingResult;verifySceneBindingResult(result,input,input.spriteFrameUuid);return result},
  readback:async(projectId,input,signal)=>{checkedSceneBindingSource(input.source);if(!sceneBindingAssetUrl(input.sceneUrl,'scene')||!input.nodeKey||!input.spriteFrameUuid)throw new SceneBindingError('invalid-input');const result=await request(projectId,'readback',input,signal) as SceneBindingResult;verifySceneBindingResult(result,input,input.spriteFrameUuid);return result},
 }
}
