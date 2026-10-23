import {afterEach,describe,expect,it,vi} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import {createMemoryHistory,createRouter} from 'vue-router'
import {createPinia} from 'pinia'
import ElementPlus from 'element-plus'
import App from '../src/App.vue'
let wrapper:ReturnType<typeof mount>|undefined
async function setup(path='/about'){
 const router=createRouter({history:createMemoryHistory(),routes:[{path:'/:all(.*)*',component:{template:'<div>Current page</div>'}}]});await router.push(path);await router.isReady()
 wrapper=mount(App,{attachTo:document.body,global:{plugins:[createPinia(),router,ElementPlus],stubs:{ArtWorkspaceView:true,CompanionSessionRecovery:true,CompanionUserMenu:true}}});await flushPromises();return router
}
afterEach(()=>{wrapper?.unmount();wrapper=undefined;localStorage.clear();document.body.innerHTML='';vi.restoreAllMocks()})
describe('compact existing navigation',()=>{
 it('folds, preserves destinations and restores only its display preference',async()=>{
  const r=await setup();await wrapper!.get('button[aria-label="收起导航"]').trigger('click');await flushPromises()
  expect(wrapper!.get('.sidebar').classes()).toContain('is-collapsed');expect(localStorage.getItem('companion.navigation.collapsed')).toBe('true')
  expect(wrapper!.get('a[aria-label="工程"]').attributes('title')).toBe('工程');expect(wrapper!.get('a[aria-label="美术资源"]').attributes('href')).toBe('/art-resources')
  await wrapper!.get('button[aria-label="知识库"]').trigger('click');await flushPromises()
  const sub=document.querySelector('nav[aria-label="知识库子导航"]')!;expect(sub).toBeTruthy();expect(sub.querySelectorAll('a')).toHaveLength(3)
  await r.push('/knowledge/qa');await flushPromises();expect((wrapper!.vm as unknown as {knowledgePopover:boolean}).knowledgePopover).toBe(false)
  wrapper!.unmount();wrapper=undefined;await setup();expect(wrapper!.get('.sidebar').classes()).toContain('is-collapsed')
  await wrapper!.get('button[aria-label="展开导航"]').trigger('click');expect(localStorage.getItem('companion.navigation.collapsed')).toBe('false')
 })
 it('uses the existing narrow drawer without overwriting desktop preference',async()=>{
  localStorage.setItem('companion.navigation.collapsed','true');await setup();Object.defineProperty(window,'innerWidth',{value:375,writable:true,configurable:true});window.dispatchEvent(new Event('resize'));await flushPromises()
  expect(wrapper!.get('.sidebar').classes()).not.toContain('is-collapsed');await wrapper!.get('button[aria-label="打开导航"]').trigger('click');expect(wrapper!.get('.sidebar').classes()).toContain('is-open');expect(localStorage.getItem('companion.navigation.collapsed')).toBe('true')
  window.innerWidth=1024;window.dispatchEvent(new Event('resize'));await flushPromises();expect(wrapper!.get('.sidebar').classes()).toContain('is-collapsed')
 })
 it('keeps the common workspace header and production-visible original tools reachable',async()=>{
  await setup('/art-resources?project=one');expect(wrapper!.find('.page-heading').exists()).toBe(false);expect(document.querySelector('button[aria-label="打开开发工具"]')).toBeTruthy();expect(wrapper!.find('.topbar .breadcrumb').exists()).toBe(true)
 })
})
