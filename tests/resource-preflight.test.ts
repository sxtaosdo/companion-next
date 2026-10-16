import { describe, expect, it } from 'vitest'
import { createDefaultSpec } from '../src/domain/spec'
import { addRequirement, createResourcePlan, planBatch } from '../src/domain/resource-planning'
import { preflightResourcePlan } from '../src/domain/resource-preflight'
const spec=()=>({...createDefaultSpec(),styleName:'仅风格引用'})
function plan(mode:'demo'|'live'='demo'){
 const p=createResourcePlan({id:'p1',name:'测试',styleApproval:'unknown',protectedAssets:null},spec(),mode,'local-draft')
 const r=addRequirement(p,{name:'图标',category:'图标',page:'商店',purpose:'货币',priority:'normal',defaultSize:{width:256,height:256},transparent:true,ownerProtected:false,acceptanceNotes:'',derivedSizes:[{width:128,height:128},{width:64,height:64}],confirmSameMaster:true})
 return planBatch(r,'试点',[r.requirements[0]!.id])
}
describe('non-executing resource preflight',()=>{
 it('always blocks real execution even when local validation passes',()=>{const p=plan('live');const r=preflightResourcePlan(p,spec());expect(r.localValidation).toBe('passed');expect(r.executionStatus).toBe('blocked-not-started');expect(r.blockers.map(b=>b.code)).toContain('service-unverified');expect(r.actualGenerated).toBe(0);expect(r.actualSubmitted).toBe(0)})
 it('includes explicit owner, license, workflow and engine gates',()=>{expect(preflightResourcePlan(plan(),spec()).blockers.map(b=>b.code)).toEqual(expect.arrayContaining(['owner-and-style-approval','reference-license-evidence','workflow-binding','engine-handoff-unverified']))})
 it('requires approval after master generation and before any resizing',()=>{const r=preflightResourcePlan(plan(),spec());expect(r.nodes.map(n=>n.kind)).toEqual(['planned-master','manual-approval-gate','planned-resize','planned-resize']);expect(r.nodes[1]?.dependencies).toEqual([r.nodes[0]!.id]);expect(r.nodes[2]?.dependencies).toEqual([r.nodes[1]!.id]);expect(r.nodes[3]?.dependencies).toEqual([r.nodes[1]!.id])})
 it('never introduces extra inference for resized outputs',()=>{const r=preflightResourcePlan(plan(),spec());expect(r.nodes.reduce((n,node)=>n+node.inferenceIntent,0)).toBe(1);expect(r.plannedMasterInferences).toBe(1);expect(r.plannedDerivativeOutputs).toBe(2);expect(r.nodes.every(n=>n.status==='not-started')).toBe(true)})
 it('adds a hard demo boundary and detects same-label spec drift',()=>{const p=plan();expect(preflightResourcePlan(p,spec()).blockers.map(b=>b.code)).toContain('demo-source');expect(preflightResourcePlan(p,{...spec(),width:1080}).blockers.map(b=>b.code)).toContain('spec-not-current')})
 it('does not invent confirmation of current spec',()=>{expect(preflightResourcePlan(plan()).blockers.map(b=>b.code)).toContain('spec-not-current')})
 it('fails locally and generates no nodes when the manifest is inconsistent',()=>{const p=plan();p.requirements[0]!.specBindingId='other';const r=preflightResourcePlan(p,spec());expect(r.localValidation).toBe('failed');expect(r.nodes).toEqual([]);expect(r.blockers[0]?.code).toBe('invalid-plan')})
 it('preserves source plan and returns stable deterministic dependencies',()=>{const p=plan();const before=JSON.stringify(p);expect(preflightResourcePlan(p,spec())).toEqual(preflightResourcePlan(p,spec()));expect(JSON.stringify(p)).toBe(before)})
 it('reports no batches explicitly without fabricating queued tasks',()=>{const p=plan();p.batches=[];const r=preflightResourcePlan(p,spec());expect(r.nodes).toEqual([]);expect(r.blockers.map(b=>b.code)).toContain('no-batches')})
})
