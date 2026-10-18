import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import type { CompanionBrowserProvider, ManagedProject } from '../domain/companion-browser'
import type { ToolCatalogEntry, ToolPreset, ToolPresetRead, ToolPresetReadProvider } from '../domain/tool-presets-read'
import { decodeToolCatalog, decodeToolPreset, decodeToolPresetRead, effectiveToolNames } from '../domain/tool-presets-read'
import { ToolPresetDraftError } from '../domain/tool-preset-drafts'
import { decodeToolPresetWriteReceipt, sameToolPreset, ToolPresetWriteError, validateToolPresetWriteContext, validateToolPresetWriteInput } from '../domain/tool-presets-write'
import type { ToolPresetWriteOperation, ToolPresetWriteProvider, ToolPresetWriteReceipt } from '../domain/tool-presets-write'

export interface ToolPresetWriteContext {
  reader: ToolPresetReadProvider | null
  writer: ToolPresetWriteProvider | null
  projectId: string
  registeredProjects: readonly ManagedProject[]
  registrationProvider: CompanionBrowserProvider | null
  expectedRegistrationProvider: CompanionBrowserProvider | null
  registrationRevision: number
  tools: readonly ToolCatalogEntry[]
  presets: readonly ToolPreset[]
  selectedPresetId: string
  previewPresetId: string
  toolsReady: boolean
  presetsReady: boolean
  loading: boolean
  draftRevision: number
}
export interface PreparedToolPresetWrite {
  readonly operation: ToolPresetWriteOperation
  readonly sourceLabel: string
  readonly draftSource: ToolPreset | null
  readonly projectId: string
  readonly projectName: string
  readonly projectPath: string
  readonly registrationLabel: string
  readonly title: string
  readonly added: readonly string[]
  readonly removed: readonly string[]
  readonly revision: number
}
export interface ToolPresetWriteObservation { readonly sourceLabel: string; readonly projectName: string; readonly projectPath: string; readonly registrationLabel: string; readonly projectId: string; readonly snapshot: ToolPresetRead; readonly matches: boolean; readonly message: string }
function freeze<T>(value: T): T { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value) }; return value }
const stale = '来源、工程、草稿或读取快照已改变，请刷新并重新确认。'
const unknown = '持久化结果未知（UNKNOWN）。禁止自动重试；回读只能显示现在的状态，不能证明本次请求成功。'

export const useToolPresetsWriteStore = defineStore('tool-presets-write', () => {
  const plan = shallowRef<PreparedToolPresetWrite | null>(null), attempt = shallowRef<PreparedToolPresetWrite | null>(null)
  const receipt = shallowRef<ToolPresetWriteReceipt | null>(null), observation = shallowRef<ToolPresetWriteObservation | null>(null)
  const status = ref<'idle' | 'review' | 'sending' | 'acknowledged' | 'rejected' | 'unknown'>('idle')
  const error = ref(''), notice = ref(''), inUseProjectIds = shallowRef<readonly string[]>([])
  const sending = ref(false), readingBack = ref(false), needsRefresh = ref(false), revision = ref(0)
  let context: ToolPresetWriteContext | null = null, signature = '', controller: AbortController | null = null, readController: AbortController | null = null
  let writtenTools: readonly ToolCatalogEntry[] | null = null, writtenPresets: readonly ToolPreset[] | null = null
  let attemptReader: ToolPresetReadProvider | null = null, observationVersion = 0
  const locked = computed(() => sending.value || readingBack.value || status.value === 'unknown')
  function fingerprint(next: ToolPresetWriteContext): string { return JSON.stringify([next.projectId, next.registeredProjects, next.registrationRevision, next.tools, next.presets, next.selectedPresetId, next.previewPresetId, next.toolsReady, next.presetsReady, next.loading, next.draftRevision]) }
  function syncContext(next: ToolPresetWriteContext) {
    let nextSignature = ''; try { nextSignature = fingerprint(next) } catch { /* Invalid context stays unusable. */ }
    const same = context && nextSignature && signature === nextSignature && next.reader === context.reader && next.writer === context.writer && next.registrationProvider === context.registrationProvider && next.expectedRegistrationProvider === context.expectedRegistrationProvider && next.tools === context.tools && next.presets === context.presets
    context = { ...next }; signature = nextSignature
    if (same) return
    revision.value++; plan.value = null
    if (status.value === 'review') status.value = 'idle'
    if (sending.value) cancelWait()
    if (needsRefresh.value && next.toolsReady && next.presetsReady && !next.loading && writtenTools !== next.tools && writtenPresets !== next.presets) needsRefresh.value = false
  }
  function guard() { if (context && fingerprint(context) !== signature) syncContext(context) }
  function ready() { return Boolean(context?.reader && context.writer && typeof context.writer.waitForIdle === 'function' && context.toolsReady && context.presetsReady && !context.loading && signature) }
  function message(cause: unknown) {
    if (cause instanceof ToolPresetWriteError) return new ToolPresetWriteError(cause.code, cause.outcome).message
    if (cause instanceof ToolPresetDraftError) return new ToolPresetDraftError(cause.code).message
    return '预设内容或当前目录无法核验，请刷新目录和预设后重试。'
  }
  function prepare(operation: ToolPresetWriteOperation, draftSource?: ToolPreset): PreparedToolPresetWrite | undefined {
    guard(); plan.value = null; error.value = ''
    if (locked.value) { error.value = status.value === 'unknown' ? unknown : '已有操作未结束。'; return }
    if (!ready() || !context || needsRefresh.value) { error.value = '请先读取或刷新当前工具目录和预设；上次写入后必须重新读取。'; return }
    try {
      const checked = validateToolPresetWriteInput({ operation, approved: true }).operation
      validateToolPresetWriteContext(checked, context.tools, { presets: [...context.presets], selectedPresetId: context.selectedPresetId }, context.registeredProjects.map(project => project.id))
      if (checked.kind === 'assign' && (checked.projectId !== context.projectId || !context.registrationProvider || context.registrationProvider !== context.expectedRegistrationProvider || !context.registeredProjects.find(project => project.id === checked.projectId)?.path)) throw new ToolPresetWriteError('invalid-input', 'not-sent')
      const before = checked.kind === 'update' ? checked.before : checked.kind === 'assign' ? checked.previous : checked.kind === 'create' ? checked.source : null
      const after = checked.kind === 'import' ? null : checked.preset
      const oldSet = before ? effectiveToolNames(before, context.tools) : new Set<string>(), newSet = after ? effectiveToolNames(after, context.tools) : new Set<string>()
      const title = { create: '创建自定义工具预设', update: '保存自定义工具预设', import: '导入工具预设到宿主', assign: '保存工程工具范围', delete: '删除未被使用的自定义预设' }[checked.kind]
      const registered = context.registeredProjects.find(project => project.id === context!.projectId)
      const prepared = freeze({ operation: checked, draftSource: draftSource ? decodeToolPreset(draftSource) : null, sourceLabel: context.reader!.label, projectId: context.projectId, projectName: registered?.name ?? '', projectPath: registered?.path ?? '', registrationLabel: context.registrationProvider?.label ?? '登记来源未核验', title,
        added: [...newSet].filter(name => !oldSet.has(name)).sort(), removed: [...oldSet].filter(name => !newSet.has(name)).sort(), revision: revision.value })
      plan.value = prepared; status.value = 'review'; return prepared
    } catch (cause) { error.value = message(cause); return }
  }
  function prepareCreate(draft: ToolPreset) {
    const source = context?.presets.find(item => item.id === context?.previewPresetId)
    if (!source) { error.value = stale; return }
    return prepare({ kind: 'create', source, preset: draft })
  }
  function prepareUpdate(draft: ToolPreset) {
    const before = context?.presets.find(item => item.id === context?.previewPresetId)
    if (!before || before.builtIn) { error.value = 'core/full 内置范围不可修改，请先克隆为自定义预设。'; return }
    return prepare({ kind: 'update', before, preset: { ...draft, id: before.id, builtIn: false } }, draft)
  }
  function prepareRename(name: string) {
    const before = context?.presets.find(item => item.id === context?.previewPresetId)
    if (!before || before.builtIn) { error.value = '内置范围不可改名。'; return }
    return prepare({ kind: 'update', before, preset: { ...before, name: name.trim() } })
  }
  function prepareImport(presets: readonly ToolPreset[]) { return prepare({ kind: 'import', presets: [...presets] }) }
  function prepareAssign() {
    const preset = context?.presets.find(item => item.id === context?.previewPresetId), previous = context?.presets.find(item => item.id === context?.selectedPresetId)
    if (!context?.projectId || !preset || !previous) { error.value = '请先选择并读取一个已登记工程。'; return }
    return prepare({ kind: 'assign', projectId: context.projectId, preset, previous })
  }
  function prepareDelete() {
    const preset = context?.presets.find(item => item.id === context?.previewPresetId)
    if (!preset || preset.builtIn) { error.value = 'core/full 内置范围不可删除。'; return }
    return prepare({ kind: 'delete', preset })
  }
  function dismiss() { plan.value = null; if (status.value === 'review') status.value = 'idle' }
  function cancelWait() {
    if (!sending.value) return
    controller?.abort(); status.value = 'unknown'; notice.value = unknown; plan.value = null
  }
  async function confirm(prepared: PreparedToolPresetWrite, approved: boolean): Promise<boolean> {
    guard(); error.value = ''
    if (!approved || prepared !== plan.value || prepared.revision !== revision.value || locked.value || !ready() || !context) { error.value = '请重新核对本次完整来源、目标和内容，并明确确认。'; return false }
    try { validateToolPresetWriteContext(prepared.operation, context.tools, { presets: [...context.presets], selectedPresetId: context.selectedPresetId }, context.registeredProjects.map(project => project.id)) }
    catch (cause) { dismiss(); error.value = message(cause); return false }
    const writer = context.writer!, localController = new AbortController()
    controller = localController; sending.value = true; status.value = 'sending'; attempt.value = prepared; attemptReader = context.reader
    writtenTools = context.tools; writtenPresets = context.presets; needsRefresh.value = true
    receipt.value = null; observation.value = null; observationVersion++; inUseProjectIds.value = []; notice.value = ''; plan.value = null
    let pending: Promise<ToolPresetWriteReceipt> | undefined
    try {
      pending = writer.execute({ operation: prepared.operation, approved: true }, localController.signal)
      const result = await pending
      if (localController.signal.aborted) throw new ToolPresetWriteError('aborted', 'unknown')
      const checked = result.kind === 'deleted' ? decodeToolPresetWriteReceipt({ deleted: true, projectIds: result.projectIds }, prepared.operation) : decodeToolPresetWriteReceipt(result.preset, prepared.operation)
      if (result.kind === 'preset' && (checked.kind !== 'preset' || result.batchSize !== checked.batchSize)) throw new ToolPresetWriteError('invalid-shape', 'unknown')
      if (prepared.operation.kind === 'create' && checked.kind === 'preset' && context.presets.some(item => item.id === checked.preset.id)) throw new ToolPresetWriteError('invalid-shape', 'unknown')
      receipt.value = freeze(checked); status.value = 'acknowledged'
      notice.value = prepared.operation.kind === 'import' ? '宿主返回导入回执，仅包含批次首项；请显式回读核对完整批次。' : prepared.operation.kind === 'assign' ? '宿主已返回工程范围保存回执；已连接的 MCP 客户端需重连后生效。工具范围不会提升 Creator 权限。' : '宿主已返回本次持久化回执；请刷新核对。已连接的 MCP 客户端需重连后使用更新范围。'
      return true
    } catch (cause) {
      const failure = cause instanceof ToolPresetWriteError ? cause : new ToolPresetWriteError('unconfirmed', 'unknown')
      status.value = failure.outcome === 'unknown' || localController.signal.aborted && failure.outcome !== 'not-sent' ? 'unknown' : 'rejected'
      notice.value = status.value === 'unknown' ? unknown : failure.message
      error.value = message(failure); inUseProjectIds.value = failure.code === 'in-use' ? failure.projectIds : []
      return false
    } finally {
      try {
        await Promise.all([pending?.then(() => undefined, () => undefined), writer.waitForIdle()])
        sending.value = false; if (controller === localController) controller = null
      } catch { status.value = 'unknown'; notice.value = unknown /* Retain lane when actual I/O settlement is unproven. */ }
    }
  }
  /** Explicit read-only observation on the attempt's frozen source and project. It never changes the recorded outcome. */
  async function readBack() {
    if (!attempt.value || !attemptReader || sending.value || readingBack.value) return
    const frozenAttempt = attempt.value, reader = attemptReader, local = new AbortController(), version = ++observationVersion
    readController = local; readingBack.value = true; observation.value = null; error.value = ''
    const pending: Promise<unknown>[] = []
    try {
      const toolsRead = reader.loadTools(local.signal); pending.push(toolsRead)
      const presetsRead = reader.loadPresets(frozenAttempt.projectId || undefined, local.signal); pending.push(presetsRead)
      const [tools, result] = await Promise.all([toolsRead, presetsRead])
      if (local.signal.aborted || version !== observationVersion) return
      const catalog = decodeToolCatalog(tools), snapshot = decodeToolPresetRead(result)
      for (const preset of snapshot.presets) effectiveToolNames(preset, catalog)
      const op = frozenAttempt.operation
      const matches = op.kind === 'delete' ? !snapshot.presets.some(item => item.id === op.preset.id)
        : op.kind === 'import' ? op.presets.every(preset => snapshot.presets.some(item => sameToolPreset(item, preset)))
          : op.kind === 'assign' ? snapshot.selectedPresetId === op.preset.id && snapshot.presets.some(item => sameToolPreset(item, op.preset))
            : op.kind === 'update' ? snapshot.presets.some(item => sameToolPreset(item, op.preset, ['updatedAt']))
              : receipt.value?.kind === 'preset' ? snapshot.presets.some(item => sameToolPreset(item, receipt.value!.kind === 'preset' ? receipt.value!.preset : op.preset))
                : snapshot.presets.some(item => sameToolPreset(item, op.preset, ['id', 'updatedAt']))
      observation.value = freeze({ sourceLabel: frozenAttempt.sourceLabel, projectName: frozenAttempt.projectName, projectPath: frozenAttempt.projectPath, registrationLabel: frozenAttempt.registrationLabel, projectId: frozenAttempt.projectId, snapshot, matches, message: `${matches ? '当前快照与预期一致' : '当前快照与预期不一致或无法对应'}；回读不证明本次请求成功，也不解除跨页面并发风险。` })
    } catch { if (version === observationVersion) error.value = '显式回读未完成；原操作结果保持不变，未自动重试写入。' }
    finally {
      // One rejection does not settle the other reader's underlying I/O.
      await Promise.allSettled(pending)
      if (readController === local) { readingBack.value = false; readController = null }
    }
  }
  function acknowledgeUnknown(approved: boolean): boolean {
    if (!approved || status.value !== 'unknown' || !observation.value || sending.value || readingBack.value) return false
    status.value = 'idle'; notice.value = '你已确认自行核查未知操作。原操作仍为结果未知；新操作必须刷新目录和预设，重新逐项确认。'; error.value = ''; needsRefresh.value = true
    writtenTools = context?.tools ?? null; writtenPresets = context?.presets ?? null
    return true
  }
  function leave() { dismiss(); cancelWait(); readController?.abort(); observationVersion++; context = null; signature = ''; revision.value++ }
  return { plan, attempt, receipt, observation, status, error, notice, inUseProjectIds, sending, readingBack, needsRefresh, locked, revision, syncContext, prepareCreate, prepareUpdate, prepareRename, prepareImport, prepareAssign, prepareDelete, dismiss, confirm, cancelWait, readBack, acknowledgeUnknown, leave }
})
