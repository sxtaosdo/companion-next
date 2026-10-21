import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import ArtStatusBar from '../src/components/ArtStatusBar.vue'
import { useRegisteredProjectStore } from '../src/stores/registered-project'
import { useCreatorOperationsStore } from '../src/stores/creator-operations'
import { CreatorOperationError } from '../src/domain/creator-operations'
import { creatorOperationsProvider } from '../src/creator-operations-integration'
import { useAiResourceReadStore } from '../src/stores/ai-resource-read'
import { companionBrowserProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { aiResourceReadProvider } from '../src/ai-resource-read-integration'
import { AiResourceReadError, type AiResourceReadProvider, type AiResourceView } from '../src/domain/ai-resource-read'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import { resourceView } from './fixtures/ai-resource-read'
const id='0123456789abcdef', project={id,name:'Alpha',path:'D:/Alpha'}
let wrapper:VueWrapper|undefined
async function enter(){
 const pinia=createPinia(), selection=useRegisteredProjectStore(pinia), resource=useAiResourceReadStore(pinia)
 const source:CompanionBrowserProvider={label:'isolated registration',runtimeProbesEnabled:true,loadProjects:vi.fn(async()=>({projects:[project],statuses:[{projectId:id,state:'stopped' as const,capabilityProfile:'unknown' as const}],dashboard:[],warnings:[]})),loadCounts:vi.fn(),loadLogs:vi.fn(),loadCalls:vi.fn()}
 const reader:AiResourceReadProvider={label:'isolated resource',readConfig:vi.fn(async()=>resourceView(id)),previewReference:vi.fn()}
 registerCompanionBrowserProvider(source);aiResourceReadProvider.value=reader
 await selection.directory.connect(source);selection.restoreRouteProject(id);resource.setContext(selection.project,selection.currentSource)
 wrapper=mount(ArtStatusBar,{props:{projectPicker:false,showCreator:true},global:{plugins:[pinia,ElementPlus]}});await flushPromises()
 return {selection,resource,source,reader,operations:useCreatorOperationsStore(pinia)}
}
function tag(kind:string){const node=wrapper!.get(`[data-status="${kind}"]`);return node.classes().includes('el-tag')?node:node.get('.el-tag')}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;companionBrowserProvider.value=null;companionProjectEntryProvider.value=null;aiResourceReadProvider.value=null;creatorOperationsProvider.value=null;vi.restoreAllMocks()})
describe('shared compact art status',()=>{
 it('shows the selected real project and independent unobserved resource status without requesting reads',async()=>{
  const {source,reader}=await enter()
  expect(wrapper!.get('.art-current-project strong').text()).toBe('Alpha')
  expect(tag('registration').classes()).toContain('el-tag--success')
  expect(tag('specification').text()).toBe('规范未读取');expect(tag('specification').classes()).toContain('el-tag--info')
  expect(wrapper!.find('[data-status="task"]').exists()).toBe(false)
  expect(source.loadProjects).toHaveBeenCalledTimes(1);expect(reader.readConfig).not.toHaveBeenCalled();expect(reader.previewReference).not.toHaveBeenCalled()
 })
 it('keeps resource reading and adapter-disabled failure separate from connected registrations',async()=>{
  const {reader,resource}=await enter()
  let fail!:(cause:unknown)=>void
  reader.readConfig=vi.fn(()=>new Promise<AiResourceView>((_resolve,reject)=>fail=reject))
  const reading=resource.readConfig(reader);await flushPromises()
  expect(tag('specification').text()).toBe('规范读取中');expect(tag('specification').find('.is-loading').exists()).toBe(true)
  fail(new AiResourceReadError('adapter-disabled','resource-config',503));await reading;await flushPromises()
  expect(tag('registration').classes()).toContain('el-tag--success')
  expect(tag('specification').text()).toBe('规范读取失败');expect(tag('specification').classes()).toContain('el-tag--danger')
  expect(wrapper!.text()).not.toContain('规范未配置')
 })
 it('clears ready-looking specification state when project path or provider no longer matches',async()=>{
  const {resource,reader,selection}=await enter();await resource.readConfig(reader);await flushPromises()
  expect(tag('specification').text()).toBe('规范已读取')
  resource.project={...project,path:'D:/Other'};await flushPromises()
  expect(tag('specification').text()).toBe('规范未读取')
  selection.directory.disconnect();await flushPromises()
  expect(tag('registration').classes()).not.toContain('el-tag--success');expect(tag('specification').classes()).not.toContain('el-tag--success')
 })
 it('accepts only the local jobs panel snapshot bound to the current project and source',async()=>{
  const {source}=await enter()
  const jobs={projectId:id,projectPath:project.path,source,loading:false,error:'',observedAt:'2026-10-21T00:00:00Z',hasRead:true,state:'import_unknown' as const}
  await wrapper!.setProps({jobs});expect(tag('task').text()).toBe('导入结果未知');expect(tag('task').classes()).toContain('el-tag--warning')
  await wrapper!.setProps({jobs:{...jobs,loading:true}});expect(tag('task').text()).toBe('任务读取中');expect(tag('task').find('.is-loading').exists()).toBe(true)
  await wrapper!.setProps({jobs:{...jobs,error:'isolated failure'}});expect(tag('task').text()).toBe('任务读取失败');expect(tag('task').classes()).toContain('el-tag--danger')
  await wrapper!.setProps({jobs:{...jobs,source:{}}});expect(wrapper!.find('[data-status="task"]').exists()).toBe(false)
  await wrapper!.setProps({jobs:{...jobs,projectPath:'D:/Other'}});expect(wrapper!.find('[data-status="task"]').exists()).toBe(false)
 })
 it('never lets an older unknown receipt override a newer observed ready project',async()=>{
  const {selection,operations}=await enter(), directory=selection.directory
  creatorOperationsProvider.value={label:'isolated action',run:vi.fn(async()=>{throw new CreatorOperationError('network-error','unknown')}),waitForIdle:vi.fn(async()=>{})}
  await operations.direct(id,'start');await flushPromises()
  expect(operations.lastReceipt?.phase).toBe('unknown')
  expect(wrapper!.get('.art-creator-state').text()).toContain('结果未知')
  directory.projectSnapshotRevision++;directory.statuses=[{projectId:id,state:'ready',capabilityProfile:'authoring'}];await flushPromises()
  expect(wrapper!.get('.art-creator-state').text()).not.toContain('结果未知')
  expect(wrapper!.get('.art-creator-state').text()).toContain('已就绪')
 })
 it('provides one shared real-project selector and hides Creator outside import context',async()=>{
  const {selection,source}=await enter();await wrapper!.setProps({projectPicker:true,showCreator:false})
  expect(wrapper!.find('input[aria-label="当前登记工程"]').exists()).toBe(true)
  expect(wrapper!.find('.art-creator-state').exists()).toBe(false)
  await wrapper!.setProps({showCreator:true});expect(wrapper!.find('.art-creator-state').exists()).toBe(true)
  selection.directory.disconnect();await flushPromises()
  expect(wrapper!.find('input[aria-label="当前登记工程"]').exists()).toBe(false)
  expect(tag('registration').classes()).not.toContain('el-tag--success')
  expect(source.loadProjects).toHaveBeenCalledTimes(1)
 })
 it('keeps an independent collector status separate from Creator and registration',async()=>{
  await enter();await wrapper!.setProps({showCreator:false,service:{label:'采集器',text:'未确认就绪',tone:'warning'}})
  expect(tag('service').classes()).toContain('el-tag--warning');expect(wrapper!.find('.art-creator-state').exists()).toBe(false)
  await wrapper!.setProps({service:{label:'采集器',text:'已就绪',tone:'success'}})
  expect(tag('service').classes()).toContain('el-tag--success');expect(tag('specification').classes()).toContain('el-tag--info')
 })
 it.each(['missing','invalid'] as const)('shows %s as a specification condition after a successful real-shaped read',async state=>{
  const {resource,reader}=await enter();await resource.readConfig(reader);resource.resource={...resource.resource!,state};await flushPromises()
  expect(tag('specification').classes()).toContain('el-tag--warning')
  expect(tag('specification').text()).toBe(state==='missing'?'规范未配置':'规范待修正')
 })
})
