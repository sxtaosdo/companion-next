import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createCompanionBrowserProvider, type CompanionFetch } from '../src/adapters/companion-browser'
import type { CallRecord } from '../src/domain/companion-browser'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'

// Synthetic HTTP bodies only: no real fetch, database, executable, or listener.
// Query semantics follow the host CallHistoryStore: before is exclusive,
// failed filtering precedes pagination, total/retained remain unfiltered.
const rows: CallRecord[] = Array.from({ length: 132 }, (_, index) => {
  const sequence = 132 - index, failed = sequence % 2 === 0
  return {
    id: `synthetic-${sequence}`, sequence, projectId: 'fixture-project',
    operation: 'synthetic_read', operationNameZh: `Synthetic read ${sequence}`,
    source: 'web', startedAt: '2026-10-19T00:00:00.000Z', durationMs: sequence,
    status: failed ? 'failed' : 'success', inputSummary: `input-${sequence}`,
    ...(failed ? { errorSummary: `error-${sequence}` } : { resultSummary: `result-${sequence}` }),
  }
})
function fixture() {
  const requests: string[] = []
  let failNext = false, corruptNext = false
  const fetch: CompanionFetch = async (path, init) => {
    expect(init.method).toBe('GET')
    requests.push(path)
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    if (path === '/api/projects') return json([{ id: 'fixture-project', name: 'Synthetic only', path: '/synthetic-only' }])
    if (path === '/api/calls/counts') return json({ sessionId: 'synthetic-session', counts: { 'fixture-project': 132 }, latest: {} })
    if (!path.startsWith('/api/projects/fixture-project/calls?')) throw new Error('Unexpected fixture request')
    if (failNext) { failNext = false; return json({ error: 'synthetic unavailable' }, 503) }
    const query = new URL(path, 'https://fixture.invalid').searchParams
    expect(query.get('limit')).toBe('50')
    const before = query.has('before') ? Number(query.get('before')) : Infinity
    const matching = rows.filter(row => row.sequence < before && (query.get('status') !== 'failed' || row.status === 'failed'))
    const records = structuredClone(matching.slice(0, 50))
    if (corruptNext) { corruptNext = false; records[0]!.projectId = 'foreign-project' }
    return json({ sessionId: 'synthetic-session', total: 132, retained: 132, records,
      ...(matching.length > 50 ? { nextBefore: records.at(-1)!.sequence } : {}) })
  }
  return { requests, fetch, fail() { failNext = true }, corrupt() { corruptNext = true } }
}
async function setup() {
  const f = fixture(), store = useCompanionBrowserStore()
  await store.connect(createCompanionBrowserProvider({ fetch: f.fetch, runtimeProbes: false }))
  store.setCallContext('fixture-project', false)
  return { f, store }
}
beforeEach(() => setActivePinia(createPinia()))

describe('synthetic HTTP adapter to call-store pagination acceptance', () => {
  it('reads 132 records across 50/50/32, then 66 failures across 50/16 without missing or duplicate IDs', async () => {
    const { f, store } = await setup()
    await store.loadCalls(); expect(store.records).toHaveLength(50); expect(store.nextBefore).toBe(83)
    await store.loadCalls(true); expect(store.records).toHaveLength(100); expect(store.nextBefore).toBe(33)
    await store.loadCalls(true)
    expect(store.records).toEqual(rows); expect(new Set(store.records.map(row => row.id)).size).toBe(132)
    expect(store.nextBefore).toBeUndefined(); expect(store.total).toBe(132); expect(store.retained).toBe(132)
    const callsBeforeEnd = f.requests.length; await store.loadCalls(true); expect(f.requests).toHaveLength(callsBeforeEnd)
    store.setCallContext('fixture-project', true); expect(store.records).toEqual([])
    await store.loadCalls(); expect(store.records).toHaveLength(50); expect(store.nextBefore).toBe(34)
    await store.loadCalls(true)
    expect(store.records).toEqual(rows.filter(row => row.status === 'failed'))
    expect(store.records).toHaveLength(66); expect(store.nextBefore).toBeUndefined()
    expect(store.total).toBe(132); expect(store.retained).toBe(132)
    expect(f.requests.slice(-2)).toEqual(['/api/projects/fixture-project/calls?limit=50&status=failed', '/api/projects/fixture-project/calls?limit=50&status=failed&before=34'])
    store.setCallContext('fixture-project', false); await store.loadCalls()
    expect(store.records).toEqual(rows.slice(0, 50))
  })

  it('preserves first-page data and cursor after append failure, retries the same cursor once, and clears the error', async () => {
    const { f, store } = await setup(); await store.loadCalls(); f.fail(); await store.loadCalls(true)
    expect(store.callError).not.toBe(''); expect(store.records).toEqual(rows.slice(0, 50)); expect(store.nextBefore).toBe(83)
    await store.loadCalls(true)
    expect(f.requests.slice(-2)).toEqual(Array(2).fill('/api/projects/fixture-project/calls?limit=50&before=83'))
    expect(store.records).toEqual(rows.slice(0, 100)); expect(store.callError).toBe(''); expect(store.callLoading).toBe(false)
  })

  it('rejects a foreign-project append without partial merge and permits recovery from a valid page', async () => {
    const { f, store } = await setup(); await store.loadCalls(); f.corrupt(); await store.loadCalls(true)
    expect(store.callError).not.toBe(''); expect(store.records).toEqual(rows.slice(0, 50)); expect(store.nextBefore).toBe(83)
    await store.loadCalls(true)
    expect(store.callError).toBe(''); expect(store.records).toEqual(rows.slice(0, 100))
  })

  it('clears stale nonempty records on failed refresh, shows unknown totals, then restores correct summaries', async () => {
    const { f, store } = await setup(); await store.loadCalls(); f.fail(); await store.loadCalls()
    expect(store.records).toEqual([]); expect(store.total).toBeNull(); expect(store.retained).toBeNull()
    expect(store.callRead).toBe(false); expect(store.callError).not.toBe('')
    await store.loadCalls()
    expect(store.callError).toBe(''); expect(store.callRead).toBe(true)
    expect(store.records[0]).toMatchObject({ inputSummary: 'input-132', errorSummary: 'error-132' })
    expect(store.records[1]).toMatchObject({ inputSummary: 'input-131', resultSummary: 'result-131' })
    expect(store.total).toBe(132); expect(store.retained).toBe(132)
  })
})
