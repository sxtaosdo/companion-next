import {sameResourceDomain} from '../domain/art-resource-domains'
import type { AiResourceConfigV2 } from '../domain/ai-resource-read'
import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { ArtSpecError, parseProjectArtSpec, validateProjectArtBindings, type ArtAuthority, type ArtCategory, type ArtValues, type ProjectArtSpec } from '../domain/project-art-spec'
import { artBindingHash, artCanonical, artPath, artPendingRevision, pendingArtWrite, freezeArtWrite, clearPendingArtWrite, type PendingArtWrite } from '../domain/project-art-pending'
import { ProjectArtSpecWriteError, type ArtInheritanceResolution, type ProjectArtSpecContext, type ProjectArtSpecProvider, type ProjectArtSpecReceipt } from '../project-art-spec-integration'
import {readArtDraft,writeArtDraft,clearArtDraft} from '../domain/project-art-draft'
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
function canonical(value: unknown): string { if (value === null || typeof value !== 'object') return JSON.stringify(value); if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'; return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}' }
function same(a: ProjectArtSpecContext | null, b: ProjectArtSpecContext | null) { return !!a && !!b && a.projectId === b.projectId && a.projectPath === b.projectPath && a.source === b.source && sameResourceDomain(a,b) && a.readOnly===b.readOnly }
function projectArtSpecSetup() {
  const context = shallowRef<ProjectArtSpecContext | null>(null), provider = shallowRef<ProjectArtSpecProvider | null>(null)
  const draft = ref<ProjectArtSpec | null>(null), base = ref<ProjectArtSpec | null>(null), hash = ref<string | null | undefined>(undefined)
  let legacyConfig: AiResourceConfigV2 | null = null
  const legacyVersion = ref<number | null>(null)
  const inheritanceResolution = ref<ArtInheritanceResolution | null>(null)
  const authorities = shallowRef<readonly ArtAuthority[]>([])
  const phase = ref<'idle' | 'reading' | 'editing' | 'saving' | 'saved' | 'unknown' | 'error'>('idle'), message = ref(''), confirmed = ref(false), pending = ref(false)
  type RetainedDraft={context:ProjectArtSpecContext;draft:ProjectArtSpec;storageRaw:string|null;baseHash:string|null|undefined}
  const retained = shallowRef<RetainedDraft | null>(null)
  const draftStorageMessage=ref(''), draftStorageConflict=ref(false)
  let draftStorageRaw:string|null=null
  let draftStorageOwned=false
  const retainedDrafts = new WeakMap<object, Map<string, RetainedDraft>>()
  const draftKey = (value: ProjectArtSpecContext) => JSON.stringify([value.projectId, value.projectPath,value.resourceDomainId??null])
  function retainDraft() {
    if (!dirty.value || !context.value || !draft.value) return
    const value = { context: context.value, draft: copy(draft.value),storageRaw:draftStorageRaw,baseHash:hash.value }
    let entries = retainedDrafts.get(context.value.source)
    if (!entries) { entries = new Map(); retainedDrafts.set(context.value.source, entries) }
    entries.set(draftKey(context.value), value); retained.value = value
  }
  let epoch = 0, controller: AbortController | null = null
  const parentTemplate=ref<ProjectArtSpec|null>(null),projectSettingsHash=ref<string|null>(null)
  const observedPath = ref<string | null>(null)
  const blocked = computed(() => {
    void artPendingRevision.value
    if (!context.value || !provider.value) return false
    try { return !!pendingArtWrite(context.value, provider.value) } catch { return true }
  })
  const errors = computed(() => {
    if (!draft.value || !context.value) return []
    try {
      if (base.value && base.value.inheritance.mode !== 'none') {
        const current = draft.value.inheritance
        if (current.mode === 'none' || current.mode !== base.value.inheritance.mode || base.value.inheritance.usage !== undefined && current.usage !== base.value.inheritance.usage || base.value.inheritance.sources.some(pin => !current.sources.some(item => item.path === pin.path && item.revision === pin.revision))) return ['INHERITANCE_CHANGE_REQUIRES_REVIEW']
      }
      parseProjectArtSpec(draft.value, context.value.projectId); validateProjectArtBindings(draft.value, authorities.value); return [] }
    catch (error) { return [error instanceof ArtSpecError ? `${error.code} · ${error.field}` : '美术规范字段无效'] }
  })
  const dirty = computed(() => !!draft.value && canonical(draft.value) !== canonical(base.value))
  watch(draft, value=>{
    if(!value||base.value||!context.value||!provider.value||hash.value===undefined||draftStorageConflict.value)return
    try{draftStorageRaw=writeArtDraft(context.value,provider.value,hash.value,copy(value),draftStorageRaw);draftStorageMessage.value='草稿已保存在此浏览器，正式规范需确认保存。'}
    catch(error){draftStorageMessage.value=error instanceof Error&&error.message==='draft changed elsewhere'?'此工程的浏览器草稿已在其他页面变化；当前内容仍在页面中，请先核对。':'浏览器未能保存草稿，请暂时保持页面打开。'}
  },{deep:true,flush:'sync'})
  const canSave = computed(() => !!context.value && !context.value.readOnly && !!provider.value && !!draft.value && hash.value !== undefined && !errors.value.length && !pending.value && !blocked.value && confirmed.value && dirty.value)
  function bind(next: ProjectArtSpecContext | null, writer: ProjectArtSpecProvider | null) {
    if (same(context.value, next) && provider.value === writer) return
    retainDraft()
    epoch++; controller?.abort(); pending.value = false; confirmed.value = false
    context.value = next; retained.value = next ? retainedDrafts.get(next.source)?.get(draftKey(next)) ?? null : null; provider.value = writer; draft.value = null; base.value = null; hash.value = undefined; authorities.value = []
    draftStorageMessage.value='';draftStorageConflict.value=false;draftStorageRaw=null;draftStorageOwned=false
    parentTemplate.value=null;projectSettingsHash.value=null;observedPath.value = null; inheritanceResolution.value = null; legacyVersion.value = null; legacyConfig = null
    phase.value = blocked.value ? 'unknown' : 'idle'
    message.value = phase.value === 'unknown' ? '此工程保存结果未知；请回读核对，不能重复保存。' : ''
  }
  function checkedReceipt(raw: ProjectArtSpecReceipt, captured: ProjectArtSpecContext) {
    if (!raw || !sameResourceDomain(raw,captured)||raw.projectId !== captured.projectId || artPath(raw.projectPath) !== artPath(captured.projectPath) || !Array.isArray(raw.authorities) || raw.authorities.length > 8) throw Error('invalid receipt')
    if (raw.inheritanceResolution !== undefined) {
      const resolution = raw.inheritanceResolution
      if (!resolution || !['unlinked', 'not-applicable', 'available'].includes(resolution.state) || !['NO_PROJECT_ASSOCIATION', 'EXPLICIT_NOT_APPLICABLE', 'REVIEWED_SOURCES_AVAILABLE'].includes(resolution.code) || !Array.isArray(resolution.sources) || resolution.sources.length > 8 || resolution.sources.some(pin => !pin || typeof pin.path !== 'string' || !pin.path.startsWith('P0001/') || typeof pin.revision !== 'string' || !/^[a-f0-9]{40}$/.test(pin.revision))) throw Error('invalid inheritance receipt')
    }
    if (raw.config === null) { if (raw.hash !== null) throw Error('invalid missing receipt'); return null }
    if (typeof raw.hash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.hash)) throw Error('invalid receipt hash')
    const parsed=parseProjectArtSpec(raw.config, captured.projectId);if(parsed.kind==='project'&&(!sameResourceDomain(parsed.spec,captured)||captured.resourceDomainId&&parsed.spec.projectSettingsHash!==raw.projectSettingsHash))throw Error('资源域规范内容不匹配');return parsed
  }
  async function read() {
    const captured = context.value, reader = provider.value, revision = epoch
    if (!captured || !reader || pending.value) return
    if (dirty.value && !blocked.value) { message.value = '请先保存当前草稿；刷新未覆盖未保存修改。'; return }
    if (blocked.value) { await recover(); return }
    inheritanceResolution.value = null; pending.value = true; phase.value = 'reading'; confirmed.value = false; hash.value = undefined; legacyVersion.value = null; controller = new AbortController()
    const signal = controller.signal
    const timer = setTimeout(() => { if (revision === epoch) { controller?.abort(); phase.value = 'error'; message.value = '读取等待超时；原读取仍待清理，不发送并发请求。' } }, 20_000)
    try {
      const receipt = await reader.read(captured, signal), parsed = checkedReceipt(receipt, captured)
      if (signal.aborted || revision !== epoch || provider.value !== reader || !same(context.value, captured)) return
      if (dirty.value && draft.value) retained.value = { context: captured, draft: copy(draft.value),storageRaw:draftStorageRaw,baseHash:hash.value }
      if(captured.resourceDomainId){if(!/^[a-f0-9]{64}$/.test(receipt.projectSettingsHash??'')||!receipt.parent)throw Error('缺少工程技术继承');const parent=parseProjectArtSpec(receipt.parent.config,captured.projectId);if(parent.kind!=='project')throw Error('无效工程技术继承');parentTemplate.value=copy(parent.spec);projectSettingsHash.value=receipt.projectSettingsHash!}
      observedPath.value = receipt.projectPath; hash.value = receipt.hash; authorities.value = copy(receipt.authorities); inheritanceResolution.value = copy(receipt.inheritanceResolution ?? null)
      legacyConfig = parsed?.kind === 'legacy-v2' ? copy(parsed.config) : null
      legacyVersion.value = legacyConfig?.version ?? null
      base.value = parsed?.kind === 'project' ? copy(parsed.spec) : null; draft.value = base.value ? copy(base.value) : null
      draftStorageConflict.value=false;draftStorageRaw=null;draftStorageOwned=false
      try { const local=readArtDraft(captured,reader),memory=retained.value;if(memory){draftStorageRaw=memory.storageRaw;if(memory.baseHash!==receipt.hash||(captured.resourceDomainId&&memory.draft.projectSettingsHash!==receipt.projectSettingsHash)){draftStorageConflict.value=true;draftStorageMessage.value='工程规范已发生变化，原浏览器草稿已保留，请先核对工程数据。'}else draftStorageMessage.value='已保留此页面的草稿，打开新建规范时会恢复。'}else if(local){draftStorageRaw=local.raw;if(!base.value&&local.record.baseHash===receipt.hash&&(!captured.resourceDomainId||local.record.draft.projectSettingsHash===receipt.projectSettingsHash)){retained.value={context:captured,draft:copy(local.record.draft),storageRaw:local.raw,baseHash:local.record.baseHash};draftStorageMessage.value='已找到此工程的浏览器草稿，打开新建规范时会恢复。'}else{draftStorageConflict.value=true;draftStorageMessage.value='工程规范已发生变化，原浏览器草稿已保留，请先核对工程数据。'}} }
      catch {draftStorageMessage.value='浏览器草稿无法读取，原数据未删除；请保持页面打开并检查浏览器存储。'}
      phase.value = blocked.value ? 'unknown' : 'editing'
      message.value = blocked.value ? '已回读文件；这不是原保存回执，未知保护仍保留。' : parsed?.kind === 'legacy-v2' ? '读取到旧 v2；旧图标流程保留，未自动迁移。' : parsed ? '已读取工程美术规范。' : '工程尚无美术规范，可新建草稿。'
    } catch { if (revision === epoch) { phase.value = blocked.value ? 'unknown' : 'error'; message.value = '美术规范读取未确认，请重新读取。' } }
    finally { clearTimeout(timer); if (revision === epoch) pending.value = false }
  }
  function startDraft(name: string) {
    if (!context.value || context.value.readOnly || pending.value || blocked.value || draft.value || draftStorageConflict.value) return
    draftStorageOwned=true
    if(context.value.resourceDomainId){if(!parentTemplate.value||!projectSettingsHash.value){message.value='请先读取当前资源域及工程技术继承。';return}const parent=parentTemplate.value;draft.value={schemaVersion:'project-art-spec-v1',projectId:context.value.projectId,resourceDomainId:context.value.resourceDomainId,projectSettingsHash:projectSettingsHash.value,version:1,project:copy(parent.project),...(parent.imageOutput?{imageOutput:parent.imageOutput}:{}),inheritance:copy(parent.inheritance),overrides:{},categories:{}};phase.value='editing';message.value='资源域草稿尚未保存；工程技术只读继承，目录尚未配置。';return}
    // Explicit local candidate; undefined hash still prevents saving until a real read confirms missing.
    draft.value = { schemaVersion: 'project-art-spec-v1', projectId: context.value.projectId, version: 1,
      project: { name, content: '', engine: 'cocos-creator', designResolution: legacyConfig ? { ...legacyConfig.designResolution } : { width: 0, height: 0 } },
      ...(legacyConfig ? {} : { imageOutput: 'transparent-png' as const }),
      inheritance: { mode: 'none', reason: '' }, overrides: legacyConfig ? { width: legacyConfig.iconSize.width, height: legacyConfig.iconSize.height, transparent: legacyConfig.background.transparent, backgroundColor: legacyConfig.background.color, destination: legacyConfig.destination.directory, exportDirectory: legacyConfig.destination.exportDirectory, paddingPercent: legacyConfig.composition.paddingPercent } : { destination: 'assets/art', exportDirectory: 'art/final', transparent: true }, categories: {} }
    { const styles = authorities.value.filter(a => a.kind === 'art-style' && a.allowedUsages.includes('project-art')); if (styles.length) draft.value.inheritance = { mode: 'style', usage: 'project-art', sources: styles.map(a => ({ ...a.source })) } }
    phase.value = 'editing'; message.value = '未保存草稿；请填写项目设定，保存前需读取工程原文件。'
  }
  function setValue(layer: 'project' | ArtCategory, key: keyof ArtValues, value: string | number | boolean) {
    if (!draft.value || pending.value) return
    const target = layer === 'project' ? draft.value.overrides : (draft.value.categories[layer] ??= {})
    if (value === '') delete target[key]; else Object.assign(target, { [key]: value })
    confirmed.value = false; if (!blocked.value) phase.value = 'editing'
  }
  function touch() { confirmed.value = false; if (!blocked.value) phase.value = 'editing' }
  function restoreRetained() {
    if (!retained.value || !same(context.value, retained.value.context) || pending.value || blocked.value || draftStorageConflict.value) return
    if(!base.value)draftStorageOwned=true
    draft.value = copy(retained.value.draft); if (context.value) retainedDrafts.get(context.value.source)?.delete(draftKey(context.value)); retained.value = null; touch()
  }
  function acceptSaved(receipt: ProjectArtSpecReceipt, captured: ProjectArtSpecContext, record: PendingArtWrite) {
    const parsed = checkedReceipt(receipt, captured)
    if (!parsed || parsed.kind !== 'project' || !receipt.operation || receipt.operation.operationId !== record.input.operationId || receipt.operation.bindingHash !== record.bindingHash || receipt.operation.state !== 'completed') throw Error('invalid save receipt')
    const { version, ...saved } = parsed.spec, { version: _submittedVersion, ...submitted } = record.input.config
    // The host owns version allocation, based on the file observed before its CAS write.
    if (artCanonical(saved) !== artCanonical(submitted) || version !== record.baseVersion + 1 || receipt.hash === record.input.expectedHash) throw Error('unconfirmed save receipt')
    validateProjectArtBindings(parsed.spec, receipt.authorities)
    return parsed.spec
  }
  async function recover() {
    const captured = context.value, writer = provider.value, revision = epoch
    if (!captured || !writer || pending.value) return
    pending.value = true; confirmed.value = false; phase.value = 'unknown'; controller = new AbortController()
    const signal = controller.signal, timer = setTimeout(() => controller?.abort(), 20_000)
    try {
      const record = pendingArtWrite(captured, writer)
      if (!record || record.bindingHash !== await artBindingHash(record.projectId, record.projectPath, record.input)) throw Error('invalid frozen binding')
      const state = await writer.status({ ...captured, projectPath: record.projectPath }, record.input.operationId, signal)
      if (signal.aborted || revision !== epoch || writer !== provider.value || !same(context.value, captured)) return
      if (state.resourceDomainId!==captured.resourceDomainId || state.projectId !== record.projectId || artPath(state.projectPath) !== artPath(record.projectPath) || state.operationId !== record.input.operationId || state.bindingHash !== record.bindingHash) throw Error('foreign operation')
      if (state.state === 'pending') { message.value = '原保存仍待确认；不会重新发送。'; return }
      if (state.state === 'rejected') { clearPendingArtWrite(captured, writer, record); hash.value = undefined; phase.value = 'error'; message.value = '原保存已明确拒绝，请重新读取工程再编辑。'; return }
      if (state.state !== 'completed' || !state.receipt) throw Error('unconfirmed original receipt')
      const saved = acceptSaved(state.receipt, captured, record)
      clearPendingArtWrite(captured, writer, record); legacyVersion.value = null; base.value = copy(saved); draft.value = copy(saved); hash.value = state.receipt.hash; authorities.value = copy(state.receipt.authorities); inheritanceResolution.value = copy(state.receipt.inheritanceResolution ?? null); observedPath.value = state.receipt.projectPath
      try{draftStorageMessage.value=clearArtDraft(captured,writer,draftStorageOwned?draftStorageRaw:null)?'':'规范已保存；其他页面更新的草稿已保留。';draftStorageRaw=null;draftStorageOwned=false}catch{draftStorageMessage.value='规范已保存，但浏览器草稿未能清除。'}
      phase.value = 'saved'; message.value = '原保存回执已确认；可重新读取当前工程文件。'
    } catch { if (revision === epoch) { phase.value = 'unknown'; message.value = '原保存结果仍未知，保护保留；未重发保存。' } }
    finally { clearTimeout(timer); if (revision === epoch) pending.value = false }
  }
  async function save() {
    if (!canSave.value || !context.value || !provider.value || !draft.value || hash.value === undefined) return
    const captured = context.value, writer = provider.value, revision = epoch, config = copy(draft.value), expectedHash = hash.value
    pending.value = true; confirmed.value = false; phase.value = 'saving'; controller = new AbortController()
    const signal = controller.signal
    let record: PendingArtWrite | null = null
    const timer = setTimeout(() => { controller?.abort(); if (revision === epoch) { phase.value = 'unknown'; message.value = '保存等待超时，结果未知；只可查询原操作。' } }, 20_000)
    try {
      record = await freezeArtWrite({ ...captured, projectPath: observedPath.value ?? captured.projectPath }, writer, config, expectedHash, base.value?.version ?? legacyVersion.value ?? 0, legacyVersion.value !== null)
      if (signal.aborted || revision !== epoch || writer !== provider.value || !same(context.value, captured)) { clearPendingArtWrite(captured, writer, record); return }
      const receipt = await writer.save({ ...captured, projectPath: record.projectPath }, record.input, signal)
      if (signal.aborted || revision !== epoch || writer !== provider.value || !same(context.value, captured)) return
      const saved = acceptSaved(receipt, captured, record)
      clearPendingArtWrite(captured, writer, record); legacyVersion.value = null; base.value = copy(saved); draft.value = copy(saved); hash.value = receipt.hash; authorities.value = copy(receipt.authorities); inheritanceResolution.value = copy(receipt.inheritanceResolution ?? null); observedPath.value = receipt.projectPath
      try{draftStorageMessage.value=clearArtDraft(captured,writer,draftStorageOwned?draftStorageRaw:null)?'':'规范已保存；其他页面更新的草稿已保留。';draftStorageRaw=null;draftStorageOwned=false}catch{draftStorageMessage.value='规范已保存，但浏览器草稿未能清除。'}
      phase.value = 'saved'; message.value = '已确认保存到工程；尚未生成或导入素材。'
    } catch (error) {
      const notSent = error instanceof ProjectArtSpecWriteError && error.outcome === 'not-sent'
      if (notSent && record) clearPendingArtWrite(captured, writer, record)
      if (revision === epoch) { phase.value = record && !notSent ? 'unknown' : 'error'; message.value = record && !notSent ? '保存结果未知；只查询原操作，不重复发送。' : '未确认保存保护，未发送保存；请检查浏览器存储或重新读取。' }
    } finally { clearTimeout(timer); if (revision === epoch) pending.value = false }
  }
  function leave() { epoch++; controller?.abort(); pending.value = false; confirmed.value = false; if (phase.value === 'saving') { phase.value = 'unknown'; message.value = '保存结果未知，保护保留。' } else if (phase.value === 'reading') phase.value = 'idle'; retainDraft() }
  return { parentTemplate,projectSettingsHash,inheritanceResolution, context, provider, draft, base, legacyVersion, hash, authorities, phase, message, confirmed, pending, retained, blocked, dirty, errors, canSave, draftStorageMessage,draftStorageConflict, bind, read, startDraft, setValue, touch, restoreRetained, save, recover, leave }
}
export const useProjectArtSpecStore=defineStore('project-art-spec-editor',projectArtSpecSetup)
export const useResourceDomainArtSpecStore=defineStore('resource-domain-art-spec-editor',projectArtSpecSetup)
