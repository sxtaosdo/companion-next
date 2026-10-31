// Pure local evidence integrity gate. No discovery, service requests, file IO or model activation.
import {createHash} from 'node:crypto';
export const workflowDigest = bytes => createHash('sha256').update(bytes).digest('hex');
export function workflowCanonical(value) {
 if(Array.isArray(value))return '['+value.map(workflowCanonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+workflowCanonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=v=>typeof v==='string'&&v.trim().length>0&&v.length<=16000&&!v.includes('\0');
function need(v,code){if(!v)throw new Error(code);}
function exact(v,keys,code){need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|'),code);}
function file(ref,files){
 exact(ref,['path','sha256'],'EVIDENCE_FILE_SCHEMA');need(text(ref.path)&&hash(ref.sha256),'EVIDENCE_FILE_IDENTITY');
 need(files instanceof Map&&files.has(ref.path),'EVIDENCE_FILE_MISSING');
 const value=files.get(ref.path);need(typeof value==='string'||Buffer.isBuffer(value)||value instanceof Uint8Array,'EVIDENCE_BYTES_REQUIRED');
 const b=Buffer.from(value);need(b.length>0&&b.length<=2*1024*1024,'EVIDENCE_FILE_SIZE');
 need(workflowDigest(b)===ref.sha256,'EVIDENCE_FILE_HASH_MISMATCH');return b.toString('utf8');
}
function json(ref,files){try{return JSON.parse(file(ref,files));}catch(e){if(e instanceof SyntaxError)throw Error('EVIDENCE_JSON_INVALID');throw e;}}
/** options are supplied by the preflight caller, never copied out of evidence.
 * collectorSha256 pins the reviewed capture/normalization wrapper, not an arbitrary verified flag.
 * This checks captured-byte consistency, not trusted timestamps, service authenticity or model causality. */
export function verifyWorkflowEvidence(e,options){
 exact(e,['schemaVersion','mode','taskId','applicability','runtime','preset','retrieval','adoption'],'WORKFLOW_SCHEMA');
 need(e.schemaVersion==='workflow-evidence-v1'&&text(e.taskId)&&e.taskId===options?.taskId,'WORKFLOW_TASK_MISMATCH');
 need(['isolated','production'].includes(options?.mode)&&e.mode===options.mode,'WORKFLOW_MODE_MISMATCH');
 const phase=options.phase??'delivery';need(['start','delivery'].includes(phase),'WORKFLOW_PHASE_INVALID');
 exact(e.runtime,['model','role','reason'],'RUNTIME_SCHEMA');
 need(e.runtime.model==='unverified'&&e.runtime.role==='unverified'&&text(e.runtime.reason),'RUNTIME_ACTIVATION_UNPROVEN');
 exact(e.applicability,['state','reason'],'APPLICABILITY_SCHEMA');
 need(['applicable','not-applicable'].includes(e.applicability.state)&&text(e.applicability.reason),'APPLICABILITY_REASON_REQUIRED');
 need(e.applicability.state===options.applicabilityState,'APPLICABILITY_EXPECTATION_MISMATCH');
 exact(e.adoption,['plan','delivery','citations','zeroHitReason'],'ADOPTION_SCHEMA');
 const plan=file(e.adoption.plan,options.files);
 const delivery=phase==='delivery'||e.adoption.delivery!==null?file(e.adoption.delivery,options.files):null;
 need(Array.isArray(e.adoption.citations)&&e.adoption.citations.length<=100,'CITATIONS_REQUIRED');
 const base={taskId:e.taskId,mode:e.mode,phase,runtime:{model:'unverified',role:'unverified'},coverage:'Captured file integrity, request/response identity and quoted adoption only; not proof of service authenticity, actual role/model activation or internal model causality.'};
 if(e.applicability.state==='not-applicable'){
  need(e.preset===null&&e.retrieval===null&&e.adoption.citations.length===0&&e.adoption.zeroHitReason===null,'NOT_APPLICABLE_MUST_NOT_FAKE_RETRIEVAL');
  need(plan.includes(e.applicability.reason)&&(phase==='start'||delivery.includes(e.applicability.reason)),'NOT_APPLICABLE_REASON_NOT_RECORDED');
  return {...base,state:'not-applicable',hitCount:0,adoptedDocuments:[]};
 }
 exact(e.preset,['id','version','summary','source','resolvedConfig','configDigest'],'PRESET_SCHEMA');
 need(text(e.preset.id)&&(text(e.preset.version)||text(e.preset.summary))&&hash(e.preset.configDigest),'PRESET_IDENTITY_REQUIRED');
 need(e.preset.id===options.presetId&&hash(options.configDigest)&&e.preset.configDigest===options.configDigest,'PRESET_EXPECTATION_MISMATCH');
 need(e.preset.version===null||text(e.preset.version),'PRESET_VERSION_INVALID');need(e.preset.summary===null||text(e.preset.summary),'PRESET_SUMMARY_INVALID');
 const preset=json(e.preset.source,options.files),config=json(e.preset.resolvedConfig,options.files);
 need(preset.id===e.preset.id&&preset.version===e.preset.version&&preset.summary===e.preset.summary&&preset.configDigest===e.preset.configDigest,'PRESET_SOURCE_MISMATCH');
 need(workflowDigest(workflowCanonical(config))===e.preset.configDigest,'RESOLVED_CONFIG_DIGEST_MISMATCH');
 exact(e.retrieval,['collectorSha256','request','response','wireRequest','wireResponse'],'RETRIEVAL_SCHEMA');
 need(hash(options.collectorSha256)&&e.retrieval.collectorSha256===options.collectorSha256,'CAPTURE_COLLECTOR_NOT_PINNED');
 // Wire bodies remain original and hash-sealed; normalized envelopes come from the pinned wrapper.
 file(e.retrieval.wireRequest,options.files);file(e.retrieval.wireResponse,options.files);
 const req=json(e.retrieval.request,options.files),res=json(e.retrieval.response,options.files);
 exact(req,['schemaVersion','mode','taskId','id','query','presetId','configDigest','wireSha256'],'REQUEST_SCHEMA');
 exact(res,['schemaVersion','mode','taskId','id','requestId','query','status','error','hits','wireSha256'],'RESPONSE_SCHEMA');
 need(req.schemaVersion==='workflow-kb-request-v1'&&res.schemaVersion==='workflow-kb-response-v1'&&req.mode===e.mode&&res.mode===e.mode,'CAPTURE_MODE_MISMATCH');
 need(req.taskId===e.taskId&&res.taskId===e.taskId&&text(req.id)&&text(res.id)&&res.requestId===req.id&&text(req.query)&&res.query===req.query,'RETRIEVAL_CORRELATION_MISMATCH');
 need(req.presetId===e.preset.id&&req.configDigest===e.preset.configDigest&&req.wireSha256===e.retrieval.wireRequest.sha256&&res.wireSha256===e.retrieval.wireResponse.sha256,'RETRIEVAL_BINDING_MISMATCH');
 need(['hit','zero','failed'].includes(res.status)&&Array.isArray(res.hits)&&res.hits.length<=100,'RETRIEVAL_STATUS_INVALID');
 if(res.status==='failed'){need(text(res.error)&&res.hits.length===0,'FAILED_RETRIEVAL_SHAPE');throw Error('KNOWLEDGE_SERVICE_BLOCKED');}
 need(res.error===null,'RETRIEVAL_ERROR_NOT_CLEARED');
 if(res.status==='zero'){
  need(res.hits.length===0&&e.adoption.citations.length===0&&text(e.adoption.zeroHitReason),'ZERO_HIT_DISPOSITION_REQUIRED');
  need(plan.includes(e.adoption.zeroHitReason)&&(phase==='start'||delivery.includes(e.adoption.zeroHitReason)),'ZERO_HIT_DISPOSITION_NOT_RECORDED');
  return {...base,state:'zero-hit-recorded',requestId:req.id,responseId:res.id,query:req.query,hitCount:0,adoptedDocuments:[]};
 }
 need(res.hits.length>0&&e.adoption.zeroHitReason===null,'HIT_STATUS_MISMATCH');
 const hits=new Map();
 for(const h of res.hits){
  exact(h,['documentId','version','sha256','content'],'HIT_SCHEMA');
  need(text(h.documentId)&&(h.version===null||text(h.version))&&hash(h.sha256)&&h.sha256===h.content?.sha256&&!hits.has(h.documentId),'HIT_IDENTITY_INVALID');
  hits.set(h.documentId,{...h,text:file(h.content,options.files)});
 }
 const stages=new Set(),adopted=new Set();
 for(const c of e.adoption.citations){
  exact(c,['stage','documentId','version','sha256','quote'],'CITATION_SCHEMA');
  if(phase==='start'&&c.stage==='delivery')throw Error('START_DELIVERY_REFERENCE_NOT_ALLOWED');
  const hit=hits.get(c.documentId);need(['plan','delivery'].includes(c.stage)&&hit&&c.version===hit.version&&c.sha256===hit.sha256&&text(c.quote),'CITATION_IDENTITY_MISMATCH');
  need(hit.text.includes(c.quote)&&(c.stage==='plan'?plan:delivery).includes(c.quote),'CITATION_QUOTE_NOT_LINKED');stages.add(c.stage);adopted.add(c.documentId);
 }
 need(stages.has('plan')&&(phase==='start'||stages.has('delivery')),'PLAN_AND_DELIVERY_ADOPTION_REQUIRED');
 return {...base,state:'evidence-linked',requestId:req.id,responseId:res.id,query:req.query,presetId:e.preset.id,configDigest:e.preset.configDigest,hitCount:res.hits.length,adoptedDocuments:[...adopted]};
}
