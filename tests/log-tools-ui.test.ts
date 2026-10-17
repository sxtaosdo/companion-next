import { afterEach,describe,it,expect,vi } from 'vitest'
import { createPinia } from 'pinia'
import { mount,flushPromises,type VueWrapper,DOMWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import LogTools from '../src/components/LogTools.vue'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useLogToolsStore } from '../src/stores/log-tools'
import { useProjectOperationLaneStore } from '../src/stores/project-operation-lane'
import { logToolsProvider } from '../src/log-tools-integration'
import { createLogToolsProvider } from '../src/adapters/log-tools'
import { LogToolError,type LogToolsProvider } from '../src/domain/log-tools'
const id='0123456789abcdef',other='fedcba9876543210'
let wrapper:VueWrapper|undefined
const json=(v:unknown)=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}})
async function setup(api:LogToolsProvider){const pinia=createPinia(),browser=useCompanionBrowserStore(pinia);logToolsProvider.value=api;await browser.connect({label:'isolated reader',loadProjects:async()=>({projects:[{id,name:'First',path:'/first'},{id:other,name:'Second',path:'/second'}],statuses:[],dashboard:[],warnings:[]}),loadCounts:async()=>({sessionId:'s',counts:{},latest:{}}),loadLogs:async()=>[],loadCalls:async()=>({sessionId:'s',total:0,retained:0,records:[]})});wrapper=mount(LogTools,{attachTo:document.body,global:{plugins:[pinia,ElementPlus]}});await flushPromises();return {browser,tools:useLogToolsStore(pinia),lane:useProjectOperationLaneStore(pinia)}}
function button(text:string){return new DOMWrapper(document.body).findAll('button').find(b=>b.text()===text)!}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;logToolsProvider.value=null;document.body.innerHTML='';vi.restoreAllMocks()})
describe('approved log tool confirmation and source boundaries',()=>{
 it('does not delete before confirmation; scope ignores message filters and clears only selected projects',async()=>{
  const fetch=vi.fn(async()=>json({cleared:2}));const {browser}=await setup(createLogToolsProvider({fetch}));browser.logFilter={projectIds:[other],sources:['bridge'],levels:['error'],search:'only visible'}
  await button('清除日志').trigger('click');await flushPromises();expect(document.body.textContent).toContain('Second');expect(document.body.textContent).toContain('来源、级别和关键字不会限制清除范围');expect(fetch).not.toHaveBeenCalled()
  await button('确认清除').trigger('click');await flushPromises();expect(fetch.mock.calls).toHaveLength(1);expect(wrapper!.emitted('cleared')).toHaveLength(1)
 })
 it('filter change invalidates pending confirmation without deleting',async()=>{const run=vi.fn();const {browser,tools}=await setup({label:'fixture',run,waitForIdle:async()=>{}});await button('清除日志').trigger('click');browser.logFilter.search='new';await flushPromises();expect(tools.prepared).toBeNull();expect(run).not.toHaveBeenCalled()})
 it('blocks repeated clear when delivery is unknown and never treats reconnect as proof',async()=>{const run=vi.fn(async()=>{throw new LogToolError('network-error')});const {tools}=await setup({label:'fixture',run,waitForIdle:async()=>{}});await button('清除日志').trigger('click');await button('确认清除').trigger('click');await flushPromises();expect(tools.unknownClear).toBe(true);expect(button('清除日志').attributes('disabled')).toBeDefined();expect(run).toHaveBeenCalledTimes(1)})
 it('defaults diagnostics to first registered project and renders only escaped text',async()=>{const fetch=vi.fn(async()=>json({projectId:id,generatedAt:'2026-10-17T00:00:00Z',status:{projectId:id,state:'stopped'},logs:[{projectId:id,message:'<img onerror="alert(1)"> token=private'}]}));const {tools}=await setup(createLogToolsProvider({fetch}));await button('导出诊断').trigger('click');expect(fetch).not.toHaveBeenCalled();await button('读取诊断').trigger('click');await flushPromises();expect(tools.diagnostic?.projectId).toBe(id);expect(wrapper!.findAll('.log-diagnostic img')).toHaveLength(0);expect(wrapper!.get('.log-diagnostic pre').text()).not.toContain('private');expect(button('保存到本机')).toBeTruthy()})
 it('source switch aborts and rejects delayed diagnostic from the previous source',async()=>{
  let resolve!:(r:Response)=>void;const fetch=vi.fn(()=>new Promise<Response>(r=>{resolve=r}));const {browser,tools,lane}=await setup(createLogToolsProvider({fetch}));await button('导出诊断').trigger('click');await button('读取诊断').trigger('click');await flushPromises();expect(lane.locked).toBe(true);browser.disconnect();await flushPromises();expect(lane.locked).toBe(true);resolve(json({projectId:id,generatedAt:'2026-10-17T00:00:00Z',status:{projectId:id},logs:[]}));await flushPromises();expect(tools.diagnostic).toBeNull();expect(lane.locked).toBe(false)
 })
 it('uses same-Pinia lane so other project actions cannot race with confirmation send',async()=>{const run=vi.fn();const {tools,lane}=await setup({label:'fixture',run,waitForIdle:async()=>{}});expect(tools.prepare({action:'clear',projectIds:[]})).toBe(true);const lease=lane.acquire('existing operation')!;expect(await tools.send()).toBe(false);expect(run).not.toHaveBeenCalled();lane.release(lease)})
})
