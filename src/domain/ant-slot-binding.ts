import { completedVariantImportSource, type IconHandoff } from './icon-handoff'
import { checkedSceneBindingSource, sceneBindingOperationId, type SceneBindingSource } from './icon-scene-binding'
import type { AiJobSnapshot } from './ai-jobs-read'
export const ANT_SLOT_PROJECT='04c4cde24ee76d83', ANT_SLOT_PREFAB='db://assets/Colony/ui/toolBar.prefab', ANT_SLOT_NODE='toolBar/slotButton/slotIcon'
const DEST='db://assets/Colony/art/toy-market/ui/companion-ant-toolbar-v01/', OLD_FRAME='688dee04-46bf-411e-9507-6db25532cb5b@f9941'
export type AntOriginal={action:'open';source:SceneBindingSource;operationId:string}|{action:'bind';source:SceneBindingSource;operationId:string;expectedRevision:string;confirmation:'APPLY_ANT_SLOT_ICON'}
export function antSlotSource(packet:IconHandoff|null,job:AiJobSnapshot|null):SceneBindingSource|null {
 if(!packet||!job||packet.projectId!==ANT_SLOT_PROJECT||packet.asset.assetId!=='ant-bottom-slot-v01'||packet.asset.width!==160||packet.asset.height!==160)return null
 const artifact=completedVariantImportSource(packet,job);if(!artifact||!artifact.destinationUrl.startsWith(DEST))return null
 try{return checkedSceneBindingSource({jobId:job.jobId,revision:job.revision,candidateId:packet.asset.candidateId,requestHash:job.requestHash,assetSha256:packet.asset.sha256,assetUrl:artifact.destinationUrl,artifact:{kind:'variant',width:160,height:160}})}catch{return null}
}
export function checkAntOriginal(value:unknown):AntOriginal {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('原操作记录无效')
 const v=value as AntOriginal,allowed=v.action==='open'?['action','source','operationId']:['action','source','operationId','expectedRevision','confirmation']
 if(!['open','bind'].includes(v.action)||Object.keys(v).length!==allowed.length||Object.keys(v).some(k=>!allowed.includes(k))||!sceneBindingOperationId(v.operationId))throw Error('原操作记录无效')
 const s=checkedSceneBindingSource(v.source);if(s.artifact.kind!=='variant'||s.artifact.width!==160||s.artifact.height!==160||!s.assetUrl.startsWith(DEST))throw Error('原操作来源无效')
 if(v.action==='bind'&&(v.confirmation!=='APPLY_ANT_SLOT_ICON'||typeof v.expectedRevision!=='string'||!v.expectedRevision||v.expectedRevision.length>256))throw Error('原操作记录无效')
 return v
}
export type AntReply={action:string;state:string;revision:string|null;nodeKey:string|null;currentSpriteFrameUuid:string|null;pngUuid:string;spriteFrameUuid:string;operationId?:string;operationStatus?:string;terminalReceiptId?:string|null;saved?:true|null}
const nonempty=(v:unknown)=>typeof v==='string'&&v.length>0&&v.length<=256
export function checkAntReply(raw:unknown,action:string,original?:AntOriginal):AntReply {
 const v=raw as any
 if(!v||v.schemaVersion!=='ant-slot-binding-v1'||v.projectId!==ANT_SLOT_PROJECT||v.action!==action||v.prefabUrl!==ANT_SLOT_PREFAB||v.nodePath!==ANT_SLOT_NODE||!nonempty(v.observedAt)||!Number.isFinite(Date.parse(v.observedAt))||!['needs_open','ready','observed','conflict','applied','unknown'].includes(v.state)||!nonempty(v.pngUuid)||!nonempty(v.spriteFrameUuid)||v.pngUuid===v.spriteFrameUuid||!(v.revision===null||nonempty(v.revision))||!(v.nodeKey===null||nonempty(v.nodeKey))||!(v.currentSpriteFrameUuid===null||nonempty(v.currentSpriteFrameUuid)))throw Error('返回结果无法核验')
 if(original&&(v.operationId!==original.operationId||!['SUCCEEDED','FAILED','STARTED','UNKNOWN','MISSING'].includes(v.operationStatus)||!(v.terminalReceiptId===null||nonempty(v.terminalReceiptId))||!(v.saved===null||v.saved===true)))throw Error('原操作回执不匹配')
 if(v.state==='applied'&&(!original||original.action!=='bind'||v.operationStatus!=='SUCCEEDED'||!nonempty(v.terminalReceiptId)||v.saved!==true||!nonempty(v.revision)||v.revision===original.expectedRevision||v.currentSpriteFrameUuid!==v.spriteFrameUuid))throw Error('应用回执不完整')
 if(original&&v.state==='ready'&&(original.action!=='open'||v.operationStatus!=='SUCCEEDED'||!nonempty(v.terminalReceiptId)))throw Error('打开回执不完整')
 if(v.state==='ready'&&(!nonempty(v.revision)||!nonempty(v.nodeKey)))throw Error('槽位状态不完整')
 if(action==='inspect'&&v.state==='ready'&&v.currentSpriteFrameUuid!==OLD_FRAME)throw Error('槽位原素材不匹配')
 if(action==='inspect'&&v.state==='observed'&&(!nonempty(v.revision)||!nonempty(v.nodeKey)||v.currentSpriteFrameUuid!==v.spriteFrameUuid))throw Error('槽位观察不匹配')
 return v as AntReply
}
