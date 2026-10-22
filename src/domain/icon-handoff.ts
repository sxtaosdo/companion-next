import { aiResourceSnapshotOutput } from './ai-resource-snapshot'
import { decodeAiJobSnapshot, isAiCandidateId, isAiJobId, type AiJobSnapshot } from './ai-jobs-read'
import { isAiProjectId } from './ai-resource-read'
import { aiJobActionCanonical } from './ai-job-actions'
export type IconHandoff={schemaVersion:"companion-icon-handoff-v1";projectId:string;sourceRevision:string;purpose:string;
 job:{jobId:string;revision:number;candidateId:string;requestHash:string;configHash:string|null;configVersion:number|null;state:string};
 asset:{candidateId:string;assetId:string;motherSha256:string;kind:"mother"|"variant";relativePath:string|null;sha256:string;width:number;height:number;sha256Verified:true;receiptSha256:string|null;savedCreatorDestination:string};
 target:{destinationUrl:string|null;documentUrl:string|null;nodeKey:string|null;component:"cc.Sprite";property:"spriteFrame"};
 resource:Record<string,unknown>;referenceProvenance:unknown[];evidence:Record<string,unknown>;
 delivery:{mode:"export_or_copy";state:"prepared";dispatchId:null};receiver:Record<string,unknown>};
const sha=(v:unknown):v is string=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const path=(v:unknown):v is string=>typeof v==="string"&&v.length<=240&&!v.includes("\\")&&!v.includes(":")&&!v.startsWith("/")&&v.split("/").every(p=>/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(p)&&p!==".."&&!p.endsWith(".")&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p));
const url=(v:unknown,extension:RegExp)=>v===null||typeof v==="string"&&v.startsWith("db://assets/")&&path(v.slice(5))&&extension.test(v);
const size=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>0&&Number(v)<=4096;
const object=(v:unknown):v is Record<string,any>=>Boolean(v&&typeof v==="object"&&!Array.isArray(v));
const keys=(v:Record<string,any>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k))&&allowed.every(k=>Object.hasOwn(v,k));
function target(v:any):boolean{return object(v)&&url(v.destinationUrl,/\.png$/i)&&url(v.documentUrl,/\.(scene|prefab)$/i)
 &&(v.nodeKey===null||typeof v.nodeKey==="string"&&v.nodeKey.length>0&&v.nodeKey.length<=300&&!/[\u0000-\u001f\u007f]/.test(v.nodeKey)&&v.documentUrl!==null);}
export const iconHandoffInputSchema={parse(v:any){
 if(!object(v)||typeof v.purpose!=="string"||!v.purpose.trim()||v.purpose.trim().length>400||!target(v.target)
  ||!object(v.artifact)||!["mother","variant"].includes(v.artifact.kind)
  ||v.artifact.kind==="variant"&&(!size(v.artifact.width)||!size(v.artifact.height)||v.artifact.width*v.artifact.height>16_000_000))throw Error("Invalid handoff input");
 return {...v,purpose:v.purpose.trim()} as {jobId:string;revision:number;candidateId:string;purpose:string;target:IconHandoff["target"];artifact:{kind:"mother"}|{kind:"variant";width:number;height:number}};
}};
/** Browser gate for the bounded public projection; the backend owns authoritative strict schemas. */
export const iconHandoffSchema={parse(value:unknown):IconHandoff{
 const v:any=value;
 if(!object(v)||JSON.stringify(v).length>32*1024||!keys(v,["schemaVersion","projectId","sourceRevision","purpose","job","asset","resource","referenceProvenance","target","evidence","delivery","receiver"])
  ||v.schemaVersion!=="companion-icon-handoff-v1"||!/^([a-f0-9]{16})$/.test(v.projectId)||!/^([a-f0-9]{40})$/.test(v.sourceRevision)
  ||typeof v.purpose!=="string"||v.purpose.length<1||v.purpose.length>400||!object(v.job)||!keys(v.job,["jobId","revision","candidateId","requestHash","configHash","configVersion","state"])
  ||!/^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/.test(v.job.jobId)||!Number.isInteger(v.job.revision)||v.job.revision<1
  ||!sha(v.job.requestHash)||v.job.configHash!==null&&!sha(v.job.configHash)||v.job.configVersion!==null&&(!Number.isInteger(v.job.configVersion)||v.job.configVersion<1)
  ||typeof v.job.state!=="string"||v.job.state.length>80||!object(v.asset)
  ||!keys(v.asset,["candidateId","assetId","motherSha256","kind","relativePath","sha256","width","height","sha256Verified","receiptSha256","savedCreatorDestination"])
  ||!/^CANDIDATE-[a-z0-9-]+-1$/.test(v.asset.candidateId)||v.asset.candidateId!==v.job.candidateId||!sha(v.asset.motherSha256)||!sha(v.asset.sha256)
  ||!/^([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/.test(v.asset.assetId)||!size(v.asset.width)||!size(v.asset.height)||v.asset.width*v.asset.height>16_000_000||v.asset.sha256Verified!==true
  ||!path(v.asset.savedCreatorDestination)||!/^assets\/.+\.png$/i.test(v.asset.savedCreatorDestination)||!target(v.target)||v.target.component!=="cc.Sprite"||v.target.property!=="spriteFrame"
  ||!keys(v.target,["destinationUrl","documentUrl","nodeKey","component","property"])
  ||v.asset.kind==="mother"&&(v.asset.width!==1024||v.asset.height!==1024||v.asset.relativePath!==null||v.asset.receiptSha256!==null||v.asset.sha256!==v.asset.motherSha256)
  ||v.asset.kind==="variant"&&(!path(v.asset.relativePath)||!v.asset.relativePath.startsWith("art/final/")||!sha(v.asset.receiptSha256)||v.job.configHash===null)
  ||!["mother","variant"].includes(v.asset.kind)||!object(v.delivery)||!keys(v.delivery,["mode","state","dispatchId"])||v.delivery.mode!=="export_or_copy"||v.delivery.state!=="prepared"||v.delivery.dispatchId!==null
  ||!object(v.evidence)||!keys(v.evidence,["imported","bound","runtimeVerified","observedImport","manualAttestation"]))throw Error("Handoff invalid");
 for(const name of ["imported","bound"]){const p=v.evidence[name];if(!object(p)||!keys(p,["state","receiptSha256","assetUuid","spriteFrameUuid"])||p.state!=="not_proven"||p.receiptSha256!==null||p.assetUuid!==null||p.spriteFrameUuid!==null)throw Error("Proof invalid");}
 const runtime=v.evidence.runtimeVerified;if(!object(runtime)||!keys(runtime,["state","receiptSha256","designResolutionVerified"])||runtime.state!=="not_run"||runtime.receiptSha256!==null||runtime.designResolutionVerified!==false)throw Error("Runtime invalid");
 const manual=v.evidence.manualAttestation;if(manual!==null&&(!object(manual)||!keys(manual,["state","receiptSha256","scope"])||manual.state!=="manual_attested"||!sha(manual.receiptSha256)||manual.scope!=="import_and_runtime_visibility"))throw Error("Manual proof invalid");
 const observed=v.evidence.observedImport;if(observed!==null&&(!object(observed)||!keys(observed,["operationId","state","effectApplied","leaseState"])||!/^icon-import-[a-f0-9]{32}$/.test(observed.operationId)||typeof observed.state!=="string"||observed.state.length>80||![true,false,"UNKNOWN"].includes(observed.effectApplied)||!["RELEASED","UNKNOWN","RETAINED"].includes(observed.leaseState)))throw Error("Import observation invalid");
 if(!object(v.resource)||!keys(v.resource,["state","designResolution","iconSize","referencesAsModelInput"])||!["sealed","not_recorded","unavailable"].includes(v.resource.state)||v.resource.referencesAsModelInput!==false)throw Error("Resource invalid");
 for(const name of ["designResolution","iconSize"]){const d=v.resource[name];if(d!==null&&(!object(d)||!keys(d,["width","height"])||!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<1||d.height<1||d.width>8192||d.height>8192))throw Error("Dimensions invalid");}
 if(!Array.isArray(v.referenceProvenance)||v.referenceProvenance.length>4)throw Error("References invalid");
 for(const ref of v.referenceProvenance){
  if(!object(ref)||!keys(ref,["relativePath","sha256","crop"])||!path(ref.relativePath)||!/^(art\/reference|assets)\/.+\.(png|jpe?g|webp)$/i.test(ref.relativePath)||!sha(ref.sha256))throw Error("Reference invalid");
  const c=ref.crop;if(c!==null){if(!object(c)||!sha(c.cropId)||!["available","unavailable"].includes(c.state))throw Error("Crop invalid");
   if(c.state==="unavailable"&&!keys(c,["state","cropId"]))throw Error("Crop invalid");
   if(c.state==="available"&&(!keys(c,["state","cropId","originalSha256","contextSha256","subjectSha256","receiptSha256","roi","coordinateSpace"])||![c.originalSha256,c.contextSha256,c.subjectSha256,c.receiptSha256].every(sha)||!object(c.roi)||!keys(c.roi,["x","y","width","height"])||!Number.isInteger(c.roi.x)||c.roi.x<0||!Number.isInteger(c.roi.y)||c.roi.y<0||!size(c.roi.width)||!size(c.roi.height)||c.coordinateSpace!=="top-left-display-pixels-after-exif-transpose"))throw Error("Crop invalid");
  }
 }
 const r=v.receiver;if(!object(r)||!keys(r,["freshProjectAndRevisionRequired","freshCoordinationRequired","writeAuthorizationIncluded","unknownReplayAllowed","importVerificationTools","bindingTools","runtimeIdentityProvider"])
  ||r.freshProjectAndRevisionRequired!==true||r.freshCoordinationRequired!==true||r.writeAuthorizationIncluded!==false||r.unknownReplayAllowed!==false||r.runtimeIdentityProvider!==null
  ||JSON.stringify(r.importVerificationTools)!=='["asset_get_info","asset_resolve_reference"]'||JSON.stringify(r.bindingTools)!=='["scene_apply_patch","prefab_apply_patch"]')throw Error("Receiver invalid");
 return v as unknown as IconHandoff;
}};
export function iconHandoffText(packet:IconHandoff):string {
 return '请先只读核对以下工程、原任务、素材哈希和目标。交接包仅准备内容，未发送给Agent，不包含写入授权或租约，UNKNOWN禁止重放。所有真实Cocos Creator动作（打开、关闭、导入、刷新、构建、绑定）必须从现有 http://127.0.0.1:32180 开发者后台UI发起，不得用CLI、脚本、直接Dashboard或Creator接口替代。导入、绑定、UUID/文件回读及运行验收分别取得证据；准备或复制不代表其中任何一步完成。\n\n'+JSON.stringify(iconHandoffSchema.parse(packet),null,2)
}
export interface IconHandoffInput { jobId:string;revision:number;candidateId:string;purpose:string;artifact:{kind:'mother'}|{kind:'variant';width:number;height:number};target:{destinationUrl:string|null;documentUrl:string|null;nodeKey:string|null} }
export interface IconHandoffProvider {readonly label:string;prepare(projectId:string,input:IconHandoffInput,snapshot:AiJobSnapshot,signal?:AbortSignal):Promise<IconHandoff>;waitForIdle():Promise<void>}
export class IconHandoffError extends Error {constructor(readonly code:'invalid-input'|'invalid-shape'|'busy'|'unauthorized'|'forbidden'|'unconfirmed'|'timeout'|'aborted'|'too-large',readonly outcome:'not-sent'|'unknown'='unknown'){super(({ 'invalid-input':'原任务、选中候选或目标输入尚未核对，未准备交接包。','invalid-shape':'交接包与原任务或素材证据不一致，未提供复制。',busy:'已有任务操作或请求清理尚未结束。',unauthorized:'会话失效（401），未确认交接包。',forbidden:'交接读取被拒绝（403），请核对当前会话。',unconfirmed:'交接包结果未确认，不会自动重试；请先核对原任务。',timeout:'交接包读取超时，结果未确认；不会自动重试。',aborted:'已停止等待，未确认交接包；未重复请求。','too-large':'交接响应超过32 KiB上限，未接受。'} as const)[code]);this.name='IconHandoffError'}}
export function iconHandoffEligible(job:AiJobSnapshot|null|undefined):job is AiJobSnapshot {return !!job&&!job.historyOnly&&['selected','import_unknown','imported_pending_verification'].includes(job.state)&&job.selectedIds.length===1&&isAiCandidateId(job.selectedIds[0])&&job.candidates.some(c=>c.candidateId===job.selectedIds[0])}
export function validateIconHandoffInput(projectId:string,value:unknown,snapshot:AiJobSnapshot):IconHandoffInput {
 try {const job=decodeAiJobSnapshot(snapshot,projectId),v=value as IconHandoffInput;if(!isAiProjectId(projectId)||!iconHandoffEligible(job)||!object(v)||!keys(v,['jobId','revision','candidateId','purpose','artifact','target'])||!isAiJobId(v.jobId)||v.jobId!==job.jobId||v.revision!==job.revision||v.candidateId!==job.selectedIds[0]||!object(v.artifact)||!keys(v.artifact,v.artifact.kind==='mother'?['kind']:['kind','width','height'])||!object(v.target)||!keys(v.target,['destinationUrl','documentUrl','nodeKey']))throw Error();const parsed=iconHandoffInputSchema.parse(v);return JSON.parse(JSON.stringify(parsed)) as IconHandoffInput}catch{throw new IconHandoffError('invalid-input','not-sent')}
}
export function decodeIconHandoff(value:unknown,projectId:string,input:IconHandoffInput,snapshot:AiJobSnapshot):IconHandoff {
 try {const checked=validateIconHandoffInput(projectId,input,snapshot),job=decodeAiJobSnapshot(snapshot,projectId),packet=iconHandoffSchema.parse(value),sealed=job.resourceSnapshot?.state==='sealed'?job.resourceSnapshot:null,candidate=job.candidates.find(c=>c.candidateId===checked.candidateId)!,asset=job.assets.find(a=>a.assetId===candidate.assetId)!;
 if(packet.projectId!==projectId||packet.sourceRevision!==job.sourceRevision||packet.purpose!==checked.purpose||packet.job.jobId!==job.jobId||packet.job.revision!==job.revision||packet.job.state!==job.state||packet.job.requestHash!==job.requestHash||packet.job.candidateId!==checked.candidateId||packet.job.configHash!==(sealed?.hash??null)||packet.job.configVersion!==(sealed?.version??null)||packet.asset.assetId!==candidate.assetId||packet.asset.motherSha256!==candidate.fileSha256||packet.asset.savedCreatorDestination!==asset.relativePath||packet.asset.kind!==checked.artifact.kind||checked.artifact.kind==='variant'&&(packet.asset.width!==checked.artifact.width||packet.asset.height!==checked.artifact.height)||packet.target.destinationUrl!==checked.target.destinationUrl||packet.target.documentUrl!==checked.target.documentUrl||packet.target.nodeKey!==checked.target.nodeKey)throw Error();
 const config=sealed?.config,design=config?.schemaVersion==='project-art-spec-v1'?config.project.designResolution:config?.designResolution??null,out=aiResourceSnapshotOutput(sealed??undefined,candidate.assetId),size=config?.schemaVersion==='project-resource-config-v2'?config.iconSize:config?.schemaVersion==='project-art-spec-v1'&&out?{width:out.width,height:out.height}:null;
 if(packet.resource.state!==(job.resourceSnapshot?.state??'not_recorded')||aiJobActionCanonical(packet.resource.designResolution)!==aiJobActionCanonical(design)||aiJobActionCanonical(packet.resource.iconSize)!==aiJobActionCanonical(size))throw Error();
 const refs=sealed&&'referenceSnapshots'in sealed?sealed.referenceSnapshots??[]:[];if(aiJobActionCanonical(packet.referenceProvenance.map((r:any)=>({relativePath:r.relativePath,sha256:r.sha256})))!==aiJobActionCanonical(refs))throw Error();
 const observed=job.import?{operationId:job.import.operationId,state:job.import.state,effectApplied:job.import.effectApplied,leaseState:job.import.leaseState}:null;if(aiJobActionCanonical(packet.evidence.observedImport)!==aiJobActionCanonical(observed))throw Error();
 const expectedManual=checked.artifact.kind==='mother'&&job.productAcceptance?.state==='owner_manual_passed'?{state:'manual_attested',receiptSha256:job.productAcceptance.receiptSha256,scope:job.productAcceptance.scope}:null;if(aiJobActionCanonical(packet.evidence.manualAttestation)!==aiJobActionCanonical(expectedManual))throw Error();return JSON.parse(JSON.stringify(packet)) as IconHandoff;
 }catch{throw new IconHandoffError('invalid-shape')}
}
export function decodeIconHandoffResponse(raw:unknown,projectId:string,input:IconHandoffInput,snapshot:AiJobSnapshot):IconHandoff {if(!object(raw)||!keys(raw,['schemaVersion','handoff'])||raw.schemaVersion!=='companion-icons-v1')throw new IconHandoffError('invalid-shape');return decodeIconHandoff(raw.handoff,projectId,input,snapshot)}
