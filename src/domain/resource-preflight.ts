import type { ProjectSpec } from './contracts'
import type { OutputSize, ResourcePlan } from './resource-planning'
import { assertPlan, planMatchesSpec, planningCounts } from './resource-planning'
export interface PreflightBlocker { code: string; message: string }
export interface PlannedExecutionNode {
  id: string
  batchId: string
  requirementId: string
  specBindingId: string
  name: string
  kind: 'planned-master' | 'manual-approval-gate' | 'planned-resize'
  dependencies: string[]
  outputSize?: OutputSize
  inferenceIntent: 0 | 1
  status: 'not-started'
}
export interface ResourcePreflight {
  kind: 'companion-resource-preflight'
  planId: string
  localValidation: 'passed' | 'failed'
  executionStatus: 'blocked-not-started'
  queuePolicy: 'serial'
  blockers: PreflightBlocker[]
  nodes: PlannedExecutionNode[]
  plannedMasterInferences: number
  plannedDerivativeOutputs: number
  actualSubmitted: 0
  actualGenerated: 0
}
/** Deterministic dry run. No transport, workflow payload, model selection or execution. */
export function preflightResourcePlan(plan: ResourcePlan, currentSpec?: ProjectSpec): ResourcePreflight {
  const report: ResourcePreflight = { kind:'companion-resource-preflight', planId:plan.id, localValidation:'passed', executionStatus:'blocked-not-started', queuePolicy:'serial', blockers:[], nodes:[], plannedMasterInferences:0, plannedDerivativeOutputs:0, actualSubmitted:0, actualGenerated:0 }
  try { assertPlan(plan) } catch (error) {
    report.localValidation='failed'; report.blockers.push({code:'invalid-plan',message:error instanceof Error?error.message:'计划结构无效'}); return report
  }
  if (!plan.batches.length) report.blockers.push({code:'no-batches',message:'尚未建立批次，没有可规划的生成节点。'})
  if (!currentSpec || !planMatchesSpec(plan,currentSpec)) report.blockers.push({code:'spec-not-current',message:'未确认当前规范与冻结快照一致；不得按旧快照直接执行。'})
  if (plan.scope.mode==='demo') report.blockers.push({code:'demo-source',message:'示例项目不能作为真实生成或工程写入的目标。'})
  if (plan.generationSource === 'unselected') report.blockers.push({code:'generation-source-unselected',message:'尚未选择生成来源；不会自动选择 ComfyUI 或付费 API。'})
  report.blockers.push(
    {code:'owner-and-style-approval',message:'尚无本批次与风格样板的 Owner 批准记录。'},
    {code:'reference-license-evidence',message:'参考图、输入素材与模型许可及来源证据尚未核验。'},
    ...(plan.generationSource === 'codex-native' ? [
      {code:'native-session-handoff',message:'Codex 原生需在已授权会话生成并人工回收；网页自动调用 / 输出协议尚未验证。'},
      {code:'service-unverified',message:'当前计划尚无原生会话输出文件及独立核验回执。'},
    ] : [
    {code:'workflow-binding',message:'尚未绑定已登记工作流及版本；不会自动选择模型或安装新方案。'},
    {code:'service-unverified',message:'未核验 ComfyUI 服务、模型可用性、GPU 预算或真实运行接口。'},
    ]),
    {code:'engine-handoff-unverified',message:'工程目标、导入路径、UUID、Prefab 绑定与运行验收尚未核验。'},
  )
  for(const batch of plan.batches) for(const rid of batch.requirementIds) {
    const requirement=plan.requirements.find((r)=>r.id===rid)!
    const base={batchId:batch.id,requirementId:rid,specBindingId:plan.binding.id,status:'not-started' as const}
    const masterId=`master:${rid}`; const approvalId=`approval:${rid}`
    report.nodes.push({...base,id:masterId,name:`${requirement.name} · 默认母图`,kind:'planned-master',dependencies:[],outputSize:{...requirement.defaultSize},inferenceIntent:1})
    report.nodes.push({...base,id:approvalId,name:`${requirement.name} · 人工视觉批准`,kind:'manual-approval-gate',dependencies:[masterId],inferenceIntent:0})
    for(const size of requirement.derivatives) report.nodes.push({...base,id:`resize:${rid}:${size.width}x${size.height}`,name:`${requirement.name} · 同图缩放`,kind:'planned-resize',dependencies:[approvalId],outputSize:{width:size.width,height:size.height},inferenceIntent:0})
  }
  const counts=planningCounts(plan);report.plannedMasterInferences=counts.plannedMasterInferences;report.plannedDerivativeOutputs=counts.plannedDerivativeOutputs
  return report
}
