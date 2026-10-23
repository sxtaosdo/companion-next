import {describe,it,expect,vi,afterEach} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import {createRouter,createMemoryHistory} from 'vue-router'
import ElementPlus from 'element-plus'
import {breadcrumbLabels,visitShellTab} from '../src/domain/shell-navigation'
import ShellRouteTabs from '../src/components/ShellRouteTabs.vue'
import CompanionUserMenu from '../src/components/CompanionUserMenu.vue'
import {COMPANION_SESSION_REQUIRED_EVENT} from '../src/domain/companion-session-recovery'
const router=()=>createRouter({history:createMemoryHistory(),routes:[{path:'/:all(.*)*',component:{template:'<div/>'}}]})
afterEach(()=>{vi.unstubAllGlobals();document.body.innerHTML=''})
describe('approved shell reuse',()=>{
 it('keeps exact project and knowledge destinations; breadcrumbs are display hierarchy',async()=>{
  const r=router();await r.push('/knowledge/qa?project=one');const location=r.currentRoute.value
  expect(breadcrumbLabels(location)).toEqual(['知识库','问答'])
  let tabs=visitShellTab([],location);await r.push('/knowledge/qa?project=two');tabs=visitShellTab(tabs,r.currentRoute.value)
  expect(tabs.map(tab=>tab.to)).toEqual(['/knowledge/qa?project=one','/knowledge/qa?project=two'])
  expect(visitShellTab(tabs,r.currentRoute.value)).toHaveLength(2)
 })
 it('switches, closes current and preserves another project query without triggering actions',async()=>{
  const r=router();await r.push('/projects?project=one');const w=mount(ShellRouteTabs,{global:{plugins:[r,ElementPlus]}})
  await r.push('/art-resources?project=two&type=icon');await flushPromises()
  expect(w.findAll('[role=tab]')).toHaveLength(2)
  await w.findAll('[role=tab]')[0]!.trigger('click');await flushPromises();expect(r.currentRoute.value.fullPath).toBe('/projects?project=one')
  await w.findAll('.close-tab')[0]!.trigger('click');await flushPromises();expect(r.currentRoute.value.fullPath).toBe('/art-resources?project=two&type=icon');expect(w.findAll('[role=tab]')).toHaveLength(1);w.unmount()
 })
 it.each([[{kind:'account',username:'verified-user'},'verified-user'],[{kind:'local'},'本机授权'],[undefined,'已登录（身份未提供）']])('shows only server-provided identity',async(session,label)=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({authenticated:true,session})));vi.stubGlobal('fetch',fetch)
  const w=mount(CompanionUserMenu,{global:{plugins:[ElementPlus]}});await flushPromises();expect(w.text()).toContain(label)
  expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0]![0]).toBe('/api/ui/session');w.unmount()
 })
 it('clears expired identity and ignores a late response after unmount',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({authenticated:true,session:{kind:'account',username:'verified-user'}}))))
  const w=mount(CompanionUserMenu,{global:{plugins:[ElementPlus]}});await flushPromises();window.dispatchEvent(new Event(COMPANION_SESSION_REQUIRED_EVENT));await flushPromises();expect(w.text()).toContain('登录已过期');expect(w.text()).not.toContain('verified-user');w.unmount()
 })
})
