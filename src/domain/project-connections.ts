import { decodeToolPreset,type ToolPreset } from './tool-presets-read'
import { validateSetupOperationId } from './project-setup'
import type { PreviewCode,PreviewOutcome } from './preview-actions'
export const CLIENT_TARGETS=['codex','cursor','trae','kiro','vscode'] as const
export type ClientTarget=typeof CLIENT_TARGETS[number]
export const CLIENT_LABELS:Record<ClientTarget,string>={codex:'Codex',cursor:'Cursor',trae:'Trae',kiro:'Kiro',vscode:'VS Code'}
export type ConnectionRequest={kind:'client';projectId:string;target:ClientTarget}|{kind:'setup-scope';projectId:string;setupOperationId:string;preset:ToolPreset}
export interface ConnectionReply {key:string;text:string}
export interface ProjectConnectionsProvider {readonly label:string;run(input:ConnectionRequest,signal?:AbortSignal):Promise<ConnectionReply>;waitForIdle():Promise<void>}
export type ConnectionCode=PreviewCode
export type ConnectionOutcome=PreviewOutcome
export class ProjectConnectionError extends Error {
 constructor(readonly code:ConnectionCode,readonly outcome:ConnectionOutcome='unknown'){
  super(outcome==='not-dispatched'?'操作未发送，请核对当前工程及所选项。':outcome==='rejected'?'原接口拒绝本次操作，未确认任何配置更改。':'配置操作结果未知，请核对原配置；本页不自动重发。');this.name='ProjectConnectionError'
 }
}
export const CONNECTION_LIMITS=Object.freeze({timeoutMs:120000,maxResponseBytes:131072,maxResponseChunks:512})
function exact(value:unknown,keys:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new ProjectConnectionError('invalid-input','not-dispatched')
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)||!('value' in Object.getOwnPropertyDescriptor(value,k)!)))throw new ProjectConnectionError('invalid-input','not-dispatched')
 return value as Record<string,unknown>
}
export function normalizeConnectionRequest(value:unknown):ConnectionRequest{
 try{
  const kind=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'kind')?.value:undefined
  const raw=exact(value,kind==='client'?['kind','projectId','target']:['kind','projectId','setupOperationId','preset'])
  if(typeof raw.projectId!=='string'||!/^[a-f0-9]{16}$/.test(raw.projectId))throw Error()
  if(kind==='client'){if(!CLIENT_TARGETS.includes(raw.target as ClientTarget))throw Error();return {kind,projectId:raw.projectId,target:raw.target as ClientTarget}}
  if(kind!=='setup-scope')throw Error()
  return {kind,projectId:raw.projectId,setupOperationId:validateSetupOperationId(raw.setupOperationId),preset:decodeToolPreset(raw.preset)}
 }catch{throw new ProjectConnectionError('invalid-input','not-dispatched')}
}
