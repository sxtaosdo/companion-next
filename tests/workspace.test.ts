import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWorkspaceStore } from '../src/stores/workspace'
import { createDemoSnapshot, demoProvider } from '../src/providers/demo'
import type { ReadOnlyCompanionProvider, WorkspaceSnapshot } from '../src/domain/contracts'
import { createDefaultSpec } from '../src/domain/spec'
beforeEach(() => { setActivePinia(createPinia()); localStorage.clear(); Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_key: string, callback: () => unknown) => callback() } }) })
afterEach(() => { Reflect.deleteProperty(navigator, 'locks') })
const liveData = (): WorkspaceSnapshot => ({ projects: [{ id: 'actual-1', name: '只读工程', styleApproval: 'unknown', protectedAssets: null }], resources: [], services: [{ id: 'test-api', name: '测试只读源', role: '项目读取', state: 'available', detail: '仅此测试响应可读' }], source: { label: '测试 provider', observedAt: '2026-10-11T08:00:00.000Z', limitations: ['测试数据，不连接服务'] } })
describe('explicit read-only data modes', () => {
  it('starts disconnected, empty, and never autoloads fixtures', () => {
    const store = useWorkspaceStore()
    expect(store.mode).toBe('disconnected'); expect(store.snapshot.projects).toEqual([])
    expect(store.snapshot.resources).toEqual([]); expect(store.project).toBeUndefined()
  })
  it('loads demo only on an explicit action', async () => {
    const store = useWorkspaceStore(); await store.openDemo()
    expect(store.mode).toBe('demo'); expect(store.sourceLabel).toBe('示例模式')
    expect(store.project?.id).toBe('demo-1060'); expect(store.resources.length).toBe(5)
    expect(store.snapshot.source.observedAt).toBeUndefined()
  })
  it('keeps all demo technical and engine evidence unverified', () => {
    const snapshot = createDemoSnapshot()
    expect(snapshot.resources.every((r) => r.technical === 'not-checked' && r.visual === 'not-checked' && r.imported === 'not-checked' && r.bound === 'not-checked' && r.runtime === 'not-checked')).toBe(true)
    expect(snapshot.services.every((s) => s.state === 'unknown')).toBe(true)
  })
  it('does not fall back to fixtures when live reads fail', async () => {
    const store = useWorkspaceStore(); await store.openDemo()
    await store.connect({ mode: 'live', label: '失败源', loadSnapshot: async () => { throw new Error('401 需要会话') } })
    expect(store.mode).toBe('live'); expect(store.connection).toBe('error')
    expect(store.snapshot.projects).toEqual([]); expect(store.snapshot.resources).toEqual([])
    expect(store.error).toContain('401'); expect(store.localDraft).toBeNull()
  })
  it('marks live snapshots as read-only', async () => {
    const store = useWorkspaceStore()
    await store.connect({ mode: 'live', label: '只读测试', loadSnapshot: async () => liveData() })
    expect(store.sourceLabel).toBe('真实数据 · 只读'); expect(store.project?.id).toBe('actual-1')
    expect(store.resources).toHaveLength(0); expect(store.spec).toBeUndefined()
  })
  it('discards a stale response after disconnect even for a non-cooperative provider', async () => {
    let resolve!: (value: WorkspaceSnapshot) => void
    const provider: ReadOnlyCompanionProvider = { mode: 'live', label: 'deferred', loadSnapshot: () => new Promise((r) => { resolve = r }) }
    const store = useWorkspaceStore(); const pending = store.connect(provider); store.disconnect()
    resolve(liveData()); await pending
    expect(store.mode).toBe('disconnected'); expect(store.snapshot.projects).toEqual([])
  })
  it('latest selection wins and aborts the earlier provider', async () => {
    let resolve!: (value: WorkspaceSnapshot) => void
    let signal: AbortSignal | undefined
    const provider: ReadOnlyCompanionProvider = { mode: 'live', label: 'deferred', loadSnapshot: (input) => { signal = input; return new Promise((r) => { resolve = r }) } }
    const store = useWorkspaceStore(); const pending = store.connect(provider)
    await store.openDemo(); expect(signal?.aborted).toBe(true)
    resolve(liveData()); await pending
    expect(store.isDemo).toBe(true); expect(store.project?.id).toBe('demo-1060')
  })
  it('refresh uses only the selected provider', async () => {
    const loadSnapshot = vi.fn(async () => liveData()); const store = useWorkspaceStore()
    await store.connect({ mode: 'live', label: 'test', loadSnapshot }); await store.refresh()
    expect(loadSnapshot).toHaveBeenCalledTimes(2)
  })
  it('protects against selecting nonexistent projects', async () => {
    const store = useWorkspaceStore(); await store.openDemo(); store.selectProject('invalid')
    expect(store.project?.id).toBe('demo-1060')
  })
  it('keeps local drafts scoped to a project and data mode without writing provider data', async () => {
    const store = useWorkspaceStore(); await store.openDemo()
    const sourceWidth = store.project?.spec?.width
    await store.saveLocalSpec({ ...store.spec!, width: 1080 })
    expect(store.spec?.width).toBe(1080); expect(store.project?.spec?.width).toBe(sourceWidth)
    store.selectProject('demo-4060'); expect(store.spec?.width).toBe(750); expect(store.localDraft).toBeNull()
    store.selectProject('demo-1060'); expect(store.spec?.width).toBe(1080)
    store.disconnect(); expect(store.localDraft).toBeNull()
  })
  it('can create a local draft for a live project without a source spec', async () => {
    const store = useWorkspaceStore(); await store.connect({ mode: 'live', label: 'test', loadSnapshot: async () => liveData() })
    await store.saveLocalSpec({ ...createDefaultSpec(), styleName: '独立草稿' })
    expect(store.localDraft?.mode).toBe('live'); expect(store.project?.spec).toBeUndefined()
    expect(store.spec?.styleName).toBe('独立草稿')
  })
  it('rejects draft writes with no selected project', async () => {
    const store = useWorkspaceStore()
    await expect(store.saveLocalSpec({ ...createDefaultSpec(), styleName: '不保存' })).rejects.toThrow('请先选择项目')
  })
  it('demo provider rejects an already-aborted signal', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(demoProvider.loadSnapshot(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('cross-tab edits and resource completeness', () => {
  it('detects stale-tab save, preserves newer draft and requires explicit reload', async () => {
    const tabA = useWorkspaceStore(createPinia()); const tabB = useWorkspaceStore(createPinia())
    await tabA.openDemo(); await tabB.openDemo()
    await tabA.saveLocalSpec({ ...tabA.spec!, width: 1080 })
    await expect(tabB.saveLocalSpec({ ...tabB.spec!, width: 1440 })).rejects.toThrow('本地草稿已被其他页面更新或删除')
    expect(tabB.localDraft).toBeNull()
    tabB.reloadLocalDraft(); expect(tabB.spec?.width).toBe(1080)
    await tabB.saveLocalSpec({ ...tabB.spec!, width: 1200 })
    tabA.reloadLocalDraft(); expect(tabA.spec?.width).toBe(1200)
  })
  it('does not interpret an omitted live resource inventory as measured zero', async () => {
    const store = useWorkspaceStore(); await store.connect({ mode: 'live', label: 'test', loadSnapshot: async () => liveData() })
    expect(store.resourceInventoryKnown).toBe(false)
    await store.openDemo(); expect(store.resourceInventoryKnown).toBe(true)
  })
  it('uses a cross-tab exclusive lock when the browser supports it', async () => {
    const request = vi.fn(async (_name: string, callback: () => unknown) => callback())
    vi.stubGlobal('navigator', { locks: { request } })
    try {
      const store = useWorkspaceStore(); await store.openDemo()
      await store.saveLocalSpec({ ...store.spec!, width: 1080 })
      expect(request).toHaveBeenCalledOnce(); expect(store.localDraft?.spec.width).toBe(1080)
    } finally { vi.unstubAllGlobals() }
  })
})

 it('fails closed without Web Locks and does not mutate localStorage', async () => {
   Reflect.deleteProperty(navigator, 'locks')
   const store = useWorkspaceStore(); await store.openDemo()
   const before = { ...localStorage }
   await expect(store.saveLocalSpec({ ...store.spec!, width: 1080 })).rejects.toThrow('此浏览器不支持跨页写锁')
   expect({ ...localStorage }).toEqual(before); expect(store.localDraft).toBeNull()
 })
