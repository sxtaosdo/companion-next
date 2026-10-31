import { afterEach, describe, expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ElementPlus from 'element-plus'
import App from '../src/App.vue'
import { routes } from '../src/router'
import DevelopmentWorkflowView from '../src/views/DevelopmentWorkflowView.vue'
let wrapper:ReturnType<typeof mount>|undefined
afterEach(()=>{wrapper?.unmount();wrapper=undefined;localStorage.clear();document.body.innerHTML=''})
describe('workflow uses the existing primary navigation',()=>{
 it('registers a workspace-independent route for the read-only workflow view',()=>{const route=routes.find(route=>route.path==='/workflow');expect(route?.component).toBe(DevelopmentWorkflowView);expect(route?.meta).toMatchObject({title:'开发工作流',workspaceIndependent:true});expect(route?.meta?.description).toContain('GSD');expect(route?.meta?.description).toContain('OpenSpec')})
 it('keeps workflow reachable, active and compact through the existing collapsed sidebar',async()=>{
  const view={template:'<div>Existing route content</div>'},router=createRouter({history:createMemoryHistory(),routes:routes.map(route=>['/workflow','/about'].includes(route.path)?{path:route.path,meta:route.meta,component:view}:route)})
  await router.push('/about');await router.isReady()
  wrapper=mount(App,{attachTo:document.body,global:{plugins:[createPinia(),router,ElementPlus],stubs:{ArtWorkspaceView:true,CompanionSessionRecovery:true,CompanionUserMenu:true,CompanionDevTools:true}}});await flushPromises()
  const link=wrapper.get('a[aria-label="开发工作流"]');expect(link.attributes('href')).toBe('/workflow');await link.trigger('click');await flushPromises()
  expect(router.currentRoute.value.path).toBe('/workflow');expect(link.attributes('aria-current')).toBe('page');expect(wrapper.find('.page-heading').exists()).toBe(false);expect(wrapper.find('.compact-page-back').exists()).toBe(true);expect(wrapper.find('.source-banner').exists()).toBe(false)
  await wrapper.get('.navigation-toggle').trigger('click');await flushPromises();expect(wrapper.get('.sidebar').classes()).toContain('is-collapsed');expect(wrapper.get('a[aria-label="开发工作流"]').attributes('title')).toBe('开发工作流')
 })
})
