import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'
import { createAiJobActionsState } from '../src/stores/ai-job-actions'
import { AiJobActionError } from '../src/domain/ai-job-actions'
import type { AiJobActionsProvider } from '../src/domain/ai-job-actions'
import { AI_WRITE_FENCE_KEY, putAiWriteFence, readAiWriteFences } from '../src/domain/ai-write-coordination'
import type { AiWriteCoordinator, AiWriteFenceStorage } from '../src/domain/ai-write-coordination'
import type { AiJobSnapshot, AiJobPreview, AiJobsReadProvider } from '../src/domain/ai-jobs-read'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { testCrypto } from './fixtures/generation-png'
const id = '0123456789abcdef', jobId = 'STUDIO-RUN-icon-demo-0123abcd', candidateId = 'CANDIDATE-gem-1', project = { id, name: '工程 A', path: '/fixture/A' }, source = {}
function job(state: AiJobSnapshot['state'] = 'queued'): AiJobSnapshot { return { projectId: id, jobId, revision: 1, state, sourceRevision: 'a'.repeat(40), requestHash: 'b'.repeat(64), mode: 'generation', profile: 'local-icon-v1', budget: { maxAssets: 2, candidatesPerAsset: 1, submissionAttempts: 1 }, createdAt: '2026-10-15T13:00:00Z', assets: [{ assetId: 'gem', relativePath: 'assets/icons/gem.png' }], candidates: [{ candidateId, assetId: 'gem', fileSha256: 'c'.repeat(64), width: 1024, height: 1024, hasAlpha: true }], selectedIds: ['selected','imported_pending_verification'].includes(state) ? [candidateId] : [], import: null, workerResident: false, productionVerified: false,
  resourceSnapshot: { state: 'sealed', version: 1, hash: 'd'.repeat(64), presetId: 'default', config: { schemaVersion: 'project-resource-config-v2', projectId: id, version: 1, designResolution: { width: 720, height: 1280 }, orientation: 'portrait', iconSize: { width: 256, height: 256 }, style: { description: 'Gem', references: [] }, background: { format: 'png', transparent: true, color: '#ffffff' }, composition: { centered: true, paddingPercent: 10 }, destination: { directory: 'assets/icons', exportDirectory: 'art/final/icons', naming: 'kebab-case' } } } } }
function storage() { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value) } } }
function coordination() { let active = false; const coordinator: AiWriteCoordinator = { async run(work) { if (active) return { acquired: false }; active = true; try { return { acquired: true, value: await work() } } finally { active = false } } }; return { coordinator, locked: () => active } }
function reader(snapshot = job()): AiJobsReadProvider { return { label: 'reader', waitForIdle: vi.fn(async () => undefined), readStatus: vi.fn(async () => snapshot), readJobs: vi.fn(), previewCandidate: vi.fn() } }
function writer(): AiJobActionsProvider { return { label: 'writer', execute: vi.fn<AiJobActionsProvider['execute']>(async (_id, submission) => ({ kind: 'dispatch', dispatchAccepted: true, job: submission.snapshot })), waitForIdle: vi.fn(async () => undefined) } }
function setup(snapshot = job(), saved: AiWriteFenceStorage = storage()) { const lock = coordination(), read = reader(snapshot), write = writer(), store = reactive(createAiJobActionsState({ storage: saved, coordinator: lock.coordinator })); store.setContext(project, source, snapshot, read, write); return { store, read, write, saved, lock } }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
const tick = async () => { for (let n = 0; n < 12; n++) await Promise.resolve() }
function crc(bytes: Uint8Array) { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0) } return (value ^ 0xffffffff) >>> 0 }
function chunk(name: string, data: Uint8Array) { const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer); view.setUint32(0, data.length); bytes.set([...name].map(char => char.charCodeAt(0)), 4); bytes.set(data, 8); view.setUint32(bytes.length - 4, crc(bytes.subarray(4, bytes.length - 4))); return bytes }
async function preview(): Promise<AiJobPreview> {
  const name = 'node:zlib', { deflateSync } = await import(name) as { deflateSync: (value: Uint8Array) => Uint8Array }, header = new Uint8Array(13), view = new DataView(header.buffer)
  view.setUint32(0,1024); view.setUint32(4,1024); header.set([8,6,0,0,0],8)
  const parts = [new Uint8Array([137,80,78,71,13,10,26,10]), chunk('IHDR',header), chunk('IDAT',deflateSync(new Uint8Array(4097 * 1024))), chunk('IEND',new Uint8Array())]
  const bytes = new Uint8Array(parts.reduce((size,part) => size + part.length,0)); let offset = 0; for (const part of parts) { bytes.set(part,offset); offset += part.length }
  return { candidateId, mimeType: 'image/png', width: 1024, height: 1024, base64: btoa(Array.from(bytes,byte => String.fromCharCode(byte)).join('')), sha256: Array.from(new Uint8Array(await testCrypto.subtle.digest('SHA-256',bytes)),byte => byte.toString(16).padStart(2,'0')).join('') }
}
beforeEach(() => { setActivePinia(createPinia()); vi.stubGlobal('crypto', testCrypto) })
afterEach(() => vi.unstubAllGlobals())
describe('frozen explicit action consent', () => {
  it('never reads or writes from context registration, preparing, checkbox or cancellation alone', async () => { const { store,read,write } = setup(); expect(store.prepare('run-next')).toBe(true); store.setConfirmed(true); expect(store.canExecute).toBe(true); store.cancelConfirmation(); await store.execute(); expect(read.readStatus).not.toHaveBeenCalled(); expect(write.execute).not.toHaveBeenCalled() })
  it('requires both explicit frozen confirmation and matching complete context', async () => { const { store,write } = setup(); await store.execute(); store.prepare('run-next'); await store.execute(); expect(write.execute).not.toHaveBeenCalled(); expect(Object.isFrozen(store.confirmation?.submission.snapshot)).toBe(true) })
  it.each(['project','name','path','source','reader','provider','revision','hash','sourceRevision','candidate','leave'] as const)('invalidates approval on %s change', async kind => {
    const { store,read,write } = setup(); store.prepare('run-next'); store.setConfirmed(true)
    if (kind === 'leave') store.leave()
    else { const target = { ...project }, snapshot = job(); if (kind === 'project') { target.id = 'fedcba9876543210'; snapshot.projectId = target.id }; if (kind === 'name') target.name = 'new'; if (kind === 'path') target.path = '/other'; if (kind === 'revision') snapshot.revision++; if (kind === 'hash') snapshot.requestHash = 'f'.repeat(64); if (kind === 'sourceRevision') snapshot.sourceRevision = 'f'.repeat(40); if (kind === 'candidate') snapshot.candidates[0]!.fileSha256 = 'f'.repeat(64)
      store.setContext(target, kind === 'source' ? {} : source, snapshot, kind === 'reader' ? reader() : read, kind === 'provider' ? writer() : write) }
    expect(store.confirmed).toBe(false); expect(store.confirmation).toBeNull(); await store.execute(); expect(write.execute).not.toHaveBeenCalled()
  })
  it('does not infer generation permission from missing mode', () => { const { store,read,write } = setup(); const snapshot = job(); delete snapshot.mode; store.setContext(project,source,snapshot,read,write); expect(store.prepare('run-next')).toBe(false); store.setContext(project,source,snapshot,read,write,false); expect(store.prepare('run-next')).toBe(true) })
  it('disallows importing two saved candidates in the single-icon UI even though backend can read them', () => { const value = job('selected'); value.assets.push({assetId:'gem-two',relativePath:'assets/icons/gem-two.png'}); value.candidates.push({...value.candidates[0]!, candidateId:'CANDIDATE-gem-two-1',assetId:'gem-two'}); value.selectedIds.push('CANDIDATE-gem-two-1'); const {store} = setup(value); expect(store.prepare('import')).toBe(false) })
  it('keeps a hash-matching individually displayed preview prerequisite and resets consent on selection', async () => {
    const image = await preview(), value = job('awaiting_selection'); value.candidates[0]!.fileSha256 = image.sha256; const {store} = setup(value)
    await store.recordPreview(image,false); store.setSelectedIds([candidateId]); expect(store.selectedIds).toEqual([]); expect(store.prepare('select')).toBe(false)
    expect(await store.recordPreview(image,true)).toBe(true); store.setSelectedIds([candidateId]); expect(store.prepare('select')).toBe(true); store.setConfirmed(true); store.setSelectedIds([]); expect(store.confirmation).toBeNull()
  })
  it('rejects wrong PNG or SHA and late verified preview after context changes', async () => {
    const image = await preview(), value = job('awaiting_selection'); value.candidates[0]!.fileSha256 = image.sha256; const {store,read,write} = setup(value)
    expect(await store.recordPreview({...image,base64:'AAAA'},true)).toBe(false)
    const pending = store.recordPreview(image,true); store.setContext(project,{},value,read,write); expect(await pending).toBe(false); expect(store.previewed).toEqual({})
  })
  it('freezes one default or custom size and separately requires upscale consent', () => {
    const {store} = setup(job('selected')); expect(store.prepare('export-variant')).toBe(true); expect(store.confirmation?.submission.input).toMatchObject({width:256,height:256,expectedTargetSha256:null,allowUpscale:false}); store.cancelConfirmation()
    expect(store.prepare('export-variant',{width:2048,height:2048})).toBe(true); store.setConfirmed(true); expect(store.canExecute).toBe(false); store.setUpscaleConfirmed(true); expect(store.canExecute).toBe(true)
    expect(store.prepare('export-variant',{width:4096,height:4096})).toBe(false)
  })
})
describe('persistent unknown fence and readback isolation', () => {
  it('accepted dispatch refreshes exactly the same original job without claiming execution success', async () => {
    const {store,read,write} = setup(); store.prepare('run-next'); store.setConfirmed(true); expect(await store.execute()).toBe(true)
    expect(write.execute).toHaveBeenCalledTimes(1); expect(read.readStatus).toHaveBeenCalledExactlyOnceWith(id,jobId,expect.any(AbortSignal)); expect(store.phase).toBe('accepted'); expect(store.message).toContain('执行前快照'); expect(store.hasPending).toBe(true); expect(store.readback).toMatchObject({project,source,reader:read,snapshot:{state:'queued'}})
  })
  it('keeps unknown across leave, provider/source replacement, new instance and unchanged status', async () => {
    const {store,read,write,saved} = setup(); write.execute = vi.fn(async () => { throw new AiJobActionError('timeout','unknown') }); store.prepare('run-next'); store.setConfirmed(true); await store.execute(); expect(readAiWriteFences(saved)).toHaveLength(1)
    store.leave(); store.setContext(project,{},job(),read,writer()); expect(store.prepare('run-next')).toBe(false)
    const second = setup(job(),saved); expect(second.store.hasPending).toBe(true); await second.store.refreshStatus(); expect(second.store.prepare('run-next')).toBe(false)
  })
  it('holds both Web Lock and project lane through ignored timeout cleanup even after leave', async () => {
    const {store,write,saved,lock} = setup(), idle = deferred<void>(); write.execute = vi.fn(async () => { throw new AiJobActionError('timeout','unknown') }); write.waitForIdle = () => idle.promise
    store.prepare('run-next'); store.setConfirmed(true); const pending = store.execute(); await tick(); expect(store.phase).toBe('unknown'); expect(lock.locked()).toBe(true); expect(useProjectOperationLaneStore().locked).toBe(true)
    store.leave(); expect(store.busy).toBe(true); expect(readAiWriteFences(saved)).toHaveLength(1); idle.resolve(); await pending; expect(lock.locked()).toBe(false); expect(useProjectOperationLaneStore().locked).toBe(false); expect(readAiWriteFences(saved)).toHaveLength(1)
  })
  it('discards late response display and readback from an old source', async () => {
    const {store,read,write,saved} = setup(), pendingResponse = deferred<Awaited<ReturnType<AiJobActionsProvider['execute']>>>(); write.execute = vi.fn(() => pendingResponse.promise)
    store.prepare('run-next'); store.setConfirmed(true); const pending = store.execute(); await tick(); store.setContext({...project,path:'/different'}, {}, job(), read, write)
    pendingResponse.resolve({kind:'dispatch',dispatchAccepted:true,job:job()}); await pending; expect(store.readback).toBeNull(); expect(read.readStatus).not.toHaveBeenCalled(); expect(readAiWriteFences(saved)).toHaveLength(1)
  })
  it('rejects foreign/read-regressing snapshots and cannot unlock from status with mismatched hash', async () => {
    const {store,read,write,saved} = setup(); write.execute = vi.fn(async () => {throw new AiJobActionError('timeout','unknown')}); store.prepare('run-next'); store.setConfirmed(true); await store.execute()
    read.readStatus = vi.fn(async () => ({...job('running'),revision:2,requestHash:'f'.repeat(64)})); expect(await store.refreshStatus()).toBe(false); expect(readAiWriteFences(saved)).toHaveLength(1)
  })
  it('newer original running status reconciles generation fence, but cannot replay stale displayed revision', async () => {
    const {store,read,saved} = setup(); store.prepare('run-next'); store.setConfirmed(true); await store.execute(); read.readStatus = vi.fn(async () => ({...job('running'),revision:2})); await store.refreshStatus()
    expect(readAiWriteFences(saved)).toEqual([]); expect(store.prepare('run-next')).toBe(false); expect(store.readback?.snapshot.state).toBe('running')
  })
  it('does not clear import UNKNOWN for a higher selected revision or unknown lease/effect', async () => {
    const value = job('selected'), {store,read,write,saved} = setup(value); write.execute = vi.fn(async () => {throw new AiJobActionError('timeout','unknown')}); store.prepare('import'); store.setConfirmed(true); await store.execute()
    for (const snapshot of [{...value,revision:2},{...job('import_unknown'),revision:3},{...job('imported_pending_verification'),revision:4,import:{operationId:`icon-import-${'a'.repeat(32)}`,state:'done',effectApplied:'UNKNOWN' as const,leaseState:'RELEASED' as const,errorCode:null,tools:[]}}]) { read.readStatus = vi.fn(async () => snapshot); await store.refreshStatus(); expect(readAiWriteFences(saved)).toHaveLength(1) }
    for (const [index,state] of ['STARTED','import_unknown','done'].entries()) {
      read.readStatus=vi.fn(async()=>({...job('imported_pending_verification'),revision:5+index,import:{operationId:`icon-import-${'a'.repeat(32)}`,state,effectApplied:true,leaseState:'RELEASED' as const,errorCode:null,tools:[]}}))
      await store.refreshStatus();expect(readAiWriteFences(saved)).toHaveLength(1)
    }
    read.readStatus = vi.fn(async () => ({...job('imported_pending_verification'),revision:8,import:{operationId:`icon-import-${'a'.repeat(32)}`,state:'imported_pending_verification',effectApplied:true,leaseState:'RELEASED' as const,errorCode:null,tools:[]}})); await store.refreshStatus(); expect(readAiWriteFences(saved)).toEqual([])
  })
  it('cannot reconcile unknown size export from status at any revision', async () => {
    const {store,read,write,saved} = setup(job('selected')); write.execute = vi.fn(async () => {throw new AiJobActionError('timeout','unknown')}); store.prepare('export-variant'); store.setConfirmed(true); await store.execute()
    read.readStatus = vi.fn(async () => ({...job('imported_pending_verification'),revision:99})); await store.refreshStatus(); expect(readAiWriteFences(saved)).toHaveLength(1)
  })
  it('blocks action when creation uses the shared ledger, and never clears a creation marker', async () => {
    const saved = storage(); putAiWriteFence(saved,{key:`${id}/${jobId}/enqueue`,projectId:id,jobId,operation:'enqueue',revision:0,requestHash:null,sourceRevision:'a'.repeat(40)})
    const {store,read} = setup(job(),saved); expect(store.prepare('run-next')).toBe(false); read.readStatus = vi.fn(async () => ({...job('running'),revision:3})); await store.refreshStatus(); expect(readAiWriteFences(saved)).toHaveLength(1)
  })
  it('fail-closes corrupt storage or unavailable coordination without sending', async () => {
    const saved = storage(); saved.setItem(AI_WRITE_FENCE_KEY,'bad-json'); const {store,write} = setup(job(),saved); expect(store.prepare('run-next')).toBe(false); expect(write.execute).not.toHaveBeenCalled()
    const second = reactive(createAiJobActionsState({storage:storage(),coordinator:{run:async () => {throw Error('not available')}}})); const secondWriter = writer(); second.setContext(project,source,job(),reader(),secondWriter); second.prepare('run-next'); second.setConfirmed(true); await second.execute(); expect(secondWriter.execute).not.toHaveBeenCalled()
  })
  it('rechecks ledger under lock instead of trusting prepared UI', async () => {
    const {store,write,saved} = setup(); store.prepare('run-next'); store.setConfirmed(true); putAiWriteFence(saved,{key:`${id}/${jobId}/adopt`,projectId:id,jobId,operation:'adopt',revision:0,requestHash:null,sourceRevision:'a'.repeat(40)}); await store.execute(); expect(write.execute).not.toHaveBeenCalled()
  })
  it('definite original version conflict releases own marker but never automatically retries', async () => {
    const {store,write,saved} = setup(); write.execute = vi.fn(async () => {throw new AiJobActionError('stale','conflict')}); store.prepare('run-next'); store.setConfirmed(true); await store.execute(); expect(write.execute).toHaveBeenCalledTimes(1); expect(readAiWriteFences(saved)).toEqual([]); expect(store.confirmation).toBeNull()
  })
})


describe('reader drainage before another mutation', () => {
  it('fails closed when a reader has no tracked I/O drain', () => {
    const {store,read,write} = setup(); delete read.waitForIdle; store.setContext(project,source,job(),read,write)
    expect(store.prepare('run-next')).toBe(false); expect(write.execute).not.toHaveBeenCalled()
  })
  it('does not write or invent a fence when reader cleanup rejects, and keeps global/lane across context replacement', async () => {
    const {store,read,write,saved,lock} = setup(); read.waitForIdle = vi.fn(async () => {throw Error('SECRET')})
    store.prepare('run-next'); store.setConfirmed(true); void store.execute(); await tick()
    expect(write.execute).not.toHaveBeenCalled(); expect(readAiWriteFences(saved)).toEqual([]); expect(store.readDrainBlocked).toBe(true); expect(store.message).not.toContain('SECRET')
    expect(store.phase).toBe('not-sent'); expect(store.message).toContain('未发送'); expect(lock.locked()).toBe(true); expect(useProjectOperationLaneStore().locked).toBe(true)
    const nextReader=reader(), nextWriter=writer(); store.setContext({...project,path:'/new-context'}, {}, job(), nextReader,nextWriter)
    expect(store.prepare('run-next')).toBe(false); expect(lock.locked()).toBe(true); expect(useProjectOperationLaneStore().acquire('其它工程操作')).toBeNull()
    const second=reactive(createAiJobActionsState({storage:saved,coordinator:lock.coordinator}));second.setContext(project,{},job(),nextReader,nextWriter)
    expect(second.prepare('run-next')).toBe(false); await second.execute(); expect(nextWriter.execute).not.toHaveBeenCalled()
    const competing=vi.fn(async()=>true); expect(await lock.coordinator.run(competing)).toEqual({acquired:false}); expect(competing).not.toHaveBeenCalled()
    store.leave(); expect(lock.locked()).toBe(true); expect(useProjectOperationLaneStore().locked).toBe(true); expect(readAiWriteFences(saved)).toEqual([])
  })
  it('retains lock while an earlier read ignores abort, and cancel before dispatch never sends', async () => {
    const {store,read,write,saved,lock} = setup(), idle = deferred<void>(); read.waitForIdle = () => idle.promise
    store.prepare('run-next'); store.setConfirmed(true); const pending = store.execute(); await tick()
    expect(lock.locked()).toBe(true); expect(write.execute).not.toHaveBeenCalled(); store.cancelWait(); idle.resolve(); await pending
    expect(write.execute).not.toHaveBeenCalled(); expect(readAiWriteFences(saved)).toEqual([]); expect(lock.locked()).toBe(false)
  })
  it('revokes existing consent on explicit status refresh and waits for reader drain before readback', async () => {
    const {store,read,write} = setup(), idle = deferred<void>(); read.waitForIdle = () => idle.promise
    store.prepare('run-next'); store.setConfirmed(true); const pending = store.refreshStatus(); await tick()
    expect(store.confirmation).toBeNull(); expect(store.refreshing).toBe(true); expect(store.readback).toBeNull(); expect(write.execute).not.toHaveBeenCalled()
    idle.resolve(); expect(await pending).toBe(true); expect(store.refreshing).toBe(false); expect(store.readback?.snapshot.jobId).toBe(jobId)
  })
  it('preserves draining read state after a logical read timeout until ignored body cancellation settles', async () => {
    const {store,read} = setup(), idle = deferred<void>(); read.readStatus = vi.fn(async () => {throw Error('timeout')}); read.waitForIdle = () => idle.promise
    const pending = store.refreshStatus(); await tick(); expect(store.refreshing).toBe(true); expect(store.message).toContain('未能核对')
    idle.resolve(); expect(await pending).toBe(false); expect(store.refreshing).toBe(false)
  })
})


describe('post-dispatch readback lock span', () => {
  it('holds both mutation locks until a timed-out status read drains', async () => {
    const {store,read,lock} = setup(), idle = deferred<void>(); let calls = 0
    read.waitForIdle = () => ++calls === 1 ? Promise.resolve() : idle.promise
    read.readStatus = vi.fn(async () => {throw Error('status timeout')})
    store.prepare('run-next'); store.setConfirmed(true); const pending = store.execute(); await tick()
    expect(read.readStatus).toHaveBeenCalledTimes(1); expect(store.busy).toBe(true); expect(lock.locked()).toBe(true); expect(useProjectOperationLaneStore().locked).toBe(true)
    store.leave(); expect(lock.locked()).toBe(true); idle.resolve(); await pending
    expect(lock.locked()).toBe(false); expect(useProjectOperationLaneStore().locked).toBe(false)
  })
})


describe('stage consent invalidation during pre-dispatch drain', () => {
  it('never dispatches after a stage revoked the already-captured confirmation', async () => {
    const {store,read,write,saved,lock} = setup(), idle = deferred<void>(); read.waitForIdle = () => idle.promise
    store.prepare('run-next'); store.setConfirmed(true); const pending = store.execute(); await tick()
    store.revokePendingScope(); expect(store.job?.jobId).toBe(jobId); expect(lock.locked()).toBe(true)
    idle.resolve(); await pending; expect(write.execute).not.toHaveBeenCalled(); expect(readAiWriteFences(saved)).toEqual([])
  })
})


describe('rejected post-dispatch read drainage', () => {
  it('does not reconcile newer status or release either lock when automatic read cleanup rejects', async () => {
    const {store,read,write,saved,lock} = setup(); let calls=0
    read.waitForIdle = async () => {if (++calls > 1) throw Error('SECRET')}
    read.readStatus = vi.fn(async () => ({...job('running'),revision:2}))
    store.prepare('run-next'); store.setConfirmed(true); void store.execute(); await tick()
    expect(write.execute).toHaveBeenCalledTimes(1); expect(read.readStatus).toHaveBeenCalledTimes(1); expect(readAiWriteFences(saved)).toHaveLength(1)
    expect(store.readback).toBeNull(); expect(store.readDrainBlocked).toBe(true); expect(lock.locked()).toBe(true); expect(useProjectOperationLaneStore().locked).toBe(true)
    store.setContext({...project,path:'/replacement'}, {}, job(), reader(),writer())
    expect(store.prepare('run-next')).toBe(false); store.leave(); expect(lock.locked()).toBe(true); expect(readAiWriteFences(saved)).toHaveLength(1)
  })
  it('keeps the original selected-write fence until automatic read cleanup is confirmed', async () => {
    const image=await preview(), value=job('awaiting_selection');value.candidates[0]!.fileSha256=image.sha256
    const {store,read,write,saved,lock}=setup(value); let calls=0
    read.waitForIdle=async()=>{if(++calls>1)throw Error('cleanup')}
    const selected={...value,revision:2,state:'selected' as const,selectedIds:[candidateId]}
    write.execute=vi.fn(async()=>({kind:'selection' as const,job:selected}));read.readStatus=vi.fn(async()=>selected)
    await store.recordPreview(image,true);store.setSelectedIds([candidateId]);store.prepare('select');store.setConfirmed(true);void store.execute();await tick()
    expect(readAiWriteFences(saved)).toHaveLength(1);expect(lock.locked()).toBe(true);expect(store.readback).toBeNull()
  })
})

describe('strict read-only legacy variant dispatch observation', () => {
  function fixture() {
    const snapshot = job('selected'), variant = { candidateId, width: 96, height: 96, fileSha256: 'e'.repeat(64), receiptSha256: 'f'.repeat(64), destinationUrl: 'db://assets/icons/gem-96.png' }
    const observation = { schemaVersion: 'variant-dispatch-observation-v1' as const, state: 'not-started' as const, effectApplied: false as const,
      originalReceipt: null, leaseDisposition: 'not-claimed' as const, reason: 'KNOWN_LEGACY_PREPARE_REJECTED_BEFORE_READ_WRITE' as const,
      binding: { projectId: id, jobId, revision: 1, requestHash: snapshot.requestHash, sourceRevision: snapshot.sourceRevision,
        motherSha256: snapshot.candidates[0]!.fileSha256, configHash: 'd'.repeat(64), ...variant }, taskSha256: '1'.repeat(64), observedAt: '2026-10-21T12:00:00.000Z' }
    snapshot.variantDispatchObservation = observation
    const fence = { key: `${id}/${jobId}/import-variant/1/${candidateId}/96x96`, projectId: id, jobId, operation: 'import-variant' as const,
      revision: 1, requestHash: snapshot.requestHash, sourceRevision: snapshot.sourceRevision, variant }
    return { snapshot, observation, fence }
  }
  it('uses existing refresh to release only the exact proven pre-dispatch fence without sending a write or inventing a receipt', async () => {
    const { snapshot, fence } = fixture(), saved = storage(); putAiWriteFence(saved,fence)
    putAiWriteFence(saved,{...fence,key:fence.key+'-other',variant:{...fence.variant,width:97}})
    const { store,write } = setup(snapshot,saved)
    expect(await store.refreshStatus()).toBe(true)
    expect(readAiWriteFences(saved)).toEqual([expect.objectContaining({key:fence.key+'-other'})])
    expect(store.observed?.import).toBeNull(); expect(store.observed?.variantImport).toBeUndefined()
    expect(store.phase).toBe('not-sent'); expect(store.message).toContain('未调用 Creator'); expect(write.execute).not.toHaveBeenCalled()
  })
  it.each(['candidateId','width','height','fileSha256','receiptSha256','destinationUrl','revision','requestHash','sourceRevision','projectId','jobId'] as const)('does not release a mismatched %s binding', async key => {
    const {snapshot,observation,fence}=fixture(), saved=storage(); putAiWriteFence(saved,fence)
    const b = observation.binding as unknown as Record<string, unknown>
    b[key] = typeof b[key] === 'number' ? Number(b[key])+1 : key === 'candidateId' ? 'CANDIDATE-other-1' : key === 'destinationUrl' ? 'db://assets/icons/other.png' : key === 'jobId' ? 'STUDIO-RUN-other-0123abcd' : key === 'projectId' ? 'fedcba9876543210' : '0'.repeat(key === 'sourceRevision' ? 40 : 64)
    const {store}=setup(job('selected'),saved); const read=reader(snapshot)
    store.setContext(project,source,job('selected'),read,writer()); await store.refreshStatus(); expect(readAiWriteFences(saved)).toHaveLength(1)
  })
  it.each(['effect','lease','receipt','reason','mother','config','active-import','extra'])('retains original fence for malformed or nonproof %s',async kind => {
    const {snapshot,observation,fence}=fixture(),saved=storage(); putAiWriteFence(saved,fence)
    const raw=observation as unknown as Record<string,unknown>
    if(kind==='effect') raw.effectApplied='UNKNOWN'
    if(kind==='lease') raw.leaseDisposition='RELEASED'
    if(kind==='receipt') raw.originalReceipt={state:'done'}
    if(kind==='reason') raw.reason='NO_RECORD'
    if(kind==='mother') observation.binding.motherSha256='0'.repeat(64)
    if(kind==='config') observation.binding.configHash='0'.repeat(64)
    if(kind==='active-import') snapshot.import={operationId:'icon-import-'+ 'a'.repeat(32),state:'STARTED',effectApplied:'UNKNOWN',leaseState:'UNKNOWN',errorCode:null,tools:[]}
    if(kind==='extra') raw.untrusted=true
    const {store}=setup(job('selected'),saved); store.setContext(project,source,job('selected'),reader(snapshot),writer()); expect(await store.refreshStatus()).toBe(false)
    expect(readAiWriteFences(saved)).toHaveLength(1)
  })
  it('absence of a record or observation never releases same-revision UNKNOWN',async()=>{
    const {snapshot,fence}=fixture(),saved=storage();delete snapshot.variantDispatchObservation;putAiWriteFence(saved,fence)
    const {store}=setup(snapshot,saved);await store.refreshStatus();expect(readAiWriteFences(saved)).toHaveLength(1)
  })
})
