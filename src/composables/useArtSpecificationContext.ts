import { computed, nextTick, onScopeDispose, watch } from 'vue'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { useProjectArtSpecStore } from '../stores/project-art-spec'
import { useAiResourceReadStore } from '../stores/ai-resource-read'
import { projectArtSpecProvider } from '../project-art-spec-integration'
import { aiResourceReadProvider } from '../ai-resource-read-integration'

export type ArtSpecificationKind = 'unread' | 'reading' | 'missing' | 'configured' | 'error' | 'saving' | 'unknown'
export interface ArtSpecificationState {
  kind: ArtSpecificationKind
  text: string
  tone: 'info' | 'success' | 'warning' | 'danger'
  busy?: boolean
  detail?: string
  legacy?: boolean
}
interface ReadBinding { projectId: string; projectPath: string; source: object; provider: object }
// Shared by all component instances using the same existing Pinia store. Not persisted.
const automaticReads = new WeakMap<object, ReadBinding>()
const sameBinding = (a: ReadBinding | undefined, b: ReadBinding) => !!a && a.projectId === b.projectId && a.projectPath === b.projectPath && a.source === b.source && a.provider === b.provider

/** One shared state projection. Only a newly bound project gets one automatic specification read; never writes or migration. */
export function useArtSpecificationContext() {
  const selection = useRegisteredProjectStore(), art = useProjectArtSpecStore(), resource = useAiResourceReadStore()
  let active = true
  onScopeDispose(() => { active = false })
  watch([() => selection.project, () => selection.currentSource, projectArtSpecProvider, aiResourceReadProvider], () => {
    const project = selection.project, source = selection.currentSource, provider = projectArtSpecProvider.value
    art.bind(project && source ? { projectId: project.id, projectPath: project.path, source } : null, provider)
    resource.setContext(project, source)
    if (resource.provider && resource.provider !== aiResourceReadProvider.value) resource.invalidateProvider()
    if (!project || !source || !provider || art.hash !== undefined || art.dirty || art.pending || art.blocked) return
    const binding = { projectId: project.id, projectPath: project.path, source, provider }
    // Child props and outgoing panels can still call bind/leave in this render.
    // Wait for that lifecycle to settle, then capture the single read attempt.
    void nextTick(() => {
      if (!active || selection.project?.id !== binding.projectId || selection.project.path !== binding.projectPath
        || selection.currentSource !== binding.source || projectArtSpecProvider.value !== binding.provider
        || art.context?.projectId !== binding.projectId || art.context.projectPath !== binding.projectPath
        || art.context.source !== binding.source || art.provider !== binding.provider
        || art.hash !== undefined || art.dirty || art.pending || art.blocked || sameBinding(automaticReads.get(art), binding)) return
      automaticReads.set(art, binding)
      void art.read()
    })
  }, { immediate: true, flush: 'sync' })
  const primaryBound = computed(() => !!selection.project && !!selection.currentSource && !!projectArtSpecProvider.value
    && art.context?.projectId === selection.project.id && art.context.projectPath === selection.project.path
    && art.context.source === selection.currentSource && art.provider === projectArtSpecProvider.value)
  const legacyBound = computed(() => !!selection.project && !!selection.currentSource && !!aiResourceReadProvider.value
    && resource.project?.id === selection.project.id && resource.project.path === selection.project.path
    && resource.project.name === selection.project.name && resource.provider === aiResourceReadProvider.value)
  const specification = computed<ArtSpecificationState>(() => {
    if (!selection.project) return { kind: 'unread', text: '未选择工程', tone: 'info' }
    if (projectArtSpecProvider.value) {
      if (!primaryBound.value) return { kind: 'unread', text: '规范未读取', tone: 'info' }
      if (art.phase === 'saving') return { kind: 'saving', text: '规范保存中', tone: 'info', busy: true }
      if (art.blocked || art.phase === 'unknown') return { kind: 'unknown', text: '规范结果待核对', tone: 'warning', busy: art.pending, detail: art.message }
      if (art.pending) return { kind: 'reading', text: '规范读取中', tone: 'info', busy: true }
      if (art.phase === 'error') return { kind: 'error', text: '规范读取失败', tone: 'danger', detail: art.message }
      if (art.base) return { kind: 'configured', text: '规范已配置', tone: 'success', detail: art.dirty ? '当前有未保存修改；已配置状态以保存版本为准。' : undefined }
      if (art.legacyVersion !== null) return { kind: 'missing', text: '项目规范未配置', tone: 'warning', legacy: true, detail: '仅有旧图标配置，尚未创建项目美术规范。' }
      if (art.hash === null) return { kind: 'missing', text: '规范未配置', tone: 'warning' }
      return { kind: 'unread', text: '规范未读取', tone: 'info' }
    }
    if (!aiResourceReadProvider.value) return { kind: 'unread', text: '规范接口未接入', tone: 'info' }
    if (!legacyBound.value) return { kind: 'unread', text: '规范未读取', tone: 'info' }
    if (resource.loading) return { kind: 'reading', text: '规范读取中', tone: 'info', busy: true }
    if (resource.error) return { kind: 'error', text: '规范读取失败', tone: 'danger', detail: resource.error }
    if (!resource.resource) return { kind: 'unread', text: '规范未读取', tone: 'info' }
    if (resource.resource.state === 'invalid') return { kind: 'error', text: '规范读取失败', tone: 'danger', detail: '旧图标配置校验失败，不能据此判断项目规范未配置。' }
    if (resource.resource.state === 'missing') return { kind: 'missing', text: '规范未配置', tone: 'warning' }
    return { kind: 'missing', text: '项目规范未配置', tone: 'warning', legacy: true, detail: '仅有旧图标配置；项目规范接口尚未接入。' }
  })
  const busy = computed(() => art.pending || resource.loading)
  const canRefresh = computed(() => !!selection.project && !!selection.currentSource && !!(projectArtSpecProvider.value || aiResourceReadProvider.value) && !busy.value && !art.dirty)
  const canCreateSpecification = computed(() => primaryBound.value && specification.value.kind === 'missing' && !art.pending && !art.blocked && !art.draft && !art.base && (art.hash === null || art.legacyVersion !== null))
  const canOpenSpecification = computed(() => primaryBound.value && !art.pending && !!(art.draft || art.base || art.blocked || art.phase === 'unknown'))
  const specificationActionLabel = computed(() => canOpenSpecification.value ? '查看 / 编辑' : canCreateSpecification.value ? '新建美术规范' : null)
  const specificationSource = computed(() => {
    if (primaryBound.value) {
      if (art.dirty) return { text: '有未保存修改', title: '草稿仍保留；公共状态以已保存规范为准。' }
      if (art.base?.inheritance.mode === 'canon') return { text: `v${art.base.version} · P0001`, title: art.base.inheritance.sources.map(pin => `${pin.path} @ ${pin.revision}`).join('；') }
      if (art.base) return { text: `v${art.base.version} · 项目自定义`, title: '独立项目美术设定；未声明继承 P0001。' }
      if (art.legacyVersion !== null) return { text: `旧图标 v${art.legacyVersion}`, title: '旧图标配置不是项目美术规范。' }
    }
    if (!projectArtSpecProvider.value && legacyBound.value && resource.resource?.state === 'valid') return { text: '旧图标配置', title: '尚未读取到项目美术规范，不能作为整个项目已配置的证明。' }
    return null
  })
  async function refresh() {
    if (!canRefresh.value) return
    const id = selection.project!.id, path = selection.project!.path, source = selection.currentSource
    const primary = projectArtSpecProvider.value, legacy = aiResourceReadProvider.value
    if (primary) {
      resource.clearReads()
      await art.read()
      if (selection.project?.id !== id || selection.project.path !== path || selection.currentSource !== source || projectArtSpecProvider.value !== primary || aiResourceReadProvider.value !== legacy) return
      if (art.legacyVersion === null || art.phase === 'error' || art.blocked) return
    }
    if (legacy && aiResourceReadProvider.value === legacy) await resource.readConfig(legacy)
  }
  return { art, resource, specification, specificationSource, canCreateSpecification, canOpenSpecification, specificationActionLabel, busy, canRefresh, refresh }
}
