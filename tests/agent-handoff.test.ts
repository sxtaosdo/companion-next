import { afterEach,describe,it,expect,vi } from 'vitest'
import { mount,flushPromises,type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter,createMemoryHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import AgentHandoffButtons from '../src/components/AgentHandoffButtons.vue'
import CliUseDialog from '../src/components/CliUseDialog.vue'
import SetupCompletionUsage from '../src/components/SetupCompletionUsage.vue'
import HelpView from '../src/views/HelpView.vue'
import { agentHandoffUrl } from '../src/domain/agent-handoff'
import { agentHandoffProvider,agentHandoffBusy } from '../src/agent-handoff-integration'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
const text='检查 Canvas/按钮\n"测试" & ? # + % 🔎',wrappers:VueWrapper[]=[]
const api=()=>({writeText:vi.fn(async(_text:string)=>{}),open:vi.fn((_url:string)=>{})})
function controls(props={text,contextKey:'source-1',disabled:false}){const w=mount(AgentHandoffButtons,{props});wrappers.push(w);return w}
function button(w:VueWrapper,label:string){return w.findAll('button').find(b=>b.text()===label)!}
afterEach(()=>{for(const w of wrappers.splice(0))w.unmount();agentHandoffProvider.value=null;agentHandoffBusy.value=false;document.body.innerHTML='';vi.restoreAllMocks()})
describe('old fixed local editor protocols',()=>{
 it.each(['cursor','codex'] as const)('preserves complete text and escaping for %s',agent=>{const result=agentHandoffUrl(agent,text),url=new URL(result.url);expect(url.protocol).toBe(agent+':');expect(url.searchParams.get(agent==='cursor'?'text':'prompt')).toBe(text);expect(result.clipboardOnly).toBe(false)})
 it('uses the exact 8000 character boundary without clipping clipboard text',()=>{expect(agentHandoffUrl('codex','a'.repeat(7981)).clipboardOnly).toBe(false);expect(agentHandoffUrl('codex','a'.repeat(7982)).clipboardOnly).toBe(true);const result=agentHandoffUrl('cursor',text.repeat(2000));expect(result.url.length).toBeLessThanOrEqual(8000);expect(new URL(result.url).searchParams.get('text')).toContain('粘贴剪贴板中的完整文本')})
 it('rejects unknown agents and blank text',()=>{expect(()=>agentHandoffUrl('http' as 'cursor','x')).toThrow();expect(()=>agentHandoffUrl('codex','  ')).toThrow()})
})
describe('explicit text handoff lifecycle',()=>{
 it('does not expose capabilities or open anything without a registered workspace provider',()=>{const w=controls();expect(w.findAll('button')).toHaveLength(0)})
 it.each(['Cursor','Codex'])('copies full text before a single explicit %s launch',async name=>{const p=api();agentHandoffProvider.value=p;const w=controls();expect(p.writeText).not.toHaveBeenCalled();expect(p.open).not.toHaveBeenCalled();await button(w,'发送到 '+name).trigger('click');await flushPromises();expect(p.writeText).toHaveBeenCalledExactlyOnceWith(text);expect(p.open).toHaveBeenCalledTimes(1);expect(p.writeText.mock.invocationCallOrder[0]).toBeLessThan(p.open.mock.invocationCallOrder[0]!);expect(new URL(p.open.mock.calls[0]![0]).protocol).toBe(name.toLowerCase()+':');expect(w.text()).toContain('已尝试打开')})
 it('keeps complete long content on clipboard while sending only paste instructions',async()=>{const p=api();agentHandoffProvider.value=p;const long=text.repeat(2000),w=controls({text:long,contextKey:'long',disabled:false});await button(w,'发送到 Codex').trigger('click');await flushPromises();expect(p.writeText).toHaveBeenCalledWith(long);expect(p.open.mock.calls[0]![0].length).toBeLessThanOrEqual(8000);expect(w.text()).toContain('请粘贴后确认使用')})
 it('does not open when clipboard permission fails and does not expose failure details',async()=>{const p=api();p.writeText.mockRejectedValue(Error('private reason'));agentHandoffProvider.value=p;const w=controls();await button(w,'发送到 Cursor').trigger('click');await flushPromises();expect(p.open).not.toHaveBeenCalled();expect(w.text()).toContain('尚未打开');expect(w.text()).not.toContain('private reason')})
 it('offers the copied text when the OS refuses navigation',async()=>{const p=api();p.open.mockImplementation(()=>{throw Error('private launch reason')});agentHandoffProvider.value=p;const w=controls();await button(w,'发送到 Codex').trigger('click');await flushPromises();expect(w.text()).toContain('请手动打开应用并粘贴');expect(w.text()).not.toContain('private launch reason')})
 it.each(['context','text','disabled','provider','unmount'])('does not launch a delayed clipboard receipt after %s changes',async change=>{let finish!:()=>void;const p=api();p.writeText.mockImplementation(()=>new Promise<void>(r=>{finish=r}));agentHandoffProvider.value=p;const w=controls();await button(w,'发送到 Codex').trigger('click');expect(agentHandoffBusy.value).toBe(true);if(change==='context')await w.setProps({contextKey:'new'});else if(change==='text')await w.setProps({text:'new'});else if(change==='disabled')await w.setProps({disabled:true});else if(change==='provider')agentHandoffProvider.value=api();else w.unmount();finish();await flushPromises();expect(p.open).not.toHaveBeenCalled();expect(agentHandoffBusy.value).toBe(false)})
 it('serializes different blocks while clipboard completion is pending',async()=>{let finish!:()=>void;const p=api();p.writeText.mockImplementation(()=>new Promise<void>(r=>{finish=r}));agentHandoffProvider.value=p;const first=controls(),second=controls({text:'other',contextKey:'two',disabled:false});await button(first,'发送到 Cursor').trigger('click');await button(second,'发送到 Codex').trigger('click');expect(p.writeText).toHaveBeenCalledTimes(1);expect(second.findAll('button').every(b=>b.attributes('disabled')!==undefined)).toBe(true);finish();await flushPromises();expect(p.open).toHaveBeenCalledTimes(1)})
})
describe('old copy-block entry points',()=>{
 it('passes the complete help code block without fetching or automatic launch',async()=>{const p=api();agentHandoffProvider.value=p;const router=createRouter({history:createMemoryHistory(),routes:[{path:'/help',component:HelpView}]});await router.push('/help?topic=cli');const w=mount(HelpView,{global:{plugins:[createPinia(),router,ElementPlus]}});wrappers.push(w);await flushPromises();const block=w.find('.help-code-block');expect(block.exists()).toBe(true);const source=block.get('pre').text();expect(p.open).not.toHaveBeenCalled();await block.findAll('button').find(b=>b.text()==='发送到 Cursor')!.trigger('click');await flushPromises();expect(p.writeText).toHaveBeenCalledWith(source)})
 it('cancels a pending project CLI handoff when its dialog closes',async()=>{let finish!:()=>void;const p=api();p.writeText.mockImplementation(()=>new Promise<void>(r=>{finish=r}));agentHandoffProvider.value=p;const source={label:'fixture'} as CompanionBrowserProvider,w=mount(CliUseDialog,{props:{modelValue:true,project:{id:'0123456789abcdef',name:'Fixture',path:'D:\\Fixture'},source},global:{plugins:[ElementPlus]}});wrappers.push(w);await flushPromises();await w.findAll('button').find(b=>b.text()==='发送到 Codex')!.trigger('click');expect(p.writeText.mock.calls[0]![0]).toContain('0123456789abcdef');await w.setProps({modelValue:false});finish();await flushPromises();expect(p.open).not.toHaveBeenCalled()})
 it('uses the exact completed setup prompt and never submits installation',async()=>{const p=api();agentHandoffProvider.value=p;const w=mount(SetupCompletionUsage,{props:{usage:{project:{id:'0123456789abcdef',name:'Fixture',path:'D:\\Fixture'},prompt:text}},global:{plugins:[ElementPlus]}});wrappers.push(w);await button(w,'发送到 Codex').trigger('click');await flushPromises();expect(p.writeText).toHaveBeenCalledExactlyOnceWith(text)})
})


describe('original clipboard writes share the handoff lease',()=>{
 it.each(['help','cli','setup'])('blocks another handoff after a pending %s copy closes',async mode=>{
  let finish!:()=>void;Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn(()=>new Promise<void>(r=>{finish=r}))}});const p=api();agentHandoffProvider.value=p;let w:VueWrapper,label:string
  if(mode==='help'){const router=createRouter({history:createMemoryHistory(),routes:[{path:'/help',component:HelpView}]});await router.push('/help?topic=cli');w=mount(HelpView,{global:{plugins:[createPinia(),router,ElementPlus]}});label='复制原文'}
  else if(mode==='cli'){w=mount(CliUseDialog,{props:{modelValue:true,project:{id:'0123456789abcdef',name:'Fixture',path:'D:\\Fixture'},source:{label:'fixture'} as CompanionBrowserProvider},global:{plugins:[ElementPlus]}});label='复制完整文本'}
  else{w=mount(SetupCompletionUsage,{props:{usage:{project:{id:'0123456789abcdef',name:'Fixture',path:'D:\\Fixture'},prompt:text}},global:{plugins:[ElementPlus]}});label='复制提示词'}
  wrappers.push(w);await flushPromises();await button(w,label).trigger('click');w.unmount();const next=controls();await button(next,'发送到 Codex').trigger('click');expect(p.writeText).not.toHaveBeenCalled();expect(agentHandoffBusy.value).toBe(true);finish();await flushPromises();expect(agentHandoffBusy.value).toBe(false);Reflect.deleteProperty(navigator,'clipboard')
 })
})
