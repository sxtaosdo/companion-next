import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import { createCompanionBrowserProvider, type CompanionFetch } from '../src/adapters/companion-browser'
import { companionBrowserProvider, companionEventProvider } from '../src/companion-browser-integration'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { projectSetupProvider } from '../src/project-setup-integration'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import type { CallRecord } from '../src/domain/companion-browser'

// Full Vue page + real HTTP decoder + store, isolated response data only.
// This does not create natural production history or invoke an MCP tool.
let wrapper:VueWrapper|undefined
function rows(size:number):CallRecord[]{return Array.from({length:size},(_,index)=>{
 const sequence=size-index,failed=sequence%2===0
 return {id:`fixture-${sequence}`,sequence,projectId:'fixture-project',operation:`read_${sequence}`,operationNameZh:`读取 ${sequence}`,source:'web',startedAt:'2026-10-20T00:00:00.000Z',status:failed?'failed':'success',durationMs:sequence,inputSummary:`input-${sequence}`,...(failed?{errorSummary:`error-${sequence} <img onerror="bad">`}:{resultSummary:`result-${sequence}`})}
})}
function fixture(size:number){
 const records=rows(size),requests:string[]=[]
 let failNext=false,holdNext=false,release:(()=>void)|undefined
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
 const fetch:CompanionFetch=vi.fn(async(path,init)=>{
  expect(init.method).toBe('GET');requests.push(path)
  if(path==='/api/projects')return json([{id:'fixture-project',name:'Fixture',path:'/fixture'}])
  if(path==='/api/calls/counts')return json({sessionId:'fixture-session',counts:{'fixture-project':size},latest:{}})
  if(!path.startsWith('/api/projects/fixture-project/calls?'))throw Error('Unexpected isolated read')
  if(holdNext){holdNext=false;await new Promise<void>(resolve=>{release=resolve})}
  if(failNext){failNext=false;return json({error:'isolated unavailable'},503)}
  const query=new URL(path,'https://fixture.invalid').searchParams
  expect(query.get('limit')).toBe('50')
  const matching=records.filter(row=>(!query.has('before')||row.sequence<Number(query.get('before')))&&(query.get('status')!=='failed'||row.status==='failed'))
  const page=matching.slice(0,50)
  return json({sessionId:'fixture-session',total:size,retained:size,records:page,...(matching.length>50?{nextBefore:page.at(-1)!.sequence}:{})})
 })
 return {records,requests,fetch,fail:()=>{failNext=true},hold:()=>{holdNext=true},release:()=>{if(!release)throw Error('No held read');release()}}
}
async function setup(size:number){
 const f=fixture(size),pinia=createPinia(),store=useCompanionBrowserStore(pinia)
 const provider=createCompanionBrowserProvider({fetch:f.fetch,runtimeProbes:false});companionBrowserProvider.value=provider
 await store.connect(provider)
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView}]})
 await router.push('/projects?tab=calls');await router.isReady()
 wrapper=mount(CompanionBrowserView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}})
 store.setCallContext('fixture-project',false);await store.loadCalls();await flushPromises()
 return {f,store}
}
function button(text:string){const found=wrapper!.findAll('button').find(b=>b.text()===text);if(!found)throw Error(`Missing ${text}`);return found}
const visibleOperations=()=>wrapper!.findAll('details.companion-call-record summary code').map(n=>n.text())
afterEach(()=>{wrapper?.unmount();wrapper=undefined;companionBrowserProvider.value=null;companionEventProvider.value=null;creatorOperationsProvider.value=null;projectSetupProvider.value=null;document.body.innerHTML='';vi.restoreAllMocks()})

describe('Vue history page migration at the real 50-row boundary; isolated transport',()=>{
 it('renders 51 records as 50 then 1, expands genuine response fields, preserves opened detail, and stops at the end',async()=>{
  const {f}=await setup(51)
  expect(visibleOperations()).toEqual(f.records.slice(0,50).map(r=>r.operation))
  const failure=wrapper!.findAll('details.companion-call-record').find(d=>d.find('summary code').text()==='read_50')!
  await failure.find('summary').trigger('click');failure.element.setAttribute('open','')
  expect(failure.findAll('pre').at(-1)!.text()).toBe('error-50 <img onerror="bad">')
  expect(failure.find('img').exists()).toBe(false)
  await button('加载更多（50 条）').trigger('click');await flushPromises()
  expect(visibleOperations()).toEqual(f.records.map(r=>r.operation))
  expect(wrapper!.findAll('details.companion-call-record').find(d=>d.find('summary code').text()==='read_50')!.element.hasAttribute('open')).toBe(true)
  expect(wrapper!.text()).toContain('累计 51 次');expect(wrapper!.text()).toContain('保留 51 条')
  expect(wrapper!.findAll('button').some(b=>b.text()==='加载更多（50 条）')).toBe(false)
  expect(f.requests.filter(p=>p.includes('/calls?'))).toEqual(['/api/projects/fixture-project/calls?limit=50','/api/projects/fixture-project/calls?limit=50&before=2'])
 })
 it('uses the actual failed filter event, blocks duplicate append, and renders all 66 failures across two pages',async()=>{
  const {f,store}=await setup(132)
  const select=wrapper!.findAllComponents({name:'ElSelect'})[1]!
  select.vm.$emit('update:modelValue',true);select.vm.$emit('change',true);await flushPromises()
  expect(store.failedOnly).toBe(true);expect(wrapper!.findAll('details.companion-call-record')).toHaveLength(50)
  f.hold();const more=button('加载更多（50 条）');await more.trigger('click');await more.trigger('click');await flushPromises()
  expect(store.callLoading).toBe(true)
  expect(f.requests.filter(p=>p.includes('status=failed&before='))).toHaveLength(1)
  f.release();await flushPromises()
  expect(visibleOperations()).toEqual(f.records.filter(r=>r.status==='failed').map(r=>r.operation))
  expect(visibleOperations()).toHaveLength(66);expect(store.total).toBe(132);expect(store.retained).toBe(132)
  expect(wrapper!.findAll('button').some(b=>b.text()==='加载更多（50 条）')).toBe(false)
 })
 it('retains the first page after append error and the retry button sends the same server cursor without duplication',async()=>{
  const {f,store}=await setup(51);f.fail()
  await button('加载更多（50 条）').trigger('click');await flushPromises()
  expect(store.callError).not.toBe('');expect(wrapper!.find('[role="alert"]').exists()).toBe(true)
  expect(visibleOperations()).toHaveLength(50);expect(store.nextBefore).toBe(2)
  await button('加载更多（50 条）').trigger('click');await flushPromises()
  expect(store.callError).toBe('');expect(visibleOperations()).toHaveLength(51)
  expect(new Set(visibleOperations()).size).toBe(51)
  expect(f.requests.filter(p=>p.includes('before='))).toEqual(Array(2).fill('/api/projects/fixture-project/calls?limit=50&before=2'))
 })
 it('discards an older append after a filter change rather than mixing success records into failed-only results',async()=>{
  const {f,store}=await setup(132);f.hold()
  await button('加载更多（50 条）').trigger('click');await flushPromises()
  const select=wrapper!.findAllComponents({name:'ElSelect'})[1]!
  select.vm.$emit('update:modelValue',true);select.vm.$emit('change',true);await flushPromises()
  expect(store.failedOnly).toBe(true);expect(store.records).toHaveLength(50)
  f.release();await flushPromises()
  expect(store.records.every(r=>r.status==='failed')).toBe(true)
  expect(visibleOperations()).toEqual(f.records.filter(r=>r.status==='failed').slice(0,50).map(r=>r.operation))
  expect(store.nextBefore).toBe(34);expect(store.callError).toBe('')
 })
})
