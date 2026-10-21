import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, toRaw, watch } from 'vue'
import { companionBrowserProvider, companionProjectEntryProvider, companionEventProvider } from '../companion-browser-integration'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { useProjectSetupStore } from '../stores/project-setup'
import { useProjectOperationLaneStore } from '../stores/project-operation-lane'
import type { DashboardProject, CompanionBrowserProvider } from '../domain/companion-browser'
// App/store and source-bound memory only. The retained project-array identity also
// invalidates a disconnected/reconnected session, even while this page is absent.
const retained = new WeakMap<object, { source: CompanionBrowserProvider; projects: object; data: DashboardProject[] }>()
/** One bounded existing Dashboard GET per source/page entry, never a discovery registration or poll. */
export function useOverviewRecentProjects() {
  const directory = useCompanionBrowserStore(), operations = useCreatorOperationsStore(), setup = useProjectSetupStore(), lane = useProjectOperationLaneStore()
  const owner = toRaw(directory), cached = retained.get(owner), source = companionBrowserProvider.value
  const restored = !!(cached && cached.source === source && directory.provider === source && directory.connected && cached.projects === directory.projects)
  const initial = restored ? cached!.data : []
  const observed = ref(restored)
  const active = ref(true), data = shallowRef<DashboardProject[]>(initial), loading = ref(false), error = ref('')
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
  watch([companionBrowserProvider, () => directory.provider, () => directory.connected], () => {
    if (directory.connected && directory.provider === companionBrowserProvider.value && retained.get(owner)?.source === directory.provider) return
    cancel(); attempted = null; data.value = []; observed.value = false; error.value = ''; retained.delete(owner)
  }, { flush: 'sync' })
  watch([allowed, companionBrowserProvider], ([ready]) => {
    if (!ready) { cancel(); return }
    const source = companionBrowserProvider.value!
    if (attempted === source) return
    attempted = source; const request = new AbortController(), identity = ++generation
    controller = request; loading.value = true
    void source.loadDashboardProjects!(request.signal).then(result => {
      if (identity === generation && !request.signal.aborted && allowed.value && source === directory.provider && source === companionBrowserProvider.value) {
        data.value = result; observed.value = true
        retained.set(owner, { source, projects: directory.projects, data: result })
      }
    }).catch(() => { if (identity === generation && !request.signal.aborted) error.value = data.value.length ? '最近打开时间未更新，保留上次已读取顺序' : '最近打开时间未读取，按稳定顺序显示' })
      .finally(() => { if (identity === generation) { loading.value = false; controller = undefined } })
  }, { immediate: true, flush: 'post' })
  onActivated(() => { active.value = true })
  onDeactivated(() => { active.value = false; cancel(); attempted = null })
  onBeforeUnmount(cancel)
  return { data, observed, loading, error, canRealtime, toggleRealtime }
}
