import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import type { CompanionBrowserProvider, ProjectRead } from '../src/domain/companion-browser'

const id = 'aaaaaaaaaaaaaaaa'
const snapshot = (): ProjectRead => ({ projects: [{ id, name: 'Offline project', path: '/offline/project' }], statuses: [{ projectId: id, state: 'ready', capabilityProfile: 'unknown' }], dashboard: [], warnings: ['Offline warning'] })
function reader(): CompanionBrowserProvider { return { label: 'offline reader', loadProjects: vi.fn(async () => snapshot()), loadCounts: vi.fn(async () => ({ sessionId: 'offline', counts: {}, latest: {} })), loadLogs: vi.fn(async () => []), loadCalls: vi.fn(async () => ({ sessionId: 'offline', total: 0, retained: 0, records: [] })) } }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
beforeEach(() => setActivePinia(createPinia()))

describe('background project presentation keeps the original safety read lifecycle', () => {
  it('retains identical snapshot arrays while advancing real read evidence and preserving the busy gate', async () => {
    const store = useCompanionBrowserStore(), source = reader(); await store.connect(source)
    const old = [store.projects, store.statuses, store.dashboard, store.warnings], revision = store.projectSnapshotRevision
    const pending = deferred<ProjectRead>(); vi.mocked(source.loadProjects).mockReturnValueOnce(pending.promise)
    const read = store.refreshProjects(true)
    expect(store.backgroundProjectRead).toBe(true); expect(store.projectLoading).toBe(true)
    pending.resolve(snapshot()); await read
    expect(store.backgroundProjectRead).toBe(false); expect(store.projectLoading).toBe(false)
    expect(store.projectSnapshotRevision).toBe(revision + 1)
    for (const [index, value] of [store.projects, store.statuses, store.dashboard, store.warnings].entries()) expect(value).toBe(old[index])
    expect(store.connected).toBe(true)
  })

  it('clears background presentation on cancellation without accepting its late result', async () => {
    const store = useCompanionBrowserStore(), source = reader(); await store.connect(source)
    const revision = store.projectSnapshotRevision, pending = deferred<ProjectRead>()
    vi.mocked(source.loadProjects).mockReturnValueOnce(pending.promise)
    const read = store.refreshProjects(true); store.cancelReads()
    expect(store.backgroundProjectRead).toBe(false); expect(store.projectLoading).toBe(false)
    pending.resolve({ ...snapshot(), projects: [] }); await read
    expect(store.projectSnapshotRevision).toBe(revision); expect(store.projects).toHaveLength(1)
  })

  it('clears failed background work and does not present its old data as a successful new snapshot', async () => {
    const store = useCompanionBrowserStore(), source = reader(); await store.connect(source)
    const pending = deferred<ProjectRead>(); vi.mocked(source.loadProjects).mockReturnValueOnce(pending.promise)
    const read = store.refreshProjects(true); pending.reject(new Error('offline failure')); await read
    expect(store.backgroundProjectRead).toBe(false); expect(store.projectLoading).toBe(false)
    expect(store.connected).toBe(false); expect(store.projects).toEqual([]); expect(store.projectError).toBe('offline failure')
  })

  it('never lets cancelled source A clear source B background busy flags or overwrite B data', async () => {
    const store = useCompanionBrowserStore(), a = reader(), b = reader(); await store.connect(a)
    const old = deferred<ProjectRead>(); vi.mocked(a.loadProjects).mockReturnValueOnce(old.promise)
    const readA = store.refreshProjects(true); store.disconnect(); await store.connect(b)
    const current = deferred<ProjectRead>(); vi.mocked(b.loadProjects).mockReturnValueOnce(current.promise)
    const readB = store.refreshProjects(true); old.resolve({ ...snapshot(), projects: [] }); await readA
    expect(store.provider).toBe(b); expect(store.backgroundProjectRead).toBe(true); expect(store.projectLoading).toBe(true); expect(store.projects).toHaveLength(1)
    current.resolve(snapshot()); await readB
    expect(store.backgroundProjectRead).toBe(false); expect(store.projectLoading).toBe(false)
  })
})
