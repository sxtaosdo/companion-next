import { afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import CompanionBrowserView from '../src/views/CompanionBrowserView.vue'
import RegisteredProjectOverview from '../src/components/RegisteredProjectOverview.vue'
import OverviewServiceSummary from '../src/components/OverviewServiceSummary.vue'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import { companionBrowserProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { knowledgeReadProvider } from '../src/knowledge-read-integration'
import type { CompanionBrowserProvider, ProjectRead } from '../src/domain/companion-browser'
let wrapper:VueWrapper|undefined
const data=():ProjectRead=>({projects:[{id:'aaaaaaaaaaaaaaaa',name:'Test',path:'/offline/test'}],statuses:[{projectId:'aaaaaaaaaaaaaaaa',state:'ready',capabilityProfile:'authoring'}],dashboard:[],warnings:[]})
function source():CompanionBrowserProvider{return {label:'mock',loadProjects:vi.fn(async()=>data()),loadCounts:vi.fn(async()=>({sessionId:'s',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn()}}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;useCompanionBrowserStore().disconnect();companionBrowserProvider.value=null;companionProjectEntryProvider.value=null;knowledgeReadProvider.value=null;vi.unstubAllEnvs();sessionStorage.clear();document.body.innerHTML=''})
it('keeps project DOM/expansion through a failed refresh, marks old green state unknown, and restores on success',async()=>{
 const pinia=createPinia();setActivePinia(pinia);const read=source();registerCompanionBrowserProvider(read)
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/projects',component:CompanionBrowserView}]});await router.push('/projects')
 wrapper=mount(CompanionBrowserView,{global:{plugins:[pinia,router,ElementPlus]}});const store=useCompanionBrowserStore();await store.connect(read);await flushPromises()
 const card=wrapper.get('.companion-project-card'),node=card.element
 expect(card.get('.project-status-trigger').text()).toContain('已就绪');expect(card.get('.project-expand').attributes('aria-expanded')).toBe('true')
 read.loadProjects=async()=>{throw Error('offline')};await store.refreshProjects(true);await flushPromises()
 expect(wrapper.get('.companion-project-card').element).toBe(node);expect(card.get('.project-expand').attributes('aria-expanded')).toBe('true')
 expect(card.get('.project-status-trigger').text()).toContain('待核对');expect(card.get('.project-status-trigger .el-tag').classes()).toContain('el-tag--warning');expect(card.text()).not.toContain('已就绪')
 read.loadProjects=async()=>data();await store.refreshProjects(true);await flushPromises();expect(card.get('.project-status-trigger').text()).toContain('已就绪');expect(wrapper.get('.companion-project-card').element).toBe(node)
})
it('does not turn Companion checking during a retained background read and shows read failure instead of a green light',async()=>{
 setActivePinia(createPinia());vi.stubEnv('MODE','companion-workspace');const read=source();registerCompanionBrowserProvider(read);companionProjectEntryProvider.value=read
 const store=useCompanionBrowserStore();await store.connect(read);store.livePreferred=false
 wrapper=mount(OverviewServiceSummary,{global:{stubs:{RouterLink:{props:['to'],template:'<a><slot/></a>'}}}});await flushPromises()
 let resolve!:(v:ProjectRead)=>void;read.loadProjects=()=>new Promise(done=>{resolve=done})
 const pending=store.refreshProjects(true);await flushPromises();const tag=()=>wrapper!.get('[data-service="Companion"] .companion-status-tag')
 expect(tag().text()).toBe('已连接');expect(tag().attributes('aria-busy')).toBe('false')
 resolve(data());await pending;read.loadProjects=async()=>{throw Error('offline')};await store.refreshProjects(true);await flushPromises();expect(tag().text()).toBe('读取异常');expect(tag().classes()).not.toContain('el-tag--success')
})

it('retains overview cards/order but replaces old ready Bridge evidence with pending verification on failed reads',async()=>{
 setActivePinia(createPinia());const read=source();registerCompanionBrowserProvider(read);const store=useCompanionBrowserStore();await store.connect(read)
 wrapper=mount(RegisteredProjectOverview,{global:{plugins:[ElementPlus],stubs:{RouterLink:{props:['to'],template:'<a><slot/></a>'}}}});await flushPromises()
 const card=wrapper.get('.registered-project-card'),node=card.element;expect(card.get('.project-bridge').text()).toContain('已就绪')
 read.loadProjects=async()=>{throw Error('offline')};await store.refreshProjects(true);await flushPromises()
 expect(wrapper.get('.registered-project-card').element).toBe(node);expect(card.get('.project-bridge').text()).toContain('待核对');expect(card.get('.project-bridge').text()).not.toContain('已就绪')
 expect(card.get('.project-bridge .el-tag').classes()).toContain('el-tag--warning');store.disconnect();await flushPromises();expect(wrapper.find('.registered-project-card').exists()).toBe(false)
})
