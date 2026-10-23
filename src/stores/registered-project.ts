import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { companionBrowserProvider } from '../companion-browser-integration'
import type { CompanionBrowserProvider } from '../domain/companion-browser'
import { useCompanionBrowserStore } from './companion-browser'

/** UI selection only. Registration remains owned by the original read store.
 * The route is an intent to select, never proof that a project exists. */
export const useRegisteredProjectStore = defineStore('registered-project', () => {
  const directory = useCompanionBrowserStore()
  const requestedId = ref(''), boundPath = ref<string | null>(null), invalidated = ref(false)
  const boundSource = shallowRef<CompanionBrowserProvider | null>(null)
  const currentSource = computed(() => directory.connected && directory.provider && directory.provider === companionBrowserProvider.value ? directory.provider : null)
  const projects = computed(() => currentSource.value ? directory.projects : [])
  const project = computed(() => {
    if (invalidated.value || !currentSource.value || boundSource.value !== currentSource.value) return null
    return projects.value.find(item => item.id === requestedId.value && item.path === boundPath.value) ?? null
  })
  const status = computed(() => project.value ? directory.statuses.find(item => item.projectId === project.value!.id) : undefined)

  let defaultFirst = false
  function restoreRouteProject(value: unknown, selectFirst = false) {
    defaultFirst = selectFirst && value === undefined
    const nextId = typeof value === 'string' && value.length <= 128 ? value : ''
    // Returning to the same verified project must not transiently unbind draft owners.
    if (!invalidated.value && nextId === requestedId.value && boundSource.value === companionBrowserProvider.value && project.value) return
    requestedId.value = nextId
    boundSource.value = companionBrowserProvider.value
    boundPath.value = null
    invalidated.value = false
    resolveSelection()
  }
  function resolveSelection() {
    if (invalidated.value || !currentSource.value || boundSource.value !== currentSource.value) return
    if (!requestedId.value && defaultFirst && projects.value.length) {
      requestedId.value = projects.value[0]!.id
      defaultFirst = false
    }
    if (!requestedId.value) return
    const target = projects.value.find(item => item.id === requestedId.value)
    // A new deep link may precede its entry read: absence from an older
    // snapshot is not proof that the requested registration does not exist.
    // Once bound, removal or a changed path requires explicit reselection.
    if (!target) {
      if (boundPath.value !== null) invalidated.value = true
      return
    }
    if (boundPath.value !== null && boundPath.value !== target.path) {
      invalidated.value = true
      return
    }
    boundPath.value = target.path
  }
  watch([() => directory.projects, currentSource], resolveSelection, { flush: 'sync' })
  watch(companionBrowserProvider, () => { if (requestedId.value) invalidated.value = true }, { flush: 'sync' })
  return { directory, requestedId, projects, project, status, currentSource, invalidated, restoreRouteProject }
})
