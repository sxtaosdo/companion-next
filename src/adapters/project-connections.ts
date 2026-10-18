import { decodeToolPreset } from '../domain/tool-presets-read'
import { CONNECTION_LIMITS, ProjectConnectionError, normalizeConnectionRequest } from '../domain/project-connections'
import type { ConnectionCode, ConnectionOutcome, ConnectionReply, ProjectConnectionsProvider } from '../domain/project-connections'
import { sanitizeCompanionDisplayText } from './companion-browser'
export type ProjectConnectionPath = `/api/projects/${string}/mcp/register` | `/api/projects/${string}/tool-preset`
export type ProjectConnectionFetch = (path: ProjectConnectionPath, init: RequestInit) => Promise<Response>
const localFailures=new WeakSet<ProjectConnectionError>()
const fail=(code:ConnectionCode,outcome:ConnectionOutcome='unknown')=>{const e=new ProjectConnectionError(code,outcome);localFailures.add(e);return e}
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw fail('invalid-shape');return value as Record<string,unknown>}
function sanitize(value:unknown,depth=0):unknown {
 if(depth>16)throw fail('invalid-shape')
 if(typeof value==='string')return sanitizeCompanionDisplayText(value).replace(/(\bcookie[\\'"\t ]*[:=][\t ]*)[^\r\n]*/gi,'$1[redacted]')
 if(value===null||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return value
 if(Array.isArray(value))return value.map(v=>sanitize(v,depth+1))
 const result:Record<string,unknown>=Object.create(null)
 for(const [key,v] of Object.entries(object(value))){result[key]=/(?:token|password|passwd|authorization|secret|api[-_]?key|credential|cookie)/i.test(key)?'[redacted]':sanitize(v,depth+1)}
 return result
}
type Track = <T>(pending: Promise<T>) => Promise<T>
function discardBody(response: Response, track: Track): void {
  try { if (response.body) void track(response.body.cancel()).catch(() => undefined) } catch { /* No raw diagnostics. */ }
}
function abortable<T>(pending: Promise<T>, signal: AbortSignal, abortError: () => ProjectConnectionError): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()) }
    signal.addEventListener('abort', abort, { once: true })
    void pending.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
    if (signal.aborted) abort()
  })
}
async function boundedJson(response: Response, signal: AbortSignal, abortError: () => ProjectConnectionError, track: Track): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length && /^\d+$/.test(length) && Number(length) > CONNECTION_LIMITS.maxResponseBytes) { discardBody(response, track); throw fail('response-too-large') }
  if (!response.body) throw fail('invalid-shape')
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0, chunks = 0, body = '', complete = false
  try {
    while (true) {
      const next = await abortable(track(reader.read()), signal, abortError)
      if (next.done) break
      if (!ArrayBuffer.isView(next.value) || Object.prototype.toString.call(next.value) !== '[object Uint8Array]') throw fail('invalid-shape')
      bytes += next.value.byteLength
      if (bytes > CONNECTION_LIMITS.maxResponseBytes || ++chunks > CONNECTION_LIMITS.maxResponseChunks) throw fail('response-too-large')
      body += decoder.decode(next.value, { stream: true })
    }
    body += decoder.decode(); complete = true
    try { return JSON.parse(body) as unknown } catch { throw fail('invalid-shape') }
  } catch (error) {
    if (signal.aborted) throw abortError()
    throw fail(error instanceof ProjectConnectionError && localFailures.has(error) && error.code === 'response-too-large' ? 'response-too-large' : 'invalid-shape')
  } finally {
    if (!complete) { try { void track(reader.cancel()).catch(() => undefined) } catch { /* Outstanding reads retain the lease. */ } }
    try { reader.releaseLock() } catch { /* Abort-unaware reads must actually settle. */ }
  }
}
export function createProjectConnectionsProvider(options:{fetch:ProjectConnectionFetch;timeoutMs?:number}):ProjectConnectionsProvider {
 if(typeof options?.fetch!=='function')throw new TypeError('需要显式同源fetch')
 const transport=options.fetch,timeoutMs=options.timeoutMs??CONNECTION_LIMITS.timeoutMs
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>CONNECTION_LIMITS.timeoutMs)throw new RangeError('无效超时')
 let inFlight:object|undefined,idle=Promise.resolve()
 return Object.freeze({label:'Companion 原客户端注册 / 向导工具范围',waitForIdle:()=>idle,
  async run(input,signal):Promise<ConnectionReply>{
   if(signal?.aborted)throw fail('aborted','not-dispatched')
   if(inFlight)throw fail('busy','not-dispatched')
   let request;try{request=normalizeConnectionRequest(input)}catch{throw fail('invalid-input','not-dispatched')}
      const identity = {}
      inFlight = identity
      let resolveIdle!: () => void
      idle = new Promise<void>(resolve => { resolveIdle = resolve })
      const controller = new AbortController()
      let invoked = false, processingDone = false, activeOperations = 0, timedOut = false, released = false
      const release = () => {
        if (!released && processingDone && activeOperations === 0) {
          released = true
          if (inFlight === identity) inFlight = undefined
          resolveIdle()
        }
      }
      const track: Track = pending => {
        activeOperations++
        void pending.then(() => { activeOperations--; release() }, () => { activeOperations--; release() })
        return pending
      }
      const cancel = () => controller.abort()
      signal?.addEventListener('abort', cancel, { once: true })
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      const abortError = () => fail(signal?.aborted ? 'aborted' : timedOut ? 'timeout' : 'aborted', invoked ? 'unknown' : 'not-dispatched')
      try {
        if (signal?.aborted) controller.abort()
        const pending = track(Promise.resolve().then(() => {
          if (controller.signal.aborted) throw abortError()
          invoked = true
          try {
            const path:ProjectConnectionPath=request.kind==='client'?`/api/projects/${request.projectId}/mcp/register`:`/api/projects/${request.projectId}/tool-preset`
            const body=request.kind==='client'?{target:request.target}:{presetId:request.preset.id,setupOperationId:request.setupOperationId}
            return Promise.resolve(transport(path, {
              method:'POST',mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',
              headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify(body),
              signal: controller.signal,
            })).catch(() => { throw fail('network-error') })
          } catch { throw fail('network-error') }
        }).then(response => { if (controller.signal.aborted) discardBody(response, track); return response }))
        const response = await abortable(pending, controller.signal, abortError)
        if (controller.signal.aborted) { discardBody(response, track); throw abortError() }
        if (response.redirected || response.type === 'opaque' || response.type === 'opaqueredirect') { discardBody(response, track); throw fail('invalid-shape') }
        if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('content-type') ?? '')) { discardBody(response, track); throw fail('invalid-shape') }
        const raw = await boundedJson(response, controller.signal, abortError, track)
        if (controller.signal.aborted) throw abortError()
        if(response.status===403)throw fail('forbidden','rejected')
        if(response.status!==200)throw fail('backend-failure')
        const reply=object(raw)
        if(request.kind==='client'){
          if(reply.target!==request.target||reply.projectId!==request.projectId||typeof reply.changed!=='boolean'||typeof reply.name!=='string'||!/^[a-zA-Z0-9_-]{1,256}$/.test(reply.name)||typeof reply.command!=='string'||!reply.command||reply.command.length>4096||JSON.stringify(reply.args)!==JSON.stringify(['mcp','--project',request.projectId])||(reply.configPath!==undefined&&(typeof reply.configPath!=='string'||reply.configPath.length>4096)))throw fail('invalid-shape')
          const receipt={target:reply.target,name:reply.name,changed:reply.changed,command:reply.command,args:reply.args,...(reply.configPath===undefined?{}:{configPath:reply.configPath})}
          return {key:JSON.stringify(request),text:JSON.stringify(sanitize(receipt),null,2)}
        }
        const preset=decodeToolPreset(reply)
        if(JSON.stringify(preset)!==JSON.stringify(request.preset))throw fail('invalid-shape')
        return {key:JSON.stringify(request),text:JSON.stringify(sanitize(preset),null,2)}

      } catch (error) {
        if (controller.signal.aborted) throw abortError()
        if (error instanceof ProjectConnectionError && localFailures.has(error)) throw error
        throw fail('network-error', invoked ? 'unknown' : 'not-dispatched')
      } finally {
        clearTimeout(timer); signal?.removeEventListener('abort', cancel); processingDone = true; release()
        // Logical cancellation is not proof of server cancellation and cannot release unfinished client operations.
      }
  },
 } satisfies ProjectConnectionsProvider)
}
