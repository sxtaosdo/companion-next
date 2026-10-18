export interface AssetInventorySummary { root:string; total:number; imported:number; unimported:number; unknownType:number; byType:Array<{type:string;count:number}>; byTopLevelFolder:Array<{folder:string;count:number}>; generatedAt:string }
export async function readAssetInventory(projectId:string,signal?:AbortSignal):Promise<AssetInventorySummary>{
 if(!/^[a-f0-9]{16}$/.test(projectId))throw Error('INVENTORY_INPUT_INVALID')
 const response=await fetch(`/api/projects/${projectId}/asset-inventory`,{method:'GET',mode:'same-origin',credentials:'same-origin',cache:'no-store',redirect:'error',signal})
 if(!response.ok){await response.body?.cancel();throw Error(response.status===503?'INVENTORY_BRIDGE_UNAVAILABLE':'INVENTORY_READ_FAILED')}
 if(response.redirected||!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')??'')||!response.body){await response.body?.cancel();throw Error('INVENTORY_RESPONSE_INVALID')}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0,count=0
 try{for(;;){const row=await reader.read();if(row.done)break;size+=row.value.byteLength;if(size>2*1024*1024||++count>4096){await reader.cancel();throw Error('INVENTORY_RESPONSE_LIMIT')}chunks.push(row.value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const row of chunks){bytes.set(row,offset);offset+=row.byteLength}
 const raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));const s=raw?.summary
 const n=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=100000
 const groups=(v:unknown,key:string)=>Array.isArray(v)&&v.length<=100000&&v.every(row=>row&&typeof row[key]==='string'&&row[key].length<=2048&&n(row.count))
 if(raw?.schemaVersion!=='companion-asset-inventory-v1'||raw.projectId!==projectId||!s||typeof s.root!=='string'||s.root!=='db://assets'||!['total','imported','unimported','unknownType'].every(k=>n(s[k]))||s.imported+s.unimported!==s.total||s.unknownType>s.total||!groups(s.byType,'type')||!groups(s.byTopLevelFolder,'folder')||s.byType.reduce((a:number,b:{count:number})=>a+b.count,0)!==s.total||s.byTopLevelFolder.reduce((a:number,b:{count:number})=>a+b.count,0)!==s.total||typeof s.generatedAt!=='string'||!Number.isFinite(Date.parse(s.generatedAt)))throw Error('INVENTORY_RESPONSE_INVALID')
 return s
}
