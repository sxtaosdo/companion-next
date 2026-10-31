import {expect,it} from 'vitest'
import {mount,flushPromises} from '@vue/test-utils'
import {createPinia} from 'pinia'
import {createMemoryHistory,createRouter} from 'vue-router'
import ElementPlus from 'element-plus'
import App from '../src/App.vue'
it('renders the same single sidebar and topbar on direct workflow and representative existing routes',async()=>{
 const router=createRouter({history:createMemoryHistory(),routes:['/workflow','/about'].map(path=>({path,component:{template:'<p>content</p>'}}))})
 await router.push('/workflow?task=original-id');await router.isReady()
 const w=mount(App,{global:{plugins:[createPinia(),router,ElementPlus],stubs:{CompanionSessionRecovery:true,CompanionDevTools:true,ArtWorkspaceView:true}}})
 try{for(const url of ['/workflow?task=original-id','/about','/workflow?task=original-id']){
  await router.push(url);await flushPromises()
  expect(w.findAll('aside.sidebar')).toHaveLength(1);expect(w.findAll('header.topbar')).toHaveLength(1)
  expect(w.classes()).not.toContain('workflow-prototype-shell')
  expect(w.findComponent({name:'ShellBreadcrumb'}).exists()).toBe(true)
  expect(w.findComponent({name:'ShellRouteTabs'}).isVisible()).toBe(true)
 }}finally{w.unmount()}
})
