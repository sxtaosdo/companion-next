import type { Project, ProjectSpec, ResourceCategory } from './contracts'
import { validateSpec } from './spec'
import { GENERATION_SOURCES } from './generation-source'
import type { GenerationSource } from './generation-source'

export interface OutputSize { width: number; height: number }
export interface PlannedDerivative extends OutputSize {
  method: 'resize-approved-master'
  sourceRequirementId: string
  additionalInferenceCount: 0
}
export interface AcceptanceCondition {
  id: 'size' | 'alpha' | 'text' | 'style' | 'owner' | 'uuid' | 'binding' | 'runtime'
  phase: 'technical' | 'visual' | 'delivery'
  description: string
  state: 'not-checked'
}
export interface ResourceRequirement {
  id: string
  projectId: string
  specBindingId: string
  name: string
  category: ResourceCategory
  purpose: string
  page: string
  priority: 'normal' | 'high'
  defaultSize: OutputSize
  format: 'png'
  transparent: boolean
  ownerProtected: boolean
  derivatives: PlannedDerivative[]
  status: 'planned' | 'owner-protected'
  generated: false
  acceptanceNotes: string
  acceptance: AcceptanceCondition[]
}
export interface PlannedBatch {
  id: string
  name: string
  projectId: string
  specBindingId: string
  requirementIds: string[]
  queuePolicy: 'serial'
  status: 'not-submitted'
  approval: 'not-approved'
}
export interface ResourcePlan {
  schemaVersion: 1
  kind: 'companion-resource-plan'
  id: string
  createdAt: string
  scope: { mode: 'demo' | 'live'; projectId: string; projectName: string; storage: 'browser-memory-and-json-export' }
  binding: { id: string; specVersion: string; styleReference: string; source: 'local-draft' | 'read-only'; snapshot: ProjectSpec }
  status: 'draft'
  generationSource: GenerationSource
  requirements: ResourceRequirement[]
  batches: PlannedBatch[]
  execution: { submittedTasks: 0; generatedAssets: 0; importedAssets: 0; boundAssets: 0; runtimeChecks: 0 }
}
export interface RequirementInput {
  name: string
  category: ResourceCategory
  purpose: string
  page: string
  priority: 'normal' | 'high'
  defaultSize: OutputSize
  transparent: boolean
  ownerProtected: boolean
  acceptanceNotes: string
  derivedSizes?: OutputSize[]
  confirmSameMaster?: boolean
}
export const PLAN_JSON_LIMIT_BYTES = 524_288
const categories: ResourceCategory[] = ['图标','按钮','面板','角色','背景','特效','字体']
const id = () => crypto.randomUUID()
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function text(value: unknown, label: string, max: number, required = true): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label}须为${required ? '非空' : ''}文本，最多 ${max} 字符`)
  return value.trim()
}
function size(value: OutputSize): void {
  if (!value || !Number.isInteger(value.width) || !Number.isInteger(value.height) || value.width < 16 || value.height < 16 || value.width > 8192 || value.height > 8192) throw new Error('输出尺寸须为 16–8192 的整数')
}
export function createResourcePlan(project: Project, spec: ProjectSpec, mode: 'demo' | 'live', source: 'local-draft' | 'read-only'): ResourcePlan {
  const errors = validateSpec(spec)
  if (errors.length) throw new Error(`先建立有效项目规范：${errors.join('；')}`)
  return { schemaVersion: 1, kind: 'companion-resource-plan', id: id(), createdAt: new Date().toISOString(),
    scope: { mode, projectId: text(project.id, '项目 ID', 128), projectName: text(project.name, '项目名称', 160), storage: 'browser-memory-and-json-export' },
    binding: { id: id(), specVersion: spec.version, styleReference: spec.styleName, source, snapshot: copy(spec) },
    status: 'draft', generationSource: 'unselected', requirements: [], batches: [], execution: { submittedTasks: 0, generatedAssets: 0, importedAssets: 0, boundAssets: 0, runtimeChecks: 0 } }
}
export function acceptanceFor(transparent: boolean, spec: ProjectSpec): AcceptanceCondition[] {
  return [
    { id: 'size', phase: 'technical', description: '默认尺寸、PNG 格式与每个派生尺寸逐项核对', state: 'not-checked' },
    { id: 'alpha', phase: 'technical', description: transparent ? '检查真实 alpha、透明边缘与白边' : '检查不透明背景及边缘', state: 'not-checked' },
    { id: 'text', phase: 'technical', description: '动态文字不烘焙，九切片 / pivot 按规范核对', state: 'not-checked' },
    { id: 'style', phase: 'visual', description: `人工比对 ${spec.styleName}，确认风格、视觉占比与小尺寸辨识`, state: 'not-checked' },
    { id: 'owner', phase: 'visual', description: 'Owner 人工批准；保护已有资产与手工修改', state: 'not-checked' },
    { id: 'uuid', phase: 'delivery', description: '真实导入后记录 UUID、路径与版本', state: 'not-checked' },
    { id: 'binding', phase: 'delivery', description: '独立检查 Prefab 组件引用与绑定', state: 'not-checked' },
    { id: 'runtime', phase: 'delivery', description: `在 ${spec.width} × ${spec.height} 实际页面运行并留证`, state: 'not-checked' },
  ]
}
export function buildRequirement(plan: ResourcePlan, input: RequirementInput): ResourceRequirement {
  size(input.defaultSize)
  if (!categories.includes(input.category) || !['normal','high'].includes(input.priority) || typeof input.transparent !== 'boolean' || typeof input.ownerProtected !== 'boolean') throw new Error('资源类别、优先级或保护属性无效')
  const requirementId = id()
  const derived = input.derivedSizes ?? []
  if (derived.length > 8) throw new Error('每项最多规划 8 个派生尺寸')
  if (derived.length && input.confirmSameMaster !== true) throw new Error('附加尺寸须明确确认从同一已批准母图缩放')
  if (input.ownerProtected && derived.length) throw new Error('Owner 保护项不规划生成或派生')
  const seen = new Set([`${input.defaultSize.width}x${input.defaultSize.height}`])
  for (const target of derived) {
    size(target)
    const key = `${target.width}x${target.height}`
    if (seen.has(key)) throw new Error('默认尺寸与派生尺寸不得重复')
    if (target.width > input.defaultSize.width || target.height > input.defaultSize.height) throw new Error('本片只规划不放大的同图缩小尺寸')
    if (target.width * input.defaultSize.height !== target.height * input.defaultSize.width) throw new Error('同图派生必须保持默认尺寸的宽高比，不裁切或重新推理')
    seen.add(key)
  }
  return { id: requirementId, projectId: plan.scope.projectId, specBindingId: plan.binding.id,
    name: text(input.name,'资源名称',100), category: input.category, purpose: text(input.purpose,'用途',200), page: text(input.page,'关联页面',160), priority: input.priority,
    defaultSize: copy(input.defaultSize), format: 'png', transparent: input.transparent, ownerProtected: input.ownerProtected,
    derivatives: derived.map((target) => ({ ...target, method: 'resize-approved-master', sourceRequirementId: requirementId, additionalInferenceCount: 0 })),
    status: input.ownerProtected ? 'owner-protected' : 'planned', generated: false, acceptanceNotes: text(input.acceptanceNotes,'补充验收条件',500,false), acceptance: acceptanceFor(input.transparent, plan.binding.snapshot) }
}
export function addRequirement(plan: ResourcePlan, input: RequirementInput): ResourcePlan {
  assertPlan(plan)
  if (plan.requirements.length >= 200) throw new Error('单个规划草稿最多 200 项需求')
  const item = buildRequirement(plan, input)
  if (plan.requirements.some((r) => r.name === item.name && r.page === item.page)) throw new Error('同一页面已有同名需求，请避免重复登记')
  return exportablePlan({ ...copy(plan), requirements: [...copy(plan.requirements), item] })
}
export function planBatch(plan: ResourcePlan, name: string, requirementIds: string[]): ResourcePlan {
  assertPlan(plan)
  if (!requirementIds.length || requirementIds.length > 32 || new Set(requirementIds).size !== requirementIds.length) throw new Error('请选择 1–32 项不重复需求')
  if (plan.batches.length >= 50) throw new Error('单个规划草稿最多 50 个批次')
  const alreadyAssigned = new Set(plan.batches.flatMap((batch) => batch.requirementIds))
  for (const itemId of requirementIds) {
    const item = plan.requirements.find((r) => r.id === itemId)
    if (!item || item.projectId !== plan.scope.projectId || item.specBindingId !== plan.binding.id) throw new Error('批次只能包含本项目同一规范与风格绑定的需求')
    if (item.ownerProtected) throw new Error('Owner 保护项不能进入生成批次')
    if (alreadyAssigned.has(itemId)) throw new Error('需求已编入批次，不能重复安排')
  }
  const batch: PlannedBatch = { id: id(), name: text(name,'批次名称',100), projectId: plan.scope.projectId, specBindingId: plan.binding.id, requirementIds: [...requirementIds], queuePolicy: 'serial', status: 'not-submitted', approval: 'not-approved' }
  return exportablePlan({ ...copy(plan), batches: [...copy(plan.batches), batch] })
}
export function planningCounts(plan: ResourcePlan) {
  const batched = new Set(plan.batches.flatMap((batch) => batch.requirementIds))
  const items = plan.requirements.filter((r) => batched.has(r.id))
  return { requirements: plan.requirements.length, batches: plan.batches.length, plannedMasterInferences: items.length, plannedDerivativeOutputs: items.reduce((n,r) => n+r.derivatives.length,0), submittedTasks: 0 as const, generatedAssets: 0 as const }
}
export function planMatchesSpec(plan: ResourcePlan, spec: ProjectSpec | undefined): boolean {
  return Boolean(spec && Object.keys(plan.binding.snapshot).every((key) => plan.binding.snapshot[key as keyof ProjectSpec] === spec[key as keyof ProjectSpec]))
}
export function parseDerivedSizes(value: string): OutputSize[] {
  if (!value.trim()) return []
  if (value.length > 250) throw new Error('派生尺寸输入过长')
  return value.split(/[,，;；\n]+/).map((part) => {
    const match = part.trim().match(/^(\d+)\s*[x×X]\s*(\d+)$/)
    if (!match) throw new Error('派生尺寸格式为 128×128，多项用逗号分隔')
    return { width: Number(match[1]), height: Number(match[2]) }
  })
}
/** Validate internally typed plan consistency; external JSON must pass the strict import boundary first. */
export function assertPlan(plan: ResourcePlan): void {
  if (!GENERATION_SOURCES.includes(plan.generationSource)) throw new Error('生成来源无效')
  if (plan.schemaVersion !== 1 || plan.kind !== 'companion-resource-plan' || plan.status !== 'draft' || validateSpec(plan.binding.snapshot).length) throw new Error('计划或规范快照无效')
  if (plan.binding.specVersion !== plan.binding.snapshot.version || plan.binding.styleReference !== plan.binding.snapshot.styleName) throw new Error('规范版本或风格引用与快照不一致')
  if (Object.values(plan.execution).some((value) => value !== 0)) throw new Error('规划草稿不能包含已执行计数')
  const ids = new Set<string>()
  for (const r of plan.requirements) {
    if (ids.has(r.id) || r.projectId !== plan.scope.projectId || r.specBindingId !== plan.binding.id) throw new Error('需求 ID、项目或规范绑定不一致')
    ids.add(r.id)
    if (r.generated !== false || r.format !== 'png' || r.status !== (r.ownerProtected ? 'owner-protected' : 'planned')) throw new Error('需求不得冒充已生成')
    const validated = buildRequirement(plan, { ...r, derivedSizes: r.derivatives, confirmSameMaster: true })
    if (r.acceptance.length !== validated.acceptance.length || r.acceptance.some((criterion,index) => criterion.state !== 'not-checked' || criterion.id !== validated.acceptance[index]?.id || criterion.phase !== validated.acceptance[index]?.phase || criterion.description !== validated.acceptance[index]?.description)) throw new Error('验收条件不得缺失或冒充已检查')
    if (r.derivatives.some((d) => d.method !== 'resize-approved-master' || d.sourceRequirementId !== r.id || d.additionalInferenceCount !== 0)) throw new Error('派生必须绑定同一母图且不增加推理')
  }
  const assigned = new Set<string>()
  for (const b of plan.batches) {
    if (b.projectId !== plan.scope.projectId || b.specBindingId !== plan.binding.id || b.status !== 'not-submitted' || b.approval !== 'not-approved' || b.queuePolicy !== 'serial' || !b.requirementIds.length || b.requirementIds.length > 32) throw new Error('批次绑定或计划状态无效')
    for (const rid of b.requirementIds) {
      if (assigned.has(rid) || !ids.has(rid) || plan.requirements.find((r) => r.id === rid)?.ownerProtected) throw new Error('批次存在重复、缺失或受保护需求')
      assigned.add(rid)
    }
  }
}
export function exportResourcePlan(plan: ResourcePlan): string {
  assertPlan(plan)
  const serialized = JSON.stringify({ ...copy(plan), disclaimer: '仅资源规划草稿，未写入项目配置、未提交生成、未产生任何资产或验收结论。派生尺寸仅在同一母图人工批准后缩放，不重新推理。', plannedCounts: planningCounts(plan) }, null, 2)
  if (new TextEncoder().encode(serialized).byteLength > PLAN_JSON_LIMIT_BYTES) throw new Error('计划超过 512 KiB 导出预算，请拆分为更小的计划；原草稿保持不变')
  return serialized
}
function exportablePlan(plan: ResourcePlan): ResourcePlan { exportResourcePlan(plan); return plan }

export function updateRequirement(plan: ResourcePlan, requirementId: string, input: RequirementInput): ResourcePlan {
  assertPlan(plan)
  const current=plan.requirements.find((r)=>r.id===requirementId)
  if(!current) throw new Error('需求不存在')
  if(current.ownerProtected) throw new Error('Owner 保护项不能修改或解除保护')
  if(plan.batches.some((b)=>b.requirementIds.includes(requirementId))) throw new Error('需求已编批，请先取消对应的本地计划批次')
  const next=buildRequirement(plan,input)
  next.id=requirementId;next.derivatives=next.derivatives.map((d)=>({...d,sourceRequirementId:requirementId}))
  if(plan.requirements.some((r)=>r.id!==requirementId&&r.name===next.name&&r.page===next.page)) throw new Error('同一页面已有同名需求')
  return exportablePlan({...copy(plan),requirements:plan.requirements.map((r)=>r.id===requirementId?next:copy(r))})
}
export function removeRequirement(plan: ResourcePlan, requirementId: string): ResourcePlan {
  assertPlan(plan)
  const current=plan.requirements.find((r)=>r.id===requirementId)
  if(!current) throw new Error('需求不存在')
  if(current.ownerProtected) throw new Error('Owner 保护项不能删除')
  if(plan.batches.some((b)=>b.requirementIds.includes(requirementId))) throw new Error('需求已编批，请先取消对应的本地计划批次')
  return {...copy(plan),requirements:copy(plan.requirements.filter((r)=>r.id!==requirementId))}
}
export function cancelPlannedBatch(plan: ResourcePlan,batchId:string): ResourcePlan {
  assertPlan(plan)
  if(!plan.batches.some((b)=>b.id===batchId)) throw new Error('计划批次不存在')
  return {...copy(plan),batches:copy(plan.batches.filter((b)=>b.id!==batchId))}
}

/** Does not mutate project spec, requirements, Owner locks or any service state. */
export function selectGenerationSource(plan: ResourcePlan, source: GenerationSource): ResourcePlan {
  assertPlan(plan)
  if (!GENERATION_SOURCES.includes(source)) throw new Error('生成来源无效')
  return exportablePlan({ ...copy(plan), generationSource: source })
}
