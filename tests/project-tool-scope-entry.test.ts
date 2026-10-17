import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ToolPresetsReadPanel from '../src/components/ToolPresetsReadPanel.vue'
import { companionBrowserProvider } from '../src/companion-browser-integration'
import { toolPresetReadProvider } from '../src/tool-presets-read-integration'
import { useToolPresetsReadStore } from '../src/stores/tool-presets-read'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import type { ToolPresetReadProvider, ToolPresetRead, ToolCatalogEntry } from '../src/domain/tool-presets-read'
import type { CompanionBrowserProvider } from '../src/domain/companion-browser'
const id='0123456789abcdef', other='1123456789abcdef'
let wrapper:VueWrapper|undefined
function fixture():ToolPresetReadProvider{return {label:'OFFLINE',loadTools:vi.fn(async()=>[{name:'project_list',displayNameZh:'工程',description:'read',scope:'Companion',profile:'core' as const,access:'read' as const}]),loadPresets:vi.fn(async()=>({presets:['core','full'].map(profile=>({id:profile,name:profile==='core'?'核心工具':'全部工具',baseProfile:profile as 'core'|'full',enabled:[],disabled:[],builtIn:true,updatedAt:'1970-01-01T00:00:00.000Z'})),selectedPresetId:'full'})),exportPreset:vi.fn()}}
async function setup(p:ToolPresetReadProvider,requestedProjectId:string|undefined=id){
 const pinia=createPinia();setActivePinia(pinia)
 const projects=useCompanionBrowserStore(pinia)
 projects.provider={label:'OFFLINE'} as CompanionBrowserProvider;companionBrowserProvider.value=projects.provider;projects.connected=true
 projects.projects=[{id,name:'One',path:'/one'},{id:other,name:'Two',path:'/two'}]
 toolPresetReadProvider.value=p
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/help',component:ToolPresetsReadPanel},{path:'/projects',component:{template:'<p/>'}}]});await router.push('/help');await router.isReady()
 wrapper=mount(ToolPresetsReadPanel,{props:{requestedProjectId},global:{plugins:[pinia,router,ElementPlus]}})
 return {store:useToolPresetsReadStore(pinia),projects}
}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;toolPresetReadProvider.value=null;companionBrowserProvider.value=null;vi.restoreAllMocks()})
describe('explicit project scope shortcut',()=>{
 it('reads the exact project once with no export or writes',async()=>{const p=fixture(),{store}=await setup(p);await flushPromises();expect(p.loadTools).toHaveBeenCalledTimes(1);expect(p.loadPresets).toHaveBeenCalledTimes(1);expect(p.loadPresets).toHaveBeenCalledWith(id,expect.any(AbortSignal));expect(store.projectId).toBe(id);expect(store.presetsRead).toBe(true);expect(p.exportPreset).not.toHaveBeenCalled()})
 it.each(['missing','',other.toUpperCase()])('rejects unknown or malformed entry %s without a default read',async value=>{const p=fixture();await setup(p,value);await flushPromises();expect(p.loadTools).not.toHaveBeenCalled();expect(p.loadPresets).not.toHaveBeenCalled();expect(wrapper!.text()).toContain('重新打开工具范围')})
 it('does not overwrite a manually selected project after late catalog completion',async()=>{const p=fixture();let finish!:()=>void;p.loadTools=vi.fn(()=>new Promise<ToolCatalogEntry[]>(resolve=>{finish=()=>resolve([])}));const {store}=await setup(p);await wrapper!.findComponent({name:'ElSelect'}).vm.$emit('change',other);finish();await flushPromises();expect(store.projectId).toBe(other);expect(p.loadPresets).not.toHaveBeenCalled()})
 it.each(['source','registration','identity','disconnect','unmount'])('drops pending scope when %s changes',async change=>{const p=fixture();let finish!:(value:ToolPresetRead)=>void;p.loadPresets=vi.fn(()=>new Promise<ToolPresetRead>(resolve=>{finish=resolve}));const {store,projects}=await setup(p);await flushPromises();expect(p.loadPresets).toHaveBeenCalledTimes(1);if(change==='source')projects.provider={label:'new'} as CompanionBrowserProvider;else if(change==='registration')companionBrowserProvider.value={label:'replacement'} as CompanionBrowserProvider;else if(change==='identity')projects.projects=[{id,name:'changed',path:'/new'}];else if(change==='disconnect')projects.connected=false;else {wrapper!.unmount();wrapper=undefined}finish({presets:[],selectedPresetId:'full'});await flushPromises();expect(store.presetsRead).toBe(false);expect(store.presets).toEqual([])})
 it('cancels pending scope after removing the route project',async()=>{const p=fixture();let finish!:(value:ToolPresetRead)=>void;p.loadPresets=vi.fn(()=>new Promise<ToolPresetRead>(resolve=>{finish=resolve}));const {store}=await setup(p);await flushPromises();expect(p.loadPresets).toHaveBeenCalledTimes(1);await wrapper!.setProps({requestedProjectId:undefined});finish({presets:[],selectedPresetId:'full'});await flushPromises();expect(store.presetsRead).toBe(false);expect(store.presets).toEqual([])})
 it('does not repeat range reads or overwrite manual preview when the catalog arrives late',async()=>{const p=fixture();let finish!:()=>void;p.loadTools=vi.fn(()=>new Promise<ToolCatalogEntry[]>(resolve=>{finish=()=>resolve([])}));const {store}=await setup(p);const read=wrapper!.findAll('button').find(button=>button.text()==='读取登记范围')!;await read.trigger('click');await flushPromises();expect(store.presetsRead).toBe(true);store.selectPreview('core');finish();await flushPromises();expect(p.loadPresets).toHaveBeenCalledTimes(1);expect(store.previewPresetId).toBe('core')})
 it('changes route target while the old catalog is pending without reading the old project',async()=>{const p=fixture();let first!:()=>void;p.loadTools=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{first=()=>resolve([])})).mockResolvedValue([]);const {store}=await setup(p);await wrapper!.setProps({requestedProjectId:other});await flushPromises();first();await flushPromises();expect(p.loadPresets).toHaveBeenCalledTimes(1);expect(p.loadPresets).toHaveBeenCalledWith(other,expect.any(AbortSignal));expect(store.projectId).toBe(other)})
})
