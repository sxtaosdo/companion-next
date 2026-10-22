import { isAiProjectId } from './ai-resource-read'
import type { CropRequest, CropRoi } from './icon-reference-editor'
export type { CropRequest, CropRoi }
export class ReferenceCropNotSent extends Error { constructor(){super('裁剪请求未发送；请等上一请求结束后再明确保存。');this.name='ReferenceCropNotSent'} }
export interface ReferenceCrop { schemaVersion:'companion-reference-crop-v1';projectId:string;cropId:string;sourceSha256:string;width:number;height:number;roi:CropRoi;coordinateSpace:'top-left-display-pixels-after-exif-transpose';modelConditioning:false;original:{relativePath:string;sha256:string};context:{relativePath:string;sha256:string;width:number;height:number};subject:{relativePath:string;sha256:string;width:number;height:number};receiptRelativePath:string;receiptSha256:string }
export type CropReply={state:'available';crop:ReferenceCrop}|{state:'missing'|'unavailable';cropId:string}
export interface ReferenceCropProvider { readonly label:string;save(projectId:string,input:CropRequest,signal?:AbortSignal):Promise<unknown>;query(projectId:string,cropId:string,signal?:AbortSignal):Promise<unknown> }
export const isCropHash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)
export const cropDigest=async(bytes:BufferSource)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('')
export function validCropDimensions(v:{width:number;height:number;roi:CropRoi}) {const r=v?.roi;return !!r&&[v.width,v.height,r.x,r.y,r.width,r.height].every(Number.isSafeInteger)&&v.width>0&&v.height>0&&v.width<=4096&&v.height<=4096&&v.width*v.height<=16000000&&r.x>=0&&r.y>=0&&r.width>0&&r.height>0&&r.x+r.width<=v.width&&r.y+r.height<=v.height}
export async function cropIdentity(v:{sourceSha256:string;width:number;height:number;roi:CropRoi}):Promise<string>{if(!isCropHash(v.sourceSha256)||!validCropDimensions(v))throw Error('裁剪输入无效。');return cropDigest(new TextEncoder().encode(JSON.stringify({sourceSha256:v.sourceSha256,width:v.width,height:v.height,roi:{x:v.roi.x,y:v.roi.y,width:v.roi.width,height:v.roi.height}})))}
export async function validateCropInput(projectId:string,v:CropRequest):Promise<CropRequest>{
 if(!isAiProjectId(projectId)||!v||v.approved!==true||typeof v.base64!=='string'||v.base64.length>5592408||!/^[A-Za-z0-9+/]+={0,2}$/.test(v.base64))throw Error('裁剪输入无效，未发送。')
 const bytes=Uint8Array.from(atob(v.base64),x=>x.charCodeAt(0));if(!bytes.length||bytes.length>4194304)throw Error('裁剪输入无效，未发送。')
 if(await cropDigest(bytes)!==v.sourceSha256)throw Error('原图 SHA 不符，未发送。');await cropIdentity(v)
 return {base64:v.base64,sourceSha256:v.sourceSha256,width:v.width,height:v.height,roi:{x:v.roi.x,y:v.roi.y,width:v.roi.width,height:v.roi.height},approved:true}
}
/** Reuses original ai-icons-page acceptCrop identity/path/ROI checks, including modelConditioning:false. */
export async function decodeCropReply(raw:unknown,projectId:string,id:string,expected?:CropRequest):Promise<CropReply>{
 if(!isAiProjectId(projectId)||!isCropHash(id)||!raw||typeof raw!=='object')throw Error('裁剪回执未确认，请查询原请求。')
 const v=raw as CropReply
 if((v.state==='missing'||v.state==='unavailable')&&v.cropId===id)return {state:v.state,cropId:id}
 if(v.state!=='available')throw Error('裁剪回执未确认，请查询原请求。')
 const c=v.crop
 if(!c||c.schemaVersion!=='companion-reference-crop-v1'||c.projectId!==projectId||c.cropId!==id||!isCropHash(c.receiptSha256)||c.coordinateSpace!=='top-left-display-pixels-after-exif-transpose'||c.modelConditioning!==false||!validCropDimensions(c)||await cropIdentity(c)!==id||!c.original||c.original.sha256!==c.sourceSha256||!new RegExp('^art/reference/companion/original/'+c.sourceSha256+'\\.(png|jpg|webp)$').test(c.original.relativePath)||!c.context||!isCropHash(c.context.sha256)||c.context.relativePath!=='art/reference/companion/'+c.context.sha256+'.png'||c.context.width!==c.width||c.context.height!==c.height||!c.subject||!isCropHash(c.subject.sha256)||c.subject.relativePath!=='art/reference/companion/crops/'+id+'.png'||c.subject.width!==c.roi.width||c.subject.height!==c.roi.height||c.receiptRelativePath!=='art/reference/companion/crops/'+id+'.json'||expected&&(c.sourceSha256!==expected.sourceSha256||c.width!==expected.width||c.height!==expected.height||JSON.stringify(c.roi)!==JSON.stringify(expected.roi)))throw Error('裁剪回执未确认，请查询原请求。')
 return {state:'available',crop:structuredClone(c)}
}
