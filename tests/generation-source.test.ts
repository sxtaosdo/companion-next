import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createDefaultSpec } from '../src/domain/spec'
import { addRequirement, createResourcePlan, exportResourcePlan, planBatch, selectGenerationSource, PLAN_JSON_LIMIT_BYTES } from '../src/domain/resource-planning'
import { parseResourcePlan } from '../src/domain/resource-plan-import'
import { createGenerationHandoff, exportGenerationHandoff } from '../src/domain/generation-handoff'
import { generationCapability } from '../src/domain/generation-source'
import { preflightResourcePlan } from '../src/domain/resource-preflight'
import { useResourcePlanningStore } from '../src/stores/resource-planning'
const project={id:'p1',name:'测试项目',styleApproval:'unknown' as const,protectedAssets:null}
const spec={...createDefaultSpec(),styleName:'统一风格'}
function plan(){
 let p=createResourcePlan(project,spec,'live','local-draft')
 p=addRequirement(p,{name:'资源',category:'图标',purpose:'货币',page:'商店',priority:'normal',defaultSize:{width:256,height:256},transparent:true,ownerProtected:false,acceptanceNotes:'',derivedSizes:[{width:128,height:128}],confirmSameMaster:true})
 p=addRequirement(p,{name:'保留',category:'按钮',purpose:'保留',page:'商店',priority:'normal',defaultSize:{width:256,height:256},transparent:true,ownerProtected:true,acceptanceNotes:''})
 return planBatch(p,'一批',[p.requirements[0]!.id])
}
beforeEach(()=>setActivePinia(createPinia()))
describe('source selection preserves the common strict plan',()=>{
 it('defaults to no provider and never infers an executable connection',()=>{expect(plan().generationSource).toBe('unselected');for(const source of ['unselected','comfyui','codex-native'] as const){expect(generationCapability(source).automaticExecutionAvailable).toBe(false);expect(generationCapability(source).currentPlanOutput).toBe('none')}})
 it('switches without modifying any shared config, Owner item, batch or requirement',()=>{const original=plan();const switched=selectGenerationSource(selectGenerationSource(original,'comfyui'),'codex-native');expect({...switched,generationSource:'unselected'}).toEqual(original);expect(original.generationSource).toBe('unselected')})
 it.each(['comfyui','codex-native','unselected'] as const)('exports and restores %s source exactly',source=>{const p=selectGenerationSource(plan(),source);expect(parseResourcePlan(exportResourcePlan(p))).toEqual(p)})
 it('reads earlier schema-1 manifests as unselected without rewriting their bindings',()=>{const original=plan();const legacy:any=JSON.parse(exportResourcePlan(original));delete legacy.generationSource;expect(parseResourcePlan(JSON.stringify(legacy))).toEqual(original)})
 it.each([null,'openai-api','ready',{source:'comfyui',token:'forbidden'},false])('rejects unsupported source value %s',source=>{const p:any=plan();p.generationSource=source;expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow('生成来源');expect(()=>selectGenerationSource(plan(),source as any)).toThrow()})
 it('retains strict refusal of extra connection credentials or job status',()=>{for(const field of ['token','endpoint','outputReceipt']){const p:any=plan();p[field]='unexpected';expect(()=>parseResourcePlan(JSON.stringify(p))).toThrow('未知字段')}})
 it('keeps per-project and demo/live selections isolated',()=>{const store=useResourcePlanningStore();store.begin(project,spec,'live','local-draft');store.begin(project,spec,'demo','local-draft');store.selectSource('live',project.id,'codex-native');expect(store.get('live',project.id)?.generationSource).toBe('codex-native');expect(store.get('demo',project.id)?.generationSource).toBe('unselected')})
 it('retains Owner protection through a source-only restore',()=>{const store=useResourcePlanningStore();const p=plan();store.restore(project,'live',exportResourcePlan(p));store.restore(project,'live',exportResourcePlan(selectGenerationSource(p,'codex-native')),true);expect(store.get('live',project.id)?.requirements[1]).toEqual(p.requirements[1]);expect(store.getBackups('live',project.id)[0]?.generationSource).toBe('unselected')})
})
describe('non-executing common generation handoff',()=>{
 it('requires explicit source choice before export',()=>expect(()=>exportGenerationHandoff(plan(),spec)).toThrow('选择'))
 it.each(['comfyui','codex-native'] as const)('%s handoff contains expected sizes, zero results and empty receipt',source=>{const p=selectGenerationSource(plan(),source);const before=JSON.stringify(p);const handoff=createGenerationHandoff(p,spec);expect(handoff.manifest.binding).toEqual(p.binding);expect(handoff.source.source).toBe(source);expect(handoff.status).toBe('draft-not-submitted');expect(handoff.expectedOutputs).toHaveLength(1);expect(handoff.expectedOutputs[0]?.master).toEqual({width:256,height:256,format:'png',transparent:true});expect(handoff.expectedOutputs[0]?.derivatives[0]?.additionalInferenceCount).toBe(0);expect(handoff.outputReceipt).toMatchObject({status:'awaiting-external-files',artifacts:[],technicalQA:'not-checked',visualReview:'not-checked',savedToProject:false,imported:false});expect(Object.values(handoff.execution).every(n=>n===0)).toBe(true);expect(handoff.sharedInputs.referenceCrop).toBe('not-recorded');expect(JSON.stringify(p)).toBe(before)})
 it('has source-specific blockers without pretending a Comfy workflow is required for Codex',()=>{const codex=preflightResourcePlan(selectGenerationSource(plan(),'codex-native'),spec);expect(codex.blockers.map(b=>b.code)).toContain('native-session-handoff');expect(codex.blockers.map(b=>b.code)).not.toContain('workflow-binding');expect(codex.executionStatus).toBe('blocked-not-started');expect(preflightResourcePlan(selectGenerationSource(plan(),'comfyui'),spec).blockers.map(b=>b.code)).toContain('workflow-binding')})
 it('preserves stale spec and demo hard stops in the handoff',()=>{const p=selectGenerationSource(plan(),'codex-native');p.scope.mode='demo';const h=createGenerationHandoff(p,{...spec,width:1080});expect(h.blockers.map(b=>b.code)).toEqual(expect.arrayContaining(['spec-not-current','demo-source','owner-and-style-approval','engine-handoff-unverified']))})
 it('rejects handoff JSON as a recoverable plan or a result',()=>{const out=exportGenerationHandoff(selectGenerationSource(plan(),'codex-native'),spec);expect(()=>parseResourcePlan(out)).toThrow();expect(JSON.parse(out).outputReceipt.artifacts).toEqual([])})
 it('rejects oversized handoff packaging even when the original manifest is within its own budget',()=>{
  const p=selectGenerationSource(plan(),'codex-native');p.batches=[]
  const template={...p.requirements[0]!,derivatives:[],acceptanceNotes:'a'.repeat(500)}
  let lastGood=p
  for(let count=100;count<=200;count++){
   const candidate={...p,requirements:Array.from({length:count},(_,i)=>({...JSON.parse(JSON.stringify(template)),id:`r-${i}`,name:`${i}-${'n'.repeat(90)}`,purpose:'p'.repeat(200)}))}
   try{exportResourcePlan(candidate);lastGood=candidate}catch{break}
  }
  const before=JSON.stringify(lastGood)
  expect(new TextEncoder().encode(exportResourcePlan(lastGood)).byteLength).toBeLessThanOrEqual(PLAN_JSON_LIMIT_BYTES)
  expect(()=>exportGenerationHandoff(lastGood,spec)).toThrow('交接草稿超过 512 KiB')
  expect(JSON.stringify(lastGood)).toBe(before)
 })
})
