import {afterEach,expect,it,vi} from 'vitest'
import {createPinia} from 'pinia'
import {createMemoryHistory,createRouter} from 'vue-router'
import {flushPromises,mount,type VueWrapper} from '@vue/test-utils'
import ElementPlus from 'element-plus'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import {useCompanionBrowserStore} from '../src/stores/companion-browser'
import {companionBrowserProvider,companionEventProvider,registerCompanionBrowserProvider} from '../src/companion-browser-integration'
import type {CompanionBrowserProvider,ManagedStatus} from '../src/domain/companion-browser'
let view:VueWrapper|undefined
const ids=['0000000000000001','0000000000000002','0000000000000003']
afterEach(()=>{view?.unmount();view=undefined;companionBrowserProvider.value=null;companionEventProvider.value=null;sessionStorage.clear();document.body.innerHTML=''})
it('orders by real open time even if a different project is ready; polling and changed input order preserve ties',async()=>{
 const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView}]})
 const projects=ids.map((id,i)=>({id,name:`Project ${i}`,path:`D:/fixture/${i}`}))
 let statuses:ManagedStatus[]=ids.map((projectId,i)=>({projectId,state:i===0?'ready':'stopped',capabilityProfile:'unknown'}))
 const dashboard=projects.map((p,i)=>({path:p.path,name:p.name,exists:true,source:'dashboard' as const,lastOpenedAt:i===0?10:20}))
 const provider:CompanionBrowserProvider={label:'fixture',runtimeProbesEnabled:true,dashboardDiscoveryEnabled:true,loadProjects:vi.fn(async()=>({projects:[...projects],statuses,dashboard,warnings:[]})),loadCounts:vi.fn(async()=>({sessionId:'s',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'s',total:0,retained:0,records:[]}))}
 registerCompanionBrowserProvider(provider);await router.push('/projects');await router.isReady()
 view=mount(CompanionBrowserView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}})
 const store=useCompanionBrowserStore(pinia);await store.connect(provider);await flushPromises()
 const titles=()=>view!.findAll('.companion-project-header h3').map(x=>x.text())
 expect(titles()).toEqual(['Project 1','Project 2','Project 0'])
 statuses=ids.map(projectId=>({projectId,state:'ready',capabilityProfile:'unknown'}));projects.reverse();await store.refreshProjects();await flushPromises()
 expect(titles()).toEqual(['Project 1','Project 2','Project 0'])
})
it('initial unknown/error/stopped cards are collapsed and explicit expansion survives a status update and remount',async()=>{
 const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView},{path:'/other',component:{template:'<p>Other</p>'}}]})
 let statuses:ManagedStatus[]=ids.map((projectId,i)=>({projectId,state:(['unknown','error','stopped'] as const)[i]!,capabilityProfile:'unknown'}))
 const provider:CompanionBrowserProvider={label:'fixture',runtimeProbesEnabled:true,dashboardDiscoveryEnabled:false,loadProjects:vi.fn(async()=>({projects:ids.map((id,i)=>({id,name:`Project ${i}`,path:`D:/fixture/${i}`})),statuses,dashboard:[],warnings:[]})),loadCounts:vi.fn(async()=>({sessionId:'s',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'s',total:0,retained:0,records:[]}))}
 registerCompanionBrowserProvider(provider);await router.push('/projects');await router.isReady()
 const render=()=>mount(CompanionBrowserView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}})
 view=render();const store=useCompanionBrowserStore(pinia);await store.connect(provider);await flushPromises()
 expect(view.findAll('.companion-project-body')).toHaveLength(0)
 await view.findAll('.project-expand')[0]!.trigger('click');expect(view.findAll('.companion-project-body')).toHaveLength(1)
 statuses=ids.map(projectId=>({projectId,state:'stopped',capabilityProfile:'unknown'}));await store.refreshProjects();await flushPromises()
 expect(view.findAll('.project-expand')[0]!.attributes('aria-expanded')).toBe('true')
 view.unmount();view=render();await flushPromises();expect(view.findAll('.project-expand')[0]!.attributes('aria-expanded')).toBe('true')
})
