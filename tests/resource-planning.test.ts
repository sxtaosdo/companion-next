import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Project } from '../src/domain/contracts'
import { createDefaultSpec } from '../src/domain/spec'
import { addRequirement, assertPlan, createResourcePlan, exportResourcePlan, parseDerivedSizes, planBatch, planMatchesSpec, planningCounts } from '../src/domain/resource-planning'
import type { RequirementInput, ResourcePlan } from '../src/domain/resource-planning'
import { useResourcePlanningStore } from '../src/stores/resource-planning'
const project: Project = { id: 'test-1060', name: '测试项目', styleApproval: 'unknown', protectedAssets: null }
const spec = () => ({ ...createDefaultSpec(), styleName: '未批准风格引用' })
const plan = () => createResourcePlan(project, spec(), 'demo', 'local-draft')
const input = (): RequirementInput => ({ name: '资源A', category: '图标', purpose: '货币展示', page: '商店', priority: 'normal', defaultSize: { width: 256, height: 256 }, transparent: true, ownerProtected: false, acceptanceNotes: '' })
const withItem = () => addRequirement(plan(), input())
beforeEach(() => { setActivePinia(createPinia()); localStorage.clear() })
describe('resource requirements and single-source planning', () => {
  it('starts empty and freezes a separate specification snapshot', () => {
    const original = spec(); const p = createResourcePlan(project, original, 'demo', 'local-draft')
    original.width = 1080
    expect(p.binding.snapshot.width).toBe(941); expect(p.requirements).toHaveLength(0)
    expect(p.status).toBe('draft'); expect(p.scope.storage).toBe('browser-memory-and-json-export')
  })
  it('does not require an approved sample to plan', () => expect(() => plan()).not.toThrow())
  it('requires a valid complete specification', () => expect(() => createResourcePlan(project, createDefaultSpec(), 'demo', 'local-draft')).toThrow('先建立有效项目规范'))
  it('defaults to a single output with no inference or execution result', () => {
    const p = withItem(); const r = p.requirements[0]!
    expect(r.derivatives).toEqual([]); expect(r.generated).toBe(false); expect(r.status).toBe('planned')
    expect(r.specBindingId).toBe(p.binding.id); expect(r.acceptance).toHaveLength(8)
    expect(r.acceptance.every((c) => c.state === 'not-checked')).toBe(true)
    expect(Object.values(p.execution).every((v) => v === 0)).toBe(true)
  })
  it.each([0,15,8193,10.5,NaN,Infinity])('rejects invalid default dimensions %s', (width) => expect(() => addRequirement(plan(), { ...input(), defaultSize: { width, height:256 } })).toThrow('输出尺寸'))
  it('requires resource name, purpose and page and disallows unknown category', () => {
    for (const field of ['name','purpose','page']) expect(() => addRequirement(plan(), { ...input(), [field]: '' })).toThrow()
    expect(() => addRequirement(plan(), { ...input(), category: 'invalid' as '图标' })).toThrow()
  })
  it('rejects duplicate names on the same page', () => expect(() => addRequirement(withItem(), input())).toThrow('同一页面已有同名需求'))
  it('allows reuse names only when the page is explicitly different', () => expect(addRequirement(withItem(), { ...input(), page:'背包' }).requirements).toHaveLength(2))
  it('requires explicit same-master confirmation for every extra-size plan', () => expect(() => addRequirement(plan(), { ...input(), derivedSizes:[{width:128,height:128}] })).toThrow('明确确认'))
  it('ties explicit derived sizes to one master and zero additional inference', () => {
    const r = addRequirement(plan(), { ...input(), derivedSizes:[{width:128,height:128},{width:64,height:64}], confirmSameMaster:true }).requirements[0]!
    expect(r.derivatives.every((d) => d.sourceRequirementId === r.id && d.method === 'resize-approved-master' && d.additionalInferenceCount === 0)).toBe(true)
  })
  it.each([{width:256,height:256},{width:128,height:64},{width:512,height:512}])('rejects duplicate, cropped or enlarged derivatives %s', (target) => expect(() => addRequirement(plan(), {...input(),derivedSizes:[target],confirmSameMaster:true})).toThrow())
  it('rejects duplicate derivations and more than eight derivations', () => {
    expect(() => addRequirement(plan(), {...input(),derivedSizes:[{width:128,height:128},{width:128,height:128}],confirmSameMaster:true})).toThrow('重复')
    expect(() => addRequirement(plan(), {...input(),derivedSizes:Array(9).fill({width:16,height:16}),confirmSameMaster:true})).toThrow('最多规划 8')
  })
  it('preserves Owner protections and prevents derived or batched operations', () => {
    const p=addRequirement(plan(),{...input(),ownerProtected:true})
    expect(p.requirements[0]?.status).toBe('owner-protected')
    expect(() => planBatch(p,'不可生成',[p.requirements[0]!.id])).toThrow('Owner 保护')
    expect(() => addRequirement(plan(),{...input(),ownerProtected:true,derivedSizes:[{width:128,height:128}],confirmSameMaster:true})).toThrow('Owner 保护')
  })
})
describe('serial batches, export and unverified acceptance', () => {
  it('builds a same-binding serial batch without changing source plan', () => {
    const source=withItem();const p=planBatch(source,'第一批',[source.requirements[0]!.id])
    expect(source.batches).toHaveLength(0)
    expect(p.batches[0]).toMatchObject({specBindingId:p.binding.id,projectId:project.id,queuePolicy:'serial',status:'not-submitted',approval:'not-approved'})
  })
  it('prevents empty, repeated, missing and already-batched entries', () => {
    const p=withItem();const rid=p.requirements[0]!.id
    expect(() => planBatch(p,'batch',[])).toThrow();expect(() => planBatch(p,'batch',[rid,rid])).toThrow()
    expect(() => planBatch(p,'batch',['missing'])).toThrow()
    expect(() => planBatch(planBatch(p,'one',[rid]),'two',[rid])).toThrow('重复安排')
  })
  it('rejects mixed specification, style or project bindings', () => {
    for (const mutation of [(p:ResourcePlan)=>{p.requirements[0]!.specBindingId='other'},(p:ResourcePlan)=>{p.requirements[0]!.projectId='other'},(p:ResourcePlan)=>{p.binding.styleReference='other'}]) {
      const p=withItem();mutation(p);expect(() => assertPlan(p)).toThrow()
    }
  })
  it('counts planned master calls and derivatives separately from actual execution', () => {
    const p=addRequirement(plan(),{...input(),derivedSizes:[{width:128,height:128}],confirmSameMaster:true});const b=planBatch(p,'one',[p.requirements[0]!.id])
    expect(planningCounts(b)).toMatchObject({plannedMasterInferences:1,plannedDerivativeOutputs:1,submittedTasks:0,generatedAssets:0})
  })
  it('exports a labeled draft manifest with the snapshot and all unchecked criteria', () => {
    const p=withItem();const result=JSON.parse(exportResourcePlan(p))
    expect(result.kind).toBe('companion-resource-plan');expect(result.disclaimer).toContain('未写入项目配置')
    expect(result.binding.snapshot).toEqual(spec());expect(result.requirements[0].acceptance).toHaveLength(8)
  })
  it('rejects fake execution, generation, approval or checked acceptance', () => {
    const mutations=[(p:ResourcePlan)=>{p.execution.generatedAssets=1 as 0},(p:ResourcePlan)=>{p.requirements[0]!.generated=true as false},(p:ResourcePlan)=>{p.requirements[0]!.acceptance[0]!.state='passed' as 'not-checked'},(p:ResourcePlan)=>{p.requirements[0]!.derivatives=[{width:128,height:128,sourceRequirementId:'other',method:'resize-approved-master',additionalInferenceCount:0}]}]
    for(const mutate of mutations){const p=withItem();mutate(p);expect(()=>exportResourcePlan(p)).toThrow()}
  })
  it('detects specification edits even without a version label change', () => {
    const p=plan();expect(planMatchesSpec(p,spec())).toBe(true)
    expect(planMatchesSpec(p,{...spec(),width:1080})).toBe(false)
    expect(planMatchesSpec(p,undefined)).toBe(false)
  })
  it('parses explicit size lists but does not infer missing units or dimensions', () => {
    expect(parseDerivedSizes('128×128, 64x64')).toEqual([{width:128,height:128},{width:64,height:64}])
    expect(parseDerivedSizes('')).toEqual([]);expect(()=>parseDerivedSizes('128')).toThrow('格式')
  })
})
describe('memory-only isolated store', () => {
  it('isolates project and mode, does not persist or overwrite an existing draft', () => {
    const store=useResourcePlanningStore();store.begin(project,spec(),'demo','local-draft');store.add('demo',project.id,input())
    expect(store.get('demo',project.id)?.requirements).toHaveLength(1)
    expect(store.get('live',project.id)).toBeUndefined();expect(store.get('demo','other')).toBeUndefined()
    expect(localStorage.length).toBe(0);expect(()=>store.begin(project,spec(),'demo','local-draft')).toThrow('不自动覆盖')
  })
  it('does not automatically seed source resources or create plans', () => {
    const store=useResourcePlanningStore();expect(Object.keys(store.plans)).toHaveLength(0)
  })
})
