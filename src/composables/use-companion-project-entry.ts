import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, watch } from 'vue'
import { companionBrowserProvider, companionProjectEntryProvider } from '../companion-browser-integration'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { useProjectSetupStore } from '../stores/project-setup'
import { useProjectOperationLaneStore } from '../stores/project-operation-lane'

/** Normal-workspace entry refresh only. No setup, mutation, SSE or retry loop. */
export function useCompanionProjectEntry(store: ReturnType<typeof useCompanionBrowserStore>, isProjectTab?: () => boolean) {
  const operations = useCreatorOperationsStore(), setup = useProjectSetupStore(), lane = useProjectOperationLaneStore()
  let active = false, disposed = false, attempted = false, stoppedByUser = false, generation = 0
  let controller: AbortController | undefined
  function cancel() { generation++; controller?.abort(); controller = undefined }
  function read() {
    const source = companionBrowserProvider.value
    if (!active || disposed || attempted || stoppedByUser || !store.liveVisible || !source
      || companionProjectEntryProvider.value !== source || source.runtimeProbesEnabled === false) return
    // A blocked entry is consumed. Releasing a confirmation, lane or error barrier
    // never creates an unsolicited read or a failure/retry loop.
    attempted = true
    // Explicit live work owns the return snapshot and open-time count read.
    if (store.liveEnabled && store.livePageActive && store.connected && store.provider === source) return
    if (store.projectLoading || store.countsLoading || store.projectPollingPaused || lane.locked
      || operations.blocksAutomaticProjectRead(source) || setup.blocksAutomaticProjectRead(source)) return
    const current = new AbortController()
    controller = current
    void store.readProjectEntry(source, current.signal).finally(() => {
      if (controller === current) controller = undefined
    })
  }
  function enter() {
    if (active || disposed) return
    active = true; attempted = false; stoppedByUser = false
    read()
  }
  function leave() { active = false; attempted = false; cancel() }
  function sourceChanged() {
    cancel(); attempted = false
    const identity = generation
    // Wait until synchronous composition-root disconnects and registration have
    // finished. A -> B -> A still cancels the original in-flight observation.
    void nextTick(() => { if (identity === generation) read() })
  }
  watch(companionBrowserProvider, () => { stoppedByUser = false; sourceChanged() }, { flush: 'sync' })
  watch(companionProjectEntryProvider, sourceChanged, { flush: 'sync' })
  watch(() => store.liveVisible, visible => {
    cancel(); attempted = false
    // setLiveVisibility also cancels/resumes explicitly enabled live work. Start
    // only after that synchronous cleanup, never inside its visibility setter.
    const identity = generation
    if (visible) void nextTick(() => { if (identity === generation) read() })
  }, { flush: 'sync' })
  if (isProjectTab) watch(isProjectTab, (projectTab, previous) => {
    if (!projectTab || previous) return
    cancel(); attempted = false
    const identity = generation
    void nextTick(() => { if (identity === generation) read() })
  }, { flush: 'sync' })
  const stopActions = store.$onAction(({ name }) => {
    if (name === 'disconnect') { stoppedByUser = true; cancel() }
    if (name === 'connect') { stoppedByUser = false; attempted = true }
  })
  onMounted(enter)
  onActivated(enter)
  onDeactivated(leave)
  onBeforeUnmount(() => { disposed = true; leave(); stopActions() })
}
