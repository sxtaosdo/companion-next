import {afterEach,describe,expect,it,vi} from 'vitest'
import {createPinia,setActivePinia} from 'pinia'
import {createProductVersionReadProvider} from '../src/adapters/product-version-read'
import {decodeProductVersion,ProductVersionReadError,type ProductVersionMetadata} from '../src/domain/product-version-read'
import {productVersionReadProvider} from '../src/product-version-integration'
import {useProductVersionStore} from '../src/stores/product-version'
const metadata:ProductVersionMetadata={schemaVersion:'companion-product-version-v1',product:{name:'Creator AI Companion',version:'0.3.142'},build:{id:'repair-abcdef12',sourceRevision:'a'.repeat(40)},identity:{entrySha256:'b'.repeat(64)}}
afterEach(()=>{productVersionReadProvider.value=null;vi.restoreAllMocks()})
describe('trusted runtime product metadata',()=>{
 it('reads only the authenticated same-origin endpoint and projects safe identity fields',async()=>{
  const request=vi.fn(async()=>new Response(JSON.stringify({...metadata,token:'must-not-survive'})))
  const value=await createProductVersionReadProvider(request).read()
  expect(request).toHaveBeenCalledWith('/api/version',expect.objectContaining({method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store'}))
  expect(value).toEqual(metadata);expect(JSON.stringify(value)).not.toContain('must-not-survive')
 })
 it.each([401,403,404,503])('keeps HTTP %s separate from a reported product version',async status=>{
  await expect(createProductVersionReadProvider(vi.fn(async()=>new Response('{}',{status}))).read()).rejects.toMatchObject({code:[401,403].includes(status)?'unauthorized':'unavailable'})
 })
 it('rejects protocol, checkpoint, arbitrary backend text and incomplete source proof',()=>{
  expect(()=>decodeProductVersion({...metadata,product:{...metadata.product,version:'1.3.173.209'}})).toThrow(ProductVersionReadError)
  expect(()=>decodeProductVersion({...metadata,product:{...metadata.product,name:'Bridge Protocol'}})).toThrow(ProductVersionReadError)
  expect(()=>decodeProductVersion({...metadata,build:{...metadata.build,sourceRevision:'unknown'}})).toThrow(ProductVersionReadError)
  expect(()=>decodeProductVersion({...metadata,build:{...metadata.build,id:'https://secret.example'}})).toThrow(ProductVersionReadError)
 })
 it('shows actual host package version and clears it after a failed refresh',async()=>{
  setActivePinia(createPinia());const store=useProductVersionStore();const read=vi.fn(async()=>metadata);productVersionReadProvider.value={label:'test host',read};await store.read()
  expect(store.label).toBe('宿主包 v0.3.142');read.mockRejectedValueOnce(new ProductVersionReadError('unavailable'));await store.read()
  expect(store.metadata).toBeNull();expect(store.label).toBe('当前接口未提供')
 })
 it('rejects a late response after source replacement without displaying the previous host',async()=>{
  setActivePinia(createPinia());const store=useProductVersionStore();let resolve!:(value:ProductVersionMetadata)=>void
  productVersionReadProvider.value={label:'old host',read:()=>new Promise(r=>resolve=r)};const pending=store.read()
  productVersionReadProvider.value={label:'new host',read:async()=>({...metadata,product:{...metadata.product,version:'0.3.150'}})}
  resolve(metadata);await pending;expect(store.metadata).toBeNull();await store.read();expect(store.label).toBe('宿主包 v0.3.150')
 })
})
