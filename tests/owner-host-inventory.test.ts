import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { createCompanionOwnerReviewProvider } from '../src/adapters/companion-owner-review'
import { useImageReviewStore } from '../src/stores/image-review'
import { readAssetInventory } from '../src/adapters/asset-inventory'
import AssetInventorySummary from '../src/components/AssetInventorySummary.vue'
const task='a'.repeat(32),image='b'.repeat(32),project='c'.repeat(16)
const caps={schema_version:1,guarded_export:true,guarded_selection:true,guarded_review_actions:false,candidate_import:false}
const raw=()=>({busy:false,task:{id:task,status:'done',mode:'browser_import',selected:[],items:[{id:image,status:'ready',title:'fixture',width:1,height:1,content_type:'image/png'}]}})
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}})
beforeEach(()=>setActivePinia(createPinia()))
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
describe('Companion Owner narrow adapter',()=>{
 it('registers passively and uses cookie endpoints with no token bootstrap or candidate import',async()=>{
  const fetch=vi.fn(async(path:string)=>response(path.endsWith('capabilities')?caps:raw())),p=createCompanionOwnerReviewProvider(fetch)
  expect(fetch).not.toHaveBeenCalled();await expect(p.loadPreview(image,'full')).rejects.toThrow();await p.loadState()
  expect(await p.loadPreview(image,'thumb')).toEqual({kind:'same-origin-image',path:`/owner-review/image/${image}/thumb`})
  expect(p.workflowGuard).toBe('unverified');expect(p.selectionGuard).toBe('verified');expect(p.candidateImportEnabled).toBe(false)
  await p.persistSelection!(task,[image]);await expect(p.importCandidates({schema_version:1,images:[]})).rejects.toThrow()
  expect(fetch.mock.calls.map(c=>c[0])).toEqual(['/api/owner-review/capabilities','/api/owner-review/state','/api/owner-review/select'])
  expect((fetch.mock.calls.at(-1) as unknown as [string,RequestInit])[1]).toMatchObject({mode:'same-origin',credentials:'same-origin',redirect:'error',body:JSON.stringify({expected_task_id:task,selected_ids:[image]})})
  expect(JSON.stringify(fetch.mock.calls)).not.toContain('X-Review-Token')
 })
 it('permits persisted selection without asserting full workflow and reads back server selection',async()=>{
  let selected:string[]=[];const fetch=vi.fn(async(path:string,init:RequestInit)=>{if(path.endsWith('/select'))selected=JSON.parse(String(init.body)).selected_ids;return response(path.endsWith('capabilities')?caps:{...raw(),task:{...raw().task,selected}})})
  const p=createCompanionOwnerReviewProvider(fetch),store=useImageReviewStore();await store.connect(p);expect(store.canSelect).toBe(true);await store.persistSelect(image,true);expect(store.selectedIds).toEqual([image]);expect(store.canSave).toBe(true);expect(store.workflowGuardVerified).toBe(false)
 })
 it('fails closed on capability loss and rejects invalid selection before sending',async()=>{
  let enabled=true;const fetch=vi.fn(async(path:string)=>response(path.endsWith('capabilities')?{...caps,guarded_selection:enabled}:raw())),p=createCompanionOwnerReviewProvider(fetch)
  await p.loadState();await expect(p.persistSelection!(task,[image,image])).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(2);enabled=false;await expect(p.loadState()).rejects.toThrow();expect(p.selectionGuard).toBe('unverified');await expect(p.saveSelected({taskId:task,ids:[image]})).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(3)
 })
 it('requires typed bounded save receipts and retains uncertain failures for the store',async()=>{
  const fetch=vi.fn(async(path:string)=>response(path.endsWith('capabilities')?caps:path.endsWith('/export')?{cancelled:false,results:[{id:image,ok:'yes'}]}:raw())),p=createCompanionOwnerReviewProvider(fetch)
  await p.loadState();await expect(p.saveSelected({taskId:task,ids:[image]})).rejects.toThrow();await expect(p.loadPreview('../escape','full')).rejects.toThrow()
 })
})
const summary=()=>({root:'db://assets',total:2,imported:1,unimported:1,unknownType:0,byType:[{type:'image',count:2}],byTopLevelFolder:[{folder:'art',count:2}],generatedAt:new Date().toISOString()})
describe('project-bound readonly inventory',()=>{
 it('requires matching project and valid aggregate, and never turns unavailable into zero',async()=>{
  const fetch=vi.fn(async(_path:string)=>response({schemaVersion:'companion-asset-inventory-v1',projectId:project,summary:summary()}));vi.stubGlobal('fetch',fetch)
  expect((await readAssetInventory(project)).total).toBe(2);expect(fetch.mock.calls[0]?.[0]).toBe(`/api/projects/${project}/asset-inventory`)
  fetch.mockImplementation(async()=>response({},503));await expect(readAssetInventory(project)).rejects.toThrow('BRIDGE_UNAVAILABLE')
  fetch.mockImplementation(async()=>response({schemaVersion:'companion-asset-inventory-v1',projectId:'d'.repeat(16),summary:summary()}));await expect(readAssetInventory(project)).rejects.toThrow('RESPONSE_INVALID')
 })
 it('does not fetch on mount, and discards a late response after project/source changes',async()=>{
  let done!:(r:Response)=>void;const fetch=vi.fn(()=>new Promise<Response>(resolve=>{done=resolve}));vi.stubGlobal('fetch',fetch)
  const wrapper=mount(AssetInventorySummary,{props:{project:{id:project,path:'/a'},source:{}},global:{stubs:{'el-button':{template:'<button @click="$emit(\'click\')"><slot/></button>'}}}})
  expect(fetch).not.toHaveBeenCalled();await wrapper.find('button').trigger('click');await wrapper.setProps({project:{id:'d'.repeat(16),path:'/b'},source:{}});done(response({schemaVersion:'companion-asset-inventory-v1',projectId:project,summary:summary()}));await flushPromises();expect(wrapper.find('dl').exists()).toBe(false);wrapper.unmount()
 })
})
