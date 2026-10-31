import {antToolbarScope,antToolbarDirectorySpec,antToolbarReference} from './ant-toolbar-scope'
import { ART_CATEGORIES, type ArtCategory } from './project-art-spec'
import { isAiJobId } from './ai-jobs-read'
import { decodeAiReferenceUploadReceipt, type AiReferenceUploadReceipt, type PreparedLocalReference } from './ai-reference-upload'
import { AI_REFERENCE_UPLOAD_FENCE_KEY } from '../stores/ai-reference-upload'
import { artCanonical,artPath } from './project-art-pending'
import {resourceDomainSuffix,validResourceDomainId,type ResourceDomainContext} from './art-resource-domains'
export type WorkbenchReferenceMode='evidence-only'|'image-conditioning'
export const WORKBENCH_IMAGE_CONDITIONING_PROJECT='16ad921aa0fb06d6'
export interface WorkbenchReference { relativePath:string; sha256:string; name:string }
export interface WorkbenchSpec { id:string; name:string; category:ArtCategory; version:number; sizePolicy:'fixed'|'per-asset'; width:number; height:number; destination:string|null; exportDirectory:string|null; imageOutput:'transparent-png'; style:string; references:WorkbenchReference[] }
export interface WorkbenchNeed { id:string; name:string; version:number; content:string; specId:string; specVersion:number; spec:WorkbenchSpec; size?:{width:number;height:number}; references:WorkbenchReference[]; jobId?:string }
export interface WorkbenchDocument extends ResourceDomainContext { schemaVersion:'art-workbench-v1'; projectId:string; projectPath:string; version:number; projectSettingsHash?:string; norm:{hash:string;version:number}; projectReferences:WorkbenchReference[]; specs:WorkbenchSpec[]; needs:WorkbenchNeed[] }
export interface WorkbenchReceipt extends ResourceDomainContext { projectId:string; projectPath:string; hash:string|null; sharedAccess?:{ownerScope:'shared';resourceDomainId:'shared';normRoute:string;workbenchRoute:string;normHash:string|null;workbenchHash:string|null}; projectSettingsHash?:string; binding?:null; blockedReason?:string; document:WorkbenchDocument|null; capabilities:{generation:false;imageConditioning:false;referenceUpload:boolean;existingJobLink:boolean;preparedTasks?:{categories:readonly ['icon'];maxBatch:1;imageConditioning:boolean;referenceModes?:readonly WorkbenchReferenceMode[]}}; operation?:{operationId:string;bindingHash:string;state:'completed'} }
export interface WorkbenchOperation extends ResourceDomainContext { projectId:string;projectPath:string;operationId:string;state:'pending'|'completed'|'rejected';receipt?:WorkbenchReceipt }
export const workbenchLabels:Record<ArtCategory,string>={ip:'人物 IP',equipment:'装备',skill:'技能',ui:'UI',icon:'图标'}
const sha=/^[a-f0-9]{64}$/
function assert(ok:unknown):asserts ok { if(!ok)throw Error('工作台数据未通过校验，请核对后重读。') }
function text(value:unknown,max=4096){assert(typeof value==='string'&&value.trim()&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value));return value}
export function validWorkbenchSize(width:number,height:number){return Number.isInteger(width)&&Number.isInteger(height)&&width>=1&&height>=1&&width<=4096&&height<=4096&&width*height<=16_000_000}
function references(value:WorkbenchReference[]){assert(Array.isArray(value)&&value.length<=4);for(const ref of value){assert(ref&&/^(?:art\/reference|assets)\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp)$/i.test(ref.relativePath)&&!ref.relativePath.split('/').includes('..')&&sha.test(ref.sha256));text(ref.name,240)}}
export function validateWorkbenchSpec(spec:WorkbenchSpec){assert(spec&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(spec.id));text(spec.name,128);assert(ART_CATEGORIES.includes(spec.category)&&Number.isSafeInteger(spec.version)&&spec.version>=1);assert(validWorkbenchSize(spec.width,spec.height));assert(spec.sizePolicy==='fixed'||spec.sizePolicy==='per-asset'&&spec.category==='ui');assert(spec.destination===null||/^assets(?:\/[A-Za-z0-9_-]+)*$/.test(spec.destination));assert(spec.exportDirectory===null||/^art\/final(?:\/[A-Za-z0-9_-]+)*$/.test(spec.exportDirectory));assert(spec.imageOutput==='transparent-png'&&typeof spec.style==='string'&&spec.style.length<=4096);references(spec.references);return spec}
export function validateWorkbenchDocument(doc:WorkbenchDocument,projectId:string,projectPath:string,resourceDomainId?:string){assert(doc.resourceDomainId===resourceDomainId&&(resourceDomainId===undefined||validResourceDomainId(resourceDomainId)&&sha.test(doc.projectSettingsHash??'')));assert(doc&&doc.schemaVersion==='art-workbench-v1'&&doc.projectId===projectId&&doc.projectPath===projectPath&&Number.isSafeInteger(doc.version)&&doc.version>=1&&sha.test(doc.norm?.hash)&&Number.isSafeInteger(doc.norm.version)&&doc.norm.version>=1);references(doc.projectReferences);assert(Array.isArray(doc.specs)&&doc.specs.length<=200&&Array.isArray(doc.needs)&&doc.needs.length<=1000);doc.specs.forEach(validateWorkbenchSpec);assert(doc.specs.every(spec=>resourceDomainId===undefined?spec.destination!==null&&spec.exportDirectory!==null:(spec.destination===null&&spec.exportDirectory===null||antToolbarScope(projectId,resourceDomainId)&&antToolbarDirectorySpec(spec))));assert(new Set(doc.specs.map(s=>s.id)).size===doc.specs.length);assert(new Set(doc.needs.map(n=>n.id)).size===doc.needs.length);for(const need of doc.needs){assert(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(need.id)&&Number.isSafeInteger(need.version)&&need.version>=1);text(need.name,128);text(need.content);validateWorkbenchSpec(need.spec);assert(need.specId===need.spec.id&&need.specVersion===need.spec.version&&doc.specs.some(s=>s.id===need.specId));references(need.references);if(antToolbarScope(projectId,resourceDomainId)){assert(antToolbarScope(projectId,resourceDomainId,need.id));assert(!doc.projectReferences.length&&!need.spec.references.length&&need.references.length<=1&&need.references.every(ref=>antToolbarReference(need.id,ref)));assert(need.spec.destination===null&&need.spec.exportDirectory===null||antToolbarDirectorySpec(need.spec))}assert(need.spec.sizePolicy==='fixed'?need.size===undefined:!!need.size&&validWorkbenchSize(need.size.width,need.size.height));assert(need.jobId===undefined||isAiJobId(need.jobId))}return doc}
export function needsReview(doc:WorkbenchDocument,need:WorkbenchNeed,norm:{hash:string;version:number}|null){return !norm||doc.norm.hash!==norm.hash||doc.norm.version!==norm.version||doc.specs.find(s=>s.id===need.specId)?.version!==need.specVersion}
export function needOutputSize(need:WorkbenchNeed){return need.spec.sizePolicy==='per-asset'?need.size!:need.spec}
export function copyWorkbench<T>(value:T):T{return JSON.parse(JSON.stringify(value))}

export interface WorkbenchReferenceScope extends ResourceDomainContext { projectId:string;projectPath:string;scope:'project'|'spec'|'need';targetId:string }
export interface WorkbenchReferenceUpload extends WorkbenchReferenceScope { name:string;originalSha256:string;mimeType:PreparedLocalReference['mimeType'];width:number;height:number;receipt:AiReferenceUploadReceipt|null }
export interface WorkbenchReferenceStorage {getItem(key:string):string|null;setItem(key:string,value:string):void}
export const WORKBENCH_REFERENCE_LEDGER_KEY='companion.art-workbench.reference.pending.v1'
export function workbenchReferenceScopeKey(scope:WorkbenchReferenceScope){return JSON.stringify([scope.projectId,scope.projectPath,scope.resourceDomainId??null,scope.scope,scope.targetId])}
export function readWorkbenchReferenceUploads(storage:WorkbenchReferenceStorage):WorkbenchReferenceUpload[]{
 const raw=storage.getItem(WORKBENCH_REFERENCE_LEDGER_KEY);if(raw===null)return [];assert(raw.length<=262144);const rows=JSON.parse(raw) as WorkbenchReferenceUpload[];assert(Array.isArray(rows)&&rows.length<=32)
 const ids=new Set<string>()
 for(const row of rows){assert(row&&Object.keys(row).length===(row.resourceDomainId===undefined?10:11)&&(row.resourceDomainId===undefined||validResourceDomainId(row.resourceDomainId))&&/^[a-f0-9]{16}$/.test(row.projectId)&&typeof row.projectPath==='string'&&row.projectPath.length>0&&row.projectPath.length<=4096&&['project','spec','need'].includes(row.scope)&&typeof row.targetId==='string'&&(row.scope==='project'?row.targetId===row.projectId:/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(row.targetId))&&sha.test(row.originalSha256)&&['image/png','image/jpeg','image/webp'].includes(row.mimeType)&&validWorkbenchSize(row.width,row.height));text(row.name,240);const id=workbenchReferenceScopeKey(row)+row.originalSha256;assert(!ids.has(id));ids.add(id);if(row.receipt)row.receipt=decodeAiReferenceUploadReceipt(row.receipt,{sha256:row.originalSha256,mimeType:row.mimeType,width:row.width,height:row.height});else assert(row.receipt===null)}
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

/** Workbench schema adapter for the existing art pending-write protocol. No credentials or image bytes. */
export interface PendingWorkbenchWrite extends ResourceDomainContext {
 schemaVersion:'art-workbench-pending-v1';endpoint:string;projectId:string;projectPath:string
 input:{operationId:string;expectedHash:string|null;approved:true;document:WorkbenchDocument;resourceDomainId?:string;expectedProjectSettingsHash?:string}
 bindingHash:string;baseVersion:number;base:WorkbenchDocument|null;draft:WorkbenchDocument
}
export interface WorkbenchPendingStorage extends WorkbenchReferenceStorage {removeItem(key:string):void;readonly length?:number;key?(index:number):string|null}
export function workbenchEndpoint(endpoint:string){const url=new URL(endpoint);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('无效工作台来源');return url.origin}
export function workbenchPendingKey(endpoint:string,projectId:string,projectPath:string,resourceDomainId?:string){return 'art-workbench-pending-v1:'+encodeURIComponent(workbenchEndpoint(endpoint))+':'+projectId+':'+encodeURIComponent(artPath(projectPath))+resourceDomainSuffix(resourceDomainId)}
export function readPendingWorkbenchWrite(storage:WorkbenchPendingStorage,endpoint:string,projectId:string,projectPath:string,resourceDomainId?:string):PendingWorkbenchWrite|null{
 const raw=storage.getItem(workbenchPendingKey(endpoint,projectId,projectPath,resourceDomainId));if(raw===null)return null;assert(raw.length<=1024*1024);const record=JSON.parse(raw) as PendingWorkbenchWrite
 assert(record&&record.input?.resourceDomainId===resourceDomainId&&(resourceDomainId===undefined||record.input.expectedProjectSettingsHash===record.input.document.projectSettingsHash)&&record.schemaVersion==='art-workbench-pending-v1'&&record.endpoint===workbenchEndpoint(endpoint)&&record.projectId===projectId&&record.resourceDomainId===resourceDomainId&&artPath(record.projectPath)===artPath(projectPath)&&/^art-save-[a-f0-9]{32}$/.test(record.input?.operationId)&&record.input.approved===true&&(record.input.expectedHash===null||sha.test(record.input.expectedHash))&&sha.test(record.bindingHash)&&Number.isSafeInteger(record.baseVersion)&&record.baseVersion>=0)
 validateWorkbenchDocument(record.input.document,projectId,record.projectPath,resourceDomainId);validateWorkbenchDocument(record.draft,projectId,record.projectPath,resourceDomainId)
 if(record.base){validateWorkbenchDocument(record.base,projectId,record.projectPath,resourceDomainId);assert(record.base.version===record.baseVersion&&record.input.expectedHash!==null)}else assert(record.baseVersion===0&&record.input.expectedHash===null)
 return record
}
export async function workbenchPendingBindingHash(record:Pick<PendingWorkbenchWrite,'endpoint'|'projectId'|'projectPath'|'resourceDomainId'|'input'|'baseVersion'|'base'>){
 const data=artCanonical({endpoint:record.endpoint,projectId:record.projectId,projectPath:artPath(record.projectPath),...(record.resourceDomainId?{resourceDomainId:record.resourceDomainId}:{}),input:record.input,baseVersion:record.baseVersion,base:record.base})
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),value=>value.toString(16).padStart(2,'0')).join('')
}
export function persistPendingWorkbenchWrite(storage:WorkbenchPendingStorage,record:PendingWorkbenchWrite){
 const key=workbenchPendingKey(record.endpoint,record.projectId,record.projectPath,record.resourceDomainId),current=readPendingWorkbenchWrite(storage,record.endpoint,record.projectId,record.projectPath,record.resourceDomainId)
 assert(!current||current.input.operationId===record.input.operationId&&current.bindingHash===record.bindingHash)
 const raw=JSON.stringify(record);assert(raw.length<=1024*1024);storage.setItem(key,raw);assert(storage.getItem(key)===raw);readPendingWorkbenchWrite(storage,record.endpoint,record.projectId,record.projectPath,record.resourceDomainId)
}
export function clearPendingWorkbenchWrite(storage:WorkbenchPendingStorage,record:PendingWorkbenchWrite){
 const current=readPendingWorkbenchWrite(storage,record.endpoint,record.projectId,record.projectPath,record.resourceDomainId);assert(current&&current.input.operationId===record.input.operationId&&current.bindingHash===record.bindingHash)
 const key=workbenchPendingKey(record.endpoint,record.projectId,record.projectPath,record.resourceDomainId);storage.removeItem(key);assert(storage.getItem(key)===null)
}

export interface WorkbenchTaskReceipt extends ResourceDomainContext {projectId:string;projectPath:string;operationId:string;needId:string|null;runId:string|null;state:'created'|'already-linked'|'rejected'|'unknown';code?:string;snapshotHash:string|null;jobId?:string;workbench?:WorkbenchReceipt;observation?:{jobId:string;state:string;verified:true}}
export interface WorkbenchTaskEntry {needId:string;name:string;operationId:string;referenceMode?:WorkbenchReferenceMode;state:'not-started'|'submitting'|WorkbenchTaskReceipt['state'];expectedHash?:string;before?:WorkbenchDocument;jobId?:string;runId?:string|null;snapshotHash?:string|null;code?:string}
export interface WorkbenchTaskLedger extends ResourceDomainContext {schemaVersion:'art-workbench-tasks-v1';endpoint:string;projectId:string;projectPath:string;entries:WorkbenchTaskEntry[]}
export function workbenchTasksKey(endpoint:string,projectId:string,projectPath:string,resourceDomainId?:string){return 'art-workbench-tasks-v1:'+encodeURIComponent(workbenchEndpoint(endpoint))+':'+projectId+':'+encodeURIComponent(artPath(projectPath))+resourceDomainSuffix(resourceDomainId)}
function validateWorkbenchTaskLedger(ledger:WorkbenchTaskLedger,endpoint:string,projectId:string,projectPath:string,resourceDomainId?:string):WorkbenchTaskLedger{
 assert(ledger?.schemaVersion==='art-workbench-tasks-v1'&&ledger.endpoint===workbenchEndpoint(endpoint)&&ledger.projectId===projectId&&ledger.resourceDomainId===resourceDomainId&&artPath(ledger.projectPath)===artPath(projectPath)&&Array.isArray(ledger.entries)&&ledger.entries.length<=100)
 const ops=new Set<string>();for(const entry of ledger.entries){assert(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(entry.needId)&&/^art-save-[a-f0-9]{32}$/.test(entry.operationId)&&!ops.has(entry.operationId)&&['not-started','submitting','created','already-linked','rejected','unknown'].includes(entry.state));text(entry.name,128);assert(entry.referenceMode===undefined||['evidence-only','image-conditioning'].includes(entry.referenceMode));ops.add(entry.operationId);if(entry.expectedHash!==undefined)assert(sha.test(entry.expectedHash));if(entry.before)validateWorkbenchDocument(entry.before,projectId,projectPath,resourceDomainId);if(entry.state==='submitting'||entry.state==='unknown')assert(entry.before&&entry.expectedHash);if(entry.jobId!==undefined)assert(isAiJobId(entry.jobId));if(entry.runId!==undefined&&entry.runId!==null)assert(isAiJobId(entry.runId));if(entry.snapshotHash!==undefined&&entry.snapshotHash!==null)assert(sha.test(entry.snapshotHash));if(entry.code!==undefined)assert(/^[A-Z][A-Z0-9_]{1,79}$/.test(entry.code))}
 return ledger
}
function mergeWorkbenchTaskEntry(previous:WorkbenchTaskEntry,next:WorkbenchTaskEntry):WorkbenchTaskEntry{
 assert(previous.operationId===next.operationId&&previous.needId===next.needId&&(previous.referenceMode??'evidence-only')===(next.referenceMode??'evidence-only'))
 if(previous.expectedHash&&next.expectedHash)assert(previous.expectedHash===next.expectedHash)
 if(previous.before&&next.before)assert(artCanonical(previous.before)===artCanonical(next.before))
 const terminal=(row:WorkbenchTaskEntry)=>['created','already-linked','rejected'].includes(row.state)
 if(terminal(previous)){if(terminal(next))assert(previous.state===next.state&&previous.jobId===next.jobId);return copyWorkbench(previous)}
 if(terminal(next))return copyWorkbench(next)
 if(previous.state==='unknown'&&next.state==='submitting')return copyWorkbench(previous)
 if(previous.state==='not-started')return copyWorkbench(next)
 if(next.state==='not-started')return copyWorkbench(previous)
 return {...copyWorkbench(previous),...copyWorkbench(next),state:previous.state==='unknown'||next.state==='unknown'?'unknown':'submitting',before:copyWorkbench(previous.before??next.before),expectedHash:previous.expectedHash??next.expectedHash,runId:next.runId??previous.runId,snapshotHash:next.snapshotHash??previous.snapshotHash}
}
export function readWorkbenchTaskLedger(storage:WorkbenchPendingStorage,endpoint:string,projectId:string,projectPath:string,resourceDomainId?:string):WorkbenchTaskLedger|null{
 const key=workbenchTasksKey(endpoint,projectId,projectPath,resourceDomainId),raw=storage.getItem(key)
 let ledger:WorkbenchTaskLedger|null=null
 if(raw!==null){assert(raw.length<=1024*1024);ledger=validateWorkbenchTaskLedger(JSON.parse(raw),endpoint,projectId,projectPath,resourceDomainId)}
 const entries=new Map<string,WorkbenchTaskEntry>(ledger?.entries.map(row=>[row.operationId,row])??[])
 // Independent operation anchors survive a last-writer-wins race on the existing summary key.
 if(storage.key&&typeof storage.length==='number'){
  const prefix=key+':operation:',keys:string[]=[]
  for(let index=0;index<storage.length;index++){const item=storage.key(index);if(item?.startsWith(prefix))keys.push(item)}
  assert(keys.length<=100)
  for(const anchorKey of keys){const value=storage.getItem(anchorKey);if(value===null)continue;assert(value.length<=1024*1024);const anchor=validateWorkbenchTaskLedger(JSON.parse(value),endpoint,projectId,projectPath,resourceDomainId);assert(anchor.entries.length===1);const entry=anchor.entries[0]!;assert(anchorKey===prefix+entry.operationId&&entry.state!=='not-started'&&entry.before&&entry.expectedHash);const previous=entries.get(entry.operationId);entries.set(entry.operationId,previous?mergeWorkbenchTaskEntry(previous,entry):entry)}
 }
 if(!ledger&&!entries.size)return null
 ledger={schemaVersion:'art-workbench-tasks-v1',endpoint:workbenchEndpoint(endpoint),projectId,projectPath,...(resourceDomainId?{resourceDomainId}:{}),entries:[...entries.values()]}
 return validateWorkbenchTaskLedger(ledger,endpoint,projectId,projectPath,resourceDomainId)
}
export function persistWorkbenchTaskLedger(storage:WorkbenchPendingStorage,ledger:WorkbenchTaskLedger){
 // Validate before every mutation, including fallback UNKNOWN writes after a storage fault.
 const candidate=validateWorkbenchTaskLedger(JSON.parse(JSON.stringify(ledger)),ledger.endpoint,ledger.projectId,ledger.projectPath,ledger.resourceDomainId)
 assert(storage.key&&typeof storage.length==='number')
 const current=readWorkbenchTaskLedger(storage,ledger.endpoint,ledger.projectId,ledger.projectPath,ledger.resourceDomainId),proposed=new Map<string,WorkbenchTaskEntry>(candidate.entries.map(row=>[row.operationId,row]))
 for(const existing of current?.entries??[]){const next=proposed.get(existing.operationId)
  if(existing.state==='unknown'||existing.state==='submitting'){assert(next);assert(!(existing.state==='unknown'&&next.state==='submitting'))}
  if(next)proposed.set(existing.operationId,mergeWorkbenchTaskEntry(existing,next));else proposed.set(existing.operationId,copyWorkbench(existing))
 }
 const merged={...candidate,entries:[...proposed.values()]};validateWorkbenchTaskLedger(merged,ledger.endpoint,ledger.projectId,ledger.projectPath,ledger.resourceDomainId)
 const raw=JSON.stringify(merged);assert(raw.length<=1024*1024);const key=workbenchTasksKey(ledger.endpoint,ledger.projectId,ledger.projectPath,ledger.resourceDomainId)
 storage.setItem(key,raw);assert(storage.getItem(key)===raw)
 for(const entry of merged.entries){if(!entry.before||!entry.expectedHash)continue
  const anchor={...merged,entries:[entry]},value=JSON.stringify(anchor),anchorKey=key+':operation:'+entry.operationId
  if(storage.getItem(anchorKey)!==value){storage.setItem(anchorKey,value);assert(storage.getItem(anchorKey)===value)}
 }
 readWorkbenchTaskLedger(storage,ledger.endpoint,ledger.projectId,ledger.projectPath,ledger.resourceDomainId)
}

/** Ordered, deduplicated saved references. File bytes/readiness remain backend checks. */
export function workbenchConditioningReferences(document:WorkbenchDocument,need:WorkbenchNeed):WorkbenchReference[]{
 const found=new Set<string>();return [...document.projectReferences,...need.spec.references,...need.references].filter(ref=>{const key=ref.relativePath+':'+ref.sha256;if(found.has(key))return false;found.add(key);return true})
}
export function workbenchConditioningIssue(document:WorkbenchDocument,need:WorkbenchNeed,capabilities:WorkbenchReceipt['capabilities']|null):string|null {
 if(document.projectId!==WORKBENCH_IMAGE_CONDITIONING_PROJECT&&!antToolbarScope(document.projectId,document.resourceDomainId,need.id))return 'ART_QWEN_PROJECT_UNSUPPORTED'
 const tasks=capabilities?.preparedTasks;if(!tasks?.imageConditioning||!tasks.referenceModes?.includes('image-conditioning'))return 'ART_QWEN_CAPABILITY_UNAVAILABLE'
 const refs=workbenchConditioningReferences(document,need)
 if(document.resourceDomainId&&(!antToolbarDirectorySpec(need.spec)||refs.length!==1||!antToolbarReference(need.id,refs[0]!)))return 'ART_QWEN_PROJECT_UNSUPPORTED'
 if(!refs.length)return 'ART_QWEN_REFERENCE_REQUIRED'
 if(refs.length>3)return 'ART_QWEN_REFERENCE_LIMIT'
 if(refs.some(ref=>!/\.(?:png|jpe?g)$/i.test(ref.relativePath)))return 'ART_QWEN_REFERENCE_MEDIA_UNSUPPORTED'
 return null
}
