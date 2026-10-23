import { parseProjectArtSpec, validateProjectArtBindings } from '../domain/project-art-spec'
import { artPath } from '../domain/project-art-pending'
import { ProjectArtSpecWriteError, type ProjectArtOperation, type ProjectArtSpecContext, type ProjectArtSpecProvider, type ProjectArtSpecReceipt } from '../project-art-spec-integration'
/** Exact same-origin authenticated routes; no credential, endpoint, or automatic retry UI. */
export function createProjectArtSpecProvider(fetcher: typeof fetch, origin: string): ProjectArtSpecProvider {
  const endpoint = new URL(origin)
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw Error('Invalid art host')
  const pending = new Set<Promise<unknown>>()
  function tracked<T>(work: Promise<T>):Promise<T> { pending.add(work); void work.finally(()=>pending.delete(work)).catch(()=>undefined); return work }
  function receipt(raw: unknown, context: ProjectArtSpecContext): ProjectArtSpecReceipt {
    const value = raw as ProjectArtSpecReceipt
    if (!value || value.projectId !== context.projectId || artPath(value.projectPath) !== artPath(context.projectPath) || !Array.isArray(value.authorities) || value.authorities.length > 8) throw Error('Invalid art receipt')
    if (value.config === null) { if (value.hash !== null) throw Error('Invalid missing receipt') }
    else { if (!value.hash || !/^[a-f0-9]{64}$/.test(value.hash)) throw Error('Invalid art hash'); const parsed = parseProjectArtSpec(value.config, context.projectId); if (parsed.kind === 'project' && !(parsed.spec.inheritance.mode === 'canon' && parsed.spec.inheritance.usage === undefined)) validateProjectArtBindings(parsed.spec, value.authorities) }
    if(value.inheritanceResolution !== undefined) {
      const info=value.inheritanceResolution
      if(!info||typeof info!=='object'||!Array.isArray(info.sources)||info.sources.length>8||Object.keys(info).some(key=>!['state','code','sources'].includes(key))||!info.sources.every(pin=>pin&&typeof pin.path==='string'&&/^P0001\/[A-Za-z0-9_./-]+\.md$/.test(pin.path)&&!pin.path.split('/').includes('..')&&typeof pin.revision==='string'&&/^[a-f0-9]{40}$/.test(pin.revision)))throw Error('Invalid inheritance resolution')
      if(info.state==='unlinked'){if(info.code!=='NO_PROJECT_ASSOCIATION'||info.sources.length||value.authorities.length)throw Error('Invalid unlinked resolution')}
      else if(info.state==='available'){if(info.code!=='REVIEWED_SOURCES_AVAILABLE'||!info.sources.length||!info.sources.every(pin=>value.authorities.some(authority=>authority.source.path===pin.path&&authority.source.revision===pin.revision&&authority.status==='Accepted'&&authority.projectIds.includes(context.projectId))))throw Error('Invalid available resolution')}
      else if(info.state==='not-applicable'){if(info.code!=='EXPLICIT_NOT_APPLICABLE'||!info.sources.length||value.authorities.length)throw Error('Invalid explicit applicability')}
      else throw Error('Invalid inheritance state')
    }
    if(value.generationCapabilities !== undefined && (value.generationCapabilities.imageReferenceInput !== false || !Array.isArray(value.generationCapabilities.categories) || value.generationCapabilities.categories.length !== 1 || value.generationCapabilities.categories[0] !== 'icon')) throw Error('Invalid generation capabilities')
    return value
  }
  async function request(route: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
    const encoded = body === undefined ? undefined : JSON.stringify(body)
    if (encoded && new TextEncoder().encode(encoded).byteLength > 256 * 1024) throw new ProjectArtSpecWriteError('not-sent')
    const response = await fetcher(route, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', redirect: 'error', headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: encoded, signal })
    if (!response.ok) { await response.body?.cancel(); throw new ProjectArtSpecWriteError('unknown') }
    if (!response.body) throw Error('Missing art response')
    const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0, count = 0
    try { for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > 512 * 1024 || ++count > 4096) throw Error('Art response budget'); chunks.push(item.value) } }
    catch { await reader.cancel().catch(() => undefined); throw Error('Art response unconfirmed') }
    finally { reader.releaseLock() }
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  }
  function route(context: ProjectArtSpecContext) { if (!/^[a-f0-9]{16}$/.test(context.projectId)) throw Error('Invalid project'); return '/api/art-spec/' + context.projectId }
  return { label: '工程美术规范', endpoint: endpoint.origin, waitForIdle: async()=>{while(pending.size) await Promise.allSettled([...pending])},
    read: (context, signal) => tracked((async()=>receipt(await request(route(context), signal), context))()),
    save: (context, input, signal) => tracked((async()=>receipt(await request(route(context), signal, input), context))()),
    status: async (context, operationId, signal) => {
      if (!/^art-save-[a-f0-9]{32}$/.test(operationId)) throw Error('Invalid operation')
      const value = await request(route(context) + '/operations/' + operationId, signal) as ProjectArtOperation
      if (!value || value.schemaVersion !== 'project-art-write-v1' || value.projectId !== context.projectId || artPath(value.projectPath) !== artPath(context.projectPath) || value.operationId !== operationId || !/^[a-f0-9]{64}$/.test(value.bindingHash) || !['pending', 'completed', 'rejected'].includes(value.state)) throw Error('Invalid art status')
      if (value.state === 'completed') value.receipt = receipt(value.receipt, context)
      return value
    },
  }
}
