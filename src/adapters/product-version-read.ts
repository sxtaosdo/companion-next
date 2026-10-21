import {decodeProductVersion,ProductVersionReadError,type ProductVersionReadProvider} from '../domain/product-version-read'
export function createProductVersionReadProvider(fetcher:typeof fetch):ProductVersionReadProvider{return {label:'Companion authenticated product version',async read(signal){
 let response:Response
 const requestSignal=signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)
 try{response=await fetcher('/api/version',{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal:requestSignal})}catch{throw new ProductVersionReadError('network')}
 if(response.status===401||response.status===403)throw new ProductVersionReadError('unauthorized')
 if(response.status===404)throw new ProductVersionReadError('unsupported')
 if(response.status===503)throw new ProductVersionReadError('unavailable')
 if(!response.ok)throw new ProductVersionReadError('network')
 try{const text=await response.text();if(text.length>8192)throw new ProductVersionReadError('invalid');return decodeProductVersion(JSON.parse(text))}catch{throw new ProductVersionReadError('invalid')}
}}}
