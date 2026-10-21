import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import KnowledgeReadView from '../src/views/KnowledgeReadView.vue'
import KnowledgeManageView from '../src/views/KnowledgeManageView.vue'
import { useKnowledgeReadStore } from '../src/stores/knowledge-read'
import { knowledgeReadProvider, registerKnowledgeReadProvider } from '../src/knowledge-read-integration'
import { knowledgeFixture, knowledgeStatus } from './knowledge-read-fixture'
let wrapper:VueWrapper|undefined
async function setup(path='/knowledge'){const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/knowledge',component:KnowledgeReadView},{path:'/knowledge/manage',component:KnowledgeManageView}]});await router.push(path);await router.isReady();wrapper=mount(RouterView,{global:{plugins:[pinia,router,ElementPlus]}});await flushPromises();return {store:useKnowledgeReadStore(pinia),router}}
function button(text:string){return wrapper!.findAll('button').find(b=>b.text()===text)!}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;knowledgeReadProvider.value=null;vi.restoreAllMocks();vi.unstubAllEnvs()})
describe('knowledge page read boundaries',()=>{
 it.each(['/knowledge','/knowledge/manage','/knowledge?tab=models'])('passive build keeps %s disconnected and explains no CLI probe',async path=>{vi.stubEnv('MODE','companion-readonly');await setup(path);if(path.includes('tab=models'))expect(button('读取当前服务状态').attributes('disabled')).toBeDefined();else {expect(button('连接知识服务').attributes('disabled')).toBeDefined();expect(wrapper!.get('.knowledge-connect').text()).toContain('未检查');if(path.includes('/manage')){expect(wrapper!.text()).toContain('此只读预览未启用状态探测');expect(wrapper!.text()).toContain('没有判断原服务离线')}}})
 it('shows missing host without requests, fixtures or guessed zero results',async()=>{await setup();expect(wrapper!.text()).toContain('当前宿主未接入');expect(wrapper!.get('.knowledge-connect').text()).toContain('未检查');expect(wrapper!.text()).toContain('点击“读取知识库列表”，或输入关键词搜索。');expect(button('连接知识服务').attributes('disabled')).toBeDefined();expect(wrapper!.findAll('iframe')).toHaveLength(0)})
 it('does not query on mount, connect only reads status and no frameable iframe is created',async()=>{const p=knowledgeFixture();registerKnowledgeReadProvider(p);await setup();expect(p.status).not.toHaveBeenCalled();await button('连接知识服务').trigger('click');await flushPromises();expect(p.status).toHaveBeenCalledTimes(1);expect(p.search).not.toHaveBeenCalled();expect(wrapper!.get('.knowledge-connect').text()).toContain('服务可达');expect(wrapper!.text()).not.toContain('模型启动器');expect(wrapper!.text()).not.toContain('Comfy');expect(wrapper!.findAll('iframe')).toHaveLength(0);expect(wrapper!.findAll('a[href^="http"]')).toHaveLength(0)})
 it('selects a returned base without submitting a query and clears previous result',async()=>{const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p);await button('读取知识库列表').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('Test KB');await button('选用此知识库').trigger('click');expect(store.kbId).toBe('kb1');expect(store.result).toBeNull();expect(p.viewKnowledgeBase).not.toHaveBeenCalled();expect(p.search).not.toHaveBeenCalled()})
 it('searches explicitly, and input edits invalidate the old display',async()=>{const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p);await wrapper!.get('input[aria-label="检索关键词"]').setValue('word');await button('检索知识库').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('test result');await wrapper!.get('input[aria-label="检索关键词"]').setValue('other');expect(wrapper!.text()).not.toContain('test result');expect(wrapper!.text()).toContain('旧结果已清空');expect(p.search).toHaveBeenCalledTimes(1)})
 it('escapes original content and never renders downloaded html or a save link',async()=>{const p=knowledgeFixture();vi.mocked(p.downloadDocument).mockResolvedValue({docId:'d1',fileName:'x.html',bytes:30,truncated:false,isBase64:false,content:'<script>attack()</script>'});registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p);store.documentId='d1';await flushPromises();await button('读取原文预览').trigger('click');await flushPromises();expect(wrapper!.findAll('script')).toHaveLength(0);expect(wrapper!.text()).toContain('<script>attack()</script>');expect(wrapper!.findAll('a[download]')).toHaveLength(0);expect(wrapper!.text()).toContain('不保存到用户目录')})
 it('shows binary preview metadata without embedding or exposing base64',async()=>{const p=knowledgeFixture();vi.mocked(p.downloadDocument).mockResolvedValue({docId:'d1',fileName:'file.bin',bytes:3,truncated:true,isBase64:true,content:'AAAA'});registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p);store.documentId='d1';await store.run('original');await flushPromises();expect(wrapper!.text()).toContain('二进制原文');expect(wrapper!.text()).toContain('内容已截断');expect(wrapper!.text()).not.toContain('AAAA');expect(wrapper!.findAll('img,iframe,object')).toHaveLength(0)})
 it('keeps failed sync registration unknown instead of a successful empty list',async()=>{const p=knowledgeFixture();vi.mocked(p.status).mockResolvedValue({...knowledgeStatus,sync:{...knowledgeStatus.sync,available:false,error:{code:'READ_FAILED',message:'来源状态读取失败'}}});registerKnowledgeReadProvider(p);const {store}=await setup('/knowledge/manage');await store.connect(p);await flushPromises();expect(wrapper!.text()).toContain('来源登记读取不可用 / 未知');expect(wrapper!.text()).toContain('来源状态读取失败');expect(wrapper!.text()).not.toContain('服务本次未返回登记来源。')})
 it('keeps model tab free of knowledge CLI/status queries',async()=>{const p=knowledgeFixture();registerKnowledgeReadProvider(p);await setup('/knowledge?tab=models');expect(wrapper!.text()).toContain('模型服务');expect(wrapper!.text()).not.toContain('读取知识库列表');expect(p.status).not.toHaveBeenCalled()})
 it('clears result and cancels pending work on tab change and unmount',async()=>{const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store,router}=await setup();await store.connect(p);await store.run('bases');const cancel=vi.spyOn(store,'cancelReads');await router.push('/knowledge?tab=models');expect(store.result).toBeNull();expect(cancel).toHaveBeenCalledTimes(1);wrapper!.unmount();wrapper=undefined;expect(cancel).toHaveBeenCalledTimes(2)})
 it('disconnects immediately if provider identity changed off page or while mounted',async()=>{const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p);registerKnowledgeReadProvider(knowledgeFixture());await flushPromises();expect(store.provider).toBeNull();expect(store.status).toBeNull()})
})

describe('knowledge bounded read presentation',()=>{
 it('keeps unverified keyword status distinct from an explicit enabled search entry',async()=>{
  const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p)
  await wrapper!.get('input[aria-label="检索关键词"]').setValue('offline fixture')
  expect(store.status?.retrieval.keyword).toBe('unverified')
  expect(button('检索知识库').attributes('disabled')).toBeUndefined()
  expect(p.search).not.toHaveBeenCalled()
 })
 it('shows document and chunk truncation without inventing pagination or loading more',async()=>{
  const p=knowledgeFixture();vi.mocked(p.listDocuments).mockResolvedValue({items:[{id:'doc1',title:'Synthetic bounded document'}],truncated:true})
  registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p)
  await button('读取文档列表').trigger('click');await flushPromises()
  expect(wrapper!.text()).toContain('仍有未返回文档（此页无分页）')
  expect(p.listDocuments).toHaveBeenCalledTimes(1)
  await button('选用此文档').trigger('click');await flushPromises()
  expect(p.viewDocument).not.toHaveBeenCalled();expect(p.listChunks).not.toHaveBeenCalled()
  await button('读取文档切片').trigger('click');await flushPromises()
  expect(wrapper!.text()).toContain('仍有未返回内容');expect(wrapper!.text()).toContain('chunk text')
  expect(p.listChunks).toHaveBeenCalledTimes(1);expect(p.downloadDocument).not.toHaveBeenCalled()
  expect(wrapper!.findAll('button').some(b=>/下一页|加载更多/.test(b.text()))).toBe(false)
 })
})


describe('knowledge content-first presentation',()=>{
 it('keeps the default page on library/search/document actions and results, with advanced read options collapsed',async()=>{
  const p=knowledgeFixture();registerKnowledgeReadProvider(p);await setup()
  const nodes=wrapper!.findAll('.knowledge-controls,.knowledge-results,.knowledge-technical,.knowledge-conversation,.knowledge-agent')
  expect(nodes.map(node=>node.classes().join(' '))).toEqual(['section-card knowledge-controls','section-card knowledge-results'])
  expect(wrapper!.get('.knowledge-read-options').attributes('open')).toBeUndefined()
  expect(button('读取知识库列表').element.closest('details')).toBeNull()
  expect(button('检索知识库').element.closest('details')).toBeNull()
  expect(button('读取文档列表').element.closest('details')).toBeNull()
  expect(button('读取文档切片').element.closest('details')).not.toBeNull()
  expect(wrapper!.find('.knowledge-status-grid').exists()).toBe(false)
  expect(wrapper!.find('.local-service-controls').exists()).toBe(false)
  expect(wrapper!.text()).not.toContain('模型启动器');expect(wrapper!.text()).not.toContain('Comfy')
  expect(p.status).not.toHaveBeenCalled();expect(p.loadServiceStates).not.toHaveBeenCalled();expect(p.search).not.toHaveBeenCalled()
 })
 it('distinguishes pending service inspection from never checked without displaying offline',async()=>{
  const p=knowledgeFixture();let complete!: (value: Awaited<ReturnType<typeof p.loadServiceStates>>) => void
  vi.mocked(p.loadServiceStates).mockImplementation(()=>new Promise(resolve=>{complete=resolve}))
  registerKnowledgeReadProvider(p);const {store}=await setup()
  expect(wrapper!.get('.knowledge-connect').text()).toContain('未检查')
  const pending=store.connect(p);await flushPromises()
  expect(wrapper!.get('.knowledge-connect').text()).toContain('检查中')
  expect(wrapper!.get('.knowledge-connect').text()).not.toContain('离线')
  complete({knowledge:{running:true,frameable:false},warnings:[]});await pending;await flushPromises()
  expect(wrapper!.get('.knowledge-connect').text()).toContain('服务可达')
 })
 it('shows service read failure and retry guidance in the main header even when retrieval status succeeded',async()=>{
  const p=knowledgeFixture();vi.mocked(p.loadServiceStates).mockRejectedValue(Error('offline fixture'))
  registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p);await flushPromises()
  expect(store.status).not.toBeNull()
  expect(wrapper!.get('.knowledge-connect').text()).toContain('读取失败')
  expect(wrapper!.get('.knowledge-fault').text()).toContain('刷新状态重试')
  expect(wrapper!.get('.knowledge-fault').element.closest('details')).toBeNull()
  expect(wrapper!.get('.knowledge-connect').text()).not.toContain('离线')
  expect(wrapper!.get('.knowledge-connect').text()).not.toContain('服务可达')
 })
 it('keeps selected library name prominent while preserving the original ID and explicit query flow',async()=>{
  const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p)
  await button('读取知识库列表').trigger('click');await flushPromises()
  await button('选用此知识库').trigger('click');await flushPromises()
  expect(wrapper!.get('.knowledge-current').text()).toBe('当前：Test KB')
  expect(store.kbId).toBe('kb1');expect(p.search).not.toHaveBeenCalled()
  store.kbId='other';await flushPromises();expect(wrapper!.get('.knowledge-current').text()).toBe('当前：已选择知识库')
 })
 it('keeps absent or denied access distinct from offline and gives a short next step',async()=>{
  const p=knowledgeFixture();vi.mocked(p.status).mockResolvedValue({...knowledgeStatus,retrieval:{...knowledgeStatus.retrieval,auth:'denied'}})
  registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p);await flushPromises()
  expect(wrapper!.get('.knowledge-connect').text()).toContain('认证被拒绝')
  expect(wrapper!.get('.knowledge-fault').text()).toContain('核对已有接入配置')
  expect(wrapper!.get('.knowledge-connect').text()).not.toContain('离线')
  expect(p.search).not.toHaveBeenCalled()
 })
})


describe('knowledge list feedback stays beside its trigger',()=>{
 it('uses the same unreachable wording as service maintenance',async()=>{
  const p=knowledgeFixture();vi.mocked(p.loadServiceStates).mockResolvedValue({knowledge:{running:false,frameable:false},warnings:[]})
  registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p);await flushPromises()
  expect(wrapper!.get('.knowledge-connect').text()).toContain('服务不可达')
  expect(wrapper!.get('.knowledge-connect').text()).not.toContain('探测未达')
 })

 it('keeps pending, populated, empty and failed list outcomes in one region without duplicate panels',async()=>{
  const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store}=await setup();await store.connect(p)
  let complete!:(value:Awaited<ReturnType<typeof p.listKnowledgeBases>>)=>void
  vi.mocked(p.listKnowledgeBases).mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve}))
  await button('读取知识库列表').trigger('click');await flushPromises()
  const region=wrapper!.get('.knowledge-base-browser')
  expect(region.text()).toContain('正在读取知识库列表')
  expect(region.get('button').classes()).toContain('is-loading')
  expect(wrapper!.find('.knowledge-results').exists()).toBe(false)
  complete({items:[{id:'kb1',name:'Returned library'}]});await flushPromises()
  expect(region.text()).toContain('Returned library');expect(region.text()).toContain('已读取 1 个知识库')
  vi.mocked(p.listKnowledgeBases).mockResolvedValueOnce({items:[]})
  await button('读取知识库列表').trigger('click');await flushPromises()
  expect(region.text()).toContain('暂无知识库');expect(region.text()).not.toContain('Returned library')
  vi.mocked(p.listKnowledgeBases).mockRejectedValueOnce(new Error('isolated failure'))
  await button('读取知识库列表').trigger('click');await flushPromises()
  expect(region.find('.el-alert--error').exists()).toBe(true);expect(region.text()).not.toContain('暂无知识库')
  expect(p.listKnowledgeBases).toHaveBeenCalledTimes(3);expect(p.search).not.toHaveBeenCalled()
 })
 it('shows the status request loading and failure as such instead of a never-checked retrieval',async()=>{
  const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store}=await setup()
  let reject!:(reason:unknown)=>void
  vi.mocked(p.status).mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail}))
  const pending=store.connect(p);await flushPromises()
  expect(wrapper!.get('.knowledge-connect').findAll('.el-tag').every(tag=>tag.text()==='检查中')).toBe(true)
  reject(new Error('isolated status failure'));await pending;await flushPromises()
  expect(wrapper!.get('.knowledge-connect').text()).toContain('读取失败')
  expect(wrapper!.get('.knowledge-connect').text()).not.toContain('检索未检查')
 })
 it('management keeps service state in the shared bar without a duplicate connection summary',async()=>{
  const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store}=await setup('/knowledge/manage');await store.connect(p);await flushPromises()
  expect(wrapper!.find('.knowledge-access-summary').exists()).toBe(false)
  expect(wrapper!.get('.knowledge-connect').text()).toContain('服务可达')
  expect(wrapper!.get('.knowledge-technical').attributes('open')).toBeUndefined()
 })
})
