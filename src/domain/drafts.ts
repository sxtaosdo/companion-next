import type { LocalSpecDraft, ProjectSpec } from './contracts'
import { validateSpec } from './spec'
const PREFIX = 'companion-next:local-spec:v1:'
export const draftKey = (mode: 'demo' | 'live', projectId: string) => `${PREFIX}${mode}:${encodeURIComponent(projectId)}`
export class DraftConflictError extends Error {
  constructor() { super('本地草稿已被其他页面更新或删除。此次编辑未保存，也未覆盖新版本。'); this.name = 'DraftConflictError' }
}
function parseDraft(raw: string | null, mode: 'demo' | 'live', projectId: string): LocalSpecDraft | null {
  try {
    if (!raw || raw.length > 16_384) return null
    const draft: unknown = JSON.parse(raw)
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return null
    const data = draft as Record<string, unknown>
    if (data.schemaVersion !== 1 || data.projectId !== projectId || data.mode !== mode || validateSpec(data.spec).length
      || typeof data.revision !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(data.revision)
      || typeof data.savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.savedAt) || !Number.isFinite(Date.parse(data.savedAt)) || new Date(data.savedAt).toISOString() !== data.savedAt
      || Object.keys(data).some((key) => !['schemaVersion','projectId','mode','savedAt','revision','spec'].includes(key))) return null
    return data as unknown as LocalSpecDraft
  } catch { return null }
}
export function readDraft(storage: Pick<Storage, 'getItem'>, mode: 'demo' | 'live', projectId: string): LocalSpecDraft | null {
  try { return parseDraft(storage.getItem(draftKey(mode, projectId)), mode, projectId) } catch { return null }
}
/** Optimistic revision check; callers serialize writes with Web Locks when supported. */
export function writeDraft(storage: Pick<Storage, 'getItem' | 'setItem'>, mode: 'demo' | 'live', projectId: string, spec: ProjectSpec, expectedRevision: string | null = null): LocalSpecDraft {
  const errors = validateSpec(spec)
  if (errors.length) throw new Error(errors.join('；'))
  const raw = storage.getItem(draftKey(mode, projectId))
  const current = parseDraft(raw, mode, projectId)
  if (raw !== null && current === null) throw new Error('已有本地草稿格式无效，未覆盖其内容。请先备份并处理浏览器中的旧草稿。')
  if ((current?.revision ?? null) !== expectedRevision) throw new DraftConflictError()
  const draft: LocalSpecDraft = { schemaVersion: 1, projectId, mode, savedAt: new Date().toISOString(), revision: crypto.randomUUID(), spec: structuredClone(spec) }
  storage.setItem(draftKey(mode, projectId), JSON.stringify(draft))
  return draft
}
