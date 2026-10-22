import { parseProjectArtSpec, resolveArtGenerationInput } from '../domain/project-art-spec'
import { artPath, pendingArtWrite } from '../domain/project-art-pending'
import type { ProjectArtSpecProvider, ProjectArtSpecReceipt } from '../project-art-spec-integration'
import { computed, reactive, ref, shallowRef } from 'vue'
import { useProjectOperationLaneStore } from './project-operation-lane'
import type { AiResourceReadProvider, AiResourceView } from '../domain/ai-resource-read'
import { decodeAiResourceView, isAiProjectId } from '../domain/ai-resource-read'
import { decodeAiJobsView } from '../domain/ai-jobs-read'
import type { AiJobsReadProvider, AiJobsView, AiJobSnapshot } from '../domain/ai-jobs-read'
import { AiTaskCreationError, aiTaskCanonicalJson, aiTaskGapAllowsWrite, aiTaskHistoryBlocked, aiTaskInputHash, buildAiTaskSubmission, buildArtTaskSubmission, decodeAiTaskInspection, newAiTaskRunId, savedAiTaskConfig, validateAiTaskCreatedJob } from '../domain/ai-task-creation'
import type { AiTaskBrief, AiTaskCreationProvider, AiTaskCreationSubmission, AiTaskInspection } from '../domain/ai-task-creation'
import { AiWriteCoordinationError, aiWriteCoordinator, getAiWriteFenceStorage, hasPendingAiWrites, putAiWriteFence, readAiWriteFences, removeAiWriteFence } from '../domain/ai-write-coordination'
import type { AiWriteCoordinator, AiWriteFence, AiWriteFenceStorage } from '../domain/ai-write-coordination'
export interface AiTaskProject { id: string; name: string; path: string }
export interface AiTaskCreatedEvent { snapshot: AiJobSnapshot; project: AiTaskProject; source: object; jobsReader: AiJobsReadProvider; recovered?: true }
interface Binding { project: AiTaskProject; source: object; resourceReader: AiResourceReadProvider; jobsReader: AiJobsReadProvider; provider: AiTaskCreationProvider; artReader: ProjectArtSpecProvider | null }
export type AiTaskCreationPhase = 'idle' | 'reading' | 'ready' | 'prepared' | 'inspecting' | 'rechecking' | 'submitting' | 'readback' | 'accepted' | 'unknown' | 'blocked'
const unknownMessage = '任务可能已封存或入队，结果尚未确认。已保留原任务 ID 与保护记录；不要新建或重发。'
const equal = (a: unknown, b: unknown) => aiTaskCanonicalJson(a) === aiTaskCanonicalJson(b)
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) } return value }
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }
function validProject(value: AiTaskProject | null): value is AiTaskProject { return !!value && isAiProjectId(value.id) && typeof value.name === 'string' && !!value.name.trim() && typeof value.path === 'string' && !!value.path.trim() && !/[\u0000-\u001f]/.test(value.path) }
/** Per-panel state. Durable UNKNOWN identity is shared with all original-job writes across tabs. */
export function createAiTaskCreationState(options: { storage?: AiWriteFenceStorage; coordinator?: AiWriteCoordinator; createRunId?: () => string } = {}) {
  const project = shallowRef<AiTaskProject | null>(null), resource = shallowRef<AiResourceView | null>(null), history = shallowRef<AiJobsView | null>(null)
  const art = shallowRef<ProjectArtSpecReceipt | null>(null)
  const artConfig = computed(() => { if(!art.value?.config || !project.value)return null; const parsed=parseProjectArtSpec(art.value.config,project.value.id);return parsed.kind==='project'?parsed.spec:null })
  const brief = reactive<AiTaskBrief>({ name: '', assetId: '', purpose: '', prompt: '', sourceId: '' })
  const briefCache = new WeakMap<object,Map<string,AiTaskBrief>>()
  let briefContext:{source:object;key:string}|null=null
  function bindBrief(next:AiTaskProject|null,source:object|null){
    const key=validProject(next)?JSON.stringify([next.id,next.path]):''
    if(briefContext?.source===source && briefContext.key===key)return
    if(briefContext){let cache=briefCache.get(briefContext.source);if(!cache){cache=new Map();briefCache.set(briefContext.source,cache)}cache.set(briefContext.key,copy(brief))}
    Object.assign(brief,source&&key?briefCache.get(source)?.get(key)??{name:'',assetId:'',purpose:'',prompt:'',sourceId:''}:{name:'',assetId:'',purpose:'',prompt:'',sourceId:''})
    briefContext=source&&key?{source,key}:null
  }
  const active = ref(true), contextVersion = ref(0), pendingRunIds = ref<string[]>([]), recovered = ref(false)
  const phase = ref<AiTaskCreationPhase>('idle'), error = ref(''), confirmed = ref(false), busy = ref(false), dirty = ref(false), storageBlocked = ref(false), pending = ref(false)
  const prepared = shallowRef<AiTaskCreationSubmission | null>(null), inspection = shallowRef<AiTaskInspection | null>(null), snapshot = shallowRef<AiJobSnapshot | null>(null), retainedRunId = ref('')
  let binding: Binding | null = null, epoch = 0, controller: AbortController | null = null, approval: AiTaskCreationSubmission | null = null, dispatching = false
  let activeFence: AiWriteFence | null = null, accepted: AiTaskCreatedEvent | null = null
  let recovery: { binding: Binding; submission: AiTaskCreationSubmission; fence: AiWriteFence } | null = null
  const coordinator = options.coordinator ?? aiWriteCoordinator, lane = useProjectOperationLaneStore()
  const storage = () => options.storage ?? getAiWriteFenceStorage()
  const config = computed(() => { try { return resource.value && project.value ? savedAiTaskConfig(resource.value, project.value.id) : null } catch { return null } })
  const output = computed(() => { if(artConfig.value) { try {return resolveArtGenerationInput(artConfig.value,{assetId:brief.assetId.trim()||'preview',category:'icon',prompt:brief.prompt.trim()||'preview',overrides:{subject:brief.prompt.trim()||'preview',purpose:brief.purpose.trim()||'preview'},references:[]},art.value!.authorities,{categories:['icon'],imageReferenceInput:false}).values} catch{return null} } return config.value?{width:config.value.iconSize.width,height:config.value.iconSize.height,destination:config.value.destination.directory}:null })
  const targetPath = computed(() => output.value && brief.assetId.trim() ? `${output.value.destination}/${brief.assetId.trim()}.png` : '')
  const supportsDrain = (bound: Binding) => typeof bound.resourceReader.waitForIdle === 'function' && typeof bound.jobsReader.waitForIdle === 'function' && typeof bound.provider.waitForIdle === 'function' && (!bound.artReader || typeof bound.artReader.waitForIdle === 'function')
  const drainAvailable = computed(() => { contextVersion.value; return !!binding && supportsDrain(binding) })
  const canPrepare = computed(() => active.value && !!project.value && !!binding && !!(config.value || artConfig.value) && !!history.value && drainAvailable.value && !aiTaskHistoryBlocked(history.value) && !dirty.value && !busy.value && !pending.value && !storageBlocked.value && !lane.locked && phase.value !== 'unknown' && !retainedRunId.value)
  const canSubmit = computed(() => active.value && !!prepared.value && drainAvailable.value && confirmed.value && approval === prepared.value && !busy.value && !dirty.value && !pending.value && !storageBlocked.value && !lane.locked && phase.value === 'prepared')
  const recoveryContextMatches = () => !!recovery && !!binding && equal(recovery.binding.project, binding.project) && recovery.binding.source === binding.source && recovery.binding.resourceReader === binding.resourceReader && recovery.binding.jobsReader === binding.jobsReader && recovery.binding.provider === binding.provider && recovery.binding.artReader === binding.artReader
  const canRecover = computed(() => { contextVersion.value; return active.value && phase.value === 'unknown' && !!activeFence && !!recovery && drainAvailable.value && !busy.value && !lane.locked && recoveryContextMatches() })
  function clearApproval() { confirmed.value = false; approval = null }
  function refreshFenceState() {
    try { const entries = readAiWriteFences(storage()).filter(entry => entry.projectId === project.value?.id); pending.value = entries.length > 0; pendingRunIds.value = [...new Set(entries.map(entry => entry.jobId))]; storageBlocked.value = false }
    catch { storageBlocked.value = true; clearApproval(); error.value = new AiWriteCoordinationError().message }
  }
  function invalidate() {
    epoch++; controller?.abort(); clearApproval(); accepted = null
    if (dispatching || activeFence) { phase.value = 'unknown'; error.value = unknownMessage }
    else { prepared.value = null; inspection.value = null; phase.value = 'idle' }
  }
  function setContext(next: AiTaskProject | null, source: object | null, resourceReader: AiResourceReadProvider | null, jobsReader: AiJobsReadProvider | null, provider: AiTaskCreationProvider | null, configDirty = false, artReader: ProjectArtSpecProvider | null = null) {
    const valid = validProject(next) && !!source && typeof source === 'object' && !!resourceReader && !!jobsReader && !!provider
    const same = valid && binding && equal(binding.project, next) && binding.source === source && binding.resourceReader === resourceReader && binding.jobsReader === jobsReader && binding.provider === provider && binding.artReader === artReader
    if (same && dirty.value === configDirty) return
    bindBrief(next,source)
    invalidate(); dirty.value = configDirty
    if (!same) { resource.value = null; art.value = null; history.value = null; snapshot.value = null }
    project.value = validProject(next) ? freeze({ ...next }) : null
    binding = valid ? { project: project.value!, source: source!, resourceReader: resourceReader!, jobsReader: jobsReader!, provider: provider!, artReader } : null
    contextVersion.value++
    if (!dispatching && !activeFence) retainedRunId.value = ''
    refreshFenceState()
  }
  function setActive(value: boolean) {
    if (active.value === value) return
    active.value = value; invalidate()
    if (value && !activeFence && !dispatching) phase.value = (resource.value || artConfig.value) && history.value ? 'ready' : 'idle'
  }
  function edit(field: keyof AiTaskBrief, value: string) {
    if (!active.value || busy.value || phase.value === 'unknown' || retainedRunId.value) return
    brief[field] = value
    if (field === 'name') brief.assetId = value.trim()
    clearApproval(); prepared.value = null; inspection.value = null; phase.value = history.value && (config.value || artConfig.value) ? 'ready' : 'idle'; error.value = ''
  }
  function returnToBrief(){
    if(!active.value || busy.value || phase.value==='unknown' || retainedRunId.value)return false
    clearApproval();prepared.value=null;inspection.value=null;phase.value=history.value&&(config.value||artConfig.value)?'ready':'idle';error.value=''
    return true
  }
  const current = (bound: Binding, token: number, frozen?: AiTaskCreationSubmission) => active.value && binding === bound && epoch === token && !dirty.value && (!frozen || prepared.value === frozen)
  const message = (cause: unknown) => cause instanceof AiTaskCreationError ? new AiTaskCreationError(cause.code).message : cause instanceof AiWriteCoordinationError ? cause.message : '原任务读取或核对未完成；未显示内部诊断。'
  async function readArt(bound:Binding,signal:AbortSignal):Promise<ProjectArtSpecReceipt|null> {
    if(!bound.artReader)return null
    const context={projectId:bound.project.id,projectPath:bound.project.path,source:bound.source}
    if(pendingArtWrite(context,bound.artReader))throw new AiTaskCreationError('context-changed','not-sent')
    const receipt=await bound.artReader.read(context,signal)
    if(receipt.projectId!==bound.project.id||artPath(receipt.projectPath)!==artPath(bound.project.path))throw new AiTaskCreationError('invalid-input','not-sent')
    if(receipt.config===null){if(receipt.hash!==null)throw new AiTaskCreationError('invalid-input','not-sent');return null}
    const parsed=parseProjectArtSpec(receipt.config,bound.project.id)
    if(parsed.kind==='legacy-v2')return null
    if(!receipt.hash||!/^[a-f0-9]{64}$/.test(receipt.hash)||receipt.generationCapabilities?.imageReferenceInput!==false||receipt.generationCapabilities.categories.length!==1||receipt.generationCapabilities.categories[0]!=='icon')throw new AiTaskCreationError('invalid-input','not-sent')
    return {...receipt,config:parsed.spec}
  }
  function build(runId?:string) { return artConfig.value ? buildArtTaskSubmission(copy(brief),artConfig.value,art.value!.hash!,art.value!.authorities,history.value!,runId) : buildAiTaskSubmission(copy(brief),resource.value!,history.value!,runId) }
  async function readContext() {
    const bound = binding
    if (!active.value || !bound || busy.value || dirty.value) return
    clearApproval(); prepared.value = null; inspection.value = null; resource.value = null; art.value = null; history.value = null
    const token = ++epoch, abort = new AbortController(); controller = abort; busy.value = true; phase.value = 'reading'; error.value = ''
    try {
      const artReceipt = await readArt(bound,abort.signal)
      if (!current(bound, token)) return
      const saved = artReceipt ? null : decodeAiResourceView(await bound.resourceReader.readConfig(bound.project.id, abort.signal), bound.project.id)
      if (!current(bound, token)) return
      const jobs = decodeAiJobsView(await bound.jobsReader.readJobs(bound.project.id, abort.signal), bound.project.id)
      if (!current(bound, token)) return
      art.value = artReceipt ? freeze(artReceipt) : null; resource.value = saved ? freeze(saved) : null; history.value = freeze(jobs); refreshFenceState()
      phase.value = activeFence || retainedRunId.value ? 'unknown' : 'ready'
      if (aiTaskHistoryBlocked(jobs)) error.value = '原工程仍有 running / unknown / import_unknown 任务，不能创建新任务。'
      else if (phase.value === 'unknown') error.value = unknownMessage
    } catch (cause) { if (current(bound, token)) { error.value = message(cause); phase.value = activeFence ? 'unknown' : 'blocked' } }
    finally { if (controller === abort) controller = null; busy.value = false }
  }
  function prepare(): boolean {
    refreshFenceState()
    if (!canPrepare.value || !(resource.value || artConfig.value) || !history.value) return false
    if (prepared.value && phase.value === 'prepared') return true
    try { prepared.value = freeze(build((options.createRunId ?? newAiTaskRunId)())); inspection.value = null; clearApproval(); phase.value = 'prepared'; error.value = ''; return true }
    catch (cause) { error.value = message(cause); return false }
  }
  function confirm(value: boolean) { clearApproval(); if (active.value && value && prepared.value && phase.value === 'prepared' && !busy.value && !dirty.value) { confirmed.value = true; approval = prepared.value } }
  function assertCurrent(bound: Binding, token: number, frozen: AiTaskCreationSubmission) { if (!current(bound, token, frozen) || !supportsDrain(bound) || !equal(build(frozen.input.request.runId), frozen)) throw new AiTaskCreationError('context-changed', 'not-sent') }
  async function settleIo(bound: Binding): Promise<void> {
    try {
      if (!bound.resourceReader.waitForIdle || !bound.jobsReader.waitForIdle || !bound.provider.waitForIdle) throw new Error('missing-drain')
      await Promise.all([bound.provider.waitForIdle(), bound.resourceReader.waitForIdle(), bound.jobsReader.waitForIdle(), ...(bound.artReader ? [bound.artReader.waitForIdle!()] : [])])
    } catch {
      // Failed cleanup is not proof of completed I/O. Keep the global lock, project lane and any fence.
      phase.value = activeFence ? 'unknown' : 'blocked'; error.value = '无法确认请求清理已结束，已保留操作锁；不会继续写入。'
      await new Promise<never>(() => {})
    }
  }
  async function submit(): Promise<AiTaskCreatedEvent | null> {
    if (!canSubmit.value || !binding || !supportsDrain(binding) || !prepared.value || !(resource.value || artConfig.value) || !history.value) return null
    const lease = lane.acquire('原图标任务检查与创建')
    if (!lease) { error.value = '当前工程管理或写操作尚未结束。'; return null }
    const bound = binding, frozen = prepared.value, baseResource = resource.value, baseArt = art.value, baseHistory = history.value, token = epoch, abort = new AbortController()
    controller = abort; busy.value = true; error.value = ''; accepted = null
    try {
      const result = await coordinator.run(async () => {
        let ioSettled = false
        try {
          assertCurrent(bound, token, frozen)
          if (hasPendingAiWrites(storage(), bound.project.id)) throw new AiTaskCreationError('busy', 'not-sent')
          phase.value = 'inspecting'
          inspection.value = freeze(decodeAiTaskInspection(await bound.provider.inspect(bound.project.id, frozen, abort.signal), frozen))
          assertCurrent(bound, token, frozen)
          if (!aiTaskGapAllowsWrite(inspection.value, frozen)) throw new AiTaskCreationError('target-exists', 'not-sent')
          phase.value = 'rechecking'
          const latestArt = await readArt(bound,abort.signal)
          const latestResource = latestArt ? null : decodeAiResourceView(await bound.resourceReader.readConfig(bound.project.id, abort.signal), bound.project.id)
          assertCurrent(bound, token, frozen)
          const latestJobs = decodeAiJobsView(await bound.jobsReader.readJobs(bound.project.id, abort.signal), bound.project.id)
          assertCurrent(bound, token, frozen)
          if(latestResource) savedAiTaskConfig(latestResource, bound.project.id)
          if (!equal(latestArt,baseArt) || !equal(latestResource, baseResource) || !equal(latestJobs, baseHistory) || aiTaskHistoryBlocked(latestJobs)) throw new AiTaskCreationError('context-changed', 'not-sent')
          const inputHash = await aiTaskInputHash(frozen.input.request)
          assertCurrent(bound, token, frozen)
          if (hasPendingAiWrites(storage(), bound.project.id)) throw new AiTaskCreationError('busy', 'not-sent')
          const fence: AiWriteFence = { key: `${bound.project.id}/${frozen.input.request.runId}/${frozen.operation}`, projectId: bound.project.id, jobId: frozen.input.request.runId, operation: frozen.operation, revision: 0, requestHash: inputHash, sourceRevision: frozen.input.request.sourceRevision }
          putAiWriteFence(storage(), fence)
          activeFence = freeze(fence); recovery = { binding: bound, submission: frozen, fence: activeFence }; recovered.value = false; retainedRunId.value = fence.jobId; pending.value = true; dispatching = true; clearApproval(); phase.value = 'submitting'
          const receipt = await validateAiTaskCreatedJob(await bound.provider.execute(bound.project.id, frozen, abort.signal), frozen)
          assertCurrent(bound, token, frozen)
          phase.value = 'readback'
          const observed = await validateAiTaskCreatedJob(await bound.jobsReader.readStatus(bound.project.id, fence.jobId, abort.signal), frozen)
          assertCurrent(bound, token, frozen)
          if (observed.revision < receipt.revision || observed.requestHash !== receipt.requestHash) throw new AiTaskCreationError('invalid-shape')
          await settleIo(bound); ioSettled = true
          assertCurrent(bound, token, frozen)
          const persisted = readAiWriteFences(storage()).find(entry => entry.key === fence.key)
          if (!equal(persisted, fence)) throw new AiWriteCoordinationError()
          removeAiWriteFence(storage(), fence.key); activeFence = null; recovery = null; dispatching = false; refreshFenceState()
          snapshot.value = freeze(observed); history.value = freeze({ ...latestJobs, jobs: [...latestJobs.jobs, observed] }); phase.value = 'accepted'; error.value = ''
          accepted = { snapshot: observed, project: { ...bound.project }, source: bound.source, jobsReader: bound.jobsReader }
          return accepted
        } catch (cause) {
          clearApproval()
          if (activeFence || dispatching) { phase.value = 'unknown'; error.value = unknownMessage }
          else if (current(bound, token)) { phase.value = 'blocked'; error.value = message(cause) }
          if (cause instanceof AiWriteCoordinationError) storageBlocked.value = true
          return null
        } finally {
          // A timeout/abort may have returned before the transport has settled. Hold the common lock.
          if (!ioSettled) await settleIo(bound)
        }
      })
      if (!result.acquired) { phase.value = 'blocked'; error.value = '其他标签页正在执行 AI 操作；本次没有发送。'; clearApproval(); return null }
      return current(bound, token, frozen) ? result.value : null
    } catch (cause) { clearApproval(); error.value = message(cause); phase.value = activeFence ? 'unknown' : 'blocked'; storageBlocked.value = cause instanceof AiWriteCoordinationError; return null }
    finally { lane.release(lease); busy.value = false; if (controller === abort) controller = null; if (!activeFence) dispatching = false }
  }
  async function recoverOriginal(): Promise<AiTaskCreatedEvent | null> {
    if (!canRecover.value || !recovery || !binding || !supportsDrain(binding)) return null
    const saved = recovery, bound = binding, token = epoch, abort = new AbortController(), lease = lane.acquire('原图标任务结果核对')
    if (!lease) return null
    controller = abort; busy.value = true; clearApproval(); error.value = ''; phase.value = 'readback'
    try {
      const result = await coordinator.run(async () => {
        let ioSettled = false
        const matches = () => active.value && binding === bound && epoch === token && recovery === saved && recoveryContextMatches()
        try {
          if (!matches() || !equal(readAiWriteFences(storage()).find(entry => entry.key === saved.fence.key), saved.fence)) throw new AiWriteCoordinationError()
          const observed = await validateAiTaskCreatedJob(await bound.jobsReader.readStatus(bound.project.id, saved.fence.jobId, abort.signal), saved.submission)
          await settleIo(bound); ioSettled = true
          if (!matches() || abort.signal.aborted) throw new AiTaskCreationError('context-changed')
          if (!equal(readAiWriteFences(storage()).find(entry => entry.key === saved.fence.key), saved.fence)) throw new AiWriteCoordinationError()
          removeAiWriteFence(storage(), saved.fence.key); activeFence = null; recovery = null; dispatching = false; refreshFenceState()
          snapshot.value = freeze(observed); recovered.value = true; phase.value = 'accepted'; error.value = ''
          if (history.value) history.value = freeze({ ...history.value, jobs: [...history.value.jobs.filter(job => job.jobId !== observed.jobId), observed] })
          return { snapshot: observed, project: { ...bound.project }, source: bound.source, jobsReader: bound.jobsReader, recovered: true as const }
        } catch (cause) { phase.value = 'unknown'; error.value = `${unknownMessage} ${message(cause)}`; return null }
        finally { if (!ioSettled) await settleIo(bound) }
      })
      if (!result.acquired) { phase.value = 'unknown'; error.value = '其他标签页正在执行 AI 操作，请稍后明确刷新原任务。'; return null }
      return active.value && binding === bound && epoch === token ? result.value : null
    } catch (cause) { phase.value = 'unknown'; error.value = message(cause); return null }
    finally { busy.value = false; lane.release(lease); if (controller === abort) controller = null }
  }
  function newBrief() {
    if (!active.value || busy.value || activeFence || phase.value === 'unknown') return false
    retainedRunId.value = ''; prepared.value = null; inspection.value = null; snapshot.value = null; recovered.value = false; accepted = null; clearApproval(); phase.value = 'ready'; refreshFenceState(); return true
  }
  function storageChanged() { refreshFenceState(); if (busy.value) invalidate(); else clearApproval() }
  function leave() { invalidate(); binding = null; contextVersion.value++ }
  return { active, project, resource, history, brief, config, artConfig, art, output, targetPath, phase, error, confirmed, busy, dirty, pending, pendingRunIds, recovered, storageBlocked, prepared, inspection, snapshot, retainedRunId,
    drainAvailable, canPrepare, canSubmit, canRecover, recoverOriginal, setActive, setContext, edit, returnToBrief, readContext, prepare, confirm, submit, newBrief, storageChanged, leave }
}
