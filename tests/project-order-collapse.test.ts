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
it.each([true,false])('orders by real open time for snapshot discovery=%s; polling preserves ties',async(discovery)=>{
 const pinia=createPinia(),router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView}]})
 const projects=ids.map((id,i)=>({id,name:`Project ${i}`,path:`D:/fixture/${i}`}))
 let statuses:ManagedStatus[]=ids.map((projectId,i)=>({projectId,state:i===0?'ready':'stopped',capabilityProfile:'unknown'}))
 const dashboard=projects.map((p,i)=>({path:p.path,name:p.name,exists:true,source:'dashboard' as const,lastOpenedAt:i===0?10:20}))
 const provider:CompanionBrowserProvider={label:'fixture',runtimeProbesEnabled:true,dashboardDiscoveryEnabled:discovery,loadDashboardProjects:vi.fn(async()=>dashboard),loadProjects:vi.fn(async()=>({projects:[...projects],statuses,dashboard:discovery?dashboard:[],warnings:[]})),loadCounts:vi.fn(async()=>({sessionId:'s',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn(async()=>({sessionId:'s',total:0,retained:0,records:[]}))}
 if(discovery)registerCompanionBrowserProvider(provider);else registerCompanionBrowserProvider(provider,undefined,{projectEntry:'read'});await router.push('/projects');await router.isReady()
 view=mount(CompanionBrowserView,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}})
 const store=useCompanionBrowserStore(pinia);await store.connect(provider);await flushPromises()
 const titles=()=>view!.findAll('.companion-project-header h3').map(x=>x.text())
 expect(titles()).toEqual(['Project 1','Project 2','Project 0'])
 if(!discovery){expect(provider.loadDashboardProjects).toHaveBeenCalledTimes(1);store.dashboardRead=true;store.dashboard=[{...dashboard[0]!,lastOpenedAt:999}];await flushPromises();expect(titles()).toEqual(['Project 1','Project 2','Project 0'])}
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
