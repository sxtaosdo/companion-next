import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { markRaw, nextTick, reactive } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ArtProductionFlow from '../src/components/ArtProductionFlow.vue'
import { artProductionStage, canChooseArtStage } from '../src/domain/art-production-flow'
import { useAiResourceReadStore } from '../src/stores/ai-resource-read'
import { aiTaskCreationProvider } from '../src/ai-task-creation-integration'
import { createAiTaskCreationState } from '../src/stores/ai-task-creation'
import type { AiTaskCreationProvider } from '../src/domain/ai-task-creation'
import type { AiResourceReadProvider } from '../src/domain/ai-resource-read'
import type { AiJobsReadProvider } from '../src/domain/ai-jobs-read'
import { resourceView } from './fixtures/ai-resource-read'
const project={id:'0123456789abcdef',name:'A',path:'/fixture/A'}, source=markRaw({})
const selection=reactive<{project:typeof project|null;currentSource:object|null}>({project,currentSource:source})
vi.mock('../src/stores/registered-project',()=>({useRegisteredProjectStore:()=>selection}))
let wrapper:VueWrapper|undefined
function setup(category:'icon'|'ui'|'ip'='icon'){
 const pinia=createPinia();setActivePinia(pinia)
 selection.project={...project};selection.currentSource=source
 const resource=useAiResourceReadStore();resource.setContext(project,source);resource.resource=resourceView()
 aiTaskCreationProvider.value={label:'test-only'} as AiTaskCreationProvider
 wrapper=mount(ArtProductionFlow,{props:{embedded:true,category},global:{plugins:[pinia,ElementPlus],stubs:{ArtStatusBar:true,AiResourceReadView:true,AiTaskCreationPanel:{template:'<div data-testid="icon-create-stub"/>'},AiJobsReadPanel:{template:'<div data-testid="icon-jobs-stub"/>'}}}})
 return resource
}
function button(label:string){return wrapper!.findAll('button').find(item=>item.text()===label)!}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;aiTaskCreationProvider.value=null})
describe('unified production stage evidence',()=>{
 it('cannot jump to a future or invalid step',()=>{expect(canChooseArtStage(4,1)).toBe(false);expect(canChooseArtStage(-1,5)).toBe(false);expect(canChooseArtStage(1.5,5)).toBe(false);expect(canChooseArtStage(6,6)).toBe(false);expect(canChooseArtStage(1,1)).toBe(true)})
 it('derives progress from observed task states and never claims production success',()=>{
  expect(artProductionStage(null)).toBe(null)
  expect(artProductionStage({state:'queued',candidates:0,selected:0,hasImport:false})).toBe(2)
  expect(artProductionStage({state:'awaiting_selection',candidates:0,selected:0,hasImport:false})).toBe(2)
  expect(artProductionStage({state:'awaiting_selection',candidates:1,selected:0,hasImport:false})).toBe(3)
  expect(artProductionStage({state:'selected',candidates:1,selected:1,hasImport:false})).toBe(4)
  expect(artProductionStage({state:'import_unknown',candidates:1,selected:1,hasImport:false})).toBe(4)
  expect(artProductionStage({state:'imported_pending_verification',candidates:1,selected:1,hasImport:false})).toBe(4)
  expect(artProductionStage({state:'imported_pending_verification',candidates:1,selected:1,hasImport:true})).toBe(5)
 })
 it('embedded mode delegates the only header/spec/step bar to its workspace',async()=>{
  setup();expect(wrapper!.find('art-status-bar-stub').exists()).toBe(false);expect(wrapper!.find('ai-resource-read-view-stub').exists()).toBe(false);expect(wrapper!.find('nav').exists()).toBe(false)
  expect((wrapper!.vm as unknown as {chooseStep:(n:number)=>boolean}).chooseStep(5)).toBe(false)
  await button('使用已保存规范').trigger('click');expect(wrapper!.emitted('stage-change')?.at(-1)).toEqual([{step:1,reached:1}])
 })
 it.each(['ui','ip'] as const)('%s planning never mounts icon submit or task paths and preserves project input',async category=>{
  const resource=setup(category);await button('使用已保存规范').trigger('click')
  expect(wrapper!.find('[data-testid="icon-create-stub"]').exists()).toBe(false)
  const inputs=wrapper!.findAll('.category-planning input');await inputs[0]!.setValue('测试素材');await inputs[1]!.setValue('界面用途');await wrapper!.get('.category-planning textarea').setValue('测试画面')
  await wrapper!.get('form').trigger('submit');expect(wrapper!.text()).toContain('没有提交图标任务');expect(wrapper!.emitted('stage-change')?.at(-1)).toEqual([{step:2,reached:2}])
  selection.project={...project,id:'1123456789abcdef',path:'/fixture/B'};resource.setContext(selection.project,source);await nextTick()
  expect(wrapper!.get('.category-planning input').element).toHaveProperty('value','')
  selection.project={...project};resource.setContext(project,source);resource.resource=resourceView();await nextTick()
  expect(wrapper!.get('.category-planning input').element).toHaveProperty('value','测试素材')
  expect(wrapper!.find('[data-testid="icon-jobs-stub"]').exists()).toBe(false)
 })
 it('unread or dirty specifications cannot advance the new-task path',async()=>{
  const resource=setup();resource.clearReads();await nextTick();expect(button('使用已保存规范').attributes('disabled')).toBeDefined();await button('使用已保存规范').trigger('click');expect(wrapper!.emitted('stage-change')?.at(-1)).toEqual([{step:0,reached:0}])
 })
})
describe('project-scoped brief retention without transaction retention',()=>{
 it('restores only inputs for same project path/source and keeps approval unconfirmed',()=>{
  setActivePinia(createPinia())
  const reader={label:'reader',readConfig:vi.fn(),previewReference:vi.fn()} as AiResourceReadProvider
  const jobs={label:'jobs',readJobs:vi.fn(),readStatus:vi.fn(),previewCandidate:vi.fn()} as AiJobsReadProvider
  const writer:AiTaskCreationProvider={label:'writer',inspect:vi.fn(),execute:vi.fn(),waitForIdle:vi.fn(async()=>{})}
  const store=createAiTaskCreationState()
  store.setContext(project,source,reader,jobs,writer);store.edit('name','gem');store.edit('purpose','奖励');store.edit('prompt','绿色宝石')
  store.setContext({...project,path:'/fixture/B'},source,reader,jobs,writer);expect(store.brief.prompt).toBe('');store.edit('prompt','B输入')
  store.setContext(project,source,reader,jobs,writer);expect(store.brief.prompt).toBe('绿色宝石');expect(store.brief.name).toBe('gem');expect(store.prepared.value).toBe(null);expect(store.confirmed.value).toBe(false);expect(store.snapshot.value).toBe(null)
  store.setContext(project,{},reader,jobs,writer);expect(store.brief.prompt).toBe('');expect(writer.execute).not.toHaveBeenCalled()
 })
})
