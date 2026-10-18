export const PREVIEW_ACTIONS = ['start','probe','status','reload','profiler'] as const
export type PreviewAction = typeof PREVIEW_ACTIONS[number]
export const previewActionLabel = (action:PreviewAction) => ({start:'预览',probe:'探测',status:'状态',reload:'刷新',profiler:'Profiler 采集'})[action]
export interface PreviewRequest { projectId:string; action:PreviewAction }
export interface PreviewReply { action:PreviewAction; projectId:string; text:string; available?:boolean }
export interface PreviewActionsProvider { readonly label:string; run(input:PreviewRequest,signal?:AbortSignal):Promise<PreviewReply>; waitForIdle():Promise<void> }
export const PREVIEW_ACTION_LIMITS=Object.freeze({timeoutMs:120000,maxResponseBytes:524288,maxResponseChunks:1024})
export type PreviewCode='invalid-input'|'busy'|'aborted'|'timeout'|'forbidden'|'backend-failure'|'invalid-shape'|'response-too-large'|'network-error'
export type PreviewOutcome='not-dispatched'|'rejected'|'unknown'
export class PreviewActionError extends Error {
 constructor(readonly code:PreviewCode,readonly outcome:PreviewOutcome='unknown'){
  super(({'invalid-input':'Preview 参数无效，未发送。',busy:'前一次 Preview / Profiler 请求仍在等待清理。',aborted:'已停止等待，后台操作不一定已取消；结果未知。',timeout:'等待超时，后台结果未知；不自动重放。',forbidden:'原会话或同源校验拒绝请求。','backend-failure':'后台未返回成功回执，请核对日志和真实状态。','invalid-shape':'回执无法核实，结果未知。','response-too-large':'回执超出读取预算，结果未知。','network-error':'请求未完整返回，结果未知。'} satisfies Record<PreviewCode,string>)[code]);this.name='PreviewActionError'
 }
}
export function normalizePreviewRequest(value:unknown):PreviewRequest {
 const fail=()=>new PreviewActionError('invalid-input','not-dispatched')
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail()
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw fail()
 const keys=Reflect.ownKeys(value);if(keys.length!==2||keys.some(k=>k!=='projectId'&&k!=='action'))throw fail()
 const id=Object.getOwnPropertyDescriptor(value,'projectId'),action=Object.getOwnPropertyDescriptor(value,'action')
 if(!id||!action||!('value'in id)||!('value'in action)||typeof id.value!=='string'||!/^[a-f0-9]{16}$/.test(id.value)||!PREVIEW_ACTIONS.includes(action.value))throw fail()
 return {projectId:id.value,action:action.value}
}
