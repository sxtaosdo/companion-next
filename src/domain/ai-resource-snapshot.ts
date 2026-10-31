import {antToolbarScope,ANT_TOOLBAR_REFERENCES,ANT_TOOLBAR_SPEC,ANT_TOOLBAR_DESTINATION,ANT_TOOLBAR_EXPORT} from './ant-toolbar-scope'
import type { AiJobReferenceProfile } from './ai-jobs-read'
import { decodeAiResourceConfig, isAiProjectId, isAiReferencePath } from './ai-resource-read'
import type { AiResourceConfig } from './ai-resource-read'
import { parseProjectArtSpec, resolveArtGenerationInput, validateProjectArtBindings, type ArtAuthority, type ProjectArtSpec, type ArtValues } from './project-art-spec'

/** Original icon-resource-config.ts ResourceSnapshot. This is a server claim,
 * not a browser revalidation of the on-disk capsule or current project config. */
export type AiLegacyResourceSnapshot = {
  state: 'sealed'; version: number; hash: string; presetId: string; config: AiResourceConfig
  referenceSnapshots?: Array<{ relativePath: string; sha256: string }>
}
export interface AiArtRequest {
  schemaVersion: 'local-icon-requests-v1'; projectId: string; runId: string; sourceRevision: string; visualSpec: string
  assets: Array<{assetId:string;relativePath:string;prompt:string;purpose:string;required:boolean}>
}
export interface AiArtFrozenInput {
  schemaVersion:'companion-project-art-input-v1';projectId:string;configHash:string;configVersion:number;spec:ProjectArtSpec
  productIdentity:null|{productId:string;uuid:string;revision:string;packageSha256:string}
  sourceDocuments:Array<{source:{path:string;revision:string};documentSha256:string}>
  capabilities:{imageReferenceInput:boolean;categories:['icon']};assets:ReturnType<typeof resolveArtGenerationInput>[]
  readyForGeneration:true;inputSha256:string
}
export interface AiArtResourceSnapshot {
  state:'sealed';kind:'project-art-spec';version:number;hash:string;presetId:'project-art';config:ProjectArtSpec
  freeze:AiArtFrozenInput;inputSha256:string;job:{projectId:string;jobId:string;sourceRevision:string;requestHash:string};request:AiArtRequest
}
export type AiJobResourceSnapshot = {state:'unavailable'} | AiLegacyResourceSnapshot | AiArtResourceSnapshot
export type AiResourceOutput={width:number;height:number;directory:string;exportDirectory:string;transparent:boolean;color?:string}
/** Output view only: keeps each configuration schema and its original hash authoritative. */
export function aiResourceSnapshotOutput(snapshot:AiJobResourceSnapshot|undefined,assetId?:string):AiResourceOutput|null {
  if(snapshot?.state!=='sealed')return null
  if('kind' in snapshot){
    const asset=snapshot.freeze.assets.find(a=>a.assetId===assetId);if(!asset)return null
    const v=asset.values
    if(typeof v.width!=='number'||typeof v.height!=='number'||typeof v.destination!=='string'||typeof v.exportDirectory!=='string'||typeof v.transparent!=='boolean'||!v.transparent&&typeof v.backgroundColor!=='string')return null
    return {width:v.width,height:v.height,directory:v.destination,exportDirectory:v.exportDirectory,transparent:v.transparent,color:v.backgroundColor}
  }
  if(snapshot.config.schemaVersion!=='project-resource-config-v2')return null
  return {width:snapshot.config.iconSize.width,height:snapshot.config.iconSize.height,directory:snapshot.config.destination.directory,
    exportDirectory:snapshot.config.destination.exportDirectory,transparent:snapshot.config.background.transparent,color:snapshot.config.background.color}
}
const sha = /^[a-f0-9]{64}$/
const invalid = () => new Error('Invalid sealed resource snapshot')
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid()
  return value as Record<string, unknown>
}
export function decodeAiJobResourceSnapshot(value: unknown, projectId: string, expectedJob?: {jobId:unknown;sourceRevision:unknown;requestHash:unknown;assets:unknown;profile?:unknown;referenceProfile?:AiJobReferenceProfile}): AiJobResourceSnapshot {
  const raw = record(value)
  if (!isAiProjectId(projectId)) throw invalid()
  if (raw.state === 'unavailable') return { state: 'unavailable' }
  if (raw.kind !== undefined) return decodeArtSnapshot(raw,projectId,expectedJob)
  if (raw.state !== 'sealed' || !Number.isSafeInteger(raw.version) || (raw.version as number) < 1
    || typeof raw.hash !== 'string' || !sha.test(raw.hash) || typeof raw.presetId !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(raw.presetId)) throw invalid()
  const config = decodeAiResourceConfig(raw.config, projectId)
  if (config.version !== raw.version || (config.schemaVersion === 'project-resource-config-v2'
    ? raw.presetId !== 'default' : !config.iconPresets.some(preset => preset.id === raw.presetId))) throw invalid()
  let referenceSnapshots: Array<{ relativePath: string; sha256: string }> | undefined
  if (raw.referenceSnapshots !== undefined) {
    if (!Array.isArray(raw.referenceSnapshots) || raw.referenceSnapshots.length > 4) throw invalid()
    referenceSnapshots = raw.referenceSnapshots.map(value => {
      const ref = record(value)
      if (!isAiReferencePath(ref.relativePath) || typeof ref.sha256 !== 'string' || !sha.test(ref.sha256)) throw invalid()
      return { relativePath: ref.relativePath, sha256: ref.sha256 }
    })
    if (referenceSnapshots.length !== config.style.references.length
      || referenceSnapshots.some((ref, index) => ref.relativePath !== config.style.references[index])) throw invalid()
  }
  // v2 references must have evidence in the sealed snapshot, not current files.
  if (config.schemaVersion === 'project-resource-config-v2' && config.style.references.length && !referenceSnapshots) throw invalid()
  return { state: 'sealed', version: raw.version as number, hash: raw.hash, presetId: raw.presetId, config,
    ...(referenceSnapshots ? { referenceSnapshots } : {}) }
}

const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>JSON.stringify(k)+':'+canonical(x)).join(',')+'}':JSON.stringify(v)
function exact(value:unknown,keys:string[]){const v=record(value);if(Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw invalid();return v}
function checkedText(v:unknown,max:number){if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw invalid();return v}
function checkedHash(v:unknown,n=64){if(typeof v!=='string'||!(n===64?sha:/^[a-f0-9]{40}$/).test(v))throw invalid();return v}

/** Same fixed accepted product/style evidence as the host capsule verifier; no caller-supplied authorities. */
function antFrozenStyleAuthorities(projectId:string,config:ProjectArtSpec,identity:AiArtFrozenInput['productIdentity'],documents:AiArtFrozenInput['sourceDocuments']):readonly ArtAuthority[]{
 const expectedIdentity={"productId": "ant-cook", "uuid": "95896d51-fc33-4b89-9469-3059ece53171", "revision": "7d21f7348e8a985b33f8e441f1b08cadf2253d90", "packageSha256": "aa81a081d9397591d2252a357bf718f7a50523a4b63154f35d3c4c47b5f20e9c"}
 const sourceEvidence={"source": {"path": "P0001/art/master-style-reference.md", "revision": "d1bc46ef3696e8254377d7b655bd006ff3633c45"}, "documentSha256": "378f370107e2b0d31af2764f9ad79654b9aab3ce0ef1c503198a2d355452f30f"}
 if(!antToolbarScope(projectId,config.resourceDomainId)||config.imageOutput!=='transparent-png'||config.inheritance.mode!=='style'||config.inheritance.usage!=='project-art'||canonical(identity)!==canonical(expectedIdentity)||canonical(documents)!==canonical([sourceEvidence])||canonical(config.inheritance.sources)!==canonical([sourceEvidence.source]))throw invalid()
 const authorities:readonly ArtAuthority[]=[{source:sourceEvidence.source,status:'Accepted',kind:'art-style',projectIds:[projectId],categories:['ip','equipment','skill','ui','icon'],allowedUsages:['project-art'],defaults:{},requiresImageReference:true,locked:{"renderingLanguage": "高品质 Stylized 3D 游戏动画风格；高品质游戏 CG，圆润柔和的大形体与干净轮廓", "proportions": "角色头部偏大、躯干偏短、四肢适度缩短、身体紧凑、偏Q版；不采用写实人体或修长模特比例", "realism": "半写实材质的游戏化卡通表现；避免照片级写实、真人电影CG与恐怖谷", "materials": "艺术化简化的 Stylized PBR 材质；细节丰富但不过度写实", "lighting": "明亮自然环境光、柔和高质量全局光照；不采用暗黑电影或摄影棚式光照", "palette": "以青色、蓝绿色、橙色、米白色的关系维持清新明亮的游戏色彩；不凭文字补造色号"}}]
 validateProjectArtBindings(config,authorities)
 return authorities
}

function decodeArtSnapshot(raw:Record<string,unknown>,projectId:string,expectedJob?:{jobId:unknown;sourceRevision:unknown;requestHash:unknown;assets:unknown;profile?:unknown;referenceProfile?:AiJobReferenceProfile}):AiArtResourceSnapshot {
  exact(raw,['state','kind','version','hash','presetId','config','freeze','inputSha256','job','request'])
  if(raw.state!=='sealed'||raw.kind!=='project-art-spec'||raw.presetId!=='project-art')throw invalid()
  const parsed=parseProjectArtSpec(raw.config,projectId);if(parsed.kind!=='project'||raw.version!==parsed.spec.version)throw invalid()
  const config=parsed.spec,hash=checkedHash(raw.hash),inputSha256=checkedHash(raw.inputSha256)
  const f=exact(raw.freeze,['schemaVersion','projectId','configHash','configVersion','spec','productIdentity','sourceDocuments','capabilities','assets','readyForGeneration','inputSha256'])
  if(f.schemaVersion!=='companion-project-art-input-v1'||f.projectId!==projectId||f.configHash!==hash||f.configVersion!==raw.version||f.inputSha256!==inputSha256||f.readyForGeneration!==true||canonical(f.spec)!==canonical(config))throw invalid()
  let productIdentity:AiArtFrozenInput['productIdentity']=null
  if(f.productIdentity!==null){const i=exact(f.productIdentity,['productId','uuid','revision','packageSha256']);productIdentity={productId:checkedText(i.productId,80),uuid:checkedText(i.uuid,100),revision:checkedHash(i.revision,40),packageSha256:checkedHash(i.packageSha256)}}
  const ant=antToolbarScope(projectId,config.resourceDomainId)
  if(!Array.isArray(f.sourceDocuments)||f.sourceDocuments.length>(ant?1:0))throw invalid()
  const sourceDocuments:AiArtFrozenInput['sourceDocuments']=f.sourceDocuments.map(value=>{const d=exact(value,['source','documentSha256']),pin=exact(d.source,['path','revision']);return {source:{path:checkedText(pin.path,512),revision:checkedHash(pin.revision,40)},documentSha256:checkedHash(d.documentSha256)}})
  if(!ant&&config.inheritance.mode!=='none')throw invalid()
  const authorities=ant?antFrozenStyleAuthorities(projectId,config,productIdentity,sourceDocuments):[]
  const capabilities=exact(f.capabilities,['imageReferenceInput','categories']),qwen=expectedJob?.profile==='qwen-image-edit-2511-reference-v1',reference=expectedJob?.referenceProfile
   if(qwen&&(!reference||!(projectId==='16ad921aa0fb06d6'||ant&&antToolbarScope(projectId,config.resourceDomainId,reference.assetId))||reference.projectId!==projectId||reference.runId!==expectedJob?.jobId||reference.scope.normHash!==hash))throw invalid()
   if(capabilities.imageReferenceInput!==qwen||canonical(capabilities.categories)!==canonical(['icon']))throw invalid()
  if(ant&&(!qwen||!reference||reference.scope.specId!==ANT_TOOLBAR_SPEC||reference.references.length!==1))throw invalid()
  if(ant&&reference){const ref=reference.references[0]!,expected=ANT_TOOLBAR_REFERENCES[reference.assetId as keyof typeof ANT_TOOLBAR_REFERENCES];if(!expected||ref.relativePath!==expected.relativePath||ref.sha256!==expected.sha256||ref.mimeType!=='image/png'||ref.width!==160||ref.height!==160||ref.role!=='subject'||ref.order!==0)throw invalid()}

  if(!Array.isArray(f.assets)||f.assets.length<1||f.assets.length>(qwen?1:2))throw invalid()
  const assets=f.assets.map(value=>{
    const a=exact(value,['projectId','assetId','category','prompt','values','sources','usage','lockedFields','provenance','references','requiresImageReference','readyForGeneration','blockers','persistence','visualCompliance'])
    if(qwen&&(!reference||a.assetId!==reference.assetId||canonical(a.references)!==canonical(reference.references.map(r=>r.relativePath))))throw invalid()
    if(a.projectId!==projectId||a.category!=='icon'||typeof a.assetId!=='string'||!/^[a-z][a-z0-9-]{0,59}$/.test(a.assetId)||!ant&&(a.usage!==null||canonical(a.sources)!=='[]'||canonical(a.lockedFields)!=='[]'))throw invalid()
    const provenance=record(a.provenance),v=record(a.values),overrides:ArtValues={}
    for(const [key,origin]of Object.entries(provenance)){if(!(ant?['project','category','asset',...authorities.map(authority=>authority.source.path+'@'+authority.source.revision)]:['project','category','asset']).includes(origin as string)||!Object.hasOwn(v,key))throw invalid();if(origin==='asset')Object.assign(overrides,{[key]:v[key]})}
    const resolved=resolveArtGenerationInput(config,{assetId:a.assetId,category:'icon',prompt:checkedText(a.prompt,1500),overrides,references:a.references as string[]},authorities,{imageReferenceInput:qwen,categories:['icon']})
    if(ant&&(!antToolbarScope(projectId,config.resourceDomainId,resolved.assetId)||resolved.values.width!==160||resolved.values.height!==160||resolved.values.destination!==ANT_TOOLBAR_DESTINATION||resolved.values.exportDirectory!==ANT_TOOLBAR_EXPORT||resolved.values.transparent!==true))throw invalid()
    if(!resolved.readyForGeneration||canonical(resolved)!==canonical(a)||resolved.values.transparent===false&&typeof resolved.values.backgroundColor!=='string')throw invalid()
    return resolved
  })
  if(new Set(assets.map(a=>a.assetId)).size!==assets.length)throw invalid()
  const j=exact(raw.job,['projectId','jobId','sourceRevision','requestHash'])
  if(j.projectId!==projectId||typeof j.jobId!=='string'||!/^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/.test(j.jobId))throw invalid()
  const job={projectId,jobId:j.jobId,sourceRevision:checkedHash(j.sourceRevision,40),requestHash:checkedHash(j.requestHash)}
  const q=exact(raw.request,['schemaVersion','projectId','runId','sourceRevision','visualSpec','assets'])
  if(q.schemaVersion!=='local-icon-requests-v1'||q.projectId!==projectId||q.runId!==job.jobId||q.sourceRevision!==job.sourceRevision||!Array.isArray(q.assets)||q.assets.length!==assets.length)throw invalid()
  const visualSpec=`Project art v${config.version} SHA256 ${hash}; resolved ${inputSha256}; ${qwen?"Qwen image conditioning with sealed reference inputs":"text constraints only; image conditioning unsupported"}; requested dimensions/background are CPU export requirements.`
  if(q.visualSpec!==visualSpec)throw invalid()
  const request:AiArtRequest={schemaVersion:'local-icon-requests-v1',projectId,runId:job.jobId,sourceRevision:job.sourceRevision,visualSpec,assets:q.assets.map(value=>{
    const a=exact(value,['assetId','relativePath','prompt','purpose','required']),resolved=assets.find(x=>x.assetId===a.assetId)
    if(!resolved||a.required!==true||a.relativePath!==`${resolved.values.destination}/${resolved.assetId}.png`)throw invalid()
    const prompt=resolved.prompt+'\nProject art text constraints:\n'+Object.entries(resolved.values).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+': '+v).join('\n')
    if(a.prompt!==prompt||prompt.length>4096)throw invalid()
    return {assetId:resolved.assetId,relativePath:a.relativePath as string,prompt,purpose:checkedText(a.purpose,400),required:true}
  })}
  if(new Set(request.assets.map(a=>a.assetId)).size!==assets.length)throw invalid()
  if(expectedJob&&(job.jobId!==expectedJob.jobId||job.sourceRevision!==expectedJob.sourceRevision||job.requestHash!==expectedJob.requestHash||canonical(request.assets.map(({assetId,relativePath})=>({assetId,relativePath})))!==canonical(expectedJob.assets)))throw invalid()
  return {state:'sealed',kind:'project-art-spec',version:config.version,hash,presetId:'project-art',config,inputSha256,job,request,
    freeze:{schemaVersion:'companion-project-art-input-v1',projectId,configHash:hash,configVersion:config.version,spec:config,productIdentity,sourceDocuments,capabilities:{imageReferenceInput:qwen,categories:['icon']},assets,readyForGeneration:true,inputSha256}}
}

/** Verifies browser-visible immutable capsule hashes, not raw config bytes or disk provenance. */
export async function verifyAiResourceSnapshotIntegrity(snapshot:AiJobResourceSnapshot|undefined):Promise<void>{
  if(snapshot?.state!=='sealed'||!('kind' in snapshot))return
  if(!globalThis.crypto?.subtle)throw invalid()
  const digest=async(value:unknown)=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)))),b=>b.toString(16).padStart(2,'0')).join('')
  const {inputSha256,...body}=snapshot.freeze
  if(await digest(body)!==inputSha256||await digest(snapshot.request)!==snapshot.job.requestHash)throw invalid()
}
