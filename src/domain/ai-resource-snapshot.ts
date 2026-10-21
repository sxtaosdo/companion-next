import { decodeAiResourceConfig, isAiProjectId, isAiReferencePath } from './ai-resource-read'
import type { AiResourceConfig } from './ai-resource-read'
import { parseProjectArtSpec, resolveArtGenerationInput, type ProjectArtSpec, type ArtValues } from './project-art-spec'

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
  capabilities:{imageReferenceInput:false;categories:['icon']};assets:ReturnType<typeof resolveArtGenerationInput>[]
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
export function decodeAiJobResourceSnapshot(value: unknown, projectId: string, expectedJob?: {jobId:unknown;sourceRevision:unknown;requestHash:unknown;assets:unknown}): AiJobResourceSnapshot {
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
function decodeArtSnapshot(raw:Record<string,unknown>,projectId:string,expectedJob?:{jobId:unknown;sourceRevision:unknown;requestHash:unknown;assets:unknown}):AiArtResourceSnapshot {
  exact(raw,['state','kind','version','hash','presetId','config','freeze','inputSha256','job','request'])
  if(raw.state!=='sealed'||raw.kind!=='project-art-spec'||raw.presetId!=='project-art')throw invalid()
  const parsed=parseProjectArtSpec(raw.config,projectId);if(parsed.kind!=='project'||parsed.spec.inheritance.mode!=='none'||raw.version!==parsed.spec.version)throw invalid()
  const config=parsed.spec,hash=checkedHash(raw.hash),inputSha256=checkedHash(raw.inputSha256)
  const f=exact(raw.freeze,['schemaVersion','projectId','configHash','configVersion','spec','productIdentity','sourceDocuments','capabilities','assets','readyForGeneration','inputSha256'])
  if(f.schemaVersion!=='companion-project-art-input-v1'||f.projectId!==projectId||f.configHash!==hash||f.configVersion!==raw.version||f.inputSha256!==inputSha256||f.readyForGeneration!==true||canonical(f.spec)!==canonical(config))throw invalid()
  let productIdentity:AiArtFrozenInput['productIdentity']=null
  if(f.productIdentity!==null){const i=exact(f.productIdentity,['productId','uuid','revision','packageSha256']);productIdentity={productId:checkedText(i.productId,80),uuid:checkedText(i.uuid,100),revision:checkedHash(i.revision,40),packageSha256:checkedHash(i.packageSha256)}}
  if(!Array.isArray(f.sourceDocuments)||f.sourceDocuments.length!==0)throw invalid()
  const capabilities=exact(f.capabilities,['imageReferenceInput','categories']);if(capabilities.imageReferenceInput!==false||canonical(capabilities.categories)!==canonical(['icon']))throw invalid()
  if(!Array.isArray(f.assets)||f.assets.length<1||f.assets.length>2)throw invalid()
  const assets=f.assets.map(value=>{
    const a=exact(value,['projectId','assetId','category','prompt','values','sources','usage','lockedFields','provenance','references','requiresImageReference','readyForGeneration','blockers','persistence','visualCompliance'])
    if(a.projectId!==projectId||a.category!=='icon'||typeof a.assetId!=='string'||!/^[a-z][a-z0-9-]{0,59}$/.test(a.assetId)||a.usage!==null||canonical(a.sources)!=='[]'||canonical(a.lockedFields)!=='[]')throw invalid()
    const provenance=record(a.provenance),v=record(a.values),overrides:ArtValues={}
    for(const [key,origin]of Object.entries(provenance)){if(!['project','category','asset'].includes(origin as string)||!Object.hasOwn(v,key))throw invalid();if(origin==='asset')Object.assign(overrides,{[key]:v[key]})}
    const resolved=resolveArtGenerationInput(config,{assetId:a.assetId,category:'icon',prompt:checkedText(a.prompt,1500),overrides,references:a.references as string[]},[],{imageReferenceInput:false,categories:['icon']})
    if(!resolved.readyForGeneration||canonical(resolved)!==canonical(a)||resolved.values.transparent===false&&typeof resolved.values.backgroundColor!=='string')throw invalid()
    return resolved
  })
  if(new Set(assets.map(a=>a.assetId)).size!==assets.length)throw invalid()
  const j=exact(raw.job,['projectId','jobId','sourceRevision','requestHash'])
  if(j.projectId!==projectId||typeof j.jobId!=='string'||!/^STUDIO-RUN-[a-z0-9-]{1,64}-[a-f0-9]{8}$/.test(j.jobId))throw invalid()
  const job={projectId,jobId:j.jobId,sourceRevision:checkedHash(j.sourceRevision,40),requestHash:checkedHash(j.requestHash)}
  const q=exact(raw.request,['schemaVersion','projectId','runId','sourceRevision','visualSpec','assets'])
  if(q.schemaVersion!=='local-icon-requests-v1'||q.projectId!==projectId||q.runId!==job.jobId||q.sourceRevision!==job.sourceRevision||!Array.isArray(q.assets)||q.assets.length!==assets.length)throw invalid()
  const visualSpec=`Project art v${config.version} SHA256 ${hash}; resolved ${inputSha256}; text constraints only; image conditioning unsupported; requested dimensions/background are CPU export requirements.`
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
    freeze:{schemaVersion:'companion-project-art-input-v1',projectId,configHash:hash,configVersion:config.version,spec:config,productIdentity,sourceDocuments:[],capabilities:{imageReferenceInput:false,categories:['icon']},assets,readyForGeneration:true,inputSha256}}
}

/** Verifies browser-visible immutable capsule hashes, not raw config bytes or disk provenance. */
export async function verifyAiResourceSnapshotIntegrity(snapshot:AiJobResourceSnapshot|undefined):Promise<void>{
  if(snapshot?.state!=='sealed'||!('kind' in snapshot))return
  if(!globalThis.crypto?.subtle)throw invalid()
  const digest=async(value:unknown)=>Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)))),b=>b.toString(16).padStart(2,'0')).join('')
  const {inputSha256,...body}=snapshot.freeze
  if(await digest(body)!==inputSha256||await digest(snapshot.request)!==snapshot.job.requestHash)throw invalid()
}
