import { isAiProjectId } from './ai-resource-read'
import { isAiJobId } from './ai-jobs-read'

/** Shared by original-job actions and enqueue/adopt. This lock never claims server-side CAS. */
export const AI_WRITE_LOCK_NAME = 'companion-next:ai-write-v1'
export const AI_WRITE_FENCE_KEY = 'companion-next.ai-write-fences.v1'
export interface AiWriteFenceStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface AiWriteFence {
  key: string; projectId: string; jobId: string
  operation: 'run-next' | 'resume' | 'select' | 'import' | 'export-variant' | 'enqueue' | 'adopt'
  revision: number; requestHash: string | null; sourceRevision: string
}
export type AiWriteLockResult<T> = { acquired: false } | { acquired: true; value: T }
export interface AiWriteCoordinator { run<T>(work: () => Promise<T>): Promise<AiWriteLockResult<T>> }
export class AiWriteCoordinationError extends Error {
  constructor() { super('无法可靠取得跨标签页写操作锁或保存操作保护记录；已阻止写入，仍可读取原任务。'); this.name = 'AiWriteCoordinationError' }
}
const limit = 64 * 1024, maxRecords = 100
const fields = ['key', 'projectId', 'jobId', 'operation', 'revision', 'requestHash', 'sourceRevision']
function check(value: unknown): AiWriteFence {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Reflect.ownKeys(value).length !== fields.length
    || fields.some(field => !Object.hasOwn(value, field)) || Reflect.ownKeys(value).some(key => typeof key !== 'string' || !fields.includes(key))) throw new AiWriteCoordinationError()
  const raw = value as Record<string, unknown>, create = raw.operation === 'enqueue' || raw.operation === 'adopt'
  if (typeof raw.key !== 'string' || raw.key.length < 1 || raw.key.length > 300 || !/^[A-Za-z0-9:/._-]+$/.test(raw.key)
    || !isAiProjectId(raw.projectId) || !isAiJobId(raw.jobId) || !['run-next', 'resume', 'select', 'import', 'export-variant', 'enqueue', 'adopt'].includes(raw.operation as string)
    || typeof raw.revision !== 'number' || !Number.isSafeInteger(raw.revision) || (create ? raw.revision !== 0 : raw.revision < 1)
    || !(raw.requestHash === null && create || typeof raw.requestHash === 'string' && /^[a-f0-9]{64}$/.test(raw.requestHash))
    || typeof raw.sourceRevision !== 'string' || !/^[a-f0-9]{40}$/.test(raw.sourceRevision)) throw new AiWriteCoordinationError()
  return { key: raw.key, projectId: raw.projectId, jobId: raw.jobId, operation: raw.operation as AiWriteFence['operation'], revision: raw.revision, requestHash: raw.requestHash as string | null, sourceRevision: raw.sourceRevision }
}
export function readAiWriteFences(storage: AiWriteFenceStorage): AiWriteFence[] {
  try {
    const text = storage.getItem(AI_WRITE_FENCE_KEY)
    if (text === null) return []
    if (typeof text !== 'string' || text.length > limit || new TextEncoder().encode(text).byteLength > limit) throw new AiWriteCoordinationError()
    const raw: unknown = JSON.parse(text)
    if (!Array.isArray(raw) || raw.length > maxRecords) throw new AiWriteCoordinationError()
    const entries = raw.map(check)
    if (new Set(entries.map(entry => entry.key)).size !== entries.length) throw new AiWriteCoordinationError()
    return entries
  } catch { throw new AiWriteCoordinationError() }
}
function write(storage: AiWriteFenceStorage, entries: AiWriteFence[]) {
  try {
    if (entries.length > maxRecords) throw new AiWriteCoordinationError()
    const text = JSON.stringify(entries.map(check))
    if (new TextEncoder().encode(text).byteLength > limit) throw new AiWriteCoordinationError()
    storage.setItem(AI_WRITE_FENCE_KEY, text)
    if (storage.getItem(AI_WRITE_FENCE_KEY) !== text) throw new AiWriteCoordinationError()
    readAiWriteFences(storage)
  } catch { throw new AiWriteCoordinationError() }
}
/** Call mutation helpers only inside AI_WRITE_LOCK_NAME. There is deliberately no reset-all helper. */
export function putAiWriteFence(storage: AiWriteFenceStorage, fence: AiWriteFence): void {
  const safe = check(fence), entries = readAiWriteFences(storage)
  if (entries.some(entry => entry.key === safe.key)) throw new AiWriteCoordinationError()
  write(storage, [...entries, safe])
}
export function removeAiWriteFence(storage: AiWriteFenceStorage, key: string): void { write(storage, readAiWriteFences(storage).filter(entry => entry.key !== key)) }
export function hasPendingAiWrites(storage: AiWriteFenceStorage, projectId: string): boolean {
  if (!isAiProjectId(projectId)) throw new AiWriteCoordinationError()
  return readAiWriteFences(storage).some(entry => entry.projectId === projectId)
}
export function getAiWriteFenceStorage(): AiWriteFenceStorage {
  try { if (!globalThis.localStorage) throw new AiWriteCoordinationError(); return globalThis.localStorage } catch { throw new AiWriteCoordinationError() }
}
export async function runAiWriteExclusive<T>(work: () => Promise<T>): Promise<AiWriteLockResult<T>> {
  let locks: LockManager
  try { if (!globalThis.navigator?.locks) throw new AiWriteCoordinationError(); locks = globalThis.navigator.locks } catch { throw new AiWriteCoordinationError() }
  return locks.request(AI_WRITE_LOCK_NAME, { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) return { acquired: false }
    return { acquired: true, value: await work() }
  })
}
export const aiWriteCoordinator: AiWriteCoordinator = Object.freeze({ run: runAiWriteExclusive })
