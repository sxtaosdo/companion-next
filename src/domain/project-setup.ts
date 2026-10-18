import type { ManagedProject } from './companion-browser'
export const SETUP_STAGES = ['registering','installing-bridge','opening-dashboard','waiting-bridge','configuring-codex','verifying','complete','failed'] as const
export type SetupStage = typeof SETUP_STAGES[number]
export interface EffectiveSetupOptions { readonly startCreator:boolean; readonly configureCodex:boolean }
export interface StrictSetupStarted { readonly operationId:string; readonly optionsContractVersion:1; readonly effectiveOptions:EffectiveSetupOptions; readonly reused:boolean }
export function sameSetupOptions(value:unknown,expected:EffectiveSetupOptions):boolean {
 if(!value||typeof value!=='object'||Array.isArray(value))return false
 const actual=value as Record<string,unknown>
 return Object.keys(actual).sort().join(',')==='configureCodex,startCreator'&&actual.startCreator===expected.startCreator&&actual.configureCodex===expected.configureCodex
}
export interface SetupSnapshot {
 id:string; projectPath:string; projectId?:string; projectName?:string; stage:SetupStage; startedAt:string; updatedAt:string
 bridge?:{status:'installed'|'updated'|'current';version:string;targetPath:string}
 runtime?:{projectId:string;state:'stopped'|'launching'|'bridge-wait'|'ready'|'stopping'|'crashed'|'incompatible'|'error';creatorVersion?:string}
 optionsContractVersion?:1; effectiveOptions?:EffectiveSetupOptions
 mcpName?:string; failureReported?:boolean; errorCode?:string
}
export interface ProjectSetupProvider {
 readonly label:string
 /** Explicit native folder dialog; undefined means user cancelled. Never registers the selection. */
 pickDirectory?(signal?:AbortSignal):Promise<string|undefined>
 /** Original minimal Cocos scaffold only; never registers, installs or starts it. */
 scaffold?(input:ProjectScaffoldInput,signal?:AbortSignal):Promise<ProjectScaffoldResult>
 register(path:string,signal?:AbortSignal):Promise<ManagedProject>
 /** Explicit full setup only. Provider sends true/true, never omitted defaults or codexPath. */
 start(projectId:string,signal?:AbortSignal):Promise<{operationId:string}>
 /** Dedicated v1 route; an old server must reject before any setup side effect. */
 startStrict?(projectId:string,options:EffectiveSetupOptions,signal?:AbortSignal):Promise<StrictSetupStarted>
 status(operationId:string,signal?:AbortSignal):Promise<SetupSnapshot>
 waitForIdle():Promise<void>
}
export type ProjectScaffoldInput=
 | {mode:'create';parentPath:string;projectName:string;creatorVersion:'3.8.8'}
 | {mode:'initialize';path:string;creatorVersion:'3.8.8'}
export interface ProjectScaffoldResult {path:string;creatorVersion:'3.8.8'}
export function validateProjectScaffoldInput(value:unknown):ProjectScaffoldInput {
 const invalid=()=>new ProjectSetupError('invalid-input','not-dispatched')
 if(!value||typeof value!=='object'||Array.isArray(value))throw invalid()
 const raw=value as Record<string,unknown>,keys=Object.keys(raw).sort()
 if(raw.creatorVersion!=='3.8.8')throw invalid()
 if(raw.mode==='initialize'){
  if(keys.join(',')!=='creatorVersion,mode,path')throw invalid()
  return {mode:'initialize',path:validateProjectPath(raw.path),creatorVersion:'3.8.8'}
 }
 if(raw.mode!=='create'||keys.join(',')!=='creatorVersion,mode,parentPath,projectName')throw invalid()
 const name=raw.projectName
 if(typeof name!=='string'||!name||name!==name.trim()||name.length>128||/[\\/<>:"|?*\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(name)||name==='.'||name==='..'||name.endsWith('.')||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(name))throw invalid()
 return {mode:'create',parentPath:validateProjectPath(raw.parentPath),projectName:name,creatorVersion:'3.8.8'}
}
export function projectScaffoldTarget(input:ProjectScaffoldInput):string {
 return input.mode==='initialize'?input.path:input.parentPath.replace(/[\\/]+$/u,'')+(input.parentPath.startsWith('/')?'/':'\\')+input.projectName
}
export type ProjectSetupErrorCode='invalid-input'|'busy'|'aborted'|'timeout'|'forbidden'|'backend-failure'|'invalid-shape'|'response-too-large'|'network-error'|'options-unsupported'|'options-conflict'|'options-mismatch'
export class ProjectSetupError extends Error {
 constructor(readonly code:ProjectSetupErrorCode,readonly outcome:'not-dispatched'|'rejected'|'unknown'='unknown'){
  super(({ 'invalid-input':'工程路径或任务标识无效，未发送。',busy:'上次请求仍在等待或清理，未发送新请求。',aborted:'已停止等待，后台任务不会因此取消。',timeout:'等待超时，后台结果未知；不会自动重发。',forbidden:'原宿主会话或同源校验拒绝请求。','backend-failure':'原后台未返回有效结果；可能已有部分影响，请核对。','invalid-shape':'无法核实原后台回执，结果未知。','response-too-large':'回执超出读取预算，结果未知。','options-unsupported':'当前服务不支持严格分项安装，安装请求未发送。','options-mismatch':'安装合同或有效选项与确认值不匹配，结果 UNKNOWN；写入屏障保留，不会自动重发。','options-conflict':'同路径有不同选项的进行中任务，本次请求已拒绝；请核实原任务。','network-error':'请求未正常返回，结果未知。'} satisfies Record<ProjectSetupErrorCode,string>)[code]);this.name='ProjectSetupError'
 }
}
export const PROJECT_SETUP_LIMITS=Object.freeze({timeoutMs:120000,maxResponseBytes:128*1024,maxResponseChunks:512,maxPath:4096,pollMs:1000,maxPollMs:15*60*1000})
export function validateProjectPath(value:unknown):string {
 const bad=()=>new ProjectSetupError('invalid-input','not-dispatched')
 if(typeof value!=='string'||!value||value.length>PROJECT_SETUP_LIMITS.maxPath||value!==value.trim()||/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(value))throw bad()
 const drive=/^[A-Za-z]:[\\/](?![\\/])/.test(value)&&!/[<>:"|?*]/.test(value.slice(2))
 const unc=/^\\\\(?!(?:\.{1,2}|\?)\\)[^\\/\s:?<>"|*]+\\[^\\/:?<>"|*]+(?:\\[^/:?<>"|*]*)?$/.test(value)
 const posix=/^\/(?!\/)/.test(value)
 if(!drive&&!unc&&!posix)throw bad()
 return value
}
export function validateSetupProjectId(value:unknown):string {if(typeof value!=='string'||!/^[a-f0-9]{16}$/.test(value))throw new ProjectSetupError('invalid-input','not-dispatched');return value}
export function validateSetupOperationId(value:unknown):string {if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value))throw new ProjectSetupError('invalid-input','not-dispatched');return value}
export function setupStageLabel(stage:SetupStage):string{return ({registering:'登记工程', 'installing-bridge':'安装 / 更新 Bridge','opening-dashboard':'打开 Dashboard','waiting-bridge':'等待 Bridge','configuring-codex':'Codex 配置阶段','verifying':'验证阶段',complete:'后台任务完成',failed:'后台任务失败'} satisfies Record<SetupStage,string>)[stage]}

/** Original v148 completion-page prompt; this text never executes a tool. */
export interface SetupCompletionUsage { readonly project: Readonly<ManagedProject>; readonly prompt: string }
export function buildSetupCompletionPrompt(mcpName: unknown): string | null {
 const name=mcpName===undefined||mcpName===''?'当前工程的 Cocos Creator MCP':mcpName
 if(typeof name!=='string'||(name!=='当前工程的 Cocos Creator MCP'&&!/^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(name)))return null
 return `使用 ${name} MCP 检查连接，确认工程身份后等待我的修改要求。禁止操作其他 Creator 工程。`
}
