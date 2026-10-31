import { isAiCandidateId,isAiJobId,type AiJobSnapshot } from './ai-jobs-read'
import { completedVariantImportSource,type IconHandoff } from './icon-handoff'
import { artCanonical } from './project-art-pending'
export const ICON_SCENE_BINDING_PROJECT='16ad921aa0fb06d6'
export const ICON_SCENE_TEST_URL='db://assets/e2e-binding.scene'
export const ICON_SCENE_TEST_NODE_NAME='CompanionE2EIcon'
export type SceneBindingAction='scenes'|'open-tree'|'create'|'resolve'|'bind'|'readback'|'observe-tree'|'create-test-sprite'|'inspect-test-sprite'
export interface SceneBindingSource {jobId:string;revision:number;candidateId:string;requestHash:string;assetSha256:string;assetUrl:string;artifact:{kind:'mother'}|{kind:'variant';width:number;height:number}}
export interface SceneBindingNode {key:string;path:string;hasSprite:boolean;spriteFrameUuid:string|null}
export interface SceneBindingFrame {url:string;uuid:string;subAsset:'spriteFrame'}
export interface SceneBindingReceipt {sceneUrl:string;beforeRevision:string|null;afterRevision:string;nodeKey:string;component:'cc.Sprite';property:'spriteFrame';assetUrl:string;assetSha256:string;pngUuid:string;spriteFrameUuid:string;validated:boolean;receiptSha256:string}
interface Envelope {schemaVersion:'scene-binding-v1';projectId:string;action:SceneBindingAction;state:string;observedAt:string;receiptSha256?:string}
export interface SceneBindingScenes extends Envelope {action:'scenes';state:'ready'|'observed';scenes:{url:string;name:string}[]}
export interface SceneBindingTree extends Envelope {action:'open-tree'|'create'|'observe-tree';state:'ready'|'observed';sceneUrl:string;revision:string;nodes:SceneBindingNode[];testSpriteSceneReady?:boolean}
export interface SceneBindingResolution extends Envelope {action:'resolve';state:'ready';source:SceneBindingSource;pngUuid:string;spriteFrames:SceneBindingFrame[]}
export interface SceneBindingResult extends Envelope {action:'bind'|'readback';state:'bound'|'matched'|'not_matched'|'unknown';receipt:SceneBindingReceipt|null}
export interface SceneBindingInput {source:SceneBindingSource;sceneUrl:string;nodeKey:string;expectedRevision:string;spriteFrameUrl:string;spriteFrameUuid:string;operationId:string;confirmation:'BIND_SPRITEFRAME'}
export interface SceneBindingReadback {source:SceneBindingSource;sceneUrl:string;nodeKey:string;spriteFrameUuid:string}
export interface SceneTestSpriteIdentity {source:SceneBindingSource;sceneUrl:typeof ICON_SCENE_TEST_URL;expectedRevision:string;operationId:string}
export interface SceneTestSpriteCreateInput extends SceneTestSpriteIdentity {confirmation:'CREATE_E2E_TEST_SPRITE'}
export interface SceneTestSpriteResult extends Envelope {action:'create-test-sprite'|'inspect-test-sprite';state:'created'|'observed'|'unknown'|'rejected';sceneUrl:typeof ICON_SCENE_TEST_URL;expectedRevision:string;revision:string|null;nodeKey:string|null;nodes:SceneBindingNode[];operationId:string;operationStatus:'SUCCEEDED'|'FAILED'|'STARTED'|'UNKNOWN'|'MISSING';terminalReceiptId:string|null;saved:true|null}
export type SceneBindingReply=SceneBindingScenes|SceneBindingTree|SceneBindingResolution|SceneBindingResult|SceneTestSpriteResult
export interface IconSceneBindingProvider {
 readonly label:string;readonly endpoint:string
 createTestSprite?(projectId:string,input:SceneTestSpriteCreateInput,signal?:AbortSignal):Promise<SceneTestSpriteResult>
 inspectTestSprite?(projectId:string,input:SceneTestSpriteIdentity,signal?:AbortSignal):Promise<SceneTestSpriteResult>
 scenes(projectId:string,source:SceneBindingSource,signal?:AbortSignal):Promise<SceneBindingScenes>
 openTree(projectId:string,input:{source:SceneBindingSource;sceneUrl:string;operationId:string},signal?:AbortSignal):Promise<SceneBindingTree>
 create?(projectId:string,input:{source:SceneBindingSource;sceneUrl:string;operationId:string;confirmation:'CREATE_EMPTY_SCENE'},signal?:AbortSignal):Promise<SceneBindingTree>
 resolve(projectId:string,source:SceneBindingSource,signal?:AbortSignal):Promise<SceneBindingResolution>
 observeTree(projectId:string,input:{source:SceneBindingSource;sceneUrl:string},signal?:AbortSignal):Promise<SceneBindingTree>
 bind(projectId:string,input:SceneBindingInput,signal?:AbortSignal):Promise<SceneBindingResult>
 readback(projectId:string,input:SceneBindingReadback,signal?:AbortSignal):Promise<SceneBindingResult>
 waitForIdle():Promise<void>
}
export class SceneBindingError extends Error {constructor(readonly code:'invalid-input'|'invalid-shape'|'busy'|'rejected'|'unknown'|'storage',readonly dispatched=false){super(({ 'invalid-input':'场景绑定输入未通过校验，未提交。','invalid-shape':'场景绑定回执不匹配，结果需核对。',busy:'另一场景绑定请求尚未结束。',rejected:'后台明确拒绝此操作，请核对当前场景和权限。',unknown:'操作结果未确认，禁止重放；请只读核对原目标。',storage:'无法可靠保存原绑定目标，未提交新写入。'})[code])}}
const sha=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
function check(value:unknown):asserts value {if(!value)throw new SceneBindingError('invalid-shape')}
function text(value:unknown,max=500):value is string{return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value)}
export function sceneBindingAssetUrl(value:unknown,extension:'png'|'scene'|null=null):value is string {return typeof value==='string'&&value.length<=500&&/^db:\/\/assets\/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*\/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(value)&&value.slice(5).split('/').every(part=>part!=='.'&&part!=='..'&&!part.endsWith('.'))&&(!extension||value.endsWith('.'+extension))}
export function checkedSceneBindingSource(value:SceneBindingSource):SceneBindingSource {if(!value||!value.artifact||!(['mother','variant'].includes(value.artifact.kind))||value.artifact.kind==='variant'&&(!Number.isSafeInteger(value.artifact.width)||!Number.isSafeInteger(value.artifact.height)||value.artifact.width<1||value.artifact.height<1||value.artifact.width>4096||value.artifact.height>4096||value.artifact.width*value.artifact.height>16000000)||!isAiJobId(value.jobId)||!isAiCandidateId(value.candidateId)||!Number.isSafeInteger(value.revision)||value.revision<1||!sha(value.requestHash)||!sha(value.assetSha256)||!sceneBindingAssetUrl(value.assetUrl,'png'))throw new SceneBindingError('invalid-input');return {...value}}
/** Import receipts and task identity are required; free-form handoff targets never confer asset authority. */
export function sceneBindingSourceFromPacket(packet:IconHandoff|null,job:AiJobSnapshot|null):SceneBindingSource|null {
 if(!packet||!job||job.historyOnly||packet.projectId!==ICON_SCENE_BINDING_PROJECT||job.projectId!==packet.projectId||packet.job.jobId!==job.jobId||packet.job.revision!==job.revision||packet.job.requestHash!==job.requestHash||packet.job.candidateId!==job.selectedIds[0]||packet.asset.candidateId!==job.selectedIds[0])return null
 const imported=packet.asset.kind==='variant'?job.variantImport:job.import
 if(!imported||imported.state!=='imported_pending_verification'||imported.effectApplied!==true||imported.leaseState!=='RELEASED')return null
 const candidate=job.candidates.find(row=>row.candidateId===packet.asset.candidateId)
 if(!candidate||candidate.fileSha256!==packet.asset.motherSha256)return null
 let assetUrl=packet.asset.savedCreatorDestination.startsWith('assets/')?'db://'+packet.asset.savedCreatorDestination:packet.asset.savedCreatorDestination
 if(packet.asset.kind==='variant'){const artifact=completedVariantImportSource(packet,job);if(!artifact||artifact.destinationUrl!==assetUrl)return null;assetUrl=artifact.destinationUrl}
 else if(packet.asset.sha256!==candidate.fileSha256)return null
 try{return checkedSceneBindingSource({jobId:job.jobId,revision:job.revision,candidateId:candidate.candidateId,requestHash:job.requestHash,assetSha256:packet.asset.sha256,assetUrl,artifact:packet.asset.kind==='mother'?{kind:'mother'}:{kind:'variant',width:packet.asset.width,height:packet.asset.height}})}catch{return null}
}
export function decodeSceneBindingReply(raw:unknown,projectId:string,action:SceneBindingAction):SceneBindingReply {
 const value=raw as SceneBindingReply;check(value&&typeof value==='object'&&!Array.isArray(value)&&value.schemaVersion==='scene-binding-v1'&&projectId===ICON_SCENE_BINDING_PROJECT&&value.projectId===projectId&&value.action===action&&text(value.observedAt,100)&&Number.isFinite(Date.parse(value.observedAt)))
 if(value.receiptSha256!==undefined)check(sha(value.receiptSha256))
 if(value.action==='create-test-sprite'||value.action==='inspect-test-sprite'){
  check(['created','observed','unknown','rejected'].includes(value.state)&&value.sceneUrl===ICON_SCENE_TEST_URL&&text(value.expectedRevision,256)&&sceneBindingOperationId(value.operationId)&&['SUCCEEDED','FAILED','STARTED','UNKNOWN','MISSING'].includes(value.operationStatus)&&(value.revision===null||text(value.revision,256))&&(value.nodeKey===null||text(value.nodeKey,300))&&(value.terminalReceiptId===null||text(value.terminalReceiptId,200))&&(value.saved===null||value.saved===true)&&Array.isArray(value.nodes)&&value.nodes.length<=5000&&value.nodes.every(row=>text(row.key,300)&&text(row.path,1000)&&typeof row.hasSprite==='boolean'&&(row.spriteFrameUuid===null||text(row.spriteFrameUuid,200)))&&new Set(value.nodes.map(row=>row.key)).size===value.nodes.length)
  if(value.state==='created'){const matches=value.nodes.filter(row=>row.hasSprite&&row.path.split('/').at(-1)===ICON_SCENE_TEST_NODE_NAME);check(value.operationStatus==='SUCCEEDED'&&text(value.terminalReceiptId,200)&&value.saved===true&&text(value.revision,256)&&value.revision!==value.expectedRevision&&matches.length===1&&matches[0]!.key===value.nodeKey&&matches[0]!.spriteFrameUuid===null)}else check(value.saved===null)
  return JSON.parse(JSON.stringify(value)) as SceneTestSpriteResult
 }
 if(value.state==='unknown'&&['open-tree','create','observe-tree'].includes(value.action))throw new SceneBindingError('unknown',true)
 if((value as Envelope).state==='rejected')throw new SceneBindingError('rejected')
 if(value.action==='scenes'){check(['ready','observed'].includes(value.state)&&Array.isArray(value.scenes)&&value.scenes.length<=500&&value.scenes.every(row=>sceneBindingAssetUrl(row.url,'scene')&&text(row.name,200))&&new Set(value.scenes.map(row=>row.url)).size===value.scenes.length&&(value.state==='observed')===(value.scenes.length===0))}
 else if(value.action==='open-tree'||value.action==='create'||value.action==='observe-tree'){check(value.testSpriteSceneReady===undefined||typeof value.testSpriteSceneReady==='boolean');check(['ready','observed'].includes(value.state)&&sceneBindingAssetUrl(value.sceneUrl,'scene')&&text(value.revision,200)&&Array.isArray(value.nodes)&&value.nodes.length<=5000&&value.nodes.every(row=>text(row.key,300)&&text(row.path,1000)&&typeof row.hasSprite==='boolean'&&(row.spriteFrameUuid===null||text(row.spriteFrameUuid,200)))&&new Set(value.nodes.map(row=>row.key)).size===value.nodes.length)}
 else if(value.action==='resolve'){check(value.state==='ready'&&value.source&&!!checkedSceneBindingSource(value.source)&&text(value.pngUuid,200)&&Array.isArray(value.spriteFrames)&&value.spriteFrames.length<=32&&value.spriteFrames.every(row=>sceneBindingAssetUrl(row.url)&&text(row.uuid,200)&&row.subAsset==='spriteFrame'&&row.uuid!==value.pngUuid)&&new Set(value.spriteFrames.map(row=>row.uuid)).size===value.spriteFrames.length)}
 else if(value.action==='bind'||value.action==='readback'){check(value.action==='bind'?['bound','unknown'].includes(value.state):['matched','not_matched','unknown'].includes(value.state));if(value.state==='unknown')check(value.receipt===null);if(value.receipt){const receipt=value.receipt;check(sceneBindingAssetUrl(receipt.sceneUrl,'scene')&&(receipt.beforeRevision===null||text(receipt.beforeRevision,200))&&text(receipt.afterRevision,200)&&text(receipt.nodeKey,300)&&receipt.component==='cc.Sprite'&&receipt.property==='spriteFrame'&&sceneBindingAssetUrl(receipt.assetUrl,'png')&&sha(receipt.assetSha256)&&text(receipt.pngUuid,200)&&text(receipt.spriteFrameUuid,200)&&receipt.pngUuid!==receipt.spriteFrameUuid&&typeof receipt.validated==='boolean'&&sha(receipt.receiptSha256))}if(value.state==='bound'||value.state==='matched')check(value.receipt?.validated===true)}
 return JSON.parse(JSON.stringify(value)) as SceneBindingReply
}
export function verifySceneBindingResult(result:SceneBindingResult,input:SceneBindingInput|SceneBindingReadback,expectedUuid:string){
 const receipt=result.receipt;if(result.state!=='bound'&&result.state!=='matched')return
 check(receipt&&receipt.sceneUrl===input.sceneUrl&&receipt.nodeKey===input.nodeKey&&receipt.assetUrl===input.source.assetUrl&&receipt.assetSha256===input.source.assetSha256&&receipt.spriteFrameUuid===expectedUuid&&receipt.validated===true)
 if('expectedRevision'in input&&result.action==='bind')check(receipt.beforeRevision===input.expectedRevision)
}
export function sceneBindingEqual(left:unknown,right:unknown){return artCanonical(left)===artCanonical(right)}

export const sceneBindingOperationId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)

/** Fixed test-only input; arbitrary node/parent/frame fields never reach the transport. */
export function checkedSceneTestSpriteInput(input:SceneTestSpriteIdentity|SceneTestSpriteCreateInput,create=false){
 const expected=create?['source','sceneUrl','expectedRevision','operationId','confirmation']:['source','sceneUrl','expectedRevision','operationId']
 if(!input||Object.keys(input).length!==expected.length||Object.keys(input).some(key=>!expected.includes(key))||input.sceneUrl!==ICON_SCENE_TEST_URL||!text(input.expectedRevision,256)||!sceneBindingOperationId(input.operationId)||create&&(!('confirmation'in input)||input.confirmation!=='CREATE_E2E_TEST_SPRITE'))throw new SceneBindingError('invalid-input')
 checkedSceneBindingSource(input.source)
}
export function verifySceneTestSpriteResult(value:SceneTestSpriteResult,input:SceneTestSpriteIdentity){check(value.sceneUrl===input.sceneUrl&&value.expectedRevision===input.expectedRevision&&value.operationId===input.operationId)}
