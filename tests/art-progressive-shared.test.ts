import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ProjectArtSpecPanel from '../src/components/ProjectArtSpecPanel.vue'
import { useProjectArtSpecStore } from '../src/stores/project-art-spec'
import type { ProjectArtSpecProvider } from '../src/project-art-spec-integration'
const project={id:'1234567890abcdef',name:'Test',path:'D:/Test'},source={}
const spec=()=>({schemaVersion:'project-art-spec-v1',projectId:project.id,version:1,project:{name:'Test',content:'Test art',engine:'cocos-creator',designResolution:{width:750,height:1334}},inheritance:{mode:'none',reason:'Independent project'},overrides:{width:96,height:96,transparent:true,destination:'assets/art'},categories:{}})
const receipt=()=>({projectId:project.id,projectPath:project.path,config:spec(),hash:'a'.repeat(64),authorities:[]})
const host=()=>({label:'isolated',endpoint:'http://127.0.0.1:32180',read:vi.fn(async()=>receipt()),save:vi.fn(),status:vi.fn()} as unknown as ProjectArtSpecProvider)
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>wrapper?.unmount())
const button=(label:string)=>wrapper!.findAll('button').find(item=>item.text()===label)!
describe('progressive specification workflow',()=>{
 it('shows a saved summary, then only the reached section and preserves edits on return',async()=>{
  const provider=host();wrapper=mount(ProjectArtSpecPanel,{props:{project,source,provider},global:{plugins:[createPinia()]}})
  expect(wrapper.find('[data-testid="art-project-section"]').exists()).toBe(false)
  await button('读取 / 刷新美术规范').trigger('click');await flushPromises()
  expect(wrapper.get('[data-testid="art-saved-summary"]').text()).toContain('v1')
  expect(wrapper.find('fieldset').exists()).toBe(false)
  await button('修改美术规范').trigger('click')
  expect(wrapper.find('[data-testid="art-global-section"]').exists()).toBe(true)
  expect(wrapper.find('[data-testid="art-project-section"]').exists()).toBe(false)
  expect(wrapper.find('footer').exists()).toBe(false)
  await button('继续').trigger('click')
  await wrapper.get('[aria-label="美术项目内容"]').setValue('Preserved edit')
  await button('继续').trigger('click')
  expect(wrapper.find('[data-testid="art-project-section"]').exists()).toBe(false)
  expect(wrapper.get('[data-testid="art-category-section"]').isVisible()).toBe(true)
  await button('返回修改').trigger('click')
  expect((wrapper.get('[aria-label="美术项目内容"]').element as HTMLTextAreaElement).value).toBe('Preserved edit')
  expect(provider.save).not.toHaveBeenCalled()
 })
 it('retains independent unsaved specification inputs for multiple projects',async()=>{
  const store=useProjectArtSpecStore(createPinia()),provider=host(),a={projectId:project.id,projectPath:project.path,source},b={projectId:'2222222222222222',projectPath:'D:/B',source}
  store.bind(a,provider);await store.read();store.draft!.project.content='Draft A';store.touch()
  store.bind(b,provider);store.startDraft('B');store.draft!.project.content='Draft B';store.touch()
  store.bind(a,provider);expect(store.draft).toBeNull();expect(store.retained?.draft.project.content).toBe('Draft A');store.restoreRetained();expect(store.draft!.project.content).toBe('Draft A')
  store.bind(b,provider);expect(store.retained?.draft.project.content).toBe('Draft B');store.restoreRetained();expect(store.draft!.project.content).toBe('Draft B');expect(provider.save).not.toHaveBeenCalled()
 })
 it('does not refresh over dirty draft or let an old context release a new read',async()=>{
  const store=useProjectArtSpecStore(createPinia()),provider=host()
  store.bind({projectId:project.id,projectPath:project.path,source},provider);await store.read()
  store.draft!.project.content='Retained';store.touch();await store.read()
  expect(provider.read).toHaveBeenCalledTimes(1);expect(store.draft!.project.content).toBe('Retained')
  let first!:(value:unknown)=>void,second!:(value:unknown)=>void
  const reads=[new Promise(resolve=>first=resolve),new Promise(resolve=>second=resolve)]
  provider.read=vi.fn(()=>reads.shift()!) as ProjectArtSpecProvider['read']
  store.bind({projectId:'2222222222222222',projectPath:'D:/B',source},provider)
  const old=store.read()
  store.bind({projectId:project.id,projectPath:project.path,source},provider)
  const current=store.read();expect(store.pending).toBe(true)
  first(receipt());await old;expect(store.pending).toBe(true)
  second(receipt());await current;expect(store.pending).toBe(false);expect(store.base?.projectId).toBe(project.id)
 })
})
