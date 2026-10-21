import { parseProjectArtSpec, resolveArtGenerationInput, type ProjectArtSpec, type ArtAuthority, type ArtAssetInput } from './project-art-spec'
import { decodeAiResourceConfigV2, decodeAiResourceView, isAiProjectId } from './ai-resource-read'
import type { AiResourceConfigV2, AiResourceView } from './ai-resource-read'
import { decodeAiJobSnapshot, decodeAiJobsView, isAiJobId } from './ai-jobs-read'
import type { AiJobSnapshot, AiJobsView } from './ai-jobs-read'

/** The original UI creates one asset. The deployed protocol allows two, but this form does not. */
export interface AiTaskBrief { name: string; assetId: string; purpose: string; prompt: string; sourceId: string }
export interface AiTaskRequest {
  schemaVersion: 'local-icon-requests-v1'; projectId: string; runId: string; sourceRevision: string; visualSpec: string
  assets: [{ assetId: string; relativePath: string; prompt: string; purpose: string; required: true }]
}
export interface AiTaskResourceBinding { version: number; hash: string; presetId: 'default' }
export interface AiTaskArtMetadata { assetId: string; category: 'icon'; overrides: ArtAssetInput['overrides']; references: string[] }
export type AiTaskInspectionInput = { request: AiTaskRequest; resourceBinding: AiTaskResourceBinding; artBinding?: never; artAssets?: never } | { request: AiTaskRequest; resourceBinding?: never; artBinding: {version:number;hash:string}; artAssets: AiTaskArtMetadata[] }
export type AiTaskCreationInput = AiTaskInspectionInput & { approved: true; sourceId?: string }
export type AiLegacyTaskCreationSubmission = AiTaskCreationSubmission & { savedConfig: AiResourceConfigV2; input: { request: AiTaskRequest; resourceBinding: AiTaskResourceBinding; approved:true; sourceId?:string; artBinding?:never } }
export interface AiTaskCreationSubmission {
  operation: 'enqueue' | 'adopt'; input: AiTaskCreationInput; savedConfig: AiResourceConfigV2 | ProjectArtSpec; authorities?: readonly ArtAuthority[]; profileId: string; sourceSha256: string | null
}
export interface AiTaskInspection {
  schemaVersion: 'companion-icons-v1'; jobId: string; sourceRevision: string
  profile: AiJobsView['profile']; gap: { requiredMissing: string[]; blockedExisting: string[]; existingTargets: Array<{ assetId: string; relativePath: string; status: 'REUSABLE' | 'EXISTING_INVALID' }> }
}
export interface AiTaskCreationProvider {
  readonly label: string
  inspect(projectId: string, submission: AiTaskCreationSubmission, signal?: AbortSignal): Promise<AiTaskInspection>
  execute(projectId: string, submission: AiTaskCreationSubmission, signal?: AbortSignal): Promise<AiJobSnapshot>
  /** Settles only after fetch, body reads and cancellation cleanup have all settled. */
  waitForIdle(): Promise<void>
}
export type AiTaskCreationCode = 'invalid-input' | 'invalid-shape' | 'busy' | 'timeout' | 'aborted' | 'response-too-large' | 'network-error' | 'unauthorized' | 'forbidden' | 'unconfirmed' | 'verification-unavailable' | 'context-changed' | 'target-exists' | 'image-reference-unsupported'
export class AiTaskCreationError extends Error {
  constructor(readonly code: AiTaskCreationCode, readonly outcome: 'not-sent' | 'unknown' = 'unknown', readonly status?: number) {
    super(({ 'image-reference-unsupported': '当前模型未接入参考图条件；此规范要求参考图，已阻止提交。保存路径不代表参考图已经参与生成。', 'invalid-input': '请核对单图输入、已保存配置与当前工程 HEAD。', 'invalid-shape': '原任务响应未通过身份与配置封存核对。', busy: '已有 AI 操作或保护记录，不能提交新任务。', timeout: '任务请求超时，结果尚未确认。', aborted: '本页请求已取消；不能据此断言后台未写入。', 'response-too-large': '原任务响应超过安全读取预算。', 'network-error': '同源任务连接未完成，结果尚未确认。', unauthorized: '需要已有的 Companion 会话（401）。', forbidden: 'Companion 拒绝操作（403），请核对已有会话与同源部署。', unconfirmed: '后台没有提供可核对的任务结果；请保留原任务 ID，不要重发。', 'verification-unavailable': '当前浏览器无法计算安全摘要，已阻止提交。', 'context-changed': '工程、输入、来源、配置或 HEAD 已变化，请重新读取并确认。', 'target-exists': '目标已经存在或缺口未确认；包括可复用内容也禁止覆盖。' } as const)[code]); this.name = 'AiTaskCreationError'
  }
}
export const AI_TASK_CREATION_LIMITS = Object.freeze({ timeoutMs: 20_000, maxRequestBytes: 128 * 1024, maxResponseBytes: 256 * 1024, maxChunks: 4096 })
const fail = (code: AiTaskCreationCode = 'invalid-input') => new AiTaskCreationError(code, 'not-sent')
const sha = /^[a-f0-9]{64}$/, head = /^[a-f0-9]{40}$/, asset = /^[a-z][a-z0-9-]{0,59}$/, reserved = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
function record(value: unknown, keys?: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail()
  const raw = value as Record<string, unknown>
  if (keys && (Reflect.ownKeys(raw).length !== keys.length || keys.some(key => !Object.hasOwn(raw, key)))) throw fail()
  return raw
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw fail()
  return value
}
export function aiTaskCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(aiTaskCanonicalJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${aiTaskCanonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value)
}
export async function aiTaskInputHash(value: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw fail('verification-unavailable')
  try { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(aiTaskCanonicalJson(value)))), byte => byte.toString(16).padStart(2, '0')).join('') }
  catch { throw fail('verification-unavailable') }
}
export function newAiTaskRunId(): string {
  if (!globalThis.crypto?.getRandomValues) throw fail('verification-unavailable')
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return `STUDIO-RUN-icon-${Date.now().toString(36)}-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
}
export function aiTaskPromptSuffix(config: AiResourceConfigV2): string {
  return `\n${config.style.description}\n单个游戏图标，物体居中完整，四周 ${config.composition.paddingPercent}% 留白，透明背景，PNG，无文字、无水印；文字由游戏 UI 承担。`
}
export function aiTaskCompiledVisualSpec(config: AiResourceConfigV2, hash: string, references: Array<{ relativePath: string; sha256: string }>): string {
  return `${config.style.description}\n配置 v${config.version} SHA256 ${hash}; 设计 ${config.designResolution.width}×${config.designResolution.height} ${config.orientation}; 默认尺寸 ${config.iconSize.width}×${config.iconSize.height}（CPU 派生）; 母图 1024×1024 透明 PNG; 居中完整，四周 ${config.composition.paddingPercent}% 留白; 参考仅记录，不作为模型图像输入。${references.map(ref => `\n${ref.relativePath}:${ref.sha256}`).join('')}`
}
export function aiTaskHistoryBlocked(history: AiJobsView): boolean { return history.jobs.some(job => ['running', 'unknown', 'import_unknown'].includes(job.state)) }
export function savedAiTaskConfig(value: AiResourceView, projectId: string): AiResourceConfigV2 {
  const view = decodeAiResourceView(value, projectId)
  if (view.state !== 'valid' || view.migrationRequired || !view.hash || view.config?.schemaVersion !== 'project-resource-config-v2' || view.version !== view.config.version) throw fail()
  return view.config
}
export function buildAiTaskSubmission(brief: AiTaskBrief, resource: AiResourceView, history: AiJobsView, runId = newAiTaskRunId()): AiLegacyTaskCreationSubmission {
  const config = savedAiTaskConfig(resource, resource.projectId), jobs = decodeAiJobsView(history, resource.projectId)
  if (!asset.test(brief.name.trim()) || !asset.test(brief.assetId.trim()) || reserved.test(brief.assetId.trim()) || aiTaskHistoryBlocked(jobs) || jobs.jobs.some(job => job.jobId === runId)) throw fail()
  const selected = brief.sourceId ? jobs.adoptionSources?.find(source => source.sourceId === brief.sourceId) : undefined
  if (brief.sourceId && !selected || !selected && jobs.mode === 'offline_import_only') throw fail()
  return validateAiTaskSubmission(resource.projectId, { operation: selected ? 'adopt' : 'enqueue', savedConfig: config, profileId: jobs.profile.id, sourceSha256: selected?.fileSha256 ?? null,
    input: { request: { schemaVersion: 'local-icon-requests-v1', projectId: resource.projectId, runId, sourceRevision: jobs.sourceRevision, visualSpec: config.style.description,
      assets: [{ assetId: brief.assetId.trim(), relativePath: `${config.destination.directory}/${brief.assetId.trim()}.png`, prompt: brief.prompt.trim(), purpose: brief.purpose.trim(), required: true }] },
    resourceBinding: { version: resource.version!, hash: resource.hash!, presetId: 'default' }, approved: true, ...(selected ? { sourceId: selected.sourceId } : {}) } }) as AiLegacyTaskCreationSubmission
}
export function validateAiTaskSubmission(projectId: string, value: AiTaskCreationSubmission): AiTaskCreationSubmission {
  if (value?.input?.artBinding !== undefined) return validateArtTaskSubmission(projectId, value)
  try {
    const outer = record(value, ['operation', 'input', 'savedConfig', 'profileId', 'sourceSha256']), adoption = outer.operation === 'adopt'
    if (!isAiProjectId(projectId) || !['enqueue', 'adopt'].includes(outer.operation as string)) throw fail()
    const input = record(outer.input, ['request', 'resourceBinding', 'approved', ...(adoption ? ['sourceId'] : [])]), request = record(input.request, ['schemaVersion', 'projectId', 'runId', 'sourceRevision', 'visualSpec', 'assets'])
    const binding = record(input.resourceBinding, ['version', 'hash', 'presetId']), config = decodeAiResourceConfigV2(outer.savedConfig, projectId)
    if (input.approved !== true || request.schemaVersion !== 'local-icon-requests-v1' || request.projectId !== projectId || !isAiJobId(request.runId) || typeof request.sourceRevision !== 'string' || !head.test(request.sourceRevision)
      || binding.version !== config.version || binding.presetId !== 'default' || typeof binding.hash !== 'string' || !sha.test(binding.hash) || !Array.isArray(request.assets) || request.assets.length !== 1
      || typeof outer.profileId !== 'string' || outer.profileId.length > 80 || (adoption ? typeof input.sourceId !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(input.sourceId) || typeof outer.sourceSha256 !== 'string' || !sha.test(outer.sourceSha256) : outer.sourceSha256 !== null)) throw fail()
    const item = record(request.assets[0], ['assetId', 'relativePath', 'prompt', 'purpose', 'required'])
    if (typeof item.assetId !== 'string' || !asset.test(item.assetId) || reserved.test(item.assetId) || item.required !== true || item.relativePath !== `${config.destination.directory}/${item.assetId}.png` || (item.relativePath as string).length > 240
      || text(request.visualSpec, 2000) !== config.style.description) throw fail()
    const prompt = text(item.prompt, 4096), purpose = text(item.purpose, 400)
    if ((prompt + aiTaskPromptSuffix(config)).length > 4096 || aiTaskCompiledVisualSpec(config, binding.hash, config.style.references.map(relativePath => ({ relativePath, sha256: '0'.repeat(64) }))).length > 2000) throw fail()
    return { operation: adoption ? 'adopt' : 'enqueue', savedConfig: config, profileId: outer.profileId, sourceSha256: outer.sourceSha256 as string | null,
      input: { request: { schemaVersion: 'local-icon-requests-v1', projectId, runId: request.runId, sourceRevision: request.sourceRevision, visualSpec: config.style.description, assets: [{ assetId: item.assetId, relativePath: item.relativePath as string, prompt, purpose, required: true }] },
        resourceBinding: { version: config.version, hash: binding.hash, presetId: 'default' }, approved: true, ...(adoption ? { sourceId: input.sourceId as string } : {}) } }
  } catch { throw fail() }
}
export function decodeAiTaskInspection(value: unknown, submission: AiTaskCreationSubmission): AiTaskInspection {
  try {
    const raw = record(value, ['schemaVersion', 'jobId', 'sourceRevision', 'profile', 'gap']), gap = record(raw.gap, ['requiredMissing', 'blockedExisting', 'existingTargets']), profile = record(raw.profile)
    const request = submission.input.request, expected = request.assets[0]
    if (raw.schemaVersion !== 'companion-icons-v1' || raw.jobId !== request.runId || raw.sourceRevision !== request.sourceRevision || profile.id !== submission.profileId || profile.maxAssets !== 2 || profile.candidatesPerAsset !== 1 || profile.submissionAttempts !== 1) throw fail()
    const ids = (value: unknown) => { if (!Array.isArray(value) || value.length > 1 || value.some(id => id !== expected.assetId)) throw fail(); return [...value] as string[] }
    if (!Array.isArray(gap.existingTargets) || gap.existingTargets.length > 1) throw fail()
    const targets = gap.existingTargets.map(value => { const row = record(value, ['assetId', 'relativePath', 'status']); if (row.assetId !== expected.assetId || row.relativePath !== expected.relativePath || !['REUSABLE', 'EXISTING_INVALID'].includes(row.status as string)) throw fail(); return { assetId: expected.assetId, relativePath: expected.relativePath, status: row.status as 'REUSABLE' | 'EXISTING_INVALID' } })
    return { schemaVersion: 'companion-icons-v1', jobId: request.runId, sourceRevision: request.sourceRevision, profile: { id: submission.profileId, maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, gap: { requiredMissing: ids(gap.requiredMissing), blockedExisting: ids(gap.blockedExisting), existingTargets: targets } }
  } catch { throw new AiTaskCreationError('invalid-shape') }
}
export function aiTaskGapAllowsWrite(value: AiTaskInspection, submission: AiTaskCreationSubmission): boolean {
  const inspected = decodeAiTaskInspection(value, submission)
  return inspected.gap.existingTargets.length === 0 && inspected.gap.blockedExisting.length === 0 && inspected.gap.requiredMissing.length === 1
}
/** Never trust the server's loose project-only enqueue/adopt envelope identity. */
export async function validateAiTaskCreatedJob(value: unknown, submission: AiTaskCreationSubmission): Promise<AiJobSnapshot> {
  try {
    if (submission.input.artBinding) return await validateArtTaskCreatedJob(value, submission)
    const request = submission.input.request, job = decodeAiJobSnapshot(value, request.projectId, request.runId), sealed = job.resourceSnapshot, bound = submission.input.resourceBinding!
    if (job.sourceRevision !== request.sourceRevision || aiTaskCanonicalJson(job.assets) !== aiTaskCanonicalJson(request.assets.map(({ assetId, relativePath }) => ({ assetId, relativePath }))) || job.profile !== submission.profileId
      || !sealed || sealed.state !== 'sealed' || sealed.version !== bound.version || sealed.hash !== bound.hash || sealed.presetId !== bound.presetId || aiTaskCanonicalJson(sealed.config) !== aiTaskCanonicalJson(submission.savedConfig)
      || submission.operation === 'adopt' && (job.origin !== 'adopted' || job.candidates.length !== 1 || job.candidates[0]?.assetId !== request.assets[0].assetId || job.candidates[0]?.fileSha256 !== submission.sourceSha256) || submission.operation === 'enqueue' && job.origin === 'adopted') throw fail()
    const compiled = { ...request, visualSpec: aiTaskCompiledVisualSpec(submission.savedConfig as AiResourceConfigV2, bound.hash, sealed.referenceSnapshots ?? []), assets: request.assets.map(item => ({ ...item, prompt: item.prompt + aiTaskPromptSuffix(submission.savedConfig as AiResourceConfigV2) })) }
    if (job.requestHash !== await aiTaskInputHash(compiled)) throw fail()
    return job
  } catch { throw new AiTaskCreationError('invalid-shape') }
}
export async function decodeAiTaskCreationResponse(value: unknown, submission: AiTaskCreationSubmission): Promise<AiJobSnapshot> {
  try { const raw = record(value, ['schemaVersion', 'job']); if (raw.schemaVersion !== 'companion-icons-v1') throw fail(); return await validateAiTaskCreatedJob(raw.job, submission) }
  catch { throw new AiTaskCreationError('invalid-shape') }
}

/** New single-authority path. Authorities are read from the host; never sent as an authority claim. */
export function buildArtTaskSubmission(brief: AiTaskBrief, config: ProjectArtSpec, hash: string, authorities: readonly ArtAuthority[], history: AiJobsView, runId = newAiTaskRunId()): AiTaskCreationSubmission {
  const jobs=decodeAiJobsView(history,config.projectId), selected=brief.sourceId ? jobs.adoptionSources?.find(s=>s.sourceId===brief.sourceId) : undefined
  if (!asset.test(brief.name.trim()) || aiTaskHistoryBlocked(jobs) || jobs.jobs.some(j=>j.jobId===runId) || brief.sourceId && !selected || !selected && jobs.mode==='offline_import_only') throw fail()
  const metadata:AiTaskArtMetadata={assetId:brief.assetId.trim(),category:'icon',overrides:{subject:brief.prompt.trim(),purpose:brief.purpose.trim()},references:[]}
  const resolved=resolveArtGenerationInput(config,{...metadata,prompt:brief.prompt.trim()},authorities,{categories:['icon'],imageReferenceInput:false})
  if (!resolved.readyForGeneration) throw fail('image-reference-unsupported')
  return validateArtTaskSubmission(config.projectId,{operation:selected?'adopt':'enqueue',savedConfig:config,authorities:[...authorities],profileId:jobs.profile.id,sourceSha256:selected?.fileSha256??null,input:{request:{schemaVersion:'local-icon-requests-v1',projectId:config.projectId,runId,sourceRevision:jobs.sourceRevision,visualSpec:config.project.content,assets:[{assetId:metadata.assetId,relativePath:resolved.values.destination+'/'+metadata.assetId+'.png',prompt:brief.prompt.trim(),purpose:brief.purpose.trim(),required:true}]},artBinding:{version:config.version,hash},artAssets:[metadata],approved:true,...(selected?{sourceId:selected.sourceId}:{})}})
}
function validateArtTaskSubmission(projectId:string,value:AiTaskCreationSubmission):AiTaskCreationSubmission {
  try {
    const outer=record(value,['operation','input','savedConfig','authorities','profileId','sourceSha256']), adoption=outer.operation==='adopt'
    if(!isAiProjectId(projectId)||!['adopt','enqueue'].includes(outer.operation as string))throw fail()
    const input=record(outer.input,['request','artBinding','artAssets','approved',...(adoption?['sourceId']:[])]),request=record(input.request,['schemaVersion','projectId','runId','sourceRevision','visualSpec','assets']),binding=record(input.artBinding,['version','hash'])
    const parsed=parseProjectArtSpec(outer.savedConfig,projectId);if(parsed.kind!=='project'||!Array.isArray(outer.authorities)||outer.authorities.length>8)throw fail()
    const config=parsed.spec, authorities=outer.authorities as ArtAuthority[]
    if(input.approved!==true||binding.version!==config.version||typeof binding.hash!=='string'||!sha.test(binding.hash)||request.schemaVersion!=='local-icon-requests-v1'||request.projectId!==projectId||!isAiJobId(request.runId)||typeof request.sourceRevision!=='string'||!head.test(request.sourceRevision)||request.visualSpec!==config.project.content||!Array.isArray(request.assets)||request.assets.length!==1||!Array.isArray(input.artAssets)||input.artAssets.length!==1||typeof outer.profileId!=='string'||outer.profileId.length>80||(adoption?typeof input.sourceId!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(input.sourceId)||typeof outer.sourceSha256!=='string'||!sha.test(outer.sourceSha256):outer.sourceSha256!==null))throw fail()
    const item=record(request.assets[0],['assetId','relativePath','prompt','purpose','required']),meta=record(input.artAssets[0],['assetId','category','overrides','references'])
    if(typeof item.assetId!=='string'||!asset.test(item.assetId)||reserved.test(item.assetId)||item.required!==true||meta.assetId!==item.assetId||meta.category!=='icon')throw fail()
    const prompt=text(item.prompt,1500),purpose=text(item.purpose,400),metadata={assetId:item.assetId,category:'icon' as const,overrides:meta.overrides as ArtAssetInput['overrides'],references:meta.references as string[]}
    const resolved=resolveArtGenerationInput(config,{...metadata,prompt},authorities,{imageReferenceInput:false,categories:['icon']})
    if(!resolved.readyForGeneration)throw fail('image-reference-unsupported')
    if(item.relativePath!==resolved.values.destination+'/'+item.assetId+'.png'||(item.relativePath as string).length>240||artTaskCompiledPrompt(resolved).length>4096)throw fail()
    return {operation:adoption?'adopt':'enqueue',savedConfig:config,authorities,profileId:outer.profileId,sourceSha256:outer.sourceSha256 as string|null,input:{request:{schemaVersion:'local-icon-requests-v1',projectId,runId:request.runId,sourceRevision:request.sourceRevision,visualSpec:config.project.content,assets:[{assetId:item.assetId,relativePath:item.relativePath as string,prompt,purpose,required:true}]},artBinding:{version:config.version,hash:binding.hash},artAssets:[metadata],approved:true,...(adoption?{sourceId:input.sourceId as string}:{})}}
  }catch(error){if(error instanceof AiTaskCreationError)throw error;throw fail()}
}
export function artTaskCompiledPrompt(resolved:ReturnType<typeof resolveArtGenerationInput>):string { return resolved.prompt+'\nProject art text constraints:\n'+Object.entries(resolved.values).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+': '+v).join('\n') }
async function validateArtTaskCreatedJob(value:unknown,submission:AiTaskCreationSubmission):Promise<AiJobSnapshot> {
  const request=submission.input.request, bound=submission.input.artBinding!, job=decodeAiJobSnapshot(value,request.projectId,request.runId),sealed=job.resourceSnapshot
  if(!sealed||sealed.state!=='sealed'||!('kind' in sealed)||sealed.kind!=='project-art-spec'||sealed.version!==bound.version||sealed.hash!==bound.hash||sealed.presetId!=='project-art'||aiTaskCanonicalJson(sealed.config)!==aiTaskCanonicalJson(submission.savedConfig)||job.sourceRevision!==request.sourceRevision||job.profile!==submission.profileId||aiTaskCanonicalJson(job.assets)!==aiTaskCanonicalJson(request.assets.map(({assetId,relativePath})=>({assetId,relativePath}))))throw fail()
  const f=sealed.freeze
  if(f.projectId!==request.projectId||f.configHash!==bound.hash||f.configVersion!==bound.version||aiTaskCanonicalJson(f.spec)!==aiTaskCanonicalJson(submission.savedConfig))throw fail()
  const {inputSha256,...body}=f
  if(await aiTaskInputHash(body)!==inputSha256)throw fail()
  const expected=submission.input.artAssets!.map(m=>resolveArtGenerationInput(submission.savedConfig as ProjectArtSpec,{...m,prompt:request.assets.find(a=>a.assetId===m.assetId)!.prompt},submission.authorities??[],{imageReferenceInput:false,categories:['icon']}))
  if(aiTaskCanonicalJson(f.assets)!==aiTaskCanonicalJson(expected)||expected.some(a=>!a.readyForGeneration))throw fail()
  const compiled={...request,visualSpec:'Project art v'+f.configVersion+' SHA256 '+f.configHash+'; resolved '+inputSha256+'; text constraints only; image conditioning unsupported; requested dimensions/background are CPU export requirements.',assets:request.assets.map(a=>({...a,prompt:artTaskCompiledPrompt(expected.find(x=>x.assetId===a.assetId)!)}))}
  if(job.requestHash!==await aiTaskInputHash(compiled)||submission.operation==='adopt'&&(job.origin!=='adopted'||job.candidates.length!==1||job.candidates[0]?.assetId!==request.assets[0].assetId||job.candidates[0]?.fileSha256!==submission.sourceSha256)||submission.operation==='enqueue'&&job.origin==='adopted')throw fail()
  return job
}
