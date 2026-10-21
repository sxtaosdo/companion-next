export interface ProductVersionMetadata {
 schemaVersion:'companion-product-version-v1'
 product:{name:'Creator AI Companion';version:string}
 build:{id:string;sourceRevision:string}
 identity:{entrySha256:string}
}
export type ProductVersionFailure='unavailable'|'unauthorized'|'invalid'|'network'
export class ProductVersionReadError extends Error {constructor(readonly code:ProductVersionFailure){super(code)}}
export interface ProductVersionReadProvider {label:string;read(signal?:AbortSignal):Promise<ProductVersionMetadata>}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ProductVersionReadError('invalid');return value as Record<string,unknown>}
export function decodeProductVersion(value:unknown):ProductVersionMetadata {
 const root=record(value),product=record(root.product),build=record(root.build),identity=record(root.identity)
 if(root.schemaVersion!=='companion-product-version-v1'||product.name!=='Creator AI Companion'||typeof product.version!=='string'||!/^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[A-Za-z0-9.-]{1,40})?$/.test(product.version)||typeof build.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(build.id)||typeof build.sourceRevision!=='string'||! /^[a-f0-9]{40}$/.test(build.sourceRevision)||typeof identity.entrySha256!=='string'||! /^[a-f0-9]{64}$/.test(identity.entrySha256))throw new ProductVersionReadError('invalid')
 return {schemaVersion:'companion-product-version-v1',product:{name:'Creator AI Companion',version:product.version},build:{id:build.id,sourceRevision:build.sourceRevision},identity:{entrySha256:identity.entrySha256}}
}
