import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { createSameOriginImageReviewProvider } from '../src/adapters/image-review'
import type { ReviewFetch } from '../src/adapters/image-review'
import { imageReviewProvider, registerImageReviewProvider } from '../src/image-review-integration'
import { useImageReviewStore } from '../src/stores/image-review'
import ImageAssetsView from '../src/views/ImageAssetsView.vue'

const taskId = 'a'.repeat(32)
const imageId = 'b'.repeat(32)
const nextTaskId = 'c'.repeat(32)
const nextImageId = 'd'.repeat(32)
const capabilityPath = '/api/companion/capabilities'
const statePath = '/api/state'
const exportPath = '/api/companion/export'
const selectPath = '/api/companion/select'
const guardWarning = '一致性保护尚未接通验证'

function state(id = taskId, candidateId = imageId) {
  return {
    busy: false,
    task: {
      id, mode: 'browser_import', status: 'done', selected: [] as string[],
      items: [{ id: candidateId, title: '候选 A', status: 'ready', width: 256, height: 256, content_type: 'image/png' }],
    },
  }
}
function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function service(guardedExport = true) {
  const queued = new Map<string, Array<Promise<Response>>>()
  const server = {
    state: state(),
    capability: { schema_version: 1, guarded_export: true, guarded_review_actions: true, guarded_selection: true },
    exportStatus: 200,
    exportReceipt: { cancelled: false, directory: 'test-directory', results: [{ id: imageId, filename: 'candidate.png', ok: true }] },
  }
  const fetch = vi.fn<ReviewFetch>(async (path, init) => {
    const pending = queued.get(path)?.shift()
    if (pending) return pending
    if (path === capabilityPath) return response(server.capability)
    if (path === statePath) return response(server.state)
    if (path === selectPath) {
      if (init.method !== 'POST' || typeof init.body !== 'string') return response({ error: 'invalid selection request' }, 400)
      const request = JSON.parse(init.body) as { expected_task_id?: string; selected_ids?: unknown }
      if (request.expected_task_id !== server.state.task.id) return response({ error: 'stale task' }, 409)
      const ids = request.selected_ids
      if (!Array.isArray(ids) || ids.length > 30 || new Set(ids).size !== ids.length
        || ids.some(id => typeof id !== 'string' || !server.state.task.items.some(item => item.id === id && item.status === 'ready'))) {
        return response({ error: 'invalid selection' }, 400)
      }
      server.state.task.selected = [...ids]
      return response({ ok: true })
    }
    if (path === exportPath) return response(server.exportReceipt, server.exportStatus)
    throw new Error(`Unexpected endpoint: ${path}`)
  })
  const provider = createSameOriginImageReviewProvider({ fetch, getProcessToken: () => 'test-session-placeholder-only', guardedExport })
  function holdNext(path: string) {
    const pending = deferred<Response>()
    queued.set(path, [...(queued.get(path) ?? []), pending.promise])
    return pending
  }
  return { server, fetch, provider, holdNext }
}
let wrapper: VueWrapper | undefined
async function mountReview(local: ReturnType<typeof service>) {
  registerImageReviewProvider(local.provider)
  const pinia = createPinia()
  wrapper = mount(ImageAssetsView, { attachTo: document.body, global: { plugins: [pinia, ElementPlus] } })
  await flushPromises()
  await button('连接本机').trigger('click')
  await flushPromises()
  return useImageReviewStore(pinia)
}
function button(label: string) {
  const result = wrapper!.findAll('button').find(item => item.text().includes(label))
  if (!result) throw new Error(`Missing button: ${label}`)
  return result
}
function saveDisabled() { return button('保存选中').attributes('disabled') !== undefined }
function checkbox() { return wrapper!.find<HTMLInputElement>('.image-review-row input[type=checkbox]') }
function exportCalls(local: ReturnType<typeof service>) { return local.fetch.mock.calls.filter(([path]) => path === exportPath) }
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  imageReviewProvider.value = null
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('real same-origin adapter refresh readiness with offline transport', () => {
  it('restores canSave after reading it while the adapter temporarily revokes its guard', async () => {
    const local = service()
    const store = useImageReviewStore(createPinia())
    await store.connect(local.provider)
    await store.persistSelect(imageId, true)
    expect(local.server.state.task.selected).toEqual([imageId])
    expect(local.fetch.mock.calls.filter(([path]) => path === selectPath)).toEqual([[selectPath, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ expected_task_id: taskId, selected_ids: [imageId] }),
      mode: 'same-origin', credentials: 'same-origin', redirect: 'error',
    })]])
    expect(local.fetch.mock.calls.map(([path]) => path)).toEqual([capabilityPath, statePath, selectPath, capabilityPath, statePath])
    expect(store.canSave).toBe(true)

    const pending = local.holdNext(statePath)
    const refresh = store.refresh()
    await flushPromises()
    expect(local.provider.saveSelectionGuard).toBe('unverified')
    expect(store.loading).toBe(true)
    // This read is essential: the old computed drops its loading/selection dependencies here.
    expect(store.canSave).toBe(false)
    await expect(store.save()).rejects.toThrow('未就绪')
    expect(exportCalls(local)).toHaveLength(0)

    pending.resolve(response(local.server.state))
    await refresh
    expect(store.loading).toBe(false)
    expect(store.selectedIds).toEqual([imageId])
    expect(local.provider.saveSelectionGuard).toBe('verified')
    expect(store.canSave).toBe(true)
    await store.save()
    expect(exportCalls(local)).toEqual([[exportPath, expect.objectContaining({
      method: 'POST', body: JSON.stringify({ expected_task_id: taskId, selected_ids: [imageId] }),
      mode: 'same-origin', credentials: 'same-origin', redirect: 'error',
    })]])
    expect(local.fetch.mock.calls.every(([path]) => [capabilityPath, statePath, selectPath, exportPath].includes(path))).toBe(true)
    expect(store.notice).toContain('确认保存 1 项')
  })

  it('re-enables the rendered Save button after refresh without reselecting the checked ready image', async () => {
    const local = service()
    const store = await mountReview(local)
    await checkbox().setValue(true)
    await flushPromises()
    expect(checkbox().element.checked).toBe(true)
    expect(saveDisabled()).toBe(false)
    expect(wrapper!.text()).not.toContain(guardWarning)

    const pending = local.holdNext(statePath)
    await button('刷新真实状态').trigger('click')
    await flushPromises()
    expect(store.loading).toBe(true)
    expect(saveDisabled()).toBe(true)
    expect(checkbox().element.checked).toBe(true)
    expect(wrapper!.text()).toContain(guardWarning)

    pending.resolve(response(local.server.state))
    await flushPromises()
    expect(store.loading).toBe(false)
    expect(store.snapshot.busy).toBe(false)
    expect(store.snapshot.items[0]?.status).toBe('ready')
    expect(checkbox().element.checked).toBe(true)
    expect(saveDisabled()).toBe(false)
    expect(wrapper!.text()).not.toContain(guardWarning)
    await button('保存选中').trigger('click')
    await flushPromises()
    expect(exportCalls(local)).toHaveLength(1)
    expect(exportCalls(local)[0]?.[1].body).toBe(JSON.stringify({ expected_task_id: taskId, selected_ids: [imageId] }))
    expect(wrapper!.text()).toContain('确认保存 1 项')
  })
})

describe('refresh failures keep saving closed', () => {
  it.each([
    ['capability HTTP failure', capabilityPath, () => response({ error: 'unavailable' }, 503)],
    ['missing guarded-export capability', capabilityPath, () => response({ schema_version: 1 })],
    ['state HTTP failure', statePath, () => response({ error: 'unavailable' }, 503)],
    ['invalid ready-image state', statePath, () => {
      const invalid = state()
      invalid.task.items[0]!.width = 0
      return response(invalid)
    }],
  ] as const)('disables selection and Save after %s, then allows an explicit successful reconnect', async (_label, path, failedResponse) => {
    const local = service()
    const store = await mountReview(local)
    await checkbox().setValue(true)
    await flushPromises()
    expect(saveDisabled()).toBe(false)

    const pending = local.holdNext(path)
    const refreshing = store.refresh()
    await flushPromises()
    expect(saveDisabled()).toBe(true)
    expect(wrapper!.text()).toContain(guardWarning)
    pending.resolve(failedResponse())
    await refreshing
    await flushPromises()

    expect(store.connected).toBe(false)
    expect(store.snapshot).toEqual({ taskId: null, busy: false, items: [], task: null, sources: [], history: [], cooldowns: [] })
    expect(store.selectedIds).toEqual([])
    expect(store.error).not.toBe('')
    expect(store.canSave).toBe(false)
    expect(saveDisabled()).toBe(true)
    expect(wrapper!.text()).toContain(guardWarning)
    await expect(store.save()).rejects.toThrow('未就绪')
    expect(exportCalls(local)).toHaveLength(0)

    await button('连接本机').trigger('click')
    await flushPromises()
    await checkbox().setValue(true)
    await flushPromises()
    expect(store.connected).toBe(true)
    expect(saveDisabled()).toBe(false)
    expect(wrapper!.text()).not.toContain(guardWarning)
  })

  it('never enables an adapter without the atomic guarded-export contract, even for a checked ready image', async () => {
    const local = service(false)
    // The server may already have a selection even when this client cannot change it.
    local.server.state.task.selected = [imageId]
    const store = await mountReview(local)
    expect(checkbox().element.checked).toBe(true)
    expect(checkbox().element.disabled).toBe(true)
    expect(store.connected).toBe(true)
    expect(store.snapshot.items[0]?.status).toBe('ready')
    expect(store.selectedIds).toEqual([imageId])
    expect(saveDisabled()).toBe(true)
    expect(wrapper!.text()).toContain(guardWarning)
    await store.refresh()
    await flushPromises()
    expect(saveDisabled()).toBe(true)
    await expect(store.save()).rejects.toThrow('未就绪')
    expect(local.fetch.mock.calls.map(([path]) => path)).toEqual([statePath, statePath])
  })

  it('rejects registration and keeps the store closed when an adapter does not expose a guard at all', async () => {
    const local = service()
    Object.defineProperty(local.provider, 'saveSelectionGuard', { value: undefined })
    expect(() => registerImageReviewProvider(local.provider)).toThrow('合同无效')
    const store = useImageReviewStore(createPinia())
    await store.connect(local.provider)
    await store.persistSelect(imageId, true)
    expect(store.connected).toBe(true)
    expect(store.canSave).toBe(false)
    await expect(store.save()).rejects.toThrow('未就绪')
    expect(exportCalls(local)).toHaveLength(0)
  })

  it('rechecks the adapter guard at Save when an out-of-store read has revoked it', async () => {
    const local = service()
    const store = useImageReviewStore(createPinia())
    await store.connect(local.provider)
    await store.persistSelect(imageId, true)
    expect(store.canSave).toBe(true)
    const pending = local.holdNext(statePath)
    const externalRead = local.provider.loadState()
    await flushPromises()
    expect(local.provider.saveSelectionGuard).toBe('unverified')
    await expect(store.save()).rejects.toThrow('未就绪')
    expect(exportCalls(local)).toHaveLength(0)
    expect(store.mutation).toBe('none')
    expect(store.receipt).toBeNull()
    expect(store.uncertain).toBe(false)
    pending.resolve(response(local.server.state))
    await externalRead
  })
})

describe('server authority and selection remain intact across refresh', () => {
  it('keeps a stale-task 409 distinct from success or an uncertain write after restoring readiness', async () => {
    const local = service()
    const store = await mountReview(local)
    await checkbox().setValue(true)
    await flushPromises()
    await button('刷新真实状态').trigger('click')
    await flushPromises()
    expect(saveDisabled()).toBe(false)
    local.server.exportStatus = 409
    await button('保存选中').trigger('click')
    await flushPromises()
    expect(exportCalls(local)).toHaveLength(1)
    expect(exportCalls(local)[0]?.[1].body).toBe(JSON.stringify({ expected_task_id: taskId, selected_ids: [imageId] }))
    expect(store.receipt).toBeNull()
    expect(store.notice).toBe('')
    expect(store.error).toContain('409')
    expect(store.uncertain).toBe(false)
    expect(store.selectedIds).toEqual([imageId])
    expect(wrapper!.text()).not.toContain('服务确认保存')
    expect(wrapper!.text()).not.toContain('已保存 candidate.png')
  })

  it('honors busy from another tab even when the task says done, then restores saving after an idle refresh', async () => {
    const local = service()
    const store = await mountReview(local)
    await checkbox().setValue(true)
    await flushPromises()
    local.server.state.busy = true
    await button('刷新真实状态').trigger('click')
    await flushPromises()
    expect(store.snapshot.busy).toBe(true)
    expect(store.selectedIds).toEqual([imageId])
    expect(checkbox().element.checked).toBe(true)
    expect(saveDisabled()).toBe(true)
    await expect(store.save()).rejects.toThrow('未就绪')
    expect(exportCalls(local)).toHaveLength(0)
    local.server.state.busy = false
    await button('刷新真实状态').trigger('click')
    await flushPromises()
    expect(checkbox().element.checked).toBe(true)
    expect(saveDisabled()).toBe(false)
  })

  it('clears old local selections and receipts when a different task arrives', async () => {
    const local = service()
    const store = useImageReviewStore(createPinia())
    await store.connect(local.provider)
    await store.persistSelect(imageId, true)
    await store.save()
    expect(store.receipt?.results[0]?.ok).toBe(true)
    local.server.state = state(nextTaskId, nextImageId)
    await store.refresh()
    expect(store.snapshot.taskId).toBe(nextTaskId)
    expect(store.selectedIds).toEqual([])
    expect(store.receipt).toBeNull()
    expect(store.canSave).toBe(false)
    await expect(store.persistSelect(imageId, true)).rejects.toThrow('只能选择已下载的当前图片')
    expect(store.selectedIds).toEqual([])
    await store.persistSelect(nextImageId, true)
    expect(store.canSave).toBe(true)
  })

  it('removes an image that is no longer ready and requires a new selection when it becomes ready again', async () => {
    const local = service()
    const store = await mountReview(local)
    await checkbox().setValue(true)
    await flushPromises()
    local.server.state.task.items[0]!.status = 'failed'
    // Model the service removing the now-invalid selection in the same state update.
    local.server.state.task.selected = []
    await button('刷新真实状态').trigger('click')
    await flushPromises()
    expect(store.selectedIds).toEqual([])
    expect(checkbox().element.checked).toBe(false)
    expect(checkbox().element.disabled).toBe(true)
    expect(saveDisabled()).toBe(true)
    local.server.state.task.items[0]!.status = 'ready'
    await button('刷新真实状态').trigger('click')
    await flushPromises()
    expect(store.selectedIds).toEqual([])
    expect(saveDisabled()).toBe(true)
    await checkbox().setValue(true)
    await flushPromises()
    expect(saveDisabled()).toBe(false)
    expect(exportCalls(local)).toHaveLength(0)
  })
})

describe('only the newest completed refresh can restore readiness', () => {
  it.each(['success', 'failure'] as const)('ignores an older refresh %s that arrives after a newer task', async outcome => {
    const local = service()
    const store = useImageReviewStore(createPinia())
    await store.connect(local.provider)
    await store.persistSelect(imageId, true)
    expect(store.canSave).toBe(true)
    const oldResponse = local.holdNext(statePath)
    const oldRefresh = store.refresh()
    await flushPromises()
    expect(store.canSave).toBe(false)
    const oldSignal = local.fetch.mock.calls.filter(([path]) => path === statePath).at(-1)?.[1].signal
    const newestResponse = local.holdNext(statePath)
    const newestRefresh = store.refresh()
    await flushPromises()
    expect(oldSignal?.aborted).toBe(true)
    const newest = state(nextTaskId, nextImageId)
    newest.task.selected = [nextImageId]
    newestResponse.resolve(response(newest))
    await newestRefresh
    expect(store.canSave).toBe(true)
    expect(store.selectedIds).toEqual([nextImageId])
    // The offline transport deliberately ignores aborts to exercise the store's version check.
    oldResponse.resolve(outcome === 'success' ? response(state()) : response({ error: 'old failure' }, 503))
    await oldRefresh
    expect(store.snapshot.taskId).toBe(nextTaskId)
    expect(store.snapshot.items.map(item => item.id)).toEqual([nextImageId])
    expect(store.selectedIds).toEqual([nextImageId])
    expect(store.connected).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBe('')
    expect(store.canSave).toBe(true)
    expect(exportCalls(local)).toHaveLength(0)
  })

  it('does not unlock saving when an older successful response arrives during the newest refresh', async () => {
    const local = service()
    const store = await mountReview(local)
    await checkbox().setValue(true)
    await flushPromises()
    const oldResponse = local.holdNext(statePath)
    const oldRefresh = store.refresh()
    await flushPromises()
    const newestResponse = local.holdNext(statePath)
    const newestRefresh = store.refresh()
    await flushPromises()
    oldResponse.resolve(response(local.server.state))
    await oldRefresh
    await flushPromises()
    expect(local.provider.saveSelectionGuard).toBe('verified')
    expect(store.loading).toBe(true)
    expect(store.canSave).toBe(false)
    expect(saveDisabled()).toBe(true)
    expect(wrapper!.text()).toContain(guardWarning)
    newestResponse.resolve(response(local.server.state))
    await newestRefresh
    await flushPromises()
    expect(saveDisabled()).toBe(false)
    expect(wrapper!.text()).not.toContain(guardWarning)
  })

  it('does not let a late response re-enable saving after disconnect', async () => {
    const local = service()
    const store = await mountReview(local)
    await checkbox().setValue(true)
    await flushPromises()
    const pending = local.holdNext(statePath)
    const refresh = store.refresh()
    await flushPromises()
    store.disconnect()
    pending.resolve(response(local.server.state))
    await refresh
    await flushPromises()
    expect(store.provider).toBeNull()
    expect(store.connected).toBe(false)
    expect(store.loading).toBe(false)
    expect(store.snapshot.items).toEqual([])
    expect(store.selectedIds).toEqual([])
    expect(store.canSave).toBe(false)
    expect(saveDisabled()).toBe(true)
    expect(wrapper!.text()).toContain(guardWarning)
    expect(exportCalls(local)).toHaveLength(0)
  })
})
