import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyWorkflowEvidence,workflowDigest,workflowCanonical} from '../scripts/workflow-evidence-gate.mjs';
const collector='a'.repeat(64);
function fixture(status='hit'){
 const files=new Map();const put=(path,v)=>{const bytes=typeof v==='string'?v:JSON.stringify(v);files.set(path,bytes);return {path,sha256:workflowDigest(bytes)}};
 const config={model:'requested-local-model',roles:['knowledge-reference']},configDigest=workflowDigest(workflowCanonical(config));
 const content=put('doc-1.txt','Policy: preserve UNKNOWN and never replay an uncertain write.');
 const wireRequest=put('wire-request.json',{query:'UNKNOWN workflow policy',agentId:'workflow-agent'}),wireResponse=put('wire-response.json',{answer:'Policy result from isolated fake provider',references:status==='hit'?['doc-1']:[]});
 const req={schemaVersion:'workflow-kb-request-v1',mode:'isolated',taskId:'workflow-sample',id:'request-1',query:'UNKNOWN workflow policy',presetId:'workflow-agent',configDigest,wireSha256:wireRequest.sha256};
 const res={schemaVersion:'workflow-kb-response-v1',mode:'isolated',taskId:'workflow-sample',id:'response-1',requestId:req.id,query:req.query,status,error:status==='failed'?'Local knowledge service unavailable':null,hits:status==='hit'?[{documentId:'doc-1',version:'v2',sha256:content.sha256,content}]:[],wireSha256:wireResponse.sha256};
 const quote='preserve UNKNOWN';const reason='Zero hits: no policy was adopted; unresolved policy remains blocked.';
 const e={schemaVersion:'workflow-evidence-v1',mode:'isolated',taskId:'workflow-sample',applicability:{state:'applicable',reason:'This workflow sample requires the local policy preset.'},runtime:{model:'unverified',role:'unverified',reason:'Requested configuration is recorded; actual host activation has no supported proof.'},preset:{id:req.presetId,version:'v3',summary:null,source:put('preset.json',{id:req.presetId,version:'v3',summary:null,configDigest}),resolvedConfig:put('resolved.json',config),configDigest},retrieval:{collectorSha256:collector,request:put('request.json',req),response:put('response.json',res),wireRequest,wireResponse},adoption:{plan:put('plan.md',status==='zero'?reason:'Plan: '+quote),delivery:put('delivery.md',status==='zero'?reason:'Delivery: '+quote),citations:status==='hit'?['plan','delivery'].map(stage=>({stage,documentId:'doc-1',version:'v2',sha256:content.sha256,quote})):[],zeroHitReason:status==='zero'?reason:null}};
 const options={taskId:e.taskId,mode:'isolated',applicabilityState:'applicable',presetId:req.presetId,configDigest,collectorSha256:collector,files};
 return {e,options,files,put,req,res,config,content};
}
function updateResponse(f){f.e.retrieval.response=f.put('response.json',f.res)}
test('hit path links exact plan/delivery quotes; retrieval hits are not all adopted',()=>{const f=fixture();const extra=f.put('unused.txt','Not used by this task.');f.res.hits.push({documentId:'unused',version:null,sha256:extra.sha256,content:extra});updateResponse(f);const r=verifyWorkflowEvidence(f.e,f.options);assert.equal(r.hitCount,2);assert.deepEqual(r.adoptedDocuments,['doc-1']);assert.equal(r.runtime.model,'unverified')});
test('zero-hit path needs recorded disposition in both plan and delivery',()=>{const f=fixture('zero');assert.equal(verifyWorkflowEvidence(f.e,f.options).state,'zero-hit-recorded');f.e.adoption.delivery=f.put('delivery.md','No disposition');assert.throws(()=>verifyWorkflowEvidence(f.e,f.options),/ZERO_HIT_DISPOSITION_NOT_RECORDED/)});
test('service unavailable is blocked, never skipped as zero-hit',()=>{const f=fixture('failed');assert.throws(()=>verifyWorkflowEvidence(f.e,f.options),/KNOWLEDGE_SERVICE_BLOCKED/);f.res.status='zero';updateResponse(f);assert.throws(()=>verifyWorkflowEvidence(f.e,f.options),/RETRIEVAL_ERROR_NOT_CLEARED/)});
test('not-applicable requires reason in plan and delivery and cannot fake a retrieval',()=>{const f=fixture();f.e.applicability={state:'not-applicable',reason:'Pure arithmetic seam, no project knowledge applicability.'};f.options.applicabilityState='not-applicable';f.e.preset=null;f.e.retrieval=null;f.e.adoption.citations=[];f.e.adoption.zeroHitReason=null;f.e.adoption.plan=f.put('plan.md',f.e.applicability.reason);f.e.adoption.delivery=f.put('delivery.md',f.e.applicability.reason);assert.equal(verifyWorkflowEvidence(f.e,f.options).state,'not-applicable');f.e.applicability.reason='';assert.throws(()=>verifyWorkflowEvidence(f.e,f.options),/APPLICABILITY_REASON_REQUIRED/)});
for(const [name,mutate,code] of [
 ['untrusted applicability change',f=>f.options.applicabilityState='not-applicable','APPLICABILITY_EXPECTATION_MISMATCH'],
 ['caller preset mismatch',f=>f.options.presetId='other','PRESET_EXPECTATION_MISMATCH'],
 ['caller resolved config mismatch',f=>f.options.configDigest='b'.repeat(64),'PRESET_EXPECTATION_MISMATCH'],
 ['sample cannot pass production',f=>f.options.mode='production','WORKFLOW_MODE_MISMATCH'],
 ['missing preset',f=>f.e.preset=null,'PRESET_SCHEMA'],
 ['missing evidence file',f=>f.files.delete('wire-response.json'),'EVIDENCE_FILE_MISSING'],
 ['tampered raw response',f=>f.files.set('wire-response.json','altered'),'EVIDENCE_FILE_HASH_MISMATCH'],
 ['wrong task',f=>f.options.taskId='other','WORKFLOW_TASK_MISMATCH'],
 ['wrong collector',f=>f.options.collectorSha256='b'.repeat(64),'CAPTURE_COLLECTOR_NOT_PINNED'],
 ['response belongs to another request',f=>{f.res.requestId='other';updateResponse(f)},'RETRIEVAL_CORRELATION_MISMATCH'],
 ['different query',f=>{f.res.query='other';updateResponse(f)},'RETRIEVAL_CORRELATION_MISMATCH'],
 ['different capture mode',f=>{f.res.mode='production';updateResponse(f)},'CAPTURE_MODE_MISMATCH'],
 ['wrong wire association',f=>{f.res.wireSha256='f'.repeat(64);updateResponse(f)},'RETRIEVAL_BINDING_MISMATCH'],
 ['wrong preset',f=>{f.req.presetId='other';f.e.retrieval.request=f.put('request.json',f.req)},'RETRIEVAL_BINDING_MISMATCH'],
 ['wrong parsed config digest',f=>{f.config.model='other';f.e.preset.resolvedConfig=f.put('resolved.json',f.config)},'RESOLVED_CONFIG_DIGEST_MISMATCH'],
 ['wrong preset source',f=>f.e.preset.source=f.put('preset.json',{id:'other',version:'v3',summary:null,configDigest:f.e.preset.configDigest}),'PRESET_SOURCE_MISMATCH'],
 ['missing version and summary',f=>{f.e.preset.version=null;f.e.preset.summary=null},'PRESET_IDENTITY_REQUIRED'],
 ['fake model activation boolean',f=>f.e.runtime.model=true,'RUNTIME_ACTIVATION_UNPROVEN'],
 ['fake role activation flag',f=>f.e.runtime.verified=true,'RUNTIME_SCHEMA'],
 ['no adoption',f=>f.e.adoption.citations=[],'PLAN_AND_DELIVERY_ADOPTION_REQUIRED'],
 ['only plan adoption',f=>f.e.adoption.citations=f.e.adoption.citations.filter(c=>c.stage==='plan'),'PLAN_AND_DELIVERY_ADOPTION_REQUIRED'],
 ['wrong citation version',f=>f.e.adoption.citations[0].version='old','CITATION_IDENTITY_MISMATCH'],
 ['wrong citation hash',f=>f.e.adoption.citations[0].sha256='e'.repeat(64),'CITATION_IDENTITY_MISMATCH'],
 ['citation not in actual hit',f=>f.e.adoption.citations[0].documentId='unknown','CITATION_IDENTITY_MISMATCH'],
 ['quote absent from document',f=>{f.e.adoption.citations[0].quote='fabricated';f.e.adoption.plan=f.put('plan.md','fabricated')},'CITATION_QUOTE_NOT_LINKED'],
 ['quote absent from plan file',f=>f.e.adoption.plan=f.put('plan.md','unrelated plan'),'CITATION_QUOTE_NOT_LINKED'],
 ['hit with empty results',f=>{f.res.hits=[];updateResponse(f)},'HIT_STATUS_MISMATCH'],
 ['zero with fake adoption',f=>{f.res.status='zero';f.res.hits=[];updateResponse(f)},'ZERO_HIT_DISPOSITION_REQUIRED'],
 ['missing applicability reason',f=>f.e.applicability.reason='','APPLICABILITY_REASON_REQUIRED'],
 ])test(name,()=>{const f=fixture();mutate(f);assert.throws(()=>verifyWorkflowEvidence(f.e,f.options),new RegExp(code))});

test('start phase needs only a real plan and rejects invented future delivery adoption',()=>{const f=fixture();f.options.phase='start';f.e.adoption.delivery=null;f.e.adoption.citations=f.e.adoption.citations.filter(c=>c.stage==='plan');f.files.delete('delivery.md');const result=verifyWorkflowEvidence(f.e,f.options);assert.equal(result.state,'evidence-linked');assert.equal(result.phase,'start');});
test('delivery phase still rejects missing actual delivery bytes',()=>{const f=fixture();f.options.phase='delivery';f.e.adoption.delivery=null;assert.throws(()=>verifyWorkflowEvidence(f.e,f.options),/EVIDENCE_FILE_SCHEMA/);});
test('start phase cannot claim delivery-stage citations',()=>{const f=fixture();f.options.phase='start';f.e.adoption.delivery=null;assert.throws(()=>verifyWorkflowEvidence(f.e,f.options),/START_DELIVERY_REFERENCE_NOT_ALLOWED/);});
test('delivery result explicitly echoes phase and remains backward compatible for pure callers',()=>{const f=fixture();assert.equal(verifyWorkflowEvidence(f.e,f.options).phase,'delivery');f.options.phase='delivery';assert.equal(verifyWorkflowEvidence(f.e,f.options).phase,'delivery');});

test('start zero-hit and not-applicable paths require only the real plan disposition',()=>{const z=fixture('zero');z.options.phase='start';z.e.adoption.delivery=null;z.files.delete('delivery.md');assert.equal(verifyWorkflowEvidence(z.e,z.options).state,'zero-hit-recorded');const f=fixture();f.options.phase='start';f.options.applicabilityState='not-applicable';f.e.applicability={state:'not-applicable',reason:'Pure arithmetic seam requires no project knowledge.'};f.e.preset=null;f.e.retrieval=null;f.e.adoption.citations=[];f.e.adoption.zeroHitReason=null;f.e.adoption.delivery=null;f.e.adoption.plan=f.put('plan.md',f.e.applicability.reason);f.files.delete('delivery.md');assert.equal(verifyWorkflowEvidence(f.e,f.options).state,'not-applicable');});
