import { computed, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import type { CompanionBrowserProvider, ProjectRead } from '../domain/companion-browser'
import type { KnowledgeReadProvider, KnowledgeServiceStates } from '../domain/knowledge-read'
import { useCompanionBrowserStore } from './companion-browser'
import { useCreatorOperationsStore } from './creator-operations'
import { useProjectSetupStore } from './project-setup'
import { useProjectOperationLaneStore } from './project-operation-lane'

/** Display-only reads. Never advance the operation stores' project readback revision:
 * a services refresh is not the user's reconciliation of an UNKNOWN operation. */
export const useServiceStatusStore = defineStore('service-status', () => {
  const directory = useCompanionBrowserStore(), operations = useCreatorOperationsStore()
  const setup = useProjectSetupStore(), lane = useProjectOperationLaneStore()
  const projectProvider = shallowRef<CompanionBrowserProvider | null>(null)
  const knowledgeProvider = shallowRef<KnowledgeReadProvider | null>(null)
  const passive = ref(false)
  const projects = shallowRef<ProjectRead | null>(null)
  const services = shallowRef<KnowledgeServiceStates | null>(null)
  const projectObservedAt = ref(''), serviceObservedAt = ref('')
  const projectError = ref(''), serviceError = ref('')
  const projectLoading = ref(false), serviceLoading = ref(false)
  const loading = computed(() => projectLoading.value || serviceLoading.value)
  const canReadProjects = computed(() => !!projectProvider.value && (!passive.value || projectProvider.value.runtimeProbesEnabled === false))
  const canReadServices = computed(() => !passive.value && !!knowledgeProvider.value)
  const hasSource = computed(() => canReadProjects.value || canReadServices.value)
  function blockingReason() {
    if (lane.locked) return '工程操作仍在处理中，请完成后重新读取。'
    const source = projectProvider.value
    if (source && (operations.blocksAutomaticProjectRead(source) || setup.blocksAutomaticProjectRead(source))) return '请先回工程页完成确认或核对未知结果。'
    if (directory.projectLoading || directory.countsLoading || directory.projectPollingPaused) return '工程读取或确认正在进行，请稍后重新读取。'
    return ''
  }
  const blockedReason = computed(() => {
    // Setup's readback barriers are private; these public observations also
    // invalidate the guard when a receipt or explicit readback changes.
    void setup.registrationReceipt; void setup.setupReceipt; void directory.projectSnapshotRevision
    return blockingReason()
  })
  let generation = 0, controller: AbortController | null = null, pending: Promise<void> | null = null

  function cancelReads() {
    generation++
    controller?.abort(); controller = null; pending = null
    projectLoading.value = false; serviceLoading.value = false
  }
  function clear() {
    projects.value = null; services.value = null
    projectObservedAt.value = ''; serviceObservedAt.value = ''
    projectError.value = ''; serviceError.value = ''
  }
  /** Registration is inert. A changed source must never inherit another source's evidence. */
  function bind(project: CompanionBrowserProvider | null, knowledge: KnowledgeReadProvider | null, options: { passive?: boolean } = {}) {
    const isPassive = options.passive === true || project?.runtimeProbesEnabled === false
    const safeKnowledge = isPassive ? null : knowledge
    if (projectProvider.value === project && knowledgeProvider.value === safeKnowledge && passive.value === isPassive) return
    cancelReads(); clear()
    projectProvider.value = project; knowledgeProvider.value = safeKnowledge; passive.value = isPassive
  }
  function refresh(): Promise<void> {
    if (pending) return pending
    if (!hasSource.value || blockingReason()) { clear(); return Promise.resolve() }
    const project = canReadProjects.value ? projectProvider.value : null
    const knowledge = canReadServices.value ? knowledgeProvider.value : null
    const identity = ++generation, request = new AbortController()
    controller = request
    clear(); projectLoading.value = !!project; serviceLoading.value = !!knowledge
    const owned = () => generation === identity && controller === request && !request.signal.aborted
    const current = () => owned() && !blockingReason()
    // Start in a microtask so even a synchronously re-entrant provider joins this flight.
    pending = Promise.resolve().then(async () => {
      if (!current()) return
      await Promise.all([
        project ? (async () => {
          if (!current()) return
          try {
            const value = await project.loadProjects(request.signal)
            if (current()) { projects.value = value; projectObservedAt.value = new Date().toISOString() }
          } catch {
            if (current()) projectError.value = '工程状态读取失败，请重试。'
          } finally { if (current()) projectLoading.value = false }
        })() : Promise.resolve(),
        knowledge ? (async () => {
          if (!current()) return
          try {
            // status() also runs CLI/sync checks and is deliberately outside this page.
            const value = await knowledge.loadServiceStates(request.signal)
            if (current()) { services.value = value; serviceObservedAt.value = new Date().toISOString() }
          } catch {
            if (current()) serviceError.value = '知识与模型服务状态读取失败，请重试。'
          } finally { if (current()) serviceLoading.value = false }
        })() : Promise.resolve(),
      ])
    }).finally(() => {
      if (owned()) {
        if (blockingReason()) clear()
        controller = null; pending = null; projectLoading.value = false; serviceLoading.value = false
      }
    })
    return pending
  }
  watch(blockedReason, reason => { if (reason) { cancelReads(); clear() } }, { flush: 'sync' })
  return { blockedReason, projectProvider, knowledgeProvider, passive, projects, services, projectObservedAt, serviceObservedAt,
    projectError, serviceError, projectLoading, serviceLoading, loading, hasSource, canReadProjects, canReadServices, bind, refresh, cancelReads }
})
