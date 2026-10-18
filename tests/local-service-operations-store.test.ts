import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LocalServiceOperationError, type LocalService, type LocalServiceOperationReply, type LocalServiceOperationsProvider } from '../src/domain/local-service-operations'
import { useLocalServiceOperationsStore, type LocalServiceContext } from '../src/stores/local-service-operations'
import { useKnowledgeReadStore } from '../src/stores/knowledge-read'
import { knowledgeFixture } from './knowledge-read-fixture'
const stopped = (service: LocalService = 'model'): LocalServiceOperationReply => service === 'model' ? { service, action: 'stop', state: { running: false } } : { service, action: 'stop', state: { running: false, frameable: false } }
const states = () => ({ knowledge: { running: true, frameable: true }, model: { running: true }, warnings: [] })
const tick = async () => { for (let i = 0; i < 16; i++) await Promise.resolve() }
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function fixture() {
  const provider: LocalServiceOperationsProvider = { label: 'OFFLINE STOP', run: vi.fn(async (input): Promise<LocalServiceOperationReply> => input.action === 'start' ? input.service === 'model' ? { service: 'model', action: 'start', state: { running: true } } : { service: 'knowledge', action: 'start', state: { running: true, frameable: false } } : stopped(input.service)), waitForIdle: vi.fn(async () => {}) }
  const readProvider = knowledgeFixture(); vi.mocked(readProvider.loadServiceStates).mockResolvedValue(states())
  const context: LocalServiceContext = { provider, readProvider, scopeKey: 'knowledge' }
  const store = useLocalServiceOperationsStore(); store.syncContext(context); return { provider, readProvider, store, context }
}
async function stop(store: ReturnType<typeof useLocalServiceOperationsStore>, service: LocalService = 'model') { await store.refresh(); return store.execute(store.prepare(service), true) }
beforeEach(() => setActivePinia(createPinia()))
describe('per-service explicit status and one-use confirmation', () => {
  it('does no work on creation or context binding and never persists state', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem'), set = vi.spyOn(Storage.prototype, 'setItem'), { provider, readProvider, store } = fixture()
    expect(readProvider.loadServiceStates).not.toHaveBeenCalled(); expect(readProvider.status).not.toHaveBeenCalled(); expect(provider.run).not.toHaveBeenCalled()
    expect(store.prepare('model')).toBeNull(); await stop(store); store.leave(); expect(get).not.toHaveBeenCalled(); expect(set).not.toHaveBeenCalled()
  })
  it('reads only service capability, not CLI status or other shared stores', async () => {
    const { readProvider, store } = fixture(), shared = useKnowledgeReadStore(); expect(await store.refresh()).toBe(true)
    expect(readProvider.loadServiceStates).toHaveBeenCalledOnce(); expect(readProvider.status).not.toHaveBeenCalled(); expect(shared.services).toBeNull(); expect(shared.provider).toBeNull()
    expect(store.states).toEqual(states()); expect(Object.isFrozen(store.states)).toBe(true)
  })
  it('does not infer stopped from missing status or display untrusted warnings', async () => {
    const { readProvider, store, provider } = fixture(); vi.mocked(readProvider.loadServiceStates).mockResolvedValue({ warnings: ['PRIVATE'] })
    await store.refresh(); expect(store.states?.knowledge).toBeUndefined(); expect(store.states?.model).toBeUndefined(); expect(JSON.stringify(store.states)).not.toContain('PRIVATE')
    expect(store.canPrepare('model')).toBe(false); expect(store.canPrepare('knowledge')).toBe(false); expect(provider.run).not.toHaveBeenCalled()
  })
  it.each([null, [], { knowledge: { running: false, frameable: true } }, { model: { running: 'false' } }, { knowledge: { running: true } }])('rejects invalid service status %#', async value => {
    const { readProvider, store } = fixture(); vi.mocked(readProvider.loadServiceStates).mockResolvedValue(value as never)
    expect(await store.refresh()).toBe(false); expect(store.states).toBeNull(); expect(store.prepare('model')).toBeNull()
  })
  it('requires current running status and a frozen one-use approval identity', async () => {
    const { store, provider } = fixture(); await store.refresh(); const prepared = store.prepare('model')!
    expect(Object.isFrozen(prepared)).toBe(true); expect(prepared.impact).toContain('所有'); expect(provider.run).not.toHaveBeenCalled()
    expect(await store.execute(prepared, false)).toBe(false); expect(await store.execute({ ...prepared }, true)).toBe(false)
    expect(await store.execute(prepared, true)).toBe(true); expect(await store.execute(prepared, true)).toBe(false)
    expect(provider.run).toHaveBeenCalledOnce(); expect(vi.mocked(provider.run).mock.calls[0]![0]).toEqual({ service: 'model', action: 'stop' })
    expect(store.states).toBeNull(); expect(store.canPrepare('model')).toBe(false); expect(store.records[0]!.status).toBe('acknowledged')
  })
  it('revokes previous service preview and never approves a service by a different preview', async () => {
    const { store, provider } = fixture(); await store.refresh(); const model = store.prepare('model')!, knowledge = store.prepare('knowledge')!
    expect(knowledge.impact).toContain('不能保证只关闭本页'); expect(await store.execute(model, true)).toBe(false)
    expect(await store.execute(knowledge, true)).toBe(true); expect(vi.mocked(provider.run).mock.calls[0]![0].service).toBe('knowledge')
  })
  it('revokes on refresh, route/scope, source swaps and back navigation', async () => {
    for (const change of ['refresh', 'scope', 'read', 'write', 'leave']) {
      setActivePinia(createPinia()); const { store, provider, readProvider, context } = fixture(); await store.refresh(); const prepared = store.prepare('model')!
      if (change === 'refresh') await store.refresh()
      else if (change === 'scope') { store.syncContext({ ...context, scopeKey: 'models' }); store.syncContext(context) }
      else if (change === 'read') { store.syncContext({ ...context, readProvider: { ...readProvider } }); store.syncContext(context) }
      else if (change === 'write') { store.syncContext({ ...context, provider: { ...provider } }); store.syncContext(context) }
      else { store.leave(); store.syncContext(context) }
      expect(await store.execute(prepared, true)).toBe(false); expect(provider.run).not.toHaveBeenCalled()
    }
  })
  it('keeps duplicate identical context inert', async () => {
    const { store, context } = fixture(); await store.refresh(); const prepared = store.prepare('model'); store.syncContext({ ...context }); expect(store.prepared).toBe(prepared)
  })
  it('blocks double clicks and the other service until exact transport settlement', async () => {
    const { store, provider } = fixture(), d = deferred<LocalServiceOperationReply>(), idle = deferred<void>(); vi.mocked(provider.run).mockReturnValue(d.promise); vi.mocked(provider.waitForIdle).mockReturnValue(idle.promise)
    await store.refresh(); const prepared = store.prepare('model'), pending = store.execute(prepared, true)
    expect(store.busy).toBe(true); expect(store.transportPending).toBe(true); expect(store.prepare('knowledge')).toBeNull(); expect(await store.execute(prepared, true)).toBe(false); expect(await store.refresh()).toBe(false)
    d.resolve(stopped()); await tick(); expect(store.busy).toBe(false); expect(store.transportPending).toBe(true); idle.resolve(); expect(await pending).toBe(true); expect(store.transportPending).toBe(false); expect(provider.run).toHaveBeenCalledOnce()
  })
  it('requires a new status read and new confirmation after every success or explicit rejection', async () => {
    const { store, provider } = fixture(); await stop(store); expect(store.prepare('model')).toBeNull()
    vi.mocked(provider.run).mockRejectedValueOnce(new LocalServiceOperationError('forbidden', 'rejected')); expect(await stop(store)).toBe(false); expect(store.blockedUnknown).toBe(false); expect(store.prepare('model')).toBeNull()
    expect(await stop(store)).toBe(true); expect(provider.run).toHaveBeenCalledTimes(3)
  })
  it('keeps reported backend failure distinct from rejection and never invents rollback', async () => {
    const { store, provider } = fixture(); vi.mocked(provider.run).mockRejectedValue(new LocalServiceOperationError('backend-failure', 'reported-failure'))
    expect(await stop(store)).toBe(false); expect(store.records[0]).toMatchObject({ status: 'reported-failure', reply: null }); expect(store.error).toContain('可能已有进程或文件受到影响'); expect(store.prepare('model')).toBeNull()
  })
})
describe('UNKNOWN and stale-response fences', () => {
  it.each(['timeout', 'network-error', 'invalid-shape'] as const)('keeps %s unknown across status refresh, source swaps and leave', async code => {
    const { store, provider, context } = fixture(); vi.mocked(provider.run).mockRejectedValue(new LocalServiceOperationError(code, 'unknown'))
    expect(await stop(store)).toBe(false); expect(store.blockedUnknown).toBe(true)
    await store.refresh(); expect(store.canPrepare('model')).toBe(false); store.leave(); store.syncContext({ ...context, provider: { ...provider } }); await store.refresh()
    expect(store.blockedUnknown).toBe(true); expect(store.prepare('knowledge')).toBeNull(); expect(store.records[0]!.status).toBe('unknown'); expect(provider.run).toHaveBeenCalledOnce()
  })
  it('cancellation retains global lease until real provider result and idle settle; late success cannot overwrite', async () => {
    const { store, provider } = fixture(), result = deferred<LocalServiceOperationReply>(), idle = deferred<void>(); vi.mocked(provider.run).mockReturnValue(result.promise); vi.mocked(provider.waitForIdle).mockReturnValue(idle.promise)
    await store.refresh(); const pending = store.execute(store.prepare('model'), true); expect(store.cancel()).toBe(true); expect(store.cancel()).toBe(false); await tick()
    expect(store.records[0]!.status).toBe('unknown'); expect(store.busy).toBe(false); idle.resolve(); await tick(); expect(store.transportPending).toBe(true)
    result.resolve(stopped()); expect(await pending).toBe(false); expect(store.records[0]!.status).toBe('unknown'); expect(store.records[0]!.reply).toBeNull(); expect(store.transportPending).toBe(false); expect(store.blockedUnknown).toBe(true)
  })
  it.each(['leave', 'provider', 'read', 'scope'])('detaches %s in-flight receipts and does not adopt a late error or success', async change => {
    const { store, provider, context, readProvider } = fixture(), result = deferred<LocalServiceOperationReply>(); vi.mocked(provider.run).mockReturnValue(result.promise)
    await store.refresh(); const pending = store.execute(store.prepare('knowledge'), true)
    if (change === 'leave') store.leave()
    else store.syncContext({ ...context, ...(change === 'provider' ? { provider: { ...provider } } : change === 'read' ? { readProvider: { ...readProvider } } : { scopeKey: 'models' }) })
    result.resolve(stopped('knowledge')); expect(await pending).toBe(false)
    expect(store.records[0]).toMatchObject({ status: 'unknown', detached: true, reply: null }); expect(store.states).toBeNull(); expect(store.blockedUnknown).toBe(true)
  })
  it('fails closed if waitForIdle cannot establish settlement', async () => {
    const { store, provider } = fixture(); vi.mocked(provider.waitForIdle).mockRejectedValue(Error('PRIVATE'))
    await stop(store); expect(store.transportPending).toBe(true); expect(store.blockedUnknown).toBe(true); expect(store.records[0]!.status).toBe('unknown'); expect(store.error).not.toContain('PRIVATE')
  })
  it('does not accept wrong service, unconfirmed running, or malformed replies', async () => {
    for (const reply of [stopped('knowledge'), { ...stopped(), state: { running: true } }, { ...stopped(), extra: 'PRIVATE' }, null]) {
      setActivePinia(createPinia()); const { store, provider } = fixture(); vi.mocked(provider.run).mockResolvedValue(reply as never); expect(await stop(store)).toBe(false); expect(store.blockedUnknown).toBe(true)
    }
  })
  it('retains service-read lane on navigation and discards late old state', async () => {
    const { store, readProvider, context } = fixture(), result = deferred<ReturnType<typeof states>>(); vi.mocked(readProvider.loadServiceStates).mockReturnValue(result.promise)
    const pending = store.refresh(); store.leave(); store.syncContext(context); expect(store.reading).toBe(true); expect(await store.refresh()).toBe(false)
    result.resolve(states()); expect(await pending).toBe(false); expect(store.states).toBeNull(); expect(store.reading).toBe(false)
  })
  it('rotates only completed memory receipts within a bounded list', async () => {
    const { store } = fixture(); for (let i = 0; i < 22; i++) await stop(store)
    expect(store.records).toHaveLength(20); expect(store.records[0]!.id).toBe(3); expect(Object.isFrozen(store.records)).toBe(true); expect(Object.isFrozen(store.records[0])).toBe(true)
  })
})


describe('knowledge start confirmation and result semantics', () => {
  const offline = () => ({ knowledge: { running: false, frameable: false }, model: { running: false }, warnings: [] })
  it('requires an explicit unreachable snapshot, never unknown or running, for both original start targets', async () => {
    const { store, readProvider, provider } = fixture(); expect(store.prepare('knowledge', 'start')).toBeNull(); await store.refresh(); expect(store.prepare('knowledge', 'start')).toBeNull()
    vi.mocked(readProvider.loadServiceStates).mockResolvedValue(offline()); await store.refresh(); expect(store.canPrepare('knowledge', 'start')).toBe(true); expect(store.canPrepare('model', 'start')).toBe(true); expect(store.prepare('model', 'start')?.service).toBe('model')
    expect(provider.run).not.toHaveBeenCalled()
  })
  it('freezes original script side effects and consumes each start confirmation once', async () => {
    const { store, readProvider, provider } = fixture(); vi.mocked(readProvider.loadServiceStates).mockResolvedValue(offline()); await store.refresh(); const prepared = store.prepare('knowledge', 'start')!
    expect(prepared.impact).toContain('ExecutionPolicy Bypass'); expect(prepared.impact).toContain('既有 JWT'); expect(prepared.impact).toContain('检查摘要、日志和 PID'); expect(prepared.impact).toContain('disabled')
    expect(await store.execute(prepared, false)).toBe(false); expect(await store.execute({ ...prepared, action: 'stop' }, true)).toBe(false)
    expect(await store.execute(prepared, true)).toBe(true); expect(await store.execute(prepared, true)).toBe(false)
    expect(vi.mocked(provider.run).mock.calls[0]![0]).toEqual({ service: 'knowledge', action: 'start' }); expect(store.records[0]).toMatchObject({ action: 'start', status: 'acknowledged' })
    expect(store.records[0]!.message).toContain('不代表登录、检索或索引就绪'); expect(store.states).toBeNull()
  })
  it('requires start replies to match both target and action', async () => {
    const { store, readProvider, provider } = fixture(); vi.mocked(readProvider.loadServiceStates).mockResolvedValue(offline()); vi.mocked(provider.run).mockResolvedValue(stopped('knowledge'))
    await store.refresh(); expect(await store.execute(store.prepare('knowledge', 'start'), true)).toBe(false); expect(store.blockedUnknown).toBe(true)
  })
  it('cancelled start stays UNKNOWN after late success, changing source and status reads', async () => {
    const { store, readProvider, provider, context } = fixture(), result = deferred<LocalServiceOperationReply>(); vi.mocked(readProvider.loadServiceStates).mockResolvedValue(offline()); vi.mocked(provider.run).mockReturnValue(result.promise)
    await store.refresh(); const pending = store.execute(store.prepare('knowledge', 'start'), true); expect(store.prepare('model')).toBeNull(); store.leave(); store.syncContext(context)
    result.resolve({ service: 'knowledge', action: 'start', state: { running: true, frameable: true } }); await pending; await store.refresh()
    expect(store.records[0]).toMatchObject({ action: 'start', status: 'unknown', detached: true, reply: null }); expect(store.prepare('knowledge', 'start')).toBeNull(); expect(provider.run).toHaveBeenCalledOnce()
  })
})


describe('model launcher one-use start confirmation',()=>{
 it('requires stopped status and binds receipt to the model action, without claiming generation',async()=>{const {store,readProvider,provider}=fixture();expect(store.prepare('model','start')).toBeNull();await store.refresh();expect(store.prepare('model','start')).toBeNull();vi.mocked(readProvider.loadServiceStates).mockResolvedValue({model:{running:false},warnings:[]});await store.refresh();const prepared=store.prepare('model','start')!;expect(prepared.impact).toContain('0.0.0.0:8090');expect(await store.execute(prepared,false)).toBe(false);expect(await store.execute(prepared,true)).toBe(true);expect(provider.run).toHaveBeenCalledOnce();expect(store.records[0]!.message).toContain('不代表模型已加载');expect(await store.execute(prepared,true)).toBe(false)})
 it('keeps cancelled model start UNKNOWN after late success and re-read',async()=>{const {store,readProvider,provider}=fixture(),pending=deferred<LocalServiceOperationReply>();vi.mocked(readProvider.loadServiceStates).mockResolvedValue({model:{running:false},warnings:[]});vi.mocked(provider.run).mockReturnValue(pending.promise);await store.refresh();const operation=store.execute(store.prepare('model','start'),true);store.cancel();pending.resolve({service:'model',action:'start',state:{running:true}});await operation;await store.refresh();expect(store.blockedUnknown).toBe(true);expect(store.canPrepare('model','start')).toBe(false);expect(store.records[0]!.reply).toBeNull()})
})
