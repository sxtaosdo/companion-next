export interface ScopedPending {operationId:string;workflowId?:string;kind:string;serverRequests?:{operationId:string;kind:'delivery-mode'|'source-grant';state:'pending'|'unknown'}[];modeChange?:{deliveryMode:'sample'|'source-patch';expectedRevision:number};sourceGrant?:{policyId:string;policyDigest:string;expectedRevision:number}}
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>
export const SCOPED_PENDING_KEY='companion.workflow-operation.pending.v2'
const LEGACY='companion.workflow-operation.pending.v1'
function valid(v:unknown):v is ScopedPending {const r=v as ScopedPending;return !!r&&typeof r.operationId==='string'&&(r.kind==='服务器待核请求'?/^[a-z0-9][a-z0-9-]{0,63}$/.test(r.operationId):/^[a-f0-9-]{36}$/i.test(r.operationId))&&typeof r.kind==='string'&&r.kind.length>0&&r.kind.length<=100&&(r.workflowId===undefined||typeof r.workflowId==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(r.workflowId))&&(r.kind!=='服务器待核请求'||Array.isArray(r.serverRequests)&&r.serverRequests.length>0&&r.serverRequests.length<=256&&r.serverRequests.every(x=>typeof x.operationId==='string'&&/^[a-z0-9][a-z0-9-]{0,63}$/.test(x.operationId)&&['delivery-mode','source-grant'].includes(x.kind)&&['pending','unknown'].includes(x.state))&&r.serverRequests[0].operationId===r.operationId)&&(r.kind.indexOf('设置交付方式:')!==0||!!r.modeChange&&['sample','source-patch'].includes(r.modeChange.deliveryMode)&&r.kind==='设置交付方式:'+r.modeChange.deliveryMode&&Number.isSafeInteger(r.modeChange.expectedRevision)&&r.modeChange.expectedRevision>=0)&&(r.kind!=='授权源码范围'||!!r.sourceGrant&&typeof r.sourceGrant.policyId==='string'&&/^[a-z0-9-]{1,64}$/.test(r.sourceGrant.policyId)&&typeof r.sourceGrant.policyDigest==='string'&&/^[a-f0-9]{64}$/.test(r.sourceGrant.policyDigest)&&Number.isSafeInteger(r.sourceGrant.expectedRevision)&&r.sourceGrant.expectedRevision>=0)}
export function readScopedPending(store:Store):Record<string,ScopedPending> {
 const raw=store.getItem(SCOPED_PENDING_KEY),rows:Record<string,ScopedPending>=raw?JSON.parse(raw):{};
 if(!rows||Array.isArray(rows)||Object.keys(rows).length>256)throw Error('Pending store invalid');
 for(const [key,row] of Object.entries(rows))if(!valid(row)||key!==(row.workflowId??'__global'))throw Error('Pending binding invalid');
 const legacyRaw=store.getItem(LEGACY);if(legacyRaw){const legacy:unknown=JSON.parse(legacyRaw);if(!valid(legacy))throw Error('Legacy pending invalid');const key=legacy.workflowId??'__global';if(rows[key]&&rows[key].operationId!==legacy.operationId)throw Error('Pending conflict');rows[key]=legacy;}
 return rows;
}
export function saveScopedPending(store:Store,request:ScopedPending) {
 if(!valid(request))throw Error('Pending request invalid');const rows=readScopedPending(store),key=request.workflowId??'__global';
 if(rows[key]&&rows[key].operationId!==request.operationId)throw Error('Original request unresolved');
 rows[key]=request;const encoded=JSON.stringify(rows);store.setItem(SCOPED_PENDING_KEY,encoded);if(store.getItem(SCOPED_PENDING_KEY)!==encoded)throw Error('Pending receipt not persisted');return rows;
}
export function clearScopedPending(store:Store,request:ScopedPending) {
 const rows=readScopedPending(store),key=request.workflowId??'__global';if(rows[key]?.operationId!==request.operationId)throw Error('Pending changed');
 delete rows[key];store.setItem(SCOPED_PENDING_KEY,JSON.stringify(rows));
 const legacyRaw=store.getItem(LEGACY);if(legacyRaw){const legacy=JSON.parse(legacyRaw);if(legacy.operationId===request.operationId)store.removeItem(LEGACY);}
 return rows;
}

/** The server hashes canonical JSON of the complete ingress request, not a display label. */
export async function ingressRequestDigest(workflowId:string,kind:'delivery-mode'|'source-grant',input:Record<string,string|number>){
 const canonical=(v:unknown):string=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}':JSON.stringify(v)
 const data=new TextEncoder().encode(canonical({workflowId,kind,input}));return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('')
}
