import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue'
import { companionBrowserProvider, companionProjectEntryProvider, companionEventProvider } from '../companion-browser-integration'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { useProjectSetupStore } from '../stores/project-setup'
import { useProjectOperationLaneStore } from '../stores/project-operation-lane'
import type { DashboardProject, CompanionBrowserProvider } from '../domain/companion-browser'
/** One bounded existing Dashboard GET per source/page entry, never a discovery registration or poll. */
export function useOverviewRecentProjects() {
  const directory = useCompanionBrowserStore(), operations = useCreatorOperationsStore(), setup = useProjectSetupStore(), lane = useProjectOperationLaneStore()
  const active = ref(true), data = shallowRef<DashboardProject[]>([]), loading = ref(false), error = ref('')
  let attempted: CompanionBrowserProvider | null = null, controller: AbortController | undefined, generation = 0
  const canRead = computed(() => {
    const source = companionBrowserProvider.value
    void setup.registrationReceipt; void setup.setupReceipt; void directory.projectSnapshotRevision
    return active.value && directory.liveVisible && directory.connected && source === directory.provider
      && companionProjectEntryProvider.value === source && !!source?.loadDashboardProjects && source.runtimeProbesEnabled !== false
      && !directory.projectPollingPaused && !lane.locked && !operations.blocksAutomaticProjectRead(source) && !setup.blocksAutomaticProjectRead(source)
  })
  const allowed = computed(() => canRead.value && directory.livePreferred)
  const canRealtime = computed(() => canRead.value && !!companionEventProvider.value)
  function toggleRealtime() {
    if (directory.livePreferred) directory.stopLive()
    else if (canRealtime.value && companionEventProvider.value) directory.startLive(companionEventProvider.value)
  }
  function cancel() { if (loading.value) attempted = null; generation++; controller?.abort(); controller = undefined; loading.value = false }
  watch(companionBrowserProvider, () => { cancel(); attempted = null; data.value = []; error.value = '' }, { flush: 'sync' })
  watch([allowed, companionBrowserProvider], ([ready]) => {
    if (!ready) { cancel(); return }
    const source = companionBrowserProvider.value!
    if (attempted === source) return
    attempted = source; const request = new AbortController(), identity = ++generation
    controller = request; loading.value = true
    void source.loadDashboardProjects!(request.signal).then(result => {
      if (identity === generation && !request.signal.aborted && allowed.value && source === directory.provider && source === companionBrowserProvider.value) data.value = result
    }).catch(() => { if (identity === generation && !request.signal.aborted) error.value = '最近使用时间未读取，按登记顺序显示' })
      .finally(() => { if (identity === generation) { loading.value = false; controller = undefined } })
  }, { immediate: true, flush: 'post' })
  onActivated(() => { active.value = true })
  onDeactivated(() => { active.value = false; cancel(); attempted = null })
  onBeforeUnmount(cancel)
  return { data, loading, error, canRealtime, toggleRealtime }
}
