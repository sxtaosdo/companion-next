import type { ManagedStatus } from './companion-browser'
// Shared project-operation lane; historical Creator naming avoids duplicating transport/confirmation state.
export type CreatorAction = 'start' | 'focus' | 'stop' | 'restart' | 'open-folder' | 'remove-registration'
export interface CreatorOperationRequest { projectId: string; action: CreatorAction }
export type CreatorOperationReply = { action: 'start' | 'stop' | 'restart'; runtime: ManagedStatus } | { action: 'focus'; acknowledged: true } | { action: 'open-folder'; acknowledged: true; path: string } | { action: 'remove-registration'; removed: boolean }
export interface CreatorOperationsProvider {
  readonly label: string
  run(input: CreatorOperationRequest, signal?: AbortSignal): Promise<CreatorOperationReply>
  /** Client request/reader settled, not proof that the server operation stopped. */
  waitForIdle(): Promise<void>
}
export type CreatorOperationOutcome = 'not-dispatched' | 'rejected' | 'unknown' | 'reported-failure'
export type CreatorOperationCode = 'invalid-input' | 'busy' | 'aborted' | 'timeout' | 'forbidden' | 'backend-failure' | 'invalid-shape' | 'response-too-large' | 'network-error'
export class CreatorOperationError extends Error {
  constructor(readonly code: CreatorOperationCode, readonly outcome: CreatorOperationOutcome, readonly backendCode?: string, readonly reportedReason?: 'unsaved-content') {
    super(({
      'invalid-input': '工程操作参数无效，未发送。', busy: '上一次工程请求仍在等待或清理，未发送新请求。',
      aborted: '已停止等待；这不会取消后台工程操作，结果需核对。', timeout: '等待超时；后台结果未知，请先刷新真实状态，不自动重发。',
      forbidden: '原 Companion 会话或同源校验拒绝请求。', 'backend-failure': '原后台报告操作未完成；可能已有部分影响，请先核对真实状态和日志。',
      'invalid-shape': '收到的工程操作回执无法核实；结果未知。', 'response-too-large': '工程操作回执超过读取预算；结果未知。',
      'network-error': '工程操作请求未正常返回；结果未知。',
    } satisfies Record<CreatorOperationCode,string>)[code])
    this.name = 'CreatorOperationError'
  }
}
export const CREATOR_OPERATION_LIMITS = Object.freeze({timeoutMs:120_000,maxResponseBytes:128*1024,maxResponseChunks:512})
export function normalizeCreatorOperation(value: unknown): CreatorOperationRequest {
  const fail=()=>new CreatorOperationError('invalid-input','not-dispatched')
  if(!value||typeof value!=='object'||Array.isArray(value))throw fail()
  const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)throw fail()
  const raw=value as Record<string,unknown>, keys=Reflect.ownKeys(raw)
  if(keys.length!==2||keys.some(key=>key!=='projectId'&&key!=='action'))throw fail()
  const id=Object.getOwnPropertyDescriptor(raw,'projectId'),action=Object.getOwnPropertyDescriptor(raw,'action')
  if(!id||!action||!('value'in id)||!('value'in action)||typeof id.value!=='string'||!/^[a-f0-9]{16}$/.test(id.value)||!['start','focus','stop','restart','open-folder','remove-registration'].includes(action.value))throw fail()
  return {projectId:id.value,action:action.value as CreatorAction}
}

export function creatorActionLabel(action: CreatorAction): string { return ({start:'启动 / 打开 Creator',focus:'聚焦 Creator',stop:'停止 Creator',restart:'重启 Creator','open-folder':'打开工程目录','remove-registration':'移除工程登记'} satisfies Record<CreatorAction,string>)[action] }
export function creatorActionConfirmation(action: CreatorAction): string { return ({start:'确认启动 / 打开此工程',focus:'确认聚焦此工程',stop:'确认停止此工程',restart:'确认重启此工程','open-folder':'确认打开此工程目录','remove-registration':'确认移除此登记与工具绑定'} satisfies Record<CreatorAction,string>)[action] }
