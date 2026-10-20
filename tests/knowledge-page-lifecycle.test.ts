import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, KeepAlive, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { useKnowledgePageLifecycle } from '../src/composables/use-knowledge-page'
import { useKnowledgeReadStore } from '../src/stores/knowledge-read'
import { useKnowledgeConversationStore } from '../src/stores/knowledge-conversation'
import { useKnowledgeAgentStore } from '../src/stores/knowledge-agent'
import { useLocalServiceOperationsStore } from '../src/stores/local-service-operations'
import KnowledgeConversationPanel from '../src/components/KnowledgeConversationPanel.vue'
import KnowledgeAgentPanel from '../src/components/KnowledgeAgentPanel.vue'
import KnowledgeSyncPanel from '../src/components/KnowledgeSyncPanel.vue'
import type { KnowledgeSyncReply } from '../src/domain/knowledge-sync'
import LocalServiceControls from '../src/components/LocalServiceControls.vue'
import { knowledgeReadProvider } from '../src/knowledge-read-integration'
import { knowledgeConversationProvider } from '../src/knowledge-conversation-integration'
import { knowledgeAgentPending, knowledgeAgentProvider } from '../src/knowledge-agent-integration'
import { hasUnknownKnowledgeSync, knowledgeSyncPending, knowledgeSyncProvider } from '../src/knowledge-sync-integration'
import { localServiceOperationsProvider } from '../src/local-service-operations-integration'
import { knowledgeScrollFor, rememberKnowledgeScroll } from '../src/domain/knowledge-navigation'
import type { KnowledgeConversationReply } from '../src/domain/knowledge-conversation'
import type { LocalServiceOperationReply } from '../src/domain/local-service-operations'
import { deferred, knowledgeFixture } from './knowledge-read-fixture'
let wrapper:VueWrapper|undefined
beforeEach(()=>{setActivePinia(createPinia());knowledgeAgentPending.value=false;knowledgeSyncPending.value=false})
afterEach(()=>{wrapper?.unmount();wrapper=undefined;knowledgeReadProvider.value=null;knowledgeConversationProvider.value=null;knowledgeAgentProvider.value=null;localServiceOperationsProvider.value=null;knowledgeSyncProvider.value=null})
async function routerFixture(){
 const Page=defineComponent({setup(){useKnowledgePageLifecycle();return()=>h('div','knowledge')}})
 const Other=defineComponent({render:()=>h('div','other')})
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/knowledge',component:Page},{path:'/knowledge/qa',component:Page},{path:'/knowledge/manage',component:Page},{path:'/outside',component:Other}]})
 await router.push('/knowledge');await router.isReady()
 const Shell=defineComponent({template:'<RouterView v-slot="{Component,route}"><KeepAlive><component :is="Component" :key="route.path"/></KeepAlive></RouterView>'})
 wrapper=mount(Shell,{global:{plugins:[createPinia(),router]}});await flushPromises()
 const read=useKnowledgeReadStore();const p=knowledgeFixture();knowledgeReadProvider.value=p;await read.connect(p)
 return {router,read,p}
}
describe('knowledge subpage session lifecycle',()=>{
 it('retains completed reads, selected name and conditions across all three pages without reconnecting',async()=>{
  const {router,read,p}=await routerFixture();read.selectKnowledgeBase('kb1','Chosen library');read.query='saved query';read.documentKeyword='saved filter';await read.run('search');const completed=read.result
  rememberKnowledgeScroll({path:'/knowledge'},{left:0,top:380})
  for(const path of ['/knowledge/qa','/knowledge/manage','/knowledge']){await router.push(path);await flushPromises();expect(read.result).toBe(completed);expect(read.kbId).toBe('kb1');expect(read.query).toBe('saved query');expect(read.documentKeyword).toBe('saved filter');expect(read.selectedBaseLabel).toBe('Chosen library')}
  expect(p.status).toHaveBeenCalledOnce();expect(p.loadServiceStates).toHaveBeenCalledOnce();expect(p.search).toHaveBeenCalledOnce();expect(knowledgeScrollFor({path:'/knowledge'})?.top).toBe(380)
  read.query='changed';expect(read.result).toBeNull();expect(knowledgeScrollFor({path:'/knowledge'})).toBeUndefined()
 })
 it('cancels an in-flight read on child navigation and cannot adopt its late response or replay on return',async()=>{
  const {router,read,p}=await routerFixture(),late=deferred<Awaited<ReturnType<typeof p.search>>>()
  read.query='old';vi.mocked(p.search).mockReturnValueOnce(late.promise);const request=read.run('search');const signal=vi.mocked(p.search).mock.calls[0]![1]!
  await router.push('/knowledge/manage');await flushPromises();expect(signal.aborted).toBe(true);late.resolve({results:[{id:'late',title:'late',content:'late'}],count:1});await request
  await router.push('/knowledge');await flushPromises();expect(read.result).toBeNull();expect(p.search).toHaveBeenCalledOnce()
 })
 it('clears completed cached content on source replacement while another child page is active',async()=>{
  const {router,read}=await routerFixture();read.selectKnowledgeBase('kb1','Old library');read.query='old';await read.run('search');await router.push('/knowledge/qa');await flushPromises()
  knowledgeReadProvider.value=knowledgeFixture();expect(read.provider).toBeNull();expect(read.result).toBeNull();expect(read.query).toBe('');expect(read.kbId).toBe('')
  await router.push('/knowledge');await flushPromises();expect(read.result).toBeNull()
 })
 it('invalidates completed reads when the same route switches to the independent model page',async()=>{
  const {router,read}=await routerFixture();read.query='old';await read.run('search');expect(read.result).not.toBeNull()
  await router.push('/knowledge?tab=models');await flushPromises();expect(read.result).toBeNull();expect(read.invalidated).toBe(true)
 })
 it('invalidates only results targeting a changed default knowledge base, not an unchanged or explicit selection',async()=>{
  const {read,p}=await routerFixture();read.query='default search';await read.run('search');const first=read.result,initial=read.status!
  await read.refreshStatus();expect(read.result).toBe(first)
  rememberKnowledgeScroll({path:'/knowledge'},{left:0,top:300});vi.mocked(p.status).mockResolvedValueOnce({...initial,retrieval:{...initial.retrieval,kbId:'new-default'}})
  await read.refreshStatus();expect(read.result).toBeNull();expect(read.invalidated).toBe(true);expect(knowledgeScrollFor({path:'/knowledge'})).toBeUndefined()
  read.selectKnowledgeBase('explicit','Chosen');await read.run('search');const explicit=read.result;vi.mocked(p.status).mockResolvedValueOnce({...initial,retrieval:{...initial.retrieval,kbId:'another-default'}})
  await read.refreshStatus();expect(read.result).toBe(explicit)
 })
 it.each([false,true])('remembers the confirmed default across cancelled status reads; changed=%s',async changed=>{
  const {router,read,p}=await routerFixture();read.query='saved';await read.run('search');const result=read.result,initial=read.status!,pending=deferred<Awaited<ReturnType<typeof p.status>>>()
  vi.mocked(p.status).mockReturnValueOnce(pending.promise);const reading=read.refreshStatus();await router.push('/knowledge/qa');await flushPromises();expect(read.result).toBe(result)
  pending.resolve({...initial,retrieval:{...initial.retrieval,kbId:'discarded-late-default'}});await reading
  vi.mocked(p.status).mockResolvedValueOnce({...initial,retrieval:{...initial.retrieval,kbId:changed?'new-default':initial.retrieval.kbId}});await read.refreshStatus();expect(read.result).toBe(changed?null:result)
 })
 it('clears all child scroll memories when leaving the knowledge family',async()=>{
  const {router}=await routerFixture();for(const path of ['/knowledge','/knowledge/qa','/knowledge/manage'])rememberKnowledgeScroll({path},{left:0,top:250})
  await router.push('/outside');await flushPromises();for(const path of ['/knowledge','/knowledge/qa','/knowledge/manage'])expect(knowledgeScrollFor({path})).toBeUndefined()
 })
 it('keeps Agent catalog reads separate from the completed search result and drops cancelled catalog replies',async()=>{
  const {read,p}=await routerFixture();read.query='saved';await read.run('search');const completed=read.result
  vi.mocked(p.listAgents).mockResolvedValueOnce({items:[{id:'a1',name:'One'}]});await read.loadAgentCatalog();expect(read.agentCatalog?.[0]?.id).toBe('a1');expect(read.result).toBe(completed)
  const late=deferred<Awaited<ReturnType<typeof p.listAgents>>>();vi.mocked(p.listAgents).mockReturnValueOnce(late.promise);const pending=read.loadAgentCatalog();read.cancelReads();late.resolve({items:[{id:'late'}]});await pending;expect(read.agentCatalog).toBeNull();expect(read.agentCatalogLoading).toBe(false);expect(read.result).toBe(completed)
 })
 it('keeps a completed KB conversation and draft during QA mode switches, but selected KB changes detach the old session',async()=>{
  const pinia=createPinia();setActivePinia(pinia);const p=knowledgeFixture();knowledgeReadProvider.value=p;const read=useKnowledgeReadStore();await read.connect(p);read.selectKnowledgeBase('kb1','One')
  knowledgeConversationProvider.value={label:'OFFLINE QA',chat:vi.fn(async()=>({schemaVersion:'companion-knowledge-v1' as const,sessionId:'s1',answer:'one',references:[]})),waitForIdle:async()=>{}}
  const mode=ref(true),Shell=defineComponent({setup:()=>()=>h(KnowledgeConversationPanel,{active:mode.value})});wrapper=mount(Shell,{global:{plugins:[pinia,ElementPlus]}})
  // Use the mounted Pinia instance, as the panel does.
  const chat=useKnowledgeConversationStore();chat.query='first';await chat.send(chat.prepareSend(),true);chat.query='local draft';const prepared=chat.prepareSend();expect(chat.activeSessionId).toBe('s1')
  mode.value=false;await flushPromises();expect(chat.prepared).toBeNull();expect(chat.activeSessionId).toBe('s1');expect(chat.query).toBe('local draft');expect(await chat.send(prepared,true)).toBe(false)
  mode.value=true;await flushPromises();read.selectKnowledgeBase('kb2','Two');expect(chat.activeSessionId).toBeNull();expect(chat.turns[0]?.detached).toBe(true);expect(chat.query).toBe('local draft')
 })
 it('suspending a pending QA request preserves UNKNOWN and its transport lock after resuming context',async()=>{
  const chat=useKnowledgeConversationStore(),late=deferred<KnowledgeConversationReply>(),idle=deferred<void>(),provider={label:'OFFLINE',chat:vi.fn(()=>late.promise),waitForIdle:()=>idle.promise},context={provider,readIdentity:{},kbId:'kb1',scopeKey:'qa',ready:true}
  chat.syncContext(context);chat.query='question';const sending=chat.send(chat.prepareSend(),true);chat.suspend();chat.syncContext({...context,ready:false});chat.syncContext(context)
  expect(chat.requiresNewConversation).toBe(true);expect(chat.transportPending).toBe(true);expect(chat.prepareSend()).toBeNull();late.resolve({schemaVersion:'companion-knowledge-v1',sessionId:'late',answer:'late',references:[]});idle.resolve();await sending
  expect(chat.turns[0]?.status).toBe('unknown');expect(chat.activeSessionId).toBeNull();expect(provider.chat).toHaveBeenCalledOnce()
 })
 it('suspending Agent preparation preserves its completed session and prevents the old confirmation from dispatching',async()=>{
  const agent=useKnowledgeAgentStore(),provider={label:'OFFLINE AGENT',ask:vi.fn(async()=>({schemaVersion:'companion-knowledge-v1' as const,agentId:'a1',sessionId:'a-session',answer:'done',references:[]})),waitForIdle:async()=>{}},context={provider,readIdentity:{},agentId:'a1',scopeKey:'qa:kb1',ready:true}
  agent.syncContext(context);agent.query='first';await agent.send(agent.prepareSend(),true);agent.query='draft';const prepared=agent.prepareSend();agent.suspend();agent.syncContext({...context,ready:false});agent.syncContext(context)
  expect(agent.activeSessionId).toBe('a-session');expect(agent.query).toBe('draft');expect(await agent.send(prepared,true)).toBe(false);expect(provider.ask).toHaveBeenCalledOnce()
 })
 it('a shared KB selection change isolates the Agent session without adding a KB field to its original request',async()=>{
  const pinia=createPinia();setActivePinia(pinia);const p=knowledgeFixture();knowledgeReadProvider.value=p;vi.mocked(p.listAgents).mockResolvedValue({items:[{id:'a1',name:'One'}]})
  const read=useKnowledgeReadStore();await read.connect(p);read.selectKnowledgeBase('kb1','One');await read.loadAgentCatalog()
  const ask=vi.fn(async(_input:unknown)=>({schemaVersion:'companion-knowledge-v1' as const,agentId:'a1',sessionId:'as1',answer:'one',references:[]}));knowledgeAgentProvider.value={label:'OFFLINE',ask,waitForIdle:async()=>{}}
  wrapper=mount(KnowledgeAgentPanel,{global:{plugins:[pinia,ElementPlus]}});const agent=useKnowledgeAgentStore();agent.query='question';await agent.send(agent.prepareSend(),true);expect(agent.activeSessionId).toBe('as1')
  read.selectKnowledgeBase('kb2','Two');expect(agent.activeSessionId).toBeNull();expect(agent.query).toBe('question');expect(agent.turns[0]?.detached).toBe(true);expect(ask.mock.calls[0]?.[0]).toEqual({query:'question',agentId:'a1'})
 })
 it('a shared Agent catalog refresh disables stale Agent sends until the catalog settles',async()=>{
  const pinia=createPinia();setActivePinia(pinia);const p=knowledgeFixture();knowledgeReadProvider.value=p;vi.mocked(p.listAgents).mockResolvedValue({items:[{id:'a1',name:'One'}]})
  const read=useKnowledgeReadStore();await read.connect(p);await read.loadAgentCatalog();knowledgeAgentProvider.value={label:'OFFLINE',ask:vi.fn(),waitForIdle:async()=>{}}
  wrapper=mount(KnowledgeAgentPanel,{global:{plugins:[pinia,ElementPlus]}});const agent=useKnowledgeAgentStore();agent.query='question';expect(agent.canPrepare).toBe(true)
  const pending=deferred<Awaited<ReturnType<typeof p.listAgents>>>();vi.mocked(p.listAgents).mockReturnValueOnce(pending.promise);const loading=read.loadAgentCatalog();await flushPromises()
  expect(agent.canPrepare).toBe(false);for(const name of ['提问','刷新 Agent'])expect(wrapper.findAll('button').find(button=>button.text()===name)?.attributes('disabled')).toBeDefined()
  pending.resolve({items:[{id:'a1',name:'One'}]});await loading;await flushPromises();expect(agent.canPrepare).toBe(true)
 })
 it('keeps a deactivated sync run UNKNOWN and blocks replay until its original transport settles',async()=>{
  const pinia=createPinia();setActivePinia(pinia);const p=knowledgeFixture(),source={id:'repo-a',label:'Repo',channel:'local' as const,approved:true,enabled:true,writerReady:true,targetSha:'a'.repeat(40),completedSha:'b'.repeat(40)}
  knowledgeReadProvider.value=p;const read=useKnowledgeReadStore();await read.connect(p);read.status={...read.status!,sync:{available:true,writerEnabled:true,schedulerEnabled:false,sources:[source]}}
  const late=deferred<KnowledgeSyncReply>(),idle=deferred<void>(),provider={label:'OFFLINE SYNC',sync:vi.fn(()=>late.promise),waitForIdle:()=>idle.promise};knowledgeSyncProvider.value=provider
  const show=ref(true),Away=defineComponent({render:()=>h('div','away')}),Shell=defineComponent({setup:()=>()=>h(KeepAlive,{},()=>show.value?h(KnowledgeSyncPanel,{key:'sync'}):h(Away,{key:'away'}))});wrapper=mount(Shell,{global:{plugins:[pinia,ElementPlus]}})
  await wrapper.findAll('button').find(button=>button.text()==='执行同步')!.trigger('click');await flushPromises();show.value=false;await flushPromises()
  expect(knowledgeSyncPending.value).toBe(true);expect(hasUnknownKnowledgeSync(provider,JSON.stringify([source.id,source.channel]))).toBe(true)
  late.resolve({plan:{sourceId:source.id,channel:'local',jobId:'late',jobState:'queued',targetSHA:source.targetSha,queuedOnly:true,writePerformed:false}});idle.resolve();await flushPromises();show.value=true;await flushPromises()
  expect(knowledgeSyncPending.value).toBe(false);expect(wrapper.findAll('button').find(button=>button.text()==='执行同步')?.attributes('disabled')).toBeDefined();expect(provider.sync).toHaveBeenCalledOnce()
 })
 it('retains the knowledge iframe for a management URL carrying the old models query',async()=>{
  const pinia=createPinia(),p=knowledgeFixture();knowledgeReadProvider.value=p;vi.mocked(p.loadServiceStates).mockResolvedValue({knowledge:{running:true,frameable:true},warnings:[]})
  localServiceOperationsProvider.value={label:'OFFLINE',run:vi.fn(),waitForIdle:async()=>{}}
  const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{template:'<div/>'}}]});await router.push('/knowledge/manage?tab=models');await router.isReady()
  wrapper=mount(LocalServiceControls,{props:{knowledgeOnly:true},global:{plugins:[pinia,router,ElementPlus]}});const store=useLocalServiceOperationsStore(pinia);await store.refresh();await flushPromises()
  expect(wrapper.get('iframe').attributes('src')).toBe('http://127.0.0.1:8081/');expect(wrapper.find('iframe[src="http://127.0.0.1:8090/"]').exists()).toBe(false)
 })
 it('a cached knowledge control cannot take or clear the active model control context',async()=>{
  const readProvider=knowledgeFixture();knowledgeReadProvider.value=readProvider
  localServiceOperationsProvider.value={label:'OFFLINE SERVICES',run:vi.fn(async(input):Promise<LocalServiceOperationReply>=>input.action==='start'?input.service==='model'?{service:'model',action:'start',state:{running:true}}:{service:'knowledge',action:'start',state:{running:true,frameable:false}}:input.service==='model'?{service:'model',action:'stop',state:{running:false}}:{service:'knowledge',action:'stop',state:{running:false,frameable:false}}),waitForIdle:async()=>{}}
  const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/:pathMatch(.*)*',component:{template:'<div/>'}}]});await router.push('/knowledge/manage');await router.isReady()
  const show=ref(true),showModel=ref(false),Away=defineComponent({render:()=>h('div','away')}),Shell=defineComponent({setup:()=>()=>h('div',[h(KeepAlive,{},()=>show.value?h(LocalServiceControls,{knowledgeOnly:true,key:'knowledge'}):h(Away,{key:'away'})),showModel.value?h(LocalServiceControls,{modelsOnly:true}):null])})
  wrapper=mount(Shell,{global:{plugins:[pinia,router,ElementPlus]}});await flushPromises();const store=useLocalServiceOperationsStore(pinia);await store.refresh();show.value=false;await flushPromises();showModel.value=true;await flushPromises();expect(store.states?.model).toBeDefined();expect(store.states?.knowledge).toBeUndefined()
  await router.push('/knowledge?tab=models');await flushPromises();expect(store.states?.model).toBeDefined();expect(store.states?.knowledge).toBeUndefined();expect(vi.mocked(readProvider.loadServiceStates).mock.calls.at(-1)?.[1]).toBe('model')
 })
})
