import type { ManagedProject } from './companion-browser'
export const SETUP_STAGES = ['registering','installing-bridge','opening-dashboard','waiting-bridge','configuring-codex','verifying','complete','failed'] as const
export type SetupStage = typeof SETUP_STAGES[number]
export interface SetupSnapshot {
 id:string; projectPath:string; projectId?:string; projectName?:string; stage:SetupStage; startedAt:string; updatedAt:string
 bridge?:{status:'installed'|'updated'|'current';version:string;targetPath:string}
 runtime?:{projectId:string;state:'stopped'|'launching'|'bridge-wait'|'ready'|'stopping'|'crashed'|'incompatible'|'error';creatorVersion?:string}
 mcpName?:string; failureReported?:boolean; errorCode?:string
}
export interface ProjectSetupProvider {
 readonly label:string
 /** Explicit native folder dialog; undefined means user cancelled. Never registers the selection. */
 pickDirectory?(signal?:AbortSignal):Promise<string|undefined>
 register(path:string,signal?:AbortSignal):Promise<ManagedProject>
 /** Explicit full setup only. Provider sends true/true, never omitted defaults or codexPath. */
 start(projectId:string,signal?:AbortSignal):Promise<{operationId:string}>
 status(operationId:string,signal?:AbortSignal):Promise<SetupSnapshot>
 waitForIdle():Promise<void>
}
export type ProjectSetupErrorCode='invalid-input'|'busy'|'aborted'|'timeout'|'forbidden'|'backend-failure'|'invalid-shape'|'response-too-large'|'network-error'
export class ProjectSetupError extends Error {
 constructor(readonly code:ProjectSetupErrorCode,readonly outcome:'not-dispatched'|'rejected'|'unknown'='unknown'){
  super(({ 'invalid-input':'工程路径或任务标识无效，未发送。',busy:'上次请求仍在等待或清理，未发送新请求。',aborted:'已停止等待，后台任务不会因此取消。',timeout:'等待超时，后台结果未知；不会自动重发。',forbidden:'原宿主会话或同源校验拒绝请求。','backend-failure':'原后台未返回有效结果；可能已有部分影响，请核对。','invalid-shape':'无法核实原后台回执，结果未知。','response-too-large':'回执超出读取预算，结果未知。','network-error':'请求未正常返回，结果未知。'} satisfies Record<ProjectSetupErrorCode,string>)[code]);this.name='ProjectSetupError'
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
