import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import App from '../src/App.vue'
import { routes, router as appRouter } from '../src/router'
import { knowledgePageFor, rememberKnowledgeScroll, knowledgeScrollFor, clearKnowledgeScrollPositions } from '../src/domain/knowledge-navigation'
import { useKnowledgeReadStore } from '../src/stores/knowledge-read'
import { knowledgeReadProvider, registerKnowledgeReadProvider } from '../src/knowledge-read-integration'
import { knowledgeFixture } from './knowledge-read-fixture'
let wrapper: VueWrapper | undefined
async function setup(path: string) {
  const pinia=createPinia(), router=createRouter({history:createMemoryHistory(),routes})
  await router.push(path); await router.isReady()
  wrapper=mount(App,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}})
  await flushPromises()
  return {router,read:useKnowledgeReadStore(pinia)}
}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;knowledgeReadProvider.value=null;clearKnowledgeScrollPositions();document.body.innerHTML='';vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('knowledge secondary navigation and visit lifetime',()=>{
  it.each([
    ['/knowledge','检索与文档'],['/knowledge/qa','问答'],['/knowledge/manage','连接与同步'],
  ])('deep links to %s with one active child and no project context',async(path,title)=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
    const {router}=await setup(path!)
    expect(wrapper!.get('.page-heading h1').text()).toBe(title)
    expect(wrapper!.get('.knowledge-nav-toggle').attributes('aria-expanded')).toBe('true')
    const children=wrapper!.findAll('.knowledge-nav-child')
    expect(children.map(link=>link.text())).toEqual(['检索与文档','问答','连接与同步'])
    expect(children.map(link=>link.attributes('href'))).toEqual(['/knowledge','/knowledge/qa','/knowledge/manage'])
    expect(children.filter(link=>link.attributes('aria-current')==='page').map(link=>link.text())).toEqual([title])
    expect(wrapper!.find('.project-select').exists()).toBe(false);expect(wrapper!.find('.source-banner').exists()).toBe(false)
    expect(router.currentRoute.value.meta.workspaceIndependent).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('retains completed read and conditions across subpages without repeated requests and clears them on leaving the visit',async()=>{
    const p=knowledgeFixture();registerKnowledgeReadProvider(p)
    const {router,read}=await setup('/knowledge?legacy=kept')
    await read.connect(p);read.selectKnowledgeBase('kb-a','Selected A');read.query='kept keyword';await read.run('search');await flushPromises()
    const result=read.result
    expect(result).not.toBeNull()
    await router.push('/knowledge/qa');await flushPromises()
    await router.push('/knowledge/manage');await flushPromises()
    await router.push('/knowledge');await flushPromises()
    expect(read.kbId).toBe('kb-a');expect(read.query).toBe('kept keyword');expect(read.selectedBaseLabel).toContain('Selected A')
    expect(read.result).toBe(result);expect(p.search).toHaveBeenCalledTimes(1);expect(p.status).toHaveBeenCalledTimes(1)
    expect(p.listKnowledgeBases).not.toHaveBeenCalled();expect(p.listAgents).not.toHaveBeenCalled()
    await router.push('/help');await flushPromises();expect(read.result).toBeNull()
    await router.push('/knowledge');await flushPromises();expect(read.result).toBeNull()
  })
  it('keeps the legacy models root separate and ignores unknown old query tabs on read',async()=>{
    const {router}=await setup('/knowledge?tab=models&filter=local#status')
    expect(wrapper!.get('.page-heading h1').text()).toBe('模型服务')
    expect(wrapper!.find('.knowledge-connect').exists()).toBe(false)
    expect(wrapper!.get('.nav-item[aria-current="page"]').text()).toBe('模型服务')
    await router.push('/knowledge?tab=historical');await flushPromises()
    expect(wrapper!.get('.page-heading h1').text()).toBe('检索与文档')
    expect(router.currentRoute.value.query.tab).toBe('historical')
    await router.push('/knowledge/manage?tab=models');await flushPromises()
    expect(wrapper!.get('.page-heading h1').text()).toBe('连接与同步')
    expect(wrapper!.find('.knowledge-manage-workspace').exists()).toBe(true)
  })
  it('tracks native back/forward and reopens a collapsed knowledge section on child navigation',async()=>{
    const {router}=await setup('/knowledge')
    await wrapper!.get('.knowledge-nav-toggle').trigger('click')
    expect(wrapper!.get('.knowledge-nav-toggle').attributes('aria-expanded')).toBe('false')
    await router.push('/knowledge/qa?mode=agent');await flushPromises()
    expect(wrapper!.get('.knowledge-nav-toggle').attributes('aria-expanded')).toBe('true')
    await router.push('/knowledge/manage');await flushPromises()
    router.back();await vi.waitFor(()=>expect(router.currentRoute.value.fullPath).toBe('/knowledge/qa?mode=agent'));await flushPromises()
    expect(wrapper!.get('.knowledge-nav-child[aria-current="page"]').text()).toBe('问答')
    expect(wrapper!.get('.knowledge-agent').isVisible()).toBe(true)
    router.forward();await vi.waitFor(()=>expect(router.currentRoute.value.path).toBe('/knowledge/manage'));await flushPromises()
    expect(wrapper!.get('.knowledge-nav-child[aria-current="page"]').text()).toBe('连接与同步')
  })
})
describe('knowledge scroll memory',()=>{
  it('keeps the legacy service-status anchor when leaving a knowledge page',async()=>{
    const {router}=await setup('/knowledge')
    const from=router.currentRoute.value
    await router.push('/overview#service-status');await flushPromises()
    const to=router.currentRoute.value
    const scroll=appRouter.options.scrollBehavior
    expect(scroll).toBeDefined()
    expect(await scroll?.(to,from,null)).toEqual({el:'#service-status',top:16})
  })
  it('isolates page and QA mode positions without treating model/unknown routes as knowledge',()=>{
    rememberKnowledgeScroll({path:'/knowledge'},{left:0,top:120})
    rememberKnowledgeScroll({path:'/knowledge/qa'},{left:0,top:200})
    rememberKnowledgeScroll({path:'/knowledge/qa',query:{mode:'agent'}},{left:0,top:360})
    expect(knowledgeScrollFor({path:'/knowledge'})).toEqual({left:0,top:120})
    expect(knowledgeScrollFor({path:'/knowledge/qa'})).toEqual({left:0,top:200})
    expect(knowledgeScrollFor({path:'/knowledge/qa',query:{mode:'agent'}})).toEqual({left:0,top:360})
    expect(knowledgePageFor({path:'/knowledge',query:{tab:'models'}})).toBeUndefined()
    expect(knowledgePageFor({path:'/knowledge/manage',query:{tab:'models'}})).toBe('manage')
    clearKnowledgeScrollPositions('read');expect(knowledgeScrollFor({path:'/knowledge'})).toBeUndefined()
    expect(knowledgeScrollFor({path:'/knowledge/qa'})).toEqual({left:0,top:200})
    clearKnowledgeScrollPositions();expect(knowledgeScrollFor({path:'/knowledge/qa'})).toBeUndefined()
  })
  it('does not retain invalid positions or accept mutable aliases',()=>{
    rememberKnowledgeScroll({path:'/help'},{left:0,top:100})
    rememberKnowledgeScroll({path:'/knowledge'},{left:NaN,top:Infinity})
    expect(knowledgeScrollFor({path:'/knowledge'})).toBeUndefined()
    rememberKnowledgeScroll({path:'/knowledge'},{left:-5,top:10})
    const value=knowledgeScrollFor({path:'/knowledge'})!;value.top=99
    expect(knowledgeScrollFor({path:'/knowledge'})).toEqual({left:0,top:10})
  })
})
