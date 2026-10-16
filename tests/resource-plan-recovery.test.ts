import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultSpec } from '../src/domain/spec'
import { addRequirement, cancelPlannedBatch, createResourcePlan, exportResourcePlan, planBatch, removeRequirement, updateRequirement } from '../src/domain/resource-planning'
import { MAX_PLAN_IMPORT_BYTES, parseResourcePlan } from '../src/domain/resource-plan-import'
import { useResourcePlanningStore } from '../src/stores/resource-planning'
import type { Project } from '../src/domain/contracts'
import type { RequirementInput } from '../src/domain/resource-planning'
const project:Project={id:'p1',name:'当前项目',styleApproval:'unknown',protectedAssets:null}
const spec=()=>({...createDefaultSpec(),styleName:'风格引用'})
const input=():RequirementInput=>({name:'资源',category:'图标',purpose:'货币',page:'商店',priority:'normal',defaultSize:{width:256,height:256},transparent:true,ownerProtected:false,acceptanceNotes:''})
const plan=()=>addRequirement(createResourcePlan(project,spec(),'demo','local-draft'),input())
beforeEach(()=>{setActivePinia(createPinia());localStorage.clear()})
describe('strict resource plan import',()=>{
 it('roundtrips exported plans and removes only known export metadata',()=>{const p=plan();expect(parseResourcePlan(exportResourcePlan(p))).toEqual(p)})
 it('accepts a raw valid plan with no optional export decoration',()=>expect(parseResourcePlan(JSON.stringify(plan())).requirements).toHaveLength(1))
 it.each(['','{','null','[]','"string"'])('rejects malformed non-plan content %s',(value)=>expect(()=>parseResourcePlan(value)).toThrow())
 it('rejects oversized input before parsing',()=>expect(()=>parseResourcePlan(' '.repeat(MAX_PLAN_IMPORT_BYTES+1))).toThrow('512 KiB'))
 it('rejects unknown fields at every executable nesting boundary',()=>{
  const paths=[(p:any)=>p.url='https://invalid.test',(p:any)=>p.scope.path='C:/anything',(p:any)=>p.binding.workflow='unknown',(p:any)=>p.requirements[0].outputPath='x',(p:any)=>p.requirements[0].defaultSize.extra=true,(p:any)=>p.requirements[0].acceptance[0].script='x']
  for(const mutate of paths){const p=plan();mutate(p);expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow()}
 })
 it('rejects missing properties, unsupported schema and altered timestamps',()=>{
  for(const field of ['id','createdAt','scope','binding','requirements','batches','execution']){const p:any=plan();delete p[field];expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow()}
  for(const value of ['bad','2026-02-31T00:00:00.000Z']){const p=plan();p.createdAt=value;expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow()}
 })
 it('rejects fake task, asset, approval and acceptance results',()=>{
  const mutations=[(p:any)=>p.execution.submittedTasks=1,(p:any)=>p.requirements[0].generated=true,(p:any)=>p.requirements[0].acceptance[0].state='passed',(p:any)=>p.status='approved',(p:any)=>p.scope.mode='other']
  for(const mutate of mutations){const p=plan();mutate(p);expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow()}
 })
 it('rejects tampered exported counts',()=>{const p=JSON.parse(exportResourcePlan(plan()));p.plannedCounts.generatedAssets=1;expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow('统计')})
 it('rejects mismatched spec/style, duplicate IDs and dangling batch references',()=>{
  const p=plan();p.binding.styleReference='不同风格';expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow()
  const d=plan();d.requirements.push({...d.requirements[0]!});expect(()=>parseResourcePlan(JSON.stringify(d))).toThrow()
  const b=plan();const batched=planBatch(b,'一批',[b.requirements[0]!.id]);batched.batches[0]!.requirementIds=['missing'];expect(()=>parseResourcePlan(JSON.stringify(batched))).toThrow()
 })
 it('rejects malformed nested booleans and derived inference overrides',()=>{const p:any=plan();p.requirements[0].ownerProtected='false';expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow();p.requirements[0].ownerProtected=false;p.requirements[0].derivatives=[{width:128,height:128,method:'generate-again',sourceRequirementId:p.requirements[0].id,additionalInferenceCount:1}];expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow()})
})
describe('requirement and batch consistency',()=>{
 it('edits while preserving stable identity, snapshot and derivative master reference',()=>{const p=plan();const id=p.requirements[0]!.id;const edited=updateRequirement(p,id,{...input(),name:'已编辑',derivedSizes:[{width:128,height:128}],confirmSameMaster:true});expect(edited.requirements[0]!.id).toBe(id);expect(edited.requirements[0]!.derivatives[0]!.sourceRequirementId).toBe(id);expect(edited.binding).toEqual(p.binding);expect(p.requirements[0]!.name).toBe('资源')})
 it('rejects editing or deletion while a batch still references the requirement',()=>{const p=plan();const b=planBatch(p,'批次',[p.requirements[0]!.id]);expect(()=>updateRequirement(b,p.requirements[0]!.id,input())).toThrow('先取消');expect(()=>removeRequirement(b,p.requirements[0]!.id)).toThrow('先取消')})
 it('cancels only the local batch, preserving requirements and freeing edit/remove',()=>{const p=plan();const b=planBatch(p,'批次',[p.requirements[0]!.id]);const canceled=cancelPlannedBatch(b,b.batches[0]!.id);expect(canceled.requirements).toEqual(p.requirements);expect(canceled.batches).toHaveLength(0);expect(removeRequirement(canceled,p.requirements[0]!.id).requirements).toHaveLength(0);expect(b.batches).toHaveLength(1)})
 it('never unlocks or removes an Owner protected requirement',()=>{const p=addRequirement(createResourcePlan(project,spec(),'demo','local-draft'),{...input(),ownerProtected:true});expect(()=>updateRequirement(p,p.requirements[0]!.id,input())).toThrow('Owner');expect(()=>removeRequirement(p,p.requirements[0]!.id)).toThrow('Owner')})
 it('requires explicit reconfirmation of derived sizes during edit',()=>{const p=plan();expect(()=>updateRequirement(p,p.requirements[0]!.id,{...input(),derivedSizes:[{width:128,height:128}]})).toThrow('明确确认')})
 it('rejects missing requirement and batch targets without changing the plan',()=>{const p=plan();expect(()=>removeRequirement(p,'missing')).toThrow();expect(()=>updateRequirement(p,'missing',input())).toThrow();expect(()=>cancelPlannedBatch(p,'missing')).toThrow();expect(p.requirements).toHaveLength(1)})
})
describe('recovery protects current drafts and scope',()=>{
 it('restores into an empty matching scope with no persistence or rebinding',()=>{const store=useResourcePlanningStore();const p=plan();store.restore(project,'demo',exportResourcePlan(p));expect(store.get('demo',project.id)).toEqual(p);expect(localStorage.length).toBe(0)})
 it('does not silently replace existing drafts and preserves a recoverable backup after confirmation',()=>{const store=useResourcePlanningStore();store.begin(project,spec(),'demo','local-draft');const old=JSON.parse(JSON.stringify(store.get('demo',project.id)));expect(()=>store.restore(project,'demo',exportResourcePlan(plan()))).toThrow('明确确认');expect(store.get('demo',project.id)).toEqual(old);store.restore(project,'demo',exportResourcePlan(plan()),true);expect(store.getBackups('demo',project.id)).toEqual([old]);expect(()=>parseResourcePlan(exportResourcePlan(store.getBackups('demo',project.id)[0]!))).not.toThrow()})
 it('rejects mismatched project, mode or project name',()=>{const store=useResourcePlanningStore();const data=exportResourcePlan(plan());expect(()=>store.restore({...project,id:'other'},'demo',data)).toThrow('不匹配');expect(()=>store.restore(project,'live',data)).toThrow('不匹配');expect(()=>store.restore({...project,name:'other'},'demo',data)).toThrow('不匹配');expect(Object.keys(store.plans)).toHaveLength(0)})
 it('does not allow import to drop, change or unlock current Owner protected entries',()=>{const store=useResourcePlanningStore();store.begin(project,spec(),'demo','local-draft');store.add('demo',project.id,{...input(),ownerProtected:true});const current=store.get('demo',project.id)!;const modified=JSON.parse(JSON.stringify(current));modified.requirements=[];expect(()=>store.restore(project,'demo',JSON.stringify(modified),true)).toThrow('Owner');expect(store.get('demo',project.id)?.requirements[0]!.ownerProtected).toBe(true);expect(store.getBackups('demo',project.id)).toHaveLength(0)})
 it('caps backups without discarding previous drafts',()=>{const store=useResourcePlanningStore();const data=exportResourcePlan(plan());store.restore(project,'demo',data);for(let n=0;n<5;n++)store.restore(project,'demo',data,true);expect(()=>store.restore(project,'demo',data,true)).toThrow('5 份');expect(store.getBackups('demo',project.id)).toHaveLength(5)})
 it('preserves both plans and backups when parse or validation fails',()=>{const store=useResourcePlanningStore();store.begin(project,spec(),'demo','local-draft');const prior=JSON.stringify(store.plans);expect(()=>store.restore(project,'demo','bad',true)).toThrow();expect(JSON.stringify(store.plans)).toBe(prior);expect(store.getBackups('demo',project.id)).toHaveLength(0)})
})

it('rejects compact valid-shaped input that cannot be re-exported, preserving current plan and backups',()=>{
 const source=plan();const template=source.requirements[0]!
 source.requirements=Array.from({length:200},(_,i)=>({...JSON.parse(JSON.stringify(template)),id:`req-${i}`,name:`${i}-${'n'.repeat(90)}`,purpose:'p'.repeat(200),acceptanceNotes:'a'.repeat(500)}))
 const compact=JSON.stringify(source)
 expect(new TextEncoder().encode(compact).byteLength).toBeLessThan(MAX_PLAN_IMPORT_BYTES)
 expect(()=>exportResourcePlan(source)).toThrow('导出预算')
 expect(()=>parseResourcePlan(compact)).toThrow('导出预算')
 const store=useResourcePlanningStore();store.begin(project,spec(),'demo','local-draft')
 const before=JSON.stringify(store.plans)
 expect(()=>store.restore(project,'demo',compact,true)).toThrow('导出预算')
 expect(JSON.stringify(store.plans)).toBe(before);expect(store.getBackups('demo',project.id)).toHaveLength(0)
})

it('rejects hidden binding changes behind the same ID and preserves Owner scope',()=>{
 const store=useResourcePlanningStore();store.begin(project,spec(),'demo','local-draft');store.add('demo',project.id,{...input(),ownerProtected:true})
 const before=JSON.stringify(store.plans);const changed=JSON.parse(JSON.stringify(store.get('demo',project.id)))
 changed.binding.snapshot.pivot='不同的 pivot'
 expect(()=>parseResourcePlan(JSON.stringify(changed))).not.toThrow()
 expect(()=>store.restore(project,'demo',JSON.stringify(changed),true)).toThrow('相同规范绑定 ID')
 expect(JSON.stringify(store.plans)).toBe(before);expect(store.getBackups('demo',project.id)).toHaveLength(0)
 changed.binding.id='new-binding';changed.requirements[0].specBindingId='new-binding'
 expect(()=>store.restore(project,'demo',JSON.stringify(changed),true)).toThrow('Owner 保护项的规范绑定')
})
it('also protects reused binding IDs when the existing plan has no Owner items',()=>{
 const store=useResourcePlanningStore();store.begin(project,spec(),'demo','local-draft');const changed=JSON.parse(JSON.stringify(store.get('demo',project.id)))
 changed.binding.snapshot.fontFamily='不同字体'
 expect(()=>store.restore(project,'demo',JSON.stringify(changed),true)).toThrow('相同规范绑定 ID')
})
it('compares unchanged Owner entries and bindings semantically rather than by JSON key order',()=>{
 const store=useResourcePlanningStore();store.begin(project,spec(),'demo','local-draft');store.add('demo',project.id,{...input(),ownerProtected:true})
 const current=JSON.parse(JSON.stringify(store.get('demo',project.id)))
 const reorder=(value:unknown):unknown=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reorder(item)])):value
 expect(()=>store.restore(project,'demo',JSON.stringify(reorder(current)),true)).not.toThrow()
 expect(store.get('demo',project.id)?.requirements[0]?.ownerProtected).toBe(true)
 expect(store.getBackups('demo',project.id)).toHaveLength(1)
})
