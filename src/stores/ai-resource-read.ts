import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { AiResourceReadError, decodeAiResourceView, verifyAiReferencePreview, isAiProjectId, isAiReferencePath } from '../domain/ai-resource-read'
import type { AiResourceReadProvider, AiResourceView, AiReferencePreview } from '../domain/ai-resource-read'
export interface AiReadProject { id: string; name: string; path: string }
export const useAiResourceReadStore = defineStore('ai-resource-read', () => {
  const provider = shallowRef<AiResourceReadProvider | null>(null), project = shallowRef<AiReadProject | null>(null)
  const resource = shallowRef<AiResourceView | null>(null), preview = shallowRef<AiReferencePreview | null>(null)
  const loading = ref(false), previewLoading = ref(false), error = ref(''), previewError = ref(''), previewPath = ref(''), observedAt = ref('')
  const references = computed(() => resource.value?.config?.style.references ?? [])
  let contextSource: object | null = null, epoch = 0, previewEpoch = 0
  let configController: AbortController | undefined, previewController: AbortController | undefined
  function clearPreview() { previewEpoch++; previewController?.abort(); previewController = undefined; previewLoading.value = false; preview.value = null; previewPath.value = ''; previewError.value = '' }
  function clearReads() { epoch++; configController?.abort(); configController = undefined; loading.value = false; resource.value = null; observedAt.value = ''; error.value = ''; clearPreview() }
  function setContext(next: AiReadProject | null, source: object | null) {
    const safe = next && source && isAiProjectId(next.id) ? { id: next.id, name: next.name, path: next.path } : null
    if (contextSource !== source || JSON.stringify(project.value) !== JSON.stringify(safe)) { clearReads(); project.value = safe; contextSource = source }
  }
  function invalidateProvider() { clearReads(); provider.value = null }
  function disconnect() { clearReads(); provider.value = null; project.value = null; contextSource = null }
  const message = (cause: unknown) => cause instanceof AiResourceReadError ? new AiResourceReadError(cause.code).message : '只读查询未完成，未显示内部诊断。'
  async function readConfig(next: AiResourceReadProvider) {
    if (!project.value || !contextSource || loading.value) return
    if (provider.value !== next) { clearReads(); provider.value = next }
    clearReads()
    const identity = epoch, id = project.value.id, source = contextSource, controller = new AbortController()
    configController = controller; loading.value = true
    const current = () => identity === epoch && provider.value === next && project.value?.id === id && contextSource === source
    try {
      const value = await next.readConfig(id, controller.signal)
      if (!current()) return
      resource.value = decodeAiResourceView(value, id); observedAt.value = new Date().toISOString()
    } catch (cause) { if (current()) error.value = message(cause) }
    finally { if (current()) { loading.value = false; configController = undefined } }
  }
  async function readPreview(path: string) {
    const active = provider.value, target = project.value, config = resource.value
    if (!active || !target || !config || loading.value || previewLoading.value || !references.value.includes(path) || !isAiReferencePath(path)) return
    clearPreview()
    const identity = epoch, version = previewEpoch, controller = new AbortController()
    previewController = controller; previewLoading.value = true; previewPath.value = path
    const current = () => identity === epoch && version === previewEpoch && active === provider.value && config === resource.value && project.value?.id === target.id
    try {
      const value = await active.previewReference(target.id, path, controller.signal)
      if (!current()) return
      const checked = await verifyAiReferencePreview(value)
      if (current()) preview.value = checked
    } catch (cause) { if (current()) previewError.value = message(cause) }
    finally { if (current()) { previewLoading.value = false; previewController = undefined } }
  }
  function previewDisplayFailed() { preview.value = null; previewError.value = '浏览器未能显示此 PNG；未放宽当前页面安全策略。' }
  return { provider, project, resource, preview, loading, previewLoading, error, previewError, previewPath, observedAt, references, setContext, invalidateProvider, disconnect, clearReads, clearPreview, readConfig, readPreview, previewDisplayFailed }
})
