/** Synchronous Storage acknowledgement checks, not a backup channel or cross-context transaction. */
export interface RegistrationStoragePort {getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
interface PendingIdentity {input:{operationId:string;path:string;purpose:string;expectedRegistryRevision:string;approved:boolean};phase:string;result?:{state:string;operationId:string;project?:{id:string;path:string}|null}}
export class RegistrationStorageUnconfirmed extends Error {constructor(readonly code:string,options?:ErrorOptions){super(code,options);this.name='RegistrationStorageUnconfirmed'}}
function requireSame(storage:RegistrationStoragePort,key:string,expected:string|null,code:string){if(storage.getItem(key)!==expected)throw new RegistrationStorageUnconfirmed(code)}
function receiptBytes(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(receiptBytes).join(',')+']'
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+receiptBytes((value as Record<string,unknown>)[key])).join(',')+'}'
 const bytes=JSON.stringify(value);if(bytes===undefined)throw new RegistrationStorageUnconfirmed('REGISTRATION_RECEIPT_CHANGED');return bytes
}
/** Keep the original request and stronger received evidence if a later read weakens. */
export function retainRegistrationPending<T extends PendingIdentity>(previous:T|null,incoming:T):T{
 if(incoming.result&&incoming.result.operationId!==incoming.input.operationId)throw new RegistrationStorageUnconfirmed('REGISTRATION_PENDING_RESULT_MISMATCH');
 if(!previous)return incoming;
 const fields=['operationId','path','purpose','expectedRegistryRevision','approved'] as const;
 if(fields.some(key=>previous.input[key]!==incoming.input[key]))throw new RegistrationStorageUnconfirmed('REGISTRATION_PENDING_OPERATION_CHANGED');
 const known=previous.result,next=incoming.result;
 if(known?.state==='registered'&&next?.state==='registered'&&receiptBytes(known)!==receiptBytes(next))throw new RegistrationStorageUnconfirmed('REGISTRATION_RECEIPT_CHANGED');
 if(known?.state==='registered'&&(!next||next.state!=='registered'||next.project?.id!==known.project?.id||next.project?.path!==known.project?.path))return {...incoming,phase:incoming.phase==='reconciling'?'reconciling':'unknown',result:known};
 return incoming;
}
/** The old bytes are compared before mutation. Failed/corrupt writes are never retried here. */
export function persistRegistrationPending(storage:RegistrationStoragePort,key:string,expected:string|null,bytes:string):void{
 requireSame(storage,key,expected,'REGISTRATION_PENDING_CHANGED');
 storage.setItem(key,bytes);
 requireSame(storage,key,bytes,'REGISTRATION_PENDING_WRITE_UNCONFIRMED');
}
/** Release is valid only after audit acknowledgement and exact pending removal acknowledgement. */
export function archiveRegistrationPending(storage:RegistrationStoragePort,options:{pendingKey:string;expectedPending:string;auditKey:string;auditBytes:string}):void{
 const {pendingKey,expectedPending,auditKey,auditBytes}=options;
 if(pendingKey===auditKey)throw new RegistrationStorageUnconfirmed('REGISTRATION_STORAGE_KEYS_CONFLICT');
 requireSame(storage,pendingKey,expectedPending,'REGISTRATION_PENDING_CHANGED');
 storage.setItem(auditKey,auditBytes);
 requireSame(storage,auditKey,auditBytes,'REGISTRATION_AUDIT_WRITE_UNCONFIRMED');
 requireSame(storage,pendingKey,expectedPending,'REGISTRATION_PENDING_CHANGED');
 storage.removeItem(pendingKey);
 requireSame(storage,pendingKey,null,'REGISTRATION_PENDING_REMOVE_UNCONFIRMED');
}
