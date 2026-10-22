import { computed, watch } from 'vue'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { useProjectArtSpecStore } from '../stores/project-art-spec'
import { useAiResourceReadStore } from '../stores/ai-resource-read'
import { projectArtSpecProvider } from '../project-art-spec-integration'
import { aiResourceReadProvider } from '../ai-resource-read-integration'

/** Shared read context only. No automatic reads, writes, generation or editor actions. */
export function useArtSpecificationContext() {
  const selection = useRegisteredProjectStore(), art = useProjectArtSpecStore(), resource = useAiResourceReadStore()
  watch([() => selection.project, () => selection.currentSource, projectArtSpecProvider, aiResourceReadProvider], () => {
    const project = selection.project, source = selection.currentSource
    art.bind(project && source ? { projectId: project.id, projectPath: project.path, source } : null, projectArtSpecProvider.value)
    resource.setContext(project, source)
    if (resource.provider && resource.provider !== aiResourceReadProvider.value) resource.invalidateProvider()
  }, { immediate: true, flush: 'sync' })
  const busy = computed(() => art.pending || resource.loading)
  const canRefresh = computed(() => !!selection.project && !!selection.currentSource && !!(projectArtSpecProvider.value || aiResourceReadProvider.value) && !busy.value && !art.dirty)
  async function refresh() {
    if (!canRefresh.value) return
    const id = selection.project!.id, path = selection.project!.path, source = selection.currentSource
    if (projectArtSpecProvider.value) {
      resource.clearReads()
      await art.read()
      if (selection.project?.id !== id || selection.project.path !== path || selection.currentSource !== source) return
      if (art.legacyVersion === null || art.phase === 'error' || art.blocked) return
    }
    if (aiResourceReadProvider.value) await resource.readConfig(aiResourceReadProvider.value)
  }
  return { art, resource, busy, canRefresh, refresh }
}
