import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { cloneVNode, defineComponent, h, KeepAlive } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import KnowledgeReadView from '../src/views/KnowledgeReadView.vue'
import KnowledgeQuestionView from '../src/views/KnowledgeQuestionView.vue'
import KnowledgeManageView from '../src/views/KnowledgeManageView.vue'
import KnowledgeStatusBar from '../src/components/KnowledgeStatusBar.vue'
import LocalServiceControls from '../src/components/LocalServiceControls.vue'
import { useKnowledgeReadStore } from '../src/stores/knowledge-read'
import { knowledgeReadProvider, registerKnowledgeReadProvider } from '../src/knowledge-read-integration'
import { knowledgeFixture } from './knowledge-read-fixture'
let wrapper:VueWrapper|undefined
async function setup(path:string,keepAlive=false){
  const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/knowledge',component:KnowledgeReadView},{path:'/knowledge/qa',component:KnowledgeQuestionView},{path:'/knowledge/manage',component:KnowledgeManageView}]})
  await router.push(path);await router.isReady()
  const root=keepAlive?defineComponent({setup:()=>()=>h(RouterView,null,{default:({Component,route}:any)=>h(KeepAlive,null,Component?[cloneVNode(Component,{key:route.path})]:[])})}):RouterView
  wrapper=mount(root,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}});await flushPromises()
  return {store:useKnowledgeReadStore(pinia),router}
}
function button(label:string){const found=wrapper!.findAll('button').find(item=>item.text()===label);if(!found)throw Error(label);return found}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;knowledgeReadProvider.value=null;document.body.innerHTML='';vi.unstubAllGlobals();vi.restoreAllMocks()})
describe('knowledge task subpages',()=>{
  it.each(['/knowledge','/knowledge/qa','/knowledge/manage'])('shows shared short status on %s without automatic requests',async path=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const p=knowledgeFixture();registerKnowledgeReadProvider(p)
    await setup(path)
    expect(wrapper!.findAllComponents(KnowledgeStatusBar)).toHaveLength(1)
    expect(wrapper!.get('.knowledge-connect').text()).toContain('未检查')
    expect(p.status).not.toHaveBeenCalled();expect(p.loadServiceStates).not.toHaveBeenCalled();expect(p.listKnowledgeBases).not.toHaveBeenCalled();expect(p.listAgents).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
    await button('连接知识服务').trigger('click');await flushPromises()
    expect(p.status).toHaveBeenCalledTimes(1);expect(p.loadServiceStates).toHaveBeenCalledTimes(1)
    expect(wrapper!.get('.knowledge-connect').text()).toContain('服务可达')
  })
  it('keeps search/documents on the default page and service/sync on management only',async()=>{
    const p=knowledgeFixture();registerKnowledgeReadProvider(p);await setup('/knowledge')
    expect(wrapper!.find('.knowledge-controls').exists()).toBe(true)
    expect(wrapper!.find('.knowledge-results').exists()).toBe(true)
    expect(wrapper!.find('.knowledge-conversation').exists()).toBe(false)
    expect(wrapper!.find('.knowledge-agent').exists()).toBe(false)
    expect(wrapper!.find('.knowledge-sync').exists()).toBe(false)
    expect(wrapper!.findComponent(LocalServiceControls).exists()).toBe(false)
    wrapper!.unmount();wrapper=undefined;await setup('/knowledge/manage')
    expect(wrapper!.find('.knowledge-controls').exists()).toBe(false)
    expect(wrapper!.find('.knowledge-sync').exists()).toBe(true)
    expect(wrapper!.getComponent(LocalServiceControls).props('knowledgeOnly')).toBe(true)
    expect(wrapper!.get('.knowledge-technical').attributes('open')).toBeUndefined()
    expect(wrapper!.text()).not.toContain('模型启动器');expect(wrapper!.text()).not.toContain('Comfy')
  })
  it('uses the sole in-page mode switch for ordinary/Agent questions, without launching either on tab changes',async()=>{
    const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {router}=await setup('/knowledge/qa')
    expect(wrapper!.get('.knowledge-conversation').isVisible()).toBe(true)
    expect(wrapper!.get('.knowledge-agent').isVisible()).toBe(false)
    expect(wrapper!.find('.knowledge-sync').exists()).toBe(false)
    const link=wrapper!.get('.knowledge-question-modes a[href="/knowledge/qa?mode=agent"]')
    await link.trigger('click');await flushPromises()
    expect(router.currentRoute.value.query.mode).toBe('agent')
    expect(wrapper!.get('.knowledge-conversation').isVisible()).toBe(false)
    expect(wrapper!.get('.knowledge-agent').isVisible()).toBe(true)
    expect((wrapper!.get('.knowledge-agent-catalog').element as HTMLElement).style.display).not.toBe('none')
    expect(p.status).not.toHaveBeenCalled();expect(p.listAgents).not.toHaveBeenCalled()
    await wrapper!.get('.knowledge-question-modes a[href="/knowledge/qa?mode=kb"]').trigger('click');await flushPromises()
    expect(wrapper!.get('.knowledge-conversation').isVisible()).toBe(true)
    await router.replace('/knowledge/qa?mode=agent');await flushPromises()
    expect(wrapper!.get('.knowledge-agent').isVisible()).toBe(true)
    await router.replace('/knowledge/qa');await flushPromises()
    expect(wrapper!.get('.knowledge-conversation').isVisible()).toBe(true)
    await router.push('/knowledge/qa?mode=agent');await flushPromises()
    router.back();await flushPromises()
    expect(router.currentRoute.value.query.mode).toBeUndefined()
    expect(wrapper!.get('.knowledge-conversation').isVisible()).toBe(true)
    expect(p.status).not.toHaveBeenCalled();expect(p.listAgents).not.toHaveBeenCalled()
  })
  it('keeps detailed Agent catalog available without overwriting completed search content',async()=>{
    const p=knowledgeFixture();registerKnowledgeReadProvider(p);const {store}=await setup('/knowledge/qa?mode=agent')
    await store.connect(p);store.query='word';await store.run('search');const result=store.result
    await button('读取 Agent 列表').trigger('click');await flushPromises()
    expect(p.listAgents).toHaveBeenCalledTimes(1)
    expect(store.agentCatalog).not.toBeNull()
    expect(wrapper!.get('.knowledge-agent-catalog').text()).toContain(store.agentCatalog![0]!.id)
    expect(store.result).toBe(result);expect(p.search).toHaveBeenCalledTimes(1)
  })
  it('honors the explicit QA mode on cached cross-page deep links and forward navigation',async()=>{
    const p=knowledgeFixture();registerKnowledgeReadProvider(p)
    const {router}=await setup('/knowledge/qa?mode=kb',true)
    expect(wrapper!.get('.knowledge-conversation').isVisible()).toBe(true)
    await router.push('/knowledge/manage?mode=agent');await flushPromises()
    await router.push('/knowledge/qa?mode=agent');await flushPromises()
    expect(wrapper!.get('.knowledge-agent').isVisible()).toBe(true)
    expect(wrapper!.get('.knowledge-conversation').isVisible()).toBe(false)
    router.back();await flushPromises()
    router.back();await flushPromises()
    expect(wrapper!.get('.knowledge-conversation').isVisible()).toBe(true)
    router.forward();await flushPromises()
    router.forward();await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/knowledge/qa?mode=agent')
    expect(wrapper!.get('.knowledge-agent').isVisible()).toBe(true)
    expect(p.status).not.toHaveBeenCalled();expect(p.loadServiceStates).not.toHaveBeenCalled();expect(p.listAgents).not.toHaveBeenCalled()
  })
  it('never mounts model controls from a cached search view on management with a models query',async()=>{
    const p=knowledgeFixture();registerKnowledgeReadProvider(p)
    const {router}=await setup('/knowledge',true)
    await router.push('/knowledge/manage?tab=models');await flushPromises()
    expect(wrapper!.findAllComponents(LocalServiceControls).some(control=>control.props('modelsOnly'))).toBe(false)
    expect(wrapper!.getComponent(LocalServiceControls).props('knowledgeOnly')).toBe(true)
    expect(p.loadServiceStates).not.toHaveBeenCalled();expect(p.status).not.toHaveBeenCalled()
    await router.back();await flushPromises()
    expect(wrapper!.find('.knowledge-controls').exists()).toBe(true)
    expect(wrapper!.findComponent(LocalServiceControls).exists()).toBe(false)
  })
  it('retains the legacy models branch without adding knowledge status, search or sync',async()=>{
    const p=knowledgeFixture();registerKnowledgeReadProvider(p);await setup('/knowledge?tab=models')
    expect(wrapper!.findComponent(KnowledgeStatusBar).exists()).toBe(false)
    expect(wrapper!.getComponent(LocalServiceControls).props('modelsOnly')).toBe(true)
    expect(wrapper!.find('.knowledge-controls').exists()).toBe(false)
    expect(wrapper!.find('.knowledge-sync').exists()).toBe(false)
    expect(p.status).not.toHaveBeenCalled()
  })
})
