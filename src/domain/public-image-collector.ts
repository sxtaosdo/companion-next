/** Owner-approved loopback tool only; route/query/user input never selects its origin. */
export const PUBLIC_IMAGE_COLLECTOR_URL='http://127.0.0.1:32182/'
export const PUBLIC_IMAGE_COLLECTOR_ORIGIN='http://127.0.0.1:32182'
export const PUBLIC_IMAGE_COLLECTOR_READY_TIMEOUT_MS=12_000
export function isPublicImageCollectorReady(event:Pick<MessageEvent,'origin'|'source'|'data'>,frameWindow:Window|null):boolean {
 if(!frameWindow||event.origin!==PUBLIC_IMAGE_COLLECTOR_ORIGIN||event.source!==frameWindow)return false
 const data:unknown=event.data
 if(!data||typeof data!=='object'||Array.isArray(data))return false
 const keys=Object.keys(data), record=data as Record<string,unknown>
 return keys.length===2&&keys.includes('type')&&keys.includes('version')&&record.type==='public-image-review:ready'&&record.version===1
}
