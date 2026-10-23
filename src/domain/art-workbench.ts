import { ART_CATEGORIES, type ArtCategory } from './project-art-spec'
import { isAiJobId } from './ai-jobs-read'
import { decodeAiReferenceUploadReceipt, type AiReferenceUploadReceipt, type PreparedLocalReference } from './ai-reference-upload'
import { AI_REFERENCE_UPLOAD_FENCE_KEY } from '../stores/ai-reference-upload'
export interface WorkbenchReference { relativePath:string; sha256:string; name:string }
export interface WorkbenchSpec { id:string; name:string; category:ArtCategory; version:number; sizePolicy:'fixed'|'per-asset'; width:number; height:number; destination:string; exportDirectory:string; imageOutput:'transparent-png'; style:string; references:WorkbenchReference[] }
export interface WorkbenchNeed { id:string; name:string; version:number; content:string; specId:string; specVersion:number; spec:WorkbenchSpec; size?:{width:number;height:number}; references:WorkbenchReference[]; jobId?:string }
export interface WorkbenchDocument { schemaVersion:'art-workbench-v1'; projectId:string; projectPath:string; version:number; norm:{hash:string;version:number}; projectReferences:WorkbenchReference[]; specs:WorkbenchSpec[]; needs:WorkbenchNeed[] }
export interface WorkbenchReceipt { projectId:string; projectPath:string; hash:string|null; document:WorkbenchDocument|null; capabilities:{generation:false;imageConditioning:false;referenceUpload:boolean;existingJobLink:boolean}; operation?:{operationId:string;bindingHash:string;state:'completed'} }
export interface WorkbenchOperation { projectId:string;projectPath:string;operationId:string;state:'pending'|'completed'|'rejected';receipt?:WorkbenchReceipt }
export const workbenchLabels:Record<ArtCategory,string>={ip:'人物 IP',equipment:'装备',skill:'技能',ui:'UI',icon:'图标'}
const sha=/^[a-f0-9]{64}$/
function assert(ok:unknown):asserts ok { if(!ok)throw Error('工作台数据未通过校验，请核对后重读。') }
function text(value:unknown,max=4096){assert(typeof value==='string'&&value.trim()&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value));return value}
export function validWorkbenchSize(width:number,height:number){return Number.isInteger(width)&&Number.isInteger(height)&&width>=1&&height>=1&&width<=4096&&height<=4096&&width*height<=16_000_000}
function references(value:WorkbenchReference[]){assert(Array.isArray(value)&&value.length<=4);for(const ref of value){assert(ref&&/^(?:art\/reference|assets)\/[a-zA-Z0-9_./-]+\.png$/.test(ref.relativePath)&&!ref.relativePath.split('/').includes('..')&&sha.test(ref.sha256));text(ref.name,240)}}
export function validateWorkbenchSpec(spec:WorkbenchSpec){assert(spec&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(spec.id));text(spec.name,128);assert(ART_CATEGORIES.includes(spec.category)&&Number.isSafeInteger(spec.version)&&spec.version>=1);assert(validWorkbenchSize(spec.width,spec.height));assert(spec.sizePolicy==='fixed'||spec.sizePolicy==='per-asset'&&spec.category==='ui');assert(/^assets(?:\/[A-Za-z0-9_-]+)*$/.test(spec.destination));assert(/^art\/final(?:\/[A-Za-z0-9_-]+)*$/.test(spec.exportDirectory));assert(spec.imageOutput==='transparent-png'&&typeof spec.style==='string'&&spec.style.length<=4096);references(spec.references);return spec}
export function validateWorkbenchDocument(doc:WorkbenchDocument,projectId:string,projectPath:string){assert(doc&&doc.schemaVersion==='art-workbench-v1'&&doc.projectId===projectId&&doc.projectPath===projectPath&&Number.isSafeInteger(doc.version)&&doc.version>=1&&sha.test(doc.norm?.hash)&&Number.isSafeInteger(doc.norm.version)&&doc.norm.version>=1);references(doc.projectReferences);assert(Array.isArray(doc.specs)&&doc.specs.length<=200&&Array.isArray(doc.needs)&&doc.needs.length<=1000);doc.specs.forEach(validateWorkbenchSpec);assert(new Set(doc.specs.map(s=>s.id)).size===doc.specs.length);assert(new Set(doc.needs.map(n=>n.id)).size===doc.needs.length);for(const need of doc.needs){assert(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(need.id)&&Number.isSafeInteger(need.version)&&need.version>=1);text(need.name,128);text(need.content);validateWorkbenchSpec(need.spec);assert(need.specId===need.spec.id&&need.specVersion===need.spec.version&&doc.specs.some(s=>s.id===need.specId));references(need.references);assert(need.spec.sizePolicy==='fixed'?need.size===undefined:!!need.size&&validWorkbenchSize(need.size.width,need.size.height));assert(need.jobId===undefined||isAiJobId(need.jobId))}return doc}
export function needsReview(doc:WorkbenchDocument,need:WorkbenchNeed,norm:{hash:string;version:number}|null){return !norm||doc.norm.hash!==norm.hash||doc.norm.version!==norm.version||doc.specs.find(s=>s.id===need.specId)?.version!==need.specVersion}
export function needOutputSize(need:WorkbenchNeed){return need.spec.sizePolicy==='per-asset'?need.size!:need.spec}
export function copyWorkbench<T>(value:T):T{return JSON.parse(JSON.stringify(value))}

export interface WorkbenchReferenceScope { projectId:string;projectPath:string;scope:'project'|'spec'|'need';targetId:string }
export interface WorkbenchReferenceUpload extends WorkbenchReferenceScope { name:string;originalSha256:string;mimeType:PreparedLocalReference['mimeType'];width:number;height:number;receipt:AiReferenceUploadReceipt|null }
export interface WorkbenchReferenceStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export const WORKBENCH_REFERENCE_LEDGER_KEY='companion.art-workbench.reference.pending.v1'
export function workbenchReferenceScopeKey(scope:WorkbenchReferenceScope){return JSON.stringify([scope.projectId,scope.projectPath,scope.scope,scope.targetId])}
export function readWorkbenchReferenceUploads(storage:WorkbenchReferenceStorage):WorkbenchReferenceUpload[]{
 const raw=storage.getItem(WORKBENCH_REFERENCE_LEDGER_KEY);if(raw===null)return [];assert(raw.length<=262144);const rows=JSON.parse(raw) as WorkbenchReferenceUpload[];assert(Array.isArray(rows)&&rows.length<=32)
 const ids=new Set<string>()
 for(const row of rows){assert(row&&Object.keys(row).length===10&&/^[a-f0-9]{16}$/.test(row.projectId)&&typeof row.projectPath==='string'&&row.projectPath.length>0&&row.projectPath.length<=4096&&['project','spec','need'].includes(row.scope)&&typeof row.targetId==='string'&&(row.scope==='project'?row.targetId===row.projectId:/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(row.targetId))&&sha.test(row.originalSha256)&&['image/png','image/jpeg','image/webp'].includes(row.mimeType)&&validWorkbenchSize(row.width,row.height));text(row.name,240);const id=workbenchReferenceScopeKey(row)+row.originalSha256;assert(!ids.has(id));ids.add(id);if(row.receipt)row.receipt=decodeAiReferenceUploadReceipt(row.receipt,{sha256:row.originalSha256,mimeType:row.mimeType,width:row.width,height:row.height});else assert(row.receipt===null)}
 return rows
}
/** Reuses the legacy upload's unknown-file fence; workbench scope metadata stays separate. */
export function legacyWorkbenchUploadUnknown(storage:WorkbenchReferenceStorage,projectId:string,originalSha256:string){
 const raw=storage.getItem(AI_REFERENCE_UPLOAD_FENCE_KEY);if(raw===null)return false;assert(raw.length<=262144);const rows=JSON.parse(raw) as {project:{id:string};originalSha256:string;receipt:unknown}[];assert(Array.isArray(rows)&&rows.length<=32);return rows.some(row=>{assert(row&&row.project&&typeof row.project.id==='string'&&typeof row.originalSha256==='string');return row.project.id===projectId&&row.originalSha256===originalSha256&&row.receipt===null})
}
export function rememberWorkbenchReferenceUpload(storage:WorkbenchReferenceStorage,record:WorkbenchReferenceUpload){
 const rows=readWorkbenchReferenceUploads(storage),id=workbenchReferenceScopeKey(record)+record.originalSha256,index=rows.findIndex(row=>workbenchReferenceScopeKey(row)+row.originalSha256===id)
 if(index<0)rows.push(copyWorkbench(record));else rows[index]=copyWorkbench(record)
 const raw=JSON.stringify(rows);assert(raw.length<=262144&&rows.length<=32);storage.setItem(WORKBENCH_REFERENCE_LEDGER_KEY,raw);assert(storage.getItem(WORKBENCH_REFERENCE_LEDGER_KEY)===raw);readWorkbenchReferenceUploads(storage)
}
export function releaseRejectedWorkbenchReferenceUpload(storage:WorkbenchReferenceStorage,record:WorkbenchReferenceUpload){
 const id=workbenchReferenceScopeKey(record)+record.originalSha256,rows=readWorkbenchReferenceUploads(storage).filter(row=>workbenchReferenceScopeKey(row)+row.originalSha256!==id||row.receipt!==null)
 const raw=JSON.stringify(rows);storage.setItem(WORKBENCH_REFERENCE_LEDGER_KEY,raw);assert(storage.getItem(WORKBENCH_REFERENCE_LEDGER_KEY)===raw)
}
