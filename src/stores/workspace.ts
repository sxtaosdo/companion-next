import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { emptySnapshot } from '../domain/contracts'
import type { ConnectionState, DataMode, LocalSpecDraft, ProjectSpec, ReadOnlyCompanionProvider } from '../domain/contracts'
import { demoProvider } from '../providers/demo'
import { draftKey, readDraft, writeDraft } from '../domain/drafts'
export const useWorkspaceStore = defineStore('workspace', () => {
  const mode = ref<DataMode>('disconnected')
  const connection = ref<ConnectionState>('disconnected')
  const snapshot = shallowRef(emptySnapshot())
  const selectedProjectId = ref('')
  const error = ref('')
  const loading = computed(() => connection.value === 'loading')
  const localDraft = shallowRef<LocalSpecDraft | null>(null)
  let provider: ReadOnlyCompanionProvider | null = null
  let controller: AbortController | null = null
  let requestVersion = 0
  const project = computed(() => snapshot.value.projects.find((p) => p.id === selectedProjectId.value))
  const resources = computed(() => snapshot.value.resources.filter((r) => r.projectId === selectedProjectId.value))
  const spec = computed(() => localDraft.value?.spec ?? project.value?.spec)
  const resourceInventoryKnown = computed(() => snapshot.value.resourceCoverage === 'complete')
  const isDemo = computed(() => mode.value === 'demo')
  const sourceLabel = computed(() => mode.value === 'demo' ? '示例模式' : mode.value === 'live' ? (connection.value === 'connected' ? '真实数据 · 只读' : '真实连接未就绪') : '未连接')
  function selectProject(id: string) {
    if (!snapshot.value.projects.some((p) => p.id === id)) return
    selectedProjectId.value = id
    try { localDraft.value = mode.value !== 'disconnected' ? readDraft(localStorage, mode.value, id) : null } catch { localDraft.value = null }
  }
  async function connect(next: ReadOnlyCompanionProvider) {
    controller?.abort()
    const version = ++requestVersion
    controller = new AbortController()
    provider = next
    const previousProjectId = selectedProjectId.value
    selectedProjectId.value = ''
    mode.value = next.mode
    connection.value = 'loading'
    error.value = ''
    snapshot.value = emptySnapshot()
    localDraft.value = null
    try {
      const data = await next.loadSnapshot(controller.signal)
      if (version !== requestVersion) return
      snapshot.value = data
      connection.value = 'connected'
      selectProject(data.projects.some((p) => p.id === previousProjectId) ? previousProjectId : (data.projects[0]?.id ?? ''))
    } catch (cause) {
      if (version !== requestVersion) return
      connection.value = 'error'
      error.value = cause instanceof Error ? cause.message : '只读读取失败'
      selectedProjectId.value = ''
    }
  }
  function disconnect() {
    ++requestVersion
    controller?.abort()
    provider = null
    mode.value = 'disconnected'
    connection.value = 'disconnected'
    selectedProjectId.value = ''
    snapshot.value = emptySnapshot()
    localDraft.value = null
    error.value = ''
  }
  async function refresh() { if (provider) await connect(provider) }
  async function openDemo() { await connect(demoProvider) }
  function reloadLocalDraft() {
    if (project.value) selectProject(project.value.id)
  }
  async function saveLocalSpec(next: ProjectSpec, expectedRevision: string | null = localDraft.value?.revision ?? null) {
    if (!project.value || mode.value === 'disconnected') throw new Error('请先选择项目')
    const projectId = project.value.id
    const sourceMode = mode.value
    // Fail closed: localStorage compare/write is not atomic across tabs by itself.
    if (typeof navigator === 'undefined' || !navigator.locks?.request) throw new Error('此浏览器不支持跨页写锁，本地草稿未保存。请使用支持 Web Locks 的浏览器；当前表单内容仍保留。')
    const save = () => writeDraft(localStorage, sourceMode, projectId, next, expectedRevision)
    const draft = await navigator.locks.request(draftKey(sourceMode, projectId), save)
    if (selectedProjectId.value === projectId && mode.value === sourceMode) localDraft.value = draft
  }
  return { mode, connection, snapshot, selectedProjectId, error, loading, localDraft, project, resources, spec, isDemo, resourceInventoryKnown, sourceLabel, selectProject, connect, disconnect, refresh, openDemo, saveLocalSpec, reloadLocalDraft }
})
