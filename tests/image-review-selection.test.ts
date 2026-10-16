import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { useImageReviewStore } from '../src/stores/image-review'
import { createSameOriginImageReviewProvider } from '../src/adapters/image-review'
import { ImageReviewRejection } from '../src/domain/image-review'
import type { ImageReviewProvider, ImageReviewSnapshot } from '../src/domain/image-review'
import ImageAssetsView from '../src/views/ImageAssetsView.vue'
import { imageReviewProvider, registerImageReviewProvider } from '../src/image-review-integration'
const task='a'.repeat(32), other='b'.repeat(32), a='c'.repeat(32), b='d'.repeat(32)
function state():ImageReviewSnapshot{return {taskId:task,busy:false,items:[a,b].map(id=>({id,status:'ready',selected:false,title:id,width:128,height:128,contentType:'image/png'}))}}
function service(){
 let current=state()
 const p:ImageReviewProvider={label:'offline persistence fixture',saveSelectionGuard:'verified',workflowGuard:'verified',selectionGuard:'verified',
 loadState:vi.fn(async()=>structuredClone(current)),loadPreview:vi.fn(async(id,variant)=>({kind:'same-origin-image' as const,path:`/image/test-session-placeholder-only/${id}/${variant}`})),
 importCandidates:vi.fn(async()=>{}),saveSelected:vi.fn(async()=>({cancelled:true,results:[]})),
 persistSelection:vi.fn(async(expected,ids)=>{if(expected!==current.taskId)throw new ImageReviewRejection(409);current.items.forEach(item=>{item.selected=ids.includes(item.id)})}),
 recycleUnselected:vi.fn(async()=>{}),switchTask:vi.fn(async()=>{})}
 return {p,get state(){return current},set state(next:ImageReviewSnapshot){current=next}}
}
beforeEach(()=>setActivePinia(createPinia()))
afterEach(()=>{imageReviewProvider.value=null;vi.restoreAllMocks()})
describe('task-bound persisted selection, offline only',()=>{
 it('sends exact fixed select body only with both verified capabilities',async()=>{
  let enabled=false
  const calls:Array<[string,RequestInit]>=[]
  const fetch=async(path:string,init:RequestInit)=>{calls.push([path,init]);return new Response(JSON.stringify(path.includes('capabilities')?{schema_version:1,guarded_export:true,guarded_review_actions:true,guarded_selection:enabled}:path==='/api/state'?{busy:false,task:null}:{ok:true}),{headers:{'content-type':'application/json'}})}
  const p=createSameOriginImageReviewProvider({fetch,getProcessToken:()=> 'test-session-placeholder-only',guardedExport:true})
  await p.loadState();await expect(p.persistSelection!(task,[])).rejects.toThrow('尚未核实');expect(calls).toHaveLength(2)
  enabled=true;await p.loadState();await p.persistSelection!(task,[a]);expect(calls.at(-1)).toEqual(['/api/companion/select',expect.objectContaining({method:'POST',body:JSON.stringify({expected_task_id:task,selected_ids:[a]}),mode:'same-origin',redirect:'error'})])
  await expect(p.persistSelection!(task,[a,a])).rejects.toThrow();await p.persistSelection!(task,[])
 })
 it('persists click/all/invert/none and restores from service on reopen and same-task refresh',async()=>{
  const s=service(),store=useImageReviewStore();await store.connect(s.p);await store.persistSelect(a,true);expect(s.state.items[0]?.selected).toBe(true);expect(store.selectedIds).toEqual([a])
  await store.persistSelectMany('all');expect(store.selectedIds).toEqual([a,b]);await store.persistSelectMany('invert');expect(store.selectedIds).toEqual([])
  await store.persistSelect(a,true);store.disconnect();await store.connect(s.p);expect(store.selectedIds).toEqual([a])
  s.state.items.forEach(item=>{item.selected=item.id===b});await store.refresh();expect(store.selectedIds).toEqual([b]);await store.persistSelectMany('none');expect(store.selectedIds).toEqual([])
 })
 it('permits downloaded selection during busy search, but waits on one write and its late acknowledgement',async()=>{
  const s=service(),store=useImageReviewStore();s.state.busy=true;await store.connect(s.p)
  let done!:()=>void;s.p.persistSelection=vi.fn(()=>new Promise<void>(resolve=>{done=resolve}))
  const pending=store.persistSelect(a,true);expect(store.mutation).toBe('select');expect(store.selectedIds).toEqual([])
  await expect(store.persistSelect(b,true)).rejects.toThrow('未就绪');expect(()=>store.disconnect()).toThrow();await store.refresh();expect(s.p.loadState).toHaveBeenCalledTimes(1)
  s.state={...state(),taskId:other,items:state().items.map(item=>({...item,selected:item.id===b}))};done();await pending
  expect(store.snapshot.taskId).toBe(other);expect(store.selectedIds).toEqual([b]);expect(s.p.persistSelection).toHaveBeenCalledTimes(1)
 })
 it('keeps uncertain selection failures closed across reconnect; never optimistically claims saved selection',async()=>{
  const s=service(),store=useImageReviewStore();s.p.persistSelection=async()=>{throw new Error('reply lost after write')};await store.connect(s.p);await store.persistSelect(a,true)
  expect(store.selectedIds).toEqual([]);expect(store.uncertain).toBe(true);expect(store.canSave).toBe(false);store.disconnect();await store.connect(s.p);await expect(store.persistSelect(b,true)).rejects.toThrow('未就绪')
 })
 it('reads new task selection after a known old-task409 without replaying the attempted set',async()=>{
  const s=service(),store=useImageReviewStore();await store.connect(s.p);s.state={...state(),taskId:other,items:state().items.map(item=>({...item,selected:item.id===b}))};await store.persistSelect(a,true)
  expect(store.error).toContain('409');expect(store.uncertain).toBe(false);expect(store.selectedIds).toEqual([b]);expect(s.p.persistSelection).toHaveBeenCalledTimes(1)
 })
 it('does not unblock saving when accepted selection cannot be read back',async()=>{
  const s=service(),store=useImageReviewStore();await store.connect(s.p);s.p.loadState=async()=>{throw new Error('offline')};await store.persistSelect(a,true)
  expect(s.state.items[0]?.selected).toBe(true);expect(store.connected).toBe(false);expect(store.canSelect).toBe(false);expect(store.canSave).toBe(false)
 })
 it('adopts actual server selection without clearing it before atomic recycle',async()=>{
  const s=service(),store=useImageReviewStore();s.state.items[0]!.selected=true;await store.connect(s.p)
  store.awaitingTask={kind:'history',before:other,target:'f'.repeat(32),afterRead:0};expect(store.canAdoptObservedTask).toBe(true)
  store.adoptObservedTask(true);expect(store.selectedIds).toEqual([a]);await store.recycle();expect(s.p.recycleUnselected).toHaveBeenCalledWith(task,[a])
 })
 it('uses persisted selection from rendered checkboxes, not the legacy local-only helper',async()=>{
  const s=service(),pinia=createPinia(),store=useImageReviewStore(pinia);registerImageReviewProvider(s.p)
  const wrapper=mount(ImageAssetsView,{global:{plugins:[pinia,ElementPlus]}})
  try{await store.connect(s.p);await flushPromises();await wrapper.find('.image-review-row input[type=checkbox]').setValue(true);await flushPromises();expect(s.p.persistSelection).toHaveBeenCalledWith(task,[a]);expect(store.selectedIds).toEqual([a]);expect(wrapper.text()).toContain('持久化到本机审阅服务')}
  finally{wrapper.unmount()}
 })
 it('disables rendered selection for the old bridge without guarded-selection capability',async()=>{
  const s=service(),pinia=createPinia(),store=useImageReviewStore(pinia);Object.defineProperty(s.p,'selectionGuard',{value:'unverified'});registerImageReviewProvider(s.p)
  const wrapper=mount(ImageAssetsView,{global:{plugins:[pinia,ElementPlus]}})
  try{await store.connect(s.p);await flushPromises();expect(wrapper.find('.image-review-row input').attributes('disabled')).toBeDefined();expect(store.canSelect).toBe(false);expect(s.p.persistSelection).not.toHaveBeenCalled()}
  finally{wrapper.unmount()}
 })
})
