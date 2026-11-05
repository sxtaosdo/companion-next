import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, reactive } from 'vue'
import View from '../src/views/ArtWorkspaceView.vue'
import { companionBrowserProvider } from '../src/companion-browser-integration'
import { useProjectArtSpecStore, useResourceDomainArtSpecStore } from '../src/stores/project-art-spec'
import { useArtWorkbenchStore } from '../src/stores/art-workbench'

const f=vi.hoisted(()=>{
 const project={id:'0123456789abcdef',name:'工程',path:'D:/fixture'},source={}
 const directory={provider:source,projectLoading:false,projectError:'',projectSnapshotRevision:0,refreshProjects:vi.fn(async()=>{directory.projectSnapshotRevision++}),connect:vi.fn(async()=>{directory.projectSnapshotRevision++})}
 return {project,source,selection:{project,currentSource:source,directory},spec:vi.fn(async()=>true)}
})
const reactiveSelection=reactive(f.selection)
vi.mock('../src/composables/use-registered-project-page',()=>({useRegisteredProjectPage:()=>reactiveSelection}))
const Status=defineComponent({props:['refreshDisabled','refreshBusy'],emits:['refresh-all'],setup(_,{expose}){expose({refreshPublicSpecification:f.spec});return {}},template:'<div><button :disabled="refreshDisabled" @click="$emit(\'refresh-all\')">刷新工程数据</button></div>'})
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();companionBrowserProvider.value=null;vi.unstubAllGlobals();vi.clearAllMocks()})
async function setup(){
 const pinia=createPinia();setActivePinia(pinia);companionBrowserProvider.value=f.source as any
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/art-resources',component:View}]});await router.push('/art-resources');await router.isReady()
 const fetcher=vi.fn(async()=>new Response(JSON.stringify({projectId:f.project.id,projectPath:f.project.path,domains:[],legacy:{readOnly:false,hasConfig:true,hasWorkbench:false},projectSettingsHash:null})))
 vi.stubGlobal('fetch',fetcher)
 wrapper=mount(View,{global:{plugins:[pinia,router],stubs:{ArtStatusBar:Status,ProjectArtSpecPanel:true,ArtWorkbenchManager:true,AiResourceReadView:true,ImageAssetsView:true,ElButton:{template:'<button><slot/></button>'}}}})
 await flushPromises();fetcher.mockClear();return {pinia,fetcher}
}
it('refreshes the project list, resource domains and public specification from one button',async()=>{
 const {fetcher}=await setup();await wrapper!.get('button').trigger('click');await flushPromises()
 expect(f.selection.directory.refreshProjects).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledTimes(1);expect(f.spec).toHaveBeenCalledTimes(1)
 expect(wrapper!.text()).toContain('工程数据已刷新');expect(wrapper!.text()).not.toContain('读取 / 刷新资源域')
})
it('protects an unsaved project specification without starting any read',async()=>{
 const {pinia,fetcher}=await setup();const store=useProjectArtSpecStore(pinia);store.draft={projectId:f.project.id,version:1} as any;await flushPromises()
 expect(wrapper!.get('button').attributes('disabled')).toBeDefined();expect(wrapper!.text()).toContain('请先保存未完成的草稿')
 expect(f.selection.directory.refreshProjects).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();expect(f.spec).not.toHaveBeenCalled()
})
it('also protects unsaved domain specifications and workbench edits',async()=>{
 const {pinia,fetcher}=await setup();const domain=useResourceDomainArtSpecStore(pinia),workbench=useArtWorkbenchStore(pinia)
 domain.draft={projectId:f.project.id,version:1} as any;await flushPromises();expect(wrapper!.get('button').attributes('disabled')).toBeDefined()
 domain.draft=null;workbench.draft={projectId:f.project.id,version:1} as any;await flushPromises();expect(wrapper!.get('button').attributes('disabled')).toBeDefined()
 expect(f.selection.directory.refreshProjects).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled()
})
it('locks editing during the asynchronous refresh',async()=>{
 await setup();let release!:()=>void;f.selection.directory.refreshProjects.mockImplementationOnce(()=>new Promise<void>(r=>{release=()=>{f.selection.directory.projectSnapshotRevision++;r()}}))
 await wrapper!.get('button').trigger('click');await flushPromises();expect(wrapper!.get('.art-domain-bar').element.parentElement?.hasAttribute('inert')).toBe(true)
 release();await flushPromises();expect(wrapper!.get('.art-domain-bar').element.parentElement?.hasAttribute('inert')).toBe(false)
})
it('reports an unconfirmed specification rather than claiming a successful refresh',async()=>{
 await setup();f.spec.mockResolvedValueOnce(false);await wrapper!.get('button').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('工程规范未能确认')
})
it('does not read domains or specifications after the selected project becomes unavailable',async()=>{
 const {fetcher}=await setup();f.selection.directory.refreshProjects.mockImplementationOnce(async()=>{f.selection.directory.projectSnapshotRevision++;reactiveSelection.project=null as any})
 try{await wrapper!.get('button').trigger('click');await flushPromises();expect(wrapper!.text()).toContain('工程状态发生变化');expect(fetcher).not.toHaveBeenCalled();expect(f.spec).not.toHaveBeenCalled()}
 finally{reactiveSelection.project=f.project}
})
it('waits for one domain read when the project list replaces an equivalent project object',async()=>{
 const {fetcher}=await setup();f.selection.directory.refreshProjects.mockImplementationOnce(async()=>{f.selection.directory.projectSnapshotRevision++;reactiveSelection.project={...f.project}})
 await wrapper!.get('button').trigger('click');await flushPromises();expect(fetcher).toHaveBeenCalledTimes(1);expect(f.spec).toHaveBeenCalledTimes(1);expect(wrapper!.text()).toContain('工程数据已刷新')
})
