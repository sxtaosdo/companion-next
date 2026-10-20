import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import { companionBrowserProvider, companionEventProvider, companionProjectEntryProvider } from '../companion-browser-integration'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { useProjectSetupStore } from '../stores/project-setup'
import { useProjectOperationLaneStore } from '../stores/project-operation-lane'

/** Own the existing singleton transport only while this overview is active. */
export function useOverviewProjectLive() {
  const directory = useCompanionBrowserStore(), operations = useCreatorOperationsStore()
  const setup = useProjectSetupStore(), lane = useProjectOperationLaneStore()
  const active = ref(true)
  const allowed = computed(() => {
    const source = companionBrowserProvider.value
    // Observe receipt/readback changes as well as the private barrier getters.
    void setup.registrationReceipt; void setup.setupReceipt; void directory.projectSnapshotRevision
    return active.value && !!source && companionProjectEntryProvider.value === source && source.runtimeProbesEnabled !== false
      && directory.provider === source && !!companionEventProvider.value
      && !lane.locked && !directory.projectPollingPaused
      && !operations.blocksAutomaticProjectRead(source) && !setup.blocksAutomaticProjectRead(source)
  })
  function suspendOwnedLive() {
    if (directory.liveEnabled && directory.livePageActive) directory.suspendReads()
  }
  watch(companionEventProvider, source => directory.reconcileLiveProvider(source), { flush: 'sync' })
  watch([allowed, companionEventProvider, () => directory.connected], ([ready, events]) => {
    if (!ready || !events) { suspendOwnedLive(); return }
    directory.setLivePageActive(true)
    directory.ensureLive(events)
  }, { immediate: true, flush: 'post' })
  onActivated(() => { active.value = true })
  onDeactivated(() => { active.value = false; suspendOwnedLive() })
  onBeforeUnmount(() => { active.value = false; suspendOwnedLive() })
}
