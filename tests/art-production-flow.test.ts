import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { markRaw, nextTick, reactive } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ArtProductionFlow from '../src/components/ArtProductionFlow.vue'
import { artProductionStage, canChooseArtStage, savedArtSpecDependency, sameArtSpecDependency } from '../src/domain/art-production-flow'
import { useAiResourceReadStore } from '../src/stores/ai-resource-read'
import { aiTaskCreationProvider } from '../src/ai-task-creation-integration'
import { createAiTaskCreationState } from '../src/stores/ai-task-creation'
import type { AiTaskCreationProvider } from '../src/domain/ai-task-creation'
import type { AiResourceReadProvider } from '../src/domain/ai-resource-read'
import type { AiJobsReadProvider } from '../src/domain/ai-jobs-read'
import { resourceView } from './fixtures/ai-resource-read'
import { useProjectArtSpecStore } from '../src/stores/project-art-spec'
import { projectArtSpecProvider, type ProjectArtSpecProvider } from '../src/project-art-spec-integration'
import type { ProjectArtSpec } from '../src/domain/project-art-spec'
const project={id:'0123456789abcdef',name:'A',path:'/fixture/A'}, source=markRaw({})
const selection=reactive<{project:typeof project|null;currentSource:object|null}>({project,currentSource:source})
vi.mock('../src/stores/registered-project',()=>({useRegisteredProjectStore:()=>selection}))
let wrapper:VueWrapper|undefined
const artProvider=markRaw({label:'art',endpoint:'http://127.0.0.1:32180'} as ProjectArtSpecProvider)
function savedSpec(){
 const art=useProjectArtSpecStore();projectArtSpecProvider.value=artProvider;art.bind({projectId:project.id,projectPath:project.path,source},artProvider)
 const spec:ProjectArtSpec={schemaVersion:'project-art-spec-v1',projectId:project.id,version:1,project:{name:'A',content:'Owner content',engine:'cocos-creator',designResolution:{width:750,height:1334}},inheritance:{mode:'none',reason:'Independent project'},overrides:{width:96,height:96,transparent:true,destination:'assets/art',exportDirectory:'art/final/icons'},categories:{}}
 art.base=structuredClone(spec);art.draft=structuredClone(spec);art.hash='a'.repeat(64);art.phase='saved';return art
}
function setup(category:'icon'|'ui'|'ip'='icon'){
 const pinia=createPinia();setActivePinia(pinia)
 selection.project={...project};selection.currentSource=source
 const resource=useAiResourceReadStore();resource.setContext(project,source);resource.resource=resourceView();savedSpec()
 aiTaskCreationProvider.value={label:'test-only'} as AiTaskCreationProvider
 wrapper=mount(ArtProductionFlow,{props:{embedded:true,category},global:{plugins:[pinia,ElementPlus],stubs:{ArtStatusBar:true,AiResourceReadView:true,AiTaskCreationPanel:{template:'<div data-testid="icon-create-stub"/>'},AiJobsReadPanel:{template:'<div data-testid="icon-jobs-stub"/>'}}}})
 return resource
}
function button(label:string){return wrapper!.findAll('button').find(item=>item.text()===label)!}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;aiTaskCreationProvider.value=null;projectArtSpecProvider.value=null})
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
  selection.project={...project};resource.setContext(project,source);resource.resource=resourceView();savedSpec();await nextTick()
  expect(wrapper!.get('.category-planning input').element).toHaveProperty('value','测试素材')
  expect(wrapper!.find('[data-testid="icon-jobs-stub"]').exists()).toBe(false)
 })
 it('unread or dirty specifications cannot advance the new-task path',async()=>{
  setup();useProjectArtSpecStore().hash=undefined;await nextTick();expect(button('使用已保存规范').attributes('disabled')).toBeDefined();await button('使用已保存规范').trigger('click');expect(wrapper!.emitted('stage-change')?.at(-1)).toEqual([{step:0,reached:0}])
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

describe('saved specification dependency fence',()=>{
 it.each(['projectId','projectPath','source','provider'] as const)('rejects foreign %s and never replaces it with a legacy read',async field=>{
  const resource=setup();const art=useProjectArtSpecStore();
  if(field==='provider')projectArtSpecProvider.value=markRaw({...artProvider});
  else if(field==='projectId')art.context={...art.context!,projectId:'1123456789abcdef'};
  else if(field==='projectPath')art.context={...art.context!,projectPath:'/fixture/other'};
  else art.context={...art.context!,source:markRaw({})};
  expect(resource.resource?.state).toBe('valid');await nextTick();expect(button('使用已保存规范').attributes('disabled')).toBeDefined();
 });
 it('requires an explicit recheck after dirty/reverted specification and retains inputs',async()=>{
  setup('ui');await button('使用已保存规范').trigger('click');const art=useProjectArtSpecStore();
  await wrapper!.findAll('.category-planning input')[0]!.setValue('Owner UI');
  art.draft!.project.content='Changed';await nextTick();expect(wrapper!.find('[data-testid="art-dependency-review"]').exists()).toBe(true);
  art.draft!.project.content=art.base!.project.content;await nextTick();expect(wrapper!.get('form button').attributes('disabled')).toBeDefined();
  expect(wrapper!.find('.category-planning input').element).toHaveProperty('value','Owner UI');
  (wrapper!.vm as unknown as {chooseStep:(n:number)=>boolean}).chooseStep(0);await nextTick();await button('使用已保存规范').trigger('click');
  expect(wrapper!.find('[data-testid="art-dependency-review"]').exists()).toBe(false);expect(wrapper!.find('.category-planning input').element).toHaveProperty('value','Owner UI');
 });
 it('marks saved hash/version changes for review without erasing reached stages',async()=>{
  setup('ip');await button('使用已保存规范').trigger('click');
  const fields=wrapper!.findAll('.category-planning input');await fields[0]!.setValue('Hero');await fields[1]!.setValue('portrait');await wrapper!.get('textarea').setValue('Owner brief');await wrapper!.get('form').trigger('submit');
  const art=useProjectArtSpecStore();art.base!.version=2;art.draft!.version=2;art.hash='b'.repeat(64);await nextTick();
  expect(wrapper!.find('[data-testid="art-dependency-review"]').exists()).toBe(true);expect((wrapper!.vm as unknown as {chooseStep:(n:number)=>boolean}).chooseStep(1)).toBe(true);await nextTick();expect(wrapper!.find('.category-planning input').element).toHaveProperty('value','Hero');
 });
 it('isolates category briefs even when one component is reused between labels',async()=>{
  setup('ui');await button('使用已保存规范').trigger('click');await wrapper!.find('.category-planning input').setValue('UI brief');await wrapper!.setProps({category:'ip'});await button('使用已保存规范').trigger('click');expect(wrapper!.find('.category-planning input').element).toHaveProperty('value','');await wrapper!.find('.category-planning input').setValue('Hero brief');await wrapper!.setProps({category:'ui'});expect(wrapper!.find('.category-planning input').element).toHaveProperty('value','UI brief');
 });
 it('pins provider/source identity, hash and version independently',()=>{
  const dependency={projectId:project.id,projectPath:project.path,source,provider:artProvider,hash:'a'.repeat(64),version:1};
  expect(sameArtSpecDependency(dependency,{...dependency})).toBe(true);expect(sameArtSpecDependency(dependency,{...dependency,version:2})).toBe(false);expect(sameArtSpecDependency(dependency,{...dependency,provider:{}})).toBe(false);
  expect(savedArtSpecDependency({project,source,context:{projectId:project.id,projectPath:project.path,source},provider:artProvider,currentProvider:artProvider,hash:dependency.hash,version:1,ready:true})).toEqual(dependency);
  expect(savedArtSpecDependency({project,source,context:{projectId:project.id,projectPath:project.path,source},provider:artProvider,currentProvider:artProvider,hash:dependency.hash,version:1,ready:false})).toBe(null);
 });
});

describe('retained original work under changed upstream dependencies',()=>{
 it('keeps the original task panel while disabling its operations after specification edits',async()=>{
  setup();await button('使用已保存规范').trigger('click');
  (wrapper!.vm as unknown as {chooseStep:(n:number)=>boolean}).chooseStep(0);await nextTick();await button('继续已有任务').trigger('click');
  const original=wrapper!.get('[data-testid="icon-jobs-stub"]').element;
  const art=useProjectArtSpecStore();art.draft!.project.content='Edited upstream';await nextTick();
  expect(wrapper!.get('[data-testid="icon-jobs-stub"]').element).toBe(original);
  expect(wrapper!.get('[data-testid="icon-jobs-stub"]').attributes('active')).toBe('false');
  expect(wrapper!.find('[data-testid="art-dependency-review"]').exists()).toBe(true);
  (wrapper!.vm as unknown as {chooseStep:(n:number)=>boolean}).chooseStep(0);await nextTick();art.draft!.project.content=art.base!.project.content;await button('使用已保存规范').trigger('click');
  expect(wrapper!.get('[data-testid="icon-jobs-stub"]').attributes('active')).toBe('false');
 });
 it('temporarily blocks a refresh without invalidating an unchanged saved dependency',async()=>{
  setup('ui');await button('使用已保存规范').trigger('click');const art=useProjectArtSpecStore();art.pending=true;art.phase='reading';art.hash=undefined;await nextTick();
  expect(wrapper!.get('form button').attributes('disabled')).toBeDefined();art.hash='a'.repeat(64);art.phase='saved';art.pending=false;await nextTick();expect(wrapper!.find('[data-testid="art-dependency-review"]').exists()).toBe(false);
 });
 it('does not advance an inactive task tab',async()=>{
  setup('ui');await wrapper!.setProps({active:false});await button('使用已保存规范').trigger('click');expect(wrapper!.emitted('stage-change')?.at(-1)).toEqual([{step:0,reached:0}]);
 });
});

it('does not present a legacy-only result as a saved new art specification',async()=>{
 setup();const art=useProjectArtSpecStore();art.bind(null,null);projectArtSpecProvider.value=null;await nextTick();expect(useAiResourceReadStore().resource?.state).toBe('valid');expect(button('使用已保存规范').attributes('disabled')).toBeDefined();await button('继续已有任务').trigger('click');expect(wrapper!.find('[data-testid="icon-jobs-stub"]').exists()).toBe(true);
});
