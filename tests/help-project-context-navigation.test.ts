import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import HelpView from '../src/views/HelpView.vue'
import MigrationView from '../src/views/MigrationView.vue'
import { helpTopics } from '../src/domain/product-information'
import { companionBrowserProvider } from '../src/companion-browser-integration'
import { toolPresetReadProvider } from '../src/tool-presets-read-integration'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { useToolPresetsReadStore } from '../src/stores/tool-presets-read'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
import type { ToolPresetReadProvider, ToolCatalogEntry } from '../src/domain/tool-presets-read'

const first='0123456789abcdef', second='1123456789abcdef'
const tool:ToolCatalogEntry={name:'project_list',displayNameZh:'工程列表',description:'read',scope:'Companion',profile:'core',access:'read'}
let wrapper:VueWrapper|undefined
function reader():ToolPresetReadProvider{return {label:'isolated navigation reader',loadTools:vi.fn(async()=>[tool]),loadPresets:vi.fn(async()=>({presets:(['core','full'] as const).map(profile=>({id:profile,name:profile==='core'?'核心工具':'全部工具',baseProfile:profile,enabled:[],disabled:[],builtIn:true,updatedAt:'1970-01-01T00:00:00.000Z'})),selectedPresetId:'full'})),exportPreset:vi.fn()}}
async function setup(path:string,api=reader()){
 const pinia=createPinia();setActivePinia(pinia)
 const directory=useCompanionBrowserStore(pinia),source={label:'isolated registered projects'} as CompanionBrowserProvider
 directory.provider=source;directory.connected=true;directory.projects=[{id:first,name:'First',path:'/first'},{id:second,name:'Second',path:'/second'}];companionBrowserProvider.value=source;toolPresetReadProvider.value=api
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/help',component:HelpView},{path:'/projects',component:{template:'<p>projects</p>'}},{path:'/migration',component:MigrationView}]})
 await router.push(path);await router.isReady()
 wrapper=mount(defineComponent({render:()=>h(RouterView)}),{global:{plugins:[pinia,router,ElementPlus]}});await flushPromises()
 return {api,router,directory,store:useToolPresetsReadStore(pinia)}
}
async function choose(id:string){const title=helpTopics.find(topic=>topic.id===id)!.title;const button=wrapper!.findAll('.help-topic-nav button').find(node=>node.text()===title)!;await button.trigger('click');await flushPromises()}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;companionBrowserProvider.value=null;toolPresetReadProvider.value=null;vi.restoreAllMocks();vi.unstubAllGlobals()})

describe('help topic navigation retains the explicit original project shortcut',()=>{
 it('keeps the selected second project through topics, rereads its scope, and drops unrelated query text',async()=>{
  const {api,router,store}=await setup(`/help?topic=tools&project=${second}&unrelated=discard`)
  expect(store.projectId).toBe(second);expect(api.loadPresets).toHaveBeenCalledWith(second,expect.any(AbortSignal))
  await choose('cli');expect(router.currentRoute.value.query).toEqual({topic:'cli',project:second})
  await choose('tools');expect(router.currentRoute.value.query).toEqual({topic:'tools',project:second})
  expect(api.loadPresets).toHaveBeenCalledTimes(2);expect(vi.mocked(api.loadPresets).mock.calls.every(([id])=>id===second)).toBe(true)
  expect(store.projectId).toBe(second);expect(store.presetsRead).toBe(true);expect(api.exportPreset).not.toHaveBeenCalled()
 })
 it('cancels the old topic read, starts the returning exact-project read, and ignores late old data',async()=>{
  const api=reader();let finish!:(tools:ToolCatalogEntry[])=>void
  vi.mocked(api.loadTools).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
  const {router,store}=await setup(`/help?topic=tools&project=${second}`,api)
  const oldSignal=vi.mocked(api.loadTools).mock.calls[0]![0]
  await choose('cli');expect(oldSignal?.aborted).toBe(true)
  await choose('tools');expect(router.currentRoute.value.query.project).toBe(second)
  expect(api.loadPresets).toHaveBeenCalledTimes(1);expect(api.loadPresets).toHaveBeenCalledWith(second,expect.any(AbortSignal))
  finish([]);await flushPromises();expect(store.tools).toEqual([tool]);expect(store.projectId).toBe(second);expect(store.presetsRead).toBe(true)
 })
 it('retains an invalid project for rejection instead of silently falling back after topic navigation',async()=>{
  const {api,router,store}=await setup('/help?topic=tools&project=invalid')
  await choose('cli');await choose('tools')
  expect(router.currentRoute.value.query.project).toBe('invalid');expect(store.projectId).toBe('')
  expect(api.loadTools).not.toHaveBeenCalled();expect(api.loadPresets).not.toHaveBeenCalled();expect(wrapper!.text()).toContain('重新打开工具范围')
 })
 it('keeps ordinary help passive when there was no explicit project shortcut',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
  const {api,router}=await setup('/help?topic=cli&unrelated=discard')
  await choose('tools');expect(router.currentRoute.value.query).toEqual({topic:'tools'})
  expect(api.loadTools).not.toHaveBeenCalled();expect(api.loadPresets).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
 })
 it('rejects a removed route project on return without reading the remaining first project',async()=>{
  const {api,directory,store}=await setup(`/help?topic=tools&project=${second}`)
  await choose('cli');directory.projects=directory.projects.filter(project=>project.id===first);await flushPromises();await choose('tools')
  expect(api.loadTools).toHaveBeenCalledTimes(1);expect(api.loadPresets).toHaveBeenCalledTimes(1)
  expect(store.projectId).toBe('');expect(store.presetsRead).toBe(false);expect(wrapper!.text()).toContain('重新打开工具范围')
 })
 it('states page migration and inherited business evidence separately without executing either',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
  const {api}=await setup('/migration?feature=calls')
  expect(wrapper!.text()).toContain('前端迁移判定');expect(wrapper!.text()).toContain('宿主与真实集成状态')
  expect(wrapper!.text()).toContain('隔离数据');expect(wrapper!.text()).toContain('不要求启动 Cursor')
  expect(wrapper!.find('#feature-calls').classes()).toContain('feature-focused')
  expect(api.loadTools).not.toHaveBeenCalled();expect(api.loadPresets).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled()
 })
})
