import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiJobsReadStore } from '../src/stores/ai-jobs-read'
import { AiJobsReadError } from '../src/domain/ai-jobs-read'
import type { AiJobSnapshot, AiJobsView, AiJobsReadProvider, AiJobPreview } from '../src/domain/ai-jobs-read'
const id = '0123456789abcdef', other = 'fedcba9876543210', jobId = 'STUDIO-RUN-icon-demo-0123abcd', secondId = 'STUDIO-RUN-icon-other-0123abcd', candidateId = 'CANDIDATE-gem-1'
const project = { id, name: '工程 A', path: '/fixture/A' }, source = {}
function job(): AiJobSnapshot { return { projectId: id, jobId, revision: 1, state: 'unknown', sourceRevision: 'a'.repeat(40), requestHash: 'b'.repeat(64), profile: 'local-icon-v1', budget: { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, createdAt: '2026-10-15T13:00:00Z', assets: [{ assetId: 'gem', relativePath: 'assets/icons/gem.png' }], candidates: [{ candidateId, assetId: 'gem', fileSha256: 'c'.repeat(64), width: 1024, height: 1024, hasAlpha: true }], selectedIds: [], import: null, workerResident: false, productionVerified: false } }
function jobs(): AiJobsView { return { schemaVersion: 'companion-icons-v1', projectId: id, sourceRevision: 'a'.repeat(40), jobs: [job(), { ...job(), jobId: secondId }], profile: { id: 'local-icon-v1', ...job().budget }, schedulerEnabled: false, workerResident: false } }
const provider = (): AiJobsReadProvider => ({ label: 'fake', readJobs: vi.fn(async () => jobs()), readStatus: vi.fn(async () => job()), previewCandidate: vi.fn(async () => { throw Error('not configured') }) })
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => vi.useRealTimers())
describe('task history context and late-read isolation', () => {
  it('requires complete registered context and never reads on setContext', async () => { const store = useAiJobsReadStore(), p = provider(); store.setContext(project, null); await store.readJobs(p); store.setContext({ ...project, id: '../x' }, source); await store.readJobs(p); expect(p.readJobs).not.toHaveBeenCalled(); store.setContext(project, source); expect(p.readJobs).not.toHaveBeenCalled(); await store.readJobs(p); expect(store.history?.jobs).toHaveLength(2) })
  it('only explicit actions read, and local task selection never fetches', async () => { const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId); expect(store.status?.state).toBe('unknown'); expect(p.readStatus).not.toHaveBeenCalled(); expect(p.previewCandidate).not.toHaveBeenCalled(); await store.readStatus(); expect(p.readStatus).toHaveBeenCalledExactlyOnceWith(id, jobId, expect.any(AbortSignal)) })
  it('blocks duplicate reads and clears previous data at explicit history refresh', async () => { const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId); const wait = deferred<AiJobsView>(); p.readJobs = vi.fn(() => wait.promise); const pending = store.readJobs(p); await store.readJobs(p); expect(p.readJobs).toHaveBeenCalledTimes(1); expect(store.history).toBeNull(); expect(store.status).toBeNull(); wait.resolve(jobs()); await pending })
  it.each(['project', 'path', 'name', 'source', 'provider', 'disconnect', 'cancel', 'a-b-a'] as const)('discards late history on %s', async kind => {
    const store = useAiJobsReadStore(), p = provider(), wait = deferred<AiJobsView>(); let signal: AbortSignal | undefined; p.readJobs = vi.fn((_id, next) => { signal = next; return wait.promise }); store.setContext(project, source); const pending = store.readJobs(p)
    if (kind === 'project') store.setContext({ ...project, id: other }, source)
    if (kind === 'path') store.setContext({ ...project, path: '/changed' }, source)
    if (kind === 'name') store.setContext({ ...project, name: 'new' }, source)
    if (kind === 'source') store.setContext(project, {})
    if (kind === 'provider') store.invalidateProvider()
    if (kind === 'disconnect') store.disconnect()
    if (kind === 'cancel') store.clearReads()
    if (kind === 'a-b-a') { store.setContext({ ...project, id: other }, source); store.setContext(project, source) }
    expect(signal?.aborted).toBe(true); wait.resolve(jobs()); await pending; expect(store.history).toBeNull(); expect(store.observedAt).toBe(''); expect(store.busy).toBe(false)
  })
  it('does not erase data for an equivalent registration refresh', async () => { const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); await store.readJobs(p); store.setContext({ ...project }, source); expect(store.history).not.toBeNull() })
  it('rejects cross-project responses and never shows raw diagnostics or false empty success', async () => { const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); p.readJobs = vi.fn(async () => ({ ...jobs(), projectId: other })); await store.readJobs(p); expect(store.error).toBeTruthy(); expect(store.history).toBeNull(); p.readJobs = vi.fn(async () => { throw Error('SECRET/private/path') }); await store.readJobs(p); expect(store.error).not.toContain('SECRET'); expect(store.history).toBeNull() })
  it('retains closed backend failure reasons through the store', async () => { const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); p.readJobs = vi.fn(async () => { throw new AiJobsReadError('http-error', 'jobs', 503, 'ICON_ADAPTER_DISABLED') }); await store.readJobs(p); expect(store.error).toContain('未启用或可信配置不完整') })
  it('binds status to selected job and discards a late result after changing the selection', async () => { const store = useAiJobsReadStore(), p = provider(), wait = deferred<AiJobSnapshot>(); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId); p.readStatus = vi.fn(() => wait.promise); const pending = store.readStatus(); store.selectJob(secondId); wait.resolve({ ...job(), revision: 2 }); await pending; expect(store.status?.jobId).toBe(secondId); expect(store.status?.revision).toBe(1) })
  it('does not fallback to historical snapshot when status refresh fails', async () => { const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId); p.readStatus = vi.fn(async () => { throw Error('SECRET') }); await store.readStatus(); expect(store.status).toBeNull(); expect(store.statusObservedAt).toBe(''); expect(store.statusError).toBeTruthy(); expect(store.history?.jobs).toHaveLength(2) })
  it.each([{ revision: 0 }, { jobId: secondId }, { projectId: other }, { requestHash: 'd'.repeat(64) }, { sourceRevision: 'd'.repeat(40) }])('rejects wrong status identity %#', async invalid => { const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId); p.readStatus = vi.fn(async () => ({ ...job(), ...invalid })); await store.readStatus(); expect(store.status).toBeNull(); expect(store.statusError).toBeTruthy() })
  it('preserves latest snapshot and actual observation time across reselection, and rejects regression after an intervening failure', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T13:00:00Z'))
    const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId); const listTime = store.observedAt
    vi.setSystemTime(new Date('2026-10-15T14:00:00Z')); p.readStatus = vi.fn(async () => ({ ...job(), revision: 3, state: 'import_unknown' as const })); await store.readStatus(); const readTime = store.statusObservedAt
    expect(readTime).not.toBe(listTime); store.selectJob(secondId); store.selectJob(jobId); expect(store.status?.revision).toBe(3); expect(store.statusObservedAt).toBe(readTime)
    p.readStatus = vi.fn(async () => { throw Error('temporary') }); await store.readStatus(); p.readStatus = vi.fn(async () => ({ ...job(), revision: 2 })); await store.readStatus(); expect(store.status).toBeNull(); expect(store.statusError).toBeTruthy()
    store.clearReads(); await store.readJobs(p); store.selectJob(jobId); expect(store.status?.revision).toBe(1)
  })
  it('refuses candidate requests not listed in the selected job', async () => { const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId); await store.readPreview('https://outside'); await store.readPreview('CANDIDATE-unlisted-1'); expect(p.previewCandidate).not.toHaveBeenCalled() })
  it.each(['close', 'status', 'selection', 'context', 'provider', 'disconnect'] as const)('discards late candidate on %s', async kind => {
    const store = useAiJobsReadStore(), p = provider(), wait = deferred<AiJobPreview>(); let signal: AbortSignal | undefined; p.previewCandidate = vi.fn((_id, _job, _candidate, next) => { signal = next; return wait.promise }); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId); const pending = store.readPreview(candidateId)
    if (kind === 'close') store.clearPreview()
    if (kind === 'status') { store.clearPreview(); await store.readStatus() }
    if (kind === 'selection') store.selectJob(secondId)
    if (kind === 'context') store.setContext({ ...project, path: '/new' }, source)
    if (kind === 'provider') store.invalidateProvider()
    if (kind === 'disconnect') store.disconnect()
    expect(signal?.aborted).toBe(true); wait.resolve({} as AiJobPreview); await pending; expect(store.preview).toBeNull(); expect(store.previewCandidateId).toBe(''); expect(store.previewLoading).toBe(false)
  })
})

describe('frozen action readback and displayed-preview handoff', () => {
  it('accepts only status evidence for the current registered identity and updates the latest cache', async () => {
    const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId)
    const newer = { ...job(), revision: 2, state: 'selected' as const }
    expect(store.acceptActionReadback({ snapshot: newer, project: { ...project }, source, reader: p })).toBe(true)
    expect(store.status?.revision).toBe(2); store.selectJob(secondId); store.selectJob(jobId); expect(store.status?.revision).toBe(2)
  })
  it.each(['source','path','name','reader','job','hash','revision','sourceRevision'] as const)('rejects stale/cross-context action readback: %s', async changed => {
    const store = useAiJobsReadStore(), p = provider(); store.setContext(project, source); await store.readJobs(p); store.selectJob(jobId)
    const input = { snapshot: { ...job(), revision: 2 }, project: { ...project }, source, reader: p }
    if (changed === 'source') input.source = {}
    if (changed === 'path') input.project.path = '/another'
    if (changed === 'name') input.project.name = 'other'
    if (changed === 'reader') input.reader = provider()
    if (changed === 'job') input.snapshot.jobId = secondId
    if (changed === 'hash') input.snapshot.requestHash = 'd'.repeat(64)
    if (changed === 'revision') input.snapshot.revision = 0
    if (changed === 'sourceRevision') input.snapshot.sourceRevision = 'd'.repeat(40)
    expect(store.acceptActionReadback(input)).toBe(false); expect(store.status?.revision).toBe(1)
  })
  it('requires the actual current image identity to be displayed, and clears evidence on image errors', () => {
    const store = useAiJobsReadStore(); store.status = job(); store.preview = { candidateId, mimeType: 'image/png', sha256: 'c'.repeat(64), base64: '', width: 1024, height: 1024 }
    expect(store.previewShown).toBe(false); store.previewDisplayed(candidateId, 'd'.repeat(64)); expect(store.previewShown).toBe(false)
    store.previewDisplayed(candidateId, 'c'.repeat(64)); expect(store.previewShown).toBe(true)
    store.previewDisplayFailed(); expect(store.previewShown).toBe(false); expect(store.preview).toBeNull()
  })
  it('clearing or changing a preview cannot retain the displayed marker', () => {
    const store = useAiJobsReadStore(); store.previewShown = true; store.clearPreview(); expect(store.previewShown).toBe(false)
    store.previewDisplayed(candidateId, 'c'.repeat(64)); expect(store.previewShown).toBe(false)
  })
})
