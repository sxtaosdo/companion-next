/** Source-proven service controls: v148 routes plus audited original knowledge start script. Model start stays unavailable. */
export type LocalService = 'knowledge' | 'model'
export type LocalServiceAction = 'start' | 'stop'
export type LocalServiceOperationRequest = { service: 'knowledge'; action: LocalServiceAction } | { service: 'model'; action: 'stop' }
export type LocalServiceOperationReply =
  | { service: 'knowledge'; action: 'start'; state: { running: true; frameable: boolean } }
  | { service: 'knowledge'; action: 'stop'; state: { running: false; frameable: false } }
  | { service: 'model'; action: 'stop'; state: { running: false } }
export interface LocalServiceOperationsProvider {
  readonly label: string
  run(input: LocalServiceOperationRequest, signal?: AbortSignal): Promise<LocalServiceOperationReply>
  /** Settled client transport only; never proof that a server process was cancelled. */
  waitForIdle(): Promise<void>
}
export type LocalServiceOperationOutcome = 'not-dispatched' | 'rejected' | 'reported-failure' | 'unknown'
export type LocalServiceOperationCode = 'invalid-input' | 'busy' | 'aborted' | 'timeout' | 'forbidden' | 'backend-failure' | 'invalid-shape' | 'response-too-large' | 'network-error'
export const LOCAL_SERVICE_OPERATION_LIMITS = Object.freeze({ timeoutMs: 120_000, maxResponseBytes: 8192, maxResponseChunks: 64, maxRecords: 20 })
export const LOCAL_SERVICE_START_GAPS = Object.freeze({
  model: '原模型启动器会监听 0.0.0.0:8090，并可能补启 8092 局域网代理；涉及网络暴露，启动需要另行审批。当前没有接入启动操作或各模型管理界面。',
})
export class LocalServiceOperationError extends Error {
  constructor(readonly code: LocalServiceOperationCode, readonly outcome: LocalServiceOperationOutcome) {
    super(({
      'invalid-input': '服务操作参数无效，未发送。', busy: '上一次服务请求尚未完全结束，未发送新请求。',
      aborted: '已停止等待；后台服务操作可能仍在继续，结果未知。', timeout: '等待服务回执超时；后台操作结果未知。',
      forbidden: '原 Companion 会话或同源校验明确拒绝请求。', 'backend-failure': '原后台报告未达到本次目标状态；可能已有进程或文件受到影响，请先核对真实状态。',
      'invalid-shape': '无法核验服务回执，操作结果未知。', 'response-too-large': '服务回执超过读取预算，操作结果未知。',
      'network-error': '服务请求未正常返回，操作结果未知。',
    } satisfies Record<LocalServiceOperationCode, string>)[code])
    this.name = 'LocalServiceOperationError'
  }
}
export function normalizeLocalServiceOperation(value: unknown): LocalServiceOperationRequest {
  const invalid = () => new LocalServiceOperationError('invalid-input', 'not-dispatched')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) throw invalid()
  const keys = Reflect.ownKeys(value)
  if (keys.length !== 2 || keys.some(key => key !== 'service' && key !== 'action')) throw invalid()
  const service = Object.getOwnPropertyDescriptor(value, 'service'), action = Object.getOwnPropertyDescriptor(value, 'action')
  if (!service || !action || !('value' in service) || !('value' in action)
    || !['knowledge', 'model'].includes(service.value) || !['start', 'stop'].includes(action.value)
    || (service.value === 'model' && action.value !== 'stop')) throw invalid()
  return service.value === 'knowledge' ? { service: 'knowledge', action: action.value as LocalServiceAction } : { service: 'model', action: 'stop' }
}
export function decodeLocalServiceOperationReply(value: unknown, request: LocalServiceOperationRequest): LocalServiceOperationReply {
  const { service, action } = request
  const invalid = () => new LocalServiceOperationError('invalid-shape', 'unknown')
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  const raw = value as Record<string, unknown>
  if (Object.keys(raw).length !== 3 || !['service', 'action', 'state'].every(key => Object.hasOwn(raw, key)) || raw.service !== service || raw.action !== action) throw invalid()
  if (!raw.state || typeof raw.state !== 'object' || Array.isArray(raw.state)) throw invalid()
  const state = raw.state as Record<string, unknown>
  if (!Object.hasOwn(state, 'running') || state.running !== (action === 'start')) throw invalid()
  if (service === 'knowledge') {
    if (Object.keys(state).length !== 2 || !Object.hasOwn(state, 'frameable') || typeof state.frameable !== 'boolean' || (action === 'stop' && state.frameable)) throw invalid()
    return action === 'start' ? { service, action, state: { running: true, frameable: state.frameable } } : { service, action, state: { running: false, frameable: false } }
  }
  if (Object.keys(state).length !== 1) throw invalid()
  return { service, action: 'stop', state: { running: false } }
}
export function localServiceLabel(service: LocalService): string { return service === 'knowledge' ? '知识库服务' : '模型启动器' }
export function localServiceStopImpact(service: LocalService): string {
  return service === 'knowledge'
    ? '将请求原宿主终止 PID 文件或 8081 端口中、可执行路径核验匹配的知识库进程，可能中断所有客户端的检索与问答。后端没有页面归属记录，不能保证只关闭本页启动的实例。'
    : '将请求原宿主终止 8090 端口中、命令行匹配 launcher.py 的启动器进程，影响所有使用此启动器的客户端。关闭启动器不等于终止已运行的模型。'
}

export const KNOWLEDGE_SERVICE_START_IMPACT = '将调用原宿主现有启动脚本，原 PowerShell 子进程使用 ExecutionPolicy Bypass。读取既有 JWT 秘密到进程环境并核验既有权限，不创建或改写秘密、ACL 或永久执行策略。固定监听 127.0.0.1:8081，写检查摘要、日志和 PID，沿用现有数据库与文件存储。原应用沙箱配置为 disabled；不能保证启动后的业务请求不写数据库。'
export function localServiceOperationImpact(service: LocalService, action: LocalServiceAction): string { return action === 'start' && service === 'knowledge' ? KNOWLEDGE_SERVICE_START_IMPACT : localServiceStopImpact(service) }
