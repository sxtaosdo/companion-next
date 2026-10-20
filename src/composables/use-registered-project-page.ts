import { onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { companionBrowserProvider } from '../companion-browser-integration'
import { useRegisteredProjectStore } from '../stores/registered-project'
import { useCompanionProjectEntry } from './use-companion-project-entry'

/** Reuses normal entry-read policy; passive/editor builds still connect explicitly. */
export function useRegisteredProjectPage() {
  const route = useRoute(), selection = useRegisteredProjectStore(), directory = selection.directory
  // The outgoing component still observes the destination route before it is
  // unmounted. Only this page's route may replace its registered-project intent.
  const ownerPath = route.path
  watch(() => route.query.project, value => {
    if (route.path === ownerPath && !(ownerPath === '/overview' && value === undefined)) selection.restoreRouteProject(value)
  }, { immediate: true, flush: 'sync' })
  watch(companionBrowserProvider, source => {
    if (directory.provider && directory.provider !== source) directory.disconnect()
  }, { immediate: true, flush: 'sync' })
  const visibility = () => directory.setLiveVisibility(document.visibilityState === 'visible')
  visibility()
  document.addEventListener('visibilitychange', visibility)
  useCompanionProjectEntry(directory)
  onBeforeUnmount(() => document.removeEventListener('visibilitychange', visibility))
  return selection
}
