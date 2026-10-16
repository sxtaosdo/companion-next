import type { ProjectSpec } from './contracts'
import type { ResourcePlan } from './resource-planning'
import { exportResourcePlan, PLAN_JSON_LIMIT_BYTES } from './resource-planning'
import { generationCapability } from './generation-source'
import { preflightResourcePlan } from './resource-preflight'

/** Outbound offline contract only. This is not a provider payload or evidence of an output. */
export function createGenerationHandoff(plan: ResourcePlan, currentSpec?: ProjectSpec) {
  const manifest = JSON.parse(exportResourcePlan(plan)) as ResourcePlan
  if (plan.generationSource === 'unselected') throw new Error('请先明确选择生成来源')
  const preflight = preflightResourcePlan(plan, currentSpec)
  if (preflight.localValidation !== 'passed') throw new Error('计划结构检查未通过')
  const assigned = new Set(plan.batches.flatMap((batch) => batch.requirementIds))
  const expectedOutputs = plan.requirements.filter((r) => assigned.has(r.id)).map((r) => ({
    requirementId: r.id, specBindingId: r.specBindingId,
    master: { ...r.defaultSize, format: r.format, transparent: r.transparent },
    derivatives: r.derivatives.map((d) => ({ ...d })),
  }))
  return {
    schemaVersion: 1 as const, kind: 'companion-generation-handoff' as const,
    status: 'draft-not-submitted' as const,
    disclaimer: '仅离线交接草稿及空输出回执，不是执行结果、批准记录或项目配置。当前网页不能提交任一来源。',
    source: generationCapability(plan.generationSource),
    manifest,
    sharedInputs: {
      referenceSelection: 'not-attached' as const,
      referenceCrop: 'not-recorded' as const,
      ownerApproval: 'not-recorded' as const,
      note: '两来源共用规范、参考图与裁切意图；须在实际执行端明确选择素材、确认许可及发送范围。此文件不包含图片或访问凭据。',
    },
    expectedOutputs,
    outputReceipt: {
      status: 'awaiting-external-files' as const,
      artifacts: [] as never[],
      technicalQA: 'not-checked' as const, visualReview: 'not-checked' as const,
      savedToProject: false as const, imported: false as const, bound: false as const, runtime: 'not-checked' as const,
      requiredEvidence: ['来源 / 会话或工作流版本', '需求 ID / 规范绑定 ID', '实际文件与 SHA-256', '实际宽高 / PNG / alpha 核验', '母图与缩放关系', 'Owner 视觉批准', '保存记录 / 导入 UUID / 绑定 / 运行证据'],
    },
    blockers: preflight.blockers,
    execution: { ...plan.execution },
  }
}
export function exportGenerationHandoff(plan: ResourcePlan, currentSpec?: ProjectSpec): string {
  const contents = JSON.stringify(createGenerationHandoff(plan, currentSpec), null, 2)
  if (new TextEncoder().encode(contents).byteLength > PLAN_JSON_LIMIT_BYTES) throw new Error('交接草稿超过 512 KiB，请拆分计划；现有草稿保持不变')
  return contents
}
