export interface OperationFeedbackState { label: string; tone: 'info' | 'warning' | 'danger' | 'success'; spinning: boolean }
/** A receipt describes the request, never proof of runtime readiness. */
export function operationFeedback(phase: string, action: string): OperationFeedbackState {
 const verb = ({start:'启动',stop:'停止',restart:'重启',focus:'聚焦','open-folder':'打开目录','remove-registration':'移除登记'} as Record<string,string>)[action] ?? '操作'
 if (phase === 'sending') return {label:`${verb}中`,tone:'warning',spinning:true}
 if (phase === 'acknowledged') return {label:`已收到${verb}回执`,tone:'success',spinning:false}
 if (phase === 'unknown') return {label:'结果未知，待核对',tone:'warning',spinning:false}
 if (phase === 'reported-failure') return {label:`${verb}失败`,tone:'danger',spinning:false}
 if (phase === 'rejected') return {label:'请求被拒绝',tone:'danger',spinning:false}
 return {label:'未发出',tone:'info',spinning:false}
}
