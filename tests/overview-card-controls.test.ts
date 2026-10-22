import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import App from '../src/App.vue'
import { routes } from '../src/router'
import { companionBrowserProvider, companionProjectEntryProvider, registerCompanionBrowserProvider } from '../src/companion-browser-integration'
import { useCompanionBrowserStore } from '../src/stores/companion-browser'
import type { CompanionBrowserProvider, ProjectRead } from '../src/domain/companion-browser'
let wrapper: VueWrapper | undefined
let history: ReturnType<typeof createMemoryHistory> | undefined
async function enter() {
 const pinia=createPinia()
 const result:ProjectRead={projects:[{id:'project-a',name:'Alpha',path:'D:/Alpha'}],statuses:[{projectId:'project-a',state:'ready',capabilityProfile:'authoring'}],dashboard:[],warnings:[]}
 const source:CompanionBrowserProvider={label:'isolated source',runtimeProbesEnabled:true,dashboardDiscoveryEnabled:false,loadProjects:vi.fn(async()=>result),loadCounts:vi.fn(async()=>({sessionId:'test',counts:{},latest:{}})),loadLogs:vi.fn(async()=>[]),loadCalls:vi.fn()}
 registerCompanionBrowserProvider(source)
 const directory=useCompanionBrowserStore(pinia);await directory.connect(source)
 const router=createRouter({history:history=createMemoryHistory(),routes});await router.push('/overview');await router.isReady()
 wrapper=mount(App,{attachTo:document.body,global:{plugins:[pinia,router,ElementPlus]}});await flushPromises()
 return {router,directory}
}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;history?.destroy();companionBrowserProvider.value=null;companionProjectEntryProvider.value=null;document.body.innerHTML='';vi.restoreAllMocks()})
describe('overview project controls and primary navigation',()=>{
 it('keeps projects directly after overview before the artwork group',async()=>{
  await enter()
  const primary=wrapper!.findAll('.nav-list > .nav-item')
  expect(primary.slice(0,2).map(node=>node.attributes('href'))).toEqual(['/overview','/projects'])
  const children=Array.from(wrapper!.get('.nav-list').element.children)
  expect(children.indexOf(primary[1]!.element)).toBeLessThan(children.findIndex(node=>node.getAttribute('href')==='/art-resources'))
 })
 it('uses the same runtime tag as projects, an accessible arrow link, and no sorting instruction',async()=>{
  const {router}=await enter(),card=wrapper!.get('[data-project-id="project-a"]')
  expect(card.get('.project-status-trigger .el-tag').classes()).toContain('el-tag--success')
  expect(card.text()).not.toContain('按最近使用排序');expect(card.text()).not.toContain('未返回最近使用时间')
  const link=card.get('a.project-title')
  expect(link.attributes('aria-label')).toBe('查看工程 Alpha');expect(link.attributes('title')).toBe('查看工程 Alpha')
  expect(link.find('.project-open-icon svg').exists()).toBe(true);expect(link.attributes('href')).toBe('/projects?project=project-a')
  ;(link.element as HTMLAnchorElement).focus();expect(document.activeElement).toBe(link.element)
  await link.trigger('click');await flushPromises();expect(router.currentRoute.value.fullPath).toBe('/projects?project=project-a')
 })
 it('updates stopped and unknown without retaining a ready tag or presenting errors as readiness',async()=>{
  const {directory}=await enter()
  directory.statuses=[{projectId:'project-a',state:'stopped',capabilityProfile:'unknown'}];await flushPromises()
  expect(wrapper!.get('.project-status-trigger .el-tag').classes()).toContain('el-tag--info')
  directory.statuses=[];await flushPromises()
  expect(wrapper!.find('.project-status-trigger').exists()).toBe(false)
  expect(wrapper!.get('.project-bridge .el-tag').classes()).toContain('el-tag--info')
 })
})
