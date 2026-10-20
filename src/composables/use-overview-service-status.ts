import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, shallowRef, watch } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import { companionBrowserProvider, companionProjectEntryProvider } from '../companion-browser-integration'
import { knowledgeReadProvider } from '../knowledge-read-integration'
import type { KnowledgeServiceStates } from '../domain/knowledge-read'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { useCreatorOperationsStore } from '../stores/creator-operations'
import { useProjectSetupStore } from '../stores/project-setup'
import { useProjectOperationLaneStore } from '../stores/project-operation-lane'

export const OVERVIEW_SERVICE_INTERVAL = 15_000
// Session-only preference: navigation and source replacement must not resume a
// service stream the user explicitly paused. No persistent browser writes.
const useOverviewServicePreferences = defineStore('overview-service-preferences', () => ({ paused: ref(false) }))
/** Display-only status GETs. The overview owner maintains the single project stream. */
export function useOverviewServiceStatus() {
  const directory = useCompanionBrowserStore(), operations = useCreatorOperationsStore()
  const setup = useProjectSetupStore(), lane = useProjectOperationLaneStore()
  const active = ref(false), visible = ref(document.visibilityState === 'visible')
  const { paused: localPaused } = storeToRefs(useOverviewServicePreferences())
  const services = shallowRef<KnowledgeServiceStates | null>(null)
  const observedAt = ref(''), evidenceSource = ref(''), error = ref(''), loading = ref(false), clock = ref(Date.now())
  let disposed = false, generation = 0, timer: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | null = null, pending: Promise<void> | null = null, nextDue = 0
  const source = computed(() => companionBrowserProvider.value)
  const approved = computed(() => import.meta.env.MODE !== 'companion-readonly' && !!source.value
    && source.value === companionProjectEntryProvider.value && source.value.runtimeProbesEnabled !== false)
  const connected = computed(() => approved.value && directory.connected && directory.provider === source.value)
  const blockedReason = computed(() => {
    void setup.registrationReceipt; void setup.setupReceipt; void directory.projectSnapshotRevision
    if (lane.locked) return '工程操作仍在处理中，服务状态待核对。'
    if (source.value && (operations.blocksAutomaticProjectRead(source.value) || setup.blocksAutomaticProjectRead(source.value))) return '请先回工程页完成确认或核对未知结果。'
    // Project/count GETs are independent: the 3s project poll must not abort a
    // slow service GET or turn this 15s cadence into a repeated entry read.
    if (directory.projectPollingPaused) return '工程确认正在进行，服务状态待核对。'
    return ''
  })
  const canRefresh = computed(() => active.value && visible.value && connected.value && !!knowledgeReadProvider.value && !blockedReason.value)
  const paused = computed(() => localPaused.value || !directory.livePreferred)
  const automatic = computed(() => canRefresh.value && !paused.value)
  const stale = computed(() => !!observedAt.value && (!!error.value || !!blockedReason.value || paused.value || !connected.value || !approved.value || !active.value || !visible.value
    || clock.value - Date.parse(observedAt.value) > OVERVIEW_SERVICE_INTERVAL * 3))
  function clearTimer() { if (timer !== undefined) clearTimeout(timer); timer = undefined }
  function cancel() {
    clearTimer(); generation++; controller?.abort(); controller = null; pending = null; loading.value = false
  }
  function reconcile() {
    if (disposed) return
    if (!automatic.value) {
      const interrupted = !!pending
      cancel()
      if (interrupted || !active.value || !visible.value) nextDue = 0
      return
    }
    if (pending || timer !== undefined) return
    const delay = Math.max(0, nextDue - Date.now())
    if (!delay) { void refresh(); return }
    timer = setTimeout(() => { timer = undefined; clock.value = Date.now(); void refresh() }, delay)
  }
  function refresh(): Promise<void> {
    if (pending) return pending
    if (disposed || !canRefresh.value) return Promise.resolve()
    clearTimer()
    const currentSource = source.value, reader = knowledgeReadProvider.value!, identity = ++generation, request = new AbortController()
    controller = request; loading.value = true; clock.value = Date.now(); evidenceSource.value = `${currentSource?.label ?? ''} · ${reader.label}`
    const current = () => !disposed && identity === generation && controller === request && !request.signal.aborted
      && canRefresh.value && source.value === currentSource && knowledgeReadProvider.value === reader
    // Join synchronous provider re-entry and never overlap periodic/manual reads.
    pending = Promise.resolve().then(async () => {
      if (!current()) return
      try {
        const result = await reader.loadServiceStates(request.signal)
        if (current()) {
          services.value = result
          if (result.knowledge || result.model) { error.value = ''; observedAt.value = new Date().toISOString() }
          else error.value = '本次未取得有效服务响应，当前情况未知。'
        }
      } catch {
        if (current()) error.value = '本次服务状态读取失败，当前情况未知。'
      }
    }).finally(() => {
      if (identity !== generation || controller !== request) return
      controller = null; pending = null; loading.value = false; clock.value = Date.now()
      nextDue = Date.now() + OVERVIEW_SERVICE_INTERVAL
      reconcile()
    })
    return pending
  }
  function togglePaused() {
    if (!directory.livePreferred) return
    if (localPaused.value) nextDue = 0
    localPaused.value = !localPaused.value
  }
  watch([source, knowledgeReadProvider], () => {
    cancel(); services.value = null; observedAt.value = ''; evidenceSource.value = ''; error.value = ''; nextDue = 0
    reconcile()
  }, { flush: 'sync' })
  watch([automatic, blockedReason, companionProjectEntryProvider, () => directory.provider, () => directory.connected], reconcile, { flush: 'sync' })
  function visibilityChanged() { visible.value = document.visibilityState === 'visible'; clock.value = Date.now() }
  function activate() { if (!disposed && !active.value) { active.value = true; visible.value = document.visibilityState === 'visible'; nextDue = 0; reconcile() } }
  function deactivate() { active.value = false; cancel(); nextDue = 0 }
  onMounted(() => { document.addEventListener('visibilitychange', visibilityChanged); activate() })
  onActivated(activate)
  onDeactivated(deactivate)
  onBeforeUnmount(() => { disposed = true; deactivate(); document.removeEventListener('visibilitychange', visibilityChanged) })
  return { directory, services, loading, observedAt, evidenceSource, error, stale, blockedReason, approved, connected, canRefresh, paused, localPaused, refresh, togglePaused }
}
