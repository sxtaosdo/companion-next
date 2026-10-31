export interface BundleMetadataRow {url:string;uuid:string;name:string;hash:string;priority:number;isBundle:true;prefabs:Array<{url:string;uuid:string;users:string[]}>}
export interface BundleMetadataSnapshot {schemaVersion:'p3000-bundle-metadata-v1';observedAt:string;projectPath:string;rows:BundleMetadataRow[]}
export interface BundleMetadataProvider {read(projectId:string):Promise<BundleMetadataSnapshot>;update(projectId:string,input:{url:string;uuid:string;expectedHash:string;priority:number;approved:true}):Promise<unknown>}
async function request(projectId:string,body?:unknown):Promise<unknown>{
 if(projectId!=='214a2184be887306')throw Error('BUNDLE_PROJECT_MISMATCH')
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000)
 try{
  const response=await fetch(`/api/projects/${projectId}/bundle-metadata`,{method:body===undefined?'GET':'POST',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:controller.signal})
  if(!response.ok||response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??'')){await response.body?.cancel();throw Error(`BUNDLE_REQUEST_FAILED_${response.status}`)}
  const text=await response.text();if(text.length>2*1024*1024)throw Error('BUNDLE_RESPONSE_LIMIT')
  return JSON.parse(text)
 }finally{clearTimeout(timer)}
}
export const bundleMetadataProvider:BundleMetadataProvider={
 async read(id){
  const value=await request(id) as BundleMetadataSnapshot
  if(value?.schemaVersion!=='p3000-bundle-metadata-v1'||!Array.isArray(value.rows)||value.rows.length!==5||typeof value.projectPath!=='string'||!Number.isFinite(Date.parse(value.observedAt)))throw Error('BUNDLE_RESPONSE_INVALID')
  const names=['game','inventory','dialogue-panel','quest-notice','outpost-yard']
  if(value.rows.some((row,index)=>row.name!==names[index]||typeof row.uuid!=='string'||typeof row.url!=='string'||!/^db:\/\/assets\/game(?:\/[a-z-]+)?$/.test(row.url)||!/^([a-f0-9]{64})$/.test(row.hash)||row.isBundle!==true||!Number.isInteger(row.priority)||!Array.isArray(row.prefabs)||row.prefabs.some(asset=>typeof asset.url!=='string'||typeof asset.uuid!=='string'||!Array.isArray(asset.users)||asset.users.some(user=>typeof user!=='string'))))throw Error('BUNDLE_RESPONSE_INVALID')
  return value
 },
 update:(id,input)=>request(id,input),
}
