export type LogToolRequest = { action: 'clear'; projectIds: readonly string[] } | { action: 'diagnostic'; projectId: string }
export type LogToolReply = { action: 'clear'; cleared: number } | { action: 'diagnostic'; projectId: string; text: string }
export interface LogToolsProvider { readonly label: string; run(input: LogToolRequest, signal?: AbortSignal): Promise<LogToolReply>; waitForIdle(): Promise<void> }
export const LOG_TOOL_LIMITS = Object.freeze({ timeoutMs: 15000, maxResponseBytes: 2_097_152, maxResponseChunks: 2048 })
export type LogToolCode = 'invalid-input' | 'busy' | 'aborted' | 'timeout' | 'forbidden' | 'backend-failure' | 'invalid-shape' | 'response-too-large' | 'network-error'
export type LogToolOutcome = 'not-dispatched' | 'rejected' | 'unknown'
export class LogToolError extends Error {
 constructor(readonly code: LogToolCode, readonly outcome: LogToolOutcome = 'unknown') {
  super(({ 'invalid-input':'日志操作参数无效，未发送。', busy:'上一次日志请求仍在等待或清理。', aborted:'已停止等待；后台操作不会因此取消，结果未知。', timeout:'日志操作等待超时；结果未知，不自动重发。', forbidden:'原会话或同源校验拒绝日志操作。', 'backend-failure':'原后台未返回成功回执，结果需核对。', 'invalid-shape':'日志操作回执无法核实，结果未知。', 'response-too-large':'诊断超过读取预算，未提供不完整导出。', 'network-error':'日志操作未正常返回，结果未知。' } satisfies Record<LogToolCode,string>)[code]);this.name='LogToolError'
 }
}
export function normalizeLogTool(value: unknown): LogToolRequest {
 const fail=()=>new LogToolError('invalid-input','not-dispatched')
 if(!value||typeof value!=='object'||Array.isArray(value))throw fail()
 const p=Object.getPrototypeOf(value);if(p!==Object.prototype&&p!==null)throw fail()
 const raw=value as Record<string,unknown>,keys=Reflect.ownKeys(raw)
 if(keys.length!==2||keys.some(k=>typeof k!=='string'||!['action','projectId','projectIds'].includes(k)))throw fail()
 for(const k of keys){const d=Object.getOwnPropertyDescriptor(raw,k);if(!d||!('value'in d))throw fail()}
 const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{16}$/.test(v)
 if(raw.action==='diagnostic'&&id(raw.projectId))return {action:'diagnostic',projectId:raw.projectId}
 if(raw.action==='clear'&&Array.isArray(raw.projectIds)&&raw.projectIds.length<=200&&raw.projectIds.every(id)&&new Set(raw.projectIds).size===raw.projectIds.length)return {action:'clear',projectIds:[...raw.projectIds]}
 throw fail()
}
