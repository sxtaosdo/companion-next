import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { knowledgeAgentPending } from '../src/knowledge-agent-integration'
import { useKnowledgeConversationStore } from '../src/stores/knowledge-conversation'
import KnowledgeSyncPanel from '../src/components/KnowledgeSyncPanel.vue'
import { useKnowledgeReadStore } from '../src/stores/knowledge-read'
import { registerKnowledgeReadProvider,knowledgeReadProvider } from '../src/knowledge-read-integration'
import { registerKnowledgeSyncProvider,knowledgeSyncProvider,knowledgeSyncPending } from '../src/knowledge-sync-integration'
import { createKnowledgeSyncProvider } from '../src/adapters/knowledge-sync'
import type { KnowledgeSyncFetch } from '../src/adapters/knowledge-sync'
import { KNOWLEDGE_SCHEMA } from '../src/domain/knowledge-read'
import { knowledgeFixture,knowledgeStatus,deferred } from './knowledge-read-fixture'
const a={id:'repo-a',label:'Repo A',channel:'local' as const,approved:true,enabled:true,writerReady:true,targetSha:'a'.repeat(40),completedSha:'b'.repeat(40),pending:1,freshness:'stale' as const,jobs:[{id:'old-job',status:'running' as const,sourceCommit:'b'.repeat(40)}]}
const b={...a,id:'repo-b',label:'Repo B',channel:'official' as const,approved:false}
const queued={sourceId:a.id,channel:a.channel,jobId:'new-job',jobState:'queued',targetSHA:'a'.repeat(40),queuedOnly:true,writePerformed:false}
const reply=(plan:unknown)=>new Response(JSON.stringify({schemaVersion:KNOWLEDGE_SCHEMA,plan}),{headers:{'Content-Type':'application/json'}})
let wrapper:VueWrapper|undefined
async function setup(fetch:KnowledgeSyncFetch=async()=>reply(queued),sources=[a,b],writerEnabled=true){const pinia=createPinia(),read=useKnowledgeReadStore(pinia),p=knowledgeFixture();vi.mocked(p.status).mockResolvedValue({...knowledgeStatus,cli:{available:false,compatible:false},retrieval:{...knowledgeStatus.retrieval,auth:'missing'},sync:{available:true,schedulerEnabled:false,writerEnabled,sources}});registerKnowledgeReadProvider(p);registerKnowledgeSyncProvider(createKnowledgeSyncProvider({fetch}));wrapper=mount(KnowledgeSyncPanel,{global:{plugins:[pinia,ElementPlus]}});return {pinia,read,p,connect:async()=>{await read.connect(p);await flushPromises()}}}
function button(label:string){return wrapper!.findAll('button').find(b=>b.text()===label)!}
const select=(s:typeof a|typeof b)=>wrapper!.find('select').setValue(JSON.stringify([s.id,s.channel]))
afterEach(()=>{wrapper?.unmount();wrapper=undefined;knowledgeReadProvider.value=null;knowledgeSyncProvider.value=null;knowledgeSyncPending.value=false;vi.restoreAllMocks()})
describe('original collapsed sync controls',()=>{
 it('is collapsed and inert on mount; connecting loads only status',async()=>{const fetch=vi.fn<KnowledgeSyncFetch>(async()=>reply(queued)),{p,connect}=await setup(fetch);expect(wrapper!.find('details').attributes('open')).toBeUndefined();expect(fetch).not.toHaveBeenCalled();expect(p.status).not.toHaveBeenCalled();await connect();expect(fetch).not.toHaveBeenCalled();expect(wrapper!.text()).toContain('old-job');expect(wrapper!.text()).toContain('running');expect(wrapper!.text()).toContain('目标 SHA');expect(button('执行同步').attributes('disabled')).toBeUndefined()})
 it('uses source/channel and this sources flags, never retrieval auth or another approved source',async()=>{const fetch=vi.fn<KnowledgeSyncFetch>(async()=>reply({summary:{added:1}})),{connect}=await setup(fetch);await connect();await select(b);expect(button('执行同步').attributes('disabled')).toBeDefined();expect(button('同步演练').attributes('disabled')).toBeUndefined();await button('同步演练').trigger('click');await flushPromises();expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual({sourceId:b.id,channel:'official'});expect(wrapper!.text()).toContain('同步演练完成，尚未写入知识库')})
 it.each(['approved','enabled','writerReady']as const)('missing %s remains unknown and denies execution',async key=>{const s={...a};delete s[key];const {connect}=await setup(undefined,[s]);await connect();expect(button('执行同步').attributes('disabled')).toBeDefined();expect(wrapper!.text()).toContain('未知');expect(button('同步演练').attributes('disabled')).toBeUndefined()})
 it('global writer false disables run but leaves independent dryrun',async()=>{const {connect}=await setup(undefined,[a],false);await connect();expect(button('执行同步').attributes('disabled')).toBeDefined();expect(button('同步演练').attributes('disabled')).toBeUndefined()})
 it('shows queued receipt and keeps ledger as last snapshot until explicit refresh',async()=>{const fetch=vi.fn<KnowledgeSyncFetch>(async()=>reply(queued)),{connect,p}=await setup(fetch);await connect();await button('执行同步').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('同步任务已持久化排队');expect(wrapper!.text()).toContain('尚未证明写入完成');expect(wrapper!.text()).toContain('new-job');expect(p.status).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledTimes(1)})
 it('shows precise policy rejection without arbitrary diagnostics',async()=>{const {connect}=await setup(async()=>new Response(JSON.stringify({code:'POLICY_DENIED',reason:'scope_changed',error:'private diagnostic'}),{status:403,headers:{'Content-Type':'application/json'}}));await connect();await button('执行同步').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('来源范围已变化');expect(wrapper!.text()).not.toContain('private diagnostic')})
 it('bad run receipt is UNKNOWN and cannot be retried by switching away and back',async()=>{const fetch=vi.fn<KnowledgeSyncFetch>(async()=>reply({...queued,sourceId:'other'})),{connect}=await setup(fetch);await connect();await button('执行同步').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('UNKNOWN');expect(button('执行同步').attributes('disabled')).toBeDefined();await select(b);await select(a);expect(button('执行同步').attributes('disabled')).toBeDefined();expect(fetch).toHaveBeenCalledTimes(1)})
 it('stopping only aborts waiting; old underlying lease blocks new requests until settle',async()=>{const d=deferred<Response>(),fetch=vi.fn<KnowledgeSyncFetch>(()=>d.promise),{connect}=await setup(fetch);await connect();await button('执行同步').trigger('click');await button('停止等待').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('UNKNOWN');expect(knowledgeSyncPending.value).toBe(true);expect(button('同步演练').attributes('disabled')).toBeDefined();d.resolve(reply(queued));await flushPromises();expect(knowledgeSyncPending.value).toBe(false);expect(wrapper!.text()).not.toContain('同步任务已持久化排队');expect(fetch).toHaveBeenCalledTimes(1)})
 it('disconnect detaches old source and ignores late success',async()=>{const d=deferred<Response>(),fetch=vi.fn<KnowledgeSyncFetch>(()=>d.promise),{connect,read}=await setup(fetch);await connect();await button('执行同步').trigger('click');read.disconnect();await flushPromises();d.resolve(reply(queued));await flushPromises();expect(wrapper!.text()).toContain('原来源记录');expect(wrapper!.text()).not.toContain('同步任务已持久化排队');expect(wrapper!.text()).not.toContain('new-job');expect(fetch).toHaveBeenCalledTimes(1)})
 it('retains UNKNOWN barrier when the panel unmounts and remounts in the same session',async()=>{const fetch=vi.fn<KnowledgeSyncFetch>(async()=>reply({...queued,sourceId:'other'})),{pinia,connect}=await setup(fetch);await connect();await button('执行同步').trigger('click');await flushPromises();wrapper!.unmount();wrapper=mount(KnowledgeSyncPanel,{global:{plugins:[pinia,ElementPlus]}});await flushPromises();expect(wrapper!.text()).toContain('此来源存在未确认');expect(button('执行同步').attributes('disabled')).toBeDefined();expect(fetch).toHaveBeenCalledTimes(1)})
 it('blocks prepared chat send and new prepare while sync owns transport',async()=>{const d=deferred<Response>(),{pinia,connect,p}=await setup(()=>d.promise);await connect();const chat=useKnowledgeConversationStore(pinia),chatProvider={label:'OFFLINE',chat:vi.fn(async()=>({schemaVersion:KNOWLEDGE_SCHEMA,sessionId:'session1',answer:'answer',references:[]})),waitForIdle:async()=>{}};chat.syncContext({provider:chatProvider,readIdentity:p,kbId:'default',scopeKey:'test',ready:true});chat.query='question';const prepared=chat.prepareSend();expect(prepared).not.toBeNull();await button('执行同步').trigger('click');expect(chat.canPrepare).toBe(false);expect(await chat.send(prepared,true)).toBe(false);expect(chat.prepareSend()).toBeNull();expect(chatProvider.chat).not.toHaveBeenCalled();d.resolve(reply(queued));await flushPromises()})
 it('provider replacement and source-status drift discard old plan and current success message',async()=>{const {connect,read}=await setup();await connect();await button('执行同步').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('同步任务已持久化排队');read.status={...read.status!,sync:{...read.status!.sync,writerEnabled:false}};await flushPromises();expect(wrapper!.text()).not.toContain('同步任务已持久化排队');expect(wrapper!.text()).toContain('原来源记录');expect(button('执行同步').attributes('disabled')).toBeDefined()})
})


describe('Agent and sync shared pending lane',()=>{
 it('blocks both sync actions during an Agent request and never replays them on release',async()=>{
  const fetch=vi.fn<KnowledgeSyncFetch>(async()=>reply(queued)),{connect}=await setup(fetch)
  try{
   await connect();knowledgeAgentPending.value=true;await flushPromises()
   expect(button('同步演练').attributes('disabled')).toBeDefined()
   expect(button('执行同步').attributes('disabled')).toBeDefined()
   expect(wrapper!.get('select').attributes('disabled')).toBeDefined()
   await button('同步演练').trigger('click');await button('执行同步').trigger('click')
   expect(fetch).not.toHaveBeenCalled()
   knowledgeAgentPending.value=false;await flushPromises()
   expect(button('同步演练').attributes('disabled')).toBeUndefined()
   expect(button('执行同步').attributes('disabled')).toBeUndefined()
   expect(fetch).not.toHaveBeenCalled()
   await button('同步演练').trigger('click');await flushPromises()
   expect(fetch).toHaveBeenCalledTimes(1)
   expect(fetch.mock.calls[0]![0]).toBe('/api/knowledge/sync/dry-run')
   expect(JSON.parse(fetch.mock.calls[0]![1].body as string)).toEqual({sourceId:a.id,channel:a.channel})
  }finally{knowledgeAgentPending.value=false}
 })
})
