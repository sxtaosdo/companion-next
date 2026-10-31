// Isolated fake wire bodies only. Never a real service capture.
import {workflowDigest,workflowCanonical} from '../scripts/workflow-evidence-gate.mjs';
const collector='a'.repeat(64);
export function workflowSample(status='hit'){
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

export function materializeWorkflowSample(directory, io) {
 const f=workflowSample(), files=[];
 for(const [key,bytes] of f.files){const absolutePath=io.join(directory,key);io.writeFileSync(absolutePath,bytes);files.push({key,absolutePath,sha256:workflowDigest(bytes)});}
 const collectorPath=io.join(directory,'isolated-collector.mjs');io.writeFileSync(collectorPath,'// ISOLATED fixture; no real request is made.\n');
 const collectorSha256=workflowDigest(io.readFileSync(collectorPath));f.e.retrieval.collectorSha256=collectorSha256;
 const policy={schemaVersion:'workflow-policy-v1',taskId:f.options.taskId,mode:'isolated',phase:'delivery',applicabilityState:'applicable',presetId:f.options.presetId,configDigest:f.options.configDigest,collectorSha256,collectorPath,authority:{kind:'reviewed-caller-policy',reviewer:'isolated test author',reviewReference:'SYNTHETIC FIXTURE, NOT REAL KNOWLEDGE ACCEPTANCE'},files};
 const evidencePath=io.join(directory,'workflow-evidence.json'),policyPath=io.join(directory,'workflow-policy.json');
 io.writeFileSync(evidencePath,JSON.stringify(f.e,null,2));io.writeFileSync(policyPath,JSON.stringify(policy,null,2));
 return {evidencePath,policyPath,evidence:f.e,policy};
}
